/**
 * F33: Session Strategy Configuration
 *
 * Configurable per-cat session lifecycle strategies:
 *   - handoff: seal at threshold → new session (current default behavior)
 *   - compress: let CLI compress, don't intervene
 *   - hybrid: allow N compressions, then seal (hook-capable providers only)
 *
 * Lookup order: breedId override → provider default → global default
 * (same pattern as seal-thresholds.ts, which Phase 2 will merge into this file)
 */

import type { SessionStrategyConfig, StrategyAction } from '@cat-cafe/shared';
import { CAT_CONFIGS, catRegistry } from '@cat-cafe/shared';
import { resolveBreedId } from './breed-resolver.js';

// ── Default Configurations ──

const GLOBAL_DEFAULT_STRATEGY: SessionStrategyConfig = {
  strategy: 'handoff',
  thresholds: { warn: 0.75, action: 0.85 },
  turnBudget: 12_000,
  safetyMargin: 4_000,
};

const DEFAULT_STRATEGY_BY_PROVIDER: Record<string, SessionStrategyConfig> = {
  anthropic: {
    strategy: 'handoff',
    thresholds: { warn: 0.8, action: 0.9 },
    turnBudget: 12_000,
    safetyMargin: 4_000,
  },
  openai: {
    strategy: 'handoff',
    thresholds: { warn: 0.75, action: 0.85 },
    turnBudget: 12_000,
    safetyMargin: 4_000,
  },
  google: {
    strategy: 'handoff',
    thresholds: { warn: 0.55, action: 0.65 },
    turnBudget: 12_000,
    safetyMargin: 4_000,
  },
};

/** breedId-keyed overrides (same breed's variants share strategy) */
const STRATEGY_BY_BREED: Record<string, Partial<SessionStrategyConfig>> = {
  // Example: ragdoll hybrid — allow 1 compression then handoff
  // ragdoll: {
  //   strategy: 'hybrid',
  //   hybrid: { maxCompressions: 1 },
  // },
};

/** Providers that support compression event signaling (PreCompact hook) */
const HOOK_CAPABLE_PROVIDERS = new Set(['anthropic']);

/**
 * Test-only: per-cat strategy override. Cleared between tests.
 * Use _setTestStrategyOverride / _clearTestStrategyOverrides.
 */
const _testOverrides = new Map<string, SessionStrategyConfig>();

/** @internal Test-only: set a strategy override for a specific cat. */
export function _setTestStrategyOverride(catName: string, config: SessionStrategyConfig): void {
  _testOverrides.set(catName, config);
}

/** @internal Test-only: clear all test overrides. */
export function _clearTestStrategyOverrides(): void {
  _testOverrides.clear();
}

// ── Lookup ──

/**
 * Get session strategy config for a cat.
 *
 * Lookup order (same as getSealConfig in seal-thresholds.ts):
 * 1. breedId override → 2. provider default → 3. global default
 *
 * Phase 1: code-only overrides via STRATEGY_BY_BREED.
 * Phase 2: cat-config.json features.sessionStrategy will be consulted first.
 */
export function getSessionStrategy(catName: string): SessionStrategyConfig {
  // Test-only override (highest priority)
  const testOverride = _testOverrides.get(catName);
  if (testOverride) return testOverride;

  // 1. breedId override
  const breedId = resolveBreedId(catName);
  const breedOverride = (breedId ? STRATEGY_BY_BREED[breedId] : undefined) ?? STRATEGY_BY_BREED[catName];

  const base = getBaseStrategy(catName);

  if (breedOverride) {
    const merged = mergeStrategyConfig(base, breedOverride);
    return validateProviderCapability(merged, catName);
  }

  return base;
}

/**
 * Deep-merge a partial override into a base config.
 * Nested objects (thresholds, handoff, compress, hybrid) are merged individually
 * so that a partial override of e.g. { thresholds: { action: 0.88 } } preserves warn.
 */
export function mergeStrategyConfig(
  base: SessionStrategyConfig,
  override: Partial<SessionStrategyConfig>,
): SessionStrategyConfig {
  return {
    ...base,
    ...override,
    thresholds: { ...base.thresholds, ...override.thresholds },
    ...(override.handoff || base.handoff
      ? { handoff: { ...base.handoff, ...override.handoff } }
      : {}),
    ...(override.compress || base.compress
      ? { compress: { ...base.compress, ...override.compress } }
      : {}),
    ...(override.hybrid || base.hybrid
      ? { hybrid: { ...base.hybrid, ...override.hybrid } }
      : {}),
  } as SessionStrategyConfig;
}

function getBaseStrategy(catName: string): SessionStrategyConfig {
  // Try catRegistry first (runtime, includes variants), then static CAT_CONFIGS fallback
  const provider = catRegistry.tryGet(catName)?.config.provider ?? CAT_CONFIGS[catName]?.provider;
  if (provider) {
    const providerDefault = DEFAULT_STRATEGY_BY_PROVIDER[provider];
    if (providerDefault) return providerDefault;
  }
  return GLOBAL_DEFAULT_STRATEGY;
}

/**
 * Phase 1 guard: hybrid requires hook-capable provider.
 * If provider lacks compression signal, degrade to handoff + log warning.
 */
function validateProviderCapability(config: SessionStrategyConfig, catName: string): SessionStrategyConfig {
  if (config.strategy !== 'hybrid') return config;

  const entry = catRegistry.tryGet(catName);
  const provider = entry?.config.provider;

  if (!provider || !HOOK_CAPABLE_PROVIDERS.has(provider)) {
    console.warn(
      `[session-strategy] hybrid strategy configured for "${catName}" ` +
        `but provider "${provider ?? 'unknown'}" lacks compression signal hook. ` +
        'Degrading to handoff.',
    );
    return { ...config, strategy: 'handoff' };
  }

  return config;
}

// ── Strategy Decision ──

/**
 * Pure function: determine what action to take based on context health + strategy.
 *
 * Replaces the boolean shouldSeal() from seal-thresholds.ts with a
 * discriminated union that supports compress/hybrid strategies.
 */
export function shouldTakeAction(
  fillRatio: number,
  windowTokens: number,
  usedTokens: number,
  compressionCount: number,
  strategy: SessionStrategyConfig,
): StrategyAction {
  const turnBudget = strategy.turnBudget ?? 12_000;
  const safetyMargin = strategy.safetyMargin ?? 4_000;
  const remaining = windowTokens - usedTokens;

  // Budget exhausted → must seal regardless of strategy
  if (remaining < turnBudget + safetyMargin) {
    return { type: 'seal', reason: 'budget_exhausted' };
  }

  // Below action threshold
  if (fillRatio < strategy.thresholds.action) {
    if (fillRatio >= strategy.thresholds.warn) {
      return { type: 'warn' };
    }
    return { type: 'none' };
  }

  // At or above action threshold — branch by strategy
  switch (strategy.strategy) {
    case 'handoff':
      return { type: 'seal', reason: 'threshold' };

    case 'compress':
      return { type: 'allow_compress' };

    case 'hybrid': {
      const max = strategy.hybrid?.maxCompressions ?? 2;
      if (compressionCount >= max) {
        return { type: 'seal_after_compress', reason: 'max_compressions' };
      }
      return { type: 'allow_compress' };
    }
  }
}
