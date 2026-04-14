---
title: "Review Request: stale-while-revalidate UX fix"
date: 2026-04-14
author: opus
---

# Review Request: stale-while-revalidate — 消除切 thread / F5 时的 2 秒白屏

Review-Target-ID: fix-stale-while-revalidate
Branch: feat/stale-while-revalidate

## What

删除前端组件在切换 thread / 刷新时"先清空旧数据再加载新数据"的 anti-pattern。
改为 stale-while-revalidate：保留旧数据直到新数据到达。

涉及 3 个组件：
- `SessionChainPanel.tsx` — 删除 `setSessions([])`
- `SessionEventsViewer.tsx` — 删除 `setData([])`
- `ExternalProjectTab.tsx` — 删除 7 个 `setX([])`

测试同步更新：从"断言旧数据消失"改为"断言旧数据在 fetch 失败时保留"。
新增 1 个测试覆盖"fetch 成功时旧数据被替换"。

## Why

铲屎官 P0 投诉：每次 F5 / 切 thread 出现 ~2 秒白屏，"非常不能接受"。
根因是组件在 useEffect 触发时先 `setX([])` 清空数据，加上 `ensureSession()` 的串行延迟。
本 PR 只修前端渲染策略，**不碰 auth/identity 任何边界**。

## Original Requirements（必填）
> "现在的情况我非常不能给接受。就是非常的慢 会出现 2s的时间没有thread！然后每次切thread也都会出现空白2s"
> "难道其他的有做一些安全防护的东西体验这么差？"
- 来源：thread_mnskgsiuyrmi6k55（铲屎官 2026-04-14 01:18）
- **请对照上面的摘录判断：修完后切 thread / F5 是否还有白屏**

## Tradeoff

- 放弃了"fetch 失败时清空旧数据"——现在 fetch 失败保留旧数据（stale > empty）
- 不做 ensureSession 非阻塞化（P1，下个 PR）
- 不做 app-shell session state（P2，后续）

## Open Questions

1. ExternalProjectTab 切换项目时保留旧项目数据可能短暂显示"错误项目的内容"——但因为 Promise.allSettled 的并行加载，实际闪烁极短。请评估是否可接受。
2. SessionEventsViewer 切换 view mode（chat→raw）时保留旧 view 数据，类型会不匹配（ChatMessage[] vs RawEvent[]）——但 fetchEvents 内部 setData() 会立即替换，中间不会渲染。

## Next Action

请 review 并确认修复是否正确解决了铲屎官的 P0 投诉。

## 自检证据

### 测试结果
```
pnpm --filter @cat-cafe/web test  # 2136 passed, 0 failed
pnpm lint                         # 0 errors
pnpm -r --if-present run build   # exit 0
```

### 变更范围
4 files changed, 38 insertions(+), 29 deletions(-)
全部在 packages/web/，不涉及后端、不涉及 auth
