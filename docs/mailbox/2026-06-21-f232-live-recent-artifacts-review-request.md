---
doc_kind: review_request
feature_ids: [F232]
reviewer: opus
author: gpt52
created: 2026-06-21
---

# Review Request: F232 live recent artifacts before session seal

Review-Target-ID: f232
Branch: fix/f232-live-recent-artifacts

## What

Patch `assembleIncrementalContext()` so live file writes from the active session
show up immediately in navigation / artifact consumers, instead of waiting for
session seal.

Core diff:
- `route-helpers.ts` adds `resolveRecentFilesTouched()` and uses it when
  `recentFilesTouched` was not passed by the caller
- `TranscriptWriter.ts` exposes `getFilesTouched(sessionId)` and reuses the same
  file-op extraction logic for both live buffer reads and seal-time digest generation
- `f232-live-recent-artifacts.test.js` locks the regression:
  live fallback works, explicit override still wins

Commit under review: `b4d816032`

## Why

Current-session write ops only reached the file artifact ledger through
`SessionSealer` -> digest -> `buildThreadMemory()`. During an active session,
both the navigation header and the thread artifacts panel could stay stale,
including the "文件 0" failure mode from the bug brief.

## Original Requirements（必填）
> "F148 Phase H 建了 `recentFilesTouched` 参数……从未有任何调用方传入这个参数，永远 fallback 到空数组。"
> "活跃 session 文件不进 ledger = 面板显示'文件 0'。"
> "在路由层……从当前 session 的 transcript buffer 实时读 `filesTouched` 并传入 `recentFilesTouched`。"
- 来源：跨线程 bug brief（source thread `thread_mqcbdk4olvi4cval`, message `0001782095863960-000138-6098498b`）
- **请对照上面的摘录判断交付物是否真的修到了"活跃 session 可见"这条核心要求**

## Tradeoff

- 选择把 live fallback 放进共享的 `assembleIncrementalContext()`，而不是分别在
  `route-serial.ts` / `route-parallel.ts` 接一遍，代价是 route helper 对
  `sessionChainStore + transcriptWriter` 的读取更隐式；收益是 serial/parallel
  自动共享同一条修复路径，不会再二次漂移。
- fail-open 处理 active session lookup / transcript read：拿不到 live buffer 时回到
  旧行为，不阻塞调用。

## Architecture Ownership（必填）
Architecture cell: `routing`
Map delta: none
Why: 只扩展现有 incremental-context / transcript-buffer 读取路径，不新增并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- live fallback 放在 route helper 而不是 callsite，是否会引入 session lookup 语义偏差

## Open Questions

### 技术 OQ（给 reviewer）
1. `resolveRecentFilesTouched()` 走 `sessionChainStore.getActive(catId, threadId)` 是否覆盖了你预期的 resume / parallel / reborn 边界？
2. `TranscriptWriter.getFilesTouched()` 复用 seal-time file-op 识别逻辑后，有没有遗漏当前实现支持但 live path 看不到的 tool name / input shape？

### 价值 OQ（给 CVO，如有）
无

## Next Action

请直接 review `fix/f232-live-recent-artifacts` 分支，重点看：
- live fallback 是否真正打通 F232/F148 的 active-session 可见性
- explicit `recentFilesTouched` override 优先级是否保持正确
- 有没有把原本只该在 seal-time 出现的副作用提前了

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f232/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`（默认起点；若 review sandbox allocator 发生偏移，请在 verdict 里记实际端口）

## 自检证据

### Spec 合规
- F232 相关真相源：`docs/features/F232-thread-artifacts-panel.md`
- 相关基础：`docs/features/F148-hierarchical-context-transport.md`
- 本 patch 不改 feature scope，只修 active-session artifact visibility 断点

### Dogfood-Your-Slice
Scope verdict: ✅ 必做

端到端路径: active session transcript buffer -> `assembleIncrementalContext()` -> navigation header recent artifacts

实际验证:
- 新增回归测试直接构造 active `SessionChainStore` + `TranscriptWriter` buffer
- 断言 live edited file 进入 `navigationHeader` / `contextText`
- 断言 read-only file 仍被排除
- 断言 caller 传入 `recentFilesTouched` 时显式 override 仍优先

发现的 bug: 无新增 dogfood bug

### 测试结果
```bash
pnpm --filter @cat-cafe/api run build
# success

cd packages/api && bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/f148-artifact-tracking.test.js test/f148-assemble-incremental.test.js test/f232-live-recent-artifacts.test.js
# 55 passed, 0 failed

pnpm --filter @cat-cafe/api lint
# tsc --noEmit -> ok

pnpm check
# exit 0
```

### Artifact Hygiene
- `git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` -> no hits
- `git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` -> no hits

### Hotfix / Worktree
- `node scripts/check-hotfix-pattern.mjs --branch fix/f232-live-recent-artifacts` -> `hotfix=false`
- author worktree clean after commit: `git status --short` -> clean

### 相关文档
- Feature: `docs/features/F232-thread-artifacts-panel.md`
- Related: `docs/features/F148-hierarchical-context-transport.md`
