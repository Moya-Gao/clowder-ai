/**
 * Redis key patterns for ConciergeConfigStore + ConciergeThreadService (F229)
 *
 * PR-A3b: added relay + confirmation keys (§1a/§1b state objects)
 */
export const ConciergeKeys = {
  /** String (JSON): per-user ConciergeConfig */
  config: (userId: string) => `concierge:config:${userId}`,
  /** String: per-user concierge thread ID (懒创建，幂等) */
  threadId: (userId: string) => `concierge:thread:${userId}`,
  /** String (JSON): relay receipt by ID (TTL=0, INV R1/R4) */
  relay: (receiptId: string) => `concierge:relay:${receiptId}`,
  /** Set: per-user relay receipt IDs (for listing) */
  relayIndex: (userId: string) => `concierge:relay-idx:${userId}`,
  /** String (JSON): pending confirmation by ID (TTL=0, INV C3) */
  confirmation: (confirmationId: string) => `concierge:confirm:${confirmationId}`,
  /** Set: per-user confirmation IDs (for listing) */
  confirmationIndex: (userId: string) => `concierge:confirm-idx:${userId}`,
} as const;
