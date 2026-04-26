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

## 5. Open Questions 状态表（等砚砚 + 铲屎官拍板）

| # | 我的立场 | 等谁拍板 | 我可能错在哪 (pre-register retraction) |
|---|---------|---------|--------------------------------------|
| OQ-1 | per-cat-per-user | 铲屎官 + 砚砚 | thread-level isolation 是更安全的默认，砚砚可能 push per-cat-per-thread + 配 cross-thread API |
| OQ-2 | 混合（自动首发 + Hub 管理） | 铲屎官 | 铲屎官可能要求"全部我手动颁"以保留 100% 控制（friction 我接受） |
| OQ-3 | Redis 6398/6399 + hash + 一次性 plaintext | 砚砚 + 铲屎官 | mcp_config.json plaintext 暴露面比想象大，砚砚可能 push 早期接 OS keychain |
| OQ-4 | 90d + rotation + 实时 revocation | 砚砚 + 铲屎官 | 90d 太长，砚砚可能 push 30d；或永久 + revoke-only（去掉 rotation friction） |
| OQ-5 | 全开 + server deny list | 铲屎官 + 砚砚 | deny list 武断，应改 per-key 显式 grant（默认空 + 颁发时勾选）|
| OQ-6 | 复用 D2b-2 HubButton + 现场 "by agent-key" tag | 烁烁 + 铲屎官 | 后置到砚砚拍完技术 OQ 后单独拉烁烁 |

## 6. 收敛流程

```
本 strawman → @ 砚砚出独立 strawman → 两份 strawman 比对（in this README）
  → 铲屎官拍板分歧 → 落 KD-3+（spec Key Decisions）→ Phase A close → writing-plans → Phase B
```

OQ-6（视觉/UX）单独拉 @烁烁，不阻塞 OQ-1~5 收敛。

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
