---
feature: F194
topics: [review-request, live-bubble-split, stream-residue, codex]
doc_kind: review-request
created: 2026-06-18
---

# Review Request: F194 R19 contentful stream residue live split

Review-Target-ID: f194-live-split-r19
Branch: fix/f194-live-split-r19
Author HEAD: `d7981721a`

## What

R19 fixes a live-only Codex bubble split after #2349/#2363 had already shipped.

Changed:
- `packages/web/src/hooks/useChatHistory.ts`
  - expands the terminal stream residue drop guard from tool-only ghosts to persisted-evidence-covered ghosts.
  - contentful local `msg-*` residue is dropped only when same-parent persisted history already covers the text and tool evidence.
  - callback / explicit post / contentBlocks / rich blocks remain protected.
- `packages/web/src/hooks/__tests__/mergeReplaceHydrationMessages-stream-residue-drop.test.ts`
  - adds the R19 red test for contentful residue covered by same-parent persisted text + tool evidence.
- `docs/bug-report/2026-06-16-codex-live-bubble-split-race/README.md`
  - records R19 root cause and boundary vs R18.
- `docs/features/F194-invocation-liveness-canonical-read-model.md`
  - adds a Timeline row for this post-close R19 fix.

## Why

Runtime proof showed this was not an old-code problem:
- `cat-cafe-runtime` already contained #2349 (`96e39f867`) and #2363 (`a8198a221`).
- Screenshot showed two live assistant stream bubbles in thread `thread_mqkivws1k5e07s6k`.
- `/api/messages?threadId=thread_mqkivws1k5e07s6k` returned one authoritative persisted stream for the relevant Codex turn: parent `b3f2a25e...`, turn `7386eb91...`, content + 14 tool events.

The old #2319 guard intentionally preserved contentful wrong-key residue to avoid deleting partial text. R19 proves that rule is too broad once same-parent persisted history already contains the text and tool evidence: keeping the local residue creates the second CLI/work-log bubble until refresh.

## Original Requirements

> "@codex 你还是裂开的，打算咋办"
> Screenshot path: `/Users/lysander/projects/relay-station/cat-cafe-runtime/packages/api/uploads/1781850207627-1483ded7.png`

- Source: current Cat Cafe thread, 2026-06-18 23:23 America/Los_Angeles.
- Please judge the change against the actual complaint: do not accept "unit tests passed earlier" as sufficient; the fix must address the live split that self-heals after refresh.

## Tradeoff

Rejected: "drop all contentful wrong-key residue".

Reason: that would regress the existing preserve boundary for persistence lag / partial text, where local content has not yet been covered by persisted history.

Chosen: drop contentful residue only with same-parent persisted evidence:
- text evidence: normalized persisted sibling text includes normalized residue text.
- tool evidence: persisted sibling tool events cover residue tool evidence by stable payload multiset.
- both text and tools present means both proofs are required.

## Architecture Ownership

Architecture cell: F194 web message hydration / live projection (`useChatHistory.ts` + stream residue reconcile)
Map delta: none
Why: this extends the existing `mergeReplaceHydrationMessages` residue guard; it does not add a new Store / Queue / Router / Adapter / Dispatcher / Binding.

Reviewer checks requested:
- Confirm `Map delta: none` matches the diff.
- Confirm this is still inside the existing F194 hydration/live reconciliation boundary.
- Confirm the new proof gates do not turn into a broad "delete local text" heuristic.

## Open Questions

### Technical OQ

1. Is `hasPersistedTextResidueSiblingEvidence` narrow enough?
   - It requires same `catId`, same parent invocation, persisted sibling id not `msg-*`/`draft-*`, no explicit post, and no user/A2A/other-cat boundary crossing.
2. Is normalized substring coverage acceptable for text?
   - It intentionally covers the R19 live catch where the ghost bubble holds a subset of the final persisted answer. It does not drop if there is no persisted text coverage.
3. Does the combined text+tool rule preserve #2319's persistence-lag safety?
   - A residue with text and tool events is dropped only when both text and tool evidence are covered.
4. Does this guard leave callback / explicit-post no-swallow intact?
   - The code still only handles `origin === 'stream'`, and rejects explicit posts / contentBlocks / rich blocks.

### Value OQ

None. This is a reversible, narrow bugfix in the existing F194 reconciliation surface.

## Next Action

Please do cross-individual review of branch `fix/f194-live-split-r19` at HEAD `d7981721a`.

Expected verdict:
- APPROVE-equivalent if the residue guard is narrow and tests cover the R19 boundary.
- REQUEST-CHANGES if this can drop legitimate partial text or cross an explicit-post/callback boundary.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f194-live-split-r19/sonnet`
- Start Command: `pnpm review:start` if browser/runtime review is desired.
- Ports: not started by author. This patch is hook-level; primary review can run tests without starting web/api. If reviewer starts sandbox, use `pnpm review:start` assigned ports, not 3001/3002/3011/3012/4111.

## Quality Gate Report

Spec: `docs/features/F194-invocation-liveness-canonical-read-model.md`
Bug report: `docs/bug-report/2026-06-16-codex-live-bubble-split-race/README.md`
检查时间: 2026-06-18 23:38 America/Los_Angeles

### Vision / Requirement Coverage

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Fix the still-splitting Codex live bubble, not just restate previous unit pass. | ✅ | R19 live catch recorded; `/api/messages` single-persisted-stream proof; new red test for contentful covered residue. |
| 2 | Avoid regressing partial text preservation. | ✅ | Existing preserve test still green; new guard requires persisted text coverage before dropping contentful residue. |
| 3 | Keep callback / explicit-post no-swallow boundary. | ✅ | Guard remains stream-origin only and rejects explicit posts / contentBlocks / rich blocks; existing F194 focused suite green. |

### Functionality

| # | Requirement | Code | Test |
|---|---|---|---|
| 1 | Drop contentful terminal wrong-key stream residue only when persisted same-parent sibling covers it. | `packages/web/src/hooks/useChatHistory.ts` | `mergeReplaceHydrationMessages-stream-residue-drop.test.ts` new R19 case |
| 2 | Preserve contentful wrong-key residue when it may be partial / not persisted. | `packages/web/src/hooks/useChatHistory.ts` | existing `mergeReplaceHydrationMessages-stream-residue-preserve.test.ts` |
| 3 | Keep R17/R18 dual-path and ledger lifecycle regressions green. | unchanged surrounding hooks | 9-file F194 focused group |

### Dogfood-Your-Slice

Scope verdict: partial dogfood.

Live E2E with a fresh 4+ tool Codex response was not re-run in this turn because the bug is race/live-window dependent and the author did not restart runtime or force a new long Codex run. Instead, the fix is anchored to the live screenshot + persisted API truth for the exact runtime thread and encoded as a deterministic red test.

Reviewer should treat this as a known dogfood gap and decide whether deterministic fixture coverage is enough before merge-gate, or whether to require a live alpha/runtime replay after merge.

### Artifact Hygiene

- Worktree root media/design artifact check: no output ✅
- `origin/main...HEAD` root media/design artifact check: no output ✅

### Fallback Layer Check

Command:

```bash
node scripts/check-fallback-layers.mjs
```

Result:

```text
packages/web/src/hooks/useChatHistory.ts: +2 -0 (net +2) [total=85]
Coordinate-system self-check triggered because the file already has >=5 total layers.
```

Self-check:
- Repairing coordinate system or patching wrong one? Repairing within the existing F194 hydration/live residue coordinate system. The split appears when live/catch-up merge sees a local-only wrong-key residue after persisted history has already covered it.
- Could a coordinate transform eliminate these layers? The broader transform would be to eliminate wrong-key local residue earlier in live identity, but R17/R18 already cover turn/ledger identity and runtime proof shows persisted API is clean. The remaining boundary is merge-time evidence reconciliation.
- Why each added layer cannot be removed:
  - `!catId || !parentInvocationId || !residueText`: prevents cross-cat / parentless / empty text proof from deleting local text.
  - `historyMsg.id.startsWith('msg-') || historyMsg.id.startsWith('draft-')`: text evidence must come from persisted authoritative history, not another local residue/draft.

### Architecture Ownership

Architecture cell: F194 web message hydration / live projection
Map delta: none
Why: existing `mergeReplaceHydrationMessages` residue guard extension; no new architectural component.

Mechanical command note:

```bash
pnpm check:architecture-ownership
```

returned command not found in this repo (`ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL`). Treat semantic architecture review as part of peer review.

### Verification Commands

```bash
pnpm --filter web exec vitest run \
  src/hooks/__tests__/useAgentMessages-codex-dual-path-thread-switch.test.ts \
  src/hooks/__tests__/useAgentMessages-codex-tool-text-background.test.ts \
  src/hooks/__tests__/mergeReplaceHydrationMessages-stream-residue-drop.test.ts \
  src/hooks/__tests__/mergeReplaceHydrationMessages-stream-residue-preserve.test.ts \
  src/hooks/__tests__/useAgentMessages-codex-tool-text-active-basic.test.ts \
  src/hooks/__tests__/useAgentMessages-codex-tool-text-active-residue.test.ts \
  src/hooks/__tests__/thread-runtime-ledger.test.ts \
  src/hooks/__tests__/thread-runtime-singleton.test.ts \
  src/hooks/__tests__/useAgentMessages-background-thread-switch.test.ts
```

Result: 9 files / 94 tests passed ✅

```bash
pnpm --filter web exec tsc --noEmit
```

Result: exit 0 ✅

```bash
git diff --check
```

Result: exit 0 ✅

### Not Yet Run

- `pnpm gate` full merge gate. This is intentionally deferred until peer review approval, per merge-gate SOP.
- Browser/runtime live replay. See Dogfood section.

[砚砚/GPT-5.5🐾]
