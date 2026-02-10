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

- 不做细粒度 RBAC（不搞"猫 A 能写文件但不能删"的复杂权限矩阵）
- 不做持久化权限策略（权限随 invocation 生命周期结束而消失）
- 不做自动授权策略引擎（不搞"如果是 git commit 就自动批准"的规则）
- 不修改 Codex/Claude CLI 本身的沙箱机制

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
  status: 'granted' | 'denied' | 'timeout';
  reason?: string;          // 铲屎官的批注
}
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
  │
  ▼
猫猫继续执行
```

**关键设计决策**：

1. **同步长轮询 vs WebSocket 推送**
   - 选择：猫猫侧用 HTTP 长轮询（callback POST 挂起等待），铲屎官侧用 WebSocket 推送
   - Why：猫猫是 CLI 子进程，用 curl/fetch 发请求等响应最简单；铲屎官在浏览器，WebSocket 实时推送体验好
   - Tradeoff：放弃纯 WebSocket 双向通道（猫猫侧没有持久连接），换取实现简洁性

2. **超时策略**
   - 默认 120s 超时，返回 `{ status: 'timeout' }`
   - 猫猫应能优雅处理 timeout（跳过该操作 or 换方案）

3. **权限粒度**
   - 初版用 `action: string` 自由文本，不做枚举限制
   - 好处：猫猫可以请求任意类型的权限，不用预定义所有可能的操作
   - 风险：无法做自动化校验，但初版不需要

#### 2.2 AuthorizationManager

**新文件**：`packages/api/src/domains/cats/services/AuthorizationManager.ts`

```typescript
interface PendingRequest {
  requestId: string;
  invocationId: string;
  catId: CatId;
  threadId: string;
  action: string;
  reason: string;
  context?: string;
  createdAt: number;
  resolve: (response: PermissionResponse) => void;
}

class AuthorizationManager {
  private pending = new Map<string, PendingRequest>();

  async requestPermission(req: PermissionRequest): Promise<PermissionResponse>
  // 创建 pending → emit ws event → 返回 Promise (timeout 120s)

  respond(requestId: string, granted: boolean, reason?: string): void
  // resolve pending Promise → 猫猫侧 HTTP 响应返回

  getPending(threadId?: string): PendingRequest[]
  // 前端查询当前待审批请求
}
```

#### 2.3 MCP Tool 扩展

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
# 返回: {"status":"granted"} 或 {"status":"denied","reason":"..."}
# ⚠️ 此请求会等待铲屎官批准，可能需要几秒到几分钟
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
┌──────────────────────────────────────┐
│ 🐱 缅因猫 请求权限                    │
│                                      │
│ 操作: git_commit                     │
│ 原因: 准备提交 session 修复的 bug fix  │
│                                      │
│ [✓ 批准]  [✗ 拒绝]                   │
└──────────────────────────────────────┘
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
| `packages/api/src/domains/cats/services/AuthorizationManager.ts` | 新建 | 授权状态机 + Promise 管理 |
| `packages/api/src/routes/callbacks.ts` | 修改 | 新增 `request-permission` endpoint |
| `packages/api/src/routes/authorization.ts` | 新建 | 铲屎官响应 endpoint + 查询 API |
| `packages/mcp-server/src/tools/callback-tools.ts` | 修改 | 新增 MCP tool |
| `packages/api/src/domains/cats/services/McpPromptInjector.ts` | 修改 | 新增 curl 模板 |
| `packages/api/src/websocket.ts` (或对应 socket 文件) | 修改 | 新增授权事件 |
| `packages/shared/src/types/authorization.ts` | 新建 | 共享类型定义 |
| `packages/web/src/components/AuthorizationCard.tsx` | 新建 | 授权请求 UI |
| `packages/web/src/hooks/useAuthorization.ts` | 新建 | 授权状态 hook |

### Stage 3（体验打磨）
| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `packages/web/src/components/StatusBar.tsx` | 修改 | 授权模式显示 |
| `packages/web/src/components/AuthorizationHistory.tsx` | 新建 | 历史记录 |

---

## 5) Open Questions（待铲屎官定夺）

1. **授权超时时间**：默认 120s 够吗？铲屎官可能离开电脑。要不要支持"稍后处理"队列？

2. **批量授权**：如果猫猫在一次调用中多次请求权限（如先 commit 再 push），要不要支持"全部批准"？

3. **权限预设**：要不要在 thread 创建时就指定"本次对话猫猫可以自由 commit"？（类似 Claude Code 的 `--dangerously-skip-permissions`）

4. **三猫差异**：三只猫的默认权限是否相同？布偶猫（主开发）是否天然比缅因猫（reviewer）有更多权限？

5. **审计日志**：授权记录是否需要持久化到 Redis？还是 invocation 结束就丢弃？

---

## 6) 依赖与风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 猫猫 curl 超时 | 120s 挂起可能触发 CLI 本身的超时机制 | 调研 Codex exec 的请求超时配置 |
| WebSocket 断连 | 铲屎官刷新页面后看不到待审批请求 | 查询 API 补偿 + 重连后推送 pending |
| 并发请求 | 多只猫同时请求权限，前端堆叠 | 队列化展示，按 threadId 分组 |
| Stage 1 安全 | `.git` 写入解锁后缅因猫理论上可以修改 git history | Codex sandbox 仍限制在 workspace 内，风险可控 |

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
