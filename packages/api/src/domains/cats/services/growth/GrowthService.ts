/**
 * F157 Cat Growth RPG — Growth Service
 * Reads/writes XP counters in Redis, computes attributes and profiles.
 *
 * XP is stored as simple Redis integers: growth:{catId}:{dimension} → total XP.
 * Level formula: level = floor(sqrt(xp / 100))  (quadratic curve)
 * XP to next: (level+1)^2 * 100 - xp
 */

import type {
  CatAttributes,
  CatGrowthProfile,
  DimensionStat,
  GrowthDimension,
  GrowthOverview,
  XpSource,
} from '@cat-cafe/shared';
import { catRegistry, GROWTH_DIMENSIONS } from '@cat-cafe/shared';
import type { RedisClient } from '@cat-cafe/shared/utils';
import { createModuleLogger } from '../../../../infrastructure/logger.js';
import { growthXpKey } from '../stores/redis-keys/growth-keys.js';

const log = createModuleLogger('growth');

/** XP per source type, mapped to the dimension it feeds. */
const XP_RULES: Record<XpSource, { dimension: GrowthDimension; xp: number }> = {
  task_complete: { dimension: 'execution', xp: 50 },
  session_seal: { dimension: 'execution', xp: 20 },
  review_given: { dimension: 'review', xp: 40 },
  review_received: { dimension: 'collaboration', xp: 15 },
  tool_use: { dimension: 'execution', xp: 1 },
  mention_collab: { dimension: 'collaboration', xp: 10 },
  discussion: { dimension: 'architecture', xp: 15 },
  pr_merged: { dimension: 'execution', xp: 80 },
  bug_caught: { dimension: 'review', xp: 60 },
  design_feedback: { dimension: 'aesthetics', xp: 30 },
  rich_block_create: { dimension: 'aesthetics', xp: 20 },
  evidence_cite: { dimension: 'insight', xp: 25 },
};

function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100));
}

function xpForLevel(level: number): number {
  return level * level * 100;
}

function buildDimensionStat(dimension: GrowthDimension, xp: number): DimensionStat {
  const level = levelFromXp(xp);
  return { dimension, xp, level, xpToNext: xpForLevel(level + 1) - xp };
}

export class GrowthService {
  constructor(private readonly redis: RedisClient) {}

  /** Resolve ioredis keyPrefix for SCAN operations. */
  private get keyPrefix(): string {
    return (this.redis as { options?: { keyPrefix?: string } }).options?.keyPrefix ?? '';
  }

  /** Award XP. Fire-and-forget — caller should not await. */
  awardXp(catId: string, source: XpSource, multiplier = 1): void {
    const rule = XP_RULES[source];
    if (!rule) return;
    const amount = Math.max(1, Math.round(rule.xp * multiplier));
    const key = growthXpKey(catId, rule.dimension);

    this.redis.incrby(key, amount).catch((err: unknown) => {
      log.warn({ err, catId, source }, 'Failed to award XP');
    });
  }

  /** Read one cat's attributes from Redis. */
  async getAttributes(catId: string): Promise<CatAttributes> {
    const keys = GROWTH_DIMENSIONS.map((d) => growthXpKey(catId, d));
    const values = await this.redis.mget(...keys);

    const stats = {} as Record<GrowthDimension, DimensionStat>;
    let totalXp = 0;
    let levelSum = 0;

    for (let i = 0; i < GROWTH_DIMENSIONS.length; i++) {
      const dim = GROWTH_DIMENSIONS[i]!;
      const xp = parseInt(values[i] ?? '0', 10) || 0;
      stats[dim] = buildDimensionStat(dim, xp);
      totalXp += xp;
      levelSum += stats[dim].level;
    }

    return {
      catId,
      stats,
      overallLevel: Math.floor(levelSum / GROWTH_DIMENSIONS.length),
      totalXp,
      updatedAt: Date.now(),
    };
  }

  /** Build full growth profile for one cat. */
  async getProfile(catId: string): Promise<CatGrowthProfile | null> {
    const entry = catRegistry.tryGet(catId);
    if (!entry) return null;
    const config = entry.config;

    const attributes = await this.getAttributes(catId);
    return {
      catId,
      displayName: config.displayName ?? config.id,
      nickname: config.nickname,
      attributes,
      highlights: [],
    };
  }

  /** Build team overview across all registered cats. */
  async getOverview(): Promise<GrowthOverview> {
    const catIds = catRegistry.getAllIds().map(String);

    const profiles = await Promise.all(catIds.map((id) => this.getProfile(id)));
    const valid = profiles.filter((p): p is CatGrowthProfile => p !== null);

    const teamTotalXp = valid.reduce((s, p) => s + p.attributes.totalXp, 0);
    const teamLevel =
      valid.length > 0 ? Math.floor(valid.reduce((s, p) => s + p.attributes.overallLevel, 0) / valid.length) : 0;

    return {
      profiles: valid,
      teamLevel,
      teamTotalXp,
      fetchedAt: new Date().toISOString(),
    };
  }
}
