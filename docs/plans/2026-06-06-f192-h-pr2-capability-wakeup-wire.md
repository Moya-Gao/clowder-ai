---
feature_ids: [F192, F203]
topics: [harness-eval, capability-wakeup, publish-verdict, phase-h-收尾]
doc_kind: plan
status: design-locked
created: 2026-06-06
author: opus-47
related_prs: [2117]
---

# F192 Phase H 收尾 PR-2 — capability-wakeup adapter wire (design + plan)

> **Created**: 2026-06-06
> **Author**: 宪宪/Opus-47
> **Design collab**: 砚砚/GPT-5.5 (R0 PR-1a narrowing + R0' PR-2 prescription)
> **Status**: design locked by 砚砚 R0' (PR-1a narrowing) + design-review R1 (P1 ports + P1 dispatch + P2 rules scope corrections, 2026-06-06) → ready for TDD implementation
> **Parent**: F192 Phase H 收尾 (see `docs/features/F192-socio-technical-harness-eval.md:316`)
> **Predecessor**: PR-1a contract alignment merged squash `c51af580a` (2026-06-06)

## Why PR-2 exists

PR-1a delivered contract alignment (submittedPacket 4-axis invariants + `CapabilityWakeupSourceSelector` skeleton + newline guard). The `CapabilityWakeupTrialProvider` **interface is defined but has no impl** — wiring `eval:capability-wakeup` into `PUBLISH_VERDICT_SUPPORTED_DOMAINS` without a real provider = fake wire that throws "not implemented" at runtime.

PR-2 closes the gap so the next scheduled capability-wakeup eval can publish a verdict PR (analogous to `eval:a2a` PR #2114 — Phase H pipeline's first real production output).

## Decisions from 砚砚 R0' (locked, not up for re-debate)

| Q | Decision | Rationale |
|---|----------|-----------|
| Q1: Include provider impl in PR-2 or split to PR-3 | **Include** (real `CapabilityWakeupTrialProviderImpl`) | Fake wire is forbidden — `PUBLISH_VERDICT_SUPPORTED_DOMAINS` adding a domain that throws at runtime violates PR-1a's safety boundary |
| Q2: Provider data source | **A — replay/reclassify via existing chain** (`buildCapabilityTrace` → `evaluateCapabilityWakeupTrace` → `classifyCapabilityWakeupTrials`) | No new durable store; uses session/transcript reader ports already in API |
| Q3: Window selector semantics | **Window edge = `trial.timeSpan.startMs`**; `windowStartMs <= startMs < windowEndMs` | session/invocation timestamp is pre-filter narrowing; final filter on classified trial |
| Q4: trial-ids selector | **Defer** (skeleton kept as future stub; PR-2 only wires window) | trial-ids is "伪精确" without durable trial store; defer until store ships |
| Q5: Domain-aware source refs | **Union via discriminated `kind` field** | a2a `{snapshotName, attributionName}` (kind optional, default a2a for backward compat); capability `{kind: 'capability-wakeup-trial-window', capability, windowStartMs, windowEndMs, sessionIds?, ruleIds?}` |

## Architecture sketch (post 砚砚 R1 design-review corrections)

```
cat (opus47, capability-wakeup eval cat)
  ↓ calls cat_cafe_publish_verdict with sourceRefs={kind:'capability-wakeup-trial-window', sessionIds:[...required], ...}
eval-hub.ts route layer (UNCHANGED dispatch site)
  ├─ opts.verdictGenerators?.[packet.domainId] → single generator (or undefined)
  └─ passes single generator to handlePublishVerdict via deps.generator
publish-verdict.ts handler
  ├─ validates packet + domain + cat allowlist (unchanged)
  ├─ if (!deps.generator) → 501 unsupported_generator (replaces hardcoded eval:a2a check)
  ├─ generator handles ITS OWN source resolution (encapsulation)
  └─ delegates to GitPublisher.publishOnIsolatedWorktree
      └─ stage(worktreeRoot) → generator.execute({packet, sourceRefs, liveRoot, isolatedRoot})
          ├─ a2a-generator-adapter: validateSourceRefsFormat → resolveSourceRefsInRoot → copyFileSync → generateA2aLiveVerdict
          └─ capability-wakeup-generator-adapter (NEW):
              ├─ validateCapabilityWakeupSelector (sessionIds non-empty required)
              ├─ provider.resolve(selector) → ClassifiedCapabilityWakeupTrial[]
              └─ generateCapabilityWakeupLiveVerdict({verdictId, domain, capability, trials, submittedPacket})

CapabilityWakeupTrialProviderImpl (NEW) — replay-based via real existing ports (砚砚 R1 P1):
  Constructor takes: sessionChainStore, transcriptReader, toolEventLog, skillLoadEventLog (all REQUIRED — fail closed if missing).
  resolve(selector) =
    1. ASSERT selector.sessionIds non-empty (PR-2 narrowed: no global window scan; global needs userId/thread enumeration → future PR)
    2. for each sessionId in selector.sessionIds:
       a. session = sessionChainStore.get(sessionId)  // resolves threadId + catId
       b. transcriptEvents = transcriptReader.readEvents(sessionId, session.threadId, session.catId)
       c. toolEvents = toolEventLog.readByThread(session.threadId)
       d. skillEvents = skillLoadEventLog.readBySession(sessionId)
       e. trace = buildCapabilityTrace({sessionId, threadId: session.threadId, catId: session.catId, transcriptEvents, toolEvents})
    3. trials = evaluateCapabilityWakeupTrace(combinedTrace, rulesRegistry.getRules(selector.capability, selector.ruleIds?))
    4. classified = classifyCapabilityWakeupTrials(combinedTrace, trials)
    5. filter: trial.timeSpan.startMs ∈ [windowStartMs, windowEndMs)
    6. return classified trials

capability-wakeup-rules.ts (NEW) — static rule registry (砚砚 R1 P2):
  getRules(capability?, ruleIds?) → CapabilityWakeupRule[]
  - MUST cover all 3 capabilities the normalizer already classifies (else domain instruction mismatch):
    * rich-messaging — 'rich-messaging-long-structured-text' (multi_msg_text_volume_threshold)
    * workspace-navigator — (predicate type TBD by reading normalizer)
    * browser-preview — (predicate type TBD by reading normalizer)
  - Loaded statically (not from disk YAML — confirmed yaml has no rules section, only domain metadata/fixture)
  - Tests CAN mock via constructor injection (rulesRegistry is a port)
```

## File-by-file change list

### Type changes (1 file)
- `publish-verdict/types.ts`:
  - `VerdictSourceRefs` → union (a2a default + capability-wakeup-trial-window variant)
  - `ResolvedSourceRefs` → keep a2a-only (this is generator-internal; capability-wakeup variant doesn't pre-resolve to paths — provider returns trials directly)
  - Update `VerdictGenerator` signature to receive raw `sourceRefs` instead of pre-resolved `ResolvedSourceRefs`, so each adapter handles its own resolution
  - **Breaking change**: a2a adapter signature changes (now receives raw sourceRefs + liveRoot + isolatedRoot, does its own copy)

### Handler refactor (1 file)
- `publish-verdict/publish-verdict.ts`:
  - Remove hardcoded `if (packet.domainId !== 'eval:a2a') return 501`
  - Replace with: `if (!deps.generator) return {status:501, error:'unsupported_generator', detail:'No generator wired for domain ${packet.domainId}'}` (砚砚 R1 P1: keep `deps.generator` single — `eval-hub.ts:311` already does per-domain dispatch via `opts.verdictGenerators?.[domainId]` and passes single generator to handler)
  - Remove a2a-specific source resolution from stage callback (move into a2a adapter)
  - Stage callback becomes domain-agnostic: just calls `generator.execute(...)` with packet + sourceRefs + liveRoot + isolatedRoot

### a2a adapter refactor (1 file)
- `publish-verdict/a2a-generator-adapter.ts`:
  - Encapsulates source resolution: `validateSourceRefsFormat` + `resolveSourceRefsInRoot` + `copyFileSync` into isolated root + call `generateA2aLiveVerdict` with resolved paths
  - Signature update to match new `VerdictGenerator` contract

### NEW: provider impl (1 file)
- `capability-wakeup/capability-wakeup-trial-provider-impl.ts`:
  - `class CapabilityWakeupTrialProviderImpl implements CapabilityWakeupTrialProvider`
  - Constructor takes REQUIRED ports (砚砚 R1 Q5: fail closed, never silent-empty):
    - `sessionChainStore: SessionChainStore` — resolves sessionId → {threadId, catId}
    - `transcriptReader: TranscriptReader`
    - `toolEventLog: ToolEventLog`
    - `skillLoadEventLog: SkillLoadEventLog`
    - `rulesRegistry: CapabilityWakeupRulesRegistry`
  - `resolve(selector)`:
    - **REQUIRES** `selector.sessionIds` non-empty (PR-2 narrowed; global window scan deferred)
    - Per architecture sketch above
  - Throws on validation errors (selector shape pre-validated by adapter, but defensive throw on data integrity / missing session)

### NEW: rules registry (1 file)
- `capability-wakeup/capability-wakeup-rules.ts`:
  - Static rule definitions for **3 capabilities** the normalizer already classifies (砚砚 R1 P2: less = new 501/empty-trial bug class):
    - `rich-messaging` — `rich-messaging-long-structured-text` (multi_msg_text_volume_threshold)
    - `workspace-navigator` — predicate TBD by reading `eval-capability-wakeup-trace-normalizers.ts`
    - `browser-preview` — predicate TBD by reading normalizer
  - `getRules(capability?, ruleIds?)` → filtered rule list
  - Pure data + filter logic; no I/O

### NEW: cw generator adapter (1 file)
- `publish-verdict/capability-wakeup-generator-adapter.ts`:
  - `createCapabilityWakeupGeneratorAdapter(provider, deps)` → `VerdictGenerator`
  - Validates selector (calls PR-1a's `validateCapabilityWakeupSelector`)
  - `provider.resolve(selector)` → trials
  - Calls `generateCapabilityWakeupLiveVerdict({verdictId: packet.id, domain, capability: selector.capability, trials, submittedPacket: packet, harnessFeedbackRoot: isolatedRoot})`
  - Returns `{verdictPath, bundleDir}`

### Instructions update (1 file)
- `eval-cat-invocation.ts`:
  - Add `'eval:capability-wakeup'` to `PUBLISH_VERDICT_SUPPORTED_DOMAINS`
  - Make `PUBLISH_VERDICT_INSTRUCTIONS` domain-aware: per-domain `sourceRefs` shape docs
    - For a2a cats: keep `{snapshotName, attributionName}` text
    - For capability-wakeup cats: `{kind:'capability-wakeup-trial-window', capability, windowStartMs, windowEndMs, sessionIds?, ruleIds?}` text
  - Refactor: split `PUBLISH_VERDICT_INSTRUCTIONS` into common text + per-domain `sourceRefs` section concatenated based on domainId

### Bootstrap update (1 file)
- `packages/api/src/index.ts` (around line 1575):
  - Inject second generator: `verdictGenerators: { 'eval:a2a': createA2aGeneratorAdapter(), 'eval:capability-wakeup': createCapabilityWakeupGeneratorAdapter(provider, deps) }`
  - Wire `CapabilityWakeupTrialProviderImpl` with required ports (need to discover session event reader port — see "Open questions" below)

### Tests (4 files)
- `test/harness-eval/capability-wakeup-trial-provider-impl.test.js`:
  - Mock sessionEventReader returning fixed transcript/tool events
  - Mock rulesRegistry returning fixed rule set
  - Assert provider.resolve returns expected classified trials for window
  - Edge cases: empty window, sessionIds narrowing, ruleIds narrowing, multi-capability filter

- `test/harness-eval/capability-wakeup-rules.test.js`:
  - getRules with no filter returns full registry
  - getRules with capability filter returns matching rules only
  - getRules with ruleIds filter returns specified rules only
  - getRules with non-existent capability/ruleId returns empty (no throw)

- `test/harness-eval/capability-wakeup-generator-adapter.test.js`:
  - Mock provider returning fixed trials
  - Adapter calls `generateCapabilityWakeupLiveVerdict` with correct args (including submittedPacket pass-through)
  - Selector validation errors propagate from PR-1a's `validateCapabilityWakeupSelector`
  - Adapter passes packet.id as verdictId (not new id)

- `test/harness-eval/publish-verdict-capability-wakeup.test.js`:
  - End-to-end: handler accepts capability-wakeup domain, dispatches to cw adapter, returns verdict path + PR url (mock GitPublisher)
  - Schema rejection: a2a sourceRefs shape sent with capability-wakeup domain → 400
  - Unsupported generator (e.g. eval:memory still 501) — confirms refactor preserves the "no generator → 501" semantic
  - MCP tool schema: union type for sourceRefs validates both shapes

## Open questions — RESOLVED (砚砚 R1 design-review answers, 2026-06-06)

1. **Session event reader port** ✅ — Use `SessionChainStore.get(sessionId)` + `TranscriptReader.readEvents(sessionId, threadId, catId)` + `ToolEventLog.readByThread` + `SkillLoadEventLog.readBySession`. PR-2 scope narrowed: `sessionIds` REQUIRED non-empty (no global window scan — that needs userId/thread enumeration, separate PR).

2. **Domain registry yaml** ✅ — `eval-capability-wakeup.yaml` has NO rules section, only domain metadata + fixture. Rules go in code-defined static registry (`capability-wakeup-rules.ts`).

3. **MCP tool schema** ✅ — Use Zod `z.union`, capability branch MUST have `kind: 'capability-wakeup-trial-window'` literal; a2a branch keeps `{snapshotName?, attributionName?}` for backward compat.

4. **Idempotency** ✅ — Same `(domain, capability, window)` with different `packet.id` should both succeed. `packet.id` is the artifact uniqueness key (handler enforces).

5. **Bootstrap timing** ✅ — Eager construction is fine; the required ports (`sessionChainStore` / `transcriptReader` / `toolEventLog` / `skillLoadEventLog`) are all created BEFORE `evalHubRoutes` registers. **HARD REQUIREMENT**: if any port missing → fail closed (constructor throws), NEVER silent-empty-array (would manufacture fake misses that look like real signal).

## Test strategy (TDD order)

1. **Red**: write `capability-wakeup-rules.test.js` (simplest, no dependencies)
2. **Green**: implement `capability-wakeup-rules.ts`
3. **Red**: write `capability-wakeup-trial-provider-impl.test.js` (depends on rules)
4. **Green**: implement provider with port mocks
5. **Red**: write `capability-wakeup-generator-adapter.test.js`
6. **Green**: implement adapter
7. **Red**: write type changes' regression — existing a2a tests should keep passing
8. **Refactor**: VerdictSourceRefs → union; update a2a adapter to match new signature
9. **Red**: write `publish-verdict-capability-wakeup.test.js` end-to-end
10. **Green**: refactor publish-verdict.ts handler (remove hardcoded check, add dispatch)
11. **Refactor**: PUBLISH_VERDICT_INSTRUCTIONS becomes domain-aware
12. **Wire**: bootstrap injection in index.ts
13. **Full gate**

## Size estimate

- New files: ~4 (provider impl, rules, cw adapter, end-to-end test)
- Modified files: ~5 (types, handler, a2a adapter, instructions, bootstrap)
- Test files: ~4 new
- Total LoC: ~400-500 added, ~50 modified
- All files must stay ≤350 lines (AGENTS.md limit) — be ready to split helpers if hit

## Out of scope (defer to follow-up)

- Real `assertCanCrossThreadHandoff` call in submittedPacket path for **both** capability-wakeup and a2a (same gap, cross-cutting) — noted in PR-1a commit message; separate refactor
- Trial-id selector real impl (needs durable trial store) — kept as skeleton
- More classification rules beyond current test fixtures — add as production usage uncovers patterns
- Eval Hub UI showing capability-wakeup verdicts in a separate tab — should "just work" via existing render path; verify in alpha

## Sign-off

✅ Design locked by 砚砚 R0' (PR-1a narrowing) + 砚砚 R1 design-review (this memo, 2026-06-06):
> "改完 memo 后可以直接实现，不需要再拉我做第二轮设计审。"

Ready for TDD implementation (next session — defer per 5 AM PT 凌晨 + 22-round review fatigue + 8-file refactor risk).

[宪宪/Opus-47🐾]
