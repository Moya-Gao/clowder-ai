# Review Request: fix invalid catId in targetCats (default-user crash)

## What

`callbacks.ts` post-message handler now filters `explicitTargetCats` against `catRegistry.has()` before merging into the A2A target set. Invalid IDs (e.g. `"default-user"`) are logged as warnings and dropped — the message is still stored and broadcast normally.

Changed files:
- `packages/api/src/routes/callbacks.ts` — filter loop at line 337-346, downstream refs updated
- `packages/api/test/callback-a2a-postmsg.test.js` — 2 new test cases + catRegistry bootstrap

## Why

When a cat's MCP `post_message` callback passes the user's ID (`"default-user"`) in `targetCats`, it was force-cast to `CatId[]` and entered the A2A worklist, crashing in `getService()` with `Error: Unknown cat ID: default-user`.

Root cause: `postMessageSchema.targetCats` used `z.string().min(1)` instead of validating against `catRegistry`. The `as CatId[]` cast at line 336 bypassed type safety.

## Original Requirements（必填）

> 你先定位一下这个 default user 的 bug 吧，因为它好像不是闭线，是偶线，很奇怪。因为我之前都没看过，要是这个有问题的话，你们 A to A 应该早就挂了。
> 哈哈哈他把我当猫猫！调用！才导致的吧？
> 开起来！

- 来源：本次对话（2026-03-13），铲屎官看到 A2A 报错截图后要求定位修复
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **方案 A（严格 400 拒绝）**：在 schema 层用 `catIdSchema()`，非法 catId 直接 400。优点：fail-fast。缺点：整条消息丢失，猫猫说的话铲屎官看不到。
- **方案 B（选择了这个）**：在 merge 点过滤 + warning log。消息照常存储和广播，只是不把非法 ID 塞进 A2A 路由。铲屎官确认了这个方案。

## Open Questions

1. 是否需要在 `postMessageSchema` 层也加 `catIdSchema()` 做 defense-in-depth？当前只在 merge 点过滤。
2. `catRegistry` 在测试中默认为空，我在 `callback-a2a-postmsg.test.js` 加了 `before()` 注册。这是该文件首次依赖 registry——请确认这不会影响其他测试的隔离性。

## Next Action

请 review 代码改动，重点关注 Open Questions 和过滤逻辑的完整性。

## 自检证据

### Spec 合规

- [x] 非法 catId 不再进入 A2A 路由（`getService()` 不会再收到 `"default-user"`）
- [x] 合法 catId 不受影响（mixed 测试验证 codex 正常通过）
- [x] 消息存储和广播不受影响（200 OK + messageStore 有记录）
- [x] Warning log 输出，便于排查

### 测试结果

```
node --test packages/api/test/callback-a2a-postmsg.test.js
# 11 passed, 0 failed (含 2 个新增)

pnpm --filter @cat-cafe/api test:public
# F062 failures pre-existing on main, unrelated to this change
```

### 相关文档

- Branch: `fix/default-user-catid-validation`
- No feature doc (bug fix, not a feature)
