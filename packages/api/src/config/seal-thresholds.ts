/**
 * Per-cat Seal Threshold Configuration
 * F24 Phase B: Configures when to auto-seal sessions per cat.
 *
 * Principle: seal BEFORE the CLI's auto-compact kicks in.
 * Each cat has different compact thresholds:
 *   - Claude: ~95% (CLAUDE_AUTOCOMPACT_PCT_OVERRIDE)
 *   - Codex:  ~90%
 *   - Gemini: ~70% (auto-compress)
 *
 * We set seal thresholds ~5% below each cat's compact point.
 */

import type { ContextHealthConfig } from '@cat-cafe/shared';

type CatName = 'opus' | 'codex' | 'gemini';

const DEFAULT_SEAL_CONFIGS: Record<CatName, ContextHealthConfig> = {
  opus: {
    warnThreshold: 0.80,
    sealThreshold: 0.90,
    turnBudget: 12_000,
    safetyMargin: 4_000,
  },
  codex: {
    warnThreshold: 0.75,
    sealThreshold: 0.85,
    turnBudget: 12_000,
    safetyMargin: 4_000,
  },
  gemini: {
    warnThreshold: 0.55,
    sealThreshold: 0.65,
    turnBudget: 12_000,
    safetyMargin: 4_000,
  },
};

/**
 * Get seal threshold config for a cat.
 * Returns per-cat defaults. All values configurable via future cat-config.json extension.
 */
export function getSealConfig(catName: CatName): ContextHealthConfig {
  return DEFAULT_SEAL_CONFIGS[catName] ?? DEFAULT_SEAL_CONFIGS.opus;
}

/**
 * Pure function: should this session be sealed?
 *
 * Two conditions (OR):
 * 1. fillRatio >= sealThreshold
 * 2. remaining tokens < turnBudget + safetyMargin (prevents single-turn overflow)
 */
export function shouldSeal(
  fillRatio: number,
  windowTokens: number,
  usedTokens: number,
  config: ContextHealthConfig,
): boolean {
  if (fillRatio >= config.sealThreshold) return true;

  const turnBudget = config.turnBudget ?? 12_000;
  const safetyMargin = config.safetyMargin ?? 4_000;
  const remaining = windowTokens - usedTokens;
  if (remaining < turnBudget + safetyMargin) return true;

  return false;
}
