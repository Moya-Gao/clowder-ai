# Review Request: F076 Phase 1 — Cross-Project Tab + Need Audit MVP

## What

F076 Phase 1 完整实现：外部项目 Tab 系统 + Need Audit Pipeline (Stages 0-2) + Mission Hub 集成。

**后端 (4 commits)**:
- Shared types: `ExternalProject`, `IntentCard` (6-slot v2), `NeedAuditFrame`, `TriageResult`
- 3 in-memory stores: ExternalProjectStore, IntentCardStore (含 `computeBucket` triage 逻辑), NeedAuditFrameStore
- Fastify 路由: project CRUD, backlog import, intent card CRUD + triage, frame upsert/get
- BacklogItem 增加 `projectId?` 字段
- **45 API tests** (8 store + 19 card store + 5 frame store + 15 route incl. e2e)

**前端 (1 commit)**:
- Zustand store: `externalProjectStore`
- MissionControlPage: 动态项目 Tab + "导入项目" button
- 8 新组件: ImportProjectModal, ExternalProjectTab (3 sub-tabs), TranslationMatrix, IntentCardDetail, CreateIntentCardForm, NeedAuditFrame (Stage 0), GovernanceHealth, TriageBadge
- **15 frontend tests** (7 store + 8 TriageBadge)

**Total**: 14 new files, ~1800 lines, 60 tests

## Why

铲屎官的猫猫团队接外部甲方项目 (如 studio-flow)，需要在 Mission Hub 统一管理。甲方 PRD 质量参差不齐（"AI 写的许愿清单"），需要 Need Audit Pipeline 做需求降级 + 翻译 + 分类。

## Original Requirements（必填）

> "甲方根本就不知道自己想要啥...他给了一个他的 claude 写的需求 prd...一个不懂编程的人带着大猫猫传来一份不知道如何形容的 prd"
>
> "和自己的项目那种全盘掌控的感觉完全不一样！现在就感觉乱七八糟的"
>
> "原本的比如 mission → backlog md 导出的能力那些，跨界执法的时候是不兼容吗？还是也有那些能力？"（答：兼容，外部项目 Tab = Mission Hub 原有能力 + Need Audit 新能力融合）

- 来源：`docs/features/F076-mission-hub-cross-project.md` lines 20-30, 83-105
- 多猫讨论：`docs/discussions/2026-03-07-f076-need-audit-methodology/meeting-notes.md`
- GPT Pro 咨询：`docs/discussions/2026-03-07-f076-need-audit-methodology/gpt-pro-consultation.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **In-memory stores** (not Redis): Phase 1 scope, follow existing BacklogStore pattern. Redis persistence deferred to Phase 2.
- **No automated risk detection**: 8 risk signals are manual checkboxes in Stage 1. Heuristic auto-detection deferred.
- **No Stage 1.5 (Domain Pass)**: Plan explicitly excludes. Extensible for Phase 2.
- **Route file 225 lines**: slightly over 200-line warning, but splitting would create unnecessary indirection for tightly coupled CRUD.

## Open Questions

1. **A-tag hard gate logic**: `computeBucket()` always returns `validate_first` for `sourceTag='A'` regardless of scores. Is this too strict? Should high-score A-tagged cards be allowed into `clarify_first` instead?
2. **Sub-tab naming**: 現在是「需求追踪 / 治理健康度 / 功能列表」。Spec 还列了「风险预警」和「切片计划」(Phase 2)。Tab 名称合适吗？
3. **MissionControlPage 膨胀**: 692 lines（原来 ~632 + 我的 ~60）。是否需要提前拆分？

## Next Action

请 review 代码质量 + 愿景对齐。重点关注：
- `computeBucket()` triage 逻辑正确性
- A-tag hard gate 是否符合 GPT Pro 咨询结论
- 前端组件结构是否合理
- 类型安全（shared types → API → frontend 链路）

## 自检证据

### Spec 合规

11/11 原始需求项已实现（见 Quality Gate Report in session）。
Phase 1 scope 正确排除: Stage 1.5, Stage 3, Stage 4, Layer 5, auto risk detection.

### 测试结果
```
node --test test/{external-project,intent-card,need-audit-frame}-store.test.js test/external-project-routes.test.js
→ 45/45 pass, 0 fail ✅

npx vitest run triage-badge.test.ts external-project-store.test.ts
→ 15/15 pass ✅

pnpm --filter @cat-cafe/web build → exit 0 ✅
pnpm lint → 0 errors ✅
pnpm check (F076 files) → 0 errors ✅
tsc --noEmit (non-test) → 0 new errors ✅
```

### 相关文档
- Spec: `docs/features/F076-mission-hub-cross-project.md`
- Architecture: `docs/plans/2026-03-07-f076-need-audit-architecture.md`
- Plan: `docs/plans/2026-03-07-f076-phase1-cross-project-need-audit.md`
- Discussion: `docs/discussions/2026-03-07-f076-need-audit-methodology/`
- Feature: F076 / BACKLOG row 40
