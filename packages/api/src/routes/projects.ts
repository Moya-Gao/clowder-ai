/**
 * Project Directory Browser Routes
 * GET /api/projects/browse  - 浏览目录结构
 * GET /api/projects/cwd     - 获取服务器工作目录
 */

import type { FastifyPluginAsync } from 'fastify';
import { readdir, stat } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { homedir } from 'node:os';

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

  // GET /api/projects/browse?path=/some/dir - list subdirectories
  app.get('/api/projects/browse', async (request, reply) => {
    const query = request.query as { path?: string };
    const targetPath = query.path || homedir();

    // Resolve to absolute path
    const absPath = resolve(targetPath);

    // Safety: only allow paths under home directory or /tmp
    const home = homedir();
    if (!absPath.startsWith(home) && !absPath.startsWith('/tmp')) {
      reply.status(403);
      return { error: 'Access denied: path must be under home directory' };
    }

    try {
      const info = await stat(absPath);
      if (!info.isDirectory()) {
        reply.status(400);
        return { error: 'Not a directory' };
      }

      const entries = await readdir(absPath, { withFileTypes: true });
      const dirs: ProjectEntry[] = [];

      for (const entry of entries) {
        // Skip hidden dirs (., .., .git, .node_modules, etc.)
        if (entry.name.startsWith('.')) continue;
        // Skip node_modules
        if (entry.name === 'node_modules') continue;

        if (entry.isDirectory()) {
          dirs.push({
            name: entry.name,
            path: resolve(absPath, entry.name),
            isDirectory: true,
          });
        }
      }

      // Sort alphabetically
      dirs.sort((a, b) => a.name.localeCompare(b.name));

      // Compute parent
      const parentParts = absPath.split('/');
      parentParts.pop();
      const parent = parentParts.length > 0 ? parentParts.join('/') || '/' : null;
      const canGoUp = parent !== null && parent.startsWith(home);

      return {
        current: absPath,
        name: basename(absPath),
        parent: canGoUp ? parent : null,
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
