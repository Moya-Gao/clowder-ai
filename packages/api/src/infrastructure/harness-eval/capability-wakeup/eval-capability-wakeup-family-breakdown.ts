import type { ClassifiedCapabilityWakeupTrial } from './eval-capability-wakeup-adapter.js';

type TrialLabel = ClassifiedCapabilityWakeupTrial['label'];

export function buildCapabilityWakeupFamilyBreakdown(trials: ClassifiedCapabilityWakeupTrial[]) {
  const buckets = new Map<string, ClassifiedCapabilityWakeupTrial[]>();
  for (const trial of trials) {
    const family = trial.family || 'unknown';
    const bucket = buckets.get(family);
    if (bucket) {
      bucket.push(trial);
    } else {
      buckets.set(family, [trial]);
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([family, items]) => {
      const misses = items.filter((trial) => trial.outcome === 'miss');
      return {
        family,
        opportunity_count: countOutcomeExcept(items, 'false_positive'),
        used_count: countOutcome(items, 'negative'),
        false_positive_count: countOutcome(items, 'false_positive'),
        miss_count: misses.length,
        cognitive_count: countLabel(misses, 'cognitive'),
        behavioral_count: countLabel(misses, 'behavioral'),
        attention_dilution_count: countLabel(misses, 'attention_dilution'),
        reachability_doubt_count: countLabel(misses, 'reachability_doubt'),
        unclassified_count: countLabel(misses, 'unclassified'),
      };
    });
}

function countOutcome(trials: ClassifiedCapabilityWakeupTrial[], outcome: ClassifiedCapabilityWakeupTrial['outcome']) {
  return trials.filter((trial) => trial.outcome === outcome).length;
}

function countOutcomeExcept(
  trials: ClassifiedCapabilityWakeupTrial[],
  outcome: ClassifiedCapabilityWakeupTrial['outcome'],
) {
  return trials.filter((trial) => trial.outcome !== outcome).length;
}

function countLabel(trials: ClassifiedCapabilityWakeupTrial[], label: TrialLabel) {
  return trials.filter((trial) => trial.label === label).length;
}
