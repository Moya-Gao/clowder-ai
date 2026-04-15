/**
 * Redis key patterns for cat growth XP counters — F157.
 * Key: growth:{catId}:{dimension}  → total XP (INCRBY, no TTL — lifetime stat)
 * Key: growth:audit:{catId}        → sorted set of XP events (score = timestamp)
 */

/** Persistent XP counter per cat per dimension. */
export function growthXpKey(catId: string, dimension: string): string {
  return `growth:${catId}:${dimension}`;
}

/** Sorted set holding XP event audit trail for one cat. Score = epoch ms. */
export function growthAuditKey(catId: string): string {
  return `growth:audit:${catId}`;
}

/** SCAN pattern to match all growth keys for one cat. */
export function growthCatScan(catId: string): string {
  return `growth:${catId}:*`;
}

/** SCAN pattern to match all growth keys. */
export const GROWTH_SCAN_ALL = 'growth:*';

// ── Phase B: Title + Bond keys ─────────────────────────────────────

/** Sorted set of unlocked titles for one cat. Score = unlock timestamp, member = title JSON. */
export function growthTitleKey(catId: string): string {
  return `growth:titles:${catId}`;
}

/** Bond score between two cats. Key is always sorted (catA < catB) to ensure uniqueness. */
export function growthBondKey(catA: string, catB: string): string {
  const [a, b] = catA < catB ? [catA, catB] : [catB, catA];
  return `growth:bond:${a}:${b}`;
}

/** SCAN pattern to match all bond keys for one cat. */
export function growthBondScan(catId: string): string {
  return `growth:bond:*${catId}*`;
}

// ── Phase D: Leadership keys (铲屎官六维) ────────────────────────

/** Persistent XP counter per leadership dimension. */
export function leadershipXpKey(dimension: string): string {
  return `leadership:${dimension}`;
}

/** Sorted set holding leadership XP audit trail. Score = epoch ms. */
export function leadershipAuditKey(): string {
  return 'leadership:audit';
}

/** SCAN pattern to match all leadership keys. */
export const LEADERSHIP_SCAN_ALL = 'leadership:*';
