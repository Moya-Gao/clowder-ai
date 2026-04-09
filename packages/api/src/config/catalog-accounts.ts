/**
 * F340 — Global accounts read/write layer
 *
 * Accounts now live in ~/.cat-cafe/accounts.json (global, cross-instance).
 * Replaces the old project-level CatCafeConfigV2.accounts section.
 *
 * Migrations (run once per process per source):
 *   1. Legacy provider-profiles.json → accounts.json (global → global)
 *   2. Project-level cat-catalog.json.accounts → accounts.json (per project)
 * Both merge into global without overwriting existing keys.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import type { AccountConfig } from '@cat-cafe/shared';

const CONFIG_SUBDIR = '.cat-cafe';
const ACCOUNTS_FILENAME = 'accounts.json';

function resolveGlobalRoot(): string {
  const envRoot = process.env.CAT_CAFE_GLOBAL_CONFIG_ROOT;
  if (envRoot) return resolve(envRoot);
  return homedir();
}

export function resolveAccountsPath(): string {
  return resolve(resolveGlobalRoot(), CONFIG_SUBDIR, ACCOUNTS_FILENAME);
}

function writeFileAtomic(filePath: string, content: string, mode?: number): void {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tempPath, content, { encoding: 'utf-8', mode: mode ?? 0o644 });
  try {
    renameSync(tempPath, filePath);
  } catch (error) {
    try {
      unlinkSync(tempPath);
    } catch {
      /* ignore cleanup failure */
    }
    throw error;
  }
}

function readAllGlobal(): Record<string, AccountConfig> {
  const accountsPath = resolveAccountsPath();
  if (!existsSync(accountsPath)) return {};
  const raw = readFileSync(accountsPath, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return parsed as Record<string, AccountConfig>;
  } catch {
    // Fix P1-3: corrupt file → backup + warn, not silent swallow
    const backupPath = `${accountsPath}.bak`;
    try {
      copyFileSync(accountsPath, backupPath);
    } catch {
      /* best-effort backup */
    }
    console.error(`[catalog-accounts] corrupt ${accountsPath} — backed up to .bak, treating as empty`);
    return {};
  }
}

function writeAllGlobal(accounts: Record<string, AccountConfig>): void {
  const accountsPath = resolveAccountsPath();
  mkdirSync(resolve(resolveGlobalRoot(), CONFIG_SUBDIR), { recursive: true });
  writeFileAtomic(accountsPath, `${JSON.stringify(accounts, null, 2)}\n`);
}

/** Merge source accounts into global, preserving existing keys. */
function mergeIntoGlobal(source: Record<string, AccountConfig>): { merged: string[]; skipped: string[] } {
  const global = readAllGlobal();
  const merged: string[] = [];
  const skipped: string[] = [];
  for (const [ref, account] of Object.entries(source)) {
    if (ref in global) {
      skipped.push(ref);
    } else {
      global[ref] = account;
      merged.push(ref);
    }
  }
  if (merged.length > 0) writeAllGlobal(global);
  return { merged, skipped };
}

// ── Legacy provider-profiles.json → accounts.json migration ──

/** Migrate legacy provider-profiles.json + secrets from a given root into global accounts. */
function migrateLegacyFrom(root: string): void {
  const metaPath = resolve(root, CONFIG_SUBDIR, 'provider-profiles.json');
  if (!existsSync(metaPath)) return;
  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  // v2/v3: flat array of profiles.  v1: nested { providers: { <client>: { profiles: [...] } } }.
  const rawProviders = meta?.providers ?? meta?.profiles;
  let providers: Array<Record<string, unknown>>;
  if (Array.isArray(rawProviders)) {
    providers = rawProviders;
  } else if (rawProviders != null && typeof rawProviders === 'object') {
    providers = [];
    for (const [, val] of Object.entries(rawProviders as Record<string, unknown>)) {
      if (typeof val !== 'object' || val === null) continue;
      const obj = val as Record<string, unknown>;
      if (Array.isArray(obj.profiles)) {
        // v1 nested: { anthropic: { profiles: [{ id, ... }, ...] } }
        for (const p of obj.profiles) {
          if (typeof p === 'object' && p !== null) providers.push(p as Record<string, unknown>);
        }
      } else {
        // Simple object: treat as single provider entry
        providers.push(obj);
      }
    }
  } else {
    providers = [];
  }
  if (providers.length === 0) return;

  const accounts: Record<string, AccountConfig> = {};
  for (const p of providers) {
    const id = String(p.id ?? '').trim();
    if (!id) continue;
    // F340: protocol not migrated — derived at runtime from well-known account IDs.
    accounts[id] = {
      authType: (p.authType as 'oauth' | 'api_key') ?? 'oauth',
      ...(p.displayName ? { displayName: String(p.displayName) } : {}),
      ...(p.baseUrl ? { baseUrl: String(p.baseUrl) } : {}),
      ...(Array.isArray(p.models) ? { models: p.models.map(String) } : {}),
    };
  }
  const { merged } = mergeIntoGlobal(accounts);
  const mergedSet = new Set(merged);
  // Read global state after merge for retry-safe credential import
  const globalAfterMerge = readAllGlobal();

  const secretsPath = resolve(root, CONFIG_SUBDIR, 'provider-profiles.secrets.local.json');
  if (!existsSync(secretsPath)) return;
  const secretsMeta = JSON.parse(readFileSync(secretsPath, 'utf-8'));
  // v2/v3: flat { profiles: { <id>: { apiKey } } }.
  // v1: nested { providers: { <client>: { <id>: { apiKey } } } }.
  let profileSecrets: Record<string, Record<string, unknown>> = {};
  if (secretsMeta?.profiles && typeof secretsMeta.profiles === 'object') {
    profileSecrets = secretsMeta.profiles;
  } else if (secretsMeta?.providers && typeof secretsMeta.providers === 'object') {
    for (const clientSecrets of Object.values(secretsMeta.providers as Record<string, unknown>)) {
      if (typeof clientSecrets === 'object' && clientSecrets !== null) {
        Object.assign(profileSecrets, clientSecrets as Record<string, Record<string, unknown>>);
      }
    }
  }
  const globalRoot = resolveGlobalRoot();
  const credPath = resolve(globalRoot, CONFIG_SUBDIR, 'credentials.json');
  const existing = existsSync(credPath)
    ? (() => {
        try {
          return JSON.parse(readFileSync(credPath, 'utf-8'));
        } catch {
          return {};
        }
      })()
    : {};
  let credCount = 0;
  for (const [id, secret] of Object.entries(profileSecrets)) {
    if (!(id in accounts) || id in existing || !secret?.apiKey) continue;
    if (mergedSet.has(id)) {
      // First run: account was just merged — safe to import its secret.
      existing[id] = { apiKey: String(secret.apiKey) };
      credCount++;
    } else if (globalAfterMerge[id]?.authType === 'api_key') {
      // Retry: account already existed in global (previous partial migration).
      // Only import if the global account is api_key-typed — attaching a legacy
      // API key to a pre-existing OAuth account would be data cross-contamination.
      existing[id] = { apiKey: String(secret.apiKey) };
      credCount++;
    }
  }
  if (credCount > 0) {
    mkdirSync(resolve(globalRoot, CONFIG_SUBDIR), { recursive: true });
    writeFileAtomic(credPath, `${JSON.stringify(existing, null, 2)}\n`, 0o600);
  }
}

let legacyMigrationDone = false;

function migrateLegacyProviderProfiles(): void {
  if (legacyMigrationDone) return;
  try {
    migrateLegacyFrom(resolveGlobalRoot());
    legacyMigrationDone = true;
  } catch (err) {
    console.error('[catalog-accounts] legacy→global migration failed:', err);
  }
}

const migratedProjectLegacy = new Set<string>();

function migrateProjectLegacyProviderProfiles(projectRoot: string): void {
  const key = resolve(projectRoot);
  if (migratedProjectLegacy.has(key)) return;
  try {
    migrateLegacyFrom(key);
    migratedProjectLegacy.add(key);
  } catch {
    /* best-effort — don't mark done so next call retries */
  }
}

// ── Project catalog.accounts → global accounts.json migration ──

const migratedProjects = new Set<string>();

function migrateProjectAccountsToGlobal(projectRoot: string): void {
  const key = resolve(projectRoot);
  if (migratedProjects.has(key)) return;
  try {
    const catalogPath = resolve(projectRoot, CONFIG_SUBDIR, 'cat-catalog.json');
    if (!existsSync(catalogPath)) return;
    const raw = readFileSync(catalogPath, 'utf-8');
    const catalog = JSON.parse(raw);
    const projectAccounts = catalog?.accounts;
    if (!projectAccounts || typeof projectAccounts !== 'object' || Object.keys(projectAccounts).length === 0) return;

    const { merged } = mergeIntoGlobal(projectAccounts as Record<string, AccountConfig>);

    // F340: project catalog.accounts is intentionally left untouched.
    // Runtime only reads global accounts.json, so the project section is
    // inert — keeping it provides free rollback compatibility and avoids
    // unnecessary writes to the project catalog file.
    if (merged.length > 0) {
      console.error(`[catalog-accounts] project ${key}: ${merged.length} account(s) merged into global`);
    }
    migratedProjects.add(key);
  } catch (err) {
    // Migration is best-effort — don't mark done so next call retries.
    // But log the error so failures aren't invisible.
    console.error(`[catalog-accounts] project→global migration failed for ${key}:`, err);
  }
}

function ensureMigrated(projectRoot: string): void {
  migrateLegacyProviderProfiles();
  migrateProjectLegacyProviderProfiles(projectRoot);
  migrateProjectAccountsToGlobal(projectRoot);
}

/** Reset migration state (for tests). */
export function resetMigrationState(): void {
  legacyMigrationDone = false;
  migratedProjects.clear();
  migratedProjectLegacy.clear();
}

// ── Public API (signatures kept backward-compatible, projectRoot used for migration) ──

export function readCatalogAccounts(projectRoot: string): Record<string, AccountConfig> {
  ensureMigrated(projectRoot);
  return readAllGlobal();
}

export function writeCatalogAccount(projectRoot: string, ref: string, account: AccountConfig): void {
  ensureMigrated(projectRoot);
  const accounts = readAllGlobal();
  accounts[ref] = account;
  writeAllGlobal(accounts);
}

export function deleteCatalogAccount(projectRoot: string, ref: string): void {
  ensureMigrated(projectRoot);
  const accounts = readAllGlobal();
  if (!(ref in accounts)) return;
  delete accounts[ref];
  writeAllGlobal(accounts);
}
