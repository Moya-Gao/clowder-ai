#!/usr/bin/env npx tsx
/**
 * F050 Phase 4: System Prompt Sync Script
 *
 * Renders semantic shards from assets/system-prompts/ into each agent's
 * native config format and syncs to their home directory targets.
 *
 * Usage:
 *   npx tsx scripts/sync-system-prompts.ts --check     # Drift detection (exit 1 if drifted)
 *   npx tsx scripts/sync-system-prompts.ts --apply      # Write to targets
 *   npx tsx scripts/sync-system-prompts.ts --apply --dry-run  # Show rendered output only
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

// --- Types ---

export interface SyncTarget {
  name: string;
  render: () => string;
  targetPath: string;
}

export interface DriftResult {
  name: string;
  drifted: boolean;
  targetPath: string;
  reason?: string;
}

// --- Shard Reader ---

function readShard(shardsDir: string, name: string): string {
  const path = join(shardsDir, name);
  return readFileSync(path, 'utf-8').trim();
}

// --- Renderers ---

/**
 * Render the full system prompt for Codex (缅因猫).
 * Target: ~/.codex/AGENTS.md
 * Format: governance + collab + cat identity, separated by horizontal rules.
 */
export function renderForCodex(shardsDir: string): string {
  const governance = readShard(shardsDir, 'governance-l0.md');
  const collab = readShard(shardsDir, 'collab-rules.md');
  const identity = readShard(shardsDir, 'cats/codex.md');

  return [identity, '', '---', '', collab, '', '---', '', governance].join('\n');
}

/**
 * Render the full system prompt for Gemini (暹罗猫).
 * Target: ~/.gemini/GEMINI.md
 * Format: same structure as Codex but with gemini identity.
 */
export function renderForGemini(shardsDir: string): string {
  const governance = readShard(shardsDir, 'governance-l0.md');
  const collab = readShard(shardsDir, 'collab-rules.md');
  const identity = readShard(shardsDir, 'cats/gemini.md');

  return [identity, '', '---', '', collab, '', '---', '', governance].join('\n');
}

// --- Drift Detection ---

export function checkDrift(target: SyncTarget): DriftResult {
  const rendered = target.render();

  if (!existsSync(target.targetPath)) {
    return {
      name: target.name,
      drifted: true,
      targetPath: target.targetPath,
      reason: 'target file does not exist',
    };
  }

  const current = readFileSync(target.targetPath, 'utf-8');
  const drifted = current !== rendered;

  return {
    name: target.name,
    drifted,
    targetPath: target.targetPath,
    reason: drifted ? 'content differs from rendered shards' : undefined,
  };
}

// --- Apply ---

function applySync(target: SyncTarget, dryRun: boolean): void {
  const rendered = target.render();

  if (dryRun) {
    console.log(`\n=== ${target.name} → ${target.targetPath} (dry-run) ===\n`);
    console.log(rendered);
    return;
  }

  const dir = dirname(target.targetPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(target.targetPath, rendered, 'utf-8');
  console.log(`✅ ${target.name} → ${target.targetPath}`);
}

// --- CLI ---

/**
 * Build sync targets. Pass targetRoot to override ~ (for CI or testing).
 * Default: homedir().
 */
export function buildTargets(shardsDir: string, targetRoot?: string): SyncTarget[] {
  const root = targetRoot ?? homedir();
  return [
    {
      name: 'codex',
      render: () => renderForCodex(shardsDir),
      targetPath: join(root, '.codex', 'AGENTS.md'),
    },
    {
      name: 'gemini',
      render: () => renderForGemini(shardsDir),
      targetPath: join(root, '.gemini', 'GEMINI.md'),
    },
  ];
}

function main(): void {
  const args = process.argv.slice(2);
  const isCheck = args.includes('--check');
  const isApply = args.includes('--apply');
  const isDryRun = args.includes('--dry-run');
  const targetRootIdx = args.indexOf('--target-root');
  const targetRoot = targetRootIdx >= 0 ? args[targetRootIdx + 1] : undefined;

  if (targetRootIdx >= 0 && (!targetRoot || targetRoot.startsWith('--'))) {
    console.error('Error: --target-root requires a directory argument');
    process.exit(2);
  }

  if (!isCheck && !isApply) {
    console.error('Usage: sync-system-prompts.ts --check | --apply [--dry-run] [--target-root <dir>]');
    process.exit(2);
  }

  // Resolve shards dir relative to this script
  const scriptDir = __dirname;
  const shardsDir = join(scriptDir, '..', 'assets', 'system-prompts');

  const targets = buildTargets(shardsDir, targetRoot);

  if (isCheck) {
    let hasDrift = false;
    for (const target of targets) {
      const result = checkDrift(target);
      if (result.drifted) {
        console.log(`❌ ${result.name}: DRIFTED — ${result.reason} (${result.targetPath})`);
        hasDrift = true;
      } else {
        console.log(`✅ ${result.name}: synced (${result.targetPath})`);
      }
    }
    process.exit(hasDrift ? 1 : 0);
  }

  if (isApply) {
    for (const target of targets) {
      applySync(target, isDryRun);
    }
    if (!isDryRun) {
      console.log('\nDone. All targets synced.');
    }
  }
}

// Only run CLI when executed directly (not imported as module)
const isDirectRun = process.argv[1]?.endsWith('sync-system-prompts.ts');
if (isDirectRun) {
  main();
}
