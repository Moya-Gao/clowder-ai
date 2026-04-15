/**
 * F157 Phase D — Co-Creator Leadership Service (铲屎官六维)
 *
 * Independent from cat trait dimensions. Tracks how effectively the co-creator
 * coordinates, delegates, explores, and guides their cat team.
 *
 * Redis keys:
 *   leadership:{dimension} → total XP (INCRBY)
 *   leadership:audit       → sorted set of footfall events
 *
 * Level formula: same quadratic curve as cat traits — level = floor(sqrt(xp / 100))
 */

import type {
  LeadershipDimension,
  LeadershipFootfallSource,
  LeadershipProfile,
  LeadershipStat,
} from '@cat-cafe/shared';
import { LEADERSHIP_DIMENSIONS, LEADERSHIP_SHADOW_DIMS } from '@cat-cafe/shared';
import type { RedisClient } from '@cat-cafe/shared/utils';
import { createModuleLogger } from '../../../../infrastructure/logger.js';
import { leadershipAuditKey, leadershipXpKey } from '../stores/redis-keys/growth-keys.js';

const log = createModuleLogger('leadership');

// ── XP Rules ─────────────────────────────────────────────────────

/** Maps each leadership footfall source to the dimension it feeds + base XP. */
const LEADERSHIP_XP_RULES: Record<LeadershipFootfallSource, { dimension: LeadershipDimension; xp: number }> = {
  // 协调力
  multi_mention_dispatch: { dimension: 'coordination', xp: 15 },
  multi_mention_success: { dimension: 'coordination', xp: 25 },
  target_diversity: { dimension: 'coordination', xp: 10 },
  // 授权力
  task_no_intervention: { dimension: 'delegation', xp: 20 },
  deep_collab_initiated: { dimension: 'delegation', xp: 15 },
  // 开拓力
  tool_category_breadth: { dimension: 'exploration', xp: 10 },
  new_skill_first_use: { dimension: 'exploration', xp: 30 },
  feature_initiated: { dimension: 'exploration', xp: 20 },
  // 引导力
  one_shot_completion: { dimension: 'guidance', xp: 25 },
  low_clarification: { dimension: 'guidance', xp: 15 },
  // 决策力 (shadow)
  direction_confirmed: { dimension: 'decision', xp: 20 },
  // 反馈力 (shadow)
  feedback_applied: { dimension: 'feedback', xp: 20 },
};

// ── Level Math (same curve as cat traits) ────────────────────────

function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100));
}

function xpForLevel(level: number): number {
  return level * level * 100;
}

const shadowSet = new Set<string>(LEADERSHIP_SHADOW_DIMS);

function buildLeadershipStat(dimension: LeadershipDimension, xp: number): LeadershipStat {
  const level = levelFromXp(xp);
  return {
    dimension,
    xp,
    level,
    xpToNext: xpForLevel(level + 1) - xp,
    shadow: shadowSet.has(dimension),
  };
}

// ── Service ──────────────────────────────────────────────────────

export class LeadershipService {
  constructor(private readonly redis: RedisClient) {}

  /** Award leadership footfall. Fire-and-forget — caller should not await. */
  awardXp(source: LeadershipFootfallSource, multiplier = 1): void {
    const rule = LEADERSHIP_XP_RULES[source];
    if (!rule) return;
    const amount = Math.max(1, Math.round(rule.xp * multiplier));
    const key = leadershipXpKey(rule.dimension);
    const ts = Date.now();

    const pipeline = this.redis.pipeline();
    pipeline.incrby(key, amount);
    const event = { dimension: rule.dimension, xp: amount, source, timestamp: ts };
    const member = JSON.stringify({ ...event, _seq: Math.random().toString(36).slice(2, 8) });
    pipeline.zadd(leadershipAuditKey(), ts, member);
    pipeline.exec().catch((err: unknown) => {
      log.warn({ err, source }, 'Failed to award leadership XP');
    });
  }

  /** Read the full leadership profile snapshot. */
  async getProfile(): Promise<LeadershipProfile> {
    const keys = LEADERSHIP_DIMENSIONS.map((d) => leadershipXpKey(d));
    const values = await this.redis.mget(...keys);

    const stats = {} as Record<LeadershipDimension, LeadershipStat>;
    let totalXp = 0;
    let levelSum = 0;
    let activeDims = 0;

    for (let i = 0; i < LEADERSHIP_DIMENSIONS.length; i++) {
      const dim = LEADERSHIP_DIMENSIONS[i]!;
      const xp = parseInt(values[i] ?? '0', 10) || 0;
      stats[dim] = buildLeadershipStat(dim, xp);
      totalXp += xp;
      // Only live dims contribute to leadershipLevel
      if (!shadowSet.has(dim)) {
        levelSum += stats[dim].level;
        if (xp > 0) activeDims++;
      }
    }

    return {
      stats,
      leadershipLevel: activeDims > 0 ? Math.floor(levelSum / activeDims) : 0,
      totalXp,
      updatedAt: Date.now(),
    };
  }

  /** Fetch recent leadership footfall events, newest first. */
  async getAuditLog(limit = 50, offset = 0): Promise<unknown[]> {
    const raw = await this.redis.zrevrange(leadershipAuditKey(), offset, offset + limit - 1);
    return raw.map((s) => JSON.parse(s));
  }
}
