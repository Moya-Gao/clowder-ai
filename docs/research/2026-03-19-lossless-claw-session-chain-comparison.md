---
feature_ids: [F102, F065]
topics: [lossless-claw, openclaw, session-chain, memory, compaction, DAG, research]
doc_kind: research
created: 2026-03-19
source: 三猫协作（布偶猫/宪宪 + 金渐层/opencode + 缅因猫/砚砚）
---

# Lossless Claw vs Cat Café Session Chain：调研对比与学习建议

> **背景**：铲屎官在 2026-03-19 提到 OpenClaw 社区很火的 DAG 记忆插件 Lossless Claw（LCM），
> 要求三只猫侦探调查它是什么、和我们的 F102 记忆系统 / session chain 有何相似不同、我们能学什么。
>
> **参与猫**：@opus（收敛）、@opencode（OpenClaw 生态视角）、@gpt52（架构风险视角）

## 一、Lossless Claw 是什么

**Lossless Claw**（LCM — Lossless Context Management）由 Martian Engineering 团队开发，基于 Voltropy 公司发表的 LCM 论文。OpenClaw 创始人 Peter Steinberger 亲自推荐，帖子 277K 浏览 + 3200 赞，GitHub ~2.9K stars。

### 解决什么问题

OpenClaw 默认 compaction 是滚动式摘要——context window 满了就把旧消息压成一段话。结果：花 45 分钟解释的架构，compaction 一触发就忘了。

### 核心架构：DAG 层级摘要

```
        [凝结摘要 L2]          ← 更高层（多个 L1 摘要再压缩）
       /      |      \
   [L1摘要] [L1摘要] [L1摘要]   ← 叶子摘要（每个压缩自 ~20K tokens 原始消息）
    /  \      |       |  \
  [m1][m2] [m3..m8] [m9..m16]  ← 原始消息（全量保留在 SQLite）
```

1. **全量保存** — 每条消息存进 SQLite，一条不丢
2. **叶子摘要** — 老消息分 chunk（~20K tokens），用 LLM 压缩成 ~1.2K tokens 摘要节点
3. **向上凝结** — 摘要节点积累够了，再压成更高层摘要，形成 DAG 树
4. **组装上下文** — 每轮对话从 DAG 上层摘要 + 最近 32 条原始消息拼成 context
5. **穿透工具** — 4 个 agent tools：`lcm_grep`（全文搜历史）、`lcm_describe`（描述摘要）、`lcm_expand_query`（高层回钻入口）、`lcm_expand`（低层展开）

### 技术选型

- 存储：SQLite（和我们一样）
- 上下文引擎：通过 OpenClaw v2026.3.7 的 `contextEngine` 插件槽接入
- 解决范围：**session 内 compaction**——"当前对话不丢失"

### 参考来源

- OpenClaw `v2026.3.7` release: https://github.com/openclaw/openclaw/releases/tag/v2026.3.7
- `lossless-claw` repo: https://github.com/Martian-Engineering/lossless-claw
- architecture doc: https://raw.githubusercontent.com/Martian-Engineering/lossless-claw/main/docs/architecture.md
- agent tools doc: https://raw.githubusercontent.com/Martian-Engineering/lossless-claw/main/docs/agent-tools.md

## 二、三层对标关系

三猫共识：Lossless Claw 不是 F102 的竞品，它们在不同层：

| 层 | 解决什么 | 我们的对应 | Lossless Claw |
|----|---------|-----------|--------------|
| **Session 内 compaction** | 上下文快满了，怎么不丢细节 | 各家 CLI 自己管（我们控制不了） | **LC 核心解决层** |
| **跨 Session 恢复** | 旧 session 封印后，新 session 怎么接上来 | **F065 Session Continuity** | 不涉及 |
| **项目级长期记忆** | 跨天/跨周/跨 thread 的知识回忆和治理 | **F102 Memory Adapter** | 不涉及 |

**结论**：LC 最对标的是 F065（session continuity），不是 F102。但 F065 和 F102 之间的写路径（pre-seal → durable knowledge）是我们能从 LC 学到的核心改进点。

## 三、Session Chain vs Lossless Claw 详细对比

### 相似点

| 维度 | Lossless Claw | 我们的 Session Chain |
|------|--------------|-------------------|
| 原始消息存储 | SQLite，全量保留 | `events.jsonl` per session，全量保留 |
| 分段策略 | ~20K tokens 一个 chunk | context fill ratio > 0.8 触发 seal |
| 摘要生成 | LLM 生成叶子摘要 (~1.2K tokens/chunk) | extractive digest（rule-based，零 LLM） |
| 上下文拼装 | 高层摘要 + 最近 32 条原始消息 | session bootstrap 拉前一个 session 的 digest + 当前 session |
| 回钻机制 | `lcm_expand` 从摘要穿透到原文 | `read_session_events(view=chat/raw)` 从 digest 穿透到事件流 |
| 索引 | SQLite 内部 | sparse offset index + FTS5 (F102) |

### 关键差异

| 维度 | Lossless Claw | 我们的 Session Chain |
|------|--------------|-------------------|
| **结构** | DAG 树（多级层级） | 严格线性链（seq 0→1→2…） |
| **连续性** | 无感——agent 不知道发生了 compaction | 断裂——猫醒来知道自己是 Session #2 |
| **摘要类型** | Abstractive（LLM 语义摘要） | Extractive（规则提取工具名/文件/错误） |
| **最小粒度** | 单条消息 | 一个 session（含多个 invocation） |
| **Session 边界** | 按 token 量硬切 chunk | 有语义边界（一次 CLI 生命周期） |
| **跨 session** | 不涉及 | session chain + F102 evidence 索引 |
| **知识治理** | 无（不管知识过期/晋升） | marker → review → materialize + superseded_by |

### 金渐层的关键比喻

> "Lossless Claw 是在同一间屋子里无缝换墙纸（context 连续压缩），我们 Session Chain 是在相邻房间之间开了一扇带备忘录的门（seal → bootstrap → 搜旧房间）。"

## 四、三猫收敛：应该学什么

### P1：Pre-seal Abstractive Digest + Durable Memory Flush

**宪宪**提的"seal 时加 abstractive digest"和**砚砚**提的"pre-seal durable memory flush"是同一条链路的两段：

```
session 即将 seal
  → extractive digest（已有，免费）
  → abstractive digest（新增，回答"讨论了什么、决定了什么"）
  → durable candidate 提取（新增，候选记忆 → marker 层 → F102 物化）
```

**模型选择**：铲屎官明确指示用 Opus 4.6（128k，通过金渐层/反代 API），不用 Haiku。原因：之前实测 Haiku 会带坑里，Sonnet 需推断，Opus 完全准确。

**增量策略**：
- 实时路径不改（拼接摘要写 evidence_docs，<100ms）
- 后台定时批处理（每 30 分钟或 dirty thread >= 3 时触发，调 Opus API 生成 abstractive summary）
- seal 事件优先进队列
- 存量历史 thread 一次性批处理（有摘要用摘要，没有用拼接）

### P2：ThreadMemory 两层化

三猫一致认为 ThreadMemory 的滚动删除是弱点：

```
ThreadMemory = 远期凝结层（Sessions #1-#5 的合并概括，带 sessionId 指针）
             + 近期详细层（最近 2-3 个 session 的完整摘要行）
```

凝结时保留 sessionId 指针（金渐层的路标思想），猫需要时能穿透回原始 transcript。规则合并即可，不需要 LLM。

### P3：搜索结果带穿透路标

`search_evidence` 命中 session/thread 类结果时，response 里直接带 `drill_down` hint：

```json
{
  "anchor": "thread-abc123",
  "drill_down": {
    "tool": "read_session_events",
    "params": { "sessionId": "xxx", "view": "handoff" }
  }
}
```

### 附：Conversation Identity 统一语义边界

砚砚独立提出，三猫认同需要做但不是从 LC 学来的——是我们自己的架构债。建议作为独立 ADR 立项。

五个概念的当前定义：

| 概念 | 是什么 | 存在哪 |
|------|--------|--------|
| **Thread** | 持久化"聊天室"，有 title/participants/featureIds | Redis Hash `thread:{id}` |
| **Session Chain** | 按 catId × threadId 组织的 session 线性序列 | Redis SortedSet `session-chain:{catId}:{threadId}` |
| **Active Slot** | 每猫每 thread 最多一个 active session 的指针 | Redis String `session-active:{catId}:{threadId}` |
| **Connector Binding** | 外部平台 chat → Cat Cafe thread 的映射 | Redis Hash `connector-binding:{connectorId}:{externalChatId}` |
| **CLI Resume** | CLI `--resume` 的 session ID → 我们 session 的映射 | Redis String `session-cli:{cliSessionId}` |

缺少的是这些概念"如何协同"的统一叙事文档。

## 五、明确不学的

1. **不搬 DAG 引擎**——我们的 session 边界有语义（一次 CLI 生命周期），比 LC 按 token 量硬切更好
2. **不替换 CLI compaction**——各家 CLI 自己管，我们控制不了
3. **不让模型直接写长期真相源**——marker → review → materialize 的门禁不能省
4. **不把 LC 当 F102 替代品**——它解决 session continuity，不是项目知识治理

## 六、一句话总结

从 Lossless Claw 学到的不是一个 DAG，是一个理念——**"压缩不等于丢弃，摘要必须可穿透"**。落到我们的行动就是三件事：seal 时写有语义的摘要、ThreadMemory 凝结而非删除、搜索结果自带回钻路标。

## 关联文档

- [F102 spec](../features/F102-memory-adapter-refactor.md) — Phase G 新增内容
- [OpenClaw 深度研究综合](./2026-03-16-openclaw-cat-cafe-learning-synthesis.md) — 更广泛的 OpenClaw 学习
- [F065 Session Continuity](../features/F065-session-continuity.md) — session chain 跨 session 恢复
- [F033 Session Strategy](../features/F033-session-strategy-configurability.md) — session 策略配置
