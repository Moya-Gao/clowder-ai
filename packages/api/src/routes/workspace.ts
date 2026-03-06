/**
 * Workspace Explorer Routes — F063
 *
 * GET  /api/workspace/worktrees — list git worktrees
 * GET  /api/workspace/tree      — directory tree (depth-limited)
 * GET  /api/workspace/file      — file content + sha256
 * POST /api/workspace/search    — content / filename search
 */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { promisify } from 'node:util';
import type { FastifyPluginAsync } from 'fastify';
import {
  getWorktreeRoot,
  isDenylisted,
  listWorktrees,
  resolveWorkspacePath,
  WorkspaceSecurityError,
} from '../domains/workspace/workspace-security.js';

const execFileAsync = promisify(execFile);
const MAX_FILE_SIZE = 1024 * 1024; // 1 MB
const MAX_SEARCH_RESULTS = 100;
const MAX_TREE_DEPTH = 5;

const MIME_MAP: Record<string, string> = {
  '.ts': 'text/typescript',
  '.tsx': 'text/tsx',
  '.js': 'text/javascript',
  '.jsx': 'text/jsx',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.css': 'text/css',
  '.html': 'text/html',
  '.svg': 'image/svg+xml',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.toml': 'text/toml',
  '.sh': 'text/x-shellscript',
  '.py': 'text/x-python',
};

function guessMime(filepath: string): string {
  return MIME_MAP[extname(filepath)] ?? 'text/plain';
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '.git', '.turbo', 'coverage']);

async function buildTree(root: string, dirPath: string, depth: number, maxDepth: number): Promise<TreeNode[]> {
  if (depth >= maxDepth) return [];
  const entries = await readdir(dirPath, { withFileTypes: true });
  const nodes: TreeNode[] = [];

  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    if (entry.name.startsWith('.') && entry.name !== '.claude') continue;
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = join(dirPath, entry.name);
    const relPath = relative(root, fullPath);

    if (entry.isDirectory()) {
      const children = await buildTree(root, fullPath, depth + 1, maxDepth);
      nodes.push({ name: entry.name, path: relPath, type: 'directory', children });
    } else {
      nodes.push({ name: entry.name, path: relPath, type: 'file' });
    }
  }
  return nodes;
}

export const workspaceRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/workspace/worktrees
  app.get('/api/workspace/worktrees', async () => {
    const entries = await listWorktrees();
    return { worktrees: entries };
  });

  // GET /api/workspace/tree?worktreeId=&path=&depth=
  app.get<{
    Querystring: { worktreeId?: string; path?: string; depth?: string };
  }>('/api/workspace/tree', async (request, reply) => {
    const { worktreeId, path: subpath, depth: depthStr } = request.query;
    if (!worktreeId) {
      reply.status(400);
      return { error: 'worktreeId required' };
    }

    const depth = Math.min(Number(depthStr ?? 3), MAX_TREE_DEPTH);

    try {
      const root = await getWorktreeRoot(worktreeId);
      const resolved = subpath ? await resolveWorkspacePath(root, subpath) : root;
      const tree = await buildTree(root, resolved, 0, depth);
      return { root: subpath || '.', worktreeId, tree };
    } catch (e) {
      if (e instanceof WorkspaceSecurityError) {
        reply.status(e.code === 'NOT_FOUND' ? 404 : 403);
        return { error: e.message };
      }
      reply.status(500);
      return { error: 'Internal error' };
    }
  });

  // GET /api/workspace/file?worktreeId=&path=
  app.get<{
    Querystring: { worktreeId?: string; path?: string };
  }>('/api/workspace/file', async (request, reply) => {
    const { worktreeId, path: filePath } = request.query;
    if (!worktreeId || !filePath) {
      reply.status(400);
      return { error: 'worktreeId and path required' };
    }

    try {
      const root = await getWorktreeRoot(worktreeId);
      const resolved = await resolveWorkspacePath(root, filePath);
      const fileStat = await stat(resolved);

      if (fileStat.isDirectory()) {
        reply.status(400);
        return { error: 'Path is a directory' };
      }

      const mime = guessMime(resolved);
      const isBinary = mime.startsWith('image/');

      if (isBinary) {
        return {
          path: filePath,
          content: '',
          sha256: '',
          size: fileStat.size,
          mime,
          truncated: false,
          binary: true,
        };
      }

      const truncated = fileStat.size > MAX_FILE_SIZE;
      const content = await readFile(resolved, 'utf-8');
      const displayContent = truncated ? content.slice(0, MAX_FILE_SIZE) : content;

      return {
        path: filePath,
        content: displayContent,
        sha256: sha256(content),
        size: fileStat.size,
        mime,
        truncated,
      };
    } catch (e) {
      if (e instanceof WorkspaceSecurityError) {
        reply.status(e.code === 'NOT_FOUND' ? 404 : 403);
        return { error: e.message };
      }
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        reply.status(404);
        return { error: 'File not found' };
      }
      reply.status(500);
      return { error: 'Internal error' };
    }
  });

  // POST /api/workspace/search { worktreeId, query, type?, limit? }
  app.post<{
    Body: { worktreeId: string; query: string; type?: 'content' | 'filename'; limit?: number };
  }>('/api/workspace/search', async (request, reply) => {
    const { worktreeId, query, type, limit: rawLimit } = request.body ?? {};
    if (!worktreeId || !query) {
      reply.status(400);
      return { error: 'worktreeId and query required' };
    }
    if (query.length > 200) {
      reply.status(400);
      return { error: 'Query too long (max 200 chars)' };
    }

    const limit = Math.min(rawLimit ?? 50, MAX_SEARCH_RESULTS);

    try {
      const root = await getWorktreeRoot(worktreeId);

      if (type === 'filename') {
        const { stdout } = await execFileAsync(
          'find',
          [
            root,
            '-type',
            'f',
            '-name',
            `*${query}*`,
            '-not',
            '-path',
            '*/node_modules/*',
            '-not',
            '-path',
            '*/.git/*',
            '-not',
            '-path',
            '*/.next/*',
            '-not',
            '-path',
            '*/dist/*',
            '-not',
            '-path',
            '*/secrets/*',
            '-not',
            '-name',
            '.env*',
            '-not',
            '-name',
            '*.pem',
            '-not',
            '-name',
            '*.key',
            '-not',
            '-name',
            'id_rsa*',
          ],
          { timeout: 5000, maxBuffer: 1024 * 1024 },
        );

        const results = stdout
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((fullPath) => relative(root, fullPath))
          .filter((relPath) => !isDenylisted(relPath))
          .slice(0, limit)
          .map((relPath) => ({
            path: relPath,
            line: 0,
            content: '',
            contextBefore: '',
            contextAfter: '',
          }));

        return { query, results, totalMatches: results.length, truncated: false };
      }

      // Content search using grep -rn with context
      let grepOutput = '';
      try {
        const { stdout } = await execFileAsync(
          'grep',
          [
            '-rn',
            '-B2',
            '-A2',
            '--include=*.ts',
            '--include=*.tsx',
            '--include=*.js',
            '--include=*.jsx',
            '--include=*.json',
            '--include=*.md',
            '--include=*.css',
            '--include=*.html',
            '--include=*.yaml',
            '--include=*.yml',
            query,
            root,
          ],
          { timeout: 10000, maxBuffer: 5 * 1024 * 1024 },
        );
        grepOutput = stdout;
      } catch {
        // grep exits 1 when no matches — that's fine
      }

      const results: Array<{
        path: string;
        line: number;
        content: string;
        contextBefore: string;
        contextAfter: string;
      }> = [];

      const groups = grepOutput.split('--\n');
      for (const group of groups) {
        if (results.length >= limit) break;
        const lines = group.trim().split('\n').filter(Boolean);

        // Find the actual match line (not context lines which use -)
        const matchLine = lines.find((l) => {
          const m = l.match(/^(.+?):(\d+):/);
          return m != null;
        });
        if (!matchLine) continue;

        const match = matchLine.match(/^(.+?):(\d+):(.*)$/);
        if (!match) continue;

        const [, fullPath, lineStr, content] = match;
        const relPath = relative(root, fullPath!);

        if (relPath.includes('node_modules') || relPath.includes('.git') || isDenylisted(relPath)) continue;

        const matchIdx = lines.indexOf(matchLine);
        const beforeLines = lines.slice(0, matchIdx);
        const afterLines = lines.slice(matchIdx + 1);

        results.push({
          path: relPath,
          line: parseInt(lineStr!, 10),
          content: content!.trim(),
          contextBefore: beforeLines.map((l) => l.replace(/^.+?:\d+[:-]/, '')).join('\n'),
          contextAfter: afterLines.map((l) => l.replace(/^.+?:\d+[:-]/, '')).join('\n'),
        });
      }

      return {
        query,
        results,
        totalMatches: results.length,
        truncated: results.length >= limit,
      };
    } catch (e) {
      if (e instanceof WorkspaceSecurityError) {
        reply.status(e.code === 'NOT_FOUND' ? 404 : 403);
        return { error: e.message };
      }
      reply.status(500);
      return { error: 'Internal error' };
    }
  });
};
