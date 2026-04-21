import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  findBrokenSessionFiles,
  repairSessionFile,
  stripPureThinkingAssistantTurns,
} from './rescue-claude-thinking-signature.mjs';

const rescueScriptPath = fileURLToPath(new URL('./rescue-claude-thinking-signature.mjs', import.meta.url));

function buildThinkingLine(sessionId, thinking = 'ponder') {
  return JSON.stringify({
    type: 'assistant',
    sessionId,
    message: {
      role: 'assistant',
      content: [{ type: 'thinking', thinking, signature: 'sig-123' }],
    },
  });
}

function buildTextLine(sessionId, text = 'hello') {
  return JSON.stringify({
    type: 'assistant',
    sessionId,
    message: {
      role: 'assistant',
      content: [{ type: 'text', text }],
    },
  });
}

test('stripPureThinkingAssistantTurns removes only pure thinking assistant turns', () => {
  const input = [
    buildThinkingLine('sess-1', 'one'),
    buildTextLine('sess-1', 'keep me'),
    JSON.stringify({ type: 'user', sessionId: 'sess-1', message: { role: 'user', content: 'hi' } }),
    '',
  ].join('\n');

  const result = stripPureThinkingAssistantTurns(input);

  assert.equal(result.removedCount, 1);
  assert.ok(!result.content.includes('"type":"thinking"'));
  assert.ok(result.content.includes('keep me'));
  assert.ok(result.content.includes('"role":"user"'));
});

test('repairSessionFile backs up original file and rewrites stripped content', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-thinking-rescue-'));
  const projectsDir = path.join(tmp, 'projects');
  const backupDir = path.join(tmp, 'backups');
  await fs.mkdir(projectsDir, { recursive: true });
  const filePath = path.join(projectsDir, 'sess-2.jsonl');
  await fs.writeFile(filePath, `${buildThinkingLine('sess-2')}\n${buildTextLine('sess-2', 'survivor')}\n`, 'utf8');

  const result = await repairSessionFile(filePath, { backupDir, now: 1_772_947_520_000 });

  assert.equal(result.status, 'repaired');
  assert.equal(result.removedCount, 1);
  assert.ok(result.backupPath);
  const repaired = await fs.readFile(filePath, 'utf8');
  assert.ok(repaired.includes('survivor'));
  assert.ok(!repaired.includes('"type":"thinking"'));
  const backup = await fs.readFile(result.backupPath, 'utf8');
  assert.ok(backup.includes('"type":"thinking"'));
});

test('findBrokenSessionFiles scans recursively for invalid thinking signature failures', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-thinking-broken-'));
  const okDir = path.join(tmp, 'ok');
  const badDir = path.join(tmp, 'bad');
  await fs.mkdir(okDir, { recursive: true });
  await fs.mkdir(badDir, { recursive: true });
  await fs.writeFile(path.join(okDir, 'ok.jsonl'), `${buildTextLine('ok')}\n`, 'utf8');
  await fs.writeFile(
    path.join(badDir, 'bad.jsonl'),
    [
      buildTextLine('bad'),
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'oops' },
        error: 'Invalid `signature` in `thinking` block',
      }),
    ].join('\n'),
    'utf8',
  );

  const files = await findBrokenSessionFiles(tmp);

  assert.deepEqual(
    files.map((file) => path.basename(file)),
    ['bad.jsonl'],
  );
});

test('--session requires an argument value', () => {
  const result = spawnSync(process.execPath, [rescueScriptPath, '--session', '--dry-run'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr, /--session requires a value/);
});
