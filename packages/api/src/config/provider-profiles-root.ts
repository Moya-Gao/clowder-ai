import { lstat, readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

export async function resolveProviderProfilesRoot(projectRoot: string): Promise<string> {
  const root = resolve(projectRoot);
  const gitPath = resolve(root, '.git');
  try {
    const st = await lstat(gitPath);
    if (st.isDirectory()) return root;
    if (!st.isFile()) return root;
    const line = (await readFile(gitPath, 'utf-8')).split(/\r?\n/, 1)[0]?.trim() ?? '';
    if (!line.toLowerCase().startsWith('gitdir:')) return root;
    const gitDir = resolve(root, line.slice('gitdir:'.length).trim());
    const worktreesDir = dirname(gitDir);
    if (basename(worktreesDir) !== 'worktrees') return root;
    const commonGitDir = dirname(worktreesDir);
    if (basename(commonGitDir) !== '.git') return root;
    return dirname(commonGitDir);
  } catch {
    return root;
  }
}
