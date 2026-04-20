# Review Request: F148 Phase H — Artifact Deterministic Tracking

Review-Target-ID: f148-phase-h
Branch: feat/f148-phase-h

## What

Replace regex-based artifact detection with deterministic extraction from structured data:
- New `artifact-tracking.ts` module: `RecentArtifact` type + `extractRecentArtifacts` function
- `ThreadMemoryV1.recentArtifacts` field (backward compatible optional)
- SessionSealer extracts file artifacts at seal time → stored in ThreadMemory
- Navigation header + briefing card render artifact sections
- Regex fallback (`extractDecisionSignals.ARTIFACT_PATTERN`) preserved alongside

## Why

Gap N-4 from 3-cat roundtable: current artifact tracking in `extractDecisionSignals` relies on regex `\b(ADR-\d+|F\d{2,3})\b` which only catches Feature/ADR string references, misses files and PRs entirely. Phase H replaces this with deterministic extraction from `filesTouched` (session seal data) and PR tracking tasks (TaskStore).

## Original Requirements（必填）

> "我觉得感觉最重要的，增量上下文的传输" — 铲屎官 (2026-03-31)
> Phase H 具体来自 3 猫圆桌讨论的 gap N-4："artifact section 目前靠 regex，遗漏 PR/文件产物"
> 铲屎官拍板 G→H 优先级调整："G 好多都可能会是噪音"

- 来源：`docs/features/F148-hierarchical-context-transport.md` Phase H ACs + reprioritization note
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 不注入 `taskStore` 到 `SessionSealer`：file artifacts 在 seal time 提取，PR artifacts 在 routing time 从 live task data 提取。避免 sealer 膨胀，且 PR 状态在 routing 时更准确。
- Navigation header 仅展示 PR artifacts（因为 thread memory 在 header 组装后才加载）；briefing card 展示 PR + file artifacts 的完整合并。

## Open Questions

1. `updatedAt` 对 file artifacts 使用 `Date.now()` 而非文件实际修改时间（`filesTouched` 不携带时间戳）——是否足够精确？
2. 当前 `recentArtifacts` 添加到 `ThreadMemoryV1` 而非创建 `V2`——这是有意的向后兼容设计，V1 读入无 `recentArtifacts` 自然为 `undefined`。

## Next Action

请审查以下重点：
- `extractRecentArtifacts` 的 PR/file 分类逻辑是否覆盖所有路径类型
- `buildThreadMemory` 的 overwrite-vs-carry-forward 策略是否合理
- routing layer 的 stored artifact merge 逻辑（route-helpers.ts IIFE）是否干净

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f148-phase-h/codex`
- Start Command: `pnpm review:start`
- 纯后端逻辑改动，无前端 UI，reviewer 可通过 `pnpm --filter @cat-cafe/api test` 验证

## 自检证据

### Spec 合规

| AC | Status | Location |
|----|--------|----------|
| H1 | ✅ | `artifact-tracking.ts:1-8`, `ThreadStore.ts:69-77` |
| H2 | ✅ | `SessionSealer.ts:349-357`, `buildThreadMemory.ts:78-145` |
| H3 | ✅ | `navigation-context.ts:118-122` |
| H4 | ✅ | `format-briefing.ts:134-137` |
| H5 | ✅ | `extractDecisionSignals.ts:14` unchanged |
| H6 | ✅ | 16 new tests across 2 test files |

### 测试结果

```
Phase H tests: 42/42 pass, 0 failed
Extended suite (navigation + system-prompt-builder): 128/128 pass
Full regression: 8856 tests, 0 failures
pnpm lint → 0 errors
pnpm check → 0 errors (after check:fix for import ordering)
pnpm --filter @cat-cafe/api build → exit 0
```

### 相关文档

- Feature: `docs/features/F148-hierarchical-context-transport.md`
- Research: `docs/research/2026-03-31-hierarchical-context-transport-gpt-pro-consult.md`
