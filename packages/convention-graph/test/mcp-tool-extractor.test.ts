import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mcpToolPlugin } from '../src/extractors/mcp-tool.ts';
import type { SourceFile } from '../src/plugin.ts';

// 受控 MCP-like fixture（仿真 cat-cafe MCP 结构，不跑真实大文件）。
// ts.createSourceFile 只 parse 语法，fixture 里引用的标识符无需真实存在。
const FIXTURE: SourceFile[] = [
  {
    path: 'packages/mcp-server/src/tools/callback-tools.ts',
    content: `
      export const callbackTools = [
        { name: 'cat_cafe_post_message', description: 'd', inputSchema: postMessageInputSchema, handler: handlePostMessage },
        { name: 'cat_cafe_hold_ball', description: 'd', inputSchema: holdBallSchema, handler: handleHoldBall },
      ] as const;
    `,
  },
  {
    path: 'packages/mcp-server/src/tools/memory-tools.ts',
    content: `
      export const memoryTools = [
        { name: 'cat_cafe_search_evidence', description: 'd', inputSchema: searchSchema, handler: handleSearch },
      ];
    `,
  },
  {
    path: 'packages/mcp-server/src/server-toolsets.ts',
    content: `
      export const READONLY_ALLOWED_TOOLS = new Set([
        'cat_cafe_search_evidence',
      ]);
      export const AGENT_KEY_TOOLS = new Set([
        'cat_cafe_post_message',
        'cat_cafe_hold_ball',
        'cat_cafe_ghost_tool',
      ]);
      export const DESKTOP_FABLE_PHASE0_ALLOWED_TOOLS = new Set([
        'cat_cafe_post_message',
      ]);
      export const KNOWN_DESKTOP_MODES = new Set([
        'fable-phase0',
      ]);
      const COLLAB_TOOL_SOURCES = [
        ...callbackTools,
        ...memoryTools,
      ];
    `,
  },
];

test('抽取 mcp_tool nodes + 权限面 metadata（来自白名单）', () => {
  const r = mcpToolPlugin.extract({ repo: 'cat-cafe', files: FIXTURE });
  const tools = r.nodes.filter((n) => n.kind === 'mcp_tool');
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, ['cat_cafe_hold_ball', 'cat_cafe_post_message', 'cat_cafe_search_evidence']);
  const post = tools.find((t) => t.name === 'cat_cafe_post_message')!;
  assert.deepEqual(post.metadata?.permissions, ['agent-key', 'desktop-fable']);
  const search = tools.find((t) => t.name === 'cat_cafe_search_evidence')!;
  assert.deepEqual(search.metadata?.permissions, ['readonly']);
  // source span 可追
  assert.match(post.filePath!, /callback-tools\.ts/);
  assert.ok((post.startLine ?? 0) > 0);
});

test('scopeKey 消歧：复合键含 name，id 非裸 display name（砚砚 OQ-2）', () => {
  const r = mcpToolPlugin.extract({ repo: 'cat-cafe', files: FIXTURE });
  const post = r.nodes.find((n) => n.name === 'cat_cafe_post_message' && n.kind === 'mcp_tool')!;
  // 复合键：repo|pkg|lang|file|kind|domain|name
  assert.match(
    post.scopeKey,
    /^cat-cafe\|mcp-server\|ts\|packages\/mcp-server\/src\/tools\/callback-tools\.ts\|mcp_tool\|mcp-tool\|cat_cafe_post_message$/,
  );
  assert.notEqual(post.id, 'cat_cafe_post_message');
  // 同 file 同 kind 的两个 tool 不撞 id
  const hold = r.nodes.find((n) => n.name === 'cat_cafe_hold_ball' && n.kind === 'mcp_tool')!;
  assert.notEqual(post.id, hold.id);
});

test('registers 边：spread 链（...callbackTools）是 grep 漏的结构关联，带 provenance', () => {
  const r = mcpToolPlugin.extract({ repo: 'cat-cafe', files: FIXTURE });
  const group = r.nodes.find((n) => n.kind === 'toolset_group' && n.name === 'COLLAB_TOOL_SOURCES');
  assert.ok(group, '应有 COLLAB_TOOL_SOURCES toolset_group 节点');
  const post = r.nodes.find((n) => n.name === 'cat_cafe_post_message' && n.kind === 'mcp_tool')!;
  const reg = r.edges.find((e) => e.kind === 'registers' && e.source === group!.id && e.target === post.id);
  assert.ok(
    reg,
    'COLLAB_TOOL_SOURCES 经 spread 链 registers post_message（grep 在 server-toolsets.ts 找不到该 tool 字面量）',
  );
  assert.equal(reg!.provenance.extractor, 'mcp-tool-extractor');
  assert.equal(reg!.provenance.confidence, 'static');
  assert.equal(reg!.provenance.sourceFile, 'packages/mcp-server/src/server-toolsets.ts');
  // memoryTools 也被 spread → search_evidence 也注册
  const search = r.nodes.find((n) => n.name === 'cat_cafe_search_evidence' && n.kind === 'mcp_tool')!;
  assert.ok(
    r.edges.some((e) => e.kind === 'registers' && e.source === group!.id && e.target === search.id),
    'memoryTools spread 链也建 registers',
  );
});

test('gap：白名单引用了未定义的 tool，显式报 gap（不静默 0 命中，AC-B2）', () => {
  const r = mcpToolPlugin.extract({ repo: 'cat-cafe', files: FIXTURE });
  const ghost = r.gaps.find((g) => g.reason.includes('cat_cafe_ghost_tool'));
  assert.ok(ghost, '白名单引用但无定义的 tool 必须报 gap');
  assert.equal(ghost!.domainId, 'mcp-tool');
});

test('gap：非 tool permission 白名单的 Set 成员不应报 undefined MCP tool', () => {
  const r = mcpToolPlugin.extract({ repo: 'cat-cafe', files: FIXTURE });
  assert.equal(
    r.gaps.some((g) => g.reason.includes('fable-phase0')),
    false,
    'KNOWN_DESKTOP_MODES 不是 tool whitelist，不应被当成缺失 MCP tool',
  );
});

test('consumer 文件影响 consumes edge，因此属于 invalidation scope 且标注 consumerKind', () => {
  assert.equal(mcpToolPlugin.invalidationScope('packages/api/src/routes/callback-a2a-trigger.ts'), true);
  assert.equal(mcpToolPlugin.invalidationScope('packages/api/src/routes/callback-a2a-trigger.test.ts'), true);
  assert.equal(mcpToolPlugin.invalidationScope('packages/web/src/components/ToolCall.tsx'), true);
  assert.equal(mcpToolPlugin.invalidationScope('packages/mcp-server/test/tool-registration.test.js'), true);
  assert.equal(mcpToolPlugin.invalidationScope('packages/mcp-server/test/tool-registration.mjs'), true);
  assert.equal(mcpToolPlugin.invalidationScope('packages/mcp-server/test/tool-registration.cjs'), true);
  assert.ok(
    mcpToolPlugin.extractorInputs.globs.includes('packages/**/*.tsx'),
    'TSX invalidation scope must be paired with a TSX extractor input glob',
  );
  assert.ok(
    mcpToolPlugin.extractorInputs.globs.includes('packages/**/*.js'),
    'JS invalidation scope must be paired with a JS extractor input glob',
  );
  assert.ok(
    mcpToolPlugin.extractorInputs.globs.includes('packages/**/*.mjs'),
    'MJS invalidation scope must be paired with an MJS extractor input glob',
  );
  assert.ok(
    mcpToolPlugin.extractorInputs.globs.includes('packages/**/*.cjs'),
    'CJS invalidation scope must be paired with a CJS extractor input glob',
  );

  const r = mcpToolPlugin.extract({
    repo: 'cat-cafe',
    files: [
      ...FIXTURE,
      {
        path: 'packages/api/src/routes/callback-a2a-trigger.ts',
        content: `
          export const toolName = 'cat_cafe_post_message';
        `,
      },
      {
        path: 'packages/api/src/routes/callback-a2a-trigger.test.ts',
        content: `
          test('uses tool', () => expect('cat_cafe_post_message').toBeTruthy());
        `,
      },
      {
        path: 'packages/web/src/components/ToolCall.tsx',
        content: `
          export function ToolCall() {
            return <span>{'cat_cafe_post_message'}</span>;
          }
        `,
      },
      {
        path: 'packages/mcp-server/test/tool-registration.test.js',
        content: `
          test('uses tool', () => expect('cat_cafe_post_message').toBeTruthy());
        `,
      },
      {
        path: 'packages/mcp-server/test/tool-registration.mjs',
        content: `
          export const toolName = 'cat_cafe_post_message';
        `,
      },
      {
        path: 'packages/mcp-server/test/tool-registration.cjs',
        content: `
          module.exports = { toolName: 'cat_cafe_post_message' };
        `,
      },
    ],
  });

  const prodConsumer = r.nodes.find(
    (n) => n.kind === 'tool_consumer' && n.filePath?.endsWith('callback-a2a-trigger.ts'),
  );
  const testConsumer = r.nodes.find(
    (n) => n.kind === 'tool_consumer' && n.filePath?.endsWith('callback-a2a-trigger.test.ts'),
  );
  const tsxConsumer = r.nodes.find((n) => n.kind === 'tool_consumer' && n.filePath?.endsWith('ToolCall.tsx'));
  const jsTestConsumer = r.nodes.find(
    (n) => n.kind === 'tool_consumer' && n.filePath?.endsWith('tool-registration.test.js'),
  );
  const mjsConsumer = r.nodes.find((n) => n.kind === 'tool_consumer' && n.filePath?.endsWith('tool-registration.mjs'));
  const cjsConsumer = r.nodes.find((n) => n.kind === 'tool_consumer' && n.filePath?.endsWith('tool-registration.cjs'));
  assert.equal(prodConsumer?.metadata?.consumerKind, 'production');
  assert.equal(testConsumer?.metadata?.consumerKind, 'test');
  assert.equal(tsxConsumer?.metadata?.consumerKind, 'production');
  assert.equal(jsTestConsumer?.metadata?.consumerKind, 'test');
  assert.equal(mjsConsumer?.metadata?.consumerKind, 'test');
  assert.equal(cjsConsumer?.metadata?.consumerKind, 'test');
  assert.equal(jsTestConsumer?.lang, 'js');
  assert.equal(mjsConsumer?.lang, 'js');
  assert.equal(cjsConsumer?.lang, 'js');

  const tsxEdge = r.edges.find((e) => e.kind === 'consumes' && e.source === tsxConsumer?.id);
  assert.equal(tsxEdge?.provenance.sourceFile, 'packages/web/src/components/ToolCall.tsx');
  const jsEdge = r.edges.find((e) => e.kind === 'consumes' && e.source === jsTestConsumer?.id);
  assert.equal(jsEdge?.provenance.sourceFile, 'packages/mcp-server/test/tool-registration.test.js');
});

test('非 tool-definition helper 文件即使位于 tools 目录也会被扫描为 consumer', () => {
  const r = mcpToolPlugin.extract({
    repo: 'cat-cafe',
    files: [
      ...FIXTURE,
      {
        path: 'packages/mcp-server/src/tools/cross-post-suggestion-format.ts',
        content: `
          export function formatSuggestion() {
            return 'cat_cafe_post_message';
          }
        `,
      },
    ],
  });

  const helperConsumer = r.nodes.find(
    (n) => n.kind === 'tool_consumer' && n.filePath?.endsWith('cross-post-suggestion-format.ts'),
  );
  assert.equal(helperConsumer?.metadata?.consumerKind, 'production');

  const post = r.nodes.find((n) => n.kind === 'mcp_tool' && n.name === 'cat_cafe_post_message')!;
  assert.ok(
    r.edges.some((e) => e.kind === 'consumes' && e.source === helperConsumer?.id && e.target === post.id),
    'tools 目录里的非定义 helper 也应保留 consumes impact edge',
  );
});

test('tool 定义只从结构 MCP 文件抽取，非结构 MCP-like 数组不 shadow 真定义', () => {
  const r = mcpToolPlugin.extract({
    repo: 'cat-cafe',
    files: [
      {
        path: 'packages/api/src/fake-tool-array.ts',
        content: `
          const fakeTools = [
            { name: 'cat_cafe_post_message', inputSchema: fakeSchema, handler: fakeHandler },
          ];
        `,
      },
      ...FIXTURE,
    ],
  });

  const post = r.nodes.find((n) => n.kind === 'mcp_tool' && n.name === 'cat_cafe_post_message')!;
  assert.equal(post.filePath, 'packages/mcp-server/src/tools/callback-tools.ts');
  assert.equal(post.metadata?.array, 'callbackTools');
});

test('tool consumer scopeKey 使用 repo-relative path，避免同 package 同 basename 混淆', () => {
  const r = mcpToolPlugin.extract({
    repo: 'cat-cafe',
    files: [
      ...FIXTURE,
      {
        path: 'packages/api/src/admin/routes.ts',
        content: `
          export const toolName = 'cat_cafe_post_message';
        `,
      },
      {
        path: 'packages/api/src/public/routes.ts',
        content: `
          export const toolName = 'cat_cafe_post_message';
        `,
      },
    ],
  });

  const consumers = r.nodes.filter((n) => n.kind === 'tool_consumer' && n.name.includes('cat_cafe_post_message'));
  assert.equal(consumers.length, 2);
  assert.equal(new Set(consumers.map((n) => n.id)).size, 2);
  assert.ok(consumers.some((n) => n.scopeKey.includes('packages/api/src/admin/routes.ts')));
  assert.ok(consumers.some((n) => n.scopeKey.includes('packages/api/src/public/routes.ts')));

  const sourceFiles = r.edges
    .filter((e) => e.kind === 'consumes' && consumers.some((n) => n.id === e.source))
    .map((e) => e.provenance.sourceFile)
    .sort();
  assert.deepEqual(sourceFiles, ['packages/api/src/admin/routes.ts', 'packages/api/src/public/routes.ts']);
});

test('negative fixtures：同名非 tool 不被误抽 / 不误连（砚砚 OQ-2 hard 门禁）', () => {
  assert.ok(mcpToolPlugin.negativeFixtures.length > 0, 'plugin 必须自带 negative fixtures');
  for (const nf of mcpToolPlugin.negativeFixtures) {
    const r = mcpToolPlugin.extract({ repo: 'cat-cafe', files: nf.files });
    // `to`（同名非约定对象）不应被误抽成 mcp_tool
    const toAsTool = r.nodes.find((n) => n.name === nf.mustNotConnect.to && n.kind === 'mcp_tool');
    assert.equal(toAsTool, undefined, `同名非 tool 被误抽为 mcp_tool: ${nf.description}`);
    // 若两端都存在，它们之间不应有边
    const from = r.nodes.find((n) => n.name === nf.mustNotConnect.from);
    const to = r.nodes.find((n) => n.name === nf.mustNotConnect.to);
    if (from && to) {
      const connected = r.edges.some(
        (e) => (e.source === from.id && e.target === to.id) || (e.source === to.id && e.target === from.id),
      );
      assert.equal(connected, false, `negative fixture 被违反: ${nf.description}`);
    }
  }
});
