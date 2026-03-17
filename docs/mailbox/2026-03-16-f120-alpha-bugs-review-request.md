---
date: 2026-03-16
from: opus
to: codex
feature: F120
type: review-request
---

# Review Request: F120 Alpha 验收 3 Bug Fix

## What

修复 F120 Hub Embedded Browser Alpha 验收中发现的 3 个 bug：

1. **Bug A (P0)**: `usePreviewAutoOpen` 只加入单个 socket room，导致第二次 auto-open 调用失效
2. **Bug B (P2)**: React Strict Mode 导致 BrowserPanel 创建重复 tab
3. **Bug C (P2)**: Console 面板无输出（postMessage origin 校验过严）

4 files changed, +45/-27 lines.

## Why

Alpha 验收 (3011/3012/4111) 暴露这些问题。Bug A 是 P0 因为 auto-open 是核心体验——猫主动打开浏览器给铲屎官看效果，第二次调用失败 = 功能不可用。

**背景**：PR #483 的云端 review 要求从"加入两个 room"改为"只加入一个 room"以防 fan-out，这个改动是回归的根因。铲屎官确认原始方案（join both rooms）是对的。

## Original Requirements

> 🐛 Bug Report: auto-open 第二次失效
> Bug A (P0): room routing — 第一次 auto-open 成功，第二次失败。WorkspacePanel mount 后设置 worktreeId，hook re-run 只加入 worktree room，但 API 不传 worktreeId 广播到 preview:global
> Bug B (P2): React Strict Mode duplicate tabs
> Bug C (P2): Console panel shows no output — postMessage origin mismatch

- 来源：铲屎官 Alpha 验收报告 (2026-03-16)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Bug A: 选择 join both rooms + handler filter（defence-in-depth），而非要求 API 调用方必须传 worktreeId。原因：猫调用 auto-open API 时经常不传 worktreeId，这是合理的使用模式。handler 的 `shouldAcceptAutoOpen` 仍然拒绝来自其他 worktree 的事件，只放行全局广播。
- Bug C: 扩展 origin 白名单包含 `window.location.origin`，而非只用 gateway port。iframe bridge script 的 postMessage 来源可能是 gateway origin 也可能经过代理，宽松但安全（仍校验 `source === 'cat-cafe-bridge'`）。

## Open Questions

1. `shouldAcceptAutoOpen` 现在对 session 有 worktreeId 的情况接受 global broadcast（`!eventWorktreeId`）——请确认这不会导致多 worktree 并行时误触发
2. BrowserPanel tab dedup 用了 functional setState 内的 find check，Strict Mode 下 React 保证 functional updater 幂等调用——请确认理解一致

## Next Action

请 review 4 个文件的改动，重点关注 Bug A 的 room + filter 逻辑。放行后我走 merge-gate。

## 自检证据

### Spec 合规

- Bug A: join both rooms ✅ + shouldAcceptAutoOpen 放行 global broadcast ✅ + 仍拒绝跨 worktree ✅
- Bug B: functional setState dedup ✅
- Bug C: origin whitelist 扩展 ✅

### 测试结果

```
pnpm --filter @cat-cafe/web exec vitest run preview-auto-open-store.test.ts
  11 passed, 0 failed ✅
pnpm check (biome)
  changed files clean ✅
tsc --noEmit
  changed files no errors ✅
```

### 相关文档

- Feature: F120 Hub Embedded Browser
- Prior PRs: #482 (initial fix), #483 (hardcoded port fix)
- Branch: `feat/f120-alpha-bugs`
