/**
 * CatAgent Security Baseline Tests — F159 Phase B
 *
 * Tests for the two security hard gates:
 * 1. Account-binding fail-closed credential resolution
 * 2. Symlink-safe sandbox (delegates to resolveWorkspacePath)
 *
 * Tool registry tests (read_file / list_files / search_content) ship in Phase D.
 */

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

// ── Credentials (account-binding fail-closed) ──

const { resolveApiCredentials } = await import(
  '../dist/domains/cats/services/agents/providers/catagent/catagent-credentials.js'
);

test('resolveApiCredentials returns null when catConfig is null', () => {
  const result = resolveApiCredentials('/tmp', 'opus', null);
  assert.equal(result, null, 'should return null for null catConfig');
});

test('resolveApiCredentials returns null when catConfig has no accountRef', () => {
  const result = resolveApiCredentials('/tmp', 'opus', { name: 'test' });
  assert.equal(result, null, 'should return null when no accountRef');
});

test('resolveApiCredentials returns null when bound account does not resolve', () => {
  // Use a fake accountRef that won't exist in any catalog
  const result = resolveApiCredentials('/tmp', 'opus', { accountRef: 'nonexistent-account-xyz' });
  assert.equal(result, null, 'should return null for unresolvable bound account');
});

test('resolveApiCredentials ignores env var — only bound account is authoritative', () => {
  // Even with env var set, resolver must not use it (AC-B1: single source of truth)
  process.env.CATAGENT_ANTHROPIC_API_KEY = 'sk-ant-should-be-ignored';
  try {
    const result = resolveApiCredentials('/tmp', 'opus', null);
    assert.equal(result, null, 'should return null — env override must not bypass account binding');
  } finally {
    delete process.env.CATAGENT_ANTHROPIC_API_KEY;
  }
});

test('resolveApiCredentials does not scan credentials.json as fallback', () => {
  // Empty accountRef should fail closed, not scan for any key
  const result = resolveApiCredentials('/tmp', 'opus', { accountRef: '' });
  assert.equal(result, null, 'should not fallback to credential scanning');
});

// ── Sandbox (delegates to shared resolveWorkspacePath) ──

const { resolveSecurePath } = await import('../dist/domains/cats/services/agents/providers/catagent/catagent-tools.js');

test('resolveSecurePath allows paths within working directory', async () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-sec-')));
  try {
    writeFileSync(join(tmpDir, 'test.txt'), 'hello');
    const result = await resolveSecurePath(tmpDir, 'test.txt');
    assert.ok(result.endsWith('test.txt'));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('resolveSecurePath blocks ../etc/passwd traversal', async () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-sec-')));
  try {
    await assert.rejects(() => resolveSecurePath(tmpDir, '../../../etc/passwd'), /Path traversal blocked/);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('resolveSecurePath blocks sibling prefix traversal', async () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-sec-')));
  const siblingDir = `${tmpDir}2`;
  mkdirSync(siblingDir, { recursive: true });
  writeFileSync(join(siblingDir, 'secret.txt'), 'leaked');
  try {
    await assert.rejects(
      () => resolveSecurePath(tmpDir, `../${tmpDir.split('/').pop()}2/secret.txt`),
      /Path traversal blocked/,
    );
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
    rmSync(siblingDir, { recursive: true, force: true });
  }
});

test('resolveSecurePath blocks symlink escape', async () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-sec-')));
  const outsideDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-outside-')));
  writeFileSync(join(outsideDir, 'secret.txt'), 'leaked');
  try {
    symlinkSync(outsideDir, join(tmpDir, 'escape-link'));
    await assert.rejects(() => resolveSecurePath(tmpDir, 'escape-link/secret.txt'), /Symlink escape blocked/);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
    rmSync(outsideDir, { recursive: true, force: true });
  }
});

test('resolveSecurePath blocks symlink to file outside workspace', async () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-sec-')));
  const outsideDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-outside-')));
  const secretFile = join(outsideDir, 'secret.txt');
  writeFileSync(secretFile, 'leaked');
  try {
    symlinkSync(secretFile, join(tmpDir, 'escape-file'));
    await assert.rejects(() => resolveSecurePath(tmpDir, 'escape-file'), /Symlink escape blocked/);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
    rmSync(outsideDir, { recursive: true, force: true });
  }
});

test('resolveSecurePath allows ENOENT (file does not exist yet)', async () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-sec-')));
  try {
    const result = await resolveSecurePath(tmpDir, 'nonexistent.txt');
    assert.ok(result.endsWith('nonexistent.txt'));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Denylist (shared with workspace-security.ts via delegation) ──

test('resolveSecurePath blocks .env files', async () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-sec-')));
  try {
    writeFileSync(join(tmpDir, '.env'), 'SECRET=leaked');
    await assert.rejects(() => resolveSecurePath(tmpDir, '.env'), /Access denied/);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('resolveSecurePath blocks .env.local variant', async () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-sec-')));
  try {
    writeFileSync(join(tmpDir, '.env.local'), 'SECRET=leaked');
    await assert.rejects(() => resolveSecurePath(tmpDir, '.env.local'), /Access denied/);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('resolveSecurePath blocks .pem files', async () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-sec-')));
  try {
    writeFileSync(join(tmpDir, 'server.pem'), 'CERT');
    await assert.rejects(() => resolveSecurePath(tmpDir, 'server.pem'), /Access denied/);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('resolveSecurePath blocks .key files', async () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-sec-')));
  try {
    writeFileSync(join(tmpDir, 'private.key'), 'KEY');
    await assert.rejects(() => resolveSecurePath(tmpDir, 'private.key'), /Access denied/);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('resolveSecurePath blocks .git directory', async () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-sec-')));
  try {
    mkdirSync(join(tmpDir, '.git'));
    writeFileSync(join(tmpDir, '.git', 'config'), 'leaked');
    await assert.rejects(() => resolveSecurePath(tmpDir, '.git/config'), /Access denied/);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('resolveSecurePath blocks secrets directory', async () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-sec-')));
  try {
    mkdirSync(join(tmpDir, 'secrets'));
    writeFileSync(join(tmpDir, 'secrets', 'api-key.txt'), 'leaked');
    await assert.rejects(() => resolveSecurePath(tmpDir, 'secrets/api-key.txt'), /Access denied/);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
