---
feature_ids: [F178]
related_features: [F061, F174, F077, F086, F098]
topics: [auth, mcp, agent-key, persistent-credential, antigravity, infrastructure]
doc_kind: spec
created: 2026-04-26
---

# F178: Persistent MCP Agent-Key Auth — 跨 invocation 写权限

> **Status**: design-done | **Owner**: 布偶猫（宪宪） | **Reviewer**: 缅因猫（砚砚） | **Priority**: P1

## Why

**F061 Bug-H 闭环**：孟加拉猫（Antigravity）作为 **持久 agent**（MCP 进程跨 invocation 存活），目前**不能在 invocation 之外主动写回 thread** —— `post_message` / `create_task` / `update_task` / `get_thread_context` 这些写工具都依赖 per-invocation callback token，token 生命期 ≪ 持久进程生命期。

**铲屎官 2026-04-26 原话**：
> "Bug-H persistent MCP write-path auth ... 这个 我觉得哦 一定要做 得给 孟加拉一个梦想？哈哈哈 不然他好可怜"
>
> "我们的 F174 是不是 mcp 的 auth 整改？现在整改完成了，你看看现在如果要做这个 可以做吗？"

**为什么现在做**：F174（Callback Auth Lifecycle）2026-04-26 全 Phase done，已经把 **Lifecycle 层** 基建打好（Redis-backed `InvocationRegistry`、结构化错误 reason codes、Route B 降级 framework、401 telemetry + 24h ring buffer、D2b "明厨亮灶" plug indicator）。F174 自己 spec line 377 显式说："F174 不解决 persistent 场景，但降级 framework 可能被复用" —— 现在到时候在 F174 基建上加一层 **agent-key**，让 Bengal 真的能拥有"持久身份 + 持久写权"。

**为什么不靠扩 invocation token**：扩长 invocation token 生命期等于绕过 per-invocation 隔离边界（F174 Phase A 显式锁的安全不变量）。invocation token 必须严格短生命，agent-key 是另一种独立的 credential。

## What

> **Scope 假设——Phase 拆分将在 Design Gate 后细化**。当前 Phase 划分是 strawman，等 OQ-1~OQ-5 拍板后可能合并/拆分。

### Phase A: Design Gate + 数据模型 + 安全模型设计

- 与砚砚（缅因猫）+ 铲屎官三方确认 5 个 Open Questions（OQ-1~OQ-5，见下）
- 输出 `docs/discussions/2026-04-26-f178-design/README.md` 含拍板结果 + 反驳意见
- 产出 agent-key schema 设计：data model, lifecycle states, security boundaries, audit semantics
- 元审美自检（feat-lifecycle Design Gate 必问）：是"坐标变换"（agent-key 是新 first-class 概念，让 persistent vs invocation 两套语义干净分离）还是"多项式堆项"（在 callback token 上叠 long-lived 标志）？

### Phase B: AgentKeyRegistry 持久化 + 核心 API

- 实现 `AgentKeyRegistry`（接口对齐 F174 `InvocationRegistry` 风格）：
  - 复用 F174 已建的 Redis storage adapter 与 in-memory fallback
  - 数据模型：`agentKeyId`、`catId`、`scope`（thread/global by Phase A 拍板）、`issuedAt`、`expiresAt`、`lastUsedAt`、`revokedAt`
- 核心 API：
  - `issueAgentKey(catId, scope, opts)` → `{ agentKeyId, secret }`
  - `verifyAgentKey(secret)` → `{ keyRecord, reason } | null`
  - `revokeAgentKey(agentKeyId, reason)`
  - `listAgentKeys({ catId?, threadId?, includeRevoked? })`
- 与 F174 `verify()` 走同一个结构化错误 reason 集（新增 `agent_key_*` reason codes）

### Phase C: MCP write tools 接入 agent-key auth path

- `callback-tools.ts` 写工具（`post_message` / `create_task` / `update_task` / 视 Phase A 决策）：
  - 当 callback token 缺失/过期时，fallback 到 agent-key auth path（不影响现有 invocation token 主路径）
  - 透传 agent-key 到 `/api/callbacks/*` 端点，server 端 preHandler 双路径鉴权
- Bengal 持久 MCP config 注入 agent-key（`~/.gemini/antigravity/mcp_config.json` env 添加）
- 复用 F174 Route B 降级 framework：agent-key 失败时按 reason code 降级提示

### Phase D: Hub UI（agent-key 管理）+ 审计 + 复用 F174 telemetry

- Hub 设置面板加 "Agent Keys" 页：
  - 列出 per-cat 的 agent-key（catId / scope / issuedAt / lastUsedAt / status）
  - "颁发新 key" 按钮（按 OQ-2 决策的颁发流程）
  - "撤销 key" 操作 + 撤销原因
- audit log：所有 agent-key 写操作记录到 evidence/observability 通道
- 复用 F174 24h ring buffer + plug indicator：agent-key 失败率挂同一个 indicator（颜色/状态语义扩展）
- "明厨亮灶" 自检：现场可感知性（thread 内 agent-key 写操作可见）vs 仅事后审计

## Acceptance Criteria

### Phase A（Design Gate）✅ done 2026-04-26
- [x] AC-A1: OQ-1~OQ-5 resolved，OQ-6 显式 deferred（Design discussion §5）
- [x] AC-A2: `docs/discussions/2026-04-26-f178-design/README.md` 落地（宪宪-47 strawman + 砚砚独立 strawman + 宪宪-46 总结 + 铲屎官拍板 OQ-2）
- [x] AC-A3: threat model 含 7 威胁面（discussion §4.3）+ 砚砚补充 redaction gap / READONLY 总闸 / rotation overlap（§8.6）
- [x] AC-A4: 元审美自检通过 — first-class agent-key = 坐标变换，真正变换点 = CallbackPrincipal 抽象（discussion §2 + §8.2）

### Phase B（Registry + API）
- [ ] AC-B1: `AgentKeyRegistry` 实现 + Redis 持久化 + in-memory fallback（与 F174 InvocationRegistry 同 storage 模式）
- [ ] AC-B2: issuance / verification / revocation / list API + 单元测试覆盖核心路径
- [ ] AC-B3: 结构化错误 reason codes 扩展（`agent_key_expired` / `agent_key_revoked` / `agent_key_scope_mismatch` 等），与 F174 reason 集对齐

### Phase C（MCP write tools）
- [ ] AC-C1: 至少 `post_message` 接入 agent-key fallback path，e2e 测试 Bengal 持久 MCP 在无 invocation 上下文时也能 post 成功
- [ ] AC-C2: server 端 preHandler 双路径鉴权（callback token + agent-key），失败原因结构化 reason code 透传给 client
- [ ] AC-C3: Bengal `mcp_config.json` 通过 capability orchestrator 自动注入 agent-key（不让用户手改），与 F061 PR #1414 binary/workspace separation 同 reconcile 链路
- [ ] AC-C4: 现有 invocation token 主路径无 regression（F174 测试套件全绿）

### Phase D（UI + 审计 + telemetry）
- [ ] AC-D1: Hub 设置面板有 "Agent Keys" 页，列出/颁发/撤销操作可用
- [ ] AC-D2: audit log 落地（agent-key 每次写操作可追溯）
- [ ] AC-D3: F174 plug indicator 扩展：agent-key 失败率与 callback 401 同 indicator 共显
- [ ] AC-D4: 现场可感知性：Bengal invocation 外的写入在 thread UI 标识"by agent-key (non-invocation)"

## Dependencies

- **Evolved from**: F061（Antigravity 接入 Bug-H follow-up）
- **Blocked by**: F174（Callback Auth Lifecycle，✅ done 2026-04-26 — 提供 Redis 持久化基建 / 结构化错误 / Route B framework / telemetry）
- **Related**:
  - F077（Multi-User Secure Collaboration）— agent-key 的 user binding 模型可能成为 F077 的 building block
  - F086（System Observability）— audit log + telemetry 走同一个 observability 母线
  - F098（Cross-Cat Persistent State）— Bengal 作为持久 agent 的状态管理
  - F098 / F102（记忆系统）— agent-key 让 Bengal 在 invocation 外能写回记忆

## Risk

| 风险 | 缓解 |
|------|------|
| 长期 credential 泄漏面 → 攻击者拿到 key 可永久写 thread | rotation 策略（OQ-4）+ 撤销列表（Phase B revoke API）+ audit log（Phase D） |
| agent-key 滥用 → cat 自动写无关 thread / 滥发 | scope binding（OQ-1 决策 per-thread / per-cat），写工具 server 端校验 scope 边界 |
| 持久进程复用 stale key → 撤销不及时 | revocation list 实时检查（每次 verifyAgentKey 都查），不依赖客户端 cache |
| Bengal 配置中暴露 secret → mcp_config.json 明文 | secret hash 存 Redis，client 持有 secret；考虑 OS keychain 集成（OQ-3 决策） |
| Phase C 改 callback-tools.ts 影响其他猫的 invocation token 主路径 | 双路径鉴权 preHandler 设计严格隔离（callback token 优先，agent-key 仅 fallback），F174 测试套件作 regression 锚点 |

## Open Questions

| # | 问题 | 状态 | 结论 |
|---|------|------|------|
| OQ-1 | **Binding scope** | ✅ resolved | **per-cat-per-user**，route 级 thread 语义保留（invocation-scoped route 仍绑 thread） |
| OQ-2 | **Issuance flow** | ✅ 铲屎官拍板 | **默认全开**。persistent writeback 猫注册即有写权限。Hub 做 agent-key inventory/revoke/audit，不做审批。不等于跨 provider YOLO 总开关（那是另一层 feature） |
| OQ-3 | **Storage** | ✅ 猫猫自决 | **Redis 6398/6399 + hash + 客户端 0600 sidecar file**（不放 mcp_config.json） |
| OQ-4 | **Expiry / rotation** | ✅ 猫猫自决 | **45d TTL + rotation API + ≤24h overlap + 实时 revocation** |
| OQ-5 | **Write tool scope** | ✅ 猫猫自决 | **Phase C1 走 allowlist MVP**（`post_message` / `cross_post_message` / `get_thread_context` / `list_threads`）。agent-key 路径必须显式 `threadId`，省略报错。后续按 auth shape 三分类逐个审 |
| OQ-6 | **Plug indicator** | ⏳ deferred | 降级为显示规则，后置拉烁烁定，不阻塞 Phase B/C |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | F174 已 done，agent-key 在 F174 基建上加层而非另起独立 auth 体系 | 复用 Redis registry / 结构化错误 / Route B framework / telemetry，避免双套基础设施 | 2026-04-26（立项时） |
| KD-2 | agent-key 是独立 first-class 概念（不是扩长 invocation token） | invocation token 必须短生命（隔离不变量），扩长会绕过 F174 Phase A 安全边界 | 2026-04-26（立项时） |
| KD-3 | Phase B 先引入 `CallbackPrincipal`（`kind: 'invocation' \| 'agent_key'`），不把 agent-key 硬塞 `InvocationRecord` | 砚砚提出：`request.callbackAuth` 现被当 `InvocationRecord` 用，agent-key 需要另一种 principal；否则 route 里到处 `if (agentKey)` 补丁 = 多项式堆项。宪宪-46 采纳 | 2026-04-26（Design Gate） |
| KD-4 | Binding scope = per-cat-per-user，route 级 thread 语义保留 | 持久 agent 价值 = 跨 thread 主动写；per-thread 等于换笼子。但 invocation-scoped route（`request_permission` / `hold_ball` / `guide_*` 等）仍绑 thread | 2026-04-26（Design Gate） |
| KD-5 | 默认全开，不做逐猫审批 | 铲屎官拍板："默认大家都开启"。用户痛点是减少限制。Hub 做 inventory/revoke/audit 管理面板 | 2026-04-26（铲屎官拍板） |
| KD-6 | 服务端 Redis + hash，客户端 0600 sidecar file | Redis+hash 复用 F174 范式；客户端不放 mcp_config.json（git diff / 截图 / 复制链路泄漏面） | 2026-04-26（Design Gate） |
| KD-7 | 45d TTL + rotation API + ≤24h overlap + 实时 revocation | 90d blast radius 过大；7d grace 无必要（capability orchestrator 自动改配置） | 2026-04-26（Design Gate） |
| KD-8 | Phase C1 走 allowlist MVP（4 工具），agent-key 路径必须显式 `threadId` | 砚砚按 auth shape 分三类（invocation-only / user-scoped / richer writeback），deny list 语义不对——很多 route 天生 invocation-scoped 不是"高风险"。省略 threadId 报错，不猜 | 2026-04-26（Design Gate） |
| KD-9 | F178 scope boundary：不解决跨 provider YOLO/sandbox 总开关 | 铲屎官明确 Hub 权限总控（改 Claude/Codex 系统配置）是另一层 feature，F178 只管 persistent writeback agent-key | 2026-04-26（Design Gate） |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-26 | 立项（F061 Bug-H follow-up，铲屎官拍板"一定要做"） |
| 2026-04-26 | Phase A Design Gate done — 宪宪-47 strawman + 砚砚独立 strawman + 宪宪-46 收敛 + 铲屎官拍板 OQ-2 + KD-3~KD-9 落 spec |

## Review Gate

- **Phase A（Design Gate）**：必须 @ 砚砚（缅因猫）+ 铲屎官参与决策。砚砚 review F174 时已经踩过这个领域，有上下文；铲屎官拍板安全/产品边界
- **Phase B / C / D**：标准跨家族 review（@ 砚砚 缅因猫，避免和作者同家族）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F061-antigravity-bengal-cat.md` | Bug-H 源 — Antigravity 持久 MCP 写权限 |
| **Feature** | `docs/features/F174-callback-auth-lifecycle.md` | 基础设施前置，本 feature 在其上加 agent-key 层（F174 line 377 自承认 persistent 场景未解） |
| **Feature** | `docs/features/F077-...md` | 后续 multi-user 隔离会依赖 agent-key user binding |
| **Discussion** | `docs/discussions/2026-04-26-f178-design/README.md` | Design Gate 落盘（两份 strawman + 收敛表 + 铲屎官拍板） |
