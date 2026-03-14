/**
 * F118 Phase C — AC-C4: Resume Health Check + Auto-Seal
 *
 * When session chain has an active record with stale updatedAt (>30min),
 * auto-seal it and fall back to fresh session instead of resuming.
 */

import './helpers/setup-cat-registry.js';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

async function collect(iterable) {
  const msgs = [];
  for await (const msg of iterable) msgs.push(msg);
  return msgs;
}

let tempDir;
let invokeSingleCat;

describe('F118 resume health check (AC-C4)', () => {
  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cat-health-'));
    process.env.AUDIT_LOG_DIR = tempDir;
    const mod = await import('../dist/domains/cats/services/agents/invocation/invoke-single-cat.js');
    invokeSingleCat = mod.invokeSingleCat;
  });

  after(async () => {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  function makeDeps(overrides = {}) {
    let counter = 0;
    return {
      registry: {
        create: () => ({
          invocationId: `inv-${++counter}`,
          callbackToken: `tok-${counter}`,
        }),
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
      ...overrides,
    };
  }

  /** A minimal service that yields done immediately */
  function makeOkService() {
    return {
      async *invoke() {
        yield { type: 'text', catId: 'codex', content: 'ok', timestamp: Date.now() };
        yield { type: 'done', catId: 'codex', timestamp: Date.now() };
      },
    };
  }

  it('auto-seals stale active session and falls back to fresh', async () => {
    const sealCalls = [];
    const THIRTY_ONE_MIN_AGO = Date.now() - 31 * 60 * 1000;

    const deps = makeDeps({
      sessionChainStore: {
        getChain: async () => [
          {
            id: 'sess-stale',
            cliSessionId: 'cli-sess-stale',
            status: 'active',
            updatedAt: THIRTY_ONE_MIN_AGO,
            catId: 'codex',
            threadId: 'thread-health',
            userId: 'user1',
            seq: 0,
            messageCount: 5,
            createdAt: THIRTY_ONE_MIN_AGO - 60000,
          },
        ],
        updateRecord: async () => {},
      },
      sessionSealer: {
        requestSeal: async (args) => {
          sealCalls.push(args);
          return { accepted: true, status: 'sealing' };
        },
        finalize: async () => {},
      },
    });

    const msgs = await collect(
      invokeSingleCat(deps, {
        catId: 'codex',
        service: makeOkService(),
        prompt: 'test',
        userId: 'user1',
        threadId: 'thread-health',
        isLastCat: true,
      }),
    );

    // Should have auto-sealed the stale session
    assert.equal(sealCalls.length, 1, 'requestSeal should be called once');
    assert.equal(sealCalls[0].sessionId, 'sess-stale');
    assert.equal(sealCalls[0].reason, 'auto_health_check');

    // Should still complete successfully (fresh session)
    assert.ok(
      msgs.some((m) => m.type === 'done'),
      'should yield done message',
    );
  });

  it('allows resume for healthy (recent) active session', async () => {
    const sealCalls = [];
    const FIVE_MIN_AGO = Date.now() - 5 * 60 * 1000;

    const deps = makeDeps({
      sessionChainStore: {
        getChain: async () => [
          {
            id: 'sess-healthy',
            cliSessionId: 'cli-sess-healthy',
            status: 'active',
            updatedAt: FIVE_MIN_AGO,
            catId: 'codex',
            threadId: 'thread-healthy',
            userId: 'user1',
            seq: 0,
            messageCount: 3,
            createdAt: FIVE_MIN_AGO - 60000,
          },
        ],
        updateRecord: async () => {},
      },
      sessionSealer: {
        requestSeal: async (args) => {
          sealCalls.push(args);
          return { accepted: true, status: 'sealing' };
        },
        finalize: async () => {},
      },
    });

    const msgs = await collect(
      invokeSingleCat(deps, {
        catId: 'codex',
        service: makeOkService(),
        prompt: 'test',
        userId: 'user1',
        threadId: 'thread-healthy',
        isLastCat: true,
      }),
    );

    // Should NOT auto-seal — session is healthy
    assert.equal(sealCalls.length, 0, 'requestSeal should not be called for healthy session');

    // Should still complete
    assert.ok(
      msgs.some((m) => m.type === 'done'),
      'should yield done message',
    );
  });
});
