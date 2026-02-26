---
feature_ids: []
topics: [mode, command, auto]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: `/mode` 快速入口未自动 kickoff，需再次 `@` 才会开始

## 1. 报告人
- 报告人：铲屎官（聊天反馈）
- 定位猫猫：缅因猫
- 发现方式：用户反馈“快速开启头脑风暴后仍需再 `@` 两只猫才能启动”

## 2. 复现步骤（期望 vs 实际）
1. 在输入框执行：`/mode brainstorm 模式启动回归 @布偶 @缅因`
2. 观察前端请求与会话行为

期望行为：
- 模式启动成功后，自动发送一次 kickoff 消息，立即触发该模式下的首轮执行
- 用户不需要再手工补一条 `@...`

实际行为：
- 仅调用一次 `POST /api/threads/:threadId/mode`，模式状态变为 active
- 没有后续 `POST /api/messages`，模式未立即执行
- 用户需要再次发送 `@...` 或普通消息，才会真正触发模式执行

## 3. 根因分析
- 前端 `useSendMessage` 对命令路径是“命令即拦截返回”：`processCommand()` 返回 `true` 后，不会走常规 `/api/messages` 发送链路。
- `useChatCommands` 的 `/mode` 分支当前只负责 start/end/status，不会在 start 成功后再发 kickoff 消息。
- 后端 `messages.ts` 的 `ModeOrchestrator.execute()` 仅在收到消息（`/api/messages`）时触发；仅启动模式不会自动执行。

结论：
- 这是前端命令语义缺口，不是后端编排器故障。

## 4. 修复方案（含取舍）
选定方案：
- 在 `useChatCommands` 中，当 `/mode brainstorm|debate|dev-loop` 启动成功后，自动补发一次 `/api/messages` kickoff：
  - brainstorm/debate：kickoff 内容用 `topic`
  - dev-loop：kickoff 内容用 `requirement`
- kickoff 失败不回滚“模式已启动”，但追加系统错误提示，保持状态透明。

放弃方案：
- 方案 A：改后端 `POST /mode` 后自动执行一次
  - 放弃原因：会把“状态管理”与“消息执行”耦合到 modes route，破坏现有消息驱动模型。
- 方案 B：仅改 UI 文案提示“启动后请再发一条消息”
  - 放弃原因：用户体验退化，仍保留流程摩擦。

## 5. 验证方式（Red → Green）
Red（已执行）：
- 新增测试：`packages/web/src/hooks/__tests__/useChatCommands-mode-kickoff.test.ts`
- 命令：
  - `pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useChatCommands-mode-kickoff.test.ts`
- 失败点：
  - `expected mockApiFetch to be called 2 times, but got 1 time`
  - 证明当前实现未触发 kickoff 请求

Green（已执行）：
- `pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useChatCommands-mode-kickoff.test.ts`
  - 结果：`1 passed, 0 failed`
  - 断言通过：`mockApiFetch` 共 2 次调用（第 2 次为 `/api/messages` kickoff）
- `pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useChatCommands.test.ts`
  - 结果：`14 passed, 0 failed`
  - 说明：既有命令边界测试未回归
