#!/usr/bin/env node
/**
 * F233 Phase C C2c — Historical backfill script (one-shot)
 *
 * 跑 4 个 real IO adapter → collector → projector → Redis store. 把所有
 * 现有 feat 的轨迹回填到数据库, opus-48 C3 UI 立刻能看到真实数据.
 *
 * Usage:
 *   # 默认: cat-cafe 主仓 + Redis 6398（worktree dev 圣域）
 *   node scripts/f233-backfill-feat-trajectory.mjs
 *
 *   # 自定义
 *   CAT_CAFE_REPO_ROOT=/path/to/repo \
 *   CAT_CAFE_REPO_FULL_NAME=owner/repo \
 *   REDIS_URL=redis://localhost:6398 \
 *   node scripts/f233-backfill-feat-trajectory.mjs
 *
 *   # 显式 target Hub Redis（仅在 CVO sign-off 后；cloud round 4 P1 guard）
 *   REDIS_URL=redis://localhost:6399 \
 *   node scripts/f233-backfill-feat-trajectory.mjs --allow-sanctuary
 *
 * Safety:
 * - **Sanctuary guard (cloud round 4 P1 fix)**: refuses to target port 6399
 *   unless `--allow-sanctuary` is explicitly passed. Matches community-bootstrap
 *   convention; uses shared `resolveSanctuaryGuard()`. CLAUDE.md Rule 1.
 * - Idempotent: same snapshot 二次跑 → upsert by entryId (cloud P2 stable id)
 *   → 不会 inflate counts
 * - 不删任何东西; 只 save projection (覆盖式)
 * - 失败 snapshot 单独 skip + log; 不会因一个 branch 烧整轮
 *
 * plan: docs/plans/2026-06-18-f233-phase-c-euthanasia-trajectory.md §C2c
 */

import Redis from 'ioredis';
import { runBackfill } from '../packages/api/dist/domains/feat-trajectory/FeatTrajectoryBackfill.js';
import { FeatTrajectoryProjector } from '../packages/api/dist/domains/feat-trajectory/FeatTrajectoryProjector.js';
import { RedisFeatTrajectoryStore } from '../packages/api/dist/domains/feat-trajectory/FeatTrajectoryStore.js';
import { GitRefSnapshotCollector } from '../packages/api/dist/domains/feat-trajectory/GitRefSnapshotCollector.js';
import { RealFeatIndexLookup } from '../packages/api/dist/domains/feat-trajectory/RealFeatIndexLookup.js';
import { RealGhClient } from '../packages/api/dist/domains/feat-trajectory/RealGhClient.js';
import { RealGitRunner } from '../packages/api/dist/domains/feat-trajectory/RealGitRunner.js';
import { RealThreadSearch } from '../packages/api/dist/domains/feat-trajectory/RealThreadSearch.js';
// Cloud round 4 P1 fix: reuse the existing sanctuary guard from
// community-bootstrap so this script can't silently target port 6399 (Redis
// sanctuary / production). CLAUDE.md Rule 1: Worktree 开发只用 6398; only
// the user's main Hub may touch 6399.
import { resolveSanctuaryGuard } from './community-bootstrap.mjs';

// Cloud round 1 P2 fix: default to process.cwd() (script convention is "run
// from repo root"). The previous hardcoded /Users/lysander/... was developer-
// specific — on any other checkout where CAT_CAFE_REPO_ROOT wasn't set, the
// script would silently scan a non-existent repo.
const REPO_ROOT = process.env.CAT_CAFE_REPO_ROOT || process.cwd();
const REPO_FULL_NAME = process.env.CAT_CAFE_REPO_FULL_NAME || 'zts212653/cat-cafe';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6398';
const BRANCH_PATTERNS = (process.env.F233_BRANCH_PATTERNS || 'fix/*,feat/*').split(',');

function log(msg) {
  console.log(msg);
}

async function main() {
  // Cloud round 4 P1 fix: sanctuary guard MUST run BEFORE we open a Redis
  // connection. If REDIS_URL points at port 6399 (Hub / production), bail out
  // hard unless --allow-sanctuary is explicitly passed (CVO sign-off ritual,
  // matching scripts/community-bootstrap.mjs convention).
  const allowSanctuary = process.argv.includes('--allow-sanctuary');
  const { blocked, warnSanctuary } = resolveSanctuaryGuard(REDIS_URL, allowSanctuary);
  if (blocked) {
    console.error('[F233 C2c backfill] ERROR: REDIS_URL targets port 6399 (Redis sanctuary / production).');
    console.error(`  REDIS_URL = ${REDIS_URL}`);
    console.error('  Worktree dev MUST use port 6398. Refusing to proceed.');
    console.error('  To intentionally target Hub Redis with CVO sign-off, pass --allow-sanctuary.');
    process.exit(1);
  }
  if (warnSanctuary) {
    console.warn('');
    console.warn('[F233 C2c backfill] ⚠️  ════════════════════════════════════════════════════════');
    console.warn('[F233 C2c backfill] ⚠️  TARGETING REDIS SANCTUARY (PORT 6399 / PRODUCTION)');
    console.warn('[F233 C2c backfill] ⚠️  --allow-sanctuary explicitly passed. CVO sign-off required.');
    console.warn('[F233 C2c backfill] ⚠️  ════════════════════════════════════════════════════════');
    console.warn('');
  }

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('F233 Phase C C2c — Feat Trajectory Historical Backfill');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log(`  REPO_ROOT:       ${REPO_ROOT}`);
  log(`  REPO_FULL_NAME:  ${REPO_FULL_NAME}`);
  log(`  REDIS_URL:       ${REDIS_URL}`);
  log(`  BRANCH_PATTERNS: ${BRANCH_PATTERNS.join(', ')}`);
  log('');

  const redis = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    log('[Redis] connected ✓');
  } catch (e) {
    log(`[Redis] connect failed: ${e.message}`);
    log('         Tip: ensure Redis is running (worktree dev: redis-server --port 6398)');
    process.exit(1);
  }

  const store = new RedisFeatTrajectoryStore(redis);
  const projector = new FeatTrajectoryProjector(store);

  const gitRunner = new RealGitRunner(REPO_ROOT);
  const ghClient = new RealGhClient(REPO_FULL_NAME);
  const featIndexLookup = new RealFeatIndexLookup(`${REPO_ROOT}/docs/features`);
  // Thread search: in script context we don't have IThreadStore loaded. The
  // graceful degrade returns empty list — heuristic join (branch_name_F# +
  // commit_message_F# + feat_index) still gets the bulk of associations. Real
  // thread join wiring happens in step 4 cron scheduler integrated with API
  // runtime context (where IThreadStore is available).
  const threadSearch = new RealThreadSearch({
    async listAll() {
      return [];
    },
  });

  const collector = new GitRefSnapshotCollector({
    branchPatterns: BRANCH_PATTERNS,
    multiCandidatePolicy: 'skip-low-confidence',
    gitRunner,
    ghClient,
    featIndexLookup,
    threadSearch,
  });

  try {
    const result = await runBackfill({
      collector,
      projector,
      store,
      logger: log,
    });

    log('');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log(`Backfill complete: ${result.snapshotsApplied}/${result.snapshotsCollected} snapshots applied`);
    log(`Feats with projections: ${result.featsInStore.length}`);

    // Cloud round 2 P2 fix: detect empty result + exit non-zero. When REPO_ROOT,
    // branch patterns, or `gh` auth are misconfigured, runBackfill returns 0
    // snapshots but the script would silently exit 0 with "Backfill complete"
    // — automation would treat an empty Redis backfill as success. Surface the
    // configuration drift as a hard failure so CI / operator notices.
    if (result.snapshotsCollected === 0) {
      log('');
      log('❌ FAIL: 0 snapshots collected. Common causes:');
      log(`   - CAT_CAFE_REPO_ROOT (${REPO_ROOT}) is not a valid git repo`);
      log(`   - F233_BRANCH_PATTERNS (${BRANCH_PATTERNS.join(', ')}) matched 0 branches`);
      log('   - `gh auth status` shows unauthenticated → run `gh auth login`');
      log('   - Repo full name mismatch with --repo flag');
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      process.exit(2);
    }

    // F188 spot-check — 提包球 fixture verify
    const f188 = result.perFeatSummary.find((s) => s.featId === 'F188');
    if (f188) {
      log('');
      log('F188 提包球 fixture spot-check:');
      log(`  Entries: ${f188.entryCount}`);
      log(
        `  Kinds: ${Object.entries(f188.countsByKind)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')}`,
      );
      const hasStale = f188.countsByKind['branch_stale_unmerged'] > 0;
      log(`  branch_stale_unmerged: ${hasStale ? '✓ detected' : '✗ NOT detected (check F188 branch state)'}`);
    } else {
      log('');
      log('⚠️  F188 fixture NOT in result — check branch exists + matches patterns');
    }

    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } finally {
    await redis.quit();
  }
}

main().catch((e) => {
  console.error('[F233 C2c backfill] FATAL:', e);
  process.exit(1);
});
