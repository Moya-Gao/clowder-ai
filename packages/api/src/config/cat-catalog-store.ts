import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import type { CatCafeConfig, ClientId, Roster } from '@cat-cafe/shared';
import {
  type BuiltinAccountClient,
  builtinAccountIdForClient,
  resolveBuiltinClientForProvider,
} from './account-resolver.js';
import { resolveProjectTemplatePath } from './project-template-path.js';

const CONFIG_SUBDIR = '.cat-cafe';
const CAT_CATALOG_FILENAME = 'cat-catalog.json';

function safePath(projectRoot: string, ...segments: string[]): string {
  const root = resolve(projectRoot);
  const normalized = resolve(root, ...segments);
  const rel = relative(root, normalized);
  if (rel.startsWith(`..${sep}`) || rel === '..') {
    throw new Error(`Path escapes project root: ${normalized}`);
  }
  return normalized;
}

function writeFileAtomic(filePath: string, content: string): void {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tempPath, content, 'utf-8');
  try {
    renameSync(tempPath, filePath);
  } catch (error) {
    try {
      unlinkSync(tempPath);
    } catch {
      // Ignore cleanup failures.
    }
    throw error;
  }
}

/** F340 P5: ClientId values — used to detect old `provider` field holding a clientId. */
const CLIENT_ID_VALUES = new Set(['anthropic', 'openai', 'google', 'dare', 'antigravity', 'opencode', 'a2a']);

/**
 * F340: One-time catalog variant migration — rewrites file on disk then never runs again.
 *   1. old `provider` (clientId value) → `clientId` (P5 field rename)
 *   2. old `ocProviderName` → `provider` (P5 field rename)
 *   3. old `providerProfileId` → `accountRef` (P5 field rename)
 *   4. Assign default `accountRef` for builtin clients that lack one
 */
function migrateCatalogVariants(catalog: CatCafeConfig): { catalog: CatCafeConfig; dirty: boolean } {
  let dirty = false;
  const next = structuredClone(catalog) as CatCafeConfig;

  for (const breed of next.breeds as unknown as Record<string, unknown>[]) {
    const variants = Array.isArray(breed.variants) ? (breed.variants as Record<string, unknown>[]) : [];
    for (const variant of variants) {
      // P5 step 1: old `provider` holding a ClientId value → `clientId`
      if (typeof variant.provider === 'string' && CLIENT_ID_VALUES.has(variant.provider)) {
        if (!variant.clientId) {
          variant.clientId = variant.provider;
          delete variant.provider;
          dirty = true;
        } else if (variant.clientId === variant.provider) {
          delete variant.provider;
          dirty = true;
        }
      }

      // P5 step 2: old `ocProviderName` → `provider`
      if (typeof variant.ocProviderName === 'string' && variant.provider === undefined) {
        variant.provider = variant.ocProviderName;
        delete variant.ocProviderName;
        dirty = true;
      }

      const client = resolveBuiltinClientForProvider((variant.clientId ?? variant.provider) as ClientId);
      if (!client) continue;

      const existingAccountRef = typeof variant.accountRef === 'string' ? variant.accountRef.trim() : '';
      const legacyProfileId = typeof variant.providerProfileId === 'string' ? variant.providerProfileId.trim() : '';

      // P5 step 3: providerProfileId → accountRef
      if (legacyProfileId && !existingAccountRef) {
        variant.accountRef = legacyProfileId;
        delete variant.providerProfileId;
        dirty = true;
        continue;
      }
      if (legacyProfileId) {
        delete variant.providerProfileId;
        dirty = true;
      }

      // Assign default accountRef if missing
      if (!existingAccountRef) {
        variant.accountRef = builtinAccountIdForClient(client);
        dirty = true;
      }
    }
  }

  return { catalog: next, dirty };
}

export function resolveCatCatalogPath(projectRoot: string): string {
  return safePath(projectRoot, CONFIG_SUBDIR, CAT_CATALOG_FILENAME);
}

export function readCatCatalogRaw(projectRoot: string): string | null {
  const catalogPath = resolveCatCatalogPath(projectRoot);
  if (!existsSync(catalogPath)) return null;
  const raw = readFileSync(catalogPath, 'utf-8');
  try {
    const parsed = JSON.parse(raw) as CatCafeConfig;
    const migrated = migrateCatalogVariants(parsed);
    if (migrated.dirty) {
      const nextRaw = `${JSON.stringify(migrated.catalog, null, 2)}\n`;
      writeFileAtomic(catalogPath, nextRaw);
      return nextRaw;
    }
  } catch {
    // Leave invalid JSON handling to the loader so callers see the original parse error.
  }
  return raw;
}

export function readCatCatalog(projectRoot: string): CatCafeConfig | null {
  const raw = readCatCatalogRaw(projectRoot);
  if (raw === null) return null;
  return JSON.parse(raw) as CatCafeConfig;
}

export function bootstrapCatCatalog(projectRoot: string, templatePath: string): string {
  const catalogPath = resolveCatCatalogPath(projectRoot);
  if (existsSync(catalogPath)) {
    readCatCatalogRaw(projectRoot);
    return catalogPath;
  }

  // F340: cat-template.json is the sole config source — cat-config.json is no longer read at runtime.
  const template = JSON.parse(readFileSync(templatePath, 'utf-8')) as CatCafeConfig;

  // Assign default accountRefs to variants that lack them
  const { catalog: runtimeCatalog } = migrateCatalogVariants(template);

  mkdirSync(dirname(catalogPath), { recursive: true });
  writeFileAtomic(catalogPath, `${JSON.stringify(runtimeCatalog, null, 2)}\n`);
  return catalogPath;
}

export function writeCatCatalog(projectRoot: string, catalog: CatCafeConfig): string {
  const catalogPath = resolveCatCatalogPath(projectRoot);
  mkdirSync(dirname(catalogPath), { recursive: true });
  writeFileAtomic(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  return catalogPath;
}
