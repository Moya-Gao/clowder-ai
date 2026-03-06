import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { accessSync, constants, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '..', '..', '..');
const settingsPath = resolve(repoRoot, '.claude', 'settings.json');
const taskHookScript = resolve(repoRoot, '.claude', 'hooks', 'check-subagent-model.sh');

/**
 * Run the hook script with a given tool_name and tool_input.
 */
function runHook(toolName, toolInput = {}) {
  return spawnSync('bash', [taskHookScript], {
    input: JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: toolName,
      tool_input: toolInput,
    }),
    encoding: 'utf8',
  });
}

/**
 * Parse hook JSON decision from stdout.
 */
function parseHookDecision(stdout) {
  assert.ok(stdout.trim().length > 0, 'hook should emit JSON decision output');
  const parsed = JSON.parse(stdout);
  assert.equal(parsed?.hookSpecificOutput?.hookEventName, 'PreToolUse');
  return parsed.hookSpecificOutput;
}

describe('project-level Claude hook settings', () => {
  it('configures PreToolUse Task matcher to enforce subagent gating', () => {
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

  it('ships project-local hook script and keeps it executable', () => {
    accessSync(taskHookScript, constants.X_OK);
  });
});

describe('subagent_type gating logic', () => {
  it('silently allows TaskOutput (no JSON output)', () => {
    const result = runHook('TaskOutput', {});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), '', 'TaskOutput should produce no output (silent allow)');
  });

  it('silently allows TaskStop (no JSON output)', () => {
    const result = runHook('TaskStop', {});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), '', 'TaskStop should produce no output (silent allow)');
  });

  it('allows Explore subagent (auto-haiku, cheap)', () => {
    const result = runHook('Agent', { subagent_type: 'Explore', prompt: 'find files' });
    assert.equal(result.status, 0, result.stderr);
    // Explore should either silently allow or explicitly allow — never deny/ask
    const stdout = result.stdout.trim();
    if (stdout.length === 0) return; // silent allow is fine
    const decision = parseHookDecision(result.stdout);
    assert.notEqual(decision.permissionDecision, 'deny');
    assert.notEqual(decision.permissionDecision, 'ask');
  });

  it('allows Plan subagent (needs Opus-level thinking)', () => {
    const result = runHook('Agent', { subagent_type: 'Plan', prompt: 'design architecture' });
    assert.equal(result.status, 0, result.stderr);
    const stdout = result.stdout.trim();
    if (stdout.length === 0) return; // silent allow is fine
    const decision = parseHookDecision(result.stdout);
    assert.notEqual(decision.permissionDecision, 'deny');
    assert.notEqual(decision.permissionDecision, 'ask');
  });

  it('asks for general-purpose subagent (inherits Opus, expensive)', () => {
    const result = runHook('Agent', { subagent_type: 'general-purpose', prompt: 'do stuff' });
    assert.equal(result.status, 0, result.stderr);
    const decision = parseHookDecision(result.stdout);
    assert.equal(decision.permissionDecision, 'ask');
    assert.match(decision.permissionDecisionReason, /Opus|general-purpose|成本/i);
  });

  it('asks when subagent_type is missing (inherits Opus)', () => {
    const result = runHook('Agent', { prompt: 'do stuff' });
    assert.equal(result.status, 0, result.stderr);
    const decision = parseHookDecision(result.stdout);
    assert.equal(decision.permissionDecision, 'ask');
    assert.match(decision.permissionDecisionReason, /Opus|未指定|成本/i);
  });

  it('also gates legacy Task tool name (same as Agent)', () => {
    const result = runHook('Task', { prompt: 'do stuff' });
    assert.equal(result.status, 0, result.stderr);
    const decision = parseHookDecision(result.stdout);
    assert.equal(decision.permissionDecision, 'ask');
  });
});
