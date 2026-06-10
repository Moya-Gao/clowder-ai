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
 * Environment:
 *   REDIS_URL  — required; e.g. redis://localhost:6398
 *
 * ⚠️  NEVER point REDIS_URL at port 6399 (Redis sanctuary / production).
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
 *
 * @param {string[]} argv - process.argv.slice(2) or any equivalent array
 * @returns {{ dryRun: boolean }}
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const dryRun = !argv.includes('--execute');
  return { dryRun };
}

// ---------------------------------------------------------------------------
// Main — only runs when executed directly
// ---------------------------------------------------------------------------

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));

  const REDIS_URL = process.env.REDIS_URL;
  if (!REDIS_URL) {
    console.error('[community-bootstrap] ERROR: REDIS_URL env var is required.');
    console.error('  Example: REDIS_URL=redis://localhost:6398 node scripts/community-bootstrap.mjs');
    process.exit(1);
  }

  // Hard guard: refuse to run against the Redis sanctuary (port 6399 = production).
  // Worktree / dev environments must use port 6398.
  if (/:[63]399\b/.test(REDIS_URL) || REDIS_URL.includes(':6399')) {
    console.error('[community-bootstrap] ERROR: REDIS_URL targets port 6399 (Redis sanctuary / production).');
    console.error('  Use port 6398 for dev/worktree environments. Refusing to proceed.');
    process.exit(1);
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
