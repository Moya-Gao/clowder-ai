import { execFileSync } from 'node:child_process';
import {
  P0_AGENTS_PATH,
  P0_CLAUDE_PATH,
  P0_LESSONS_PATH,
  isP0AllowedSourcePath,
  normalizeSourcePath,
} from './p0-contract.js';

function listTrackedDecisionDocs(repoRoot: string): string[] {
  const output = execFileSync('git', ['ls-files', 'docs/decisions'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();

  if (!output) return [];

  return output
    .split(/\r?\n/)
    .map((line) => normalizeSourcePath(line))
    .filter((line) => line.endsWith('.md'))
    .sort();
}

function isTrackedSource(repoRoot: string, sourcePath: string): boolean {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', sourcePath], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

export async function collectP0ImportSources(repoRoot: string, explicitSource?: string): Promise<string[]> {
  if (explicitSource) {
    const source = normalizeSourcePath(explicitSource);
    if (!isP0AllowedSourcePath(source)) {
      throw new Error(`source path is not in P0 allowlist: ${source}`);
    }
    if (!isTrackedSource(repoRoot, source)) {
      throw new Error(`source path is not git-tracked: ${source}`);
    }
    return [source];
  }

  const decisions = listTrackedDecisionDocs(repoRoot);
  const baselineSources = [P0_CLAUDE_PATH, P0_AGENTS_PATH, P0_LESSONS_PATH]
    .filter((source) => isTrackedSource(repoRoot, source));

  return [
    ...decisions,
    ...baselineSources,
  ];
}

export function readGitHeadCommit(repoRoot: string): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
}
