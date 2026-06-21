import { resolve } from 'node:path';
import { defaultDbPath, resolveRepoRoot } from './cli-files.ts';
import type { NodeQuery } from './engine.ts';

export type Format = 'json' | 'text';

export interface GlobalOptions {
  repoRoot: string;
  dbPath: string;
  format: Format;
}

export function parseGlobalOptions(argv: string[], cwd = process.cwd()): GlobalOptions {
  const repoRoot = resolveRepoRoot(readOption(argv, '--repo'), cwd);
  const dbPath = resolve(repoRoot, readOption(argv, '--db') ?? defaultDbPath(repoRoot));
  const format = (readOption(argv, '--format') ?? 'json') as Format;
  if (format !== 'json' && format !== 'text') throw new Error(`unsupported format: ${format}`);
  return { repoRoot, dbPath, format };
}

export function parseNodeQuery(argv: string[]): NodeQuery {
  const domainId = readOption(argv, '--domain');
  const kind = readOption(argv, '--kind');
  const name = readOption(argv, '--name');
  if (!domainId) throw new Error('--domain is required for code-consumers');
  if (!kind) throw new Error('--kind is required for code-consumers');
  if (!name) throw new Error('--name is required for code-consumers');
  return { domainId, kind, name };
}

export function parseDomains(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((domain) => domain.trim())
    .filter(Boolean);
}

export function readOption(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx < 0) return undefined;
  const value = argv[idx + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

export function formatOutput(payload: Record<string, unknown>, format: Format): string {
  if (format === 'json') return `${JSON.stringify(payload, null, 2)}\n`;
  if (payload.command === 'index') return formatIndex(payload);
  return formatCodeConsumers(payload);
}

function formatIndex(payload: Record<string, unknown>): string {
  const domains = payload.domains as { domainId: string; indexedFiles: number; nodes: number; edges: number }[];
  return [
    `Indexed ${payload.repoRoot}`,
    `DB: ${payload.dbPath}`,
    ...domains.map((d) => `${d.domainId}: files=${d.indexedFiles} nodes=${d.nodes} edges=${d.edges}`),
    '',
  ].join('\n');
}

function formatCodeConsumers(payload: Record<string, unknown>): string {
  const freshness = payload.freshness as { stale: boolean; pendingChanges: unknown[] };
  const consumers = payload.consumers as unknown[];
  return [
    `Targets: ${(payload.targets as unknown[]).length}`,
    `Consumers: ${consumers.length}`,
    `Freshness: ${freshness.stale ? 'stale' : 'fresh'}`,
    `Pending changes: ${freshness.pendingChanges.length}`,
    '',
  ].join('\n');
}

export function usage(): string {
  return `Usage:
  cat-cafe-convention-graph index [--repo <path>] [--db <path>] [--domain mcp-tool,skill-manifest] [--format json|text]
  cat-cafe-convention-graph code-consumers --domain <domain> --kind <kind> --name <name> [--repo <path>] [--db <path>] [--format json|text]

Commands:
  index           Rebuild .cat-cafe/convention-graph.sqlite for supported domains.
  code-consumers  Query convention consumers and report freshness against current files.`;
}
