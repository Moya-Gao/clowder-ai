/**
 * F157 Cat Growth RPG — shared types
 * AI Agent 养成 & 成就系统：六维属性 + 经验值 + 猫猫名片
 */

import type { CatId } from './ids.js';

/** The six growth dimensions */
export type GrowthDimension = 'architecture' | 'review' | 'aesthetics' | 'execution' | 'collaboration' | 'insight';

export const GROWTH_DIMENSIONS: readonly GrowthDimension[] = [
  'architecture',
  'review',
  'aesthetics',
  'execution',
  'collaboration',
  'insight',
] as const;

/** Human-readable labels for each dimension */
export const DIMENSION_LABELS: Record<GrowthDimension, { zh: string; en: string }> = {
  architecture: { zh: '架构力', en: 'Architecture' },
  review: { zh: '审查力', en: 'Review' },
  aesthetics: { zh: '审美力', en: 'Aesthetics' },
  execution: { zh: '执行力', en: 'Execution' },
  collaboration: { zh: '协作力', en: 'Collaboration' },
  insight: { zh: '洞察力', en: 'Insight' },
};

/** XP and level for a single dimension */
export interface DimensionStat {
  readonly dimension: GrowthDimension;
  readonly xp: number;
  readonly level: number;
  /** XP needed to reach next level */
  readonly xpToNext: number;
}

/** Six-dimensional attribute snapshot for one cat */
export interface CatAttributes {
  readonly catId: string;
  readonly stats: Record<GrowthDimension, DimensionStat>;
  /** Overall level (avg of dimension levels, floored) */
  readonly overallLevel: number;
  /** Total XP across all dimensions */
  readonly totalXp: number;
  readonly updatedAt: number;
}

/** Currently active title/badge */
export interface CatTitle {
  readonly id: string;
  readonly label: { zh: string; en: string };
  readonly unlockedAt: number;
}

/** Top highlight moment linked to a real session */
export interface HighlightMoment {
  readonly label: string;
  readonly sessionId?: string;
  readonly threadId?: string;
  readonly timestamp: number;
}

/** Full growth profile for the cat profile card */
export interface CatGrowthProfile {
  readonly catId: string;
  readonly displayName: string;
  readonly nickname?: string;
  readonly attributes: CatAttributes;
  readonly currentTitle?: CatTitle;
  readonly highlights: readonly HighlightMoment[];
}

/** Team overview for the "adventurer guild" page */
export interface GrowthOverview {
  readonly profiles: readonly CatGrowthProfile[];
  readonly teamLevel: number;
  readonly teamTotalXp: number;
  readonly fetchedAt: string;
}

/** Granular XP event for audit trail */
export interface XpEvent {
  readonly catId: string;
  readonly dimension: GrowthDimension;
  readonly xp: number;
  readonly source: XpSource;
  readonly detail?: string;
  readonly timestamp: number;
}

export type XpSource =
  | 'task_complete'
  | 'session_seal'
  | 'review_given'
  | 'review_received'
  | 'tool_use'
  | 'tool_use_mcp'
  | 'tool_use_skill'
  | 'mention_collab'
  | 'deep_collab'
  | 'discussion'
  | 'pr_merged'
  | 'bug_caught'
  | 'design_feedback'
  | 'rich_block_create'
  | 'evidence_cite';

// ── Phase B: Title System ──────────────────────────────────────────

/** Condition for unlocking a title */
export type TitleCondition =
  | { readonly type: 'dimension_level'; readonly dimension: GrowthDimension; readonly minLevel: number }
  | { readonly type: 'overall_level'; readonly minLevel: number }
  | { readonly type: 'total_xp'; readonly minXp: number };

export type TitleRarity = 'common' | 'rare' | 'epic' | 'legendary';

/** Static definition of a title/badge that can be unlocked */
export interface TitleDefinition {
  readonly id: string;
  readonly label: { readonly zh: string; readonly en: string };
  readonly description: { readonly zh: string; readonly en: string };
  readonly rarity: TitleRarity;
  /** All conditions must be met (AND logic) */
  readonly conditions: readonly TitleCondition[];
}

/** A title unlocked by a specific cat */
export interface UnlockedTitle {
  readonly titleId: string;
  readonly catId: string;
  readonly unlockedAt: number;
}

// ── Phase B: Bond System ───────────────────────────────────────────

/** Bond record between two cats */
export interface CatBond {
  readonly catA: string;
  readonly catB: string;
  /** Bond strength score (higher = stronger bond) */
  readonly score: number;
  /** Number of collaboration events */
  readonly interactions: number;
  /** Most recent interaction timestamp */
  readonly lastInteractionAt: number;
}

/** Bond level thresholds */
export type BondLevel = 'acquaintance' | 'partner' | 'soulmate';

// ── Phase B: Invocation Purpose ────────────────────────────────────

/** Purpose tag for A2A invocations — enables dimension-aware XP routing */
export type InvocationPurpose = 'discussion' | 'review';

// ── Phase C: Achievement System ──────────────────────────────────

export type AchievementCategory = 'individual' | 'team' | 'milestone' | 'hidden';

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

/** Condition type for auto-triggering achievements */
export type AchievementCondition =
  | { readonly type: 'total_xp'; readonly minXp: number }
  | { readonly type: 'overall_level'; readonly minLevel: number }
  | { readonly type: 'dimension_level'; readonly dimension: GrowthDimension; readonly minLevel: number }
  | { readonly type: 'title_count'; readonly minCount: number }
  | { readonly type: 'bond_count'; readonly minCount: number }
  | { readonly type: 'bond_level'; readonly minLevel: BondLevel }
  | { readonly type: 'task_count'; readonly minCount: number }
  | { readonly type: 'review_count'; readonly minCount: number }
  | { readonly type: 'session_count'; readonly minCount: number };

/** Static definition of an achievement */
export interface AchievementDefinition {
  readonly id: string;
  readonly label: { readonly zh: string; readonly en: string };
  readonly description: { readonly zh: string; readonly en: string };
  readonly category: AchievementCategory;
  readonly rarity: AchievementRarity;
  /** All conditions must be met (AND logic). Empty = manual trigger only. */
  readonly conditions: readonly AchievementCondition[];
  /** Optional icon hint for UI */
  readonly icon?: string;
}

/** An achievement unlocked by a specific member (cat or co-creator) */
export interface UnlockedAchievement {
  readonly achievementId: string;
  readonly memberId: string;
  readonly unlockedAt: number;
  /** Session/thread that triggered the unlock */
  readonly triggerRef?: string;
}
