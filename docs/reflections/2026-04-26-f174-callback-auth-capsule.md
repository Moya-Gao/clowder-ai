---
capsule_id: "F174-2026-04-26"
context: "F174 Callback Auth Lifecycle & Resilience close — 4 层架构 + 6 Phase 全 merged + D2b 三层明厨亮灶模型 + alpha 验收纠错闭环"
feature_ids: [F174]
doc_kind: capsule
created: 2026-04-26
---

## What Worked

- **跨家族 review 立项早期就拉进来**：缅因猫 GPT-5.4 在 spec v1 阶段就给了 6 项独立立场（OQ-1~6），全部接受 → KD-5~10 + 整体 Phase 重排（A→B→C→D1→E→D2→F）。Phase A "结构化失败原因" 作为前置避免下游 regex 字符串匹配的债。立项当天就拿到这些 input，比开发到一半再 review 省了至少 2 个 Phase 返工。
- **4 层架构图作为 rebut 框架**：把"砚砚反复撞 401"从单点修复重新分解为 L1-L5 (Transport/Lifecycle/Authority/Bearer-notes/Federation)，每个 Phase 知道自己治哪一层。Bearer 想列 L4 时被缅因猫挡掉降为 transport encoding 注，避免 F174 抢戏。
- **In-context observability checklist 现场沉淀为 SOP 元工具**：D2b 设计阶段铲屎官 push back "F153 是上个世纪的可观测性"——当场把方法论固化到 `cat-cafe-skills/refs/in-context-observability-checklist.md` 而不是只修一次。后续 feature 自动继承"现场可感知性 = 第一入口"的设计哲学。
- **Pre-register retraction conditions 命中 D2b-2 alpha 验收纠错**：D2b 设计阶段就主动想"如果我错了最可能错在哪"——但当时只覆盖了"reason taxonomy 不全"等技术风险，没覆盖 affordance / mental model 缺失这种信息设计层面失败。下次 design gate 把 retraction conditions 的扫描面扩到信息设计层。

## What Failed

- **D2b-2 spec 错把"实体层"理解为 cat-level entity**：实际 callback-auth 是 system-level subsystem 不是 cat-level，但 spec 写"每只猫 avatar 角上 status dot"。Per-cat dot 在 ThreadItem 16px avatar 上永远 too small + 没有用户 mental model 把"红点"和"callback auth"对应起来。Alpha 验收 18:08 才发现："莫名其妙的颜色...你还差一层啊"。
- **信号设计三件套缺一**：affordance（用户能不能 parse 这个信号）+ placement（放在哪里能被发现）+ legend（颜色/形状/位置的语义在哪里学）—— D2b-2 原版只解决了 placement（wider 部署），没解决 affordance（plug 图标 + 24h 数量 badge）和 legend（hover tooltip + click 直达 deep-dive panel）。
- **需求点 Checklist (R1-R6) 立项时没追踪状态**：留到 close 才补勾。中间 Phase merge 时 Phase 文档同步是有的（merge-gate Step 7.5），但需求点级别的状态滚动没自动化。

## Trigger Missed

- **D2b 设计阶段未把"信号设计 = affordance × placement × legend"作为 in-context observability checklist 必检项**：原 checklist 只有 `primary_surface` / `why_not_dashboard_only` / `deep_dive_surface` / `noise_dedup_policy` 4 字段，缺"信号是否自带 affordance"判断。这次靠 alpha 验收兜底，但代价是 PR #1403 + #1410 两次 merge。
- **AC 带硬 deadline 时应在 close 立刻自动化 reminder**：AC-F5 (legacy fallback schema 删除 deadline 2026-05-08) 是守护猫主动提醒才想起要 `/schedule`，没有 SOP 强制。如果守护猫没提，13 天后 deadline 就会被遗忘。
- **D2b-2 设计阶段没问"如果用户没看 spec 就打开页面，他能 parse 这个信号吗？"** 这个问题如果在设计阶段问出来，per-cat dot 方案根本不会进 PR。

## Doc Links

- [F174 spec](../features/F174-callback-auth-lifecycle.md)（主体）
- [in-context observability checklist](../../cat-cafe-skills/refs/in-context-observability-checklist.md)（D2b 设计阶段沉淀的 SOP 元工具）
- [feedback_pre_register_retraction_conditions.md](../../../.claude/projects/-Users-lysander-projects-relay-station-cat-cafe/memory/feedback_pre_register_retraction_conditions.md)（preregister 失败模式）
- 铲屎官立项原话（2026-04-23 14:26 / 14:34 / 14:48）
- D2b-2 alpha 否决（2026-04-25 18:08 / 18:28 a+ 升级指示）
- 缅因猫 GPT-5.4 跨家族 review 起点（2026-04-23 15:23）

## Rule Update Target

- `cat-cafe-skills/refs/in-context-observability-checklist.md` — 加新必检项：「信号设计 = affordance × placement × legend，三者缺一不可。affordance 自检：去掉所有外部解释（spec/legend/tooltip），用户能从信号本身 parse 出含义吗？」
- `cat-cafe-skills/refs/in-context-observability-checklist.md` — 加新必检项：「实体层 = 用户可 mental model 锚点的最小粒度，不是技术 entity 粒度。callback-auth = 1 个 system-level entity，不是 N 个 per-cat entity」
- `cat-cafe-skills/feat-lifecycle/SKILL.md` Completion 段 — 加新步骤：「Step 4.5（建议）：扫描所有 AC 的硬 deadline 字段，触发 `/schedule` 立 one-time reminder agent。如果有任何 `deadline = YYYY-MM-DD` 文字未被自动化兜底，BLOCK close」
