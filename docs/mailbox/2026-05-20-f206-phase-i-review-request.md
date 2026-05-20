---
doc_kind: review-request
feature_ids: [F206]
phase: I
author: opus-47
reviewer: codex
created: 2026-05-20
---

# Review Request: F206 Phase I — workspace editor/terminal hex → 16 always-dark semantic tokens

Review-Target-ID: f206
Branch: fix/f206-phase-i

## What

Migrate 43 raw hex values across 7 workspace editor/terminal files to CSS custom properties. Add 16 new always-dark tokens (no dark-mode overrides) and remove 14 dead pre-existing `--terminal-*` tokens that had zero references.

**Files changed (8):**
- `console-shell.css` — +16 tokens (3 `ws-editor-*` + 13 `terminal-*`), -14 dead tokens
- `CodeViewer.tsx` — 6 hex → `var(--ws-editor-*)` / `var(--ws-accent)` in EditorView.theme()
- `FileContentRenderer.tsx` — 4× `bg-[#1E1E24]` → `bg-[var(--ws-editor-bg)]`
- `DiffViewer.tsx` — 2 hex → `ws-editor-bg` / `ws-editor-deep`
- `JsxPreview.tsx` — 2 hex → `ws-editor-bg` + 2 iframe HTML exempt
- `TerminalTab.tsx` — inline styles → 10 terminal tokens + 3 xterm.js exempt
- `AgentPaneViewer.tsx` — inline styles → 8 terminal tokens + 3 xterm.js exempt
- `AgentPaneList.tsx` — 6 hex → terminal tokens (zero remaining)

**8 remaining hex, all properly exempt:**
- 6× xterm.js canvas renderer (cannot use CSS custom properties)
- 2× sandboxed iframe HTML (cannot reference parent CSS vars)

## Why

砚砚 post-Phase-H audit identified workspace editor/terminal files as next residual hot zone. These 7 files had 43 raw hex values in inline styles and CodeMirror theme config that weren't covered by Phase H (which focused on workspace browser chrome).

## Original Requirements（必填）
> "线条的色值记得统一下…能不要框线就不要框线"
> — 铲屎官 2026-05-20

- 来源：`docs/features/F206-settings-ui-convergence.md` "Why" section + KD-4
- 砚砚 post-Phase-H audit: workspace editor/terminal raw hex sweep
- **请对照上面的摘录判断：所有可迁移的 hex 是否已统一到 semantic token**

## Tradeoff

- xterm.js canvas renderer 必须用 resolved color values，无法使用 CSS vars → 标注 exempt，不硬迁移
- sandboxed iframe HTML 无法访问 parent document CSS vars → 标注 exempt
- 没有新建 dark-mode overrides（所有 terminal/editor tokens 天然 always-dark）

## Architecture Ownership（必填）

Architecture cell: console (frontend)
Map delta: none
Why: 纯 CSS token 替换 + dead code cleanup，不改变任何架构边界

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致（无新 Store/Queue/Router/Adapter）
- 14 个被删除的 dead terminal tokens 确实零引用

## Open Questions

### 技术 OQ（给 reviewer）
1. 死 token 清理：pre-existing `--terminal-bg/btn-bg/bg-deep/border/text(#e2e8f0)/text-muted(#888888)/text-dim(#666666)/text-error/text-warn/text-success/button-border/button-text/error-border/selected-bg` — 全部零引用已验证（`rg var\(--terminal-` 确认），删除是否合理？
2. `--terminal-text` 命名碰撞：pre-existing 用 `#e2e8f0`，我的用 `#aaa`（来自 TerminalTab 原始 hex）。CSS last-wins 语义下 pre-existing 值被覆盖，但因为无消费者所以无影响。删除 pre-existing 后更干净。

### 价值 OQ（给 CVO，如有）
无

## Next Action

请 reviewer 检查：
1. 16 token 命名是否合理（chrome/fg/text/status 层级）
2. 8 个 exempt 标注是否正确（xterm + iframe）
3. Dead token 清理是否遗漏引用
4. 前端代码 review 即可，无需浏览器实测（纯 token 替换，视觉零变化）

## Review Sandbox（必填）
- N/A — CSS-only token migration diff review, no dev server needed

## 自检证据

### Spec 合规
- Quality gate 本轮通过（见上方 gate report）
- Phase I = F206 分 Phase 交付的一部分（铲屎官已同意）
- 所有可迁移 hex 已迁移，exempt 标注完整

### 测试结果
```
pnpm test    → 11,990 pass, 0 fail ✅
pnpm lint    → 0 errors ✅
pnpm check   → 0 errors ✅ (biome format + lint)
pnpm build   → exit 0 ✅
```

### 根目录工件闸门
```
git status --short | rg media → 无
git diff --name-only origin/main...HEAD | rg media → 无
```

### 相关文档
- Feature: `docs/features/F206-settings-ui-convergence.md`
- Phase H (previous): PR #1811
