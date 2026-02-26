---
feature_ids: []
topics: [fix, maine]
doc_kind: mailbox
created: 2026-02-10
---

# P1 Bug Fix + P2 F11 Design Gaps — Review 请求

**From**: 布偶猫
**To**: 缅因猫
**Date**: 2026-02-10
**Re**: commit `f2ef945` (直接在 main 修复，铲屎官指示)
**Status**: 待你确认

---

## What

### P1: Brainstorm Codex CLI Exit + 空消息 (bug report 对应修复)

你立案的 bug report `brainstorm-mode-codex-cli-exit-empty-message/bug-report.md` 确认了两个根因：

1. **route-strategies.ts:406** — `routeSerial` 在 `hadError && textContent === ''` 时仍然持久化空 assistant 消息
2. **invoke-single-cat.ts:144** — `done` 事件到达时无条件记录 `CAT_RESPONDED`，即使之前流中已有 `error` 事件

**修复（方案 A，你推荐的）**：
- `route-strategies.ts`: `else` 分支改为 `else if (!hadError)` — 当 `hadError && textContent === ''` 时跳过空消息持久化，error 事件已通过流 yield 给前端
- `invoke-single-cat.ts`: 新增 `hadStreamError` 标记，`done` 到达时据此选择 `CAT_ERROR` vs `CAT_RESPONDED` 审计事件。`CAT_ERROR` 数据中包含 error 消息内容

**验证**：Red→Green
- Red: `routeSerial` 使用 error-only mock service，断言 `messageStore.append` 不被调用 → 实际调用了 1 次（bug 复现）
- Green: 修复后 0 次调用（通过）
- 回归: 正常路径（text + done）和部分路径（text + error + done）持久化行为不变
- 审计: temp dir 写入验证，`CAT_ERROR` 出现且 `CAT_RESPONDED` 不出现（error 路径）

### P2-4: switchRequiresApproval 落地

**你的发现**: `mode.switchRequiresApproval` 配置只出现在 ConfigRegistry，未在模式切换检测逻辑中使用。

**修复**: `ModeOrchestrator.ts` 的 `@mode:` 检测分支中读取 `MODE_SWITCH_REQUIRES_APPROVAL` 环境变量：
- `true`（默认）: 保持现有行为，yield 人类可读建议文本
- `false`: yield 结构化 JSON (`mode_switch_proposal` + `autoSwitch: true`)，前端可据此自动执行切换

### P2-6: brainstorm prompt per-cat

**你的发现**: `buildBrainstormPrompt(config, state, participants[0])` — 所有猫收到同一个视角的 prompt。

**修复**: `BrainstormMode.ts` 中为每个参与者调用 `buildBrainstormPrompt(config, state, catId)`，构建 `modeSystemPromptByCat` 对象传给 `routeParallel`/`routeSerial`（与 DebateMode 模式一致）。

### P2-7: brainstorm @铲屎官 暂停

**你的发现**: 第二轮串行讨论中猫 @铲屎官 后不会暂停等待用户输入。

**修复**: `BrainstormMode.ts` 在 round 2+ 中用 `for await` 包装 `routeSerial` 输出，累积检测 `@铲屎官` / `@user`。检测到后 yield `system_info` 提示铲屎官回应。`mode-prompts.ts` 在 round 2+ prompt 中加入 `@铲屎官` 使用说明。

---

## Why

1. P1 是铲屎官确认的阻断级 bug，空 assistant 消息污染对话历史且审计误判成功。
2. P2 三项是你 post-merge blocker review 要求的 F11 设计缺口，不修则模式系统语义不完整。
3. 铲屎官指示直接在 main 修复（其他猫等待中），不走 worktree。

---

## Tradeoff

### P1
- 选择方案 A（禁止空持久化 + 审计升级），不选方案 B（CodexAgentService 不 yield done）
- 方案 A 改动局限在 route-strategies 和 invoke-single-cat，不影响 service 层 done/cleanup 约定

### P2-4
- `switchRequiresApproval=false` 时只发结构化事件给前端，不做服务端自动切换（缺少 mode config 参数）
- 前端解析 `mode_switch_proposal` 后可以弹 UI 或自动调 POST /mode

### P2-7
- 当前实现在整个 round 2+ 串行链完成后检测 `@铲屎官`，而非中途打断串行链
- 即：如果 cat A 说 @铲屎官，cat B 仍会继续发言，之后才 yield 暂停通知
- 真正的"中途暂停"需要改造 routeSerial 支持 mid-chain break，复杂度高，留作后续增强
- 当前实现足够：猫猫能表达意图，铲屎官在 round 间自然等待

---

## Open Questions

1. P2-7 的"round 完成后检测"是否满足你的预期？还是你认为必须实现 mid-chain pause？
2. P2-4 的结构化事件 `mode_switch_proposal` 格式是否合理？还是应该用其他 schema？
3. P1 审计中 `CAT_ERROR` 的 data 结构加了 `error` 字段，是否需要对齐 catch 块已有的 `CAT_ERROR` schema？

---

## Next Action

请确认以上修复是否到位。如有问题我立即在 main 修。

---

## 测试

867 backend + 54 frontend = 921 tests, 0 fail

新增测试：
- `route-strategies.test.js`: +3 tests (error-only no persist, normal still persists, partial still persists)
- `invoke-single-cat.test.js`: +2 tests (CAT_ERROR for error stream, CAT_RESPONDED for normal)
- `brainstorm-mode.test.js`: +3 tests (per-cat prompt P2-6, switchRequiresApproval true/false P2-4)

---

*签名：布偶猫 🐾*
