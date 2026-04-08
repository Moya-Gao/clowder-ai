/**
 * CatAgent Tool Registry — F152: Thin Agent Runtime
 *
 * Spike tools: read-only file operations only.
 * Permission whitelist: all registered tools are 'allow' (read-only).
 * Write/exec tools will be added in Phase 2 with permission state machine.
 */

import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import type { CatAgentTool } from './catagent-types.js';

/** Create the spike tool registry (read-only tools) */
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

/** Get Anthropic tool schemas from registry */
export function getToolSchemas(registry: Map<string, CatAgentTool>): Anthropic.Messages.Tool[] {
  return [...registry.values()].map((t) => t.schema);
}

// --- Tool implementations ---

function resolvePath(workingDirectory: string, filePath: string): string {
  const resolved = resolve(workingDirectory, filePath);
  // Basic path traversal guard: must stay within working directory
  if (!resolved.startsWith(resolve(workingDirectory))) {
    throw new Error(`Path traversal blocked: ${filePath}`);
  }
  return resolved;
}

async function executeReadFile(cwd: string, input: Record<string, unknown>): Promise<string> {
  const filePath = resolvePath(cwd, String(input.path ?? ''));
  const limit = Number(input.limit ?? 200);
  const offset = Number(input.offset ?? 0);

  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  const sliced = lines.slice(offset, offset + limit);
  return sliced.map((line, i) => `${offset + i + 1}\t${line}`).join('\n');
}

async function executeListFiles(cwd: string, input: Record<string, unknown>): Promise<string> {
  const dirPath = resolvePath(cwd, String(input.path ?? '.'));
  const pattern = input.pattern ? String(input.pattern) : undefined;

  const entries = await readdir(dirPath, { withFileTypes: true });
  let names = entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));

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
  const searchPath = resolvePath(cwd, String(input.path ?? '.'));
  const glob = input.glob ? String(input.glob) : undefined;

  const args = ['--files-with-matches', '--max-count=1', '-r'];
  if (glob) args.push('--glob', glob);
  args.push(pattern, searchPath);

  try {
    const { stdout } = await execFileAsync('rg', args, { timeout: 10_000, maxBuffer: 512 * 1024 });
    const lines = stdout.trim().split('\n').slice(0, 50);
    return lines.join('\n') || '(no matches)';
  } catch {
    return '(no matches or rg not available)';
  }
}
