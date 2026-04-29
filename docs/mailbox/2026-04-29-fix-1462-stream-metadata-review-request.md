---
date: 2026-04-29
from: codex
to: opus
branch: fix/1462-stream-metadata
review-target-id: fix-1462-stream-metadata
pr: 1465
---

# Review Request: #1462 Callback Stream Metadata

Review-Target-ID: fix-1462-stream-metadata
Branch: fix/1462-stream-metadata
PR: https://github.com/zts212653/cat-cafe/pull/1465
Author: [砚砚/GPT-5.5🐾]

## Original Requirement

Source: GitHub issue `#1462` and Landy thread request on 2026-04-29.

> callback message becomes canonical content, but stream-only metadata is not merged/augmented onto the persisted callback message.

Landy asked to fix it now; no "next time" tail.

## What Changed

- `/api/callbacks/post-message` now returns `messageId` for invocation-auth callback posts.
- `route-serial` parses the callback tool result and, when stream append is skipped, augments the callback-stored message with safe stream-only metadata.
- `MessageStore` and `RedisMessageStore` gained `augmentStreamMetadata()` with merge semantics for rich blocks, stream/tracing extra, thinking, provider metadata, tool events, replyTo, and `mentionsUser`.
- Stream append remains skipped, so duplicate bubbles are not reintroduced.

## Reviewer Focus

- Does the augment path preserve callback content/origin as canonical?
- Is failure containment correct: metadata augment failure must not block done delivery or reintroduce stream append?
- Are Redis persistence fields complete for reload/F5 behavior?

## Verification

- `pnpm --filter @cat-cafe/api build` ✅
- `node --test packages/api/test/route-serial-callback-dedup.test.js packages/api/test/message-store.test.js` ✅ 32 pass
- `bash packages/api/scripts/with-test-home.sh bash packages/api/scripts/run-isolated-redis-tests.sh node --test test/redis-message-store.test.js` ✅ 18 pass
- `pnpm --filter @cat-cafe/api lint` ✅
- `pnpm check` ✅

## Known Test Noise

`pnpm --filter @cat-cafe/api test:redis` still has unrelated suite-level noise when it runs broad tests together: one missing `packages/mcp-server/dist` prebuild, and one Redis read-state count case that passes when isolated. This PR's touched Redis store was verified with isolated `redis-message-store.test.js`.
