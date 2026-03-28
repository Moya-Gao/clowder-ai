/**
 * F136 Phase 4b — Unified account resolver
 *
 * Single resolution path: accounts (cat-catalog.json) + credentials (credentials.json).
 * Outputs RuntimeProviderProfile for backward-compatible consumption.
 */
import type { AccountConfig, AccountProtocol } from '@cat-cafe/shared';
import { readCatalogAccounts } from './catalog-accounts.js';
import { readCredential } from './credentials.js';
import type {
  BuiltinAccountClient,
  ProviderProfileProtocol,
  RuntimeProviderProfile,
} from './provider-profiles.types.js';

const PROTOCOL_ENV_KEY_MAP: Record<AccountProtocol, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_API_KEY',
};

function protocolToClient(protocol: AccountProtocol): BuiltinAccountClient {
  return protocol as BuiltinAccountClient;
}

function resolveEnvFallbackKey(protocol: AccountProtocol): string | undefined {
  const envKey = PROTOCOL_ENV_KEY_MAP[protocol];
  return envKey ? process.env[envKey] : undefined;
}

/**
 * Resolve a single accountRef to RuntimeProviderProfile.
 * Returns null if the accountRef is not in the catalog.
 */
export function resolveByAccountRef(projectRoot: string, accountRef: string): RuntimeProviderProfile | null {
  const accounts = readCatalogAccounts(projectRoot);
  const account = accounts[accountRef];
  if (!account) return null;
  return accountToRuntimeProfile(accountRef, account);
}

/**
 * Resolve a RuntimeProviderProfile for a given built-in client/protocol.
 * If preferredAccountRef is given, tries that first.
 * Falls back to finding any account matching the protocol.
 */
export function resolveForClient(
  projectRoot: string,
  client: BuiltinAccountClient | AccountProtocol,
  preferredAccountRef?: string,
): RuntimeProviderProfile | null {
  const accounts = readCatalogAccounts(projectRoot);

  // Try preferred first
  if (preferredAccountRef) {
    const preferred = accounts[preferredAccountRef];
    if (preferred) return accountToRuntimeProfile(preferredAccountRef, preferred);
  }

  // Find accounts matching the protocol — return only if unambiguous (exactly one match)
  const protocol = normalizeProtocol(client);
  const matches: Array<[string, AccountConfig]> = [];
  for (const [ref, account] of Object.entries(accounts)) {
    if (account.protocol === protocol) {
      matches.push([ref, account]);
    }
  }
  if (matches.length === 1) {
    return accountToRuntimeProfile(matches[0][0], matches[0][1]);
  }

  // 0 matches = no account configured; >1 = ambiguous → fall through to legacy
  return null;
}

function normalizeProtocol(clientOrProtocol: string): AccountProtocol {
  if (clientOrProtocol === 'anthropic' || clientOrProtocol === 'openai' || clientOrProtocol === 'google') {
    return clientOrProtocol;
  }
  // dare → openai, opencode → anthropic
  if (clientOrProtocol === 'dare') return 'openai';
  if (clientOrProtocol === 'opencode') return 'anthropic';
  return 'openai'; // safe default
}

function accountToRuntimeProfile(ref: string, account: AccountConfig): RuntimeProviderProfile {
  const credential = readCredential(ref);
  const apiKey = credential?.apiKey ?? resolveEnvFallbackKey(account.protocol);

  const isBuiltin = account.authType === 'oauth';
  return {
    id: ref,
    authType: account.authType,
    kind: isBuiltin ? 'builtin' : 'api_key',
    ...(isBuiltin ? { client: protocolToClient(account.protocol) } : {}),
    protocol: account.protocol as ProviderProfileProtocol,
    ...(account.baseUrl ? { baseUrl: account.baseUrl } : {}),
    ...(apiKey ? { apiKey } : {}),
    ...(account.models && account.models.length > 0 ? { models: [...account.models] } : {}),
  };
}
