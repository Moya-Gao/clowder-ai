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
});
