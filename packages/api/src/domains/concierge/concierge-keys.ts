/**
 * Redis key patterns for ConciergeConfigStore + ConciergeThreadService (F229)
 */
export const ConciergeKeys = {
  /** String (JSON): per-user ConciergeConfig */
  config: (userId: string) => `concierge:config:${userId}`,
  /** String: per-user concierge thread ID (懒创建，幂等) */
  threadId: (userId: string) => `concierge:thread:${userId}`,
} as const;
