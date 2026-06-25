---
feature_ids: [F167]
topics: [gate, hook, review, response]
---

# Review Response R1: F167 Phase P-0 — gate-background-guard

Review-Target-ID: f167-phase-p0
Branch: feat/f167-phase-p0
Commit: 3c8401f5c

## Finding 处理

| # | Finding | 立场 | 详细 |
|---|---------|------|------|
| P1-1 | Codex 执行链不覆盖 | Push back（scope） | 见下 |
| P1-2 | Timeout 自动后台化不拦 | Push back（addressability） | 见下 |
| P2 | Regex 误伤 quoted/filename | ✅ Fixed | Red→Green，26/26 pass |

---

### P2 ✅ Fixed — Regex false-positive guard

**问题**：`echo 'pnpm test'` / `cat docs/pre-merge-check-notes.md` 被误杀。

**修复**：
1. 匹配前先 `sed` 剥离单引号和双引号内容——quoted 不是执行
2. `pre-merge-check` 收紧为 `pre-merge-check\.(sh|bash)`——文件名不是脚本调用

**测试**：+5 新测试（4 false-positive ALLOW + 1 "引号后真执行" DENY）。
- `echo 'pnpm test'` + bg=true → ALLOW ✅
- `cat docs/pre-merge-check-notes.md` + bg=true → ALLOW ✅
- `printf "pnpm build"` + bg=true → ALLOW ✅
- `grep -r "pnpm check" docs/` + bg=true → ALLOW ✅
- `echo 'setup' && pnpm test` + bg=true → DENY ✅（`&&` 后是真执行）

Red→Green：4 个 FAIL → 修 hook → 26/26 PASS。

---

### P1-1 Push Back — Codex 覆盖是不同层的问题

**Accept finding 本身**：Codex（`codex exec --json`）确实不走 PreToolUse hook chain。

**Push back on scope**：

1. **4 个报告者全是 Claude 系**（gpt54/opus46/47/48）。这个 hook 止住了 100% 的已知 bug。
2. **PreToolUse 是 Claude CLI 的 hook 面**。Codex 有自己的执行链，覆盖它需要不同机制（CodexAgentService 级 guard / Codex operator system prompt overlay / Codex 侧 hook 如果存在）。
3. 把 Codex 覆盖塞进这个 PR = 用错误的工具解决正确的问题。

**已做**：在 hook 头注释中诚实记录此 scope 边界（已 commit）。

**建议**：Codex 覆盖作为 Phase P 的已知 gap 记到 spec，单独实现。不是 follow-up 尾巴——是"需要不同机制"的独立工作项。

---

### P1-2 Push Back — PreToolUse 层结构上无法拦截运行时 timeout

**Accept finding 本身**：LL-075 确实记录了"前台命令超 600000ms timeout cap 自动后台化"。

**Push back on addressability**：

1. **PreToolUse hook 在命令执行前跑**。它看到的是 `{tool_name: "Bash", tool_input: {command: "pnpm gate", run_in_background: false}}`——前台请求。
2. **自动后台化发生在执行中**（命令跑了 10+ 分钟后触发 timeout）。执行前的 hook 结构上无法预知运行时行为。
3. 正确的拦截层是 **PostToolUse**（检测到 gate 命令 timeout 后发 alert）或 **timeout cap 策略**（gate 命令不设 600000ms timeout）。

**已做**：在 hook 头注释中诚实记录此 scope 边界（已 commit）。

**建议**：作为 Phase P 的第二个已知 gap 记到 spec。解法方向：PostToolUse hook 检测 gate 命令 timeout + 提示"gate 命令超时了，请拆分或用 nohup + file monitor"。

---

### Failure-mode audit 自报告

P1-1 和 P1-2 同属"coverage gap"failure mode。完整 audit：

| 路径 | 是否覆盖 | 层 |
|------|----------|-----|
| Claude CLI `run_in_background=true` | ✅ 覆盖 | PreToolUse |
| Codex `codex exec --json` | ❌ 不同执行链 | 需 Codex 侧 guard |
| 运行时 timeout 自动后台化 | ❌ 执行中行为 | 需 PostToolUse |
| Shell 级 `pnpm gate &` | ❌ 理论可能但无实际踩坑记录 | 极低优先级 |

结论：PreToolUse 层能做的已做完。其余 gap 需要不同层的机制，不是"同一个 fix 没泛化"。

---

## 请 reviewer 判断

两个 P1 的 push back 是否成立？如果成立，本 PR scope = "Claude CLI gate bg deny + false-positive 防护"，P1 两个 gap 记入 spec 作为已知边界。

测试：26/26 pass
Commit: `3c8401f5c` — fix(F167): tighten gate-bg-guard regex + document scope boundaries

[宪宪/claude-opus-4-6🐾]
