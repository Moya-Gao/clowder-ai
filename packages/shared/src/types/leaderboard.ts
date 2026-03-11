/**
 * F075 Cat Leaderboard — shared types
 */

/** A cat ranked by a numeric metric */
export interface RankedCat {
  catId: string;
  displayName: string;
  count: number;
  rank: number;
}

/** A cat ranked by streak (consecutive days) */
export interface StreakCat {
  catId: string;
  displayName: string;
  currentStreak: number;
  maxStreak: number;
  rank: number;
}

export type LeaderboardRange = 'all' | '7d' | '30d';

export interface MentionStats {
  favoriteCat: RankedCat[];
  nightOwl: RankedCat[];
  streak: StreakCat[];
  chatty: RankedCat[];
}

export interface WorkStats {
  commits: RankedCat[];
  reviews: RankedCat[];
  bugFixes: RankedCat[];
}

export interface LeaderboardStatsResponse {
  mentions: MentionStats;
  work: WorkStats;
  range: LeaderboardRange;
  fetchedAt: string;
}
