---
capsule_id: "F188-2026-05-20"
context: "F188 Library Stewardship 完整交付：9 Phase（A-I，E superseded），14 PR"
feature_ids: [F188]
doc_kind: capsule
created: 2026-05-20
---

## What Worked

- GBrain teardown → 铲屎官原话驱动立项，scope 紧贴真实痛点（rebuild / health / graph / materialize / lifecycle），没有跑偏到"做 GBrain"
- Phase 拆分粒度合理：每个 Phase 独立可验收、独立 PR，最终 14 PR 全部 squash merge 无冲突
- 砚砚 local review 串行 → 云端 cloud review 的固定管线，每个 PR 都走完全流程，质量稳定
- Phase E 及时认清"手动 Pin 不现实"，CVO signoff superseded by F200，避免沉没成本
- Phase B → opus-47 愿景守护踢回 → Path A badge 修复 → 闭环：守护机制实际运作，没有走过场
- Collection lifecycle 状态机（Phase I）从铲屎官实操 `domain:finance` 暴露 CRUD 缺口开始，需求源自真实使用而非臆测
- getActionItems 复用已有 HealthReport 计算逻辑，badge 只是 UI 呈现层，zero new backend

## What Failed

- badge 测试首次写错断言（expected 5 got 3）：对 getActionItems 返回值理解有误（per-category 不是 per-count），Red→Green 本应先读源码再写断言
- vitest cache 隐藏新测试不运行（13/13 pass 但新增 2 个测试根本没跑），浪费一轮调试时间
- NODE_ENV=production worktree 缺 devDeps 问题再次出现（feedback memory 已有记录但没第一时间想到）
- pnpm gate 首次跑出 antigravity timing flake，虽然验证了是 pre-existing 但浪费了一轮门禁时间
- Phase C 到 Phase G 之间 graph_resolve response shape mismatch 上线后才被砚砚 dogfood 暴露——说明 MCP wrapper 的集成测试覆盖不够（只测了 happy path mock）

## Trigger Missed

- badge 的"现场可感知性"应该在 Phase B 原始 Design Gate 就触发（in-context-observability-checklist），而不是等 opus-47 愿景守护踢回才补。checklist 存在但没在 Phase B 执行
- getActionItems 的返回值语义（per-category vs per-count）应该在写测试前就 Read 源码确认，而不是先猜再改

## Doc Links

- Feature spec: `docs/features/F188-library-stewardship.md`
- Original discussion: `docs/discussions/2026-05-03-gbrain-deep-dive/README.md`
- Library architecture: `docs/discussions/2026-05-03-gbrain-deep-dive/library-architecture.md`
- In-context observability checklist: `cat-cafe-skills/refs/in-context-observability-checklist.md`
- F200 (supersedes Phase E): `docs/features/F200-memory-recall-eval.md`

## Rule Update Target

- `cat-cafe-skills/refs/in-context-observability-checklist.md`: 补一条"Health/Status dashboard 类 feature 必须同时规划 proactive surfacing（badge/notification/inline hint），不能只做 passive dashboard page"
- `quality-gate` skill Step 5 附近: 补提醒"测试断言值来自外部函数时，先 Read 该函数源码确认返回值语义"
