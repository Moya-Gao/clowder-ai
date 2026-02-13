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

const catVariantSchema = z.object({
  id: z.string().min(1),
  provider: z.enum(['anthropic', 'openai', 'google']),
  defaultModel: z.string().min(1),
  mcpSupport: z.boolean(),
  cli: cliConfigSchema,
  personality: z.string().optional(),
  strengths: z.array(z.string()).optional(),
  contextBudget: contextBudgetSchema.optional(),
});

const catBreedSchema = z.object({
  id: z.string().min(1),
  catId: z.enum(['opus', 'codex', 'gemini']),
  name: z.string().min(1),
  displayName: z.string().min(1),
  avatar: z.string().min(1),
  color: z.object({ primary: z.string(), secondary: z.string() }),
  mentionPatterns: z.array(z.string().min(1)).min(1),
  roleDescription: z.string().min(1),
  defaultVariantId: z.string().min(1),
  variants: z.array(catVariantSchema).min(1),
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

/** Convert CatCafeConfig → flat CatConfig Record (backward compat) */
export function toFlatConfigs(config: CatCafeConfig): Record<string, CatConfig> {
  const result: Record<string, CatConfig> = {};
  for (const breed of config.breeds) {
    const variant = getDefaultVariant(breed);
    result[breed.catId] = {
      id: createCatId(breed.catId),
      name: breed.catId,
      displayName: breed.displayName,
      avatar: breed.avatar,
      color: breed.color,
      mentionPatterns: breed.mentionPatterns,
      provider: variant.provider,
      defaultModel: variant.defaultModel,
      mcpSupport: variant.mcpSupport,
      roleDescription: breed.roleDescription,
      personality: variant.personality ?? '',
    };
  }
  return result;
}

/** Find a breed by checking mention patterns against text */
export function findBreedByMention(
  config: CatCafeConfig,
  text: string,
): { breed: CatBreed; catId: CatId } | undefined {
  const lower = text.toLowerCase();
  for (const breed of config.breeds) {
    for (const pattern of breed.mentionPatterns) {
      if (lower.includes(pattern.toLowerCase())) {
        return { breed, catId: createCatId(breed.catId) };
      }
    }
  }
  return undefined;
}
