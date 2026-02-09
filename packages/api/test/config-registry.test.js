/**
 * ConfigRegistry Tests
 * 验证配置快照收集的正确性
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Save and restore env vars around tests
const savedEnv = {};
function setEnv(key, value) {
  savedEnv[key] = process.env[key];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
function restoreEnv() {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe('ConfigRegistry', () => {
  afterEach(() => restoreEnv());

  it('snapshot contains all 7 categories', async () => {
    const { collectConfigSnapshot } = await import('../dist/config/ConfigRegistry.js');
    const snapshot = collectConfigSnapshot();

    assert.ok(snapshot.context, 'has context');
    assert.ok(snapshot.cli, 'has cli');
    assert.ok(snapshot.storage, 'has storage');
    assert.ok(snapshot.upload, 'has upload');
    assert.ok(snapshot.server, 'has server');
    assert.ok(snapshot.cats, 'has cats');
    assert.ok(snapshot.a2a, 'has a2a');
  });

  it('uses default values when env vars are missing', async () => {
    setEnv('CONTEXT_HISTORY_LIMIT', undefined);
    setEnv('MAX_CONTEXT_MSG_CHARS', undefined);
    setEnv('MAX_PROMPT_CHARS', undefined);

    const { collectConfigSnapshot } = await import('../dist/config/ConfigRegistry.js');
    const snapshot = collectConfigSnapshot();

    assert.equal(snapshot.context.maxMessages, 20);
    assert.equal(snapshot.context.maxContentLength, 1500);
    assert.equal(snapshot.context.maxPromptChars, 32000);
    assert.equal(snapshot.context.maxTotalChars, 8000);
  });

  it('reads context env overrides', async () => {
    setEnv('CONTEXT_HISTORY_LIMIT', '50');
    setEnv('MAX_CONTEXT_MSG_CHARS', '3000');
    setEnv('MAX_PROMPT_CHARS', '64000');

    const { collectConfigSnapshot } = await import('../dist/config/ConfigRegistry.js');
    const snapshot = collectConfigSnapshot();

    assert.equal(snapshot.context.maxMessages, 50);
    assert.equal(snapshot.context.maxContentLength, 3000);
    assert.equal(snapshot.context.maxPromptChars, 64000);
  });

  it('shows redis=memory when REDIS_URL not set', async () => {
    setEnv('REDIS_URL', undefined);

    const { collectConfigSnapshot } = await import('../dist/config/ConfigRegistry.js');
    const snapshot = collectConfigSnapshot();

    assert.equal(snapshot.server.redis, 'memory');
  });

  it('shows redis=connected when REDIS_URL is set', async () => {
    setEnv('REDIS_URL', 'redis://localhost:6379');

    const { collectConfigSnapshot } = await import('../dist/config/ConfigRegistry.js');
    const snapshot = collectConfigSnapshot();

    assert.equal(snapshot.server.redis, 'connected');
  });

  it('populates cats from CAT_CONFIGS', async () => {
    const { collectConfigSnapshot } = await import('../dist/config/ConfigRegistry.js');
    const snapshot = collectConfigSnapshot();

    assert.ok(snapshot.cats.opus, 'has opus');
    assert.ok(snapshot.cats.opus.displayName, 'opus has displayName');
    assert.ok(snapshot.cats.opus.provider, 'opus has provider');
    assert.ok(snapshot.cats.opus.model, 'opus has model');
    assert.equal(typeof snapshot.cats.opus.mcpSupport, 'boolean', 'opus has mcpSupport');
  });

  it('reads MAX_A2A_DEPTH from env', async () => {
    setEnv('MAX_A2A_DEPTH', '5');

    const { collectConfigSnapshot } = await import('../dist/config/ConfigRegistry.js');
    const snapshot = collectConfigSnapshot();

    assert.equal(snapshot.a2a.maxDepth, 5);
  });

  it('defaults a2a.maxDepth to 2', async () => {
    setEnv('MAX_A2A_DEPTH', undefined);

    const { collectConfigSnapshot } = await import('../dist/config/ConfigRegistry.js');
    const snapshot = collectConfigSnapshot();

    assert.equal(snapshot.a2a.maxDepth, 2);
    assert.equal(snapshot.a2a.enabled, true);
  });

  it('has perCatBudgets for all three cats', async () => {
    const { collectConfigSnapshot } = await import('../dist/config/ConfigRegistry.js');
    const snapshot = collectConfigSnapshot();

    assert.ok(snapshot.perCatBudgets, 'has perCatBudgets');
    assert.ok(snapshot.perCatBudgets.opus, 'has opus budget');
    assert.ok(snapshot.perCatBudgets.codex, 'has codex budget');
    assert.ok(snapshot.perCatBudgets.gemini, 'has gemini budget');
  });

  it('perCatBudgets contains all budget fields', async () => {
    const { collectConfigSnapshot } = await import('../dist/config/ConfigRegistry.js');
    const snapshot = collectConfigSnapshot();

    const opusBudget = snapshot.perCatBudgets.opus;
    assert.ok(opusBudget.maxPromptChars > 0, 'opus has maxPromptChars');
    assert.ok(opusBudget.maxContextChars > 0, 'opus has maxContextChars');
    assert.ok(opusBudget.maxMessages > 0, 'opus has maxMessages');
    assert.ok(opusBudget.maxContentLengthPerMsg > 0, 'opus has maxContentLengthPerMsg');
  });

  it('context section has deprecation note', async () => {
    const { collectConfigSnapshot } = await import('../dist/config/ConfigRegistry.js');
    const snapshot = collectConfigSnapshot();

    assert.ok(snapshot.context.note, 'context has note');
    assert.ok(snapshot.context.note.includes('perCatBudgets'), 'note mentions perCatBudgets');
  });

  it('perCatBudgets reflects different budgets per cat', async () => {
    const { collectConfigSnapshot } = await import('../dist/config/ConfigRegistry.js');
    const snapshot = collectConfigSnapshot();

    // codex has lower budget than opus (80k vs 150k)
    assert.ok(
      snapshot.perCatBudgets.codex.maxPromptChars < snapshot.perCatBudgets.opus.maxPromptChars,
      'codex should have lower maxPromptChars than opus'
    );
  });

  it('has memory section (F3-lite)', async () => {
    const { collectConfigSnapshot } = await import('../dist/config/ConfigRegistry.js');
    const snapshot = collectConfigSnapshot();

    assert.ok(snapshot.memory, 'has memory section');
    assert.equal(snapshot.memory.enabled, true);
    assert.equal(snapshot.memory.maxKeysPerThread, 50);
  });

  it('has governance section (4-D-lite)', async () => {
    const { collectConfigSnapshot } = await import('../dist/config/ConfigRegistry.js');
    const snapshot = collectConfigSnapshot();

    assert.ok(snapshot.governance, 'has governance section');
    assert.equal(snapshot.governance.degradationEnabled, true);
    assert.equal(snapshot.governance.doneTimeoutMs, 5 * 60 * 1000);
    assert.equal(snapshot.governance.heartbeatIntervalMs, 30000);
  });

  it('has deliberate section (4-E)', async () => {
    const { collectConfigSnapshot } = await import('../dist/config/ConfigRegistry.js');
    const snapshot = collectConfigSnapshot();

    assert.ok(snapshot.deliberate, 'has deliberate section');
    assert.equal(snapshot.deliberate.status, 'types_only');
  });

  it('snapshot contains all 12 categories (Phase 5.1)', async () => {
    const { collectConfigSnapshot } = await import('../dist/config/ConfigRegistry.js');
    const snapshot = collectConfigSnapshot();

    const categories = ['context', 'perCatBudgets', 'cli', 'storage', 'upload', 'server', 'cats', 'a2a', 'memory', 'governance', 'deliberate', 'hindsight'];
    for (const cat of categories) {
      assert.ok(snapshot[cat], `has ${cat}`);
    }
  });

  it('has hindsight section with correct defaults', async () => {
    setEnv('HINDSIGHT_URL', undefined);

    const { collectConfigSnapshot } = await import('../dist/config/ConfigRegistry.js');
    const snapshot = collectConfigSnapshot();

    assert.ok(snapshot.hindsight, 'has hindsight section');
    assert.equal(snapshot.hindsight.enabled, true);
    assert.equal(snapshot.hindsight.baseUrl, 'http://localhost:8888');
    assert.equal(snapshot.hindsight.sharedBank, 'cat-cafe-shared');
  });

  it('hindsight recallDefaults are correct', async () => {
    const { collectConfigSnapshot } = await import('../dist/config/ConfigRegistry.js');
    const snapshot = collectConfigSnapshot();

    const rd = snapshot.hindsight.recallDefaults;
    assert.equal(rd.budget, 'mid');
    assert.equal(rd.tagsMatch, 'all_strict');
    assert.equal(rd.limit, 5);
  });

  it('hindsight retainPolicy and reflect are correct', async () => {
    const { collectConfigSnapshot } = await import('../dist/config/ConfigRegistry.js');
    const snapshot = collectConfigSnapshot();

    assert.equal(snapshot.hindsight.retainPolicy.narrativeFactRequired, true);
    assert.equal(snapshot.hindsight.retainPolicy.minUsefulHorizonDays, 180);
    assert.equal(snapshot.hindsight.reflect.dispositionMode, 'template_only');
  });

  it('reads HINDSIGHT_URL from env', async () => {
    setEnv('HINDSIGHT_URL', 'http://custom-host:9999');

    const { collectConfigSnapshot } = await import('../dist/config/ConfigRegistry.js');
    const snapshot = collectConfigSnapshot();

    assert.equal(snapshot.hindsight.baseUrl, 'http://custom-host:9999');
  });
});
