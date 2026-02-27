---
feature_ids: [F016]
topics: [codex, exec, image]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: Codex `exec --image` 吞掉 prompt 导致 CLI code 1

## 1) 报告人

- 报告人：铲屎官（聊天窗口实测）
- 定位人：缅因猫（砚砚）
- 发现时间：2026-02-18

## 2) 复现步骤（期望 vs 实际）

复现：
1. 在 Cat Cafe 中给缅因猫发送一条带图片消息（新会话/无 session resume）。
2. 后端走 `codex exec --json ... --image <path> <prompt>` 调用。
3. 前端出现 `Error: Codex CLI: CLI 异常退出 (code: 1, signal: none)`。

期望：
- Codex CLI 正常收图并处理 prompt。

实际：
- CLI 进入“从 stdin 读取 prompt”的分支并直接退出（无 stdin 输入时 code 1）。

## 3) 根因分析（定位过程）

核心证据：
- `codex exec --help` 显示 `--image <FILE>...`（可变参数）。
- 当命令形态是 `codex exec ... --image /tmp/a.png "prompt"` 且未加分隔符时，`"prompt"` 会被 `--image` 吸收为额外文件参数。
- 结果是 CLI 认为“没有 positional prompt”，转而读取 stdin；无输入时退出码 1。
- `codex exec resume` 路径未复现该问题（其 help 显示 `--image <FILE>` 非可变参数），因此故障集中在 fresh exec 路径。

结论：
- 这是 CLI 参数拼装错误，不是“Codex 无法收图”能力问题。

## 4) 修复方案（含取舍）

方案：
- 在 `CodexAgentService` 里统一将 prompt 形态改为 `-- <prompt>`，即：
  - `... --image <path> -- <prompt>`
  - `... -- <prompt>`（无图也统一保持显式边界）

Why：
- `--` 能终止选项解析，阻止 `--image` 继续吞 positional 参数。
- 兼容当前与后续 CLI 参数解析行为，修复点小、风险低。

Tradeoff：
- 参数数组多一个显式分隔符，但语义更稳定，几乎无负面影响。

## 5) 验证方式

Red -> Green：
1. 新增测试：`fresh exec with --image inserts "--" before prompt ...`
2. Red：修复前断言失败（prompt 前是图片路径，不是 `--`）。
3. Green：修复后断言通过。

回归：
- `node --test packages/api/test/codex-agent-service.test.js` 全绿。
- `node --test packages/api/test/image-upload.test.js` 全绿。
