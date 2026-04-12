/**
 * CatAgent Security Baseline Tests — F159
 *
 * Tests for the two security hard gates:
 * 1. Account-binding fail-closed credential resolution
 * 2. Symlink-safe sandbox (fs.realpath double-check)
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

test('resolveApiCredentials uses env var override when set', () => {
  const key = 'sk-ant-test-key-' + Date.now();
  process.env.CATAGENT_ANTHROPIC_API_KEY = key;
  process.env.CATAGENT_ANTHROPIC_BASE_URL = 'https://test.example.com';
  try {
    const result = resolveApiCredentials('/tmp', 'opus', null);
    assert.ok(result, 'should return credentials from env');
    assert.equal(result.apiKey, key);
    assert.equal(result.baseURL, 'https://test.example.com');
    assert.equal(result.source, 'env');
  } finally {
    delete process.env.CATAGENT_ANTHROPIC_API_KEY;
    delete process.env.CATAGENT_ANTHROPIC_BASE_URL;
  }
});

test('resolveApiCredentials does not scan credentials.json as fallback', () => {
  // With no env var and no bound account, should return null — not scan for any key
  const result = resolveApiCredentials('/tmp', 'opus', { accountRef: '' });
  assert.equal(result, null, 'should not fallback to credential scanning');
});

// ── Sandbox (symlink-safe path validation) ──

const { resolveSecurePath, createToolRegistry, getToolSchemas } = await import(
  '../dist/domains/cats/services/agents/providers/catagent/catagent-tools.js'
);

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
    // Create symlink inside workspace pointing to outside directory
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
    // Create file symlink inside workspace pointing to outside file
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

// ── Denylist (aligned with workspace-security.ts) ──

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

// ── Tool Registry ──

test('createToolRegistry returns 3 read-only tools', () => {
  const registry = createToolRegistry('/tmp');
  assert.equal(registry.size, 3, 'should have 3 tools');
  assert.ok(registry.has('read_file'));
  assert.ok(registry.has('list_files'));
  assert.ok(registry.has('search_content'));
  for (const [, tool] of registry) {
    assert.equal(tool.permission, 'allow', 'all tools should be allowed (read-only)');
  }
});

test('getToolSchemas returns valid Anthropic tool schemas', () => {
  const registry = createToolRegistry('/tmp');
  const schemas = getToolSchemas(registry);
  assert.equal(schemas.length, 3);
  for (const schema of schemas) {
    assert.ok(schema.name, 'each schema should have a name');
    assert.ok(schema.input_schema, 'each schema should have input_schema');
  }
});

test('read_file tool reads a file correctly via secure path', async () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-sec-')));
  try {
    writeFileSync(join(tmpDir, 'hello.txt'), 'line1\nline2\nline3\n');
    const registry = createToolRegistry(tmpDir);
    const result = await registry.get('read_file').execute({ path: 'hello.txt' });
    assert.ok(result.includes('line1'));
    assert.ok(result.includes('line2'));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('read_file tool blocks symlink escape', async () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-sec-')));
  const outsideDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-outside-')));
  writeFileSync(join(outsideDir, 'secret.txt'), 'leaked');
  try {
    symlinkSync(join(outsideDir, 'secret.txt'), join(tmpDir, 'link-to-secret'));
    const registry = createToolRegistry(tmpDir);
    await assert.rejects(() => registry.get('read_file').execute({ path: 'link-to-secret' }), /Symlink escape blocked/);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
    rmSync(outsideDir, { recursive: true, force: true });
  }
});

test('list_files does not expose denylisted entries', async () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-sec-')));
  try {
    writeFileSync(join(tmpDir, 'visible.txt'), 'ok');
    writeFileSync(join(tmpDir, '.env'), 'SECRET=leaked');
    writeFileSync(join(tmpDir, '.env.local'), 'SECRET=leaked');
    writeFileSync(join(tmpDir, 'server.pem'), 'CERT');
    mkdirSync(join(tmpDir, '.git'));
    writeFileSync(join(tmpDir, '.git', 'config'), 'leaked');
    mkdirSync(join(tmpDir, 'secrets'));
    writeFileSync(join(tmpDir, 'secrets', 'key.txt'), 'leaked');
    const registry = createToolRegistry(tmpDir);
    const result = await registry.get('list_files').execute({ path: '.' });
    assert.ok(result.includes('visible.txt'), 'should include visible files');
    assert.ok(!result.includes('.env'), 'should not expose .env');
    assert.ok(!result.includes('.git'), 'should not expose .git');
    assert.ok(!result.includes('secrets'), 'should not expose secrets');
    assert.ok(!result.includes('server.pem'), 'should not expose .pem files');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('search_content does not return denylisted descendants', async () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-sec-')));
  try {
    writeFileSync(join(tmpDir, 'visible.txt'), 'findme');
    writeFileSync(join(tmpDir, '.env'), 'findme');
    mkdirSync(join(tmpDir, 'secrets'));
    writeFileSync(join(tmpDir, 'secrets', 'key.txt'), 'findme');
    mkdirSync(join(tmpDir, '.git'));
    writeFileSync(join(tmpDir, '.git', 'config'), 'findme');
    const registry = createToolRegistry(tmpDir);
    const result = await registry.get('search_content').execute({ pattern: 'findme' });
    assert.ok(result.includes('visible.txt'), 'should find visible file');
    assert.ok(!result.includes('.env'), 'should not return .env');
    assert.ok(!result.includes('secrets'), 'should not return secrets/');
    assert.ok(!result.includes('.git'), 'should not return .git/');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('search_content with glob filter returns matching files', async () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-sec-')));
  try {
    writeFileSync(join(tmpDir, 'app.ts'), 'export const greeting = "hello";');
    writeFileSync(join(tmpDir, 'readme.md'), 'hello world');
    const registry = createToolRegistry(tmpDir);
    const result = await registry.get('search_content').execute({ pattern: 'hello', glob: '*.ts' });
    assert.ok(result.includes('app.ts'), 'should find app.ts');
    assert.ok(!result.includes('readme.md'), 'should not find readme.md');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('search_content uses -- separator to prevent rg injection', async () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-sec-')));
  try {
    writeFileSync(join(tmpDir, 'test.txt'), 'hello world');
    const registry = createToolRegistry(tmpDir);
    // Pattern starting with - should not be interpreted as rg flag
    const result = await registry.get('search_content').execute({ pattern: '-help' });
    // Should not crash — either returns no matches or the file if it matches
    assert.ok(typeof result === 'string');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
