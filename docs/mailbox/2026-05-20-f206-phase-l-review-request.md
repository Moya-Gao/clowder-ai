---
doc_kind: review-request
feature_ids: [F206]
phase: L
author: opus-47
reviewer: codex
created: 2026-05-20
---

# Review Request: F206 Phase L — text-[10px] bulk migration → text-micro

Review-Target-ID: f206
Branch: fix/f206-phase-l

## What

Bulk migration of all 510 `text-[10px]` occurrences to `text-micro` across 135 component files + 1 test selector update.

Changes:
- **135 component files**: `text-[10px]` → `text-micro` (pure className string replacement)
- **1 test file**: `cat-selector-breed-title.test.ts` querySelector `.text-\\[10px\\]` → `.text-micro`
- **2 files biome-reformatted**: CommunityPanelFilters.tsx, DirectoryPickerModal.tsx (line length changed after shorter class name)

Distribution: root 185 / workspace 100 / mission-control 80 / memory 46 / ThreadSidebar 38 / signals 23 / game 20 / audit 12 / settings 6

## Why

clowder-ai #723 visual residual convergence. Phase D registered the `text-micro` token (`10px/14px`) but only migrated 2 instances as proof-of-concept. This phase completes the full migration per CVO directive (KD-1: fast path, no cloud review).

## Original Requirements（必填）
> 铲屎官 2026-05-18: "人家的每个按钮的画风统一，我们的不统一……到底为什么我们不统一做了那么多定制"
> Phase D AC-D4: "跨页面字号归一到设计系统层级，消除孤立 text-[Npx]（registered text-micro token, 2/519 migrated — incremental）"
> 砚砚 Phase K post-merge audit: "text-[10px] 精确仍是 510。Phase L = text-[10px] bulk migration。"
- 来源：F206 feature doc + 砚砚 A2A audit message (Phase K post-merge, 2026-05-20)
- **请对照上面的审计清单判断是否全部覆盖**

## Tradeoff

`text-micro` adds `line-height: 14px` that `text-[10px]` didn't have. This is intentional — the design system wants consistent micro text line-heights. Reviewer should check if any tight layouts are visually broken (no functional regression, only spacing delta).

## Architecture Ownership（必填）
Architecture cell: hub-ui (presentation layer)
Map delta: none
Why: Pure className string replacement — no new stores/queues/routers/adapters, no behavior change

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
1. `text-micro` = `font-size: 10px; line-height: 14px` vs `text-[10px]` = `font-size: 10px` only. The added line-height is design-system-intentional, but could cause subtle spacing changes in very tight layouts. Spot check a few dense pages (SessionChainPanel, HubTraceTree, WorkspacePanel).

### 价值 OQ（给 CVO，如有）
无

## Next Action

请 review code diff，确认 510 处全部正确替换且无遗漏/误替换。

## Review Sandbox（必填）
N/A — className-only bulk migration diff review, no runtime sandbox needed.

## 自检证据

### Spec 合规
- AC-L1 ~ AC-L3 全部覆盖（见 quality-gate report）
- Hotfix pattern: not a hotfix
- Fallback layers: net +0 (pre-existing patterns in touched files)
- Architecture mismatch scan: QueueEntryRow/ResolutionQueue in diff are className-only ✅
- Follow-up tail scan: CLEAN
- Root artifact hygiene: CLEAN (both working tree + committed diff)

### 测试结果
```
env -u NODE_ENV pnpm --filter @cat-cafe/web test  → 418 files, 3138 passed, 0 failed ✅
env -u NODE_ENV pnpm lint                          → 0 errors ✅
env -u NODE_ENV pnpm check                         → 0 errors ✅ (biome + guides + tails + primitives)
env -u NODE_ENV pnpm -r --if-present run build     → exit 0 ✅
```

### 相关文档
- Feature: `docs/features/F206-settings-ui-convergence.md`
- Issue: clowder-ai #723
- Prior Phase: PR #1814 (Phase K)

### 如果判断错了我最可能错在哪
1. `line-height: 14px` 增加可能让某些紧凑布局（HubTraceTree 20 处、SessionChainPanel 15 处、SchedulePanel 23 处）的行间距微变
2. 某些 `text-[10px]` 旁边可能有 `leading-*` class 覆盖 line-height——替换后 `text-micro` 的 line-height 是否会被后面的 leading-* 覆盖取决于 CSS specificity/顺序
3. Test selector 只找到 1 处 `.text-\\[10px\\]`，如果有其他测试通过 snapshot 或 string match 检查 className 可能遗漏
