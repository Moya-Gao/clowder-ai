import ts from 'typescript';
import type { NegativeFixture } from '../plugin.ts';

export function pkgOf(filePath: string): string {
  const m = filePath.match(/packages\/([^/]+)\//);
  return m ? m[1]! : 'unknown';
}

export function baseName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] ?? filePath;
}

export function isStructuralMcpFile(filePath: string): boolean {
  return isToolDefinitionFile(filePath) || isToolsetFile(filePath);
}

export function isToolDefinitionFile(filePath: string): boolean {
  return /packages\/mcp-server\/src\/tools\/[^/]+\.ts$/.test(filePath);
}

export function isToolsetFile(filePath: string): boolean {
  return /packages\/mcp-server\/src\/server-toolsets\.ts$/.test(filePath);
}

export function consumerKind(filePath: string): string {
  if (/(^|\/)(__tests__|tests?)\//.test(filePath) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(filePath)) {
    return 'test';
  }
  if (/^docs\//.test(filePath)) return 'doc';
  return 'production';
}

export function langOf(filePath: string): 'js' | 'ts' {
  return /\.[cm]?js$/.test(filePath) ? 'js' : 'ts';
}

export function lineOf(sf: ts.SourceFile, node: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

function unwrapExpression(expr: ts.Expression): ts.Expression {
  let current = expr;
  while (ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
}

function propKey(p: ts.ObjectLiteralElementLike): string | null {
  if (!ts.isPropertyAssignment(p) && !ts.isShorthandPropertyAssignment(p)) return null;
  const name = p.name;
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteralLike(name)) return name.text;
  return null;
}

interface RawTool {
  name: string;
  line: number;
  hasSchema: boolean;
  hasHandler: boolean;
}

export interface RawGroup {
  name: string;
  spreads: string[];
  file: string;
  line: number;
}

/**
 * 识别 tool 数组：`const xTools = [{ name: '...', inputSchema|handler ... }]`。
 * tool 约定 = name 字符串字面量 + (inputSchema 或 handler) —— 借此区分普通同名对象（negative 门禁）。
 */
export function extractToolArray(
  sf: ts.SourceFile,
  decl: ts.VariableDeclaration,
): { arrayVar: string; tools: RawTool[] } | null {
  if (!ts.isIdentifier(decl.name)) return null;
  const init = decl.initializer ? unwrapExpression(decl.initializer) : undefined;
  if (!init || !ts.isArrayLiteralExpression(init)) return null;
  const tools: RawTool[] = [];
  for (const el of init.elements) {
    if (!ts.isObjectLiteralExpression(el)) continue;
    let name: string | null = null;
    let hasSchema = false;
    let hasHandler = false;
    for (const p of el.properties) {
      const key = propKey(p);
      if (!key) continue;
      if (key === 'name' && ts.isPropertyAssignment(p) && ts.isStringLiteralLike(p.initializer)) {
        name = p.initializer.text;
      } else if (key === 'inputSchema') {
        hasSchema = true;
      } else if (key === 'handler') {
        hasHandler = true;
      }
    }
    if (name && (hasSchema || hasHandler)) {
      tools.push({ name, line: lineOf(sf, el), hasSchema, hasHandler });
    }
  }
  return tools.length ? { arrayVar: decl.name.text, tools } : null;
}

/** 识别权限白名单：`const NAME = new Set(['tool', ...])`。 */
export function extractWhitelist(decl: ts.VariableDeclaration): { name: string; members: string[] } | null {
  if (!ts.isIdentifier(decl.name)) return null;
  const init = decl.initializer ? unwrapExpression(decl.initializer) : undefined;
  if (!init || !ts.isNewExpression(init)) return null;
  if (!ts.isIdentifier(init.expression) || init.expression.text !== 'Set') return null;
  const arg = init.arguments?.[0];
  if (!arg || !ts.isArrayLiteralExpression(arg)) return null;
  const members = arg.elements.filter(ts.isStringLiteralLike).map((e) => e.text);
  return { name: decl.name.text, members };
}

/** 识别 source group：`const GROUP = [...arrA, ...arrB]`（spread 聚合，grep 漏的链）。 */
export function extractSpreadGroup(
  sf: ts.SourceFile,
  decl: ts.VariableDeclaration,
): { name: string; spreads: string[]; line: number } | null {
  if (!ts.isIdentifier(decl.name)) return null;
  const init = decl.initializer ? unwrapExpression(decl.initializer) : undefined;
  if (!init || !ts.isArrayLiteralExpression(init)) return null;
  const spreads: string[] = [];
  for (const el of init.elements) {
    if (ts.isSpreadElement(el) && ts.isIdentifier(el.expression)) {
      spreads.push(el.expression.text);
    }
  }
  return spreads.length ? { name: decl.name.text, spreads, line: lineOf(sf, init) } : null;
}

export const NEGATIVE_FIXTURES: readonly NegativeFixture[] = [
  {
    description: '同名 function / 非 *Tools 数组对象（缺 inputSchema+handler）不被误抽为 mcp_tool',
    files: [
      {
        path: 'packages/api/src/utils/post.ts',
        content: `
          // 恰好叫 post_message 的普通函数，不是 MCP tool
          export function post_message(text) { return text; }
          // 缺 inputSchema/handler 的对象数组，不是 tool 定义
          const notTools = [{ name: 'post_message' }];
        `,
      },
    ],
    mustNotConnect: { from: 'COLLAB_TOOL_SOURCES', to: 'post_message' },
  },
];
