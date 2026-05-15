---
feature_ids: [F201]
related_features: [F061, F172, F174, F178, F183, F193, F194, F197]
topics: [antigravity, reliability, side-effect-journal, availability, recovery, smoke-test, rich-block]
doc_kind: spec
created: 2026-05-15
---

# F201: Antigravity Reliability Contract — 孟加拉猫可靠可用性闭环

> **Status**: in-progress | **Owner**: 缅因猫（砚砚） | **Reviewer**: 布偶猫 Opus 4.6 + 布偶猫 Opus 4.7 | **Priority**: P0

## Why

2026-05-15 的现场事故暴露出 F061 close 后仍缺少一个“可靠可用”的产品级契约：

- `@antig-opus` 在旧 cascade 上出现 `Antigravity returned no text response`。这类问题不能只显示空回复，必须告诉用户是 cascade/context 边界、上游空结果、还是我们桥接层没识别输出。
- `@antig-opus` 在隔壁 `adhd asd` thread 写入测试文件成功后，前端显示 `Error: 连接中断`。本地证据显示测试文件确实留下了，说明故障发生在 side effect 之后；此时不能盲 retry，也不能只给红色错误。
- 现有 retry gate 为了避免重复执行工具，遇到 toolish/side-effect activity 后会停止自动 retry，这是正确的安全底线，但用户体验变成“写了文件然后挂了，不知道后续怎么办”。

这不是“给孟加拉猫降级”的问题。我们要把 Antigravity 从“能接入、能偶尔修”提升到“可诊断、可恢复、可验收、可持续巡检”。

### Incident Evidence Anchors

| 事故 | Anchor | 现象 | F201 回归形态 |
|------|--------|------|---------------|
| empty response | `thread_mp5lezi1hp0cft3w` / `cascade=e764b99a...` | 老 cascade 上 Antigravity 返回空 `PLANNER_RESPONSE`，前端显示 `Antigravity returned no text response` | `empty_response && no side effect` 应带 cascade health，并在阈值命中时 fresh-cascade retry 一次 |
| post-file-write stream interruption | `thread_mp5vr6hjjwsv9zbw` / `cascade=5df3042c...` 与 `3f5ad2f2...` | 文件写入成功后出现 `stream_error grace expired without recovery`，用户只看到 `连接中断` | `post_side_effect_interrupted` 应输出 side-effect journal + resumable recovery card，禁止盲 retry |
| incident artifact | `docs/stories/audhd-self-observation/_test-write-capability.md` | 事故现场曾遗留测试文件；当前工作树已不存在该文件 | 作为事故证据路径记录，不进入常规 smoke；常规 smoke 必须用 sentinel sandbox |

## Feature Audit

| Feature | 当前结论 | 与 F201 的关系 |
|---------|----------|----------------|
| F061 Antigravity 接入 | `done` | Phase 3 已交付 unified upstream fault tolerance：5-kind error taxonomy、`shouldRetryTransient` retry pipeline、toolish-step safety gate、`textMode=replace` partial text recovery、Chinese user-facing messages。F201 不重做这些；F201 在 Phase 3 之上补 ① `CODE_ACTION` 纳入 effect gate，② side-effect journal，③ recovery decision engine refactor 现有 retry gate，④ availability smoke，⑤ typed recovery card。 |
| F172 图片发布 | `done` | 已修 image-only 不应触发 empty_response；F201 不把 image-only 作为 close-gate smoke，避免重新承载 F172 scope；若发现 image regression，回 F172 verify/alpha smoke。 |
| F178 Persistent MCP Agent-Key Auth | `in-progress` | Phase B/C 已解决 agent-key write path MVP，Phase D UI/audit/key orphan guard 未完。F201 只消费 agent-key writeback 是否能调通，不做 agent-key lifecycle health 或 F178 audit。 |
| F193 Cross-Thread Communication Unification | `done` | 为 cross-thread / agent-key / callback 契约提供底座；F201 复用，不重建通信协议。 |
| F183 Bubble Pipeline Architecture Consolidation | `done` | 前端消息气泡和 rich block 管线真相源；F201 typed recovery card 必须走 F183 bubble pipeline，不另起 UI 写路径。 |
| F194 Invocation Liveness Canonical Read Model | `done` | 为“红色连接中断但 invocation 实际做了 side effect”的 read model 提供参考；F201 需要接入 liveness/partial-state 可见性。 |
| F197 ACP tool_result surfacing | `done` | 不是 Antigravity feature，但提供“单事件拆 tool_use/tool_result”的可观测性参照。 |

结论：**需要新 Feature F201**。F061 是接入完成，不是可靠性验收；F178 是鉴权写路径，不覆盖 stream interruption、side-effect resume、availability smoke 和 UI recovery。

## Reliability Contract

F201 关闭时，Antigravity 必须满足以下契约：

1. **失败必须可解释**：所有 `empty_response` / `stream_error` / 上游错误都带结构化 reason、cascadeId、step counters、是否发生 side effect、下一步恢复动作。
2. **side effect 必须可追踪**：文件写入、删除、MCP 写回、图片产物、shell 执行等动作进入 side-effect journal；失败后用户能看到“已完成什么、未完成什么、能否安全继续”。
3. **恢复必须区分安全等级**：side effect 前的瞬态失败可以自动换 fresh cascade 重试；side effect 后只允许 resumable recovery，不做盲 retry。
4. **可用性必须有 smoke gate**：text-only、MCP read、agent-key writeback call、file write/delete sentinel、large cascade retirement 至少一组端到端 smoke 可重复跑。
5. **UI 不再只给红字**：连接中断后展示 typed error card，包含完成动作、残留文件/产物、建议操作和可复制诊断信息。

## Journal / Audit Boundary

| Layer | Owner feature | 记录什么 | F201 边界 |
|-------|---------------|----------|-----------|
| Callback verify telemetry / plug indicator | F174 | callback token / principal verify 成败、401 reason、降级提示 | F201 只读取结果，不新增 callback verify audit。 |
| Agent-key write audit | F178 | agent-key 写操作、rotate/revoke/list、key orphan guard、inventory UI | F201 不记录 key lifecycle；只在 smoke 中调用 agent-key writeback 并记录调用结果。 |
| Antigravity side-effect journal | F201 | 单个 cascade/invocation 内 Antigravity 已执行或可能执行的文件、MCP、shell、artifact side effect | F201 journal 用于 retry/resume/UI recovery，不替代 F174/F178 audit。 |

## Scope

### In Scope

- Antigravity cascade health / retirement gate。
- `CORTEX_STEP_TYPE_CODE_ACTION`、`MCP_TOOL`、`RUN_COMMAND`、`GENERATE_IMAGE` 等 step taxonomy 明确化。
- Side-effect journal + retry/resume policy。
- Availability smoke runner + alpha/runtime canary。
- 前端错误展示从“纯红字”升级为 typed recovery card。
- F178 agent-key writeback smoke 接入；不做 agent-key 过期/吊销/rotation health。

### Out of Scope

- 不绕过 Antigravity 平台自身的权限/安全限制。
- 不把 persistent MCP 写权限无限放开；F178 的 allowlist 和 `CAT_CAFE_READONLY` 总闸仍然有效。
- 不用盲 retry 重放文件写入/删除/shell。
- 不新增 F174/F178 审计写口；side-effect journal 只服务 Antigravity recovery。
- 不把 F172 image-only regression 作为 F201 close gate；如需跑 image 回归，挂到 F172 verify/alpha smoke。
- 不把所有上游平台不稳定都包装成“Cat Café 已保证 100% 成功”。F201 保证的是可诊断、可恢复、可验收。

## Acceptance Criteria

### AC-A: Incident Classification

- [ ] AC-A1: `empty_response` metadata 至少包含 `cascadeId`、`totalStepsSeen`、`rawStepTypeCounts`、`lastDelivered`、`cascadeHealth`、`sideEffectSummary`。
- [ ] AC-A2: `stream_error` 根据 side-effect 状态分为 `pre_side_effect_transient`、`post_side_effect_interrupted`、`upstream_stream_interrupted`。
- [ ] AC-A3: `CORTEX_STEP_TYPE_CODE_ACTION` 不再落入 silent `unknown_activity`；至少被识别为 side-effect-capable activity。
- [ ] AC-A4: 不能判定 effect 的 step 默认 side-effect-capable，禁止 blind retry；warning budget 只是 telemetry，不能当恢复策略 gate。
- [ ] AC-A5: UI step bucket 与 effect classification 有显式映射表；测试覆盖每个 fixture step 不出现互相矛盾的 retry/UI 结论。

### AC-B: Side-Effect Journal

- [ ] AC-B1: 每个 invocation/cascade 有 side-effect journal，记录 stepId、stepType、operation、target、status、idempotencyKey、observedAt；已 `done` 的 side effect 必须有 idempotencyKey。
- [ ] AC-B2: 文件写入/删除 smoke 失败时，错误卡明确列出残留路径和清理状态。
- [ ] AC-B3: post-side-effect interruption 不触发盲 retry；只输出 resumable state。
- [ ] AC-B4: resume prompt 带 journal 摘要，要求 Antigravity 继续未完成动作且不得重复已完成 side effect；若新 side effect 命中已 done 的 idempotencyKey，Cat Café 侧自动 dedup，不只依赖 prompt 约束。
- [ ] AC-B5: 现有 `executionJournal` inline metadata 被 `AntigravitySideEffectJournal` 明确 subsume 或委托，不保留两个同名不同义的 journal。

### AC-C: Availability Smoke

- [ ] AC-C1: `pnpm antigravity:smoke` 或等价脚本存在，默认 dry-run / explicit opt-in，不污染真实工作树。
- [ ] AC-C2: smoke 覆盖 text-only 回复、MCP read、agent-key thread writeback call、file write/delete sentinel、large cascade retirement。
- [ ] AC-C3: smoke 连续 3 次通过，且失败时产出 JSON report（ports、cascadeId、step taxonomy、side-effect journal、cleanup）。
- [ ] AC-C4: runtime/alpha 启动后能运行只读 health probe，区分“Antigravity 未启动”“LS 不通”“MCP config 旧”“上游模型异常”；agent-key 过期/吊销/rotation health 留在 F178。
- [ ] AC-C5: smoke report 有 typed schema（`AntigravityAvailabilitySmokeReport`）和 shape test，禁止回退成 ad hoc JSON。
- [ ] AC-C6: sentinel smoke 使用 lockfile（pid + timestamp）；上次异常退出留下 stale lock / leftover 时，下次先报告并清理，清理失败即红灯。

### AC-D: Cascade Context Boundary

- [ ] AC-D1: 进入 Antigravity 调用前检查 cascade step count / trajectory size proxy；超过阈值自动 retire 到 fresh cascade，并在消息中标注。
- [ ] AC-D2: old cascade `empty_response` 可以自动 fresh-cascade retry 一次，但前提是 journal 证明没有 side effect。
- [ ] AC-D3: retry signal 不抹掉已有 partial text；`textMode=replace` 仅用于明确的 fresh-cascade 重试。
- [ ] AC-D4: 初始阈值可配置且有测试锚点：warn ≥ 1.5 MiB 或 ≥ 150 steps；retire ≥ 2.0 MiB 或 ≥ 200 steps，且只有 journal clean 时可自动 retire。

### AC-E: User Experience

- [ ] AC-E1: 前端不再只显示 `Error: 连接中断`；展示 typed recovery card。
- [ ] AC-E2: card 包含“已完成动作 / 未完成动作 / 建议下一步 / 诊断 ID”。
- [ ] AC-E3: 用户能复制诊断摘要，直接交给维护猫排查。
- [ ] AC-E4: typed recovery card 必须走 rich block（v1 复用 `kind: card`，后续可升级 `antigravity_recovery` kind）并接入 F183 bubble pipeline，不另起 React 消息树。

### AC-F: Close Gate

- [ ] AC-F1: 单元测试覆盖 step taxonomy、retry gate、side-effect journal、empty_response metadata。
- [ ] AC-F2: 集成测试覆盖 pre-side-effect retry 与 post-side-effect non-retry。
- [ ] AC-F3: 手动 alpha smoke 记录落到 close report。
- [ ] AC-F4: F178 Phase D 状态不被 F201 偷偷吞掉；若 close 前仍未完成，close report 必须列为 external dependency。

## Implementation Phases

### Phase A: Spec + Evidence Baseline

- 固化 2026-05-15 两个事故为 regression cases。
- 建 `AntigravityReliabilityEvent` / `SideEffectJournalEntry` 的领域模型。
- 给现有 F061/F172/F174/F178/F183/F193/F194/F197 做边界说明，避免重复 reopen。

### Phase B: Step Taxonomy + Journal

- 把 step 分类从 ad hoc boolean 提升为单点函数：`classifyAntigravityStepEffect(step)`。
- 明确 `CODE_ACTION`、`MCP_TOOL`、`RUN_COMMAND`、`GENERATE_IMAGE` 的 effect type 和 retry safety。
- 迁移契约：`classifyStep()` 保留为 UI bucket mapper，但所有 retry/side-effect 问题都委托 `classifyAntigravityStepEffect()`；`batchHasToolishStep` 被 journal/effect summary 替换，不继续新增第三套判断。
- journal 先落 invocation metadata / JSONL audit，后续可接 Redis read model。

### Phase C: Recovery Policy

- 封装 `decideAntigravityRecovery(error, journal, cascadeHealth)`。
- Phase C 必须 deprecate inline `shouldRetryTransient` 决策，并把 `attemptHasResolvedToolishStep` / native dispatch / tool activity 信号收口进 decision engine；保留 F061 Phase 3 的 `classifyUpstreamError()` 与 `humanErrorMessage()` 作为 error taxonomy helpers，不允许两套 retry policy 并存。
- pre-side-effect transient 才 fresh retry。
- post-side-effect interruption 输出 resumable error + journal summary。
- 构造 resume prompt payload：由 API 根据 journal summary 生成 machine-readable resume context，下一次继续时要求 Antigravity 跳过已完成 side effect，只执行未完成动作。
- large cascade 自动 retire，防止 2MB+ trajectory 继续累积。

### Phase D: Smoke + Canary

- 增加 explicit opt-in smoke runner，产生 machine-readable report。
- alpha 环境加入只读 health probe。
- smoke 使用 sentinel directory，必须清理；清理失败是测试失败。

### Phase E: UI Recovery Card

- API error metadata 标准化。
- Web hook 将 Antigravity typed error 显示为 recovery card。
- 保留原始红字作为 fallback，不作为主体验。

### Phase F: Close Gate

- 跑单元、集成、smoke、alpha 手测。
- 找跨家族 reviewer，至少 46/47 + 砚砚三方签字。
- close report 写入 F201 timeline。

## Open Questions for Review

| # | 问题 | 推荐立场 |
|---|------|----------|
| OQ-1 | side-effect journal 第一版落哪里？ | 先落 invocation metadata + JSONL audit，避免先做 Redis migration；等 UI/read model 稳定后再迁移。 |
| OQ-2 | `CODE_ACTION` 的 file path / operation 如何可靠提取？ | 先用 raw step schema 适配器 + shape tests；无法提取时仍记录 `operation=unknown_code_action`，但标记为 side-effect-capable。 |
| OQ-3 | post-side-effect interruption 是否允许自动 resume？ | 默认不自动；输出 resume-ready state，由下一次用户/猫调用带 journal 摘要继续。 |
| OQ-4 | smoke 是否可以写真实 docs 路径？ | 不可以。必须写 sentinel sandbox，除非用户明确指定现场复现。当前留下的 `_test-write-capability.md` 只作为事故证据，不作为常规 smoke。 |
| OQ-5 | F178 Phase D 是否并入 F201？ | 不并入。F178 Phase D 是 agent-key inventory/audit，F201 只消费其结果并在 close gate 检查依赖状态。 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-15 | 立项草案：用户现场报告 `empty_response` + post-file-write `连接中断`；砚砚确认 F061 done、F178 in-progress，建议新开 F201 reliability contract。 |
| 2026-05-15 | Landy 明确开工：46 + 47 双 review approve 后，F201 进入 in-progress，砚砚开 worktree 实施 Phase A。 |
