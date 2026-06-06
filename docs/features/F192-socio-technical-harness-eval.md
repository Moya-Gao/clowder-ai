---
feature_ids: [F192]
related_features: [F167, F153, F086, F188, F200]
topics: [harness-engineering, eval, socio-technical, observability, cat-user-feedback]
doc_kind: spec
created: 2026-05-07
---

# F192: Socio-Technical Harness Eval — harness 共创评估体系

> **Status**: in-progress (Phase G `eval:task-outcome` v0) | **Owner**: 布偶猫 | **Phases A-E completed**: 2026-05-27

## Architecture Ownership

Architecture cell: harness-eval
Map delta: new cell required (Phase E-pilot)
Why: Phase E turns F192 from per-feature harness feedback into a cross-domain harness eval control plane. The cell owns eval domain registration, verdict handoff contracts, eval-cat invocation, legacy scheduled-task migration, and re-eval closure semantics.

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
| **F192（本 feature）** | close-time eval workflow、cat interview、harness-feedback doc type、feature fit review、digest、**runtime eval pipeline（消费 F153 telemetry → 聚合 → 归因 → 行动）** | canonical trace schema、export 格式、data ownership、F153 ring buffer 容量/TTL |

## What

### Phase A: 基础骨架——doc type + feat-lifecycle 接入 + scanner ✅

最轻量的一刀：让 harness-feedback 作为 doc type 存在、被索引、能在 feat close 时被触发。

- 创建 `docs/harness-feedback/` 目录 + README
- 定义 `doc_kind: harness-feedback` frontmatter 规范
- 确认 CatCafeScanner glob 覆盖 `docs/harness-feedback/**/*.md`
- feat-lifecycle Completion 加 Step 0.6 Harness Eval Checkpoint（判断是否触发 interview，默认写 `harness_feedback: none`）
- 写一份样例 harness-feedback 文档验证全链路（建议用 F167 A2A 的某个已知摩擦点）

### Phase B: F167 Pilot——Eval Contract & Evidence Artifact Pilot ✅

用 F167 A2A 球权作为试点，跑完预期声明层的全部产物。

- 给 F167 补 Eval / Tracking Contract
- 从历史 trace 抽 3-5 个 fixture（ball drop、zombie hold、ack loop）
- 生成一次 Feature Trace Bundle 样例
- 写一次 evidence-directed cat interview 样例
- 写一次 Feature Fit Review 模板样例
- 定义 A2A 工具的 adoption / friction / false-positive 指标

**Phase B 定位（KD-5 重新定性）**：Phase B = 预期声明层（should be）。产物是 eval pipeline 的 schema / 触发点 / 输入锚点，不是 runtime eval 完成证明。具体定位：

| Phase B 产物 | 新定位 | 自动化程度 |
|---|---|---|
| Eval Contract | 预期声明（spec-time）——pipeline 用它对比 actual | 手填 |
| Trace fixtures | regression ground truth——pipeline 必须正确判断 | 手填 anchor，pipeline 消费 |
| Feature Trace Bundle | derived view——pipeline 自动从 F153 生成 | 自动化（Phase C） |
| Cat interview | 触发型产物——pipeline 检测 anomaly 时触发 | 触发自动化，回答手填 |
| Feature Fit Review | 人工 sense-check——归因后 CVO/愿景守护猫裁定 | 半自动 |
| Tool Eval Contracts | 预期声明——同 Eval Contract | 手填 |

### Phase C: Runtime Harness Eval — F167 端到端验证 ✅

从 F153 消费运行时 telemetry，对 F167 A2A harness 跑一次真实的端到端 eval。Phase B 定义了"应该怎样"（eval contract），Phase C 观测"实际怎样"（telemetry），**diff = eval 信号**。

核心 scope：搭骨架（3-4 条 AC），不做自动化 pipeline / 定时任务 / 通用化。用 F167 作为唯一接入对象。

- 实现 F153 Telemetry Adapter，消费 `/api/telemetry/traces`、`/traces/stats`、`/metrics`、`/metrics/history` 四个公开 API
- 对 F167 的 4 个 harness 组件（L1 ping-pong breaker / C1 hold_ball / C2 forced-pass guard / route-serial）产出真实数据驱动的 runtime eval snapshot
- 对 telemetry 中的 friction signal 跑至少一次归因 → 抽象 → 解决循环
- 明确标注 telemetry gap（不可观测本身就是 eval 结果）

### Phase D: Eval Infrastructure Completion + Tool Eval Expansion

Phase C 骨架跑通后，完善基础设施 + 扩展到更多工具。含原 Phase C scope + 三猫讨论的剩余 AC + 愿景守护新增 AC。

- **Instrumentation Gap Closure（前置）**：实施 Phase C 暴露的 6 个 add-counter findings，让 L1/C1/C2 进入 confidence ≥ medium。这是其他 D-AC 的前置——没有 instrument 就没有 data，D2 snapshot store 存的是空气
- Harness Component Registry：F167 每个 harness 组件拆出 hard/soft/eval 三栏
- Snapshot Store：daily scheduled task 从 F153 拉聚合摘要，解决 24h TTL 限制
- End-to-End Verification：pipeline 复现 Phase B fixtures 的已知 friction（recall gate）
- Self-Eval Contract：Phase C pipeline 自己填 Eval Contract（meta-eval），含 sunset signal + attribution action-rate metric
- Top-5 MCP 工具写 tool eval contract（search_evidence、post_message、hold_ball、browser tools、rich block）
- 注册 monthly scheduled task `harness-fit-digest`
- 跑第一次 micro fit digest，评估 Phase A/B/C 的机制是否太重
- 根据 digest 结论决定：升级为 ADR / 精简 / sunset
- **Attribution Action-Rate（meta-loop）**：tracking findings → acted-on 比例，连续 3 月 < 50% 则 pipeline 自候选 sunset

### Phase E: Harness Eval Control Plane / Eval Hub

Phase A-D 证明了 F192 能对单个 harness domain（F167/A2A）做预期声明、runtime 观测、归因和 digest。但铲屎官在 2026-05-21 指出：eval 的第一性目的不是"有个告警"或"有个定时任务"，而是**长期追踪并解释 harness 运行效果，产出 delete/sunset / build / fix / keep 的证据化 verdict，再把诊断交给负责 feature 的猫处理，由后续 eval 复验**。

Phase E 将 F192 从单域试点提升为横切的 Harness Eval Control Plane：

- 每个 eval domain 有独立系统 thread（如 `eval:a2a`、`eval:memory`），保留该域长期分析上下文
- 每个 harness 注册 Eval Contract（服务谁 / 触发条件 / 摩擦指标 / 回归用例 / sunset 信号）
- eval 猫产出结构化 Verdict Handoff Packet，不能只说"你去看看"
- Eval Hub 展示 verdict、趋势、handoff、owner 响应、复验状态和社区报告
- F192/F200/F188 当前各自注册的定时任务迁移到统一 runtime，迁移完成后必须关闭旧任务，避免双触发

**Delete includes sunset**：`delete` verdict 包含"模型/猫猫能力变强后不再需要该 harness"的 sunset 场景。实现上可显示为 `sunset`，但 lifecycle 语义是删除/退役/收回注意力预算。

**Build sequence（owner review R1）**：Phase E 必须先跑通一个真实 domain 的 contract→verdict→handoff→re-eval 闭环，再做 Hub UI 和多域扩展。顺序固定为：

1. **E-pilot**：只接 `eval:a2a`，无新 UI，验证 registry / handoff / legacy cleanup / re-eval closure
2. **E-hub**：用 E-pilot contract mechanics + 后续真实 verdict 驱动 Eval Hub v1
3. **E-scale**：接 `eval:memory`（F200 + F188 adapter）并迁移对应旧任务
4. **E-sop**：接 `eval:sop`（cat-cafe SOP compliance；ground truth = `SopDefinition.hard_rules/pitfalls` per F203 #748；domain-generic schema 从 day 1 支持 development / video-cocreation / tech-article / family-office 等多 domain）
5. **E-community**：开放社区 issue packet / custom domain path
6. **Phase F** (reopened 2026-05-27)：接 `eval:capability-wakeup`（F203 L0 §8 trigger reflex 命中率监测；从 hard 规则合规 eval 扩到软提示发现率 eval）

**Remaining PR packaging（CVO + 46/55, 2026-05-24）**：Phase E 剩余工作不按 AC 逐条拆 PR，按可独立验收的功能块收敛为 4 个 PR，避免过细 PR 造成 review / merge overhead：

1. **E-hub PR（owner: 缅因猫/砚砚）**：System Workspace 归一 + Eval Hub v1。只消费真实 `eval:a2a` verdict，不接 memory / sop / community；Hub 放 Console daily workflow path（Observability/Eval），不放 Settings；必须提供 IM Hub / domain thread / 相关 surface 的跳转按钮。
2. **E-scale PR（owner: 布偶猫/宪宪）**：`eval:memory` adapter（F200 + F188）+ F188 repair surface 双向跳转 + F200/F188 旧定时任务清理 dry-run，确保不双触发。
3. **E-sop PR**：`eval:sop` runtime evaluator + domain registry + invocation + predicate violation verdict + re-eval closure；依赖 F203 #748 的 `SopDefinition` / predicate ground truth，已由 F203 PR #1868 满足。
4. **E-community PR**：社区 issue packet / custom domain schema + sanitized fixture；基于已落的 verdict / bundle / hub contract，不抢先做新控制面。

分工原则：E-hub 由砚砚接（contract / handoff / Hub IA 由砚砚主导），E-scale 由宪宪接（F188 health governance / repair API 由宪宪主导）。E-sop 与 E-community 在 E-hub/E-scale 稳定后再排，避免四条线同时改控制面。

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

### Phase C（Runtime Harness Eval — F167 端到端验证）
- [x] AC-C1: F153 Telemetry Adapter 实现——消费 F153 四个公开 API（`/api/telemetry/traces`、`/traces/stats`、`/metrics`、`/metrics/history`），不 import F153 内部类型。写 adapter contract test：F153 response 格式变化时 F192 失败在 adapter 层
- [x] AC-C2: F167 Runtime Eval Snapshot——对 F167 四个 harness 组件（L1 ping-pong breaker / C1 hold_ball / C2 forced-pass guard / route-serial）产出真实数据驱动的 health snapshot。字段含 window / data_source / activation_counts / friction_counts / false_positive_candidates / bypass_candidates / confidence。Telemetry gap 必须明确标注（缺 counter / span 未持久化 / tool_use 不可查 / cross-cat 403 / TraceContext Phase G 未完成）——不可观测本身就是 eval 结果
- [x] AC-C3: Attribution Finding——至少跑一个基于 telemetry 的「归因 → 抽象 → 解决」循环。输出结构化 YAML attribution_record（含 trace_anchor / friction_signal / attribution / proposed_action / status）。归因使用 7-class 矩阵（vision_gap / translation_gap / harness_misfit / tool_gap / execution_gap / environment_drift / taste_gap）。"no finding" 也是合法结论，但必须基于 telemetry 证据
- [x] AC-C4: Phase B Reclassification——F192 spec 明确写入：Phase B = 预期声明层（should be），Phase C = 实际观测层（actually is），diff = eval 信号。Phase B 产物保留但定位为 L0/L1/L4 支撑层，不是 runtime eval 完成证明

### Phase D（Eval Infrastructure Completion + Tool Eval Expansion）
- [x] AC-D0: Instrumentation Gap Closure（前置）——实施 Phase C 暴露的 add-counter actions：`streak_warn_count` / `streak_break_count`（L1）、`zombie_hold_count` / `hold_cancel_count`（C1）、拆分 `hint_emitted` 为 routing/verdict 两个独立 counter（C2）、`verdict_without_pass_count`（C2）。完成后 L1/C1/C2 confidence ≥ medium
- [x] AC-D1: Harness Component Registry——F167 每个 harness 组件拆出 hard / soft / eval 三栏，形成可扩展的 registry 格式
- [x] AC-D2: Snapshot Store——daily scheduled task 从 F153 拉聚合摘要到 `docs/harness-feedback/snapshots/`，解决 F153 24h TTL 限制。monthly digest 从 daily snapshot 二次聚合
- [x] AC-D3: End-to-End Verification——pipeline 必须复现 Phase B fixtures 的已知 friction signal（recall gate），且对正常 trace 不误判（precision gate）
- [x] AC-D4: Self-Eval Contract——Phase C pipeline 自己填 Eval Contract（meta-eval），定义 sunset signal
- [x] AC-D5: top-5 MCP 工具各有 tool eval contract
- [x] AC-D6: monthly scheduled task `harness-fit-digest` 已注册
- [x] AC-D7: 第一次 micro fit digest 已完成
- [x] AC-D8: digest 结论写入 feature spec（升级 / 精简 / sunset）
- [x] AC-D9: Attribution Action-Rate——tracking Phase C/D findings 的 acted-on 比例。pipeline 自身 eval contract 含 action-rate metric；连续 3 月 < 50% 则候选 sunset

### Phase E（Harness Eval Control Plane / Eval Hub）

#### E-pilot（`eval:a2a`，无 UI）
- [x] AC-E1: Architecture Decision / Design Gate 明确 Phase E 不是新 F 号，而是 F192 的横切控制面升级；写清 eval 第一性原理、domain thread、legacy scheduled-task 迁移和 verdict handoff 契约
- [x] AC-E2: Eval Domain Registry v0 定义 `eval:a2a` 最小 schema（domain id、system thread id、eval cat invocation policy、frequency、source adapter、legacy scheduled-task ids、handoff target resolver、SLA）
- [x] AC-E3: Verdict Handoff Packet schema 落地，字段至少含 phenomenon、harness under eval、evidence packet、daily trend、root-cause hypothesis、verdict、owner ask、acceptance / re-eval plan、counterarguments；缺字段不得 cross-thread handoff
- [x] AC-E4: `eval:a2a` domain thread bootstrap：thread 只承载 A2A eval 长期分析；状态 / verdict / trend SOT 在 registry，不在 thread 文本
- [x] AC-E5: Eval cat invocation primitive：统一 scheduled task 唤醒 eval 猫进入 `eval:a2a` thread，加载该域纵向上下文，执行 day-over-day analysis，替代旧 `harness-fit-digest` 自注册任务
- [x] AC-E6: `eval:a2a` legacy scheduled-task cleanup：inventory `harness-fit-digest`，接入后 disable / redirect，并用 dry-run report 证明不会双触发
- [x] AC-E7: Re-eval closure loop：feature owner 处理 handoff 后，只有后续 eval 复验或明确 CVO accept / suppress 才能 close verdict；猫猫不能靠一句"修了"自闭环
- [x] AC-E8: E-pilot contract demo：用 representative A2A 数据证明 Verdict Handoff Packet contract / adapter transform / pending closure state；不得把 fixture 当作 live F167 verdict。真实 day-over-day telemetry verdict + cross-thread handoff deferred until real snapshot / attribution artifacts exist

#### E-hub（由 E-pilot contract + 真实 a2a verdict 驱动）
- [x] AC-E9: Eval Hub v1 只展示 E-pilot 产出的真实 `eval:a2a` verdicts、trend windows、handoff 状态、owner 响应、re-eval closure、stale findings；它是 harness lifecycle 控制面，不是单纯 metrics dashboard
- [x] AC-E10: Eval Hub design-in-context：Hub 主入口在 Console daily workflow path（Observability/Eval sub-area），不放 Settings；明确它与现有 Observability / Health surfaces 的关系，禁止在没有真实 verdict 数据前做空 dashboard

#### E-scale（`eval:memory`） ✅
- [x] AC-E11: Unified Eval Runtime 接入 `eval:memory` adapter：F200 memory recall eval + F188 library health governance 只产出标准 verdict / finding，不复制各自业务数据真相源
- [x] AC-E12: F188 Health Dashboard / badge 与 Eval Hub 边界决议落地：F188 health 是 memory-domain adapter 输入；Eval Hub 聚合 verdict / handoff / closure，不替代 F188 的现场健康入口，除非 Design Gate 明确迁移。UI 必须提供双向跳转：Eval Hub verdict → F188 repair / dry-run / apply surface，F188 Health Dashboard → 相关 Eval Hub verdict / handoff / closure 详情
- [x] AC-E13: `eval:memory` legacy scheduled-task cleanup：列出现有 F200/F188 相关 scheduled tasks / health repair reminders；接入后 disable / redirect 对应旧任务，并有 regression test 或 dry-run report 证明不会双触发

#### E-sop（`eval:sop`，domain-generic SOP compliance） ✅

来源 2026-05-23 #748 设计讨论（clowder-ai 社区 terrenceeLeung 提议外化 SOP stage 定义；CVO 反思 "skill = 软约束（猫可加载可不加载），需硬约束兜底"）。Phase D AC-D1 「hard / soft / eval 三栏 registry」正是答案：`SopDefinition.hard_rules / pitfalls` 是 ground truth，eval 跑 runtime trace 检测违规；hook 注入与否由 eval 数据驱动 (per AC-D9 acted-on rate)，不预判。**Domain-generic from day 1**：schema 不绑 coding，`development` 只是第一个 domain，video co-creation / tech article / family office 同 schema 不同实例（消除「多阶段 skill 如 video-forge / ppt-forge / tech-writing / expert-panel 本质是 SOP 错位写进 skill body」的归位错位）。

- [x] AC-E16: Architecture Decision——`eval:sop` 是 F192 内部 domain 扩展（同 E-pilot/E-scale，不是新 F 号）；复用 Verdict Handoff / re-eval closure pattern；明确三件套定位（skill = 软约束 / SopDefinition = 硬约束 ground truth / eval = 观测层）
- [x] AC-E17: SOP Trace Adapter——从 F153 telemetry / session events / git state 抽 stage transition + tool-call sequence + repo state，喂 predicate evaluator
- [x] AC-E18: Predicate Evaluator——接 SopDefinition 里的机器可检测 predicate（基础 type 集：command_pattern / command_sequence / sha_dedup / env_check / git_state_predicate / handle_check），输出 violation 列表带 trace anchor
- [x] AC-E19: `eval:sop` domain registry + system thread bootstrap：复用 AC-E2/E4 pattern；first SOP scope = `development`（cat-cafe 开发 SOP，从 #748 SopDefinition 读取）
- [x] AC-E20: Eval cat invocation：周度 scheduled task 唤醒 eval 猫，per-stage / per-rule 出 violation verdict
- [x] AC-E21: Verdict Handoff target resolver：rule owner = SOP 维护者 / skill 维护者（按 rule 归属解析；development.yaml 的 owner 在 cat-cafe-skills/refs/）
- [x] AC-E22: First batch machine-checkable predicates 覆盖 sop_navigation 现存 12 条规则（merge `--squash` / `closed≠merged` / self-review / Redis 6398 / main 双向同步 等）；每条 rule 跑通过/未通过判定
- [x] AC-E23: Cross-domain schema validation——用 stub `video-cocreation.yaml` / `tech-article.yaml` / `family-office.yaml` 跑 schema 校验，证明 schema generic 不绑 coding；不实做这些 domain，只验 schema
- [x] AC-E24: Re-eval closure——与 E-pilot 同 pattern（owner 处理 handoff → 复验 verdict pass / CVO accept / suppress）

依赖：#748（cat-cafe）已由 F203 PR #1868 落地（`SopDefinition` + predicate-backed `hard_rules/pitfalls`）；与 E-hub / E-scale / E-community 可并行（不依赖 UI / memory adapter / community path），但按 PR packaging 决策排在 E-hub / E-scale 后，降低控制面并发改动风险。

#### E-community ✅
- [x] AC-E14: Community path：支持社区实例把本地 eval finding 导出为脱敏 issue packet；也支持社区项目注册自有 eval domain，不 fork Cat Café core
- [x] AC-E15: Community dogfood：至少 1 个 sanitized issue packet fixture + 1 个 custom domain fixture 通过 schema validation

### Phase F（`eval:capability-wakeup` — L0 §8 软提示发现率 eval）

来源 2026-05-27 F203 L0 §8 candidate triage（铲屎官反思 "skills/features 存在 ≠ 在猫认知路径"；Tier 1 决定缺 eval/tracking 数据驱动）。Phase F 把 F192 eval 从「**hard 规则合规检测**（E-pilot/E-hub/E-scale/E-sop/E-community）」扩展到「**软提示发现率监测**」——观测猫在 L0 §8 trigger reflex 场景下"该用没用"的掉球率，verdict 反馈给 F203 owner iterate L0 §8 v2。

**关键定位区别**（与 E-sop 对比）：

| | E-sop（已 merged） | F-capability（本 Phase） |
|---|---|---|
| ground truth | `SopDefinition.hard_rules/pitfalls` 硬规则 | L0 §8 trigger reflex 软提示 |
| 检测语义 | "做了违反规则的事" | "该用某能力但没用" |
| miss verdict | 违规事件 + trace anchor | scenario hit 但 capability invocation absent |
| 反馈对象 | SOP / skill 维护者 fix 规则 | F203 owner iterate L0 §8 trigger 排序 |

**Path C double-track**（Tier 1 ship + eval parallel）：L0 §8 v1（13 条 educated guess）已 ship 不阻塞；Phase F eval 收集 N 周 miss rate 数据 → L0 §8 v2 数据驱动调 Tier 1 排序 / 加新条目 / 移到 Tier 2。

- [x] AC-F1: Architecture Decision——`eval:capability-wakeup` 是 F192 内 domain 扩展（同 E-sop/E-scale，不是新 F 号；reopen 由 CVO 2026-05-27 sign-off）；复用 Verdict Handoff / re-eval closure pattern；明确"capability-wakeup eval ≠ SOP compliance eval"边界（软提示发现率 vs 硬规则合规）。**决策落地 → design memo `docs/plans/2026-05-28-F192-phase-f-capability-wakeup-eval.md`（6 个 seam + 6 个代码缝实测核验：domainId/sourceAdapter/verdict-handoff enum 封闭需拓宽、`eval-cat-invocation.ts` DOMAIN_INSTRUCTIONS Record 需补 key、evaluatePredicate switch 可扩展、workspace navigate 无 auditLog；Record seam 系 gpt52 review 补）**
- [ ] AC-F2: Capability Trace Adapter——从 F153 telemetry / session events / Skill loading events / MCP tool call invocations / diff context 抽 capability invocation traces + scenario detection signals（如 diff 含 `packages/web/*` 文件、回复含特定 trigger phrase、文件路径 reference）
- [ ] AC-F3: Scenario→Capability Predicate Evaluator——扩展 E-sop predicate type 集，加 capability-wakeup 专属 type：`scenario_then_capability_predicate`（场景 hit 但 capability invocation 缺失）/ `text_pattern_then_capability`（特定 trigger phrase 出现但没调相应 skill）/ `multi_msg_text_volume_threshold`（纯文字回复超 N tokens 没用 rich_block）/ `file_change_then_capability`（特定文件路径改了但 capability 没触发）
- [ ] AC-F4: `eval:capability-wakeup` domain registry + system thread bootstrap：复用 AC-E2/E4 pattern；first scope = L0 §8 v1 的 13 条 Tier 1 trigger reflex（每条至少一个 predicate）
- [ ] AC-F5: Eval cat invocation：周度 scheduled task 唤醒 eval 猫，per-cat / per-scenario / per-capability 出 miss rate verdict；区分 false-positive（不在该场景）vs true-miss（场景对了但没用 capability）vs negative（场景对了用了 capability）。**CVO 2026-05-28 决策 #1：miss 全记（含 threadId + sessionId 全 provenance），记录与归因解耦——3-way 根因分类（认知/行为/注意力稀释）是 analysis 层、不烤进记录，跨 session "会用" 是分析时可回溯的问题不预设记录规则（memo §3）。第三根因「注意力稀释」来自 ADR-030 §9.5 + 铲屎官观察 CC 动态提醒机制**
- [ ] AC-F6: Verdict Handoff target resolver：capability owner = F203 owner（@opus47 布偶猫）/ skill 维护者（按 capability 归属解析）；handoff packet 含 miss rate trend + 排序建议（promote / demote / drop）+ scenario fixture 证据
- [ ] AC-F7: First batch predicates 覆盖 L0 §8 v1 的 13 条 Tier 1（`rich-messaging` / `browser-preview` / `image-generation` / `workspace-navigator` / `pencil-design` / `guide-interaction` / `expert-panel` / `propose_thread` / `external_runtime_sessions` / `cliDiagnostics` / `eval verdict` / `search_evidence drilldown` / `update_workflow`）每条至少一个 machine-checkable predicate
- [ ] AC-F8: Cross-cat scope validation——predicate 应能跨 cat family 分别检测（布偶猫 / 缅因猫 / 暹罗猫 各自典型掉球模式不同；e.g., 开发系猫常忘 `rich-messaging` + `propose_thread`，视觉系猫常忘 `update_workflow`）；verdict bundle 含 per-family 拆分
- [ ] AC-F9: Re-eval closure——与 E-pilot 同 pattern（F203 owner 处理 handoff → L0 §8 v2 update → 复验 verdict miss rate 下降 → verdict close）；连续 4 周某条 Tier 1 miss rate < 5% → demote 候选 → 写入 `capability-wakeup-index.md` Tier 2。**CVO 2026-05-28 决策 #2 治理权重：新 forcing-function hook = 行为改动 → 走 Design Gate / CVO accept（继承 verdict-handoff cvoAcceptRequired gate）；纯 demote/promote（Tier 1↔Tier 2 排序）= eval-owner + feature-owner 轻量闭环、无 CVO gate（memo §4）**

依赖：F203 PR（L0 §8 v1 ship）merged 后 register `eval:capability-wakeup` domain；F209 telemetry / Skill load tracking / MCP call tracking 提供 trace source；与 E-pilot/E-hub/E-scale/E-sop/E-community 共享 evaluator infra（extend predicate type 集 + 复用 verdict handoff schema）。

**Build sequence**（Path C double-track）：
1. F203 PR ship L0 §8 v1 + ref doc（本 PR）→ trigger 名单稳定
2. ✅ Phase F design memo（`docs/plans/2026-05-28-F192-phase-f-capability-wakeup-eval.md`）：6 seam + 4 capability predicate type + **3-way 根因分类器**（认知/行为/注意力稀释，严格按序）+ 全量记录与归因解耦 + 治理权重；6 个 load-bearing 代码缝实测核验
3. Implementation：trace adapter + evaluator + domain registry + scheduled invocation
   - **Status (2026-05-29)**: 第一版 implemented-then-parked in PR #1942（branch `feat/f192-capability-wakeup`，归档保留）。6+ 轮云端 review 暴露根因：trace/trials approach（"reconstruct from heterogeneous events + scattered scope binding"）补锅-prone（31 inline comments，65% 聚集 trials.ts+trace.ts）。**Clean reboot in progress**：transplant 已稳定的 source-instrumented blocks（domain plumbing / route audits / verdict+bundle）+ 按对的坐标系（**normalize-at-boundary + centralize-scope**）重写 trials.ts/trace.ts。详见 `docs/plans/2026-05-29-F192-phase-f-clean-reboot.md`（含 transplant block list + 反模式 checklist 抽自旧 PR 31 cloud comments）。Owner: gpt52（砚砚）author + opus-47 收口策略 + cross-individual review。
4. First weekly verdict cycle（real data 第一刀）
5. L0 §8 v2 数据驱动 iterate（去掉低 miss-rate 条目 / 加新发现的高 miss-rate 场景）

### Phase G（`eval:task-outcome` — L3 任务交付质量 v0）

来源 2026-06-01 审计（`docs/discussions/2026-06-01-f192-eval-coverage-audit.md`）暴露 L3 任务交付质量是最大结构性盲区。三猫 + 铲屎官收敛终态计划（`docs/discussions/2026-06-03-eval-task-outcome-plan.md`）：**Ground truth 从用户已在做的决策中自然掉出来（决策即标注），不让用户做标注员。Proxy 只导航不判定。**

**核心设计**：
- **Episode** 是评价对象（一整个任务生命周期），不是单条消息
- **Verdict** 是分类不是分数：success / corrected_success / needs_investigation / harness_fix_needed / routing_failure / taste_mismatch / abandoned
- **摩擦传感器层**（2026-06-04 补充，详见 `docs/discussions/2026-06-01-f192-eval-coverage-audit.md` §八）：中断动作 act（cancel/deny/skip/F128 reject）+ 中断理由 reason（magic word/cancel reason/re-route/user edit）+ 世界结果真值（test/build/merge/post-merge rollback）+ 聚合 proxy（cancel burst/cross-thread repetition/rework/latency）+ 缺席摩擦（silent bypass / feature abandonment / capability miss）
- **三信号层**：A1 世界真值（merge/post-merge rollback/test/build，自动零成本）+ A2 嵌入交互决策（act 携带可解释对象语义或 reason 时才算；纯无理由动作默认 proxy）+ Proxy（导航不判定）；这是可信度层，不与传感器类型刚性绑定
- **执行频率**：daily（信号产生频率高于 capability-wakeup，需要更及时的观测窗口）

#### v0 骨架（PR #2074, merged 2026-06-03）

- [x] AC-G1: TaskOutcomeEpisode Zod schema 定义——含 episodeId、trigger、threadId、participants、artifacts、signals（a1WorldTruth / a2InteractionDecisions / proxy）、terminalState（含 in_progress）、verdict（nullable categorical）、createdAt
- [x] AC-G2: Permission Cancel 记录——signal builder + store，字段含 toolName / paramsSummary / reason（should_not_do / wrong_direction / i_will_do_it / skip） / timestamp / catId / threadId / sessionId
- [x] AC-G3: Magic Word 上下文记录——signal builder + store，字段含 word / timestamp / threadId / catId / 前后消息摘要（可选）
- [x] AC-G4: A1 世界真值信号——signal builder + CiCdRouter.onPrLifecycle 生产接线（merge+success 自动 complete episode），字段含 type（merge / revert / test_pass / test_fail / build_pass / build_fail） / ref / outcome / timestamp
- [x] AC-G5: SQLite-backed Episode Store——创建 / 查询 / 追加信号 / 更新终态 / 更新 verdict / 按 thread 列表 / 待 verdict 列表 / 获取活跃 episode
- [x] AC-G6: API route handlers + session auth guard——handlePermissionCancel / handleMagicWord / handleA1WorldTruth / handleUpdateTerminalState / handleGetEpisode / handleListEpisodes（自动创建 episode if none active）+ 路由注册到 index.ts
- [x] AC-G7: eval:task-outcome 域注册——扩展 domainId enum + sourceAdapter enum + DOMAIN_INSTRUCTIONS + YAML registry file（daily frequency）+ verdict handoff domainId
- [x] AC-G8: 授权系统集成——authorization respond 路由在 deny 时触发 onPermissionCancel hook（best-effort，reason 默认 skip，结构化 reason 来自 AC-G10）
- [x] AC-G9: Shared types——CANCEL_REASON_OPTIONS + CancelReasonValue + PermissionCancelEvent 导出到 @cat-cafe/shared 供前端使用
- [x] AC-G9b: env-registry + .gitignore——TASK_OUTCOME_DB 注册 + task-outcome-episodes.sqlite* gitignore

#### v0.5 信号接线（下一个 PR，一个 PR 搞定）

- [ ] AC-G10: Cancel 理由浮层前端——cancel 后弹轻量浮层（可选：不该做/方向不对/我自己来/跳过），选择后调 POST /api/task-outcome/cancel 带结构化 reason
- [ ] AC-G12: Magic Word 运行时检测 hook——在消息处理流程中检测 magic word 触发 → 调 POST /api/task-outcome/magic-word 记录（高权重 reason 采集）
- [ ] AC-G13: Cancel burst proxy signal——短时间内连续 cancel ≥3 次 → 自动追加 proxy signal（中断动作聚合）
- [ ] AC-G11: 端到端验证——铲屎官 + 宪宪一起：cancel → 选理由 → 绑 episode → magic word 检测 → eval hub 可见

依赖：复用 F192 已有 Eval Domain Registry / Verdict Handoff / Re-eval Closure / Eval Hub 控制面。与 F222 Frustration Auto-Issue 的打通（confirmed issue → episode signal）标记为 v1。

### Phase H（Verdict Publishing Pipeline — OQ-21 v1.x 收口 / 砚砚 R0 Path B）✅ merged 2026-06-05 (PR #2109, squash `33ee6ae54`)

来源 OQ-21 PR #2092 merge 后 v1.x 收口（铲屎官 2026-06-05 directive: "继续完成最后一公里"）。Path B 由砚砚 R0 narrowed：eval cat 产结构化 packet + 受控 MCP tool 提交，比 raw artifacts auto-export (Path A) scope 小但同样闭环 "eval cat 分析 → Hub 显示新 verdict"。

**Why（愿景硬度）**：
- 真实现状：OQ-21 PR #2092 merge 后，trigger-now 真叫醒 eval cat ✓，generate-now API ready ✓，但 eval cat 分析完后**无受控写出路径**——4.6 abandoned PR #2091 教 cat `git push origin main` 违反铁律 #2；当前 cat 只能产 verdict 在 thread 里飘，端到端"Hub 看到新 verdict"靠人工 commit
- 价值：补完 OQ-21 cycle，eval cat 能 publish verdict 让 Hub 看见，无需人工 commit 中介
- AC↔Why trace：每条 AC 都指向"eval cat → MCP tool → 受控 commit → Hub 可见"链路

**Architecture cell**: harness-eval (extend); **Map delta**: extend manual-trigger/ with publish-verdict.ts + new MCP tool `cat_cafe_publish_verdict` in cat-cafe-mcp registration

**Software-hardness (ADR-031)**:
- Soft: eval cat DOMAIN_INSTRUCTIONS 升级指引调用 MCP tool（替代 abandoned R0 "git push" 教学）
- Hard: MCP tool schema validation (VerdictHandoffPacket) + 受控 commit semantics（worktree write → auto-PR or branch commit, 待 Design Gate 定）
- Eval: Phase H Eval Contract 下

**AC（Design Gate locked, 砚砚 2026-06-05 narrowing A 方案）**：
- [x] AC-H1: 新 MCP tool `cat_cafe_publish_verdict` 接受**完整** `VerdictHandoffPacket`（12 字段全填——R1 砚砚 + R11 完整性 + R18/R19 newline injection guard）+ domain；evidence 通过 `sourceRefs.snapshotName/attributionName` basenames 显式带（R2 cloud allowlist + R17 live-read/isolated-write 分层），**tool 不造 evidence**
- [x] AC-H2: 受控 commit 路径——`createGitWorktreePublisher` 实现 git worktree add → stage → commit → push → `gh pr create` → cleanup finally；返回 commit SHA + PR URL；live worktree 永不被改（R1 P1 #1 isolated 抽象 + R12/R13/R15 push-fail 远程分支安全清理）
- [x] AC-H3: Auth model = **callback auth + agent-key auth**（R4/R9/R10 wiring）— `requireCallbackPrincipal` accepts both `invocation` + `agent_key` principal kinds，catId 从 server-trusted principal 取（非 body 可伪造）；额外 **domain-level allowlist**（R6 P1 尊重 OQ-20 Redis evalCat override 与 trigger-now 对称）
- [x] AC-H4: eval:a2a DOMAIN_INSTRUCTIONS 升级到 `cat_cafe_publish_verdict` MCP tool（R2 cloud 收口：只在 wired generator 的 domain append，其他 4 个 domain 保留原指引避免 501 loop）；明确禁止 abandoned `git push origin main` 反模式
- [x] AC-H5: Tool returns commit SHA + PR URL + repo-relative verdictPath/bundleDir（R12 P2 cloud 修：不返回 temp worktree 绝对路径）
- [x] AC-H6 (partial): handler unit tests + route Fastify-inject e2e（mock GitPublisher 真跑 stage callback + seed live evidence + copy 到 isolated）；deterministic real e2e（git+gh+真 worktree round-trip）deferred 到 alpha 验收
- [x] AC-H7 (partial): v1 only `eval:a2a` wired；其他 domain 返回 501 unsupported_generator（与 generate-now 对称）；capability-wakeup generator 待后续 Phase
- [x] AC-H8: idempotency（live + isolated worktree authoritative dup-check, R3 cloud P1 #2）+ length + slug validation（复用 generate-now.ts 模式）

**Eval Contract (F192 mandate)**：
- Primary Users + Activation Signal: eval cats publishing verdicts after analysis; tool call count per eval cycle
- Friction Metric: tool error rate / invalid packet / commit failures / merge conflicts
- Regression Fixture: success / unsupported domain / invalid packet / duplicate verdictId (idempotency)
- Sunset Signal: 如果 Path A (raw artifacts auto-export from F153 telemetry) 完全自动化 → cat-mediated publish 可 sunset；或铲屎官明确"我们不要 cat-in-the-loop 了"

**Scope 边界**：
- v1.x scope: Path B (cat-mediated publish via MCP)
- v2 scope: Path A (raw artifacts auto from F153 — F192 OQ-15 老 backlog，独立 Phase)
- 不在 Phase H: audit log (OQ-21 v1.5 backlog) / error sanitize / rate limit

依赖：F192 现有 Verdict Handoff Packet schema + manual-trigger/ generators + 砚砚 R0 narrowed direction 文档。

**Phase H v1.0 alpha verification (2026-06-05)**：MCP `cat_cafe_publish_verdict` 在 alpha (`pnpm alpha:start`) 真路径调通——opus-47 调 `eval:memory` domain 返回预期 `501 unsupported_generator`（一字不差匹配 `publish-verdict.ts:154` 详情），证明 MCP 注册 + callback auth + invocation principal + catId derive + packet schema + handoff completeness + newline guard + unsupported_generator path 全链路活；零副作用（无 commit/PR/分支）。完整 `eval:a2a` round-trip（commit + PR open + cleanup）需 codex (eval:a2a 注册 cat) 发起，留 codex 自验。

### Phase H 收尾（wire remaining generator-ready domains）

**Why**：Phase H v1.0 把基础设施 + 一个 domain (a2a) wire 完。剩下 4 个 domain 不应该 each-a-PR，应该按 generator 就绪状态分流。

**就绪状态盘点**（2026-06-05）：
- ✅ **eval:a2a**（v1.0 完成）：`generateA2aLiveVerdict` 写 bundle + verdict.md，adapter wired
- ✅ **eval:capability-wakeup**：`generateCapabilityWakeupLiveVerdict` 同模式（write `mkdirSync(bundleDir)` + `writeFileSync(verdictPath, markdown)`），**adapter 30 行可直接 wire**
- ❌ **eval:sop**：`eval-sop-adapter.ts` 只 build packet 对象，不写 disk。SOP eval 是 trace command/env/git 跑 predicate，没有 "snapshot YAML + attribution YAML → bundle + verdict.md" 资产管线。要进 publish-verdict 需先加 file-writer 层（~100-150 行独立工作）
- ❌ **eval:memory**：没有 `packages/api/src/infrastructure/harness-eval/memory/` dir，没有 generator
- ❌ **eval:task-outcome**：有 episode store/detector/route 但没 verdict generator

**Phase H v1.x follow-up scope**（与砚砚 collab 细化）：

**PR-1a — Contract Alignment（✅ merged 2026-06-06 PR #2115, squash `c51af580a`）**：砚砚 R0 narrowing — wire 前先把 capability-wakeup 一侧的 submittedPacket contract 跟 a2a 路径对齐，否则 adapter wire 后 cat-mediated publish 比 CVO-regen 安全性弱。
- [x] `assertSubmittedPacketMatches` (submitted-packet-guard.ts) — 4 轴 invariant 守 cat-submitted packet：
  - R8 P1 mirror: `submitted.harnessUnderEval.featureId === domain.handoffTargetResolver.featureId`
  - R8 P1 mirror: `submitted.domainId === input.domain.domainId`
  - R2 P1 (cross-cap): `submitted.harnessUnderEval.componentId === input.capability`（无此则 cat 可 publish `workspace-navigator` verdict 绑定 `rich-messaging` evidence bundle）
  - R3 P2 (cross-validated cloud): `input.domain.domainId === 'eval:capability-wakeup'`（mirror build-from-trials 路径 verdict.ts:20-22；无此则 wrong-generator routing 写出 hard-coded frontmatter / packet domain 不一致）
- [x] R4 P2: newline injection guard on cat-controlled rendered fields（`phenomenon` / `ownerAsk.requestedAction` / `metricRefs[]`）— 阻 `value\n- snapshot:forged` 假 evidence 注入 Hub view
- [x] `CapabilityWakeupSourceSelector` skeleton (capability-wakeup-trial-provider.ts) — window-based selector + future trial-ids 占位（砚砚 R0：trial-ids 在 durable store 之前是伪精确，先 window range）；validation 含 newline guard + element shape
- [x] R1 P2: metric ref `metric:metric:` double-prefix idempotent fix（a2a R14 mirror，extract to `formatMetricRefBullet` helper 让 strip-then-add 模式视觉无歧义）
- [x] tests：9/9 capability-wakeup submittedPacket invariants green
- 22 轮 review（砚砚 R0-R3 local 主审 + 云端 R1-R5 fine-grained，R4 helper extract 破除云端 reviewer-LLM 模式盲视）

**PR-2 — Adapter Wire（pending）**：
- [ ] capability-wakeup adapter（复刻 `a2a-generator-adapter.ts` 模式，~30 行）— 把 `CapabilityWakeupTrialProvider.resolve(selector)` 接到 `generateCapabilityWakeupLiveVerdict({trials})`
- [ ] 加 `eval:capability-wakeup` 到 `PUBLISH_VERDICT_SUPPORTED_DOMAINS` (eval-cat-invocation.ts) — 必须先有 real trial provider impl（PR-1a 只定 interface）
- [ ] 加 capability-wakeup 的 DOMAIN_INSTRUCTIONS publish 段
- [ ] tests：复刻 a2a-generator-adapter test 模式 + capability-wakeup mock fixture

**独立 backlog（不在 Phase H 收尾内）**：
- sop publish 要先加 file-writer 层（独立 Phase）
- memory generator 要先建（独立 Phase / 跟 F200/F188 协同）
- task-outcome verdict generator 要先建（独立 Phase）
- AC-H6 real e2e (real git+gh round-trip)：当前 alpha 验已覆盖 happy path 表征，deferred 留待真正端到端测试需求出现时再补

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "eval 是为了 tracing harness 后看 harness 效果如何，是不是需要 sunset / delete / build" | AC-E1, AC-E3, AC-E8, AC-E9 | Design Gate + Verdict Packet fixture | [x] |
| R2 | "delete 还有一种情况是 sunset，比如猫猫变强了，不需要了" | AC-E1, AC-E3 | Verdict enum + sunset fixture | [x] |
| R3 | "负责 a2a eval 的猫要分析、深度分析原因、对比每天" | AC-E2, AC-E4, AC-E5 | domain thread registry + trend window fixture | [x] |
| R4 | "eval 猫要跨线程通讯，发给负责的猫，让负责的猫来深度看" | AC-E3, AC-E7, AC-E8 | cross-thread handoff packet + re-eval closure test | [x] |
| R5 | "verdict → handoff 要不要结构化，必须带证据包" | AC-E3 | schema validation rejects incomplete packet | [x] |
| R6 | "诊断 / eval 结果需要一个看板，叫 Eval Hub" | AC-E9, AC-E10 | Eval Hub screenshot / API response | [x] |
| R7 | "接入完成得清理遗留定时任务，避免双触发" | AC-E6, AC-E13 | scheduled task inventory + dry-run migration report | [x] |
| R8 | "社区小伙伴发现自己的场景有掉球，也能提 issue / 接自己的项目 eval" | AC-E14, AC-E15 | sanitized issue packet fixture + custom domain fixture | [x] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [x] 前端需求已准备需求→证据映射表（Eval Hub Phase 需要）

## Phase E Eval / Tracking Contract

| 项 | Contract |
|----|----------|
| Primary Users + Activation Signal | eval 猫、feature owner、CVO、社区 maintainer。触发：harness 进入 registry / existing domain adapter 接入 / verdict 产生 / owner action 完成后待复验 |
| Friction Metric | incomplete_handoff_count、duplicate_trigger_count、unowned_verdict_count、stale_verdict_days、unverified_close_count、legacy_task_overlap_count |
| Regression Fixture | 1) F192 `harness-fit-digest` 迁入后旧 scheduled task 不再重复发；2) F200 memory eval 产出 verdict 后必须带 evidence packet；3) F188 orphan-edge health finding 不能只显示指标，必须能形成 owner ask + re-eval plan |
| Sunset Signal | 若 Phase E 连续 2 个 eval domain 接入后，verdict handoff acted-on rate < 50% 且 duplicate_trigger_count > 0，说明控制面比旧竖井更重，必须进入 simplify / sunset review |

### Phase E Verdict Matrix Contract（E-hub 前硬化）

Verdict 不是自由文案。每个 verdict 都必须满足对应证据门槛、handoff ask 和 closure 规则；不满足时 schema / review 必须拒绝，而不是靠 reviewer 一条条补语义洞。

| Verdict | 合法触发条件 | 必填证据 | Handoff ask | Closure / re-eval | Governance |
|---|---|---|---|---|---|
| `fix` | 已有 harness 目标正确，但实现 / prompt / workflow 没做到位；出现 regression、false positive、bypass 或 owner friction | phenomenon、affected harness、metric refs、day-over-day trend、root-cause hypothesis、counterarguments | 请 feature owner 修正现有 harness 或其接线 | 后续 eval 对同一 failure pattern 复验通过；owner 不能自报 resolved | 默认 eval owner + feature owner 闭环；高影响行为变更走 Design Gate |
| `build` | 反复出现的 failure pattern 没有现有 harness 覆盖，或现有 harness 边界外出现新场景 | missing-coverage evidence、candidate harness scope、expected activation signal、success metric、counterarguments | 请 feature owner 设计 / 扩展 harness，并补 Eval Contract | 新 harness 有 Eval Contract + 首次 eval snapshot；未接入前不得标 resolved | 新增规则 / SOP / MCP 行为变化必须过 Design Gate |
| `delete_sunset` | harness 的边际效果低或成本高，且可能已被模型 / 猫猫能力内化；**不能仅因最近没触发就判 sunset** | cost/effect trend、activation history、原始 failure pattern refs、Sunset Trial Plan、counterarguments | 请 owner 启动 sunset trial；verdict 本身不执行删除 | trial 满足 criteria 后进入 `dormant`；真正 `retired` 需额外 CVO accept | `toDormant` 可按 criteria 自动；`toRetired` 必须 CVO accept |
| `keep_observe` | 当前证据不足以改变 harness，或 harness 仍健康；不是“什么都不做”的永久终态 | current metric refs、why-no-action、next observation window、known blind spots | 继续观察 / 补 instrumentation / 等下一窗口 | 到期必须重新 eval；若无 next window 则不合法 | 可由 eval owner 自决；不能用来掩盖缺数据 |

不变式：

1. live verdict 的 evidence refs 必须可解析；fixture / demo 必须显式标注，不能伪装成真实 telemetry verdict。
2. `delete_sunset` verdict 只能触发 Sunset Trial，不能直接关闭或删除 harness。
3. `keep_observe` 必须带 next observation window；否则就是把未知包装成结论。
4. `build` 必须补 Eval Contract；没有可观测 success metric 的新 harness 不得进入 active。

### Phase E Sunset Trial Contract（`delete_sunset` 展开）

Sunset 是对 harness 的可逆退役试验，不是直接删 guardrail。默认生命周期：

```
active -> trial -> dormant -> retired
            ^         |
            |_________|  任一 regression signal 回退 active
```

- `active`: harness 在 prompt / SOP / tool / hook 的正常路径里生效。
- `trial`: harness 从主动路径中撤出或降级，只按 Trial Plan 观测。
- `dormant`: 默认 sunset 终态。harness 不再消耗 active 注意力预算，但配置、文档、revival path 保留，目标是 24h 内可恢复。
- `retired`: 真的删除代码 / skill / SOP。只在 dormant 连续通过多个周期后考虑，且必须 CVO accept。

Trial Plan schema：

```ts
{
  harnessId: string;
  ablationMode: 'log_only' | 'ab_cohort' | 'full_ablation';
  triggerScenarios: AdversarialProbeRef[]; // 必填：复用 Eval Contract 原始 failure pattern
  trialWindow: {
    minDays: number;
    minSessions: number;
    minCatsSampled: number;
  };
  successCriteria: {
    minProbePassRate: number;
    maxNaturalRegressionCount: number;
  };
  failureCriteria: {
    anyProbeFail: boolean;
    maxNaturalRegressionCount: number;
  };
  revertPlan: {
    snapBackPath: string;
    slaHours: number; // must be <= 24
  };
  governance: {
    toDormant: 'auto-if-criteria-met';
    toRetired: 'cvo_accept_required';
  };
}
```

Trial mode 选择：

| Harness type | Preferred ablationMode | 原因 |
|---|---|---|
| tool / hook / MCP guard | `log_only` | 可以“本该拦截但不拦截”，记录 would-have-fired |
| prompt / SOP / skill thinking harness | `ab_cohort` 或 `full_ablation` + adversarial probes | prompt 在上下文里就会影响行为，不能真正 shadow，只能移除后主动 probe |
| high-risk guardrail | `full_ablation` only in isolated fixture / alpha | 生产路径不允许无保护试验 |

Sunset 判断规则：

1. **低触发率不是 sunset 证据**。低触发只说明场景少，不能区分“能力内化”与“问题间歇出现”。
2. 思考类 harness 的效果用 adversarial probe pass rate 衡量：把当初 harness 要防的 failure pattern 重新呈现给不带 harness 的猫，观察是否仍能正确处理。
3. 任何 probe fail、真实 regression、或 CVO / feature owner 指出关键反例，都立即回退 `active`。
4. `triggerScenarios` 为空时 Trial Plan schema reject；没有原始 failure pattern 的 harness 先补 Eval Contract，不许 sunset。
5. 进入 `dormant` 不是失败，是正常释放注意力预算；进入 `retired` 才是不可逆删除门，必须 CVO accept。

### Phase E Live Verdict Evidence Bundle Contract（OQ-15）

Live verdict 不是单独一篇 markdown。若 verdict 引用 `snapshot:` / `attribution:` evidence ref，必须随 verdict 提交一个 sanitized evidence bundle；bundle 是这两类 ref 的证据真相源，raw runtime snapshot / attribution 只作为派生输入，继续保持 gitignored。

```text
docs/harness-feedback/
  verdicts/
    <verdict-id>.md
  bundles/
    <verdict-id>/
      snapshot.json
      attribution.json
      provenance.json
  snapshots/      # raw runtime generated, gitignored
  attributions/   # raw runtime generated, gitignored
```

Bundle contract：

1. **Bundle 是 `snapshot:` / `attribution:` 的 SOT**。Live verdict 文档中的 `snapshot:` / `attribution:` ref 必须解析到 `docs/harness-feedback/bundles/<verdict-id>/`；不得引用 raw runtime `snapshots/` 或 `attributions/` 路径。
2. **Bundle 是 sanitized subset**。`snapshot.json` 只包含 verdict 实际引用的 domain / window / components / metrics / trend 字段；`attribution.json` 只包含 verdict 实际引用的 finding / no-finding record / evidence anchors；未引用组件、自由文本样本、临时 runtime noise 不进入 bundle。若必须保留 user text，先脱敏或降级为 trace / thread / message ref。
3. **Bundle 可从 raw 重派生**。`provenance.json` 必须记录 raw input path、content hash、generatedAt、generator version / commit、sanitize rules version。相同 raw input + 相同规则应能生成 bit-identical bundle。
4. **Bundle 与 verdict 同提交**。`verdicts/<verdict-id>.md` 与 `bundles/<verdict-id>/` 1:1 绑定；invariant test 必须拒绝 live verdict 缺 bundle、bundle 缺 verdict、或 ref 指向不存在 bundle item。

Evidence ref SOT 分类：

| Ref 类型 | SOT | 说明 |
|---|---|---|
| `snapshot:` / `attribution:` | `docs/harness-feedback/bundles/<verdict-id>/` | 本 contract 覆盖；committed sanitized subset |
| `trace:` | F153 trace store | 已有 canonical SOT，不复制进 bundle |
| `thread:` / `message:` | runtime DB | 已有 canonical SOT，不复制进 bundle |
| `pr:` / `commit:` | git / GitHub | 已有 canonical SOT，不复制进 bundle |

### Phase D Digest Conclusions (AC-D8)

Based on the first micro fit digest (2026-05-11):

- **Upgrade**: route-serial instrumentation is production-ready (high confidence with full counter coverage). Consider per-agent breakdown in future eval cycles.
- **Streamline**: L1/C1/C2 now have dedicated counters (D0 closed all 6 gaps). The mixed `hint_emitted` counter is retained for routing hints (backwards compat) — evaluate removing it once C2 split counters accumulate enough data.
- **No sunset candidates**: All 4 components actively serve A2A chain quality. Action-rate tracking (D9) will surface sunset candidates if findings go unacted for 3+ months.
- **Next cycle focus**: Verify D0 counters are incrementing in production after merge. If any counter shows zero after 1 week of deployment, investigate code path reachability.

## Dependencies

- **Related**: F167（A2A Chain Quality——pilot 目标）
- **Related**: F153（Observability Infrastructure——canonical trace 来源）
- **Related**: F086（Cat Orchestration——anti-散文反思 discipline）
- **Related**: F188（Library Stewardship——health governance / orphan edge / verification debt 作为 memory-domain eval 输入）
- **Related**: F200（Memory Recall Eval——memory-domain 专项 eval 竖井，Phase E 首批迁移对象）
- **Related**: ADR-031（Harness Engineering 方法论）
- **Related**: ADR-032（Local-First Trace Producer Enabler）

## Risk

| 风险 | 缓解 |
|------|------|
| 流程膨胀——eval checkpoint 变成每次 feat close 的 token 黑洞 | Phase A 默认写 `none`，只在触发条件下展开；Phase D digest 显式审计是否太重 |
| Feature Trace Bundle schema 和 F153 trace 脱节 | Authority Boundary 约束：bundle 是 derived view，schema defer to F153 |
| cat interview 变成走形式 | interview 基于 trace 的固定问题，不是自由散文；Phase B pilot 验证有效性 |
| 草案最终没用 | Build to Delete：Phase D digest 是显式 sunset 判断点，废弃只删标注层，不影响 ADR-032 |
| F153 24h TTL 不够 monthly digest | Phase C 不阻塞；Phase D 建 Snapshot Store 每日快照聚合 |
| 又把 eval 做成文档 | Phase C AC-C2 要求 telemetry 数据驱动的 snapshot，手填 = 不通过；AC-C4 明确写入 Phase B 重新定性 |
| 跨猫 403 阻塞 aggregate eval | Phase C 先走单猫可拉的 aggregate 数据；403 不阻塞骨架，Phase D 解决 |
| F153 API 格式变化导致 F192 破碎 | AC-C1 adapter contract test 兜底——变化失败在 adapter 层，不散落一地 |
| Phase E 退化成"漂亮 metrics dashboard" | AC-E3/E5 强制 verdict + handoff + re-eval closure；Eval Hub 不以分数为终点 |
| F192/F200/F188 旧定时任务与新 runtime 双触发 | AC-E6/AC-E13 强制 inventory + disable/redirect + dry-run 证明 |
| domain thread 变成新垃圾桶 | AC-E4 限定 thread 只按域承载长期分析；工作状态 / verdict SOT 在 registry + Eval Hub |
| IM Hub 老系统 thread 与 Eval domain thread 割裂成两套前端模型 | KD-15 明确 System Thread / System Workspace 归一：统一 system kind / linked surface / actions；IM Hub kind=`connector_hub`，Eval kind=`eval_domain`，互用系统分区与删除保护 |
| eval 猫武断给 delete/sunset verdict | AC-E3 要 counterarguments；高影响 delete/sunset 需 CVO accept 或 Design Gate 签字 |
| **`harness-eval/` 目录 dir-size 超限债** — Phase F capability-wakeup 一批 `eval-capability-wakeup-*.ts` 加入，使 `packages/api/src/infrastructure/harness-eval/` 达 29 .ts（> error=25），2026-05-30 全量 sync 时被 clowder-ai Directory Size Guard 抓出 | `.dir-exceptions.json` 已登记 time-bound 豁免（expiresAt 2026-06-15，ticket F192）；**后续按 capability-wakeup / a2a / domain / hub 子域拆分**（GitHub issue 跟踪）。根因：`check:dir-size` 此前不在 pnpm gate，本次已补入堵住下次 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Feature Trace Bundle 应该 close 时生成静态 snapshot 还是 query view？ | ✅ Phase C 产出 snapshot |
| OQ-2 | Cat interview 用 MCP tool 驱动还是先 markdown 模板？ | ✅ Phase A 先用 markdown |
| OQ-3 | skill/SOP step telemetry 怎么捕获？ | ⬜ Phase D 探索 |
| OQ-4 | 跨猫 session 403 如何处理？三个方案：(A) Service token (B) ADR-032 export 层 (C) Push-based | ⬜ Phase C 先走 aggregate 脱敏不阻塞；Phase D 解决 |
| OQ-5 | Daily snapshot 存储格式：markdown（可被 search_evidence 索引）vs SQLite（查询效率） | ⬜ Phase D 定 |
| OQ-6 | Eval Domain Registry 真相源放 SQLite、docs registry 还是 hybrid？ | ✅ E-pilot: docs-backed registry + generated JSON/YAML snapshots；E-hub 可加 SQLite read model |
| OQ-7 | Eval Hub 首屏是在 Console 独立页面，还是挂到现有 Health / Observability 区域？ | ✅ Console daily workflow path：Settings shell 下的 Observability/Eval sub-area deep link（`/settings?ops=observability&obs=eval`），不放 Settings-only 配置页 |
| OQ-8 | delete/sunset verdict 的签字门槛：哪些可以 eval 猫自决，哪些必须 CVO accept？ | ✅ 高影响 delete/sunset 默认 requires CVO accept；fix/build/keep_observe 可由 eval owner + feature owner 闭环 |
| OQ-9 | 旧 scheduled task 的 disable / redirect 如何可逆，避免迁移失败后丢报告？ | ✅ E-pilot: inventory → dry-run report → redirect/disable with rollback record；无 dry-run 不切 |
| OQ-10 | 社区 issue packet 的脱敏边界和上游接收格式是什么？ | ⬜ Phase E Design Gate |
| OQ-11 | eval 猫 invocation 模型：统一 scheduled task 如何唤醒指定 eval 猫进入对应 domain thread，并加载纵向上下文做 day-over-day analysis？ | ✅ E-pilot: AC-E5 mandates unified scheduled invocation packet for `eval:a2a` |
| OQ-12 | Eval Hub 与 F188 Health Dashboard / badge 的关系：吸收、替代还是共存？ | ✅ 共存：互链、不互替。Eval Hub 聚合 verdict / handoff / closure；F188 保留现场 health repair controls 与 badge |
| OQ-13 | `delete_sunset` 的 CVO gate 现在是 fail-safe text gate（要求 `cvo accept` 文本）；E-scale 前是否改成结构化 `governance.requiresCvoAccept` 字段？ | ⬜ E-scale hardening before second domain |
| OQ-14 | Sunset Trial 的 `triggerScenarios` 自己会不会过期？旧 failure pattern 可能已不代表当前模型 / 猫猫能力 | ⬜ E-scale 前定 refresh policy；trial 可先要求引用原 Eval Contract pattern |
| OQ-15 | live verdict 的 evidence SOT 是什么？当前 `docs/harness-feedback/snapshots/` 与 `attributions/` 是 gitignored generated artifacts，干净 worktree 无法解析 committed verdict refs | ✅ Option 3 hybrid：raw runtime artifacts 继续 gitignored；每个 live verdict 同提交 sanitized `bundles/<verdict-id>/`，`snapshot:` / `attribution:` 只解析 bundle |
| OQ-16 | **[BUG] eval:memory 在 Hub 完全不可见**——Hub read model 只扫 `verdicts/` 目录的 `.md` 文件，没有 verdict = domain 不显示。eval:memory adapter 代码已 merge (E-scale PR #1879) 但从未产出 verdict，Hub 上 eval:memory 完全隐形。应该从 domain registry 加载所有已注册 domain，没 verdict 的显示"待首次 eval"状态 | ✅ Fixed: Hub read model `loadEvalHubSummary()` now returns `domains[]` from all YAML-registered domains + frontend `DomainCard` shows "待首次评估" for no-verdict domains. PR eval-pipeline-livefix 2026-05-26 |
| OQ-17 | **[BUG] 定时 eval 从未注册**——YAML 配置了 `frequency: daily`，`buildEvalCatInvocation()` 构建了 invocation packet，但没有 scheduled task 调用它。eval:a2a 的唯一 verdict (2026-05-23) 是手动生成的；eval:memory 从未运行。AC-E5 要求"统一 scheduled task 唤醒 eval 猫进入 domain thread"——引擎没启动，整个 eval pipeline 是死的 | ✅ Fixed: `createEvalDomainDailySpec()` registered as TaskSpec_P1, cron `0 3 * * *`, reads all eval-domains/*.yaml, triggers eval cat per domain via invokeTrigger. PR eval-pipeline-livefix 2026-05-26 |
| OQ-18 | **[BUG] System thread 是空壳**——`ensureEvalDomainThreads()` 在 Hub API 请求时按需创建空 thread，但 eval cat 从未在里面工作。AC-E4 要求"thread 承载 eval 长期分析上下文"，AC-E5 要求"eval 猫进入 domain thread"——点击"工作线程"导航到全新的空 thread 因为 eval 从未在此执行 | ✅ Fixed: consequence of OQ-17 — daily eval task now delivers eval invocation content to system threads and triggers eval cat to work in them. PR eval-pipeline-livefix 2026-05-26 |
| OQ-19 | **[BUG] Eval domain thread 不出现在侧边栏"系统"分区**（CVO 二次 report）——KD-15 决策 eval thread 与 IM Hub thread 共享系统线程模型按 `kind` 区分，但实现缺口：①侧边栏 `thread-utils.ts:152-154` 过滤 system thread 的判据是 `!!t.connectorHubState`（IM Hub 专用属性），没有通用的 `kind` 字段；②`ensureEvalDomainThreads()` 只调 `ensureThread(id, title)` 创建裸 thread，不设任何 system 标记；③ Thread 接口没有 `kind` 字段，KD-15 的"按 kind 区分"**决策已录但未落地**。结果：eval thread 存在于 Redis 但被侧边栏归为普通 thread，"系统"分区只展示 6 个 IM Hub thread、0 个 eval thread。修复方向：Thread 接口加 `systemKind?: 'connector_hub' \| 'eval_domain'`，侧边栏过滤从 `connectorHubState` 升级为 `systemKind` 判据 | ✅ Fixed: Thread.systemKind field added (backend+frontend+Redis), sidebar filter upgraded to `!!t.systemKind \|\| !!t.connectorHubState`, ensureEvalDomainThreads sets systemKind='eval_domain' + heals existing threads, ConnectorRouter sets systemKind='connector_hub'. PR eval-pipeline-livefix 2026-05-26 |
| OQ-20 | **[GAP] Eval domain evalCat 写死在 YAML 不可编辑 + Eval Hub 缺 next eval 时间** — 社区用户使用国产大模型（DeepSeek/Qwen/GLM 等），eval-domains YAML 硬编码了 `catId: codex` / `opus47`，社区部署后 eval cron 找不到对应猫静默失败。CVO directive（2026-05-29）：Eval Hub domain card 加 evalCat 编辑能力（弹出 roster 选择器）+ 显示 next eval 时间。实现：后端 `PATCH /api/eval-domains/:domainId/eval-cat`（roster 校验 + available check + domainId registry 校验）+ Redis override + `GET /api/eval-hub/available-cats`（roster-backed）+ `computeNextCronFire(frequency, now)` 所有 domain 显示 + 前端 `<select>` roster 选择器 | ✅ Fixed: PR #1982 merged 2026-05-31 |
| OQ-21 | **[BUG/DIRECTION] Eval verdict 产出链路从未闭环**——`eval-domain-daily.ts:167` 已 `ctx.invokeTrigger.trigger()` 唤醒 eval 猫，但 `generateA2aLiveVerdict` / `generateCapabilityWakeupLiveVerdict` 已写好却**无 production caller**（5/23 a2a verdict 是 PR #1856 one-shot 跑出来的）。Hub 读 `verdicts/` 目录 → 只看到那一份。**Abandoned (PR #2091, 4.6)**：教猫 `git push origin main` 违反 §5 铁律 #2（review 必须跨个体），砚砚 review 抓 4 P1（no real wake / unsafe push / incomplete frontmatter / no e2e roundtrip）。 | ✅ **Fixed: PR #2092 merged 2026-06-05** — Path C narrowed (47/砚砚 收敛, 11 rounds review converged)：(1) manual trigger 真 wake（late-bound `ConnectorInvokeTrigger.trigger()`，'full' outcome → 503）；(2) `eval:a2a generate-now` 调现有 generator + `loadEvalHubSummary()` roundtrip test；(3) unsupported domains（memory/sop/task-outcome/capability-wakeup）→ 501 unsupported_generator, NOT stub；(4) auth chain symmetric：session → network → owner (loopback guard for single-user mode)；(5) idempotency guard：duplicate verdictId → 409 不覆盖 Eval Hub evidence；(6) input hardening：typeof + slug + length (verdictId≤128 / artifact≤255) + path-traversal allowlist；(7) split to 5 source files all < 350 lines per AGENTS.md。**v1.5 backlog**（砚砚 收敛 A 划界外）：audit log + error sanitize + rate limit；non-blocking 因已有 owner/network gate 覆盖 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 本 feature 是 enrichment layer，不拥有 canonical trace schema | 防止和 ADR-032 变成两套源（铲屎官 + 三猫共识 2026-05-07） | 2026-05-07 |
| KD-2 | F167 作为首个 pilot | 天然具备 failure pattern / trace signal / CVO pain / cat friction / sunset 问题 | 2026-05-07 |
| KD-3 | 立项前置 Eval Contract 塞进 Phase B 验证（方案 C），不 reopen Phase A | 模板需 pilot 验证后才有资格成为硬门禁；AC 驱动验证不是验证驱动 AC（47 提议 + 46 确认） | 2026-05-07 |
| KD-4 | Sunset Signal 空填 = Design Gate 不通过，不设 reviewer 签字降级 | 治"只加不删"的核心机制；说不清何时删 = 没想清楚要解决什么（46 决策） | 2026-05-07 |
| KD-5 | Phase C scope pivot：从"文档模板 + monthly digest"改为"runtime eval 基础设施"。Phase B 重新定性为"Eval Contract & Evidence Artifact Pilot"（预期声明层），不是 runtime eval 完成证明 | Phase B AC 设计把"pilot"翻译成了"写文档模板验证 schema"，没有从 F153 拉运行时数据跑真正的 eval。CVO 原话："f192的基础设施根本没做呀！""一个 harness 需要有硬/软/eval，eval 去观测 harness 跑的如何→归因→抽象→解决"。三猫讨论收敛后铲屎官确认（2026-05-08） | 2026-05-08 |
| KD-6 | Phase C = 4 条核心 AC（骨架），剩余推 Phase D。原 Phase C (Tool Eval Contracts + Monthly Digest) 推为 Phase D 后半 | 7 条 AC 是终态蓝图，一口气做完有过度设计风险。3-4 条先搭骨架跑通端到端，再扩展（铲屎官 2026-05-10 确认） | 2026-05-10 |
| KD-7 | Phase E 不开新 F 号，作为 F192 的 Harness Eval Control Plane / Eval Hub 升级 | 关联检测显示 F192 已 owns harness eval + runtime pipeline；longform 第 5 章也把统一 Eval Hub 定位为 F192/F200 竖井的终态收敛 | 2026-05-21 |
| KD-8 | Verdict Handoff Packet 是硬 contract，不是文案建议 | 没有 evidence / trend / root cause / owner ask / re-eval plan 的 handoff 无法 enforce "有理有据"，会退化成"你去看看" | 2026-05-21 |
| KD-9 | 每个 eval domain 要有专属 system thread，但 thread 不是状态真相源 | 深度分析需要长期上下文；状态和趋势仍进入 registry/Eval Hub，避免 thread 变垃圾桶 | 2026-05-21 |
| KD-10 | 旧 scheduled task 清理是接入 AC，不是收尾优化 | F192/F200/F188 已有各自定时/报告机制；不迁移清理会双触发，导致猫猫收到重复 verdict，破坏信任 | 2026-05-21 |
| KD-11 | Phase E 拆为 E-pilot → E-hub → E-scale → E-community；先一个真实 domain 跑通闭环，再做 Hub UI 和多域扩展 | owner review 指出 10 AC 单 Phase 违反 F192 KD-6；Hub 必须由真实 verdict 驱动，避免 F188 dashboard-before-verdict 反模式 | 2026-05-21 |
| KD-12 | Verdict Matrix + Sunset Trial 是 E-hub 前的 contract hardening，不是 UI 后补 | E-pilot review 连续暴露 `fix/build/delete_sunset/keep_observe` 语义洞；应把四类 verdict 的证据门槛、handoff ask、closure 和 CVO 门固化成 contract，避免靠 review 逐条补锅。`delete_sunset` 只能触发可逆 trial，默认终态是 dormant，不直接删除 | 2026-05-22 |
| KD-13 | Live verdict 的 `snapshot:` / `attribution:` evidence SOT 是 committed sanitized bundle，不是 raw runtime artifacts | raw `snapshots/` / `attributions/` 是 gitignored generated artifacts；直接引用会让 clean checkout / reviewer 无法解析 refs。Hybrid bundle 保留审计证据、脱敏边界和可重派生 provenance，同时避免把全量 runtime dump 提交进 repo | 2026-05-22 |
| KD-14 | Eval Hub 是 daily workflow surface，不是 Settings 配置页；F188 Health Dashboard 与 Eval Hub 互链不互替 | Settings 只承载 domain registry / frequency / owner / export policy 等配置。Hub 承载 verdict lifecycle、trend、handoff、closure；F188 承载现场 health repair controls。互链按钮是验收要求，避免用户在两个 surface 间手动找入口；若实用性差，后续调整 IA / 跳转位置属于低风险 UI 改动 | 2026-05-23 |
| KD-15 | System Thread / System Workspace 基座归一：IM Hub 与 eval domain thread 共享系统线程模型，但按 `kind` 区分 | IM Hub（`connector_hub`）和 Eval domain（`eval_domain`）都是 system-managed thread / workspace；归一的是 thread 基础模型、系统分区、删除保护、跳转和管理方式，不归一业务语义。Eval Hub 是工作面，不另造割裂前端；IM Hub 与 Eval Hub 互链，不互替 | 2026-05-23 |
| KD-16 | Phase E 剩余交付按 4 个功能块 PR 收敛：E-hub / E-scale / E-sop / E-community，不按 AC 粒度拆 | PR 边界应对应可独立验收的用户/系统能力，而不是单条 AC。E-hub 由砚砚接，E-scale 由宪宪接；E-sop 依赖已由 F203 #1868 满足但排在 Hub/Scale 后；E-community 最后基于稳定 contract 输出社区 packet | 2026-05-24 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-05 | 砚砚起草 socio-technical eval draft |
| 2026-05-07 | 宪宪加 authority boundary + landing plan |
| 2026-05-07 | 铲屎官确认立项，F192 kickoff |
| 2026-05-07 | Phase A merged (PR #1584) |
| 2026-05-08 | Phase B merged (PR #1590) |
| 2026-05-08 | CVO pivot：Phase C scope 从文档模板改为 runtime eval 基础设施（KD-5） |
| 2026-05-08 | 三猫讨论（砚砚55 / 47 / 46）收敛 Phase C AC 方案（7 条终态蓝图） |
| 2026-05-10 | 铲屎官确认 Phase C = 4 核心 AC，剩余推 Phase D（KD-6） |
| 2026-05-11 | Phase C merged (PR #1626) |
| 2026-05-11 | Phase D merged (PR #1627) — 10/10 AC, 砚砚 review + cloud review clean |
| 2026-05-21 | P1 fix: C2 semantic misclassification merged (PR #1816) — verdict_without_pass/void_hold moved from activationCounts to frictionCounts |
| 2026-05-21 | Phase E kickoff — Harness Eval Control Plane / Eval Hub；CVO 明确 eval 第一性目标 = harness delete/build/fix/keep verdict + structured handoff + legacy scheduled-task cleanup |
| 2026-05-21 | Owner Design Gate R1 — 宪宪/Opus-47 endorse 架构核，要求 Phase E sub-sequence：E-pilot → E-hub → E-scale → E-community；补 eval cat invocation 和 F188 Health overlap OQ |
| 2026-05-21 | Phase E Design Gate passed — owner review verified E-pilot sequencing, Verdict Handoff Packet contract, eval-cat invocation primitive, and F188 Health boundary guard；AC-E1 complete |
| 2026-05-21 | Phase E-pilot implemented — `eval:a2a` docs-backed registry, Verdict Handoff Packet schema, invocation packet, legacy cleanup dry-run, re-eval closure state machine, and representative contract demo fixture |
| 2026-05-22 | Phase E-pilot merged (PR #1835) — `eval:a2a` contract→verdict→handoff→re-eval loop landed with cloud review pass and `pnpm gate` green |
| 2026-05-22 | Phase E contract hardening added — Verdict Matrix Contract + Sunset Trial Contract, clarifying `fix/build/delete_sunset/keep_observe` evidence gates and reversible sunset lifecycle before E-hub |
| 2026-05-22 | Live verdict evidence SOT decided — `snapshot:` / `attribution:` refs resolve to committed sanitized per-verdict bundles; raw runtime snapshots remain ignored (KD-13) |
| 2026-05-23 | First live `eval:a2a` verdict generated — runtime F167 telemetry produced a `keep_observe` verdict with committed sanitized bundle under `docs/harness-feedback/bundles/2026-05-23-eval-a2a-live-verdict/` |
| 2026-05-23 | Phase E live verdict evidence slice merged (PR #1856) — resolver/generator/invariant tests landed for committed `snapshot:` / `attribution:` bundle refs |
| 2026-05-23 | System Thread / System Workspace IA decision recorded — IM Hub system threads and Eval domain threads reuse one system-managed thread base with `kind` separation; Hub surfaces 互链、不互替 |
| 2026-05-23 | **Phase E-sop scoped (AC-E16-E24)**——CVO 反思 "skill = 软约束需硬约束兜底" → `SopDefinition.hard_rules/pitfalls` 作 ground truth，`eval:sop` domain 跑 runtime trace 检测违规，hook 注入决策由 eval 数据驱动 (AC-D9)。Schema **domain-generic from day 1**（cross-domain schema 校验作 AC-E23 硬验证），消除多阶段 skill（video-forge / ppt-forge / tech-writing / expert-panel）= SOP 错位写进 skill body 的归位错位。依赖 F203 #748 merge 提供 SopDefinition + predicate schema。 |
| 2026-05-24 | Phase E remaining PR packaging decided — CVO + 46/55 收敛为 4 个功能块 PR：E-hub（砚砚）、E-scale（宪宪）、E-sop、E-community；不按 AC 粒度继续拆碎 |
| 2026-05-24 | Phase E-hub merged (PR #1878, squash `fe9d2449`) — Eval Hub v1 read model + API + Console Observability/Eval surface landed. It consumes committed live `eval:a2a` verdict bundles, fails closed on missing evidence bundle, and preserves the "互链、不互替" boundary with F188 repair surfaces. AC-E9/E10 complete; Phase E remains open for E-scale / E-sop / E-community. |
| 2026-05-24 | Phase E-scale merged (PR #1879, squash `025ed939`) — `eval:memory` adapter (F200 RecallMetrics + F188 LibraryHealth → VerdictHandoffPacket), multi-domain read model, bidirectional jump links (Eval Hub ↔ Memory Health), and legacy task inventory/dry-run. AC-E11/E12/E13 complete; Phase E remains open for E-sop / E-community. |
| 2026-05-27 | Eval pipeline livefix merged (PR #1913, squash `9ed3b400`) — Fixed 4 CVO dogfood bugs (OQ-16/17/18/19): Thread.systemKind sidebar visibility, Hub all-domains read model, eval-domain-daily cron registration + legacy double-trigger guard, system thread indexForUser for user sidebar. Cloud review found + fixed P1 (thread user indexing) and P2 (cron timezone UTC). |
| 2026-05-27 | Phase E-sop merged (PR #1917, squash `b3ddf5bc`) — `eval:sop` domain-generic SOP compliance evaluator: SOP trace adapter, 7-type predicate evaluator, verdict handoff with three-tier rule-owner resolution (explicit resolver > session author > domain fallback), re-eval closure, cross-domain schema validation (3 stub YAMLs), `development.yaml` first domain + weekly scheduled task registration. 砚砚 R5 review pass (0 P1/P2) + cloud review R2 pass (P2 downgraded P3). AC-E16 through AC-E24 complete; Phase E remains open for E-community. |
| 2026-05-27 | Phase E-community merged (PR #1920) — SanitizedIssuePacket schema + sanitize export (AC-E14), CommunityEvalDomainEntry schema + filesystem loader, community fixtures + validation tests (AC-E15). Cloud review 5 rounds: fixed dailyTrend key scrub (P1), slash-delimited ref + attribution prefix scrub (P1), key collision disambiguation + cross-record stable mapping (P2). 砚砚 R7 放行 + 25/25 tests. AC-E14/E15 complete; **Phase E complete**. |
| 2026-05-27 | **F192 marked done** — 愿景守护 @opus47 放行（4 项 close-hygiene 同步清理）。51 AC met / 16 merged PRs / 5 Phases over 20 days。Close gate ack：1 CVO dogfood directive (livefix OQ-16/17/18/19) addressed in PR #1913；eval:memory / eval:sop adapter + cron 已注册 ✅，第一次真 verdict 等下次 scheduled cron 实际产出（启动状态，不是 bug）。 |
| 2026-05-27 | **F192 reopened — Phase F `eval:capability-wakeup` scoped** — 同日 close 后 reopen，CVO sign-off 2026-05-27（"Path C.1：F192 reopen Phase F eval:capability-wakeup 可以 我同意"）。来源：F203 L0 §8 candidate triage 暴露的 meta-gap "Tier 1 决定缺 eval/tracking 数据"。Phase F 把 F192 eval 从「hard 规则合规」扩到「软提示发现率」（trigger reflex miss rate）。AC-F1-F9 scoped；Path C double-track —— L0 §8 v1 ship 不阻塞，Phase F eval N 周后数据驱动 v2 iterate。依赖 F203 PR L0 §8 v1 merge。 |
| 2026-05-28 | **Phase F design memo merged (PR #1939, squash `c7254eaa5`)** — `eval:capability-wakeup` 设计落地（AC-F1 ✅ + Build seq step 2）：**6 seam** 插既有 eval 控制面（含 gpt52 review 补的 `eval-cat-invocation.ts` DOMAIN_INSTRUCTIONS Record seam）+ **3-way 根因分类器**（认知/行为/注意力稀释，严格按序，knew-how-established 门防认知↔注意力塌缩）+ **全量记录与归因解耦**（CVO 决策 #1：miss 全记含 threadId+sessionId，分类是 analysis 层）+ **治理权重**（CVO 决策 #2：新 forcing hook=Design Gate/CVO accept，demote/promote 轻量）。第三根因「注意力稀释」+ JIT 提醒解药来自 ADR-030 §9.5。6 个 load-bearing 代码缝 opus-47 实测核验（非脑补）。砚砚 3 轮 review（2 轮 BLOCKING：补 Record seam + 修 attention/L0 前提 + 拍平 leftover 口径 → 最后 delta re-review APPROVE）+ docs-only 云端豁免。Phase F 余 implementation（build seq 3-5，workspace 最高优先）。 |
| 2026-05-29 | **C2 eval attribution denominator fix (Phase D follow-up)** — `eval:a2a` 2026-05-29 verdict（砚砚）把 C2 `verdict_without_pass_count=9` 报成 `fix`/human-required。Owner triage（opus47）：根因是**测量假象**不是 guard regression——`verdict_without_pass_count` ≡ `verdict_hint_emitted`（route-serial.ts 同一 site +1），C2 无 `c2.checked` 分母，attribution `ratio = baseline>0 ? v/baseline : 1` 在分母缺失时伪造 100% → 任何 ≥3 的无分母 friction 自动升 high/human-required（confidence 0.4 记录但不 gate）。1→9 跳变其实跟踪 eval 活动本身（猫做 eval 时发结论触发 verdict-no-pass guard）。修复：(1) attribution 分母缺失时不再伪造 ratio——降为 low-severity/pipeline + 提 add-counter，保留 Day-9 #1816「friction 必须 surface」不变量；(2) **显式 per-component denominator map**（C1→`hold_ball_calls` / C2→`c2.checked` / route-serial→`inline_action.checked`，未知前缀 fallback `<prefix>.checked`），新增 `c2.exit_checked` counter（route-serial，每次 exit-check 评估 +1）→ buildC2 暴露 `c2.checked`，使 `verdict_without_pass / c2.checked` 成真实比率（可回答"是否假阳性"）。砚砚 R1 review 抓出 P2：通用 `<prefix>.checked` 漏了 C1 既有分母 `hold_ball_calls` → 改显式 map + C1 regression test。云端 review R1 又抓 P2：C2 的 verdict / void-hold 是两个独立 guard，不能共用 `c2.checked`（否则 void_hold 被 verdict count 稀释 suppress）→ 改 **per-metric 分母 map**（verdict→`c2.checked` / void_hold→`c2.void_hold_checked`），新增 `c2.void_hold_checked` counter + 回归测试。分母数据需 runtime rebuild+restart 后生效；attribution robustness 修复即时止血。 |
| 2026-05-29 | **OQ-20 scoped: Eval Hub domain card editable evalCat + next eval time** — 社区用户报告国产大模型无法跑 eval（YAML 硬编码了内部猫 catId）。CVO directive：Eval Hub domain card 加 evalCat 编辑 + 显示 next eval 时间。Post-close livefix。 |
| 2026-05-31 | **OQ-20 merged (PR #1982)** — Eval Hub domain card: roster-backed `<select>` for evalCat override (Redis-persisted, cron reads override) + `nextCronFireAt` for ALL domains. gpt52 3-round review (5 findings all fixed: roster validation, available=false rejection, domainId registry check, nextCronFireAt semantics, summary read-path decoupling). Cloud P1 downgraded P3 (theoretical `owner` entry not in real roster). |
| 2026-05-29 | **Scheduler stream visibility fix merged (PR #1946, squash `852f6f8c`)** — clowder-ai#796 / Tianyi eval dogfood exposed that scheduled eval replies were persisted under `scheduler` user scope, so `default-user` could not see stream-origin assistant replies after refresh. Fix split trigger identity from invocation owner identity: scheduler trigger messages remain `scheduler`, eval cat invocations use configured owner, and scheduler reply user-id backfill v2 now repairs both `callback` and `stream` replies. Cloud review P1 caught eval-domain system threads created with `createdBy=system`; fix injects configured owner into backfill for `systemKind='eval_domain'` threads before writing v2 marker. Gate + cloud R2 + opus continuity review passed. |
| 2026-06-03 | **C2 observability dimensions added (eval:a2a build verdict 2026-06-03)** — 06-01 / 06-03 两次 C2 verdict-no-pass 比率越过 5% floor（20.8% / 16.7%），中间一天 clean = **intermittent recurrent**。砚砚 `build` verdict（不是 `fix`）：先补可归因维度，让下一次 eval 能区分 review/eval 语境噪音 vs 真实产品线程摩擦。所有 5 个 C2 counter（`c2.exit_checked` / `c2.void_hold_checked` / `c2.verdict_hint_emitted` / `c2.verdict_without_pass_count` / `c2.void_hold_hint_emitted`）加 `thread.system_kind` label（`eval_domain` / `connector_hub` / `product`）；verdict fire 两个 counter 额外用现有 `trigger` semconv 装 keyword（`lgtm` / `approve` / `reject` / `p1p2` / `modify_suggestion` / `approve_cn` / `reject_cn` / `unknown`）。`verdict-detect.ts` 加 `detectMatchedVerdictKeyword`，重构 `VERDICT_PATTERNS` 为 named structure 保持 `hasReviewVerdict` 行为不变。砚砚 R1 抓出 P1：新 labels 必须进 F152 `metric-allowlist.ts`，否则 OTel SDK 静默丢弃 → observability 目标空转。已加 `THREAD_SYSTEM_KIND` 到 genai-semconv + 进 allowlist；keyword label 改用现有 `TRIGGER`（避免新增 key），加 metric-allowlist 回归测试。**纯 observability，无行为改动**——下一次 eval 可按 thread.system_kind / trigger 切分，判定真正的 fix 方向（bypass `eval_domain` 还是 tune VERDICT_PATTERNS 减少 p1p2 overload）。基于上轮（2026-05-29 → 06-02）"wait-one-cycle"教训：单日 anomaly 让 re-eval 自闭，连续复现才算 owner-action territory。 |

| 2026-06-03 | **Phase G scoped: eval:task-outcome v0** — 三猫 + 铲屎官收敛（`docs/discussions/2026-06-03-eval-task-outcome-plan.md`）。补 L3 最大 gap：任务交付质量。核心认知：决策即标注，不做标注员；Episode 是评价对象；Verdict 不叫 score。v0 scope 含 TaskOutcomeEpisode schema / Permission Cancel 记录 / Magic Word 上下文记录 / A1 世界真值绑定 / eval:task-outcome 域注册。 |
| 2026-06-03 | **Phase G v0 implementation (AC-G1 through AC-G9)** — 9/11 AC 完成：TaskOutcomeEpisode Zod schema + PermissionCancelRecord/MagicWordRecord/A1WorldTruthRecord + signal builders + SQLite-backed episode store + route handlers + eval domain registration (domainId/sourceAdapter/DOMAIN_INSTRUCTIONS/YAML) + authorization deny hook + shared types for frontend cancel reason popup. 87 tests all green, 0 regression on existing harness-eval tests. Remaining: AC-G10 前端 cancel 理由浮层 + AC-G11 端到端验证。 |
| 2026-06-05 | **VERDICT_PATTERNS keyword tuning (eval:a2a fix verdict 2026-06-05)** — #2058 observability shipped → 06-04 clean (2/25 sub-floor) → 06-05 `19/125 = 15.2%` (real signal). 切片数据决定性：所有 19 fires 都是 `thread_system_kind="product"`（system-thread 噪音假设证伪），trigger 分布 `approve: 10` / `p1p2: 8` / `reject: 1`（keyword overload 假设证实，18/19 落在 review-discussion 高频词）。砚砚 `fix` verdict 走 owner action 路径而不是再绕一圈 build。两条最保守的针对性收紧：(1) `approve`: `/\bapprove(d\|s)?\b/i` → `/\bapproved\b/i`，只匹配过去式（决定已下），丢掉裸 `approve`/`approves` 的 intent / 第三人称叙事；(2) `p1p2`: `/\bP[12]\b/` → `/\bP[12]\s*[:：]/`，必须带冒号（典型 verdict 格式），丢掉 `P1 already fixed` / `P0/P1/P2 all clean` 类状态/列举。Trade-off：极少 uncolon 真 verdict（`found P1 in handler`）会漏；可逆——下一次 eval 若 ratio 还高就加 classifier-context fallback，若塌到 floor 下且 cats 真漏球就回调。644 tests green。基于上轮 #2058 R3 base-drift 教训：开 worktree 后第一刀就 rebase 到最新 origin/main，避免后续 squash 倒回别人合入的 commit。 |
| 2026-06-05 | **Phase H alpha verified** — opus-47 调 `cat_cafe_publish_verdict` MCP tool 对 `eval:memory` 返回预期 `501 unsupported_generator`（详情字符串一字不差匹配 `publish-verdict.ts:154`），证明 MCP registration + callback auth + invocation principal + catId derive + handler full chain 在 alpha 真活，零副作用。Phase H 收尾 scope locked：只 wire `eval:capability-wakeup`（generator 已就绪同模式，~30 行 adapter）；sop/memory/task-outcome 因 generator 缺位（sop 只 build packet 不写 disk，memory/task-outcome 没 generator）独立 backlog。 |
| 2026-06-05 | **Phase H merged (PR #2109, squash `33ee6ae54`)** — `cat_cafe_publish_verdict` MCP tool + handler + real GitPublisher（git worktree add → stage → commit → push → gh pr create → cleanup finally）+ `eval-a2a` adapter（cat 拥有 verdict，generator 只 override bundle refs）。Auth 双 principal（callback invocation + agent-key for shared-MCP Antigravity），catId 从 server-trusted principal 取（非 body）。OQ-20 Redis evalCat override 与 trigger-now 对称尊重。AC-H1（schema + handoff 完整性 + 8 字段 newline injection guard）+ AC-H2（GitPublisher isolated worktree + push--delete remote on probe-confirmed no-PR + 路径 repo-relative return）+ AC-H3/H4/H5/H7-partial/H8 全 ✅，AC-H6 partial（handler unit + route Fastify-inject e2e，real git+gh round-trip deferred 到 alpha）。21 轮 review 闭环（砚砚 R0-R20 + 云端 R1-R21），lessons：(1) 提交报 size 必须 post-lint `wc -l`（biome reformat 会展开 compact one-liner，连续 3 轮 R10/R17/R20 误报）；(2) merge-gate 阶段串行不并行——不要 ping 本地砚砚同时 trigger 云端（铲屎官 R20 push back）。522 tests green，handler 297 / validation 103 / publisher 158 / 全套 <350. |
| 2026-06-06 | **Phase H 收尾 PR-1a merged (PR #2115, squash `c51af580a`)** — capability-wakeup contract alignment before adapter wire（砚砚 R0 Path B narrowing）。`assertSubmittedPacketMatches` 4 轴 invariant 守 cat-submitted packet（domain × feature × capability × generator-identity），mirror `buildCapabilityWakeupVerdictHandoff:20-22` 的 build-from-trials 路径不变量——submittedPacket 路径不能比 CVO-regen 安全性弱。`CapabilityWakeupSourceSelector` skeleton（window-based selector + future trial-ids 占位，砚砚 R0：trial-ids 在 durable store 之前是伪精确）。R4 P2 newline injection guard 覆盖 3 个 cat-controlled rendered fields（`phenomenon` / `ownerAsk.requestedAction` / `metricRefs[]`），阻 `value\n- snapshot:forged` 假 evidence 注入 Hub view。R1 P2 metric `metric:metric:` double-prefix idempotent fix（a2a R14 mirror，extract `formatMetricRefBullet` helper 让 strip-then-add 模式视觉无歧义，破除云端 reviewer-LLM 模式盲视）。22 轮 review（砚砚 R0-R3 local + 云端 R1-R5）。9/9 capability-wakeup submittedPacket invariants green，gate 187s 全套通过。Lessons：(1) failure-mode family 第二次同型出现强制做 audit（R8/R2/R3/R4 全是 submittedPacket-inherits-weaker-invariant 同族）；(2) 云端 reviewer-LLM 对内联 ternary template literal 有模式盲视，extract helper + 显式名字可破；(3) R20 重申：cloud review 介入后 author ↔ cloud 串行迭代，本地砚砚 R3 放行=终态，除非愿景级 / 跨族架构改动才再拉。PR-2（adapter wire + PUBLISH_VERDICT_SUPPORTED_DOMAINS + DOMAIN_INSTRUCTIONS + bootstrap inject ≈ 150 行）待办。 |

## Review Gate

- Phase A: 砚砚 review（草案原作者验证骨架实现与设计一致）
- Phase B: 跨家族 review
- Phase C: spec 更新需跨家族 review；实现需跨家族 review
- Phase D: digest 结论需铲屎官确认
- Phase E: 架构级 Design Gate 由 F192 owner + 跨族 reviewer 收敛；E-pilot 先行（无 UI）；Eval Hub UI 需等 E-pilot 真实 verdict 后再 design-in-context + 铲屎官验收；legacy scheduled-task cleanup 需 dry-run report

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| Discussion | `docs/discussions/2026-05-05-socio-technical-harness-eval-draft.md` | 原始草案 |
| Discussion | `docs/discussions/2026-05-21-f192-phase-e-eval-hub-kickoff/README.md` | Phase E kickoff / Design Gate 草案 |
| Article Draft | `docs/content/drafts/longform-002-v0-formal.md` | 第 5 章 Eval / Harness Eval Control Plane 论述 |
| Decision | `docs/decisions/031-harness-engineering-methodology.md` | 方法论基础 |
| Decision | `docs/decisions/032-cat-cafe-as-local-first-trace-enabler.md` | 数据归属边界 |
| Feature | `docs/features/F167-a2a-chain-quality.md` | Pilot 目标 |
| Feature | `docs/features/F153-observability-infra.md` | Canonical trace 来源 |
| Feature | `docs/features/F188-library-stewardship.md` | Memory/library health governance 首批接入域 |
| Feature | `docs/features/F200-memory-recall-eval.md` | Memory recall eval 首批迁移对象 |
