# Review Request: F199 D-2 SkillsContent Read-Mostly Backfill

Review-Target-ID: f199
Branch: feat/f199-skills-content

## What

Ports the read-mostly Skills settings surface for F199 D-2:

- Adds `packages/web/src/components/settings/SkillsContent.tsx`.
- Wires `/settings?s=skills` from the old `HubSkillsTab` write-capable surface to the new read-mostly `SkillsContent`.
- Reuses existing read APIs only: `GET /api/skills` and `GET /api/rules/skill/:id`.
- Adds focused tests for Skill list rendering, category filtering, SKILL.md preview, and no write-action buttons.
- Adds visual parity proof and User Visibility Disclosure under `docs/discussions/2026-05-13-f199-d2-skills-content-proof/`.
- Adds F199 Architecture cell declaration (`action-plane`, `Map delta: none`) so request-review has a durable spec anchor.

## Why

F199 is the post-F190 parity backfill after CVO found that the closed F190 intake had user-visible settings surface gaps. D-2 specifically backfills the read part of open-source `SkillsContent` without reopening the high-risk skill write/uninstall path.

## Original Requirements（必填）

> "图1是开源的 图2是我们的 这里能证明 你们只是调整了样式 其实很多东西都丢了？"
> "走 Phase D 用 -> 完整 backfill 7 个组件"

- 来源：`docs/features/F199-console-parity-backfill.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官指出的 settings parity gap**

## Tradeoff

- Ported: Skill list, category/text filtering, passive mount/MCP dependency visibility, staleness/conflict visibility, and SKILL.md preview.
- Deliberately not ported: external skill uninstall, per-cat/global toggles, sync, conflict resolve, MCP repair/install actions.
- Reason: D-2 is the read-mostly validation slice. Write/delete/repair paths need separate auth and hardening, and remain covered by the five-slice F199 plan accepted by CVO on 2026-05-13.

## Architecture Ownership（必填）

Architecture cell: action-plane
Map delta: none
Why: This only changes an existing Console settings visibility surface and does not add a new action owner, Store, Queue, Router, Adapter, Dispatcher, Binding, or capability writer.

请 reviewer 检查：

- diff 是否与 `Map delta: none` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- read-mostly boundary 是否被 tests + UI copy 锁住

## Open Questions

### 技术 OQ（给 reviewer）

- 新 `SkillsContent` 是否正确保留 source intent 的 read/list/preview/filter 部分？
- Settings skills section 从 `HubSkillsTab` 切到 `SkillsContent` 是否干净，不破坏旧 HubSkillsTab 的现有测试和保留代码？
- User Visibility Disclosure 是否清楚说明了 write controls 的 deliberate defer？

### 价值 OQ（给 CVO，如有）

无。CVO 已在 2026-05-13 接受完整五刀 F199 backfill 计划；D-2 的 write control defer 是该计划内的技术分层。

## Next Action

请 Opus 4.7 review D-2。重点看 parity proof、read-only 边界、Settings wire、测试覆盖和是否需要补 P3。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f199/opus-47`
- Start Command: `pnpm review:start`（或在本 branch 运行 focused tests + Playwright proof）
- Proof Ports: `source web=3101`（clowder-ai dev，由 CVO 要求保留）, `home web=5112`（worktree web-only dev，已停止）, `api=mocked by Playwright routes`

## 自检证据

### Spec 合规

| Check | Status | Evidence |
|---|---|---|
| F199 D-2 scope | ✅ | Skill list + preview + filter ported; external uninstall not ported |
| Visual parity gate | ✅ | `docs/discussions/2026-05-13-f199-d2-skills-content-proof/assets/side-by-side-skills-content.png` |
| User Visibility Disclosure | ✅ | `docs/discussions/2026-05-13-f199-d2-skills-content-proof/README.md` |
| Console logs during proof | ✅ | `capture-log.json` has empty `logs` for source and home |
| Red-zone files | ✅ | diff path grep for F183/F184/F194 chat/bubble/read-model files returned no output |
| Architecture ownership | ✅ | `check:architecture-ownership` exits 0; F199 no longer appears in missing-cell warnings |
| Root artifact guard | ✅ | root media/design artifact checks returned no output |
| Design .pen check | ✅ | `find designs -name '*.pen' | rg -i 'f199|skills|skill|settings'` returned no output |

### 测试结果

```bash
NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/skills-content.test.tsx src/components/__tests__/hub-skills-tab.test.tsx src/components/__tests__/hub-skills-install-missing.test.tsx
# Test Files 3 passed; Tests 7 passed

pnpm biome check packages/web/src/components/settings/SkillsContent.tsx packages/web/src/components/settings/SettingsContent.tsx packages/web/src/components/__tests__/skills-content.test.tsx docs/discussions/2026-05-13-f199-d2-skills-content-proof/README.md --diagnostic-level=error
# Checked 3 files. No fixes applied.

pnpm --filter @cat-cafe/web exec tsc --noEmit --project tsconfig.json
# exit 0

git diff --check
# exit 0

node scripts/check-hotfix-pattern.mjs
# hotfix=false

node scripts/check-fallback-layers.mjs
# SkillsContent +2, tests +1; below per-file threshold, no self-check block

pnpm check:architecture-ownership
# exit 0, warning-only; F199 missing-cell warning resolved

pnpm check:features
# PASS check-feature-truth
```

### 相关文档

- Feature: `docs/features/F199-console-parity-backfill.md`
- Proof: `docs/discussions/2026-05-13-f199-d2-skills-content-proof/README.md`
- Source target: `clowder-ai/packages/web/src/components/settings/SkillsContent.tsx`
- Home target: `packages/web/src/components/settings/SkillsContent.tsx`
