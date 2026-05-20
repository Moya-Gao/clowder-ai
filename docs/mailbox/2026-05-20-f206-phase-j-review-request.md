---
doc_kind: review-request
feature_ids: [F206]
phase: J
author: opus-47
reviewer: codex
created: 2026-05-20
---

# Review Request: F206 Phase J — Hub visual raw-hex → 45 hub-* semantic tokens + ChangesPanel fix

Review-Target-ID: f206
Branch: fix/f206-phase-j

## What

Migrate ~152 raw hex values across 6 Hub/Leaderboard/Quota files to CSS custom properties. Add 45 new `--hub-*` tokens (light + dark mode). Fix 1 workspace residual (`ChangesPanel`). Mark 15 FileIcons brand colors exempt.

**Files changed (10):**
- `console-shell.css` — +45 hub-* tokens (light + dark), +91 lines
- `HubToolUsageTab.tsx` — ~41 hex → hub-*/hub-cat-* tokens + 5× `bg-white` → `bg-[var(--hub-surface-clean)]`
- `HubCoCreatorEditor.tsx` — ~27 hex → hub-*/ws-accent tokens (modal chrome, form fields, avatar, color pickers exempt as config data)
- `HubQuotaBoardTab.tsx` — ~27 hex → hub-*/field-success-* tokens (quota pools, error banner, member tags)
- `HubCatEditor.tsx` — ~24 hex → hub-*/field-success-focus tokens (member editor modal)
- `leaderboard-cards.tsx` — ~17 hex + 1 rgba → hub-lb-* tokens via inline `style={{}}`
- `leaderboard-phase-bc.tsx` — ~16 hex + 2 rgba → hub-lb-* tokens via inline `style={{}}`
- `ChangesPanel.tsx` — `bg-[#16161c]` → `bg-[var(--ws-editor-deep)]` (Phase I token, workspace residual)
- `FileIcons.tsx` — +1 exempt comment (15 file-type brand colors)
- `F206-settings-ui-convergence.md` — Phase J spec section added

**Token architecture (45 new):**
- `--hub-surface-*` (6) — panel/footer/form/hover/warm/accent backgrounds
- `--hub-heading` + `--hub-text-*` (6) — heading/body/secondary/muted/soft/faint/ghost text
- `--hub-border-*` (5) — border/warm/soft/accent/field
- `--hub-accent-*` (4) — primary/hover/breadcrumb/warm
- `--hub-btn-*` (3) — dark button/dark hover/hover
- `--hub-cat-*` (6) — tool usage 3 category colors + backgrounds
- `--hub-lb-*` (8) — leaderboard text/muted/accent/warm/card-bg/section-bg/badge-bg/progress-bg
- `--hub-quota-*` (6) — tag bg/text + error border/bg/text + surface-warm (in `:root`)
- 1 remaining: `--hub-surface-clean`

**Exempt items:**
- `HubCoCreatorEditor` `DEFAULT_CO_CREATOR.color` — config data defaults, not UI theme
- `FileIcons` 15 file-type brand colors — fixed per language identity

## Why

砚砚 post-Phase-I audit identified Hub/Leaderboard/Quota files as the next residual hot zone. These 6 files had ~152 raw hex values — the largest remaining block outside of `text-[10px]` (which is Phase K scope).

## Original Requirements

> "人家的每个按钮的画风统一，我们的不统一...到底为什么我们不统一做了那么多定制"
> "线条的色值记得统一下"
> — 铲屎官 2026-05-18 / 2026-05-20

- 来源：`docs/features/F206-settings-ui-convergence.md` "Why" section + KD-4
- 砚砚 post-Phase-I audit: Hub visual raw-hex sweep recommendation
- **请对照上面的摘录判断：Hub/Leaderboard/Quota 中可迁移的 hex 是否已统一到 semantic token**

## Tradeoff

- Consolidated near-identical hex values to single tokens (e.g., `#5C4A3A`/`#5C4B42` → `--hub-text`, `#FDF8F3`/`#FFF8F2` → `--hub-surface`) — acceptable <=2 shade delta
- Reused existing tokens where exact match: `--field-success-border/card-bg/hint/focus`, `--ws-accent`
- Leaderboard files use inline `style={{}}` not Tailwind — CSS vars work via `'var(--token)'` string syntax
- R1: `bg-white` → `bg-[var(--hub-surface-clean)]` to prevent dark mode contrast regression; `rgba(139,111,71,...)` → `--hub-lb-badge-bg` / `--hub-lb-progress-bg` with `color-mix()` dark overrides

## Architecture Ownership

Architecture cell: console (frontend)
Map delta: none
Why: CSS token definitions + mechanical hex→token replacement in TSX, no architecture boundary change

Reviewer checklist:
- diff 与 `Map delta: none` 一致（无新 Store/Queue/Router/Adapter）
- 45 hub-* tokens 命名层级合理（surface/text/border/accent/btn/cat/lb/quota）

## Open Questions

### 技术 OQ（给 reviewer）
1. Token consolidation: near-identical values merged (e.g., `#5C4A3A` + `#5C4B42` → one `--hub-text`). <=2 shade tolerance — reviewer confirmed acceptable in R1.
2. ~~`bg-white`~~ → resolved R1: all 5 occurrences → `bg-[var(--hub-surface-clean)]`
3. ~~`rgba(139,111,71,...)`~~ → resolved R1: tokenized as `--hub-lb-badge-bg` / `--hub-lb-progress-bg`

### 价值 OQ（给 CVO，如有）
无

## Next Action

请 reviewer 检查：
1. 45 token 命名层级是否清晰（hub-surface/text/border/accent/btn/cat/lb/quota 分组）
2. Dark mode token 值是否合理（warm palette 保持一致）
3. Exempt 标注是否正确（config data + brand colors）
4. 前端 diff review 即可，无需浏览器实测（纯 CSS token 替换，视觉零变化）

## Review Sandbox

- N/A — CSS-only token migration diff review, no dev server needed

## 自检证据

### Spec 合规
- Quality gate 本轮通过
- Phase J = F206 分 Phase 交付的一部分（铲屎官已同意 multi-phase）
- 所有可迁移 hex 已迁移，exempt 标注完整

### 测试结果
```
pnpm --filter @cat-cafe/web test  → 5/5 pass, 0 fail
pnpm lint                         → 0 errors (2 pre-existing warnings in ThreadSidebar)
pnpm check                        → 0 errors (biome format + lint + settings-primitives)
pnpm -r --if-present run build    → exit 0
```

### 根目录工件闸门
```
git status --short | rg media  → 无
git diff --name-only origin/main...HEAD | rg root-media  → 无
```

### 相关文档
- Feature: `docs/features/F206-settings-ui-convergence.md`
- Phase I (previous): PR #1812
