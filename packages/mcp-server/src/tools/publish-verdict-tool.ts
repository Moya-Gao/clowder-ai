import { z } from 'zod';
import { callbackPost } from './callback-tools.js';
import type { ToolResult } from './file-tools.js';

/**
 * F192 Phase H AC-H4: cat_cafe_publish_verdict MCP tool.
 *
 * 砚砚 R3 P1 #1 cloud: previously DOMAIN_INSTRUCTIONS referenced this tool but
 * it wasn't registered anywhere — cats would loop. Now wired to
 * POST /api/eval-domains/:domainId/publish-verdict which calls
 * handlePublishVerdict (validates packet → resolves sourceRefs → invokes
 * isolated-worktree publisher → opens auto-PR).
 *
 * Cat input: VerdictHandoffPacket + sourceRefs (snapshotName + attributionName
 * basenames inside docs/harness-feedback/{snapshots,attributions}/).
 * Tool output: { commitSha, prUrl, verdictPath, bundleDir } on success.
 */

const verdictPacketShape = z
  .object({
    id: z.string().min(1),
    domainId: z.string().min(1),
    createdAt: z.string().min(1),
    phenomenon: z.string().min(1),
    verdict: z.enum(['fix', 'build', 'keep_observe', 'delete_sunset']),
  })
  .passthrough()
  .describe(
    'VerdictHandoffPacket — 12 fields total (id, domainId, createdAt, phenomenon, harnessUnderEval, evidencePacket, dailyTrend, rootCauseHypothesis, verdict, ownerAsk, acceptanceReevalPlan, counterarguments; governance optional except delete_sunset). See instructions in your eval cat invocation packet for full schema.',
  );

export const publishVerdictInputSchema = {
  domainId: z.string().min(1).describe('Your assigned eval domain (e.g. eval:a2a). Must match packet.domainId.'),
  packet: verdictPacketShape,
  sourceRefs: z
    .object({
      snapshotName: z
        .string()
        .min(1)
        .describe('Basename of sanitized eval snapshot YAML inside <harnessFeedbackRoot>/snapshots/.'),
      attributionName: z
        .string()
        .min(1)
        .describe('Basename of sanitized attribution YAML inside <harnessFeedbackRoot>/attributions/.'),
    })
    .describe(
      '砚砚 R1 P1 #2 + R2 P2: explicit evidence sources (NOT fabricated). BASENAMES only — path separators / .. rejected.',
    ),
  // 砚砚 R4 P1 + cloud R4 P1: catId is NOT a cat-supplied field — server
  // derives it from the trusted callback principal (invocationId → registry).
  // Removed from input schema; agentKeyCatId stays for shared-MCP routing.
  agentKeyCatId: z
    .string()
    .min(1)
    .optional()
    .describe('Persistent-agent identity selector. Required for shared Antigravity MCP.'),
};

export async function handlePublishVerdict(input: {
  domainId: string;
  packet: Record<string, unknown>;
  sourceRefs: { snapshotName: string; attributionName: string };
  agentKeyCatId?: string | undefined;
}): Promise<ToolResult> {
  return callbackPost(
    `/api/eval-domains/${encodeURIComponent(input.domainId)}/publish-verdict`,
    {
      packet: input.packet,
      sourceRefs: input.sourceRefs,
    },
    { agentKeyCatId: input.agentKeyCatId },
  );
}

export const publishVerdictTools = [
  {
    name: 'cat_cafe_publish_verdict',
    description:
      'F192 Phase H: publish your eval verdict as a structured commit + auto-PR. ' +
      'Use after your analysis converges to a verdict for your assigned eval domain (eval:a2a in v1). ' +
      'Pass the complete VerdictHandoffPacket + sourceRefs (basenames of your sanitized evidence YAMLs). ' +
      'The handler validates schema, resolves evidence paths under allowlist, invokes the domain generator inside an isolated git worktree, commits + pushes the branch verdict/auto/<domain-slug>/<verdict-id>, and opens an auto-PR. Returns { commitSha, prUrl }. ' +
      'GOTCHA: only eval:a2a is wired in v1; other domains return 501. ' +
      'GOTCHA: catId must match the registered eval cat for the domain (eval:a2a → codex); 403 not_allowed otherwise. ' +
      'GOTCHA: DO NOT run git push/commit/add yourself; this tool owns the publish lifecycle.',
    inputSchema: publishVerdictInputSchema,
    handler: handlePublishVerdict,
  },
] as const;
