---
feature_ids: [F192]
related_features: [F227, F200]
topics: [publish-verdict, task-outcome, generator-wire, schema-spec]
doc_kind: plan
created: 2026-06-09
owner_cat: opus-47
status: design-gate-pending
---

# F192 publish_verdict — Wire `eval:task-outcome` generator + 抽 SPEC.md

**Feature:** F192 — `docs/features/F192-socio-technical-harness-eval.md`
**Design Gate:** This document
**Goal:** Bring `eval:task-outcome` into the same publish pipeline as `eval:a2a` / `eval:capability-wakeup`. Stop manual bundle materialization.

## Why now (CVO directive 2026-06-09 03:34 UTC)

> "我感觉猫猫 你们是不是不要 搞这种hot fix？ 就是应该直接和其他a2a 那种那样对接到统一管道？ 顺手把 schema 抽出来写成 docs/harness-feedback/SPEC.md？这样 manual contributor（包括未来社区贡献者）能直接看规范，不用啃代码。"

PR #2158 (manual bundle materialization) was closed because:
1. Manual path has no schema enforcement — eval cat must hand-replicate format from reference verdict.md, which is exactly how I produced two P1 schema breaks that @gpt52 caught
2. Reference repo for community contributors should be the generator path, not hand-written bundles
3. F192 Phase H wrap-up explicitly left task-outcome generator in "independent backlog" — this directive moves it out of that backlog and onto the active path

## Acceptance Criteria

### AC-0 (PREREQUISITE) Verdict taxonomy alignment — episode 7-class vs harness 4-class

**Discovered by @gpt52 review on first plan revision**: `eval:task-outcome` carries TWO verdict taxonomies that must be explicitly bridged before any wire work:

- **Episode-level** (`packages/api/src/infrastructure/harness-eval/task-outcome/task-outcome-episode.ts:14` `VERDICT_CLASSES`): `success / corrected_success / needs_investigation / harness_fix_needed / routing_failure / taste_mismatch / abandoned` — 7 classes, one per Task Outcome Episode (the F192 Phase G spec semantics)
- **Harness-level** (`packages/api/src/infrastructure/harness-eval/verdict-handoff.ts:36` `VerdictHandoffPacket.verdict`): `delete_sunset / build / fix / keep_observe` — 4 classes, the publish pipeline + Eval Hub read-model only accept this enum
- **Domain instruction** (`packages/api/src/infrastructure/harness-eval/eval-cat-invocation.ts:41`): currently tells the eval cat "Verdict is categorical (7-class)", **directly conflicting** with the schema that would reject any 7-class value at publish time

**Decision (this PR): Map approach + downgrade scope — no premature 7-class data claim**

1. **Packet-level `verdict` stays 4-class** (`fix / build / keep_observe / delete_sunset`) — eval cat's harness-state judgement summarising the window. Day 1-5 rich-block verdicts informally already did this (used `keep_observe` / `fix`); the new generator path makes the choice explicit + schema-enforced.
2. **Episode-level `verdict` (7-class) is OUT OF SCOPE for this wire PR.** Discovered in @gpt52 rev1 review: production code has no `updateVerdict()` caller. `task_outcome_episodes.verdict` column in the live DB is **NULL for all 49 episodes**. The 7-class enum is *defined* (`task-outcome-episode.ts:14` `VERDICT_CLASSES`) but the writeback path was never wired. The original Phase G plan (`docs/discussions/2026-06-03-eval-task-outcome-plan.md:106`) literally said "verdict: null # eval 猫填" — the eval-cat-writeback loop is unfinished work, not a misplaced field.
   - **Generator will NOT emit 7-class distribution metrics** in this PR (would always report 0/0/0/...0 — vacuous evidence, fake signal).
   - **Generator will emit `terminalState` distribution metrics** instead: `terminalState` is a separate, populated column (`in_progress / completed / abandoned / escalated_cvo / corrected_then_completed`) that production code DOES write. The rev1 example that grouped `in_progress` with 7-class verdicts was a conflation; `in_progress` belongs to the lifecycle column, not the verdict column.
   - **Snapshot evidence**: per-component metrics over `{episodes_total, completed_total, in_progress_total, abandoned_total, ...}` and signal totals (`magic_word_ref_total`, `permission_cancel_total`, `proposal_reject_total`). No 7-class counters.
   - **Episode verdict writeback path** (`updateVerdict()` callers + cat SOP for verdict assignment) → separate AC under a separate PR. Out of scope here; documented in §"Follow-up backlog" below.
3. **Update `DOMAIN_INSTRUCTIONS['eval:task-outcome']`** in `eval-cat-invocation.ts:41` to replace the 7-class verdict sentence with: "Verdict (packet-level) is the harness-state judgement: `fix / build / keep_observe / delete_sunset`. Per-episode terminal lifecycle (`in_progress / completed / ...`) and signal distributions are evidence inputs, not the packet verdict. The 7-class episode verdict writeback path is unfinished separate work; do not assume it is queryable yet."
4. **Schema does not change.** Rejected alternatives:
   - ❌ Extending `VerdictHandoffPacket.verdict` to 11-class union: breaks Eval Hub read-model, breaks per-verdict policy gates (`computePublishPolicy`), ripples to a2a / cw without good reason
   - ❌ Adding a second packet field for episode verdict: redundant with `attribution.findings` once writeback exists
   - ❌ Keeping the 7-class instruction silently mapping at generator-time: hides contract drift, eval cat can't reason about packet output
   - ❌ Spending this PR also wiring episode verdict writeback: scope creep, blocks the simple wire on the unfinished episode-eval loop

This is **AC-0** because every downstream AC presumes a stable verdict contract + truthful data claims. If CVO / @opus pushes back on the scope downgrade (e.g. wants episode writeback inside this PR), AC-1..AC-8 need re-scoping.

### AC-1 sourceRefs union 第三 kind
Add `kind: "task-outcome-snapshot"` to `publish-verdict.ts` discriminated union (mirror `a2a-snapshot-attribution` / `capability-wakeup-trial-window`). Replayable selector fields:
- `windowStartMs: number` (inclusive epoch ms)
- `windowEndMs: number` (exclusive epoch ms; must be > windowStartMs)
- `databasePath?: string` (optional override; default `task-outcome-episodes.sqlite` at repo root)
- `evidenceCatId?: string` (optional anchor for cross-thread evidence linking)

### AC-2 Domain registration — full wire touchpoints, split by PR (expanded after @gpt52 P1#2 + rev1 P1#1)

Original AC-2 listed only 3 API-side touchpoints. @gpt52 review caught the API-only scope was a fake wire. Rev1 expansion added MCP / runtime / test layers. **Rev2 (this version)** further splits the touchpoints by PR phase to prevent a second fake-wire surface: instruction / tool-description text is itself a "wire" signal that eval cats and CVO read. Per `eval-cat-invocation.ts:152-161`, when `wiredDomains` is undefined (legacy caller default), the publish instruction emits for any domain present in `PUBLISH_VERDICT_INSTRUCTIONS_BY_DOMAIN`. So that map entry must NOT land before the real wire.

#### PR1 touchpoints (schema + taxonomy correction only; honest 501 preserved)

**API server** (`packages/api/`):
- `publish-verdict/publish-verdict.ts:189-201` — extend `EXPECTED_REFS_KIND_BY_DOMAIN` map to include `'eval:task-outcome': 'task-outcome-snapshot'`
- `publish-verdict/types.ts` — extend `VerdictSourceRefs` union with the `task-outcome-snapshot` shape
- `publish-verdict/validation.ts` — add `isTaskOutcomeSourceRefs` type guard mirroring `isA2aSourceRefs` (used by handler's `refsKind` derivation at `publish-verdict.ts:189`)
- `eval-cat-invocation.ts:41` — update `DOMAIN_INSTRUCTIONS['eval:task-outcome']` per AC-0 (taxonomy correction); this is the BASE instruction, not the publish-section append

**MCP server** (`packages/mcp-server/`):
- `src/tools/publish-verdict-tool.ts:88,94` — extend MCP tool input schema's `sourceRefs` union to accept the third kind (otherwise tool-layer schema rejects calls before they reach the API handler)

**Tests**: handler asserts `unsupported_generator` 501 for task-outcome + valid task-outcome-snapshot sourceRefs (proves contract is half-built honestly; matches capability-wakeup's pre-PR1 state).

**NOT in PR1**:
- ❌ `PUBLISH_VERDICT_INSTRUCTIONS_BY_DOMAIN['eval:task-outcome']` entry — its mere presence flips `domainInstructions()` to emit publish guidance for legacy callers (`eval-cat-invocation.ts:152-161`), which is the fake-wire @gpt52 rev1 caught at the instruction surface
- ❌ `src/tools/publish-verdict-tool.ts:147` "wired domains" doc text update — readers (including CVO + LLMs invoking the tool) treat this as the ground-truth wired set
- ❌ `index.ts:1626` `verdictGenerators` map injection
- ❌ `index.ts:3207` `wiredPublishDomains` set
- ❌ Any reference impl of the generator

PR1 should be perceivable to the eval cat as "schema for task-outcome exists, instructions clarify taxonomy, but task-outcome `publish_verdict` still returns 501 (and instruction is silent on publishing for this domain)."

#### PR2 touchpoints (real generator + flip the wire, all in one PR)

**API server**:
- `eval-cat-invocation.ts` — add `PUBLISH_VERDICT_INSTRUCTIONS_BY_DOMAIN['eval:task-outcome']` describing `task-outcome-snapshot` sourceRefs shape (now safe: matches real generator behaviour)

**MCP server**:
- `src/tools/publish-verdict-tool.ts:147` — update "wired domains" doc text to include `eval:task-outcome`

**Runtime bootstrap**:
- `index.ts:1626` — extend `verdictGenerators` map with `generateTaskOutcomeLiveVerdict`
- `index.ts:3207` — extend `wiredPublishDomains` set

**Generator + supporting files** (all NEW; see file deltas section):
- `eval-task-outcome-live-verdict.ts`, `-adapter.ts`, `-renderer.ts`, `-source-resolver.ts`

**Verification gate**:
- MCP tool-layer test (`publish-verdict-tool.task-outcome.test.js`) exercising the full chain from MCP tool call to generator output to PR creation mock. Reference: `publish-verdict-tool.test.js` capability-wakeup pattern.

PR2 is the single atomic wire-flip: before merge → 501; after merge → live verdict pipeline.

### AC-3 Generator implementation (parallels `eval-capability-wakeup-live-verdict.ts`)
New file: `packages/api/src/infrastructure/harness-eval/task-outcome/eval-task-outcome-live-verdict.ts`
- Input: `{ verdictId, harnessFeedbackRoot, domain, window, store, submittedPacket }`
- Reads from `task-outcome-episodes.sqlite` over [windowStartMs, windowEndMs)
- Produces:
  - `snapshot.json` — components for Phase-G-v0 pipeline + F227 backfill, all metrics number/null
    - **Episode metrics**: `episodes_total`, `terminalState` distribution (`completed_total`, `in_progress_total`, `abandoned_total`, `escalated_cvo_total`, `corrected_then_completed_total`)
    - **Signal metrics**: per-category counters (`a1_signals_total`, `magic_word_ref_total`, `permission_cancel_total`, `proposal_reject_total`, `proxy_signals_total`)
    - **F227 sub-component metrics**: `events_backfilled_visible`, `confidence_low_count`, etc.
    - **Explicitly NOT computed** (per AC-0 rev2 downgrade): 7-class episode verdict distribution. The `task_outcome_episodes.verdict` column is NULL for 100% of production rows; counting it would surface as `{success: 0, ..., abandoned: 0}` — vacuous fake signal. Once episode verdict writeback ships, regenerate from a separate PR
  - `attribution.json` — findings derived from terminalState + signal distribution + cross-feature evidence anchors (e.g. `Phase-G-v0/permission_cancel_total`, `Phase-G-v0/in_progress_total`). Anchors point at the snapshot metrics actually emitted, so the read-model resolver can verify them
  - `provenance.json` — sha256 of DB file + rich-block packet ids
  - `verdict.md` — strict format matching `extractBullet` / `parseHarness` / `Evidence:` markers
  - **Replay artifact placement** (per @gpt52 P1#3): place `episodes.json` inside `bundleDir/raw/episodes.json` **NOT** `generated/task-outcome/<verdictId>/`. Rationale: the artifact-only merge-gate allowlist (`docs/SOP.md:124,144`) currently whitelists `docs/harness-feedback/` and `generated/capability-wakeup/<verdictId>/` only. Putting the replay file inside `bundleDir` (which lives under `docs/harness-feedback/bundles/<verdictId>/`) keeps it inside the existing allowlist with zero SOP / merge-gate / test edits. Alternative — extending the allowlist — adds 3+ touchpoints (SOP doc, gate script regex, tests) for no architectural gain
- Returns `TaskOutcomeLiveVerdictArtifact` matching `VerdictGenerator` contract

### AC-4 Cat-facing instructions (`PUBLISH_VERDICT_INSTRUCTIONS_BY_DOMAIN['eval:task-outcome']`)
Tell the eval cat that for task-outcome they pass `{kind: 'task-outcome-snapshot', windowStartMs, windowEndMs}` as `sourceRefs`. Mention the optional `evidenceCatId` for cross-thread anchor and the optional `databasePath` override (defaults to repo root).

### AC-5 TDD coverage (split by PR per rev2 chunking; rev3 adds @gpt52 non-blocking suggestions)

#### PR1 tests
- Red 1: `handlePublishVerdict` with `eval:task-outcome` + a2a kind sourceRefs → `sourceRefs_kind_mismatch` 400
- Red 2: `handlePublishVerdict` with `eval:task-outcome` + valid `task-outcome-snapshot` sourceRefs but no generator wired → `unsupported_generator` 501 (this is the persistent state after PR1 merges; PR1 keeps this red because the wire is intentionally not flipped)
- **NEW (rev3, @gpt52 non-blocking suggestion #1)** — extend `packages/mcp-server/test/publish-verdict-tool-schema.test.js`: assert MCP tool input schema accepts `{kind: 'task-outcome-snapshot', windowStartMs, windowEndMs}` shape without pre-rejection. This is the minimal regression test at the tool-layer that locks in the schema-only half of the wire
- **NEW (rev3, @gpt52 non-blocking suggestion #2)** — negative test in `buildEvalCatInvocation` suite: when `wiredDomains` is undefined AND when wiredDomains is the legacy default set (a2a + capability-wakeup), assert that the invocation for `eval:task-outcome` does NOT include any publish-section text. This locks the "instruction surface stays honest 501" guarantee — prevents a future contributor (or me, in PR2 hurry) from prematurely adding `PUBLISH_VERDICT_INSTRUCTIONS_BY_DOMAIN['eval:task-outcome']`
- Edge: schema-non-conformant inputs (rejected at handler), newline injection guard re-asserted for new kind

#### PR2 tests
- Green: with generator wired + valid sourceRefs + valid packet → returns `{commitSha, prUrl}`
- Generator output shape: `eval-task-outcome-live-verdict.test.js` — exercises buildSnapshot / buildAttribution / writeProvenance pure functions; asserts terminalState distribution surfaces, signal totals, and NO 7-class verdict counters emitted (AC-0 rev2 invariant)
- MCP tool-layer **integration** test (`publish-verdict-tool.task-outcome.test.js`): full chain from MCP tool call → handler → generator → GitPublisher mock → returns `{commitSha, prUrl}`. This is the test that proves the wire-flip is real, complementing the schema regression test from PR1
- Idempotency: re-running same packet.id returns `verdict_already_exists` 409 (live + main-side checks)
- Empty episode window: generator handles 0-row SQL result gracefully (snapshot with 0-count metrics; no divide-by-zero; attribution finding "no signals window")
- Re-use `submitted-packet-guard` and `publish-policy` paths unchanged (domain-agnostic, already tested for a2a / cw)

### AC-6 `docs/harness-feedback/SPEC.md` — schema 抽出
New file documenting:
- `verdict.md` format: frontmatter required keys + bullet labels + `Evidence:` marker line + `Harness:` strict `Feature/Component (Name)` regex
- `bundle/snapshot.json` schema (zod from `eval-a2a-artifact-resolver.ts`): components shape, count types (number|null only), confidence enum
- `bundle/attribution.json` schema: finding shape, evidence anchor convention (`<componentId>/<metricKey>`), severity enum, required `proposedAction`
- `bundle/provenance.json` schema: rawInputs path+sha256 requirement
- Worked example referencing `2026-06-09-eval-a2a-c2-pending-runtime-sync-keep` bundle
- Notes for manual contributors: this file lives alongside the code; if you see schema drift, file an issue rather than hand-writing a one-off bundle

### AC-7 Backwards compatibility
- Existing `eval:a2a` / `eval:capability-wakeup` paths unchanged (no schema breakage)
- Existing rich-block ephemeral verdicts in `thread_eval_task_outcome` remain valid as informal history — do not retroactively migrate (CVO has not asked)
- The 5-day Day-1..Day-5 trajectory: leave as rich-block until either (a) we choose to retro-publish a single summary verdict via the new generator, or (b) we skip materialization and start fresh from Day-6

### AC-8 Documentation drift guard
- Add a brief paragraph in F192 feature doc Phase H 收尾 section noting task-outcome wire is no longer "独立 backlog" — link this plan + the resulting PR
- BACKLOG.md entry refresh

## Architecture & file deltas (revised after @gpt52 P1#2/#3 review)

```
packages/api/src/infrastructure/harness-eval/
├── publish-verdict/
│   ├── publish-verdict.ts                                — extend EXPECTED_REFS_KIND_BY_DOMAIN map
│   ├── types.ts                                          — extend VerdictSourceRefs union
│   └── validation.ts                                     — add isTaskOutcomeSourceRefs guard
├── task-outcome/
│   ├── eval-task-outcome-live-verdict.ts                 — NEW (mirror cw-live-verdict)
│   ├── eval-task-outcome-adapter.ts                      — NEW (mirror cw-adapter)
│   ├── eval-task-outcome-renderer.ts                     — NEW (markdown format)
│   └── eval-task-outcome-source-resolver.ts              — NEW (replayable window → episode rows)
├── eval-cat-invocation.ts                                — (a) update DOMAIN_INSTRUCTIONS per AC-0 verdict taxonomy fix
│                                                           (b) add PUBLISH_VERDICT_INSTRUCTIONS_BY_DOMAIN entry

packages/api/src/
├── index.ts                                              — (a) line 1626 extend verdictGenerators injection
│                                                           (b) line 3207 extend wiredPublishDomains set
└── routes/eval-hub.ts                                    — register through opts.verdictGenerators (touched via index.ts wire)

packages/mcp-server/src/tools/
└── publish-verdict-tool.ts                               — (a) lines 88,94 extend tool input schema sourceRefs union
                                                            (b) line 147 update wired-domains list in tool description

docs/harness-feedback/
└── SPEC.md                                               — NEW (抽 schema 给社区/manual contributor)

packages/api/test/harness-eval/
├── task-outcome-publish-verdict.test.js                  — NEW (red→green TDD at handler layer)
└── task-outcome-live-verdict-generator.test.js           — NEW (generator output shape)

packages/mcp-server/test/
└── publish-verdict-tool.task-outcome.test.js             — NEW (P1#2 mandate: prove tool-layer schema accepts new kind, no pre-rejection)

docs/features/F192-socio-technical-harness-eval.md        — Phase H 收尾 段落同步 + AC-0 taxonomy decision linked
docs/BACKLOG.md                                           — refresh entry

# NOT touched (decided after @gpt52 P1#3):
# docs/SOP.md                                             — replay artifact lives in bundleDir, no allowlist extension
# (gate script)                                           — same reason
```

Estimated diff: ~500-700 lines code + ~250 lines tests (incl. mcp-server layer) + ~200 lines docs = single non-trivial PR.

## Sequencing vs parallel opus-47 (eval:memory wire)

Parallel opus-47 in `thread_mq62cz3jc20z127z` is proposing a sibling wire for `eval:memory` (`kind: "memory-recall-snapshot"`). Both wires touch `publish-verdict.ts` and `eval-cat-invocation.ts`. Coordination message already posted there.

Proposed serial merge order (default unless parallel pushes back within 30 min of my coordination message):
1. This PR (task-outcome) lands first — includes SPEC.md
2. Parallel opus-47's eval:memory PR rebases onto SPEC.md + its own wire

Rationale: SPEC.md is shared; whoever merges first writes it, the other rebases. Either order works, but a chosen default avoids deadlock.

## Owner asks

| Cat | Ask |
|-----|-----|
| @opus (F192 owner) | (1) Day-3 ack ordered task-outcome wire after v0.5 signal wiring (AC-G10/G12/G13). CVO 2026-06-09 directive supersedes that ordering — confirm reprioritization or push back. (2) Optionally co-author the generator implementation if you'd rather own that adapter family — I'm prepared to write it but you wrote a2a / capability-wakeup so your touch is faster |
| @codex | Cross-family review when PR opens (eval:a2a registered cat; spotted my schema breaks on PR #2158 reference path, will spot any here too) |
| @opus-47 (parallel in `thread_mq62cz3jc20z127z`) | Coordination on serial merge order — default I-first; push back to swap |
| @landy | Direction lock-in: confirm this plan + AC subset is the right scope for the first PR. AC-7 (do not retro-migrate 5-day rich blocks) is the explicit non-action — confirm OK |

## What I will not do (in this PR)

- ❌ Retroactively migrate Day 1-5 rich block verdicts to bundle format (AC-7)
- ❌ Wire `eval:sop` or `eval:memory` (parallel opus-47 handles memory; sop has additional file-writer layer cost per Phase H wrap-up notes)
- ❌ Add v0.5 signal sources (AC-G10/G12/G13 — that's @opus' separate F192 work)
- ❌ Manual bundle materialization side-paths (CVO directive)
- ❌ **Episode verdict writeback path** (`updateVerdict()` callers + cat SOP for assigning episode verdicts). Discovered in @gpt52 rev2 review: production code has 0 callers, DB has 0 non-null verdicts. This is unfinished separate work (Phase G original plan called it out); should not block the publish wire. Goes to follow-up backlog below
- ❌ Emit 7-class episode verdict distribution metrics in the generator. Would be all-zeros until the writeback path lands — vacuous evidence violates "live verdict evidence refs must be resolvable" invariant from F192 Verdict Matrix Contract

## Follow-up backlog (out of scope, tracked here for closure)

- **FBL-1 Episode verdict writeback path**: implement `updateVerdict()` callers — eval cat (this me!) calls it during daily cron after attribution, marking each episode in window with one of the 7 classes. Needs SOP / instruction update for eval cat too. Independent of wire PR
- **FBL-2 Schema rename `permission_cancel` → `tool_authorization_deny`** (AR-002 from PR #2158 attribution): clarify vs `proposal_reject`. Owner @opus said defer to v0.5 batch
- **FBL-3 Retro-publish Day 1-5 trajectory verdict** via new generator once PR2 lands. CVO decides whether to back-stamp or start fresh from Day-6

## Next action (immediately after this design memo merges or CVO ack)

**Chunking correction (after @gpt52 review)**: original plan said "PR1 = schema + dispatch + tests + SPEC.md; PR2 = real generator". @gpt52 flagged this would replay the capability-wakeup "fake wire" failure mode — if PR1 lands schema + dispatch but the generator stub is registered in `verdictGenerators` / `wiredPublishDomains`, the domain appears wired to CVO / callers but actually 500s. Corrected chunking:

1. **PR1 (structural prep without exposing wire)**: schema union extension in `publish-verdict.ts` + `types.ts` + `validation.ts`, MCP tool schema extension (the union shape only), `DOMAIN_INSTRUCTIONS` AC-0 fix, SPEC.md skeleton, plus tests at handler layer asserting `unsupported_generator` 501 (matching capability-wakeup's pre-PR1 state behaviour). **Crucially: do NOT add `eval:task-outcome` to `verdictGenerators` map or `wiredPublishDomains` set in PR1.** Effect: schema is ready, taxonomy is corrected, contract is documented, but `publish_verdict` for task-outcome still 501s — honestly, not pretending to be wired.

2. **PR2 (real generator + final wire)**: implementation of `eval-task-outcome-live-verdict.ts` + adapter + renderer + source-resolver, generator-shape tests, mcp-server tool-layer test from AC-2 step 9, **then** add `eval:task-outcome` to `verdictGenerators` + `wiredPublishDomains` in the SAME PR. This is the wire-flip moment — before this PR's merge, the domain is honest-501; after this PR's merge, it's live.

3. **PR3 (optional, separate decision)**: retro publish first real verdict via the new generator. CVO decides whether to start fresh from Day-6 (clean) or back-stamp a single trajectory verdict for Day 1-5.

If CVO prefers single PR over chunked, I can land everything in one. Default to chunked-but-honest (no fake wire interim state) for review velocity. Reviewer @gpt52 also confirmed this chunking only works under the "no premature wire injection" constraint above.
