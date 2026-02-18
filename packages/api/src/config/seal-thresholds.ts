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

import { catRegistry } from '@cat-cafe/shared';
import type { ContextHealthConfig } from '@cat-cafe/shared';

/** Per-cat overrides (built-in cats have specific tuning) */
const SEAL_OVERRIDES: Record<string, ContextHealthConfig> = {
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

/** Provider-based defaults for cats without explicit overrides */
const DEFAULT_SEAL_BY_PROVIDER: Record<string, ContextHealthConfig> = {
  anthropic: { warnThreshold: 0.80, sealThreshold: 0.90, turnBudget: 12_000, safetyMargin: 4_000 },
  openai: { warnThreshold: 0.75, sealThreshold: 0.85, turnBudget: 12_000, safetyMargin: 4_000 },
  google: { warnThreshold: 0.55, sealThreshold: 0.65, turnBudget: 12_000, safetyMargin: 4_000 },
};

const GLOBAL_DEFAULT: ContextHealthConfig = {
  warnThreshold: 0.75,
  sealThreshold: 0.85,
  turnBudget: 12_000,
  safetyMargin: 4_000,
};

/**
 * Get seal threshold config for a cat.
 * Lookup: catId override → provider default → global default.
 */
export function getSealConfig(catName: string): ContextHealthConfig {
  // 1. Exact catId override
  const override = SEAL_OVERRIDES[catName];
  if (override) return override;

  // 2. Provider-based default
  const entry = catRegistry.tryGet(catName);
  if (entry) {
    const providerDefault = DEFAULT_SEAL_BY_PROVIDER[entry.config.provider];
    if (providerDefault) return providerDefault;
  }

  // 3. Global fallback
  return GLOBAL_DEFAULT;
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
