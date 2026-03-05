# Review Request: F057 Phase B+C — Badge 增强 + MCP list_threads 搜索

## What

4 commits / 7 files / +37 -7 lines:

1. **`ChatMessage.tsx`**: 跨线程 badge 从静态 `转发自 {id8}…` → 可点击 `📮 {id8} · {threadName}`，从 store 查名称，`useRouter` 跳转
2. **`callbacks.ts`**: `list-threads` MCP 端点加 `keyword` 搜索参数（匹配 title + threadId）+ 返回 `pinned` 字段
3. **`threads.ts`**: 后端 `GET /api/threads` 搜索也匹配 thread ID
4. **4 test files**: 补 `useRouter` mock（因 badge 引入 router 依赖）

## Why

F057 Phase A（PR #210 已合入）做了排序 + 前端搜索。Phase B+C 补齐：
- 跨线程 badge 不可点击 → 可点击跳转 + 显示来源名称
- 猫猫 MCP 工具无法搜索 thread → `keyword` 参数 + `pinned` 状态
- 后端搜索不匹配 ID → 加 threadId 匹配

## Original Requirements（必填）

> "通过 thread id 搜索？不然我找不到！"
> "你们也要有 list_threads MCP 工具 不然如何回答我哪些 thread 举办过猫猫杀？"
> "转发自 badge 显示不全"

- 来源：`docs/features/F057-thread-discoverability.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- badge 用 `threads.find()` 做 O(n) 查找，未用 Map — thread 数量 < 100，不值得优化
- `keyword` 搜索用 `includes` 而非正则 — 简单安全，铲屎官没要求高级搜索

## Open Questions

1. **`useRouter` 在 ChatMessage** — 引入了 Next.js app router 依赖。考虑过用 `window.location` 或 `onNavigate` callback，但项目中已有 `useRouter` 使用模式（`message-actions-identity.test.ts` 等），保持一致。
2. **`pinned` 字段默认值** — 用 `thread.pinned ?? false`，如果 Thread type 没有 pinned 可选字段会有问题吗？

## Next Action

请 review 代码质量 + 对照原始需求判断交付物。

## 自检证据

### Spec 合规

| AC | 实现 | 验证 |
|----|------|------|
| AC-B2: badge 显示 ID+名称，可点击跳转 | `ChatMessage.tsx` | build pass |
| AC-C1: list_threads 可按名称搜索 | `callbacks.ts` keyword param | build pass |
| 后端搜索也支持 ID | `threads.ts` | build pass |

### 测试结果

```
pnpm --filter @cat-cafe/web vitest run   # 695 passed, 1 failed (pre-existing right-status-panel)
pnpm --filter @cat-cafe/api build        # exit 0
pnpm --filter @cat-cafe/web build        # Compiled successfully
pnpm --filter @cat-cafe/web lint         # 0 errors (1 pre-existing warning)
```

### 相关文档

- Feature: `docs/features/F057-thread-discoverability.md`
- Plan: `docs/plans/2026-03-04-f057-thread-discoverability-phase-bc.md`
- Phase A PR: #210 (merged)
