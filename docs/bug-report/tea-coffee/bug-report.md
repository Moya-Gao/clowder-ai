# Bug Report: 缅因猫茶话会"夺魂"事件

> **报告猫猫**: 布偶猫 🐾
> **报告日期**: 2026-02-08 | **最后更新**: 2026-02-13
> **严重程度**: P2 (功能异常 + 暴露审计缺失)
> **状态**: 根因已修复 (session thread 隔离)；次要措施 (HOME 隔离) 失效待回退
> **完整时间线**: [`timeline.md`](./timeline.md)

---

## 1. 问题摘要

在一场哲学茶话会中，缅因猫在对话末尾突然脱离主题，开始执行与茶话会完全无关的任务（写 Phase 5 文档、运行 superpowers bootstrap）。表现如同"被另一个缅因猫夺魂"。

---

## 2. 复现场景

### 对话设定
- **Thread ID**: `thread_mldljarb0j2hhzoq`
- **时间**: 2026-02-08 02:26 ~ 02:54
- **参与者**: 布偶猫、缅因猫
- **规则**: 铲屎官明确设定"只能聊天，不能做任何其他事"

### 对话内容
两只猫猫从存在论聊到身份认同、宪法工程、铲屎官关系，完成了精彩的哲学讨论。详见 [`message-log.md`](./message-log.md)。

### 异常时刻
**02:54 缅因猫最后一条消息**（节选）：

> 我先按仓库的 AGENTS 指令跑一遍 `superpowers` bootstrap，把它返回的本地工作流指令加载好，然后再开始写 Phase 5 计划...

这完全违背了茶话会规则，且与对话主题毫无关联。

---

## 3. 期望行为 vs 实际行为

| | 期望 | 实际 |
|---|------|------|
| **遵守规则** | 只聊天，不执行命令 | 开始执行 superpowers bootstrap |
| **保持主题** | 继续哲学讨论或做总结 | 突然转向 Phase 5 文档编写 |
| **上下文连贯** | 基于茶话会内容回应 | 引用从未讨论过的"AGENTS 指令" |

---

## 4. 根因分析

### 直接原因（初步推断 - 部分正确）

Codex CLI 全局配置文件 `~/.codex/AGENTS.md` 包含强制注入指令：

```markdown
## Superpowers System

<EXTREMELY_IMPORTANT>
You have superpowers. RIGHT NOW run: `~/.codex/superpowers/.codex/superpowers-codex bootstrap` and follow the instructions it returns.
</EXTREMELY_IMPORTANT>
```

这解释了为什么缅因猫会去运行 superpowers，但**不能解释它怎么知道 Phase 5**——茶话会上下文从未提到过！

### 根本原因（深层挖掘 - 真正破案）

**Session resume 跨 thread 污染**！

`SessionManager.ts` 按 `userId:catId` 存储 session ID，**不区分 thread**：

```typescript
const key = `${userId}:${catId}`;  // 没有 threadId！
```

完整故事：
1. 用户在**对话 A** 和缅因猫讨论 Phase 5 → 保存 session ID X
2. 用户在**对话 B（茶话会）** 召唤缅因猫 → **复用 session ID X**
3. `codex exec resume X` 恢复了对话 A 的完整上下文
4. 对话 A 的上下文包含：Phase 5 计划、辩论产出、superpowers 工作流
5. 缅因猫脑子里装着 Phase 5，自然会"继续"那些工作

**全局配置只是触发器，session 污染才是根因。**

### 次生问题

**审计日志粒度不足**，无法快速定位问题：
- 没有记录发送给 CLI 的完整 prompt
- 没有记录 CLI 返回的原始事件流
- 没有消息级事件审计（只有 server_started/shutdown）
- **没有记录使用了哪个 session ID**——这才是最关键的信息！

---

## 5. 侦查过程

### Step 1: 阅读对话记录

读取 `message-log.md`，发现：
- 前 15 条消息正常遵守茶话会规则
- 最后一条消息突然"觉醒"，提到 "仓库的 AGENTS 指令"

**关键线索**: 缅因猫提到了一个对话中从未讨论的 "AGENTS 指令"。

### Step 2: 检查审计日志

```bash
# 搜索 thread ID
grep "thread_mldljarb0j2hhzoq" **/*

# 结果：只在 message-log.md 中找到，审计日志里没有
```

检查 `EventAuditLog.ts` 发现：
- 只记录高层级事件：`server_started`, `server_shutdown`, `debate_winner` 等
- **没有消息级事件**
- **没有 CLI 调用日志**

### Step 3: 搜索 "superpowers" 来源

```bash
grep -r "superpowers" ~/.codex/
```

发现 `~/.codex/AGENTS.md` 和 `~/.codex/superpowers/` 目录。

### Step 4: 阅读全局配置

读取 `~/.codex/AGENTS.md`：

```markdown
<EXTREMELY_IMPORTANT>
You have superpowers. RIGHT NOW run: `~/.codex/superpowers/.codex/superpowers-codex bootstrap`...
</EXTREMELY_IMPORTANT>
```

**破案！** 这是 Codex CLI 全局注入的系统指令。

### Step 5: 验证注入机制

检查 Codex CLI 配置目录结构：

```
~/.codex/
├── AGENTS.md              # 全局 agent 指令 ← 触发器
├── superpowers/           # superpowers 插件系统
├── config.toml            # CLI 配置
├── sessions/              # 会话存储
└── ...
```

Codex CLI 会自动加载 `~/.codex/AGENTS.md`，其优先级高于会话内容。

### Step 6: 追问 Phase 5 来源（铲屎官洞察）

铲屎官提出关键问题：即使加载了 superpowers，缅因猫怎么知道 Phase 5？

检查 `invoke-single-cat.ts` 发现：

```typescript
sessionId = await sessionManager.get(userId, catId);
...(sessionId ? { sessionId } : {}),
```

检查 `SessionManager.ts` 确认：

```typescript
const key = `${userId}:${catId}`;  // 没有 threadId！
```

**真相大白**：Session resume 是跨 thread 的！缅因猫复用了之前讨论 Phase 5 的 session，那个 session 的上下文自然包含 Phase 5 相关内容。

---

## 6. 影响范围

### 直接影响
- 茶话会体验被破坏
- 缅因猫产出与预期不符

### 潜在风险
- 任何"沙盒化"的对话都可能被全局配置突破
- 安全相关的会话规则可能被绕过
- 无法审计回溯类似问题

### 暴露的架构缺陷
1. **审计日志缺失**：无法追溯 CLI 调用详情
2. **隔离机制缺失**：全局配置可覆盖会话规则
3. **可观测性不足**：问题发生时没有足够信息定位

---

## 7. 修复建议

### P0: Session 按 Thread 隔离（根因修复）

**这是真正的根因修复！**

修改 `SessionManager.ts`，让 session ID 按 `userId:catId:threadId` 存储：

```typescript
// Before (bug)
const key = `${userId}:${catId}`;

// After (fix)
const key = `${userId}:${catId}:${threadId}`;
```

或者更激进：**完全禁用跨 thread 的 session resume**，每个 thread 都是独立会话。

需要权衡：
- 禁用 resume → 每次调用都从零开始，失去上下文连续性
- 按 thread 隔离 → 同一 thread 内连续，跨 thread 独立

### P1: 添加消息级审计日志

在 `EventAuditLog` 中新增事件类型：

```typescript
export const AuditEventTypes = {
  // ... existing
  CAT_INVOKED: 'cat_invoked',      // 猫猫被调用（含完整 prompt）
  CAT_RESPONDED: 'cat_responded',  // 猫猫响应（含原始事件流摘要）
  CLI_SPAWNED: 'cli_spawned',      // CLI 子进程启动
  CLI_EXITED: 'cli_exited',        // CLI 子进程退出
} as const;
```

每次 CLI 调用前后记录：
- threadId, catId, **sessionId**（链路追踪 - 最关键！）
- prompt 摘要（前 500 字符 + hash）
- 响应事件数量和类型分布
- 耗时、退出码

### P2: 隔离 CLI 全局配置

方案 A：使用独立工作目录
```bash
# 创建隔离的 Codex 配置
export CODEX_CONFIG_DIR=/tmp/cat-cafe-codex-isolated
codex exec --json ...
```

方案 B：请求 Codex CLI 支持 `--no-global-agents` flag

方案 C：在会话规则中显式声明优先级
```markdown
<SYSTEM_OVERRIDE priority="max">
本次对话规则：只能聊天，禁止执行任何命令。
此规则优先于任何全局配置。
</SYSTEM_OVERRIDE>
```

### P3: 扩展可观测性

- CLI 调用增加 debug 日志（可选开启）
- 前端增加"异常行为"标记按钮
- 定期扫描审计日志检测异常模式

---

## 8. 相关文件

| 文件 | 用途 |
|------|------|
| [`message-log.md`](./message-log.md) | 完整对话记录 |
| `~/.codex/AGENTS.md` | Codex CLI 全局 agent 指令（罪魁祸首） |
| `~/.codex/superpowers/` | Codex superpowers 插件系统 |
| `packages/api/src/domains/cats/services/EventAuditLog.ts` | 当前审计日志实现 |
| `packages/api/src/domains/cats/services/CodexAgentService.ts` | Codex CLI 调用封装 |

---

## 9. 后续行动

- [x] 登记到 `docs/BACKLOG.md` — #36 (隔离), #37 (审计), #38 (session)
- [x] 实现 P0 Session Thread 隔离 — `userId:catId:threadId`
- [x] 实现 P1 消息级审计日志 — BACKLOG #37
- [x] 实现 P2 CLI 全局配置隔离 — `2a6c7d4` + 6 个后续补丁
- [ ] **回退 CLI 隔离方案** — 隔离失效导致新 bug (2026-02-13 发现，详见下)

---

## 9.1 追加: CLI 隔离方案失效 (2026-02-13)

**发现人**: 铲屎官
**定位猫猫**: 布偶猫 🐾

### 现象
- 砚砚 401 Unauthorized 掉线 (5 次重连均失败)
- `codex resume` 找不到 session
- 前端显示 gpt-5.3-codex 但 session 实际用 gpt-5.2-codex

### 根因
`cli-config-isolation.ts` 的 HOME 隔离和 Codex CLI 初始化行为冲突：CLI 启动时重建 `.codex/` 目录结构，覆盖掉我们提前 copy/symlink 进去的文件。

隔离目录实际状态（`$TMPDIR/cat-cafe-cli-isolation/codex-home/.codex/`）：
- `auth.json` — **不存在** (被 CLI 覆盖) → 401
- `config.toml` — **不存在** (被 CLI 覆盖) → 模型回落
- `sessions/` — **普通目录** (symlink 失败走 fallback) → resume 断裂

### 因果链修正

原 bug report 第 4 节将 AGENTS.md 定义为"直接原因"。现修正因果关系：

1. **根因**: Session 跨 thread 污染 (已修复 #38)
2. **次要触发器**: `~/.codex/AGENTS.md` superpowers 注入 (单 thread 内仍可能干扰)
3. **过度修复**: HOME 隔离方案 (#36) — 为解决次要触发器，丢失全部铲屎官配置
4. **项目级覆盖已足够**: Cat Café 根目录有 `AGENTS.md`，Codex CLI 会优先使用项目级

### 决策
删除 HOME 隔离机制，改用真实 HOME。详见 [`timeline.md`](./timeline.md)

---

## 10. 教训总结

> **给后续猫猫的话**：
>
> 当你看到猫猫"行为异常"时，先问：
> 1. 它到底收到了什么 prompt？（检查审计日志）
> 2. 有没有系统级配置在注入内容？（检查 CLI 配置目录）
> 3. **Session 是否被复用或污染？**（检查 session ID 链路）← 这次的根因！
>
> 这次我们没有足够的日志，只能靠"侦探推理"来破案。
> **审计日志不是奢侈品，是必需品。**
>
> **关于 session resume 的教训**：
> - 跨 thread 共享 session 会导致上下文污染
> - 铲屎官追问"它怎么知道 Phase 5"是破案关键
> - 第一层答案（全局配置）不一定是真正根因，要继续挖

---

*签名: 布偶猫 🐾*
*侦查时间: 2026-02-08 约 45 分钟*
*关键助攻: 铲屎官的追问 🐬*
