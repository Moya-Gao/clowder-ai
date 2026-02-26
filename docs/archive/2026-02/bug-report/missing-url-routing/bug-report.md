---
feature_ids: []
topics: [missing, url, routing]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: 前端缺失 URL 路由 — 纯状态驱动 SPA

> **报告人**: 铲屎官
> **定位猫猫**: 布偶猫 🐾
> **报告日期**: 2026-02-08
> **严重程度**: P2 (功能缺失 + 阻碍截图/分享)
> **状态**: ✅ 已修复

---

## 1. 问题摘要

Cat Cafe 前端是纯状态驱动的 SPA，没有实现 URL 路由。所有对话都在 `localhost:3001/` 一个 URL 下运行，对话切换只改变 React state，不改变 URL。

铲屎官发现此问题的直接触发：想让猫猫自己给自己截长图截不了 —— headless 浏览器只能截到大厅，无法导航到特定对话。

---

## 2. 复现场景

1. 打开 `http://localhost:3001/`
2. 在侧边栏点击任意对话 → URL 不变，仍然是 `/`
3. 刷新页面 → 回到大厅（default thread），丢失当前对话
4. 尝试直接访问 `http://localhost:3001/thread/some-id` → 404
5. 浏览器后退/前进 → 无效

---

## 3. 期望行为 vs 实际行为

| | 期望 | 实际 |
|---|------|------|
| **URL** | 切换对话 → URL 变为 `/thread/{id}` | URL 始终为 `/` |
| **刷新** | 保持当前对话 | 回到大厅 |
| **深链接** | 直接访问 `/thread/{id}` 打开对应对话 | 404 或回到大厅 |
| **浏览器导航** | 后退/前进切换对话 | 无效果 |
| **截图** | Headless 浏览器可导航到特定对话 | 只能截到大厅 |

---

## 4. 根因分析

### 架构缺陷：单页面 + 纯 Zustand 状态驱动

Next.js App Router 只有 2 个文件：
- `src/app/layout.tsx` — 根 layout
- `src/app/page.tsx` — 唯一页面，渲染 `<ChatContainer />`

没有动态路由（`[threadId]`），没有 URL 参数解析。

**对话切换流程（修复前）：**
```
Sidebar 点击 → handleSelect(threadId)
→ chatStore.setCurrentThread(threadId)   // 只改 Zustand state
→ onThreadSwitch(threadId)              // 清理 + 加载新数据
→ URL 不变                               // ← 问题所在
```

**状态存储位置：**
- `currentThreadId`: Zustand store（内存）— 刷新即丢失
- 无 localStorage 持久化
- 无 URL 同步

### 为什么之前没发现

- 开发过程中主要通过侧边栏切换对话，体验上"能用"
- 没有截图/自动化测试等需要 URL 导航的场景
- 猫猫们的开发重心在后端 API 和 agent 调用

---

## 5. 修复方案

### 设计决策：URL 作为 source of truth，Store 作为 follower

```
URL /thread/{id}  →  ChatContainer(threadId prop)  →  store.setCurrentThread(threadId)
```

### URL 结构

| 路径 | 含义 |
|------|------|
| `/` | 大厅（default thread） |
| `/thread/[threadId]` | 特定对话 |

### 变更文件

| 文件 | 变更 |
|------|------|
| **NEW** `src/app/thread/[threadId]/page.tsx` | 动态路由页面 |
| `src/app/page.tsx` | 传 `threadId="default"` |
| `src/components/ChatContainer.tsx` | 接受 `threadId` prop，effect 驱动切换 |
| `src/components/ThreadSidebar.tsx` | 用 `useRouter().push()` 导航 |
| `src/hooks/useChatHistory.ts` | 接受 `threadId` 参数 |
| `src/hooks/useSocket.ts` | `threadId` 变化自动切换 socket room |

### 放弃的备选方案

| 方案 | 放弃原因 |
|------|----------|
| Query param `/?thread=abc` | 不够语义化，SEO 不友好 |
| Hash routing `/#/thread/abc` | 不是 Next.js 惯例，无法 SSR |
| Layout 级共享组件 | 增加复杂度，当前规模不需要 |

---

## 6. 验证

```bash
cd packages/web && npx tsc --noEmit  # 0 errors
npm run build                         # ✓ 4 pages generated
cd ../api && npm test                 # 478 pass, 0 fail
```

Build 路由表：
```
○ /                       (Static)
ƒ /thread/[threadId]      (Dynamic)
```

---

## 7. 教训总结

> **给后续猫猫的话：**
>
> 1. **前端不能只看"能不能用"** — 要检查 URL 语义、刷新恢复、深链接是否正常
> 2. **自动化测试需要 URL** — 没有路由的 SPA 无法做 headless 截图、无法 CI 回归
> 3. **铲屎官的使用场景和开发场景不同** — 铲屎官想截图分享对话，这暴露了开发者视角的盲区
>
> **流程教训（铲屎官指出的）：**
> - 收到 bug 汇报后应该**先写 bug report**，记录定位过程和决策理由
> - 修完后应该**写 review 信给缅因猫**
> - 这次两个都跳过了 — 以后必须遵守！

---

*签名: 布偶猫 🐾*
*修复时间: 2026-02-08*
*汇报人: 铲屎官 🐬*
