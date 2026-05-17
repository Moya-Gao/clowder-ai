---
date: 2026-05-17
from: codex
to: opus47
review-target-id: f194-z11-live-dedupe
branch: fix/f194-z11-live-dedupe
head: 4f48bbd84
status: review-request
---

# F194 Z11 Live Dedupe Review Request

## Original Requirements

Source: runtime thread report, 2026-05-17.

> "如果猫猫发送了 post msg 然后期望行为 post msg 自己单独气泡。然后其他的消息就是正常的 Thinking expand CLI Output (tools) + cli原本的消息。"
> "CLI Output 无论有没有这个 post msg 行为要保持一致。"
> "应该就是你们这个线程改坏的，很像是之前为了保留 cli output 导致的？你定位看看。"

## Architecture Ownership

- Architecture cell: F194 canonical bubble projection / live-hydrate read model.
- Map delta: none. This is a local refinement of the existing projection grouping contract.
- Why: Z11 v1 preserved CLI stdout by keeping stream and post_msg in one projected bubble. The product contract is narrower: exact-key callback finals can merge with stream work logs, but ordinary MCP `post_message` callback records with their own message id are independent speech bubbles.

## Change Summary

- `projectCanonicalBubbles` now groups by `originBucket` in addition to `(catId, invocation key)`.
- Stream records remain in the stream bucket.
- Callback records with an id that exactly matches a stream record under the same base key remain terminal updates for the stream bucket.
- Callback records with their own distinct id are post_msg speech and project as a separate callback bucket.
- `ChatMessage` keeps using `extra.stream.cliStdout` for exact-key merged cases and `speechContent` for body text, without merging ordinary post_msg back into the stream bubble.
- F194 spec AC-Z27 / AC-Z30 updated to document the refined contract.

## Self-Check Evidence

- Targeted projection/hooks/hydration regression:
  - `NODE_ENV=test pnpm --dir packages/web exec vitest run src/hooks/__tests__/useAgentMessages-active-text-reducer-wire.test.ts src/hooks/__tests__/useAgentMessages-background.test.ts src/hooks/__tests__/useAgentMessages-catchup-ref-desync.test.ts src/hooks/__tests__/useChatHistory-replace-hydration.test.ts src/stores/__tests__/bubble-projection-z9-replay.test.ts src/stores/__tests__/bubble-projection-alpha-replay.test.ts src/hooks/__tests__/useAgentMessages-z8-dual-id-callback.test.ts src/stores/__tests__/bubble-projection-z11-cli-stdout.test.ts src/stores/__tests__/bubble-projection.test.ts`
  - Result: 9 files / 135 tests passed.
- Full related web suite:
  - `NODE_ENV=test pnpm --dir packages/web exec vitest run src/stores src/hooks src/components`
  - Result: 371 files / 2713 tests passed.
- Typecheck:
  - `pnpm --dir packages/web exec tsc --noEmit`
  - Result: pass.
- Gate:
  - `env -u NODE_ENV NPM_CONFIG_PRODUCTION=false pnpm gate`
  - Result: GATE PASSED at `4f48bbd84`.

## Review Focus

1. Does the exact-key callback exception preserve Z8 terminal-callback behavior without re-merging ordinary post_msg speech?
2. Do live writer and hydrate remain equivalent now that projection group keys include origin bucket?
3. Are the rewritten Z8/Z9 tests enforcing the product semantics instead of hiding a regression?
4. Is the `ChatMessage` rendering path still compatible with pure stream, pure callback, exact-key callback final, and ordinary post_msg cases?

## Open Questions

None for CVO. The user explicitly chose the "post_msg separate bubble, CLI output remains consistent" semantics.
