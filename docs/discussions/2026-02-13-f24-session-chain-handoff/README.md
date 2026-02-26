---
feature_ids: [F024]
topics: [session, chain, handoff]
doc_kind: discussion
created: 2026-02-13
---

# F24 Session 链 + Sub-agent 交接讨论

> 日期：2026-02-13
> 参与者：铲屎官、布偶猫
> 状态：💡 讨论中，待三猫 + 铲屎官对齐
> 关联：[BACKLOG F24](../../BACKLOG.md)、[GPT Pro 调研](../../archive/2026-02/research/2026-02-13-f24-gpt-pro-research-result.md)、[调研提示词](../../prompts/2026-02-13-f24-gpt-pro-research-prompt.md)

---

## 1. 背景与动机

### 现状

Cat Café 的三猫（Claude/Codex/Gemini）通过 CLI 子进程调用。每只猫在一个 session 里工作，session 有 context window 上限：

| 猫猫 | Context Window | 实际安全区 |
|------|---------------|-----------|
| 布偶猫 (Claude Opus) | ~200k tokens | ~170k (auto-compact 在 ~95% 触发) |
| 缅因猫 (Codex/GPT) | ~128k tokens | 待确认 |
| 暹罗猫 (Gemini) | ~1M tokens | ~700k (auto-compress 在 70% 触发) |

当 context 快满时，CLI 会自动压缩（auto-compact），**静默丢失早期细节**。铲屎官如果睡着了，猫猫可能在 compact 后"失忆"继续工作，质量下降但不自知。

### 痛点

1. **Auto-compact 是黑箱** — 压缩了什么、丢了什么，猫和铲屎官都不知道
2. **濒死猫写不好交接** — context 剩 15% 时让猫写交接，它已经记不清早期细节了
3. **铲屎官可能不在线** — 不能依赖人手动触发交接
4. **compact 后的记忆不可追溯** — 前端看不到被压缩掉的内容

### 目标

> "猫的 session 满了就自动换一个，新猫能按需查旧 session，前端能看到完整历史"

铲屎官想要：
1. **Thread 对应多个 Session** — session 满了自动拉新的，不丢数据
2. **前端可视化 Session 链** — 每段 session 的内容都能查看/复制
3. **新 session 的猫按需获取旧上下文** — 不是一次性灌入，而是像搜代码一样按需拉取
4. **不依赖铲屎官在线** — 全自动检测 + 切换 + 恢复

---

## 2. 核心创意：Sub-agent 按需拉取模式

### 铲屎官的脑洞（2026-02-13 对话中提出）

传统思路（GPT Pro 方案）：濒死猫自己写交接文档 → 新 session 读文档。

铲屎官的升级思路：

```
Session 1 的宪宪：context 快满了 → 自动结束（不需要写任何交接）

Session 2 的宪宪：全新满血 200k
  ├── 启动时知道自己是 Session 2，前面有 Session 1
  ├── 派出 Sonnet sub-agent（1M context，便宜 10 倍+）
  │     ├── 调用 MCP: read_session_transcript(session_1_id)
  │     ├── 读到完整对话记录
  │     ├── 按会议纪要规范输出：
  │     │     ├── 产出的所有文件清单
  │     │     ├── 每个决策的 WHY
  │     │     ├── 各 invocation 摘要 (invocation_id 可供后续查询)
  │     │     └── 未完成的事项 + 下一步
  │     └── 返回给 Session 2 的宪宪
  ├── 宪宪看摘要就知道之前做了什么
  ├── 某个 invocation 想细看？再派 agent 去读那条
  └── 继续干活
```

### 为什么这比"写交接文档"更优

| 维度 | 传统交接文档 | Sub-agent 按需拉取 |
|------|------------|-------------------|
| **交接质量** | 濒死猫 context 紧张，写出的交接不完整 | Sonnet 1M context 读完整 transcript，无信息损失 |
| **交接粒度** | 写的时候就决定了粒度（死的） | Session 2 的猫根据需要决定看多深（活的） |
| **成本** | Opus 写交接（贵） | Sonnet 读+总结（便宜 10 倍+） |
| **Session 1 的负担** | 快满了还要分心写交接 | 零负担，直接结束 |
| **可追溯性** | 交接文档是一次性产物 | 原始 transcript 永久保留，随时可重新阅读 |

### 同构类比：就像现在搜代码

| 现在的工作方式 | F24 的工作方式 |
|--------------|--------------|
| 派 Sonnet agent 去**搜代码仓** | 派 Sonnet agent 去**读旧 session transcript** |
| Agent 返回"这几个文件相关，摘要如下" | Agent 返回"上个 session 做了这些事，摘要如下" |
| 我感兴趣就 Read 具体文件 | 我感兴趣就读具体 invocation 详情 |
| **按需拉取，不是一次性灌入** | **同理** |

---

## 3. 核心决策

### 决策 1：Thread → 多 Session 数据模型

当前：1 Thread = 1 Session per cat（隐式，通过 `userId:catId:threadId` 的 session key）

改为：1 Thread = N Sessions per cat，session 有序链接

```
Thread: "F24 开发"
├── Session 1 (opus, 创建 14:00, 结束 15:30, tokens: 195k/200k)
├── Session 2 (opus, 创建 15:31, 结束 17:00, tokens: 188k/200k)
├── Session 3 (opus, 创建 17:01, 活跃中, tokens: 85k/200k)
└── 前端：每段 session 可展开查看完整内容
```

**Why**：Session 是有寿命的（context 会满），但 Thread 的生命周期更长（一个功能可能跨多个 session）。解耦后 session 满了不影响 thread 连续性。

**Tradeoff**：增加了数据模型复杂度（SessionStore + session chain 管理），但换来了零信息丢失。

### 决策 2：Session Transcript 暴露为 MCP 工具

新增 MCP 工具让猫猫（或 sub-agent）能读取任意 session 的完整 transcript：

```
read_session_transcript(sessionId) → 完整对话记录
read_invocation_detail(invocationId) → 单次调用的完整输入/输出
list_session_chain(threadId, catId) → 该猫在这个 thread 的所有 session 列表
```

**Why**：Sub-agent 需要数据源。MCP 是我们已有的跨猫通信机制，复用成本最低。

**Tradeoff**：Transcript 可能很大（200k tokens），MCP 工具需要支持分页或摘要模式。

### 决策 3：自动切换策略 — sessionRestart 而非 nativeCompact

GPT Pro 调研确认：三猫的 compact 机制各不相同，且都是黑箱。统一做法：

1. 检测 context 使用超过阈值（如 85%）
2. **结束当前 session**（不依赖各家 compact）
3. 自动开新 session
4. 新 session 启动时派 sub-agent 拉取旧 session 摘要

**Why**：`/compact` 在 Claude headless 模式下不可靠（GPT Pro 已确认）；Codex/Gemini 的 compact 行为也不统一。自己管 session 生命周期比依赖黑箱更可控。

**Tradeoff**：新 session 需要"热启动"时间（sub-agent 读旧 session + 总结），但这个时间可以后台并行。

### 决策 4：交接规范 = 会议纪要规范

Sub-agent 输出的交接摘要必须遵循我们已有的规范：

1. **产出文件清单** — 上个 session 创建/修改了哪些文件
2. **每个决策的 WHY** — 不只是"改了什么"，还有"为什么这样改"
3. **Invocation 摘要表** — 每次猫调用的 ID + 状态 + 耗时 + 简述
4. **未完成事项** — 进行中的任务 + 卡住的原因
5. **下一步建议** — Session 2 应该先做什么

**Why**：规范已有，不需要发明新格式。Sub-agent 按规范输出，Session 2 的猫能快速理解。

---

## 4. 与现有架构的契合度

### 已有基础设施（可直接复用）

| 组件 | 现有能力 | F24 用途 |
|------|---------|---------|
| `InvocationRecord` | 每次猫调用有唯一 ID + 状态 + usage | 按 invocation 粒度检索 |
| MCP callback 工具 | `post_message`、`search_evidence` 等 | 新增 `read_session_transcript` |
| `ContextAssembler` | 跨 session 上下文组装 | Session 2 启动时的上下文注入 |
| Claude Task tool | 派 Sonnet/Haiku sub-agent | 读旧 session + 写摘要 |
| Codex sub-agent | Codex 也支持 sub-agent | 同理 |
| `TokenUsage` 类型 | 已有 `inputTokens`/`outputTokens` | 扩展 `contextWindow` + `usedPct` |
| 会议纪要规范 | 已在多次讨论中使用 | Sub-agent 输出格式 |

### 需要新建的

| 组件 | 说明 |
|------|------|
| `SessionChainStore` | Session 链数据模型（parentSessionId, status, tokenUsage） |
| `read_session_transcript` MCP 工具 | 暴露 transcript 供 sub-agent 读取 |
| `ContextHealth` 类型 | 统一的 context 使用百分比（exact/approx/none） |
| Session 自动切换逻辑 | 检测阈值 → 结束旧 session → 开新 session |
| 前端 Session 链 UI | 显示 session 1 → 2 → 3 链条，每段可展开 |

---

## 5. 三猫差异化处理

| 能力 | 布偶猫 (Claude) | 缅因猫 (Codex) | 暹罗猫 (Gemini) |
|------|----------------|----------------|-----------------|
| **中途消息注入** | ✅ `--input-format stream-json` | ❌ exec 不支持（app-server 有 `turn/steer`） | ❌ one-shot 模式 |
| **Context 监控精度** | `exact` — `modelUsage.contextWindow` 在流里 | `approx` — 有 token 数，window 需硬编码 | `approx` — 有 token 数，window 硬编码 1M |
| **Session 切换触发** | 主动：context 监控 + stdin 注入"准备结束" | 轮间：每轮完成后检查 token，决定是否 resume | 事后：调用结束后检查 token |
| **Sub-agent 交接** | ✅ Task tool 派 Sonnet | ✅ Codex sub-agent | ⚠️ 需要通过 MCP prompt 注入 |

---

## 6. 开放问题

| # | 问题 | 影响范围 | 建议 |
|---|------|---------|------|
| 1 | Session transcript 存储位置？Redis 还是文件系统？ | 存储成本 + 查询性能 | 文件系统落盘（`.jsonl`），Redis 存元数据索引 |
| 2 | Sub-agent 读 transcript 的 token 成本？200k transcript 用 Sonnet 读一次约多少钱？ | 运营成本 | 需实测。Sonnet 1M input 价格较低，估算 ~$0.6/次 |
| 3 | Session 切换的阈值设多少？85%？90%？ | 用户体验 vs context 利用率 | 建议 85% 开始预警，90% 自动切换 |
| 4 | 前端 session 链 UI 怎么设计？ | UX | 待暹罗猫参与设计讨论 |
| 5 | Codex 是否值得从 exec 迁移到 app-server？ | 架构复杂度 | Phase 3 评估，不 block Phase 1-2 |
| 6 | Gemini 1M context 实际安全区在哪？ | 暹罗猫的切换策略 | 需实测，初期保守设 70% |

---

## 7. 建议实施路线

### Phase 1：Context 监控 + 前端显示

- 从三猫的 CLI 输出中提取 token usage + context window
- 前端 status panel 显示 "上下文健康度"（已用 / 总量 / 剩余 %）
- 数据来源标注 exact / approx

### Phase 2：Session 链数据模型 + 自动切换

- SessionChainStore：Thread has many Sessions per cat
- 自动检测阈值 → 结束旧 session → 开新 session
- 前端显示 session 链（可展开查看）

### Phase 3：Sub-agent 按需拉取交接

- `read_session_transcript` MCP 工具
- `read_invocation_detail` MCP 工具
- Session 2 启动时自动派 sub-agent 读 Session 1 → 输出会议纪要格式摘要
- 新 session 的猫看摘要即可继续工作

### Phase 4：中途消息注入（Claude 先行）

- Claude CLI 切换到 `stream-json` 双向模式
- 铲屎官在猫执行期间可追加消息
- 后续评估 Codex app-server 迁移

---

## 8. 参考资料

- [BACKLOG F24](../../BACKLOG.md) — 中途消息注入 + Context 存活监控 + 自动交接
- [GPT Pro 调研结果](../../archive/2026-02/research/2026-02-13-f24-gpt-pro-research-result.md) — 三猫 CLI 能力深度调研
- [调研提示词](../../prompts/2026-02-13-f24-gpt-pro-research-prompt.md) — 委托 GPT Pro 的调研提示词
- [布偶猫初步调研](#) — 三猫能力矩阵（本次对话中完成）
- Cat Café 会议纪要规范 — Sub-agent 交接输出格式
