---
feature_ids: []
topics: [hydration, cancel-button, hotfix]
doc_kind: mailbox
created: 2026-05-17
---

# Review Request: fix /queue+/messages hydration race — cancel button disappears

Review-Target-ID: fix-cancel-hydration
Branch: fix/cancel-button-hydration-race

## What
`useChatHistory.ts` hydration race: `/queue` (lightweight) returns before `/messages` (heavier). When `/queue` reports idle, it clears `hasActiveInvocation` and persists to IDB. `/messages` then returns draft messages with `isStreaming: true` but never restores `hasActiveInvocation`. Result: cancel button disappears (ChatInputActionButton sees `hasActiveInvocation=false`).

Fix: Added `restoreActiveFromDrafts()` — after message hydration (both replace and prepend paths), checks for `isDraft` messages and restores synthetic active invocation slots for each drafting cat.

## Why
P1 bug reported by 铲屎官: "猫猫在回复时右下角应有取消按钮，现在没了！发送按钮变成麦克风而不是取消按钮。" Users can't tell if a cat is working or stuck, and can't cancel.

## Original Requirements
> 你们这里应该学了开源的一个东西 就是 当猫猫在回复或者说在a2a 原本右下角都有一个取消按钮 现在没了！
> 以前是有 右下角那个发送按钮变成一个取消按钮，现在是没了啊！是变成之前那张图的语音输入按钮啊
- 来源: 铲屎官直报 (2026-05-17 runtime thread)
- **请对照上面的摘录判断：draft 消息存在时 cancel 按钮是否正确出现**

## Tradeoff
- 选择在 `useChatHistory` 层修复（message hydration 之后恢复 active state），而非在 `ChatInputActionButton` 层添加 fallback。砚砚诊断推荐此方案：不碰主按钮优先级链，从 root cause 修。
- `restoreActiveFromDrafts` 是 idempotent —— 如果 `/queue` 已经正确设了 active state，early return（`alreadyActive` check）。

## Architecture Ownership
Architecture cell: hydration/state-reconciliation
Map delta: none
Why: Extends existing `fetchHistory` callback with draft-aware active state restoration. No new store/queue/router.

## Open Questions

### 技术 OQ（给 reviewer）
1. Race window: `/queue` clears active → `/messages` restores it. There's a brief window where `hasActiveInvocation=false`. Is the synthetic slot ID prefix (`draft-restore-`) safe against collision with real invocation IDs (`hydrated-` prefix)?
2. Should `restoreActiveFromDrafts` also persist to IDB via `saveThreadActiveState`? Currently it doesn't — the assumption is the next real socket event or `/queue` refresh will provide the authoritative state.

### 价值 OQ（给 CVO）
无

## Next Action
Please review the fix for correctness. Key files:
- `packages/web/src/hooks/useChatHistory.ts` (lines 552-584: `restoreActiveFromDrafts`, line 726+740: call sites)
- `packages/web/src/hooks/__tests__/useChatHistory-draft-restores-active.test.ts` (2 tests)

## Review Sandbox
- Path: `/tmp/cat-cafe-review/fix-cancel-hydration/codex`
- Start Command: `pnpm review:start`
- Ports: allocated by review:start (not 3001/3002/3011/3012/4111)

## 自检证据

### Spec 合规
- Vision check: cancel button visibility restored when cat is streaming (matches 铲屎官 complaint)
- No UI component changes — state management fix only
- Hotfix pattern detected: cross-cat review required (砚砚 reviewing)

### 测试结果
```
vitest run → 411 files, 3080/3080 pass
pnpm lint → 0 errors (warnings only, pre-existing)
pnpm check → 0 errors
tsc --noEmit → 0 errors
```

### Fallback layers
`node scripts/check-fallback-layers.mjs` → No fallback pattern changes

### 相关文档
- Root cause diagnosis: 砚砚 (2026-05-17, same thread)
- No formal spec/plan — this is a regression fix
