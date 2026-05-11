---
title: "嘉宾核心项目拆解 — 记忆方向（Claims → 代码证据 → Verdict）"
date: 2026-05-11
event_date: 2026-05-13
doc_kind: seminar-reference
status: final
author: "宪宪/Opus-46"
method: "open-source-teardown (claims ledger + 架构地图 + 算法剥皮)"
repos_analyzed:
  - { name: LightMem, url: "https://github.com/zjunlp/LightMem", sha: 15ba5b39 }
  - { name: GMemory, url: "https://github.com/bingreeky/GMemory", sha: shallow-clone }
  - { name: MemP, url: "https://github.com/zjunlp/MemP", sha: shallow-clone }
---

# 嘉宾核心项目源码拆解 — 记忆方向

> 按 teardown 标准：宣传 claim → 代码路径 → verdict → 我们的 tradeoff。
> 聚焦 3 个与 Topic 1 直接竞争的开源项目。

---

## 1. LightMem（张宁豫 / ZJUNLP）— ICLR 2026

### Claims Ledger

| # | Claim（README / 论文） | 代码证据 | Verdict |
|---|---|---|---|
| C1 | "三阶段记忆：sensory → short-term → long-term" | `SenMemBufferManager`（token 阈值触发分段）→ `ShortMemBufferManager`（累积分段触发提取）→ `MemoryEntry` + Qdrant 向量存储 | **✅ 真实实现**。三阶段是 pipeline 阶段不是认知模型——sensory = 消息缓冲 + 语义分段，short-term = 累积直到 LLM 提取，long-term = 向量 DB + JSON 持久化 |
| C2 | "token 用量降 117x" | 通过 topic 分段 + LLM 提取 facts 替代全量上下文注入。检索时只返回 `"{timestamp} {weekday} {memory_text}"` 格式字符串 | **✅ 数字可信但机制朴素**。本质是"提取摘要 + 按需检索"替代"塞全文"，不是压缩算法创新。任何 extract-then-retrieve 方案都能拿到类似倍数 |
| C3 | "准确率提升 10.9%" | 在 LongMemEval 上对比 full_context / naive_rag / mem0 / langmem 等 baseline | **⚠️ 条件成立**。baseline 包含 mem0 vendor fork（`memories/layers/baselines/mem0/`），公平性待验证 |
| C4 | "sleep-time 离线更新" | `offline_update` pipeline：向量相似度找候选 → LLM judge 决定 delete / update → 修改 Qdrant payload | **⚠️ LLM judge 不是算法**。没有独立 eval、threshold、rollback。LLM 说删就删，说改就改 |
| C5 | "模块化可插拔设计" | Factory 模式：6 种 LLM backend、2 种 retriever（embedding / context）、可选 pre-compress / topic-segment | **✅ 工程质量好**。config-driven pipeline，组件确实可替换 |
| C6 | "MCP Server 接口" | `mcp/server.py`：只暴露 `add_memory()` + `get_timestamp()`，**没有 retrieve** | **⚠️ 半成品**。MCP 只写不读，不是完整接口 |

### 架构地图

```
Input Messages → MessageNormalizer（时间戳解析）
    ↓
[可选: pre_compress] → SenMemBufferManager（token 阈值 + 语义分段）
    ↓
ShortMemBufferManager（累积分段，超阈值触发）
    ↓
LLM Extraction（meta_text_extract，flat/event 两种模式）
    ↓
MemoryEntry（12 个 metadata 字段）→ text_embedder.embed()
    ↓
Qdrant 向量 DB + JSON 文件双写
    ↓
[离线: offline_update] → 向量相似度找候选 → LLM judge → delete/update
```

### 算法剥皮

| 被宣传为 | 实际是 |
|---|---|
| "三阶段认知记忆" | Token 阈值触发的 pipeline 阶段（缓冲 → 累积 → 提取） |
| "sleep-time consolidation" | LLM prompt judge（无独立 eval / 无 rollback） |
| "topic-aware segmentation" | 语义相似度阈值切割（cosine distance 0.2-0.5）+ 粗分段器 |
| "memory retrieval" | 标准 Qdrant 向量搜索 + 可选 BM25 |

### 对我们发言稿的影响

**好消息**：LightMem 是一个优秀的 **Layer 1（Memory Substrate）+ Layer 2（Reflex Injection）** 实现。但它**完全没有**：

- ❌ Governance Plane：无 provenance、无 permission、无 delete propagation、无 audit trail
- ❌ Layer 3 Wearing Protocol：无机制让 agent 学习何时使用/压制记忆
- ❌ Salience Ledger：无"为什么被写入/取出/压制"的记录
- ❌ Multi-agent 一致性：单 agent 设计，无共享/冲突解决

**这直接验证了我们的核心论点**："前两层行业在卷，第三层还没有形成成熟方法论"——LightMem 就是"前两层卷到了 ICLR 2026"的代表。

**风险**：张宁豫可能用 LightMem 的 117x 数据反驳"检索门槛归零"。**对话策略**：承认 LightMem 在检索效率上的突破，然后问："LightMem 的 offline_update 里 LLM 判错了怎么回滚？谁来审计这个决定？"——引导到治理层。

---

## 2. G-Memory（张桂彬 / NUS）— NeurIPS 2025

### Claims Ledger

| # | Claim | 代码证据 | Verdict |
|---|---|---|---|
| C1 | "三层图结构：insight-query-interaction" | Interaction = `StateChain`（NetworkX DiGraph 链，节点=AgentMessage）；Query = NetworkX 无向图（节点=任务，边=语义相似度）；Insight = JSON list（rule + score + 正负相关任务列表） | **⚠️ 名字是"图"但实现差异大**。Interaction 是图，Query 是图，Insight 只是带 score 的 list |
| C2 | "多 agent 层级记忆" | 所有 agent 读写同一个 `meta_memory` 实例。`solver_agent` 和 `ground_truth_agent` 都没有 private memory | **⚠️ "多 agent" = 共享单例存储**。无锁、无事务隔离、无冲突解决、无版本控制。假设顺序执行 |
| C3 | "从协作历史中汲取知识" | Insight 通过 LLM 比较成功/失败轨迹生成 rules → 按 task 结果 ±score → score ≤ 0 淘汰 | **✅ 有真实的知识沉淀闭环**。但 score 调整是粗暴的 +1/-2，无因果分析 |
| C4 | "跨任务持续进化" | 内存持久化到 pickle + JSON + Chroma 向量 DB。跨 trial 累积 | **✅ 工程上实现了持久化**。但无 TTL / 无过期 / 无知识失效检测 |

### 架构地图

```
Task 执行 → Agent 消息链（StateChain / Interaction Graph）
    ↓
Sparsification（移除失败步骤）→ LLM 提取关键步骤
    ↓
Query Graph（任务节点 + 语义相似度边 + k-hop 展开检索）
    ↓
Insight Graph（LLM 对比成功/失败轨迹 → 生成/修正 rules）
    ↓
Backward（任务结果 → rule score ±调整 → score≤0 淘汰）
```

**存储后端**：

| 层 | 存储 | 格式 |
|---|---|---|
| Interaction | Chroma 向量 DB | metadata + node_link_data |
| Query | NetworkX pickle | `{ns}_graph.pkl` |
| Insight | JSON list | `{ns}.json` |

### 算法剥皮

| 被宣传为 | 实际是 |
|---|---|
| "层级图记忆" | 三种不同存储结构的 pipeline（DiGraph + 无向图 + JSON list） |
| "组织记忆理论" | LLM prompt judge 生成 rules + 简单 score 增减 |
| "多 agent 协同记忆" | 共享单例存储 + 顺序执行假设 |
| "跨任务知识迁移" | 向量相似度检索 + k-hop 图遍历 |

### 对我们发言稿的影响

**关键发现**：G-Memory 声称做"多 agent 记忆"，但代码里**没有任何分布式一致性协议**。所有 agent 读写同一个 Python 对象实例，假设顺序执行。

**这强化了我们断裂点 2 的论点**："当前所有框架都是'共享一个数据库'——但这只解决了存储一致性，没解决语义一致性"——G-Memory 恰好印证了这一点。

**风险**：张桂彬可能认为我们说"多 agent 记忆几乎未开垦"不公平，因为他已经在做。**对话策略**："G-Memory 在跨任务知识沉淀上走得最远，insight graph 的 rule lifecycle 是有意义的探索。但在 agent A 异步更新 rule 而 agent B 同时在用这条 rule 做决策的场景下——当前没有一致性保证。这才是我们说的'未开垦'——不是'没人做'，是'没人做到分布式语义一致性'。"

---

## 3. MemP（张宁豫 / ZJUNLP）— 程序性记忆

### Claims Ledger

| # | Claim | 代码证据 | Verdict |
|---|---|---|---|
| C1 | "程序性记忆——复用跨任务经验" | LLM 从轨迹提取 workflow（自然语言段落），存入 FAISS 向量 DB，按 query 相似度检索 | **⚠️ "程序性记忆" = LLM 摘要 + 向量检索**。没有可执行程序，没有符号化表示 |
| C2 | "动态更新/修正/废弃" | 三种策略：vanilla（全存）、validation（只存成功的）、reflect（LLM 分析失败 → 重写 workflow） | **✅ 有真实的 lifecycle**。reflect 模式有 LLM 修正 + 自动废弃（hit≥3 且成功率<50% 删除） |
| C3 | "distilling into step-by-step + script-like abstractions" | 两种提取模式：direct（单次 LLM 提取 workflow 段落）/ round（先提取 atomic events JSON → 再选关键步骤） | **✅ 两种粒度确实不同**。但"script-like"只是自然语言段落，不是可执行脚本 |

### 算法剥皮

| 被宣传为 | 实际是 |
|---|---|
| "程序性记忆" | LLM 摘要（自然语言 workflow） |
| "动态废弃" | hit/success 比率阈值（≥3 次 hit + 成功率<50%）→ 自动删除 |
| "反思修正" | LLM prompt（分析失败原因 → 重写 workflow）→ 原地替换，无版本历史 |
| "知识蒸馏" | In-context learning 提取（非模型蒸馏） |

### 对我们发言稿的影响

**Memp 的 reflect 模式有一个我们没提到的角度**：失败轨迹 → LLM 分析失败原因 → 修正 workflow → 替换旧版。这是一种原始的"知识更正"机制。

**但缺陷印证了我们的 Salience Ledger 论点**：
- 修正后的 workflow 直接原地替换旧版（无版本历史）
- 删除决定基于 hit/success 比率（启发式规则，无审计）
- 修正原因（LLM 的 `<Analysis>` 输出）没有持久化保存
- **如果 LLM 的修正是错的，无法回滚**

**对话策略**：把 Memp 定位为"佩戴协议的早期探索"——它试图让 agent 学会从失败中修正记忆，但缺 Salience Ledger 做审计。"张老师的 Memp 是我们看到的最接近佩戴协议的工作——如果加上修正原因的审计记录和回滚能力，就是 Salience Ledger 的核心。"

---

## 三项目对照：映射到我们的三层架构

| 我们的框架 | LightMem | G-Memory | MemP |
|---|---|---|---|
| **Layer 1: Memory Substrate** | ✅ Qdrant + JSON（可审计 plaintext） | ✅ Chroma + pickle + JSON | ✅ FAISS + JSON |
| **Layer 2: Reflex Injection** | ✅ 向量检索 + 可选 BM25 | ✅ k-hop 图遍历 + 向量检索 | ✅ 向量相似度检索 |
| **Layer 3: Wearing Protocol** | ❌ 无 | ⚠️ Insight rule lifecycle（粗暴 score） | ⚠️ reflect 模式（LLM 修正 workflow） |
| **Governance Plane** | ❌ 无 provenance/permission/audit | ⚠️ 有 score 但无 provenance/permission | ⚠️ 有 hit/success 但无 audit/rollback |
| **Multi-agent** | ❌ 单 agent | ⚠️ 共享单例（无一致性协议） | ❌ 单 agent |
| **Salience Ledger** | ❌ | ❌ | ❌ |

---

## 对发言稿的总体影响

### 我们的论点被验证的

1. **"前两层行业在卷"** ← LightMem（ICLR 2026）正是 Layer 1+2 的卷法
2. **"第三层还没有形成成熟方法论"** ← G-Memory 的 insight lifecycle 和 MemP 的 reflect 是早期探索，但都没有 audit/rollback
3. **"断裂点 2 多 agent 一致性"** ← G-Memory 声称做多 agent，代码是共享单例 + 顺序执行
4. **"Salience Ledger 是空白"** ← 三个项目都没有"为什么被写入/取出/压制"的记录

### 需要现场注意的措辞

| 发言稿原文 | 代码证据后的风险 | 建议调整 |
|---|---|---|
| "检索两年内门槛归零" | LightMem 117x 降幅说明检索效率仍是活跃研究 | 保持"门槛降低"，避免"归零" |
| "多 agent 记忆几乎未开垦" | G-Memory NeurIPS 2025 在做 | 改为"共享存储有了，分布式语义一致性未开垦" |
| "佩戴协议完全空白" | 已改成"还没有形成成熟方法论"✅ | 无需再改，但要知道 MemP reflect 模式是可引用的早期探索 |

### 现场可用的代码级 push back 武器

1. **对 LightMem**："offline_update 里 LLM 判断 delete/update——如果判错了怎么回滚？"
2. **对 G-Memory**："两个 agent 同时更新同一条 insight rule，谁赢？"
3. **对 MemP**："reflect 模式修正 workflow 后原地替换旧版——修正原因保存了吗？"

这三个问题的答案都是"没有"——**这就是 Governance Plane 的价值所在**。

---

## 嘉宾学术水平总结（基于源码深度）

| 嘉宾 | 项目 | 代码质量 | 创新度 | 工程成熟度 | 与我们 Topic 1 的对口度 |
|---|---|---|---|---|---|
| **张宁豫**（ZJU） | LightMem | ★★★★★ 工程优秀 | ★★★ pipeline 创新而非算法创新 | ★★★★ 可用 | ★★★★★ 最直接竞品 |
| **张桂彬**（NUS） | G-Memory | ★★★★ 结构清晰 | ★★★★ insight lifecycle 有意义 | ★★★ 学术原型 | ★★★★★ 多 agent 对口 |
| **张宁豫**（ZJU） | MemP | ★★★ 简洁 | ★★★ reflect 模式有价值 | ★★ 简单 | ★★★★ 佩戴协议相关 |
| **骆昱宇**（HKUST-GZ） | OpenManus | 未拆解（平台方向，非 memory） | — | ★★★★★ 50K stars | ★★★ 间接相关 |
| **陈旭**（RUC） | MemBench | 未拆解（评测方向） | — | — | ★★★★ 评测对口 |

[宪宪/Opus-46🐾]
