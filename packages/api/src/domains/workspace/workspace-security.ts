import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { basename, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DENYLIST_PATTERNS = [/^\.env/, /\.pem$/, /\.key$/, /^id_rsa/];

const DENYLIST_DIRS = new Set(['.git', 'secrets']);

export class WorkspaceSecurityError extends Error {
  constructor(
    message: string,
    public readonly code: 'TRAVERSAL' | 'DENIED' | 'NOT_FOUND',
  ) {
    super(message);
    this.name = 'WorkspaceSecurityError';
  }
}

/**
 * Resolve a user-provided relative path against a workspace root.
 * Throws on traversal, symlink escape, or denylist match.
 */
export async function resolveWorkspacePath(root: string, userPath: string): Promise<string> {
  const decoded = decodeURIComponent(userPath);
  const resolved = resolve(root, decoded);
  const relFromRoot = relative(root, resolved);

  if (relFromRoot.startsWith('..') || resolve(root, relFromRoot) !== resolved) {
    throw new WorkspaceSecurityError('Path outside workspace root', 'TRAVERSAL');
  }

  const segments = relFromRoot.split(sep);
  for (const seg of segments) {
    if (DENYLIST_DIRS.has(seg)) {
      throw new WorkspaceSecurityError(`Access denied: ${seg}`, 'DENIED');
    }
    for (const pat of DENYLIST_PATTERNS) {
      if (pat.test(seg)) {
        throw new WorkspaceSecurityError(`Access denied: ${seg}`, 'DENIED');
      }
    }
  }

  // Symlink escape check: resolve the FULL real path (follows all symlinks
  // in every segment, not just the final one). This catches both
  // "final segment is symlink" AND "intermediate directory is symlink".
  // Also realpath the root to handle cases where root itself traverses
  // symlinks (e.g. macOS /tmp → /private/tmp).
  try {
    const [real, realRoot] = await Promise.all([realpath(resolved), realpath(root)]);
    if (!real.startsWith(realRoot + sep) && real !== realRoot) {
      throw new WorkspaceSecurityError('Symlink escapes workspace root', 'TRAVERSAL');
    }
  } catch (e) {
    if (e instanceof WorkspaceSecurityError) throw e;
    // ENOENT = file doesn't exist yet; traversal check above covers it
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw e;
    }
  }

  return resolved;
}

/**
 * Check if a relative path matches the denylist (for filtering search results).
 * Returns true if the path should be blocked.
 */
export function isDenylisted(relPath: string): boolean {
  const segments = relPath.split(sep);
  for (const seg of segments) {
    if (DENYLIST_DIRS.has(seg)) return true;
    for (const pat of DENYLIST_PATTERNS) {
      if (pat.test(seg)) return true;
    }
  }
  return false;
}

export interface WorktreeEntry {
  id: string;
  root: string;
  branch: string;
  head: string;
}

export async function listWorktrees(repoRoot?: string): Promise<WorktreeEntry[]> {
  const cwd = repoRoot ?? process.cwd();
  const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], { cwd });
  const entries: WorktreeEntry[] = [];
  let current: Partial<WorktreeEntry> = {};

  for (const line of stdout.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current.root) entries.push(current as WorktreeEntry);
      const root = line.slice('worktree '.length);
      current = {
        root,
        id: basename(root).replace(/[^a-zA-Z0-9_-]/g, '_'),
        branch: 'HEAD',
        head: '',
      };
    } else if (line.startsWith('HEAD ')) {
      current.head = line.slice('HEAD '.length, 'HEAD '.length + 8);
    } else if (line.startsWith('branch ')) {
      const branchRef = line.slice('branch '.length);
      current.branch = branchRef.startsWith('refs/heads/') ? branchRef.slice('refs/heads/'.length) : branchRef;
    }
  }
  if (current.root) entries.push(current as WorktreeEntry);

  // Deduplicate IDs
  const seen = new Set<string>();
  for (const e of entries) {
    if (seen.has(e.id)) e.id = `${e.id}_${e.head}`;
    seen.add(e.id);
  }

  return entries;
}

export async function getWorktreeRoot(worktreeId: string, repoRoot?: string): Promise<string> {
  const entries = await listWorktrees(repoRoot);
  const entry = entries.find((e) => e.id === worktreeId);
  if (!entry) {
    throw new WorkspaceSecurityError(`Worktree not found: ${worktreeId}`, 'NOT_FOUND');
  }
  return entry.root;
}
