# Codex live bubble split — root cause (race in live reducer)

> 2026-06-16 | 诊断: 宪宪/Opus-48 | F194 post-close regression（codex 气泡裂 saga 第 17 轮的**根因记录**）
> 状态: **root cause confirmed (真实样本坐实, 见 §真实样本坐实-session5), fix not yet implemented**
> ⚠️ 下方 §根因 / §修复方向 的"parent-id 建泡 + 6 条件启发式竞态"是 **2026-06-16 的早期假设**，
> 已被 2026-06-17 (session #5) 铲屎官 devtools 真实样本**修正**：真根因是 **dual-path（active + background
> 双路径）各建一泡 + background 关联了一个非持久化的不同 turnInvocationId**。以 §真实样本坐实 为准。

## 症状（铲屎官 runtime catch）

codex（砚砚, gpt-5.5, `codex exec` CLI）的一个 turn 在 **live** 渲染时裂成两个气泡：
[正文泡（含 cost footer）] + [下面一个**只有 tool call** 的额外气泡]。**F5 / 硬刷新后合并成一个**。

- **codex 裂的概率 >> gpt52**（缅因猫 GPT-5.4）
- **不是必现**（intermittent → 竞态，非确定性）

## 确认的事实（真实 runtime 数据，非推断）

1. **持久化数据正确，零裂**。OKF thread (`thread_mqg40i0bgpahdh9s`) 最新 codex 消息持久化是
   **单条 record**：`turnInvocationId=1ba442cb-b245-...`、textLen=1362、**nTools=4**、origin=stream。
   另一 thread (`thread_mqevrpipz1prrvh3`) 全部 codex turn 同样是每 turn 一条 record、turnInvocationId 正常 stamp、
   **无任何同-turnInvocationId 的多 record**。→ 后端 + Z9 turn-id stamp 对持久化记录有效。
2. **F5 / hydration 正确合并**。`useChatHistory.ts` 的 hydration 投影按 turnInvocationId 确定性分组，
   读持久化单 record → 一个气泡。这正是"F5 后合并"。
3. **裂 100% 是 live reducer 产物**（`useAgentMessages.ts`）。同一个 turn（持久化为一条 record）
   被 live 增量 reducer 拆成两个气泡。

## 根因

codex CLI（`codex-event-transform.ts`）的 stream 事件（tool_use / 工作日志 / text）与
`invocation_created` 事件（携带 per-turn `turnInvocationId`，`invoke-single-cat.ts:646`）之间存在
**竞态**：当 tool stream 先于 invocation_created 到达前端时，live reducer 先用 **parent invocationId**
建了一个 tool-only 气泡；等 turn-id 到达，`finalizeStaleBackgroundInvocationStreams`
(`useAgentMessages.ts` line 636-676) 的 **6 条件绑定启发式**判定该不该把 parent-only 泡升级进当前 turn。
启发式没绑上时 → `setThreadMessageStreaming(false)` + `markReplacedInvocation` → **裂**（注释原文:
"Finalizing it here ... is exactly what splits the work-log bubble from the later turn text"）。

- **为什么 codex >> gpt52**：codex CLI 先吐工具/工作日志 stream，turn-id 后到 → 高频踩竞态窗口；
  gpt52 流式顺序不同，很少踩。
- **为什么不是必现**：tool stream 与 invocation_created 异步赛跑，turn-id 有时及时到（不裂）、有时晚到（裂）。

## 为什么 16 轮没修好 + #2319 也没用

每轮（Z1-Z13 / #1716 / #2304 / #2319）都在**给启发式加条件**或**修 hydration 侧 residue**。
但 (a) hydration 侧本来就对（F5 合并是证据），(b) live 侧的根因是**竞态下用 parent-id 先建泡再猜归属**，
加第 N 个时序条件只能堵某一种 race，下一种又漏。**#2319 改的是 `useChatHistory.ts`（hydration），
完全是错的层** —— 那条路没裂。

## 修复方向（结构性，不是第 17 个启发式条件）

**坐标系问题**：live 增量 reducer 在猜 bubble 归属，而持久化投影（hydration 用的）是确定性的、正确的。
两个候选（需 trace `codex-event-transform` + `invoke-single-cat:646` 的实际排序后定）：

- **A. 后端串行化**：保证 codex 的 `invocation_created`（turn-id）在**首个 tool stream 之前** flush 到前端，
  消灭 parent-only 窗口，从源头对齐 gpt52。竞态根除。
- **B. 前端收敛**：让 live reducer 复用 hydration 的确定性投影（按 turnInvocationId 分组），
  不再靠 parent-id 先建泡 + 时序启发式。

A 治本（消灭竞态）但要改后端流式；B 让两条路径共享一套投影（Z8 unified projection 的初衷未竟）。
**动手前必须 trace 实际事件排序定哪条，并与砚砚（codex 流式 + 这段 reducer 的 author）对齐**——
saga 16 轮都栽在"不对齐方法就直接 patch"。

## Evidence 锚点

- 裂泡形态截图: 铲屎官 2026-06-16 OKF thread + thread_mqevrpipz1prrvh3
- live reducer 启发式: `packages/web/src/hooks/useAgentMessages.ts:636-680`
- turn-id 发射: `packages/api/.../invocation/invoke-single-cat.ts:646`
- codex 流式转换: `packages/api/.../providers/codex-event-transform.ts`
- hydration 正确投影: `packages/web/src/hooks/useChatHistory.ts`（#2319 改在这里 = 错层）

## 深化 trace（2026-06-16 宪宪/opus-48）

进一步 trace 把 A/B 天平**强烈推向 B（前端 live reducer）**，但未 100% 敲死（race，需实时事件序列证实）：

- **后端 stamping 经检查正确**：`invoke-single-cat.ts:643` 先于 agent stream loop yield `invocation_created`；
  `route-serial.ts:1089` 处理它 set `ownInvocationId`，:1019 之后的 stream 事件 stamp `invocationId=ownInvocationId`；
  `visible-turn.ts stampVisibleTurn` 对 live broadcast + 持久化都给 `turnInvocationId`。持久化 record 的 turnInvocationId
  实测正确 → 后端没乱序、没漏 stamp。**所以 fix 不在后端排序（A 不是主因）。**
- **裂在前端 live reducer**（`useAgentMessages.ts` active 路径 `handleAgentMessage`）：即使收到正确 stamp 的事件，
  增量建泡 + 6 条件绑定启发式仍会把同 turnInvocationId 的 stream 事件拆成两个 bubble。`finalizeStaleBackgroundInvocationStreams`
  (:636-680) 是 background 路径的同型逻辑；active 路径有对应的建泡/recover 逻辑（:900+ 区域，多路径，复杂）。
- **为什么没在本轮直接修**：active 路径建泡逻辑是 16 轮打磨的复杂多路径代码；要写**确定性红测**复现这个 race，
  需要 OKF 那次裂的**真实 live 事件序列**（哪个事件先到、带什么 id）。冷读代码不足以可靠构造该序列；
  硬猜一个红测 = 可能根本没复现真 bug = 假绿/round-17。

**下一轮最高效路径（二选一）**：
1. **砚砚（reducer + codex 流式的 author）**当 budget refill 后接手——他的代码、他最快能钉死 race 序列。
2. **runtime capture**：在 active 路径建泡处加一行 log（或 devtools 直接 dump 裂开那刻 `useChatStore` 里两个 codex
   bubble 的 `extra.stream.invocationId/turnInvocationId`），拿到真实序列 → 写确定性红测 → 修 → 绿。
   裂自愈于 F5，属 live-only cosmetic（非数据丢失），可作为 done-time 用 hydration 同款确定性投影 re-project 收敛。

---

## 真实样本坐实（session #5, 2026-06-17, 宪宪/opus-48 + 铲屎官 devtools dump）

砚砚 budget 仍空，无法 runtime 复现；改由**铲屎官在他自己前端用 devtools 抓当时还在屏幕上的裂泡**（store 未暴露到
window → 用 React fiber 按消息形状捞 `useChatStore` 消息；脚本见本 saga thread）。拿到**两个裂泡的完整真实数据**，
把根因从"假设"升级为"坐实"。

### 裂开的两个 bubble（同一次 codex 回复，parent=`ff1d8e85-50e8-4355-bb5f-b830f4bd59d5`, session=`019ecf3d`）

| 字段 | bubble A（active path） | bubble B（background path） |
|---|---|---|
| `extra.stream.invocationId`（parent） | `ff1d8e85…` | `ff1d8e85…`（**相同**） |
| `extra.stream.turnInvocationId` | `1ba442cb…` | `ac378b26…`（**不同**） |
| bubble `id` | `0001781664577010-…`（后端持久化 messageId） | `msg-ac378b26-…-codex`（active-ledger `deriveBubbleId`） |
| `content` | 有（长文 1362 字） | **空** |
| `toolEvents` ids | `tool-1781664603935-k4m4` / `toolr-…` | `bg-tool-use-1781664603935-924` / `bg-tool-result-…` |
| 4 个工具的 ts | 603935/603936/603937/603938 | **603935/603936/603937/603938（逐一相同）** |
| 工具 command | `rg -n "OKF…"` + `sed -n '1,220p'` | **逐字相同** |
| `usage.outputTokens` | 67 | 1641 |

### 决定性证据 → dual-path 根因

1. **同一批工具事件**：两泡的 4 个 toolEvent **ts 逐一相同、command 逐字相同**，只是 id 前缀不同
   （`tool-` / `toolr-` = **active 路径**；`bg-tool-use-` / `bg-tool-result-` = **background 路径**）。
   → 同一次 codex 回复被 **active path 和 background path 各处理了一遍**，各建一个 bubble。
2. **turnInvocationId 不一致是不合并的直接原因**：reducer stable key = `getStableInvocationKey`（turn 优先）。
   两泡 turn 不同（`1ba442cb` vs `ac378b26`）→ Z3 视作两个独立 turn → 不合并 → 裂。
3. **持久化真相 = `1ba442cb`（§确认的事实 #1：单 record、turn=`1ba442cb`、nTools=4）**。
   即 active 泡（`1ba442cb`）匹配持久化；**background 泡的 `ac378b26` 不在持久化里 = live-only 影子 turn id**。
   F5 后只剩持久化的那个 → 自愈成一个。
4. **content / usage 错位**（active 泡 out=67 却有长文；bg 泡 out=1641 却空 content）= 同一份回复的
   text / tool / usage 被两条路径**串味**分到了两个泡，进一步坐实"同一回复被双重处理"。

### UI 表现（铲屎官截图）

正文长文显示在 bubble A（footer `63.3k↓ 67↑`）；**另起一条独立消息**（带独立 message header + footer
`60.3k↓ 1.6k↑`）渲染成一个 **"CLI Output · 2 tools" 的纯工具气泡** = bubble B。用户看到「文字泡 + 多出来的纯工具泡」。

### 结构性修复方向（更新版，取代旧 §修复方向的 A/B）

根因不是"竞态先用 parent-id 建泡"，而是 **同一回复被 active + background 双路径重复处理，且 background 路径
关联了一个非持久化的不同 turnInvocationId**。所以结构性收敛点（**不是检测两泡再合并 = 又一个启发式**）：

- **C（最可能·治本）**：消除/抑制 background 路径对**已在 active 处理**的同一 (catId, parent invocationId) 回复重复建泡——
  F173 "dual write-path 统一" 的未竟残留。同一 socket 回复只能被一条路径建泡。
- **D（兜底·对齐 id）**：若双路径暂时无法收口，强制 background 与 active 对同一 parent invocation 使用**同一 turnInvocationId**
  （background 泡的 `ac378b26` 不该凭空出现）→ reducer 自然按 turn 合并。

### 待钉死的 open question（fix 前必答）

- **`ac378b26` 这个 turn id 从哪来？** 它不在持久化、不在 active 泡。background path（`useAgentMessages.ts` 的
  background event 逻辑 + `bg-tool-use-` id 生成处）如何为这次回复关联/生成了一个独立 turn id？这是 fix 的精确落点。
- **为什么 background path 会处理一个 active thread 的回复？**（thread 当时前台 vs 后台？socket 双发？）

### 红测构造（拿到真实序列后可写忠实红测）

模拟「同 parent invocationId、同一批 tool 事件，分别经 active 与 background 两条建泡路径、各带不同 turnInvocationId」
→ 断言收敛为 **1 个** assistant bubble。**注意**：现有 292 个 codex/bubble/dual-id 测试**全绿**（基础 race 场景已覆盖），
本 bug 是**未覆盖的双路径场景**——红测必须复现"双路径"这一维度，否则又是假绿。

### 复现状态

- ✅ 真实裂泡数据已抓（本节表格）。❌ codex(砚砚)无 budget，**无法 runtime 重新触发**——屏幕上这次是当前唯一活样本。
- ⏭️ 下一步：trace `useAgentMessages.ts` background path（`bg-tool-use-` id 生成 + turn id 关联）定位 `ac378b26` 来源 →
  worktree TDD 写双路径红测 → 结构 fix（方向 C/D）→ 云端 codex / opus47/46 review。

### fix 落点 trace（session #5 续，宪宪/opus-48 + Explore；标注 provenance）

> ⚠️ provenance：✅=本人 clean-read 或真实样本坐实；🔍=Explore subagent trace，实现前请 re-verify
> （本 session 深 context 下 Read 出现过 display 重复/损坏，行号可能漂移，**以函数名为锚**）。

- ✅ **同一回复双路径各建一泡**（真实样本：同 parent + 同 4 工具 ts + `tool-` vs `bg-tool-use-` id 前缀）。
- ✅ **bg toolEvent id 生成**：`useAgentMessages.ts` `handleBackgroundAgentMessage` 内 `bg-tool-use-${ts}-${nextBgSeq()}` / `bg-tool-result-…`（约 :2306 / :2362）。
- ✅ **active toolEvent id 生成**：`handleAgentMessage` active 分支 `tool-${Date.now()}-${rand}` / `toolr-…`（约 :4298 / :4378）。
- ✅ **bg path turnInvocationId 解析**（约 :1635，`ensureBackgroundAssistantMessage`）：
  `msg.turnInvocationId ?? store.getThreadState(threadId).catInvocations[catId]?.turnInvocationId` → 喂给 `deriveBubbleId` 建 `msg-{turn}-codex`。
  **当 `msg.turnInvocationId` 缺失时 fallback 到 store 的 catInvocations，可能拿到与 active/持久化不一致的 turn（= `ac378b26` 来源最大嫌疑）。**
- 🔍 **active path turn 解析走不同函数** `resolveEffectiveTurnInvocationIdForCat()`（与 bg 的 fallback 不同源 → 两路径 turn 可不一致）。**re-verify**。
- 🔍 **路由条件** `handleAgentMessage`（约 :3828）：`isActiveThreadMessage = msg.threadId === store.currentThreadId`；否则走 `handleBackgroundAgentMessage`。
  **假说：一次回复跨越 currentThreadId 切换（用户切 thread）/ 或事件重放时，同 parent 先后命中两条路径** → 各建一泡。**re-verify（真实样本是同一批工具全量出现在两泡 = 重复处理，非分割，需确认是切 thread 还是 socket 重发/backfill 重放）**。
- 🔍 **dedup guard 用 streamKey（catId+invocationId），不含 turnInvocationId**（约 :3882 `clearBackgroundStreamRefForActiveEvent`）→ turn 不一致时 bubble id mismatch 击败去重。**re-verify**。

### 结构 fix 候选（实现者与砚砚/作者对齐后定，勿在未对齐下 patch — saga 16 轮教训）

- **C（治本）**：一次回复只允许一条路径建泡——用 **(catId, parent invocationId) 共享 ledger** 让 active claim 后 background 不再为同一 parent 重复建泡（F173 dual-write-path 未竟收口）。
- **D（兜底）**：bg path **禁止 fallback 到 store catInvocations 拿 turn**；无 `msg.turnInvocationId` 时不另立 turn，而是与 active 对齐同一 turn（或不建泡等 active）。
- **Z3 兼容红线**：fix 不能破坏 Z3「same-parent **真** multi-turn-same-cat 不合并」——必须区分「同回复双路径 artifact（应合并/去重）」vs「合法多 turn（应分开）」。鉴别量：artifact 两泡的 toolEvents 完全相同（同 ts/command）+ 其一 content 空。
- **红测**：模拟「同 parent、同一批 tool 事件经 active+background 两路径、各带不同 turn」→ 断言收敛 1 泡。现有 292 测试全绿（基础 race 已覆盖），本 bug 是**未覆盖的双路径维度**，红测必须复现「双路径」否则假绿。

### 路由（session #5 收尾）

砚砚（reducer + codex 流式 author）无 budget，无法实时对齐；fix 属架构级（双路径收口 / turn-id 一致性 / dedup key），README 红线要求作者对齐。**建议**：砚砚 budget refill 后接手（最快钉死），或 opus47（跨族 + 能写代码 + review）在 fresh context 实现、云端 codex review。诊断侧已闭环（真根因 + 精确落点 + fix 候选 + 红测构造全在本节）。

---

## 机制钉死 + 精确 fix（session #5 续2, 铲屎官第一手场景 + 代码核验）

铲屎官第一手观察（A2A 场景）：「我在看**别的会话**，砚砚被 A2A 叫出来回复，那个 has-tool 气泡和正文其实是**同一个**回复，他自己分成了两个」。结合代码核验，open question **全部钉死**：

### 触发机制 = currentThreadId 中途切换（不是 socket 双发，不是 A2A 双投递）

- ✅ **单 msg 单路径**（核验 `handleAgentMessage` :3822-3836）：每条 msg **fresh 读** `useChatStore.getState().currentThreadId`，`isActiveThreadMessage = msg.threadId === currentThreadId`；background 分支 early `return`。一条 msg 只走一条路径。
- ✅ **同一回复跨两路径的根因**：`currentThreadId` 无 per-reply pinning。codex 在 thread Y 流式回复时，operator 视图在 Y↔X 间**中途切换** → 切换前的事件走一条路径、切换后的走另一条。A2A 场景高发是因为**A2A 回复常发生在用户没盯着的 thread**（用户切入/切出该 thread 的概率高）。`requestStreamCatchUp` 重放会放大，但根是 per-msg fresh 读 currentThreadId。
- ✅ **纯 active 不裂**：全程 `currentThreadId == 回复 thread` → 全走 active 单路径，turn 解析一致 → reducer 归一泡（292 测试印证）。

### turn 不一致根因（核验）= 两路径 fallback 不同源

codex 的 tool/work-log stream 事件**不带 `msg.turnInvocationId`**（只有 `invocation_created` 带）。此时：
- **active**（`resolveEffectiveTurnInvocationIdForCat`）：`msg.turnInvocationId` → `catInvocations[cat].turnInvocationId` → **再 fallback 到 active ledger 泡的 bound turn**（`getActiveBubbleLedger(...).turnInvocationId`）。
- **background**（:1635）：`msg.turnInvocationId` → `catInvocations[cat].turnInvocationId` **only**（**无 ledger fallback**；非当前 thread 的 catInvocations 易 stale/unset）。
→ 同一回复两路径绑**不同 turn** → reducer `getStableInvocationKey` 按 turn 当两个 → 裂。

### 精确 fix（收敛版，取代上方 C/D 的模糊表述）

**统一两路径的 turn 解析**：让 background path（:1635 `ensureBackgroundAssistantMessage`）也加上 active 同款 **ledger-bound-turn fallback**——这样同一回复无论事件走哪条路径，都解析出 active 已 bound 的同一 turn → reducer 自然归一泡。

> 🔑 **关键正确性精化（session #5 续3，clean-read 核验 :2791-2806）——避免 round-17 回归**：
> **不能**让 background 直接调 active 的 `resolveEffectiveTurnInvocationIdForCat`。原因：
> (1) 它是 :2791 的 **hook 内 useCallback 闭包**，而 `ensureBackgroundAssistantMessage` 是 :1630 的 **module-level 纯函数**，作用域不通；
> (2) 更致命——active resolver 用 **`threadIdRef.current`（= 当前 active 线程）** 查 ledger：`getActiveBubbleLedger(getThreadRuntimeLedger(), threadIdRef.current, catId)`。但 background 处理的回复在 **`msg.threadId`（= 回复线程 Y，≠ 已切走的 active 线程 X）**。若 background 照搬 `threadIdRef.current` 会查**错线程**的 ledger，拿不到 thread Y 在 active 阶段绑定的 turn。
> **正确 fix**：在 `ensureBackgroundAssistantMessage`（~:1635）的 turn 解析里，在 `catInvocations` fallback **之前**插一层 **按 `msg.threadId` 查 ledger**：
> `getActiveBubbleLedger(getThreadRuntimeLedger(), msg.threadId, msg.catId)?.turnInvocationId`
> （`getActiveBubbleLedger` / `getThreadRuntimeLedger` 是文件顶部 module-level import，background 纯函数可直接调）。
> 即 background turn 解析变为：`msg.turnInvocationId ?? getActiveBubbleLedger(ledger, msg.threadId, catId)?.turnInvocationId ?? catInvocations[cat]?.turnInvocationId`。
> 这样切走前 active 在 thread Y 绑定的 turn(`1ba442cb`)被 background 复用 → 与 active 泡同 turn → reducer 合并。真正不同 invocation 的 multi-turn 各有各的 ledger bubble，turn 仍不同 → Z3 不破。

- **为什么不破坏 Z3**：Z3 要分开的是**真正不同 invocation_created 的 multi-turn**（turn id 真不同）；本 fix 只在 `msg.turnInvocationId` 缺失时让两路径 fallback **同源**，真正不同的 turn 仍不同 → 合法 multi-turn 仍分开。
- **改动面**：turn 解析源统一（background 复用 active 的 resolver / 加 ledger fallback），**不碰 reducer 核心、不碰 Z3 stable key 语义** → 比"架构级双路径收口"轻得多，是 F173 dual-path 统一的收尾。
- **红测**：`installActiveHarness` 模拟「回复事件流中途 `currentThreadId` 从 Y 切走 → 后续事件走 background path，且 tool 事件无 msg.turnInvocationId」→ 断言收敛为 **1** 个 codex stream bubble。这是现有 292 测试**未覆盖的"中途切 thread 双路径"维度**。

> ⚠️ Read 可靠性：本 session 深 context 下 Read 多次出现 display 重复/损坏（如同作用域 `const` 重复=编译不过的假象）。上面行号经函数名锚定核验过核心逻辑，但**实现者动手前仍应在干净 context 下重读确认确切行**，尤其 `resolveEffectiveTurnInvocationIdForCat` 全文 + :1635 上下文。
