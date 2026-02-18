/**
 * Cat Model Configuration
 * 优先级: 环境变量 > cat-config.json > 硬编码默认值
 *
 * 环境变量 (最高优先级):
 *   CAT_OPUS_MODEL   → 布偶猫模型
 *   CAT_CODEX_MODEL  → 缅因猫模型
 *   CAT_GEMINI_MODEL → 暹罗猫模型
 *
 * 或直接修改项目根目录的 cat-config.json
 */

import { catRegistry, CAT_CONFIGS } from '@cat-cafe/shared';
import { loadCatConfig, getDefaultVariant } from './cat-config-loader.js';

const MODEL_ENV_KEYS = {
  opus: 'CAT_OPUS_MODEL',
  codex: 'CAT_CODEX_MODEL',
  gemini: 'CAT_GEMINI_MODEL',
} as const;

// 缓存从 cat-config.json 加载的模型配置
let cachedJsonModels: Record<string, string> | null = null;

function loadModelsFromJson(): Record<string, string> {
  if (cachedJsonModels) return cachedJsonModels;

  try {
    const config = loadCatConfig();
    cachedJsonModels = {};
    for (const breed of config.breeds) {
      const variant = getDefaultVariant(breed);
      cachedJsonModels[breed.catId] = variant.defaultModel;
    }
    return cachedJsonModels;
  } catch {
    // cat-config.json 不存在或无效，返回空对象
    cachedJsonModels = {};
    return cachedJsonModels;
  }
}

/**
 * 获取猫的实际模型
 * 优先级: 环境变量 > cat-config.json > CAT_CONFIGS 硬编码
 */
export function getCatModel(catName: string): string {
  // 1. 环境变量最高优先
  const envKey = MODEL_ENV_KEYS[catName as keyof typeof MODEL_ENV_KEYS];
  const envValue = envKey ? (process.env[envKey] as string | undefined) : undefined;
  if (envValue && envValue.trim()) {
    return envValue.trim();
  }

  // 2. cat-config.json 次优先
  const jsonModels = loadModelsFromJson();
  if (jsonModels[catName]) {
    return jsonModels[catName];
  }

  // 3. 硬编码默认值
  const config = CAT_CONFIGS[catName];
  if (config) {
    return config.defaultModel;
  }

  // 4. F32-a: catRegistry fallback for dynamically registered cats
  const entry = catRegistry.tryGet(catName);
  if (entry) {
    return entry.config.defaultModel;
  }

  throw new Error(`No model configured for cat "${catName}"`);
}

/**
 * 获取所有猫的模型配置 (用于 ConfigRegistry)
 */
export function getAllCatModels(): Record<string, string> {
  const result: Record<string, string> = {};
  // F32-a: iterate catRegistry (dynamic) with CAT_CONFIGS fallback
  const allIds = catRegistry.getAllIds().length > 0
    ? catRegistry.getAllIds().map(String)
    : Object.keys(CAT_CONFIGS);
  for (const catName of allIds) {
    result[catName] = getCatModel(catName);
  }
  return result;
}
