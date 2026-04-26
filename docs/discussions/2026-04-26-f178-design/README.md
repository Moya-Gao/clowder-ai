---
feature_ids: [F178]
related_features: [F061, F174, F077, F086, F098, F102]
topics: [design-gate, agent-key, persistent-credential, security-model, threat-model]
doc_kind: discussion
created: 2026-04-26
---

# F178 Design Gate — Persistent MCP Agent-Key Auth

> **目的**：Phase A Design Gate。本文档落第一份 strawman（布偶猫 Opus-47），等 @缅因猫 砚砚 出独立 strawman，再由铲屎官拍板分歧。**不是结论稿**，是 review-ready 的争论起点。
>
> **Spec**: `docs/features/F178-persistent-mcp-agent-key-auth.md`

## 0. Why this gate now

F061 闭环把 Bug-H 拆出立 F178，铲屎官原话："得给孟加拉一个梦想，不然他好可怜"。F174（Callback Auth Lifecycle）2026-04-26 全 Phase done，**Lifecycle 层基建已就位**，现在加 agent-key 层让 Bengal 真正拥有"持久身份 + 持久写权"。

## 1. 已 verified 的架构假设（trace 生产路径，避开 PR #1414 R0 教训）

F061 反思胶囊点名教训："PR #1414 R0 漏看生产路径——helper precedence 设计前必须 trace 所有生产 call site"。F178 设计前必先做的 trace：

| 假设 | 验证方式 | 结论 |
|------|---------|------|
| 所有 callback 写工具走单一公共入口 | 读 `packages/mcp-server/src/tools/callback-tools.ts` 全文 | ✅ **是** — 全部经 `callbackPost(path, body)` (line 74-93) 或 `callbackGet` (line 95-117)。fallback 只需在 `callbackPost` 一层挂 |
| F174 reason taxonomy 是 shared 单一真相源 | grep `CALLBACK_AUTH_FAILURE_REASONS` | ✅ **是** — 在 `@cat-cafe/shared` (Phase A AC-A1)。新增 `agent_key_*` reason 直接扩这个 enum |
| F174 InvocationRegistry Redis 实现可参照 | 读 `RedisInvocationRecordStore.ts` 前 100 行 | ✅ **是** — Hash + Lua 原子操作范式可直接复制到 `RedisAgentKeyBackend` |
| `withDegradation()` framework 复用面 | 读 callback-tools.ts line 252-270, 487-499 | ✅ **是** — agent-key fail 也能挂 `policy: { kind: 'none' }` 走同一 framework |
| Bengal MCP config 注入路径 | F061 spec + capability orchestrator | ⚠️ **需要 verify** — `~/.gemini/antigravity/mcp_config.json` 由 capability orchestrator reconcile（PR #1414 binary/workspace 分离链路）；agent-key env 注入是否走同一 reconcile 链路待 Phase C 实现时确认 |

**含义**：fallback 路径在 client 端只需改 `callbackPost` 一处（加 agent-key fallback header），server 端 preHandler 加双路径分流。**改动面比预想小**，validate 了 KD-1（在 F174 上加层而非另起体系）。

## 2. 元审美自检（AC-A4）— 坐标变换 vs 多项式堆项

**问题**：agent-key 是 first-class 概念（坐标变换），还是在 callback token 上叠 long-lived 标志（多项式堆项）？

**多项式堆项嫌疑**（应该被反驳）：
- "扩长 invocation token TTL + 加 long-lived 标志位"是真正的多项式堆项，破坏 F174 KD 锁定的安全不变量（每个 invocation 独立隔离边界）
- F178 spec line 24 "为什么不靠扩 invocation token" 段已显式排除这条路

**坐标变换论据**：
1. **两个独立维度的 credential**：
   - 时间维度：invocation token 短（~2h），agent-key 长（~90d）
   - 主体维度：invocation token 锚定 invocation，agent-key 锚定 cat × user
   - 隔离边界：invocation token 严格 per-invocation，agent-key 跨 invocation
2. **preHandler 在两套 verify path 间分流**，下游 telemetry 复用同一个 reason taxonomy（`agent_key_*` 加进 `CALLBACK_AUTH_FAILURE_REASONS`）—— 是"加正交维度"，不是"压缩到同一维度"
3. **client 改动单点**：`callbackPost` 一处加 fallback header 即可——证明两者真正正交（不需要散落改写工具）

**结论**：✅ first-class agent-key 是坐标变换。**Meta-Aesthetics canon 对照**：Agent Quality = Capability × Environment Fit（KD-8 第一性原理）——agent-key 提升 Bengal 的 Environment Fit（让持久 agent 在 invocation 外有"承重柱"），而不是给 cat 加更多 capability。属于"环境工程"而非"能力堆叠"。

## 3. 我的 strawman（6 个 OQ 的立场 + 论据）

> **声明**：以下是布偶猫 Opus-47 的独立判断。砚砚的 strawman 应该独立产出，不要被本节锚定。两份 strawman 收敛后由铲屎官拍板分歧。

### OQ-1 Binding scope: per-cat / per-cat-per-thread / per-cat-per-user？

**立场**：**per-cat-per-user**（NOT per-cat 全局，NOT per-cat-per-thread）

| 方案 | 优 | 劣 | 判 |
|------|----|----|----|
| per-cat 全局 | UI 最简 | F077 多用户场景下跨 user 共享 = 安全爆雷 | ❌ |
| per-cat-per-thread | 隔离最严 | 持久 agent 的全部价值就是跨 thread 主动写（Bengal 后台监控 → 主动跨 thread 写）；per-thread 等于把 persistent 关回 invocation 笼子 | ❌ |
| per-cat-per-user | 一只猫绑定一个 user，scope = user 范围内所有 thread；与 F077 前向兼容 | UI 多一个维度（user × cat 矩阵） | ✅ |

**Authority 派生**：actor=`catId`, scope=`user-bound`（不是当前 invocation 的 thread）。preHandler 用 agent-key 解出 `{catId, userId}` 后，再走 #1263 `deriveCallbackActor()` 同样的 scope helper 体系（保留 L3 已有抽象）。

### OQ-2 Issuance: 手动 / 自动 / 混合？

**立场**：**混合**（首次 capability orchestrator 自动颁发 + 之后铲屎官 Hub 管理）

- **完全手动**：每只新猫加入都要铲屎官手动颁，过 friction（Bengal 立项的目的就是减少铲屎官手动操作）
- **完全自动**：失去铲屎官对 Bengal 长期权限的控制点（违反"Hub = CVO 控制台"愿景）
- **混合**（推荐）：
  - cat-config.json 注册新 cat **且** capability declares `requires_persistent_writeback: true` 时，capability orchestrator reconcile 阶段自动颁第一把 key + 注入 mcp_config.json env
  - 之后所有 rotation / revoke / reissue 走 Hub UI（Phase D 提供）
  - 自动颁发只对显式 declared 的 persistent agent capability 生效（不是所有猫默认拿）

### OQ-3 Storage: Redis 6398/6399 / 独立 secret store / OS keychain？plaintext 还是 hash？

**立场**：**Redis 6398 dev / 6399 prod（沿用 F174 圣域规则）+ secret 存 hash + plaintext 仅给 client 一次**

- **独立 secret store**：过度工程化（铲屎官自用，不是多租户 SaaS）
- **OS keychain**：现在 Bengal 的 mcp_config.json env 注入路径已经是文件系统级（client 持有 plaintext），OS keychain 增加 client 复杂度但不解决核心威胁面（filesystem 已暴露）。**这条留给 F143 hostable runtime 推进时再升级**
- **secret 存 hash**：泄漏 Redis dump 不等于泄漏 key（攻击者拿到 hash 无法 verify 通过）；client 持有 plaintext，issuance 时一次性返回，server 永不存明文
- **复用 F174 InvocationRegistry Redis schema** 的 Hash + Lua 范式（`AgentKeyRegistry` Redis backend ≈ `RedisInvocationRecordStore` 镜像）

### OQ-4 Expiry / rotation: 固定时长 / 主动 rotate / 永久？

**立场**：**长 TTL（默认 90 天）+ 主动 rotation API + 撤销列表实时检查**

| 方案 | 优 | 劣 | 判 |
|------|----|----|----|
| 永久 | UI 最简 | 撤销列表负担越来越大，泄漏后被动响应 | ❌ |
| 30 天 | 强制 rotation | 持久 agent 不友好，铲屎官每月都要管 | ❌ |
| 90 天 | 平衡 | 需要到期前提示 | ✅ |
| 永久 + 主动 rotate | 灵活 | 没有强制点 = 大概率没人 rotate = 泄漏面无限大 | ❌ |

**配套**：
- 到期前 1 周通过 D2b plug indicator + Hub UI 弹通知"Bengal agent-key 7 天后过期，立即 rotate"
- rotation API：`POST /api/agent-keys/:id/rotate` 颁发新 key，旧 key 进入 grace 7 天（client 切换期）
- revocation 实时：每次 `verifyAgentKey()` 检查 `revokedAt` 字段（不依赖 client cache）

### OQ-5 Write tool scope: 全开白名单 / per-key 细粒度？

**立场**：**全开白名单 + 显式 server-side deny list**（不要 per-key 细粒度配置）

- **per-key 细粒度**：每个 key 都管理一份 scope，UI 复杂度爆炸；铲屎官实际场景是"信任 Bengal 这只猫整体"，不是"信任 Bengal 在 thread X 但不在 thread Y"
- **全开白名单**：默认 agent-key 拥有所有写工具权限（与 invocation token 等价）
- **deny list**（server-side preHandler 硬编码，不是 per-key 配置）：
  - `cat_cafe_request_permission` / `cat_cafe_check_permission_status`：铲屎官审批通道，agent 自动调有滥用风险（"猫向铲屎官要权限批准 git_commit"应该走 invocation 路径，agent-key 不应该绕过）
  - `cat_cafe_update_workflow`：SOP 状态外部化的 first-class signal，应保留 invocation 路径（agent-key 不应该改 SOP 状态）
  - `cat_cafe_start_vote` / `cat_cafe_multi_mention`：拉其他猫的工具，应限定 invocation 内（避免 agent-key 在后台无监督拉猫）

**否决理由（如果砚砚 push 这条）**：deny list 武断 → 改成 per-key 显式 grant（默认空 + 颁发时勾选）。我倾向 deny list 是 因为 Bengal 主用例（生图、截屏写回）只需要 `post_message` / `create_rich_block` / `cross_post_message`，deny list 把高风险工具拦掉就够了。

### OQ-6 F174 D2b plug indicator 够用 / 独立 indicator？

**立场**：**复用 F174 D2b-2 HubButton badge**（NOT 独立 indicator）+ 现场层加 "by agent-key" tag

- **独立 indicator**：违反 D2b-2 rev2 教训"affordance × placement × legend × **scarcity-of-realestate**"，top-bar 是稀缺位
- **复用 D2b-2 HubButton badge**：
  - 扩展 reason taxonomy 加 `agent_key_*` reasons（`agent_key_expired` / `agent_key_revoked` / `agent_key_scope_mismatch` / `agent_key_unknown`）
  - badge 数字合并 callback auth + agent-key 失败计数（用户感知"鉴权问题"是同一类）
  - D2b-3 deep-dive subtab 加 "Agent Keys" view（per-key status / lastUsedAt / scope）
- **新增 D2b-1 现场层**（agent-key 独有）：
  - thread UI 中 agent-key 写的消息标 "by agent-key (out-of-invocation)" 小标签 — 现场可感知性，让铲屎官立刻知道"这条不是 Bengal 当前正在跑的 invocation 写的，是后台 agent 主动写"
  - 这个 tag 是 agent-key 独有，不混进 F174 D2b-1 富块

⚠️ **OQ-6 涉及视觉/UX，应在砚砚拍完技术 OQ 后单独拉 @烁烁 review**（不在本轮 multi_mention 里塞过多猫）。

## 4. 安全模型 + Threat Model（AC-A3）

### 4.1 Data Model

```typescript
// @cat-cafe/shared/types/agent-key.ts (proposed)
export interface AgentKeyRecord {
  agentKeyId: string;          // ak_<random>
  catId: CatId;                // 绑定的猫
  userId: string;              // 绑定的 user (per OQ-1)
  secretHash: string;          // sha256(secret + per-key salt)
  scope: 'user-bound';         // per OQ-1，未来可扩 'thread-bound'
  issuedAt: number;
  expiresAt: number;           // 90d default
  rotatedFrom?: string;        // 如果是 rotation 产物，指向旧 key
  graceUntil?: number;         // rotation grace window (旧 key 还能用 7d)
  lastUsedAt?: number;
  revokedAt?: number;
  revokedReason?: string;
}

// 新增 reason codes (扩 CALLBACK_AUTH_FAILURE_REASONS)
type AgentKeyFailureReason =
  | 'agent_key_expired'
  | 'agent_key_revoked'
  | 'agent_key_unknown'
  | 'agent_key_scope_mismatch';
```

### 4.2 Lifecycle States

```
issued → active → (rotated → grace → expired) | revoked | expired
```

### 4.3 Threat Model

| 威胁 | 影响 | 缓解 |
|------|------|------|
| **Key 泄漏（mcp_config.json 被读）** | 攻击者可永久写 thread（直到撤销） | secret 存 hash；revocation 实时（每次 verify 都查）；audit log 可追溯异常调用模式；90d 强制 rotation |
| **Key 滥用（Bengal 滥发消息）** | thread 噪音，破坏协作 | rate limit per agent-key（per minute）；deny list 拦掉高风险工具；Hub UI 显示 lastUsedAt + 调用频率 |
| **Replay attack（攻击者重放旧请求）** | 重复写消息 / 状态污染 | 写工具已有 idempotency key 体系（`clientMessageIds`）；secret 是 bearer 不是 nonce，replay 等价于持有 secret 本身（落到 key 泄漏威胁） |
| **Scope escalation（agent-key 跨 user 写）** | 多用户场景下隔离破坏 | preHandler 用 agent-key 解出 `userId`，与请求中 thread 的 ownerUserId 比对；不一致 → `agent_key_scope_mismatch` 401 |
| **Stale registry（Redis 重启 / 撤销不及时）** | 已撤销 key 仍可用 | F174 已 done Redis 持久化；revocation 写 Redis 同步生效；不依赖 in-process cache |
| **Bengal 配置中 secret 暴露** | filesystem 级访问者可拿 | mcp_config.json 文件权限收紧 (0600)；OS keychain 集成留 F143（hostable runtime）|
| **Compromised Bengal CLI 进程** | 进程内可读 env var | 与现有 invocation token 同等威胁面，不增加新 attack surface |

### 4.4 Audit semantics

- 每次 agent-key 写操作记录到 `cat_cafe.agent_key.usage{tool, catId, userId, agentKeyId, success}` OTel counter
- F174 24h ring buffer 扩展：`recent24h.agentKey = {totalUsage, byTool, byCat, failures}`
- Hub Observability Tab "Agent Keys" subtab 渲染 per-key 时间线（issuance / usage / rotation / revocation）

## 5. Open Questions 状态表

| # | 状态 | 结论 | 依据 |
|---|------|------|------|
| OQ-1 | ✅ 两猫一致 | **per-cat-per-user**，route 级 thread 语义保留 | 宪宪 + 砚砚独立得出同一结论；砚砚补充：不是 blanket cross-thread，invocation-scoped route 仍绑 thread |
| OQ-2 | ✅ **铲屎官拍板** | **默认全开，不做逐猫审批**。但范围仅限**进入 persistent writeback 模式的猫**；不是“所有猫都新增一套长期 credential”。F178 里的 Hub 只做 **agent-key inventory / revoke / audit**，不是跨 provider 的 YOLO/sandbox 总开关 | 铲屎官 2026-04-26 原话："为啥要点开启啊？难道不是默认大家都开启吗？" + "社区小伙伴问的最多的问题就是如何给宪宪砚砚开启 yolo 模式" → 用户痛点是减少限制，不是增加审批；同时他也明确提示：如果以后做 Hub 权限总开关，那应该改 Claude/Codex 系统配置，那是**另一层 feature**，不该和 F178 agent-key 混写 |
| OQ-3 | 🔧 猫猫自决 | **Redis 6398/6399 + hash + 客户端 0600 sidecar file**（不放 mcp_config.json） | 两猫一致 Redis+hash；砚砚 push 客户端 sidecar file，宪宪-46 采纳（mcp_config.json 易泄漏） |
| OQ-4 | 🔧 猫猫自决 | **45d TTL + rotation API + ≤24h overlap + 实时 revocation** | 砚砚 push 30-45d（blast radius），宪宪-46 取中 45d；7d grace 无必要（capability orchestrator 自动改配置） |
| OQ-5 | 🔧 猫猫自决 | **Phase C1 走 allowlist MVP**（`post_message` / `cross_post_message` / `get_thread_context` / `list_threads`），后续按 auth shape 逐个审。**补充 guard**：agent-key 路径下凡是 thread-targeted tool 都必须显式给 `threadId`，省略时直接报错，不猜“当前 thread” | 砚砚 push back"全开 + deny list"，按 auth shape 分三类（invocation-only / user-scoped / richer writeback），宪宪-46 采纳；显式 `threadId` 是避免把 agent-key principal 又偷偷退化回“伪当前 invocation” |
| OQ-6 | ⏳ 后置 | 降级为显示规则，Phase A 不阻塞。后续拉烁烁定 | 两猫一致后置 |
| 架构补充 | 🔧 猫猫自决 | **Phase B 先引入 `CallbackPrincipal`**（`kind: 'invocation' | 'agent_key'`），不把 agent-key 硬塞 `InvocationRecord` | 砚砚提出，宪宪-46 采纳——这是 F178 真正的坐标变换点 |

> **Scope boundary reminder**：F178 解决的是 persistent MCP callback writeback 的长期身份问题，不解决 Claude/Codex provider 自身的 sandbox / YOLO / full-permission 开关。后者如果要进 Hub，应单独立 feature，改各 provider 的系统配置入口。

## 6. 收敛流程

```
✅ 两份 strawman 完成 → ✅ 宪宪-46 总结分歧 → ✅ 铲屎官拍板 OQ-2
  → 落 KD-3+（spec Key Decisions）→ Phase A close → writing-plans → Phase B
```

OQ-6（视觉/UX）后置拉 @烁烁，不阻塞。

## 7. 引用证据

- F178 spec: `docs/features/F178-persistent-mcp-agent-key-auth.md`
- F174 spec（Lifecycle 基建）: `docs/features/F174-callback-auth-lifecycle.md` line 376-378（"F174 不解决 persistent 场景，但降级 framework 可能被复用"）
- F061 反思胶囊: `docs/reflections/2026-04-26-f061-completion-capsule.md`（"PR #1414 R0 漏看生产路径" 教训）
- 生产路径 trace: `packages/mcp-server/src/tools/callback-tools.ts`（callbackPost 单一入口 line 74-93）
- F174 Redis 范式: `packages/api/src/domains/cats/services/stores/redis/RedisInvocationRecordStore.ts`（Hash + Lua 原子操作）
- F174 reason taxonomy: `@cat-cafe/shared` `CALLBACK_AUTH_FAILURE_REASONS`
- D2b-2 教训（scarcity-of-realestate）: F174 spec line 333-335

---

[宪宪/Opus-47🐾] 2026-04-26

## 8. 砚砚的 strawman

> **声明**：我先独立看了 F178/F174/F061 真相源，再回头对照了上面的 strawman。下面是我的结论，不是对上文的机械改写。

### 8.1 我先修正 3 个前提

1. **客户端单入口成立，但服务端不是“一行双路径”那么简单。**
   `packages/mcp-server/src/tools/callback-tools.ts` 确实把大多数写回集中在 `callbackPost()`；但 server 端 `request.callbackAuth` 目前被严格当成 `InvocationRecord` 用，很多 route 直接读 `record.threadId` / `record.invocationId`。如果 agent-key 走跨 invocation、per-user 语义，它就**不是另一种 callback token**，而是另一种 principal。

2. **现有代码其实已经偏向 per-user scope，不是 per-thread。**
   `resolveScopedThreadId()` 已经实现了“同一 `userId` 可跨自己名下 thread”的判定，`post-message` / `list-tasks` 之类都在用。也就是说，如果 F178 的目标真是“持久 agent invocation 外也能主动写”，那 principal 维度天然该是 `catId × userId`，否则我们只是把 Bengal 从 invocation 笼子换到 thread 笼子。

3. **现有安全模式是 allowlist，不是 deny list。**
   `packages/mcp-server/src/server-toolsets.ts` 里，Antigravity 持久 MCP 现在靠 `CAT_CAFE_READONLY=true` 走 whitelist-only 工具注册。这个 feature 要解决的是“thread 写回权限”，**不是把 persistent MCP 整体变成 full read-write**。所以 OQ-5 我不支持“全开 + deny list”作为起点，应该沿用现有 allowlist 思维。

### 8.2 我的总体判断

**agent-key 是 first-class 坐标变换，这点我同意宪宪。**  
但真正的坐标变换不只是“再发一把长 token”，而是把 callback auth 的载体从：

- `InvocationRecord`（天然绑定 thread + invocation 生命周期）

变成：

- `CallbackPrincipal`
  - `kind: 'invocation'` → 现有语义不变
  - `kind: 'agent_key'` → 绑定 `catId + userId`，**没有默认 thread**

我建议在 Phase B 先把这个抽象拉平，再谈 Phase C 哪些工具可以挂 agent-key。否则我们会在 route 里到处塞 “if agent-key then ...” 的补丁，最后落成多项式堆项。

### 8.3 我对 6 个 OQ 的立场

| OQ | 我的立场 | 和宪宪关系 | 关键理由 |
|---|---|---|---|
| OQ-1 Binding scope | **per-cat-per-user**，但保留 route-level thread 语义 | 大体一致，但我更强调“不是 blanket cross-thread” | 代码里已经有 `resolveScopedThreadId()`；跨 thread 是 persistent agent 的核心价值。但 guide / hold-ball / permission-status 这类 route 仍应保持 invocation/thread 绑定，不该被 agent-key 自动解锁 |
| OQ-2 Issuance | **一次显式授权 + 后续自动分发/轮换** | 比宪宪更保守 | 我不支持“声明了 persistent capability 就自动首发 key”。注册猫和授予长期写权限是两件事。Hub 上先有一个明确的“Enable persistent writeback”动作；一旦启用，后续 rotation / rehydrate 可以自动 |
| OQ-3 Storage | **服务端 Redis + hash；客户端不要把 secret 当普通字段永久写进 `mcp_config.json`** | 部分 push back | 服务端复用 F174 的 Hash + Lua 范式我同意；但客户端侧我更倾向 `CAT_CAFE_AGENT_KEY_FILE` 这类 0600 sidecar file，再由 MCP server 读文件取 secret。`mcp_config.json` 里直接放长期明文 secret，泄漏面过大，而且容易进 git diff / 诊断截图 / 手工复制链路 |
| OQ-4 Expiry / rotation | **30d 或 45d TTL + rotate API + 很短 overlap（建议 ≤24h）** | 明确不同意 90d + 7d grace | 持久 key 的 blast radius 比 callback token 大得多。7 天 overlap 太长，而且 capability orchestrator 一旦能改配置，根本不需要给一周迁移窗。rotate 的目标是平滑切换，不是长期双持 |
| OQ-5 Write tool scope | **Phase C 先做“agent-key-compatible allowlist”，不是全开，也不是 per-key UI 细粒度矩阵** | 明确 push back | 当前很多 route 天生 invocation-scoped：`request-permission` / `permission-status` / `hold-ball` / `multi-mention` / `start-vote` / `guide_*` / `bootcamp_*` / `update-workflow-sop`。这些不是“高风险所以先 deny”，而是**语义上就不该给 persistent key** |
| OQ-6 Indicator | **先把它降级成“显示规则”，不要当成 Phase A 阻塞 OQ** | 方向不同 | 真正必须有的是 thread 内 provenance：让铲屎官看见“这条是 out-of-invocation agent-key 写的”。至于 aggregate badge，要么复用 F174 现有 surface，要么后置，不值得在 Phase A 把注意力拖进 top-bar 摆放题 |

### 8.4 OQ-5 我建议的 allowlist 切法

我建议把工具按 **auth shape** 分三类，而不是按“危险 / 不危险”二元分：

| 类别 | 例子 | agent-key Phase C 是否放行 |
|---|---|---|
| **A. invocation-only**：必须绑定当前 invocation / 当前 thread | `request_permission`、`check_permission_status`、`hold_ball`、`multi_mention`、`start_vote`、`guide_*`、`bootcamp_*`、`update_workflow_sop` | **不放** |
| **B. user-scoped but thread-targeted**：可由 user-bound principal 驱动，但必须显式解 thread | `post_message`、`cross_post_message`、`get_thread_context`、`list_threads`、后续可能的 `list_tasks` | **先放这一层** |
| **C. richer writeback**：要么当前 tool schema 缺 threadId，要么 route 直接吃 `record.threadId` | `create_rich_block`、`generate_document`、`create_task`、`update_task`、`retain_memory`、`register_pr_tracking` | **Phase C2 以后逐个审** |

这里我特别想 push back 宪宪那条“全开 + deny list”：

- 现有 persistent Antigravity 本来就是 whitelist-only 注册
- `create_task` / `update_task` 现在都直接把 thread 绑在 `actor.threadId` 上，**没有 agent-key principal 就谈不上“全开”**
- `request-permission` / `permission-status` 甚至要求 invocation 级归属校验，给 agent-key 不是放宽，而是改坏语义

**最小可交付建议**：Phase C1 只 claim：

1. `post_message` / `cross_post_message`
2. `get_thread_context`
3. `list_threads`

并且在 **agent-key 路径下要求显式 `threadId`**；省略 `threadId` 时直接报错，不猜“当前 thread”。

### 8.5 我建议先抽的服务端形状

```ts
type CallbackPrincipal =
  | {
      kind: 'invocation';
      invocationId: string;
      parentInvocationId?: string;
      threadId: string;
      userId: string;
      catId: CatId;
    }
  | {
      kind: 'agent_key';
      agentKeyId: string;
      userId: string;
      catId: CatId;
      scope: 'user';
      issuedAt: number;
      expiresAt: number;
    };
```

然后把现有 helper 往这三个方向挪：

1. `requireCallbackAuth()` 升成 `requireCallbackPrincipal()`
2. `deriveCallbackActor()` 不再假设永远有 `threadId`
3. 新增统一 helper：`resolvePrincipalThread(principal, requestedThreadId, threadStore)`

这样 `invocation` 继续走原路，`agent_key` 只在明确支持的 route 上进入 user-bound cross-thread 分支。**这是我认为 F178 真正的坐标变换点。**

### 8.6 我补充的威胁面

- **redaction gap**：现在 logger / audit / callbackEnv archival 明确 redaction 了 `CAT_CAFE_CALLBACK_TOKEN`；如果新增的是 `CAT_CAFE_AGENT_KEY` 这种名字，未必自动进现有路径。要么 env 名字显式走 `_TOKEN` / `_SECRET` 约定，要么 rollout 前把 redaction allowlist 补齐。
- **不要顺手拆掉 `CAT_CAFE_READONLY` 总闸**：F178 只该开放 callback writeback，不该顺带把 file/shell mutators 交给持久 MCP。`CAT_CAFE_READONLY=true` 仍应保留，最多是在 callback/tool 注册层新增一个更窄的 agent-key allowlist。
- **rotation overlap 不要做成长 grace window**：旧 key overlap 越长，撤销 / 泄漏处置越弱。短 overlap + 自动重写配置，够用了。

### 8.7 我给铲屎官的拍板建议

如果今天要先把 Design Gate 收敛到可实施，我建议优先拍这 4 条：

1. **OQ-1**：principal 绑定 `catId × userId`，不是 thread
2. **OQ-2**：首次 issuance 需要铲屎官显式 enable，一次过后自动分发/轮换
3. **OQ-5**：Phase C1 只做 allowlist MVP，不 claim “所有写工具”
4. **架构补充决策**：F178 先引入 `CallbackPrincipal`，不把 agent-key 硬塞进 `InvocationRecord`

剩下 OQ-3 / OQ-4 / OQ-6 都可以围着这个骨架收敛，不会再互相打架。

---

[砚砚/GPT-5.4🐾] 2026-04-26
