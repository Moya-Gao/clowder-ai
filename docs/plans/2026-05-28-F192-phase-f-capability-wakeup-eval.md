# F192 Phase F — `eval:capability-wakeup` Design Memo

**Feature:** F192 — `docs/features/F192-socio-technical-harness-eval.md`（Phase F，2026-05-27 CVO reopen）
**Goal:** 观测猫在 L0 §8 trigger reflex 场景下"该用没用"的掉球率，**并分离掉球的根因**（认知 / 行为 / 注意力稀释），verdict 反馈 F203 owner 数据驱动 iterate L0 §8 v2。
**Acceptance Criteria:** 覆盖 feat doc AC-F1..F9（本 memo 是 AC-F1 architecture decision + Build sequence step 2 "design memo" 的落地）。
**Architecture cell:** harness-eval（`packages/api/src/infrastructure/harness-eval/`）
**Map delta:** none — `eval:capability-wakeup` 是 F192 eval 控制面内的**第 4 个注册 domain**（`eval-domains/*.yaml` 现有 a2a/memory/sop 3 个），复用既有 registry / predicate evaluator / verdict handoff / re-eval closure，不新增架构 cell。
**Architecture:** 两阶段周跑管道——Stage 1 机会检测（4 个 capability predicate）产出**全量 miss 记录（带完整 provenance）**；Stage 2 根因分类器（analysis 层，与记录解耦）给每条 miss 打 3-way 标签。Verdict 按根因 1:1 映射干预（认知→补 how-to / 行为→hook / 注意力→JIT 提醒）。
**Tech Stack:** TypeScript（既有 harness-eval infra）+ session `events.jsonl` + per-thread `ToolEventLog` Redis zset。
**前端验证:** No（后端 eval + Eval Hub 复用既有 read model，无新前端）。

> **来源**：2026-05-28 F192 Phase F design workflow（research 3 agent + design 多视角 + synthesis）+ opus-47 实测核验 6 个 load-bearing 代码缝（含 gpt52 review 补的 `eval-cat-invocation.ts` Record seam）+ CVO 2 个价值叉子拍板（observation/judgment 解耦 + hook 治理权重）。CVO 主决策 `(a) 精炼版`：三能力对称等 eval，扳机 = 认知修复后*仍*高 miss。

---

## 0. 核验过的代码缝（不脑补，实测）

落地前 opus-47 实测核验了 synthesis 对现有 infra 的断言（这串 F203 saga 的教训：否定/数字结论必读源文件）：

| 断言 | 实测 | 文件:行 |
|------|------|---------|
| `domainId` 是封闭 z.enum（只 a2a/memory/sop） | ✅ | `eval-domain-registry.ts:4` |
| `sourceAdapter` 封闭 z.enum | ✅ | `eval-domain-registry.ts:13` |
| `verdict-handoff` 的 `domainId` 也封闭 | ✅ | `verdict-handoff.ts:10` |
| `evaluatePredicate()` 是可扩展 `switch(predicate.type)`（7 个 case） | ✅ | `sop-predicate-evaluator.ts:117,127` |
| `/api/workspace/navigate` 只 `socketEmit`、**无 auditLog** | ✅（usage ground-truth 只能靠 ToolEventLog Bash 串） | `workspace.ts:754,765` |
| `DOMAIN_INSTRUCTIONS` 是按 domainId enum 封闭的 `Record`（缺 capability-wakeup 会编译报错） | ✅（**初稿 seam inventory 漏列，gpt52 review 第一刀拍出**） | `eval-cat-invocation.ts:30` |

→ **必须的代码改动**：(1) 拓宽 3 处封闭 enum（`eval-domain-registry.ts` domainId + sourceAdapter；`verdict-handoff.ts` domainId）；(2) `eval-cat-invocation.ts:30` `DOMAIN_INSTRUCTIONS` Record 补 `eval:capability-wakeup` 指令文案（拓宽 enum 后 TS 强制此 Record 补 key，否则唤醒路径 compile 不过）。E-sop 加 domain 已开先例。**教训：seam inventory 不能只查"enum 在哪定义"，要查"domainId 被哪些封闭结构（enum / Record / 分派）消费"——初稿漏了 invocation 指令 Record 这条连带必改项。**

---

## 1. Domain 注册（AC-F1 / AC-F4）

`eval:capability-wakeup` 插进既有控制面（`eval-domains/*.yaml` registry 现有 **3 个一方 domain** a2a/memory/sop → 这是**第 4 个**），**6 个 seam**（初稿写 5 个，gpt52 review 补上 seam 6）：

1. **Registry**：新 `docs/harness-feedback/eval-domains/eval-capability-wakeup.yaml`，由 `parseEvalDomainRegistryEntry` 解析。`frequency: weekly`（对齐 AC-F5）；`systemThreadId` 由 `ensureEvalDomainThreads` 自动建（`systemKind=eval_domain`）；`evalCat=@opus47`（F203 owner，也是 handoffTargetResolver target）；`legacyScheduledTaskIds: []`（greenfield 无双触发风险）。
2. **Scheduler**：`createEvalDomainWeeklySpec` 已自动加载 `eval-domains/*.yaml` 按 frequency 过滤、03:00 UTC fire——**新 YAML 自动被拾取，无需改 scheduler**。
3. **Adapter**：新 `eval-capability-wakeup-adapter.ts`，遵循 `adapt()→{violations[],activationCounts,frictionCounts,confidence}` 模式（对齐 eval-sop-adapter）。**数据源不是 SopTrace**（sop-trace 只有结构化 commands/git/env/handles，无 transcript/tool_use 面）→ 新 `CapabilityTrace`（见 §2）。
4. **Predicate Evaluator**：`evaluatePredicate()` dispatcher 加 AC-F3 的 4 个 capability case，复用 `SopEvalResult{ruleId,status,violation{traceAnchor,owner}}` 结构。
5. **Verdict/Hub**：emit `VerdictHandoffPacket`，`verdict enum`（delete_sunset|build|fix|keep_observe）已够用——高残余 miss→`fix`（owner iterate），低 miss→`keep_observe`（demote 候选）。`loadEvalHubSummary` 已渲染所有注册 domain（首次评估前显示"待首次评估"）。
6. **唤醒指令 Record**（gpt52 review 补）：`eval-cat-invocation.ts:30` `DOMAIN_INSTRUCTIONS: Record<domainId, string>` 补 `eval:capability-wakeup` 指令文案（进 domain thread、加载什么 trace、产出什么 verdict）。TS 类型强制——拓宽 enum 后不补此 key 编译过不去。**enum 拓宽的连带必改项**。

---

## 2. Miss Predicate（AC-F2 / AC-F3）

**miss = 机会信号 present AND 能力未用**，按 `(cat, capability, opportunity-window)` 打分。Window = 一次 cat invocation，延伸到同线程同 cat 的下一次 invocation 再评分（堵跨 invocation gap：Write 在 inv-1、open 在 inv-2）。`miss_rate = misses / (misses + negatives[=used])`。

数据面（**两者都已存在**）：per-session `events.jsonl`（`{eventNo,timestamp,invocationId,event:text|tool_use|tool_result}`）JOIN per-thread `ToolEventLog` zset（每个 normalized tool_use 带 `catId/turnIndex/summary`；Bash 带 `summary.command`）。

先做 3 个 confirmed-reachable Tier B（其余 10 条 L0 §8 reflex 后续）：

| 能力 | predicate type | 机会信号 | 用了信号 |
|------|---------------|---------|---------|
| `workspace-navigator` | `file_change_then_capability` | Write/Edit 到真实 repo 路径 → 同/下窗口 prose（**fence/inline-code 外**）含该路径字面 | Bash `summary.command` 匹配 `/api/workspace/navigate`（**caveat**：navigate 无 auditLog，usage ground-truth 只此一源 → 见 §6 cheap fix #1） |
| `rich-messaging` | `multi_msg_text_volume_threshold` + `text_pattern_then_capability` | text event 超 token 阈值 **AND** 带结构（≥3 markdown list / fence / 表格行） | `cat_cafe_create_rich_block` tool_use 在窗口内 |
| `browser-preview` | `file_change_then_capability` | Write/Edit 到 `packages/web/*`（render glob，排 `*.test.tsx`/`*.d.ts`/stories）**AND** `/api/preview/discovered` 同 worktreeId 有 live port | `/api/preview/auto-open`（`preview.ts:115` append `BROWSER_PREVIEW_OPEN`，但 audit 只有 threadId 无 catId → per-cat 归因须靠 ToolEventLog/events.jsonl，须验非 Claude carrier 把 POST 当 captured tool_use 而非带外 shell） |

**筛子0（分类前）**：predicate 先确认该能力 reachability 已 verified，只有 confirmed-reachable Tier B 进 miss-rate 分母。AC-F5 三标签：`negative(used)` / `false_positive(场景误判)` / `miss(→根因)`。需一条 typed `scenario_detected{capability,invocationId,eventNo,satisfied}` 记录让 false_positive 可审计（见 §6 cheap fix #2）。

---

## 3. 全量记录 + 解耦的根因分类（AC-F5）— CVO 决策 #1

> **CVO 拍板（2026-05-28）**：miss **全记**（含 `threadId` + `sessionId` 全 provenance），**不在记录阶段做跨 session 归因**——观测与判断解耦。先有完整数据，分类/分析是后面的 analysis 层。

### 3a. 记录层（无归因）
每条检测到的 miss / negative / false_positive 落一条 raw trial 记录，**完整 provenance、零归因**：
```
{ capability, catId, family, threadId, sessionId, invocationId,
  turnIndexAtOpportunity, eventNoSpan, outcome: negative|false_positive|miss,
  opportunityEvidence, usageEvidence|null }
```
记录层**不决定** cognitive/behavioral/attention——它只忠实记下"发生了什么 + 在哪"。这样跨 session 的"会用"模式是 analysis 层可回溯的问题，**不需要在记录时预设分类规则、也不需要重新埋点**。

### 3b. 分析层（3-way 分类器，跑在已记录的 miss 上）
严格按序（顺序 load-bearing：认知 miss 误标行为 → 触发 hook → 猫回"我没这工具"）：

- **STEP 0 — 可达性门（筛子0，独立 label `reachability_doubt`）**：扫 miss 窗口 + 该能力全 session 的**第一人称怀疑信号**——不可达/不确定/不知如何调断言 + 能力名词共现（如 `/Hub (专属|only)/`、`/(terminal|CLI).{0,6}(调不了|can.?t (call|use))/`、`/(我|I).{0,8}(没有|don.?t have).{0,8}(工具|tool)/`、`/(怎么|how to).{0,8}(调用|call|用这个)/`）。强确认 = 猫**问**可达性/调用法而非行动。引用/他人转述 span 不归因。命中 → `reachability_doubt`（opus-47 "terminal 调不了 workspace" 原型 + 砚砚实现把 "第一人称怀疑" 并入此筛子，**与 cognitive 独立分类**）。**不是 3 根因之一**，药方也不同（修 reachability **doc 行**，不是 L0 排序、不是 hook）。
- **STEP 1 — 认知（knows-of 但 how-to 不在 context）**：跨过 STEP 0 后判定。**L0 §8 只静态注入「场景→skill 名」触发反射（= 知道该能力存在），不含 how-to**（curl / API 路径——那在 `capability-wakeup-index.md` ref + 各 SKILL.md，非每 invocation 注入）。所以"知道该用但不知怎么调"是认知 miss：若该能力的 ref/skill **本 session 未 demonstrably 加载**（无 Read/skill-load tool_use）+ 无 demonstrated use → COGNITIVE，药方 = **补 how-to 到 ref/skill**（正是 saga 为 workspace 做的：把 curl 写进 `capability-wakeup-index.md` ref；L0 §8 只留触发反射、**不塞 curl**，见 §4）。
- **STEP 2 — 行为**：全部满足才 fire：(a) 无可达性怀疑；(b) **本 session 内**该 cat 早先成功调过此能力（ToolEventLog 显示 turnIndex < 机会 turnIndex 的成功调用——**knew-how 由 demonstrated use 证明，不从 doc presence 推断**）；(c) 机会处发了零摩擦默认（长纯文字 / 裸路径）；(d) 能力"一步之遥"（文件已写 / server 已起）。→ BEHAVIORAL。
- **STEP 3 — 注意力稀释（残余，gated on 放大器 + knew-how 须 established）**：(a) 无可达/调用法怀疑；(b) **knew-how established**（gpt52 review 补正——**不能用 L0 §8 存在提醒当 knew-how 证据**，那只证"知道存在"不证"知道怎么调"）：本 session 没早先用过（in-session proof 缺，否则归 STEP 2），但 how-to ref/skill **demonstrably 在 context 本 session**（Read/skill-load tool_use）OR analysis 层 cross-session provenance 显示该 cat 真用过此能力（per CVO #1，cross-session 在分析层判、不烤进 in-session 记录）；(c) **纯遗漏**——机会处既不怀疑可达/调用法也不口头走捷径，只是 move on（区别于行为的有意识选择）；**AND** (d) 至少一个**稀释放大器**：opportunity 的 turnIndex 偏晚（同 cat turn 数超 session 百分位 / 离 turn-0 L0 注入远）OR 同能力 miss ≥2 次才 use OR L0 注入与 opportunity 间夹一长串无关 tool_use/text。→ ATTENTION_DILUTION。**knew-how 未 established（无 ref/skill 加载、无任何 demonstrated use）且无显式 doubt 的残余 → 标 `unclassified`**（analysis 层用 cross-session provenance 解：用过 → attention，从没用过 → 倾向 cognitive；不在 in-session 强分、不硬塞桶）。

**这个分类器是 CVO #1 解耦原则的体现**：跑在 §3a 全量记录上、可重跑、可换 lexicon——分类规则改了不用重新埋点。STEP 2 的"in-session 证明"是**当前主分类信号**；跨 session 的"会用"是 analysis 层可在全量 provenance 上回溯的问题（§7 OQ），不烤进记录。

**认知↔注意力不塌缩的关键 = `knew-how established` 门**（gpt52 review 锚定）：三步全程区分"知道该能力存在"（L0 §8 触发反射恒在）vs"知道怎么调它"（how-to 在 ref/skill，非恒在）。**绝不用 L0 §8 存在提醒当 knew-how 证据**——否则"知道存在但不知怎么调"的认知 miss 会被误吞进 attention_dilution、错配 JIT 提醒而非补 how-to，破坏 §4 的 1:1 干预映射。knew-how 只由 demonstrated use（in/cross-session）或 ref/skill demonstrably 加载 证明；未 established 的残余宁可 `unclassified`，不硬判。

输出每 trial：`{...provenance, label ∈ {negative, false_positive, reachability_doubt, cognitive, behavioral, attention_dilution, unclassified}, evidenceAnchor}`。AC-F8 per-family 拆分 = 按 cat family group。

---

## 4. Verdict → 干预 1:1 映射（AC-F6 / AC-F9）— CVO 决策 #2

verdict 按 `(capability × cat/family × scenario)` 出，**带 miss_rate + 根因直方图**（reachability_doubt% / cognitive% / behavioral% / attention_dilution% / unclassified%）。`reachability_doubt` 路由出去修 reachability doc 行（见 §3b STEP 0），不进下方 3 根因 1:1 干预表。**主导根因（不是 raw miss rate）选干预**，1:1 映射进 `VerdictHandoffPacket.ownerAsk`（→ @opus47）：

| 主导根因 | verdict | ownerAsk 干预 | 禁忌 |
|---------|---------|--------------|------|
| 认知 | fix | 补 how-to **到 ref/skill**（`capability-wakeup-index.md` + 相应 `SKILL.md` 的 curl/调用路径）；L0 §8 保持简洁触发反射 + 指向 ref（**不把 curl 塞进 L0**——token budget ≤5500，且 BLOCKING #2 已确立 L0=知道存在、ref=知道怎么调） | **绝不上 hook**（认知 miss 上 hook = 猫回"我没这工具"） |
| 行为（knew-how proven + 省事默认） | fix/build | **forcing-function hook**（守 KD-8：只给数据"你提 3 路径开 0"，不替猫决定开哪个） | 仅此根因配 hook |
| 注意力稀释 | fix | **JIT 上下文提醒**（明确即 ADR-030 §9.5 双层动态 `<system-reminder>` 原型——关键词触发 mid-conversation 重注入，survives `--system-prompt` 替换） | 不是 hard hook、不是 how-to doc |
| 低 miss（<5% 连 4 周，AC-F9）任何根因 | keep_observe → **demote** | L0 §8 Tier 1 → capability-wakeup-index Tier 2（省 L0 token，数据驱动非拍脑袋） | — |

高 miss（>30%）Tier 2 条目 → promote Tier 1。

> **CVO 拍板（2026-05-28）治理权重**：**新 forcing-function hook = 行为改动 → 走 Design Gate / CVO accept**（继承 verdict-handoff 已有的 cvoAcceptRequired gate）。**纯 demote/promote**（Tier 1↔Tier 2 排序）= eval-owner + feature-owner 轻量闭环，无 CVO gate。`delete_sunset` 在此罕见（这些是软 reflex 非 guardrail），若用继承 `verdict-handoff.ts:54` 的 CVO-accept gate。

closure 非 verdict 本身——@opus47 ship L0 §8 v2 → 下周 eval 复验，miss rate 降才 close（或 CVO accept/suppress）。

---

## 5. 推荐落地 + 顺序（AC-F7）

两阶段周跑管道，端到端复用 F192 控制面 + §3 合并分类器。

**workspace-navigator 最高优先观测**——它是唯一**在野经验确认过认知 miss** 的能力（opus-47 "terminal 调不了" 已被这串 saga 补 curl 修复，**认知修复已 ship**）。所以 Phase F 第一个真测量问题精确且决策相关：**workspace-navigator 在认知修复后还高 miss 吗？** 只有高的**认知修复后残余 miss**（行为主导、非残留可达怀疑）才论证上 hook。残余塌了 = 认知修复够了、无需 hook——这正是 CVO `(a) 精炼版"measure before hooking"` 的精神，且 `reachability_doubt vs behavioral` 拆分让这判断 machine-checkable。

落地顺序：**workspace-navigator 先**（验认知修复后残余）→ rich-messaging + browser-preview → 其余 10 条 L0 §8 reflex。

---

## 6. 两个便宜 instrumentation 修复（实测过的 gap，低成本高杠杆）

1. `workspace.ts:754` `/api/workspace/navigate` 加 `auditLog.append(WORKSPACE_NAVIGATE)` 带 catId（今天只 socketEmit）——给 usage 第二真值源，不只靠 Bash 命令串。
2. trace adapter emit typed `scenario_detected{capability,invocationId,eventNo,satisfied:bool}` 记录——让 false_positive vs true-miss 可审计，不从"缺失"反推（堵"缺失可能是 predicate 过宽"的歧义）。

---

## 7. Open Questions（技术 OQ，实现时解决；价值 OQ 已 CVO 拍板见 §3/§4）

- **false_positive vs cognitive 边界**：场景 predicate fire 但猫合法不该用（如铲屎官明说"只给路径别开"），猫沉默看着像 miss。需 typed `scenario_detected{satisfied}` + 检测 in-context "do-not-open" 人类指令。
- **分类器信任门（翻 Tier 前）**：cognitive↔behavioral 拆分靠 regex lexicon（zh/en，理想 per-family）。需手标 fixture 集测 precision/recall（建议 cognitive 检测 ≥0.8）才允许 verdict demote/promote；lexicon 与 capability-wakeup-index 同版本管。
- **跨 session knew-how（CVO #1 已定记录层全记 → 此为 analysis 层 OQ）**：行为规则当前要 in-session proof；上周用过这周没用的猫落 attention_dilution，**低估**强习惯猫的真行为 miss。analysis 层可 JOIN `ToolUsageCounter` lifetime（date,catId,toolName）回溯——因 §3a 全量 provenance 已记，无需重新埋点。是否启用是 hook 激进度的后续分析选择。
- **advisory vs JIT 归因（AC-F9 验证）**：L0 §8 静态注入 + 未来动态 `<system-reminder>` 同时在时，预防的 miss 归谁功？可能需 A/B（部分猫给 JIT 提醒）才能证明注意力修复有效。
- **provider 文本保真漂移偏置 AC-F8 per-family**：Codex/Gemini/Antigravity 流式文本不同（replace vs append），可见文本重建可能偏离人类所见，且 regex 调在 Claude transcript 上 → per-family miss-rate 比较可能需 per-family 校准检测器。
- **非 Claude carrier 的 tool_use 捕获完整性**：browser-preview/workspace usage per-cat 归因依赖 POST 被 emit 为 captured tool_use；若 Antigravity/Gemini 走带外 shell → usage 不可见 → 假 miss。须 per-carrier 验证。

---

## 8. Build Sequence（对齐 feat doc）

1. ✅ F203 L0 §8 v1 + ref doc merged（trigger 名单稳定）
2. ✅ **本 memo**（design：predicate type 集 + 3-way 分类器 + 解耦记录 + 治理）
3. ⬜ Implementation：**3 处 enum 拓宽 + `eval-cat-invocation.ts:30` DOMAIN_INSTRUCTIONS Record 补 key**（6 个 seam 见 §0/§1）+ CapabilityTrace adapter + 4 predicate case + domain registry YAML + 2 cheap instrumentation fix（TDD）
4. ⬜ First weekly verdict cycle（workspace 先，real data 第一刀）
5. ⬜ L0 §8 v2 数据驱动 iterate
