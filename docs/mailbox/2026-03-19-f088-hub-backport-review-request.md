---
feature_ids: [F088]
topics: [review-request, connector-hub, connector-router, backport, sync-followup]
doc_kind: review-request
created: 2026-03-19
author: gpt52
reviewer: opencode
---

# Review Request: F088 backport — connector-hub trusted identity + ConnectorRouter race guard

Review-Target-ID: f088
Branch: fix/f088-hub-backport
Head: 377d9fc0

## What

把这次 `clowder-ai#146` sync review 暴露出的两条真实运行时缺陷回流到我们家里的真相源：

1. `packages/api/src/routes/connector-hub.ts`
   - `/api/connector/hub-threads` 不再接受 spoofed `?userId=`
   - 只认 trusted `X-Cat-Cafe-User`
2. `packages/api/src/infrastructure/connectors/ConnectorRouter.ts`
   - 给同一 `connectorId + externalChatId` 的 Hub thread 创建加 in-flight 串行化
   - 进入创建前做最终 binding re-read，避免 stale snapshot 双建 Hub thread

另外补了两条回归测试：
- `packages/api/test/connector-hub-route.test.js`
- `packages/api/test/connector-router-hub-thread-race.test.js`

## Why

这两条不是“开源仓特有修补”，而是 sync review 暴露出来的真 bug。如果不回流到 `cat-cafe`，下一次 full outbound sync 还会把公开仓重新带回旧行为。

这轮目标很窄：只把已经在 `clowder-ai#146` 被证明为真实缺陷的运行时修复拉平，不顺手扩到 F077 全局 auth 重构，也不借题重构整个 connector 层。

## Original Requirements（必填）

> "那你要记得 connector-hub / ConnectorRouter 两条真实缺陷，也要回流到我们家里的真相源 cat-cafe"
> "我同意哪你修吧只不过布偶猫暂时没猫粮了 你喊小金 金渐层帮你本地review ... pr a和pr b"

- 来源：当前 thread（铲屎官消息 2026-03-19 10:31 / 10:40 PST）
- 关联 Feature：`docs/features/F088-multi-platform-chat-gateway.md`
- **请对照上面的摘录判断：这轮 backport 是否把 sync 暴露出的真实缺陷准确回流到真相源，而没有顺手扩大 scope**

## Tradeoff

1. 只回流已经在 `clowder-ai#146` 被证实的两条缺陷
   - 不在这轮把浏览器身份模型整体升级成 F077 session/cookie
   - 不动其他 connector route
2. `ConnectorRouter.route()` 的 complexity warning 保持不动
   - 这是 `origin/main` 既有热区旧债
   - 这轮只修并发正确性，不借题重构主路由

## Open Questions

1. `connector-hub` 改成 trusted-header-only 之后，有没有遗漏合法调用面？
2. `ConnectorRouter` 的 in-flight + 最终 re-read 是否正好覆盖 double-create / stale-binding 两个 race，不会把已有正常路径卡死？
3. 这轮 backport 的边界是否足够窄，没有把 `clowder-ai` 上的临时语义错误地带回家里？

## Next Action

请按纯代码 review 看这条 backport 是否可以放行。重点看：
- `?userId=` 被拒绝是否合理
- Hub thread race guard 是否最小且正确
- 有没有把 F077 还没做完的 auth 债错误塞进这条 PR

## 自检证据

### Spec 合规
- 关联 Feature：`docs/features/F088-multi-platform-chat-gateway.md`
- 本轮范围：sync-discovered runtime defect backport，不是新功能，不是 auth 模型重构
- 愿景对齐：
  - connector hub 列表不再接受 query-param 冒充身份
  - 同一外部 chat 并发命令不再双建 Hub thread

### 设计稿对照（Step 5）
- `glob designs/**/*.pen` 命中：无和本轮后端修复直接相关的 UI 设计稿
- 结论：➖ 后端修复，无前端 UI 改动

### Artifact Hygiene（Step 7.5）
- 仓库根目录未跟踪媒体文件：无 ✅

### 测试结果
```bash
pnpm --filter @cat-cafe/api build
# ✅ success

node --test \
  packages/api/test/connector-hub-route.test.js \
  packages/api/test/connector-router-hub-thread-race.test.js \
  packages/api/test/connector-thread-binding-store.test.js
# 15 passed, 0 failed ✅

pnpm exec biome check \
  packages/api/src/routes/connector-hub.ts \
  packages/api/src/infrastructure/connectors/ConnectorRouter.ts \
  packages/api/test/connector-hub-route.test.js \
  packages/api/test/connector-router-hub-thread-race.test.js
# 0 errors, only inherited ConnectorRouter.route complexity warning ✅
```

### 相关文档
- Feature：`docs/features/F088-multi-platform-chat-gateway.md`
- 相关计划：`docs/plans/2026-03-09-f088-chat-gateway.md`
- 回流来源：`clowder-ai#146` sync follow-up（当前 thread 记录）
