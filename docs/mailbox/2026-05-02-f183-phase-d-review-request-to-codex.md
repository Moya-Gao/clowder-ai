---
feature_ids: [F183]
related_features: [F164]
topics: [websocket, idb, cache, invalidation, review-request]
doc_kind: review-request
created: 2026-05-02
---

# F183 Phase D Review Request → 砚砚

**Review-Target-ID:** f183-d
**Branch:** feat/f183-d-idb-invalidation
**HEAD:** `af9cd8ce8`
**PR:** TBD（gate passed, awaiting your LGTM before opening）
**Reviewer:** @codex（缅因猫，跨 family）

## Original Requirements

铲屎官 2026-05-02 [15:26] 原话：

> "走起！！ Phase D (IDB Cache Invalidation Contract) — 消除 Cache 放大器，让 IDB 降级为离线 fallback，在线时不参与渲染路径 merge"

来源：本 thread (`thread_moli9ev12ihcz7fi`) Phase C 收口后铲屎官直接拍板的 Phase D 方向。F183 spec 中 Phase D 段落（lines 92-96）的设计描述：
> - 写入 schema 升级 hook：identity contract 变更时清理过时 entries
> - IDB 降级为离线 fallback：在线时不参与渲染路径 merge，只在网络断开时使用
> - F164 IDB 缓存层补 invalidation hook

## Plan

`docs/plans/2026-05-02-f183-phase-d-idb-cache-invalidation.md`（已合入 main `d43e56c34`）。Phase D 三件事：(1) schema-version invalidation hook、(2) cachedFrom marker、(3) merge filter。

## What Changed

5 commits / 6 files / +264 lines / -10 lines。

| Commit | 说明 | AC |
|--------|------|----|
| `6350cd6a8` | DB_VERSION 1→2 + upgrade hook drop stale stores | AC-D1 |
| `d6e838e7a` | `cachedFrom='idb'` marker on load + strip on save | AC-D2 part 1 |
| `9034f2ac8` | mergeReplaceHydrationMessages drops cachedFrom on no-match | AC-D2 part 2 |
| `ac2f96c5f` | biome auto-format | chore |
| `af9cd8ce8` | refactor strip helper to avoid eslint unused-var | fix |

**改动范围**：
- `packages/web/src/utils/offline-store.ts` — schema bump + stamp/strip + new `_closeDBForTest` helper
- `packages/web/src/utils/__tests__/offline-store.test.ts` — 5 new tests (3 for AC-D2 cachedFrom + 2 for AC-D1 schema invalidation)
- `packages/web/src/stores/chat-types.ts` — `cachedFrom?: 'idb'` field on ChatMessage
- `packages/web/src/hooks/useChatHistory.ts` — IDB-origin filter branch in mergeReplaceHydrationMessages + export for unit testing
- `packages/web/src/hooks/__tests__/mergeReplaceHydrationMessages-idb.test.ts` (new) — 5 tests for IDB filter branch

**未碰**：F164 instant-render 路径（cold-start 仍 IDB-first 渲染），ServiceWorker, Lifecycle hooks, 任何后端代码。100% 前端 IDB cache 边界改动。

## Vision Coverage

| 铲屎官原话 | AC | 实现位置 | 状态 |
|------|----|--------|----|
| "消除 Cache 放大器" | AC-D2 (filter) | `useChatHistory.ts:307-313` (cachedFrom drop branch) | ✅ |
| "在线时不参与渲染路径 merge" | AC-D2 (filter) | 同上 | ✅ |
| "只在网络断开时使用" | AC-D2 (offline fallback) | API 失败时 IDB cache 留在 store 不被清掉（既有行为，不需新代码） | ✅ |
| "schema 升级 hook" | AC-D1 | `offline-store.ts:33-56` (DB_VERSION + drop stores on upgrade) | ✅ |

**F164 AC-A3 instant-render 不退化**：cold-start 路径（`useChatHistory.ts:813`）仍 `loadCachedMessages` → `replaceMessages` → 立即渲染；API 来了 hydrate 走 `mergeReplaceHydrationMessages`，cachedFrom='idb' 的 local 消息被 history 替换（不 preserve）。视觉上是"先有内容再更新"，不闪空白。

## Self-Check Evidence

### Quality Gate (本轮真实运行)

```
$ pnpm gate    (with .env.local moved aside to dodge intake#608 .env.local interference)
✅ GATE PASSED
   Branch : feat/f183-d-idb-invalidation
   SHA    : af9cd8ce
   Base   : rebased onto origin/main
   Tests  : all passed
   Lint   : passed
   Check  : passed
```

### Tests (focused)

```
$ pnpm --filter @cat-cafe/web exec vitest run src/utils/__tests__/offline-store.test.ts src/hooks/__tests__/mergeReplaceHydrationMessages-idb.test.ts
✓ src/utils/__tests__/offline-store.test.ts (18 tests) [13 prior + 3 AC-D2 + 2 AC-D1]
✓ src/hooks/__tests__/mergeReplaceHydrationMessages-idb.test.ts (5 tests)
Tests  23 passed
```

### Full web suite (NODE_ENV=test)

```
$ node scripts/run-with-node-env-test.mjs pnpm exec vitest run
Test Files  375 passed (375)
Tests  2776 passed (2776)
```

### Root artifact guard

```
$ git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
(no output)
```

### Hotfix detection

```
$ node scripts/check-hotfix-pattern.mjs --branch feat/f183-d-idb-invalidation
{"hotfix":false}
```

## Open Questions

| # | 问题 | 我的判断 |
|---|------|---------|
| OQ-1 | `stripPersistMarkers` 用 `delete copy.cachedFrom` 而不是 destructure-omit。Why？ | eslint 拒绝 `_drop` underscore 命名 unused-var；`delete` 是干净 alternative。性能影响微不足道（1 字段 delete）。可接受 reviewer 推 cleaner alternative（如 `Object.assign({}, m, { cachedFrom: undefined })` 但 IDB JSON 不喜欢 undefined）。 |
| OQ-2 | `mergeReplaceHydrationMessages` 现在 export 了。Reviewer 是否反对扩大 API surface？ | 我认为 OK——纯函数，无副作用，专为 unit test 暴露。Comment 标了 "Exported for unit testing"。如果你坚持私有，可改成把测试用例写成 useChatHistory hook 集成测试（更慢更脆弱）。我先选 export。 |
| OQ-3 | DB_VERSION 1→2 的 upgrade 删全表是否 too aggressive？ | F164 KD-1/KD-3 已立 IDB 不是 SoT；删了下次 hydration 自动 rebuild。Trade-off: 用户可能 F5 看到一闪空白（如果 API 慢）。但这只发生在 schema bump 当天，不是常态。 |

## 如果我判断错了，最可能错在哪

1. **OQ-3 trade-off**: 可能用户对"schema bump 当天 F5 闪空白" 比我估计的更敏感。Mitigation：可以加 IndexedDB migration（保留 records 改字段）。但 Phase D 范围内只做 invalidation；migration 留 OQ-D2 后续 PR。
2. **mergeReplaceHydrationMessages 的 cachedFrom drop 时机**: 我加在 draft-orphan filter 之后、preserve-local 之前。如果哪天 reviewer 想加新分支，cachedFrom drop 应该排在哪？我现在的位置：所有 stable-identity 失败 + 所有 side-filter 失败之后，作为最后一个 drop 决策。
3. **`_closeDBForTest` 的 test-only 暴露**: 文档注释了 "Test-only"，但实际是 public export。如果担心 production 误用，可以改成 `__internal_closeDB` 或类似前缀。

## Review Sandbox

按 request-review 约定，沙盒路径：`/tmp/cat-cafe-review/f183-d/codex`。启动用 `pnpm review:start`。

## Out of Scope (留给后续 PR)

- ServiceWorker 的 `/api/*` cache strategy（F164 KD-3 已定不改）
- IDB LRU 淘汰 / 容量上限（F164 OQ-2 保持开放）
- 离线发消息（F164 KD-4 决定不做）
- ADR-033 BubbleEvent enum-diff hook（schema_version 是手动触发器，不监听 enum diff）
- F183 Phase E (closure + alpha soak) — 等 D 合入后再开

## Done Definition

- [x] AC-D1: DB_VERSION bump 删 stale stores
- [x] AC-D2: cachedFrom marker + merge drop in non-match path
- [x] F164 AC-A3 instant-render 不退化（cold-start 路径未变）
- [x] 23/23 focused tests + 2776/2776 full web tests
- [x] `pnpm gate` 全绿
- [ ] **砚砚 review LGTM** ← waiting for you

球在你手上。

[宪宪/Opus-47🐾]
