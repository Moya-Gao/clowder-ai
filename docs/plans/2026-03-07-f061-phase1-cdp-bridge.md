# F061 Phase 1: AntigravityAgentService — CDP 桥接入

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 将 Antigravity IDE 作为新 provider (`antigravity`) 接入 Cat Cafe AgentRouter，通过 CDP WebSocket 桥实现消息收发。

**Architecture:** `AntigravityAgentService` 通过 CDP WebSocket 连接到 Antigravity IDE（端口 9000），用 `document.execCommand('insertText')` 注入消息（Lexical 编辑器），用 DOM polling 读取模型回复，将结果转换为标准 `AgentMessage` 流。CDP 连接层抽取为独立的 `AntigravityCdpClient` 类，方便测试和替换。

**Tech Stack:** Node.js native WebSocket (Node 22+), CDP JSON-RPC over WebSocket, Zod schema validation

**Spike 经验（Phase 0 已验证，详见 `docs/features/F061-antigravity-bengal-cat.md`）：**
- 消息注入：`document.execCommand('insertText')` 是唯一有效方式（Lexical 编辑器）
- 注入前必须 click 获焦
- 回复读取：`.whitespace-pre-wrap`（用户消息）、`button` 含 "Thought for"（思考）、`<p>`（回复）
- 需先通过 `/json` 获取 target，过滤掉 Launchpad 页面
- 新建对话：点击 `+` 按钮（chat header icon 0）
- CDP 端口：9000（`~/.antigravity/argv.json` 配置）

**NOT building（Phase 2 scope）：**
- 图片生成回传（AC-7）
- 截图/录屏证据链（AC-8）
- 多模型切换控制（AC-9）
- MCP browser tools 集成

---

## Terminal Schema

```typescript
// packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityCdpClient.ts
export interface CdpTarget {
  title: string;
  webSocketDebuggerUrl: string;
  type: string;
  url: string;
}

export interface AntigravityCdpClientOptions {
  port?: number;         // default 9000
  host?: string;         // default 'localhost'
}

export class AntigravityCdpClient {
  constructor(options?: AntigravityCdpClientOptions);
  async connect(): Promise<void>;          // Find editor target + open WS
  async disconnect(): Promise<void>;
  async sendMessage(text: string): Promise<void>;  // Click + execCommand + Enter
  async pollResponse(timeoutMs?: number): Promise<string | null>;  // DOM polling
  async newConversation(): Promise<void>;  // Click + button
  get connected(): boolean;
}

// packages/api/src/domains/cats/services/agents/providers/AntigravityAgentService.ts
export interface AntigravityAgentServiceOptions {
  catId?: CatId;
  model?: string;
  cdpPort?: number;
  /** Inject mock CDP client for testing */
  cdpClient?: AntigravityCdpClient;
}

export class AntigravityAgentService implements AgentService {
  readonly catId: CatId;
  async *invoke(prompt: string, options?: AgentServiceOptions): AsyncIterable<AgentMessage>;
}
```

---

## Task 1: CDP Client — 连接 + Target 发现

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityCdpClient.ts`
- Test: `packages/api/test/antigravity-cdp-client.test.js`

**Step 1: Write the failing test**

```javascript
// packages/api/test/antigravity-cdp-client.test.js
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { AntigravityCdpClient, findEditorTarget } from
  '../dist/domains/cats/services/agents/providers/antigravity/AntigravityCdpClient.js';

describe('findEditorTarget', () => {
  test('picks editor page, skips Launchpad', () => {
    const targets = [
      { type: 'page', title: 'Launchpad', webSocketDebuggerUrl: 'ws://a', url: 'vscode-file://...' },
      { type: 'page', title: 'cat-cafe — main.ts', webSocketDebuggerUrl: 'ws://b', url: 'vscode-file://...' },
      { type: 'iframe', title: 'webview', webSocketDebuggerUrl: 'ws://c', url: 'vscode-webview://...' },
    ];
    const result = findEditorTarget(targets);
    assert.equal(result?.webSocketDebuggerUrl, 'ws://b');
  });

  test('returns null when no editor page found', () => {
    const targets = [
      { type: 'page', title: 'Launchpad', webSocketDebuggerUrl: 'ws://a', url: '' },
    ];
    assert.equal(findEditorTarget(targets), null);
  });
});

describe('AntigravityCdpClient', () => {
  test('constructor defaults', () => {
    const client = new AntigravityCdpClient();
    assert.equal(client.connected, false);
  });

  test('constructor with custom port', () => {
    const client = new AntigravityCdpClient({ port: 9222 });
    assert.equal(client.connected, false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && pnpm build && node --test test/antigravity-cdp-client.test.js`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityCdpClient.ts
export interface CdpTarget {
  title: string;
  webSocketDebuggerUrl: string;
  type: string;
  url: string;
}

export interface AntigravityCdpClientOptions {
  port?: number;
  host?: string;
}

/** Pick the editor page target, skip Launchpad/iframes/workers */
export function findEditorTarget(targets: CdpTarget[]): CdpTarget | null {
  return targets.find(t =>
    t.type === 'page' &&
    !t.title.includes('Launchpad') &&
    t.webSocketDebuggerUrl
  ) ?? null;
}

export class AntigravityCdpClient {
  private readonly port: number;
  private readonly host: string;
  private ws: WebSocket | null = null;
  private idCounter = 0;
  private pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }>();

  constructor(options?: AntigravityCdpClientOptions) {
    this.port = options?.port ?? 9000;
    this.host = options?.host ?? 'localhost';
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get baseUrl(): string {
    return `http://${this.host}:${this.port}`;
  }

  /** Fetch targets and connect to editor page */
  async connect(): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/json`);
    const targets: CdpTarget[] = await resp.json();
    const target = findEditorTarget(targets);
    if (!target) {
      throw new Error(`No Antigravity editor page found on port ${this.port}. Targets: ${targets.map(t => t.title).join(', ')}`);
    }

    this.ws = new WebSocket(target.webSocketDebuggerUrl);
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result);
      }
    };

    await new Promise<void>((resolve, reject) => {
      this.ws!.onopen = () => resolve();
      this.ws!.onerror = (e) => reject(new Error(`CDP WebSocket error: ${e}`));
    });

    await this.cdp('Runtime.enable');
    await this.cdp('Input.enable');
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.pending.clear();
  }

  /** Send a CDP command and await result */
  async cdp(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('CDP not connected');
    }
    const id = ++this.idCounter;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout for ${method}`));
        }
      }, 10_000);
    });
  }

  /** Evaluate JS in the Antigravity page */
  async evaluate<T = unknown>(expression: string): Promise<T> {
    const result = await this.cdp('Runtime.evaluate', { expression }) as
      { result: { value: T } };
    return result.result.value;
  }

  /** Inject message into Antigravity chat and send */
  async sendMessage(text: string): Promise<void> {
    // 1. Find and click the textbox to focus it
    const tbInfo = await this.evaluate<string | null>(`(() => {
      const tb = document.querySelector('[role="textbox"][contenteditable="true"]');
      if (!tb) return null;
      const r = tb.getBoundingClientRect();
      return JSON.stringify({ x: r.x + r.width/2, y: r.y + r.height/2 });
    })()`);

    if (!tbInfo) throw new Error('Antigravity chat textbox not found');
    const { x, y } = JSON.parse(tbInfo);

    await this.cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });

    // 2. Small delay for focus
    await new Promise(r => setTimeout(r, 300));

    // 3. Inject text via execCommand (Lexical hook)
    await this.evaluate(`document.execCommand('insertText', false, ${JSON.stringify(text)})`);

    // 4. Press Enter to send
    await new Promise(r => setTimeout(r, 200));
    await this.cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await this.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  }

  /** Poll DOM for model response. Returns text or null on timeout. */
  async pollResponse(timeoutMs = 60_000): Promise<string | null> {
    const start = Date.now();
    const pollInterval = 1_000;
    let lastUserMsgCount = await this.evaluate<number>(
      `document.querySelectorAll('.whitespace-pre-wrap').length`
    );

    while (Date.now() - start < timeoutMs) {
      await new Promise(r => setTimeout(r, pollInterval));

      const state = await this.evaluate<string>(`(() => {
        const thoughts = [...document.querySelectorAll('button')].filter(b => b.textContent?.includes('Thought for'));
        const loading = document.querySelector('.codicon-loading');
        // Collect all <p> text after the last thought button
        const lastThought = thoughts[thoughts.length - 1];
        let responseText = '';
        if (lastThought) {
          const container = lastThought.closest('.group') || lastThought.parentElement?.parentElement;
          if (container) {
            const ps = container.querySelectorAll('p');
            responseText = [...ps].map(p => p.textContent?.trim()).filter(Boolean).join('\\n');
          }
        }
        return JSON.stringify({ loading: !!loading, thoughts: thoughts.length, responseText });
      })()`);

      const { loading, thoughts, responseText } = JSON.parse(state);
      if (thoughts > 0 && !loading && responseText) {
        return responseText;
      }
    }
    return null;
  }

  /** Click + button to start new conversation */
  async newConversation(): Promise<void> {
    const btnInfo = await this.evaluate<string | null>(`(() => {
      const links = document.querySelectorAll('a.group.relative');
      const chatBtns = [...links].filter(a => {
        const r = a.getBoundingClientRect();
        return r.y > 30 && r.y < 70 && r.x > 1200 && r.width < 30;
      });
      if (chatBtns.length === 0) return null;
      const btn = chatBtns[0]; // First icon = +
      const r = btn.getBoundingClientRect();
      return JSON.stringify({ x: r.x + r.width/2, y: r.y + r.height/2 });
    })()`);

    if (!btnInfo) throw new Error('New conversation button not found');
    const { x, y } = JSON.parse(btnInfo);
    await this.cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 1000));
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/api && pnpm build && node --test test/antigravity-cdp-client.test.js`
Expected: PASS (2 tests — pure unit tests on findEditorTarget + constructor, no real CDP)

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityCdpClient.ts \
       packages/api/test/antigravity-cdp-client.test.js
git commit -m "feat(F061): AntigravityCdpClient — CDP 连接 + target 发现 + 消息注入/读取"
```

---

## Task 2: AntigravityAgentService — AgentService 接口实现

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/AntigravityAgentService.ts`
- Test: `packages/api/test/antigravity-agent-service.test.js`

**Step 1: Write the failing test**

```javascript
// packages/api/test/antigravity-agent-service.test.js
import { describe, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { AntigravityAgentService } from
  '../dist/domains/cats/services/agents/providers/AntigravityAgentService.js';

async function collect(iterable) {
  const messages = [];
  for await (const msg of iterable) messages.push(msg);
  return messages;
}

/** Create a fake CDP client for testing */
function createMockCdpClient({ response = 'Meow!', error = null } = {}) {
  return {
    connected: false,
    connect: mock.fn(async () => { /* noop */ }),
    disconnect: mock.fn(async () => { /* noop */ }),
    sendMessage: mock.fn(async () => {
      if (error) throw new Error(error);
    }),
    pollResponse: mock.fn(async () => response),
    newConversation: mock.fn(async () => { /* noop */ }),
  };
}

describe('AntigravityAgentService', () => {
  test('yields text + done from successful response', async () => {
    const cdpClient = createMockCdpClient({ response: 'Hello from Antigravity!' });
    const service = new AntigravityAgentService({
      catId: 'antigravity',
      model: 'gemini-3.1-pro',
      cdpClient,
    });
    const messages = await collect(service.invoke('Say hello'));

    // Should connect, create new conversation, send, poll, disconnect
    assert.equal(cdpClient.connect.mock.callCount(), 1);
    assert.equal(cdpClient.newConversation.mock.callCount(), 1);
    assert.equal(cdpClient.sendMessage.mock.callCount(), 1);
    assert.equal(cdpClient.sendMessage.mock.calls[0].arguments[0], 'Say hello');
    assert.equal(cdpClient.pollResponse.mock.callCount(), 1);

    // Message sequence: text → done
    assert.equal(messages.length, 2);
    assert.equal(messages[0].type, 'text');
    assert.equal(messages[0].content, 'Hello from Antigravity!');
    assert.equal(messages[0].catId, 'antigravity');
    assert.equal(messages[0].metadata.provider, 'antigravity');
    assert.equal(messages[1].type, 'done');
  });

  test('yields error + done when CDP connect fails', async () => {
    const cdpClient = createMockCdpClient();
    cdpClient.connect = mock.fn(async () => { throw new Error('Connection refused'); });
    const service = new AntigravityAgentService({ catId: 'antigravity', cdpClient });
    const messages = await collect(service.invoke('test'));

    assert.equal(messages.length, 2);
    assert.equal(messages[0].type, 'error');
    assert.ok(messages[0].error.includes('Connection refused'));
    assert.equal(messages[1].type, 'done');
  });

  test('yields error + done when poll returns null (timeout)', async () => {
    const cdpClient = createMockCdpClient({ response: null });
    const service = new AntigravityAgentService({ catId: 'antigravity', cdpClient });
    const messages = await collect(service.invoke('test'));

    assert.equal(messages.length, 2);
    assert.equal(messages[0].type, 'error');
    assert.ok(messages[0].error.includes('timeout'));
    assert.equal(messages[1].type, 'done');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && pnpm build && node --test test/antigravity-agent-service.test.js`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// packages/api/src/domains/cats/services/agents/providers/AntigravityAgentService.ts
import { type CatId, createCatId } from '@cat-cafe/shared';
import { getCatModel } from '../../../../../config/cat-models.js';
import type { AgentMessage, AgentService, AgentServiceOptions, MessageMetadata } from '../../types.js';
import { AntigravityCdpClient } from './antigravity/AntigravityCdpClient.js';

export interface AntigravityAgentServiceOptions {
  catId?: CatId;
  model?: string;
  cdpPort?: number;
  /** Inject mock CDP client for testing */
  cdpClient?: AntigravityCdpClient | {
    connected: boolean;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    sendMessage(text: string): Promise<void>;
    pollResponse(timeoutMs?: number): Promise<string | null>;
    newConversation(): Promise<void>;
  };
}

export class AntigravityAgentService implements AgentService {
  readonly catId: CatId;
  private readonly model: string;
  private readonly cdpClient: AntigravityCdpClient | AntigravityAgentServiceOptions['cdpClient'];

  constructor(options?: AntigravityAgentServiceOptions) {
    this.catId = options?.catId ?? createCatId('antigravity');
    this.model = options?.model ?? getCatModel(this.catId as string);
    this.cdpClient = options?.cdpClient ?? new AntigravityCdpClient({ port: options?.cdpPort });
  }

  async *invoke(prompt: string, _options?: AgentServiceOptions): AsyncIterable<AgentMessage> {
    const metadata: MessageMetadata = { provider: 'antigravity', model: this.model };

    try {
      const client = this.cdpClient!;

      // Connect to Antigravity
      if (!client.connected) {
        await client.connect();
      }

      // Start fresh conversation for each invocation
      await client.newConversation();

      // Send the message
      await client.sendMessage(prompt);

      // Poll for response
      const response = await client.pollResponse(60_000);

      if (response === null) {
        yield {
          type: 'error', catId: this.catId,
          error: 'Antigravity response timeout — 60s 内未收到回复',
          metadata, timestamp: Date.now(),
        };
        yield { type: 'done', catId: this.catId, metadata, timestamp: Date.now() };
        return;
      }

      yield {
        type: 'text', catId: this.catId,
        content: response,
        metadata, timestamp: Date.now(),
      };
      yield { type: 'done', catId: this.catId, metadata, timestamp: Date.now() };
    } catch (err) {
      yield {
        type: 'error', catId: this.catId,
        error: err instanceof Error ? err.message : String(err),
        metadata, timestamp: Date.now(),
      };
      yield { type: 'done', catId: this.catId, metadata, timestamp: Date.now() };
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/api && pnpm build && node --test test/antigravity-agent-service.test.js`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/agents/providers/AntigravityAgentService.ts \
       packages/api/test/antigravity-agent-service.test.js
git commit -m "feat(F061): AntigravityAgentService — AgentService 接口实现 + mock CDP 测试"
```

---

## Task 3: Provider 注册 — config + routing

**Files:**
- Modify: `packages/api/src/config/cat-config-loader.ts:58` — 添加 `'antigravity'` 到 provider enum
- Modify: `packages/api/src/index.ts:204-220` — 添加 switch case
- Modify: `cat-config.json` — 将 `available: false` → `available: true`（仅 `antigravity-gemini` variant）
- Test: `packages/api/test/antigravity-registration.test.js`

**Step 1: Write the failing test**

```javascript
// packages/api/test/antigravity-registration.test.js
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Antigravity provider registration', () => {
  test('cat-config-loader accepts antigravity provider', async () => {
    // Import and validate that 'antigravity' is a valid provider
    const { loadCatConfig } = await import('../dist/config/cat-config-loader.js');
    const config = loadCatConfig();
    const bengal = config.breeds.bengal;
    assert.ok(bengal, 'bengal breed should exist');
    assert.ok(bengal.variants.length > 0, 'bengal should have variants');
    assert.equal(bengal.variants[0].provider, 'antigravity');
  });

  test('AntigravityAgentService is importable', async () => {
    const mod = await import('../dist/domains/cats/services/agents/providers/AntigravityAgentService.js');
    assert.ok(mod.AntigravityAgentService, 'should export AntigravityAgentService');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && pnpm build && node --test test/antigravity-registration.test.js`
Expected: FAIL — Zod validation rejects `'antigravity'` as provider

**Step 3: Apply edits**

In `packages/api/src/config/cat-config-loader.ts` line 58:
```typescript
// Before:
provider: z.enum(['anthropic', 'openai', 'google', 'dare']),
// After:
provider: z.enum(['anthropic', 'openai', 'google', 'dare', 'antigravity']),
```

In `packages/api/src/index.ts` add import + switch case:
```typescript
// Add import:
import { AntigravityAgentService } from './domains/cats/services/agents/providers/AntigravityAgentService.js';

// Add case before default:
      case 'antigravity':
        service = new AntigravityAgentService({ catId });
        break;
```

**Step 4: Run test to verify it passes**

Run: `cd packages/api && pnpm build && node --test test/antigravity-registration.test.js`
Expected: PASS (2 tests)

**Step 5: Run full test suite**

Run: `cd packages/api && pnpm build && node --test test/*.test.js`
Expected: All existing tests still pass + 3 new test files pass

**Step 6: Commit**

```bash
git add packages/api/src/config/cat-config-loader.ts \
       packages/api/src/index.ts \
       packages/api/test/antigravity-registration.test.js
git commit -m "feat(F061): provider 注册 — antigravity enum + switch case + AgentRouter 可路由"
```

---

## Task 4: 集成冒烟测试（需要 Antigravity 运行）

**Files:**
- Create: `packages/api/test/antigravity-smoke.test.js`

**前置条件:** Antigravity IDE 正在运行，CDP 端口 9000 已开启

**Step 1: Write smoke test**

```javascript
// packages/api/test/antigravity-smoke.test.js
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

// Skip if Antigravity is not running
async function isAntigravityRunning() {
  try {
    const resp = await fetch('http://localhost:9000/json/version', { signal: AbortSignal.timeout(2000) });
    const data = await resp.json();
    return data['User-Agent']?.includes('Antigravity');
  } catch { return false; }
}

describe('Antigravity smoke test', { skip: !(await isAntigravityRunning()) && 'Antigravity not running on port 9000' }, () => {
  test('CDP connect → send → receive round trip', async () => {
    const { AntigravityCdpClient } = await import(
      '../dist/domains/cats/services/agents/providers/antigravity/AntigravityCdpClient.js'
    );
    const client = new AntigravityCdpClient({ port: 9000 });
    await client.connect();
    assert.equal(client.connected, true);

    await client.newConversation();
    await client.sendMessage('Reply with just the word "pong"');
    const response = await client.pollResponse(30_000);

    assert.ok(response, 'should receive a response');
    assert.ok(response.toLowerCase().includes('pong') || response.includes('pong'),
      `response should contain "pong", got: ${response}`);

    await client.disconnect();
  });

  test('AntigravityAgentService invoke yields text + done', async () => {
    const { AntigravityAgentService } = await import(
      '../dist/domains/cats/services/agents/providers/AntigravityAgentService.js'
    );
    const service = new AntigravityAgentService({ catId: 'antigravity', cdpPort: 9000 });
    const messages = [];
    for await (const msg of service.invoke('Reply with just "meow"')) {
      messages.push(msg);
    }

    assert.ok(messages.length >= 2, 'should have at least text + done');
    const textMsg = messages.find(m => m.type === 'text');
    assert.ok(textMsg, 'should have a text message');
    assert.ok(textMsg.content, 'text message should have content');
    assert.equal(messages[messages.length - 1].type, 'done');
  });
});
```

**Step 2: Run smoke test**

Run: `cd packages/api && pnpm build && node --test test/antigravity-smoke.test.js`
Expected: PASS if Antigravity running, SKIP if not

**Step 3: Commit**

```bash
git add packages/api/test/antigravity-smoke.test.js
git commit -m "test(F061): Antigravity 冒烟测试 — CDP round trip + AgentService invoke"
```

---

## Task 5: 质量检查 + spec 状态更新

**Step 1: Run full build + lint**

```bash
pnpm check && pnpm lint && pnpm --filter @cat-cafe/api test
```

**Step 2: Update F061 spec — AC 状态**

Mark AC-4 (cat-config registration), AC-5 (AgentService), AC-6 (AgentRouter routing) as done.

**Step 3: Commit spec update**

```bash
git add docs/features/F061-antigravity-bengal-cat.md
git commit -m "docs(F061): Phase 1 AC-4/5/6 验证通过"
```

---

## Summary

| Task | 内容 | 测试 | AC |
|------|------|------|-----|
| 1 | CDP Client (连接/注入/读取) | 2 unit tests (pure) | AC-1 |
| 2 | AgentService (invoke 流) | 3 unit tests (mock CDP) | AC-5 |
| 3 | Provider 注册 (enum + switch) | 2 tests | AC-4, AC-6 |
| 4 | 冒烟测试 (real CDP) | 2 smoke tests | AC-5, AC-6 |
| 5 | 质量检查 + spec 更新 | full suite | — |

**Total new files:** 4 (2 src + 2 test) + 2 smoke test
**Total modified files:** 2 (cat-config-loader.ts, index.ts)
**Estimated new tests:** 9
