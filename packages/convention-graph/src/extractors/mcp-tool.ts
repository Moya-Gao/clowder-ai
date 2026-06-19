/**
 * mcp-tool domain extractor（F242 首个 domain plugin，dogfood domain 非方法论本体）。
 *
 * 抽取 cat-cafe MCP 约定：
 *  - tool 定义（tools/*.ts 的 `export const xxxTools = [{name, inputSchema, handler}]`）→ mcp_tool 节点
 *  - 权限面（server-toolsets.ts 三个白名单 Set）→ tool 节点的 permission metadata
 *  - 注册结构链（source group 的 `...spread`）→ registers 边
 *
 * 价值定位（对比 grep）：grep `cat_cafe_post_message` 在 server-toolsets.ts 找不到——
 * 那里只有 `...callbackTools` / `server.tool(tool.name)`。extractor 经 AST 理解
 * 「tool 定义 → spread 聚合 → group」这条 grep 表达不出的约定链，每条边带 provenance。
 *
 * v0.1 scope（spike 第②步）：mcp_tool/toolset_group 节点 + registers 边 + 权限面 + gap。
 * `consumes`（业务消费方扫描，dogfood code_consumers）留第③步专做，此处不虚标 edgeKind。
 */
import ts from 'typescript';
import type { ConventionEdge, ConventionNode } from '../engine.ts';
import type { ConventionDomainPlugin, ExtractCtx, ExtractResult, Gap, RawNodeIdentity } from '../plugin.ts';
import { standardScopeKey } from '../plugin.ts';
import {
  baseName,
  consumerKind,
  extractSpreadGroup,
  extractToolArray,
  extractWhitelist,
  isStructuralMcpFile,
  isToolDefinitionFile,
  isToolsetFile,
  langOf,
  lineOf,
  NEGATIVE_FIXTURES,
  pkgOf,
  type RawGroup,
} from './mcp-tool-helpers.ts';

const DOMAIN_ID = 'mcp-tool';
const EXTRACTOR = 'mcp-tool-extractor';
const VERSION = '0.1.0';

// 白名单变量名 → 权限面标签（Explore 实测 server-toolsets.ts 的三个 Set）
const PERMISSION_BY_WHITELIST: Record<string, string> = {
  READONLY_ALLOWED_TOOLS: 'readonly',
  AGENT_KEY_TOOLS: 'agent-key',
  DESKTOP_FABLE_PHASE0_ALLOWED_TOOLS: 'desktop-fable',
};
const PERMISSION_ORDER = ['readonly', 'agent-key', 'desktop-fable'];

// ---------- main extract ----------

function extract(ctx: ExtractCtx): ExtractResult {
  const nodes: ConventionNode[] = [];
  const edges: ConventionEdge[] = [];
  const gaps: Gap[] = [];

  const toolNodeByName = new Map<string, ConventionNode>();
  const toolNamesInArray = new Map<string, string[]>(); // arrayVar → [tool name]
  const permissionsByName = new Map<string, Set<string>>();
  const whitelistRefs: { name: string; file: string }[] = [];
  const groups: RawGroup[] = [];
  const structuralConsumerSkipFiles = new Set<string>();

  // 单遍 AST：收集 tool 定义 / 白名单 / spread group（group 处理延后到全收集完，跨文件 spread 不依赖文件顺序）
  for (const f of ctx.files) {
    if (!isStructuralMcpFile(f.path)) continue;
    if (isToolsetFile(f.path)) structuralConsumerSkipFiles.add(f.path);
    const sf = ts.createSourceFile(f.path, f.content, ts.ScriptTarget.Latest, true);
    for (const stmt of sf.statements) {
      if (!ts.isVariableStatement(stmt)) continue;
      for (const decl of stmt.declarationList.declarations) {
        if (isToolDefinitionFile(f.path)) {
          const arr = extractToolArray(sf, decl);
          if (!arr) continue;
          structuralConsumerSkipFiles.add(f.path);
          for (const t of arr.tools) {
            if (toolNodeByName.has(t.name)) continue;
            const id: RawNodeIdentity = {
              repo: ctx.repo,
              pkg: pkgOf(f.path),
              lang: 'ts',
              file: f.path,
              kind: 'mcp_tool',
              domainId: DOMAIN_ID,
              name: t.name,
            };
            const scopeKey = standardScopeKey(id);
            const node: ConventionNode = {
              id: scopeKey,
              domainId: DOMAIN_ID,
              kind: 'mcp_tool',
              name: t.name,
              scopeKey,
              filePath: f.path,
              startLine: t.line,
              lang: 'ts',
              metadata: { array: arr.arrayVar, hasSchema: t.hasSchema, hasHandler: t.hasHandler },
            };
            nodes.push(node);
            toolNodeByName.set(t.name, node);
          }
          toolNamesInArray.set(arr.arrayVar, [
            ...(toolNamesInArray.get(arr.arrayVar) ?? []),
            ...arr.tools.map((t) => t.name),
          ]);
          continue;
        }
        if (!isToolsetFile(f.path)) continue;
        const wl = extractWhitelist(decl);
        if (wl) {
          const perm = PERMISSION_BY_WHITELIST[wl.name];
          if (perm) {
            for (const m of wl.members) {
              whitelistRefs.push({ name: m, file: f.path });
              const permissions = permissionsByName.get(m) ?? new Set<string>();
              permissions.add(perm);
              permissionsByName.set(m, permissions);
            }
          }
          continue;
        }
        const grp = extractSpreadGroup(sf, decl);
        if (grp) groups.push({ ...grp, file: f.path });
      }
    }
  }

  // 回填权限面
  for (const node of nodes) {
    const permissions = permissionsByName.get(node.name);
    if (permissions?.size) {
      node.metadata = {
        ...node.metadata,
        permissions: PERMISSION_ORDER.filter((p) => permissions.has(p)),
      };
    }
  }

  // toolset_group 节点 + registers 边（spread 链：group → 经 array → tool）
  for (const grp of groups) {
    const registeredNames = grp.spreads.flatMap((arrVar) => toolNamesInArray.get(arrVar) ?? []);
    if (registeredNames.length === 0) continue; // spread 的不是 tool array，跳过
    const gid: RawNodeIdentity = {
      repo: ctx.repo,
      pkg: pkgOf(grp.file),
      lang: 'ts',
      file: grp.file,
      kind: 'toolset_group',
      domainId: DOMAIN_ID,
      name: grp.name,
    };
    const gScopeKey = standardScopeKey(gid);
    const groupNode: ConventionNode = {
      id: gScopeKey,
      domainId: DOMAIN_ID,
      kind: 'toolset_group',
      name: grp.name,
      scopeKey: gScopeKey,
      filePath: grp.file,
      startLine: grp.line,
      lang: 'ts',
      metadata: { spreads: grp.spreads },
    };
    nodes.push(groupNode);
    for (const tname of registeredNames) {
      const toolNode = toolNodeByName.get(tname);
      if (!toolNode) continue;
      edges.push({
        source: groupNode.id,
        target: toolNode.id,
        kind: 'registers',
        domainId: DOMAIN_ID,
        provenance: {
          extractor: EXTRACTOR,
          extractorVersion: VERSION,
          sourceFile: grp.file,
          sourceLine: grp.line,
          confidence: 'static',
        },
      });
    }
  }

  // 外部代码中引用 tool name 字符串 → tool_consumer 节点 + consumes 边。
  // 结构源文件（tool 定义 / 白名单 / spread group）已经由上面的 registers/metadata 表达，
  // 这里跳过，避免把定义处字面量误报成“业务消费方”。
  const consumerSeen = new Set<string>();
  for (const f of ctx.files) {
    if (structuralConsumerSkipFiles.has(f.path)) continue;
    const sf = ts.createSourceFile(f.path, f.content, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (ts.isStringLiteralLike(node)) {
        const tool = toolNodeByName.get(node.text);
        if (tool) {
          const line = lineOf(sf, node);
          const key = `${f.path}:${line}:${node.text}`;
          if (!consumerSeen.has(key)) {
            consumerSeen.add(key);
            const lang = langOf(f.path);
            const cid: RawNodeIdentity = {
              repo: ctx.repo,
              pkg: pkgOf(f.path),
              lang,
              file: f.path,
              kind: 'tool_consumer',
              domainId: DOMAIN_ID,
              name: `${baseName(f.path)}:${line}:${node.text}`,
            };
            const scopeKey = standardScopeKey(cid);
            const consumerNode: ConventionNode = {
              id: scopeKey,
              domainId: DOMAIN_ID,
              kind: 'tool_consumer',
              name: cid.name,
              scopeKey,
              filePath: f.path,
              startLine: line,
              lang,
              metadata: { toolName: node.text, consumerKind: consumerKind(f.path) },
            };
            nodes.push(consumerNode);
            edges.push({
              source: consumerNode.id,
              target: tool.id,
              kind: 'consumes',
              domainId: DOMAIN_ID,
              provenance: {
                extractor: EXTRACTOR,
                extractorVersion: VERSION,
                sourceFile: f.path,
                sourceLine: line,
                confidence: 'static',
              },
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  // gap：白名单引用但未定义的 tool（不静默 0 命中，砚砚 OQ-5 / AC-B2）
  const reported = new Set<string>();
  for (const ref of whitelistRefs) {
    if (toolNodeByName.has(ref.name) || reported.has(ref.name)) continue;
    reported.add(ref.name);
    gaps.push({
      domainId: DOMAIN_ID,
      reason: `白名单引用了未定义的 tool: ${ref.name}（白名单声明但 tools/*.ts 无对应定义）`,
      filePath: ref.file,
    });
  }

  return { nodes, edges, gaps };
}

export const mcpToolPlugin: ConventionDomainPlugin = {
  domainId: DOMAIN_ID,
  nodeKinds: ['mcp_tool', 'toolset_group', 'tool_consumer'],
  edgeKinds: ['registers', 'consumes'],
  scopeKey: standardScopeKey,
  extractorInputs: {
    globs: [
      'packages/mcp-server/src/server-toolsets.ts',
      'packages/mcp-server/src/tools/*.ts',
      'packages/**/*.ts',
      'packages/**/*.tsx',
      'packages/**/*.js',
      'packages/**/*.mjs',
      'packages/**/*.cjs',
    ],
    needsTypeScript: true,
  },
  invalidationScope: (changedFile) =>
    /^packages\/.*\.(?:tsx?|[cm]?js)$/.test(changedFile) ||
    /\/server-toolsets\.ts$/.test(changedFile) ||
    /\/tools\/[^/]+\.ts$/.test(changedFile),
  negativeFixtures: NEGATIVE_FIXTURES,
  extract,
};
