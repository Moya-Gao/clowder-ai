import type { ConfigSnapshot } from './config-snapshot.js';
import { parseEnum, parseIntInRange } from './parse-utils.js';

type RecallBudget = ConfigSnapshot['hindsight']['recallDefaults']['budget'];
type RecallTagsMatch = ConfigSnapshot['hindsight']['recallDefaults']['tagsMatch'];
type ReflectDispositionMode = ConfigSnapshot['hindsight']['reflect']['dispositionMode'];

export interface ParsedHindsightRuntimeConfig {
  recallDefaults: {
    budget: RecallBudget;
    tagsMatch: RecallTagsMatch;
    limit: number;
  };
  reflect: {
    dispositionMode: ReflectDispositionMode;
  };
}

export function parseHindsightRuntimeConfig(env: NodeJS.ProcessEnv): ParsedHindsightRuntimeConfig {
  return {
    recallDefaults: {
      budget: parseEnum<RecallBudget>(env['HINDSIGHT_RECALL_DEFAULT_BUDGET'], ['low', 'mid', 'high'], 'mid'),
      tagsMatch: parseEnum<RecallTagsMatch>(env['HINDSIGHT_RECALL_DEFAULT_TAGS_MATCH'], ['all_strict', 'any_strict', 'all', 'any'], 'all_strict'),
      limit: parseIntInRange(env['HINDSIGHT_RECALL_DEFAULT_LIMIT'], 5, 1, 20),
    },
    reflect: {
      dispositionMode: parseEnum<ReflectDispositionMode>(env['HINDSIGHT_REFLECT_DISPOSITION_MODE'], ['off', 'template_only'], 'template_only'),
    },
  };
}
