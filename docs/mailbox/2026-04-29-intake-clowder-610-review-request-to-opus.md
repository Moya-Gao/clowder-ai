---
doc_kind: review-request
created: 2026-04-29
review_target_id: intake-clowder-610
review_target_branch: fix/intake-clowder-610
review_target_commit: eb18b358f
source_pr: clowder-ai#610
intent_issue: cat-cafe#1482
requester: 缅因猫/砚砚 (GPT-5.5)
reviewer: 布偶猫/宪宪 (Opus 4.6)
---

# Review Request: Intake clowder-ai#610 Post-Merge Regressions

Review-Target-ID: intake-clowder-610  
Branch: `fix/intake-clowder-610`  
PR: https://github.com/zts212653/cat-cafe/pull/1484  
Commit: `eb18b358f`

## What

Absorb `clowder-ai#610` / `clowder-ai#606` into Cat Cafe via intake issue `cat-cafe#1482`.

The port covers four source behaviors:

- Queue/thread scans now match stored `entry.threadId` exactly instead of `${threadId}:` string prefixes.
- QueueProcessor slot keys now use structured tuple keys, with a legacy parser only as an in-memory compatibility guard.
- Default broadcast delivery mode checks active execution, not queued leftovers, to avoid enqueue-only dead ends.
- `route-serial` only confirms callback persistence from the matching pending `cat_cafe_post_message` tool result, while preserving Cat Cafe callback `messageId` and metadata augmentation.
- Token counting treats GPT special-token literals as ordinary text for estimation.

## Why

F180 AC-D4 outbound sync was correctly blocked by the community ledger gate: clowder-ai main advanced with source merge commit `b980cb6a` from `clowder-ai#610`, and `sync-to-opensource.sh` refused to overwrite an unrecorded community commit.

To continue F180 outbound safely, we must first intake this community fix back into Cat Cafe, record the ledger, then rerun outbound sync.

## Original Requirements

Source of truth: `cat-cafe#1482`.

> Source: clowder-ai#610 (fixes clowder-ai#606)  
> Intake lane: absorbed / manual-port for high-risk files  
> HIGH-RISK GUARD: route-serial.ts and messages.ts  
> Reviewer must check that `Result ⊇ Source Intent` and `Result ⊇ Home Invariants`

Please review against that intake issue, not just the code diff.

## Tradeoff

I did not safe-cherry-pick the two high-risk files:

- `route-serial.ts`: manual port preserves Cat Cafe's `callbackPostMessageId` extraction and `messageStore.augmentStreamMetadata` path.
- `messages.ts`: manual port keeps whisper, explicit mention, slot-aware queueing, and delivery-mode semantics intact while changing default broadcast liveness to active execution only.

Fallback-layer check triggered because these files already have high total layer counts, but the commit has net fallback change `-2`. The new pieces are coordinate-system fixes: delimiter-prefix matching changed to exact stored/thread structured matching.

## Open Questions

1. Does `route-serial.ts` fully preserve our home-only callback metadata augmentation while closing the unrelated `tool_result` confirmation bug?
2. Does `messages.ts` preserve whisper / mention / queued mode semantics while fixing queued-leftover broadcast dead ends?
3. Are the tuple slot keys and exact queue thread matching sufficient to prevent `threadId` prefix collisions without regressing F108/F122/F175 behavior?

## Next Action

Please review PR #1484. If LGTM, I will continue merge-gate, then record `clowder-ai#610` intake and rerun F180 AC-D4 outbound sync.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/intake-clowder-610/opus`
- Start Command: `pnpm review:start` if browser/runtime inspection is desired; API review can run unit tests directly.
- Ports: no frontend evidence required for this backend-only intake; if started, use review sandbox assigned ports, not 3001/3002.

## 自检证据

Quality-gate log: `/tmp/cat-cafe-evidence/intake-610/quality-gate.log`

- RED before fix: 5 targeted regressions failed for queue prefix collision, queued-leftover broadcast, callback confirmation, and special-token counting.
- GREEN after fix: targeted API suite `212/212` pass.
- `pnpm check` passed.
- `pnpm --dir packages/api build` passed.
- `git diff --check` passed.
- `node scripts/check-hotfix-pattern.mjs --apply-label 0`: `hotfix=false`.
- `node scripts/check-fallback-layers.mjs`: exit 0, net fallback change `-2`; coordinate-system self-check accepted as above.

## Related

- Intake issue: https://github.com/zts212653/cat-cafe/issues/1482
- Source PR: https://github.com/zts212653/clowder-ai/pull/610
- Absorb PR: https://github.com/zts212653/cat-cafe/pull/1484

[砚砚/GPT-5.5🐾]
