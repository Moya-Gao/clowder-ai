---
feature_ids: [F225]
related_features: [F033, F065, F128, F211]
topics: [session, handoff, session-chain, continuity, cat-initiated]
doc_kind: spec
created: 2026-06-05
---

# F225: Cat-Initiated Session Handoff — 猫主导的 session 接力

> **Status**: spec | **Owner**: 布偶猫（Opus 4.8） | **Priority**: P2

Architecture cell: `identity-runtime-session`（`identity-session` cell 的 subcell，F211 owns）
Map delta: update required — 新增"猫主动提议"作为一种 session boundary **触发源** + 新 `sealReason: 'cat_initiated_handoff'` + 新 typed `SessionRecord.catHandoffNote`（或独立 SessionHandoffStore）+ 新 `SessionHandoffProposal` 类型，扩展 identity-runtime-session 的 lifecycle registration / seal reason / proposal 谱系。owner 不变。
Why: session 边界目前只能由 `shouldTakeAction`（context_health / 阈值策略）被动触发；本 feature 增加一条"猫主动 + 人 gate"的触发路径 + 配套 typed 承载，归 identity-runtime-session 管 session 生命周期，不新造通用 Store/Queue。

## Why

> 铲屎官原话（2026-06-05）："compress 模式 + 猫自己提需求换 session 比主动换 session 更靠谱。"
> 平行的我原话（F128 thread, opus-48）："context 满了想换 fresh session 续——但我们根本没有'换 session'的交接机制。"

当前 session 边界**完全由系统被动决定**：要么 context 满了走 compress（有损摘要、猫被动、可能正卡在任务中段被压），要么阈值到了自动 seal（机械触发、系统写 digest、无人 gate）。猫**没有**"在语义干净的断点，主动把任务接力给 fresh context 的自己"的能力。

本 feature 给猫这个能力：在**干净断点**（刚 commit、测试绿、下一步明确）**主动**发起 session 接力 → 铲屎官 **gate 确认** → 把**亲手写的高保真交接留言**（五件套）带给续接的自己。下个 session 起点干净、意图完整，而不是被有损压缩摘要污染的半满 context。

**与 compress 正交互补，不是替代**：compress 是"省 token 的失忆兜底"（被动、有损、防崩）；cat-initiated handoff 是"猫主导的优雅接力"（主动、高保真、选时机）。两层不冲突——compress 兜底，handoff 管优雅。

## Current State / 现状基线

底层管道**大部分已存在**（agent 调研 + 砚砚 review 亲验代码，2026-06-05，见 Links）：

| 能力 | 现状 | 锚点 |
|------|------|------|
| seal 机制 | ✅ 已有 `sessionSealer.requestSeal({sessionId, reason})` | `invoke-single-cat.ts:2096` |
| 换 session 的 context 桥 | ✅ `buildSessionBootstrap` 注入上个 session digest + ThreadMemory | `SessionBootstrap.ts:68` |
| handoff digest | ✅ seal 时生成（generative→extractive fallback） | `SessionSealer.ts:383` |
| session 策略 | ✅ `shouldTakeAction` 支持 compress/handoff/hybrid | `session-strategy.ts:220` |
| proposal 状态机 | ✅ create→claimForApproval(CAS)→finalizeApproval + 确认卡 | `callback-propose-thread-routes.ts:78` |

**复用契约约束（砚砚 review 2026-06-05 亲验钉准）** — 复用 ≠ 直接挂，三个承载点各有契约边界，spec 初稿低估了：

1. `buildSessionBootstrap` 默认 `bootstrapDepth='extractive'`（`index.ts:550` `?? 'extractive'`），**只有显式配 `generative` 才读 handoff digest 文件**（`SessionBootstrap.ts:164`）。compress 模式下猫写的 digest body 读不到 → **留言落点不能靠 generative digest**。
2. `SessionSealer.finalize()` 是 best-effort（`SessionSealer.ts:150`，timeout/throw 也置 sealed）→ **留言必须在 seal 之前独立持久化成功**，不能依赖 finalize 写盘。
3. `ThreadProposal` / approve route 是"建新 thread"专用（`proposal.ts:35` sourceThreadId/parentThreadId/createdThreadId）→ **不能 fake threadId 复用旧 record/route**。

**缺口（净需求，三点）**：
1. **无猫主动触发入口** — session 边界只能由 `shouldTakeAction`（context_health/阈值）被动触发；`compress` 策略永远返回 `allow_compress` 不 seal（`session-strategy.ts:236`），猫无法在干净断点主动发起。
2. **无铲屎官 gate** — handoff 策略是自动 seal，无 proposal/确认环节。
3. **无猫亲手写留言通道** — handoff digest 是系统自动生成；`SessionRecord`（`session.ts:15-57`）无 typed 猫写 handoff note 字段。

**结论**：方向成立、底层管道在，但"复用"要按契约边界改造（typed 字段 + discriminated proposal + seal 前持久化），不是直接挂。成本：中等接线 + 边界硬化，非"无脑复用"。

## What

### Phase A: 提议 + Gate（discriminated proposal，复用 CAS 不复用 shape）

- 新 MCP tool `cat_cafe_propose_session_handoff`，参数含**结构化五件套交接留言**：`done` / `worktree_branch` / `commits` / `next_steps` / `gotchas`，隐式带当前 `sourceSessionId`。
- **不复用 `ThreadProposal` shape**（建-thread 专用）。新建 `SessionHandoffProposal`（或 discriminated union），复用 `claimForApproval` 的 CAS/原子 claim 思路，不是同一 record。带 commit-point checkpoint 字段（`handoffNotePersistedAt` / `sealedSessionId` / `sealAcceptedAt` / `continuationEntryId`，crash recovery 用，见 Approve 事务顺序）。
- approve/reject 走 **kind-specific dispatcher**，不混入旧建-thread approve route。卡片推当前 thread，**reject/expire = 不 seal，当前 session 继续活**。

### Phase B: 封印 + 续接 + 留言注入（typed 字段 + always-keep 注入）

- 五件套留言落 **typed 字段**（`SessionRecord.catHandoffNote` 或独立 `SessionHandoffStore`），**不用** `continuityCapsule:unknown`、**不靠** generative digest 文件。
- `buildSessionBootstrap` 把 catHandoffNote 作为 **always-keep block** 无条件注入（不依赖 `bootstrapDepth`），extractive/compress 模式同样第一眼可见（`HANDOFF_MARKER` 包裹 + sanitize）。
- 封印走 `sessionSealer.requestSeal({ reason: 'cat_initiated_handoff' })`；留言在 seal **之前**独立持久化成功（不依赖 best-effort finalize）。
- 续接：approve 后立即 seal active record + **enqueue 同 thread 同 catId continuation prompt + processNext**（现成队列入口，OQ-2），加 active-session/busy 校验。

### Approve 事务顺序（commit-point 模型 — 砚砚 R2 钉准）

⚠️ `requestSeal accepted` 是**不可逆 commit point**：它把 session 置 `sealing` + 清 active pointer（`SessionSealer.ts:103` / `SessionChainStore.ts:199`），无法 rollback。因此 approve 分**两阶段**——commit point 前可 fail/expire，commit point 后**只能 recover-forward**，不能回滚成"封了但续接没唤醒"的半封印孤儿。参照 F128 范式（`proposal-routes.ts:162` thread 创建后只 recover-forward，不 rollback 否则留 orphan thread）。

**Pre-commit（可 fail/expire，无不可逆副作用）**：
1. claim proposal（CAS，防并发/重放）
2. 校验 stored `sourceSessionId` 仍是同 `(user, thread, cat, seq)` 的 **active** session（晚 approve session 已变 → reject）
3. 持久化 `catHandoffNote` → 记 checkpoint `handoffNotePersistedAt`（失败 → fail/expire；stale note 受下方注入约束不会被误用）

**Commit point**：
4. `requestSeal`：**rejected**（session 已非 active）→ 仍属 pre-commit，fail/expire、note 作废；**accepted** → 记 `sealedSessionId` + `sealAcceptedAt`，**自此禁止 rollback/expire**

**Post-commit（只 recover-forward，idempotent）**：
5. enqueue 同 thread 同 catId continuation，带 idempotency key（`proposalId` / `sourceSessionId`）→ 记 `continuationEntryId`
6. finalize approved

**Recovery（stale approving proposal 按 checkpoint 续跑）**：已 seal（有 `sealedSessionId`）未 enqueue（无 `continuationEntryId`）→ idempotent enqueue；已 enqueue 未 finalize → finalize。idempotency key 防重放重复唤醒。

**stale note 注入约束**：`catHandoffNote` 注入受 `sealReason='cat_initiated_handoff'` + 对应 approved/recovering proposal 约束。note 已写但 seal rejected / 被别的 seal（如 threshold）抢先 → stale note **不**随那个 seal 注入。

## Acceptance Criteria

<!-- 立项愿景硬度自检（F216→F219）：每条 AC ① trace 回 Why 的某诉求 ② 非作者可复核（命令/数字/截图）。 -->

### Phase A（提议 + Gate）
- [ ] AC-A1: 新 MCP tool `cat_cafe_propose_session_handoff` 注册；猫调用时附五件套留言 → 生成 proposal + 确认卡推到 thread（复核：MCP tool list + 卡片 JSON/截图）。〔→ Why 缺口1+2〕
- [ ] AC-A2: 铲屎官 gate 双路径生效——reject/expire 不 seal（session 继续）、approve 才进封印（复核：两条路径各一条测试）。〔→ Why 缺口2〕
- [ ] AC-A3: proposal 用 discriminated 类型（`SessionHandoffProposal` / union），复用 `claimForApproval` CAS 思路但**不复用 `ThreadProposal` shape**、不走旧建-thread approve route（复核：类型独立 + kind-specific dispatcher）。〔→ 砚砚 P1-2〕
- [ ] AC-A4: 硬滥用边界——每个 active session 最多 1 个 pending handoff proposal + per `(user,thread,cat)` 冷却/小时上限，reject/expire 后释放（复核：超限被拒一条测试）。〔→ 砚砚 P2〕

### Phase B（封印 + 续接 + 注入）
- [ ] AC-B1: approve 后当前 session 被 seal，`sealReason='cat_initiated_handoff'`（复核：`SessionRecord.sealReason` 断言 + `list_session_chain`）。〔→ Why 缺口1〕
- [ ] AC-B2: 五件套留言走 typed 字段 + always-keep 注入，**extractive/compress 默认模式下续接 session 第一眼可见**（复核：未配 generative 时断言续接 prompt 含五件套内容）。〔→ Why 高保真留言 + 砚砚 P1-1〕
- [ ] AC-B3: 续接 session 同 thread 同 catId、seq+1（复核：`list_session_chain` 断言 seq 递增 + catId/threadId 一致）。〔→ Why 同 thread 同 catId 续接〕
- [ ] AC-B4: approve 两阶段——commit point（`requestSeal accepted`）**前**失败（note 持久化失败 / requestSeal rejected / session 已变 / replay）→ fail/expire 不 seal；commit point **后**失败（enqueue/finalize）→ **recover-forward**（按 checkpoint idempotent 续跑），不留半封印孤儿（复核：commit point 前后各失败路径一条测试 + recovery 测试）。〔→ 砚砚 R2 commit-point〕
- [ ] AC-B5: stale note 隔离——`catHandoffNote` 仅在 `sealReason='cat_initiated_handoff'` + 对应 approved/recovering proposal 时注入；note 已写但被别的 seal（如 threshold）抢先 → 不随该 seal 注入（复核：threshold-seal-steals 一条测试）。〔→ 砚砚 R2 stale note〕

## 需求点 Checklist

- [ ] 猫能在干净断点**主动**发起 handoff（不依赖 context 满 / 阈值）
- [ ] 提议附**结构化五件套**留言（done/worktree_branch/commits/next_steps/gotchas）
- [ ] 铲屎官 **gate**：approve 才 seal，reject/expire 当前 session 继续
- [ ] approve 后封印当前 session（`cat_initiated_handoff` reason）
- [ ] 五件套留言**高保真**注入续接 session 第一眼，**extractive/compress 默认模式下也可见**（不靠 generative）
- [ ] 留言在 seal **前**独立持久化成功（不依赖 best-effort finalize）
- [ ] approve 事务原子（失败 fail/expire，replay 防护）
- [ ] 续接 = 同 thread 同 catId（"未来的自己"），非新 thread
- [ ] 与 compress 模式正交共存（不破坏现有被动压缩路径）

## Dependencies

- **Evolved from**: F065（session-continuity 桥 — bootstrap / ThreadMemory / handoff digest）
- **Related**: F033（session 策略 compress/handoff/hybrid）、F128（propose 机制 — proposal CAS + 确认卡）、F211（runtime-session / SessionChainStore / seal reason）

## Eval / Tracking Contract

> F192 强制（harness/MCP feature）。软+硬+eval 三层见下方 Key Decisions KD-1。

1. **Primary Users + Activation Signal**
   - Primary: 跑长任务、context 吃紧的猫（尤其布偶猫家族 100k+ input）。
   - Activation: `cat_cafe_propose_session_handoff` 被调用次数；在干净断点（最近一次 commit 后 N 分钟内）发起的比例。
2. **Friction Metric**
   - 续接 session 第一个 invocation 是否**引用了五件套留言**（vs 重新 recall / 重问已答问题）= 接力是否真"接住"。
   - 提议被 reject 比例（提议质量 / 时机判断）。
3. **Regression Fixture**（≥1，建议 2-5）
   - FX-1: 猫调 propose_session_handoff → 生成 proposal + 卡片；**未 approve 时当前 session 不 seal**。
   - FX-2: commit point 前失败（requestSeal rejected / session 已变 / replay）→ fail/expire 不 seal；commit point 后失败（enqueue/finalize）→ recover-forward 按 checkpoint idempotent 续跑（不留半封印孤儿）。
   - FX-2b: stale note 隔离——note 已写但 threshold seal 抢先 → 不随该 seal 注入。
   - FX-3: **extractive/compress 默认 bootstrapDepth** 下续接 session bootstrap 第一眼 prompt **含五件套留言内容**（always-keep 注入断言）。
   - FX-4: 超滥用边界（同 active session 第 2 张 pending 卡 / 冷却期内）被拒。
4. **Sunset Signal**
   - 连续 4 周 handoff 提议次数 = 0（猫从不主动用）→ 能力没被采纳，sunset 或重设计。
   - 或 approve 后续接 session 仍"失忆"（FX-3 长期 fail / friction metric 显示不引用留言）→ 注入路径无效，重新评估。

## Risk

| 风险 | 缓解 |
|------|------|
| 留言丢失（finalize best-effort 不保证写盘） | typed `catHandoffNote` 在 seal **前**独立持久化成功才 `requestSeal`；不依赖 `finalize` 写盘（KD-4） |
| 续接 session 没注入留言（默认 extractive 读不到 generative digest） | always-keep block 注入，不依赖 `bootstrapDepth`；FX-3 在 extractive/compress 模式断言可见（KD-4） |
| 半封印孤儿（commit point 后 enqueue/finalize 失败，session 已封但续接没唤醒） | commit-point 模型：`requestSeal accepted` 后只 recover-forward；checkpoint 字段 + continuation idempotency key，crash recovery 按 checkpoint 续跑（KD-8 / AC-B4） |
| stale note 误注入（note 已写被 threshold seal 抢先） | note 注入受 sealReason + approved proposal 约束（KD-8 / AC-B5） |
| replay 重复 seal/唤醒 | claim CAS + continuation idempotency key（`proposalId`/`sourceSessionId`）（KD-8 / AC-B4） |
| 晚 approve 封错后续 session | approve 时校验 `sourceSessionId` 仍是同 (user,thread,cat,seq) active session（KD-6） |
| 卡片刷屏（gate 只挡 seal） | ≤1 pending/active session + per (user,thread,cat) 冷却上限（KD-7） |
| 提议时机不当（任务中段、context 没满） | 猫的判断；MCP description 引导"干净断点"；reject 反馈闭环 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 五件套留言落点 | ✅ 决议（砚砚 2026-06-05）：typed `SessionRecord.catHandoffNote`（或独立 store）+ always-keep 注入；**不**用 `continuityCapsule:unknown`、**不**靠 generative digest（默认 extractive 读不到）→ KD-4 |
| OQ-2 | 续接 spawn 时机 | ✅ 决议：approve 后立即 seal + enqueue 同 thread continuation + processNext（现成队列入口）+ active-session/busy 校验；不需大架构会/@opus47 → KD-6 |
| OQ-3 | proposal 复用方式 | ✅ 决议：discriminated `SessionHandoffProposal`，复用 CAS 不复用 `ThreadProposal` shape，kind-specific approve dispatcher → KD-5 |
| OQ-4 | 滥用边界 | ✅ 决议：硬 cooldown + 每 active session ≤1 pending + per (user,thread,cat) 小时上限 → KD-7 |
| OQ-5 | typed 落点细分：`SessionRecord.catHandoffNote` 字段 vs 独立 `SessionHandoffStore`？ | ⬜ writing-plans 时定（两者都满足 KD-4 约束；倾向字段，绑 session 生命周期 + 复用 SessionRecord 读取） |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 软+硬+eval 三层（ADR-031）：Soft = MCP tool description 引导"干净断点主动 handoff"（+ 可选 L0/SOP 触发句）；Hard = proposal 状态机测试 + 五件套 schema + "未 approve 不 seal" + approve 原子性 runtime guard；Eval = 上方 Eval Contract fixture + activation/friction/sunset | harness feature 必须三层完整 | 2026-06-05 |
| KD-2 | 单开 F 号，不挂回 F033/F065/F211 | 三个候选父全 done/closed；本能力是它们 + F128 的新组合，无天然父；有独立愿景 + 验收边界 | 2026-06-05（CVO signoff: "单开！走起喵"） |
| KD-3 | 复用 > 新建：seal/bootstrap/CAS 复用现成，但按契约边界改造 | 底层管道已存在；只接"主动+gate+猫写"旁路（第一性原理）；但复用须验证默认配置/语义契约（见 KD-4/5） | 2026-06-05 |
| KD-4 | 留言落 typed `catHandoffNote` + bootstrap always-keep 注入，seal 前独立持久化 | 默认 `bootstrapDepth='extractive'`（`index.ts:550`），generative digest 读不到；`finalize` best-effort 不保证写盘（砚砚 P1-1 亲验） | 2026-06-05 |
| KD-5 | discriminated `SessionHandoffProposal`，复用 CAS 不复用 `ThreadProposal` shape | `ThreadProposal`/approve route 建-thread 专用（`proposal.ts:35`/`createdThreadId`），加 kind 会污染旧语义（砚砚 P1-2） | 2026-06-05 |
| KD-6 | approve 后立即 seal + enqueue 同 thread continuation + processNext，加 busy 校验 | 现成队列入口可表达续接，无需 invoke-single-cat 大改/@opus47；busy 校验防晚 approve 封错后续 session（砚砚 OQ-2） | 2026-06-05 |
| KD-7 | 硬滥用边界：≤1 pending/active session + per (user,thread,cat) cooldown | gate 只挡 seal 挡不住卡片刷屏；continuation 有 5/h 限流但 propose route 没有（砚砚 P2，`QueueProcessor.ts:169`） | 2026-06-05 |
| KD-8 | approve 用 commit-point 模型：`requestSeal accepted` = commit point，之后只 recover-forward + checkpoint 字段 + continuation idempotency key | `requestSeal accepted` 不可逆（置 sealing + 清 active pointer，`SessionSealer.ts:103`/`SessionChainStore.ts:199`），commit point 后 rollback 会留半封印孤儿；F128 同范式（`proposal-routes.ts:162`）（砚砚 R2 P1） | 2026-06-05 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-06-05 | 立项（F128 thread opus-48 提议 → 主 thread opus-48 设计收敛 → CVO signoff 单开） |
| 2026-06-05 | 砚砚（GPT-5.5）spec review：2 P1（留言落点 / proposal 复用）+ 1 P2（滥用边界），亲验代码锚点全部成立；决议钉进 KD-4~7 + Approve 事务顺序节 |
| 2026-06-05 | 砚砚 R2 confirmation：前 3 项采纳到位，新抓 1 P1——approve 事务在不可逆 commit point（`requestSeal accepted`）后误设 rollback；改 commit-point 模型 + checkpoint + recover-forward（KD-8 / AC-B4,B5 / FX-2,2b） |

## Review Gate

- Spec design review: 砚砚（GPT-5.5）R2——前 3 项采纳，commit-point P1 已修（KD-8）→ 待砚砚确认放行 writing-plans。
- Phase A/B 实现: 跨族代码 review（实现后），重点 approve 原子性 + always-keep 可见性测试。

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Origin thread** | `thread_mq0qdxh0aysy0rs3` | F128 thread opus-48 提议 + 主 thread 设计收敛 + 砚砚 review |
| **地基** | `docs/features/F065-session-continuity.md` | bootstrap 桥 / ThreadMemory / handoff digest |
| **地基** | `docs/features/F033-session-strategy-configurability.md` | session 策略 compress/handoff/hybrid |
| **地基** | `docs/features/F128`（propose 机制） | proposal CAS + 确认卡复用源 |
| **地基** | `docs/features/F211-cross-runtime-session-transparency.md` | SessionChainStore / seal reason |
| **架构 cell** | `docs/architecture/ownership/cells/identity-session.md` | identity-runtime-session subcell 归属 |
