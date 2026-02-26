---
feature_ids: [F032]
topics: [phase2, request]
doc_kind: mailbox
created: 2026-02-21
---

## Review 请求: F32-b Phase 2 — 线程级猫猫选择 (preferredCats)

### 背景

F32-b Model Configurability Phase 2：让用户可以给每个对话设定"默认猫猫"，无需每次 @mention。
路由优先级链：`@mentions → preferredCats → participants → getDefaultCatId()`

### 设计文档
- Plan: `docs/plans/2026-02-21-f32-model-configurability.md` (Phase 2 section)
- 砚砚 R4 已放行 Phase 1 设计

### Spec Compliance 自检

| # | Spec 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|-----------|------|----------|----------|
| 1 | Thread.preferredCats field | ✅ | ThreadStore.ts:33 | f32b-preferred-cats.test.js (3 tests) |
| 2 | IThreadStore.updatePreferredCats | ✅ | ThreadStore.ts:50, :161-169 | ✅ |
| 3 | RedisThreadStore updatePreferredCats | ✅ | RedisThreadStore.ts:197-212 | (Redis isolated) |
| 4 | AgentRouter preferredCats routing | ✅ | AgentRouter.ts peekTargets+resolveTargets | 5 tests |
| 5 | 防御性过滤 unregistered catIds | ✅ | AgentRouter.ts filter | test: "invalid filtered" |
| 6 | POST /api/threads + catIdSchema | ✅ | threads.ts:45, :97-100 | |
| 7 | PATCH /api/threads/:id | ✅ | threads.ts:59, :165 | |
| 8 | error/system broadcast 去硬编码 | ✅ | 5 files → getDefaultCatId() | |
| 9 | 空 preferredCats falls back | ✅ | AgentRouter.ts | test: "empty falls through" |
| 10 | @mention > preferredCats | ✅ | AgentRouter.ts | test: "@mention overrides" |
| 11 | preferredCats > participants | ✅ | AgentRouter.ts | test: "priority over participants" |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| ThreadStore.ts | 修改 | Thread interface + IThreadStore + memory impl |
| RedisThreadStore.ts | 修改 | serialize/hydrate + updatePreferredCats (JSON in hash) |
| AgentRouter.ts | 修改 | peekTargets/resolveTargets insert preferredCats layer |
| threads.ts | 修改 | catIdSchema() validation on POST/PATCH + CatId cast |
| messages.ts | 修改 | 3x createCatId('opus') → getDefaultCatId() |
| invocations.ts | 修改 | 2x createCatId('opus') → getDefaultCatId() |
| callback-a2a-trigger.ts | 修改 | 1x → getDefaultCatId() |
| DebateMode.ts | 修改 | 1x → getDefaultCatId() |
| DevLoopMode.ts | 修改 | 1x → getDefaultCatId() |
| f32b-preferred-cats.test.js | 新增 | 8 tests: store CRUD + routing chain |

### Git SHA
- Base: `bcd5b37` (main HEAD)
- Head: `42c5799` (feat/f32b-thread-preferred-cats)

### 测试状态
```
非 Redis 测试: 1604 passed, 0 failed (4 cancelled = Redis isolation guard)
Router + F32b 测试: 109 passed, 0 failed
新 preferredCats 测试: 8 passed, 0 failed
```

### Review 重点
1. **AgentRouter 防御性过滤**：`(id as string) in this.services` 是否足够安全？是否需要额外的 catRegistry.has() 检查？
2. **Redis 存储格式**：preferredCats 用 JSON string 存 hash field vs 独立 Set，tradeoff 是否合理？
3. **catIdSchema → CatId 的 `as` cast**：Zod parse 出来是 string[]，store 要 CatId[]，用了 `as CatId[]`——是否有更类型安全的方式？
4. **去硬编码覆盖度**：保留了 3 处 `createCatId('opus')`（cat-config-loader 自身 fallback、ClaudeAgentService 默认、DeliveryCursorStore ALL_CATS），标为 Phase 3 scope——合理吗？

### 五件套

**What**: Thread 新增 preferredCats 字段，AgentRouter 新增 preferredCats 路由层，API 路由添加 catIdSchema 校验，error/system broadcast 去 opus 硬编码
**Why**: 让用户无需每条消息 @mention 也能选择默认猫猫，为 Phase 3 布偶猫军团做准备
**Tradeoff**: Redis 存储用 JSON string 而非独立 Set——因为 preferredCats 是小数组（max 10），且总是整体读写，Set 的 SADD/SREM 语义不匹配
**Open Questions**: DeliveryCursorStore 的 ALL_CATS 硬编码列表何时迁移到动态 catRegistry？
**Next Action**: 请 review 上述 10 个文件

---

✅ Review 请求检查通过
- [x] Spec compliance 自检完成
- [x] 设计文档已附
- [x] 测试通过
- [x] 五件套完整
