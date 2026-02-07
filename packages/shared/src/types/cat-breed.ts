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
 */
export interface CatVariant {
  readonly id: string;              // 'opus-4.6', 'codex-default'
  readonly provider: CatProvider;
  readonly defaultModel: string;
  readonly mcpSupport: boolean;
  readonly cli: CliConfig;
  readonly personality?: string;
  readonly strengths?: readonly string[];
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
  readonly avatar: string;
  readonly color: CatColor;
  readonly mentionPatterns: readonly string[];
  readonly roleDescription: string;
  readonly defaultVariantId: string;
  readonly variants: readonly CatVariant[];
}

/**
 * Root config: versioned, contains all breeds
 */
export interface CatCafeConfig {
  readonly version: 1;
  readonly breeds: readonly CatBreed[];
}
