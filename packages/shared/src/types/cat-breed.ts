/**
 * Cat Breed & Variant Types
 * Breed+Variant 两层 schema：Breed 是猫种（布偶/缅因/暹罗），
 * Variant 是同一猫种下的不同模型/配置。
 *
 * Phase 3.5: 每 Breed 有 1 个 default Variant
 * Phase 4-F: 支持多 Variant（多版本猫召唤）
 */

import type { CatId } from './ids.js';
import type { CatColor, CatProvider } from './cat.js';
import type { VoiceConfig } from './tts.js';

/**
 * Per-cat context budget configuration.
 * Controls how much history/context is sent to each cat.
 */
export interface ContextBudget {
  /** Total prompt token limit (including system prompt + context + user message) */
  readonly maxPromptTokens: number;
  /** Maximum tokens for historical context */
  readonly maxContextTokens: number;
  /** Maximum number of historical messages to include */
  readonly maxMessages: number;
  /** Maximum characters per single message (truncation point) */
  readonly maxContentLengthPerMsg: number;
}

/**
 * CLI invocation config for a variant
 */
export interface CliConfig {
  readonly command: string;         // 'claude' | 'codex' | 'gemini'
  readonly outputFormat: string;    // 'stream-json' | 'json'
  readonly defaultArgs?: readonly string[];
}

/**
 * A specific model/config variant within a breed.
 * e.g. ragdoll breed → opus-4.6 variant, opus-4.5 variant
 *
 * F32-b: Variants can override catId, displayName, and mentionPatterns
 * to register as independent cats within the same breed.
 */
export interface CatVariant {
  readonly id: string;              // 'opus-4.6', 'codex-default'
  /** Override breed-level catId to register as an independent cat (F32-b) */
  readonly catId?: string;
  /** Override breed-level displayName (F32-b) */
  readonly displayName?: string;
  /** F32-b P4: Human-readable label for disambiguation (e.g. "4.5", "Sonnet") */
  readonly variantLabel?: string;
  /** Independent mention patterns for this variant (F32-b).
   *  Default variant inherits breed mentionPatterns; non-default variants fallback to @catId when unspecified. */
  readonly mentionPatterns?: readonly string[];
  readonly provider: CatProvider;
  readonly defaultModel: string;
  readonly mcpSupport: boolean;
  readonly cli: CliConfig;
  readonly personality?: string;
  readonly strengths?: readonly string[];
  /** F32-b P4c: Override breed-level avatar for this variant */
  readonly avatar?: string;
  /** F32-b P4c: Override breed-level color for this variant */
  readonly color?: CatColor;
  /** Per-cat context budget (optional, falls back to defaults) */
  readonly contextBudget?: ContextBudget;
  /** F34: Per-cat TTS voice (optional, falls back to defaults in cat-voices.ts) */
  readonly voiceConfig?: VoiceConfig;
}

/**
 * Per-cat feature flags.
 * Controls which subsystems are enabled for each cat.
 */
export interface CatFeatures {
  /** F24: Enable session chain (context health tracking, auto-seal, bootstrap).
   *  Default: true. Set false for cats with inaccurate token stats (e.g. Gemini). */
  readonly sessionChain?: boolean;
}

/**
 * A cat breed — the identity layer (name, avatar, color, role).
 * Each breed has one or more variants (model configs).
 */
export interface CatBreed {
  readonly id: string;              // 'ragdoll', 'maine-coon', 'siamese'
  readonly catId: CatId;
  readonly name: string;            // '布偶猫'
  readonly displayName: string;
  /** Nickname given by 铲屎官. See docs/stories/cat-names.md */
  readonly nickname?: string;
  readonly avatar: string;
  readonly color: CatColor;
  readonly mentionPatterns: readonly string[];
  readonly roleDescription: string;
  readonly defaultVariantId: string;
  readonly variants: readonly CatVariant[];
  /** Per-cat feature flags (optional, all features enabled by default) */
  readonly features?: CatFeatures;
}

/**
 * Root config: versioned, contains all breeds
 */
export interface CatCafeConfig {
  readonly version: 1;
  readonly breeds: readonly CatBreed[];
}
