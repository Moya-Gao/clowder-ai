---
feature_ids: [F102]
type: review-request
author: opus
reviewer: codex
created: 2026-03-16
---

# Review Request: F102 Phase D-1a — Hindsight Runtime Cleanup

## What

Hindsight 运行链路全量清理：factory 只留 sqlite 路径，所有 routes 的 Hindsight fallback 删除，HindsightClient + HindsightAdapter 删除。

16 files changed, +113/-867 lines。纯删除型重构，无新功能。

核心变更：
- `factory.ts`: `MemoryConfig.type` 只有 `'sqlite'`，删除 `createHindsightServices()`
- `evidence.ts` / `reflect.ts` / `callback-memory-routes.ts` / `callbacks.ts`: 删除所有 Hindsight fallback 分支，`evidenceStore`/`reflectionService` 从 optional 变 required
- `evidence-helpers.ts`: 删除 `memoryToResult()` + HindsightError 相关逻辑
- `index.ts`: 删除 `createHindsightClient` + `EVIDENCE_STORE_TYPE` 条件判断，直接初始化 SQLite
- 删除 `HindsightAdapter.ts` + `HindsightClient.ts`
- 清理 barrel exports

## Why

Hindsight 已废弃，但代码仍在（~50 files）。factory 里 `hindsightClient ? 'hindsight' : 'sqlite'` 让 SQLite 不是真默认而是 fallback。双轨并存阻碍 F102 Phase D 后续工作（auto-rebuild、MCP 收敛、提示词集成）。

## Original Requirements（必填）

> 铲屎官原话："你们现在的 memory 有没有把 Hindsight 给去掉？因为我们其实现在已经不依赖这玩意儿了，这东西得去掉。"
> 铲屎官补充："面向终态设计，不要搞中间态脚手架。"

- 来源：对话历史 2026-03-14 + `docs/features/F102-memory-adapter-refactor.md` L22
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

| 方案 | 选择 | 原因 |
|------|------|------|
| 保留 Hindsight 作为 fallback | ❌ | 铲屎官明确说不要了 + 双轨维护成本 |
| 一次性删全部（runtime + config + legacy） | ❌ | 三层拆解降低风险（两猫共识 KD-27） |
| 只删 runtime 层，config 和 legacy 后续 PR | ✅ | runtime 是最关键的，切断后其他两层可安全删 |

## Open Questions

1. `hindsight-import/p0-importer.ts` 内联了 `RetainItem`/`RetainOptions` 类型（原来从 HindsightClient 导入）。P0 import 脚本已废弃，但保留了兼容存根。D-1c 会清理。
2. `hindsight-import-p0.ts` script 的 `createHindsightClient()` 被 stub 为 `null` + runtime error。D-1c 会删除整个 script。

## Next Action

请做 P0/P1 审查。重点关注：
- SQLite 路径是否完整接管（没有断链）
- route options 从 optional 变 required 是否安全（DI 注入点是否都传了值）
- barrel exports 清理是否干净

## 自检证据

### Spec 合规

AC-D1 满足：运行链路中无 Hindsight 调用分支，factory 只有 `sqlite` 路径。

### 测试结果

```
pnpm --filter @cat-cafe/api run build   → exit 0 ✅
node --test packages/api/test/memory/*.test.js → 139/139 pass, 0 fail ✅
```

（141 - 2 deleted Hindsight-specific factory tests = 139）

### 相关文档

- Spec: `docs/features/F102-memory-adapter-refactor.md`
- Plan: `docs/plans/2026-03-16-f102-phase-d1-hindsight-cleanup.md`
- Discussion: `docs/discussions/2026-03-14-f102-activation-meeting-notes.md`

### 分支信息

- Branch: `feat/f102-phase-d`
- Worktree: `cat-cafe-f102-phase-d`
- Commits: 1 (`23f5457a`)
- Diff: `git diff --stat origin/main..feat/f102-phase-d`
