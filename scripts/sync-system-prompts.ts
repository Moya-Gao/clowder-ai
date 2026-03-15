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

interface PromptRosterEntry {
  family?: string;
}

interface PromptVariant {
  id: string;
  catId?: string;
  variantLabel?: string;
  displayName?: string;
  mentionPatterns?: string[];
  teamStrengths?: string | null;
  caution?: string | null;
}

interface PromptBreed {
  id: string;
  catId: string;
  name: string;
  displayName: string;
  nickname?: string | null;
  roleDescription: string;
  teamStrengths?: string | null;
  caution?: string | null;
  mentionPatterns: string[];
  defaultVariantId: string;
  variants: PromptVariant[];
}

interface PromptConfig {
  roster: Record<string, PromptRosterEntry>;
  breeds: PromptBreed[];
}

interface FlatPromptCat {
  catId: string;
  breedId: string;
  familyName: string;
  nickname?: string | null;
  displayName: string;
  provider: string;
  roleDescription: string;
  teamStrengths?: string | null;
  mentionPatterns: string[];
}

const PROVIDER_FAMILY_LABELS: Record<string, string> = {
  anthropic: 'Claude',
  openai: 'OpenAI',
  google: 'Gemini',
  dare: 'DARE',
  antigravity: 'Antigravity',
  opencode: 'OpenCode',
};

// --- Shard Reader ---

function readShard(shardsDir: string, name: string): string {
  const path = join(shardsDir, name);
  return readFileSync(path, 'utf-8').trim();
}

function readPromptConfig(shardsDir: string): PromptConfig {
  const configPath = join(shardsDir, '..', '..', 'cat-config.json');
  return JSON.parse(readFileSync(configPath, 'utf-8')) as PromptConfig;
}

function flattenPromptCats(config: PromptConfig): FlatPromptCat[] {
  const result: FlatPromptCat[] = [];

  for (const breed of config.breeds) {
    for (const variant of breed.variants) {
      const isDefault = variant.id === breed.defaultVariantId;
      const catId = variant.catId ?? breed.catId;
      const mentionPatterns =
        variant.mentionPatterns && variant.mentionPatterns.length > 0
          ? variant.mentionPatterns
          : isDefault
            ? breed.mentionPatterns
            : [`@${catId}`];

      result.push({
        catId,
        breedId: breed.id,
        familyName: breed.name,
        nickname: breed.nickname,
        displayName: variant.displayName ?? breed.displayName,
        provider: variant.provider,
        roleDescription: breed.roleDescription,
        teamStrengths: variant.teamStrengths ?? breed.teamStrengths,
        mentionPatterns,
      });
    }
  }

  return result;
}

function pickMention(cat: FlatPromptCat): string {
  const exact = cat.mentionPatterns.find((pattern) => pattern.toLowerCase() === `@${cat.catId}`.toLowerCase());
  if (exact) return exact;
  return [...cat.mentionPatterns].sort((a, b) => a.length - b.length)[0] ?? `@${cat.catId}`;
}

function formatFamilyLabel(cat: FlatPromptCat): string {
  return `${cat.familyName} (${PROVIDER_FAMILY_LABELS[cat.provider] ?? cat.provider})`;
}

function buildDynamicRosterSection(config: PromptConfig): string {
  const byId = new Map(flattenPromptCats(config).map((cat) => [cat.catId, cat]));
  const rows: string[] = [];

  for (const catId of Object.keys(config.roster)) {
    const cat = byId.get(catId);
    if (!cat) continue;

    rows.push(
      `| ${formatFamilyLabel(cat)} | ${cat.nickname ?? cat.displayName} | ${cat.teamStrengths ?? cat.roleDescription} | \`${pickMention(cat)}\` |`,
    );
  }

  return [
    '## 队友',
    '',
    `当前名册来自 \`cat-config.json\`，共 ${rows.length} 只猫。`,
    '',
    '| 家族 | 昵称 | 角色 | @ 句柄 |',
    '|------|------|------|--------|',
    ...rows,
    '',
    '注：同族不同个体按唯一句柄区分；完整真相源是 `cat-config.json`。',
  ].join('\n');
}

function renderCollabRules(shardsDir: string): string {
  const raw = readShard(shardsDir, 'collab-rules.md');
  const config = readPromptConfig(shardsDir);
  const teamHeading = '## 队友';
  const projectHeading = '## 项目信息';
  const teamIndex = raw.indexOf(teamHeading);
  const projectIndex = raw.indexOf(projectHeading);

  if (teamIndex < 0 || projectIndex < 0 || projectIndex <= teamIndex) {
    return raw;
  }

  const before = raw.slice(0, teamIndex).trim();
  const after = raw.slice(projectIndex).trim();
  return [before, '', buildDynamicRosterSection(config), '', after].join('\n');
}

// --- Renderers ---

/**
 * Render the full system prompt for Codex (缅因猫).
 * Target: ~/.codex/AGENTS.md
 * Format: governance + collab + cat identity, separated by horizontal rules.
 */
export function renderForCodex(shardsDir: string): string {
  const governance = readShard(shardsDir, 'governance-l0.md');
  const collab = renderCollabRules(shardsDir);
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
  const collab = renderCollabRules(shardsDir);
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
