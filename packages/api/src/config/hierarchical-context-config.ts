// F148: Hierarchical Context Transport configuration
// Controls smart window behavior for cold-mention context assembly.

/** F148: Configuration for hierarchical context transport */
export interface HierarchicalContextConfig {
  /** Unseen message count threshold: below = warm path (unchanged), above = smart window */
  coldMentionThreshold: number;
  /** Silence gap in ms to detect burst boundaries */
  burstSilenceGapMs: number;
  /** Max messages in recent burst */
  maxBurstMessages: number;
  /** Min messages in recent burst (guarantee) */
  minBurstMessages: number;
  /** Max keywords extracted for tombstone */
  maxTombstoneKeywords: number;
  /** Evidence recall timeout ms */
  evidenceRecallTimeoutMs: number;
  /** Max evidence hits to inject */
  maxEvidenceHits: number;
  /** Token count threshold: triggers smart window even when message count is low (Gap-1) */
  coldMentionTokenThreshold: number;
}

export const DEFAULT_HIERARCHICAL_CONTEXT: HierarchicalContextConfig = {
  coldMentionThreshold: 15,
  burstSilenceGapMs: 15 * 60 * 1000, // 15 minutes
  maxBurstMessages: 12,
  minBurstMessages: 4,
  maxTombstoneKeywords: 4,
  evidenceRecallTimeoutMs: 500,
  maxEvidenceHits: 3,
  coldMentionTokenThreshold: 10_000, // ~10K tokens — triggers smart window for "few but fat" messages
};
