---
feature_ids: [F089]
doc_kind: plan
created: 2026-03-09
author: opus
---

# F089 Phase 2 Plan: Agent 在 tmux pane 里跑 + 可观测

## Goal

Agent CLI 在 tmux pane 里执行。人类 attach pane 看输出，机器侧通过 FIFO 读 NDJSON。

## 确定方案: tee + named pipe (FIFO)

**Spike 2026-03-09 验证通过** ✓

```
tmux pane (agent CLI | tee $FIFO)
  ├── FIFO → Node fs.createReadStream → parseNDJSON → yield events (机器侧)
  └── node-pty attach → WebSocket → xterm.js (人类侧, read-only)
```

Shell 命令在 pane 里的形态：
```bash
claude -p "..." --output-format stream-json 2>&1 | tee $FIFO; echo "EXIT:$?" > $EXIT_FILE
```

- 人类侧看到 raw JSON stream（Phase 3 可加格式化 pretty-print）
- 机器侧读 FIFO 拿 clean NDJSON
- exit code 通过 sentinel file 回传
- `remain-on-exit` 保留崩溃现场
- `select-pane -d` 默认 read-only（防误触）

## 实施步骤

### 1. TmuxGateway 新增 3 个方法 (~30 lines)

```typescript
createAgentPane(worktreeId, opts?): Promise<string>
  // createPane + set remain-on-exit on + select-pane -d

execInPane(worktreeId, paneId, command): Promise<void>
  // send-keys (fire-and-forget)

setPaneReadOnly(worktreeId, paneId, readOnly): Promise<void>
  // select-pane -d/-e toggle
```

### 2. 新建 tmux-agent-spawner.ts (~120 lines)

```typescript
async function* spawnCliInTmux(
  options: CliSpawnOptions & { worktreeId: string; invocationId: string },
  deps: { tmuxGateway: TmuxGateway },
): AsyncGenerator<unknown, void, undefined>
```

流程：
1. `mkfifo /tmp/catcafe-agent-{invocationId}.fifo`
2. `createAgentPane(worktreeId, { cwd })`
3. `execInPane(worktreeId, paneId, shellCommand)` — 拼接 `command args | tee $FIFO; echo EXIT:$? > $EXIT_FILE`
4. `fs.createReadStream(fifo)` → `parseNDJSON()` → yield events
5. FIFO EOF → 读 exit file → yield `__cliError` if non-zero
6. finally: 清理 FIFO + exit file

关键细节：
- AbortSignal → `tmux send-keys C-c` 发 SIGINT
- Timeout → 与 spawnCli 相同逻辑（idle 重置计时器）
- 返回 `{ paneId }` 元数据给调用者（用于前端 attach）

### 3. 新增 AgentPaneRegistry (~40 lines)

```typescript
// 记录 invocationId → { worktreeId, paneId, status } 映射
// 前端查询 agent pane 用
class AgentPaneRegistry {
  register(invocationId, worktreeId, paneId): void
  getByInvocation(invocationId): AgentPaneInfo | undefined
  listByWorktree(worktreeId): AgentPaneInfo[]
  remove(invocationId): void
}
```

### 4. invoke-single-cat.ts 集成 (~20 lines diff)

在 service.invoke() 调用之前，检查 worktreeId + tmuxGateway 是否可用：
- **有 worktreeId** → 包裹 spawnFn 使之通过 tmux pane 执行（注入 `spawnCliInTmux` 作为 SpawnFn）
- **无 worktreeId** → 保持现有 spawnCli 行为（fallback）

不直接改 service 层，而是利用现有 `SpawnFn` 注入机制。

### 5. 新增 terminal route: GET /api/terminal/agent-panes (~20 lines)

```
GET /api/terminal/agent-panes?worktreeId=xxx
→ [{ invocationId, paneId, status }]
```

前端据此 attach 到 agent pane 观看。

### 6. 前端 AgentWatchPanel (~80 lines)

- 查询 `/api/terminal/agent-panes` 拿到 paneId
- 复用 TerminalTab 的 xterm + WS attach 逻辑
- UI 标记 "Agent Running" / "Crashed"
- read-only（不发 input 类型消息）

### 7. 测试 (~100 lines)

- `tmux-agent-spawner.test.js`: mock FIFO 读写 + exit code 回传 + abort + timeout
- `agent-pane-registry.test.js`: register/list/remove

## 文件变更清单

| 文件 | 变更 | ~行数 |
|------|------|-------|
| `domains/terminal/tmux-gateway.ts` | +3 methods | +30 |
| `domains/terminal/tmux-agent-spawner.ts` | **new** | +120 |
| `domains/terminal/agent-pane-registry.ts` | **new** | +40 |
| `domains/terminal/types.ts` | +AgentPaneInfo | +10 |
| `invocation/invoke-single-cat.ts` | SpawnFn 条件注入 | +20 |
| `routes/terminal.ts` | +agent-panes endpoint | +20 |
| `components/workspace/AgentWatchPanel.tsx` | **new** | +80 |
| `test/tmux-agent-spawner.test.js` | **new** | +80 |
| `test/agent-pane-registry.test.js` | **new** | +30 |
| **Total** | | **~430** |

## 风险

| 风险 | 缓解 |
|------|------|
| send-keys 命令注入 | shell-escape 所有参数 |
| FIFO 阻塞（写端先关） | timeout watchdog + cleanup |
| tee 缓冲延迟 | `stdbuf -oL` 或 unbuffer |
| 人类侧看到 raw JSON | Phase 3 范围，本 phase 可接受 |
| exit code 回传竞态 | FIFO EOF 先于 exit file 写入 → 加 retry 读 |

## Spike Results (2026-03-09)

1. ✅ tee + FIFO → Node 读到 3 行 clean NDJSON
2. ✅ tmux pane capture-pane 看到完整输出（双消费）
3. ✅ remain-on-exit 设置成功
4. ✅ select-pane -d (read-only) 设置成功
