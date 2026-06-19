/**
 * fastapi-route domain extractor（F242 Phase B 陌生 repo 骨架）。
 *
 * 目标不是完整 Python AST，而是先覆盖 deer-flow 暴露出的约定层：
 *  - `router = APIRouter(prefix="...")` → fastapi_router 节点
 *  - `@router.get/post/...("...")` → fastapi_route 节点
 *  - router declares route 边，带 source line provenance
 *
 * 漏识别要显式 gap，不能静默 0 命中。
 */
import type { ConventionEdge, ConventionNode } from '../engine.ts';
import type {
  ConventionDomainPlugin,
  ExtractCtx,
  ExtractResult,
  Gap,
  NegativeFixture,
  RawNodeIdentity,
} from '../plugin.ts';
import { standardScopeKey } from '../plugin.ts';

const DOMAIN_ID = 'fastapi-route';
const EXTRACTOR = 'fastapi-route-extractor';
const VERSION = '0.1.0';

const METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'options', 'head']);

function baseName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] ?? filePath;
}

function pkgOf(filePath: string): string {
  return filePath.split('/')[0] ?? 'unknown';
}

function namedStringArg(text: string, name: string): string | null {
  const m = text.match(new RegExp(`${name}\\s*=\\s*(['"])(.*?)\\1`));
  return m ? m[2]! : null;
}

function firstPositionalStringArg(text: string): string | null {
  const openParen = text.indexOf('(');
  if (openParen < 0) return null;
  const rest = text.slice(openParen + 1).trimStart();
  const quote = rest[0];
  if (quote !== '"' && quote !== "'") return null;
  const escapedQuote = quote === '"' ? '\\"' : "\\'";
  let value = '';
  for (let i = 1; i < rest.length; i += 1) {
    const ch = rest[i]!;
    if (ch === quote && rest[i - 1] !== '\\') return value;
    if (ch === quote && rest.slice(i - 1, i + 1) === escapedQuote) {
      value = value.slice(0, -1) + quote;
      continue;
    }
    value += ch;
  }
  return null;
}

function routePathArg(text: string): string | null {
  return namedStringArg(text, 'path') ?? firstPositionalStringArg(text);
}

function joinPath(prefix: string, path: string): string {
  if (!path) return prefix || '/';
  if (!prefix) return path.startsWith('/') ? path : `/${path}`;
  return `${prefix.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function parenDelta(line: string): number {
  return [...line].reduce((delta, ch) => {
    if (ch === '(') return delta + 1;
    if (ch === ')') return delta - 1;
    return delta;
  }, 0);
}

interface RouterDecl {
  name: string;
  prefix: string;
  line: number;
  node: ConventionNode;
}

interface RouteDecl {
  routerName: string;
  method: string;
  path: string;
  fullPath: string;
  line: number;
  handler?: string;
}

function findHandler(lines: readonly string[], from: number): string | undefined {
  for (let i = from; i < lines.length; i += 1) {
    const m = lines[i]!.match(/^\s*(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
    if (m) return m[1]!;
    if (/^\s*@/.test(lines[i]!)) continue;
    if (/^\S/.test(lines[i]!) && !/^\s*(?:async\s+)?def\s+/.test(lines[i]!)) return undefined;
  }
  return undefined;
}

function collectDecorator(lines: readonly string[], start: number): { text: string; end: number } {
  let text = lines[start]!;
  let depth = parenDelta(text);
  let end = start;
  while (depth > 0 && end + 1 < lines.length) {
    end += 1;
    text += `\n${lines[end]!}`;
    depth += parenDelta(lines[end]!);
  }
  return { text, end };
}

const NEGATIVE_FIXTURES: readonly NegativeFixture[] = [
  {
    description: '非 FastAPI decorator 不抽成 route',
    files: [
      {
        path: 'backend/app/random.py',
        content: `
class router:
    @staticmethod
    def get(path):
        return path
`,
      },
    ],
    mustNotConnect: { from: 'router', to: 'GET /x' },
  },
];

function extract(ctx: ExtractCtx): ExtractResult {
  const nodes: ConventionNode[] = [];
  const edges: ConventionEdge[] = [];
  const gaps: Gap[] = [];

  for (const f of ctx.files) {
    if (!f.path.endsWith('.py')) continue;
    const lines = f.content.split(/\r?\n/);
    const routers = new Map<string, RouterDecl>();
    let routeCount = 0;

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]!;
      const routerMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*APIRouter\((.*)\)\s*$/);
      if (!routerMatch) {
        if (/^\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*APIRouter\(/.test(line)) {
          gaps.push({
            domainId: DOMAIN_ID,
            reason: `检测到暂不支持的多行 APIRouter 声明: ${baseName(f.path)}:${i + 1}`,
            filePath: f.path,
          });
        }
        continue;
      }
      const name = routerMatch[1]!;
      const prefix = namedStringArg(routerMatch[2]!, 'prefix') ?? '';
      const id: RawNodeIdentity = {
        repo: ctx.repo,
        pkg: pkgOf(f.path),
        lang: 'python',
        file: f.path,
        kind: 'fastapi_router',
        domainId: DOMAIN_ID,
        name,
      };
      const scopeKey = standardScopeKey(id);
      const node: ConventionNode = {
        id: scopeKey,
        domainId: DOMAIN_ID,
        kind: 'fastapi_router',
        name,
        scopeKey,
        filePath: f.path,
        startLine: i + 1,
        lang: 'python',
        metadata: { prefix },
      };
      routers.set(name, { name, prefix, line: i + 1, node });
      nodes.push(node);
    }

    for (let i = 0; i < lines.length; i += 1) {
      const start = lines[i]!;
      const routeMatch = start.match(/^\s*@([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
      if (!routeMatch) continue;
      const routerName = routeMatch[1]!;
      const method = routeMatch[2]!.toLowerCase();
      if (!METHODS.has(method)) continue;
      const { text, end } = collectDecorator(lines, i);
      const routePath = routePathArg(text);
      const router = routers.get(routerName);
      if (routePath === null || !router) {
        gaps.push({
          domainId: DOMAIN_ID,
          reason: `FastAPI route decorator 未能解析: ${baseName(f.path)}:${i + 1}`,
          filePath: f.path,
        });
        continue;
      }
      const route: RouteDecl = {
        routerName,
        method: method.toUpperCase(),
        path: routePath,
        fullPath: joinPath(router.prefix, routePath),
        line: i + 1,
        handler: findHandler(lines, end + 1),
      };
      routeCount += 1;

      const id: RawNodeIdentity = {
        repo: ctx.repo,
        pkg: pkgOf(f.path),
        lang: 'python',
        file: f.path,
        kind: 'fastapi_route',
        domainId: DOMAIN_ID,
        name: `${route.method} ${route.fullPath}`,
      };
      const scopeKey = standardScopeKey(id);
      const routeNode: ConventionNode = {
        id: scopeKey,
        domainId: DOMAIN_ID,
        kind: 'fastapi_route',
        name: id.name,
        scopeKey,
        filePath: f.path,
        startLine: route.line,
        lang: 'python',
        metadata: {
          router: route.routerName,
          method: route.method,
          path: route.fullPath,
          localPath: route.path,
          handler: route.handler,
        },
      };
      nodes.push(routeNode);
      edges.push({
        source: router.node.id,
        target: routeNode.id,
        kind: 'declares',
        domainId: DOMAIN_ID,
        provenance: {
          extractor: EXTRACTOR,
          extractorVersion: VERSION,
          sourceFile: f.path,
          sourceLine: route.line,
          confidence: 'static',
        },
      });
    }

    if (routers.size > 0 && routeCount === 0) {
      gaps.push({
        domainId: DOMAIN_ID,
        reason: `检测到 APIRouter 但未识别到支持的 route decorator: ${f.path}`,
        filePath: f.path,
      });
    }
  }

  return { nodes, edges, gaps };
}

export const fastapiRoutePlugin: ConventionDomainPlugin = {
  domainId: DOMAIN_ID,
  nodeKinds: ['fastapi_router', 'fastapi_route'],
  edgeKinds: ['declares'],
  scopeKey: standardScopeKey,
  extractorInputs: {
    globs: ['**/*.py'],
    needsTypeScript: false,
  },
  invalidationScope: (changedFile) => changedFile.endsWith('.py'),
  negativeFixtures: NEGATIVE_FIXTURES,
  extract,
};
