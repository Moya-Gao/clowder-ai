/**
 * Project Directory Browser Routes
 * GET /api/projects/browse        - 浏览目录结构
 * GET /api/projects/cwd           - 获取服务器工作目录
 * POST /api/projects/pick-directory - 打开系统原生文件选择器
 */

import type { FastifyPluginAsync } from 'fastify';
import { readdir, realpath, stat } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { validateProjectPath, isUnderAllowedRoot } from '../utils/project-path.js';
import { resolveUserId } from '../utils/request-identity.js';

const execFileAsync = promisify(execFile);

export type PickDirectoryResult =
  | { status: 'picked'; path: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

/**
 * Shell out to macOS osascript to open native folder picker (NSOpenPanel).
 * Returns a discriminated result: picked / cancelled / error.
 */
export async function execPickDirectory(): Promise<PickDirectoryResult> {
  try {
    const { stdout } = await execFileAsync('osascript', [
      '-e', 'POSIX path of (choose folder)',
    ], { timeout: 120_000 });
    const picked = stdout.trim().replace(/\/$/, '');
    if (!picked) return { status: 'cancelled' };
    const s = await stat(picked);
    if (!s.isDirectory()) return { status: 'error', message: 'Selected path is not a directory' };
    return { status: 'picked', path: picked };
  } catch (err: unknown) {
    // osascript reports "User canceled. (-128)" in stderr when user presses Cancel.
    // Exit code 1 is generic — also used for permission denial, script errors, etc.
    // Only treat explicit "User canceled" as cancellation.
    const stderr = String((err as { stderr?: unknown }).stderr ?? '');
    if (stderr.includes('User canceled')) return { status: 'cancelled' };
    return { status: 'error', message: stderr || (err instanceof Error ? err.message : 'Unknown error') };
  }
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
      return { error: 'Selected directory is outside allowed roots' };
    }
    return { path: validated, name: basename(validated) };
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
