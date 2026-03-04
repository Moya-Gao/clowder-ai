# F050 Phase 1: DARE L1 CLI 接入 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Cat Café 能通过 CLI adapter 驱动 DARE agent 完成单轮 headless 任务，验证端到端事件流。

**Architecture:** 新增 `DareAgentService`（复用 `spawnCli` + 新 `dare-event-transform` 映射层），扩展 `CatProvider` 类型为 `'dare'`，在 `cat-config.json` 注册 DARE 猫。Phase 1 使用 `--auto-approve --headless` 模式，不需要 stdin 控制面。

**Tech Stack:** TypeScript, Node.js child_process, NDJSON, DARE CLI (Python), OpenRouter

---

## Task 1: Extend CatProvider type to include 'dare'

**Files:**
- Modify: `packages/shared/src/types/cat.ts:12`
- Test: `packages/api/test/cat-config-loader.test.js` (existing tests should still pass)

**Step 1: Modify the CatProvider type**

```typescript
// packages/shared/src/types/cat.ts:12
export type CatProvider = 'anthropic' | 'openai' | 'google' | 'dare';
```

**Step 2: Rebuild shared package**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f050-dare-l1 && pnpm --filter @cat-cafe/shared build`
Expected: Clean build, no errors

**Step 3: Run existing cat-config-loader tests**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f050-dare-l1/packages/api && node --test test/cat-config-loader.test.js`
Expected: All existing tests PASS (type widening is backward-compatible)

**Step 4: Commit**

```bash
git add packages/shared/src/types/cat.ts
git commit -m "feat(F050): extend CatProvider type to include 'dare'"
```

---

## Task 2: Update cat-config-loader zod schema for 'dare' provider

**Files:**
- Modify: `packages/api/src/config/cat-config-loader.ts:57`
- Test: `packages/api/test/cat-config-loader.test.js`

**Step 1: Write failing test — dare provider accepted by zod**

Add to `test/cat-config-loader.test.js`:

```javascript
test('loadCatConfig accepts dare provider', (t) => {
  const configWithDare = structuredClone(validConfig);
  // Add a DARE variant to the first breed (or add new breed)
  configWithDare.breeds.push({
    id: 'dare-test',
    catId: 'dare-agent',
    name: 'DARE Test',
    displayName: 'DARE',
    avatar: '/avatars/dare.png',
    color: { primary: '#FF6B35', secondary: '#FFE0D0' },
    mentionPatterns: ['@dare-agent'],
    roleDescription: 'External DARE agent',
    defaultVariantId: 'dare-default',
    variants: [{
      id: 'dare-default',
      provider: 'dare',
      defaultModel: 'zhipu/glm-4.7',
      mcpSupport: false,
      cli: { command: 'python', outputFormat: 'headless-json', defaultArgs: ['-m', 'client'] },
    }],
  });
  const tmp = writeTempConfig(configWithDare);
  const loaded = loadCatConfig(tmp);
  const cats = toAllCatConfigs(loaded);
  assert.ok(cats['dare-agent']);
  assert.strictEqual(cats['dare-agent'].provider, 'dare');
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f050-dare-l1/packages/api && node --test test/cat-config-loader.test.js -f "accepts dare provider"`
Expected: FAIL — zod rejects `'dare'` because enum is `['anthropic', 'openai', 'google']`

**Step 3: Update zod schema**

```typescript
// packages/api/src/config/cat-config-loader.ts:57
provider: z.enum(['anthropic', 'openai', 'google', 'dare']),
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f050-dare-l1/packages/api && node --test test/cat-config-loader.test.js`
Expected: ALL tests PASS (including new one)

**Step 5: Commit**

```bash
git add packages/api/src/config/cat-config-loader.ts packages/api/test/cat-config-loader.test.js
git commit -m "feat(F050): accept 'dare' provider in cat-config zod schema"
```

---

## Task 3: DARE event transformer

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/dare-event-transform.ts`
- Create: `packages/api/test/dare-event-transform.test.js`

**Step 1: Write failing tests for DARE headless envelope → AgentMessage mapping**

Create `test/dare-event-transform.test.js`:

```javascript
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { transformDareEvent } from '../src/domains/cats/services/agents/providers/dare-event-transform.js';

const catId = 'dare-agent';

describe('transformDareEvent', () => {
  test('maps session.start → session_init', () => {
    const event = {
      schema_version: 'client-headless-event-envelope.v1',
      ts: 1709500000.0,
      session_id: 'abc123',
      run_id: 'run-1',
      seq: 1,
      event: 'session.start',
      data: { task: 'hello' },
    };
    const result = transformDareEvent(event, catId);
    assert.ok(result);
    assert.strictEqual(result.type, 'session_init');
    assert.strictEqual(result.sessionId, 'abc123');
    assert.strictEqual(result.catId, catId);
  });

  test('maps message.text → text', () => {
    const event = {
      schema_version: 'client-headless-event-envelope.v1',
      ts: 1709500001.0,
      session_id: 'abc123',
      run_id: 'run-1',
      seq: 2,
      event: 'message.text',
      data: { content: 'Hello from DARE!' },
    };
    const result = transformDareEvent(event, catId);
    assert.ok(result);
    assert.strictEqual(result.type, 'text');
    assert.strictEqual(result.content, 'Hello from DARE!');
  });

  test('maps task.completed → done', () => {
    const event = {
      schema_version: 'client-headless-event-envelope.v1',
      ts: 1709500002.0,
      session_id: 'abc123',
      run_id: 'run-1',
      seq: 10,
      event: 'task.completed',
      data: { status: 'completed' },
    };
    const result = transformDareEvent(event, catId);
    assert.ok(result);
    assert.strictEqual(result.type, 'done');
  });

  test('maps task.failed → error', () => {
    const event = {
      schema_version: 'client-headless-event-envelope.v1',
      ts: 1709500003.0,
      session_id: 'abc123',
      run_id: 'run-1',
      seq: 11,
      event: 'task.failed',
      data: { reason: 'approval_timeout', message: 'Timed out' },
    };
    const result = transformDareEvent(event, catId);
    assert.ok(result);
    assert.strictEqual(result.type, 'error');
    assert.ok(result.error?.includes('Timed out'));
  });

  test('maps tool.started → tool_use', () => {
    const event = {
      schema_version: 'client-headless-event-envelope.v1',
      ts: 1709500004.0,
      session_id: 'abc123',
      run_id: 'run-1',
      seq: 5,
      event: 'tool.started',
      data: { tool_name: 'read_file', tool_input: { path: '/tmp/test.txt' } },
    };
    const result = transformDareEvent(event, catId);
    assert.ok(result);
    assert.strictEqual(result.type, 'tool_use');
    assert.strictEqual(result.toolName, 'read_file');
  });

  test('maps tool.completed → tool_result', () => {
    const event = {
      schema_version: 'client-headless-event-envelope.v1',
      ts: 1709500005.0,
      session_id: 'abc123',
      run_id: 'run-1',
      seq: 6,
      event: 'tool.completed',
      data: { tool_name: 'read_file', output: 'file contents here' },
    };
    const result = transformDareEvent(event, catId);
    assert.ok(result);
    assert.strictEqual(result.type, 'tool_result');
    assert.ok(result.content?.includes('file contents here'));
  });

  test('returns null for unknown event types', () => {
    const event = {
      schema_version: 'client-headless-event-envelope.v1',
      ts: 1709500006.0,
      session_id: 'abc123',
      run_id: 'run-1',
      seq: 99,
      event: 'internal.debug',
      data: {},
    };
    const result = transformDareEvent(event, catId);
    assert.strictEqual(result, null);
  });

  test('returns null for non-object input', () => {
    assert.strictEqual(transformDareEvent('not an object', catId), null);
    assert.strictEqual(transformDareEvent(null, catId), null);
    assert.strictEqual(transformDareEvent(42, catId), null);
  });

  test('returns null for non-DARE envelope (missing schema_version)', () => {
    const event = { type: 'item.completed', data: {} };
    assert.strictEqual(transformDareEvent(event, catId), null);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f050-dare-l1/packages/api && pnpm run build && node --test test/dare-event-transform.test.js`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `packages/api/src/domains/cats/services/agents/providers/dare-event-transform.ts`:

```typescript
/**
 * DARE Event Transformer
 * DARE headless envelope → Cat Café AgentMessage 映射
 *
 * DARE headless envelope (client-headless-event-envelope.v1):
 *   { schema_version, ts, session_id, run_id, seq, event, data }
 *
 * Event mapping:
 *   session.start → session_init
 *   message.text  → text
 *   tool.started  → tool_use
 *   tool.completed → tool_result
 *   task.completed → done
 *   task.failed    → error
 */

import type { CatId } from '@cat-cafe/shared';
import type { AgentMessage } from '../../types.js';

const DARE_SCHEMA = 'client-headless-event-envelope.v1';

interface DareEnvelope {
  schema_version: string;
  ts: number;
  session_id: string;
  run_id: string;
  seq: number;
  event: string;
  data: Record<string, unknown>;
}

function isDareEnvelope(event: unknown): event is DareEnvelope {
  if (typeof event !== 'object' || event === null) return false;
  const e = event as Record<string, unknown>;
  return e['schema_version'] === DARE_SCHEMA && typeof e['event'] === 'string';
}

export function transformDareEvent(
  event: unknown,
  catId: CatId | string,
): AgentMessage | null {
  if (!isDareEnvelope(event)) return null;

  const ts = typeof event.ts === 'number' ? event.ts * 1000 : Date.now();
  const data = event.data ?? {};

  switch (event.event) {
    case 'session.start':
      return {
        type: 'session_init',
        catId: catId as CatId,
        sessionId: event.session_id,
        timestamp: ts,
      };

    case 'message.text':
      return {
        type: 'text',
        catId: catId as CatId,
        content: typeof data['content'] === 'string' ? data['content'] : '',
        timestamp: ts,
      };

    case 'tool.started':
      return {
        type: 'tool_use',
        catId: catId as CatId,
        toolName: typeof data['tool_name'] === 'string' ? data['tool_name'] : 'unknown',
        toolInput: typeof data['tool_input'] === 'object' ? data['tool_input'] as Record<string, unknown> : undefined,
        timestamp: ts,
      };

    case 'tool.completed':
      return {
        type: 'tool_result',
        catId: catId as CatId,
        toolName: typeof data['tool_name'] === 'string' ? data['tool_name'] : undefined,
        content: typeof data['output'] === 'string' ? data['output'] : JSON.stringify(data['output'] ?? ''),
        timestamp: ts,
      };

    case 'task.completed':
      return {
        type: 'done',
        catId: catId as CatId,
        timestamp: ts,
      };

    case 'task.failed':
      return {
        type: 'error',
        catId: catId as CatId,
        error: typeof data['message'] === 'string'
          ? data['message']
          : `DARE task failed: ${typeof data['reason'] === 'string' ? data['reason'] : 'unknown'}`,
        timestamp: ts,
      };

    default:
      return null;
  }
}
```

**Step 4: Build and run tests**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f050-dare-l1/packages/api && pnpm run build && node --test test/dare-event-transform.test.js`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/agents/providers/dare-event-transform.ts packages/api/test/dare-event-transform.test.js
git commit -m "feat(F050): DARE headless event → AgentMessage transformer"
```

---

## Task 4: DareAgentService

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/DareAgentService.ts`
- Create: `packages/api/test/dare-agent-service.test.js`

**Step 1: Write failing tests**

Create `test/dare-agent-service.test.js` (follows `codex-agent-service.test.js` mock pattern):

```javascript
import { describe, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import { DareAgentService } from '../src/domains/cats/services/agents/providers/DareAgentService.js';

function createMockProcess() {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const emitter = new EventEmitter();
  const proc = {
    stdout, stderr, pid: 54321,
    kill: mock.fn(() => {
      process.nextTick(() => {
        if (!stdout.destroyed) stdout.end();
        emitter.emit('exit', 0, null);
      });
      return true;
    }),
    on: (event, listener) => { emitter.on(event, listener); return proc; },
    once: (event, listener) => { emitter.once(event, listener); return proc; },
    _emitter: emitter,
  };
  return proc;
}

function emitDareEvents(proc, events) {
  for (const event of events) {
    proc.stdout.write(JSON.stringify(event) + '\n');
  }
  proc.stdout.end();
  process.nextTick(() => proc._emitter.emit('exit', 0, null));
}

async function collect(iterable) {
  const messages = [];
  for await (const msg of iterable) messages.push(msg);
  return messages;
}

const DARE_SESSION_START = {
  schema_version: 'client-headless-event-envelope.v1',
  ts: 1709500000.0, session_id: 'dare-sess-1', run_id: 'run-1', seq: 1,
  event: 'session.start', data: { task: 'test' },
};
const DARE_TEXT = {
  schema_version: 'client-headless-event-envelope.v1',
  ts: 1709500001.0, session_id: 'dare-sess-1', run_id: 'run-1', seq: 2,
  event: 'message.text', data: { content: 'Hello from DARE' },
};
const DARE_TASK_COMPLETED = {
  schema_version: 'client-headless-event-envelope.v1',
  ts: 1709500002.0, session_id: 'dare-sess-1', run_id: 'run-1', seq: 3,
  event: 'task.completed', data: { status: 'completed' },
};

describe('DareAgentService', () => {
  test('yields session_init, text, done from headless events', async () => {
    const proc = createMockProcess();
    const spawnFn = mock.fn(() => proc);
    const service = new DareAgentService({ catId: 'dare-agent', spawnFn });
    const promise = collect(service.invoke('Say hello'));
    emitDareEvents(proc, [DARE_SESSION_START, DARE_TEXT, DARE_TASK_COMPLETED]);
    const messages = await promise;

    const types = messages.map((m) => m.type);
    assert.ok(types.includes('session_init'));
    assert.ok(types.includes('text'));
    assert.ok(types.includes('done'));

    const textMsg = messages.find((m) => m.type === 'text');
    assert.strictEqual(textMsg.content, 'Hello from DARE');
    assert.strictEqual(textMsg.catId, 'dare-agent');
  });

  test('passes correct CLI args for headless run', async () => {
    const proc = createMockProcess();
    const spawnFn = mock.fn(() => proc);
    const service = new DareAgentService({ catId: 'dare-agent', spawnFn, darePath: '/path/to/dare' });
    const promise = collect(service.invoke('Test prompt'));
    emitDareEvents(proc, [DARE_SESSION_START, DARE_TASK_COMPLETED]);
    await promise;

    const call = spawnFn.mock.calls[0];
    const command = call.arguments[0];
    const args = call.arguments[1];
    assert.strictEqual(command, 'python');
    assert.ok(args.includes('-m'));
    assert.ok(args.includes('client'));
    assert.ok(args.includes('--headless'));
    assert.ok(args.includes('--auto-approve'));
  });

  test('passes workingDirectory as cwd', async () => {
    const proc = createMockProcess();
    const spawnFn = mock.fn(() => proc);
    const service = new DareAgentService({ catId: 'dare-agent', spawnFn });
    const promise = collect(service.invoke('Test', { workingDirectory: '/tmp/project' }));
    emitDareEvents(proc, [DARE_SESSION_START, DARE_TASK_COMPLETED]);
    await promise;

    const call = spawnFn.mock.calls[0];
    const opts = call.arguments[2];
    assert.strictEqual(opts.cwd, '/tmp/project');
  });

  test('sets OPENROUTER env vars when adapter is openrouter', async () => {
    const proc = createMockProcess();
    const spawnFn = mock.fn(() => proc);
    const service = new DareAgentService({
      catId: 'dare-agent', spawnFn,
      adapter: 'openrouter', model: 'zhipu/glm-4.7',
    });
    const promise = collect(service.invoke('Test'));
    emitDareEvents(proc, [DARE_SESSION_START, DARE_TASK_COMPLETED]);
    await promise;

    const call = spawnFn.mock.calls[0];
    const args = call.arguments[1];
    assert.ok(args.includes('--adapter'));
    assert.ok(args.includes('openrouter'));
    assert.ok(args.includes('--model'));
    assert.ok(args.includes('zhipu/glm-4.7'));
  });

  test('yields error on task.failed event', async () => {
    const proc = createMockProcess();
    const spawnFn = mock.fn(() => proc);
    const service = new DareAgentService({ catId: 'dare-agent', spawnFn });
    const failEvent = {
      schema_version: 'client-headless-event-envelope.v1',
      ts: 1709500003.0, session_id: 'dare-sess-1', run_id: 'run-1', seq: 3,
      event: 'task.failed', data: { reason: 'approval_timeout', message: 'Approval timed out' },
    };
    const promise = collect(service.invoke('Test'));
    emitDareEvents(proc, [DARE_SESSION_START, failEvent]);
    const messages = await promise;

    const errorMsg = messages.find((m) => m.type === 'error');
    assert.ok(errorMsg);
    assert.ok(errorMsg.error.includes('Approval timed out'));
  });

  test('yields error + done on CLI error (spawn failure)', async () => {
    const proc = createMockProcess();
    const spawnFn = mock.fn(() => proc);
    const service = new DareAgentService({ catId: 'dare-agent', spawnFn });
    const promise = collect(service.invoke('Test'));
    proc.stdout.end();
    process.nextTick(() => proc._emitter.emit('exit', 1, null));
    const messages = await promise;

    const types = messages.map((m) => m.type);
    assert.ok(types.includes('error'));
    assert.ok(types.includes('done'));
  });

  test('metadata includes provider and model', async () => {
    const proc = createMockProcess();
    const spawnFn = mock.fn(() => proc);
    const service = new DareAgentService({
      catId: 'dare-agent', spawnFn,
      adapter: 'openrouter', model: 'zhipu/glm-4.7',
    });
    const promise = collect(service.invoke('Test'));
    emitDareEvents(proc, [DARE_SESSION_START, DARE_TEXT, DARE_TASK_COMPLETED]);
    const messages = await promise;

    const textMsg = messages.find((m) => m.type === 'text');
    assert.ok(textMsg.metadata);
    assert.strictEqual(textMsg.metadata.provider, 'dare');
    assert.strictEqual(textMsg.metadata.model, 'zhipu/glm-4.7');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f050-dare-l1/packages/api && pnpm run build && node --test test/dare-agent-service.test.js`
Expected: FAIL — module not found

**Step 3: Write DareAgentService implementation**

Create `packages/api/src/domains/cats/services/agents/providers/DareAgentService.ts`:

```typescript
/**
 * DARE Agent Service
 * 通过 DARE CLI 子进程调用外部 DARE agent（headless 模式）
 *
 * CLI 调用方式:
 *   python -m client --adapter openrouter --model MODEL --api-key KEY \
 *     run --task "prompt" --auto-approve --headless
 *
 * NDJSON 事件格式 (headless envelope v1):
 *   session.start    → session_init
 *   message.text     → text
 *   tool.started     → tool_use
 *   tool.completed   → tool_result
 *   task.completed   → done (via transformer, plus service yields final done)
 *   task.failed      → error
 */

import { createCatId, type CatId } from '@cat-cafe/shared';
import { spawnCli, isCliError, isCliTimeout } from '../../../../../utils/cli-spawn.js';
import { formatCliExitError } from '../../../../../utils/cli-format.js';
import type { SpawnFn } from '../../../../../utils/cli-types.js';
import { transformDareEvent } from './dare-event-transform.js';
import type {
  AgentMessage,
  AgentService,
  AgentServiceOptions,
  MessageMetadata,
} from '../../types.js';

interface DareAgentServiceOptions {
  catId?: CatId;
  /** DARE adapter: 'openrouter' | 'openai' (default: 'openrouter') */
  adapter?: string;
  /** Model name (e.g. 'zhipu/glm-4.7') */
  model?: string;
  /** Path to DARE repo (for python -m client) */
  darePath?: string;
  /** Inject a custom spawn function (for testing) */
  spawnFn?: SpawnFn;
}

export class DareAgentService implements AgentService {
  readonly catId: CatId;
  private readonly adapter: string;
  private readonly model: string;
  private readonly darePath: string | undefined;
  private readonly spawnFn: SpawnFn | undefined;

  constructor(options?: DareAgentServiceOptions) {
    this.catId = options?.catId ?? createCatId('dare-agent');
    this.adapter = options?.adapter ?? 'openrouter';
    this.model = options?.model ?? (process.env['DARE_MODEL'] ?? 'qwen/qwen3-coder:free');
    this.darePath = options?.darePath ?? process.env['DARE_PATH'];
    this.spawnFn = options?.spawnFn;
  }

  async *invoke(
    prompt: string,
    options?: AgentServiceOptions,
  ): AsyncIterable<AgentMessage> {
    const args = this.buildArgs(prompt);
    const env = this.buildEnv(options?.callbackEnv);
    const metadata: MessageMetadata = { provider: 'dare', model: this.model };

    try {
      const events = spawnCli(
        {
          command: 'python',
          args,
          ...(options?.workingDirectory ? { cwd: options.workingDirectory } : this.darePath ? { cwd: this.darePath } : {}),
          env,
          ...(options?.signal ? { signal: options.signal } : {}),
        },
        this.spawnFn ? { spawnFn: this.spawnFn } : undefined,
      );

      for await (const event of events) {
        if (isCliTimeout(event)) {
          yield {
            type: 'error',
            catId: this.catId,
            error: `DARE CLI 响应超时 (${Math.round(event.timeoutMs / 1000)}s)`,
            metadata,
            timestamp: Date.now(),
          };
          continue;
        }
        if (isCliError(event)) {
          yield {
            type: 'error',
            catId: this.catId,
            error: formatCliExitError('DARE CLI', event),
            metadata,
            timestamp: Date.now(),
          };
          continue;
        }

        const result = transformDareEvent(event, this.catId);
        if (result !== null) {
          if (result.type === 'session_init' && result.sessionId) {
            metadata.sessionId = result.sessionId;
          }
          yield { ...result, metadata };
        }
      }

      yield { type: 'done', catId: this.catId, metadata, timestamp: Date.now() };
    } catch (err) {
      yield {
        type: 'error',
        catId: this.catId,
        error: err instanceof Error ? err.message : String(err),
        metadata,
        timestamp: Date.now(),
      };
      yield { type: 'done', catId: this.catId, metadata, timestamp: Date.now() };
    }
  }

  private buildArgs(prompt: string): string[] {
    const args = ['-m', 'client'];

    args.push('--adapter', this.adapter);
    args.push('--model', this.model);

    // API key from env (DARE CLI also reads env, but explicit is safer)
    const apiKeyEnvName = this.adapter === 'openrouter' ? 'OPENROUTER_API_KEY' : 'OPENAI_API_KEY';
    const apiKey = process.env[apiKeyEnvName];
    if (apiKey) {
      args.push('--api-key', apiKey);
    }

    args.push('run', '--task', prompt, '--auto-approve', '--headless');

    return args;
  }

  private buildEnv(callbackEnv?: Record<string, string>): Record<string, string | null> {
    return callbackEnv ?? {};
  }
}
```

**Step 4: Build and run tests**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f050-dare-l1/packages/api && pnpm run build && node --test test/dare-agent-service.test.js`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/agents/providers/DareAgentService.ts packages/api/test/dare-agent-service.test.js
git commit -m "feat(F050): DareAgentService — CLI adapter for DARE headless mode"
```

---

## Task 5: Provider registration + cat-config entry

**Files:**
- Modify: `packages/api/src/index.ts` (add `'dare'` case to switch)
- Modify: `cat-config.json` (add DARE breed)
- Test: existing startup tests still pass

**Step 1: Add 'dare' case to provider switch in index.ts**

In the switch block at `packages/api/src/index.ts` (~line 170), add:

```typescript
case 'dare':
  service = new DareAgentService({ catId });
  break;
```

Add import at top:

```typescript
import { DareAgentService } from './domains/cats/services/agents/providers/DareAgentService.js';
```

**Step 2: Add DARE breed to cat-config.json**

Add a new breed entry at the end of the `breeds` array:

```json
{
  "id": "dare",
  "catId": "dare-agent",
  "name": "DARE Agent",
  "displayName": "DARE",
  "avatar": "/avatars/dare.png",
  "color": { "primary": "#FF6B35", "secondary": "#FFE0D0" },
  "mentionPatterns": ["@dare-agent", "@dare"],
  "roleDescription": "External DARE agent (Deterministic Agent Runtime Engine)",
  "defaultVariantId": "dare-default",
  "variants": [
    {
      "id": "dare-default",
      "provider": "dare",
      "defaultModel": "zhipu/glm-4.7",
      "mcpSupport": false,
      "cli": {
        "command": "python",
        "outputFormat": "headless-json",
        "defaultArgs": ["-m", "client"]
      }
    }
  ]
}
```

Also add DARE to `roster` section:

```json
"dare-agent": {
  "family": "dare",
  "roles": ["coding"],
  "lead": true,
  "available": true,
  "evaluation": "experimental"
}
```

**Step 3: Build and verify startup**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f050-dare-l1/packages/api && pnpm run build`
Expected: Clean build

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f050-dare-l1/packages/api && node --test test/cat-config-loader.test.js`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add packages/api/src/index.ts cat-config.json
git commit -m "feat(F050): register DARE provider in AgentRegistry + cat-config"
```

---

## Task 6: Regression test — existing tests still green

**Files:** No new files — verification only

**Step 1: Run full non-Redis test suite**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f050-dare-l1/packages/api && node --test $(ls test/*.test.js | grep -v redis | grep -v concurrent-fault | tr '\n' ' ')`
Expected: ALL PASS (same count as baseline ± new tests)

**Step 2: Run type check**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f050-dare-l1 && pnpm lint`
Expected: Clean

**Step 3: Run biome check**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f050-dare-l1 && pnpm check`
Expected: Clean (or only pre-existing issues)

---

## Task 7: DARE smoke test (live — requires OpenRouter key)

**Files:**
- Create: `packages/api/test/dare-smoke.test.js` (skip when no API key)

**Step 1: Write conditional smoke test**

```javascript
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

const DARE_PATH = process.env['DARE_PATH'] ?? '/tmp/cat-cafe-reviews/Deterministic-Agent-Runtime-Engine';
const HAS_KEY = !!process.env['OPENROUTER_API_KEY'];

describe('DARE smoke tests', { skip: !HAS_KEY }, () => {
  test('DARE doctor command returns valid JSON', () => {
    const result = execSync(
      `python -m client --adapter openrouter --api-key dummy --output json doctor`,
      { cwd: DARE_PATH, timeout: 30_000, encoding: 'utf-8' },
    );
    // Doctor outputs JSON diagnostics
    assert.ok(result.trim().length > 0);
  });
});
```

**Step 2: Run smoke test**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f050-dare-l1/packages/api && DARE_PATH=/tmp/cat-cafe-reviews/Deterministic-Agent-Runtime-Engine node --test test/dare-smoke.test.js`
Expected: PASS (doctor doesn't need real API key)

**Step 3: Commit**

```bash
git add packages/api/test/dare-smoke.test.js
git commit -m "test(F050): DARE smoke test (doctor command)"
```

---

## Post-Plan Summary

| Task | What | New tests |
|------|------|-----------|
| 1 | CatProvider type + 'dare' | 0 (type-only) |
| 2 | Zod schema accepts 'dare' | 1 |
| 3 | dare-event-transform.ts | ~9 |
| 4 | DareAgentService.ts | ~7 |
| 5 | Provider registration + config | 0 (integration) |
| 6 | Regression verification | 0 |
| 7 | DARE smoke test | 1 |

**Total new tests: ~18**

After Phase 1, Cat Café can spawn a DARE agent, parse its headless JSON events, and yield them as `AgentMessage`. The DARE cat appears in cat-config and is routable via `@dare-agent`.

**Not in Phase 1 (deferred):**
- stdin pipe for `--control-stdin`（Phase 1b, when runtime MCP injection needed）
- DARE session resume (needs DARE-side stable resume protocol)
- A2A protocol adapter (Phase 3)
