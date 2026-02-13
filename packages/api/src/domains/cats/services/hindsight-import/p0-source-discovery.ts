import { execFileSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  P0_AGENTS_PATH,
  P0_CLAUDE_PATH,
  P0_LESSONS_PATH,
  isP0AllowedSourcePath,
  normalizeSourcePath,
} from './p0-contract.js';

async function listDecisionDocs(repoRoot: string): Promise<string[]> {
  const decisionsDir = resolve(repoRoot, 'docs/decisions');
  const files = await readdir(decisionsDir, { withFileTypes: true });
  return files
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => normalizeSourcePath(join('docs/decisions', entry.name)))
    .sort();
}

export async function collectP0ImportSources(repoRoot: string, explicitSource?: string): Promise<string[]> {
  if (explicitSource) {
    const source = normalizeSourcePath(explicitSource);
    if (!isP0AllowedSourcePath(source)) {
      throw new Error(`source path is not in P0 allowlist: ${source}`);
    }
    return [source];
  }

  const decisions = await listDecisionDocs(repoRoot);
  return [
    ...decisions,
    P0_CLAUDE_PATH,
    P0_AGENTS_PATH,
    P0_LESSONS_PATH,
  ];
}

export function readGitHeadCommit(repoRoot: string): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
}
