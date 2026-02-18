/**
 * Cat Context Budget Configuration
 * 优先级: 环境变量 > cat-config.json > 硬编码默认值
 *
 * 环境变量 (最高优先级, 覆盖单个字段):
 *   CAT_OPUS_MAX_PROMPT_TOKENS   → 布偶猫 prompt token 上限
 *   CAT_CODEX_MAX_PROMPT_TOKENS  → 缅因猫 prompt token 上限
 *   CAT_GEMINI_MAX_PROMPT_TOKENS → 暹罗猫 prompt token 上限
 *   MAX_PROMPT_TOKENS            → 全局默认 token (fallback)
 *
 * 或直接修改项目根目录的 cat-config.json
 */

import type { ContextBudget } from '@cat-cafe/shared';
import { catRegistry } from '@cat-cafe/shared';
import { loadCatConfig, getDefaultVariant } from './cat-config-loader.js';

const BUDGET_ENV_KEYS = {
  opus: 'CAT_OPUS_MAX_PROMPT_TOKENS',
  codex: 'CAT_CODEX_MAX_PROMPT_TOKENS',
  gemini: 'CAT_GEMINI_MAX_PROMPT_TOKENS',
} as const;

/** Hardcoded defaults if cat-config.json missing or incomplete */
const DEFAULT_BUDGETS: Record<string, ContextBudget> = {
  opus: { maxPromptTokens: 150000, maxContextTokens: 100000, maxMessages: 200, maxContentLengthPerMsg: 10000 },
  codex: { maxPromptTokens: 100000, maxContextTokens: 60000, maxMessages: 200, maxContentLengthPerMsg: 10000 },
  gemini: { maxPromptTokens: 200000, maxContextTokens: 150000, maxMessages: 300, maxContentLengthPerMsg: 15000 },
};

/** F32-a: Conservative fallback for unknown/dynamic cats — use smallest built-in budget */
const GLOBAL_FALLBACK_BUDGET: ContextBudget = {
  maxPromptTokens: 100000,
  maxContextTokens: 60000,
  maxMessages: 200,
  maxContentLengthPerMsg: 10000,
};

// Cache from cat-config.json
let cachedJsonBudgets: Record<string, ContextBudget> | null = null;

function loadBudgetsFromJson(): Record<string, ContextBudget> {
  if (cachedJsonBudgets) return cachedJsonBudgets;

  try {
    const config = loadCatConfig();
    cachedJsonBudgets = {};
    for (const breed of config.breeds) {
      const variant = getDefaultVariant(breed);
      if (variant.contextBudget) {
        cachedJsonBudgets[breed.catId] = variant.contextBudget;
      }
    }
    return cachedJsonBudgets;
  } catch {
    // cat-config.json doesn't exist or is invalid
    cachedJsonBudgets = {};
    return cachedJsonBudgets;
  }
}

/**
 * Get context budget for a cat.
 * Priority: env var override (maxPromptTokens only) > cat-config.json > hardcoded defaults
 */
export function getCatContextBudget(catName: string): ContextBudget {
  // 1. Get base budget from JSON or default
  const jsonBudgets = loadBudgetsFromJson();
  const baseBudget: ContextBudget = jsonBudgets[catName]
    ?? DEFAULT_BUDGETS[catName]
    ?? GLOBAL_FALLBACK_BUDGET; // F32-a: conservative fallback for dynamic cats

  // 2. Check for per-cat env var override
  const perCatEnvKey = BUDGET_ENV_KEYS[catName as keyof typeof BUDGET_ENV_KEYS];
  const perCatEnvValue = process.env[perCatEnvKey];
  if (perCatEnvValue && perCatEnvValue.trim()) {
    const parsed = parseInt(perCatEnvValue.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return {
        maxPromptTokens: parsed,
        maxContextTokens: baseBudget.maxContextTokens,
        maxMessages: baseBudget.maxMessages,
        maxContentLengthPerMsg: baseBudget.maxContentLengthPerMsg,
      };
    }
  }

  // 3. Check for global fallback env var
  const globalEnvValue = process.env['MAX_PROMPT_TOKENS'];
  if (globalEnvValue && globalEnvValue.trim()) {
    const parsed = parseInt(globalEnvValue.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return {
        maxPromptTokens: parsed,
        maxContextTokens: baseBudget.maxContextTokens,
        maxMessages: baseBudget.maxMessages,
        maxContentLengthPerMsg: baseBudget.maxContentLengthPerMsg,
      };
    }
  }

  return baseBudget;
}

/**
 * Get all cat budgets (for ConfigRegistry display)
 */
export function getAllCatBudgets(): Record<string, ContextBudget> {
  const result: Record<string, ContextBudget> = {};
  // F32-a: iterate catRegistry (includes dynamic cats), fallback to DEFAULT_BUDGETS keys
  const allIds = catRegistry.getAllIds().length > 0
    ? catRegistry.getAllIds().map(String)
    : Object.keys(DEFAULT_BUDGETS);
  for (const catName of allIds) {
    result[catName] = getCatContextBudget(catName);
  }
  return result;
}

/**
 * Clear cached budgets (for testing)
 */
export function clearBudgetCache(): void {
  cachedJsonBudgets = null;
}
