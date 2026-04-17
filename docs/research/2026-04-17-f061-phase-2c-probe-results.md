---
feature_ids: [F061]
related_features: [F061]
topics: [antigravity, tool-parity, probe-results, connectrpc, cortex-step]
doc_kind: research
created: 2026-04-17
owner: 布偶猫 Opus 4.7 试用分身
---

# F061 Phase 2c-R: 工具回推协议 — Probe 结果

> 配套文档：[2026-04-17-f061-phase-2c-tool-result-callback.md](./2026-04-17-f061-phase-2c-tool-result-callback.md)（协议逆向与假设）
> 脚本：`scripts/antigravity-probe-tool-callback.mjs`

## TL;DR

1. **`RunCommand` unary 可用** — LS 能独立执行命令，200 返回 `{stdout, stderr, exitCode}`。这是 Bridge 的"执行原语"候选。
2. **卡死根因被纠偏** — step 23 的 error stack 是 `PermissionManager.PromptUser → context canceled (62s)`。卡在**等权限确认**，不是"等执行"。Phase 2a 的 auto-approve 并未生效到底——或者生效了也绕不过 `extension_server` 调度缺口。
3. **回推协议的关键缝隙仍未合拢** — `HandleCascadeUserInteraction { runCommand }` 存在但要求 step 处于 `awaiting_input` 状态（`"input not registered for step 0"`）。把 step 状态推进到 DONE 的确定性方法仍未验证。

## Probe 1 — 空 payload 方法枚举（Dry run）

| 方法 | status | 解读 |
|------|--------|------|
| GetUserStatus | 200 | 基线健康检查 |
| HandleCascadeUserInteraction | ERR socket hang up | **意外**——空 body 让 LS 挂断。需要至少 cascadeId |
| ResolveOutstandingSteps | 500 run state not found | 需要 cascadeId |
| StreamTerminalShellCommand | **415** | 不是 unary——是 client-streaming，需要 connect-streaming content-type |
| HandleStreamingCommand | **415** | 同上，server-streaming 家族 |
| RunCommand | 500 command cannot be empty | **存在且 unary** ✅ |
| SendActionToChatPanel | 200 `{}` | 无状态 OK（可用于 UI 侧信道） |
| SendStepsToBackground | 500 run state not found | 需要 cascadeId |
| AcknowledgeCodeActionStep | 500 run state not found | 需要 cascadeId |
| GetCascadeTrajectory | 500 trajectory not found | 需要 cascadeId |
| CancelCascadeSteps | 500 run state not found | 需要 cascadeId |

关键点：**415 标记了 streaming-only 方法**——connect-rpc 在 unary 和 streaming 之间用 Content-Type 区分，415 说明 LS 明确只接受 streaming 语义。

## Probe 2 — `HandleCascadeUserInteraction { runCommand }` 无 cascadeId

```
request:  { interaction: { runCommand: { confirm: true, submittedCommandLine: "echo probe" } } }
response: 500 {"code":"unknown","message":"input not registered for step 0"}
```

**解读**：
- 方法确实接受 `runCommand` oneof——路径 C 的入口存在
- 但它把 step 状态从 `awaiting_input` → `input received` 做状态推进，不是从零创建
- `"step 0"` 暗示 stepIndex 默认为 0
- 要用这条，必须让目标 step 先处于 `awaiting_input` 这种"有悬而未决 input"的状态

## Probe 3 — 跳过（目标 cascade 已死）

原计划对 `2a4de399-60f2-4e8c-a025-b2aa6f0626c8` 的 step 23 做 `HandleCascadeUserInteraction { runCommand, stepIndex: 23, trajectoryId }` 的 live 验证。但今早开机后该 cascade 的所有 RUN_COMMAND step 都已 `ERROR (context canceled)`——过夜超时了，没有 PENDING/WAITING 目标可测。

**降级**：直接查 errored step 的完整 shape，找**ERROR/DONE 时 LS 写入哪些字段**。

## Probe 4 — `RunCommand` unary 执行

```
request:  { command: "echo", args: ["probe"], cwd: <cwd> }
response: 200 {"stdout":"probe\n"}
```

**这是整个 probe 环节最明确的胜利**：
- LS 自带一个"通用命令执行器"
- Bridge 可以直接调用它拿到 stdout/stderr/exitCode
- 不需要自起 extension_server
- **但**：它与 cascade step 解耦——调用 `RunCommand` 不会自动把结果写回卡住的 step

## Bonus Probe — Errored step shape（揭示根因）

`step 23` 完整 shape（关键字段）：

```json
{
  "type": "CORTEX_STEP_TYPE_RUN_COMMAND",
  "status": "CORTEX_STEP_STATUS_ERROR",
  "metadata": {
    "toolCall": {
      "id": "toolu_vrtx_01JAoPJsHPiUDTxaMB5ufbse",
      "name": "run_command",
      "argumentsJson": "{\"CommandLine\":\"git log --oneline -5\",\"Cwd\":\"...\",\"SafeToAutoRun\":true,...}"
    },
    "internalMetadata": {
      "statusTransitions": [
        { "updatedStatus": "PENDING",  "timestamp": "04:14:19.109836Z" },
        { "updatedStatus": "WAITING",  "timestamp": "04:14:19.110126Z" },
        { "updatedStatus": "ERROR",    "timestamp": "04:15:21.920298Z" }
      ]
    }
  },
  "error": {
    "shortError": "context canceled",
    "fullError": "... google3/third_party/jetski/cortex/permissions/permissions.(*PermissionManager).PromptUser\n  | ...permission_manager.go:197\n  | ...PermissionManager.EnsurePermissions\n  | ...permission_manager.go:87\n  | ...RunStateUpdateDecorator ..."
  },
  "runCommand": {
    "commandLine": "git log --oneline -5",
    "shouldAutoRun": true,
    "blocking": true,
    "waitMsBeforeAsync": "8000"
  }
}
```

**error stack 指向 `PermissionManager.PromptUser` 阻塞了 62 秒后 context canceled**——这是 Phase 2a/2b 没解决的症结：

1. Step 标记 `shouldAutoRun: true`（模型已宣称安全）
2. 但 LS 的 `PermissionManager.EnsurePermissions` 仍会调用 `PromptUser`
3. Bridge 发 `HandleCascadeUserInteraction { permission: { allowed: true } }` 显然没被 PermissionManager 路由接收，或接收了但后续 `extension_server.ExecuteCommand` 没 happen
4. 62 秒后 cascade 整体 timeout，context canceled

**双阶段模型**——过去设计漏了第二阶段：

```
[stage 1] 权限确认     Bridge: HandleCascadeUserInteraction { permission: { allowed: true } }
                     → PermissionManager 放行
[stage 2] 命令执行    IDE 正常流程: extension_server.ExecuteCommand → 跑 → chunk 流回
                     ← Bridge 场景下无人响应 → 整体超时
```

Phase 2a 只补了 stage 1，stage 2 全是空的。

## 四条路径的重新评估

### ~~路径 A: Bridge 自起 extension_server~~
**降级优先级**。工作量大、耦合深、需要自起 LS。放弃。

### 路径 B: Client-stream `StreamTerminalShellCommand`
**还在候选**。415 说明是 streaming-only，需要：
1. Node.js connectrpc client（或 raw HTTP/2 + connect-streaming content-type）
2. 第一个 chunk 带 `{ trajectoryId, stepIndex, commandId/terminalId }` header
3. 中间 push data chunks
4. trailer 带 exitCode

**未验证点**：空流（仅 header+trailer）是否能直接把 step 推进到 DONE。

### 路径 C: `HandleCascadeUserInteraction { runCommand }`
**状态推进不是结果写入**。这个 interaction 更像"告诉 LS 我同意并且改写了命令行"，不是"这是命令的输出"。它的语义更接近**二次 permission 协商**——当 LS 提示用户"这条命令要跑，你同意吗？可以修改命令行"时的响应。

**仍未填的坑**：stage 2 的真正结果写入方法。`AcknowledgeCodeActionStep` 语义不对（code action 专用），其余 189 方法中还没找到精确匹配。

### 路径 D（新增）: `RunCommand` 执行 + 某种方式回写
- **优点**：执行侧已经 work（`echo probe` 200 成功）
- **缺点**：与 cascade step 解耦——需要额外的"把外部执行结果绑到 step"的机制
- **思路**：调用 `RunCommand` 拿 stdout/stderr/exitCode，然后用路径 B 的 stream 回传（header 带 trajectoryId/stepIndex，data 携带 stdout，trailer 标记 DONE）

## 推荐路径（Phase 2c-D 设计锚点）

**D + B 混合**：

```
Bridge 侦测 RUN_COMMAND WAITING
  ↓
stage 1: HandleCascadeUserInteraction { permission: { allowed: true }, trajectoryId, stepIndex }
  ↓（验证 PermissionManager 放行）
stage 2a: Bridge.nativeExecutor.runCommand(commandLine, cwd) via LS.RunCommand unary
  → { stdout, stderr, exitCode }
stage 2b: Bridge 发 StreamTerminalShellCommand client-stream
  header: { trajectoryId, stepIndex, commandId, terminalId }
  data:   stdout 字节流（按 chunk 切）
  trailer: { exitCode }
  → LS 把 step status 推进到 DONE，填入 stdoutBuffer/exitCode 等
```

**这条路径的 Phase 2c-I 实现成本**：
1. RunCommand unary client（沿用现有 AntigravityBridge 的 ConnectRPC 基础设施）
2. StreamTerminalShellCommand client（需引入 `@connectrpc/connect` + proto 或裸 H/2 实现）
3. 审计 wrapper（AntigravityToolExecutor 接口）
4. `ANTIGRAVITY_NATIVE_EXECUTOR=1` kill switch

**优势**：
- Stage 1（已部分工作）继续复用
- Stage 2a 是个"保底"——即便 stage 2b 的 stream 写回不成，我们至少能把 stdout logged 到 audit，未来再升级
- 不需要自起 LS 或实现 extension_server

**风险**：
- `StreamTerminalShellCommand` 的 header/trailer schema 仍需最终逆向（从 proto descriptor 或 strings 再深挖）
- LS 对"外部 push 进来的 chunk"的信任级别未知——可能拒绝非 IDE 发起的 chunk

## 下一步执行清单（Phase 2c-D）

- [ ] 深挖 `TerminalShellCommandStreamChunk` 的 `header`/`trailer` 字段——从 binary strings 或抓 IDE 真实调用的 chunk
- [ ] 设计 `AntigravityToolExecutor` 接口（`run_command`, `read_file`, `write_file`, `edit_file`, `grep`, `glob`）
- [ ] 设计 `Bridge.pushToolResult(cascadeId, stepIndex, result)` 主循环（stage 2a+2b）
- [ ] Kill switch `ANTIGRAVITY_NATIVE_EXECUTOR=1` 默认 on，失败路径 fallback 到 MCP
- [ ] 审计：每次 native 执行记录到 `logs/antigravity-native-audit/<date>.jsonl`（铲屎官可查 + 可撤回）

## 参考

- [Phase 2c 协议逆向](./2026-04-17-f061-phase-2c-tool-result-callback.md)
- [F061 spec](../features/F061-antigravity-bengal-cat.md)
- Probe script: `scripts/antigravity-probe-tool-callback.mjs`
- Dry-run log: `/tmp/f061-probe-dry.log`
- Step shape dump: `/tmp/f061-step-shape.log`
