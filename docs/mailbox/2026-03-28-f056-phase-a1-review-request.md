# Review Request: F056 Phase A-1 — Three-Layer Design Token Architecture

Review-Target-ID: f056-phase-a1
Branch: feat/f056-phase-a1

## What

Three-layer design token system in CSS custom properties + Tailwind config:

1. **Layer 1 — Base Palette** (`--cat-cream-white`, `--cat-paw-pink`, etc.): 8 raw named colors in `:root`, never used directly by components
2. **Layer 2 — Semantic Tokens** (`--cafe-surface`, `--cafe-text`, `--cafe-border`, etc.): 12 tokens that components consume, with full dark mode overrides via `[data-theme="dark"]`
3. **Tailwind Mapping**: `cafe.*` colors, `textColor.cafe`, `borderColor.cafe` extensions so components use `bg-cafe-surface`, `text-cafe`, `border-cafe`

Legacy aliases (`--bg-app`, `--text-primary`, `--text-secondary`) rewired through semantic tokens for backward compatibility — existing code works unchanged.

WCAG AA contrast validation script (`scripts/check-color-contrast.mjs`) checks all text-on-background pairs.

## Why

F056 design language system. Phase A-0 (governance gate) established the ESLint rule preventing new hardcoded colors. Phase A-1 creates the token targets that the future codemod (Phase A-2.5) will migrate existing hardcoded colors to.

## Original Requirements（必填）
> 铲屎官："这两个都很技术向你觉得哪个方向应该先做啊？有区别？没区别的话随意？" → 布偶猫建议 A-1 先于 A-2.5（codemod 需要 token 作为替换目标）→ 铲屎官："走起开始吧！！"
- 来源：当前会话 2026-03-28 对话记录
- AC 来源：`docs/features/F056-cat-cafe-design-language.md` AC-A5, AC-A6
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- `cafe-text-muted` darkened from `#999999` to `#888888` to pass WCAG AA 3:1 for large text — slightly less "muted" but accessible
- `cafe-interactive` darkened from `var(--cat-warm-brown)` (#8d6e63) to `#85655a` to pass WCAG AA 4.5:1 on cream surface — slightly darker brown
- Accent/crosspost colors excluded from text-on-surface contrast checks: they're used as backgrounds/badges, not body text

## Open Questions

1. **Dark mode `cafe-text-muted` (#777777)**: ratio is 3.70:1 on `#1e1e24` — comfortably above 3:1 for large text. Acceptable for placeholder/tertiary text?
2. **`cafe-interactive` on `cafe-surface-elevated`**: 4.52:1 in light mode — passes but tight. Worth darkening further?
3. Pre-existing Biome format issue in `InvocationQueue.ts` (not in this changeset) — should this be fixed separately?

## Next Action

请 review 以下三个文件的改动，重点关注：
- Token 命名是否清晰、层级是否正确分离
- Dark mode 语义 token 覆盖是否完整
- WCAG AA 对比度阈值的 token 调整是否合理

## 自检证据

### Spec 合规
| AC | 状态 |
|----|------|
| AC-A5: Token 三层架构落地 | ✅ globals.css + tailwind.config.js |
| AC-A6: WCAG AA 对比度检查 | ✅ 14/14 pairs pass |

### 测试结果
```
pnpm --filter @cat-cafe/web test  → 244 files, 1727 tests, 0 failures ✅
pnpm --filter @cat-cafe/web lint  → 0 errors ✅
pnpm --filter @cat-cafe/web build → exit 0 ✅
node scripts/check-color-contrast.mjs → 14/14 PASS ✅
```

### 相关文档
- Plan: `docs/plans/2026-03-28-f056-phase-a1-token-architecture.md`
- Feature: `docs/features/F056-cat-cafe-design-language.md`
- Phase A-0 PR: #792 (merged)

### 变更文件
| 文件 | 变更类型 | 行数 |
|------|----------|------|
| `packages/web/src/app/globals.css` | Modified | +69 -16 |
| `packages/web/tailwind.config.js` | Modified | +16 |
| `scripts/check-color-contrast.mjs` | Created | +107 |
