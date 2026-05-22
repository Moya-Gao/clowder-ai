---
decision_id: ADR-035
feature_ids: [F128]
related_features: [F079, F102, F108]
topics: [agent-actions, approval, rich-blocks, product-design, persistence, autonomy]
doc_kind: decision
created: 2026-05-22
status: accepted
decided_by: 铲屎官（2026-05-22）
---

# ADR-035: Proposal-First Agent Actions — 猫猫先起草，铲屎官确认后执行

> 状态：accepted（2026-05-22，铲屎官提出产品方向，砚砚收敛成 ADR）
> 触发：F128 社区 issue #82 / PR #85 的 `cat_cafe_create_thread` 方案暴露了一个更通用的产品问题：猫猫需要能主动推进工作，但不能悄悄改变用户可见的持久状态。
> 适用范围：agent 主动发起、会改变用户工作空间结构或外部世界状态的动作。

## 背景

Cat Cafe 的愿景要求猫猫具备主动性：发现话题需要独立上下文时，猫猫应该能帮铲屎官整理出一个新 thread；发现信息值得沉淀时，猫猫应该能帮铲屎官准备候选记忆；发现某项工作需要追踪时，猫猫应该能准备任务或计划。

但这些动作如果由猫猫直接执行，会带来另一类产品问题：

- 用户可见的工作空间结构会被悄悄改变；
- 持久化数据会增加，且用户不一定理解来源；
- 跨 thread / 外部系统 / 长期自动化会产生追溯和权限边界问题；
- 猫猫的“主动性”容易变成用户体感上的“失控”。

F128 的原始方案是给猫猫暴露 `cat_cafe_create_thread`，让猫直接创建新 thread。这个方案解决了“猫没有能力”的问题，但没有解决“谁授权这个持久化结构变化”的产品问题。

## 决策

### KD-1: 对高影响 agent 动作默认采用 Proposal-First 流程

凡是 agent 主动发起、且动作结果满足任一条件，默认不得直接执行，必须先生成可编辑的提案卡片，由铲屎官确认后执行：

1. 创建、删除、归档、移动、重命名用户可见对象；
2. 改变 thread / task / memory / schedule / connector / project settings 等持久化状态；
3. 向外部系统发送消息、评论、PR、issue、日程邀请或其他可见副作用；
4. 触发长期自动化、周期任务、后台 watcher、订阅或 webhook；
5. 产生费用、占用显著资源，或可能造成重复噪声；
6. 需要代表用户做出产品、项目、治理或社交判断。

标准流程：

```text
agent detects need
  -> agent creates proposal card
  -> user edits / approves / rejects
  -> backend executes using user approval context
  -> system writes audit trail + source link
```

### KD-2: Agent 工具命名必须反映权限边界

工具名不能暗示猫猫拥有它实际上不该拥有的权限。

| 动作类别 | 工具命名 | 行为 |
|----------|----------|------|
| 猫可直接安全完成 | `cat_cafe_create_*` / `cat_cafe_update_*` | 直接执行 |
| 需要用户确认 | `cat_cafe_propose_*` / `cat_cafe_request_*` | 只创建提案，不执行最终动作 |
| 需要系统审批流 | `cat_cafe_submit_*_proposal` | 进入明确审批队列 |

`cat_cafe_create_thread` 这类直建工具不应作为默认猫猫能力暴露。F128 应改为 `cat_cafe_propose_thread`，由卡片确认后才创建 thread。

### KD-3: 提案卡片是主要产品界面，不是错误兜底

提案卡片必须是用户能理解和编辑的第一入口，而不是后台 API 失败后的 fallback。

最小字段：

- **Title**：将要创建或修改的对象名称；
- **Why**：猫猫为什么建议这个动作；
- **Scope**：影响范围，例如 parent thread、projectPath、外部 repo、目标 channel；
- **Payload**：可编辑内容，例如初始消息、任务描述、schedule cron、GitHub comment；
- **Actor**：提案猫、审批人、执行身份；
- **Actions**：Approve / Edit / Reject；
- **Audit Link**：执行后能回到原 thread 和原提案。

### KD-4: 执行阶段必须使用用户确认上下文

Approve 后的执行不是“猫猫继续执行”，而是系统拿到一个用户确认事件后执行：

- 后端 endpoint 必须校验当前用户有权限；
- 使用 idempotency key 防重复执行；
- 记录 `proposalId`、`approvedBy`、`approvedAt`、`sourceThreadId`、`executedActionId`；
- 成功后在源 thread 留下结果消息；
- 失败时更新原卡片状态，而不是悄悄吞掉。

### KD-5: 明确例外，不把确认流做成到处弹窗

以下场景可以直接执行：

1. 用户在当前 turn 明确要求具体动作，且字段完整、影响范围清晰；
2. 动作只影响当前回复的呈现，不产生持久化对象；
3. read-only 查询、诊断、检索；
4. 已进入显式批准流程的后续机械步骤；
5. 用户在 settings 中为某类低风险动作开启 trusted auto-execute。

即使命中例外，高影响动作仍应尽量在聊天流中留下可见结果和撤销路径。

## 适用例子

| 功能 | 默认模式 | 理由 |
|------|----------|------|
| F128 创建子 thread | 提案卡片 | 改变 thread 结构，持久化可见 |
| 创建/调整 schedule | 提案卡片 | 长期自动化，可能持续触发 |
| 发布 Knowledge Feed 候选 | 提案卡片 / approve 队列 | 把临时知识变成可检索真相源 |
| 新建用户任务 / 项目任务 | 提案卡片 | 改变用户工作清单 |
| 发送 GitHub/飞书/Slack 外部消息 | 提案卡片，除非用户显式要求原文发送 | 外部可见副作用 |
| 改 connector / MCP / model settings | 提案卡片 | 改运行环境和权限边界 |
| 归档/删除/移动 thread | 提案卡片或更强确认 | 用户空间结构变化 |
| 猫猫回复当前 thread | 直接执行 | 当前对话的基本能力 |

## 对 F128 的影响

F128 从“Cat-Initiated Thread Creation”调整为“Cat-Proposed Thread Creation”：

- MCP 工具从 `cat_cafe_create_thread` 改为 `cat_cafe_propose_thread`；
- 猫猫只能创建 thread proposal rich block；
- 铲屎官在卡片中确认后，后端才创建 thread；
- 创建成功后系统自动把新 thread 与源 thread 互链，并写 audit；
- 社区 PR #85 的直建 API 方向不再是推荐产品路径，需要按本 ADR 改造。

## Open Questions

### OQ-1: 用户显式说“现在创建一个 X thread”时是否仍弹卡？

倾向：仍使用同一个卡片组件，但可做成一键确认的紧凑形态。这样保持一致审计链，也避免猫猫和普通用户操作走两套创建逻辑。

### OQ-2: 是否需要全局 trusted auto-execute 策略？

倾向：可以有，但必须按动作类型细分，且默认关闭。trusted mode 不能覆盖删除、外部发送、费用、权限配置等高风险动作。

## Review Trail

| 日期 | 事件 |
|------|------|
| 2026-05-22 | 铲屎官拍板 F128 不应是单点问题，应抽象为一类产品设计模式：猫猫填好信息，铲屎官点击再创建，不悄悄创建 |
| 2026-05-22 | 砚砚将该模式沉淀为 Proposal-First Agent Actions，并同步更新 F128 spec |
