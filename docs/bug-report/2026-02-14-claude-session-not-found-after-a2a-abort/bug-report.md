# Bug Report: Claude Session ID 存在但不可恢复（`No conversation found`）

> **报告人**: 铲屎官  
> **定位猫猫**: 缅因猫（砚砚）🐾  
> **报告日期**: 2026-02-14  
> **严重程度**: P1（会导致同线程连续对话上下文丢失）  
> **状态**: 已定位根因链路，待修复

---

## 1. 报告人

- 报告人：铲屎官
- 现场现象：
  - 前端提示：`No conversation found with session ID: 902c827b-3e0e-4730-a6eb-3f4e40f9cbb7`
  - 感知为“布偶猫 session 消失 / conversation 记录无效”
- 关联线程：`thread_mllxh7hjkymvxut4`

---

## 2. 复现步骤（期望 vs 实际）

1. 在同一 thread 触发 A2A 对话链（`post-message` 行首 `@猫名`），存在“首轮 pending，后续仍可继续输入”的交互。
2. 后端后续调用 Claude CLI，携带已保存 sessionId（`--resume <sessionId>`）。
3. 使用该 sessionId 直接复现：

```bash
claude -p "ping" --output-format stream-json --include-partial-messages --verbose \
  --model sonnet --permission-mode acceptEdits --setting-sources project,local \
  --resume 902c827b-3e0e-4730-a6eb-3f4e40f9cbb7
```

**期望行为**
- CLI 正常恢复该会话并继续生成回复。

**实际行为**
- CLI 立即返回：`No conversation found with session ID: 902c827b-3e0e-4730-a6eb-3f4e40f9cbb7`。
- 对应本地会话文件存在但为空壳，仅 1 行 `queue-operation/dequeue`：
  - `~/.claude/projects/-Users-lysander-projects-relay-station-cat-cafe/902c827b-3e0e-4730-a6eb-3f4e40f9cbb7.jsonl`

---

## 3. 根因分析

### 3.1 已确认事实（证据）

1. 后端会无条件复用存储的 sessionId，并传 `--resume`：
   - `packages/api/src/domains/cats/services/invoke-single-cat.ts:100`
   - `packages/api/src/domains/cats/services/ClaudeAgentService.ts:295`
2. 一旦 sessionId 无效，当前逻辑没有“清理坏 session + 无 resume 重试”降级路径。
3. callback A2A 自动触发会新开 invocation：
   - `packages/api/src/routes/callbacks.ts:99`
   - `packages/api/src/routes/callback-a2a-trigger.ts:57`
4. `InvocationTracker.start()` 设计为“同 thread 新调用会 abort 旧调用”：
   - `packages/api/src/domains/cats/services/InvocationTracker.ts:37`
5. 前端输入框禁用仅绑定 `isLoading`：
   - `packages/web/src/components/ChatContainer.tsx:385`
   - 但 `setLoading(true)` 只在“用户手动发送消息”时触发：`packages/web/src/hooks/useSendMessage.ts:49`

### 3.2 结论（根因链路）

- **直接根因**：系统持久化了一个“存在但不可恢复”的 sessionId，并在后续继续 `--resume`，导致每次命中同一错误。
- **高概率触发链路**：
  - callback A2A 自动触发 + 同 thread abort 旧 invocation + 前端未全程锁输入，造成同线程内并发/抢占；
  - 在该时序下，Claude 会话可能只留下空壳记录（仅 queue-operation），进而成为无效 sessionId。

### 3.3 我不确定的点（需补证）

- 目前缺少“session 写入时序日志（invocationId ↔ sessionId ↔ abort 时点）”，因此无法 100% 证明“空壳文件一定由 abort 当下写坏”。
- 但现有代码与用户观测一致，且可稳定复现“该 sessionId 不可恢复”。

---

## 4. 修复方案（为何选择）

### 方案 A（必须先做，止血）

**在 Claude 调用链增加 session 自愈：**
- 识别 `No conversation found with session ID` 错误；
- 立即清理该 `userId+catId+threadId` 的 session 存储；
- 同请求内仅重试一次（不带 `--resume`），生成新 session。

**Why**
- 可立刻阻断“坏 session 无限复用”故障环。

**Tradeoff**
- 会丢失坏 session 的连续上下文，但比持续不可用更可控。

### 方案 B（同轮修，消根因）

**限制 callback A2A 的抢占行为：**
- 当 thread 已有 active invocation 时，A2A 回调不再直接 `start()` 抢占；改为 `queued` 或 `skip with system_info`（明确提示稍后重试）。

**Why**
- 避免同 thread 中断正在进行的 CLI 会话，降低 session 空壳概率。

**Tradeoff**
- A2A 响应速度略降，但线程一致性和稳定性提升。

### 方案 C（同轮修，修交互）

**补前端 loading 语义：**
- callback/A2A 背景 invocation 开始时也要进入 loading（或至少禁用发送）；
- 结束/失败后再解锁。

**Why**
- 与用户感知一致，避免“看起来空闲但后台在抢占执行”。

**Tradeoff**
- 输入可用性更保守，但能减少误操作与并发冲突。

---

## 5. 验证方式（Red→Green）

### Red（先让问题可测）

1. 新增测试：坏 session 触发后不会无限复用
   - 目标：首次 `--resume` 返回 `No conversation found` 时，系统清理旧 session 并进行一次无 resume 重试。
2. 新增测试：A2A callback 不会抢占已运行 invocation
   - 目标：已有 active invocation 时，第二个 callback invocation 进入 `queued`/`skipped`，而不是 abort 旧调用。
3. 新增前端测试：A2A 后台执行期间输入应禁用
   - 目标：非手动发送触发的 invocation 也能驱动 `isLoading` 或等价禁用状态。

### Green（修复后）

- 上述失败用例全部转绿；
- 手工复现：
  1. 构造一次坏 session；
  2. 再次发消息时系统自动恢复并拿到新 session；
  3. A2A 链中不会出现“第一轮 pending、后续可继续乱入导致抢占”的行为。

---

*签名: 缅因猫（砚砚）🐾*
