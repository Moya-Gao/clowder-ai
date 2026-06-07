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
    'Enter the eval:task-outcome domain thread. Analyze task outcome episodes: review permission cancel signals (tool_name, reason, frequency), proposal reject signals (proposalId, proposalType thread/session_handoff, catId, rejectionReason), magic word triggers (word, context), and A1 world truth events (merge/revert). Bind signals to episodes, compare weekly cancel rates and verdict distributions, identify patterns (per-cat, per-task-type), and produce a verdict handoff packet. Verdict is categorical (success/corrected_success/needs_investigation/harness_fix_needed/routing_failure/taste_mismatch/abandoned), not a score. Proxy signals navigate, they do not judge.',
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
/** Common packet section — used by all domain publish instructions. */
const PUBLISH_VERDICT_PACKET_INSTRUCTIONS = `

## Publish your verdict (MANDATORY — NOT git push)

When your analysis converges to a verdict, call the \`cat_cafe_publish_verdict\` MCP tool with a complete \`VerdictHandoffPacket\` (12 top-level fields; governance optional except for delete_sunset; all other fields REQUIRED):

1. **id** — stable verdict slug (lowercase alphanumeric + hyphens, e.g. \`2026-06-05-{domainSlug}-c1-friction\`)
2. **domainId** — must match your assigned domain
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

## After publishing — PR lifecycle (MANDATORY)

The MCP tool returns a PR URL. Your job is NOT done at publish — follow through:

### Evidence-only verdict PR (\`keep_observe\` / first-round verdicts)
1. The PR contains only docs/evidence files (no code). You are the domain owner — **self-merge via \`gh pr merge <number> --squash --delete-branch\`** after confirming the PR is clean (no unintended files).
2. Post a summary in your domain thread: verdict direction + PR URL + next eval schedule.

### Actionable verdict PR (\`fix\` / \`build\` / \`delete_sunset\`)
1. Merge the evidence PR yourself (same as above — evidence is evidence regardless of verdict direction).
2. The \`ownerAsk.targetOwnerCatId\` in your verdict identifies who should act on the finding. **Cross-post to that owner's thread** via \`cat_cafe_cross_post_message\` with: verdict summary, PR URL, and the specific \`requestedAction\`.
3. If the owner creates a fix/build PR with code changes, that PR follows normal cross-review merge-gate (NOT self-merge).

### Thread traceability
Include your domain thread ID in the verdict PR body (the MCP tool does this automatically via provenance.json). If someone asks "which thread produced this PR", the answer is in \`provenance.json → sourceThreadId\`.
`;

/** a2a-specific sourceRefs section (snapshot/attribution YAML basenames). */
const PUBLISH_VERDICT_INSTRUCTIONS_A2A = `${PUBLISH_VERDICT_PACKET_INSTRUCTIONS}
You must also supply \`sourceRefs\` (NOT part of packet, separate input field): \`{ snapshotName, attributionName }\` — BASENAMES of your sanitized evidence YAMLs inside \`<harnessFeedbackRoot>/snapshots/\` and \`<harnessFeedbackRoot>/attributions/\` respectively. Path separators / \`..\` will be rejected (allowlist). The tool will NOT fabricate evidence — if you don't provide refs, publish fails.

The MCP tool creates branch \`verdict/auto/{domainSlug}/{verdictId}\` + commits + opens PR. Returns commit SHA + PR URL.

**DO NOT** run \`git add\`, \`git commit\`, \`git push\`, or write verdict files directly. Use the MCP tool.
`;

/**
 * F192 Phase H 收尾 PR-2 (砚砚 R1 P2): capability-wakeup-specific sourceRefs section
 * (replayable selector — no pre-sanitized YAMLs; provider replays from session/trial data).
 */
const PUBLISH_VERDICT_INSTRUCTIONS_CAPABILITY_WAKEUP = `${PUBLISH_VERDICT_PACKET_INSTRUCTIONS}
You must also supply \`sourceRefs\` (NOT part of packet, separate input field) as a replayable selector:
\`\`\`json
{
  "kind": "capability-wakeup-trial-window",
  "capability": "rich-messaging",
  "windowStartMs": 1759276800000,
  "windowEndMs": 1759363200000,
  "sessionIds": ["session-id-1", "session-id-2"]
}
\`\`\`

Fields:
- \`kind\` — REQUIRED literal \`"capability-wakeup-trial-window"\` (other selector kinds reserved for future durable trial store)
- \`capability\` — REQUIRED non-empty (e.g. \`rich-messaging\` / \`workspace-navigator\` / \`browser-preview\`); no newlines
- \`windowStartMs\` / \`windowEndMs\` — REQUIRED finite ms epoch; \`windowEndMs\` must be > \`windowStartMs\`. Trial fire time (\`trial.timeSpan.startMs\`) must fall in \`[windowStartMs, windowEndMs)\`
- \`sessionIds\` — REQUIRED non-empty array of session IDs to replay (PR-2 narrowed; global window scan deferred to future PR with durable trial store)
- \`ruleIds\` — OPTIONAL narrowing (filters to specific rule IDs in the static capability-wakeup-rules registry)

Tool resolves the selector by replaying session events via \`buildCapabilityTrace → evaluateCapabilityWakeupTrace → classifyCapabilityWakeupTrials\` — no need for you to pre-sanitize evidence YAMLs. Tool will NOT fabricate evidence — if selector yields zero classified trials, publish fails.

The MCP tool creates branch \`verdict/auto/{domainSlug}/{verdictId}\` + commits + opens PR. Returns commit SHA + PR URL.

**DO NOT** run \`git add\`, \`git commit\`, \`git push\`, or write verdict files directly. Use the MCP tool.
`;

/**
 * 砚砚 R2 P1 (cloud) + R1 P2 PR-2: only domains with wired generator see publish
 * instructions; per-domain instruction blob includes the correct sourceRefs shape.
 * memory / sop / task-outcome keep base instructions until their generators land.
 */
const PUBLISH_VERDICT_INSTRUCTIONS_BY_DOMAIN: Partial<Record<EvalDomainRegistryEntry['domainId'], string>> = {
  'eval:a2a': PUBLISH_VERDICT_INSTRUCTIONS_A2A,
  'eval:capability-wakeup': PUBLISH_VERDICT_INSTRUCTIONS_CAPABILITY_WAKEUP,
};

/**
 * cloud R5 P2 (PR-2): publish instructions emit ONLY when a generator is actually
 * wired for the domain in this runtime. Bootstrap fail-closes cw wire when Redis-backed
 * ports (toolEventLog/skillLoadEventLog) unavailable; without this gating, cw cats
 * waste a run producing a packet they can't publish (handler returns 501).
 *
 * `wiredDomains` parameter is the runtime contract — pass `undefined` (or omit) when
 * caller can't determine wired set (defaults to "all known-wireable", preserving
 * pre-R5 behavior for tests + non-route call sites).
 */
function domainInstructions(
  domainId: EvalDomainRegistryEntry['domainId'],
  wiredDomains?: ReadonlySet<EvalDomainRegistryEntry['domainId']>,
): string {
  const base = DOMAIN_INSTRUCTIONS[domainId];
  const publishSection = PUBLISH_VERDICT_INSTRUCTIONS_BY_DOMAIN[domainId];
  if (!publishSection) return base;
  // If wiredDomains explicitly provided, gate on actual runtime support.
  if (wiredDomains !== undefined && !wiredDomains.has(domainId)) return base;
  return base + publishSection;
}

export interface BuildEvalCatInvocationOpts {
  /**
   * cloud R5 P2 (PR-2): explicit set of domains with wired verdict generators in
   * this runtime. When provided, publish instructions are omitted for unwired
   * domains (no point telling cats to publish via a tool that returns 501).
   * Omit/undefined → all known-wireable domains get publish instructions (legacy default).
   */
  wiredPublishDomains?: ReadonlySet<EvalDomainRegistryEntry['domainId']>;
}

export function buildEvalCatInvocation(
  input: EvalCatInvocationInput,
  opts: BuildEvalCatInvocationOpts = {},
): EvalCatInvocationPacket {
  const domain = parseEvalDomainRegistryEntry(input.domain);
  return {
    domainId: domain.domainId,
    targetThreadId: domain.systemThreadId,
    evalCat: domain.evalCat,
    instructions: domainInstructions(domain.domainId, opts.wiredPublishDomains),
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
