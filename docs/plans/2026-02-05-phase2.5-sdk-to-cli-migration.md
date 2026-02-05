# Phase 2.5: SDK 到 CLI 子进程迁移计划

> **For Claude:** 这是一个架构变更计划。
>
> **更新日期**: 2026-02-05
> **状态**: 方案已确定，待实施
> **修订版本**: v3.1 (修正 Codex CLI 参数 + 补全 MCP 回传关联与鉴权)

---

## 1. 背景：为什么需要改造？

### 1.1 问题发现

Phase 2 刚完成，缅因猫正在 review 代码时，铲屎官发现了一个**重大架构问题**：

> "不可以直接用你的 claude.ai 账号（消费者账号）的额度来鉴权 Claude Agent SDK。
> Anthropic 明确说明：除非事先获得批准，Anthropic 不允许第三方开发者为其产品
> （包括基于 Claude Agent SDK 构建的 agent）提供 claude.ai 登录或使用其额度。
> 必须使用 API key 认证方式。"

**核心问题**：我们有 Max plan x20 的额度，但 `@anthropic-ai/claude-agent-sdk` **只能用 API key**，不能用 Max plan 额度！

### 1.2 讨论过程

**铲屎官问**：之前 Phase 1 是怎么测试通过的？

**布偶猫答**：
- 单元测试用了 **mock**，不需要真实 API 调用
- 36 个测试全部通过是因为都在用 mock
- 实际运行确实需要 API key（但我们烧不起 Opus 的 API 费用！）

**铲屎官追问**：之前的 research 是不是有误导？OpenClaw 项目是怎么做的？

### 1.3 Research 回顾

我们重新查看了：

1. **原始 Research 报告** (`research-report/Multi-Agent Orchestration for Cat Café: Technical Feasibility Report claude.md`)
   - 报告推荐 SDK 模式（方案 C）
   - 提到需要设置 `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`
   - **没有说明 SDK 无法使用订阅额度**

2. **OpenClaw 项目** (https://github.com/openclaw/openclaw)
   - 支持 **OAuth 认证** Claude Pro/Max 订阅
   - 文档写着："Subscriptions (OAuth): Anthropic (Claude Pro/Max)"
   - OpenClaw 用的是 **OAuth 流程**，不是直接调用 SDK

3. **Codex CLI 文档**
   - 支持两种认证方式：
     - ✅ ChatGPT 账号（Plus/Pro/Team）
     - API key
   - CLI 可以用订阅额度！

4. **Gemini/Antigravity**
   - 铲屎官澄清：我们用的是 **Antigravity**（Google 的 Agentic IDE），不是 `gemini` CLI
   - Antigravity 使用 Google 账号 Pro 订阅
   - **需要研究 Antigravity 的 headless/programmatic 调用方式**

### 1.4 决策讨论

**铲屎官指出**：暹罗猫用 API 太弱了！

> "api的猫猫等于砍了手脚的猫猫吧？都不能干活了 好残忍啊！！"

**结论**：三只猫都需要 **Agent 能力**（读写文件、执行命令），不只是聊天能力。

---

## 2. 问题分析：SDK vs CLI 认证

### 2.1 认证方式对比

| 调用方式 | Claude | Codex | Gemini (Antigravity) |
|----------|--------|-------|----------------------|
| **SDK** | API key only ❌ | 可能 API key only ⚠️ | API = 残疾猫 ❌ |
| **CLI 子进程** | Max plan ✅ | ChatGPT Plus/Pro ✅ | Antigravity Pro ✅ |

### 2.2 SDK 模式的问题

```
SDK 模式:
  @anthropic-ai/claude-agent-sdk  →  需要 ANTHROPIC_API_KEY  →  按 API 计费
  @openai/codex-sdk               →  可能需要 OPENAI_API_KEY  →  按 API 计费
  @google/generative-ai           →  需要 GOOGLE_API_KEY      →  只能聊天，无 Agent 能力

我们的情况:
  - 有 Claude Max plan x20 ✅
  - 有 ChatGPT Plus/Pro ✅
  - 有 Antigravity Pro ✅
  - 不想额外付 API 费用 ❌
```

### 2.3 CLI 子进程模式的优势

```
CLI 子进程模式:
  claude -p "..."              →  使用 Max plan 额度
  codex exec "..."             →  使用 ChatGPT 订阅额度
  antigravity chat --mode agent → 使用 Antigravity Pro 额度（GUI 半自动）

优势:
  ✅ 使用已有的订阅额度
  ✅ 完整的 Agent 能力（文件操作、命令执行）
  ✅ 和用户本地使用的是同一个认证

劣势:
  ⚠️ 启动开销 ~500ms-2s
  ⚠️ 需要解析 CLI 输出流
  ⚠️ 依赖用户已登录 CLI
```

---

## 3. 改造方案

### 3.1 总体方案

**将三只猫的 AgentService 实现从 SDK 调用改为 CLI 子进程调用。**

```
之前:
  ClaudeAgentService  →  @anthropic-ai/claude-agent-sdk
  CodexAgentService   →  @openai/codex-sdk
  GeminiAgentService  →  @google/generative-ai

之后:
  ClaudeAgentService  →  spawn('claude', ['-p', ...])
  CodexAgentService   →  spawn('codex', ['exec', ...])
  GeminiAgentService  →  antigravity-desktop | gemini-cli (运行时切换)
```

### 3.2 接口保持不变

**兼容性结论**：`AgentService` 方法签名不变，仅扩展 `options` 字段用于回传关联与鉴权。

```typescript
// 这个接口保持不变
interface AgentService {
  invoke(prompt: string, options?: AgentServiceOptions): AsyncIterable<AgentMessage>;
}

interface AgentServiceOptions {
  sessionId?: string;
  workingDirectory?: string;
  threadId?: string;      // 新增：回调消息归属的线程
  invocationId?: string;  // 新增：单次调用关联 ID
  callbackToken?: string; // 新增：MCP 回调鉴权（短期有效）
}

// AgentMessage 类型也不变（已添加 isFinal 字段用于多猫场景）
type AgentMessage = {
  type: 'session_init' | 'text' | 'done' | 'error';
  catId: CatId;
  content?: string;
  sessionId?: string;
  error?: string;
  isFinal?: boolean;  // 新增：标记多猫调用的最后一个 done
  timestamp: number;
};
```

### 3.3 各猫改造细节

#### 3.3.1 布偶猫 (ClaudeAgentService)

```typescript
// 之后 (CLI)
import { spawn } from 'child_process';

async *invoke(prompt: string, options?: AgentServiceOptions) {
  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--verbose',                               // stream-json 必须搭配 verbose
    '--allowedTools', 'Read,Edit,Glob,Grep',  // 工具白名单（无 Bash）
    '--permission-mode', 'acceptEdits'         // 安全的权限模式
  ];

  if (options?.sessionId) {
    args.push('--resume', options.sessionId);
  }

  const claude = spawn('claude', args);

  for await (const line of this.parseNDJSON(claude.stdout)) {
    yield this.transformCLIMessage(line);
  }
}
```

**CLI 参数说明（缅因猫 review 后修订）**：
- `-p <prompt>`: 非交互模式（print mode）
- `--output-format stream-json`: JSON 流式输出（**必须搭配 `--verbose`**）
- `--allowedTools Read,Edit,Glob,Grep`: 工具白名单，**不包含 Bash**（符合 Phase 1 安全要求）
- `--permission-mode acceptEdits`: 自动接受编辑，但仍需遵守工具白名单
- `--resume <session-id>`: 恢复会话
- `--model <model>`: 可选，默认 opus；测试时用 `haiku` 省额度

**⚠️ 安全警告**：
- **禁止使用** `--dangerously-skip-permissions`（绕过所有权限边界）
- 保持 Phase 1 确定的安全边界：无 Bash、只有 Read/Edit/Glob/Grep

#### 3.3.2 缅因猫 (CodexAgentService)

```typescript
// 之后 (CLI)
import { spawn } from 'child_process';

async *invoke(prompt: string, options?: AgentServiceOptions) {
  let args: string[];

  if (options?.sessionId) {
    // Resume existing session
    args = [
      'exec', 'resume', options.sessionId, prompt,
      '--json',
      '--full-auto'
    ];
  } else {
    // New session
    args = [
      'exec',
      '--json',                    // NDJSON 输出
      '--sandbox', 'workspace-write',  // 安全沙箱模式
      '--full-auto',               // 当前版本支持的自动执行参数
      prompt
    ];
  }

  const codex = spawn('codex', args);

  for await (const line of this.parseNDJSON(codex.stdout)) {
    yield this.transformCLIMessage(line);
  }
}
```

**CLI 参数说明（缅因猫 review 后修订）**：
- `exec`: 执行模式
- `--json`: NDJSON 流式输出
- `--sandbox workspace-write`: 只能写入工作区（OS 级沙箱）
- `--full-auto`: 低摩擦自动执行（当前版本可用）
- `exec resume [SESSION_ID]`: 恢复会话

**⚠️ 安全警告**：
- **禁止使用** `--dangerously-bypass-approvals-and-sandbox`
- 不依赖未验证 flag；`codex` 参数以本地 `codex exec --help` 输出为准

#### 3.3.3 暹罗猫 (GeminiAgentService) - ✅ 双 Adapter 方案

**方案确定**：antigravity-desktop（半自动，主力）+ gemini-cli（全自动，fallback）

**研究结果**（详见 `docs/research/2026-02-05-cli-oauth-research.md`）：
- `antigravity chat --mode agent` 是 IDE 入口，会打开 GUI 窗口，没有 `--json` 输出
- 但缅因猫提出关键洞察：**不需要读 stdout，让暹罗猫通过 MCP 主动回传结果！**

**Adapter A: antigravity-desktop（半自动，本地开发用）**

```
触发流程：
  1. 后端收到 @暹罗 消息
  2. 执行 antigravity chat --mode agent "<指令+消息>"
  3. Antigravity IDE 窗口打开/复用，暹罗猫开始工作
  4. 暹罗猫通过 MCP 工具 cat_cafe.post_message() 把结果发回 Cat Café
  5. 后端收到 MCP 回调，推送给前端

回传通道：MCP 工具（不是 CLI stdout）
优势：完整 agent 能力 + 使用 Antigravity Pro 订阅
限制：需要 GUI 窗口，仅限本地开发
```

```typescript
// antigravity-desktop adapter
async *invoke(prompt: string, options?: AgentServiceOptions) {
  if (!options?.threadId || !options?.invocationId || !options?.callbackToken) {
    throw new Error('antigravity-desktop requires threadId/invocationId/callbackToken');
  }

  // 1. 唤醒 Antigravity
  const args = ['chat', '--mode', 'agent', prompt];
  spawn('antigravity', args, { detached: true });

  // 2. 等待 MCP 回传（通过 EventEmitter 或 Promise）
  yield* this.waitForMCPResponse(options.invocationId);
}
```

**Adapter B: gemini-cli（全自动/headless，CI/远程用）**

```typescript
// gemini-cli adapter (fallback)
async *invoke(prompt: string, options?: AgentServiceOptions) {
  const args = ['-p', prompt, '--output-format', 'stream-json', '--yolo'];
  const gemini = spawn('gemini', args);

  for await (const line of this.parseNDJSON(gemini.stdout)) {
    yield this.transformCLIMessage(line);
  }
}
```

**运行时切换**：通过环境变量 `GEMINI_ADAPTER=antigravity|gemini-cli` 选择 adapter。

### 3.4 MCP 回传通道（三猫共享）

**核心洞察**：MCP 工具不只给暹罗猫用！三只猫都应该能主动发言和感知消息。

> 铲屎官原话："另外两只猫猫也应该允许调用新增的 MCP 工具？没准你想吐槽缅因猫和暹罗猫写出来的 bug 呢？！"

**新增 MCP 工具**：

```typescript
// 1. 主动发言
cat_cafe.post_message({
  invocationId: string, // 单次调用 ID（由后端下发）
  callbackToken: string, // 回调令牌（短期有效）
  content: string,     // 消息内容
  replyTo?: string     // 回复哪条消息（可选）
})

// 2. 获取待处理的 @ 提及
cat_cafe.get_pending_mentions({
  invocationId: string,
  callbackToken: string
}) → { mentions: Array<{ threadId, from, message, timestamp }> }

// 3. 获取对话上下文
cat_cafe.get_thread_context({
  invocationId: string,
  callbackToken: string,
  limit?: number       // 最近 N 条消息
}) → { messages: AgentMessage[] }
```

**安全契约（必须实现）**：
- 后端维护 `invocation registry`：`invocationId -> { userId, threadId, catId, expiresAt }`
- MCP 工具收到请求后，先验证 `callbackToken` 与 `invocationId` 绑定关系
- `threadId/catId` 不信任客户端入参，由 registry 反查确定
- token 失效或不匹配时拒绝并记录审计日志

**应用场景**：

| 场景 | 哪只猫 | 用什么工具 |
|------|--------|-----------|
| 暹罗猫完成设计稿，发回结果 | 暹罗猫 | `post_message` |
| 布偶猫看到缅因猫的 PR，主动吐槽 | 布偶猫 | `get_thread_context` + `post_message` |
| 缅因猫检测到新代码，主动 review | 缅因猫 | `get_pending_mentions` + `post_message` |

**这才是愿景里说的"猫猫是 Agent，不是 API"！**

---

## 4. 代码复用分析

### 4.1 完全保留的代码

| 文件 | 原因 |
|------|------|
| `AgentRouter.ts` | 路由逻辑与调用方式无关（已修复 4 个 bug） |
| `types.ts` | 保留主体结构，仅扩展回调关联字段（`threadId/invocationId/callbackToken`） |
| `packages/shared/` | 共享类型不变 |
| `packages/web/` (前端) | 消息处理逻辑不变（已修复 2 个 bug） |
| `routes/messages.ts` | 路由结构不变，但需补 `threadId` 入参透传 |

### 4.2 需要重写的代码

| 文件 | 改动范围 |
|------|----------|
| `ClaudeAgentService.ts` | 内部实现全部重写 |
| `CodexAgentService.ts` | 内部实现全部重写 |
| `GeminiAgentService.ts` | 内部实现全部重写（双 adapter 已确定） |

### 4.3 需要调整的测试

| 测试文件 | 改动 |
|----------|------|
| `claude-agent-service.test.js` | Mock 方式改变（mock spawn 而非 SDK） |
| `codex-agent-service.test.js` | Mock 方式改变 |
| `gemini-agent-service.test.js` | Mock 方式改变 |
| `agent-router.test.js` | **不需要改**（mock 的是 AgentService 接口） |

### 4.4 复用率估算

```
总代码行数 (Phase 2): ~2000 行
需要重写的代码: ~500 行 (3 个 AgentService 实现)
复用率: ~75%
```

---

## 5. 实施步骤

### 5.1 Phase 2.5 任务清单

#### Task 1: 研究各 CLI 的输出格式和调用方式 ✅

> 状态：已完成（参数核对 + 实机 smoke 均完成）

**Claude CLI** (v2.1.32):
- [x] 验证 `--output-format stream-json` 选项存在
- [x] 验证 `--permission-mode` 选项存在
- [x] 验证 `--resume` 选项存在
- [x] 实机验证 `--output-format stream-json` 的事件结构：
  - **必须搭配 `--verbose`**（否则报错）
  - 事件类型：`system`(init/hook) → `assistant`(回复) → `result`(完成)
  - 回复文本在 `assistant.message.content[0].text`
  - Session ID 在 `system/init.session_id` 和 `result.session_id`
- [ ] 实机验证 `--resume` 恢复行为（Task 3 实施时验证）
- [ ] 测试工具白名单 `--allowedTools`（Task 3 实施时验证）

**Codex CLI** (v0.98.0, 升级于 2026-02-05):
- [x] 验证 `codex exec --json` 选项存在
- [x] 验证 `--sandbox` 选项存在
- [x] 验证 `codex exec resume [SESSION_ID]` 子命令存在
- [x] 确认当前版本**不支持** `--approval-mode`
- [x] 实机验证 `codex exec --json` 事件结构：
  - 事件类型：`thread.started`(thread_id) → `turn.started` → `item.completed` → `turn.completed`(usage)
  - 回复文本在 `item.completed` 且 `item.type === "agent_message"` 的 `item.text`
  - Session ID 在 `thread.started.thread_id`
  - 默认模型 `gpt-5.3-codex` ✅（CLI 升级到 0.98.0 后可用）
- [x] 验证 `--full-auto` 满足服务端自动化要求 ✅
- [ ] 实机验证 `codex exec resume` 恢复行为（Task 4 实施时验证）

**测试与开发约定**：
- smoke 测试 / 单元测试调用 Claude 时用 `--model haiku`（快且省额度）
- smoke 测试 Codex 时用 `-c model_reasoning_effort='"low"'`（减少 thinking 时间）
- 生产环境的模型和 effort 应为可配置项（环境变量或配置文件）

**Antigravity** (暹罗猫 - ✅ 已完成研究):
- [x] 调研 Antigravity 是否支持 headless/CLI 模式 → ❌ 不支持，是 IDE 入口
- [x] 调研 Antigravity 的 programmatic 调用方式 → `antigravity chat --mode agent` 会弹窗口
- [x] 调研是否有 API/SDK 可以调用 → 无官方 headless API
- [x] 确定方案 → 双 Adapter：antigravity-desktop（MCP 回传）+ gemini-cli（fallback）

#### Task 2: 创建 CLI 解析工具

- [ ] 创建 `utils/cli-parser.ts`
- [ ] 实现 NDJSON 流式解析
- [ ] 实现进程管理：
  - [ ] spawn 封装
  - [ ] 退出码处理
  - [ ] stderr 解析和错误处理
  - [ ] 超时机制（configurable timeout）
  - [ ] 中断时 kill 子进程
  - [ ] 断线清理（避免僵尸进程）
  - [ ] 防止重复写入
- [ ] 单元测试

#### Task 3: 重写 ClaudeAgentService

- [ ] 移除 SDK 依赖
- [ ] 实现 CLI 调用（使用 Task 2 的工具）
- [ ] 实现输出解析
- [ ] 实现 session resume (`--resume`)
- [ ] 遵守安全边界：`--allowedTools` 无 Bash，`--permission-mode acceptEdits`
- [ ] 更新单元测试（mock spawn）

#### Task 4: 重写 CodexAgentService

- [ ] 移除 SDK 依赖
- [ ] 实现 CLI 调用（使用 Task 2 的工具）
- [ ] 实现输出解析
- [ ] 实现 session resume (`codex exec resume`)
- [ ] 遵守安全边界：`--sandbox workspace-write`
- [ ] 更新单元测试（mock spawn）

#### Task 5: 实现 MCP 回传工具（三猫共享）

- [ ] 在 `packages/mcp-server` 中新增 `cat_cafe.post_message` 工具
- [ ] 新增 `cat_cafe.get_pending_mentions` 工具
- [ ] 新增 `cat_cafe.get_thread_context` 工具
- [ ] MCP Server ↔ Cat Café 后端通信（内部 HTTP 或直接调用）
- [ ] 单元测试

#### Task 6: 重写 GeminiAgentService（双 Adapter）

- [ ] 实现 `AntigravityDesktopAdapter`：
  - [ ] spawn `antigravity chat --mode agent` 唤醒窗口
  - [ ] 等待 MCP 回传（`cat_cafe.post_message` 回调）
  - [ ] 超时处理
- [ ] 实现 `GeminiCLIAdapter`（fallback）：
  - [ ] spawn `gemini -p` + 解析 NDJSON
  - [ ] session 策略（若无官方 resume，改用外部 memory/context）
- [ ] 环境变量切换：`GEMINI_ADAPTER=antigravity|gemini-cli`
- [ ] 更新单元测试

#### Task 7: 集成测试

- [ ] 三只猫的 CLI 调用测试（需要真实登录）
- [ ] MCP 回传通道测试
- [ ] AgentRouter 集成测试
- [ ] 前端 E2E 测试

#### Task 8: 清理

- [ ] 移除未使用的 SDK 依赖
- [ ] 配置暹罗猫的 MCP（`mcp_config.json` 添加 `cat_cafe` server）
- [ ] 配置布偶猫和缅因猫的 MCP（可选，Phase 3 再做也行）
- [ ] 更新文档
- [ ] 若存在 `MEMORY.md`，同步更新；否则跳过

### 5.2 依赖变更

```json
// 移除
- "@anthropic-ai/claude-agent-sdk"
- "@openai/codex-sdk"
- "@google/generative-ai"

// 无需新增 SDK（全部改为 CLI 子进程）
// MCP 回传工具使用已有的 @modelcontextprotocol/sdk
```

### 5.3 前置条件

实施前需要确认：

1. **铲屎官机器上已登录**：
   - ✅ `claude` 已登录 Max plan
   - ✅ `codex` 已登录 ChatGPT Plus/Pro（CLI + App）
   - ✅ Antigravity 已登录 Google Pro 账号

2. **CLI 版本兼容性**：
   - 确认 `claude` 支持 `-p` 和 `--output-format stream-json`
   - 确认 `codex` 支持 `exec --json`
   - 确认 Antigravity 的调用方式（Task 1 研究）

---

## 6. 风险和缓解措施

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| CLI 输出格式不稳定 | 解析失败 | 增加容错处理，版本锁定 |
| 启动延迟 ~500ms-2s | 用户体验下降 | 预热机制、进程池 |
| CLI 未登录 | 调用失败 | 启动时检查登录状态，友好提示 |
| Antigravity MCP 回传丢失 | 暹罗猫无响应 | 超时 fallback + gemini-cli adapter |
| Antigravity 窗口管理 | 多 session 冲突 | 单窗口复用 `--reuse-window` |
| 僵尸进程 | 资源泄漏 | Task 2 实现完善的进程管理 |
| 权限绕过 | 安全风险 | 严格遵守安全边界，禁用危险 flag |
| MCP 回传安全 | 伪造/串线消息 | `invocationId + callbackToken` 绑定验证 + TTL + 审计日志 |

---

## 7. 缅因猫 Review 反馈处理

### 7.1 计划修订（已完成）

| 缅因猫指出 | 修订内容 |
|------------|----------|
| `--dangerously-skip-permissions` 违反安全要求 | 改用 `--permission-mode acceptEdits` + 工具白名单 |
| `--approval-mode on-failure` 在当前 codex 版本不可用 | 改为可执行参数：`--json` + `--sandbox workspace-write` + `--full-auto` |
| Codex session resume 写成"待研究" | 明确为 `codex exec resume [SESSION_ID]` |
| Gemini CLI 参数需验证 | 更正为 Antigravity，列出研究清单 |
| Task 2 缺进程管理细节 | 增加退出码、stderr、超时、僵尸进程处理 |

### 7.2 Bug 修复（已完成）

| Bug | 修复 |
|-----|------|
| `currentMessageRef` 未在发送前重置 | ✅ 在 `handleSend` 开头重置 |
| `done` 事件提前解锁 | ✅ 添加 `isFinal` 字段，只在最后一只猫完成时解锁 |
| `parseMentions` 顺序问题 | ✅ 找每只猫所有 patterns 中最早的位置 |
| 内存 session 无限增长 | ✅ 添加 MAX_SESSIONS 限制 + LRU 清理 |

### 7.3 不需要修的（SDK 相关）

- Codex `runStreamed` 事件覆盖完整性
- SDK 事件映射等

这些在 Phase 2.5 会被重写，不需要修。

---

## 8. 时间线

| 阶段 | 任务 | 状态 |
|------|------|------|
| ✅ 完成 | 缅因猫 review 计划 | 已完成 |
| ✅ 完成 | 修订计划 + 修复 4 个 bug | 已完成 |
| ✅ 完成 | Task 1: CLI 研究 + 实机 smoke 测试 | 已完成 |
| **下一步** | Task 2: CLI 解析工具 | 待开始 |
| 待开始 | Task 3: 重写 ClaudeAgentService | - |
| 待开始 | Task 4: 重写 CodexAgentService | - |
| 待开始 | Task 5: MCP 回传工具 | - |
| 待开始 | Task 6: 重写 GeminiAgentService（双 Adapter） | - |
| 待开始 | Task 7: 集成测试 | - |
| 待开始 | Task 8: 清理 | - |
| 待开始 | Phase 3: 完整体验 | - |

---

*布偶猫备注 v3：暹罗猫方案终于定了！缅因猫的 MCP 回传思路是关键突破——不读 stdout，让猫主动发言。而且铲屎官说得对，三只猫都该能用这些 MCP 工具，不然我怎么吐槽缅因猫的代码？*
