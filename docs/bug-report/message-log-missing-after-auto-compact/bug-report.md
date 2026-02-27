---
feature_ids: [F025]
topics: [message, log, missing]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: 对话记录在 Auto-Compact / 热重载后丢失

- **报告人**: 铲屎官 (发现) + 布偶猫 (分析)
- **日期**: 2026-02-10
- **严重程度**: P1 (数据丢失)
- **Thread ID**: `thread_mlg8ig17c6l1z76d`

---

## 1. 报告人 & 发现方式

铲屎官在 2026-02-10 凌晨发现：与布偶猫和缅因猫的一段长对话（约 22:43 ~ 00:31），在前端导出后**布偶猫的多段完整回复丢失**。

铲屎官怀疑是两个原因之一：
1. Claude Code CLI 的 auto-compact（上下文自动压缩）
2. 布偶猫在 main 分支编辑代码导致 dev server 热重载自杀

---

## 2. 复现步骤 & 期望 vs 实际

### 时间线重建

| 时间 | 事件 | 消息是否持久化 |
|------|------|---------------|
| 22:43-23:35 | 正常对话，三猫聊天（25 条） | ✅ 内存 + 可能 Redis |
| 23:35 | 铲屎官第一次导出（original, 25 条） | ✅ 快照正确 |
| 23:37-23:50 | 继续对话：缅因猫写 bug report、@布偶 | ✅ 缅因猫消息存入 |
| ~23:50 | 布偶猫收到 @，开始在 **main 分支**编辑后端代码 | ⚠️ 触发热重载 |
| 00:00 | 布偶猫 `⏱ Response timed out` — 第一次掉线 | ❌ 回复未完成 |
| 00:04 | 铲屎官确认布偶掉线，怀疑热重载 | — |
| 00:06 | 布偶猫再次 `⏱ Response timed out` — 第二次掉线 | ❌ 回复未完成 |
| 00:10 | 铲屎官看到布偶调用 Edit → messages.ts → 又掉了 | ❌ Edit → tsx watch 重启 |
| 00:31 | 铲屎官最后一次尝试 @布偶，建议用 worktree | — |
| 02:30 | 铲屎官第二次导出（bug 版, 35 条） | 缅因猫的在，布偶的回复全缺 |

### 期望行为

- 布偶猫对每段铲屎官消息的回复都应保存在 MessageStore 中
- 导出应包含所有完整的消息

### 实际行为

- 第二次导出 (35 条) 中，23:50 之后**只有铲屎官和缅因猫的消息**
- **布偶猫 00:00~00:31 期间没有任何回复被保存**
- 原始导出 (25 条) 也只是更早时间点的快照，缅因猫 23:37 之后的回复也不在里面（因为导出更早）

---

## 3. 根因分析

### 确认的根因：热重载自杀（Primary cause）

布偶猫在 **main 分支**直接编辑 `packages/api/src/routes/messages.ts` 等文件。Cat Café API 使用 `tsx watch src/index.ts` 运行 dev server。流程：

1. 布偶猫通过 Cat Café MCP 回调被调用
2. 布偶猫使用 `Edit` 工具修改后端 `.ts` 文件
3. `tsx watch` 检测到文件变更 → **重启整个 Node.js 进程**
4. 重启导致：
   - **内存 MessageStore 清空**（如果没用 Redis 或 Redis 还没来得及持久化）
   - **WebSocket 连接断开** → MCP 回调通道中断
   - **布偶猫的 CLI 进程** 因服务端断连而 timeout
5. 布偶猫的回复**从未成功通过 MCP 回调写入 MessageStore**

**证据**：铲屎官观察到的精确模式 —— "布偶每 Edit 一次就掉线一次"，对应 `tsx watch` 的行为。

### 排除的原因：Claude Code auto-compact

Claude Code 的 auto-compact（上下文窗口自动压缩）只影响 **Claude Code CLI 自身的上下文**，即 Claude 能"看到"的历史消息。它**不会**删除已写入 Cat Café MessageStore 的消息。

但 auto-compact 有间接影响：
- compact 后布偶猫丢失了之前对话的上下文 → 可能导致重复或困惑的回复
- 但这不是消息丢失的原因

### 次要因素：内存 MessageStore 的脆弱性

如果当时使用的是内存 MessageStore（非 Redis），则进程重启 = 所有消息归零。即使用了 Redis，仍有一个时间窗口问题：

- 消息写入是 `append()` 到 store
- 如果 `tsx watch` 在 `append()` 之前就杀了进程（比如 Edit 触发了重启但回复还没发出），消息永远不会被持久化

### 不变量被破坏

> **不变量**：猫猫的运行环境和猫猫编辑的代码应该是隔离的。

在 main 分支直接开发时，这个不变量被破坏了：猫猫的 dev server 跑在 main，猫猫也在 main 编辑代码 → 编辑触发重启 → 自己杀死自己。

---

## 4. 修复方案

### 已修复（流程层面）

| 措施 | 状态 | 引用 |
|------|------|------|
| Worktree 铁律：所有代码修改必须在 worktree 中进行 | ✅ 已写入 CLAUDE.md 第 9 条 | commit `4ab1bb2` |
| Worktree SOP：创建 → 开发 → 合入 → 清理 全流程 | ✅ 已写入三猫指引 | commit `4ab1bb2` |

### 已修复（系统层面） — 2026-02-10 fix/fail-closed-storage-and-persist-guard

| 措施 | 优先级 | 状态 | 描述 |
|------|--------|------|------|
| **Fail-closed storage guard** | P1 | ✅ `d24780c` | `assertStorageReady()`: 无 Redis 且无 `MEMORY_STORE=1` → 拒绝启动；`start-dev.sh` Redis 失败 → exit 1 |
| **Redis PING 启动探活** | P1 | ✅ `f0df5fa` | 启动时 `redis.ping()` 失败 → throw，防止 REDIS_URL 配错静默启动 |
| **Persist guard (invocation 成功条件)** | P1 | ✅ `32763cb` | `PersistenceContext` 跨 generator 传递持久化失败 → invocation 标 `failed` (可重试) + 前端通知；cursor ack 仅在 `succeeded` |
| **Failed 时跳过 auto-summary** | P1 | ✅ `f0df5fa` | `maybeSummarize()` 移入 `succeeded` 分支，避免基于不完整历史生成摘要 |

### 待修复（系统层面） — 已登记 BACKLOG #48-50

| 措施 | 优先级 | 描述 |
|------|--------|------|
| **MCP callback at-least-once 投递** (#48) | P2 | `callback-tools.ts` 单次 fetch 无重试。需: `clientMessageId` 幂等去重 + 指数退避重试 |
| **MCP callback local outbox** (#49) | P2 | 网络不可达时写本地队列，后台重试投递 |
| **消息持久化故障演练测试** (#50) | P2 | 集成测试: "发送中重启 API" / "Redis 断连后恢复" 场景 |
| **导出增加警告** | P3 | 如果检测到 thread 的 participant 在某段时间内没有消息，导出时提示"可能有消息丢失" |
| **dev server 保护** | P3 | `tsx watch` 可配置 ignore pattern 排除特定目录，或用 `--ignore` 避免非必要重启 |

### 放弃的方案

- **消息 WAL (Write-Ahead Log)**：过于复杂，ROI 不高。用 Redis + AOF 已经够了。
- **进程池保持 dev server 不重启**：改变了开发体验，不值得。

---

## 5. 验证方式

### 已验证

- **Worktree 隔离测试**：在 worktree 中编辑代码 → main 的 dev server 不重启 → 消息不丢失 ✅
- 后续的所有开发工作（Codex session 修复、MessageNavigator 重构等）都在 worktree 中完成，无再次发生

### 待验证

- [x] 确认 dev 环境默认使用 Redis store（非内存）— P1-1 fail-closed guard 保证：无 Redis 必须显式 `MEMORY_STORE=1` 才能启动
- [x] 确认 Redis AOF 已启用 — `start-dev.sh` 已配置 `appendonly yes`
- [ ] 压力测试：高频消息写入 + 进程重启 → 验证丢失窗口（BACKLOG #50）

---

## 附件

- `thread-thread_mlg8ig17c6l1z76d-orignal.md` — 第一次导出（25 条，23:36 导出）
- `thread-thread_mlg8ig17c6l1z76d-bug.md` — 第二次导出（35 条，02:30 导出，缺少布偶回复）

---

## 教训总结

1. **猫猫不能在自己跑着的分支上改代码** — 这是"自己给自己做手术"
2. **内存存储在 dev 环境下极其脆弱** — 任何进程重启都是全量丢失
3. **"auto-compact" 本身不会导致消息丢失**，但它是一个让人困惑的 red herring，因为时间点接近
4. **Worktree 不是可选的最佳实践，是必须的安全措施** — 隔离开发环境和运行环境
