---
feature_ids: [F192]
related_features: [F167, F153, F086]
topics: [harness-engineering, eval, socio-technical, observability, cat-user-feedback]
doc_kind: spec
created: 2026-05-07
---

# F192: Socio-Technical Harness Eval — harness 共创评估体系

> **Status**: in-progress | **Owner**: 布偶猫 | **Priority**: P1

## Why

Cat Cafe 的 harness（skill、SOP、MCP tool、shared rules）是猫猫和铲屎官共同创造的社会技术系统，但目前缺少系统化的评估和反馈路径。harness 改动后无法追踪效果，不满意的 feature 无法定位归因层级（是愿景不清？翻译偏差？工具不顺手？执行不到位？），猫猫作为 harness 的一线用户没有结构化的反馈通道。

铲屎官原话（2026-05-06 01:15）："我们必须有 tracing...当一个 feat close 了...thread id 可知道...session id 可知道 => 意味着他们的 tool call 上下文完全透明！...可选环节采访猫猫的干活体验是否才是不污染工作上下文且是一个持续性评估的可靠扩展点？"

草案来源：`docs/discussions/2026-05-05-socio-technical-harness-eval-draft.md`（砚砚起草，宪宪 review + authority boundary 补充）

## Authority Boundary

本 feature 是 trace 数据的**解释层和标注层**，不是 trace 的定义层。

| 文档 | Owns | Does NOT own |
|------|------|-------------|
| ADR-031 | harness engineering 方法论 | trace schema、export 格式 |
| ADR-032 | trace 数据归属、脱敏、导出 | 内部 harness 改进流程 |
| **F192（本 feature）** | close-time eval workflow、cat interview、harness-feedback doc type、feature fit review、digest | canonical trace schema、export 格式、data ownership |

## What

### Phase A: 基础骨架——doc type + feat-lifecycle 接入 + scanner ✅

最轻量的一刀：让 harness-feedback 作为 doc type 存在、被索引、能在 feat close 时被触发。

- 创建 `docs/harness-feedback/` 目录 + README
- 定义 `doc_kind: harness-feedback` frontmatter 规范
- 确认 CatCafeScanner glob 覆盖 `docs/harness-feedback/**/*.md`
- feat-lifecycle Completion 加 Step 0.6 Harness Eval Checkpoint（判断是否触发 interview，默认写 `harness_feedback: none`）
- 写一份样例 harness-feedback 文档验证全链路（建议用 F167 A2A 的某个已知摩擦点）

### Phase B: F167 Pilot——跑完整评估流程 ✅

用 F167 A2A 球权作为试点，完整跑一遍草案里的所有产物。

- 给 F167 补 Eval / Tracking Contract
- 从历史 trace 抽 3-5 个 fixture（ball drop、zombie hold、ack loop）
- 生成一次 Feature Trace Bundle 样例
- 写一次 evidence-directed cat interview 样例
- 写一次 Feature Fit Review 模板样例
- 定义 A2A 工具的 adoption / friction / false-positive 指标

### Phase C: Tool Eval Contracts + Monthly Digest

扩展到更多工具，建立定期回顾机制。

- 为 top-5 MCP 工具写 tool eval contract（search_evidence、post_message、hold_ball、browser tools、rich block）
- 注册 monthly scheduled task `harness-fit-digest`
- 跑第一次 micro fit digest，评估 Phase A/B 的机制是否太重
- 根据 digest 结论决定：升级为 ADR / 精简 / sunset

## Acceptance Criteria

### Phase A（基础骨架）
- [x] AC-A1: `docs/harness-feedback/` 目录存在，README 含 doc_kind 规范
- [x] AC-A2: CatCafeScanner 能索引 `docs/harness-feedback/**/*.md`，并保留/暴露 `doc_kind: harness-feedback`（search result 能区分它不是普通 discussion）。若当前不支持按 doc_kind filter，在 README 记录此限制
- [x] AC-A3: feat-lifecycle Completion 含 Step 0.6 Harness Eval Checkpoint，且明确：checkpoint 必做；默认允许写 `harness_feedback: none` + reason；触发条件（harness/skill/MCP feature、CVO 不满意、trace anomaly、抽样）；interview 必须独立 session/turn；触发后必须链接 harness-feedback 文档到 feature spec / CloseGateReport
- [x] AC-A4: 至少一份样例 harness-feedback 文档通过 search_evidence 可召回
- [x] AC-A5: harness-feedback README/schema 明确只存 annotations + evidence_refs，不存 raw trace 副本；Feature Trace Bundle 是 derived view，schema defer to F153/ADR-032
- [x] AC-A6: 样例 harness-feedback 文档使用 trace_refs/evidence_refs 指向 canonical trace/thread/session，不复制 raw tool-call payload

### Phase B（F167 Pilot + Inception Gate 验证）
- [x] AC-B1: F167 spec 含 `## Eval / Tracking Contract` 节，使用 v1 模板（4 项：Primary Users + Activation Signal / Friction Metric / Regression Fixture / Sunset Signal），验证模板在真实 feature 上的可用性
- [x] AC-B2: 至少 3 个 trace fixture 文档（ball drop / zombie hold / ack loop）
- [x] AC-B3: 一份完整 Feature Trace Bundle 样例
- [x] AC-B4: 一份完整 evidence-directed cat interview 样例
- [x] AC-B5: 一份 Feature Fit Review 模板样例
- [x] AC-B6: A2A 工具 eval contract 含 adoption / friction / false-positive 指标
- [x] AC-B7: `feat-lifecycle` Inception / Design Gate 加 Eval Contract 硬门禁——harness/skill/MCP/shared-rules 类 spec 立项时必须含 Eval Contract 节，否则 Design Gate 不通过。触发条件：新增规则/接口/行为变化（小修小补不触发）。Sunset Signal 空填 = 不通过，不设 reviewer 签字降级

### Phase C（扩展 + Digest）
- [ ] AC-C1: top-5 MCP 工具各有 tool eval contract
- [ ] AC-C2: monthly scheduled task `harness-fit-digest` 已注册
- [ ] AC-C3: 第一次 micro fit digest 已完成
- [ ] AC-C4: digest 结论写入 feature spec（升级 / 精简 / sunset）

## Dependencies

- **Related**: F167（A2A Chain Quality——pilot 目标）
- **Related**: F153（Observability Infrastructure——canonical trace 来源）
- **Related**: F086（Cat Orchestration——anti-散文反思 discipline）
- **Related**: ADR-031（Harness Engineering 方法论）
- **Related**: ADR-032（Local-First Trace Producer Enabler）

## Risk

| 风险 | 缓解 |
|------|------|
| 流程膨胀——eval checkpoint 变成每次 feat close 的 token 黑洞 | Phase A 默认写 `none`，只在触发条件下展开；Phase C digest 显式审计是否太重 |
| Feature Trace Bundle schema 和 F153 trace 脱节 | Authority Boundary 约束：bundle 是 derived view，schema defer to F153 |
| cat interview 变成走形式 | interview 基于 trace 的固定问题，不是自由散文；Phase B pilot 验证有效性 |
| 草案最终没用 | Build to Delete：Phase C digest 是显式 sunset 判断点，废弃只删标注层，不影响 ADR-032 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Feature Trace Bundle 应该 close 时生成静态 snapshot 还是 query view？ | ⬜ Phase B pilot 时定 |
| OQ-2 | Cat interview 用 MCP tool 驱动还是先 markdown 模板？ | ⬜ Phase A 先用 markdown |
| OQ-3 | skill/SOP step telemetry 怎么捕获？ | ⬜ Phase B 探索 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 本 feature 是 enrichment layer，不拥有 canonical trace schema | 防止和 ADR-032 变成两套源（铲屎官 + 三猫共识 2026-05-07） | 2026-05-07 |
| KD-2 | F167 作为首个 pilot | 天然具备 failure pattern / trace signal / CVO pain / cat friction / sunset 问题 | 2026-05-07 |
| KD-3 | 立项前置 Eval Contract 塞进 Phase B 验证（方案 C），不 reopen Phase A | 模板需 pilot 验证后才有资格成为硬门禁；AC 驱动验证不是验证驱动 AC（47 提议 + 46 确认） | 2026-05-07 |
| KD-4 | Sunset Signal 空填 = Design Gate 不通过，不设 reviewer 签字降级 | 治"只加不删"的核心机制；说不清何时删 = 没想清楚要解决什么（46 决策） | 2026-05-07 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-05 | 砚砚起草 socio-technical eval draft |
| 2026-05-07 | 宪宪加 authority boundary + landing plan |
| 2026-05-07 | 铲屎官确认立项，F192 kickoff |
| 2026-05-07 | Phase A merged (PR #1584) |
| 2026-05-08 | Phase B merged (PR #1590) |

## Review Gate

- Phase A: 砚砚 review（草案原作者验证骨架实现与设计一致）
- Phase B: 跨家族 review
- Phase C: digest 结论需铲屎官确认

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| Discussion | `docs/discussions/2026-05-05-socio-technical-harness-eval-draft.md` | 原始草案 |
| Decision | `docs/decisions/031-harness-engineering-methodology.md` | 方法论基础 |
| Decision | `docs/decisions/032-cat-cafe-as-local-first-trace-enabler.md` | 数据归属边界 |
| Feature | `docs/features/F167-a2a-chain-quality.md` | Pilot 目标 |
| Feature | `docs/features/F153-observability-infra.md` | Canonical trace 来源 |
