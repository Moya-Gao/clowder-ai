---
feature_ids: [F056]
doc_kind: plan
created: 2026-03-28
---

# F056 Phase A-1: Token Three-Layer Architecture

**Feature:** F056 — `docs/features/F056-cat-cafe-design-language.md`
**Goal:** Build the three-layer design token system (base palette -> semantic tokens -> Tailwind config) with dark mode mappings and WCAG AA compliance.
**Acceptance Criteria:**
- AC-A5: Token 三层架构落地（base palette -> semantic tokens -> Tailwind config）
- AC-A6: Semantic token 色板通过 WCAG AA 对比度检查
**Architecture:** CSS custom properties in globals.css define Layer 1 (base palette) and Layer 2 (semantic tokens). Tailwind config maps semantic tokens to utility classes. A validation script checks WCAG AA contrast ratios. Dark mode is a `[data-theme="dark"]` override of semantic tokens only.
**Tech Stack:** CSS custom properties, Tailwind CSS 3.4.0, Node.js script for contrast validation
**Frontend validation:** Yes — semantic tokens affect all pages. Reviewer must verify light/dark render.

---

## Current State

- **Layer 3 (agent persona) already exists**: `--color-opus-primary` etc. in globals.css + Tailwind aliases
- **Minimal UI tokens exist**: `--bg-app`, `--text-primary`, `--text-secondary`
- **No Layer 1 base palette**: spec's named palette (`cat-cream-white` etc.) not in CSS
- **No Layer 2 semantic tokens**: no `--cafe-surface`, `--cafe-border`, `--cafe-accent`
- **Dark mode skeleton**: only inverts bg/text + cat bg opacity — no semantic layer

## Token Contract

### Layer 1: Base Palette (raw colors, never used directly in components)

| Variable | Value | Purpose |
|----------|-------|---------|
| `--cat-cream-white` | `#fdf8f3` | Warm ivory background |
| `--cat-soft-blue` | `#81D4FA` | Cross-thread accent |
| `--cat-warm-brown` | `#8D6E63` | Text, borders |
| `--cat-paw-pink` | `#FFAB91` | Interactive highlights |
| `--cat-deep-ink` | `#1e1e24` | Dark surfaces |
| `--cat-muted-stone` | `#666666` | Secondary text |
| `--cat-light-sand` | `#f5ede3` | Elevated surfaces (cards) |
| `--cat-border-tan` | `#e0d5c7` | Default borders |

### Layer 2: Semantic Tokens (what components use)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--cafe-surface` | `--cat-cream-white` | `--cat-deep-ink` | Page background |
| `--cafe-surface-elevated` | `--cat-light-sand` | `#2a2a32` | Cards, panels |
| `--cafe-surface-sunken` | `#f0e8dd` | `#16161c` | Inputs, wells |
| `--cafe-text` | `--cat-deep-ink` | `--cat-cream-white` | Primary text |
| `--cafe-text-secondary` | `--cat-muted-stone` | `#aaaaaa` | Secondary text |
| `--cafe-text-muted` | `#999999` | `#777777` | Tertiary/placeholder |
| `--cafe-border` | `--cat-border-tan` | `#3a3a44` | Default borders |
| `--cafe-border-subtle` | `#ebe3d9` | `#2e2e38` | Subtle separators |
| `--cafe-accent` | `--cat-paw-pink` | `#FFB899` | Primary actions |
| `--cafe-accent-hover` | `#FF9A7A` | `#FFC5AA` | Hover state |
| `--cafe-crosspost` | `--cat-soft-blue` | `#64B5F6` | Cross-thread indicators |
| `--cafe-interactive` | `--cat-warm-brown` | `#B0937A` | Links, clickable |

### Layer 3: Agent Persona (already exists, no changes needed)

Existing `--color-opus-*`, `--color-codex-*`, etc. remain as-is.

### Tailwind Mapping

```js
cafe: {
  surface:          'var(--cafe-surface)',
  'surface-elevated': 'var(--cafe-surface-elevated)',
  'surface-sunken': 'var(--cafe-surface-sunken)',
  accent:           'var(--cafe-accent)',
  'accent-hover':   'var(--cafe-accent-hover)',
  crosspost:        'var(--cafe-crosspost)',
  interactive:      'var(--cafe-interactive)',
}
// + textColor, borderColor extensions
```

Components will use: `bg-cafe-surface`, `text-cafe`, `border-cafe`, `bg-cafe-accent`, etc.

---

## Tasks

### Task 1: Layer 1 + Layer 2 CSS variables in globals.css

**Files:**
- Modify: `packages/web/src/app/globals.css`

Add base palette block (Layer 1) and semantic token block (Layer 2) for both `:root` (light) and `[data-theme="dark"]`. Preserve existing cat persona variables (Layer 3) and werewolf theme.

### Task 2: Tailwind config semantic token mapping

**Files:**
- Modify: `packages/web/tailwind.config.js`

Extend the `cafe` color group from `{white, black}` to the full semantic token set. Add `textColor` and `borderColor` extensions for cafe tokens.

### Task 3: WCAG AA contrast validation script

**Files:**
- Create: `scripts/check-color-contrast.mjs`

Node.js script that:
1. Parses the semantic token contract (light + dark)
2. Checks text-on-background pairs against WCAG AA (4.5:1 normal, 3:1 large)
3. Reports pass/fail per pair
4. Exit code 1 if any pair fails

### Task 4: Update ESLint rule allowlist

**Files:**
- Modify: `packages/web/eslint-plugins/no-hardcoded-colors.js`
- Modify: `packages/web/eslint-plugins/no-hardcoded-colors.test.js`

Add `cafe` semantic token classes (`bg-cafe-surface`, `text-cafe`, `border-cafe`) to the allowed list. They're already partially allowed via the `cafe` prefix in `SEMANTIC_PREFIXES`, but verify test coverage for new token names.

### Task 5: Commit + verify

Run `pnpm check`, `pnpm lint`, `pnpm --filter @cat-cafe/web test`, `pnpm --filter @cat-cafe/web build`.
Commit all changes.
