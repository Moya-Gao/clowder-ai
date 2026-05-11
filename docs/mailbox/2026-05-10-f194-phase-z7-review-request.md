# Review Request: F194 Phase Z7 live-only provisional duplicate cleanup

Review-Target-ID: f194-phase-z7
Branch: feat/f194-phase-z7
Commit: 27d9b4b60

## What

Z7 修的是铲屎官 18:12 现场确认的 live-only residue：同一 assistant response 在 live state 里裂成 canonical stream bubble + local-only provisional duplicate；F5 后 `/messages` hydrate 正常，只剩 canonical bubble。

核心改动：
- `bubble-reducer.ts` 新增 terminal reconcile：`done` / exact-key `callback_final` 命中 canonical sibling 后，删除同 cat、同 terminal 时间之前的 local-only `origin='stream'` provisional siblings。
- 新增两条 RED tests：删除 older duplicate；保留 timestamp 晚于 terminal 的 next-turn local placeholder。
- F194 spec 增加 Phase Z7 / AC-Z19 / R11。

## Why

Z5/Z6 已经让 rich/audio late event 和 fallback 语义收敛，但这次截图证明 live reducer 还有一个终态收敛缺口：canonical bubble 已存在时，terminal event 只 finalize canonical，不清理更早的 local-only stream sibling。因为 hydrate 只返回 canonical，F5 能恢复；所以修点应在 live terminal reducer path，而不是缓存或后端持久化。

## Original Requirements（必填）

> "我确认了一下 live state 残留 f5之后就正常了，你看这里opus46 变成两个了。 而且你自己现在也是裂开的"
> "还是裂开的，而且也没合并起来，是需要我清理缓存 强制刷新一次吗？"

- 来源：thread alpha re-test 2026-05-10 18:10~18:12；已同步到 `docs/features/F194-invocation-liveness-canonical-read-model.md` R11
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

没有恢复 Z4 那种 helper-id 对齐路线；仍保持 F183/ADR-033 的 reducer single-writer。Z7 只在 terminal event 已确认 canonical sibling 存在时清理 local-only stream sibling：
- 有 canonical sibling 才清，避免误删独立 local stream。
- 只清 `origin='stream'` 且无 stable invocation key 的 sibling，避免删掉正式 callback / history bubble。
- timestamp 晚于 terminal event 的 local-only bubble 保留，避免误伤下一轮。

## Architecture Ownership（必填）

Architecture cell: `bubble-pipeline`
Map delta: none
Why: 只收紧既有 BubbleReducer terminal reconcile 行为，没有新增并行 Store / Queue / Router / Adapter / Dispatcher / Binding，也不改变 ownership 边界。

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 是否仍符合 F183/ADR-033 reducer single-writer contract

## Open Questions

### 技术 OQ（给 reviewer）

1. `dropLocalOnlyStreamSiblings` 的清理条件是否够窄：canonical sibling required + same cat + origin stream + no stable key + timestamp <= terminal。
2. `callback_final` 只在 exact-key existing path 做清理，没有在 callback 创建新 canonical 时清理。我的判断是保守正确：避免把 contentful invocationless live stream 被新 callback hijack。
3. 如果 old local-only stream sibling 来自更早 invocation 但一直没清，terminal canonical sibling 出现时一并清掉是否符合 "live converges to hydrate" contract。

### 价值 OQ（给 CVO，如有）

无。

## Next Action

请 Opus-47 做 Z7 review。重点看 terminal cleanup 是否会误删下一轮或独立 local-only stream；通过后我走 merge-gate：PR → cloud review → squash → alpha re-test。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f194-phase-z7/opus-47`
- Start Command: `pnpm review:start`（本轮是 reducer/spec review，不需要启动前端也可完成）
- Ports: `pnpm review:start` 自动分配；若不启动前端则 N/A

## 自检证据

### Spec 合规

- F194 spec 已新增 Phase Z7 / AC-Z19 / R11。
- `docs/features/index.json` 已 regenerated。

### 测试结果

```bash
NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run \
  src/stores/__tests__/bubble-reducer.test.ts \
  src/stores/__tests__/bubble-invariants.test.ts \
  src/hooks/__tests__/useAgentMessages-richblock-correlation.test.ts \
  src/hooks/__tests__/useAgentMessages-background-system-info-web-search.test.ts
# 4 files / 103 tests passed

pnpm --filter @cat-cafe/web run test
# 388 test files / 2956 tests passed
# next-config node test: 5 passed
# no-hardcoded-colors: passed

pnpm check
# passed
```

### 相关文档

- Feature: `docs/features/F194-invocation-liveness-canonical-read-model.md`
- Architecture cell: `docs/architecture/ownership/cells/bubble-pipeline.md`
