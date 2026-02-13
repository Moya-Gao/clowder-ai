import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHindsightClient } from '../domains/cats/services/HindsightClient.js';
import { buildImportItemsFromMarkdown, collectP0ImportSources, readGitHeadCommit } from '../domains/cats/services/hindsight-import/p0-importer.js';

interface CliArgs {
  dryRun: boolean;
  source?: string;
  all: boolean;
  author: string;
  bank: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    dryRun: false,
    all: false,
    author: 'codex',
    bank: process.env['HINDSIGHT_SHARED_BANK'] ?? 'cat-cafe-shared',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--all') args.all = true;
    else if (arg === '--source') {
      const value = argv[i + 1];
      if (value) args.source = value;
    }
    else if (arg === '--author') args.author = argv[i + 1] ?? args.author;
    else if (arg === '--bank') args.bank = argv[i + 1] ?? args.bank;

    if (arg === '--source' || arg === '--author' || arg === '--bank') i += 1;
  }

  return args;
}

function usage(): void {
  console.log(
    [
      'Usage:',
      '  node dist/scripts/hindsight-import-p0.js --all [--dry-run] [--author codex] [--bank cat-cafe-shared]',
      '  node dist/scripts/hindsight-import-p0.js --source docs/decisions/005-hindsight-integration-decisions.md [--dry-run]',
    ].join('\n'),
  );
}

function buildDocumentTags(tags: string[] | undefined): string[] {
  const base = (tags ?? []).filter((tag) => !tag.startsWith('anchor:'));
  return Array.from(new Set(base));
}

function detectRepoRoot(startCwd: string): string {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: startCwd,
      encoding: 'utf8',
    }).trim();
  } catch {
    return startCwd;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.all && !args.source) {
    usage();
    process.exitCode = 1;
    return;
  }

  const repoRoot = detectRepoRoot(process.cwd());
  const sourcePaths = await collectP0ImportSources(repoRoot, args.source);
  const sourceCommit = readGitHeadCommit(repoRoot);
  const client = createHindsightClient();

  let totalItems = 0;

  for (const sourcePath of sourcePaths) {
    const absolutePath = resolve(repoRoot, sourcePath);
    const content = await readFile(absolutePath, 'utf8');
    const items = buildImportItemsFromMarkdown({
      sourcePath,
      sourceCommit,
      content,
      author: args.author,
    });
    totalItems += items.length;

    if (items.length === 0) {
      console.log(`[skip] ${sourcePath}: no importable chunks`);
      continue;
    }

    if (args.dryRun) {
      console.log(`[dry-run] ${sourcePath}: ${items.length} chunks, document_id=${items[0]?.document_id ?? '-'}`);
      continue;
    }

    await client.retain(args.bank, items, {
      document_tags: buildDocumentTags(items[0]?.tags),
    });
    console.log(`[retain] ${sourcePath}: ${items.length} chunks`);
  }

  console.log(`[done] sources=${sourcePaths.length} chunks=${totalItems} dryRun=${args.dryRun}`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[error] hindsight-import-p0: ${message}`);
  process.exitCode = 1;
});
