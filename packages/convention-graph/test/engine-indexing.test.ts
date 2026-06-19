import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConventionGraphEngine } from '../src/engine.ts';

test('recordIndexedFiles 全量刷新会移除不在当前文件集里的旧文件行', () => {
  const g = new ConventionGraphEngine();
  const initial = [
    { path: 'a.ts', content: 'export const a = 1;' },
    { path: 'b.ts', content: 'export const b = 1;' },
  ];
  const refreshed = [{ path: 'a.ts', content: 'export const a = 1;' }];

  g.recordIndexedFiles(initial, ['d']);
  g.recordIndexedFiles(refreshed, ['d']);

  const freshness = g.freshness(refreshed);
  assert.equal(freshness.stale, false);
  assert.deepEqual(freshness.pendingChanges, []);
  g.close();
});

test('recordIndexedFiles 只清理当前 recorded domains 的旧文件行，保留其他 domain freshness', () => {
  const g = new ConventionGraphEngine();
  const mcpFiles = [
    { path: 'packages/mcp-server/src/tools/callback-tools.ts', content: 'export const callbackTools = [];' },
  ];
  const skillFiles = [{ path: 'cat-cafe-skills/convention-graph-discovery/SKILL.md', content: '# Skill' }];

  g.recordIndexedFiles(mcpFiles, ['mcp-tool']);
  g.recordIndexedFiles(skillFiles, ['skill-manifest']);

  const freshness = g.freshness([...mcpFiles, ...skillFiles]);
  assert.equal(freshness.stale, false);
  assert.deepEqual(freshness.pendingChanges, []);
  g.close();
});

test('freshness 按 domain 查询时不会把其他 domain 的 current files 标为 untracked', () => {
  const g = new ConventionGraphEngine();
  const mcpFiles = [
    { path: 'packages/mcp-server/src/tools/callback-tools.ts', content: 'export const callbackTools = [];' },
  ];
  const skillFiles = [{ path: 'cat-cafe-skills/convention-graph-discovery/SKILL.md', content: '# Skill' }];

  g.recordIndexedFiles(mcpFiles, ['mcp-tool']);
  g.recordIndexedFiles(skillFiles, ['skill-manifest']);

  const inScope = (p: string) => p.startsWith('packages/mcp-server/src/tools/');
  const freshness = g.freshness([...mcpFiles, ...skillFiles], ['mcp-tool'], inScope);
  assert.equal(freshness.stale, false);
  assert.deepEqual(freshness.pendingChanges, []);
  g.close();
});

test('recordIndexedFiles 合并共享文件 domain ownership，并只移除当前刷新缺失的 domain', () => {
  const g = new ConventionGraphEngine();
  const shared = { path: 'packages/shared/conventions.ts', content: 'export const shared = true;' };
  const mcpOnly = {
    path: 'packages/mcp-server/src/tools/callback-tools.ts',
    content: 'export const callbackTools = [];',
  };
  const skillOnly = { path: 'cat-cafe-skills/convention-graph-discovery/SKILL.md', content: '# Skill' };

  g.recordIndexedFiles([shared, mcpOnly], ['mcp-tool']);
  g.recordIndexedFiles([shared, skillOnly], ['skill-manifest']);

  let freshness = g.freshness([shared, mcpOnly, skillOnly]);
  assert.equal(freshness.stale, false);
  assert.deepEqual(freshness.pendingChanges, []);

  g.recordIndexedFiles([skillOnly], ['skill-manifest']);

  freshness = g.freshness([shared, mcpOnly, skillOnly]);
  assert.equal(freshness.stale, false);
  assert.deepEqual(freshness.pendingChanges, []);
  g.close();
});

test('recordIndexedFiles 对共享文件按 domain 保留独立 hash，避免其他 domain 重索引掩盖 stale', () => {
  const g = new ConventionGraphEngine();
  const sharedV1 = { path: 'packages/shared/conventions.ts', content: 'export const shared = "v1";' };
  const sharedV2 = { path: sharedV1.path, content: 'export const shared = "v2";' };
  const mcpOnly = {
    path: 'packages/mcp-server/src/tools/callback-tools.ts',
    content: 'export const callbackTools = [];',
  };

  g.recordIndexedFiles([sharedV1, mcpOnly], ['mcp-tool']);
  g.recordIndexedFiles([sharedV2], ['skill-manifest']);

  const freshness = g.freshness([sharedV2, mcpOnly]);
  assert.equal(freshness.stale, true);
  assert.deepEqual(freshness.pendingChanges, [{ path: sharedV1.path, reason: 'modified' }]);
  g.close();
});

test('reindex 替换 domain 时会清除旧 nodes/edges/gaps，避免已删除约定继续 live', () => {
  const g = new ConventionGraphEngine();
  const initial = {
    nodes: [
      {
        id: 'tool:old',
        domainId: 'mcp-tool',
        kind: 'mcp_tool',
        name: 'old_tool',
        scopeKey: 'repo|pkg|ts|tools.ts|mcp_tool|mcp-tool|old_tool',
      },
      {
        id: 'consumer:old',
        domainId: 'mcp-tool',
        kind: 'tool_consumer',
        name: 'old_consumer',
        scopeKey: 'repo|pkg|ts|consumer.ts|tool_consumer|mcp-tool|old_consumer',
      },
    ],
    edges: [
      {
        source: 'consumer:old',
        target: 'tool:old',
        kind: 'consumes',
        domainId: 'mcp-tool',
        provenance: {
          extractor: 'mcp-tool-extractor',
          extractorVersion: '0.1.0',
          sourceFile: 'consumer.ts',
          sourceLine: 1,
          confidence: 'static' as const,
        },
      },
    ],
    gaps: [{ domainId: 'mcp-tool', reason: 'old gap', filePath: 'tools.ts' }],
  };

  g.ingestExtractionResult(initial, { replaceDomains: ['mcp-tool'] });
  assert.equal(g.findNodes({ domainId: 'mcp-tool' }).length, 2);
  assert.equal(g.consumers('tool:old').length, 1);

  g.ingestExtractionResult({ nodes: [], edges: [], gaps: [] }, { replaceDomains: ['mcp-tool'] });

  assert.equal(g.findNodes({ domainId: 'mcp-tool' }).length, 0);
  assert.equal(g.consumers('tool:old').length, 0);
  g.close();
});

test('非空 reindex 默认按 extraction domain 替换旧行', () => {
  const g = new ConventionGraphEngine();
  g.ingestExtractionResult({
    nodes: [
      {
        id: 'tool:old',
        domainId: 'mcp-tool',
        kind: 'mcp_tool',
        name: 'old_tool',
        scopeKey: 'repo|pkg|ts|tools.ts|mcp_tool|mcp-tool|old_tool',
      },
    ],
    edges: [],
    gaps: [],
  });

  g.ingestExtractionResult({
    nodes: [
      {
        id: 'tool:new',
        domainId: 'mcp-tool',
        kind: 'mcp_tool',
        name: 'new_tool',
        scopeKey: 'repo|pkg|ts|tools.ts|mcp_tool|mcp-tool|new_tool',
      },
    ],
    edges: [],
    gaps: [],
  });

  assert.equal(g.getNode('tool:old'), null);
  assert.equal(g.getNode('tool:new')?.name, 'new_tool');
  g.close();
});

test('刷新单个 domain 时保留其他 domain 指向仍存在节点的 edge', () => {
  const g = new ConventionGraphEngine();
  g.ingestExtractionResult(
    {
      nodes: [
        {
          id: 'tool:shared',
          domainId: 'mcp-tool',
          kind: 'mcp_tool',
          name: 'shared_tool',
          scopeKey: 'repo|pkg|ts|tools.ts|mcp_tool|mcp-tool|shared_tool',
          metadata: { version: 1 },
        },
      ],
      edges: [],
      gaps: [],
    },
    { replaceDomains: ['mcp-tool'] },
  );
  g.ingestExtractionResult(
    {
      nodes: [
        {
          id: 'consumer:skill',
          domainId: 'skill-manifest',
          kind: 'skill_reference',
          name: 'skill-consumer',
          scopeKey: 'repo|skills|md|SKILL.md|skill_reference|skill-manifest|skill-consumer',
        },
      ],
      edges: [
        {
          source: 'consumer:skill',
          target: 'tool:shared',
          kind: 'consumes',
          domainId: 'skill-manifest',
          provenance: {
            extractor: 'skill-manifest-extractor',
            extractorVersion: '0.1.0',
            sourceFile: 'SKILL.md',
            sourceLine: 3,
            confidence: 'static',
          },
        },
      ],
      gaps: [],
    },
    { replaceDomains: ['skill-manifest'] },
  );

  g.ingestExtractionResult(
    {
      nodes: [
        {
          id: 'tool:shared',
          domainId: 'mcp-tool',
          kind: 'mcp_tool',
          name: 'shared_tool',
          scopeKey: 'repo|pkg|ts|tools.ts|mcp_tool|mcp-tool|shared_tool',
          metadata: { version: 2 },
        },
      ],
      edges: [],
      gaps: [],
    },
    { replaceDomains: ['mcp-tool'] },
  );

  assert.equal(g.getNode('tool:shared')?.metadata?.version, 2);
  assert.equal(g.consumers('tool:shared').length, 1);
  assert.equal(g.consumers('tool:shared')[0]?.edge.domainId, 'skill-manifest');
  g.close();
});

test('ingestExtractionResult 作为事务替换 domain，edge 插入失败时保留上一版 live graph', () => {
  const g = new ConventionGraphEngine();
  g.ingestExtractionResult(
    {
      nodes: [
        {
          id: 'tool:old',
          domainId: 'mcp-tool',
          kind: 'mcp_tool',
          name: 'old_tool',
          scopeKey: 'repo|pkg|ts|tools.ts|mcp_tool|mcp-tool|old_tool',
        },
      ],
      edges: [],
      gaps: [],
    },
    { replaceDomains: ['mcp-tool'] },
  );

  assert.throws(() =>
    g.ingestExtractionResult(
      {
        nodes: [
          {
            id: 'tool:new',
            domainId: 'mcp-tool',
            kind: 'mcp_tool',
            name: 'new_tool',
            scopeKey: 'repo|pkg|ts|tools.ts|mcp_tool|mcp-tool|new_tool',
          },
        ],
        edges: [
          {
            source: 'consumer:missing',
            target: 'tool:new',
            kind: 'consumes',
            domainId: 'mcp-tool',
            provenance: {
              extractor: 'mcp-tool-extractor',
              extractorVersion: '0.1.0',
              sourceFile: 'consumer.ts',
              sourceLine: 1,
              confidence: 'static',
            },
          },
        ],
        gaps: [],
      },
      { replaceDomains: ['mcp-tool'] },
    ),
  );

  assert.equal(g.getNode('tool:old')?.name, 'old_tool');
  assert.equal(g.getNode('tool:new'), null);
  g.close();
});
