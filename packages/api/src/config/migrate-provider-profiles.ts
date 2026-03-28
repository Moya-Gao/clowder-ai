/**
 * F136 Phase 4a — Migrate provider-profiles.json → accounts + credentials
 *
 * HC-3: One-time migration. Does NOT delete old files (留一版本兼容窗口).
 * Writes marker file to prevent re-migration.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import type { AccountConfig, AccountProtocol, CredentialEntry } from '@cat-cafe/shared';
import { readCatCatalog, writeCatCatalog } from './cat-catalog-store.js';
import { writeCredential } from './credentials.js';
import type {
  ProviderProfileMeta,
  ProviderProfilesMetaFile,
  ProviderProfilesSecretsFile,
} from './provider-profiles.types.js';

const CAT_CAFE_DIR = '.cat-cafe';
const META_FILENAME = 'provider-profiles.json';
const SECRETS_FILENAME = 'provider-profiles.secrets.local.json';
const MIGRATION_MARKER = 'accounts-migration-done.json';

export interface MigrationResult {
  migrated: boolean;
  reason?: 'no-source' | 'already-migrated' | 'no-catalog';
  accountsMigrated?: number;
  credentialsMigrated?: number;
}

function resolveGlobalRoot(): string {
  const envRoot = process.env.CAT_CAFE_GLOBAL_CONFIG_ROOT;
  if (envRoot) return resolve(envRoot);
  return homedir();
}

function resolveGlobalPath(filename: string): string {
  return resolve(resolveGlobalRoot(), CAT_CAFE_DIR, filename);
}

function isMigrated(): boolean {
  return existsSync(resolveGlobalPath(MIGRATION_MARKER));
}

function markMigrated(): void {
  writeFileSync(
    resolveGlobalPath(MIGRATION_MARKER),
    JSON.stringify({ migratedAt: new Date().toISOString() }, null, 2),
    'utf-8',
  );
}

function readOldMeta(): ProviderProfilesMetaFile | null {
  const path = resolveGlobalPath(META_FILENAME);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as ProviderProfilesMetaFile;
  } catch {
    return null;
  }
}

function readOldSecrets(): Record<string, { apiKey?: string }> {
  const path = resolveGlobalPath(SECRETS_FILENAME);
  if (!existsSync(path)) return {};
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8')) as ProviderProfilesSecretsFile;
    return data.profiles ?? {};
  } catch {
    return {};
  }
}

function toAccountProtocol(protocol: string | undefined): AccountProtocol {
  if (protocol === 'anthropic' || protocol === 'openai' || protocol === 'google') return protocol;
  return 'openai'; // safe default for custom API-key accounts
}

function profileToAccountConfig(profile: ProviderProfileMeta): AccountConfig {
  return {
    authType: profile.authType ?? 'api_key',
    protocol: toAccountProtocol(profile.protocol),
    ...(profile.baseUrl ? { baseUrl: profile.baseUrl.trim().replace(/\/+$/, '') } : {}),
    ...(profile.models && profile.models.length > 0 ? { models: profile.models } : {}),
    ...(profile.displayName ? { displayName: profile.displayName } : {}),
  };
}

export function migrateProviderProfilesToAccounts(projectRoot: string): MigrationResult {
  if (isMigrated()) {
    return { migrated: false, reason: 'already-migrated' };
  }

  const oldMeta = readOldMeta();
  if (!oldMeta) {
    return { migrated: false, reason: 'no-source' };
  }

  const catalog = readCatCatalog(projectRoot);
  if (!catalog) {
    return { migrated: false, reason: 'no-catalog' };
  }

  const oldSecrets = readOldSecrets();
  const profiles = oldMeta.providers ?? [];
  const accounts: Record<string, AccountConfig> = {};
  let credCount = 0;

  for (const profile of profiles) {
    accounts[profile.id] = profileToAccountConfig(profile);

    // Migrate secrets → credentials.json
    const secret = oldSecrets[profile.id];
    if (secret?.apiKey) {
      const entry: CredentialEntry = { apiKey: secret.apiKey };
      writeCredential(profile.id, entry);
      credCount++;
    }
  }

  // Write accounts into catalog (HC-2: cat-catalog.json is runtime write source)
  const v2 = catalog as import('@cat-cafe/shared').CatCafeConfigV2;
  const mergedAccounts = { ...(v2.accounts ?? {}), ...accounts };
  writeCatCatalog(projectRoot, { ...v2, accounts: mergedAccounts });

  markMigrated();

  return {
    migrated: true,
    accountsMigrated: profiles.length,
    credentialsMigrated: credCount,
  };
}
