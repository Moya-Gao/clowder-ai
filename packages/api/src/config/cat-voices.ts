/**
 * F34/F066: Cat Voice Configuration
 * Per-cat TTS voice settings, mirroring cat-budgets.ts pattern.
 *
 * Priority: env var override > cat-config.json voiceConfig > hardcoded defaults
 *
 * Voice names are Kokoro-82M (mlx-audio) voice IDs.
 * The Python TTS server (scripts/tts-api.py) handles provider switching —
 * if TTS_PROVIDER=edge-tts, EdgeTtsAdapter maps Kokoro names to Microsoft voices.
 *
 * Env vars:
 *   CAT_OPUS_TTS_VOICE    → 布偶猫 voice ID
 *   CAT_CODEX_TTS_VOICE   → 缅因猫 voice ID
 *   CAT_GEMINI_TTS_VOICE  → 暹罗猫 voice ID
 */

import type { VoiceConfig } from '@cat-cafe/shared';
import { catRegistry } from '@cat-cafe/shared';
import { resolveBreedId } from './breed-resolver.js';
import { getAllCatIdsFromConfig, getDefaultVariant, loadCatConfig } from './cat-config-loader.js';

const VOICE_ENV_KEYS = {
  opus: 'CAT_OPUS_TTS_VOICE',
  codex: 'CAT_CODEX_TTS_VOICE',
  gemini: 'CAT_GEMINI_TTS_VOICE',
} as const;

/**
 * Hardcoded defaults — keyed by breedId so all variants share the same voice.
 *
 * Kokoro voice IDs (mlx-audio):          edge-tts equivalents (for reference):
 *   zm_yunjian  → 低沉温暖              zh-CN-YunjianNeural
 *   zm_yunxi    → 清朗书生              zh-CN-YunxiNeural
 *   zm_yunyang  → 明快活泼              zh-CN-YunyangNeural
 *
 * 声线待铲屎官试听后可能更新（F066 声线试听流程）。
 */
const DEFAULT_VOICES: Record<string, VoiceConfig> = {
  ragdoll: { voice: 'zm_yunjian', langCode: 'z', speed: 0.95 }, // 宪宪: 温柔少年
  'maine-coon': { voice: 'zm_yunxi', langCode: 'z', speed: 1.0 }, // 砚砚: 清朗书生
  siamese: { voice: 'zm_yunyang', langCode: 'z', speed: 1.05 }, // 烁烁: 活泼明快
};

/** Conservative fallback for unknown/dynamic cats */
const GLOBAL_FALLBACK_VOICE: VoiceConfig = {
  voice: 'zm_yunjian',
  langCode: 'z',
  speed: 1.0,
};

// Cache from cat-config.json
let cachedJsonVoices: Record<string, VoiceConfig> | null = null;

function loadVoicesFromJson(): Record<string, VoiceConfig> {
  if (cachedJsonVoices) return cachedJsonVoices;

  try {
    const config = loadCatConfig();
    cachedJsonVoices = {};
    for (const breed of config.breeds) {
      const variant = getDefaultVariant(breed);
      if (variant.voiceConfig) {
        cachedJsonVoices[breed.catId] = variant.voiceConfig;
      }
    }
    return cachedJsonVoices;
  } catch {
    cachedJsonVoices = {};
    return cachedJsonVoices;
  }
}

/**
 * Get TTS voice config for a cat.
 * Priority: env var override (voice only) > cat-config.json > hardcoded defaults (by breedId)
 */
export function getCatVoice(catName: string): VoiceConfig {
  // 1. Get base voice from JSON or default (resolve breedId for DEFAULT_VOICES)
  const jsonVoices = loadVoicesFromJson();
  const breedId = resolveBreedId(catName);
  const baseVoice: VoiceConfig =
    jsonVoices[catName] ??
    (breedId ? DEFAULT_VOICES[breedId] : undefined) ??
    DEFAULT_VOICES[catName] ??
    GLOBAL_FALLBACK_VOICE;

  // 2. Check for per-cat env var override (voice ID only)
  const perCatEnvKey = VOICE_ENV_KEYS[catName as keyof typeof VOICE_ENV_KEYS];
  const perCatEnvValue = process.env[perCatEnvKey];
  if (perCatEnvValue?.trim()) {
    return {
      ...baseVoice,
      voice: perCatEnvValue.trim(),
    };
  }

  return baseVoice;
}

/**
 * Get all cat voices (for diagnostics/display)
 */
export function getAllCatVoices(): Record<string, VoiceConfig> {
  const result: Record<string, VoiceConfig> = {};
  // F032 P2: use dynamic config fallback instead of hardcoded cat names
  const registryIds = catRegistry.getAllIds();
  const allIds = registryIds.length > 0 ? registryIds.map(String) : getAllCatIdsFromConfig();
  for (const catName of allIds) {
    result[catName] = getCatVoice(catName);
  }
  return result;
}

/** Clear cached voices (for testing) */
export function clearVoiceCache(): void {
  cachedJsonVoices = null;
}
