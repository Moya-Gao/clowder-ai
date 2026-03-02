/**
 * F051 — Real Quota Dashboard API tests
 *
 * Tests the /api/quota endpoint that returns cached quota data
 * from official sources (ccusage for Claude, browser for Codex).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

async function buildApp() {
  const Fastify = (await import('fastify')).default;
  const { quotaRoutes } = await import('../dist/routes/quota.js');
  const app = Fastify();
  await app.register(quotaRoutes);
  await app.ready();
  return app;
}

describe('GET /api/quota', () => {
  it('returns quota structure for all three platforms', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/api/quota' });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.claude.platform, 'claude');
      assert.equal(body.codex.platform, 'codex');
      assert.equal(body.antigravity.platform, 'antigravity');
      assert.ok(body.fetchedAt);
    } finally {
      await app.close();
    }
  });

  it('antigravity returns not-yet-implemented status', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/api/quota' });
      const body = res.json();
      assert.equal(body.antigravity.status, 'not-yet-implemented');
    } finally {
      await app.close();
    }
  });

  it('claude starts with lastChecked=null before any refresh', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/api/quota' });
      const body = res.json();
      assert.equal(body.claude.lastChecked, null);
    } finally {
      await app.close();
    }
  });

  it('codex starts with empty usageItems before any data push', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/api/quota' });
      const body = res.json();
      assert.deepEqual(body.codex.usageItems, []);
      assert.equal(body.codex.lastChecked, null);
    } finally {
      await app.close();
    }
  });
});

describe('PATCH /api/quota/codex — validation', () => {
  it('rejects payload without usageItems array', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/quota/codex',
        payload: { garbage: true },
      });
      assert.equal(res.statusCode, 400);
    } finally {
      await app.close();
    }
  });

  it('rejects usageItems with out-of-range percent', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/quota/codex',
        payload: {
          usageItems: [{ label: 'Week', usedPercent: 200 }],
        },
      });
      assert.equal(res.statusCode, 400);
    } finally {
      await app.close();
    }
  });

  it('rejects usageItems with empty label', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/quota/codex',
        payload: {
          usageItems: [{ label: '', usedPercent: 50 }],
        },
      });
      assert.equal(res.statusCode, 400);
    } finally {
      await app.close();
    }
  });
});

describe('PATCH /api/quota/codex — scrape failure reporting', () => {
  it('accepts error-only payload (no usageItems) and stores error', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/quota/codex',
        payload: {
          error: 'Browser scrape failed: page not loaded',
        },
      });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.codex.error, 'Browser scrape failed: page not loaded');
      assert.deepEqual(body.codex.usageItems, []);
    } finally {
      await app.close();
    }
  });

  it('codex error is visible on subsequent GET', async () => {
    const app = await buildApp();
    try {
      await app.inject({
        method: 'PATCH',
        url: '/api/quota/codex',
        payload: {
          error: 'Timeout waiting for usage table',
        },
      });
      const getRes = await app.inject({ method: 'GET', url: '/api/quota' });
      const body = getRes.json();
      assert.equal(body.codex.error, 'Timeout waiting for usage table');
    } finally {
      await app.close();
    }
  });
});

describe('PATCH /api/quota/codex — happy path', () => {
  it('stores pushed codex usage data and returns it on GET', async () => {
    const app = await buildApp();
    try {
      const patchRes = await app.inject({
        method: 'PATCH',
        url: '/api/quota/codex',
        payload: {
          usageItems: [{ label: 'Current week', usedPercent: 100, resetsAt: '2026-03-05T19:00:00Z' }],
        },
      });
      assert.equal(patchRes.statusCode, 200);

      const getRes = await app.inject({ method: 'GET', url: '/api/quota' });
      const body = getRes.json();
      assert.equal(body.codex.usageItems.length, 1);
      assert.equal(body.codex.usageItems[0].usedPercent, 100);
      assert.equal(body.codex.usageItems[0].label, 'Current week');
      assert.ok(body.codex.lastChecked);
    } finally {
      await app.close();
    }
  });
});
