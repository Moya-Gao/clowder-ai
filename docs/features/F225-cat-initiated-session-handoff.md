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
Map delta: update required — 新增"猫主动提议"作为一种 session boundary **触发源** + 新 `sealReason: 'cat_initiated_handoff'`，扩展 identity-runtime-session 的 lifecycle registration 与 seal reason 枚举。owner 不变。
Why: session 边界目前只能由 `shouldTakeAction`（context_health / 阈值策略）被动触发；本 feature 增加一条"猫主动 + 人 gate"的触发路径，归 identity-runtime-session 管 session 生命周期，不新造 Store/Queue。

## Why

> 铲屎官原话（2026-06-05）："compress 模式 + 猫自己提需求换 session 比主动换 session 更靠谱。"
> 平行的我原话（F128 thread, opus-48）："context 满了想换 fresh session 续——但我们根本没有'换 session'的交接机制。"

当前 session 边界**完全由系统被动决定**：要么 context 满了走 compress（有损摘要、猫被动、可能正卡在任务中段被压），要么阈值到了自动 seal（机械触发、系统写 digest、无人 gate）。猫**没有**"在语义干净的断点，主动把任务接力给 fresh context 的自己"的能力。

本 feature 给猫这个能力：在**干净断点**（刚 commit、测试绿、下一步明确）**主动**发起 session 接力 → 铲屎官 **gate 确认** → 把**亲手写的高保真交接留言**（五件套）带给续接的自己。下个 session 起点干净、意图完整，而不是被有损压缩摘要污染的半满 context。

**与 compress 正交互补，不是替代**：compress 是"省 token 的失忆兜底"（被动、有损、防崩）；cat-initiated handoff 是"猫主导的优雅接力"（主动、高保真、选时机）。两层不冲突——compress 兜底，handoff 管优雅。

## Current State / 现状基线

底层管道**大部分已存在**（agent 代码实测，2026-06-05，见 Links）：

| 能力 | 现状 | 锚点 |
|------|------|------|
| seal 机制 | ✅ 已有 `sessionSealer.requestSeal({sessionId, reason})` | `invoke-single-cat.ts:2096` |
| 换 session 的 context 桥 | ✅ `buildSessionBootstrap` 注入上个 session digest + ThreadMemory rolling summary，新 session 第一眼可见 | `SessionBootstrap.ts:68` |
| handoff digest | ✅ seal 时生成（generative→extractive fallback），`[Previous Session Summary]` 标记注入 | `SessionSealer.ts:383` |
| session 策略 | ✅ `shouldTakeAction` 支持 compress/handoff/hybrid | `session-strategy.ts:220` |
| F128 proposal 状态机 | ✅ create→claimForApproval(CAS)→finalizeApproval + 确认卡 | `callback-propose-thread-routes.ts:78` |

**缺口（净需求，三点）**：
1. **无猫主动触发入口** — session 边界只能由 `shouldTakeAction`（context_health/阈值）被动触发；`compress` 策略永远返回 `allow_compress` 不 seal（`session-strategy.ts:236`），猫无法在干净断点主动发起。
2. **无铲屎官 gate** — handoff 策略是自动 seal，无 proposal/确认环节。
3. **无猫亲手写留言通道** — handoff digest 是系统自动生成（extractive/generative），不是猫写的五件套高保真意图；`SessionRecord`（`session.ts:15-57`）无猫写 handoff note 字段。

**结论**：这不是新机制，是在现有 handoff 管道上接一条"主动 + gate + 猫写留言"的旁路。成本：便宜接线活。

## What

### Phase A: 提议 + Gate（学 F128 proposal 状态机）

- 新 MCP tool `cat_cafe_propose_session_handoff`，参数含**结构化五件套交接留言**：`done` / `worktree_branch` / `commits` / `next_steps` / `gotchas`。
- 复用 F128 proposal 状态机（`proposalStore.create/claimForApproval/finalizeApproval`）+ 确认卡（`buildProposalCardBlock`，新增 `kind: 'session_handoff'` + sessionId/五件套字段）。
- 卡片推到当前 thread，铲屎官点 approve/reject。**reject = 不 seal，当前 session 继续活**。

### Phase B: 封印 + 续接 + 留言注入（复用 F211 seal + F065 bootstrap）

- approve 后：调 `sessionSealer.requestSeal({ sessionId, reason: 'cat_initiated_handoff' })` 封印当前 session。
- 猫的五件套留言写进 handoff digest body（`TranscriptWriter.writeHandoffDigest`，或 `SessionRecord.continuityCapsule`，见 OQ-1）。
- spawn 同 thread 同 catId 的 next session，留言通过现有 `buildSessionBootstrap`（generative 路径）注入新 invocation **第一眼可见**（`HANDOFF_MARKER_OPEN/CLOSE` 包裹）。

## Acceptance Criteria

<!-- 立项愿景硬度自检（F216→F219）：每条 AC ① trace 回 Why 的某诉求 ② 非作者可复核（命令/数字/截图）。 -->

### Phase A（提议 + Gate）
- [ ] AC-A1: 新 MCP tool `cat_cafe_propose_session_handoff` 注册；猫调用时附五件套留言 → 生成 proposal + 确认卡推到 thread（复核：MCP tool list + 卡片 JSON/截图）。〔→ Why 缺口1+2〕
- [ ] AC-A2: 铲屎官 gate 双路径生效——reject 不 seal（session 继续）、approve 才进封印（复核：两条路径各一条测试）。〔→ Why 缺口2〕
- [ ] AC-A3: 提议层复用 F128 `proposalStore`（claimForApproval CAS 防竞态），不重造 proposal 机制（复核：代码引用 + 无新建 proposal store）。〔→ Why "学 F128" + 不重造轮子〕

### Phase B（封印 + 续接 + 注入）
- [ ] AC-B1: approve 后当前 session 被 seal，`sealReason='cat_initiated_handoff'`（复核：`SessionRecord.sealReason` 断言 + `list_session_chain`）。〔→ Why 缺口1〕
- [ ] AC-B2: 猫的五件套留言注入续接 session 的 bootstrap，**第一眼可见**（复核：新 session prompt 含五件套内容的断言，非空、非系统自动 digest）。〔→ Why "亲手写的高保真留言"〕
- [ ] AC-B3: 续接 session 同 thread 同 catId、seq+1（复核：`list_session_chain` 断言 seq 递增 + catId/threadId 一致）。〔→ Why "同 thread 同 catId 续接"〕

## 需求点 Checklist

- [ ] 猫能在干净断点**主动**发起 handoff（不依赖 context 满 / 阈值）
- [ ] 提议附**结构化五件套**留言（done/worktree_branch/commits/next_steps/gotchas）
- [ ] 铲屎官 **gate**：approve 才 seal，reject 当前 session 继续
- [ ] approve 后封印当前 session（`cat_initiated_handoff` reason）
- [ ] 五件套留言**高保真**注入续接 session 第一眼（不被系统自动 digest 覆盖）
- [ ] 续接 = 同 thread 同 catId（"未来的自己"），非新 thread
- [ ] 与 compress 模式正交共存（不破坏现有被动压缩路径）

## Dependencies

- **Evolved from**: F065（session-continuity 桥 — bootstrap / ThreadMemory / handoff digest）
- **Related**: F033（session 策略 compress/handoff/hybrid）、F128（propose 机制 — proposal 状态机 + 确认卡）、F211（runtime-session / SessionChainStore / seal reason）

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
   - FX-2: approve → session seal（`reason='cat_initiated_handoff'`）+ 五件套写入 handoff digest。
   - FX-3: 续接 session bootstrap 第一眼 prompt **含五件套留言内容**（断言文本存在）。
4. **Sunset Signal**
   - 连续 4 周 handoff 提议次数 = 0（猫从不主动用）→ 能力没被采纳，sunset 或重设计。
   - 或 approve 后续接 session 仍"失忆"（fixture FX-3 长期 fail / friction metric 显示不引用留言）→ 注入路径无效，重新评估。

## Risk

| 风险 | 缓解 |
|------|------|
| 猫滥用 seal（频繁提议打断铲屎官） | 铲屎官 gate 是硬闸（必须 approve）+ 提议频率纳入 friction metric |
| 留言丢失（seal 后 digest 没写成功） | 留言先持久化（SessionChainStore/handoff digest）**再** seal；seal 前确认写入成功 |
| 续接 session 没注入留言（bootstrap 没走 generative） | 留言注入走 always-keep 段或显式 generative 路径；FX-3 守护 |
| 提议时机不当（任务中段、context 没满就提议） | 猫的判断；MCP description 引导"干净断点"；reject 反馈闭环 |
| 与 compress 模式冲突（双触发） | 猫主动 handoff 不走 context_health 路径；与 `shouldTakeAction` 解耦，独立旁路 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 五件套留言落点：写 handoff digest body（复用现有 bootstrap 读取，agent 推荐）vs 新增 `SessionRecord.handoffNote` 字段 vs 复用 `continuityCapsule`（unknown 类型）？ | ⬜ 未定 → @codex / @opus47 |
| OQ-2 | 续接 session spawn 时机：approve 后立即 spawn，还是当前 session 自然收尾后由系统 spawn？涉及 invoke-single-cat lifecycle | ⬜ 未定 → 可能需 @opus47 深化 |
| OQ-3 | proposal 复用：扩 F128 `proposalStore` 加 `kind` 字段 vs 新建独立 handoff proposal 类型？ | ⬜ 未定 → @codex |
| OQ-4 | 滥用边界：是否需要频率上限 / 冷却期，还是纯靠铲屎官 gate？ | ⬜ 未定 → @codex 安全 review |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 软+硬+eval 三层（ADR-031）：Soft = MCP tool description 引导"干净断点主动 handoff"（+ 可选 L0/SOP 触发句）；Hard = proposal 状态机测试 + 五件套 schema + "未 approve 不 seal" runtime guard；Eval = 上方 Eval Contract fixture + activation/friction/sunset | harness feature 必须三层完整 | 2026-06-05 |
| KD-2 | 单开 F 号，不挂回 F033/F065/F211 | 三个候选父全 done/closed；本能力是它们 + F128 的新组合，无天然父；有独立愿景（猫主导接力）+ 独立验收边界 | 2026-06-05（CVO signoff: "单开！走起喵"） |
| KD-3 | 复用 > 新建：seal/bootstrap/digest/proposal 全复用现成 | 底层管道已存在；只接"主动+gate+猫写"旁路，不重造（第一性原理，避免脚手架） | 2026-06-05 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-06-05 | 立项（F128 thread opus-48 提议 → 主 thread opus-48 设计收敛 → CVO signoff 单开） |

## Review Gate

- Phase A/B: 跨族 review @codex（砚砚 GPT-5.5）— 重点封印边界（防滥用 seal / 留言丢失 / gate 绕过）。

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Origin thread** | `thread_mq0qdxh0aysy0rs3` | F128 thread opus-48 提议 + 主 thread 设计收敛 |
| **地基** | `docs/features/F065-session-continuity.md` | bootstrap 桥 / ThreadMemory / handoff digest |
| **地基** | `docs/features/F033-session-strategy-configurability.md` | session 策略 compress/handoff/hybrid |
| **地基** | `docs/features/F128`（propose 机制） | proposal 状态机 + 确认卡复用源 |
| **地基** | `docs/features/F211-cross-runtime-session-transparency.md` | SessionChainStore / seal reason |
| **架构 cell** | `docs/architecture/ownership/cells/identity-session.md` | identity-runtime-session subcell 归属 |
