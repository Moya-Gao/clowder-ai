import { type Dirent, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import type { SourceContent } from './engine.ts';
import type { ConventionDomainPlugin } from './plugin.ts';

const SKIP_DIRS = new Set([
  '.cat-cafe',
  '.git',
  '.mypy_cache',
  '.next',
  '.nox',
  '.pytest_cache',
  '.ruff_cache',
  '.turbo',
  '.tox',
  '.venv',
  '__pycache__',
  'coverage',
  'dist',
  'env',
  'node_modules',
  'tmp',
  'venv',
]);

export function defaultDbPath(repoRoot: string): string {
  return resolve(repoRoot, '.cat-cafe/convention-graph.sqlite');
}

export function ensureDbParent(dbPath: string): void {
  mkdirSync(dirname(dbPath), { recursive: true });
}

export function resolveRepoRoot(rawRepo?: string, cwd = process.cwd()): string {
  return resolve(cwd, rawRepo ?? '.');
}

export function readPluginFiles(repoRoot: string, plugin: ConventionDomainPlugin): SourceContent[] {
  return walkFiles(repoRoot)
    .filter((path) => plugin.invalidationScope(path))
    .map((path) => ({
      path,
      content: readFileSync(resolve(repoRoot, path), 'utf8'),
    }));
}

export function readPluginsFiles(repoRoot: string, plugins: readonly ConventionDomainPlugin[]): SourceContent[] {
  const seen = new Set<string>();
  const files: SourceContent[] = [];
  for (const plugin of plugins) {
    for (const file of readPluginFiles(repoRoot, plugin)) {
      if (seen.has(file.path)) continue;
      seen.add(file.path);
      files.push(file);
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export function combineInvalidationScopes(
  plugins: readonly ConventionDomainPlugin[],
): ((path: string) => boolean) | undefined {
  return plugins.length ? (path) => plugins.some((plugin) => plugin.invalidationScope(path)) : undefined;
}

function walkFiles(repoRoot: string): string[] {
  if (!existsSync(repoRoot)) throw new Error(`repo does not exist: ${repoRoot}`);
  const files: string[] = [];
  const stack = [''];
  while (stack.length > 0) {
    const relDir = stack.pop();
    if (relDir === undefined) continue;
    const absDir = resolve(repoRoot, relDir);
    for (const entry of readdirSync(absDir, { withFileTypes: true })) {
      collectEntry(files, stack, relDir, entry);
    }
  }
  return files.sort();
}

function collectEntry(files: string[], stack: string[], relDir: string, entry: Dirent): void {
  if (entry.isDirectory()) {
    if (!SKIP_DIRS.has(entry.name)) stack.push(joinRel(relDir, entry.name));
    return;
  }
  if (entry.isFile()) files.push(joinRel(relDir, entry.name));
}

function joinRel(...parts: string[]): string {
  return parts.filter(Boolean).join('/').split(sep).join('/');
}
