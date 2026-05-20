---
title: "Review Request: F206 Phase H — workspace browser chrome hex → ws-* semantic tokens"
date: 2026-05-20
feature: F206
phase: H
reviewer: codex
---

# Review Request: F206 Phase H — workspace browser chrome hex → ws-* semantic tokens

Review-Target-ID: f206
Branch: fix/f206-phase-h

## What

Migrated 31 raw hex values across 5 workspace browser chrome files to 10 new `--ws-*` CSS semantic tokens. Added light-mode definitions + 7 dark-mode `color-mix()` overrides. Updated BrowserTabs test assertion. Assessed ThreadSidebar borders per KD-4 — all justified, no removals.

**Files changed (7):**
- `console-shell.css` — 10 new `--ws-*` token definitions (light + dark)
- `BrowserPanel.tsx` — 6 hex → ws-* tokens
- `BrowserToolbar.tsx` — 7 hex → ws-* tokens (nav buttons, URL bar, Go button, console toggle)
- `ConsolePanel.tsx` — 6 hex → ws-* tokens (header, badges, output text)
- `BrowserTabBar.tsx` — 5 hex → ws-* tokens (container, active/inactive tabs)
- `WorkspaceFileViewer.tsx` — 4 hex → ws-* tokens (always-dark editor chrome)
- `BrowserTabs.test.tsx` — assertion updated `bg-[#FDF8F3]` → `bg-[var(--ws-surface)]`

## Why

砚砚 post-merge audit after Phase G identified 31 raw hex across workspace/browser chrome as next migration target. These are the warm-palette UI chrome colors (surfaces, text, accents) that need semantic tokens for dark-mode support and design consistency.

## Original Requirements
> "线条的色值记得统一下…类似网易云和微信的…能不要框线就不要框线"
- 来源：铲屎官 directive via #723 discussion
- **请对照上面的摘录判断：workspace browser chrome 色值是否统一到 semantic token 体系**

## Tradeoff

Chose 10 purpose-named tokens (`--ws-surface`, `--ws-accent`, `--ws-editor-bg`, etc.) over reusing existing `--console-*`/`--cafe-*` tokens. Reason: workspace browser chrome has its own warm palette distinct from console (cool) and cafe (general) — mixing would create semantic confusion.

## Architecture Ownership
Architecture cell: workspace
Map delta: none
Why: Pure CSS token migration within existing workspace components, no boundary/data-flow changes

## Open Questions

### Technical OQ (for reviewer)
1. Dark-mode `color-mix()` ratios — do the 7 overrides produce visually coherent contrast in dark theme?
2. `--ws-editor-*` tokens are always-dark (no dark-mode override needed) — correct that WorkspaceFileViewer uses these regardless of theme?

### Value OQ (for CVO)
None — pure mechanical migration, low rollback cost.

## Next Action

Please review the 7-file diff. Focus on token naming consistency and dark-mode override completeness.

## Review Sandbox
N/A — CSS-only token migration diff review, no runtime sandbox needed

## Self-Check Evidence

### Spec Compliance
- Quality gate passed 2026-05-20 21:50
- Vision check: 色值统一 ✅, 框线 KD-4 assessment ✅
- ThreadSidebar borders: all on interactive controls (modals/inputs/dropdowns/buttons), justified per KD-4

### Test Results
- `pnpm test` → 418 files, 3138 tests, 0 failed ✅
- `pnpm lint` → 0 errors ✅
- `pnpm check` → 0 errors (biome + guide flows + followup-tails + settings-primitives) ✅
- `pnpm -r --if-present run build` → exit 0 ✅
- Zero raw hex in all 5 migrated workspace files (rg verified) ✅

### Related Docs
- Feature: `docs/features/F206-settings-ui-convergence.md`
- Issue: clowder-ai #723 (NOT to be closed)
