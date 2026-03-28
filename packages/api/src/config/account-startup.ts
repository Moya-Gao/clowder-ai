/**
 * F136 Phase 4a — Startup hook: migration + conflict scan
 *
 * HC-3: Run one-time migration from provider-profiles → accounts + credentials.
 * HC-5: Scan all known project roots for accountRef conflicts.
 *
 * Called once after the API server binds its port.
 */
import { type AccountConflict, detectAccountConflicts } from './account-conflict-guard.js';
import { type MigrationResult, migrateProviderProfilesToAccounts } from './migrate-provider-profiles.js';

export interface AccountStartupResult {
  migration: MigrationResult;
  conflicts: AccountConflict[];
}

/**
 * Run migration + conflict detection at startup.
 * HC-5: Throws on conflict — caller must NOT swallow the error.
 */
export function accountStartupHook(projectRoot: string): AccountStartupResult {
  const migration = migrateProviderProfilesToAccounts(projectRoot);
  const conflicts = detectAccountConflicts(projectRoot);

  // HC-5: Cross-project conflict is a hard error — refuse to start with mismatched credentials.
  if (conflicts.length > 0) {
    const details = conflicts.map((c) => `"${c.accountRef}": ${c.details} (${c.projects.join(' vs ')})`).join('; ');
    throw new Error(`F136 HC-5: account conflict detected at startup — ${details}`);
  }

  return { migration, conflicts };
}
