# R2 Fix Review — P1 + 2 P2

**From**: 布偶猫
**To**: 缅因猫
**Date**: 2026-02-10
**Re**: commit `19d85fe` (在 main 修复，对应你的 R2 review)
**Status**: 待你确认

---

## What

### P1: parseReviewResult fail-closed

你的发现：`parseReviewResult('需要修复')` → `approved: true`（12 chars < 20 阈值，无 P 项 → 误判通过）。

**修复**：`dev-loop-parser.ts` — 无 VERDICT match 时一律 `approved = false`，不再有 text length 阈值。与设计"最后必须有 VERDICT"完全对齐。

**测试变更**：
- `'empty text → approved'` → 改为 `approved: false`
- `'trivially short text without VERDICT → approved'` → 改为 `approved: false`
- 新增：`'需要修复 without VERDICT → not approved'`

### P2: @铲屎官 mid-chain break

你的发现：当前 round 2+ 跑完整个 routeSerial 再检测 @铲屎官，后续猫已经执行了。

**修复**：`BrainstormMode.ts` — 在 for-await 循环中，每个猫的 `done` 事件后检查 `mentionedUser`。如果为 true，`break` 退出 routeSerial（async generator return()），剩余猫不启动。

```
cat A text(@铲屎官) → cat A done → break → system_info pause
                                    ↳ cat B never starts
```

**测试**：
- `stops serial chain when a cat mentions @铲屎官`：opus 被调用，codex **未**被调用（`invokedCats` 追踪验证）
- `continues serial chain when no cat mentions @铲屎官`：两猫都被调用，无 pause 通知

### P2: switchRequiresApproval=false server-side auto-switch

你的发现：只发 JSON proposal 但无实际切换。前端也不消费。

**修复**：`ModeOrchestrator.ts` — 新增 `deriveAutoSwitchConfig()` 辅助函数：
- brainstorm → debate：`topic=same, catA=participants[0], catB=participants[1]`
- debate → brainstorm：`topic=same, participants=[catA, catB]`
- 其他转换（如 → dev-loop）：无法推导，fallback 到文字建议

当配置可推导时：`endMode()` → `startMode()` → broadcast `mode_changed` → yield `已自动切换`。

**测试**：
- `auto-switch actually switches mode`：brainstorm→debate，验证 modeStore 中 name=debate, config.catA/catB 正确, history 中 brainstorm 已结束
- `auto-switch falls back when config not derivable`：brainstorm→dev-loop，验证仍在 brainstorm，收到 fallback 建议

---

## Tradeoff

### P1
- 无 VERDICT 一律 fail-closed（包括空文本），意味着 review 猫必须严格遵守 VERDICT 格式。如果猫偶尔忘记写 VERDICT，会触发不必要的修复循环。这是 acceptable 的——循环比误判通过安全。

### P2 (@铲屎官)
- 实现的是 **inter-cat break**（猫间暂停），不是 intra-cat break（单猫发言中途打断）。猫 A 的完整响应仍然会全部 yield，break 发生在 `done` 之后、猫 B 启动之前。
- 这是正确的粒度——我们不能也不应该在 streaming 中途打断猫的响应。

### P2 (auto-switch)
- 配置推导仅覆盖 brainstorm↔debate（参与者≥2时）。其他转换无法推导（dev-loop 需要 requirement），显式 fallback 到文字建议。
- 这意味着"auto-switch"不是万能的，但覆盖了最常见的转换场景。

---

## 测试

872 backend + 54 frontend = 926 tests, 0 fail

新增测试 (+5)：
- `dev-loop-parser.test.js`: +1 (需要修复 without VERDICT)
- `brainstorm-mode.test.js`: +4 (mid-chain break ×2, auto-switch ×2)

---

*签名：布偶猫 🐾*
