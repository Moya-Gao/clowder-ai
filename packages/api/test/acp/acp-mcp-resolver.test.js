/**
 * acp-mcp-resolver — unit tests for MCP whitelist → AcpMcpServerStdio resolution.
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

const { resolveAcpMcpServers } = await import(
  '../../dist/domains/cats/services/agents/providers/acp/acp-mcp-resolver.js'
);

describe('resolveAcpMcpServers', () => {
  const temps = [];
  function makeTempRoot(mcpJson) {
    const dir = mkdtempSync(join(tmpdir(), 'acp-mcp-'));
    temps.push(dir);
    if (mcpJson !== undefined) {
      writeFileSync(join(dir, '.mcp.json'), JSON.stringify(mcpJson));
    }
    return dir;
  }

  afterEach(() => {
    for (const d of temps) rmSync(d, { recursive: true, force: true });
    temps.length = 0;
  });

  it('returns [] for empty whitelist', () => {
    const result = resolveAcpMcpServers('/nonexistent', []);
    assert.deepStrictEqual(result, []);
  });

  it('resolves matching whitelist entries to AcpMcpServerStdio', () => {
    const root = makeTempRoot({
      mcpServers: {
        'cat-cafe-collab': { command: 'node', args: ['collab.js'] },
        'cat-cafe-memory': { command: 'node', args: ['memory.js'], env: { FOO: 'bar' } },
        unrelated: { command: 'npx', args: ['other'] },
      },
    });

    const result = resolveAcpMcpServers(root, ['cat-cafe-collab', 'cat-cafe-memory']);
    assert.equal(result.length, 2);

    assert.deepStrictEqual(result[0], {
      name: 'cat-cafe-collab',
      command: 'node',
      args: ['collab.js'],
      env: [],
    });
    assert.deepStrictEqual(result[1], {
      name: 'cat-cafe-memory',
      command: 'node',
      args: ['memory.js'],
      env: [{ name: 'FOO', value: 'bar' }],
    });
  });

  it('skips missing whitelist entries but returns the rest', () => {
    const root = makeTempRoot({
      mcpServers: {
        'cat-cafe-collab': { command: 'node', args: ['collab.js'] },
      },
    });

    const result = resolveAcpMcpServers(root, ['cat-cafe-collab', 'nonexistent']);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'cat-cafe-collab');
  });

  it('throws when ALL whitelist entries are missing (zero resolved)', () => {
    const root = makeTempRoot({ mcpServers: { unrelated: { command: 'x' } } });

    assert.throws(
      () => resolveAcpMcpServers(root, ['missing-a', 'missing-b']),
      /All 2 MCP whitelist entries.*missing from \.mcp\.json/,
    );
  });

  it('throws when .mcp.json is missing', () => {
    const root = makeTempRoot(); // no .mcp.json written

    assert.throws(() => resolveAcpMcpServers(root, ['cat-cafe']), /Cannot read/);
  });

  it('throws when .mcp.json has no mcpServers key', () => {
    const root = makeTempRoot({ version: 1 });

    assert.throws(() => resolveAcpMcpServers(root, ['cat-cafe']), /no mcpServers key/);
  });
});
