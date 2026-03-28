# F056 Phase D-1+D-2: ThemeProvider + Dark Mode Implementation Plan

**Feature:** F056 — `docs/features/F056-cat-cafe-design-language.md`
**Goal:** Centralized theme switching infrastructure — components access theme via React context, dark mode toggleable site-wide
**Acceptance Criteria:**
- AC-D1: ThemeProvider + useTheme + useCatTheme hook 落地，组件不再直接吃 hex
- AC-D2: Dark mode 全站可切换，light/dark 截图对比无视觉异常
**Architecture:** Use `next-themes` for SSR-safe theme switching (handles hydration flash, localStorage persistence, system preference detection). Wrap app in ThemeProvider, `data-theme` attribute on `<html>` drives existing `[data-theme="dark"]` CSS overrides from Phase A-1. Custom `useCafeTheme` hook provides typed theme API.
**Tech Stack:** next-themes 0.4.x, React Context, Next.js 14 App Router
**前端验证:** Yes — dark mode toggle must be visually verified in browser

---

## What We're NOT Building

- D-3 (next-intl internationalization) — separate PR
- D-4 (tenant.config brand assets) — separate PR
- Custom theme engine — `next-themes` handles the hard parts (SSR, flash prevention)
- Per-component theme overrides — components consume semantic tokens via Tailwind, theme switching is global

## Terminal Schema

```typescript
// useCafeTheme return type
interface CafeTheme {
  theme: 'light' | 'dark' | 'system';
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleTheme: () => void;
}
```

---

## Tasks

### Task 1: Install next-themes + create ThemeProvider

**Files:**
- Modify: `packages/web/package.json` (add next-themes)
- Create: `packages/web/src/components/ThemeProvider.tsx`
- Modify: `packages/web/src/app/layout.tsx` (wrap with ThemeProvider)

**Step 1:** Install next-themes

```bash
pnpm --filter @cat-cafe/web add next-themes
```

**Step 2:** Create ThemeProvider client component

```tsx
// packages/web/src/components/ThemeProvider.tsx
'use client';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="data-theme" defaultTheme="light" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
```

Key config:
- `attribute="data-theme"` — matches our existing `[data-theme="dark"]` CSS
- `defaultTheme="light"` — current behavior
- `enableSystem` — respect OS preference
- `disableTransitionOnChange` — avoid flash during switch

**Step 3:** Wrap layout.tsx

Add `suppressHydrationWarning` to `<html>` (required by next-themes for SSR script injection).

**Step 4:** Commit

### Task 2: Create useCafeTheme hook + tests

**Files:**
- Create: `packages/web/src/hooks/useCafeTheme.ts`
- Create: `packages/web/src/components/__tests__/theme-provider.test.ts`

**Step 1:** Write failing tests

- `useCafeTheme returns light as default theme`
- `useCafeTheme.toggleTheme switches light→dark`
- `useCafeTheme.setTheme('system') sets system preference`

**Step 2:** Implement useCafeTheme hook

```typescript
'use client';
import { useTheme } from 'next-themes';

export function useCafeTheme() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return {
    theme: (theme ?? 'light') as 'light' | 'dark' | 'system',
    resolvedTheme: (resolvedTheme ?? 'light') as 'light' | 'dark',
    setTheme,
    toggleTheme: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
  };
}
```

**Step 3:** Run tests, confirm green

**Step 4:** Commit

### Task 3: Add ThemeToggle button component

**Files:**
- Create: `packages/web/src/components/ThemeToggle.tsx`
- Create: `packages/web/src/components/__tests__/theme-toggle.test.ts`

**Step 1:** Write test: renders toggle, clicking switches theme

**Step 2:** Implement ThemeToggle — minimal button that calls `useCafeTheme().toggleTheme()`. Uses sun/moon icons (Lucide `Sun` and `Moon`). Shows current state.

**Step 3:** Run tests, confirm green

**Step 4:** Commit

### Task 4: Integrate toggle into existing UI

**Files:**
- Modify: `packages/web/src/components/CatCafeHub.tsx` (or appropriate settings area)

**Step 1:** Find the right integration point — likely the hub header or settings panel

**Step 2:** Add `<ThemeToggle />` to the UI

**Step 3:** Verify: `pnpm --filter @cat-cafe/web build` passes (SSR check)

**Step 4:** Commit

### Task 5: Full verification

**Step 1:** Run full test suite

```bash
pnpm --filter @cat-cafe/web test
pnpm --filter @cat-cafe/web lint
pnpm --filter @cat-cafe/web build
```

**Step 2:** Visual verification in browser — light/dark toggle, persistence across refresh

**Step 3:** Final commit if any fixes needed
