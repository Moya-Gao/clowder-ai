---
type: review-request
date: 2026-05-07
feature: F063
author: opus
reviewer: codex
---

# Review Request: F063 Presentation Lock Scroll Viewport Persist

Review-Target-ID: f063-scroll-viewport
Branch: feat/scroll-viewport

## What

Store-level scroll position persistence during presentation lock + generic CodeViewer viewport bridge. 7 files, +123 lines.

Core changes:
1. `PresentationLockSnapshot.scrollTop: number | null`
2. `setPresentationLockViewport(scrollTop)` action — no-op when lock null
3. `setCurrentThread` lock overlay includes scrollTop
4. CodeViewer generic props: `restoreScrollTop` / `restoreKey` / `onScrollTopChange`
5. WorkspacePanel wires store → viewer only when lock is active

## Why

愿景守护 identified AC-PL2 scroll as "Residual Risk" — thread switch during lock doesn't preserve scroll position, leading to viewport jump. 铲屎官 confirmed: "基本是未来要反复修bug的地方".

## Original Requirements（必填）

> 铲屎官: "那我感觉这里很危险 基本是未来要反复修bug的地方哦。 怎么办？"
> 砚砚(Codex): "store保存lock-local viewport, viewer只做通用bridge不知道lock存在"
> 砚砚: "restoreKey anti-loop: 只在 threadId/filePath/remount 变化时 restore，不在每次 scrollTop 更新时 restore"

- 来源：PR #1570 愿景守护 review + 后续设计讨论
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 选择了 `restoreKey` 模式（threadId:filePath composite key）而非每次 scrollTop 变化都 restore → 避免 scroll 抖动和与用户滚动打架
- CodeViewer 完全不知道 lock 存在，只接收 generic props → 未来非 lock 场景也可复用 viewport bridge

## Open Questions

1. `onScrollTopChange` 用 passive scroll listener，没有 debounce/throttle — 每帧触发 store update。是否需要 throttle？（当前 lock 模式下 thread switch 不频繁，store update 成本低）
2. `restoreKey` 用 `${threadId}:${filePath}` — 如果同一 thread 同一 file re-mount（不换 thread），scroll 不会 restore。这是 by-design（不干扰用户正常浏览），需确认。

## Next Action

请 @codex 做代码审查，重点关注：
- store action 的 no-op guard 是否完备
- viewport bridge 的 anti-loop 设计是否正确
- thread switch 时 scrollTop 恢复的边界 case

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f063-scroll-viewport/codex`
- Start Command: `pnpm review:start`
- Ports: web=3201, api=3202

## 自检证据

### Spec 合规

- ✅ scrollTop 持久化到 lock snapshot
- ✅ thread switch 恢复 scrollTop
- ✅ CodeViewer 无 lock 耦合（generic bridge）
- ✅ disable lock 时清除 workspaceScrollTop
- ✅ setPresentationLockViewport no-op when lock null

### 测试结果

```
pnpm --filter @cat-cafe/web exec vitest run src/stores/__tests__/
# 33 test files passed, 406 tests passed, 0 failed (2026-05-07 19:32)
```

5 new tests:
- setPresentationLockViewport updates lock scrollTop
- setPresentationLockViewport is no-op when lock is null
- thread switch with lock restores scrollTop from lock snapshot
- enablePresentationLock initializes scrollTop to null
- disablePresentationLock clears workspaceScrollTop

### 根目录工件闸门

```
git status --short | rg '^.. [^/]+\.(png|...)$'  → empty
git diff --name-only origin/main...HEAD | rg ... → empty
```

### 相关文档

- Feature: F063 (Presentation Lock)
- Source: PR #1570 愿景守护 AC-PL2 Residual Risk
