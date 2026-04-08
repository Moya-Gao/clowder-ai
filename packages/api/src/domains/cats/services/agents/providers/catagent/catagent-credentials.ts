/**
 * CatAgent Credentials — F152: Thin Agent Runtime
 *
 * Resolves Anthropic API key for direct API calls.
 * Priority: env override → account resolver (credentials.json).
 */

import { resolveAnthropicRuntimeProfile } from '../../../../../../config/account-resolver.js';
import { createModuleLogger } from '../../../../../../infrastructure/logger.js';

const log = createModuleLogger('catagent-creds');

const CATAGENT_API_KEY_ENV = 'CATAGENT_ANTHROPIC_API_KEY';
const CATAGENT_BASE_URL_ENV = 'CATAGENT_ANTHROPIC_BASE_URL';

export interface ApiCredentials {
  apiKey: string;
  baseURL?: string;
  /** Where the key came from (for logging) */
  source: string;
}

/** Resolve API credentials: env override → account resolver */
export function resolveApiCredentials(): ApiCredentials | null {
  // Priority 1: explicit env var override
  const envKey = process.env[CATAGENT_API_KEY_ENV];
  if (envKey) {
    return {
      apiKey: envKey,
      baseURL: process.env[CATAGENT_BASE_URL_ENV],
      source: 'env',
    };
  }

  // Priority 2: account resolver (same credential store as CLI agents)
  try {
    const profile = resolveAnthropicRuntimeProfile(process.cwd());
    if (profile.apiKey) {
      log.info(`Resolved API key from account: ${profile.id}`);
      return {
        apiKey: profile.apiKey,
        baseURL: profile.baseUrl,
        source: `account:${profile.id}`,
      };
    }
  } catch (err) {
    log.warn(`Account resolver failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return null;
}
