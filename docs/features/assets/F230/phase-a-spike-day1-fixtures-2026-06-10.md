# F230 Phase A Spike — Day 1 Fixtures (2026-06-10)

> Owner: 宪宪 Fable-5 | 环境: macOS, tmux, claude 2.1.170, Claude Max 订阅, model claude-opus-4-8
> Worktree: cat-cafe-f230-pty-spike (spike/F230-pty-carrier, base e5f710af2)

## Interactive 身份 capsule (AC-A0)

| 字段 | 实采值 |
|------|--------|
| argv | `claude`（零 flag——无 `-p` 无 `--bg`；resume 轮: `claude --resume 78077385-…`） |
| spawn | tmux pane (PTY)，pane_pid=89817 (zsh) → claude 子进程 |
| TTY | `ttys008`（ps 实采，真 PTY） |
| version | 2.1.170 (Claude Code) |
| auth | Claude Max 订阅（启动横幅实采 "Opus 4.8 (1M context) with high effort · Claude Max"） |
| entrypoint（污染对照） | `sdk-cli` ×8 — pid 90352 env 实采 `CLAUDE_CODE_ENTRYPOINT=sdk-cli`（继承自 spawn 者 = SDK 起的猫 session；tmux server 继承链） |
| entrypoint（干净 env） | **`cli` ×8** — pid 98588 env 实采 ENTRYPOINT_ABSENT（`unset CLAUDE_CODE_ENTRYPOINT CLAUDECODE` 后启动） |
| 未误走 print/SDK | TUI 全程交互态（❯ 输入框 + spinner + response 气泡），transcript 含 interactive 专属事件（ai-title/file-history-snapshot/skill_listing） |

**E1 教训（production 级要点）**：嵌套 spawn 必污染 entrypoint——cat-cafe API spawn PTY 时必须 delete `CLAUDE_CODE_ENTRYPOINT`/`CLAUDECODE`（F198 `buildClaudeEnvOverrides` 已有该逻辑，Phase B 直接复用）。AC-A0 capsule 第一跑即逮住假阳性，证明砚砚 Design Gate P1#2 的必要性。

## E1: 基础 cycle — PASS

- 启动：worktree cwd 无 trust dialog（同 repo 信任继承）；"⚠ 3 setup issues: MCP" 不阻塞。冷启动到 ready ≈ 10-15s。
- 注入坑 + 解法：**两段式**——send-keys 文本 → sleep ≥2s → 单独发 Enter（连发时 Enter 被 TUI 渲染循环吞）。
- cycle：prompt `F230_SPIKE_E1_PURR` → response ⏺ 精确回显（Cogitated 3s）→ transcript 落盘 `~/.claude/projects/-…-f230-pty-spike/<sessionId>.jsonl`。

## E2: 长 prompt 注入 — PASS（两档全过）

| 档 | 生成 bytes | transcript user_msg bytes | needle |
|----|-----------|--------------------------|--------|
| 50K | 62,350 | **62,350**（一字不差） | `F230_E2_NEEDLE_50K` 精确命中 |
| 200K | 204,596 | **204,596**（一字不差） | `F230_E2_NEEDLE_200K` 精确命中 |

机制：`tmux load-buffer <file>` + `paste-buffer -p`（bracketed paste）→ sleep 6-12s → Enter。无截断、无分片、无 ARG_MAX 问题（argv 不携带 prompt）。

## E3: 旁路读 transcript（输出面） — PASS

- 三次 needle 验证全部从 transcript 取证（屏幕仅人眼观看，未参与任何断言——KD-2 双通道哲学自证）。
- 干净 session 事件类型实采：`assistant/user/text/message/system/attachment/mode/permission-mode/skill_listing/mcp_instructions_delta/deferred_tools_delta/hook_success/ai-title/file-history-snapshot/last-prompt` —— 信息密度 ≥ bg transcript（结构同源，TranscriptTailer 直接可用）。
- model 字段实采：`claude-opus-4-8`。

## E4: resume 语义（命门） — PASS：原地续写，零 fork

- 流程：/exit 干净退出 → `claude --resume 78077385-…` → 问上轮 token → 秒答 `F230_SPIKE_E1B_CLEAN`（Brewed 2s）。
- **id 证据**：resume 后目录仍 2 个 jsonl（无新文件）；resume 轮对话写入**原文件**；文件内 30 个 sessionId 字段全部 = `78077385-…`。
- 对照 bg（F198 Bug #3 探索轮 1）：bg resume live worker 撞 already-in-use → 强制 `--fork-session` 每轮新 id → chainKey 会员卡整套工程。interactive 退出后冷恢复不撞 → **bg 的失忆工程在 interactive 结构性不存在**，Phase C sessionChain 走 cliSessionId 直连分支。

## 四实验汇总 → 核心可行性 GO（待 AC-A5 runway 三档 + 报告收口）

| 实验 | 结论 |
|------|------|
| E1 cycle + capsule | PASS（含污染对照组） |
| E2 长 prompt | PASS 50K+200K 一字不差 |
| E3 旁路读 | PASS 事件全套 |
| E4 resume | PASS 原地续写零 fork |

残留（Day 2）：runway 三档 telemetry 校准（AC-A5①）+ skeleton 工期对照（②）+ dev support 问询登记（③）+ go/no-go 报告 + F198 AC-D6 回写。OQ-5（transcript 写盘粒度/streaming 时机）+ OQ-8（cancel 注入方式）随 Day 2 顺带采。
