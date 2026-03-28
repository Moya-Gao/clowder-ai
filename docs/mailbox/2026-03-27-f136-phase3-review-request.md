# Review Request: F136 Phase 3A/3B/3C — F127 收编（event bus 管线统一）

Review-Target-ID: f136-phase3
Branch: feat/f136-phase3-f127-consolidation

## What

将猫猫 CRUD（POST/PATCH/DELETE /api/cats）的 registry 同步从 inline callback 模式迁移到 ConfigEventBus subscriber 模式，与 Phase 2 的 ConnectorReloadSubscriber 对称。

核心变更：
1. 新增 `CatCatalogSubscriber`（`config/cat-catalog-subscriber.ts`）— 订阅 `source: 'cat-config'` 事件
2. `cats.ts` 路由：移除 `onCatalogChanged` callback，CRUD 后 emit `ConfigChangeEvent`
3. `index.ts`：移除 callback 注入，改为 subscriber wiring
4. Phase 3B/3C：`runtime-cat-catalog.ts` 已是纯 CRUD（无 side effect），无需改动；无死代码

## Why

F136 spec 决策：F127 的 ad-hoc 热更新机制需要收编到统一 event bus。`reconcileCatRegistry()` 通过 `opts.onCatalogChanged` callback 直接调 `syncAgentRegistry` — 这是紧耦合，新增 subscriber 必须改路由代码。迁移到 event bus 后，任何模块都可以订阅 cat-config 变更而无需触碰路由。

## Original Requirements（必填）
> "connector 这个指的是？ im？ 我记得 F127 有一个烂摊子没收拾，他搞了个他自己的 Hot Reload 但是不用 cat config yaml 而是自己搞了一套。所以按照「脚手架」「喵约」理论我们是不是先梳理一下..."
>
> "F127 收编方式：重写，渐进迁移（3A→3B→3C），每步产物都是终态基座，不是脚手架"
- 来源：`docs/features/F136-unified-config-hot-reload.md`（决策记录段）
- **请对照上面的摘录判断：callback 管道是否已被替换为 event bus subscriber**

## Tradeoff

- 不加 debounce：猫猫 CRUD 是用户触发的低频操作（< 1次/分钟），无需防抖
- `reconcileCatRegistry()` 保留在 `cats.ts` 内：它重载 catRegistry 并返回结果给路由 response，移走会断路由 → 事件只在 reconcile 之后发射

## Open Questions

1. `reconcileCatRegistry` 同步更新 `catRegistry`，然后 subscriber 异步读取 `catRegistry.getAllConfigs()` 传给 `syncAgentRegistry` — 时序上 catRegistry 已经是最新的，但如果未来有并发 CRUD 请求，可能读到更新版本。当前单机单线程下无问题，记为 known limitation？
2. Phase 3B/3C 均为 no-op（runtime-cat-catalog 已纯净，无死代码），是否可以直接在同一 PR 中标记完成？

## Next Action

请 review 以下 3 个 commit，确认 event bus 迁移正确、无 regression。

## 自检证据

### Spec 合规
- AC-1 ✅: CRUD registry sync via event bus subscriber
- AC-2 ✅: runtime-cat-catalog.ts pure (grep: 0 hits)
- AC-3 ✅: cats.ts no onCatalogChanged callback
- AC-4 ✅: Dead code deleted (grep: 0 hits)
- AC-5 ✅: Existing CRUD tests pass (13/13)

### 测试结果
```
pnpm --filter @cat-cafe/api build  # exit 0
Subscriber tests: 4/4 pass
CRUD tests: 13/13 pass (1 pre-existing cat-template.json path failure excluded)
pnpm lint: 0 errors
pnpm check: 0 errors (after check:fix)
```

### 相关文档
- Plan: `docs/plans/2026-03-27-f136-phase-3abc-f127-consolidation.md`
- Feature: `docs/features/F136-unified-config-hot-reload.md`
