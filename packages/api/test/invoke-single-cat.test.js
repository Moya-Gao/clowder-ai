/**
 * invoke-single-cat Tests
 * P1 fix: audit should emit CAT_ERROR when error was yielded during stream
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

async function collect(iterable) {
  const msgs = [];
  for await (const msg of iterable) msgs.push(msg);
  return msgs;
}

// Shared temp dir — singleton EventAuditLog only initializes once
let tempDir;
let invokeSingleCat;

describe('invokeSingleCat audit events (P1 fix)', () => {
  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cat-audit-'));
    process.env['AUDIT_LOG_DIR'] = tempDir;
    // Dynamic import AFTER env is set — singleton will use this dir
    const mod = await import('../dist/domains/cats/services/invoke-single-cat.js');
    invokeSingleCat = mod.invokeSingleCat;
  });

  function makeDeps() {
    let counter = 0;
    return {
      registry: {
        create: () => ({ invocationId: `inv-${++counter}`, callbackToken: `tok-${counter}` }),
        verify: () => null,
      },
      sessionManager: {
        get: async () => undefined,
        getOrCreate: async () => ({}),
        store: async () => {},
        delete: async () => {},
        resolveWorkingDirectory: () => '/tmp/test',
      },
      threadStore: null,
      apiUrl: 'http://127.0.0.1:3002',
    };
  }

  it('emits CAT_ERROR audit when service yields error before done', async () => {
    const errorService = {
      async *invoke() {
        yield { type: 'error', catId: 'codex', error: 'CLI 异常退出 (code: 1)', timestamp: Date.now() };
        yield { type: 'done', catId: 'codex', timestamp: Date.now() };
      },
    };

    const msgs = await collect(invokeSingleCat(makeDeps(), {
      catId: 'codex',
      service: errorService,
      prompt: 'test',
      userId: 'user1',
      threadId: 'thread-error',
      isLastCat: true,
    }));

    assert.ok(msgs.some(m => m.type === 'error'), 'error should be yielded');
    assert.ok(msgs.some(m => m.type === 'done'), 'done should be yielded');

    // Wait for fire-and-forget audit writes
    await new Promise(r => setTimeout(r, 150));

    const files = await readdir(tempDir);
    const auditContent = await readFile(join(tempDir, files[0]), 'utf-8');
    const events = auditContent.trim().split('\n').map(l => JSON.parse(l));
    const threadEvents = events.filter(e => e.threadId === 'thread-error');

    const responded = threadEvents.filter(e => e.type === 'cat_responded');
    const catError = threadEvents.filter(e => e.type === 'cat_error');

    assert.equal(responded.length, 0, 'should NOT have cat_responded when errors occurred');
    assert.ok(catError.length > 0, 'should have cat_error event');
    assert.ok(catError[0].data.error.includes('CLI'), 'cat_error should contain error message');
  });

  it('emits CAT_RESPONDED audit when service yields text + done (no errors)', async () => {
    const normalService = {
      async *invoke() {
        yield { type: 'text', catId: 'opus', content: 'hello', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      },
    };

    await collect(invokeSingleCat(makeDeps(), {
      catId: 'opus',
      service: normalService,
      prompt: 'test',
      userId: 'user1',
      threadId: 'thread-normal',
      isLastCat: true,
    }));

    await new Promise(r => setTimeout(r, 150));

    const files = await readdir(tempDir);
    const auditContent = await readFile(join(tempDir, files[0]), 'utf-8');
    const events = auditContent.trim().split('\n').map(l => JSON.parse(l));
    const threadEvents = events.filter(e => e.threadId === 'thread-normal');

    const responded = threadEvents.filter(e => e.type === 'cat_responded');
    const catError = threadEvents.filter(e => e.type === 'cat_error');

    assert.ok(responded.length > 0, 'should have cat_responded for normal path');
    assert.equal(catError.length, 0, 'should NOT have cat_error for normal path');
  });

  it('F8: yields invocation_usage system_info when done has metadata.usage', async () => {
    const usageService = {
      async *invoke() {
        yield { type: 'text', catId: 'opus', content: 'answer', timestamp: Date.now() };
        yield {
          type: 'done',
          catId: 'opus',
          timestamp: Date.now(),
          metadata: {
            provider: 'anthropic',
            model: 'opus',
            usage: { inputTokens: 1000, outputTokens: 500, costUsd: 0.03 },
          },
        };
      },
    };

    const msgs = await collect(invokeSingleCat(makeDeps(), {
      catId: 'opus',
      service: usageService,
      prompt: 'test',
      userId: 'user1',
      threadId: 'thread-usage',
      isLastCat: true,
    }));

    const usageInfos = msgs.filter(m => {
      if (m.type !== 'system_info') return false;
      try {
        const parsed = JSON.parse(m.content);
        return parsed.type === 'invocation_usage';
      } catch { return false; }
    });

    assert.equal(usageInfos.length, 1, 'should yield exactly one invocation_usage system_info');
    const payload = JSON.parse(usageInfos[0].content);
    assert.equal(payload.catId, 'opus');
    assert.equal(payload.usage.inputTokens, 1000);
    assert.equal(payload.usage.outputTokens, 500);
    assert.equal(payload.usage.costUsd, 0.03);
  });

  it('F8: does not yield invocation_usage when done has no usage', async () => {
    const noUsageService = {
      async *invoke() {
        yield { type: 'text', catId: 'opus', content: 'hello', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      },
    };

    const msgs = await collect(invokeSingleCat(makeDeps(), {
      catId: 'opus',
      service: noUsageService,
      prompt: 'test',
      userId: 'user1',
      threadId: 'thread-no-usage',
      isLastCat: true,
    }));

    const usageInfos = msgs.filter(m => {
      if (m.type !== 'system_info') return false;
      try {
        const parsed = JSON.parse(m.content);
        return parsed.type === 'invocation_usage';
      } catch { return false; }
    });

    assert.equal(usageInfos.length, 0, 'should not yield invocation_usage when no usage data');
  });

  it('F24: creates SessionRecord on session_init when sessionChainStore provided', async () => {
    const { SessionChainStore } = await import('../dist/domains/cats/services/SessionChainStore.js');
    const sessionChainStore = new SessionChainStore();

    const service = {
      async *invoke() {
        yield { type: 'session_init', catId: 'opus', sessionId: 'cli-sess-abc', timestamp: Date.now() };
        yield { type: 'text', catId: 'opus', content: 'hello', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      },
    };

    const deps = { ...makeDeps(), sessionChainStore };
    await collect(invokeSingleCat(deps, {
      catId: 'opus',
      service,
      prompt: 'test',
      userId: 'user1',
      threadId: 'thread-f24-init',
      isLastCat: true,
    }));

    const active = sessionChainStore.getActive('opus', 'thread-f24-init');
    assert.ok(active, 'should have created an active SessionRecord');
    assert.equal(active.cliSessionId, 'cli-sess-abc');
    assert.equal(active.catId, 'opus');
    assert.equal(active.threadId, 'thread-f24-init');
    assert.equal(active.status, 'active');
  });

  it('F24: updates cliSessionId when session_init arrives for existing active record', async () => {
    const { SessionChainStore } = await import('../dist/domains/cats/services/SessionChainStore.js');
    const sessionChainStore = new SessionChainStore();

    // Pre-create an active session with old cliSessionId
    sessionChainStore.create({
      cliSessionId: 'old-cli',
      threadId: 'thread-f24-update',
      catId: 'opus',
      userId: 'user1',
    });

    const service = {
      async *invoke() {
        yield { type: 'session_init', catId: 'opus', sessionId: 'new-cli', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      },
    };

    const deps = { ...makeDeps(), sessionChainStore };
    await collect(invokeSingleCat(deps, {
      catId: 'opus',
      service,
      prompt: 'test',
      userId: 'user1',
      threadId: 'thread-f24-update',
      isLastCat: true,
    }));

    const active = sessionChainStore.getActive('opus', 'thread-f24-update');
    assert.ok(active);
    assert.equal(active.cliSessionId, 'new-cli', 'should have updated cliSessionId');
  });

  it('F24: yields context_health system_info when done has usage with contextWindowSize', async () => {
    const { SessionChainStore } = await import('../dist/domains/cats/services/SessionChainStore.js');
    const sessionChainStore = new SessionChainStore();

    const service = {
      async *invoke() {
        yield { type: 'session_init', catId: 'opus', sessionId: 'cli-health', timestamp: Date.now() };
        yield { type: 'text', catId: 'opus', content: 'answer', timestamp: Date.now() };
        yield {
          type: 'done',
          catId: 'opus',
          timestamp: Date.now(),
          metadata: {
            provider: 'anthropic',
            model: 'claude-opus-4-6',
            usage: {
              inputTokens: 50000,
              outputTokens: 2000,
              contextWindowSize: 200000,
            },
          },
        };
      },
    };

    const deps = { ...makeDeps(), sessionChainStore };
    const msgs = await collect(invokeSingleCat(deps, {
      catId: 'opus',
      service,
      prompt: 'test',
      userId: 'user1',
      threadId: 'thread-f24-health',
      isLastCat: true,
    }));

    const healthInfos = msgs.filter(m => {
      if (m.type !== 'system_info') return false;
      try {
        const parsed = JSON.parse(m.content);
        return parsed.type === 'context_health';
      } catch { return false; }
    });

    assert.equal(healthInfos.length, 1, 'should yield exactly one context_health system_info');
    const payload = JSON.parse(healthInfos[0].content);
    assert.equal(payload.catId, 'opus');
    assert.equal(payload.health.usedTokens, 50000);
    assert.equal(payload.health.windowTokens, 200000);
    assert.equal(payload.health.source, 'exact');
    assert.ok(payload.health.fillRatio > 0 && payload.health.fillRatio <= 1);
  });

  it('F24: uses fallback window size for models without contextWindowSize', async () => {
    const { SessionChainStore } = await import('../dist/domains/cats/services/SessionChainStore.js');
    const sessionChainStore = new SessionChainStore();

    const service = {
      async *invoke() {
        yield { type: 'session_init', catId: 'opus', sessionId: 'cli-fallback', timestamp: Date.now() };
        yield {
          type: 'done',
          catId: 'opus',
          timestamp: Date.now(),
          metadata: {
            provider: 'anthropic',
            model: 'claude-opus-4-6',
            usage: {
              inputTokens: 100000,
              outputTokens: 1000,
              // no contextWindowSize — should use fallback
            },
          },
        };
      },
    };

    const deps = { ...makeDeps(), sessionChainStore };
    const msgs = await collect(invokeSingleCat(deps, {
      catId: 'opus',
      service,
      prompt: 'test',
      userId: 'user1',
      threadId: 'thread-f24-fallback',
      isLastCat: true,
    }));

    const healthInfos = msgs.filter(m => {
      if (m.type !== 'system_info') return false;
      try {
        return JSON.parse(m.content).type === 'context_health';
      } catch { return false; }
    });

    assert.equal(healthInfos.length, 1, 'should yield context_health with fallback window');
    const payload = JSON.parse(healthInfos[0].content);
    assert.equal(payload.health.windowTokens, 200000, 'should use fallback 200k for claude-opus-4-6');
    assert.equal(payload.health.source, 'approx', 'should mark as approx when using fallback');
  });

  it('F24: no context_health when model is unknown and no contextWindowSize', async () => {
    const service = {
      async *invoke() {
        yield {
          type: 'done',
          catId: 'opus',
          timestamp: Date.now(),
          metadata: {
            provider: 'unknown',
            model: 'totally-unknown-model',
            usage: {
              inputTokens: 5000,
              outputTokens: 500,
            },
          },
        };
      },
    };

    const { SessionChainStore } = await import('../dist/domains/cats/services/SessionChainStore.js');
    const deps = { ...makeDeps(), sessionChainStore: new SessionChainStore() };
    const msgs = await collect(invokeSingleCat(deps, {
      catId: 'opus',
      service,
      prompt: 'test',
      userId: 'user1',
      threadId: 'thread-f24-unknown',
      isLastCat: true,
    }));

    const healthInfos = msgs.filter(m => {
      if (m.type !== 'system_info') return false;
      try {
        return JSON.parse(m.content).type === 'context_health';
      } catch { return false; }
    });

    assert.equal(healthInfos.length, 0, 'should not yield context_health for unknown model without window');
  });

  it('F24: updates SessionRecord contextHealth on done', async () => {
    const { SessionChainStore } = await import('../dist/domains/cats/services/SessionChainStore.js');
    const sessionChainStore = new SessionChainStore();

    const service = {
      async *invoke() {
        yield { type: 'session_init', catId: 'opus', sessionId: 'cli-update-health', timestamp: Date.now() };
        yield {
          type: 'done',
          catId: 'opus',
          timestamp: Date.now(),
          metadata: {
            provider: 'anthropic',
            model: 'claude-opus-4-6',
            usage: {
              inputTokens: 140000,
              outputTokens: 3000,
              contextWindowSize: 200000,
            },
          },
        };
      },
    };

    const deps = { ...makeDeps(), sessionChainStore };
    await collect(invokeSingleCat(deps, {
      catId: 'opus',
      service,
      prompt: 'test',
      userId: 'user1',
      threadId: 'thread-f24-persist',
      isLastCat: true,
    }));

    const active = sessionChainStore.getActive('opus', 'thread-f24-persist');
    assert.ok(active, 'should still have active session');
    assert.ok(active.contextHealth, 'session record should have contextHealth');
    assert.equal(active.contextHealth.usedTokens, 140000);
    assert.equal(active.contextHealth.windowTokens, 200000);
    assert.equal(active.contextHealth.fillRatio, 0.7);
    assert.equal(active.contextHealth.source, 'exact');
  });

  it('F24-fix: prefers lastTurnInputTokens over aggregated inputTokens for context health', async () => {
    const { SessionChainStore } = await import('../dist/domains/cats/services/SessionChainStore.js');
    const sessionChainStore = new SessionChainStore();

    const service = {
      async *invoke() {
        yield { type: 'session_init', catId: 'opus', sessionId: 'cli-last-turn', timestamp: Date.now() };
        yield {
          type: 'done',
          catId: 'opus',
          timestamp: Date.now(),
          metadata: {
            provider: 'anthropic',
            model: 'claude-opus-4-6',
            usage: {
              inputTokens: 192000,          // aggregated across 5 turns (WRONG for context health)
              lastTurnInputTokens: 44000,   // last API call's actual input (CORRECT)
              outputTokens: 5000,
              contextWindowSize: 200000,
            },
          },
        };
      },
    };

    const deps = { ...makeDeps(), sessionChainStore };
    const msgs = await collect(invokeSingleCat(deps, {
      catId: 'opus',
      service,
      prompt: 'test',
      userId: 'user1',
      threadId: 'thread-f24-lastturn',
      isLastCat: true,
    }));

    const healthInfos = msgs.filter(m => {
      if (m.type !== 'system_info') return false;
      try {
        return JSON.parse(m.content).type === 'context_health';
      } catch { return false; }
    });

    assert.equal(healthInfos.length, 1);
    const payload = JSON.parse(healthInfos[0].content);
    // Should use lastTurnInputTokens (44000) not aggregated inputTokens (192000)
    assert.equal(payload.health.usedTokens, 44000,
      'context health should use lastTurnInputTokens, not aggregated inputTokens');
    assert.equal(payload.health.windowTokens, 200000);
    // fillRatio should be 44000/200000 = 0.22, not 192000/200000 = 0.96
    const expectedRatio = 44000 / 200000;
    assert.ok(Math.abs(payload.health.fillRatio - expectedRatio) < 0.001,
      `fillRatio should be ~${expectedRatio} (22%), got ${payload.health.fillRatio}`);
  });

  it('F24-fix: falls back to inputTokens when lastTurnInputTokens is absent', async () => {
    const service = {
      async *invoke() {
        yield {
          type: 'done',
          catId: 'opus',
          timestamp: Date.now(),
          metadata: {
            provider: 'anthropic',
            model: 'claude-opus-4-6',
            usage: {
              inputTokens: 50000,  // no lastTurnInputTokens
              outputTokens: 2000,
              contextWindowSize: 200000,
            },
          },
        };
      },
    };

    const deps = makeDeps();
    const msgs = await collect(invokeSingleCat(deps, {
      catId: 'opus',
      service,
      prompt: 'test',
      userId: 'user1',
      threadId: 'thread-f24-fallback',
      isLastCat: true,
    }));

    const healthInfos = msgs.filter(m => {
      if (m.type !== 'system_info') return false;
      try {
        return JSON.parse(m.content).type === 'context_health';
      } catch { return false; }
    });

    assert.equal(healthInfos.length, 1);
    const payload = JSON.parse(healthInfos[0].content);
    // Falls back to inputTokens since lastTurnInputTokens is absent
    assert.equal(payload.health.usedTokens, 50000,
      'should fall back to inputTokens when lastTurnInputTokens is absent');
  });

  it('session self-heal: retries once without --resume when Claude reports missing conversation', async () => {
    let invokeCount = 0;
    const sessionDeletes = [];
    const sessionStores = [];
    const optionsSeen = [];
    const service = {
      async *invoke(_prompt, options) {
        optionsSeen.push(options);
        invokeCount++;
        if (invokeCount === 1) {
          yield {
            type: 'error',
            catId: 'opus',
            error: 'No conversation found with session ID: bad-sess',
            timestamp: Date.now(),
          };
          yield { type: 'done', catId: 'opus', timestamp: Date.now() };
          return;
        }
        yield { type: 'session_init', catId: 'opus', sessionId: 'new-sess', timestamp: Date.now() };
        yield { type: 'text', catId: 'opus', content: 'recovered', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      },
    };

    const deps = makeDeps();
    deps.sessionManager = {
      get: async () => 'bad-sess',
      store: async (_u, _c, _t, sid) => { sessionStores.push(sid); },
      delete: async (u, c, t) => { sessionDeletes.push(`${u}:${c}:${t}`); },
    };

    const msgs = await collect(invokeSingleCat(deps, {
      catId: 'opus',
      service,
      prompt: 'test',
      userId: 'user-retry',
      threadId: 'thread-retry',
      isLastCat: true,
    }));

    assert.equal(invokeCount, 2, 'should re-invoke service once after stale session error');
    assert.equal(optionsSeen[0].sessionId, 'bad-sess', 'first attempt should include stored session');
    assert.equal(optionsSeen[1].sessionId, undefined, 'retry attempt should drop --resume session');
    assert.deepEqual(sessionDeletes, ['user-retry:opus:thread-retry'], 'should delete stale session before retry');
    assert.ok(msgs.some(m => m.type === 'text' && m.content === 'recovered'), 'should recover and stream retry result');
    assert.ok(msgs.some(m => m.type === 'session_init' && m.sessionId === 'new-sess'), 'should accept new session');
    assert.equal(msgs.some(m => m.type === 'error' && String(m.error).includes('No conversation found')), false,
      'stale-session bootstrap error should be suppressed when retry succeeds');
    assert.ok(sessionStores.includes('new-sess'), 'new session should be stored after recovery');
  });

  it('session self-heal: does not retry on non-session errors', async () => {
    let invokeCount = 0;
    const sessionDeletes = [];
    const service = {
      async *invoke() {
        invokeCount++;
        yield { type: 'error', catId: 'opus', error: 'upstream timeout', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      },
    };

    const deps = makeDeps();
    deps.sessionManager = {
      get: async () => 'sess-normal',
      store: async () => {},
      delete: async () => { sessionDeletes.push('deleted'); },
    };

    const msgs = await collect(invokeSingleCat(deps, {
      catId: 'opus',
      service,
      prompt: 'test',
      userId: 'user-no-retry',
      threadId: 'thread-no-retry',
      isLastCat: true,
    }));

    assert.equal(invokeCount, 1, 'non-session errors should not trigger retry');
    assert.equal(sessionDeletes.length, 0, 'non-session errors should not clear session');
    assert.ok(msgs.some(m => m.type === 'error' && String(m.error).includes('upstream timeout')));
  });

  it('transient CLI self-heal: retries once when Claude exits code 1 before any stream output', async () => {
    let invokeCount = 0;
    const service = {
      async *invoke() {
        invokeCount++;
        if (invokeCount === 1) {
          yield {
            type: 'error',
            catId: 'opus',
            error: 'Claude CLI: CLI 异常退出 (code: 1, signal: none)',
            timestamp: Date.now(),
          };
          yield { type: 'done', catId: 'opus', timestamp: Date.now() };
          return;
        }
        yield { type: 'text', catId: 'opus', content: 'retry-ok', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      },
    };

    const msgs = await collect(invokeSingleCat(makeDeps(), {
      catId: 'opus',
      service,
      prompt: 'test',
      userId: 'user-transient-retry',
      threadId: 'thread-transient-retry',
      isLastCat: true,
    }));

    assert.equal(invokeCount, 2, 'should retry once for transient code:1 exit');
    assert.ok(msgs.some((m) => m.type === 'text' && m.content === 'retry-ok'), 'retry result should be streamed');
    assert.equal(
      msgs.some((m) => m.type === 'error' && String(m.error).includes('CLI 异常退出')),
      false,
      'first-attempt transient CLI error should be suppressed when retry succeeds',
    );
  });

  it('transient CLI self-heal: does not retry when stream already produced text', async () => {
    let invokeCount = 0;
    const service = {
      async *invoke() {
        invokeCount++;
        yield { type: 'text', catId: 'opus', content: 'partial-output', timestamp: Date.now() };
        yield {
          type: 'error',
          catId: 'opus',
          error: 'Claude CLI: CLI 异常退出 (code: 1, signal: none)',
          timestamp: Date.now(),
        };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      },
    };

    const msgs = await collect(invokeSingleCat(makeDeps(), {
      catId: 'opus',
      service,
      prompt: 'test',
      userId: 'user-no-transient-retry',
      threadId: 'thread-no-transient-retry',
      isLastCat: true,
    }));

    assert.equal(invokeCount, 1, 'must not retry after partial output to avoid duplication');
    assert.ok(
      msgs.some((m) => m.type === 'error' && String(m.error).includes('CLI 异常退出')),
      'error should be preserved when partial output already streamed',
    );
  });

  it('session self-heal: retries at most once and surfaces error when retry still fails', async () => {
    let invokeCount = 0;
    const sessionDeletes = [];
    const service = {
      async *invoke() {
        invokeCount++;
        yield {
          type: 'error',
          catId: 'opus',
          error: 'No conversation found with session ID: still-bad',
          timestamp: Date.now(),
        };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      },
    };

    const deps = makeDeps();
    deps.sessionManager = {
      get: async () => 'stale-sess',
      store: async () => {},
      delete: async () => { sessionDeletes.push('deleted'); },
    };

    const msgs = await collect(invokeSingleCat(deps, {
      catId: 'opus',
      service,
      prompt: 'test',
      userId: 'user-still-failing',
      threadId: 'thread-still-failing',
      isLastCat: true,
    }));

    assert.equal(invokeCount, 2, 'should never retry more than once');
    assert.equal(sessionDeletes.length, 1, 'stale session should be cleared once before retry');
    assert.ok(
      msgs.some((m) => m.type === 'error' && String(m.error).includes('No conversation found')),
      'should surface session error if retry still fails',
    );
    assert.ok(msgs.some((m) => m.type === 'done'), 'should still emit done');
  });
});
