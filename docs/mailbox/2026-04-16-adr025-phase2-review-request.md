---
doc_kind: mailbox
created: 2026-04-16
status: pending
---

# Review Request: ADR-025 Phase 2 — Stale Detection + Conflict Resolution

Review-Target-ID: adr025-phase2
Branch: feat/adr025-phase2

## What

ADR-025 Phase 2 implementation: stale detection + skill conflict resolution.

**Backend (5 new/modified files, 35 new tests):**
- `skills-state.ts`: `checkStaleness()` + `listSourceSkillNames()` — detect when managed skills are out of date
- `skill-conflict.ts`: `detectConflicts()` — find same-name skills across user/project layers with different realpath targets
- `skill-sync.ts`: `syncSkills()` + `resolveConflict()` — create/fix/remove per-skill symlinks, update state file
- `skill-parse.ts`: Extracted parsing helpers from skills route (file size hygiene)
- `skills.ts`: Extended GET /api/skills with `staleness` + `conflicts` fields; added POST /api/skills/sync and POST /api/skills/resolve-conflict

**Frontend (1 modified file):**
- `HubSkillsTab.tsx`: Stale banner (blue info, +N new skills, sync button) + conflict cards (amber, official/mine choice buttons) + toast notifications

## Why

Closes AC2 + AC4 from clowder-ai#386. ADR-025 §4 mandates "choice card, not red error" for conflicts. §5b mandates "gentle notification + one-click sync" for staleness. Without Phase 2, checkout drift between A/B repos silently mixes two skill trees with no user-visible signal.

## Original Requirements（必填）

> ADR-025 §4: "同名冲突处理：不是红灯报错，而是给用户选择卡片"
> ADR-025 §5b: "Stale 时 Hub 不弹红色警告，而是显示温和的上新通知 + 一键同步按钮"
> clowder-ai#386 AC2: "用户级和项目级同名 skill 如同时存在，系统能检测并报告 target 不一致"
> clowder-ai#386 AC4: "A/B checkout 切换后，不会让旧项目静默混用两棵 skill tree"

- 来源：`docs/decisions/025-skills-canonical-mount-policy.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Symlink targets use absolute paths (not relative like `sync-skills.sh`). Reason: the TypeScript sync service runs server-side where absolute paths are reliable. The bash script still handles relative paths for git-tracked directories.
- `skill-parse.ts` extraction: moved 100+ lines of parsing helpers out of the route file to stay within the 350-line hard limit. No logic change, pure refactor.

## Open Questions

1. **P1 review focus**: `resolveConflict('mine')` removes project-level symlinks and updates `managedSkillNames`. Is the state file update safe if multiple providers fail partially? (Current impl: sequential removal, state write at end)
2. `conflicts` field defaults to `[]` from the API. Frontend uses `data.conflicts?.length` guard for backward compat. Is this sufficient?
3. File size: `HubSkillsTab.tsx` is now 328 lines (under 350 limit but close). Task 6+7 could be extracted to separate components if reviewer prefers.

## Next Action

请 review 代码质量 + 愿景对照。前端有 UI 改动（stale banner + conflict cards），请用 Playwright/Chrome 验证交互。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/adr025-phase2/codex`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`（禁止 3001/3002/3011/3012/4111）

## 自检证据

### Spec 合规

Quality Gate PASS — 4 ACs all covered:
- AC2 (#386): detectConflicts() with 6 tests
- AC4 (#386): checkStaleness() with 4 tests
- §4: ConflictCard with amber styling, choice buttons (not red error)
- §5b: StaleBanner with blue info styling, sync button

### 测试结果

```
node --test test/governance/*.test.js → 111 passed, 0 failed
pnpm --filter @cat-cafe/web test     → 2197 passed, 0 failed
pnpm lint                            → 0 errors
npx biome check                      → 0 errors (3 pre-existing warnings)
pnpm -r --if-present run build       → exit 0
```

### 相关文档

- Plan: `docs/plans/2026-04-16-adr025-phase2-stale-detection-conflicts.md`
- ADR: `docs/decisions/025-skills-canonical-mount-policy.md`
- Issue: clowder-ai#386
