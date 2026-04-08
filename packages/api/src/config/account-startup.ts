/**
 * F340 — Account startup hook (simplified)
 *
 * Legacy migration (HC-3), conflict detection (HC-5), and invariant guard
 * (LL-043) have been removed. Accounts are now global (~/.cat-cafe/accounts.json)
 * and migration from project-level catalogs is handled by catalog-accounts.ts.
 */
import { readCatalogAccounts } from './catalog-accounts.js';

export interface AccountStartupResult {
  accountCount: number;
}

/**
 * Lightweight startup check — ensure global accounts are readable.
 */
export function accountStartupHook(projectRoot: string): AccountStartupResult {
  const accounts = readCatalogAccounts(projectRoot);
  return { accountCount: Object.keys(accounts).length };
}
