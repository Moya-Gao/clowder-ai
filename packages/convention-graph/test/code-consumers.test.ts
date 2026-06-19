import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConventionGraphEngine } from '../src/engine.ts';
import { mcpToolPlugin } from '../src/extractors/mcp-tool.ts';
import type { SourceFile } from '../src/plugin.ts';
import { codeConsumers } from '../src/queries.ts';

const MCP_FIXTURE: SourceFile[] = [
  {
    path: 'packages/mcp-server/src/tools/callback-tools.ts',
    content: `
      export const callbackTools = [
        { name: 'cat_cafe_post_message', inputSchema: postMessageInputSchema, handler: handlePostMessage },
      ];
    `,
  },
  {
    path: 'packages/mcp-server/src/server-toolsets.ts',
    content: `
      const COLLAB_TOOL_SOURCES = [
        ...callbackTools,
      ];
    `,
  },
  {
    path: 'packages/api/src/routes/callback-a2a-trigger.ts',
    content: `
      export function routeToolUse(toolName: string) {
        if (toolName === 'cat_cafe_post_message') return 'current-thread';
        return 'other';
      }
    `,
  },
];

test('codeConsumers 查出指定 tool 的结构消费方并保留 provenance', () => {
  const g = new ConventionGraphEngine();
  const extracted = mcpToolPlugin.extract({ repo: 'cat-cafe', files: MCP_FIXTURE });
  g.ingestExtractionResult(extracted);

  const result = codeConsumers(g, {
    domainId: 'mcp-tool',
    kind: 'mcp_tool',
    name: 'cat_cafe_post_message',
  });

  assert.equal(result.targets.length, 1);
  assert.equal(result.targets[0]!.name, 'cat_cafe_post_message');
  assert.equal(result.consumers.length, 2);
  const kinds = result.consumers.map((c) => c.edge.kind).sort();
  assert.deepEqual(kinds, ['consumes', 'registers']);
  const registration = result.consumers.find((c) => c.edge.kind === 'registers')!;
  assert.equal(registration.node.name, 'COLLAB_TOOL_SOURCES');
  assert.equal(registration.edge.provenance.extractor, 'mcp-tool-extractor');
  assert.match(registration.edge.provenance.sourceFile!, /server-toolsets\.ts/);
  const consumer = result.consumers.find((c) => c.edge.kind === 'consumes')!;
  assert.equal(consumer.node.kind, 'tool_consumer');
  assert.match(consumer.node.filePath!, /callback-a2a-trigger\.ts/);
  assert.equal(consumer.edge.provenance.extractor, 'mcp-tool-extractor');
  assert.match(consumer.edge.provenance.sourceFile!, /callback-a2a-trigger\.ts/);

  g.close();
});

test('codeConsumers 查询结果带 freshness，文件改动后标 stale（AC-A3）', () => {
  const g = new ConventionGraphEngine();
  const extracted = mcpToolPlugin.extract({ repo: 'cat-cafe', files: MCP_FIXTURE });
  g.ingestExtractionResult(extracted);
  g.setIndexCommit('abc1234');
  g.recordIndexedFiles(MCP_FIXTURE, ['mcp-tool']);

  const fresh = codeConsumers(
    g,
    {
      domainId: 'mcp-tool',
      kind: 'mcp_tool',
      name: 'cat_cafe_post_message',
    },
    { currentFiles: MCP_FIXTURE },
  );
  assert.equal(fresh.freshness.indexCommit, 'abc1234');
  assert.equal(fresh.freshness.stale, false);
  assert.deepEqual(fresh.freshness.pendingChanges, []);

  const changed = MCP_FIXTURE.map((f) =>
    f.path.endsWith('callback-a2a-trigger.ts')
      ? { ...f, content: f.content.replace('current-thread', 'updated-thread') }
      : f,
  );
  const stale = codeConsumers(
    g,
    {
      domainId: 'mcp-tool',
      kind: 'mcp_tool',
      name: 'cat_cafe_post_message',
    },
    { currentFiles: changed },
  );
  assert.equal(stale.freshness.indexCommit, 'abc1234');
  assert.equal(stale.freshness.stale, true);
  assert.deepEqual(stale.freshness.pendingChanges, [
    {
      path: 'packages/api/src/routes/callback-a2a-trigger.ts',
      reason: 'modified',
    },
  ]);

  g.close();
});

test('codeConsumers freshness 只比较查询 domain 的 indexed files', () => {
  const g = new ConventionGraphEngine();
  g.insertNode({
    id: 'mcp-tool:shared:cat_cafe_post_message',
    domainId: 'mcp-tool',
    kind: 'mcp_tool',
    name: 'cat_cafe_post_message',
    scopeKey: 'cat-cafe|packages/mcp-server|ts|shared.ts|mcp_tool|mcp-tool|cat_cafe_post_message',
    filePath: 'shared.ts',
    lang: 'ts',
  });
  g.insertNode({
    id: 'skill-manifest:shared:convention-graph-discovery',
    domainId: 'skill-manifest',
    kind: 'skill',
    name: 'convention-graph-discovery',
    scopeKey: 'cat-cafe|cat-cafe-skills|md|shared.ts|skill|skill-manifest|convention-graph-discovery',
    filePath: 'shared.ts',
    lang: 'md',
  });
  g.recordIndexedFiles(
    [
      { path: 'shared.ts', content: 'mcp version' },
      { path: 'mcp-only.ts', content: 'mcp only' },
    ],
    ['mcp-tool'],
  );
  g.recordIndexedFiles(
    [
      { path: 'shared.ts', content: 'skill version' },
      { path: 'skill-only.md', content: 'skill only' },
    ],
    ['skill-manifest'],
  );

  const result = codeConsumers(
    g,
    {
      domainId: 'mcp-tool',
      kind: 'mcp_tool',
      name: 'cat_cafe_post_message',
    },
    {
      currentFiles: [
        { path: 'shared.ts', content: 'mcp version' },
        { path: 'mcp-only.ts', content: 'mcp only' },
      ],
    },
  );

  assert.equal(result.targets.length, 1);
  assert.equal(result.freshness.stale, false);
  assert.deepEqual(result.freshness.pendingChanges, []);

  g.close();
});

test('codeConsumers freshness 包含返回 consumer edge 的 domain', () => {
  const g = new ConventionGraphEngine();
  g.insertNode({
    id: 'mcp-tool:tool:cat_cafe_post_message',
    domainId: 'mcp-tool',
    kind: 'mcp_tool',
    name: 'cat_cafe_post_message',
    scopeKey: 'cat-cafe|packages/mcp-server|ts|tools.ts|mcp_tool|mcp-tool|cat_cafe_post_message',
    filePath: 'packages/mcp-server/src/tools/callback-tools.ts',
    lang: 'ts',
  });
  g.insertNode({
    id: 'skill-manifest:skill:convention-graph-discovery',
    domainId: 'skill-manifest',
    kind: 'skill',
    name: 'convention-graph-discovery',
    scopeKey:
      'cat-cafe|cat-cafe-skills|md|cat-cafe-skills/convention-graph-discovery/SKILL.md|skill|skill-manifest|convention-graph-discovery',
    filePath: 'cat-cafe-skills/convention-graph-discovery/SKILL.md',
    lang: 'md',
  });
  g.insertEdge({
    source: 'skill-manifest:skill:convention-graph-discovery',
    target: 'mcp-tool:tool:cat_cafe_post_message',
    kind: 'consumes',
    domainId: 'skill-manifest',
    provenance: {
      extractor: 'skill-manifest-extractor',
      extractorVersion: 'v1',
      sourceFile: 'cat-cafe-skills/convention-graph-discovery/SKILL.md',
      sourceLine: 8,
      confidence: 'static',
    },
  });
  g.recordIndexedFiles([{ path: 'packages/mcp-server/src/tools/callback-tools.ts', content: 'tool v1' }], ['mcp-tool']);
  g.recordIndexedFiles(
    [{ path: 'cat-cafe-skills/convention-graph-discovery/SKILL.md', content: 'skill v1' }],
    ['skill-manifest'],
  );

  const result = codeConsumers(
    g,
    { domainId: 'mcp-tool', kind: 'mcp_tool', name: 'cat_cafe_post_message' },
    {
      currentFiles: [
        { path: 'packages/mcp-server/src/tools/callback-tools.ts', content: 'tool v1' },
        { path: 'cat-cafe-skills/convention-graph-discovery/SKILL.md', content: 'skill v2' },
      ],
      inScope: (path) => path.startsWith('packages/mcp-server/'),
    },
  );

  assert.equal(result.consumers.length, 1);
  assert.equal(result.freshness.stale, true);
  assert.deepEqual(result.freshness.pendingChanges, [
    { path: 'cat-cafe-skills/convention-graph-discovery/SKILL.md', reason: 'modified' },
  ]);

  g.close();
});

test('codeConsumers domain-scoped currentFiles 无 inScope 时 fail closed，不静默漏报新文件', () => {
  const g = new ConventionGraphEngine();
  const extracted = mcpToolPlugin.extract({ repo: 'cat-cafe', files: MCP_FIXTURE });
  g.ingestExtractionResult(extracted);
  g.recordIndexedFiles(MCP_FIXTURE, ['mcp-tool']);

  const newToolFile = {
    path: 'packages/mcp-server/src/tools/new-tools.ts',
    content: 'export const newTools = [];',
  };
  const result = codeConsumers(
    g,
    { domainId: 'mcp-tool', kind: 'mcp_tool', name: 'cat_cafe_post_message' },
    {
      currentFiles: [...MCP_FIXTURE, newToolFile],
    },
  );
  assert.equal(result.freshness.stale, true);
  assert.deepEqual(result.freshness.pendingChanges, [{ path: newToolFile.path, reason: 'untracked' }]);

  g.close();
});

test('codeConsumers 透传 inScope（真实 plugin.invalidationScope）→ 报本 domain 新文件 untracked', () => {
  const g = new ConventionGraphEngine();
  const extracted = mcpToolPlugin.extract({ repo: 'cat-cafe', files: MCP_FIXTURE });
  g.ingestExtractionResult(extracted);
  g.recordIndexedFiles(MCP_FIXTURE, ['mcp-tool']);

  // 本 domain 新文件（未索引）；inScope 用真实 plugin.invalidationScope（dogfood：
  // 证明 domain membership 真相源就是 plugin.invalidationScope，不是简化 predicate）
  const newToolFile = {
    path: 'packages/mcp-server/src/tools/new-tools.ts',
    content: 'export const newTools = [];',
  };
  const result = codeConsumers(
    g,
    { domainId: 'mcp-tool', kind: 'mcp_tool', name: 'cat_cafe_post_message' },
    {
      currentFiles: [...MCP_FIXTURE, newToolFile],
      inScope: (path) => mcpToolPlugin.invalidationScope(path),
    },
  );
  assert.equal(result.freshness.stale, true);
  assert.deepEqual(result.freshness.pendingChanges, [{ path: newToolFile.path, reason: 'untracked' }]);

  g.close();
});
