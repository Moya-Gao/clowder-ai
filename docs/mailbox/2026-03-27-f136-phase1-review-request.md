---
feature_ids: [F136]
doc_kind: review-request
created: 2026-03-27
---

# Review Request: F136 Phase 1 — ConfigEventBus + ConfigChangeEvent Schema

Review-Target-ID: f136
Branch: feat/f136-config-hot-reload

## What

统一配置变更 event bus 基座（3 commits，~77 行生产代码 + ~199 行测试）：

1. **ConfigEventBus** (`config-event-bus.ts`, 60 行) — Node.js EventEmitter 单例，支持：
   - `emitChange(event)`: 发射配置变更事件
   - `onConfigChange(listener)`: 全量订阅，返回 unsub
   - `onKeysChange(keys, listener)`: key 级过滤订阅，file-scope 降级
2. **ConfigChangeEvent schema** — `{ source, scope, changedKeys[], changeSetId, timestamp }`
3. **Wire 两个现有入口**：
   - `PATCH /api/config/env` → 写 .env + process.env 后 emit source=env
   - `ConfigStore.set()` → overlay 赋值后 emit source=config-store

## Why

F136 愿景：Hub 配置面板从只读变成可读可写可即时生效。Phase 1 是基座——Phase 2 的 connector 热重载订阅这个 bus 来触发 restart。没有这个 bus，每个子系统只能各搞各的 ad-hoc reload（现状：F127 的 517 行脚手架）。

## Original Requirements（必填）

> "connector 这个指的是？ im？ 我记得 F127 有一个烂摊子没收拾，他搞了个他自己的 Hot Reload 但是不用 cat config yaml 而是自己搞了一套。所以按照「脚手架」「喵约」理论我们是不是先梳理一下...然后就像你说的一样，各自模块订阅各自自己的热更新。"
- 来源：`docs/features/F136-unified-config-hot-reload.md` (Why 段铲屎官原话)
- **请对照上面的摘录判断：bus 的 API 是否足以让各模块独立订阅自己关心的配置变更？**

## Tradeoff

- **没用外部 pub/sub（Redis pub/sub 等）**：单进程 EventEmitter 足够，避免引入新依赖。如果未来多进程部署再升级。
- **没做 debounce/coalesce**：Phase 1 只有 API-driven 变更（PATCH handler），不需要防抖。Phase 2 加 file watcher 时再加。
- **没改 ConfigStore 的 reset() 也发事件**：reset 只在测试里用，不是业务场景。

## Open Questions

1. `onKeysChange` 的 file-scope 降级策略（file-scope 事件无 changedKeys → 总是触发所有 key 订阅者）是否合理？还是应该忽略？
2. ConfigStore.set() 和 PATCH /api/config/env 是两个独立入口，emit 的 source 不同（config-store vs env）。订阅者需要关心 source 吗？

## Next Action

请 review 代码质量 + 架构合理性。特别关注 event bus 的 API 设计是否足以支撑 Phase 2 的 connector 热重载需求。

## 自检证据

### Spec 合规

Quality Gate PASS: 6/6 AC 全覆盖。

| AC | 状态 |
|----|------|
| AC-1: ConfigChangeEvent schema | ✅ |
| AC-2: ConfigEventBus singleton | ✅ |
| AC-3: PATCH /env emits event | ✅ |
| AC-4: ConfigStore.set() emits | ✅ |
| AC-5: Key-filtered subscription | ✅ |
| AC-6: Zero regression | ✅ 60 existing tests pass |

### 测试结果

```
node --test (4 config test files) → 69/69 pass, 0 fail
pnpm lint                         → 0 errors
pnpm check                        → 0 errors (biome clean)
pnpm --filter @cat-cafe/api build → exit 0
```

### 相关文档

- Feature: `docs/features/F136-unified-config-hot-reload.md`
- Plan: `docs/plans/2026-03-27-f136-phase-1-config-event-bus.md`
- 决策记录: F136 spec 内「决策记录」段落（2026-03-27，铲屎官 + @opus + @codex 讨论收敛）
