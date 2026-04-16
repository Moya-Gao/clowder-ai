# Review Request: F164 Phase A — IndexedDB Snapshot + Cache-First Hydration

Review-Target-ID: f164
Branch: `feat/f164-thread-snapshot-persistence`

## What

给前端 `chatStore` 加 IndexedDB 镜像层，解决断网 F5 页面全白的问题。

核心改动 3 层：
1. **offline-store.ts**（新）：IndexedDB CRUD，`idb` 库封装，50 条 message 上限裁剪
2. **Write-through**：`setThreads` / `setCurrentThread` 成功后 fire-and-forget 写 IDB
3. **Cache-first read**：`ThreadSidebar` mount 先读 IDB → 渲染 → API fetch 替换；`useChatHistory` 同理 + 离线标记 badge

不持久化的东西：`activeInvocations`、`catStatuses`、streaming draft、queue（实时态，存了有害）。

9 files changed, 275 insertions(+), 10 deletions(-)

## Why

铲屎官断网后按 F5，前端页面完全空白。根因：`chatStore.threadStates` 纯内存，PWA 对 `/api/*` 使用 NetworkOnly，F5 = 冷启动 + API 不可达 = 空白页。

这是 P1 体验问题：铲屎官日常使用中遇到的真实痛点。

## Original Requirements（必填）

> "断网了，我按 F5 我们的前端页面都刷不出来，就是有多少 thread 啊我们的聊天内容啊就都没了"

- 来源：F164 kickoff thread 讨论（铲屎官 2026-04-15 语音消息）
- Feature spec：`docs/features/F164-thread-snapshot-persistence.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

| 放弃的方案 | 原因 |
|------------|------|
| 新建 `offlineSnapshotStore` | 多一层抽象 + 映射开销，直接在 `threadStates` 写入点挂 IDB 更简单（KD-1） |
| localStorage | 5MB 上限、同步 API 阻塞主线程、不适合结构化数据（KD-2） |
| Service Worker 缓存 `/api/*` | 可能 serve 过期 session，app-layer cache-first 更安全（KD-3） |

## Open Questions

1. **50 条裁剪够不够？** — 当前 `MAX_SNAPSHOT_MESSAGES = 50`，平衡存储与覆盖面。Reviewer 可判断是否合适
2. **socket 实时消息的快照时机** — 目前只在 `setCurrentThread`（切 thread）和 `fetchHistory` 成功后快照。中间收到的 socket 消息要到下次切 thread 才入 IDB。Phase A 可接受，Phase B 可以加 debounced save
3. **`isOfflineSnapshot` badge 的 UX** — 目前是简单的 `text-xs text-cafe-muted` 文案"离线快照 · 显示的是上次缓存的内容"，API 成功后自动消失。是否需要更明显的视觉提示？

## Next Action

请 reviewer：
1. `git clone` 到 review 沙盒，跑测试确认 8/8 绿灯
2. 代码审查：重点看 write-through 路径是否有遗漏、cache-first hydration 的竞态处理
3. 对照铲屎官原始需求判断：断网 F5 后能否看到之前的 threads + messages
4. 审完后发 review 到 `docs/mailbox/`

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f164/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`（禁止 3001/3002/3011/3012/4111）

## 自检证据

### Spec 合规

| # | AC | 状态 | 代码位置 | 测试 |
|---|-----|------|----------|------|
| A1 | IndexedDB CRUD 封装 | ✅ | `utils/offline-store.ts` | `offline-store.test.ts` (8 tests) |
| A2 | write-through setThreads | ✅ | `chatStore.ts` setThreads | — |
| A3 | write-through setCurrentThread | ✅ | `chatStore.ts` setCurrentThread | — |
| A4 | cache-first ThreadSidebar | ✅ | `ThreadSidebar.tsx` loadThreads | — |
| A5 | cache-first useChatHistory | ✅ | `useChatHistory.ts` bootstrap | — |
| A6 | 离线标记 badge | ✅ | `ChatContainer.tsx` isOfflineSnapshot | — |

### 测试结果

```
pnpm --filter @cat-cafe/web test         # 8 passed, 0 failed ✅
pnpm lint                                 # 0 errors ✅
pnpm check                                # 0 errors ✅ (biome format + lint)
pnpm -r --if-present run build            # exit 0 ✅
```

### Artifact Hygiene

```
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'  → 空 ✅
git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|...)$'                     → 空 ✅
```

### 相关文档

- Feature: `docs/features/F164-thread-snapshot-persistence.md`
- Plan: `docs/plans/2026-04-15-f164-thread-snapshot-persistence-phase-a.md`
- BACKLOG: F164 row added
