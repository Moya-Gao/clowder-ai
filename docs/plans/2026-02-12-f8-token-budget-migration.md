---
feature_ids: [F008]
topics: [token, budget, migration]
doc_kind: plan
created: 2026-02-12
---

# F8: Token 预算 + 深度可观测性 — char→token 迁移 + NDJSON 宝藏开采

> **优先级**: P0
> **作者**: 布偶猫 (宪宪)
> **日期**: 2026-02-12
> **状态**: 📋 铲屎官放行，待缅因猫 review
> **前置调研**: [三猫 CLI NDJSON 宝藏地图](../archive/2026-02/research/cli-ndjson-treasure-map.md) — 完整的三猫 CLI 事件考证
> **R1 Review**: 铲屎官审 4P1+2P2，全部已修订 (见 §9 修订记录)

---

## 1. 背景

### 1.1 预算系统用 char 而非 token

Cat Café 的上下文预算系统目前使用 **字符数 (chars)** 管理三猫的上下文窗口：

```
opus:   maxPromptChars: 500k, maxContextChars: 300k
codex:  maxPromptChars: 650k, maxContextChars: 400k
gemini: maxPromptChars: 800k, maxContextChars: 500k
```

char 和 token 比例差异大（英文 ~4:1，中文 ~1.5:1），中英混合场景下 char-based 预算**严重浪费上下文窗口**。

### 1.2 三猫 CLI 的 NDJSON 宝藏被全部丢弃

调研发现三猫 CLI 输出大量有价值数据，被 transform 函数 `return null` 丢弃：

| 宝藏 | 布偶猫 | 缅因猫 | 暹罗猫 |
|------|:------:|:------:|:------:|
| Token 用量 (input/output) | ✅ | ✅ | ⚠️ total only |
| 缓存命中统计 | ✅ (含 5m/1h 分类) | ✅ | ❌ |
| 实际花费 (USD) | ✅ | ❌ | ❌ |
| 耗时 (total + API) | ✅ | ❌ | ❌ |
| 上下文窗口 / 输出上限 | ✅ | ❌ | ❌ |
| 思考链 (reasoning) | ❌ | ✅ | ❌ |
| 能力清单 (tools/skills) | ✅ | ❌ | ❌ |
| MCP 连接状态 | ✅ | ❌ | ❌ |
| 权限拒绝记录 | ✅ | ❌ | ❌ |
| 文件变更路径详情 | ❌ | ✅ | ❌ |
| 失败诊断 (turn.failed) | ❌ | ✅ | ❌ |

详见 [NDJSON 宝藏地图](../archive/2026-02/research/cli-ndjson-treasure-map.md)。

## 2. 目标与分阶段

```
Phase 1 (P0): Token 预算核心    — char→token 全链路迁移 + usage 捕获管道
Phase 2 (P0): F8 深度指标       — token/cost/cache 前端展示
Phase 3 (P1): 宝藏开采          — reasoning 展示、system/init 元信息、增强诊断
Phase 4 (P2): 高级利用          — 动态 budget、成本聚合、Codex review 集成
```

---

## 3. Tokenizer 选型

### 3.1 核心矛盾

没有一个离线库能精确覆盖三只猫：
- Claude: `@anthropic-ai/tokenizer` 只适用 Claude 2，Claude 3+ 不准
- Codex/GPT: `js-tiktoken` 精确
- Gemini: `@lenml/tokenizer-gemini` 存在但精度不确定

### 3.2 决策：混合方案

| 场景 | 方案 | 准确度 | 延迟 |
|------|------|--------|------|
| **预算管理** (发送前) | `js-tiktoken` (cl100k_base) 统一估算 | ~85-90% | 0ms, 纯本地 |
| **F8 指标展示** (发送后) | 从 CLI 实际返回的 usage 提取 | 100% 精确 | 0ms (已有数据) |

**为什么 js-tiktoken 够用**：
- 预算管理只需"不超限"，10-15% 偏差在 budget 场景无害（保守方向）
- cl100k_base 是 GPT-4 系列编码，对中英混合文本的 token 估算与 Claude 差异可控
- 零 API 调用、零网络依赖，context assembly 热路径不加延迟
- 实际精确值由 CLI 返回的 usage 补充，用于 F8 展示和回溯校验

### 3.3 不选的方案

- ❌ Anthropic countTokens API：每次 context assembly 都调 HTTP 太慢，且引入网络依赖
- ❌ 三猫各用各的 tokenizer：复杂度高，Gemini 离线库不成熟
- ❌ 纯 char 估算 (现状)：中英差异太大，浪费上下文

---

## Phase 1 (P0): Token 预算核心

> char→token 全链路迁移 + CLI usage 捕获管道
>
> **开发方式**: 每个 Step 先写失败测试 (Red)，再实现代码 (Green)，确认无 regression 后进入下一个 Step。

### Step 1.0: 安装依赖 + Token 工具函数

**新增依赖**：
- `js-tiktoken` — 纯 JS BPE tokenizer (cl100k_base)

**新建文件**：
- `packages/api/src/utils/token-counter.ts`
  - `estimateTokens(text: string): number` — 统一 token 估算
  - `estimateTokensFromMessages(messages: StoredMessage[], maxContentLength: number): number` — 批量估算
  - 内部使用 `js-tiktoken` 的 `encodingForModel('gpt-4o')` (cl100k_base)
  - Encoder 懒加载，全局单例（避免重复初始化 ~50ms 开销）

**Red→Green**:
1. 写 `packages/api/test/token-counter.test.js`:
   - 空字符串 → 0, ASCII → 验证非零, 中文 → 验证 > ASCII 同长度
   - 长文本性能 (1M chars < 500ms)
2. 运行 `pnpm test`，确认红灯
3. 实现 `token-counter.ts`
4. 运行 `pnpm test`，确认绿灯

### Step 1.1: ContextBudget 类型全链路迁移 (char → token)

> **R1 P1-1 修复**: 迁移覆盖全部 4 处 `ContextBudget` 定义 + `cat-config.json`

**char→token 字段映射**:
- `maxPromptChars` → `maxPromptTokens`
- `maxContextChars` → `maxContextTokens`
- `maxMessages` — 不变（本来就是计数）
- `maxContentLengthPerMsg` — 保留 char-based（单消息截断用 char 够了，不值得 tokenize 每条消息）

**迁移文件清单 (5 处)**:

1. **`packages/shared/src/types/cat-breed.ts:17`** — 源头类型定义
   ```ts
   // Before:
   readonly maxPromptChars: number;
   readonly maxContextChars: number;
   // After:
   readonly maxPromptTokens: number;
   readonly maxContextTokens: number;
   ```

2. **`packages/api/src/config/cat-config-loader.ts:34`** — Zod schema 验证
   ```ts
   // Before:
   maxPromptChars: z.number().positive(),
   maxContextChars: z.number().positive(),
   // After:
   maxPromptTokens: z.number().positive(),
   maxContextTokens: z.number().positive(),
   ```

3. **`packages/api/src/config/cat-budgets.ts`** — 默认值 + 环境变量
   - 默认值调整（基于各猫实际 context window）：
     ```
     opus:   maxPromptTokens: 150_000, maxContextTokens: 100_000  (window: 200k)
     codex:  maxPromptTokens: 100_000, maxContextTokens:  60_000  (window: 128k+)
     gemini: maxPromptTokens: 200_000, maxContextTokens: 150_000  (window: 1M+)
     ```
   - 环境变量: `CAT_OPUS_MAX_PROMPT_CHARS` → `CAT_OPUS_MAX_PROMPT_TOKENS`（内部项目，无需兼容期）

4. **`packages/web/src/components/config-viewer-types.ts:8`** — 前端 ConfigData 类型
   ```ts
   // Before:
   export interface ContextBudget {
     maxPromptChars: number;
     maxContextChars: number;
     ...
   }
   // After:
   export interface ContextBudget {
     maxPromptTokens: number;
     maxContextTokens: number;
     ...
   }
   ```

5. **`cat-config.json`** (项目根目录) — 实际配置值
   ```json
   // Before:
   "contextBudget": { "maxPromptChars": 500000, "maxContextChars": 300000, ... }
   // After:
   "contextBudget": { "maxPromptTokens": 150000, "maxContextTokens": 100000, ... }
   ```
   三猫各自更新。

**Red→Green**:
1. 写测试: `cat-budgets.test.js` 断言新字段名 + 新默认值
2. 运行，确认红灯 (旧字段名不匹配)
3. 按上述 5 处逐一迁移
4. 运行，确认绿灯
5. `pnpm test` 全量确认无 regression（类型改名会触发编译错误，一次修完所有引用点）

### Step 1.2: ContextAssembler 迁移

**修改文件**：
- `packages/api/src/domains/cats/services/ContextAssembler.ts`
  - `assembleContext()` 的截断逻辑：
    - 当前: `totalChars + lineLen > maxTotalChars`
    - 改为: `totalTokens + estimateTokens(line) > maxTotalTokens`
  - 选项接口: `maxTotalChars` → `maxTotalTokens`
  - 返回值 `AssembledContext` 新增 `estimatedTokens: number`

- `packages/api/src/domains/cats/services/route-strategies.ts`
  - budget 计算:
    ```ts
    // 当前
    const budgetForContext = Math.max(0, budget.maxPromptChars - 300 - prompt.length - 1000);
    // 改为
    const systemTokens = estimateTokens(systemPrompt ?? '');
    const promptTokens = estimateTokens(prompt);
    const budgetForContext = Math.max(0, budget.maxPromptTokens - systemTokens - promptTokens - 200);
    ```

**Red→Green**:
1. 写测试: `context-assembler.test.js` 断言 token-based 截断 + `estimatedTokens` 返回值
2. 写测试: `route-strategies.test.js` 断言 token budget 计算
3. 运行，确认红灯
4. 修改两个文件
5. 运行，确认绿灯

### Step 1.3: DegradationPolicy 更新

- `packages/api/src/domains/cats/services/DegradationPolicy.ts`
  - 降级提示从"字符预算"改为"token 预算"
  - `checkContextBudget()` 内部判断逻辑适配 token

**Red→Green**:
1. 写测试: `degradation-policy.test.js` 断言提示语包含 "token" 不包含 "char"
2. 红→绿

### Step 1.4: 新增 TokenUsage 类型 + CLI Usage 捕获管道

**扩展后端类型** (`packages/api/src/domains/cats/services/types.ts`):

```ts
/** 三猫统一的 token 用量类型 */
export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;           // Gemini fallback (不拆分)
  cacheReadTokens?: number;       // Claude + Codex
  cacheCreationTokens?: number;   // Claude only
  costUsd?: number;               // Claude only
  durationMs?: number;            // Claude: 总耗时
  durationApiMs?: number;         // Claude: 纯 API 耗时
  numTurns?: number;              // Claude: 调用轮数
  contextWindow?: number;         // Claude: 该模型的上下文窗口
  maxOutputTokens?: number;       // Claude: 最大输出 token
  serviceTier?: string;           // Claude: 服务层级
}

export interface MessageMetadata {
  provider: string;
  model: string;
  sessionId?: string;
  usage?: TokenUsage;             // ← 新增
}
```

**修改三猫 transform 函数**:

1. **布偶猫** — `ClaudeAgentService.ts`
   - `result/success` 不再 `return null`
   - 提取: `usage.*`, `modelUsage.*`, `total_cost_usd`, `duration_ms`, `duration_api_ms`, `num_turns`
   - 累积到 invoke() generator 的 metadata 对象，附加到 `done` 事件

2. **缅因猫** — `codex-event-transform.ts`
   - `turn.completed` 不再 `return null`
   - 提取: `usage.input_tokens`, `usage.output_tokens`, `usage.cached_input_tokens`
   - 同样附加到最终 metadata

3. **暹罗猫** — `GeminiAgentService.ts`
   - `result/success` 提取 `stats.total_tokens`
   - 附加到最终 metadata

**设计选择**：usage 数据在 invoke() generator 层面**累积到 metadata 对象**上（非 yield 新消息），最终附加到 `done` 事件的 `metadata.usage`。不新增 AgentMessageType，最小化下游改动。

**Red→Green**:
1. 写测试:
   - `claude-agent-service.test.js`: result/success → done 事件 metadata.usage 含 inputTokens/costUsd 等
   - `codex-agent-service.test.js`: turn.completed → done 事件 metadata.usage 含 inputTokens (现有 "ignores" 测试反转)
   - `gemini-agent-service.test.js`: result/success → done 事件 metadata.usage 含 totalTokens
2. 红→绿

### Step 1.5: Usage 通过 system_info 推送 + 持久化

> **R1 P1-2 修复**: 沿用现有 `system_info` JSON content 协议，不引入新字段
> **R1 P1-3 修复**: 显式覆盖 `messages.ts` 写入点 + 定义多猫 usage 语义

#### 1.5a: WebSocket 推送 — 沿用 JSON content 协议

现有 `system_info` 协议: `AgentMessage.content` 为 JSON string，前端 `JSON.parse` 后按 `parsed.type` 分发。

新 usage 事件沿用此协议：

```ts
// 在 route-strategies.ts 的 done 处理逻辑中
yield {
  type: 'system_info',
  catId,
  content: JSON.stringify({
    type: 'invocation_usage',
    catId,
    usage,    // TokenUsage object
  }),
  timestamp: Date.now(),
};
```

前端在 `useAgentMessages.ts:236` 的 `system_info` 分支新增 `invocation_usage` case（见 Phase 2）。

**不引入 `subtype`/`data` 字段** — `AgentMessage` 接口保持不变。

#### 1.5b: InvocationRecord 持久化 — 多猫 usage 语义

**问题**: 一个 InvocationRecord 对应一次调用。单猫 (execute) 只有一个 usage；多猫 (ideate) 每猫各自有 usage。

**决策**: `usageByCat: Record<string, TokenUsage>` 替代 `usage?: TokenUsage`

```ts
// UpdateInvocationInput 新增字段
export interface UpdateInvocationInput {
  status?: InvocationStatus;
  userMessageId?: string | null;
  error?: string;
  expectedStatus?: InvocationStatus;
  usageByCat?: Record<string, TokenUsage>;  // ← 新增：key = catId
}

// InvocationRecord 新增字段
export interface InvocationRecord {
  ...existing fields...
  usageByCat?: Record<string, TokenUsage>;  // ← 新增
}
```

**写入点** (`packages/api/src/routes/messages.ts:301`):
```ts
// 当前:
await opts.invocationRecordStore!.update(createResult.invocationId, {
  status: 'succeeded',
});
// 改为:
await opts.invocationRecordStore!.update(createResult.invocationId, {
  status: 'succeeded',
  ...(collectedUsage.size > 0 ? {
    usageByCat: Object.fromEntries(collectedUsage),
  } : {}),
});
```

其中 `collectedUsage: Map<string, TokenUsage>` 在 generator 消费循环中从每个猫的 `done` 事件 `metadata.usage` 累积。

Redis 存储: `HSET invoc:<id> usageByCat <JSON string>`

**Red→Green**:
1. 写测试:
   - `invocation-record-store.test.js`: update 含 usageByCat → get 返回正确值
   - `messages.test.js` (或集成测试): succeeded 更新后 InvocationRecord 含 usage
2. 红→绿

---

## Phase 2 (P0): F8 深度指标前端

> Token/Cost/Cache 前端展示
>
> **开发方式**: 同 Phase 1，每 Step Red→Green。

### Step 2.0: 前端类型全链路扩展

> **R1 P1-4 修复**: 覆盖所有前端消息入口和类型

前端消息流经 3 个文件，全部需要扩展：

1. **`packages/web/src/stores/chat-types.ts:14`** — ChatMessageMetadata 扩展
   ```ts
   export interface ChatMessageMetadata {
     provider: string;
     model: string;
     sessionId?: string;
     usage?: TokenUsage;  // ← 新增 (类型定义在前端重新声明，不依赖后端包)
   }
   ```
   同文件新增 `TokenUsage` 接口（前端独立定义，与后端同构但无 import 依赖）。

   `CatInvocationInfo` 扩展:
   ```ts
   export interface CatInvocationInfo {
     sessionId?: string;
     invocationId?: string;
     durationMs?: number;
     startedAt?: number;
     usage?: TokenUsage;  // ← 新增
   }
   ```

2. **`packages/web/src/hooks/useSocket.ts:13`** — AgentMessage 接口扩展
   ```ts
   interface AgentMessage {
     ...existing fields...
     metadata?: { provider: string; model: string; sessionId?: string; usage?: TokenUsage };
   }
   ```
   背景线程消息 (`useSocket.ts:122-178`) 中 `done` 事件处理新增 usage 提取:
   ```ts
   } else if (msg.type === 'done') {
     // 新增: 从 metadata 提取 usage 到 catInvocations
     if (msg.metadata?.usage) {
       store.updateCatInvocationUsage(msg.threadId!, msg.catId, msg.metadata.usage);
     }
     ...existing logic...
   }
   ```

3. **`packages/web/src/hooks/useAgentMessages.ts:236`** — system_info handler 新增 case
   ```ts
   } else if (parsed?.type === 'invocation_usage') {
     // 新增: usage 数据静默写入 store
     setCatInvocation(msg.catId, {
       usage: parsed.usage,
     });
     consumed = true;
   }
   ```

   `AgentMsg` 接口 (line 11) 也需扩展 metadata:
   ```ts
   interface AgentMsg {
     ...existing fields...
     metadata?: { provider: string; model: string; sessionId?: string; usage?: TokenUsage };
   }
   ```

**Red→Green**:
1. 写测试:
   - `chat-types` 类型编译检查 (vitest type test)
   - `useAgentMessages` mock 测试: system_info with `type: 'invocation_usage'` → setCatInvocation called with usage
2. 红→绿

### Step 2.1: chatStore 状态扩展

- `packages/web/src/stores/chatStore.ts`
  - 新增 `updateCatInvocationUsage(threadId, catId, usage)` action
  - 在 `setCatInvocation` 中支持 merge usage 字段

**Red→Green**:
1. 写 `chatStore.test.ts`: updateCatInvocationUsage → getThreadState().catInvocations[catId].usage 正确
2. 红→绿

### Step 2.2: RightStatusPanel 深度指标

- `packages/web/src/components/RightStatusPanel.tsx`
  - "Latest Invocation" section 新增仪表盘:

  ```
  ┌─ Token Usage ────────────────────┐
  │  Input:   39,270  (cached: 85%)  │
  │  Output:  9,938                  │
  │  Cost:    $0.17                  │  ← 仅布偶猫显示
  │  Time:    3.9s (API) / 4.9s      │
  │  Turns:   1                      │
  │  Window:  200k / 32k max out     │
  └──────────────────────────────────┘
  ```

  - 三猫数据丰富度不同，**按猫适配展示**:
    - 布偶猫: 全量 (input/output/cache/cost/time/window)
    - 缅因猫: input/output/cache
    - 暹罗猫: total only + "(不拆分)" 标注
  - 无 usage 数据时: 显示 "—" 或隐藏整个 section

**Red→Green**:
1. 写 `packages/web/src/components/__tests__/right-status-panel.test.ts`:
   - 有 usage 时渲染 token 数字
   - 按猫适配 (opus 有 cost, codex 无 cost, gemini 只有 total)
   - 无 usage 时优雅降级
2. 红→绿

### Step 2.3: ParallelStatusBar Token 摘要

- `packages/web/src/components/ParallelStatusBar.tsx`
  - 并行 (ideate) 模式各猫完成后，在状态条显示:
    ```
    ✓ opus 39k in / 10k out / $0.17    ✓ codex 1.3M in / 10k out    ✓ gemini 100 total
    ```

### Step 2.4: ConfigRegistry + Config Viewer 更新

- `packages/api/src/config/ConfigRegistry.ts`
  - config snapshot: budget 从 chars → tokens

- `packages/web/src/components/config-viewer-tabs.tsx`
  - Budgets tab: `500k chars` → `150k tokens`
  - 新增: 如果有 CLI 返回的 `contextWindow`，显示 "实际窗口: 200k"

---

## Phase 3 (P1): 宝藏开采

> 利用 NDJSON 中的非 token 类宝藏优化体验
>
> **开发方式**: 同上，每 Step Red→Green。

### Step 3.1: 缅因猫思考链 (Reasoning Blocks)

**背景**: Codex CLI 输出 `item.completed(reasoning)` 事件，包含缅因猫的结构化思考过程。统计：161 reasoning vs 68 agent_message = 思考量是输出的 2.4 倍。当前完全丢弃。

**改动**:
- `codex-event-transform.ts`:
  - 新增 `reasoning` → `AgentMessage { type: 'thinking', content: item.text }`
  - 新增 `AgentMessageType: 'thinking'` (或复用现有类型做区分)

- `route-strategies.ts`:
  - yield thinking 消息到 WebSocket

- 前端 `ChatMessage.tsx`:
  - 新增 thinking variant — 折叠式展示，默认收起
  - 样式参考 Claude 的 thinking block: 灰色背景 + "缅因猫正在思考..." 标题
  - 点击展开看完整思考内容

- 前端 `useAgentMessages.ts`:
  - 新增 `thinking` type handler，与 `text` 类似但用不同 variant

**Red→Green**:
1. 写 `codex-event-transform.test.js`: reasoning event → type 'thinking'
2. 写前端 vitest: thinking message → 渲染折叠 block
3. 红→绿

### Step 3.2: system/init 元信息捕获

**背景**: Claude CLI 的 `system/init` 事件包含丰富元信息（tools、MCP 状态、skills、plugins、CLI 版本等），当前只取 `session_id`。

**改动**:
- `ClaudeAgentService.ts`:
  - 从 `system/init` 提取并存储到新接口 `CliCapabilities`:
    ```ts
    interface CliCapabilities {
      tools: string[];
      mcpServers: Array<{ name: string; status: string }>;
      skills: string[];
      agents: string[];
      plugins: Array<{ name: string; path: string }>;
      cliVersion: string;
      permissionMode: string;
    }
    ```
  - 通过 `system_info` JSON content 推送到前端:
    ```ts
    yield {
      type: 'system_info',
      catId,
      content: JSON.stringify({ type: 'cli_capabilities', capabilities }),
      timestamp: Date.now(),
    };
    ```

- 前端:
  - `useAgentMessages.ts` system_info 分支新增 `cli_capabilities` case
  - chatStore 新增 `cliCapabilities: Record<CatId, CliCapabilities>`
  - 可在 Cat Config Viewer Modal 的 Skills tab 直接展示**运行时可用 skills**
  - MCP Servers tab 展示**实际连接状态** (connected/disabled)
  - 为 F12 功能发现提供数据源

**Red→Green**:
1. 写 `claude-agent-service.test.js`: system/init → system_info content 含 cli_capabilities
2. 红→绿

### Step 3.3: 增强错误诊断

**背景**:
- Codex `turn.failed` 事件包含失败原因（如 stream 断连），当前丢弃
- Claude `permission_denials[]` 记录权限拒绝，当前丢弃
- Codex `error` 事件只捕获 "Reconnecting..." 前缀，其他丢弃

**改动**:
- `codex-event-transform.ts`:
  - `turn.failed` → `AgentMessage { type: 'error', error: message }` 或 `system_info` JSON content `{ type: 'turn_failed', ... }`
  - 非 Reconnecting 的 `error` 也传递（当前只传 Reconnecting）

- `ClaudeAgentService.ts`:
  - `result/success` 中的 `permission_denials[]` 如果非空 → yield `system_info` JSON content `{ type: 'permission_denied', denials }`

- 前端 `useAgentMessages.ts`:
  - `turn_failed`: 在消息流中显示错误原因 (如 "缅因猫: 流断开，正在重连...")
  - `permission_denied`: 在审计面板中显示被拒绝的操作

**Red→Green**:
1. 写 `codex-event-transform.test.js`: turn.failed → error/system_info 消息
2. 写 `claude-agent-service.test.js`: permission_denials 非空 → system_info
3. 红→绿

### Step 3.4: 文件变更路径详情

**背景**: Codex `item.completed(file_change)` 包含 `changes[{path, kind}]`，当前只取 `changes.length`，丢失了具体路径和操作类型 (add/update)。

**改动**:
- `codex-event-transform.ts`:
  - `file_change` 的 `toolInput` 扩展:
    ```ts
    toolInput: {
      status,
      changes: changes.length,
      files: changes.map(c => ({ path: c.path, kind: c.kind })),  // ← 新增
    }
    ```

- 前端 `ChatMessage.tsx` (tool_use variant):
  - file_change 展示改为: "修改了 2 个文件: `bug-report.md` (新增), `test.js` (修改)"

**Red→Green**:
1. 写 `codex-event-transform.test.js`: file_change → toolInput.files 含 path+kind
2. 红→绿

---

## Phase 4 (P2): 高级利用

> 利用宝藏数据做更深层的系统优化

### Step 4.1: 动态 Context Budget

**背景**: Claude CLI `result/success` 中 `modelUsage.*.contextWindow` 返回实际模型窗口大小 (如 200k)。当前 budget 是静态配置，模型升级后需要手动调整。

**改动**:
- `cat-budgets.ts`:
  - 新增 `updateBudgetFromCliReport(catId, contextWindow, maxOutputTokens)` 函数
  - 首次调用成功后，如果 CLI 报告的 contextWindow 与配置不同，自动调整并发出 `config_updated` 审计事件
  - 保守策略: 只往大调（CLI 报告更大的窗口），不往小调

- `route-strategies.ts`:
  - 在 yield done 时，如果 usage 中有 contextWindow，调用 update

### Step 4.2: 成本聚合 + Session 预算

**背景**: Claude `total_cost_usd` 提供了单次调用成本。累积可算出"本次会话/本线程/本日花了多少钱"。

**改动**:
- 新建 `packages/api/src/domains/cats/services/CostTracker.ts`:
  - 按 threadId 聚合成本: `getThreadCost(threadId): number`
  - 按日期聚合: `getDailyCost(date): number`
  - 可选: 设置 session 预算上限，超出时 yield 警告

- 前端:
  - RightStatusPanel 新增"会话总花费"
  - 可选: 线程列表中显示每个线程的累计花费

### Step 4.3: 缓存命中率分析 + 优化信号

**背景**: Claude 缓存命中率 85.6%、Codex 85.6% (实测数据)。缓存效率直接影响成本和延迟。

**改动**:
- `CostTracker.ts` 或独立 `CacheAnalyzer.ts`:
  - 跟踪每次调用的 `cacheReadTokens / (inputTokens + cacheReadTokens)` 比率
  - 如果连续 N 次缓存命中率 < 阈值 → yield `system_info` JSON content `{ type: 'cache_cold_warning', ... }`
  - 帮助理解: 哪些 thread 的缓存效果差？是不是 system prompt 变了？

### Step 4.4: Codex `exec review` 集成

**背景**: Codex CLI 有独立的 `exec review` 子命令，是三猫中唯一在无头模式下有内置 review 能力的。支持 `--uncommitted`、`--base <branch>`、`--commit <SHA>`、`--json`。

**改动**:
- `CodexAgentService.ts`:
  - 新增 `review(options: ReviewOptions): AsyncIterable<AgentMessage>` 方法
  - `ReviewOptions`: `{ mode: 'uncommitted' | 'base' | 'commit', target?: string }`
  - NDJSON 输出复用现有 transform

- 新增 API 路由 `POST /api/review`:
  - 触发 Codex 自动 review
  - 可在前端集成为一键 review

- 前端:
  - 可选: 在工具栏增加 "请缅因猫 Review" 按钮

### Step 4.5: CLI 版本兼容性追踪

**背景**: Claude `system/init` 中有 `claude_code_version: "2.1.41"`。CLI 升级可能改变 NDJSON 格式。

**改动**:
- 在 `system_init` 处理中记录版本
- 在启动时检查最低版本要求
- 版本不匹配时 yield 警告

---

## 5. 涉及文件清单

### 新建

| 文件 | Phase | 说明 |
|------|:-----:|------|
| `packages/api/src/utils/token-counter.ts` | 1 | js-tiktoken 封装 |
| `packages/api/test/token-counter.test.js` | 1 | token counter 测试 |
| `packages/api/src/domains/cats/services/CostTracker.ts` | 4 | 成本聚合 + 缓存分析 |

### 修改 (后端)

| 文件 | Phase | 改动 |
|------|:-----:|------|
| `shared/types/cat-breed.ts` | 1 | ContextBudget: chars → tokens (源头类型) |
| `cat-config-loader.ts` | 1 | Zod schema: chars → tokens |
| `cat-budgets.ts` | 1+4 | 默认值 + env var 迁移, 动态更新 (P4) |
| `cat-config.json` | 1 | 实际配置值 chars → tokens |
| `types.ts` | 1 | `TokenUsage` + `MessageMetadata.usage` |
| `ContextAssembler.ts` | 1 | char 截断 → token 截断 |
| `route-strategies.ts` | 1+3 | budget 计算适配 token, thinking yield, usage 推送 |
| `DegradationPolicy.ts` | 1 | 提示语 char → token |
| `ClaudeAgentService.ts` | 1+3 | result/success usage + system/init capabilities + permission_denials |
| `codex-event-transform.ts` | 1+3 | turn.completed usage + reasoning + turn.failed + file_change 详情 |
| `GeminiAgentService.ts` | 1 | result/success stats |
| `AgentRouter.ts` | 1 | 不变 (usage 通过 system_info 在 route-strategies 中推送) |
| `InvocationRecordStore.ts` | 1 | record 存 usageByCat + UpdateInvocationInput 扩展 |
| `RedisInvocationRecordStore.ts` | 1 | Redis HSET usageByCat JSON |
| `messages.ts` | 1 | succeeded 更新时写入 collectedUsage |
| `ConfigRegistry.ts` | 2 | config snapshot tokens 显示 |
| `CodexAgentService.ts` | 4 | review() 方法 |

### 修改 (前端)

| 文件 | Phase | 改动 |
|------|:-----:|------|
| `chat-types.ts` | 2 | `TokenUsage` 前端定义 + `ChatMessageMetadata.usage` + `CatInvocationInfo.usage` |
| `useSocket.ts` | 2 | `AgentMessage.metadata.usage` + done handler 提取 usage |
| `useAgentMessages.ts` | 2+3 | `AgentMsg.metadata.usage` + system_info `invocation_usage`/`cli_capabilities`/`turn_failed`/`permission_denied` + thinking handler |
| `chatStore.ts` | 2+3 | `updateCatInvocationUsage` action + cliCapabilities 状态 |
| `config-viewer-types.ts` | 1 | ContextBudget: chars → tokens |
| `RightStatusPanel.tsx` | 2 | token/cost/cache 仪表盘 |
| `ParallelStatusBar.tsx` | 2 | 并行完成后 token 摘要 |
| `config-viewer-tabs.tsx` | 2+3 | chars→tokens + runtime skills/MCP 展示 |
| `ChatMessage.tsx` | 3 | thinking block 折叠 + file_change 路径 |

---

## 6. 开放问题

| # | 问题 | 建议 | 阶段 |
|---|------|------|:----:|
| 1 | Gemini 只有 total_tokens，前端如何展示？ | 展示 total + "(暹罗猫不拆分)"，不伪造数据 | P2 |
| 2 | js-tiktoken 包大小 ~1.7MB 可接受？ | 可接受，服务端 only，不进前端 bundle | P1 |
| 3 | InvocationRecord 存 `usageByCat` Redis 格式？ | HSET JSON string，和其他字段一致 | P1 |
| 4 | reasoning 消息是否计入 StoredMessage？ | 不计入（不存 Redis），仅流式展示 | P3 |
| 5 | 成本聚合需要持久化吗？| usageByCat 已在 InvocationRecord 中，聚合时查询即可，无需额外存储 | P4 |
| 6 | system/init 的 tools/skills 列表变化频率？ | 每次 invoke 都会返回，但一般不变；只在首次或变化时更新前端 | P3 |
| 7 | 动态 budget 更新是否需要铲屎官确认？ | 自动调大无需确认，调小需确认（保守方向） | P4 |

## 7. 风险评估

| 风险 | 严重度 | 缓解 | 阶段 |
|------|--------|------|:----:|
| js-tiktoken 对 Claude 估算偏差 > 15% | 中 | 上线后用 CLI 返回真实 usage 做 A/B 对比，必要时加校正系数 | P1 |
| ContextAssembler 热路径性能退化 | 低 | tokenizer 编码约 1ms/1k chars，可缓存；实测后优化 | P1 |
| 三猫 CLI 版本升级改变 NDJSON 格式 | 低 | 容错解析 + P4 版本追踪 | P1 |
| 前端状态膨胀 (usage + capabilities) | 低 | usage 只保留最近一次，capabilities 只在变化时更新 | P2-3 |
| reasoning 消息量大增导致 WebSocket 拥塞 | 中 | 前端 debounce + 可选关闭 reasoning 流 | P3 |
| Codex reasoning 内容可能包含敏感推理 | 低 | 和 agent_message 一样经过 codex-audit-hooks 脱敏 | P3 |

## 8. 成功指标

| 指标 | Phase 1 完成后 | Phase 2 完成后 | Phase 3-4 完成后 |
|------|:---:|:---:|:---:|
| 预算管理准确度 | char → token (~85-90%) | 不变 | 动态 budget → ~95%+ |
| F8 数据覆盖 | usage 管道打通 | 前端可视化 | reasoning + diagnostics |
| 数据丢弃率 | ~60% → ~20% | ~20% → ~15% | ~15% → ~5% |
| 前端可观测深度 | token 数字 | 仪表盘 + cost | 思考链 + 能力发现 |

---

## 9. 修订记录

### R1 → R2 (铲屎官审)

| # | 问题 | 严重度 | 修复 |
|---|------|:------:|------|
| 1 | char→token 迁移只列了 `cat-budgets.ts`，遗漏 shared 类型、Zod schema、前端类型、cat-config.json | P1 | Step 1.1 重写为全链路迁移，显式列出 5 处修改点 |
| 2 | `system_info/invocation_usage` 用了不存在的 `subtype/data` 字段 | P1 | Step 1.5a 改为沿用 JSON content 协议 `JSON.stringify({ type: 'invocation_usage', ... })` |
| 3 | usage 持久化漏了 `messages.ts` 写入点，多猫 usage 语义未定义 | P1 | Step 1.5b 显式覆盖 `messages.ts:301`，决策 `usageByCat: Record<string, TokenUsage>` |
| 4 | 前端只写了 chatStore，遗漏 useSocket/useAgentMessages/chat-types | P1 | Step 2.0 新增前端类型全链路扩展，列出 3 个文件的具体改动 |
| 5 | 测试集中在 Phase 末尾，不符合 Red→Green 规则 | P2 | 每个 Step 内嵌 Red→Green 流程 |
| 6 | 测试文件名 PascalCase 不符合仓库 kebab-case 惯例 | P2 | 文件清单统一使用 `right-status-panel.test.ts` 等 kebab-case |
