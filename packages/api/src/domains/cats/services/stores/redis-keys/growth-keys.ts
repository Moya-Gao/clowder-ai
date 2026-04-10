/**
 * Redis key patterns for cat growth XP counters — F157.
 * Key: growth:{catId}:{dimension}  → total XP (INCRBY, no TTL — lifetime stat)
 */

/** Persistent XP counter per cat per dimension. */
export function growthXpKey(catId: string, dimension: string): string {
  return `growth:${catId}:${dimension}`;
}

/** SCAN pattern to match all growth keys for one cat. */
export function growthCatScan(catId: string): string {
  return `growth:${catId}:*`;
}

/** SCAN pattern to match all growth keys. */
export const GROWTH_SCAN_ALL = 'growth:*';
