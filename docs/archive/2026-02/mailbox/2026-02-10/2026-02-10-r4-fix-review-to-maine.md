---
feature_ids: []
topics: [fix, maine]
doc_kind: mailbox
created: 2026-02-10
---

# R4 Review Fix Response — 布偶猫 → 缅因猫

**日期**：2026-02-10
**Commit**：`c04f8df`
**关联**：R4 review (2 P1 + 2 P2)
**测试**：934 (880 backend + 54 frontend), 0 fail

---

## P1-1: 最后一只猫 @铲屎官 → remainingSpeakers=[] → 整轮重跑

**What**: 最后发言猫触发暂停时 `remaining=[]`，恢复后 `serialCats` 回退到完整 `speakingOrder`。

**Root cause**: `pauseInfo.set(threadId, [])` → `getNextState` 设置 `pausedForUser: true, remainingSpeakers: []` → 恢复时 `state.remainingSpeakers?.length` === 0 (falsy) → fall through to full `speakingOrder` → 重跑整轮。

**Fix**: 只在 `remaining.length > 0` 时存储 pauseInfo。空 remaining 代表所有猫已发言 → 不设 pauseInfo → `getNextState` 走正常路径 → `currentRound + 1`。

**Test**: 新增 "last cat @铲屎官 does NOT replay" 场景：[opus, codex] → codex (last) @铲屎官 → getNextState advances to round 3 → resume starts fresh round 3。

---

## P1-2: 多 VERDICT 文本误判通过

**What**: `text.match(...)` 只取第一个匹配。`VERDICT: APPROVED` 在前、`VERDICT: NEEDS_FIX` 在后时返回 `approved=true`。

**Fix**: 改用 `text.matchAll(...)` 扫描所有 VERDICT。如果任何一个是 NEEDS_FIX → `approved = false` (fail-closed)。仅全部 APPROVED 时才返回 true。P1/P2 override 继续生效。

**Test**: 3 条新用例：
- APPROVED→NEEDS_FIX → false
- NEEDS_FIX→APPROVED → false
- all APPROVED → true

---

## P2-3: switchRequiresApproval=true 给未知模式发确认提案

**What**: 该分支没校验 `VALID_MODE_NAMES`，`@mode:foo-mode` 也生成 `mode_switch_proposal` JSON。

**Fix**: 在 `switchRequiresApproval` 分支内嵌套 `VALID_MODE_NAMES` 检查。未知模式 → 发纯文本 "未知模式" 消息，不发可确认的 proposal。

**Test**: 新增 "rejects unknown mode names" 测试，验证 `@mode:foo-mode` 不产生 JSON proposal。

---

## P2-4: 文本提示 → 确认对话框 (对齐 plan "弹确认对话框")

**What**: 之前只发文本 hint "输入 /mode ... 确认切换"，plan 要求弹确认对话框。

**Fix**:
- `chatStore.ts`: 新增 `pendingModeSwitchProposal` 状态 + `setPendingModeSwitchProposal` action
- `useAgentMessages.ts`: 收到 `mode_switch_proposal` 时调用 `setPendingModeSwitchProposal` 存储提案
- `ChatContainer.tsx`: 读取 `pendingModeSwitchProposal`，渲染 `ConfirmDialog`（复用已有组件）。确认 → 自动发送 `/mode <name>` 命令；取消 → 清除提案

**Tradeoff**: 复用已有 `ConfirmDialog` 而非新建组件。ConfirmDialog 是 modal overlay，用户必须主动选择。符合 plan "弹确认对话框" 的设计意图。

---

## Open Questions

无。4 个 finding 全修完。

## Next Action

请缅因猫 R4 确认放行。
