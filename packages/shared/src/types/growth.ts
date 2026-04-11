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
  | 'mention_collab'
  | 'discussion'
  | 'pr_merged'
  | 'bug_caught'
  | 'design_feedback'
  | 'rich_block_create'
  | 'evidence_cite';
