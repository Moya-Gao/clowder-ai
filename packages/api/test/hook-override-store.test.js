/**
 * F237 PR3 — HookOverrideStore + HookRegistry override integration tests
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';

// ── FakeRedis with HASH + sorted set support ──

class FakeRedis {
  constructor() {
    this.kv = new Map();
    this.hashes = new Map(); // key → Map<field, value>
    this.sorted = new Map(); // key → Map<member, score>
    this.ttls = new Map();
  }

  async set(key, value, ...args) {
    this.kv.set(key, value);
    if (args[0] === 'EX' && typeof args[1] === 'number') {
      this.ttls.set(key, args[1]);
    }
    return 'OK';
  }

  async get(key) {
    return this.kv.get(key) ?? null;
  }

  async del(key) {
    const existed = this.kv.has(key) ? 1 : 0;
    this.kv.delete(key);
    return existed;
  }

  async hset(key, field, value) {
    const h = this.hashes.get(key) ?? new Map();
    h.set(field, value);
    this.hashes.set(key, h);
    return 1;
  }

  async hget(key, field) {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hgetall(key) {
    const h = this.hashes.get(key);
    if (!h || h.size === 0) return null;
    return Object.fromEntries(h.entries());
  }

  async hdel(key, field) {
    const h = this.hashes.get(key);
    if (!h) return 0;
    return h.delete(field) ? 1 : 0;
  }

  async zadd(key, score, member) {
    const s = this.sorted.get(key) ?? new Map();
    s.set(member, score);
    this.sorted.set(key, s);
    return 1;
  }

  async zrangebyscore(key, min, max, ...args) {
    const s = this.sorted.get(key);
    if (!s) return [];
    const minN = typeof min === 'number' ? min : 0;
    const maxN = max === '+inf' ? Infinity : Number(max);
    let entries = [...s.entries()].filter(([, score]) => score >= minN && score <= maxN).sort((a, b) => a[1] - b[1]);
    if (args[0] === 'LIMIT') {
      const offset = args[1] ?? 0;
      const count = args[2] ?? entries.length;
      entries = entries.slice(offset, offset + count);
    }
    return entries.map(([member]) => member);
  }
}

// ── Test manifest factories ──

function makeManifest(id, overrides = {}) {
  return {
    id,
    name: `Test ${id}`,
    stage: 'session-init',
    order: 100,
    version: 1,
    enabled: true,
    template: `${id.toLowerCase()}.md`,
    inputs: [],
    disableable: true,
    safetyTier: 'editable',
    transparencyTier: 'visible-by-default',
    governanceTier: 'immutable',
    ...overrides,
  };
}

// ── Tests ──

describe('HookOverrideStore', () => {
  /** @type {import('../dist/domains/prompt-hooks/HookOverrideStore.js').HookOverrideStore} */
  let store;
  let redis;

  beforeEach(async () => {
    redis = new FakeRedis();
    const mod = await import('../dist/domains/prompt-hooks/HookOverrideStore.js');
    store = new mod.HookOverrideStore(redis);
  });

  describe('enable/disable', () => {
    test('enable writes override and records event', async () => {
      const m = makeManifest('S1');
      await store.enable('S1', m, 'opus');

      const override = await store.getOverride('S1');
      assert.equal(override.hookId, 'S1');
      assert.equal(override.enabled, true);
      assert.equal(override.source, 'operator');
      assert.equal(override.updatedBy, 'opus');

      const events = await store.listEvents();
      assert.equal(events.length, 1);
      assert.equal(events[0].action, 'enable');
      assert.equal(events[0].hookId, 'S1');
    });

    test('disable writes override for disableable hook', async () => {
      const m = makeManifest('S2', { disableable: true });
      await store.disable('S2', m, 'codex');

      const override = await store.getOverride('S2');
      assert.equal(override.enabled, false);
      assert.equal(override.updatedBy, 'codex');
    });

    test('disable rejects non-disableable hook', async () => {
      const m = makeManifest('S1', { disableable: false });
      await assert.rejects(
        () => store.disable('S1', m, 'opus'),
        (err) => {
          assert.equal(err.name, 'OverrideGateError');
          assert.equal(err.gate, 'disableable');
          return true;
        },
      );
    });
  });

  describe('content override', () => {
    test('setContentOverride stores content and increments version', async () => {
      const m = makeManifest('D5', { safetyTier: 'editable' });
      await store.setContentOverride('D5', m, 'new content v1', 'opus');

      const o1 = await store.getOverride('D5');
      assert.equal(o1.contentOverride, 'new content v1');
      assert.equal(o1.contentVersion, 1);

      await store.setContentOverride('D5', m, 'new content v2', 'opus');
      const o2 = await store.getOverride('D5');
      assert.equal(o2.contentOverride, 'new content v2');
      assert.equal(o2.contentVersion, 2);
    });

    test('setContentOverride rejects readonly safetyTier', async () => {
      const m = makeManifest('S1', { safetyTier: 'readonly' });
      await assert.rejects(
        () => store.setContentOverride('S1', m, 'hack', 'opus'),
        (err) => err.gate === 'safetyTier' && err.manifestValue === 'readonly',
      );
    });

    test('setContentOverride rejects limited-edit with auto-eval source', async () => {
      const m = makeManifest('D8', { safetyTier: 'limited-edit' });
      await assert.rejects(
        () => store.setContentOverride('D8', m, 'new', 'system', { source: 'auto-eval' }),
        (err) => err.gate === 'safetyTier' && err.manifestValue === 'limited-edit',
      );
    });

    test('setContentOverride allows limited-edit with operator source', async () => {
      const m = makeManifest('D8', { safetyTier: 'limited-edit' });
      await store.setContentOverride('D8', m, 'fixed text', 'operator', { source: 'operator' });
      const o = await store.getOverride('D8');
      assert.equal(o.contentOverride, 'fixed text');
    });

    test('clearContentOverride removes content but keeps other override state', async () => {
      const m = makeManifest('D5', { safetyTier: 'editable' });
      await store.disable('D5', m, 'opus');
      await store.setContentOverride('D5', m, 'override text', 'opus');
      await store.clearContentOverride('D5', 'opus');

      const o = await store.getOverride('D5');
      assert.equal(o.enabled, false);
      assert.equal(o.contentOverride, undefined);
      assert.equal(o.contentVersion, undefined);
    });
  });

  describe('rollback', () => {
    test('rollback removes all override state for a hook', async () => {
      const m = makeManifest('D5');
      await store.disable('D5', m, 'opus');
      await store.setContentOverride('D5', m, 'override', 'opus');
      await store.rollback('D5', 'opus');

      const o = await store.getOverride('D5');
      assert.equal(o, null);
    });

    test('rollback records event', async () => {
      await store.rollback('D5', 'opus');
      const events = await store.listEvents();
      const rollbackEvent = events.find((e) => e.action === 'rollback');
      assert.ok(rollbackEvent);
      assert.equal(rollbackEvent.hookId, 'D5');
    });
  });

  describe('listOverrides + loadSnapshot', () => {
    test('listOverrides returns all overrides for workspace', async () => {
      const m1 = makeManifest('S1');
      const m2 = makeManifest('S2');
      await store.enable('S1', m1, 'opus');
      await store.disable('S2', m2, 'codex');

      const list = await store.listOverrides();
      assert.equal(list.length, 2);
      const ids = list.map((o) => o.hookId).sort();
      assert.deepEqual(ids, ['S1', 'S2']);
    });

    test('loadSnapshot returns ReadonlyMap keyed by hookId', async () => {
      const m = makeManifest('D5');
      await store.disable('D5', m, 'opus');
      const snapshot = await store.loadSnapshot();
      assert.equal(snapshot.size, 1);
      assert.equal(snapshot.get('D5').enabled, false);
    });
  });

  describe('per-workspace isolation', () => {
    test('overrides in different workspaces are independent', async () => {
      const m = makeManifest('S1');
      await store.enable('S1', m, 'opus', { workspaceId: 'ws-a' });
      await store.disable('S1', m, 'opus', { workspaceId: 'ws-b' });

      const oA = await store.getOverride('S1', 'ws-a');
      const oB = await store.getOverride('S1', 'ws-b');
      assert.equal(oA.enabled, true);
      assert.equal(oB.enabled, false);
    });
  });

  describe('event stream', () => {
    test('events are recorded with correct fields', async () => {
      const m = makeManifest('D5');
      await store.disable('D5', m, 'opus');
      await store.enable('D5', m, 'codex');

      const events = await store.listEvents();
      assert.equal(events.length, 2);
      assert.equal(events[0].action, 'disable');
      assert.equal(events[0].actorId, 'opus');
      assert.equal(events[1].action, 'enable');
      assert.equal(events[1].actorId, 'codex');
    });
  });
});

describe('HookRegistry override integration', () => {
  /** @type {import('../dist/domains/prompt-hooks/HookRegistry.js').HookRegistry} */
  let HookRegistry;

  beforeEach(async () => {
    const mod = await import('../dist/domains/prompt-hooks/HookRegistry.js');
    HookRegistry = mod.HookRegistry;
  });

  test('isEnabled returns manifest baseline when no overrides', async () => {
    const { mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = join(import.meta.dirname, '__fixtures__', 'override-test-1');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(join(dir, 's1'), { recursive: true });
    writeFileSync(
      join(dir, 's1', 'hook.yaml'),
      [
        'id: S1',
        'name: Test S1',
        'stage: session-init',
        'order: 100',
        'version: 3',
        'enabled: true',
        'template: s1.md',
        'inputs: []',
        'disableable: true',
        'safetyTier: editable',
        'transparencyTier: visible-by-default',
        'governanceTier: immutable',
      ].join('\n'),
    );
    writeFileSync(join(dir, 's1', 's1.md'), '<!-- S1 -->');

    const registry = new HookRegistry(dir);
    registry.scan();
    assert.equal(registry.isEnabled('S1'), true);
    assert.equal(registry.getActiveVersion('S1'), 3);
    assert.equal(registry.getDisabledBySource('S1'), 'manifest');
    assert.equal(registry.getContentOverride('S1'), undefined);

    rmSync(dir, { recursive: true, force: true });
  });

  test('override snapshot overrides manifest baseline', async () => {
    const { mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = join(import.meta.dirname, '__fixtures__', 'override-test-2');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(join(dir, 's1'), { recursive: true });
    writeFileSync(
      join(dir, 's1', 'hook.yaml'),
      [
        'id: S1',
        'name: Test S1',
        'stage: session-init',
        'order: 100',
        'version: 1',
        'enabled: true',
        'template: s1.md',
        'inputs: []',
        'disableable: true',
        'safetyTier: editable',
        'transparencyTier: visible-by-default',
        'governanceTier: immutable',
      ].join('\n'),
    );
    writeFileSync(join(dir, 's1', 's1.md'), '<!-- S1 -->');

    const registry = new HookRegistry(dir);
    registry.scan();

    // Set override: disable S1 via operator
    const snapshot = new Map();
    snapshot.set('S1', {
      hookId: 'S1',
      enabled: false,
      contentOverride: 'overridden content',
      contentVersion: 5,
      source: 'operator',
      updatedAt: Date.now(),
      updatedBy: 'opus',
    });
    registry.setOverrideSnapshot(snapshot);

    assert.equal(registry.isEnabled('S1'), false);
    assert.equal(registry.getActiveVersion('S1'), 5);
    assert.equal(registry.getDisabledBySource('S1'), 'operator');
    assert.equal(registry.getContentOverride('S1'), 'overridden content');

    // Clear overrides → back to manifest
    registry.clearOverrideSnapshot();
    assert.equal(registry.isEnabled('S1'), true);
    assert.equal(registry.getActiveVersion('S1'), 1);

    rmSync(dir, { recursive: true, force: true });
  });

  test('auto-eval source maps to correct disabledBy', async () => {
    const { mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = join(import.meta.dirname, '__fixtures__', 'override-test-3');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(join(dir, 'd5'), { recursive: true });
    writeFileSync(
      join(dir, 'd5', 'hook.yaml'),
      [
        'id: D5',
        'name: Test D5',
        'stage: per-turn',
        'order: 500',
        'version: 1',
        'enabled: true',
        'template: d5.md',
        'inputs: []',
        'disableable: true',
        'safetyTier: editable',
        'transparencyTier: visible-by-default',
        'governanceTier: auto-evolve',
      ].join('\n'),
    );
    writeFileSync(join(dir, 'd5', 'd5.md'), '<!-- D5 -->');

    const registry = new HookRegistry(dir);
    registry.scan();

    registry.setOverrideSnapshot(
      new Map([
        [
          'D5',
          {
            hookId: 'D5',
            enabled: false,
            source: 'auto-eval',
            updatedAt: Date.now(),
            updatedBy: 'system',
          },
        ],
      ]),
    );

    assert.equal(registry.getDisabledBySource('D5'), 'auto-eval');

    rmSync(dir, { recursive: true, force: true });
  });
});
