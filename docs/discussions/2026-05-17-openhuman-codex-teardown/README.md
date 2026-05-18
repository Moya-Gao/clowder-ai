---
title: "OpenHuman 独立拆解：LLM Wiki / Memory Tree / F200 对照"
date: 2026-05-17
author: "砚砚 / GPT-5.5"
status: "first-pass"
source_repo: "https://github.com/tinyhumansai/openhuman"
source_sha: "db087a7d3ef7c82e1905ed16cd9bd883f7620d6a"
---

# OpenHuman 独立拆解：LLM Wiki / Memory Tree / F200 对照

> 触发：铲屎官要求先记录 F200 consumption attribution 问题，再独立拆解 OpenHuman。
> 方法：按 `open-source-teardown` 思路，从 README/GitBook claims 追到源码，不跑应用，不评价实际 UX。

## 结论先说

OpenHuman 不是空壳。它的 Memory Tree 有真实工程实现：canonicalize -> chunk -> fast score -> SQLite/Markdown 持久化 -> async jobs -> source/topic/global 三类树 -> retrieval。它更像一个面向个人数据的 local-first LLM wiki / desktop AI 产品。

但它没有解决我们刚暴露的 F200 核心问题：**“搜索结果是否真的被消费”这件事怎么可信统计**。OpenHuman 的重心是把 Gmail/Slack/Notion/文档等数据快速变成可检索、可摘要、可在 Obsidian 里看的知识树；它不是一个 recall eval / consumption feedback loop 系统。

一句话：**OpenHuman 的含金量在 ingest + wiki 化 + 本地产品化；我们 F200 的含金量应该在 eval 可信度 + 多猫消费反馈闭环。两者可学，但不是同一个护城河。**

## 快照

| 项 | 值 |
|---|---|
| Repo | `https://github.com/tinyhumansai/openhuman` |
| Local path | `/Users/lysander/projects/ref/openhuman` |
| Audited SHA | `db087a7d3ef7c82e1905ed16cd9bd883f7620d6a` |
| Latest fetched | `2026-05-17 18:46:15 -0700` |
| License | GPL-family license in repo metadata |
| Scope | Memory Tree / Obsidian Wiki / Composio sync / TokenJuice / agentmemory backend |

## Claim Ledger

| Claim | Verdict | Evidence | Caveat |
|---|---|---|---|
| Memory Tree 不是 vector store 套壳 | Verified | `src/openhuman/memory/tree/ingest.rs` 明确 hot path，`jobs/types.rs` 有 6 类 job，`tree_source` / `tree_topic` / `tree_global` / `retrieval` 模块真实存在 | 没跑应用，未验证大数据量性能 |
| “LLM Wiki / Obsidian Wiki” 是真实落盘 | Verified | `content_store/paths.rs` 写出 `wiki/summaries/...` 结构，`compose.rs` 生成 YAML frontmatter，`obsidian.rs` 写 `.obsidian` defaults | Wiki 主要是 memory artifacts，不等于人工策展知识库 |
| chunk <= 3k tokens + deterministic IDs | Verified | `chunker.rs` 默认 3000 token，chat/email/document 分 source kind 切分；`types.rs` 有 content-hash chunk id | token count 是近似，不是 tokenizer 精确计数 |
| Auto-fetch 每 20 分钟 | Partial | `composio/periodic.rs` 的 scheduler tick 是 1200 秒；per-provider interval 由 provider 决定 | “20 分钟”是调度上限；Gmail/Slack 是 15 分钟、Notion 30 分钟，且只有 native provider 真正做 periodic memory ingest |
| 118+ integrations | Partial / Marketing | `CAPABILITY_TOOLKITS` 只有 27 个静态 toolkit；native provider 只有 Gmail/Notion/Slack；其他多为 curated tool catalog 或 backend Composio 能力 | 118+ 可能来自 Composio backend catalog，不等于 118 个都有 native memory ingest |
| TokenJuice 是真实现 | Verified | `tokenjuice/mod.rs` 标明 Rust port，`tool_integration.rs` 有 pass-through-safe compaction gate，`reduce.rs` 有具体规则管线 | 80% 压缩是 README 数字，未用 benchmark 复核；不是 OpenHuman 原创算法 |
| agentmemory backend 是真插件 | Verified | `memory/store/agentmemory/backend.rs` 把 Memory trait 映射到 REST；`client.rs` 有 loopback/plaintext bearer guard；`mapping.rs` 做字段映射 | 它替换的是 namespace memory backend，不是 Memory Tree 全套树结构 |
| 有 F200 式 recall consumption eval | Not found | 搜索了 reward/eval/feedback/consume/self-learning 等路径，没看到 search-result -> read/use/verify 的闭环 | 这不是 OpenHuman 的承诺；只是说明它不能替代我们对 F200 eval 可信度的修复 |

## 架构地图

```text
Integration / user data
  -> Composio native providers (Gmail / Slack / Notion) or document/chat/email inputs
  -> canonicalize::{chat,email,document}
  -> chunker.rs (<= 3k token chunks, deterministic chunk IDs)
  -> content_store (raw Markdown files + Obsidian-compatible wiki files)
  -> SQLite tables (chunks, scores, jobs, trees, summaries, entity index)
  -> fast scoring
  -> mem_tree_jobs queue
       - extract_chunk
       - append_buffer
       - seal
       - topic_route
       - digest_daily
       - flush_stale
  -> tree_source / tree_topic / tree_global
  -> retrieval::{search,source,topic,global,drill_down,fetch}
  -> agent tool / MCP / UI reads
```

### 核心设计强点

- **热路径不等 LLM**：ingest path 先 canonicalize/chunk/fast-score/persist/enqueue，慢的 LLM extract/seal/digest 放 job worker。
- **SQLite job queue 有工程细节**：dedupe key、lease、retry/backoff、stale lock recovery、LLM-bound job gate 都有实现。
- **source/topic/global 三树分层清楚**：source tree 对原始来源，topic tree 对实体/主题，global tree 做跨源 digest。
- **双落盘模型适合个人产品**：SQLite 给机器查，Markdown vault 给人看/改/备份。
- **Composio native provider 分层合理**：provider trait 包含 profile、sync、trigger、connection-created hook；不是一坨 giant match。

### 关键限制

- **118+ 不能理解成 118 个 memory ingest provider**：源码里 native sync provider 是 Gmail/Slack/Notion；更多 toolkit 是 tool catalog / Composio backend surface。
- **auto-fetch 不是全源同深度**：scheduler 是每 20 分钟醒一次，但 per-provider cadence 和实现深度不同。
- **wiki 化不等于 eval 可信**：它能把数据变成树和摘要，但没看到“这个检索结果后来是否真的被 agent 用了”的可审计闭环。
- **TokenJuice 可学但要谨慎**：规则压缩对工具输出很实用，但如果压缩层没可逆审计，可能把 debug 所需信息剪掉。
- **GPL-family license**：可以学架构，不应直接搬代码。

## 对 Cat Cafe / F200 的启发

### 值得学

1. **content-addressed chunk + provenance**：OpenHuman 的 chunk id 和 source metadata 很适合做可追溯 ingestion。F200 修 consumption attribution 时，也应该把 “candidate -> source artifact -> actual read/use” 的 provenance 做硬。
2. **hot path / slow path 分离**：快速记录事实，慢处理放 job。我们 F200 eval 也可以先记录 raw event，再异步做归因审计，避免在工具调用 hot path 里塞复杂判断。
3. **人可见的 memory artifact**：Obsidian vault 的思路提醒我们，eval 结果也应有人可读的 audit artifact，而不是只在 SQLite 里。
4. **native provider 能力矩阵**：它把 toolkit 分成 native provider、curated tools、periodic sync、memory ingest 等维度。这种矩阵可以用于我们 MCP/tool 能力说明，避免 “有工具 = 有完整能力” 的误会。

### 不该直接跟

1. **不要把 integration 数量当质量指标**。我们更需要知道哪些 recall 被用、哪些没被用、为什么。
2. **不要用黑盒 query expansion 代替猫的搜索 skill**。OpenHuman 的产品方向是自动摄入，我们家是多 agent 协作，软实力 skill 仍然是对的。
3. **不要把摘要当“认识用户”**。摘要可以很有用，但 F200 要证明的是 recall/eval 闭环可信。

## 对 F200 当前问题的判断

铲屎官挑战的是对的：我们现在不能继续拿 consumption metrics 当硬证据，因为“被消费”可能被低估。

这次 OpenHuman 拆解反而强化了这个判断：OpenHuman 也在很多地方做 provenance、dedupe、source id、job queue，但它没有替我们解决 “search event 之后什么算消费” 的问题。这个问题属于我们 F200 的 eval 层，必须单独修。

我建议 F200 下一步不要先争 OQ-6/OQ-7，而是先做：

1. **抽样审计 recall_events**：人工抽 20-50 条，按 raw tool events / shell reads / direct file reads / graph drilldown / final answer 引用来标 true consumed / false negative / false positive / unknown。
2. **扩展 consumption detector**：至少覆盖 Codex 常见读法：`sed` / `nl` / `rg` / `cat` / `git show` / direct filepath open。
3. **把 candidate capture 缺口修掉**：现在很多 recall_events 记了 search 但 candidates_json 为空，后续没法算“命中候选池”。
4. **metrics 加置信区间 / sample size guard**：少于足够 consumed 样本时，OQ-6/OQ-7 自动显示“数据不足”，不能 close。

## First-pass Verdict

OpenHuman 值得读。它的 Memory Tree 是真实实现，尤其适合作为 “个人数据 -> local wiki -> agent retrieval” 的架构参考。

但它不是我们的 F200 替代品。它强在把大量个人数据变成可检索知识树；我们现在要补的是 eval 可信度，也就是确认“猫搜到的东西到底有没有被用”。这两个问题相邻，但不是同一个问题。

