/**
 * F230 B-hook: Hook setup infrastructure tests
 *
 * Tests the .claude/settings.json writer + hook capture script that
 * funnels Stop/PostToolUse events into a sidecar jsonl.
 */
import './helpers/setup-cat-registry.js';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setupHookInfrastructure } from '../dist/domains/cats/services/agents/providers/pty/hook-setup.js';

function makeTmpCwd() {
  const dir = join(tmpdir(), `hook-test-${process.pid}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------------------------------------------------------------------------
// setupHookInfrastructure — settings.json creation
// ---------------------------------------------------------------------------

test('hook setup: creates .claude/settings.json with Stop + PostToolUse hooks', async () => {
  const tmpCwd = makeTmpCwd();
  const sidecarPath = join(tmpCwd, 'sidecar.jsonl');
  const result = await setupHookInfrastructure(tmpCwd, sidecarPath);
  try {
    assert.ok(existsSync(result.settingsPath), 'settings.json must exist');
    const settings = JSON.parse(readFileSync(result.settingsPath, 'utf8'));
    assert.ok(settings.hooks, 'hooks key must exist');
    assert.ok(settings.hooks.Stop, 'Stop hook must be configured');
    assert.ok(settings.hooks.PostToolUse, 'PostToolUse hook must be configured');
    // Claude hook schema: hooks.<EventName> = [{ hooks: [{ type, command, timeout? }] }]
    assert.ok(Array.isArray(settings.hooks.Stop), 'Stop must be an array of hook groups');
    assert.equal(settings.hooks.Stop.length, 1, 'Stop has exactly one hook group');
    assert.ok(Array.isArray(settings.hooks.Stop[0].hooks), 'Stop group has hooks array');
    assert.equal(settings.hooks.Stop[0].hooks[0].type, 'command', 'Stop hook type is command');
    assert.ok(
      settings.hooks.Stop[0].hooks[0].command.includes(result.scriptPath),
      'Stop hook must point to capture script',
    );
    assert.ok(Array.isArray(settings.hooks.PostToolUse), 'PostToolUse must be an array of hook groups');
    assert.equal(settings.hooks.PostToolUse[0].hooks[0].type, 'command', 'PostToolUse hook type is command');
    assert.ok(
      settings.hooks.PostToolUse[0].hooks[0].command.includes(result.scriptPath),
      'PostToolUse hook must point to capture script',
    );
  } finally {
    await result.cleanup();
  }
});

test('hook setup: creates executable capture script', async () => {
  const tmpCwd = makeTmpCwd();
  const sidecarPath = join(tmpCwd, 'sidecar.jsonl');
  const result = await setupHookInfrastructure(tmpCwd, sidecarPath);
  try {
    assert.ok(existsSync(result.scriptPath), 'capture script must exist');
    // Check it's executable
    const stat = readFileSync(result.scriptPath, 'utf8');
    assert.ok(stat.startsWith('#!/'), 'must have shebang');
  } finally {
    await result.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Capture script — stdin → sidecar append
// ---------------------------------------------------------------------------

test('hook setup: capture script reads stdin and appends to sidecar', async () => {
  const tmpCwd = makeTmpCwd();
  const sidecarPath = join(tmpCwd, 'sidecar.jsonl');
  const result = await setupHookInfrastructure(tmpCwd, sidecarPath);
  try {
    const testData = JSON.stringify({ hook_event_name: 'Stop', session_id: 'test-1', last_assistant_message: 'hello' });
    execSync(`echo '${testData}' | ${result.scriptPath}`, {
      env: { ...process.env, CAT_CAFE_HOOK_SIDECAR: sidecarPath },
    });
    assert.ok(existsSync(sidecarPath), 'sidecar file must be created');
    const lines = readFileSync(sidecarPath, 'utf8').trim().split('\n');
    assert.equal(lines.length, 1);
    const parsed = JSON.parse(lines[0]);
    assert.equal(parsed.hook_event_name, 'Stop');
    assert.equal(parsed.session_id, 'test-1');
  } finally {
    await result.cleanup();
  }
});

test('hook setup: capture script appends multiple events', async () => {
  const tmpCwd = makeTmpCwd();
  const sidecarPath = join(tmpCwd, 'sidecar.jsonl');
  const result = await setupHookInfrastructure(tmpCwd, sidecarPath);
  try {
    const event1 = JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Read' });
    const event2 = JSON.stringify({ hook_event_name: 'Stop', last_assistant_message: 'done' });
    execSync(`echo '${event1}' | ${result.scriptPath}`, {
      env: { ...process.env, CAT_CAFE_HOOK_SIDECAR: sidecarPath },
    });
    execSync(`echo '${event2}' | ${result.scriptPath}`, {
      env: { ...process.env, CAT_CAFE_HOOK_SIDECAR: sidecarPath },
    });
    const lines = readFileSync(sidecarPath, 'utf8').trim().split('\n');
    assert.equal(lines.length, 2);
    assert.equal(JSON.parse(lines[0]).hook_event_name, 'PostToolUse');
    assert.equal(JSON.parse(lines[1]).hook_event_name, 'Stop');
  } finally {
    await result.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Cleanup — backup/restore of existing settings
// ---------------------------------------------------------------------------

test('hook setup: cleanup restores original settings.json', async () => {
  const tmpCwd = makeTmpCwd();
  const sidecarPath = join(tmpCwd, 'sidecar.jsonl');
  const claudeDir = join(tmpCwd, '.claude');
  mkdirSync(claudeDir, { recursive: true });
  const originalContent = JSON.stringify({ existingKey: true, permissions: {} });
  writeFileSync(join(claudeDir, 'settings.json'), originalContent);

  const result = await setupHookInfrastructure(tmpCwd, sidecarPath);
  // During setup, settings.json has our hooks
  const during = JSON.parse(readFileSync(result.settingsPath, 'utf8'));
  assert.ok(during.hooks, 'hooks present during setup');

  await result.cleanup();
  const restored = readFileSync(join(claudeDir, 'settings.json'), 'utf8');
  assert.equal(restored, originalContent, 'original settings must be restored');
});

test('hook setup: cleanup removes settings.json when none existed before', async () => {
  const tmpCwd = makeTmpCwd();
  const sidecarPath = join(tmpCwd, 'sidecar.jsonl');
  // No pre-existing .claude/settings.json
  const result = await setupHookInfrastructure(tmpCwd, sidecarPath);
  assert.ok(existsSync(result.settingsPath));

  await result.cleanup();
  assert.ok(!existsSync(result.settingsPath), 'settings.json must be removed when none existed before');
});

test('hook setup: creates empty sidecar file for tailer', async () => {
  const tmpCwd = makeTmpCwd();
  const sidecarPath = join(tmpCwd, 'sidecar.jsonl');
  const result = await setupHookInfrastructure(tmpCwd, sidecarPath);
  try {
    assert.ok(existsSync(sidecarPath), 'sidecar file must be created');
    assert.equal(readFileSync(sidecarPath, 'utf8'), '', 'sidecar must start empty');
  } finally {
    await result.cleanup();
  }
});
