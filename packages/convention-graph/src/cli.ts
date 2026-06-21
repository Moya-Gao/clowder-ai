#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatOutput, parseDomains, parseGlobalOptions, parseNodeQuery, readOption, usage } from './cli-args.ts';
import { combineInvalidationScopes, ensureDbParent, readPluginFiles, readPluginsFiles } from './cli-files.ts';
import { ConventionGraphEngine, type NodeQuery } from './engine.ts';
import { fastapiRoutePlugin } from './extractors/fastapi-route.ts';
import { mcpToolPlugin } from './extractors/mcp-tool.ts';
import { skillManifestPlugin } from './extractors/skill-manifest.ts';
import type { ConventionDomainPlugin } from './plugin.ts';
import { codeConsumers } from './queries.ts';

export interface CliIO {
  cwd?: string;
  stdout?: (chunk: string) => void;
  stderr?: (chunk: string) => void;
}

const PLUGINS = [mcpToolPlugin, skillManifestPlugin, fastapiRoutePlugin] as const;

export async function runCli(argv: string[], io: CliIO = {}): Promise<number> {
  const out = io.stdout ?? ((chunk: string) => process.stdout.write(chunk));
  const err = io.stderr ?? ((chunk: string) => process.stderr.write(chunk));
  const cwd = effectiveCwd(io.cwd);
  try {
    const [command, ...args] = argv;
    if (!command || command === 'help' || command === '--help' || command === '-h') {
      out(`${usage()}\n`);
      return 0;
    }
    if (command === 'index') {
      out(formatOutput(runIndex(args, cwd), parseGlobalOptions(args, cwd).format));
      return 0;
    }
    if (command === 'code-consumers') {
      out(formatOutput(runCodeConsumers(args, cwd), parseGlobalOptions(args, cwd).format));
      return 0;
    }
    throw new Error(`unknown command: ${command}`);
  } catch (error) {
    err(`[convention-graph] ${error instanceof Error ? error.message : String(error)}\n`);
    err(`${usage()}\n`);
    return 1;
  }
}

function runIndex(argv: string[], cwd = process.cwd()): Record<string, unknown> {
  const options = parseGlobalOptions(argv, cwd);
  const domainIds = parseDomains(readOption(argv, '--domain') ?? readOption(argv, '--domains'));
  const plugins = selectPlugins(domainIds);
  ensureDbParent(options.dbPath);

  const graph = new ConventionGraphEngine(options.dbPath);
  const indexCommit = gitHead(options.repoRoot);
  if (indexCommit) graph.setIndexCommit(indexCommit);

  const domains = plugins.map((plugin) => {
    const files = readPluginFiles(options.repoRoot, plugin);
    const extracted = plugin.extract({ repo: repoName(options.repoRoot), files });
    graph.ingestExtractionResult(extracted, { replaceDomains: [plugin.domainId] });
    graph.recordIndexedFiles(files, [plugin.domainId]);
    return {
      domainId: plugin.domainId,
      indexedFiles: files.length,
      nodes: extracted.nodes.length,
      edges: extracted.edges.length,
      gaps: extracted.gaps?.length ?? 0,
    };
  });

  graph.close();
  return {
    command: 'index',
    repoRoot: options.repoRoot,
    dbPath: options.dbPath,
    indexCommit,
    domains,
    queryCommand: `pnpm convention-graph:code-consumers -- --repo ${options.repoRoot} --domain <domain> --kind <kind> --name <name>`,
  };
}

function effectiveCwd(explicitCwd?: string): string {
  return explicitCwd ?? process.env.INIT_CWD ?? process.cwd();
}

function runCodeConsumers(argv: string[], cwd = process.cwd()): Record<string, unknown> {
  const options = parseGlobalOptions(argv, cwd);
  if (!existsSync(options.dbPath)) {
    throw new Error(`graph db not found: ${options.dbPath}; run index first`);
  }

  const query = parseNodeQuery(argv);
  const initial = withGraph(options.dbPath, (graph) => codeConsumers(graph, query));
  const domainIds = freshnessDomains(query, initial);
  const plugins = selectPlugins(domainIds);
  const currentFiles = readPluginsFiles(options.repoRoot, plugins);
  const inScope = combineInvalidationScopes(plugins);
  const result = withGraph(options.dbPath, (graph) => codeConsumers(graph, query, { currentFiles, inScope }));

  return {
    command: 'code-consumers',
    repoRoot: options.repoRoot,
    dbPath: options.dbPath,
    query,
    targets: result.targets,
    consumers: result.consumers,
    freshness: result.freshness,
    reindexCommand: `pnpm convention-graph:index -- --repo ${options.repoRoot}`,
  };
}

function withGraph<T>(dbPath: string, fn: (graph: ConventionGraphEngine) => T): T {
  const graph = new ConventionGraphEngine(dbPath);
  try {
    return fn(graph);
  } finally {
    graph.close();
  }
}

function freshnessDomains(query: NodeQuery, result: ReturnType<typeof codeConsumers>): string[] {
  return [
    ...new Set([
      ...(query.domainId ? [query.domainId] : []),
      ...result.targets.map((target) => target.domainId),
      ...result.consumers.flatMap((consumer) => [consumer.node.domainId, consumer.edge.domainId]),
    ]),
  ];
}

function selectPlugins(domainIds: readonly string[]): ConventionDomainPlugin[] {
  if (domainIds.length === 0) return [...PLUGINS];
  const selected = domainIds.map((domainId) => {
    const plugin = PLUGINS.find((candidate) => candidate.domainId === domainId);
    if (!plugin) throw new Error(`unsupported domain: ${domainId}`);
    return plugin;
  });
  return [...new Set(selected)];
}

function gitHead(repoRoot: string): string | null {
  try {
    return execFileSync('git', ['-C', repoRoot, 'rev-parse', '--short=12', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function repoName(repoRoot: string): string {
  return repoRoot.split('/').filter(Boolean).at(-1) ?? 'repo';
}

function isCliEntrypoint(metaUrl: string, argvPath?: string): boolean {
  if (!argvPath) return false;
  try {
    return realpathSync(fileURLToPath(metaUrl)) === realpathSync(resolve(argvPath));
  } catch {
    return false;
  }
}

if (isCliEntrypoint(import.meta.url, process.argv[1])) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
