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

const TEST_OPENAI_TEXT = `
使用情况面板
5 小时使用限额
97% 剩余
重置时间：23:10
每周使用限额
99% 剩余
重置时间：2026年3月9日 19:10
GPT-5.3-Codex-Spark 5 小时使用限额
100% 剩余
GPT-5.3-Codex-Spark 每周使用限额
93% 剩余
代码审查
56% 剩余
`;

const TEST_CLAUDE_TEXT = `
Current session
7% used
Resets 10am (America/Los_Angeles)
Current week (all models)
54% used
Resets Mar 5 at 7pm (America/Los_Angeles)
Current week (Sonnet only)
3% used
Resets Mar 5 at 7pm (America/Los_Angeles)
`;

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

describe('official page parsers', () => {
  it('parses OpenAI codex usage page into usageItems', async () => {
    const { parseCodexUsageFromPageText } = await import('../dist/routes/quota.js');
    const items = parseCodexUsageFromPageText(TEST_OPENAI_TEXT);
    assert.equal(items.length, 5);
    assert.deepEqual(
      items.map((x) => [x.label, x.usedPercent]),
      [
        ['GPT-5.3-Codex-Spark 5小时使用限额', 100],
        ['GPT-5.3-Codex-Spark 每周使用限额', 93],
        ['5小时使用限额', 97],
        ['每周使用限额', 99],
        ['代码审查', 56],
      ],
    );
    assert.ok(items.every((x) => x.percentKind === 'remaining'));
  });

  it('parses Claude usage page into usageItems', async () => {
    const { parseClaudeUsageFromPageText } = await import('../dist/routes/quota.js');
    const items = parseClaudeUsageFromPageText(TEST_CLAUDE_TEXT);
    assert.equal(items.length, 3);
    assert.deepEqual(
      items.map((x) => [x.label, x.usedPercent]),
      [
        ['Current session', 7],
        ['Current week (all models)', 54],
        ['Current week (Sonnet only)', 3],
      ],
    );
  });

  it('does not duplicate base rows when page only contains Spark limits', async () => {
    const { parseCodexUsageFromPageText } = await import('../dist/routes/quota.js');
    const items = parseCodexUsageFromPageText(`
GPT-5.3-Codex-Spark 5 小时使用限额
100% 剩余
GPT-5.3-Codex-Spark 每周使用限额
93% 剩余
    `);
    assert.deepEqual(
      items.map((x) => x.label),
      ['GPT-5.3-Codex-Spark 5小时使用限额', 'GPT-5.3-Codex-Spark 每周使用限额'],
    );
  });

  it('parses English Spark quota labels without creating base phantom rows', async () => {
    const { parseCodexUsageFromPageText } = await import('../dist/routes/quota.js');
    const items = parseCodexUsageFromPageText(`
GPT-5.3-Codex-Spark 5 hour usage limit
100% remaining
GPT-5.3-Codex-Spark weekly usage limit
93% remaining
    `);
    assert.deepEqual(
      items.map((x) => x.label),
      ['GPT-5.3-Codex-Spark 5小时使用限额', 'GPT-5.3-Codex-Spark 每周使用限额'],
    );
    assert.deepEqual(
      items.map((x) => x.usedPercent),
      [100, 93],
    );
  });

  it('parses hyphenated English Spark 5-hour label', async () => {
    const { parseCodexUsageFromPageText } = await import('../dist/routes/quota.js');
    const items = parseCodexUsageFromPageText(`
GPT-5.3-Codex-Spark 5-hour usage limit
99% remaining
GPT-5.3-Codex-Spark weekly usage limit
93% remaining
    `);
    assert.deepEqual(
      items.map((x) => [x.label, x.usedPercent]),
      [
        ['GPT-5.3-Codex-Spark 5小时使用限额', 99],
        ['GPT-5.3-Codex-Spark 每周使用限额', 93],
      ],
    );
  });

  it('accepts Chinese all-models label in Claude usage parser', async () => {
    const { parseClaudeUsageFromPageText } = await import('../dist/routes/quota.js');
    const items = parseClaudeUsageFromPageText(`
当前会话
7% used
本周（所有模型）
54% used
本周（仅 Sonnet）
3% used
    `);
    assert.equal(items.length, 3);
    assert.deepEqual(
      items.map((x) => [x.label, x.usedPercent]),
      [
        ['Current session', 7],
        ['Current week (all models)', 54],
        ['Current week (Sonnet only)', 3],
      ],
    );
  });
});

describe('POST /api/quota/refresh/official', () => {
  it('returns 400 when CDP URL env is not configured', async () => {
    const old = process.env.QUOTA_BROWSER_CDP_URL;
    delete process.env.QUOTA_BROWSER_CDP_URL;
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'POST', url: '/api/quota/refresh/official' });
      assert.equal(res.statusCode, 400);
      const body = res.json();
      assert.match(body.error, /QUOTA_BROWSER_CDP_URL/);
      const quota = (await app.inject({ method: 'GET', url: '/api/quota' })).json();
      assert.match(quota.codex.error, /QUOTA_BROWSER_CDP_URL/);
      assert.match(quota.claude.error, /QUOTA_BROWSER_CDP_URL/);
    } finally {
      if (old != null) process.env.QUOTA_BROWSER_CDP_URL = old;
      await app.close();
    }
  });

  it('returns 400 when CDP URL is not localhost/127.0.0.1', async () => {
    const old = process.env.QUOTA_BROWSER_CDP_URL;
    process.env.QUOTA_BROWSER_CDP_URL = 'http://192.168.1.8:9222';
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'POST', url: '/api/quota/refresh/official' });
      assert.equal(res.statusCode, 400);
      const body = res.json();
      assert.match(body.error, /localhost/);
      const quota = (await app.inject({ method: 'GET', url: '/api/quota' })).json();
      assert.match(quota.codex.error, /localhost/);
      assert.match(quota.claude.error, /localhost/);
    } finally {
      if (old != null) process.env.QUOTA_BROWSER_CDP_URL = old;
      await app.close();
    }
  });
});
