/**
 * Cat Config Loader
 * 从 cat-config.json 加载 Breed+Variant 配置。
 * Node-only — 前端继续用 shared 包的 CAT_CONFIGS 常量。
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { CatConfig, CatId } from '@cat-cafe/shared';
import { createCatId } from '@cat-cafe/shared';
import type { CatBreed, CatCafeConfig, CatVariant } from '@cat-cafe/shared';

/**
 * Default cat-config.json location (repo root).
 *
 * IMPORTANT: API dev scripts run with cwd=`packages/api`, so `process.cwd()` is
 * not the repo root. Resolve relative to this file instead to keep behavior
 * stable across different launch directories.
 */
const DEFAULT_CAT_CONFIG_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
  'cat-config.json',
);

const cliConfigSchema = z.object({
  command: z.string().min(1),
  outputFormat: z.string().min(1),
  defaultArgs: z.array(z.string()).optional(),
});

const contextBudgetSchema = z.object({
  maxPromptTokens: z.number().positive(),
  maxContextTokens: z.number().positive(),
  maxMessages: z.number().positive().int(),
  maxContentLengthPerMsg: z.number().positive(),
});

/** F32-b: mentionPatterns must start with @ */
const mentionPatternSchema = z.string().min(2).regex(
  /^@/,
  'mentionPattern must start with @',
);

const colorSchema = z.object({ primary: z.string(), secondary: z.string() });

const catVariantSchema = z.object({
  id: z.string().min(1),
  catId: z.string().min(1).optional(),                        // F32-b: variant-level catId
  displayName: z.string().min(1).optional(),                  // F32-b: variant-level displayName
  variantLabel: z.string().min(1).optional(),                 // F32-b P4: disambiguation label
  mentionPatterns: z.array(mentionPatternSchema).optional(),  // F32-b: variant-level mentions
  provider: z.enum(['anthropic', 'openai', 'google']),
  defaultModel: z.string().min(1),
  mcpSupport: z.boolean(),
  cli: cliConfigSchema,
  personality: z.string().optional(),
  strengths: z.array(z.string()).optional(),
  avatar: z.string().min(1).optional(),                       // F32-b P4c: override breed avatar
  color: colorSchema.optional(),                              // F32-b P4c: override breed color
  contextBudget: contextBudgetSchema.optional(),
});

const catFeaturesSchema = z.object({
  sessionChain: z.boolean().optional(),
}).optional();

const catBreedSchema = z.object({
  id: z.string().min(1),
  catId: z.string().min(1),
  name: z.string().min(1),
  displayName: z.string().min(1),
  nickname: z.string().optional(),
  avatar: z.string().min(1),
  color: colorSchema,
  mentionPatterns: z.array(mentionPatternSchema).min(1),
  roleDescription: z.string().min(1),
  defaultVariantId: z.string().min(1),
  variants: z.array(catVariantSchema).min(1),
  features: catFeaturesSchema,
});

const catCafeConfigSchema = z.object({
  version: z.literal(1),
  breeds: z.array(catBreedSchema).min(1),
});

/**
 * Load and validate cat-config.json.
 * @param filePath - Explicit path or auto-resolved from env/project root
 */
export function loadCatConfig(filePath?: string): CatCafeConfig {
  const resolvedPath = filePath
    ?? process.env['CAT_CONFIG_PATH']
    ?? DEFAULT_CAT_CONFIG_PATH;

  let raw: string;
  try {
    raw = readFileSync(resolvedPath, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    throw new Error(`Failed to read cat config at ${resolvedPath}: ${code ?? 'unknown error'}`);
  }

  const json: unknown = JSON.parse(raw);
  const result = catCafeConfigSchema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid cat config:\n${issues.join('\n')}`);
  }

  // Validate defaultVariantId references
  for (const breed of result.data.breeds) {
    const found = breed.variants.find((v) => v.id === breed.defaultVariantId);
    if (!found) {
      throw new Error(
        `Breed "${breed.id}": defaultVariantId "${breed.defaultVariantId}" not found in variants`,
      );
    }
  }

  // Zod output has mutable arrays + plain string catId;
  // CatCafeConfig has readonly arrays + branded CatId.
  // The shapes match at runtime after validation.
  return result.data as unknown as CatCafeConfig;
}

/** Get the default variant for a breed */
export function getDefaultVariant(breed: CatBreed): CatVariant {
  const found = breed.variants.find((variant) => variant.id === breed.defaultVariantId);
  if (!found) throw new Error(`Default variant "${breed.defaultVariantId}" not found for breed "${breed.id}"`);
  return found;
}

/**
 * F32-b: Register ALL variants as independent cats.
 * Each variant becomes a CatConfig entry keyed by its catId.
 * Default variant inherits breed-level mentionPatterns; others default to @catId when unspecified.
 * @throws Error on duplicate catId (fail-fast at startup)
 */
export function toAllCatConfigs(config: CatCafeConfig): Record<string, CatConfig> {
  const result: Record<string, CatConfig> = {};
  for (const breed of config.breeds) {
    // F32-b P4c: resolve default variant personality for non-default fallback
    const defaultVariant = breed.variants.find((v) => v.id === breed.defaultVariantId);

    for (const variant of breed.variants) {
      const isDefault = variant.id === breed.defaultVariantId;
      const catId = variant.catId ?? breed.catId;

      // F32-b R3: catId uniqueness — duplicate is a hard error (startup failure)
      if (result[catId]) {
        throw new Error(
          `Duplicate catId "${catId}": variant "${variant.id}" in breed "${breed.id}" `
          + `conflicts with already registered cat. Each variant must have a unique catId.`,
        );
      }

      result[catId] = {
        id: createCatId(catId),
        name: catId,
        displayName: variant.displayName ?? breed.displayName,
        ...(breed.nickname != null ? { nickname: breed.nickname } : {}),
        avatar: variant.avatar ?? breed.avatar,    // F32-b P4c: variant can override
        color: variant.color ?? breed.color,        // F32-b P4c: variant can override
        mentionPatterns: variant.mentionPatterns
          ?? (isDefault ? breed.mentionPatterns : [`@${catId}`]),
        provider: variant.provider,
        defaultModel: variant.defaultModel,
        mcpSupport: variant.mcpSupport,
        roleDescription: breed.roleDescription,
        personality: variant.personality ?? defaultVariant?.personality ?? '',
        breedId: breed.id,
        breedDisplayName: breed.displayName,
        ...(variant.variantLabel != null ? { variantLabel: variant.variantLabel } : {}),
        isDefaultVariant: isDefault,
      };
    }
  }
  return result;
}

/** Backward-compat alias — now registers all variants, not just defaults */
export function toFlatConfigs(config: CatCafeConfig): Record<string, CatConfig> {
  return toAllCatConfigs(config);
}

/**
 * Find a breed by checking mention patterns against text.
 * F32-b P4c: Uses longest-match-first to avoid prefix collisions
 * (e.g. `@布偶sonnet` must match Sonnet variant, not breed-level `@布偶`).
 */
export function findBreedByMention(
  config: CatCafeConfig,
  text: string,
): { breed: CatBreed; catId: CatId } | undefined {
  const lower = text.toLowerCase();

  // Collect all patterns with their resolution targets
  const entries: { pattern: string; breed: CatBreed; catId: string }[] = [];
  for (const breed of config.breeds) {
    for (const pattern of breed.mentionPatterns) {
      entries.push({ pattern: pattern.toLowerCase(), breed, catId: breed.catId });
    }
    for (const variant of breed.variants) {
      if (variant.mentionPatterns) {
        const catId = variant.catId ?? breed.catId;
        for (const pattern of variant.mentionPatterns) {
          entries.push({ pattern: pattern.toLowerCase(), breed, catId });
        }
      }
    }
  }

  // Sort longest-first to prevent prefix collisions
  entries.sort((a, b) => b.pattern.length - a.pattern.length);

  for (const entry of entries) {
    if (lower.includes(entry.pattern)) {
      return { breed: entry.breed, catId: createCatId(entry.catId) };
    }
  }
  return undefined;
}

// ── F24 Feature Toggle ──────────────────────────────────────────────

let _cachedConfig: CatCafeConfig | null = null;
let _configLoadFailed = false;

function getCachedConfig(): CatCafeConfig | null {
  if (_configLoadFailed) return null;
  if (!_cachedConfig) {
    try {
      _cachedConfig = loadCatConfig();
    } catch (err) {
      _configLoadFailed = true;
      console.warn('[cat-config] Failed to load cat-config.json, F24 toggle will default to enabled:', err);
      return null;
    }
  }
  return _cachedConfig;
}

// ── F32-b: catId → breed index (for variant-aware feature lookups) ────

/**
 * Build an index mapping every catId (including variant-level) to its parent breed.
 * Used by isSessionChainEnabled() to correctly resolve features for variants.
 */
export function buildCatIdToBreedIndex(config: CatCafeConfig): Map<string, CatBreed> {
  const index = new Map<string, CatBreed>();
  for (const breed of config.breeds) {
    for (const variant of breed.variants) {
      const catId = variant.catId ?? breed.catId;
      index.set(catId, breed);
    }
  }
  return index;
}

// Cache bound to config reference — rebuilt if different config is passed (e.g. tests)
let _catIdToBreed: Map<string, CatBreed> | null = null;
let _catIdToBreedSource: CatCafeConfig | null = null;

/**
 * Check if F24 session chain is enabled for a cat.
 * Returns true by default — only false when explicitly disabled in cat-config.json.
 * Gracefully returns true if config file is unreadable (availability over strictness).
 *
 * F32-b: Now resolves variant catIds to their parent breed via index.
 * Design constraint: Cat Cafe config is loaded once at startup, no hot-reload.
 *
 * @param catId - The cat to check (e.g. 'opus', 'codex', 'opus-45')
 * @param config - Optional config override (for testing)
 */
export function isSessionChainEnabled(catId: CatId | string, config?: CatCafeConfig): boolean {
  const cfg = config ?? getCachedConfig();
  if (!cfg) return true; // Config unreadable → default enabled (Cloud P1 fix)

  // Rebuild index if config reference changed (test injection)
  if (!_catIdToBreed || _catIdToBreedSource !== cfg) {
    _catIdToBreed = buildCatIdToBreedIndex(cfg);
    _catIdToBreedSource = cfg;
  }

  const breed = _catIdToBreed.get(catId as string);
  if (!breed) return true; // Unknown cat → default enabled
  return breed.features?.sessionChain !== false;
}

// ── F32-b: Default cat resolution ─────────────────────────────────────

let _defaultCatId: CatId | null = null;

/**
 * Get the default cat ID (= breeds[0].defaultVariantId's resolved catId).
 * Used as ultimate fallback in AgentRouter when no mentions/participants/preferredCats.
 *
 * F32-b R4: Explicit derivation from defaultVariantId — NOT registry order dependent.
 */
export function getDefaultCatId(): CatId {
  if (_defaultCatId) return _defaultCatId;

  const config = getCachedConfig();
  const firstBreed = config?.breeds[0];
  if (firstBreed) {
    const defaultVariant = firstBreed.variants.find(
      (v) => v.id === firstBreed.defaultVariantId,
    );
    // variant has independent catId → use it; otherwise inherit breed's
    _defaultCatId = createCatId(defaultVariant?.catId ?? firstBreed.catId);
    return _defaultCatId;
  }

  // Ultimate fallback (should not trigger — config always has at least 1 breed)
  return createCatId('opus');
}

/** Reset cached config (for testing) */
export function _resetCachedConfig(): void {
  _cachedConfig = null;
  _configLoadFailed = false;
  _catIdToBreed = null;
  _catIdToBreedSource = null;
  _defaultCatId = null;
}
