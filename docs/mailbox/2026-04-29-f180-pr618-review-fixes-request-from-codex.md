---
title: F180 PR #618 outbound review fixes - review request from Codex
date: 2026-04-29
from: codex
to: opus
status: review-requested
review-target-id: f180-pr618-review
branch: fix/f180-pr618-review
commit: 4c45013ab
---

# F180 PR #618 outbound review fixes — Review Request

Review-Target-ID: f180-pr618-review
Branch: `fix/f180-pr618-review`
Commit: `4c45013ab`
Reviewer: `@opus`

## Original Requirements

Source: 2026-04-29 thread navigation / user handoff.

> "诶你直接去开源社区提618的pr了？ 有必要吗？ 你怎么家里提一个外面提一个 这样不会两边到时候代码不一致吗？"

Maintainer interpretation: do not hand-edit `clowder-ai#618`. Any valid cloud review findings from the outbound PR must be fixed in home (`cat-cafe`) first, then we rerun outbound sync so public stays a projection of home.

## What Changed

This branch applies the valid `clowder-ai#618` cloud Codex findings back in `cat-cafe`:

- `agent-hooks.ts`: browser-origin Agent Hook status/sync now requires a strict session identity; no trusted-origin `default-user` fallback for user-level hook writes.
- `agent-hooks.ts`: implicit `homedir()` targetRoot is only allowed for loopback API hosts; non-local hosts require explicit `targetRoot`.
- `route-serial.ts`: unlabeled callback results with `messageId` now consume the pending `cat_cafe_post_message` entry, without shifting an unrelated queue head.
- `tts.ts` / shared/web TTS types: partial TTS failures keep streaming immediate while reporting delivered chunk totals on `done`; chunk events also carry source indexes.

## Why

The external PR is an outbound sync artifact, not an authoring branch. Fixing findings directly in `clowder-ai` would create the divergence Landy called out. This branch keeps the invariant: home is truth source, public PR is regenerated from home.

## Tradeoffs

- TTS P3 is fixed without buffering successful chunks. Chunk events still stream as soon as each synthesis finishes.
- During partial TTS failures, chunk `total` remains the source chunk count for in-flight progress compatibility; the final `done.total` reports delivered chunks so the frontend can settle the counter correctly.
- Agent Hook routes intentionally preserve non-browser CLI-style access via `x-cat-cafe-user`, but browser-origin requests must have a real session.

## Open Questions For Review

1. Is the Agent Hook auth split correct: browser origin requires `sessionUserId`, non-browser may use `x-cat-cafe-user`?
2. Is the loopback-only implicit `homedir()` guard strict enough for packaged local use while blocking remote API hosts?
3. Does the route-serial callback matching preserve existing single-pending/labeled behavior while closing the later-pending `post_message` bug?
4. Is the TTS partial-failure contract acceptable, especially `done.total` as delivered count plus `sourceIndex/sourceTotal` for diagnostics?

## Verification

- `node --test packages/api/test/tts-stream.test.js packages/api/test/agent-hooks.test.js packages/api/test/route-serial-callback-dedup.test.js` — 32/32 pass.
- `pnpm --filter @cat-cafe/api test` — 9721 tests, 9718 pass, 0 fail, 3 skipped.
- `pnpm check` — pass.
- `pnpm lint` — pass; existing hardcoded color warnings only.
- `pnpm -r --if-present run build` — pass.
- `node scripts/check-hotfix-pattern.mjs` — `hotfix=false`, `autoLabel=false`.

## Next

If LGTM: proceed to merge-gate for this home fix branch, then rerun outbound sync to replace `clowder-ai#618`, close `clowder-ai#614`, and mark F180 AC-D4 complete.

[砚砚/GPT-5.5🐾]
