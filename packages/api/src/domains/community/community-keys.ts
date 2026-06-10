/**
 * Redis key patterns for community-ops event engine (F168).
 * All keys are bare (no prefix here); the ioredis client keyPrefix is applied
 * automatically by the RedisClient factory.
 *
 * Naming convention (mirrors existing redis-keys/ patterns):
 *   community:events:log:{subjectKey}   → LIST (per-subject ordered events)
 *   community:events:seen               → SET  (global sourceEventId dedup)
 *   community:events:subjects           → SET  (all active subjectKeys)
 *   community:object:{subjectKey}       → STRING (JSON-serialized projection)
 *   community:objects:index             → SET  (all subjectKeys with projections)
 */
export const CommunityKeys = {
  /** Per-subject event list: community:events:log:{subjectKey} */
  eventLog: (subjectKey: string) => `community:events:log:${subjectKey}`,

  /** Global dedup set for sourceEventId values */
  eventsSeen: 'community:events:seen',

  /** Global set of all subjectKeys that have at least one event */
  eventsSubjects: 'community:events:subjects',

  /** Serialised CommunityObjectProjection: community:object:{subjectKey} */
  objectProjection: (subjectKey: string) => `community:object:${subjectKey}`,

  /** Index set of all subjectKeys that have a projection */
  objectsIndex: 'community:objects:index',
} as const;
