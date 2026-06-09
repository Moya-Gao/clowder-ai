---
feature_ids: [F192]
topics: [harness-feedback, live-verdict, publish-verdict, schema-spec]
doc_kind: harness-feedback
feedback_type: tool-eval
created: 2026-06-09
status: candidate
---

# Harness Feedback Spec

`docs/harness-feedback/` live verdicts are machine-read artifacts, not freeform notes.
If a document or bundle diverges from this contract, `loadEvalHubSummary()` or
`resolveA2aEvidenceBundle()` fails closed.

## Authority

This file is a reader-facing extraction of the current code contract.
The code remains the source of truth:

- `packages/api/src/infrastructure/harness-eval/hub/eval-hub-read-model.ts`
- `packages/api/src/infrastructure/harness-eval/a2a/eval-a2a-artifact-resolver.ts`
- `packages/mcp-server/src/tools/publish-verdict-tool.ts`

If this file and code drift, fix the code first or update both in the same PR.

## `verdict.md`

Required frontmatter keys:

```yaml
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a | eval:capability-wakeup | eval:memory | eval:sop | eval:task-outcome
packet_id: <verdict packet id>
source_snapshot: "snapshot:bundle/<verdict-id>/snapshot"
```

Required body shape:

```md
# Live Verdict — <verdict-id>

- Verdict: `keep_observe|fix|build|delete_sunset`
- Phenomenon: ...
- Harness: F123/ComponentId (Human readable name)
- Owner ask: ...
- Re-eval: ... 2026-06-10T03:00:00.000Z

Evidence:
- snapshot:bundle/<verdict-id>/snapshot
- attribution:bundle/<verdict-id>/<finding-id-or-no-finding-ref>
- metric:...

Counterarguments:
- ...
```

Important:

- Bullet labels must be plain `- Verdict:` style. Bolded labels are not parsed.
- `Evidence:` must be a standalone marker line. `## Evidence` is not parsed.
- `Harness:` must match `Feature/Component (Name)`. Multi-component prose does not parse.
- Only the 4-class packet verdict enum is valid in live verdict markdown:
  `fix / build / keep_observe / delete_sunset`.

## `bundle/snapshot.json`

Resolver contract:

```json
{
  "verdictId": "string",
  "evalSnapshotId": "string",
  "featureId": "F123",
  "generatedAt": "ISO-8601",
  "window": {
    "startMs": 0,
    "endMs": 1,
    "durationHours": 24
  },
  "components": [
    {
      "componentId": "C1",
      "componentName": "name",
      "activationCounts": { "metric.key": 1, "optional.metric": null },
      "frictionCounts": { "metric.key": 0 },
      "confidence": "no-data|low|medium|high"
    }
  ]
}
```

Compatibility notes:

- `id`/`name` are accepted aliases for `componentId`/`componentName`.
- `activationCounts` and `frictionCounts` values must be `number | null` only.
- Freeform strings, booleans, or inline comments in count maps are invalid.

## `bundle/attribution.json`

Required top-level fields:

```json
{
  "verdictId": "string",
  "featureId": "F123",
  "evalSnapshotId": "string",
  "generatedAt": "ISO-8601",
  "findings": [],
  "noFindingRecord": { "reason": "string", "evidence": "string" }
}
```

Each finding must contain:

- `id`
- `frictionSignal.type`
- `frictionSignal.severity` in `low | medium | high`
- `frictionSignal.confidence` in `[0,1]`
- `attribution.primaryLayer`
- `attribution.evidence[]`
- `proposedAction[]`

Evidence anchor convention:

- Use `<componentId>/<metricKey>` when pointing at bundled metrics.
- Each finding needs at least one bundled component evidence anchor.
- Each evidence item needs both `anchor` and `excerpt`.

## `bundle/provenance.json`

Required shape:

```json
{
  "verdictId": "string",
  "rawInputs": [
    { "path": "string", "sha256": "<64-char lowercase sha256>" }
  ],
  "generatedAt": "ISO-8601",
  "generator": {
    "name": "string",
    "version": "string"
  },
  "sanitizeRulesVersion": "string"
}
```

Important:

- Every `rawInputs[]` entry needs both `path` and a real 64-char lowercase SHA-256 digest.
- `sanitizeRulesVersion` is required by the resolver.

## Wire Status

Schema acceptance is not the same as a live wired domain.

- A domain is live only when all three are true:
  - MCP tool input schema accepts its `sourceRefs`
  - runtime injects a real generator in `verdictGenerators`
  - runtime adds the domain to `wiredPublishDomains`
- Before that, the honest state is `unsupported_generator` 501.

Current state:

- `eval:a2a` wired
- `eval:capability-wakeup` wired
- `eval:memory` wired
- `eval:task-outcome` wired (PR #2162)
- `eval:sop` still unwired

## Adding A Domain

If you are wiring a new eval domain into `cat_cafe_publish_verdict`, the minimum checklist is:

1. Add a new `domain_id` registry entry under `docs/harness-feedback/eval-domains/`
2. Define a replayable `sourceRefs` selector in:
   - `packages/api/src/infrastructure/harness-eval/publish-verdict/types.ts`
   - `packages/api/src/infrastructure/harness-eval/publish-verdict/validation.ts`
3. Implement a domain adapter that resolves `sourceRefs` into trusted live inputs
4. Implement a generator that writes:
   - `verdict.md`
   - `bundle/snapshot.json`
   - `bundle/attribution.json`
   - `bundle/provenance.json`
5. Wire the runtime in all 4 places together:
   - MCP tool schema
   - `PUBLISH_VERDICT_INSTRUCTIONS_BY_DOMAIN`
   - `verdictGenerators`
   - `wiredPublishDomains`
6. Prove it with tests:
   - invalid selector / kind mismatch / honest 501 before wire
   - generator bundle can round-trip through `loadEvalHubSummary()`
   - callback route uses server-trusted principal, not user payload

If only some of these are done, the domain is not “half wired”; it is still unwired.

## Worked Example

Use these committed artifacts as the canonical example pair:

- `docs/harness-feedback/verdicts/2026-06-09-eval-a2a-c2-pending-runtime-sync-keep.md`
- `docs/harness-feedback/bundles/2026-06-09-eval-a2a-c2-pending-runtime-sync-keep/`

## Contributor Note

If you are hand-writing artifacts, treat this file as a last resort.
The intended path is generator-produced output through `cat_cafe_publish_verdict`.
If a new domain needs manual exceptions, file that as a pipeline gap instead of
inventing a one-off bundle shape.
