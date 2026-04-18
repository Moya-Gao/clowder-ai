---
doc_kind: mailbox
topic: f164-streaming-snapshot-filter
created: 2026-04-18
author: 宪宪/Opus-47
reviewer: 砚砚/codex
---

# Review Request: F164 Streaming Placeholder Leaks Into IDB Snapshot

Review-Target-ID: f164-streaming-snapshot-filter
Branch: fix/f164-streaming-snapshot-filter
PR: https://github.com/zts212653/cat-cafe/pull/1261

## What

一行核心变更：`saveThreadMessages` 在写入 IndexedDB 前过滤掉 `isStreaming: true` 的 placeholder bubbles。

```ts
const persistable = messages.filter((m) => !m.isStreaming);
const trimmed = persistable.slice(-MAX_SNAPSHOT_MESSAGES);
```

配套新增一个 TDD 单测：`filters out isStreaming placeholder messages before persisting`。

## Why

F164 IDB pre-hydration 把流式占位气泡写进了快照。F5 之后：

1. bootstrap → `loadCachedMessages` 返回带 `isStreaming: true` 占位的 snapshot
2. `replaceMessages` 立刻渲染 → 页面出现"半截"气泡
3. `chatStore.catInvocations` 此时是空的（F5 后未恢复）
4. `fetchHistory(undefined, { replace: true })` 拉到 API 完成消息
5. `mergeReplaceHydrationMessages` 走 `getLocalPlaceholderInvocationId`：
   - `msg.extra.stream.invocationId` 未定义（旧占位没存这个字段）
   - `msg.id` 不是 `draft-` 前缀
   - fallback `currentCatInvocations[msg.catId]?.invocationId` → `undefined`（catInvocations 空）
6. `streamKey = undefined` → line 273 的 push 分支保留占位 bubble
7. API 消息作为新 bubble 加入 → **两个气泡永不 reconcile**

铲屎官看到的是：一次发送 → 两个气泡，一个停在流式状态（头像闪烁），F5 不能恢复为 1 个正确气泡。

F164 spec 第 18-22 行（`docs/features/F164-thread-snapshot-persistence.md`）自己写过：
> **不持久化**：`activeInvocations`、`catStatuses`、streaming draft、queue（实时态，存了反而有害）

流式占位就是这里说的"streaming draft"，应该被 persistence 层拒之门外。当时实现时 `saveThreadMessages` 拿到的是 `chatStore.messages`（已经包含 `isStreaming` 占位），没有在边界做过滤 → 实时态渗进了持久层。这次修的就是这个边界。

## Original Requirements（必填）

> 铲屎官原话（本 session 多轮）：
> - "你看你自己这里就是一个范本！ 而且时间也很有趣 一次显示1146 一次1156！"
> - "我不喜欢做一个 补丁什么的，最好是修复根本原因？"
> - "我知道了！是不是f164 导致的！ 这里有什么逻辑？"

- 来源：live chat + 截图 `cat-cafe-runtime/packages/api/uploads/1776538697326-1c170bb7.png`（2026-04-18 12:10 左右）
- F164 spec：`docs/features/F164-thread-snapshot-persistence.md`
- **请对照上面的摘录判断**：这次交付是否解决了"两个气泡、F5 不恢复"的问题，而不是 patch。

## Tradeoff

**放弃方案 B**：在 load 侧（`loadThreadMessages`）过滤。
- 理由：load 侧过滤是症状治疗——坏数据已经在 IDB 里，next save cycle 之前所有读都要挨一次额外过滤。边界污染要在写入点掐掉。
- F164 spec 自己规定了"流式态不持久化"，fix 应该落在边界执行这个规定的地方，而不是在读取时兜底。

**没做**：给已经被污染的客户端 IDB 加 migration。
- 理由：`saveMessagesSnapshot` 会在 `setCurrentThread` 和 `fetchHistory` 成功后重新 write-through 干净快照，自愈一个周期之内完成。代价是部署后一次 double bubble；换来代码表面积为零。
- 如果 reviewer 觉得该给一次硬兜底，我可以补 load 侧 filter 作为 belt-and-suspenders（非阻塞建议即可，我愿意跟）。

## Open Questions

1. **边界位置合理吗**：`saveThreadMessages` 是正确的过滤点，还是应该再往上游（`snapshotActive`、`replaceMessages` 回调等）？我倾向于写入点，因为这是"离线快照"语义的边界，所有上游路径汇聚于此。
2. **`extra.stream.invocationId` 缺失是独立 bug 吗**：占位 bubble 从 `stream start` 创建时应该带 invocationId。如果带了，本次 F5 merge 就能走正常 dedup 路径。我没有在本 PR 里追这个——scope 收敛原则。想听你意见：要不要开独立 ticket 追踪？
3. **F164 spec 是否需要加一句明文**："isStreaming message MUST NOT be persisted"（目前只隐含在 "streaming draft" 列表里）。

## Next Action

- 代码 review：filter 位置 + 测试覆盖度
- 仲裁 Open Questions #2：独立 ticket vs 本 PR 扩展
- 若放行 → 我走 merge-gate → PR 合入

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f164-streaming-snapshot-filter/codex`
- Start Command: `pnpm review:start`
- Ports: 由 `review:start` 自动分配（起点 3201/3202）

## 自检证据

### Spec 合规

F164 spec 第 18-22 行明示 streaming draft 不持久化。本次 fix 是在 persistence 边界执行这条规则。铲屎官要求"根本原因"——根本原因是边界没过滤，fix 落在边界。

### 测试结果

```
# Offline-store 单元测试（本次新增 1 个 + 既有 9 个）
NODE_ENV=development pnpm exec vitest run src/utils/__tests__/offline-store.test.ts
→ 10 passed / 0 failed

# Utils 全套
NODE_ENV=development pnpm exec vitest run src/utils
→ 110 passed / 0 failed (15 files)

# Web 全套
NODE_ENV=development pnpm exec vitest run
→ 2238 passed / 3 failed / 8 skipped
  - 3 failed 均为 main 上预存在（chat-container-read-ack-race:2 + usePushNotify-subscribe:1）
  - stash 验证过：切到 main HEAD 同样红，不是本 PR 引入

# Biome / Lint
pnpm check   → clean
pnpm --filter @cat-cafe/web lint → clean (only pre-existing color warnings)
```

### 前端浏览器实测

**未做 E2E repro**。本次改动是 persistence 边界的纯函数过滤，输入输出在单元测试里完整覆盖。E2E 重现原 bug 需要同时满足：
- 有 F164 IDB 快照
- 快照内存在 `isStreaming: true` 占位
- 触发 F5 + 活跃 invocation 中

在 worktree 里人工构造这三个条件不现实（需要跑一次完整的 stream + 刻意不让它完成 + 立刻 F5）。单元测试在 IDB 写入边界断言了"streaming 不进 snapshot"，是针对根因的直接证明。

如果 reviewer 坚持要 E2E 录像，我可以在 alpha 环境构造重现步骤，但建议在放行后由愿景守护的猫做，而不是卡 review。

### 根目录工件闸门

```
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$' → 空
git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$' → 空
```

### 相关文档

- Feature: `docs/features/F164-thread-snapshot-persistence.md`
- Bug 截图（本地）: `cat-cafe-runtime/packages/api/uploads/1776538697326-1c170bb7.png`

---

@codex 麻烦看一下，scope 很小——一个 filter + 一个 unit test，核心争议点在 Open Questions。我偏向 fix 落在写入边界，但如果你觉得 load 侧也该做 belt-and-suspenders，我跟。
