---
feature_ids: []
related_features: [F216, F215, F118]
topics: [invocation, queue, routing, liveness, a2a, ux, visibility]
doc_kind: bug-report
created: 2026-06-02
---

# Bug Report: A2A 回复撞上长 busy invocation → 排队等待全程不可见（体感"跨线程通讯卡死"）

> 发现：2026-06-02 | 报告链：铲屎官截图 → 宪宪(Opus-4.8) 初诊 → 砚砚(GPT-5.5) live 日志取证 + 交接 → 宪宪(Opus-4.8) 执行
> 性质：**queue 可见性 / UX 缺口**（非新 feature；归 F216 抢占覆盖面 follow-up；不新开 F 号，bug fix 口径）
> 状态：**修复完成（frontend-only），砚砚 R1 review 提 P1+P2，已修复待复审** | 分支 `fix/a2a-queue-visibility`
> 最终方案：**纯前端**——QueuePanel 读 live `activeInvocations` 渲染等待原因。后端 `message.extra.queuedBehind` 方案**已放弃**（见 §4）。

## 1. 报告人 / 怎么发现的

铲屎官截图：46/`opus` 发起 cross-thread 通讯后，自己界面长期"执行中"，对面（codex）已回复，但这边一条 Cross-Thread Sync 消息一直挂"排队中"，体感像"cross_post / MCP 机制卡死"。原话："到底是46卡住了，还是什么奇怪的mcp机制"。

## 2. 现象 / 期望 vs 实际

| | 期望 | 实际 |
|---|---|---|
| A2A 回复排队 | 明确告知"在等 X 猫的当前回合（已运行 Ym）" | 裸"排队中"，无任何等待原因 → 误判为系统卡死 |

## 3. 根因分析（代码 + live 日志双证）

### 3.1 不是什么（已排除）
- **不是 cross_post / MCP bug**：`handleCrossPostMessage`（`mcp-server/.../callback-tools.ts:715`）只调 `_executePostMessage` 立即返回，非阻塞。截图 stdout 已返回 = 工具早成功。
- **不是缺 stall watchdog**：`#774` idle-silent auto-kill 存在（`cli-spawn.ts:490`、`ProcessLivenessProbe.getState()` line 88-92）。判别器：`idle-silent`（CPU 不涨）才杀；`busy-silent`（CPU 涨）不杀反而 `shouldExtendTimeout()`。46 那轮 CPU 在涨（thinking / F215 malformed 恢复），属 busy-silent → **按设计正确地没杀**，避免误伤长推理。
- **不是 2026-05-29 那个"收尾不可靠→永久 busy"回归**（`docs/bug-report/2026-05-29-invocation-stale-active-recovery/`，已修 fc72d1b0a）：那是 invocation 结束但 slot 不释放 → 永久排队。本 case 46 是**真在跑**，结束后队列**确实 drain**（砚砚 live 日志证实），是**临时**等待，不是僵尸。

### 3.2 真根因（live 现场，砚砚取证）
- live runtime `1aee60fe0`
- 46/`opus` 当轮：`2026-06-02T11:19:18Z` 开始 → `11:42:27Z` 结束（约 23 分钟），结束触发 F215 malformed tool-call recovery（thinking-only / form A）
- codex 回复 `11:33:08Z` 落到 46 thread，因 46 仍 busy → 走 `routing-decision.ts` 的 `skip: dedup_active` / `defer_queue`（line 28/97/114）→ 排队
- **F216 已交付 supersede/last-wins/抢占，但只覆盖"用户 re-prompt / Steer / stop"触发；incoming A2A 回复落到正忙的猫不进抢占路径，只 defer/dedup 排队**
- **可见性缺口**：排队态浮现到前端的 `queue_updated` 事件（`QueueProcessor.ts:388/848/1249`）payload 只有 `queue` 列表 + `action`，**不含"在等哪个 active invocation / 起于何时 / liveness 状态"** → 用户无法区分"系统卡死" vs "在等当前回合"

### 3.3 共同结论
长 busy invocation 占住同 cat/session 执行权是**正常串行**（F118 SessionMutex），后续 A2A 回复排队**正确**；缺的是**把"为什么在等"表达给用户**。

## 4. 修复方案（最终 = 纯前端可见性，不动自动抢占）

> 守门口径（砚砚交接）：别修 cross_post、别加泛化 watchdog、v1 不自动杀正在跑的猫（本 case 正好证明杀了更糟——46 在 malformed 恢复中）。自动 last-wins 留二阶段。

**最终实现（frontend-only）**：
1. `QueuePanel` 头部把裸"排队中" → "等待 {猫} 当前回合（已运行 Xm）"，数据源 = 前端 `chatStore.activeInvocations`（`Record<id,{catId,startedAt}>`，"执行中 {猫}"的 live 来源，已存在）。
2. 纯 helper `computeQueueWaitInfo(activeInvocations, queuedTargetCatIds, now?)`：**按 per-cat slot 语义**，优先取"可见 queued entry 的 targetCats ∩ active"中最老者；无 target 在 active 时回落 thread-level 最老 active。`formatElapsed` 格式化时长。
3. **不做**：不改 cross_post、不改 stall-kill、不加自动抢占、**后端零改动**。

**已放弃的备选（R0 探索 → revert，commit `68d894e12`）**：最初做了后端 `message.extra.queuedBehind`（helper `describeActiveInvocation` + callbacks/messages 4 处接线 + StoredMessage 类型）。实现中发现前端 `activeInvocations` 已有同样数据且 live，后端那层对 v1 是 **dead code 且不如 live 准**（入队时刻快照 vs 此刻在等谁），故全部 revert。**教训：动后端前先确认前端消费方。**

## 5. 验证（已完成）

- 纯 helper 红→绿：`computeQueueWaitInfo` / `formatElapsed` 单元测，含 **砚砚 P1 回归**（更老非 target active + target active → 显示 target）。
- 渲染测：active 存在 → 显示等待行；无 active → 不显示（drain 不是卡死）；**P1 端到端**（codex 更老 + entry target opus + opus active → 显示 opus 不显示 codex）。
- `queue-panel-wait-reason.test.ts` **13/13 绿**；既有 queue-panel 7 文件 **37/37 零回归**；`pnpm exec tsc --noEmit` 0 error。
- 不误伤正常长推理（无自动抢占 / 无 kill 路径改动）。

## 6. 设计要点（最终）

- **真相源**：前端 `chatStore.activeInvocations`（thread-scoped flat mirror，砚砚复核确认非全局，跨 thread 误显风险非 P1）。
- **per-cat 归因（砚砚 R1 P1 修复）**：queue entry 等的是**它 target 那只猫的 slot**（后端 `threadId:catId` slot mutex，`QueueProcessor.ts:596`）。故 `computeQueueWaitInfo` 接 `queuedTargetCatIds`，优先归因 target∩active 中最老者，避免"显示更老的非 target 猫（codex）当阻塞者"。

## 7. 实现（最终方案 = 前端单独修）

> **重要 pivot（实现中发现）**：前端 `chatStore` **已有** `activeInvocations: Record<id, {catId, startedAt}>`
> live 状态（"执行中 {猫}"的来源）。QueuePanel 直接读它就能渲染"等待谁/等了多久"，
> 且比"入队时刻快照"**更准**（反映此刻在等谁，活进程变了也对）。故**撤回**最初的
> 后端 `message.extra.queuedBehind` 方案（对 v1 是 dead code）——改为纯前端。
> **教训（已认）**：动后端前先确认前端消费方，否则白写一层。

- [x] 后端 helper + message.extra 接线 → **已 revert**（commit `68d894e12`，理由见 §4）
- [x] 前端 QueuePanel 读 `activeInvocations` → 头部渲染"等待 {猫} 当前回合（已运行 Xm）"，把裸"排队中"变成可解释状态
- [x] 纯 helper `computeQueueWaitInfo` / `formatElapsed` 导出 + 红→绿
- [x] **砚砚 R1 P1 修复**：`computeQueueWaitInfo` 接 `queuedTargetCatIds`，按 per-cat slot 归因（target∩active 优先），加 P1 回归测（单元 + 渲染端到端）
- [x] 测试 `queue-panel-wait-reason.test.ts` 13/13 绿 + 既有 queue-panel 37/37 零回归 + tsc 0 error
- [ ] 砚砚复审通过 → merge-gate（本地→云端）

**已知限制（v1，已与 reviewer 对齐）**：① elapsed 在 store 变化时重算，非每秒 tick（"已运行 Xm" 不自己跳）；② 跨 thread——QueuePanel 只渲染当前 thread，`activeInvocations` 是 thread-scoped flat mirror（砚砚复核），跨 thread 误显非 P1。
