---
doc_kind: review-request
feature_ids: [F206]
phase: K
author: opus-47
reviewer: codex
created: 2026-05-20
---

# Review Request: F206 Phase K — Hub residual mini sweep

Review-Target-ID: f206
Branch: fix/f206-phase-k

## What

Phase J post-merge audit（砚砚）identified ~27 real UI hex across 5 Hub files + 3 files needing exempt annotations. This phase migrates them all.

Changes:
- **16 new `--hub-*` CSS tokens** in `console-shell.css` (light + dark mode) — tag palette (green/orange/purple bg+text+border), alert system (success/warning), input focus ring, shadow tokens, leaderboard error-bg
- **5 files migrated**: HubLeaderboardTab (7 hex), hub-tag-editor (tag pill + input + add-button), hub-cat-editor-advanced (12 hex), HubConnectorConfigTab + HubPermissionsTab (rgba shadows → `--hub-shadow`/`--hub-shadow-hover`)
- **3 files exempt-annotated**: HubConfigIcons (connector/icon palette), HubMemberOverviewCard (coCreator config defaults), HubObservabilityTab (data-viz chart stroke)

Token count: 45 (Phase J) + 16 (Phase K) = 61 hub-* semantic tokens total.

## Why

clowder-ai #723 visual residual convergence. Continuing the raw-hex → semantic-token sweep per CVO directive (KD-1: fast path, no cloud review).

## Original Requirements（必填）
> 砚砚 Phase J post-merge audit: "Hub-ish raw color still has ~55 matches, ~31 are real UI chrome. Suggest inserting Phase K: Hub residual sweep before text-micro."
> Migration targets: HubLeaderboardTab (9 places), hub-tag-editor (6 places), hub-cat-editor-advanced (12 places), HubConnectorConfigTab+HubPermissionsTab (4 rgba shadow)
> Exempt candidates: HubConfigIcons (connector/icon palette), HubMemberOverviewCard (coCreator config), HubObservabilityTab (data-viz chart stroke)
- 来源：砚砚 A2A audit message (Phase J post-merge, 2026-05-20)
- **请对照上面的审计清单判断是否全部覆盖**

## Tradeoff

Reused existing tokens where exact color match existed (e.g., `#FFF4EC` → `--hub-surface-accent`). Purple tag pills got dedicated `--hub-tag-purple-bg/text` tokens (same values as quota but semantically independent, per R2 review).

## Architecture Ownership（必填）
Architecture cell: hub-ui (presentation layer)
Map delta: none
Why: Pure CSS token replacement — no new stores/queues/routers/adapters, no behavior change

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
1. Shadow tokens store full `box-shadow` values (not just color) — `--hub-shadow: 0 12px 30px rgba(43,33,26,0.08)`. Used via `shadow-[var(--hub-shadow)]`. Reviewer confirmed acceptable granularity (R2).
2. ~~Tag editor quota token reuse~~ → Resolved in R2: dedicated `--hub-tag-purple-bg/text` tokens added.

### 价值 OQ（给 CVO，如有）
无

## Next Action

请 review code diff，确认 27 处 hex 全部正确映射到 semantic tokens，exempt 标注合理。

## Review Sandbox（必填）
N/A — CSS-only token migration diff review, no runtime sandbox needed.

## 自检证据

### Spec 合规
- AC-K1 ~ AC-K7 全部覆盖（见上方 quality-gate report）
- Hotfix pattern: not a hotfix
- Fallback layers: none detected
- Architecture mismatch scan: no new architecture names in diff
- Follow-up tail scan: CLEAN
- Root artifact hygiene: CLEAN (both working tree + committed diff)

### 测试结果
```
env -u NODE_ENV pnpm --filter @cat-cafe/web test  → 3138 passed, 0 failed ✅
env -u NODE_ENV pnpm lint                          → 0 errors ✅
env -u NODE_ENV pnpm check                         → 0 errors ✅ (biome + guides + tails + primitives)
env -u NODE_ENV pnpm -r --if-present run build     → exit 0 ✅
no-hardcoded-colors lint rule                      → all passed ✅
```

### 相关文档
- Feature: `docs/features/F206-settings-ui-convergence.md`
- Issue: clowder-ai #723
- Prior Phase: PR #1813 (Phase J)

### 如果判断错了我最可能错在哪
1. Dark mode `color-mix()` 比例可能偏亮/暗（未做像素级 dark mode 截图对比）
2. ~~Quota token coupling~~ → Resolved in R2 (dedicated purple tag tokens)
3. Shadow token 存储完整 box-shadow 值——Tailwind 的 `shadow-[var()]` 语法可能在某些 build 配置下解析不同
