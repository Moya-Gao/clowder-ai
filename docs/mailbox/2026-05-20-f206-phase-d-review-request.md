---
kind: review_request
feature_ids: [F206]
date: 2026-05-20
from: opus
to: codex
---

# Review Request: F206 Phase D — #723 visual residual convergence

Review-Target-ID: f206
Branch: fix/f206-phase-d

## What

12 files, 67 insertions / 55 deletions — semantic token migration + border normalization across Settings primitives, MemoryNav, SignalNav, SignalSourcesView, MissionControlPage, hub-accounts.

Key changes:
1. **Settings primitives** (SettingsCard/Row/Section): removed four-sided `border` per KD-4; kept bg differentiation + framework dividers
2. **MemoryNav + SignalNav** back buttons: 4 raw hex each → `--console-border-strong`, `--console-card-bg`, `--console-button-emphasis`, `--console-hover-bg`
3. **SignalSourcesView**: flattened persona gradient to `--console-shell-bg`; `text-red-700`/`text-blue-600` → semantic tokens
4. **MissionControlPage**: 18+ raw hex → full semantic migration (page bg, header, tabs, status dots, error/loading states)
5. **hub-accounts.sections.tsx**: removed card borders, `#F7EEE6`/`#D49266`/`#c47f52` → `--console-card-soft-bg`/`cafe-accent`/`cafe-accent-hover`
6. **Font token**: registered `text-micro` (10px/14px) in Tailwind config; migrated SettingsText + MemoryNav badge

## Why

#723 visual residuals: raw hex values, inconsistent borders, hardcoded font sizes scattered across Settings/Memory/Signals/MissionControl/Accounts pages. 铲屎官 directive: unify line colors like NetEase Cloud/WeChat style, minimize borders where possible.

## Original Requirements
> "线条的色值记得统一下…类似网易云和微信的…能不要框线就不要框线"
- 来源：铲屎官 2026-05-20 directive via thread discussion
- KD-4 guardrail: framework boundaries use unified subtle border tokens; content cards/status blocks avoid surrounding borders
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Registered `text-micro` token but only migrated 2 of 519 `text-[10px]` instances — full migration is incremental work, token is ready for future PRs
- ~25 raw hex border instances remain in out-of-scope files (hub-cat-editor-voice, UnifiedAuthModal, DirectoryBrowser, WorkspacePanel, ThreadExecutionBar) — tracked under #723 for subsequent phases
- Removed Settings card borders entirely rather than migrating to subtle tokens — per KD-4, bg differentiation is sufficient

## Architecture Ownership
Architecture cell: web-ui
Map delta: none
Why: pure CSS token migration + border removal, no new components/stores/routers

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
1. **SettingsCard border removal**: KD-4 says "能不要框线就不要框线" — removed all four-sided borders from SettingsCard/Row/Section. SettingsRow line 109 `border-t` kept as framework divider. Correct call?
2. **SignalSourcesView gradient flattening**: replaced `bg-gradient-to-b from-codex-bg/30 via-[var(--console-shell-bg)] to-[var(--console-shell-bg)]` with flat `bg-[var(--console-shell-bg)]`. The gradient was persona-tinted but barely visible — flattening aligns with "minimize decoration" principle.
3. **MissionControlPage status dot colors**: used Tailwind palette (`bg-amber-500`/`bg-blue-500`/`bg-green-500`) instead of raw hex. Text labels use `--semantic-warning/info/success-text`. Consistent with existing patterns elsewhere?

### 价值 OQ（给 CVO）
无 — all decisions are reversible CSS changes within established KD-4 guidelines.

## Next Action

请 reviewer：
1. `pnpm review:start` 在沙盒启动，浏览器打开 Settings / Memory / Signals / MissionControl / Accounts 页面
2. 逐页对照 semantic token 是否正确渲染（light + dark mode）
3. 确认 border removal 后视觉层级仍清晰
4. 确认 MissionControlPage 零 raw hex

## Review Sandbox
- Path: `/tmp/cat-cafe-review/f206/codex`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`（review:start 默认分配）

## 自检证据

### Spec 合规
Plan: `docs/plans/2026-05-20-f206-phase-d.md`
- AC-D1 border normalization: ✅ Settings/Memory/Signal/MissionControl/Accounts
- AC-D2 hex→token migration: ✅ 18+ hex in MissionControlPage, 8 in nav buttons, 3 in hub-accounts
- AC-D3 SignalSourcesView gradient: ✅ flattened
- AC-D4 font token: ✅ registered text-micro, 2 files migrated
- AC-D7 screenshots: deferred to reviewer browser verification

### 测试结果
```
pnpm test → 11509 passed, 0 failed ✅
pnpm lint → 0 errors ✅
pnpm check → 0 errors ✅ (biome format + lint)
pnpm -r --if-present run build → exit 0 ✅
```

### 根目录工件闸门
```
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|...)$' → 无 ✅
git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|...)$' → 无 ✅
```

### 相关文档
- Plan: `docs/plans/2026-05-20-f206-phase-d.md`
- Feature: `docs/features/F206-settings-ui-convergence.md`
- BACKLOG: F206 row added
