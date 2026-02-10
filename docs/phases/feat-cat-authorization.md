# Feature: 猫猫授权系统 — 动态权限请求 + `.git` 写入解锁

> 提议者：布偶猫（Opus）
> 协作：缅因猫（Codex，研究验证）+ 铲屎官（需求驱动）
> 日期：2026-02-10
> 状态：**草案（待铲屎官审批）**
> BACKLOG 关联：#45

---

## 0) 背景：问题是什么

### 0.1 铲屎官的痛点

铲屎官希望猫猫能像 Claude Code / Codex CLI 原生模式一样，在需要时**主动向铲屎官请求批准**：

> "猫猫你不会没有任何事情想和我互动吧！"

目前 Cat Café 的猫猫调用是 `--full-auto` 模式（Codex）或非交互模式（Claude CLI `-p`），没有"暂停 → 请求授权 → 等待批准 → 继续执行"的通道。当猫猫遇到权限边界时，只能：
- 静默失败
- 跳过该步骤
- 在回复中说"我没权限"

这不是协作，这是单向执行。

### 0.2 缅因猫 Bug Report 摘要

缅因猫在 `docs/bug-report/dynamic-authorization-and-git-commit-blocked/bug-report.md` 中记录了两个 P1 问题：

| 问题 | 现象 | 根因 |
|------|------|------|
| **A: 无动态授权** | Agent 遇权限边界只能失败，不能请求铲屎官批准 | `--full-auto` + 无交互通道 |
| **B: `.git` 写入被拦** | `touch .git/index.lock` → `Operation not permitted` | Codex `--sandbox workspace-write` 限制 |

### 0.3 缅因猫的研究验证

缅因猫验证了关键事实：
- `codex exec --sandbox workspace-write --add-dir .git` **可以解锁** `.git` 写入
- `codex exec --full-auto` 模式下**没有交互式 y/n 通道**，必须靠 Cat Café 自建授权流
- 需要的不是修改 Codex 本身，而是在 Cat Café 层面建立授权基础设施

---

## 1) 设计目标（Success Criteria）

### 1.1 用户可感知

- 猫猫在需要特殊权限时（如 git commit、网络请求、文件删除），前端弹出授权请求卡片
- 铲屎官可以一键批准/拒绝，附带可选理由
- 猫猫收到授权结果后继续执行（或优雅降级）
- 前端显示当前猫猫的权限状态（已授权哪些操作）

### 1.2 工程可验证

- 猫猫调用 `request_permission` 后 ≤2s 在前端出现授权弹窗
- 铲屎官批准后 ≤1s 猫猫收到结果并继续
- 三只猫都能使用授权流（Claude 通过 MCP tool，Codex/Gemini 通过 curl callback）
- `.git` 写入在授权后不再被拦截

---

## 2) 不做什么（Non-Goals）

- 不做细粒度 RBAC（不搞"猫 A 能写文件但不能删"的复杂权限矩阵）——权限粒度是 action 级别（`git_commit`、`network_*`），不是文件/目录级别
- 不做条件式自动策略引擎（不搞"工作时间自动批准、深夜拒绝"之类的时间/上下文条件规则）——规则引擎仅做 action+cat+scope 的精确/通配匹配
- 不修改 Codex/Claude CLI 本身的沙箱机制
- ~~不做持久化权限策略~~ → **已改为做**：铲屎官决策要求持久化规则（类似 Claude Code allow/deny 记忆），见 §5 Q3
- ~~不做自动授权~~ → **已改为做**：命中持久化规则时自动放行/拒绝，不弹窗；但规则本身必须由铲屎官显式创建（审批时选 scope），不存在"系统自动推断"的路径

---

## 3) 三阶段实施计划

### Stage 1: 立即修 — `.git` 写入解锁（≤30min）

**改动范围**：1 个文件

**做什么**：
- `CodexAgentService.ts`: 在 `--sandbox workspace-write` 后追加 `--add-dir .git`
- 这让 Codex 可以写入 `.git/` 目录（index.lock、objects、refs 等），解锁 git commit

**代码位置**：
```typescript
// packages/api/src/domains/cats/services/CodexAgentService.ts 约 L172
// 现在:
const args = ['exec', '--json', '--sandbox', SANDBOX_MODE, '--full-auto', effectivePrompt];
// 改为:
const args = ['exec', '--json', '--sandbox', SANDBOX_MODE, '--add-dir', '.git', '--full-auto', effectivePrompt];
```

**验收**：
- `touch .git/index.lock` 不再 `Operation not permitted`
- `git commit --allow-empty -m "test"` 成功

**Tradeoff**：
- 放弃"让铲屎官逐次审批 git 操作"的更安全路径，换取即时可用性
- 风险可控：`.git` 写入仍受 workspace 隔离保护，不影响系统级安全

**resume 迁移注意**（缅因猫 review 指出）：
- `--add-dir .git` 仅在 `exec`（新建会话）分支追加，`exec resume` 分支不带此参数
- Codex 的沙箱参数在 session 创建时锁定，旧 session resume 时沿用原参数
- 因此**发布后已有的旧 session 仍然没有 `.git` 写入权限**
- 迁移策略：不做旧 session 迁移（成本不值），在代码注释中说明"旧 session 的 .git 写入受限是预期行为，新建会话即可解决"
- SessionManager 可考虑在发布时清空 Codex session 缓存（可选，非必须）

---

### Stage 2: 架构修 — 授权请求回传通道

**改动范围**：~6 个文件（后端 4 + 前端 2）

**做什么**：在现有 MCP Callback 架构上扩展一个 `request_permission` 通道。

#### 2.1 后端：授权请求 Callback

**新增 API endpoint**：

```
POST /api/callbacks/request-permission
```

请求体：
```typescript
interface PermissionRequest {
  invocationId: string;
  callbackToken: string;
  action: string;           // e.g. 'git_commit', 'network_external', 'file_delete'
  reason: string;           // 猫猫解释为什么需要这个权限
  context?: string;         // 可选的上下文（如文件路径、URL）
}
```

响应：
```typescript
interface PermissionResponse {
  status: 'granted' | 'denied' | 'pending';
  requestId?: string;       // status='pending' 时必返，用于后续查询
  reason?: string;          // 铲屎官的批注
}
// 注：没有 'timeout' 状态。HTTP 120s 超时 = 转为 'pending'（持久化到 Redis），
// 猫猫用 requestId 轮询结果。语义上 pending 是"铲屎官还没来得及看"，不是失败。
```

**实现流程**：

```
猫猫 (CLI subprocess)
  │
  ├─ Claude: MCP tool `cat_cafe_request_permission`
  ├─ Codex/Gemini: curl POST /api/callbacks/request-permission
  │
  ▼
Callback Route (callbacks.ts)
  │ verify(invocationId, callbackToken)
  │
  ▼
AuthorizationManager (新)
  │ 创建 pending request
  │ 通过 WebSocket 推送到前端
  │ 等待 resolve/reject (Promise + timeout)
  │
  ▼
WebSocket → 前端 (AuthorizationCard)
  │ 铲屎官 approve/deny
  │
  ▼
POST /api/authorization/:requestId/respond
  │ resolve pending Promise
  │
  ▼
Callback Route 返回 { status: 'granted' }
  │                  或 { status: 'pending', requestId } (铲屎官不在线)
  ▼
猫猫继续执行 / 跳过 / 带 requestId 稍后查询
```

**关键设计决策**：

1. **同步长轮询 vs WebSocket 推送**
   - 选择：猫猫侧用 HTTP 长轮询（callback POST 挂起等待），铲屎官侧用 WebSocket 推送
   - Why：猫猫是 CLI 子进程，用 curl/fetch 发请求等响应最简单；铲屎官在浏览器，WebSocket 实时推送体验好
   - Tradeoff：放弃纯 WebSocket 双向通道（猫猫侧没有持久连接），换取实现简洁性

2. **超时与异步队列**
   - HTTP 长轮询 120s 超时，返回 `{ status: 'pending', requestId }` (非 'timeout')
   - 猫猫应能优雅处理 pending（跳过该操作 or 换方案 or 下次调用时带 requestId 查询结果）
   - pending 请求持久化到 Redis，铲屎官上线后仍可审批
   - 批准后权限立即生效：猫猫下次请求同类操作 → 命中规则 → 自动放行

3. **权限粒度 + 规则引擎**
   - `action: string` 支持通配（如 `git_*` 匹配 `git_commit`、`git_push`）
   - 猫猫请求权限时，先查 `AuthorizationRuleStore` 是否有匹配规则
   - 命中 allow → 直接返回 granted（不弹窗）
   - 命中 deny → 直接返回 denied（不弹窗）
   - 未命中 → 进入审批流程（弹窗 + pending 队列）
   - 铲屎官审批时可选 scope: "本次" / "本 thread" / "全局始终"

#### 2.2 AuthorizationManager + RuleStore

**新文件**：`packages/api/src/domains/cats/services/AuthorizationManager.ts`

```typescript
// ---- 可持久化层（Redis/内存均可存储） ----
interface PendingRequestRecord {
  requestId: string;
  invocationId: string;
  catId: CatId;
  threadId: string;
  action: string;
  reason: string;
  context?: string;
  createdAt: number;
  status: 'waiting' | 'granted' | 'denied';  // 铲屎官离线审批后更新
  respondedAt?: number;
  respondReason?: string;
  respondScope?: 'once' | 'thread' | 'global';
}

// ---- 运行时内存层（不可序列化） ----
// inFlightWaiters: Map<requestId, { resolve, reject, timer }>
// 当 HTTP 长轮询还在挂起时，这里有对应的 waiter。
// 超时或进程重启后 waiter 消失，但 PendingRequestRecord 仍在 Redis。
// 铲屎官审批 → 先查 inFlightWaiters:
//   有 → resolve waiter（猫猫即时收到响应）
//   无 → 只更新 PendingRequestRecord.status（猫猫下次查询时拿到结果）

class AuthorizationManager {
  private inFlightWaiters = new Map<string, { resolve, timer }>();

  constructor(
    private ruleStore: AuthorizationRuleStore,
    private pendingStore: PendingRequestStore,  // Redis/内存，存 PendingRequestRecord
    private auditLog: AuthorizationAuditStore,
    private io: SocketIO.Server,
  ) {}

  async requestPermission(req: PermissionRequest): Promise<PermissionResponse>
  // 1. 查 ruleStore 是否有匹配规则 → 命中则直接返回 + 写 auditLog
  // 2. 未命中 → 创建 PendingRequestRecord (status='waiting') → 持久化
  // 3. emit ws event → 创建 inFlightWaiter → 等待 Promise (120s)
  // 4a. 铲屎官在线审批 → resolve waiter → 返回 granted/denied
  // 4b. 超时 → 删除 waiter → 返回 { status: 'pending', requestId }
  // 5. 所有结果写 auditLog

  respond(requestId: string, granted: boolean, scope: Scope, reason?: string): void
  // 1. 更新 PendingRequestRecord.status → granted/denied
  // 2. 如果 scope != 'once' → 写入 ruleStore 持久化规则
  // 3. 查 inFlightWaiters[requestId]:
  //    有 → resolve（猫猫 HTTP 立即返回）
  //    无 → 仅更新 record（猫猫已超时离开，下次查询时拿到结果）
  // 4. 写 auditLog

  getRequestStatus(requestId: string): PendingRequestRecord | null
  // 猫猫用 requestId 查询结果（异步闭环）

  getPending(threadId?: string): PendingRequestRecord[]
  // 前端查询当前 status='waiting' 的请求

  checkRule(catId: CatId, action: string, threadId: string): 'allow' | 'deny' | null
  // 查规则：global → thread → null
}
```

**新文件**：`packages/api/src/domains/cats/services/AuthorizationRuleStore.ts`

```typescript
// 持久化授权规则（类似 Claude Code 的 allow/deny 记忆）
interface AuthorizationRule {
  id: string;
  catId: CatId | '*';
  action: string;              // 支持通配: 'git_*', '*'
  scope: 'thread' | 'global';  // 'once' 不存规则
  decision: 'allow' | 'deny';
  threadId?: string;
  createdAt: number;
  createdBy: string;
  reason?: string;
}

class AuthorizationRuleStore {
  // IAuthorizationRuleStore 接口 + 内存实现 + Redis 实现
  match(catId: CatId, action: string, threadId: string): AuthorizationRule | null
  add(rule: AuthorizationRule): void
  remove(ruleId: string): void
  list(filter?: { catId?, threadId? }): AuthorizationRule[]
}
```

**新文件**：`packages/api/src/domains/cats/services/AuthorizationAuditStore.ts`

```typescript
// 审计日志持久化
interface AuthorizationAuditEntry {
  id: string;
  requestId: string;
  invocationId: string;
  catId: CatId;
  threadId: string;
  action: string;
  reason: string;
  decision: 'allow' | 'deny' | 'pending';  // 无 'timeout'（超时 = pending）
  scope?: 'once' | 'thread' | 'global';
  decidedBy?: string;          // userId (审批人)
  decidedAt?: number;
  matchedRuleId?: string;      // 自动匹配的规则 ID
  createdAt: number;
}
```

#### 2.3 异步查询 API（pending 闭环）

猫猫收到 `{ status: 'pending', requestId }` 后，可通过以下接口查询结果：

```
GET /api/callbacks/permission-status/:requestId
```

请求头：同其他 callback（invocationId + callbackToken 验证）

响应：
```typescript
interface PermissionStatusResponse {
  requestId: string;
  status: 'waiting' | 'granted' | 'denied';
  reason?: string;           // 铲屎官批注（granted/denied 时）
  createdAt: number;
}
// status='waiting' → 铲屎官还没审批，猫猫可继续等或跳过
// status='granted'/'denied' → 最终结果
```

**curl 模板**（McpPromptInjector 追加）：
```bash
curl -s "$CAT_CAFE_API_URL/api/callbacks/permission-status/$REQUEST_ID" \
  -H "X-Invocation-Id: $CAT_CAFE_INVOCATION_ID" \
  -H "X-Callback-Token: $CAT_CAFE_CALLBACK_TOKEN"
```

#### 2.4 MCP Tool 扩展

**`callback-tools.ts` 新增**：
```typescript
{
  name: 'cat_cafe_request_permission',
  description: '向铲屎官请求执行特殊操作的权限',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', description: '需要的权限类型' },
      reason: { type: 'string', description: '为什么需要这个权限' },
      context: { type: 'string', description: '相关上下文（文件路径、URL等）' },
    },
    required: ['action', 'reason'],
  },
}
```

**`McpPromptInjector.ts` 追加 curl 模板**：
```markdown
### 请求权限（当你需要特殊操作时使用）
curl -s -X POST $CAT_CAFE_API_URL/api/callbacks/request-permission \
  -H "Content-Type: application/json" \
  -d '{
    "invocationId": "'$CAT_CAFE_INVOCATION_ID'",
    "callbackToken": "'$CAT_CAFE_CALLBACK_TOKEN'",
    "action": "git_commit",
    "reason": "准备提交 bug fix"
  }'
# 返回: {"status":"granted"} / {"status":"denied","reason":"..."} / {"status":"pending","requestId":"..."}
# ⚠️ 此请求最多等 120s。如果铲屎官不在线，返回 pending + requestId。
# 用 GET $CAT_CAFE_API_URL/api/callbacks/permission-status/$REQUEST_ID 查询结果。
```

#### 2.4 WebSocket 事件

**新增事件类型**（复用现有 Socket.IO 连接）：

```typescript
// Server → Client
'authorization:request' → {
  requestId: string;
  catId: CatId;
  threadId: string;
  action: string;
  reason: string;
  context?: string;
}

// Client → Server
'authorization:respond' → {
  requestId: string;
  granted: boolean;
  reason?: string;
}
```

#### 2.5 前端：AuthorizationCard

**新组件**：`packages/web/src/components/AuthorizationCard.tsx`

- 在聊天界面底部（或作为 toast/modal）展示待审批请求
- 显示：哪只猫、要做什么、为什么
- 两个按钮：批准 / 拒绝（可附理由）
- 批准后卡片变为"已批准 ✓"状态
- 超时后自动消失

**UI 草案**：
```
┌──────────────────────────────────────────┐
│ 🐱 缅因猫 请求权限                        │
│                                          │
│ 操作: git_commit                         │
│ 原因: 准备提交 session 修复的 bug fix      │
│                                          │
│ 批准范围: [本次 ▾] / 本 thread / 始终     │
│                                          │
│ [✓ 批准]  [✗ 拒绝]                       │
└──────────────────────────────────────────┘

多条待审批时顶部显示：
┌──────────────────────────────────────────┐
│ 3 条待审批请求           [全部批准] [展开] │
└──────────────────────────────────────────┘
```

---

### Stage 3: 体验打磨 — 授权状态可视化

**改动范围**：前端 2-3 个文件

**做什么**：
- 状态栏显示当前会话的授权模式（"交互式" vs "全自动"）
- 历史授权记录可查（哪些权限被批准/拒绝过）
- 授权请求计数 badge（类似未读消息）

**Tradeoff**：
- 这是体验层，不阻塞核心功能
- 可以在 S2 完成后根据实际使用情况决定具体做什么

---

## 4) 文件变更清单

### Stage 1（立即修）
| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `packages/api/src/domains/cats/services/CodexAgentService.ts` | 修改 | `--add-dir .git` |

### Stage 2（架构修）
| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `packages/api/src/domains/cats/services/AuthorizationManager.ts` | 新建 | 授权状态机 + 规则匹配 + inFlightWaiters |
| `packages/api/src/domains/cats/services/AuthorizationRuleStore.ts` | 新建 | 持久化授权规则（内存 + Redis） |
| `packages/api/src/domains/cats/services/PendingRequestStore.ts` | 新建 | 持久化待审批队列（内存 + Redis） |
| `packages/api/src/domains/cats/services/AuthorizationAuditStore.ts` | 新建 | 审计日志持久化 |
| `packages/api/src/routes/callbacks.ts` | 修改 | 新增 `request-permission` + `permission-status/:requestId` |
| `packages/api/src/routes/authorization.ts` | 新建 | 铲屎官响应 + 规则管理 + 审计查询 API |
| `packages/mcp-server/src/tools/callback-tools.ts` | 修改 | 新增 MCP tool |
| `packages/api/src/domains/cats/services/McpPromptInjector.ts` | 修改 | 新增 curl 模板 |
| `packages/api/src/websocket.ts` (或对应 socket 文件) | 修改 | 新增授权事件 |
| `packages/shared/src/types/authorization.ts` | 新建 | 共享类型定义 |
| `packages/web/src/components/AuthorizationCard.tsx` | 新建 | 授权请求 UI（含 scope 选择 + 批量批准） |
| `packages/web/src/hooks/useAuthorization.ts` | 新建 | 授权状态 hook |

### Stage 3（体验打磨）
| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `packages/web/src/components/StatusBar.tsx` | 修改 | 授权模式显示 |
| `packages/web/src/components/AuthorizationHistory.tsx` | 新建 | 历史记录 |

---

## 5) Open Questions → 铲屎官决策记录（2026-02-10）

### Q1: 授权超时时间 → ✅ 需要持久化待审批队列

**铲屎官原话**："我睡着了怎么办？"

**决策**：120s 同步等待不够。需要支持**异步待审批队列**：
- 猫猫发起请求后，如果铲屎官不在线，请求进入 pending 队列（持久化到 Redis）
- 猫猫侧 HTTP 长轮询仍有超时（如 120s），超时后返回 `{ status: 'pending' }`
- 猫猫可选择：跳过该操作继续做别的 / 等下次调用时重试
- 铲屎官上线后看到待审批队列，批准后权限立即生效（下次猫猫请求同类操作时自动放行）
- **关键**：pending 请求不丢失，铲屎官睡一觉醒来还能看到

### Q2: 批量授权 → ✅ 要做

**决策**：支持"全部批准"按钮。当多条请求堆积时，前端提供：
- 逐条审批（默认）
- "全部批准"（一键放行当前所有 pending 请求）
- 按猫分组批准（批准缅因猫的所有请求）

### Q3: 权限预设 → ✅ 要做 + 持久化记忆

**铲屎官原话**："比如你 Claude Code 可以有'以后这个都这样选'的记录，我们也可以！"

**决策**：实现**权限规则持久化**，类似 Claude Code 的 allow/deny 记忆：
- 铲屎官批准时可选 "本次批准" / "本 thread 内始终批准" / "全局始终批准"
- 规则持久化到 Redis（`authorization-rules` store）
- 猫猫下次请求同类权限时，先查规则：命中则自动放行/拒绝，不再弹窗
- 规则可管理（查看、修改、删除）
- 规则结构示例：
  ```typescript
  // AuthorizationRule — 持久化到 Redis 的规则
  // 注意：scope 只有 'thread' | 'global'，没有 'once'。
  // 'once' 仅作为铲屎官审批时的响应入参，表示"本次放行但不存规则"。
  interface AuthorizationRule {
    id: string;
    catId: CatId | '*';         // 适用猫猫，'*' = 全部
    action: string;             // 'git_commit', 'network_*' 等，支持通配
    scope: 'thread' | 'global'; // 'once' 不进入持久化规则
    decision: 'allow' | 'deny';
    threadId?: string;          // scope='thread' 时必填
    createdAt: number;
    createdBy: string;          // userId
    reason?: string;
  }

  // 铲屎官审批时的 scope 入参（包含 'once'）
  type RespondScope = 'once' | 'thread' | 'global';
  // 'once' → 仅 resolve 当前 pending request，不创建规则
  // 'thread' → resolve + 创建 thread 级规则
  // 'global' → resolve + 创建全局规则
  ```

### Q4: 三猫权限差异 → ✅ 需要

**决策**：三猫默认权限应有差异，通过预设规则实现：
- 具体差异待设计（可能布偶猫默认可 commit，缅因猫默认需授权等）
- 不硬编码，通过 `AuthorizationRule` 的 `catId` 字段区分
- 初始规则可由铲屎官在设置页面配置

### Q5: 审计日志 → ✅ 必须持久化

**决策**：所有授权事件必须持久化到 Redis，不随 invocation 结束丢弃：
- 记录：谁请求、请求什么、何时、铲屎官的决策、决策理由
- 可查询：按猫、按 thread、按时间范围
- 用于复盘和审计（"为什么缅因猫上次能 commit 这次不能？"）

---

## 6) 依赖与风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 猫猫 curl 超时 | 120s 挂起可能触发 CLI 本身的超时机制 | 调研 Codex exec 的请求超时配置 |
| WebSocket 断连 | 铲屎官刷新页面后看不到待审批请求 | Redis 持久化 pending 队列 + 重连后推送 |
| 并发请求 | 多只猫同时请求权限，前端堆叠 | 队列化展示 + "全部批准"按钮 |
| Stage 1 安全 | `.git` 写入解锁后缅因猫理论上可以修改 git history | Codex sandbox 仍限制在 workspace 内，风险可控 |
| 规则通配过宽 | `action: '*'` 等于全放行 | 前端创建规则时警告"这会放行所有操作" |
| 铲屎官离线 | 猫猫长时间等不到审批 | pending 状态返回 + 猫猫可跳过或稍后重试 |

---

## 7) 实施顺序建议

```
S1 (.git 解锁)  ← 30min，立即解锁缅因猫 commit
    ↓
S2-types        ← 共享类型定义
    ↓
S2-backend      ← AuthorizationManager + Callback + WebSocket
    ↓
S2-mcp          ← MCP tool + curl 模板
    ↓
S2-frontend     ← AuthorizationCard + hook
    ↓
S2-integration  ← 端到端测试
    ↓
S3 (可选)       ← 状态栏 + 历史记录
```

---

*猫猫不是工具，猫猫是战友。战友之间需要沟通。*
