---
capsule_id: "CLI-LIVENESS-2026-04-20"
context: "Codex CLI 无头 exec_command 长任务 / 后台子进程生命周期验证"
feature_ids: []
doc_kind: capsule
created: 2026-04-20
---

## Scope
- 只针对 **Codex CLI 无头 exec harness** 下的 `exec_command` / `write_stdin` 行为成立。
- 不把这个结论外推成“普通终端里 `nohup` 永远没用”。普通 shell 的作业控制语义和这里的 harness 生命周期不是一回事。

## Experiment Matrix

| 模式 | 验证方式 | 结果 | 结论 |
|------|----------|------|------|
| 前台长任务 + `session_id` | `echo start; sleep 12; echo done`，15s 后才 `write_stdin(session_id)` | 仍收到 `done` | `session_id` 本身就能承接前台长任务；短时间不轮询不会自动杀任务 |
| shell 后台 `&` | `(sleep 4; echo ok >> file) &` | `file` 缺失 | 父 shell 结束后，后台子进程未继续存活 |
| `nohup ... &` | `nohup bash -lc 'sleep 4; echo ok >> file' &` | `file` 缺失 | `nohup` 在这个 harness 里不够，不能当可靠后台方案 |
| `setsid ... &` / `disown` | 各跑一轮 | `file` 缺失 | shell 层 detach 仍不足以跨过 harness 生命周期 |
| Node detached spawn | `spawn(..., { detached: true, stdio: 'ignore' }); child.unref()` | 4s / 20s 后结果文件都存在 | 真正脱离父进程树后，任务能在 CLI 命令结束后继续跑完 |

## What Changed In My Model
- 之前容易把“持续轮询”误当成长任务保活机制。实测后更准确的说法是：**轮询负责拿进度，不负责保活**。
- 真正的分界线不是“前台/后台”这四个字，而是谁拥有生命周期：
  - 需要交互 / 持续输出：让任务留在当前 `session_id`
  - 需要 fire-and-forget：必须用真正 detached 的子进程，并改成看日志/结果文件/端口/PID 这类外部探针

## Supporting Evidence In Repo
- `docs/discussions/2026-03-13-f059-sync-runtime-postmortem.md`
  - 已记录一次真实事故：从 CLI 手动拉起 proxy，CLI session 结束后 proxy 跟着死；`nohup` 方式不正确
- `docs/archive/2026-02/mailbox/2026-02-14/2026-02-14-h71-full-review-result-to-codex.md`
  - 已有明确结论：`detached spawn + child.unref()` 是正确的非阻塞设计
- `packages/api/src/domains/cats/services/agents/providers/GeminiAgentService.ts`
  - Antigravity adapter 现行实现就是 `detached: true` + `child.unref()`

## Rule Update Target
- `assets/system-prompts/cats/codex.md`
- `docs/lessons-learned.md`
