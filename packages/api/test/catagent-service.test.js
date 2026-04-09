/**
 * CatAgent Service Tests — F152: Thin Agent Runtime
 * Unit tests for kernel prompt, microcompact, tool registry, and credential resolution.
 * Does NOT call the real Anthropic API — mocks the LLM client.
 */

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const { buildKernelPrompt } = await import(
  '../dist/domains/cats/services/agents/providers/catagent/catagent-kernel-prompt.js'
);
const { createToolRegistry, getToolSchemas } = await import(
  '../dist/domains/cats/services/agents/providers/catagent/catagent-tools.js'
);
const { microcompact } = await import(
  '../dist/domains/cats/services/agents/providers/catagent/catagent-microcompact.js'
);

// ── Kernel Prompt ──

test('buildKernelPrompt includes identity and iron laws', () => {
  const prompt = buildKernelPrompt({
    catId: 'opus',
    catName: '布偶猫/宪宪',
    model: 'claude-sonnet-4-20250514',
    workingDirectory: '/tmp/test',
    turnNumber: 1,
  });
  assert.ok(prompt.includes('布偶猫/宪宪'), 'should include cat name');
  assert.ok(prompt.includes('Iron Laws') || prompt.includes('Safety Rules'), 'should include safety rules');
  assert.ok(prompt.includes('Turn: 1'), 'should include turn number');
  assert.ok(prompt.includes('/tmp/test'), 'should include working directory');
});

test('buildKernelPrompt rebuilds with different turn numbers', () => {
  const p1 = buildKernelPrompt({
    catId: 'opus',
    catName: 'test',
    model: 'm',
    workingDirectory: '/tmp',
    turnNumber: 1,
  });
  const p5 = buildKernelPrompt({
    catId: 'opus',
    catName: 'test',
    model: 'm',
    workingDirectory: '/tmp',
    turnNumber: 5,
  });
  assert.ok(p1.includes('Turn: 1'));
  assert.ok(p5.includes('Turn: 5'));
  assert.notEqual(p1, p5, 'prompts should differ per turn');
});

test('buildKernelPrompt includes custom system prompt', () => {
  const prompt = buildKernelPrompt({
    catId: 'opus',
    catName: 'test',
    model: 'm',
    workingDirectory: '/tmp',
    turnNumber: 1,
    customSystemPrompt: 'You are a code reviewer.',
  });
  assert.ok(prompt.includes('You are a code reviewer.'));
});

// ── Tool Registry ──

test('createToolRegistry returns 3 read-only tools', () => {
  const registry = createToolRegistry('/tmp');
  assert.equal(registry.size, 3, 'should have 3 tools');
  assert.ok(registry.has('read_file'));
  assert.ok(registry.has('list_files'));
  assert.ok(registry.has('search_content'));
  for (const [, tool] of registry) {
    assert.equal(tool.permission, 'allow', 'all spike tools should be allowed');
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

test('read_file tool reads a file correctly', async () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-test-')));
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

test('read_file tool blocks path traversal', async () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-test-')));
  try {
    const registry = createToolRegistry(tmpDir);
    await assert.rejects(
      () => registry.get('read_file').execute({ path: '../../../etc/passwd' }),
      /Path traversal blocked/,
    );
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('read_file tool blocks sibling prefix traversal', async () => {
  // e.g. workingDir=/tmp/repo, path=../repo2/secret → /tmp/repo2/secret starts with /tmp/repo
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-test-')));
  const siblingDir = `${tmpDir}2`;
  mkdirSync(siblingDir, { recursive: true });
  writeFileSync(join(siblingDir, 'secret.txt'), 'leaked');
  try {
    const registry = createToolRegistry(tmpDir);
    await assert.rejects(
      () => registry.get('read_file').execute({ path: `../` + `${tmpDir.split('/').pop()}2/secret.txt` }),
      /Path traversal blocked/,
    );
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
    rmSync(siblingDir, { recursive: true, force: true });
  }
});

test('list_files tool lists directory contents', async () => {
  const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-test-')));
  try {
    writeFileSync(join(tmpDir, 'a.ts'), '');
    writeFileSync(join(tmpDir, 'b.js'), '');
    mkdirSync(join(tmpDir, 'sub'));
    const registry = createToolRegistry(tmpDir);
    const result = await registry.get('list_files').execute({});
    assert.ok(result.includes('a.ts'));
    assert.ok(result.includes('b.js'));
    assert.ok(result.includes('sub/'));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── MicroCompact ──

test('microcompact does nothing when few tool results', () => {
  const messages = [
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: [{ type: 'text', text: 'hi' }] },
  ];
  const result = microcompact(messages);
  assert.deepEqual(result, messages, 'should not modify when no tool results');
});

test('microcompact strips old tool results beyond 3 turns', () => {
  const messages = [];
  // Create 5 turns of tool use
  for (let i = 0; i < 5; i++) {
    messages.push({
      role: 'assistant',
      content: [{ type: 'tool_use', id: `t${i}`, name: 'read_file', input: {} }],
    });
    messages.push({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: `t${i}`, content: `result-${i}-long-content` }],
    });
  }

  const result = microcompact(messages);
  assert.equal(result.length, messages.length, 'should preserve message count');

  // First 2 tool result turns (indices 1, 3) should be compacted
  const first = result[1];
  assert.equal(first.content[0].content, '[compacted — see recent results]');

  const second = result[3];
  assert.equal(second.content[0].content, '[compacted — see recent results]');

  // Last 3 turns (indices 5, 7, 9) should be intact
  const last = result[9];
  assert.equal(last.content[0].content, 'result-4-long-content');
});
