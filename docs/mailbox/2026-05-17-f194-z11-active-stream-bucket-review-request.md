# Review Request: F194 Z11 live active stream bucket

Review-Target-ID: f194-z11-active-stream-bucket
Branch: `fix/f194-z11-active-stream-bucket`
SHA: `1112641d4`

## What

Fix the live-only Z11 follow-up where incoming active stream/tool events can recover a same-turn `origin=callback` post_msg bubble and append CLI/tool rows into it.

Changed:
- `useAgentMessages.findRecoverableAssistantMessage(...)` now supports `requireStreamOrigin`.
- `getOrRecoverActiveAssistantMessageId(... ensureStreaming=true)` treats an active callback bubble as stale and only recovers stream-origin bubbles.
- Added a RED test proving same parent+turn callback bubble + incoming `tool_use` creates a separate stream bubble, not an append into the callback bubble.
- Updated F194 Phase Z11 spec/timeline with the live recovery edge.

## Why

铲屎官 gave concrete runtime evidence in `thread_motr8u5i1dtjigtd`: Opus post_msg callback bubble is correctly separate, but while the next live tool event is still streaming, recovery reuses that callback bubble as the stream container. The result is visually wrong: callback speech renders above CLI Output, and tool rows appear inside the post_msg bubble.

This is not the pure projection bug fixed by Z11 v2. It is the active live recovery path still using same stable key without respecting the stream/callback bucket boundary.

## Original Requirements

> "第一张 布偶猫 thread_motr8u5i1dtjigtd 在这个线程 是最新的一个invocation 你可以看看"
> "有点有意思 46这里是先把自己的话cli output -> tool call"
> "按道理应该是 tool call -> cli output 这个是故意的吗？你能不能看到第二张你自己的行为，就是tools -> 然后具体的output"

- 来源：runtime thread handoff, 2026-05-17
- 请对照上面的摘录判断：post_msg speech must stay its own callback bubble; live stream/tool work-log must stay in the stream bubble with normal CLI Output order.

## Tradeoff

I did not change `projectCanonicalBubbles` again. The projection contract from Z11 v2 is still the right coordinate system for hydrate/batch data.

The fix is scoped to live active stream recovery:
- `ensureStreaming=true` means the caller is building or continuing a stream/tool container, so callback bubbles are invalid recovery targets.
- Terminal/done/replacement fallback paths do not pass `requireStreamOrigin`, preserving exact-key `callback_final` compatibility and legacy hydration recovery.
- `origin` missing is still accepted for legacy messages; only explicit non-stream origin is rejected.

## Architecture Ownership

Architecture cell: `bubble-pipeline`
Map delta: none
Why: This changes recovery target selection inside the existing live bubble writer; it does not introduce a new store, router, adapter, dispatcher, or binding.

Please check:
- diff matches `Map delta: none`
- no parallel `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- active stream recovery is the right boundary, not another projection rewrite

## Open Questions

### 技术 OQ（给 reviewer）

1. Does `requireStreamOrigin` need to apply only to `ensureStreaming=true`, or should any explicit stream/tool event path pass it more directly?
2. Does accepting missing `origin` as legacy-compatible preserve old hydration tests without reopening the callback-bubble append bug?
3. Is treating `found.origin === 'callback'` as stale in the active ref path narrow enough, or should it additionally require `ensureStreaming=true` plus an incoming tool/text type? Current implementation uses only `ensureStreaming=true`.

### 价值 OQ（给 CVO）

无。

## Next Action

Please quick-review the branch. If LGTM, hand back to me for fast merge gate.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f194-z11-active-stream-bucket/opus47`
- Start Command: `pnpm review:start`（或等价 read-only review command）
- Ports: not required for this code review unless you choose to run a UI sandbox; do not use 3001/3002/3011/3012/4111.

## 自检证据

### Spec 合规

- F194 AC-Z30 updated with the 2026-05-17 live recovery edge.
- Timeline updated with `Z11 live active recovery follow-up`.
- Artifact hygiene: no root media/design artifacts in working tree or committed diff.
- Architecture ownership: `pnpm check:architecture-ownership` exits 0; warnings are pre-existing global doc warnings, diff architecture noun scan OK.
- F177 fallback check: script exits 0; it flags existing total-layer count in `useAgentMessages.ts`, but net fallback change is `+0`. Coordinate self-check: this repairs the bucket coordinate (stream vs callback) rather than adding another fallback layer.

### 测试结果

```text
NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run src/hooks/__tests__/useAgentMessages-placeholder-recovery.test.ts -t "does not reuse"
→ 1/1 pass (RED before fix)

NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run src/hooks/__tests__/useAgentMessages-placeholder-recovery.test.ts
→ 9/9 pass

NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run \
  src/hooks/__tests__/useAgentMessages-placeholder-recovery.test.ts \
  src/hooks/__tests__/useAgentMessages-bubble-merge.test.ts \
  src/hooks/__tests__/useAgentMessages-z8-dual-id-callback.test.ts \
  src/stores/__tests__/bubble-projection-z11-cli-stdout.test.ts
→ 59/59 pass

NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run src/hooks
→ 80 files / 683 tests pass

NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run src/hooks src/stores src/components
→ 372 files / 2725 tests pass

pnpm check
→ exit 0

pnpm --filter @cat-cafe/web run build
→ exit 0 (pre-existing hardcoded-color warnings only)
```

### 相关文档

- Feature: `docs/features/F194-invocation-liveness-canonical-read-model.md`
- Runtime evidence: `thread_motr8u5i1dtjigtd`

