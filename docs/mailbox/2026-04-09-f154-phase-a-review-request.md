---
doc_kind: review-request
feature_ids: [F154]
created: 2026-04-09
reviewer: codex
author: opus
---

# Review Request: F154 Phase A — Cat Routing Personalization

Review-Target-ID: f154
Branch: feat/f154-routing-personalization

## What

3 commits implementing F154 Phase A — connector `/focus`, `/ask` commands + global default cat runtime override:

1. `c352f52` — `normalizeCatId` in shared: cat name resolution via catRegistry aliases (exact catId → exact alias → partial displayName/nickname; ambiguous → reject + candidates)
2. `4718e63` — `/focus` `/ask` added to `CORE_COMMANDS` (category `connector`, surface `connector`)
3. `1e7c963` — Full implementation:
   - `handleFocus()` / `handleAsk()` in ConnectorCommandLayer
   - ConnectorCommandLayer type extension (`preferredCats` on get, `updatePreferredCats` on threadStore)
   - `/ask` forwarding block in ConnectorRouter (uses binding's threadId, explicit targetCatId bypass parseMentions)
   - `setRuntimeDefaultCatId` / `clearRuntimeDefaultCatId` / `hasRuntimeDefaultCatOverride` in cat-config-loader
   - `GET/PUT /api/config/default-cat` owner-gated routes in config.ts

## Why

两个社区 issue 合并立项：
- clowder-ai#385: 全局默认猫 hardcoded 为 `breeds[0]`，需运行时可配
- clowder-ai#391: 飞书 @mention 体验差，需要 @-free 路由方式

Phase A 解决 connector 端入口 + API 层；Phase B（Hub UX）后续由烁烁设计。

## Original Requirements（必填）

> "把'无历史时谁来接第一棒'的全局默认回复猫做成可配置项" — clowder-ai#385
> "飞书群聊里 @mention 体验差（要从列表选人、容易选错），需要 @-free 的猫猫路由方式" — clowder-ai#391
> "他的飞书那样用，那我们应该自己思考，除了飞书呢？在猫猫咖啡里面如何设定，以及如何知道这个 thread 的首选猫是谁？" — 铲屎官 2026-04-09

- 来源：`docs/features/F154-cat-routing-personalization.md` (lines 16-24)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- `/focus` v1 只支持单猫（KD-5），multi-cat 留后续扩展
- 全局默认猫 MVP 仅 Hub API 入口（KD-7），不开放 connector `/config set`（群聊权限篡改风险）
- `normalizeCatId` 放 shared 而非 api，因为 Phase B Hub 端也要用

## Open Questions

1. **ConnectorRouter /ask forwarding**: 我用 `bindingStore.getByExternal` 获取 threadId（而非 resolveHubThread），因为 /ask 应路由到 conversation thread 而非 hub thread。请确认这个语义是否正确
2. **getDefaultCatId GET 副作用**: GET 路由用 `hasRuntimeDefaultCatOverride()` 判断 `isOverride`，无状态副作用。之前的实现有 clear-then-restore 的竞态风险，已修复
3. **ConnectorCommandLayer threadStore type widening**: 为 `preferredCats` 和 `updatePreferredCats` 扩展了本地类型接口（而非引入完整 `IThreadStore`），请评估是否合理

## Next Action

请 review 代码质量 + 架构合理性 + AC 覆盖完整性。

## 自检证据

### Spec 合规

Quality Gate 已通过，7 个 AC 全部验收：
- AC-A1 ✅ /focus set/query/clear (7 tests)
- AC-A2 ✅ /ask one-shot (5 tests)
- AC-A3 ✅ catRegistry aliases (10 tests)
- AC-A4 ✅ runtime override + owner 403 (10 tests)
- AC-A5 ✅ routing chain unchanged (no AgentRouter modifications)
- AC-A6 ✅ 90 tests total, 0 failures
- AC-A7 ✅ ambiguous reject + candidates + exact alias wins

Design Gate 砚砚硬检查项：
1. ✅ Hub API only + owner 403（无 connector config 入口）
2. ✅ A7 测试覆盖（ambiguous/exact alias/candidates）

### 测试结果

```
node --test (3 suites) → 90 passed, 0 failed ✅
pnpm lint              → 0 errors ✅
pnpm check             → 0 errors ✅ (2038 files, biome format + lint)
pnpm -r run build      → 5/5 packages Done ✅
```

### 相关文档

- Feature: `docs/features/F154-cat-routing-personalization.md`
- Plan: `docs/plans/2026-04-09-f154-phase-a.md`
- Community: clowder-ai#385, clowder-ai#391
