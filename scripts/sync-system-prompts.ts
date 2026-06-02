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
 * Gemini home-file（`renderForGemini`）同样退役为空——见下。
 */
export function renderForCodex(): string {
  return '';
}

/**
 * Gemini (暹罗猫 / Gemini 家族) native config target — F203 Phase H: retired to empty.
 *
 * 暹罗猫身份由 runtime 每次 prompt-prepend 提供（GeminiAgentService 的 gemini-cli /
 * antigravity-cli 两个 adapter 都把 options.systemPrompt 拼进 prompt）。
 * `~/.gemini/GEMINI.md` 这条 F050 home-file 是冗余的第二份注入，且被 Antigravity IDE
 * Global Rules + AGY CLI global context 误读为身份源 → 在 IDE / AGY 里选任意模型都被
 * 灌成"烁烁"。照 renderForCodex(KD-14) 退役：渲染空字符串让 `--apply` 清空文件，
 * checkDrift 守护它不被旧烁烁身份复活。native L0 通道跟进见 F203 Phase H（AC-H1/H2）。
 */
export function renderForGemini(): string {
  return '';
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
      render: () => renderForGemini(),
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
