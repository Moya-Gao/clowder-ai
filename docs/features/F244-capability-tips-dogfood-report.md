---
feature_ids: [F244]
doc_kind: verification
tips_exempt: Internal eval/dogfood report about tips system itself — no user-visible feature to teach
---

# F244 Capability Tips — Dogfood Report (Phase D AC-D3)

> **Status**: done | **Owner**: 缅因猫/砚砚 | **Completed**: 2026-06-22
>
> 产出时间：2026-06-22 | 数据窗口：Phase B 首次上线 → Phase D PR-D1 merge
> 产出者：宪宪/claude-opus-4-6
> 方法：CVO 5 轮手动 dogfood + Timeline 记录 + PR review findings 汇总

## 1. 概要

Capability Tips 在 2026-06-18（PR #2406）首次上线，到 2026-06-22（PR #2502 merge）共经历 5 轮 CVO dogfood、8 个 PR、从 13 条 tips 扩充到 53 条。

| 指标 | 值 |
|------|------|
| Tips 总数 | 53 |
| Owner 分布 | opus: 23, codex: 23, opus-47: 1, opus-48: 6 |
| Kind 分布 | capability / magic_word / workflow / feature / status_help |
| Surface | PendingMemberBubble（等待态思考气泡） |
| 曝光机制 | 单线程单 tip, date-seeded shuffle, exposure uniformity (#997) |
| 数据持久化 | localStorage (PR-D1, usage events + exposure state) |

## 2. CVO Dogfood 观测记录

### Round 1-2（2026-06-18 — 2026-06-19）

**位置错误**：Tips 最初渲染在 `ThreadExecutionBar`（页面顶部），CVO 反馈"位置错误"——期望在 assistant streaming 区域。

修复：PR #2433 移到 ChatMessage streaming bubble → PR #2424 进一步移到 assistant streaming bubble。

**轮播太快**：初始无停留下限，tips 闪过太快无法阅读。修复：`firstDelayMs = 1500`。

### Round 3（2026-06-20）

**弹跳点与 tip strip 割裂**：CVO 发现思考态弹跳点和 tip strip 是两个视觉元素，体验割裂。

修复：PR #2448 统一 tip strip = 思考气泡，PendingMemberBubble 中 tip 立即渲染（`firstDelayMs=0`）带呼吸光晕，弹跳点降级为无 tip 时的 shimmer placeholder。

### Round 4（2026-06-20）

**"分析处理中"SaaS 文案**：CVO 反感"分析处理中..."的企业软件感觉。

修复：PR #2444 去除 SaaS 文案，改为极简弹跳点 `· · ·`；12 条 tips 从猫内部语言重写为铲屎官友好语气；增加 `audience="cvo"` 过滤 + a11y label。

### Round 5（2026-06-21）

三个问题：
1. **tips 不随机**：`rotationKey` 每次从 0 开始，确定性排序导致同一 context 下每次看到同一条。→ 记为 Phase D #997 issue，PR-D1 修复（date-seeded shuffle + exposure uniformity）
2. **"了解更多"上下文被折叠**：concierge draft textarea `rows=2` 折叠了完整 5 行 prompt。→ 已知 UX 问题，待 F229 猫猫球解决
3. **`basics-at-routing` 文案缺并发 @ 说明**：用户困惑"@ 多只猫为什么不互相协作"。→ PR #2473 当轮修复

## 3. Tips 有效性信号

### 正面信号

- CVO 5 轮逐条审视，主动提出文案改进方向（从猫语言→用户语言）
- CVO 要求扩充 tips 到社区 feature discovery（13→46→53 条），说明认可 tips 作为用户教育通道
- Magic word tips 被 CVO 视为"闭环教育"：用户看到 tip → 点"了解更多"→ 猫猫球解释 → 用户学会触发词
- CVO 主动排期 exposure uniformity 修复，说明在意"每条都被看到"

### 噪音信号

- 内部猫语言 tips 在 CVO 看来"不知所云"（Phase B 初版 12 条全是给猫猫看的，不是给用户看的）→ 已修复
- 重复曝光同一条（Round 5 #1）→ PR-D1 修复
- Tip 停留时间太短（Round 1 轮播无下限）→ 已修复

### 尚未观测到的信号

- action 转化率（用户是否真的点了"了解更多"）— 需 localStorage usage events 自然累积
- 分 context 有效性差异（thinking vs waiting_external vs review）— 需 eval 域接入
- 长期效果（tips 是否真的让用户学会了能力）— 需跨周观测窗口

## 4. Stale/Sunset 状态

截至 2026-06-22，`pnpm check:capability-tips:stale` 全绿（0 stale findings）：
- 53 条 tips 的 sourceRef path + anchor 全部有效
- 无 feature sunset 引用

## 5. 后续建议

| 优先级 | 建议 | 触发条件 |
|--------|------|----------|
| P1 | 接入 web→API telemetry rollup，让 eval 域能消费 usage events | 当猫猫球（F229）或 Hub 有服务端 tip 展示需求时 |
| P2 | 扩展 eval:capability-tips 域的 verdict 产出：按 context 切分有效性 | 累积 ≥100 次 tip exposed 事件 |
| P2 | 周期性 stale check（接入 CI 或 cron）| 下次大规模 skill/feature sunset 时 |
| P3 | concierge draft textarea 展开（"了解更多"上下文被折叠）| F229 猫猫球 UX 迭代 |
