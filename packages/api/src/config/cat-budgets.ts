/**
 * Cat Context Budget Configuration
 * 优先级: 环境变量 > cat-config.json > 硬编码默认值
 *
 * 环境变量 (最高优先级, 覆盖单个字段):
 *   CAT_OPUS_MAX_PROMPT_CHARS   → 布偶猫 prompt 上限
 *   CAT_CODEX_MAX_PROMPT_CHARS  → 缅因猫 prompt 上限
 *   CAT_GEMINI_MAX_PROMPT_CHARS → 暹罗猫 prompt 上限
 *   MAX_PROMPT_CHARS            → 全局默认 (fallback)
 *
 * 或直接修改项目根目录的 cat-config.json
 */

import type { ContextBudget } from '@cat-cafe/shared';
import { loadCatConfig, getDefaultVariant } from './cat-config-loader.js';

const BUDGET_ENV_KEYS = {
  opus: 'CAT_OPUS_MAX_PROMPT_CHARS',
  codex: 'CAT_CODEX_MAX_PROMPT_CHARS',
  gemini: 'CAT_GEMINI_MAX_PROMPT_CHARS',
} as const;

/** Hardcoded defaults if cat-config.json missing or incomplete */
const DEFAULT_BUDGETS: Record<string, ContextBudget> = {
  opus: { maxPromptChars: 500000, maxContextChars: 300000, maxMessages: 200, maxContentLengthPerMsg: 10000 },
  codex: { maxPromptChars: 650000, maxContextChars: 400000, maxMessages: 200, maxContentLengthPerMsg: 10000 },
  gemini: { maxPromptChars: 800000, maxContextChars: 500000, maxMessages: 300, maxContentLengthPerMsg: 15000 },
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
 * Priority: env var override (maxPromptChars only) > cat-config.json > hardcoded default
 */
export function getCatContextBudget(catName: 'opus' | 'codex' | 'gemini'): ContextBudget {
  // 1. Get base budget from JSON or default (guaranteed to exist in DEFAULT_BUDGETS)
  const jsonBudgets = loadBudgetsFromJson();
  const baseBudget: ContextBudget = jsonBudgets[catName] ?? DEFAULT_BUDGETS[catName]!;

  // 2. Check for per-cat env var override
  const perCatEnvKey = BUDGET_ENV_KEYS[catName];
  const perCatEnvValue = process.env[perCatEnvKey];
  if (perCatEnvValue && perCatEnvValue.trim()) {
    const parsed = parseInt(perCatEnvValue.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return {
        maxPromptChars: parsed,
        maxContextChars: baseBudget.maxContextChars,
        maxMessages: baseBudget.maxMessages,
        maxContentLengthPerMsg: baseBudget.maxContentLengthPerMsg,
      };
    }
  }

  // 3. Check for global fallback env var
  const globalEnvValue = process.env['MAX_PROMPT_CHARS'];
  if (globalEnvValue && globalEnvValue.trim()) {
    const parsed = parseInt(globalEnvValue.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return {
        maxPromptChars: parsed,
        maxContextChars: baseBudget.maxContextChars,
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
  return {
    opus: getCatContextBudget('opus'),
    codex: getCatContextBudget('codex'),
    gemini: getCatContextBudget('gemini'),
  };
}

/**
 * Clear cached budgets (for testing)
 */
export function clearBudgetCache(): void {
  cachedJsonBudgets = null;
}
