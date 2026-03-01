import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { accessSync, chmodSync, constants, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '..', '..', '..');
const settingsPath = resolve(repoRoot, '.claude', 'settings.json');
const taskHookScript = resolve(repoRoot, '.claude', 'hooks', 'check-subagent-model.sh');

function runTaskHook(toolInput, options = {}) {
  return spawnSync('bash', [taskHookScript], {
    input: JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Task',
      tool_input: toolInput,
    }),
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
  });
}

function parseHookDecision(stdout) {
  assert.ok(stdout.trim().length > 0, 'hook should emit JSON decision output');
  const parsed = JSON.parse(stdout);
  assert.equal(parsed?.hookSpecificOutput?.hookEventName, 'PreToolUse');
  return parsed.hookSpecificOutput;
}

describe('project-level Claude hook settings', () => {
  it('configures PreToolUse Task matcher to enforce model selection', () => {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    const preToolUse = settings?.hooks?.PreToolUse;

    assert.ok(Array.isArray(preToolUse), 'hooks.PreToolUse must be an array');

    const taskMatcher = preToolUse.find((entry) => entry?.matcher === 'Task');
    assert.ok(taskMatcher, 'missing PreToolUse matcher "Task" in project settings');

    const command = taskMatcher?.hooks?.[0]?.command;
    assert.equal(
      command,
      '"$CLAUDE_PROJECT_DIR"/.claude/hooks/check-subagent-model.sh',
      'Task matcher must call project-local check-subagent-model hook',
    );
  });

  it('ships project-local model guard hook script and keeps it executable', () => {
    accessSync(taskHookScript, constants.X_OK);
  });

  it('blocks Task call when model is missing', () => {
    const result = runTaskHook({ description: 'quick search' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const decision = parseHookDecision(result.stdout);
    assert.equal(decision.permissionDecision, 'deny');
    assert.match(decision.permissionDecisionReason, /model/i);
  });

  it('blocks Task call when model is null', () => {
    const result = runTaskHook({ description: 'quick search', model: null });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const decision = parseHookDecision(result.stdout);
    assert.equal(decision.permissionDecision, 'deny');
    assert.match(decision.permissionDecisionReason, /model/i);
  });

  it('allows Task call for sonnet model', () => {
    const result = runTaskHook({ description: 'quick search', model: 'sonnet' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const stdout = result.stdout.trim();
    if (stdout.length === 0) return;

    const decision = parseHookDecision(result.stdout);
    assert.notEqual(decision.permissionDecision, 'deny');
  });

  it('allows sonnet model even when python3 is unavailable', () => {
    const shimDir = mkdtempSync(join(tmpdir(), 'cat-cafe-no-python-'));
    const shimPath = join(shimDir, 'python3');

    try {
      writeFileSync(shimPath, '#!/usr/bin/env bash\nexit 127\n', 'utf8');
      chmodSync(shimPath, 0o755);

      const result = runTaskHook(
        { description: 'quick search', model: 'sonnet' },
        { env: { PATH: `${shimDir}:${process.env.PATH}` } },
      );

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const stdout = result.stdout.trim();
      if (stdout.length === 0) return;

      const decision = parseHookDecision(result.stdout);
      assert.notEqual(decision.permissionDecision, 'deny');
    } finally {
      rmSync(shimDir, { recursive: true, force: true });
    }
  });

  it('allows sonnet model when jq is unavailable (python fallback)', () => {
    const shimDir = mkdtempSync(join(tmpdir(), 'cat-cafe-no-jq-'));
    const jqShimPath = join(shimDir, 'jq');

    try {
      writeFileSync(jqShimPath, '#!/usr/bin/env bash\nexit 127\n', 'utf8');
      chmodSync(jqShimPath, 0o755);

      const result = runTaskHook(
        { description: 'quick search', model: 'sonnet' },
        { env: { PATH: `${shimDir}:${process.env.PATH}` } },
      );

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const stdout = result.stdout.trim();
      if (stdout.length === 0) return;

      const decision = parseHookDecision(result.stdout);
      assert.notEqual(decision.permissionDecision, 'deny');
    } finally {
      rmSync(shimDir, { recursive: true, force: true });
    }
  });

  it('returns ask decision when both jq and python3 are unavailable', () => {
    const shimDir = mkdtempSync(join(tmpdir(), 'cat-cafe-no-parser-'));
    const jqShimPath = join(shimDir, 'jq');
    const pyShimPath = join(shimDir, 'python3');

    try {
      writeFileSync(jqShimPath, '#!/usr/bin/env bash\nexit 127\n', 'utf8');
      writeFileSync(pyShimPath, '#!/usr/bin/env bash\nexit 127\n', 'utf8');
      chmodSync(jqShimPath, 0o755);
      chmodSync(pyShimPath, 0o755);

      const result = runTaskHook(
        { description: 'quick search', model: 'sonnet' },
        { env: { PATH: `${shimDir}:${process.env.PATH}` } },
      );

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const decision = parseHookDecision(result.stdout);
      assert.equal(decision.permissionDecision, 'ask');
      assert.match(decision.permissionDecisionReason, /jq|python3|解析/i);
    } finally {
      rmSync(shimDir, { recursive: true, force: true });
    }
  });

  it('warns but allows Task call for opus model', () => {
    const result = runTaskHook({ description: 'deep reasoning', model: 'opus' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const decision = parseHookDecision(result.stdout);
    assert.equal(decision.permissionDecision, 'ask');
    assert.match(decision.permissionDecisionReason, /opus/i);
  });
});
