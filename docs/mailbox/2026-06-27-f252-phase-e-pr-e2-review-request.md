---
feature_ids: [F252]
topics: [story-player, bullet-time, heatmap, review]
doc_kind: mailbox
created: 2026-06-27
---

# Review Request: F252 Phase E PR E-2 — Bullet Time + Heatmap + Sunset

Review-Target-ID: f252-e2
Branch: feat/f252-phase-e-pr-e2

## What

Single-thread replay enhancements for Meow Theater:

1. **Bullet Time Easing** (AC-E4 partial): 3-phase smooth speed curve replacing step-function `PASS_BALL_SLOWDOWN_FACTOR`. Decelerate (400ms) → hold at MIN_SPEED_FACTOR=0.01 (1000ms) → accelerate back (600ms). Total 2000ms. Pure function + engine integration.

2. **Event Density Heatmap** (AC-E7 partial): `computeEventDensity()` buckets events across timeline, normalized to [0,1]. `EventDensityBar` renders semi-transparent bars behind progress track — accent-colored for past/current, muted for future. Wired through `useThreadReplay` → `ReplayControls` → `TheaterReplayContent`.

3. **Session Page Sunset** (AC-E1 completion): Standalone `/story/[storyId]` session replay view replaced with 20-line deprecation notice. 360→92 lines. All dead imports removed.

**14 files changed, +889/-315 lines, 7 commits.**

## Why

PR E-1 landed the core Theater Overlay + Hub-native rendering. PR E-2 adds the single-thread cinematic enhancements (smooth bullet time, visual density) and completes the sunset of the old standalone page. These are self-contained within the existing `web/story-player` module — no multi-thread layout needed.

PR E-3 (next) handles multi-thread expansion: Spotlight/Dim, Multi-cam, Guest Cameo.

## Original Requirements（必填）

> "传球事件触发子弹时间降速 100x→1x→0.5x" — AC-E4
> "进度条背景融合事件密度的微型热力图，哪里有猫猫大混战一目了然" — AC-E7
> "Story Player 不再是独立 `/story/[storyId]` 页面，改为 Hub Theater Overlay" — AC-E1
> "100% 看起来就是你们平时的样子加特效和快进" — 视觉铁律

- 来源：`docs/features/F252-story-player.md` Phase E section (lines 303-391)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Arc animation for causal particle beam deferred to PR E-3 (needs multi-thread target)
- F233 milestone badges on timeline deferred to PR E-3 (needs feature-level replay context)
- Bullet time uses CSS transitions only, no Canvas/WebGL

## Architecture Ownership（必填）

Architecture cell: `web/story-player` (existing)
Map delta: none
Why: All changes within existing story-player module — no new stores/routers/adapters

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 Store / Queue / Router / Adapter / Dispatcher / Binding
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **Bullet time invariant coverage**: 5 invariants (INV-1 through INV-5) in `bullet-time-engine.test.ts`. Are adversarial scenarios (pass-ball at last event, consecutive pass-balls, pause during bullet time) sufficient?

2. **Event density edge cases**: `computeEventDensity()` handles empty/single events, zero span, unsorted input. Any missing edge case?

3. **Deprecated constant**: `PASS_BALL_SLOWDOWN_FACTOR` marked `@deprecated` but not removed (still referenced in old adaptive-engine tests as documentation). Should it be fully removed?

### 价值 OQ（给 CVO，如有）

无 — 所有决策在 AC 范围内，回滚成本低（单 PR revert）。

## Next Action

请 review 代码质量 + AC 覆盖度。涉及前端组件（EventDensityBar），请在 review sandbox 中实测。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f252-e2/gpt52`
- Start Command: `pnpm review:start`
- Ports: 按 `pnpm review:start` 自动分配（3201/3202 起）

### 沙盒 Bootstrap

```bash
unset NODE_ENV
pnpm install --frozen-lockfile
pnpm --filter @cat-cafe/shared build
```

## 自检证据

### Spec 合规

| AC | 状态 | 证据 |
|----|------|------|
| AC-E4 (partial: speed curve) | ✅ | 14 easing tests + 12 engine integration tests, all GREEN |
| AC-E7 (partial: density heatmap) | ✅ | 11 density computation tests, EventDensityBar component renders |
| AC-E1 (session page sunset) | ✅ | `/story/[storyId]` session route → deprecation notice, 360→92 lines |

### 测试结果

```bash
unset NODE_ENV
pnpm install --frozen-lockfile
pnpm --filter @cat-cafe/shared build

# Story-player targeted tests
pnpm --filter @cat-cafe/web test -- --run packages/web/src/lib/story-player/
# 208 passed, 0 failed

# Full web test suite
pnpm --filter @cat-cafe/web test
# 4832 passed, 0 failed

# Biome lint (PR scope)
pnpm biome check packages/web/src/lib/story-player/ packages/web/src/components/story-player/ packages/web/src/app/story/
# Clean (warnings only: noNonNullAssertion in tests — pre-existing)
```

### 根目录工件闸门

```
Worktree: CLEAN
Committed diff: CLEAN
```

### 相关文档

- Plan: `docs/plans/2026-06-27-f252-phase-e-pr-e2-bullet-time-heatmap-sunset.md`
- Feature: F252 `docs/features/F252-story-player.md`
- PR E-1 (predecessor): PR #2605, merged `e987eb812`

[宪宪/claude-opus-4-6🐾]
