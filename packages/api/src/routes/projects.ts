/**
 * Project Directory Browser Routes
 * GET /api/projects/browse  - 浏览目录结构
 * GET /api/projects/cwd     - 获取服务器工作目录
 */

import type { FastifyPluginAsync } from 'fastify';
import { readdir, realpath } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import { validateProjectPath, isUnderAllowedRoot } from '../utils/project-path.js';

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

    // Validate path: realpath() resolves symlinks, then boundary check
    const validatedPath = await validateProjectPath(targetPath);
    if (!validatedPath) {
      reply.status(403);
      return { error: 'Access denied: path must be an existing directory under home' };
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
          } catch {
            continue; // broken symlink or permission error
          }
        }
      }

      // Sort alphabetically
      dirs.sort((a, b) => a.name.localeCompare(b.name));

      // Compute parent (use validatedPath which is already canonicalized)
      const parentParts = validatedPath.split('/');
      parentParts.pop();
      const parent = parentParts.length > 0 ? parentParts.join('/') || '/' : null;
      const canGoUp = parent !== null && isUnderAllowedRoot(parent);

      return {
        current: validatedPath,
        name: basename(validatedPath),
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
