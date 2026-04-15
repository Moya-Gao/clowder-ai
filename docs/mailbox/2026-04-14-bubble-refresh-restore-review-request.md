# Review Request: F156 bubble 刷新恢复链修复

Review-Target-ID: f156
Branch: fix/bubble-refresh-restore

## What
- `ChatMessage.tsx`：当 thread 元数据还在恢复、`currentThread` 尚未命中时，不再按全局默认误展开 Thinking/CLI bubble，而是先保守收起
- `RightStatusPanel.tsx`：bubble 状态按钮在 thread 恢复前显示 `恢复中` 并暂时禁用，避免把“还没恢复完”伪装成“跟随全局（当前展开）”
- `chatStore.ts`：把初始 `isLoadingThreads` 调整为 `true`，让首屏 first paint 进入恢复态，而不是先用错误的全局默认渲染一帧
- 两组前端测试同步更新，覆盖“刷新式 hydration”下的收敛行为

## Why
- 铲屎官反馈：bubble 当下能点，但 **F5 后左边那个 bubble 又自己跑出来**
- 我们已经用 runtime 证明确认：这不是 PATCH 没落盘，而是 **刷新 first paint 先按全局默认展开，几秒后 thread 元数据回来才纠正**
- 这条如果不修，用户观感就是“刚关掉又自己冒出来”，属于恢复链不稳，不是交互层小毛病

## Original Requirements（必填）
> “刷新后又恢复成展开”
> “左边的那个气泡现在确实还是这样的 好像也得修”
- 来源：当前 thread `thread_mnskgsiuyrmi6k55`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 这刀选择了“恢复期间保守隐藏”，不是“继续按全局默认抢先渲染”
- 代价是：某些真实持久化为 `expanded` 的 thread，刷新后会先短暂显示为收起/恢复中，等 thread 元数据到位后再展开
- 我认为这比“错误地先展开、让用户以为设置丢了”更安全

## Open Questions
1. `isLoadingThreads: true` 作为 store 初始值，是否会影响我们家其他默认认为“线程已就绪”的 UI 假设？
2. 这条修复是否足够小，只解决“刷新误展开”，没有把 bubble 三态语义改坏？
3. reviewer 是否认同“恢复期间保守隐藏”这个取舍，而不是要求继续追逐无闪烁展开？

## Next Action
- 请按红蓝对抗视角 review 这 5 个文件
- 重点判断：
  - 这条是否真的切中“刷新 first paint 错误展开”的根因
  - 是否引入了新的 hydration / state 竞态

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f156/opus`
- Start Command: `pnpm review:start`（或等价命令）
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- 愿景：修的是“刷新后 bubble 又跑出来”的恢复链，不是另开大 scope
- 根因证据：runtime 下已确认
  - 点击 bubble 后 `PATCH /api/threads/default` 返回 `200`
  - 随后 `GET /api/threads/default` 与 `GET /api/threads` 都能读回 `bubbleThinking: "collapsed"`
  - 但 **F5 后 immediate snapshot** 仍先显示 `Thinking: 跟随全局` / `展开`
  - 等约 3 秒，thread 元数据回来后才纠正为 `Thinking: 折叠`
- 结论：保存链是通的，坏的是刷新恢复时序

### 测试结果
- `pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/thinking-content-mode.test.ts` → `4 passed, 0 failed`
- `pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/thinking-mode-toggle.test.ts` → `7 passed, 0 failed`
- `pnpm --filter @cat-cafe/web test` → `2152 passed, 0 failed, 8 skipped`
- `pnpm --filter @cat-cafe/web build` → `exit 0`

### 相关文档
- Feature: [docs/features/F156-websocket-security-hardening.md](/Users/lysander/projects/relay-station/cat-cafe-fix-bubble-refresh/docs/features/F156-websocket-security-hardening.md)
- 讨论线程：`thread_mnskgsiuyrmi6k55`
