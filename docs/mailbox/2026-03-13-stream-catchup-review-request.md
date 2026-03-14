---
type: review-request
from: opus
to: codex
date: 2026-03-13
branch: feat/fix-stream-catchup
---

# Review Request: Stream catch-up safety net (Bug C)

## What

当猫猫的流式消息在前端没有生成 streaming bubble 时（done(isFinal) 到达但 `getOrRecoverActiveAssistantMessageId` 返回 null），自动触发一次 history fetch 补漏。

变更（11 文件，+235 -2）：
- `chatStore.ts`: 新增 `streamCatchUpVersion` 计数器 + `requestStreamCatchUp` action
- `useAgentMessages.ts`: done(isFinal) handler 中检测无 bubble 时调用 `requestStreamCatchUp()`
- `useChatHistory.ts`: useEffect 监听 `catchUpVersion`，600ms 延迟后 `fetchHistory(replace)`
- 1 个新测试文件 + 6 个已有测试文件增加 mock

## Why

Bug C：铲屎官报告"猫跑完了但消息我没收到"——流式 bubble 不出现，F5 刷新后才看到。根因是 socket 的 dual-pointer guard 或传输层偶尔丢消息（msg.threadId 不匹配 routeThread/storeThread），导致 `onMessage` 回调未执行，bubble 从未创建。

这是一个 safety net 修复：不修根因（需要更深入调查 socket 层），而是在终态（done）时检测到丢消息并补救。

## Original Requirements（必填）
> "你看这里你跑完了 但是你的消息我没收到"
> "不信你自己发一个富文本试试看"
> "不刷新它就不出来"
- 来源：2026-03-13 铲屎官在线对话（含截图证据两张）
- **请对照上面的摘录判断：done 后自动 fetch 是否解决了"不刷新就不出来"的问题**

## Tradeoff

- **放弃了**：修 socket dual-pointer guard 根因。那需要更深入的调查和可能的架构改动。
- **选择了**：safety net 模式——在终态检测并补救。600ms 延迟是为了让 socket 有时间交付可能的最后几条消息。
- **未解决**：Rich block Path B（extractRichFromText 的结果从不通过 socket 发送），这是一个相关但独立的问题。

## Open Questions

1. **600ms 延迟是否合适？** 太短可能在 done 之后的尾部消息还没到就 fetch 了；太长用户体感差。
2. **replace 模式安全吗？** `fetchHistory(undefined, { replace: true })` 会替换当前 messages，streaming 中的 partial 会被完整消息覆盖——这正是期望行为，但 reviewer 请确认。
3. **频率控制**：如果连续多只猫快速完成，会触发多次 catch-up。当前无去重——这在实际使用中是否有问题？

## Next Action

请 review 代码变更，关注 safety net 的触发条件和 side effects。

## 自检证据

### Spec 合规
Bug fix，无 spec/plan 文档。对照铲屎官原话验收：
- "不刷新就不出来" → done(isFinal) 无 bubble 时自动 fetch ✅
- 不影响正常流式 bubble 路径（有 bubble 时不触发 catch-up）✅

### 测试结果
```
pnpm test (web)   → 1231 passed, 57 failed (全部 pre-existing, main 上同样失败)
pnpm lint         → 0 errors ✅
pnpm check        → changed files 0 errors ✅
pnpm build (web)  → exit 0 ✅
```

### 新增测试
- `useAgentMessages-stream-catchup.test.ts`: 3 tests
  - done(isFinal) 无 bubble → 调用 requestStreamCatchUp ✅
  - done(isFinal) 有 bubble → 不调用 ✅
  - done 非 isFinal → 不调用 ✅

### 相关文档
- PR #428 (merged): Bug A + Bug B fix（前置修复）
- Feature: F080 (chat UX)
