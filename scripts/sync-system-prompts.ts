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
 *   npx tsx scripts/sync-system-prompts.ts --apply --agent-hooks-only  # Write Agent CLI hook targets + Claude settings only
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { syncClaudeSettings } from '../packages/api/src/agent-hooks/claude-settings.js';
import {
  applySync,
  buildAgentHookTargets,
  checkDrift,
  type SyncTarget,
  selectAgentHookTargets,
} from '../packages/api/src/agent-hooks/sync-targets.js';

export { checkDrift, type DriftResult, type SyncTarget } from '../packages/api/src/agent-hooks/sync-targets.js';

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
 * Codex (缅因猫) native config target — F203: retired to empty.
 *
 * 缅因猫已切到 native `developer_instructions` L0 注入（压缩免疫层，真相源
 * `assets/system-prompts/system-prompt-l0.md` + `scripts/compile-system-prompt-l0.mjs`）。
 * `~/.codex/AGENTS.md` 这条 F050 user-layer fallback 路径已退役——Codex CLI 默认
 * prepend 它到 user message，与 developer L0 重复注入身份/家规/队友/Magic Words。
 * 渲染空字符串让 `--apply` 清空该文件，`checkDrift` 持续守护它不被旧内容污染。
 * Codex CLI 专属的「长任务纪律」已迁入 `compile-system-prompt-l0.mjs` 的
 * maine-coon WORKFLOW overlay。
 *
 * Gemini 路径（`renderForGemini`）暂留——暹罗猫尚未切到 native L0 注入。
 */
export function renderForCodex(): string {
  return '';
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

// --- CLI ---

/**
 * Build sync targets. Pass targetRoot to override ~ (for CI or testing).
 * Default: homedir().
 */
export function buildTargets(shardsDir: string, targetRoot?: string): SyncTarget[] {
  const root = targetRoot ?? homedir();
  const projectRoot = join(shardsDir, '..', '..');
  return [
    {
      name: 'codex',
      render: () => renderForCodex(),
      targetPath: join(root, '.codex', 'AGENTS.md'),
    },
    {
      name: 'gemini',
      render: () => renderForGemini(shardsDir),
      targetPath: join(root, '.gemini', 'GEMINI.md'),
    },
    ...buildAgentHookTargets({ projectRoot, targetRoot: root }),
  ];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isCheck = args.includes('--check');
  const isApply = args.includes('--apply');
  const isDryRun = args.includes('--dry-run');
  const isAgentHooksOnly = args.includes('--agent-hooks-only');
  const targetRootIdx = args.indexOf('--target-root');
  const targetRoot = targetRootIdx >= 0 ? args[targetRootIdx + 1] : undefined;

  if (targetRootIdx >= 0 && (!targetRoot || targetRoot.startsWith('--'))) {
    console.error('Error: --target-root requires a directory argument');
    process.exit(2);
  }

  if (!isCheck && !isApply) {
    console.error(
      'Usage: sync-system-prompts.ts --check | --apply [--dry-run] [--agent-hooks-only] [--target-root <dir>]',
    );
    process.exit(2);
  }

  // Resolve shards dir relative to this script
  const scriptDir = __dirname;
  const shardsDir = join(scriptDir, '..', 'assets', 'system-prompts');

  const syncTargetRoot = targetRoot ?? homedir();
  const allTargets = buildTargets(shardsDir, syncTargetRoot);
  const targets = isAgentHooksOnly ? selectAgentHookTargets(allTargets) : allTargets;

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
    if (isAgentHooksOnly && !isDryRun) {
      await syncClaudeSettings(syncTargetRoot);
      console.log(`synced claude-settings -> ${join(syncTargetRoot, '.claude', 'settings.json')}`);
    }
    if (!isDryRun) {
      console.log('\nDone. All targets synced.');
    }
  }
}

// Only run CLI when executed directly (not imported as module)
const isDirectRun = process.argv[1]?.endsWith('sync-system-prompts.ts');
if (isDirectRun) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
