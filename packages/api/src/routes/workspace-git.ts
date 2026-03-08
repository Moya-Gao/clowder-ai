/**
 * Workspace Git Routes — F082 Git Health Panel
 *
 * GET  /api/workspace/git-log     — commit history
 * GET  /api/workspace/git-status  — working tree status (staged/unstaged/untracked)
 * GET  /api/workspace/git-show    — single commit changed-file summary
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { FastifyPluginAsync } from 'fastify';
import { WorkspaceSecurityError, getWorktreeRoot } from '../domains/workspace/workspace-security.js';

const execFileAsync = promisify(execFile);

// ── Parsers (exported for unit testing) ─────────────────────────────

export interface GitCommit {
  hash: string;
  short: string;
  author: string;
  date: string;
  subject: string;
}

export function parseGitLog(stdout: string): GitCommit[] {
  if (!stdout.trim()) return [];
  return stdout
    .trim()
    .split('\n')
    .map((line) => {
      const [hash = '', author = '', date = '', ...subjectParts] = line.split('\0');
      return { hash, short: hash.slice(0, 8), author, date, subject: subjectParts.join('\0') };
    });
}

export interface GitStatusResult {
  staged: Array<{ status: string; path: string }>;
  unstaged: Array<{ status: string; path: string }>;
  untracked: Array<{ status: string; path: string }>;
}

function classifyStatusLine(
  line: string,
): { category: 'staged' | 'unstaged' | 'untracked'; status: string; path: string }[] {
  if (line.length < 4) return [];
  const x = line[0] ?? ' ';
  const y = line[1] ?? ' ';
  const filePath = line.slice(3);
  if (x === '?' && y === '?') return [{ category: 'untracked', status: '??', path: filePath }];
  const entries: { category: 'staged' | 'unstaged'; status: string; path: string }[] = [];
  if (x !== ' ' && x !== '?') entries.push({ category: 'staged', status: x, path: filePath });
  if (y !== ' ' && y !== '?') entries.push({ category: 'unstaged', status: y, path: filePath });
  return entries;
}

export function parseGitStatus(stdout: string): GitStatusResult {
  const result: GitStatusResult = { staged: [], unstaged: [], untracked: [] };
  if (!stdout.trim()) return result;
  for (const line of stdout.trim().split('\n')) {
    for (const entry of classifyStatusLine(line)) {
      result[entry.category].push({ status: entry.status, path: entry.path });
    }
  }
  return result;
}

export function parseGitShow(statOutput: string): Array<{ path: string; summary: string }> {
  return statOutput
    .trim()
    .split('\n')
    .filter((l) => l.includes('|'))
    .map((l) => {
      const [pathPart, ...rest] = l.split('|');
      return { path: (pathPart ?? '').trim(), summary: rest.join('|').trim() };
    });
}

// ── Routes ──────────────────────────────────────────────────────────

export const workspaceGitRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/workspace/git-log
  app.get<{
    Querystring: { worktreeId?: string; limit?: string };
  }>('/api/workspace/git-log', async (request, reply) => {
    const { worktreeId, limit = '50' } = request.query;
    if (!worktreeId) {
      reply.status(400);
      return { error: 'worktreeId required' };
    }
    try {
      const root = await getWorktreeRoot(worktreeId);
      const n = Math.min(Math.max(1, Number(limit) || 50), 200);
      const { stdout } = await execFileAsync('git', ['log', '-n', String(n), '--pretty=format:%H%x00%an%x00%aI%x00%s'], {
        cwd: root,
        timeout: 5000,
      });
      return { worktreeId, commits: parseGitLog(stdout) };
    } catch (e) {
      if (e instanceof WorkspaceSecurityError) {
        reply.status(e.code === 'NOT_FOUND' ? 404 : 403);
        return { error: e.message };
      }
      throw e;
    }
  });

  // GET /api/workspace/git-status
  app.get<{
    Querystring: { worktreeId?: string };
  }>('/api/workspace/git-status', async (request, reply) => {
    const { worktreeId } = request.query;
    if (!worktreeId) {
      reply.status(400);
      return { error: 'worktreeId required' };
    }
    try {
      const root = await getWorktreeRoot(worktreeId);
      const { stdout } = await execFileAsync('git', ['status', '--porcelain', '-uall'], {
        cwd: root,
        timeout: 5000,
        maxBuffer: 1024 * 1024,
      });
      const { stdout: branchOut } = await execFileAsync('git', ['branch', '--show-current'], {
        cwd: root,
        timeout: 3000,
      });
      return { worktreeId, branch: branchOut.trim(), ...parseGitStatus(stdout) };
    } catch (e) {
      if (e instanceof WorkspaceSecurityError) {
        reply.status(e.code === 'NOT_FOUND' ? 404 : 403);
        return { error: e.message };
      }
      throw e;
    }
  });

  // GET /api/workspace/git-show
  app.get<{
    Querystring: { worktreeId?: string; hash?: string };
  }>('/api/workspace/git-show', async (request, reply) => {
    const { worktreeId, hash } = request.query;
    if (!worktreeId || !hash) {
      reply.status(400);
      return { error: 'worktreeId and hash required' };
    }
    if (!/^[0-9a-f]{7,40}$/i.test(hash)) {
      reply.status(400);
      return { error: 'invalid hash' };
    }
    try {
      const root = await getWorktreeRoot(worktreeId);
      const { stdout } = await execFileAsync('git', ['show', '--stat', '--no-color', hash], { cwd: root, timeout: 5000 });
      const parts = stdout.split('\n\n');
      const statSection = parts.length > 1 ? parts.slice(1).join('\n\n') : '';
      return { worktreeId, hash, files: parseGitShow(statSection) };
    } catch (e) {
      if (e instanceof WorkspaceSecurityError) {
        reply.status(e.code === 'NOT_FOUND' ? 404 : 403);
        return { error: e.message };
      }
      throw e;
    }
  });
};
