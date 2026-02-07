/**
 * Project Path Validation
 * 共享的路径安全校验，防止路径遍历和 symlink 逃逸。
 *
 * 使用 realpath() 解析 symlink 后再做边界检查。
 * 被 projects.ts, threads.ts, AgentRouter.ts 复用。
 */

import { realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve, relative } from 'node:path';

/**
 * Allowed root directories for project paths.
 * Configurable via PROJECT_ALLOWED_ROOTS env var (colon-separated).
 * Default: homedir + /tmp + /private/tmp (macOS realpath).
 */
const DEFAULT_ROOTS = () => [homedir(), '/tmp', '/private/tmp'];

const ALLOWED_ROOTS = (): string[] => {
  const envRoots = process.env['PROJECT_ALLOWED_ROOTS'];
  if (envRoots && envRoots.trim()) {
    return envRoots.split(':').filter(Boolean);
  }
  return DEFAULT_ROOTS();
};

/**
 * Check if a path is an allowed project directory.
 *
 * 1. Resolves the path to absolute
 * 2. Uses realpath() to follow symlinks and canonicalize
 * 3. Checks the real path is under an allowed root (with separator boundary)
 * 4. Verifies the path is an existing directory
 *
 * @returns The canonicalized real path if valid, or null if rejected.
 */
export async function validateProjectPath(rawPath: string): Promise<string | null> {
  try {
    const absPath = resolve(rawPath);
    // realpath resolves symlinks → canonical path
    const realPath = await realpath(absPath);

    if (!isUnderAllowedRoot(realPath)) return null;

    const info = await stat(realPath);
    if (!info.isDirectory()) return null;

    return realPath;
  } catch {
    // ENOENT, EACCES, etc.
    return null;
  }
}

/**
 * Check if a path string (without fs access) is plausibly under an allowed root.
 * Uses separator-aware relative() check instead of naive startsWith().
 *
 * For full validation (including symlinks), use validateProjectPath().
 */
export function isUnderAllowedRoot(absPath: string): boolean {
  for (const root of ALLOWED_ROOTS()) {
    // path.relative(root, target): if target is under root,
    // the result won't start with '..'
    const rel = relative(root, absPath);
    if (rel === '' || (!rel.startsWith('..') && !rel.startsWith('/'))) {
      return true;
    }
  }
  return false;
}
