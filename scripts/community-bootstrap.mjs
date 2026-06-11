#!/usr/bin/env node
/**
 * community-bootstrap.mjs — CLI entrypoint for legacy CommunityIssueStore migration
 * (F168 Phase A — Task 5)
 *
 * Reads all legacy issue records from RedisCommunityIssueStore and migrates them
 * into the Event Log + projection engine via communityBootstrap().
 *
 * Usage:
 *   node scripts/community-bootstrap.mjs             # dry-run (default, no writes)
 *   node scripts/community-bootstrap.mjs --dry-run   # explicit dry-run
 *   node scripts/community-bootstrap.mjs --execute   # live run (writes events)
 *
 * By default this script refuses to target the Redis sanctuary (port 6399 / production).
 * To intentionally run against production Redis (e.g. one-time historical migration with
 * CVO authorisation), combine with --allow-sanctuary:
 *
 *   REDIS_URL=redis://localhost:6399 node scripts/community-bootstrap.mjs --dry-run --allow-sanctuary
 *   REDIS_URL=redis://localhost:6399 node scripts/community-bootstrap.mjs --execute --allow-sanctuary
 *
 * ⚠️  --allow-sanctuary bypasses the sanctuary guard. Use ONLY with CVO explicit sign-off.
 *     Always dry-run first. --allow-sanctuary without --execute is always safe (no writes).
 *
 * Environment:
 *   REDIS_URL  — required; e.g. redis://localhost:6398
 *
 * ⚠️  NEVER point REDIS_URL at port 6399 (Redis sanctuary / production) without --allow-sanctuary.
 *     Use port 6398 for dev/worktree environments.
 *
 * Requires a prior `pnpm --filter @cat-cafe/api build` to populate dist/.
 */

import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_ROOT = resolve(__dirname, '../packages/api/dist');

// ---------------------------------------------------------------------------
// Exported testable surface
// ---------------------------------------------------------------------------

/**
 * Parse CLI argv into options understood by this script.
 *
 * Defaults:
 *  - dryRun: true (safe by default; require explicit --execute to write)
 *  - allowSanctuary: false (require explicit --allow-sanctuary to target port 6399)
 *
 * @param {string[]} argv - process.argv.slice(2) or any equivalent array
 * @returns {{ dryRun: boolean, allowSanctuary: boolean }}
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const dryRun = !argv.includes('--execute');
  const allowSanctuary = argv.includes('--allow-sanctuary');
  return { dryRun, allowSanctuary };
}

/**
 * Decide whether the sanctuary guard should block or warn.
 *
 * Extracted for testability — this is the security-critical branch.
 * Tests can verify guard semantics without spawning a real process
 * or connecting to Redis.
 *
 * @param {string} redisUrl
 * @param {boolean} allowSanctuary
 * @returns {{ blocked: boolean, warnSanctuary: boolean }}
 */
export function resolveSanctuaryGuard(redisUrl, allowSanctuary) {
  const targetsSanctuary = /:[63]399\b/.test(redisUrl) || redisUrl.includes(':6399');
  if (targetsSanctuary && !allowSanctuary) {
    return { blocked: true, warnSanctuary: false };
  }
  return { blocked: false, warnSanctuary: targetsSanctuary };
}

// ---------------------------------------------------------------------------
// Main — only runs when executed directly
// ---------------------------------------------------------------------------

async function main() {
  const { dryRun, allowSanctuary } = parseArgs(process.argv.slice(2));

  const REDIS_URL = process.env.REDIS_URL;
  if (!REDIS_URL) {
    console.error('[community-bootstrap] ERROR: REDIS_URL env var is required.');
    console.error('  Example: REDIS_URL=redis://localhost:6398 node scripts/community-bootstrap.mjs');
    process.exit(1);
  }

  // Sanctuary guard — uses resolveSanctuaryGuard() so decision logic is independently testable.
  const { blocked, warnSanctuary } = resolveSanctuaryGuard(REDIS_URL, allowSanctuary);
  if (blocked) {
    console.error('[community-bootstrap] ERROR: REDIS_URL targets port 6399 (Redis sanctuary / production).');
    console.error('  Use port 6398 for dev/worktree environments. Refusing to proceed.');
    console.error('  To intentionally target production Redis with CVO sign-off, pass --allow-sanctuary.');
    process.exit(1);
  }
  if (warnSanctuary) {
    console.warn('');
    console.warn('[community-bootstrap] ⚠️  ════════════════════════════════════════════════════════');
    console.warn('[community-bootstrap] ⚠️  TARGETING REDIS SANCTUARY (PORT 6399 / PRODUCTION)');
    console.warn('[community-bootstrap] ⚠️  --allow-sanctuary explicitly passed. CVO sign-off required.');
    console.warn('[community-bootstrap] ⚠️  Ensure dry-run output was reviewed before --execute.');
    console.warn('[community-bootstrap] ⚠️  ════════════════════════════════════════════════════════');
    console.warn('');
  }

  console.log(
    `[community-bootstrap] Mode: ${dryRun ? 'DRY-RUN (no writes)' : '⚠️  LIVE EXECUTE (will write to Redis)'}`,
  );
  console.log(`[community-bootstrap] Redis: ${REDIS_URL}`);

  // Dynamic imports from built dist — avoids needing tsx/ts-node at runtime
  const { RedisCommunityEventLog } = await import(
    pathToFileURL(resolve(DIST_ROOT, 'domains/community/CommunityEventLog.js')).href
  );
  const { RedisCommunityObjectStore } = await import(
    pathToFileURL(resolve(DIST_ROOT, 'domains/community/CommunityObjectStore.js')).href
  );
  const { RedisCommunityIssueStore } = await import(
    pathToFileURL(resolve(DIST_ROOT, 'domains/cats/services/stores/redis/RedisCommunityIssueStore.js')).href
  );
  const { communityBootstrap } = await import(
    pathToFileURL(resolve(DIST_ROOT, 'domains/community/community-bootstrap.js')).href
  );
  const { createRedisClient } = await import('@cat-cafe/shared/utils');

  const redis = createRedisClient(REDIS_URL);
  await redis.ping();

  const issueStore = new RedisCommunityIssueStore(redis);
  const eventLog = new RedisCommunityEventLog(redis);
  const objectStore = new RedisCommunityObjectStore(redis);

  console.log('[community-bootstrap] Loading legacy issues...');
  const issues = await issueStore.listAll();
  console.log(`[community-bootstrap] Found ${issues.length} legacy issue records.`);

  const report = await communityBootstrap({ issues, eventLog, objectStore, dryRun });

  // Print report
  const toCreate = report.filter((r) => r.wouldCreate);
  const skipped = report.filter((r) => !r.wouldCreate);

  console.log('\n[community-bootstrap] === Report ===');
  console.log(`  Total issues:   ${report.length}`);
  console.log(`  Would create:   ${toCreate.length}  (${dryRun ? 'dry-run, not written' : 'written'})`);
  console.log(`  Already done:   ${skipped.length}  (idempotent skip)`);

  if (toCreate.length > 0) {
    console.log('\n  Would-create entries:');
    for (const entry of toCreate) {
      console.log(`    ${entry.subjectKey}  ${entry.originalState} → ${entry.mappedState}`);
    }
  }

  if (dryRun && toCreate.length > 0) {
    console.log('\n[community-bootstrap] Dry-run complete. Re-run with --execute to write events.');
  } else if (!dryRun) {
    console.log('\n[community-bootstrap] Migration complete.');
  } else {
    console.log('\n[community-bootstrap] Nothing to migrate (all already bootstrapped).');
  }

  await redis.quit();
}

// Only execute when this file is the main entry point
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((err) => {
    console.error('[community-bootstrap] Fatal error:', err);
    process.exit(1);
  });
}
