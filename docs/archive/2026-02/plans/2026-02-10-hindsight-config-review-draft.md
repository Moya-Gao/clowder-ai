---
feature_ids: []
topics: [hindsight, config, draft]
doc_kind: plan
created: 2026-02-10
---

# Hindsight 长期记忆配置评审稿（v0.2）

> 日期：2026-02-10  
> 目标状态：评审通过后，进入 **API + UI 一起实现**  
> 范围：仅定义配置项，不改代码行为
> 本版变更：**暂时统一使用缅因猫（Codex）作为推理引擎；Hindsight 独立服务仅承担存储/检索。**

## 1. 评审目标

- 把“长期记忆怎么调”从口头约定变成明确配置表。
- 明确每个字段的：
  - 字段名（key）
  - 默认值（default）
  - 可调范围（range/enum）
  - 热更新策略（hot-update / restart）
- 为下一步实现确定边界：先做哪些字段，哪些后置。

## 2. 当前基线（已在代码中存在）

- `hindsight.enabled=true`
- `hindsight.baseUrl=http://localhost:8888`
- `hindsight.sharedBank=cat-cafe-shared`
- `hindsight.recallDefaults={ budget: mid, tagsMatch: all_strict, limit: 5 }`
- `hindsight.retainPolicy={ narrativeFactRequired: true, minUsefulHorizonDays: 180 }`
- `hindsight.reflect={ dispositionMode: template_only }`

说明：以上来自当前 `ConfigRegistry` 快照；本稿在此基础上扩展“可调范围”和“引擎路由”。

## 3. 配置分层（v0.2）

- Layer A（Cat Cafe Runtime）：
  - 由 Cat Cafe API 读取并生效。
  - 支持 `/api/config` 可见和部分热更新。
- Layer B（Hindsight 独立服务）：
  - 仅承担存储/检索（retain 写入、recall 检索）。
  - 本期不把 LLM 推理决策绑定在 Hindsight 服务内部。
- Layer C（Codex 推理引擎）：
  - Reflect 与 Retain 提取统一走 Codex OAuth 通道。
  - 目标：避免多模型漂移，先把链路统一再做优化分层。

## 4. 配置项清单（评审主表）

## 4.1 Layer A：Cat Cafe Runtime（本期 API+UI 直接落地）

| Key | 默认值 | 可调范围 | 热更新 | 风险级别 | 备注 |
|---|---|---|---|---|---|
| `hindsight.enabled` | `true` | `true/false` | 支持 | 中 | 关闭后 recall/reflect/retain 统一走降级或拒绝策略 |
| `hindsight.baseUrl` | `http://localhost:8888` | URL（http/https） | 支持 | 高 | 变更后立即影响所有 Hindsight 调用 |
| `hindsight.sharedBank` | `cat-cafe-shared` | 非空字符串（建议 `cat-cafe-*`） | 支持 | 中 | 仍保持单 bank 策略 |
| `hindsight.recallDefaults.budget` | `mid` | `low \| mid \| high` | 支持 | 中 | 影响 recall 深度与延迟 |
| `hindsight.recallDefaults.tagsMatch` | `all_strict` | `any \| all \| any_strict \| all_strict` | 支持 | 中 | 建议默认 strict，避免 untagged 污染 |
| `hindsight.recallDefaults.limit` | `5` | `1..20` | 支持 | 低 | 超大 limit 会增加响应体和排序成本 |
| `hindsight.recallDefaults.tags` | `["project:cat-cafe"]` | `string[]`（1..10） | 支持 | 中 | 新增字段，作为默认检索过滤 |
| `hindsight.retainPolicy.narrativeFactRequired` | `true` | `true/false` | 支持 | 中 | 关闭会放宽入库质量门槛 |
| `hindsight.retainPolicy.minUsefulHorizonDays` | `180` | `30..3650` | 支持 | 低 | 低于 90 容易记忆爆炸 |
| `hindsight.retainPolicy.anchorRequired` | `false` | `true/false` | 支持 | 高 | 新增字段；开启后可提升证据可追溯性 |
| `hindsight.reflectProfile.dispositionMode` | `template_only` | `off \| template_only` | 支持 | 低 | 当前不做 per-cat disposition |
| `hindsight.client.requestTimeoutMs` | `8000` | `1000..30000` | 支持 | 中 | 新增字段，对应客户端调用超时 |
| `hindsight.degrade.on429` | `true` | `true/false` | 支持 | 低 | 与现有 shouldDegrade 策略对齐 |
| `hindsight.engine.reflect` | `codex_oauth` | `codex_oauth \| hindsight_native` | 支持 | 高 | v0.2 建议固定 `codex_oauth` |
| `hindsight.engine.retainExtraction` | `codex_oauth` | `codex_oauth \| hindsight_native` | 支持 | 高 | v0.2 建议固定 `codex_oauth` |
| `hindsight.engine.allowNativeFallback` | `false` | `true/false` | 支持 | 中 | 生产建议默认关闭，避免静默漂移 |

## 4.2 Layer B：Hindsight 独立服务（Store/Retrieval）

| Key | 默认值（建议） | 可调范围 | 热更新 | 风险级别 | 备注 |
|---|---|---|---|---|---|
| `hindsight.service.baseUrl` | `http://localhost:8888` | URL（http/https） | 支持 | 高 | 与 `hindsight.baseUrl` 保持一致 |
| `hindsight.service.bank` | `cat-cafe-shared` | 非空字符串 | 支持 | 中 | 单 bank 策略不变 |
| `hindsight.service.mode` | `storage_retrieval_only` | `storage_retrieval_only` | 支持 | 低 | 明确职责，不承载主推理链路 |
| `hindsight.service.requireHealthcheck` | `true` | `true/false` | 支持 | 中 | 启动/运行时健康探测开关 |
| `hindsight.service.writeTimeoutMs` | `8000` | `1000..30000` | 支持 | 中 | retain 写入超时阈值 |
| `hindsight.service.recallTimeoutMs` | `8000` | `1000..30000` | 支持 | 中 | recall 检索超时阈值 |

## 4.3 Layer C：Codex 推理引擎（统一模型，OAuth）

| Key | 默认值 | 可调范围 | 热更新 | 风险级别 | 备注 |
|---|---|---|---|---|---|
| `codex.execution.model` | `gpt-5.3-codex` | 模型名字符串 | 支持 | 中 | Reflect/Retain 提取统一使用此模型 |
| `codex.execution.authMode` | `oauth` | `oauth \| api_key \| auto` | 支持 | 高 | v0.2 建议固定 `oauth` |
| `codex.execution.passModelArg` | `true` | `true/false` | 支持 | 中 | 避免展示模型与执行模型漂移 |
| `codex.execution.requestTimeoutMs` | `30000` | `5000..120000` | 支持 | 中 | 推理超时保护 |
| `codex.execution.maxRetries` | `1` | `0..3` | 支持 | 低 | 超时/瞬断重试 |

## 4.4 Codex 执行模型一致性（并入本次评审，防显示值/执行值漂移）

| Key | 默认值 | 可调范围 | 热更新 | 风险级别 | 备注 |
|---|---|---|---|---|---|
| `cats.codex.model` | `gpt-5.3-codex` | 模型名字符串 | 支持 | 中 | 当前已展示在 `/api/config` |
| `codex.execution.passModelArg` | `true` | `true/false` | 支持 | 中 | 开启后 `codex exec` 显式传 `--model` |
| `codex.execution.model` | 跟随 `cats.codex.model` | 模型名字符串 | 支持 | 中 | 明确“执行时模型”单独字段 |
| `codex.execution.authMode` | `oauth` | `oauth \| api_key \| auto` | 支持 | 中 | 与 `CODEX_AUTH_MODE` 对齐 |

## 5. UI 展示草案（系统配置页）

目标：在“系统配置”新增 `长期记忆配置` 面板，支持只读 + 可编辑（按风险分层）。

- 区块 A：连接与 Bank
  - `enabled/baseUrl/sharedBank`
- 区块 B：Recall
  - `budget/tagsMatch/limit/tags`
- 区块 C：Retain
  - `narrativeFactRequired/minUsefulHorizonDays/anchorRequired`
- 区块 D：Reflect
  - `dispositionMode`
- 区块 E：引擎路由（Codex）
  - `reflect/retainExtraction` 当前路由目标
  - `codex model/authMode/passModelArg`
  - fallback 开关（默认关）
- 区块 F：Hindsight 独立服务（Store/Retrieval）
  - `baseUrl/bank/mode/healthcheck/timeout`

每个字段展示：
- 当前值
- 默认值
- 可调范围
- 生效方式（实时/重启）
- 风险标签（低/中/高）

## 6. API 交互草案

- 读配置：
  - `GET /api/config`（沿用）
  - 可选增强：`GET /api/config/schema?category=hindsight`（返回字段范围与类型）
- 改配置：
  - `PATCH /api/config`（沿用 `{ key, value }`）
  - 本期新增 key allowlist：`hindsight.*`、`codex.execution.*`
- 审计：
  - 每次成功 PATCH 记录 `old/new/operator/timestamp`

新增建议：
- `GET /api/config/runtime-status?category=hindsight`
  - 返回当前引擎路由是否生效（例如 reflect 是否走 codex_oauth）

## 7. 实施优先级（API + UI 一起做）

- P0（首批必须）
  - `hindsight.recallDefaults.*`
  - `hindsight.retainPolicy.*`
  - `hindsight.reflectProfile.dispositionMode`
  - `hindsight.engine.reflect=codex_oauth`
  - `hindsight.engine.retainExtraction=codex_oauth`
  - `hindsight.engine.allowNativeFallback=false`
  - `codex.execution.model/authMode/passModelArg`
  - UI 可见 + 可改 + 范围校验
- P1（首批建议）
  - `hindsight.client.requestTimeoutMs`
  - `codex.execution.requestTimeoutMs/maxRetries`
  - `hindsight.service.writeTimeoutMs/recallTimeoutMs`
- P2（二期）
  - 如后续恢复多模型策略，再引入 `hindsight_native` profile 配置

## 8. 风险与护栏

- 误配置导致 recall 命中下降：
  - 护栏：`tagsMatch` 默认 strict，UI 上强提示。
- 误配置导致延迟暴涨：
  - 护栏：`limit`、`timeoutMs` 限制范围。
- 路由配置和实际执行不一致：
  - 护栏：增加 runtime-status 检查端点，显示“配置值 vs 实际值”。
- fallback 被误开导致模型漂移：
  - 护栏：`allowNativeFallback=false` 作为默认并加高亮警示。

## 9. 待评审问题（请铲屎官 + 三猫拍板）

1. `hindsight.recallDefaults.tags` 是否作为首批可配项？
2. `hindsight.retainPolicy.anchorRequired` 首批默认是否直接设为 `true`？
3. `hindsight.engine.allowNativeFallback` 是否保持长期关闭（只在紧急时人工开启）？
4. `codex.execution.model` 是否允许与 `cats.codex.model` 脱钩？
5. UI 是否先仅放在系统配置页，还是同时提供 `/memory config` 命令入口？

## 10. 协作交接（WHY 完整版）

- What:
  - 输出了长期记忆配置评审稿 v0.2（字段名/默认值/可调范围/生效策略）。
- Why:
  - 当前参数分散在代码和文档，且存在多模型漂移风险；我们先统一到 Codex 路由，降低认知和运维复杂度。
- Tradeoff:
  - 暂时放弃多模型成本优化空间，换取链路一致性和可观测性。
- Open Questions:
  - 见第 9 节 5 个拍板问题。
- Next Action:
  - 拍板第 9 节后，直接进入“API + UI 一起实现”的 P0/P1。
