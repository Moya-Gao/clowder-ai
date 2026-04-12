/**
 * CatAgent Credentials — F159: Native Provider Security Baseline
 *
 * Resolves Anthropic API key for direct API calls using the
 * account-binding fail-closed pattern from invoke-single-cat.
 *
 * Priority: env override → bound account (via catConfig.accountRef).
 * No fallback scan — if the bound account doesn't resolve, it fails closed.
 */

import type { CatConfig } from '@cat-cafe/shared';
import { resolveForClient } from '../../../../../../config/account-resolver.js';
import { resolveBoundAccountRefForCat } from '../../../../../../config/cat-account-binding.js';
import { createModuleLogger } from '../../../../../../infrastructure/logger.js';

const log = createModuleLogger('catagent-creds');

const CATAGENT_API_KEY_ENV = 'CATAGENT_ANTHROPIC_API_KEY';
const CATAGENT_BASE_URL_ENV = 'CATAGENT_ANTHROPIC_BASE_URL';

export interface ApiCredentials {
  apiKey: string;
  baseURL?: string;
  source: string;
}

/**
 * Resolve API credentials using account-binding (fail-closed).
 *
 * 1. Explicit env var override (for testing / manual opt-in)
 * 2. Bound account: catConfig.accountRef → resolveForClient (same as invoke-single-cat)
 *
 * No wildcard credential scan — if the bound account doesn't resolve, returns null.
 */
export function resolveApiCredentials(
  projectRoot: string,
  catId: string,
  catConfig: CatConfig | null | undefined,
): ApiCredentials | null {
  // Priority 1: explicit env var override (testing, manual deployment)
  const envKey = process.env[CATAGENT_API_KEY_ENV];
  if (envKey) {
    log.info(`[${catId}] Using env var override`);
    return { apiKey: envKey, baseURL: process.env[CATAGENT_BASE_URL_ENV], source: 'env' };
  }

  // Priority 2: bound account (fail-closed)
  const boundRef = resolveBoundAccountRefForCat(projectRoot, catId, catConfig);
  if (!boundRef) {
    log.warn(`[${catId}] No bound accountRef in catConfig — cannot resolve credentials`);
    return null;
  }

  const profile = resolveForClient(projectRoot, 'anthropic', boundRef);
  if (!profile?.apiKey) {
    log.warn(`[${catId}] Bound account "${boundRef}" did not resolve to an API key`);
    return null;
  }

  log.info(`[${catId}] Resolved API key from bound account: ${boundRef}`);
  return { apiKey: profile.apiKey, baseURL: profile.baseUrl, source: `bound:${boundRef}` };
}
