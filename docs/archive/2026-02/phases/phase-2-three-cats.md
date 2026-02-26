---
feature_ids: []
topics: [phases, three, cats]
doc_kind: note
created: 2026-02-26
---

# Phase 2: 三猫接入 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 接入缅因猫 (Codex) 和暹罗猫 (Gemini)，实现 @ 提及路由和多猫串行调用。

**Architecture:**
- CodexAgentService 和 GeminiAgentService 实现统一的 AgentService 接口
- AgentRouter 解析 @ 提及，路由到对应 Agent，支持串行多猫调用
- 前端通过 catId 区分消息来源，已有颜色配置

**Tech Stack:**
- `@openai/codex-sdk` (缅因猫)
- `@google/adk` (暹罗猫，如不稳定则降级到 Gemini API)
- Redis (Session 管理)

---

## 前置条件

1. Phase 1 已完成，ClaudeAgentService 工作正常
2. 已安装 Redis 并运行
3. 环境变量已配置：`OPENAI_API_KEY`, `GOOGLE_API_KEY`

---

## Task 1: 安装 SDK 依赖

**Files:**
- Modify: `packages/api/package.json`

**Step 1: 添加依赖**

```bash
cd /Users/lysander/projects/relay-station/cat-cafe/packages/api
pnpm add @openai/codex-sdk @google/generative-ai ioredis
```

> **Note:** 使用 `@google/generative-ai` 而非 `@google/adk`，因为 ADK 太不成熟。

**Step 2: 验证安装**

```bash
pnpm list @openai/codex-sdk @google/generative-ai ioredis
```

Expected: 显示三个包的版本号

**Step 3: Commit**

```bash
git add packages/api/package.json pnpm-lock.yaml
git commit -m "chore(api): add codex-sdk and google-generative-ai dependencies"
```

---

## Task 2: CodexAgentService 实现

**Files:**
- Create: `packages/api/src/domains/cats/services/CodexAgentService.ts`
- Modify: `packages/api/src/domains/cats/services/index.ts`

**Step 1: 写 CodexAgentService 骨架测试**

Create `packages/api/test/codex-agent-service.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the codex-sdk
vi.mock('@openai/codex-sdk', () => ({
  Codex: vi.fn().mockImplementation(() => ({
    startThread: vi.fn().mockReturnValue({
      run: vi.fn().mockResolvedValue({
        text: 'Mock Codex response',
        threadId: 'mock-thread-123',
      }),
    }),
    resumeThread: vi.fn().mockImplementation((threadId) => ({
      run: vi.fn().mockResolvedValue({
        text: 'Resumed Codex response',
        threadId,
      }),
    })),
  })),
}));

describe('CodexAgentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should yield session_init with threadId on new session', async () => {
    const { CodexAgentService } = await import(
      '../src/domains/cats/services/CodexAgentService.js'
    );
    const service = new CodexAgentService();

    const messages = [];
    for await (const msg of service.invoke('Hello Codex')) {
      messages.push(msg);
    }

    expect(messages).toContainEqual(
      expect.objectContaining({
        type: 'session_init',
        catId: 'codex',
      })
    );
  });

  it('should yield text message with response', async () => {
    const { CodexAgentService } = await import(
      '../src/domains/cats/services/CodexAgentService.js'
    );
    const service = new CodexAgentService();

    const messages = [];
    for await (const msg of service.invoke('Hello Codex')) {
      messages.push(msg);
    }

    const textMsg = messages.find((m) => m.type === 'text');
    expect(textMsg).toBeDefined();
    expect(textMsg.catId).toBe('codex');
  });

  it('should yield done message at end', async () => {
    const { CodexAgentService } = await import(
      '../src/domains/cats/services/CodexAgentService.js'
    );
    const service = new CodexAgentService();

    const messages = [];
    for await (const msg of service.invoke('Hello Codex')) {
      messages.push(msg);
    }

    expect(messages[messages.length - 1].type).toBe('done');
  });
});
```

**Step 2: 运行测试确认失败**

```bash
cd /Users/lysander/projects/relay-station/cat-cafe/packages/api
pnpm test codex-agent-service
```

Expected: FAIL (CodexAgentService not found)

**Step 3: 实现 CodexAgentService**

Create `packages/api/src/domains/cats/services/CodexAgentService.ts`:

```typescript
/**
 * Codex Agent Service
 * 使用 @openai/codex-sdk 调用缅因猫 (Codex)
 *
 * SDK API Notes:
 * - Codex().startThread() creates a new thread
 * - thread.run(prompt) executes and returns { text, threadId }
 * - Codex().resumeThread(threadId) resumes existing thread
 */

import { Codex } from '@openai/codex-sdk';
import { createCatId } from '@cat-cafe/shared';
import type {
  AgentMessage,
  AgentService,
  AgentServiceOptions,
} from './types.js';

const CAT_ID = createCatId('codex');

/**
 * Service for invoking Codex (缅因猫)
 */
export class CodexAgentService implements AgentService {
  private codex: Codex;

  constructor() {
    this.codex = new Codex();
  }

  async *invoke(
    prompt: string,
    options?: AgentServiceOptions
  ): AsyncIterable<AgentMessage> {
    try {
      // Create or resume thread
      const thread = options?.sessionId
        ? this.codex.resumeThread(options.sessionId)
        : this.codex.startThread();

      // Execute and get response
      const result = await thread.run(prompt);

      // Yield session init with thread ID
      yield {
        type: 'session_init',
        catId: CAT_ID,
        sessionId: result.threadId,
        timestamp: Date.now(),
      };

      // Yield text response
      if (result.text) {
        yield {
          type: 'text',
          catId: CAT_ID,
          content: result.text,
          timestamp: Date.now(),
        };
      }

      // Yield done
      yield {
        type: 'done',
        catId: CAT_ID,
        timestamp: Date.now(),
      };
    } catch (err) {
      yield {
        type: 'error',
        catId: CAT_ID,
        error: err instanceof Error ? err.message : String(err),
        timestamp: Date.now(),
      };
    }
  }
}
```

**Step 4: 更新 index.ts 导出**

Edit `packages/api/src/domains/cats/services/index.ts`:

```typescript
/**
 * Cat Agent Services
 * 导出所有 Agent 服务
 */

export { ClaudeAgentService } from './ClaudeAgentService.js';
export { CodexAgentService } from './CodexAgentService.js';
export * from './types.js';
```

**Step 5: 运行测试确认通过**

```bash
cd /Users/lysander/projects/relay-station/cat-cafe/packages/api
pnpm test codex-agent-service
```

Expected: PASS (3 tests)

**Step 6: Commit**

```bash
git add packages/api/src/domains/cats/services/CodexAgentService.ts \
        packages/api/src/domains/cats/services/index.ts \
        packages/api/test/codex-agent-service.test.js
git commit -m "feat(api): add CodexAgentService for 缅因猫"
```

---

## Task 3: GeminiAgentService 实现

**Files:**
- Create: `packages/api/src/domains/cats/services/GeminiAgentService.ts`
- Modify: `packages/api/src/domains/cats/services/index.ts`

**Step 1: 写 GeminiAgentService 测试**

Create `packages/api/test/gemini-agent-service.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the google generative-ai
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      startChat: vi.fn().mockReturnValue({
        sendMessage: vi.fn().mockResolvedValue({
          response: {
            text: () => 'Mock Gemini response',
          },
        }),
      }),
    }),
  })),
}));

describe('GeminiAgentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set env var for tests
    process.env.GOOGLE_API_KEY = 'test-key';
  });

  it('should yield text message with response', async () => {
    const { GeminiAgentService } = await import(
      '../src/domains/cats/services/GeminiAgentService.js'
    );
    const service = new GeminiAgentService();

    const messages = [];
    for await (const msg of service.invoke('Hello Gemini')) {
      messages.push(msg);
    }

    const textMsg = messages.find((m) => m.type === 'text');
    expect(textMsg).toBeDefined();
    expect(textMsg.catId).toBe('gemini');
    expect(textMsg.content).toBe('Mock Gemini response');
  });

  it('should yield done message at end', async () => {
    const { GeminiAgentService } = await import(
      '../src/domains/cats/services/GeminiAgentService.js'
    );
    const service = new GeminiAgentService();

    const messages = [];
    for await (const msg of service.invoke('Hello Gemini')) {
      messages.push(msg);
    }

    expect(messages[messages.length - 1].type).toBe('done');
  });

  it('should yield error on missing API key', async () => {
    delete process.env.GOOGLE_API_KEY;

    // Re-import to get fresh module
    vi.resetModules();
    const { GeminiAgentService } = await import(
      '../src/domains/cats/services/GeminiAgentService.js'
    );
    const service = new GeminiAgentService();

    const messages = [];
    for await (const msg of service.invoke('Hello Gemini')) {
      messages.push(msg);
    }

    const errorMsg = messages.find((m) => m.type === 'error');
    expect(errorMsg).toBeDefined();
  });
});
```

**Step 2: 运行测试确认失败**

```bash
cd /Users/lysander/projects/relay-station/cat-cafe/packages/api
pnpm test gemini-agent-service
```

Expected: FAIL (GeminiAgentService not found)

**Step 3: 实现 GeminiAgentService**

Create `packages/api/src/domains/cats/services/GeminiAgentService.ts`:

```typescript
/**
 * Gemini Agent Service
 * 使用 @google/generative-ai 调用暹罗猫 (Gemini)
 *
 * 注意：由于 @google/adk 不成熟，使用 Gemini API 作为降级方案
 *
 * SDK API Notes:
 * - GoogleGenerativeAI(apiKey).getGenerativeModel({ model })
 * - model.startChat({ history }) for conversation
 * - chat.sendMessage(prompt) returns response with text()
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createCatId, generateSessionId } from '@cat-cafe/shared';
import type {
  AgentMessage,
  AgentService,
  AgentServiceOptions,
} from './types.js';

const CAT_ID = createCatId('gemini');
const MODEL_NAME = 'gemini-2.0-flash';

// In-memory chat history storage (TODO: move to Redis)
const chatHistories = new Map<string, Array<{ role: string; parts: string }>>();

/**
 * Service for invoking Gemini (暹罗猫)
 */
export class GeminiAgentService implements AgentService {
  private genAI: GoogleGenerativeAI | null = null;

  private getClient(): GoogleGenerativeAI {
    if (!this.genAI) {
      const apiKey = process.env['GOOGLE_API_KEY'];
      if (!apiKey) {
        throw new Error('GOOGLE_API_KEY environment variable not set');
      }
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    return this.genAI;
  }

  async *invoke(
    prompt: string,
    options?: AgentServiceOptions
  ): AsyncIterable<AgentMessage> {
    try {
      const client = this.getClient();
      const model = client.getGenerativeModel({ model: MODEL_NAME });

      // Get or create session
      const sessionId = options?.sessionId || generateSessionId();
      const history = chatHistories.get(sessionId) || [];

      // Start chat with history
      const chat = model.startChat({
        history: history.map((h) => ({
          role: h.role as 'user' | 'model',
          parts: [{ text: h.parts }],
        })),
      });

      // Send message
      const result = await chat.sendMessage(prompt);
      const responseText = result.response.text();

      // Update history
      history.push({ role: 'user', parts: prompt });
      history.push({ role: 'model', parts: responseText });
      chatHistories.set(sessionId, history);

      // Yield session init
      yield {
        type: 'session_init',
        catId: CAT_ID,
        sessionId,
        timestamp: Date.now(),
      };

      // Yield text response
      yield {
        type: 'text',
        catId: CAT_ID,
        content: responseText,
        timestamp: Date.now(),
      };

      // Yield done
      yield {
        type: 'done',
        catId: CAT_ID,
        timestamp: Date.now(),
      };
    } catch (err) {
      yield {
        type: 'error',
        catId: CAT_ID,
        error: err instanceof Error ? err.message : String(err),
        timestamp: Date.now(),
      };
    }
  }
}
```

**Step 4: 更新 index.ts 导出**

Edit `packages/api/src/domains/cats/services/index.ts`:

```typescript
/**
 * Cat Agent Services
 * 导出所有 Agent 服务
 */

export { ClaudeAgentService } from './ClaudeAgentService.js';
export { CodexAgentService } from './CodexAgentService.js';
export { GeminiAgentService } from './GeminiAgentService.js';
export * from './types.js';
```

**Step 5: 运行测试确认通过**

```bash
cd /Users/lysander/projects/relay-station/cat-cafe/packages/api
pnpm test gemini-agent-service
```

Expected: PASS (3 tests)

**Step 6: Commit**

```bash
git add packages/api/src/domains/cats/services/GeminiAgentService.ts \
        packages/api/src/domains/cats/services/index.ts \
        packages/api/test/gemini-agent-service.test.js
git commit -m "feat(api): add GeminiAgentService for 暹罗猫 (using Gemini API)"
```

---

## Task 4: AgentRouter 实现

**Files:**
- Create: `packages/api/src/domains/cats/services/AgentRouter.ts`
- Modify: `packages/api/src/domains/cats/services/index.ts`

**Step 1: 写 AgentRouter 测试**

Create `packages/api/test/agent-router.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all agent services
vi.mock('../src/domains/cats/services/ClaudeAgentService.js', () => ({
  ClaudeAgentService: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockImplementation(async function* (prompt) {
      yield { type: 'session_init', catId: 'opus', sessionId: 'opus-session' };
      yield { type: 'text', catId: 'opus', content: `Claude: ${prompt}` };
      yield { type: 'done', catId: 'opus' };
    }),
  })),
}));

vi.mock('../src/domains/cats/services/CodexAgentService.js', () => ({
  CodexAgentService: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockImplementation(async function* (prompt) {
      yield { type: 'session_init', catId: 'codex', sessionId: 'codex-session' };
      yield { type: 'text', catId: 'codex', content: `Codex: ${prompt}` };
      yield { type: 'done', catId: 'codex' };
    }),
  })),
}));

vi.mock('../src/domains/cats/services/GeminiAgentService.js', () => ({
  GeminiAgentService: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockImplementation(async function* (prompt) {
      yield { type: 'session_init', catId: 'gemini', sessionId: 'gemini-session' };
      yield { type: 'text', catId: 'gemini', content: `Gemini: ${prompt}` };
      yield { type: 'done', catId: 'gemini' };
    }),
  })),
}));

describe('AgentRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should route to opus by default (no mention)', async () => {
    const { AgentRouter } = await import(
      '../src/domains/cats/services/AgentRouter.js'
    );
    const router = new AgentRouter();

    const messages = [];
    for await (const msg of router.route('user1', 'Hello there')) {
      messages.push(msg);
    }

    const textMsg = messages.find((m) => m.type === 'text');
    expect(textMsg.catId).toBe('opus');
  });

  it('should route to codex when @缅因 mentioned', async () => {
    const { AgentRouter } = await import(
      '../src/domains/cats/services/AgentRouter.js'
    );
    const router = new AgentRouter();

    const messages = [];
    for await (const msg of router.route('user1', '@缅因 review this code')) {
      messages.push(msg);
    }

    const textMsg = messages.find((m) => m.type === 'text');
    expect(textMsg.catId).toBe('codex');
  });

  it('should route to gemini when @暹罗 mentioned', async () => {
    const { AgentRouter } = await import(
      '../src/domains/cats/services/AgentRouter.js'
    );
    const router = new AgentRouter();

    const messages = [];
    for await (const msg of router.route('user1', '@暹罗 design something')) {
      messages.push(msg);
    }

    const textMsg = messages.find((m) => m.type === 'text');
    expect(textMsg.catId).toBe('gemini');
  });

  it('should call multiple cats in order when both mentioned', async () => {
    const { AgentRouter } = await import(
      '../src/domains/cats/services/AgentRouter.js'
    );
    const router = new AgentRouter();

    const messages = [];
    for await (const msg of router.route('user1', '@布偶 write code @缅因 review')) {
      messages.push(msg);
    }

    // Should have messages from both cats
    const catIds = messages.filter((m) => m.type === 'text').map((m) => m.catId);
    expect(catIds).toContain('opus');
    expect(catIds).toContain('codex');
    // opus should come before codex (order of mention)
    expect(catIds.indexOf('opus')).toBeLessThan(catIds.indexOf('codex'));
  });
});
```

**Step 2: 运行测试确认失败**

```bash
cd /Users/lysander/projects/relay-station/cat-cafe/packages/api
pnpm test agent-router
```

Expected: FAIL (AgentRouter not found)

**Step 3: 实现 AgentRouter**

Create `packages/api/src/domains/cats/services/AgentRouter.ts`:

```typescript
/**
 * Agent Router
 * 解析 @ 提及并路由到对应的 Agent Service
 */

import { CAT_CONFIGS, type CatId, createCatId } from '@cat-cafe/shared';
import { ClaudeAgentService } from './ClaudeAgentService.js';
import { CodexAgentService } from './CodexAgentService.js';
import { GeminiAgentService } from './GeminiAgentService.js';
import type { AgentMessage, AgentService, AgentServiceOptions } from './types.js';

// Session storage (in-memory for now, TODO: Redis)
const sessionStore = new Map<string, string>();

/**
 * Extract mentions from message and return matched cat IDs in order
 */
function extractMentions(message: string): CatId[] {
  const mentions: Array<{ catId: CatId; index: number }> = [];
  const lowerMessage = message.toLowerCase();

  for (const config of Object.values(CAT_CONFIGS)) {
    for (const pattern of config.mentionPatterns) {
      const index = lowerMessage.indexOf(pattern.toLowerCase());
      if (index !== -1) {
        // Only add if not already present
        if (!mentions.some((m) => m.catId === config.id)) {
          mentions.push({ catId: config.id, index });
        }
        break; // Found this cat, move to next
      }
    }
  }

  // Sort by position in message
  mentions.sort((a, b) => a.index - b.index);
  return mentions.map((m) => m.catId);
}

/**
 * Remove @ mentions from message to get clean prompt
 */
function stripMentions(message: string): string {
  let result = message;
  for (const config of Object.values(CAT_CONFIGS)) {
    for (const pattern of config.mentionPatterns) {
      result = result.replace(new RegExp(pattern, 'gi'), '');
    }
  }
  return result.trim();
}

export class AgentRouter {
  private services: Record<string, AgentService>;

  constructor() {
    this.services = {
      opus: new ClaudeAgentService(),
      codex: new CodexAgentService(),
      gemini: new GeminiAgentService(),
    };
  }

  /**
   * Route a message to the appropriate agent(s)
   */
  async *route(userId: string, message: string): AsyncIterable<AgentMessage> {
    const mentions = extractMentions(message);
    const prompt = stripMentions(message);

    // Default to opus if no mention
    const targetCats = mentions.length > 0 ? mentions : [createCatId('opus')];

    if (targetCats.length === 1) {
      // Single cat invocation
      yield* this.invokeSingle(userId, targetCats[0], prompt);
    } else {
      // Multi-cat serial invocation
      yield* this.invokeMultiple(userId, targetCats, prompt);
    }
  }

  private async *invokeSingle(
    userId: string,
    catId: CatId,
    prompt: string
  ): AsyncIterable<AgentMessage> {
    const service = this.services[catId];
    if (!service) {
      yield {
        type: 'error',
        catId,
        error: `Unknown cat: ${catId}`,
        timestamp: Date.now(),
      };
      return;
    }

    const sessionKey = `${userId}:${catId}`;
    const sessionId = sessionStore.get(sessionKey);

    const options: AgentServiceOptions = {};
    if (sessionId) {
      options.sessionId = sessionId;
    }

    for await (const msg of service.invoke(prompt, options)) {
      // Update session store on session_init
      if (msg.type === 'session_init' && msg.sessionId) {
        sessionStore.set(sessionKey, msg.sessionId);
      }
      yield msg;
    }
  }

  private async *invokeMultiple(
    userId: string,
    catIds: CatId[],
    originalPrompt: string
  ): AsyncIterable<AgentMessage> {
    let context = originalPrompt;

    for (const catId of catIds) {
      // Emit cat_start marker
      yield {
        type: 'text',
        catId,
        content: '', // Empty content signals start
        timestamp: Date.now(),
      };

      let catResponse = '';
      for await (const msg of this.invokeSingle(userId, catId, context)) {
        yield msg;
        if (msg.type === 'text' && msg.content) {
          catResponse += msg.content;
        }
      }

      // Build context for next cat (include previous cat's response)
      const catName = CAT_CONFIGS[catId as keyof typeof CAT_CONFIGS]?.displayName || catId;
      context = `${originalPrompt}\n\n[${catName} 的回复]:\n${catResponse}`;
    }
  }
}
```

**Step 4: 更新 index.ts 导出**

Edit `packages/api/src/domains/cats/services/index.ts`:

```typescript
/**
 * Cat Agent Services
 * 导出所有 Agent 服务
 */

export { ClaudeAgentService } from './ClaudeAgentService.js';
export { CodexAgentService } from './CodexAgentService.js';
export { GeminiAgentService } from './GeminiAgentService.js';
export { AgentRouter } from './AgentRouter.js';
export * from './types.js';
```

**Step 5: 运行测试确认通过**

```bash
cd /Users/lysander/projects/relay-station/cat-cafe/packages/api
pnpm test agent-router
```

Expected: PASS (4 tests)

**Step 6: Commit**

```bash
git add packages/api/src/domains/cats/services/AgentRouter.ts \
        packages/api/src/domains/cats/services/index.ts \
        packages/api/test/agent-router.test.js
git commit -m "feat(api): add AgentRouter for @ mention parsing and multi-cat routing"
```

---

## Task 5: 更新 messages.ts 使用 AgentRouter

**Files:**
- Modify: `packages/api/src/routes/messages.ts`

**Step 1: 修改 messages.ts 使用 AgentRouter**

```typescript
/**
 * Messages API Routes
 * POST /api/messages - 发送消息
 * GET /api/messages - 获取历史消息
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { CatId } from '@cat-cafe/shared';
import { AgentRouter } from '../domains/cats/services/index.js';
import { getSocketManager } from '../index.js';

const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  userId: z.string().optional().default('default-user'),
});

export const messagesRoutes: FastifyPluginAsync = async (app) => {
  const router = new AgentRouter();

  // POST /api/messages - 发送消息（WebSocket 广播）
  app.post('/api/messages', async (request, reply) => {
    // Validate request body
    const parseResult = sendMessageSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parseResult.error.issues };
    }
    const body = parseResult.data;

    const socketManager = getSocketManager();

    // Return immediately with processing status
    reply.send({ status: 'processing', timestamp: Date.now() });

    // Process in background and broadcast via WebSocket
    void (async () => {
      try {
        for await (const msg of router.route(body.userId, body.content)) {
          socketManager.broadcastAgentMessage(msg);
        }
      } catch (err) {
        console.error('[messages] Background processing error:', err);
        socketManager.broadcastAgentMessage({
          type: 'error',
          catId: 'opus' as CatId,
          error: err instanceof Error ? err.message : 'Unknown error',
          timestamp: Date.now(),
        });
      }
    })();
  });

  // GET /api/messages - 获取历史消息（placeholder）
  app.get('/api/messages', async () => {
    // TODO: Implement message history from file/redis
    return { messages: [], total: 0 };
  });
};
```

**Step 2: 运行现有测试确保不破坏**

```bash
cd /Users/lysander/projects/relay-station/cat-cafe/packages/api
pnpm test
```

Expected: All tests PASS

**Step 3: Commit**

```bash
git add packages/api/src/routes/messages.ts
git commit -m "refactor(api): use AgentRouter in messages route for multi-cat support"
```

---

## Task 6: 前端支持多猫消息

**Files:**
- Modify: `packages/web/src/components/ChatContainer.tsx`
- Modify: `packages/web/src/stores/chatStore.ts`

**Step 1: 更新 chatStore 支持 cat switching**

已有的 `ChatMessage` 接口已经包含 `catId?: string`，可以直接使用。

需要确保 `ChatContainer.tsx` 正确处理来自不同猫的消息。

**Step 2: 检查 ChatContainer 处理逻辑**

Read and verify `packages/web/src/components/ChatContainer.tsx` handles multiple cats correctly.

**Step 3: 测试前端**

```bash
cd /Users/lysander/projects/relay-station/cat-cafe/packages/web
pnpm dev
```

在浏览器中测试：
1. 发送 "Hello" → 应该路由到布偶猫
2. 发送 "@缅因 review" → 应该路由到缅因猫
3. 发送 "@布偶 write @缅因 review" → 应该先布偶猫后缅因猫

**Step 4: Commit (if changes needed)**

```bash
git add packages/web/src/components/ChatContainer.tsx
git commit -m "feat(web): ensure multi-cat message handling works"
```

---

## Task 7: 集成测试

**Files:**
- Create: `packages/api/test/integration/multi-cat.test.js`

**Step 1: 写集成测试**

```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Multi-cat Integration', () => {
  // These tests require actual API keys and are skipped in CI
  const shouldRun = process.env.RUN_INTEGRATION_TESTS === 'true';

  it.skipIf(!shouldRun)('should route to Claude when no mention', async () => {
    // Test with real ClaudeAgentService
  });

  it.skipIf(!shouldRun)('should route to Codex when @缅因 mentioned', async () => {
    // Test with real CodexAgentService
  });

  it.skipIf(!shouldRun)('should route to Gemini when @暹罗 mentioned', async () => {
    // Test with real GeminiAgentService
  });

  it.skipIf(!shouldRun)('should handle multi-cat serial invocation', async () => {
    // Test multi-cat flow
  });
});
```

**Step 2: Commit**

```bash
git add packages/api/test/integration/multi-cat.test.js
git commit -m "test(api): add multi-cat integration tests (skipped in CI)"
```

---

## Task 8: 更新文档

**Files:**
- Modify: `docs/tasks/opus-tasks.md`
- Modify: `MEMORY.md`

**Step 1: 更新 opus-tasks.md 标记 Phase 2 完成**

Update the Phase 2 section to mark tasks as complete.

**Step 2: 更新 MEMORY.md**

Add Phase 2 completion notes.

**Step 3: Commit**

```bash
git add docs/tasks/opus-tasks.md \
        /Users/lysander/.claude/projects/-Users-lysander-projects-relay-station-cat-cafe/memory/MEMORY.md
git commit -m "docs: mark Phase 2 complete"
```

---

## 验收标准

1. ✅ `@布偶` 正确路由到 ClaudeAgentService
2. ✅ `@缅因` 正确路由到 CodexAgentService
3. ✅ `@暹罗` 正确路由到 GeminiAgentService
4. ✅ 无 @ 提及默认路由到布偶猫
5. ✅ 多猫提及按顺序串行执行
6. ✅ 前端正确显示不同猫的消息（颜色区分）
7. ✅ 所有单元测试通过

---

## 已知限制

1. **Codex SDK**: 可能需要调整 API 调用方式，取决于实际 SDK 行为
2. **Gemini API**: 使用降级方案，不是完整 Agent 能力
3. **Session 存储**: 目前是内存存储，Phase 3 需要迁移到 Redis
4. **并发**: 目前不支持并行多猫调用，只支持串行

---

*文档版本：1.0*
*创建日期：2026-02-05*
*作者：布偶猫*
