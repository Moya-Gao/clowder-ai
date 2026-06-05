import { type EvalDomainRegistryEntry, parseEvalDomainRegistryEntry } from './domain/eval-domain-registry.js';

export interface LegacyCleanupStatus {
  status: 'not_checked' | 'dry_run_ready' | 'redirected' | 'disabled';
  reportRef?: string;
}

export interface EvalCatInvocationInput {
  domain: EvalDomainRegistryEntry;
  trendRefs: string[];
  verdictRefs: string[];
  legacyCleanup: LegacyCleanupStatus;
}

export interface EvalCatInvocationPacket {
  domainId: EvalDomainRegistryEntry['domainId'];
  targetThreadId: string;
  evalCat: EvalDomainRegistryEntry['evalCat'];
  instructions: string;
  context: {
    trendRefs: string[];
    verdictRefs: string[];
    sourceAdapter: EvalDomainRegistryEntry['sourceAdapter'];
    legacyScheduledTaskIds: string[];
    fixtures: EvalDomainRegistryEntry['fixtures'];
    legacyCleanup: LegacyCleanupStatus;
    sla: EvalDomainRegistryEntry['sla'];
  };
}

const DOMAIN_INSTRUCTIONS: Record<EvalDomainRegistryEntry['domainId'], string> = {
  'eval:a2a':
    'Enter the eval:a2a domain thread, load the longitudinal context, compare day-over-day trends, and produce a verdict handoff packet when evidence supports fix/build/keep/delete_sunset. Include legacy scheduled task status in the analysis to prevent duplicate triggers.',
  'eval:memory':
    'Enter the eval:memory domain thread, load recall quality and library health trends, compare day-over-day recall metrics (MRR, precision@K, abandonment) and library health indicators (orphan edges, stale anchors, verification debt), and produce a verdict handoff packet when evidence supports fix/build/keep/delete_sunset.',
  'eval:sop':
    'Enter the eval:sop domain thread, load the SOP definition for the target domain, trace session commands / env / git state against machine-checkable predicates, and produce a per-rule violation report. Hand off actionable violations to the rule owner (skill maintainer) with trace evidence.',
  'eval:capability-wakeup':
    'Enter the eval:capability-wakeup domain thread, prioritize workspace-navigator first, compare weekly miss-rate trends across capability wakeup traces, separate cognitive / behavioral / attention-dilution misses, and produce a verdict handoff packet when evidence supports fix/build/keep/delete_sunset.',
  'eval:task-outcome':
    'Enter the eval:task-outcome domain thread. Analyze task outcome episodes: review permission cancel signals (tool_name, reason, frequency), magic word triggers (word, context), and A1 world truth events (merge/revert). Bind signals to episodes, compare weekly cancel rates and verdict distributions, identify patterns (per-cat, per-task-type), and produce a verdict handoff packet. Verdict is categorical (success/corrected_success/needs_investigation/harness_fix_needed/routing_failure/taste_mismatch/abandoned), not a score. Proxy signals navigate, they do not judge.',
};

/**
 * F192 Phase H AC-H4 (砚砚 Path B): publish verdict via MCP tool, NOT git push.
 *
 * Replaces abandoned PR #2091 教学 ('git add + git commit + git push origin
 * main' violates §5 rule #2 — review must be cross-individual). Eval cats
 * now publish through `cat_cafe_publish_verdict` MCP tool which validates
 * packet schema, calls generator, creates isolated branch, opens auto-PR.
 *
 * Appended to all 5 domain instructions so cats see consistent publish path
 * regardless of which domain they're working on.
 */
const PUBLISH_VERDICT_INSTRUCTIONS = `

## Publish your verdict (MANDATORY — NOT git push)

When your analysis converges to a verdict, call the \`cat_cafe_publish_verdict\` MCP tool with a complete \`VerdictHandoffPacket\` (12 top-level fields; governance optional except for delete_sunset; all other fields REQUIRED):

1. **id** — stable verdict slug (lowercase alphanumeric + hyphens, e.g. \`2026-06-05-eval-a2a-c1-friction\`)
2. **domainId** — must match your assigned domain (e.g. \`eval:a2a\`)
3. **createdAt** — ISO 8601 timestamp
4. **phenomenon** — what you observed (1-2 sentences)
5. **harnessUnderEval** — { featureId, componentId, name } of harness being evaluated
6. **evidencePacket** — { snapshotRefs, attributionRefs, metricRefs, sampleTraceRefs } — concrete refs to committed bundle artifacts, NOT raw narrative
7. **dailyTrend** — { window, current, baseline, threshold, direction } — quantitative trend data
8. **rootCauseHypothesis** — { summary, confidence (low/medium/high), alternatives[] }
9. **verdict** — categorical: \`fix\` / \`build\` / \`keep_observe\` / \`delete_sunset\` (NOT a score)
10. **ownerAsk** — { targetFeatureId, targetOwnerCatId, requestedAction }
11. **acceptanceReevalPlan** — { nextEvalAt, closureCondition }
12. **counterarguments** — non-empty array of alternative interpretations
13. **governance** (OPTIONAL except for \`delete_sunset\` verdict, where \`governance.cvoAcceptRequired: true\` is REQUIRED)

You must also supply \`sourceRefs\` (NOT part of packet, separate input field): { snapshotName, attributionName } — BASENAMES of your sanitized evidence YAMLs inside \`<harnessFeedbackRoot>/snapshots/\` and \`<harnessFeedbackRoot>/attributions/\` respectively. Path separators / \`..\` will be rejected (allowlist). The tool will NOT fabricate evidence — if you don't provide refs, publish fails.

The MCP tool creates branch \`verdict/auto/{domainSlug}/{verdictId}\` + commits + opens PR. Returns commit SHA + PR URL.

**DO NOT** run \`git add\`, \`git commit\`, \`git push\`, or write verdict files directly. Use the MCP tool.
`;

// 砚砚 R2 P1 (cloud): only domains with wired generator should see the publish
// instructions; otherwise cat tries to publish and handler returns 501. v1 only
// eval:a2a has the generator; others (memory/sop/capability-wakeup/task-outcome)
// keep base instructions until their generators are wired in Path B+.
const PUBLISH_VERDICT_SUPPORTED_DOMAINS: ReadonlySet<EvalDomainRegistryEntry['domainId']> = new Set(['eval:a2a']);

function domainInstructions(domainId: EvalDomainRegistryEntry['domainId']): string {
  const base = DOMAIN_INSTRUCTIONS[domainId];
  return PUBLISH_VERDICT_SUPPORTED_DOMAINS.has(domainId) ? base + PUBLISH_VERDICT_INSTRUCTIONS : base;
}

export function buildEvalCatInvocation(input: EvalCatInvocationInput): EvalCatInvocationPacket {
  const domain = parseEvalDomainRegistryEntry(input.domain);
  return {
    domainId: domain.domainId,
    targetThreadId: domain.systemThreadId,
    evalCat: domain.evalCat,
    instructions: domainInstructions(domain.domainId),
    context: {
      trendRefs: input.trendRefs,
      verdictRefs: input.verdictRefs,
      sourceAdapter: domain.sourceAdapter,
      legacyScheduledTaskIds: domain.legacyScheduledTaskIds,
      fixtures: domain.fixtures,
      legacyCleanup: input.legacyCleanup,
      sla: domain.sla,
    },
  };
}
