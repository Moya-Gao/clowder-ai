---
feature_ids: [F016]
topics: [cli, image, flags]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: Claude/Gemini image flags mismatch causes CLI exit code 1

## 1) 报告人
- 报告人：铲屎官（前端手测）
- 发现方式：在 Cat Cafe 会话中发送“@布偶 @缅因 @暹罗 + 图片”后，状态栏显示 Claude CLI / Gemini CLI 同时异常退出，且猫猫没有产出回复。
- 关联线程：`thread_mln05knsjj6dncpt`（审计日志取证）

## 2) 复现步骤（期望 vs 实际）
1. 在聊天室粘贴或上传图片，并同时 @ 多只猫（含 opus/gemini）。
2. 点击发送，进入并发调用。
3. 观察状态栏与错误卡片。

期望行为：
- 三只猫都能收到消息；即便不支持图像直传，也不应因参数错误直接崩溃。

实际行为：
- Claude CLI 报 `unknown option '--images'` 并退出码 1。
- Gemini CLI 因 `-p` 与 `-i` 互斥报错并退出码 1。
- 前端表现为两条 CLI 异常退出错误。

## 3) 根因分析（定位过程）
- 审计日志确认同一条消息触发了三个 invocation；Codex 成功、Claude/Gemini 失败。
- 代码取证：
  - `ClaudeAgentService` 对每张图追加 `--images <path>`。
  - `GeminiAgentService` 对每张图追加 `-i <path>`，同时已使用 `-p`。
- 版本实测：
  - `claude --help` 无 `--images` 选项。
  - `gemini --help` 显示 `-i` 为 `--prompt-interactive`，与 `-p` 互斥。
  - 最小复现命令均稳定返回 code 1。

结论：
- 不是消息路由丢失，而是 CLI 参数协议与当前版本不匹配，导致进程在启动参数解析阶段失败。

## 4) 修复方案（含取舍）
方案：移除 Claude/Gemini 的错误图片 flags，改为与 Codex 一致的兼容策略：将图片绝对路径作为文本附加到 prompt（best-effort）。

为什么选这个：
- 立刻消除 code 1 的硬失败，恢复多猫并发可用性。
- 不依赖未文档化/已变更的 CLI 图像参数。
- 与现有 `contentBlocks` 存储兼容，改动小、风险低。

放弃的备选：
- 继续尝试 `--images`/`-i`：已被当前 CLI 明确否定。
- 立即改为 provider 原生多模态 API：改造面大，不适合作为紧急修复。

## 5) 验证方式
- 单元测试（Red→Green）：
  - 先让测试要求“无错误 flag + prompt 含图片路径”并验证现状失败。
  - 实现修复后转绿。
- 手工烟测：
  - 发送“@三猫 + 图片”，确认不再出现参数错误导致的 CLI code 1。
- 回归检查：
  - 纯文本消息路径不受影响。
