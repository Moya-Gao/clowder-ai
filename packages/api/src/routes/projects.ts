/**
 * Project Directory Browser Routes
 * GET /api/projects/browse        - 浏览目录结构
 * GET /api/projects/cwd           - 获取服务器工作目录
 * POST /api/projects/pick-directory - (deprecated, use browse instead)
 */

import { readdir, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import type { FastifyPluginAsync } from 'fastify';
import { getAllowedRoots, isUnderAllowedRoot, validateProjectPath } from '../utils/project-path.js';
import { resolveUserId } from '../utils/request-identity.js';

export type PickDirectoryResult =
  | { status: 'picked'; path: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

/**
 * F113: Deprecated — previously used macOS osascript to open native folder picker.
 * The frontend now uses the web-based DirectoryBrowser (GET /api/projects/browse).
 * This function is kept for backward compatibility but returns an error directing
 * clients to use the browse endpoint instead.
 */
export async function execPickDirectory(): Promise<PickDirectoryResult> {
  return { status: 'error', message: 'Native picker unavailable. Use GET /api/projects/browse instead.' };
}

/** Swappable reference for testing — route calls this instead of execPickDirectory directly */
export let _pickDirectoryImpl: () => Promise<PickDirectoryResult> = execPickDirectory;
export function setPickDirectoryImpl(fn: () => Promise<PickDirectoryResult>): void {
  _pickDirectoryImpl = fn;
}

export interface ProjectEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export const projectsRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/projects/cwd - return server's working directory
  app.get('/api/projects/cwd', async () => {
    const cwd = process.cwd();
    return { path: cwd, name: basename(cwd) };
  });

  // POST /api/projects/pick-directory - open native macOS folder picker
  app.post('/api/projects/pick-directory', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required (X-Cat-Cafe-User header or userId query)' };
    }
    const result = await _pickDirectoryImpl();
    if (result.status === 'cancelled') {
      reply.status(204);
      return;
    }
    if (result.status === 'error') {
      reply.status(500);
      return { error: result.message };
    }
    const validated = await validateProjectPath(result.path);
    if (!validated) {
      reply.status(403);
      return {
        error: 'Selected directory is outside allowed roots',
        selectedPath: result.path,
        allowedRoots: getAllowedRoots(),
      };
    }
    return { path: validated, name: basename(validated) };
  });

  // GET /api/projects/complete?prefix=src/comp&cwd=/path/to/project&limit=10
  app.get('/api/projects/complete', async (request, reply) => {
    const query = request.query as { prefix?: string; cwd?: string; limit?: string };
    if (!query.prefix && query.prefix !== '') {
      reply.status(400);
      return { error: 'prefix parameter is required' };
    }
    const prefix = query.prefix;
    const limit = Math.min(Math.max(parseInt(query.limit || '10', 10) || 10, 1), 50);

    // Resolve prefix: expand ~ to homedir, then resolve relative paths
    const cwd = query.cwd || process.cwd();
    const expandedPrefix = prefix.startsWith('~/') ? homedir() + prefix.slice(1) : prefix;
    const absPrefix = resolve(cwd, expandedPrefix);

    // Split into parent directory + name fragment
    const parentDir = prefix.endsWith('/') ? absPrefix : dirname(absPrefix);
    const fragment = prefix.endsWith('/') ? '' : basename(absPrefix);

    // Validate parent directory
    const validatedParent = await validateProjectPath(parentDir);
    if (!validatedParent) {
      reply.status(403);
      return { error: 'Access denied: path is outside allowed roots' };
    }

    try {
      const entries = await readdir(validatedParent, { withFileTypes: true });
      const results: ProjectEntry[] = [];

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        if (entry.name === 'node_modules') continue;
        if (fragment && !entry.name.startsWith(fragment)) continue;

        const childPath = resolve(validatedParent, entry.name);
        try {
          const childReal = await realpath(childPath);
          if (!isUnderAllowedRoot(childReal)) continue;
          const isDir = entry.isDirectory();
          results.push({
            name: isDir ? `${entry.name}/` : entry.name,
            path: childReal,
            isDirectory: isDir,
          });
        } catch {}
      }

      // Sort: directories first, then alphabetically within each group
      results.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return { entries: results.slice(0, limit) };
    } catch {
      return { entries: [] };
    }
  });

  // GET /api/projects/browse?path=/some/dir - list subdirectories
  app.get('/api/projects/browse', async (request, reply) => {
    const query = request.query as { path?: string };
    const targetPath = query.path || homedir();

    // Validate path: realpath() resolves symlinks, then boundary check
    const validatedPath = await validateProjectPath(targetPath);
    if (!validatedPath) {
      reply.status(403);
      return { error: 'Access denied: path is outside allowed roots' };
    }

    try {
      const entries = await readdir(validatedPath, { withFileTypes: true });
      const dirs: ProjectEntry[] = [];

      for (const entry of entries) {
        // Skip hidden dirs (., .., .git, .node_modules, etc.)
        if (entry.name.startsWith('.')) continue;
        // Skip node_modules
        if (entry.name === 'node_modules') continue;

        if (entry.isDirectory()) {
          // Resolve child realpath to prevent symlink escape in entries
          const childPath = resolve(validatedPath, entry.name);
          try {
            const childReal = await realpath(childPath);
            if (!isUnderAllowedRoot(childReal)) continue;
            dirs.push({ name: entry.name, path: childReal, isDirectory: true });
          } catch {}
        }
      }

      // Sort alphabetically
      dirs.sort((a, b) => a.name.localeCompare(b.name));

      // Compute parent — use path.dirname() for cross-platform separator handling
      const parentDir = dirname(validatedPath);
      const isAtRoot = parentDir === validatedPath; // dirname('/') === '/'
      const canGoUp = !isAtRoot && isUnderAllowedRoot(parentDir);

      return {
        current: validatedPath,
        name: basename(validatedPath),
        parent: canGoUp ? parentDir : null,
        homePath: homedir(),
        entries: dirs,
      };
    } catch (err) {
      reply.status(400);
      return {
        error: `Cannot read directory: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });
};
