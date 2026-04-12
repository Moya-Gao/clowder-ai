/**
 * CatAgent Tool Registry — F159: Native Provider Security Baseline
 *
 * Read-only file operations with symlink-safe sandbox.
 * Path validation uses fs.realpath() double-check, following the
 * pattern from workspace-security.ts (resolveWorkspacePath).
 *
 * ADR-001 F159 boundary: no write/edit/delete, no shell/exec, no network tools.
 */

import { readdir, readFile, realpath } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { isDenylisted } from '../../../../../../domains/workspace/workspace-security.js';

/** Anthropic tool schema shape (inline to avoid SDK dependency in this slice) */
export interface ToolSchema {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: readonly string[] };
}

/** Tool permission level */
export type ToolPermission = 'allow' | 'deny';

/** A registered CatAgent tool */
export interface CatAgentTool {
  schema: ToolSchema;
  execute: (input: Record<string, unknown>) => Promise<string>;
  permission: ToolPermission;
}

/** Create the tool registry (read-only tools only per ADR-001 F159 boundary) */
export function createToolRegistry(workingDirectory: string): Map<string, CatAgentTool> {
  const registry = new Map<string, CatAgentTool>();

  registry.set('read_file', {
    schema: {
      name: 'read_file',
      description: 'Read the contents of a file. Returns the file content as text.',
      input_schema: {
        type: 'object' as const,
        properties: {
          path: { type: 'string', description: 'Absolute or relative file path' },
          limit: { type: 'number', description: 'Max lines to read (default: 200)' },
          offset: { type: 'number', description: 'Line offset to start from (default: 0)' },
        },
        required: ['path'],
      },
    },
    execute: async (input) => executeReadFile(workingDirectory, input),
    permission: 'allow',
  });

  registry.set('list_files', {
    schema: {
      name: 'list_files',
      description: 'List files in a directory. Returns file names, one per line.',
      input_schema: {
        type: 'object' as const,
        properties: {
          path: { type: 'string', description: 'Directory path (default: working directory)' },
          pattern: { type: 'string', description: 'Glob-like filter (e.g. "*.ts")' },
        },
        required: [],
      },
    },
    execute: async (input) => executeListFiles(workingDirectory, input),
    permission: 'allow',
  });

  registry.set('search_content', {
    schema: {
      name: 'search_content',
      description: 'Search for a pattern in files. Returns matching file paths.',
      input_schema: {
        type: 'object' as const,
        properties: {
          pattern: { type: 'string', description: 'Search pattern (regex supported)' },
          path: { type: 'string', description: 'Directory to search in (default: working directory)' },
          glob: { type: 'string', description: 'File glob filter (e.g. "*.ts")' },
        },
        required: ['pattern'],
      },
    },
    execute: async (input) => executeSearchContent(workingDirectory, input),
    permission: 'allow',
  });

  return registry;
}

/** Get tool schemas from registry */
export function getToolSchemas(registry: Map<string, CatAgentTool>): ToolSchema[] {
  return [...registry.values()].map((t) => t.schema);
}

// --- Path validation (symlink-safe) ---

/**
 * Resolve and validate a path within the working directory.
 * Three-stage check following workspace-security.ts pattern:
 * 1. Lexical: resolved path must be equal to or under root (with sep boundary)
 * 2. Denylist: reuses shared isDenylisted() from workspace-security.ts
 * 3. Physical: fs.realpath() both paths to catch symlink escapes
 *
 * Throws on traversal or symlink escape.
 */
export async function resolveSecurePath(workingDirectory: string, filePath: string): Promise<string> {
  const resolved = resolve(workingDirectory, filePath);
  const root = resolve(workingDirectory);

  // Stage 1: Lexical boundary check (use sep for cross-platform)
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    throw new Error(`Path traversal blocked: ${filePath}`);
  }

  // Stage 2: Denylist check — reuses shared isDenylisted() from workspace-security.ts
  const relPath = resolved.slice(root.length + 1);
  if (isDenylisted(relPath)) {
    throw new Error(`Access denied: ${filePath}`);
  }

  // Stage 3: Symlink escape check (realpath both to handle macOS /tmp → /private/tmp)
  try {
    const [realResolved, realRoot] = await Promise.all([realpath(resolved), realpath(root)]);
    if (realResolved !== realRoot && !realResolved.startsWith(realRoot + sep)) {
      throw new Error(`Symlink escape blocked: ${filePath}`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Symlink escape blocked')) throw e;
    if (e instanceof Error && e.message.startsWith('Path traversal blocked')) throw e;
    if (e instanceof Error && e.message.startsWith('Access denied')) throw e;
    // ENOENT = file doesn't exist yet; lexical check above covers it
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }

  return resolved;
}

// --- Tool implementations ---

async function executeReadFile(cwd: string, input: Record<string, unknown>): Promise<string> {
  const filePath = await resolveSecurePath(cwd, String(input.path ?? ''));
  const limit = Number(input.limit ?? 200);
  const offset = Number(input.offset ?? 0);

  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  const sliced = lines.slice(offset, offset + limit);
  return sliced.map((line, i) => `${offset + i + 1}\t${line}`).join('\n');
}

async function executeListFiles(cwd: string, input: Record<string, unknown>): Promise<string> {
  const dirPath = await resolveSecurePath(cwd, String(input.path ?? '.'));
  const pattern = input.pattern ? String(input.pattern) : undefined;

  const entries = await readdir(dirPath, { withFileTypes: true });
  let names = entries.filter((e) => !isDenylisted(e.name)).map((e) => (e.isDirectory() ? `${e.name}/` : e.name));

  if (pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
    names = names.filter((n) => regex.test(n));
  }
  return names.sort().join('\n') || '(empty directory)';
}

async function executeSearchContent(cwd: string, input: Record<string, unknown>): Promise<string> {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);

  const pattern = String(input.pattern);
  const searchPath = await resolveSecurePath(cwd, String(input.path ?? '.'));
  const glob = input.glob ? String(input.glob) : undefined;

  const args = ['--files-with-matches', '--max-count=1'];
  if (glob) args.push('--glob', glob);
  // Use -- to prevent pattern being parsed as rg flags (injection prevention)
  args.push('--', pattern, searchPath);

  try {
    const { stdout } = await execFileAsync('rg', args, { timeout: 10_000, maxBuffer: 512 * 1024 });
    const lines = stdout
      .trim()
      .split('\n')
      .filter((line) => !isDenylisted(relative(searchPath, line.trim())))
      .slice(0, 50);
    return lines.join('\n') || '(no matches)';
  } catch {
    return '(no matches or rg not available)';
  }
}
