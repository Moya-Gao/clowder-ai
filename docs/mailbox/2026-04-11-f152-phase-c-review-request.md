---
doc_kind: mailbox
created: 2026-04-11
---

# Review Request: F152 Phase C — Global Lesson Distillation

Review-Target-ID: f152-phase-c
Branch: feat/f152-phase-c

## What

F152 Phase C 代码框架：跨项目经验回流管线。

- `EvidenceItem.generalizable` 字段 + schema V12 migration (DEFAULT NULL = fail-closed)
- `DeidentificationService`: regex 脱敏（项目路径→[PROJECT]、URL→[URL]、项目名 word-boundary 替换），保留技术术语
- `DistillationService`: 候选队列 nominate→pending→approve/reject→global store upsert
- 4 个 API endpoint: PATCH generalizable、POST nominate、POST review、GET candidates
- 3 个 MCP 工具: mark_generalizable / nominate_for_global / review_distillation
- 端到端集成测试: create→mark→nominate→deidentify→approve→global search

## Why

铲屎官愿景：猫在外部项目踩的坑能回流全局，下次去别的项目直接能用。Phase A/B 已做完冷启动扫描和 bootstrap，Phase C 补完经验回流管线。

## Original Requirements（必填）

> 铲屎官原话（F152 spec）："猫踩的坑能带回来下次用"
> 铲屎官补充（2026-04-10）："可以我们先把这些框架搭建好"
- 来源：`docs/features/F152-expedition-memory.md` Phase C section + 对话记录
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 候选队列用 in-memory Map 而非 SQLite 持久化表。理由：Phase C 是框架，后续可扩展为 SQLite 持久化（接口不变）
- SystemPromptBuilder 字符预算已满，未在 MCP_TOOLS_SECTION 内联工具描述。工具通过 MCP memoryToolset 自动发现

## Open Questions

1. **脱敏覆盖度**: 当前只处理路径/URL/项目名，人名等未覆盖。是否需要 Phase C 补充？
2. **候选持久化**: in-memory Map 重启丢失。Phase C 框架是否需要 SQLite 持久化？

## Next Action

请 review 代码质量 + 架构合理性。重点关注 DeidentificationService 的脱敏策略和 DistillationService 的审核流程。

## 自检证据

### Spec 合规

| AC | 状态 | 验证 |
|----|------|------|
| AC-C1 | ✅ | generalizable 字段 + PATCH API + MCP tool |
| AC-C2 | ✅ | DEFAULT NULL + rowToItem null→undefined + 测试 |
| AC-C3 | ✅ | DistillationService + API endpoints + MCP tools |
| AC-C4 | ✅ | DeidentificationService + 集成测试脱敏验证 |
| AC-C5 | ➖ | 合入后铲屎官手动体验 |

### 测试结果

```
API + MCP + Phase C tests → 407/407 pass, 0 fail
pnpm biome check → 2090 files, No fixes applied
pnpm lint → 0 errors
pnpm -r --if-present run build → exit 0
SystemPromptBuilder guardian → 76/76 pass
```

### 根目录工件闸门

```
git status --short | rg media → CLEAN
git diff --name-only origin/main...HEAD | rg media → CLEAN
```

### 相关文档

- Feature: `docs/features/F152-expedition-memory.md`
- Plan: `docs/plans/2026-04-10-f152-phase-c-global-distillation.md`

### 8 commits on branch

1. `ea9b7ea` generalizable field + schema V12 (AC-C1, AC-C2)
2. `4ee7b28` DeidentificationService (AC-C4)
3. `d2467ba` DistillationService candidate queue (AC-C3)
4. `f57d6e1` API endpoints (AC-C1, AC-C3)
5. `aeecc64` MCP tools (AC-C3)
6. `1d878bf` Integration test (all ACs)
7. `95a2ca2` Route wiring + factory globalStore
8. `fcf51a8` Biome formatting
