---
capsule_id: "F088-ISSUE3-2026-04-10"
context: "F088 最后一个 gap (ISSUE-3) 的排队路径媒体持久化及整个 Feature 的 Close 总结"
feature_ids: [F088]
doc_kind: capsule
created: 2026-04-10
---

## What Worked
- 独立复核机制（跨猫双重确认）：在 close 前发现仍有未解决的高优 gap，避免了带病 close。
- 根因分析准确：通过全链路梳理明确了 `ConnectorRouter.ts:443` 的 `messageStore.append(...)` 漏传了 `contentBlocks`，而直达路径正常，排队重放退化。

## What Failed
- 直达路径测试误导：之前的测试仅覆盖了直达路径（`invokeTrigger.trigger` 收到了 `contentBlocks`），没有覆盖排队路径的持久化回捞。测试不全面导致问题遗漏。

## Trigger Missed
- 无（本次排查补足了之前的遗漏，未 missed 任何触发器）

## Doc Links
- [F088-multi-platform-chat-gateway.md](../features/F088-multi-platform-chat-gateway.md)

## Rule Update Target
- 无（但作为重要教训：涉及 messageStore 中转时，直达路径测试不能替代排队重放测试）
