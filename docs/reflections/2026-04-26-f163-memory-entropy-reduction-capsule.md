---
capsule_id: "F163-2026-04-26"
context: "F163 Memory Entropy Reduction — 6 Phase 全链路：多轴元数据 → 压缩 → 审计 → authority backfill → confidence=f(rank) → salience gating"
feature_ids: [F163]
doc_kind: capsule
created: 2026-04-26
---

## What Worked
- LL-051 反思后的方向修正：Phase D/E/F 放弃"先建框架再填数据"，改为"直接解决问题"（pathToAuthority 21 行、rankToConfidence 4 行、salience ≤30 行），效果立竿见影
- 实验框架（Phase A）虽然前期空转，但后续 Phase D-F 的 shadow/on 灰度、variant ID 归因、cohort sticky routing 都从中受益——基础设施不是白建，是时机问题
- gpt52 Design Gate 的三处修正（task context 来源、flag 复用、scoring 行数约束）避免了又一次过度工程
- 云端 review + 本地 review 双重审查有效：codex 发现 empty-string truthSourceRef 边界问题（P2），gpt52 发现 shadow mode / anchor shape / scoring floor 三个实质问题

## What Failed
- Phase A-C 建了完整实验框架但 authority 全部 observed、confidence 硬编码 mid——框架空转 448 次搜索无效（LL-051 核心教训）
- 坐标系错误：需求是"重要知识排前面"，最小方案是纯函数，实际走了"建完整框架"的路径
- NDCG 测试 fixture 最初用了 always_on 文档（SOP、lessons-learned），但生产中这些走注入不走搜索，导致 baseline 数据失真，差点让回归测试通过但实际无效

## Trigger Missed
- Phase A 应该在建框架前先问"现在 authority 分布是什么？"——如果先跑一个查询发现 100% observed，就不会先建 boost 再发现没弹药
- Phase D 的"装弹"本该是 Phase A 的第一步，而不是反思后的补救

## Doc Links
- [F163 Spec](../features/F163-memory-entropy-reduction.md)
- [LL-051 教训](../lessons-learned.md#LL-051)
- [Harness Engineering 讨论](../discussions/2026-04-15-harness-engineering-triad-study/round2-overfitting-and-entropy.md)
- [Phase E 设计讨论](../discussions/2026-04-19-f163-phase-e-confidence-redesign/README.md)
- [Phase F Design Gate](../discussions/2026-04-25-f163-phase-f-design/)
- [ADR-009](../decisions/009-knowledge-criticality-levels.md)

## Rule Update Target
- `docs/SOP.md` / `shared-rules.md`：已有"先搜再建"原则，本次教训强化——建任何 boost/rerank 前先验证输入数据分布（authority 不能全 observed、confidence 不能全 mid）
- `writing-plans` skill：Plan 头部应包含"数据前置条件验证"步骤——框架类 feature 第一个 task 应该是验证数据分布，而不是建框架
