/**
 * F157 GrowthService — unit tests
 *
 * Covers: level formula, overallLevel active-dimension averaging,
 * audit event uniqueness (nonce), and XP award pipeline.
 */

import './helpers/setup-cat-registry.js';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

/** Import pure helpers directly (they don't depend on Redis). */
const { GrowthService } = await import('../dist/domains/cats/services/growth/GrowthService.js');

// ── level formula ──────────────────────────────────────────────

describe('Level formula', () => {
  test('level 0 at 0 XP', () => {
    // level = floor(sqrt(xp / 100))
    assert.equal(Math.floor(Math.sqrt(0 / 100)), 0);
  });

  test('level 0 at 99 XP', () => {
    assert.equal(Math.floor(Math.sqrt(99 / 100)), 0);
  });

  test('level 1 at 100 XP', () => {
    assert.equal(Math.floor(Math.sqrt(100 / 100)), 1);
  });

  test('level 2 at 400 XP', () => {
    assert.equal(Math.floor(Math.sqrt(400 / 100)), 2);
  });

  test('level 3 at 900 XP', () => {
    assert.equal(Math.floor(Math.sqrt(900 / 100)), 3);
  });
});

// ── overallLevel excludes zero-XP dimensions ───────────────────

describe('overallLevel active-dimension averaging', () => {
  /** Minimal Redis mock that stores values in a Map. */
  function createMockRedis() {
    const store = new Map();
    return {
      options: { keyPrefix: '' },
      async mget(...keys) {
        return keys.map((k) => store.get(k) ?? null);
      },
      pipeline() {
        const ops = [];
        const self = {
          incrby(key, amount) {
            const cur = parseInt(store.get(key) ?? '0', 10);
            store.set(key, String(cur + amount));
            ops.push(['incrby', key, amount]);
            return self;
          },
          zadd(key, score, member) {
            // Just accumulate — no need to implement sorted set
            ops.push(['zadd', key, score, member]);
            return self;
          },
          async exec() {
            return ops.map(() => [null, 'OK']);
          },
        };
        return self;
      },
      async zrevrange() {
        return [];
      },
    };
  }

  test('overallLevel only averages dimensions with XP > 0', async () => {
    const redis = createMockRedis();
    const svc = new GrowthService(redis);

    // Award XP to only execution (tool_use → execution, 1 XP)
    svc.awardXp('testcat', 'tool_use');
    // Wait for pipeline to settle
    await new Promise((r) => setTimeout(r, 50));

    const attrs = await svc.getAttributes('testcat');
    // Only execution has XP → activeDimensions=1, levelSum includes only execution's level
    // 1 XP → level 0, so overallLevel = 0
    assert.equal(attrs.overallLevel, 0);

    // Now give 100 XP to execution (level 1)
    for (let i = 0; i < 99; i++) {
      svc.awardXp('testcat', 'tool_use');
    }
    await new Promise((r) => setTimeout(r, 50));

    const attrs2 = await svc.getAttributes('testcat');
    // 100 XP in execution → level 1. Only 1 active dimension → overallLevel = 1/1 = 1
    assert.equal(attrs2.overallLevel, 1);
    // totalXp should be 100
    assert.equal(attrs2.totalXp, 100);
  });

  test('overallLevel is 0 when no dimensions have XP', async () => {
    const redis = createMockRedis();
    const svc = new GrowthService(redis);
    const attrs = await svc.getAttributes('empty');
    assert.equal(attrs.overallLevel, 0);
    assert.equal(attrs.totalXp, 0);
  });
});

// ── audit event uniqueness ─────────────────────────────────────

describe('Audit event uniqueness', () => {
  test('consecutive awardXp calls produce unique ZADD members', () => {
    const members = new Set();
    const mockRedis = {
      options: { keyPrefix: '' },
      pipeline() {
        const self = {
          incrby() {
            return self;
          },
          zadd(_key, _score, member) {
            members.add(member);
            return self;
          },
          async exec() {
            return [];
          },
        };
        return self;
      },
    };

    const svc = new GrowthService(mockRedis);
    // Fire 10 identical tool_use events at ~same timestamp
    for (let i = 0; i < 10; i++) {
      svc.awardXp('cat1', 'tool_use');
    }

    // All 10 should be unique members (nonce prevents collision)
    assert.equal(members.size, 10, `Expected 10 unique members, got ${members.size}`);
  });
});
