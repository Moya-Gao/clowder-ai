---
feature_ids: [F061]
related_features: [F061]
doc_type: review_request
status: open
last_updated: 2026-04-21
---

# Review Request: F061 Bundle B — run_command permission guard before native execute

Review-Target-ID: f061
Branch: feat/f061-parity-v2

## What
- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts`
  - 在 `nativeExecuteAndPush` 的 `RunCommand` unary 之前，显式发 `HandleCascadeUserInteraction { permission: { allowed: true }, trajectoryId, stepIndex }`
- `packages/api/test/antigravity-bridge-native-execute.test.js`
  - 新增回归：必须先过 `HandleCascadeUserInteraction`，再跑 `RunCommand`
- `docs/features/F061-antigravity-bengal-cat.md`
  - 同步 Bundle B 当前分支状态：PermissionManager guard 已补，真实 Antigravity 环境尚待复验

## Why
- `@antig-opus` 的真实环境验证已经把边界钉实：`run_command` 在简单 `git log --oneline` 上 `context canceled` 2/2 稳定复现
- `docs/research/2026-04-17-f061-phase-2c-probe-results.md` 也给出了更细的根因：error stack 指向 `PermissionManager.PromptUser`
- 当前 bridge 直接 `RunCommand` + `pushToolResult`，但**没有**显式走 stage 1 的 `HandleCascadeUserInteraction { permission: { allowed: true } }`
- 这次先补最小 guard，验证“是不是 PermissionManager 这层没被满足”这一条机制

## Original Requirements（必填）
> “来规划一下我们之后还要修复哪些这个f61的issue？”  
> “你好像可以at出来我们的孟加拉猫猫 opus那只让他试试看？你修复的那些他能不能用了？”  
> “`run_command`：`context canceled` on simple `git log --oneline` — 2 out of 2 attempts failed”

- 来源：thread 原话 + `docs/features/F061-verification-2026-04-21.md`
- 请 reviewer 对照判断：这次改动是否是一个**合理的最小 Bundle B 子步**，而不是继续盲加复杂 executor

## Tradeoff
- 这次没做完整 tool parity v2，只补了 `run_command` 的 PermissionManager guard
- 好处：改动面小，能先验证 `PromptUser → context canceled` 这条机制假设
- 代价：`read_file` / `write_file` / `edit_file` / `grep_search` / `file_glob` 仍然没开始，实机是否真的消掉 `context canceled` 还要再找 `@antig-opus` 复验

## Open Questions
- 你是否同意把这次缩成 “permission guard before native execute” 是最小正确边界？
- 如果 `HandleCascadeUserInteraction` 失败，你倾向于现在的“让 nativeExecuteAndPush 冒泡失败并由 service 记录 warning”，还是应该显式转成 fatal？
- 这一步之后，下一跳是先找 `@antig-opus` 真实复验，还是继续把 v2 executors 一起补上更合理？

## Next Action
- 请 review 这 3 个文件的改动边界
- 重点看：
  1. `HandleCascadeUserInteraction` 的 payload 是否正确
  2. 调用顺序是否应该严格在 `RunCommand` unary 之前
  3. 文档是否准确表达“已补 guard，但未宣称实机已修好”

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f061/sonnet`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- 愿景对照：这次只 claim “补上 run_command 的 PermissionManager 前置 guard”，没有越界 claim “Bundle B 全部闭环”
- F061 真相源已更新：`docs/features/F061-antigravity-bengal-cat.md`
- 根目录工件闸门：无根目录媒体/设计工件

### 测试结果
- `CI=1 NODE_ENV=development pnpm --filter @cat-cafe/api run build` ✅
- `node --test packages/api/test/antigravity-agent-service-executors.test.js packages/api/test/antigravity-bridge-native-execute.test.js packages/api/test/antigravity-run-command-executor.test.js packages/api/test/antigravity-agent-service-fatal-errors.test.js`
  - `38 passed, 0 failed` ✅

### 相关文档
- Feature: `docs/features/F061-antigravity-bengal-cat.md`
- Verification: `docs/features/F061-verification-2026-04-21.md`
- Research: `docs/research/2026-04-17-f061-phase-2c-probe-results.md`
