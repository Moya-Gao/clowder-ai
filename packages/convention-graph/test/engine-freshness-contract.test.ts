import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConventionGraphEngine } from '../src/engine.ts';

// ---- freshness domain membership contract（F242 cloud P1：inScope predicate）----
// 不变量：domain-scoped untracked 检测的 membership 判定唯一来源 = 注入的 inScope
// （生产路径来自 plugin.invalidationScope）。A/B 对照证明逻辑真依赖 inScope（非假绿）。

test('freshness contract A：domain-scoped + inScope 报本 domain 新文件 untracked（修复漏报）', () => {
  const g = new ConventionGraphEngine();
  const indexed = {
    path: 'packages/mcp-server/src/tools/callback-tools.ts',
    content: 'export const callbackTools = [];',
  };
  g.recordIndexedFiles([indexed], ['mcp-tool']);
  // 本 domain（mcp-tool）的新文件，尚未索引；inScope 判定它属于 mcp-tool
  const newMcp = { path: 'packages/mcp-server/src/tools/new-tools.ts', content: 'export const newTools = [];' };
  const inScope = (p: string) => p.startsWith('packages/mcp-server/src/tools/');
  const freshness = g.freshness([indexed, newMcp], ['mcp-tool'], inScope);
  assert.equal(freshness.stale, true);
  assert.deepEqual(freshness.pendingChanges, [{ path: newMcp.path, reason: 'untracked' }]);
  g.close();
});

test('freshness contract B：domain-scoped 无 inScope fail closed 报 unknown untracked（对照 C）', () => {
  const g = new ConventionGraphEngine();
  const indexed = {
    path: 'packages/mcp-server/src/tools/callback-tools.ts',
    content: 'export const callbackTools = [];',
  };
  g.recordIndexedFiles([indexed], ['mcp-tool']);
  const newMcp = { path: 'packages/mcp-server/src/tools/new-tools.ts', content: 'export const newTools = [];' };
  // 不传 inScope → 无法证明 unknown file out-of-scope → fail closed，不把 incomplete graph 标 fresh
  const freshness = g.freshness([indexed, newMcp], ['mcp-tool']);
  assert.equal(freshness.stale, true);
  assert.deepEqual(freshness.pendingChanges, [{ path: newMcp.path, reason: 'untracked' }]);
  g.close();
});

test('freshness contract C：domain-scoped + inScope 不把别 domain 新文件误报 untracked（砚砚 OQ-2）', () => {
  const g = new ConventionGraphEngine();
  const mcpIndexed = {
    path: 'packages/mcp-server/src/tools/callback-tools.ts',
    content: 'export const callbackTools = [];',
  };
  g.recordIndexedFiles([mcpIndexed], ['mcp-tool']);
  // skill domain 的新文件；mcp-tool 的 inScope 判定 false → 不该误报
  const skillFile = { path: 'cat-cafe-skills/foo/SKILL.md', content: '# Skill' };
  const inScope = (p: string) => p.startsWith('packages/mcp-server/src/tools/');
  const freshness = g.freshness([mcpIndexed, skillFile], ['mcp-tool'], inScope);
  assert.equal(freshness.stale, false);
  assert.deepEqual(freshness.pendingChanges, []);
  g.close();
});
