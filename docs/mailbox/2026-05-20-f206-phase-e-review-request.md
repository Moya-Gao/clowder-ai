---
feature_ids: [F206]
related_features: [F190]
topics: [console, frontend, tokens, visual-convergence]
doc_kind: mailbox
created: 2026-05-20
---

# Review Request: F206 Phase E — semantic token migration for 7 out-of-scope files

Review-Target-ID: f206-phase-e
Branch: fix/f206-phase-e

## What

Migrate ~100 raw hex color values to semantic CSS tokens across 7 files that were out-of-scope in Phase D, plus define new `--field-success-*` / `--field-persist-*` tokens in `console-shell.css`:

| # | File | Hex replaced |
|---|------|-------------|
| 1 | ThreadExecutionBar.tsx | 3 |
| 2 | DirectoryBrowser.tsx | 6 |
| 3 | WorkspacePanel.tsx (port discovery toast) | 8 |
| 4 | hub-cat-editor-voice.tsx | ~14 |
| 5 | hub-cat-editor.sections.tsx | ~12 |
| 6 | UnifiedAuthModal.tsx | ~48 |
| 7 | hub-cat-editor-fields.tsx | ~12 (including success/persist status colors) |
| 8 | console-shell.css | +20 new CSS custom properties (light+dark) |

Token mapping:
- Borders: raw hex → `var(--console-border-soft)`
- Backgrounds: raw hex → `var(--console-card-bg)` / `var(--console-hover-bg)`
- Text: raw hex → `text-cafe` / `text-cafe-secondary` / `text-cafe-muted`
- Accent: raw hex → `cafe-accent` / `cafe-accent-hover`
- Placeholder: raw hex → `var(--cafe-text-muted)`
- Focus: raw hex → `focus:border-cafe-accent` / `focus:ring-cafe-accent/30`
- Success status: raw hex → `var(--field-success-*)` (sage green, 6 tokens)
- Persistence banner: raw hex → `var(--field-persist-*)` (warm orange, 4 tokens)

Zero raw hex remaining in hub-cat-editor-fields.tsx after R1 fix.

## Why

铲屎官 2026-05-20 directive + clowder-ai #723: raw hex color values cause visual fragmentation. Phase D handled 15 core files; Phase E covers the remaining 7 files identified by 砚砚's audit.

## Original Requirements（必填）
> "线条的色值记得统一下…类似网易云和微信的…能不要框线就不要框线"
> "先归一再全量同步……不能5-7天太慢了"
- 来源：`docs/features/F206-settings-ui-convergence.md` (Why section)
- **请对照上面的摘录判断：这批文件的 hex 是否都换成了统一 token？有无遗漏？**

## Tradeoff

No alternative considered — this is mechanical token replacement following the same mapping established in Phase D.

## Architecture Ownership（必填）
Architecture cell: web/components (visual-only)
Map delta: none
Why: Pure CSS class replacements, zero behavioral/structural changes

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致（应只有 className string 变化）
- 是否新建了并行 Store/Queue/Router/Adapter/Dispatcher/Binding — 答案应为 No

## Open Questions

### 技术 OQ（给 reviewer）
1. hub-cat-editor-fields.tsx 的 success/persist 状态色已迁移到 `--field-success-*` / `--field-persist-*` tokens（R1 fix）。这些 token 用 sage green / warm orange 独立于 `--semantic-success-*`（standard Material green）。请确认 token 命名和 dark mode color-mix 比例是否合理。
2. UnifiedAuthModal.tsx 有 ~48 处替换，是本批最大文件。请重点检查有无漏替或误替。

### 价值 OQ（给 CVO）
无

## Next Action

请 review 这 7 个文件的 token 替换正确性。纯 CSS class 变更，无需启动 dev server。

## Review Sandbox（必填）
- Path: N/A — 纯 CSS token 替换，无需 dev server，`git diff` 即可 review。
- Start Command: N/A
- Ports: N/A

## 自检证据

### Spec 合规
Quality gate passed — see above report. Phase E extends Phase D's AC-D1 (全局 border token 归一) to 7 additional files.

### 测试结果
- `pnpm test` → 418 files / 3138 tests passed, 0 failed ✅
- `pnpm lint` → 0 errors ✅
- `pnpm check` → passed (biome format + lint + follow-up tails + settings primitives) ✅
- `pnpm -r --if-present run build` → exit 0 ✅

### Artifact Hygiene
- Working tree root: clean ✅
- Committed diff root: clean ✅

### 相关文档
- Feature: `docs/features/F206-settings-ui-convergence.md`
- Prior PR: #1806 (Phase D, merged)
