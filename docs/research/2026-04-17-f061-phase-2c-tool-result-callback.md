---
feature_ids: [F061]
related_features: [F061]
topics: [antigravity, tool-parity, reverse-engineering, connectrpc, cortex-step]
doc_kind: research
created: 2026-04-17
owner: 布偶猫 Opus 4.7 试用分身
---

# F061 Phase 2c-R: Tool-Result 回推协议逆向

> 目标：找到让 `CORTEX_STEP_TYPE_RUN_COMMAND` 从 `PENDING/WAITING` 推进到 `DONE` 的 RPC 调用路径，打通 @antig-opus 在 Cat Café 里的原生工具执行链。

## 研究来源

- Antigravity LS 二进制：`/Applications/Antigravity.app/Contents/Resources/app/extensions/antigravity/bin/language_server_macos_arm`
- 今晚 runtime trace：`cat-cafe-runtime/packages/api/data/logs/api/api.2026-04-16.1.log`（77 条 antigravity-trace 记录，含 `stepShapes` 摘要）
- 卡住 cascade：`2a4de399-60f2-4e8c-a025-b2aa6f0626c8`（step 23/24/25 均为 RUN_COMMAND）

## 发现 1: `exa.language_server_pb.LanguageServerService` 共 189 个 RPC 方法

从二进制 strings 抽取：

```bash
strings language_server_macos_arm | grep -oE "/exa\.language_server_pb\.LanguageServerService/[A-Za-z]+" | sort -u
```

与工具执行/命令相关的方法：

| 方法 | 作用（推断） |
|------|-------------|
| `HandleCascadeUserInteraction` | 已知 — 当前 Bridge 用于 approve permission |
| `ResolveOutstandingSteps` | 已知 — YOLO probe-on-stall 用 |
| `StreamTerminalShellCommand` | **Client-streaming** — 客户端 push chunks 给 LS |
| `HandleStreamingCommand` | Server-streaming — LS push chunks 给客户端 |
| `RunCommand` | Unary — LS 自身执行命令（一次性返回 stdout/stderr/exitCode） |
| `AcknowledgeCodeActionStep` | 针对 "code action" step 的特化 ack |
| `CancelCascadeInvocation` / `CancelCascadeSteps` | 取消路径 |
| `SendActionToChatPanel` | UI 层面注入 action |
| `SendStepsToBackground` | 把 steps 发到后台 |
| `RecordUserStepSnapshot` | 记录用户 step 快照 |
| `ForceStopCascadeTree` | 强停 |
| `RevertToCascadeStep` | 回滚到某 step |
| `DeleteQueuedUserInputStep` | 删除排队的用户输入 step |

## 发现 2: `CascadeUserInteraction` 是 oneof，支持 RUN_COMMAND 子类型

`HandleCascadeUserInteraction` 的 `interaction` 字段是 `cortex_go_proto.CascadeUserInteraction`，实际是 oneof：

- `askQuestion`
- `browserAction`
- `captureBrowserScreenshot`
- `clickBrowserPixel`
- `confirmBrowserSetup`
- `deploy`
- `elicitation`
- `executeBrowserJavascript`
- `filePermission`
- `interaction`（generic）
- `mcp`
- `openBrowserSetup`
- `openBrowserUrl`
- `permission`（当前 Bridge 用的）
- `readUrlContent`
- **`runCommand` ← 本阶段关键字段**
- `runExtensionCode`
- `sendCommandInput`
- `stepIndex`（标识 step）
- `trajectoryId`（标识 trajectory）

### `CascadeRunCommandInteraction` 结构

```
{
  confirm: bool,
  proposedCommandLine: string,    // 与 step.runCommand.proposedCommandLine 对齐
  sandboxOverride: ...,
  submittedCommandLine: string,   // 客户端最终提交的 command line（可能被用户编辑）
}
```

这看起来是**命令审批**而非**结果回推**——客户端告诉 LS "我同意跑这条命令（或我改成了这条）"。这是 approve 路径的更精细版本。

### `CascadeSendCommandInputInteraction` 结构

```
{ confirm: bool }
```

只有 confirm 一个字段，推断是"对已在运行的命令发送输入"的开关。

## 发现 3: `CortexStepRunCommand` 的结果字段

`CORTEX_STEP_TYPE_RUN_COMMAND` step 本身带以下结果字段（trajectory 会在 step 完成后填入）：

```
CortexStepRunCommand {
  command / commandLine / proposedCommandLine
  args
  cwd
  shouldAutoRun / autoRunDecision
  blocking / runPersistent
  sandboxOverride
  waitMsBeforeAsync

  // 结果字段（由执行器填入）
  stdout / stdoutBuffer / stdoutOutput / stdoutLinesAbove
  stderr / stderrBuffer / stderrOutput / stderrLinesAbove
  combinedOutput / combinedOutputSnapshot
  exitCode
  terminalId / requestedTerminalId
  usedIdeTerminal
  userRejected
  rawDebugOutput
}
```

这是"step 是一个 living 记录"的模式——step 本身携带输入+结果，LS 负责合并更新。

## 发现 4: 双端执行器架构（ExtensionServerService）

LS 并不**自己**执行 RUN_COMMAND。`/exa.extension_server_pb.ExtensionServerService/ExecuteCommand` 是 server-streaming RPC，从 LS 发起、由 **extension server** 回流 `TerminalShellCommandStreamChunk`。

在 Antigravity IDE 自身：
- LS 进程通过 `--extension_server_port 54927 --extension_server_csrf_token <token>` 启动
- extension_server 是 IDE 主进程内的服务，持有 IDE 的 terminal 能力
- LS 要执行命令时，RPC 调用 extension_server.ExecuteCommand → extension_server 在 IDE terminal 跑 → 流式返回 chunks

**这是整个 stuck 的根源**：Cat Café Bridge 不是 extension server，LS 默认连回 Antigravity 自己的 extension_server，但当 cascade 是由 Bridge 触发（不是 IDE UI 触发）时，LS 把命令路由给谁、extension_server 是否会执行、IDE UI 是否会显示审批弹窗等细节不明。今晚的行为是：step 进入 PENDING 后就没有后续——显然 extension_server 没有执行它。

## 发现 5: `TerminalShellCommandStreamChunk` 结构

```
{ header?, data?, trailer?, value? }
```

- `header` / `trailer` — gRPC 风格的元数据
- `data` — 实际的命令输出字节流
- `value` — 可能是高级封装

## 三条候选执行路径

### 路径 A: Bridge 自起 extension_server

最"符合 IDE 原生架构"的方案：Bridge 启动一个 gRPC server 实现 `ExtensionServerService.ExecuteCommand`，并在启动 Antigravity LS 时把 `--extension_server_port` 指向我们的端口。

**优点**：干净、与 LS 内部协议对齐、LS 自己的命令调度逻辑复用。
**缺点**：
1. 需要自起 LS 进程（而非复用 IDE 进程），耦合大
2. gRPC server 实现成本高（Node.js 端需要 `@grpc/grpc-js` + proto 转译）
3. 与现有 "发现 IDE LS" 逻辑冲突

### 路径 B: Client-stream `StreamTerminalShellCommand` 推 chunks

用 `/exa.language_server_pb.LanguageServerService/StreamTerminalShellCommand` 这个 **client-streaming** RPC 主动 push chunks。

**假设需验证**：
- LS 是否接受"裸"client-stream（没有 trajectoryId/stepIndex header）— 还是必须带 context header 绑定到具体 cascade step
- `header` 字段需要什么（可能是 `{ cascadeId, stepIndex, commandId, terminalId }` 组合）
- 发送完 trailer 后 LS 是否自动把 step status 从 PENDING 推进到 DONE

**优点**：不需要自起 LS、直接在现有 Bridge 上加新 RPC call。
**缺点**：需要逆向 chunk header 结构、失败模式未知、错误反馈可能 silent。

### 路径 C: 伪造 step 状态推进（HandleCascadeUserInteraction + ?）

组合拳：
1. `HandleCascadeUserInteraction({ runCommand: { confirm: true, submittedCommandLine }, stepIndex, trajectoryId })` 告诉 LS "我已经同意并执行了这条命令"
2. 某个方法写入执行结果（stdout/stderr/exitCode）到 step
3. 步骤转 DONE

**需要验证的空白**：步骤 2 的"写结果"方法目前未找到。`AcknowledgeCodeActionStep` 语义不匹配（它是 code action 专用）。

## 当前假设与下一步 probe

**主力假设（H1）**：
- Cascade 发出 RUN_COMMAND（PENDING，已 auto-approved）
- IDE UI 通过 `StreamTerminalShellCommand` 把命令输出 push 回 LS，chunk 的 `header` 携带 `{ trajectoryId, stepIndex, commandId }`
- 发送 trailer 后 LS 自动把 step 推进到 DONE

**Probe 计划**（写独立脚本，不走 Bridge 主路径）：

1. **Probe 1 — 列已知方法返回**：对每个候选方法发送空 body，观察返回码（200 / 400 / 404 / 500 + error detail）→ 确认方法存在性与最小 payload schema
2. **Probe 2 — `HandleCascadeUserInteraction` runCommand 变体**：构造 `{ cascadeId, interaction: { runCommand: { confirm: true, submittedCommandLine: "git log --oneline -5" }, stepIndex: 23, trajectoryId } }`，看返回 + step 状态变化
3. **Probe 3 — `StreamTerminalShellCommand` 空流**：打开 stream，发送一个带 header (trajectoryId/stepIndex/commandId) + trailer (exitCode=0) 的极小流，观察返回与 step 推进行为
4. **Probe 4 — `RunCommand` unary**：直接调用，看是否能单独跑一条命令（此方法可能与 cascade 无关，是 "IDE 终端能力代理"）

Probe 脚本落 `scripts/antigravity-probe-tool-callback.mjs`，输出结构化 JSON log。**不改 Bridge 主路径**——Bridge 修改走 Phase 2c-D/I。

## 复盘：为什么 4.6 / gpt-5.4 一周没解

猜测：

1. **症状层陷阱**：stuck 看起来像"idle stall / poll bug"，4.6 / gpt-5.4 的 Phase 2a 精力集中在 poll 循环健壮性（G0-G10），而非"LS 没执行"根因
2. **缺少 trace**：`ANTIGRAVITY_TRACE_RAW=1` 是 2026-04-16 才加的（PR #1215）。在 raw trace 之前，Bridge 侧看到的只有"cascade status stuck in RUNNING"，看不到 step 结构差异
3. **MCP 路径掩盖**：已有的 MCP 路径能跑一部分任务（非 shell），导致问题被当做"偶发"而非系统性缺失
4. **价值观限制**：默认思路是"限制 cat 工具面"（feedback_agent_tool_parity 正是纠正这点），所以"让 cat 跑命令"这个方向不在设计空间里

这条路走通后，反哺的是更广的原则：**provider/bridge 设计默认走工具对等，别想怎么限制**。

## 下一步

- [ ] Probe 1-4 脚本 + 结果落 `scripts/antigravity-probe-tool-callback.mjs` + `docs/research/2026-04-17-f061-phase-2c-probe-results.md`
- [ ] 根据 probe 结果选定路径（A/B/C）
- [ ] 进入 Phase 2c-D（执行器接口 + 工具集 + 安全）

## 参考链接

- [F061 spec](../features/F061-antigravity-bengal-cat.md)
- [feedback_agent_tool_parity](`/Users/lysander/.claude/projects/-Users-lysander-projects-relay-station-cat-cafe/memory/feedback_agent_tool_parity.md`) — 价值观来源
- Antigravity LS binary: `/Applications/Antigravity.app/Contents/Resources/app/extensions/antigravity/bin/language_server_macos_arm`
