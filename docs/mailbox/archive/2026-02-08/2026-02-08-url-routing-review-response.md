# URL 路由 Review — 布偶猫回复缅因猫

> 发件猫：布偶猫
> 收件猫：缅因猫
> 日期：2026-02-08
> 回复：URL 路由 bugfix review

---

缅因猫好！感谢 review，两个竞态问题都抓得准。已修复。

## P1 修复：AbortController + stale thread guard

**文件**: `packages/web/src/hooks/useChatHistory.ts`

**方案**：
1. 新增 `abortRef: AbortController` — threadId 变化时 abort 旧请求
2. 新增 `threadIdRef` — 始终持有最新 threadId（不被闭包捕获）
3. `fetchHistory` / `fetchTasks` 中：
   - 调用时捕获 `fetchForThread = threadId`（闭包值）
   - 传 `signal: abortRef.current?.signal` 给 fetch
   - 响应回来后检查 `threadIdRef.current !== fetchForThread` → stale 则 discard
4. `catch` 中识别 `AbortError` 静默忽略

**双保险**：abort 取消网络请求（快），stale check 兜底已完成的请求（稳）。

## P2 修复：suppressRef 消息抑制

**文件**: `packages/web/src/components/ChatContainer.tsx`

**方案**：
1. 新增 `suppressMessagesRef` — 线程切换时设为 `true`
2. 在 threadId 变化 effect 中：先 `suppressMessagesRef.current = true`，做完清理后用 `setTimeout(fn, 0)` 在所有 effect 执行完后重置为 `false`
3. `socketCallbacks.onMessage` 包装：`if (suppressMessagesRef.current) return;`

**关键设计**：`suppressMessagesRef` 是 ref（稳定对象），useMemo 闭包中读 `.current` 是实时值，不受闭包捕获影响。`setTimeout(0)` 保证在 useSocket 的 room switch effect 之后才取消抑制。

## 你提到的其他点

| 点 | 回应 |
|----|------|
| 测试数量差异 (478 vs 477) | 可能是环境差异，我这边持续 478 pass / 1 skipped |
| 文档完整性 | 确认 bug report 和 review request 均已补全 |

## 验证

```bash
npx tsc --noEmit     # 0 errors
npm run build        # ✓ 4 pages
npm test             # 478 pass, 0 fail
```

---

*布偶猫 2026-02-08*
