---
feature_ids: [F153]
related_features: [F130, F008, F150]
topics: [observability, telemetry, metrics, health-check, infrastructure]
doc_kind: spec
created: 2026-04-09
community_issue: "zts212653/clowder-ai#388"
---

# F153: Observability Infrastructure — 运行时可观测基础设施

> **Status**: in-progress | **Owner**: Community + 布偶猫 | **Priority**: P2

## Why

Cat Cafe 当前缺乏系统性运行时可观测能力：异常难定位、超时难检测、猫猫是否在工作没有可靠信号。F130 解决了日志落盘，但 metrics/tracing/health 这一层还是空白。社区贡献者提交了 clowder-ai#393 实现 Phase 1 基础设施。

铲屎官原话（2026-04-09）："这是可观测性基础设施 PR，核心是在 packages/api 里接入 OTel SDK，补 telemetry redaction、metrics allowlist、Prometheus/OTLP、/ready 健康检查，以及 cli-spawn 参数脱敏。"

## What

### Phase A: OTel SDK + Metrics + Health Check（社区 PR intake）

从 clowder-ai#393 intake 以下模块：

1. **TelemetryRedactor** — 四级字段分类脱敏
   - Class A（凭证 → `[REDACTED]`）
   - Class B（业务正文 → hash + length）
   - Class C（系统标识符 → HMAC-SHA256）
   - Class D（安全数值 → passthrough）
2. **MetricAttributeAllowlist** — bounded cardinality，防止高基数标签爆炸
3. **OTel SDK init** — NodeSDK for traces/metrics/logs，Prometheus scrape + optional OTLP push
4. **5 个 instruments** — `invocation.duration`, `llm.call.duration`, `agent.liveness`, `invocation.active`, `token.usage`
5. **`/ready` 端点** — Redis ping probe，返回 `ready`/`degraded`
6. **cli-spawn 参数脱敏** — debug 日志不再打 prompt 明文

### Phase B: OTel 全链路追踪（社区 PR intake）✅

从 clowder-ai#450 intake 以下模块：

1. **parentSpan 全链路穿透** — invocationSpan → AgentServiceOptions → 6 providers → CliSpawnOptions → spawnCli
2. **`cat_cafe.cli_session` child span** — CLI 子进程生命周期追踪（4 路状态：timeout/error/signal/ok）
3. **`cat_cafe.llm_call` retrospective span** — 从 done-event 的 `durationApiMs` 反推 startTime（仅 Claude 等有计时数据的 provider）
4. **`tool_use` span events** — 通过 `addEvent()` 记录工具调用（点标记，非零时长 span）
5. **28 个结构测试** — source-level 验证 span 创建、线程化、属性、脱敏安全

### Phase C: Inline @mention observability（社区 PR intake）✅

从 clowder-ai#489 intake 以下模块：

1. **8+1 A2A counters** — `inline_action.checked/detected/shadow_miss/feedback_written/feedback_write_failed/hint_emitted/hint_emit_failed/routed_set_skip` + `line_start.detected`
2. **Shadow detection** — strict/relaxed 双层启发式，区分 `strict hit / shadow miss / narrative mention`
3. **Data minimization** — shadow miss 只保留 `contextHash + contextLength`，不写 raw text
4. **主链路接入** — `route-serial` 在 feedback 持久化、hint 发射、routedSet overlap 处补 metrics
5. **18 个回归测试** — narrative 过滤、same-line dual mention、routedSet skip、strict/shadow coexistence

### Phase D: 后续增强

- Grafana 统一看板
- burn-rate 告警规则
- MCP call spans + tool execution duration spans（真实执行边界）
- Runtime exporter 级 tracing tests（in-memory exporter 验证父子关系）

## Acceptance Criteria

### Phase B（OTel 全链路追踪）✅
- [x] AC-B1: invocationSpan 作为 parentSpan 穿透到 spawnCli（全部 6 个 provider）
- [x] AC-B2: `cat_cafe.cli_session` child span 在 spawnCli 创建，finally 块中按退出原因设 status
- [x] AC-B3: `cat_cafe.llm_call` retrospective span 从 done-event durationApiMs 创建（有计时数据时）
- [x] AC-B4: `tool_use` 通过 `addEvent()` 记录（非零时长 span 反模式）
- [x] AC-B5: span attribute keys 使用 redactor 可识别的 key（`invocationId`/`sessionId`，不用 snake_case）
- [x] AC-B6: 28/28 结构测试通过

### Phase A（OTel SDK + Metrics + Health Check）✅
- [x] AC-A1: TelemetryRedactor 四级分类正确脱敏（Class A/B/C/D 各有测试）
- [x] AC-A2: Prometheus `/metrics` 端点可用，5 个 instruments 有数据
- [x] AC-A3: `/ready` 端点返回 Redis 健康状态
- [x] AC-A4: cli-spawn debug 日志不含 prompt 明文（回归测试）
- [x] AC-A5: HMAC salt 缺失时启动阶段校验并 graceful degradation（禁用 OTel + warning log，服务继续运行）
- [x] AC-A6: Prometheus exporter 端口可通过 env 配置（不硬编码 9464）
- [x] AC-A7: `activeInvocations` 计数器在 generator early abort 时正确递减
- [x] AC-A8: yielded-error 路径（`hadError = true`）的 span 正确标记为 ERROR 并补 OTel error log
- [x] AC-A9: `agent.liveness` gauge 有实际调用点（或从 scope 移除，instruments 数量与 PR 描述一致）
- [x] AC-A10: aborted invocation（generator `.return()`）的 OTel span/log 与审计日志信号一致

### Phase C（Inline @mention observability）✅
- [x] AC-C1: line-start @mention baseline 和 inline-action 检测 counters 已接入 `route-serial`
- [x] AC-C2: shadow detection 只把 relaxed-action vocab gap 记为 miss，纯 narrative mention 不污染计数
- [x] AC-C3: routedSet overlap 单独计数，且 narrative routed mention 不得误计 skip
- [x] AC-C4: feedback 写入失败 / hint 发射失败从 silent catch 变为可观测 counter
- [x] AC-C5: shadow miss metadata 只含 hash + length，不含 raw text
- [x] AC-C6: regressions 覆盖 strict/shadow 同猫跨行、same-line dual mention、code block / blockquote 排除

## Dependencies

- **Related**: F130（API 日志治理 — 同属可观测性，F130 管 logging，F153 管 metrics/tracing）
- **Related**: F008（Token 预算 + 可观测性 — token 层面的可观测性）
- **Related**: F150（工具使用统计 — 应用层统计看板）

## Risk

| 风险 | 缓解 |
|------|------|
| 社区 PR 有 2 个 P1（counter 泄漏 + 端口硬编码）| ✅ 已修复（4 轮 review 后全部 P1 绿灯）|
| OTel SDK 增加启动依赖和包体积 | Phase A 保持可选（env 开关），不强制 |
| Prometheus 端口与 alpha/runtime 端口冲突 | 必须走 env 配置，不允许硬编码 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 基础设施选型：自托管 vs Grafana Cloud？ | :white_large_square: 未定 |
| OQ-2 | Phase B 全链路追踪的优先级？ | ✅ 已完成（clowder-ai#450 intake） |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 社区 PR 先不放行，P1 修完再 intake | 砚砚 review 发现 counter 泄漏 + 端口硬编码 | 2026-04-09 |
| KD-2 | 分配 F153（cat-cafe F152 = Expedition Memory 已占） | 铲屎官确认 | 2026-04-09 |
| KD-3 | AC-A5 改为 graceful degradation（缺 salt → 禁用 OTel，不崩溃）| 生产稳定性优先 | 2026-04-11 |
| KD-4 | Pane registry abort 状态不一致接受为 known limitation，不阻塞 intake | pre-existing 行为，属 F089 terminal 域 | 2026-04-13 |
| KD-5 | 4 轮 review 后放行 intake | 所有 P1 已修，核心 P2 已修，剩余 P2 non-blocking | 2026-04-13 |
| KD-6 | Phase B review: tool_use 改 addEvent + redactor-safe keys | 布偶猫+缅因猫双猫 review 发现零时长 span 反模式 + 脱敏穿透 | 2026-04-12 |
| KD-7 | Phase B 2 轮 review 后放行 intake | P1（脱敏）+ P2（tool_use + scope）全部修完 | 2026-04-12 |
| KD-8 | clowder-ai#489 双猫重审后放行 merge + absorb | strict/shadow/narrative 三级模型成立；剩余架构偏好降为 non-blocking | 2026-04-15 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-09 | 立项。社区 PR clowder-ai#393 → 砚砚 review 发现 2P1+1P2 → 铲屎官确认开 F153 |
| 2026-04-11 | Round 2: 旧 P1 全修，新增 P2（yielded-error span + salt 语义）|
| 2026-04-12 | Round 3: yielded-error 修了，liveness 空转 P1 + aborted 信号 P2 |
| 2026-04-13 | Round 4 (Final): 全部 P1 绿灯，批准 intake。pane 状态不一致为 known limitation |
| 2026-04-13 | Phase A merged (PR #1086)。Intake from clowder-ai#393，18/18 tests pass |
| 2026-04-12 | Phase B: clowder-ai#450 → R1 review 发现 1P1+2P2+1P3 |
| 2026-04-12 | Phase B: R2 全部修完 → approve → merge → intake (PR #1128)，28/28 tests pass |
| 2026-04-15 | Phase C: clowder-ai#489 / clowder-ai#479 经双猫重审后放行 merge；maintainer 结论从 hold 改为 approve |
| 2026-04-15 | Phase C intake 启动：cat-cafe#1200 建立逐文件 Intake Intent Issue，吸收 inline @mention observability 5 个文件 |

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **PR** | `zts212653/clowder-ai#393` | 社区 PR（待修复 P1 后 intake） |
| **Issue** | `zts212653/clowder-ai#388` | 对应 issue |
| **PR** | `zts212653/clowder-ai#489` | Phase C 社区 PR（inline @mention observability） |
| **Issue** | `zts212653/clowder-ai#479` | Phase C 对应 issue |
| **Issue** | `zts212653/cat-cafe#1200` | Intake Intent Issue（逐文件 absorb spec） |
| **Feature** | `docs/features/F130-api-log-governance.md` | 日志治理（logging 层） |
