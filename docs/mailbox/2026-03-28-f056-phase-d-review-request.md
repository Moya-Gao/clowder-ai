---
title: "Review Request: F056 Phase D-1+D-2 — ThemeProvider + Dark Mode"
feature: F056
date: 2026-03-28
type: review-request
---

# Review Request: F056 Phase D-1+D-2 — ThemeProvider + Dark Mode

## What

Centralized theme switching infrastructure using `next-themes`:
- `ThemeProvider` client component wrapping root layout (`attribute="data-theme"`)
- `useCafeTheme` typed hook (theme/resolvedTheme/setTheme/toggleTheme)
- `ThemeToggle` button in chat header (sun/moon SVG icons, aria-labeled)
- `suppressHydrationWarning` on `<html>` for SSR flash prevention

5 commits on `feat/f056-phase-d`, touching 7 files (4 new, 3 modified).

## Why

Phase D is the engineering backbone for "组件不再直接吃 hex". The CSS token layer (Phase A-1) and codemod (Phase A-2.5) are already on main — but without a ThemeProvider, dark mode only works in manually-wired game components. This PR makes dark mode site-wide toggleable via React context.

## Original Requirements（必填）

> "Phase D 先行（ThemeProvider + useTheme hook + dark mode）—— 这才是'组件不再直接吃 hex'的工程骨架，是真正的组件化基建"

- 来源：铲屎官 2026-03-28 对话（本 session 内确认，无独立 Discussion 文档）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Used inline SVG for sun/moon icons instead of adding `lucide-react` dependency (only 2 icons needed)
- `next-themes` over custom implementation — handles SSR hydration flash, localStorage persistence, system preference detection out of the box
- ThemeToggle placed in ChatContainerHeader (always visible) rather than buried in Hub settings

## Open Questions

1. ThemeToggle positioning — before HubButton in header toolbar. Is this the right spot or should it also appear in Hub settings?
2. The `disableTransitionOnChange` flag prevents CSS transition flash during theme switch. If we later want animated transitions, this needs revisiting.

## Next Action

请 review `feat/f056-phase-d` 分支（5 commits），重点关注：
- ThemeProvider config 是否正确（attribute/defaultTheme/enableSystem）
- useCafeTheme hook 类型安全
- ThemeToggle accessibility (aria-label)

Review-Target-ID: f056-phase-d
Branch: feat/f056-phase-d

## 自检证据

### Spec 合规

| AC | 状态 | 证据 |
|----|------|------|
| AC-D1: ThemeProvider + useTheme + useCafeTheme | ✅ | ThemeProvider.tsx + useCafeTheme.ts + layout.tsx |
| AC-D1: 组件不再直接吃 hex | ✅ | data-theme drives CSS custom properties |
| AC-D2: Dark mode 全站可切换 | ✅ | ThemeToggle in header, next-themes handles persistence |

### 测试结果

```
pnpm --filter @cat-cafe/web test  → 1748 passed, 0 failed ✅
pnpm --filter @cat-cafe/web lint  → 0 errors ✅
pnpm check                        → 0 errors ✅
pnpm --filter @cat-cafe/web build → exit 0 ✅
```

### 相关文档

- Plan: `docs/plans/2026-03-28-f056-phase-d1-d2-theme-provider-dark-mode.md`
- Feature: F056 — `docs/features/F056-cat-cafe-design-language.md`
