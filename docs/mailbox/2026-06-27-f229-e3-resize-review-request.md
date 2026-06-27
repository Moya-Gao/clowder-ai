---
feature_ids: [F229]
topics: [concierge, resize, ball, settings]
---

# Review Request: F229 E3 — Resizable Concierge Ball

Review-Target-ID: f229-e3
Branch: feat/f229-e3-resize

## What
Users can now resize the concierge ball (cat) from 48px to 192px by dragging the bottom-right corner. Size persists to config (TTL=0). Settings page gets a slider for precise control + reset button.

Core changes across 10 files:
- **shared**: `ballSize` field on `ConciergeConfig`, `clampBallSize()` utility, constants, 13 unit tests
- **api**: zod validation for `ballSize` in PATCH config schema
- **store**: `ballSize` state + `setBallSize` action (optimistic PUT, silent fail)
- **ConciergeHost**: Rnd `enableResizing` on bottomRight, `lockAspectRatio`, all size/position/clamp computed from dynamic `ballSize`
- **ConciergeBall**: button fills parent (`w-full h-full`), AtlasSprite accepts `containerSize` prop for proportional scaling (height-fit 88% of container)
- **Settings**: new `RangeSlider` component + ballSize section (48-192px, step 4, reset button)

## Why
CVO: "这只大猫猫太小了" -- users want the cat bigger (or smaller). The atlas cells are 192x208px displayed at 72x72px (2.7x downscale), so enlarging up to 192px uses native resolution with zero pixel artifacts.

## Original Requirements
> "我能够拖动猫猫球的大小让这只猫变大点吗？现在有的时候感觉这只大猫猫太小了"
- 来源: F229 feature doc Phase E3 + CVO 2026-06-26 brainstorm session
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- Only bottom-right resize handle enabled (not all 8 directions) — keeps the interaction simple and prevents accidental resize during drag-to-move
- Step size 4px in settings slider (not 1px) — avoids excessive API writes while being granular enough
- No custom resize handle icon (fish/paw) in this phase — codex brainstorm suggested it as a creative add-on for later

## Architecture Ownership
Architecture cell: concierge
Map delta: none
Why: Extends existing ConciergeConfig field pattern (same as ballPosition). No new stores, no new routes, no new architectural concepts.

Please check:
- diff does not introduce parallel Store / Queue / Router / Adapter / Dispatcher / Binding
- `Map delta: none` is consistent with the actual diff

## Open Questions

### Technical OQ (for reviewer)
1. **AtlasSprite scaling**: I changed from hardcoded `displayHeight = 64` to `Math.round(containerSize * 0.88)`. At max size (192px), displayHeight = 169px which is within the atlas cell height (208px). At min size (48px), displayHeight = 42px. Does the sprite look acceptable at very small sizes? (Can't visually verify without browser)
2. **Settings slider commit frequency**: `onChange` fires on every slider position change, triggering `updateConfig` which PUTs to API. The `pendingRef` guard prevents concurrent writes, but rapid sliding could queue many writes. Is this acceptable, or should we debounce?

### Value OQ (for CVO)
None -- reversible, low risk, CVO explicitly requested this feature.

## Next Action
Please review for correctness, especially:
- AtlasSprite dynamic scaling logic (ConciergeBall.tsx lines 74-122)
- Rnd resize integration (ConciergeHost.tsx)
- Settings RangeSlider UX (ConciergeSettingsContent.tsx)

## Review Sandbox
- Path: `/tmp/cat-cafe-review/f229-e3/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: reviewer's sandbox auto-assigns (starting 3201/3202)

### Sandbox Bootstrap

```bash
unset NODE_ENV
pnpm install --frozen-lockfile
pnpm --filter @cat-cafe/shared build
```

## Self-Check Evidence

### Spec Compliance
Quality Gate PASS (2026-06-27 06:35 UTC):
- Vision check: CVO's original request fully covered (resize 48-192px, persist TTL=0)
- Hotfix check: `{"hotfix":false}`
- Follow-up tail scan: 0 blocked keywords
- Fallback layer check: cumulative warning on conciergeStore.ts (independent try/catch per API call, not nested fallback)
- Artifact hygiene: clean
- Capability tips: PASS

### Test Results

```bash
unset NODE_ENV
pnpm install --frozen-lockfile
pnpm --filter @cat-cafe/shared build

# Tests
pnpm test                    # 533 files, 4795 passed, 0 failed
pnpm lint                    # 0 errors (1 pre-existing warning)
pnpm biome check (changed)   # 0 errors on all 10 changed files
pnpm -r --if-present run build # all packages exit 0
pnpm check:capability-tips   # PASS
```

### Related Documents
- Feature: `docs/features/F229-cat-ball-concierge.md` Phase E3
- Three-cat brainstorm (gemini35 + codex + opus48): E3/E4 architecture decisions in F229 doc

[宪宪/claude-opus-4-6🐾]
