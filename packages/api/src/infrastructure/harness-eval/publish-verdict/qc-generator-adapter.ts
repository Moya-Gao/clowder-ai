/**
 * F253 Phase C — QC generator adapter (publish_verdict eval:qc).
 *
 * Follows friction-generator-adapter.ts shape:
 *   1. Discriminator: sourceRefs.kind === 'qc-metrics-rollup'
 *   2. Validate window (start < end)
 *   3. Resolve metrics via provider
 *   4. Generate verdict markdown + bundle artifacts
 *
 * Phase C bootstrap: metrics are zero-baseline (no live data source
 * wired yet). The adapter is structurally complete so eval:qc can
 * fire weekly and produce keep_observe verdicts with zero-data notes.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type QcMetricsSelector, resolveQcMetrics } from '../qc-metrics-provider.js';
import type { VerdictGenerator } from './types.js';

export function createQcGeneratorAdapter(): VerdictGenerator {
  return async (packet, sourceRefs, deps) => {
    const kind = (sourceRefs as { kind?: string }).kind;
    if (kind !== 'qc-metrics-rollup') {
      throw new Error(
        `qc_adapter_wrong_kind: received sourceRefs with kind='${kind ?? '(omitted)'}'; expected 'qc-metrics-rollup'`,
      );
    }

    const selector = sourceRefs as unknown as QcMetricsSelector;
    if (selector.windowEndMs <= selector.windowStartMs) {
      throw new Error('invalid_window: windowEndMs must be greater than windowStartMs');
    }

    const snapshot = resolveQcMetrics(selector);

    // Write verdict + bundle under harnessFeedbackRoot
    const verdictDir = join(deps.harnessFeedbackRoot, 'verdicts', packet.id);
    const bundleDir = join(verdictDir, 'bundle');
    mkdirSync(bundleDir, { recursive: true });

    // Write snapshot data
    writeFileSync(join(bundleDir, 'snapshot.json'), JSON.stringify(snapshot, null, 2));

    // Write verdict markdown
    const verdictPath = join(verdictDir, 'verdict.md');
    const verdictMd = [
      `# eval:qc Verdict — ${packet.id}`,
      '',
      `**Window**: ${snapshot.windowDays} days | **PRs analyzed**: ${snapshot.prCount}`,
      '',
      '## Metrics',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Finding Yield (avg/review) | ${snapshot.findingYield} |`,
      `| False Positive Rate | ${snapshot.falsePositiveRate} |`,
      `| Reviewer Delta | ${snapshot.reviewerDelta} |`,
      `| Post-Merge Bug Rate | ${snapshot.postMergeBugRate} |`,
      '',
      '## Notes',
      '',
      snapshot.prCount === 0
        ? 'No PR data available in this window. Zero-baseline snapshot (Phase C bootstrap — live data sources not yet wired).'
        : `Analyzed ${snapshot.prCount} PRs over ${snapshot.windowDays} days.`,
      '',
    ].join('\n');
    writeFileSync(verdictPath, verdictMd);

    return {
      verdictPath,
      bundleDir,
    };
  };
}
