---
type: review-request
date: 2026-04-14
author: opus
reviewer: gpt52
feature: F061
branch: feat/f061-yolo-auto-approve
status: pending
---

# Review Request: F061 YOLO Auto-Approve for Antigravity

Review-Target-ID: f061
Branch: feat/f061-yolo-auto-approve

## What

3 files changed (+73 / -7):

- **AntigravityBridge.ts**: 新增 `resolveOutstandingSteps(cascadeId)` 和 `approveInteraction(cascadeId, interaction)` 两个 RPC 方法
- **AntigravityAgentService.ts**: 新增 `autoApprove` 选项（默认 true），`awaitingUserInput` 时自动调 `ResolveOutstandingSteps` 批准，失败 fallback 到 liveness_signal
- **antigravity-waiting-approval.test.js**: 4 个测试覆盖 approve/fallback/disabled 路径

## Why

Bug-6 修了 `awaitingUserInput` 误报 stall 的问题，但孟加拉猫执行 shell/browser/MCP 动作时仍然卡在 Antigravity 的审批弹窗，需要铲屎官手动去 Antigravity UI 点批准。铲屎官明确要求 YOLO 模式——Claude Code / Codex / OpenCode 都是 YOLO，Antigravity 不应该不行。

## Original Requirements（必填）

> "先搞个yolo 用用？然后你们再设计这个，这里哈哈哈你们有点过度设计了。咋你们claude code codex opencode 全yolo 人家antigravity不行？"
> "最好少审批，他这点一个鼠标按钮都要我审批一下，我之前用antigravity觉得贼难用 我不要这种"

- 来源：本 thread 铲屎官消息（2026-04-14 06:10 / 06:06）
- **请对照上面的摘录判断：交付物是否实现了"YOLO 自动审批、不卡弹窗"的目标？**

## Tradeoff

- **选了 `ResolveOutstandingSteps` 而非 `HandleCascadeUserInteraction`**：前者只需 cascadeId 一个参数，批量解决所有待审批步骤；后者需要 trajectory_id + step_index + 精确的交互类型构造（17 种 oneof），复杂度高得多
- `approveInteraction` 方法作为备用保留，未来如果需要精确控制单个交互类型（比如只批准 shell 不批准 deploy）可以用
- 默认 `autoApprove=true`（YOLO）——铲屎官明确说"少审批"，所以默认开

## Open Questions

1. **`ResolveOutstandingSteps` 语义**：从 proto 逆向得到，名称暗示"解决待处理步骤"。如果实际语义是"跳过/取消"而非"批准"，需要改用 `HandleCascadeUserInteraction` + `confirm: true` 方案。这需要实际跑孟加拉猫触发审批来验证
2. **失败 fallback**：auto-approve 失败时 fallback 到 liveness_signal（不 break 流程），是否足够？还是应该重试？

## Next Action

请 review 代码变更，重点关注：
- auto-approve 的错误处理路径是否安全（不会吞掉异常导致死循环）
- `resolveOutstandingSteps` 的 RPC payload 是否正确（`{ cascadeId }` vs `{ cascade_id }`）
- 测试覆盖是否充分

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f061/gpt52`
- Start Command: `pnpm review:start`
- Ports: 纯后端改动，不需要起 web（API 测试 `node --test` 即可）

## 自检证据

### 测试结果

```
node --test packages/api/test/antigravity-waiting-approval.test.js
  ✔ pollForSteps yields awaiting-user-input state instead of throwing stall
  ✔ service auto-approves via resolveOutstandingSteps when autoApprove=true (default)
  ✔ service falls back to liveness_signal when auto-approve fails
  ✔ service emits liveness_signal when autoApprove=false
  4 passed, 0 failed

node --test packages/api/test/antigravity-agent-service.test.js
  16 passed, 0 failed

pnpm --filter @cat-cafe/api run build   # 成功
pnpm --filter @cat-cafe/api run lint    # tsc --noEmit 通过
pnpm check                              # Biome 通过
```

### 相关文档

- Feature: `docs/features/F061-antigravity-bengal-cat.md`
- Bug-6 PR: #1163（砚砚修的 awaitingUserInput 检测，本 PR 在此基础上加 auto-approve）
