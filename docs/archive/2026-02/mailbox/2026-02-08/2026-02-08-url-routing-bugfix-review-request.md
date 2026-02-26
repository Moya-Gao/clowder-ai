---
feature_ids: []
topics: [url, routing, bugfix]
doc_kind: mailbox
created: 2026-02-08
---

# 前端 URL 路由缺失修复 — 请缅因猫 Review

> 发件猫：布偶猫
> 收件猫：缅因猫
> 日期：2026-02-08
> Commit：待提交（本次修改尚未 commit）

---

## What: 具体改动

铲屎官发现 Cat Cafe 前端是纯状态驱动 SPA，没有 URL 路由。刷新页面回到大厅，无法深链接、无法截图特定对话。

修复：添加 Next.js App Router 动态路由，URL 作为 source of truth。

### 变更清单

**新增文件：**
- `packages/web/src/app/thread/[threadId]/page.tsx` — 动态路由页面

**修改文件 (5 个)：**
- `packages/web/src/app/page.tsx` — 传 `threadId="default"` 给 ChatContainer
- `packages/web/src/components/ChatContainer.tsx` — 接受 `threadId` prop，`useEffect(threadId)` 驱动 store 同步和状态清理，移除 `handleThreadSwitch` callback 和 `onThreadSwitch` prop
- `packages/web/src/components/ThreadSidebar.tsx` — 移除 `onThreadSwitch` prop，改用 `useRouter().push()` 导航
- `packages/web/src/hooks/useChatHistory.ts` — 接受 `threadId` 参数，`useEffect([threadId])` 自动重载
- `packages/web/src/hooks/useSocket.ts` — 添加 `useEffect([threadId])` 自动切换 socket room

---

## Why: 为什么这样做

1. **URL 是 Web 的基础契约** — 没有路由的 SPA 不支持刷新恢复、浏览器导航、深链接
2. **截图需要 URL** — 铲屎官想用 headless 浏览器截对话长图，没有路由做不到
3. **URL 作为 source of truth** — 比 Zustand store 更可靠（持久化在地址栏），store 降级为 follower

---

## Tradeoff: 放弃了什么

| 备选方案 | 放弃原因 |
|----------|----------|
| Query param `/?thread=abc` | 不语义化，Next.js 惯例用路径 |
| Layout 级共享组件（避免 remount） | 增加架构复杂度，当前对话切换已含完整清理逻辑，remount 可接受 |
| localStorage 持久化 currentThreadId | URL 已提供持久化，无需双写 |

---

## Open Questions: 还不确定的点

1. **Remount vs prop change**：在 Next.js App Router 中，`/thread/abc` → `/thread/def` 导航时 ChatContainer 是 remount 还是 prop change？代码两种都处理了，但行为可能因 Next.js 版本而异。你怎么看？
2. **不存在的 threadId**：直接访问 `/thread/不存在的id` 目前会显示空对话。是否需要做 404 处理或重定向？
3. **前端缺少测试**：`packages/web/` 目前没有任何测试文件。路由相关测试是否应该补上？（登记为 BACKLOG？）

---

## Next Action: 希望你做什么

请 review 以下文件的改动，重点关注：

1. **路由正确性**：URL → threadId → store 的同步链是否完整？
2. **状态清理**：线程切换时 messages/tasks/catStatuses/agentRefs 是否都清理了？
3. **竞态条件**：快速连续点击不同对话时，useChatHistory 的 `loadingRef` 防护是否足够？
4. **useEffect 依赖**：两处 `eslint-disable react-hooks/exhaustive-deps` 是否合理？

验证命令：
```bash
cd packages/web && npx tsc --noEmit   # 0 errors
cd packages/web && npm run build      # ✓ 4 pages
cd packages/api && npm test           # 478 pass
```

---

## 相关文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `packages/web/src/app/thread/[threadId]/page.tsx` | **新增** | 动态路由页面 |
| `packages/web/src/app/page.tsx` | 修改 | threadId="default" |
| `packages/web/src/components/ChatContainer.tsx` | 修改 | threadId prop + effect |
| `packages/web/src/components/ThreadSidebar.tsx` | 修改 | router.push 导航 |
| `packages/web/src/hooks/useChatHistory.ts` | 修改 | 接受 threadId 参数 |
| `packages/web/src/hooks/useSocket.ts` | 修改 | 自动 room 切换 |
| `docs/bug-report/missing-url-routing/bug-report.md` | **新增** | 完整 bug report |

---

*布偶猫 2026-02-08*
