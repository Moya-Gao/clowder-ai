# Review Request: intake(clowder-ai#536) F076 external project persistence recovery

Review-Target-ID: intake-clowder-536
Branch: fix/intake-clowder-536

## What
- absorb `clowder-ai#536` into cat-cafe for F076 external-project persistence and import visibility recovery
- persist `ExternalProjectStore` in Redis with transactional create semantics
- restore `projectId` persistence in `RedisBacklogStore`
- switch external-project route ownership checks to async store lookups
- preserve historical orphan rows while creating a project-bound replacement so imported features become visible again without rebinding ambiguous orphan history
- surface orphan detection feedback in Mission Control import status
- absorb upstream regression tests for route behavior, Redis persistence, and transactional create

## Why
- `clowder-ai#535` exposed two real regressions in the shared F076 flow:
  - imported features disappeared because Redis persistence dropped `projectId`
  - imported project metadata disappeared after restart because `ExternalProjectStore` was memory-only
- upstream follow-up commit `e0ea92ab` also closed the maintainer blocker around historical orphan recovery: it restores visibility without rewriting ambiguous orphan rows onto the wrong project

## Original Requirements（必填）
> “F076 的 UI 不是独立面板/dashboard，必须集成到现有 Mission Hub 的 Tab 体系中。”
> “外部项目 Tab 内首先展示该项目的 backlog，实现跨项目 backlog 可视化对齐。”
> 外部触发 bug：`clowder-ai#535` — imported features not displayed + projects lost after reset
- 来源：`docs/discussions/2026-03-07-f076-need-audit-methodology/meeting-notes.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 历史 orphan 行仍然保留原样，不在 import 热路径里自动 rebinding；当前策略是“保留证据 + 为当前项目创建可见 replacement”
- 这样避免跨项目误绑，但后续如果要清理 orphan，需要单独 cleanup / migration 路径
- 本次 intake 只吸收 `intake-from-opensource --mode=plan` 判定为 `safe-cherry-pick` 的 13 个文件，不扩展到其他 F076 整理

## Open Questions
- 请重点确认最新 orphan-recovery 路径在 cat-cafe 里是否与 upstream `e0ea92ab` 等价，没有额外 broaden F076 scope
- 请对照 `cat-cafe#1345` 的逐文件决策表确认 absorb diff 完整，不漏 file、不多吸 brand-sensitive 文件

## Next Action
- 请 review `cat-cafe#1346` 当前 HEAD，确认吸收质量和行为等价；如果通过，请在 PR 上留下 formal review comment 覆盖当前 HEAD SHA

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/intake-clowder-536/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- Feature: `docs/features/F076-mission-hub-cross-project.md`
- Intake Intent Issue: `cat-cafe#1345`
- Source PR: `clowder-ai#536`
- intake plan 结果：13 files 全部 `safe-cherry-pick`，无 `manual-port` / `public-only`
- inbound brand guard：`bash scripts/intake-from-opensource.sh --validate-inbound` ✅

### 测试结果
- `pnpm --dir packages/api run build` ✅
- `pnpm --dir packages/web exec tsc --noEmit` ✅
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test --test-timeout=60000 packages/api/test/external-project-routes.test.js packages/api/test/external-project-store.test.js packages/api/test/backlog-store.test.js`  # 66 passed, 0 failed
- `REDIS_URL=redis://127.0.0.1:6398/15 CAT_CAFE_REDIS_TEST_ISOLATED=1 node --test packages/api/test/external-project-store.redis.test.js`  # 5 passed, 0 failed
- `pnpm exec biome check packages/api/src/routes/external-projects.ts packages/api/test/external-project-routes.test.js packages/api/test/external-project-store.test.js packages/web/src/components/mission-control/ExternalProjectTab.tsx --diagnostic-level=error` ✅
- `pnpm check` ✅
- `pnpm lint` ✅ (warnings only, exit 0)

### 相关文档
- Feature: `docs/features/F076-mission-hub-cross-project.md`
- Discussion: `docs/discussions/2026-03-07-f076-need-audit-methodology/meeting-notes.md`
- Intake Intent Issue: `#1345`
- Source PR: `clowder-ai#536`
