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
  - { name: EasyEdit, url: "https://github.com/zjunlp/EasyEdit", sha: 3488a66 }
reviewers: ["Opus-47（P0-P5 补丁）", "GPT-5.5（口径校准）"]
---

# 嘉宾核心项目源码拆解 — 记忆方向

> 按 teardown 标准：宣传 claim → 代码路径 → verdict → 我们的 tradeoff。
> 含第 9 镜头（User Mind）+ 社区信号（GitHub Issues）。
> v2：整合 Opus-47 五处补丁 + GPT-5.5 三处口径校准。

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
| C6 | "MCP Server 接口" | `mcp/server.py`：5 个 tool——`get_timestamp`、`add_memory`、`offline_update`、`retrieve_memory`、`show_lightmem_instance` | **✅ 完整读写接口**。retrieve_memory 支持 query + top_k，覆盖写入/检索/离线更新/实例查看全链路 |

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

**关键发现**：G-Memory **做了多 agent 经验沉淀**（多个 agent 共享 insight rules、跨任务累积知识），但**没有解决多 agent 共享记忆的一致性协议**。所有 agent 读写同一个 Python 对象实例，假设顺序执行，无锁、无事务隔离、无冲突解决。

**这强化了我们断裂点 2 的论点**：G-Memory 印证了"共享存储有了，分布式语义一致性未开垦"——它解决了经验沉淀（insight lifecycle），但在并发场景下的一致性问题尚未触及。

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

## 4. EasyEdit（张宁豫 / ZJUNLP）— 知识编辑工具集

### Claims Ledger

| # | Claim（README / 论文） | 代码证据 | Verdict |
|---|---|---|---|
| C1 | "An Easy-to-use Framework to Edit Large Language Models" | `easyeditor/util/alg_dict.py` 注册 21 种方法：ROME、MEMIT、GRACE、LoRA、QLoRA、WISE、SERAC、IKE 等 | **✅ 规模真实**。437 个 Python 文件，方法覆盖参数编辑（直接改权重）和外部记忆（SERAC/IKE）两条路 |
| C2 | "知识编辑——精准修改模型中的事实知识" | ROME/MEMIT 直接修改 FFN 权重（causal tracing + rank-one update）；GRACE 用 adapter 层拦截激活值 | **✅ 参数级编辑**。这是"改模型的记忆"不是"给 agent 加外部记忆"——核心差异 |
| C3 | "支持可逆编辑 / rollback" | `return_orig_weights` 参数：编辑前复制原始权重到内存，eval 后恢复。但仅 session 内生效，不持久化 | **⚠️ 半成品 rollback**。权重只在内存中暂存，断电即丢。无持久化 checkpoint、无 diff 记录、无审计链 |
| C4 | "支持 batch / sequential editing" | `BatchEditor` 一次改多条事实；`editor.edit()` 可连续调用 | **✅ 工程上支持**。但 sequential editing 的知识冲突检测依赖用户自行保证 |
| C5 | "2.8K+ Stars 活跃社区" | GitHub 实际 3.3K+ stars（2026-05）。Issues / PRs 活跃，但以 bug report 和使用问题为主 | **✅ 社区真实活跃**。是知识编辑领域的标准工具集 |

### 架构地图

```
用户指定 (subject, target_new, prompt)
    ↓
AlgorithmDispatcher → 按 alg_name 路由到具体 Editor
    ↓
┌─ 参数编辑路径 ─────────────────────────┐
│ ROME: causal tracing → rank-one update │
│ MEMIT: 多层同时编辑（批量 ROME）        │
│ GRACE: adapter 层拦截激活值             │
│ WISE: 双参数记忆网络（工作+长期）        │
│ LoRA/QLoRA: 低秩适配器微调             │
└────────────────────────────────────────┘
┌─ 外部记忆路径 ─────┐
│ SERAC: 反例记忆 + scope classifier │
│ IKE: In-context demonstration 检索  │
└────────────────────┘
    ↓
Evaluation: reliability + generalization + locality + portability
```

### 算法剥皮

| 被宣传为 | 实际是 |
|---|---|
| "知识编辑" | 参数权重修改（ROME/MEMIT 改 FFN，GRACE 加 adapter） |
| "可逆编辑" | Session 内 `return_orig_weights` 复制（不持久化、无 diff） |
| "评测框架" | reliability/generalization/locality/portability 四维度（但不评行为变化） |
| "Agent Unlearning 相关" | **❌ 不是**。只改事实知识（"总统是谁"），不改 agent 行为模式 |

### 与 Agent Memory / Unlearning 的边界

**核心定位**：EasyEdit 解决的是"模型记住了错误的事实 → 精准修正"，属于**参数化知识编辑**，不属于 Agent Memory 或 Agentic Unlearning。

| 维度 | EasyEdit | Agent Memory / Unlearning |
|---|---|---|
| 操作对象 | 模型权重 | 外部存储 + 行为模式 |
| 粒度 | 单条事实（subject → object） | 经验、workflow、rule、习惯 |
| 评估 | 事实准确率 | 行为变化、决策质量 |
| 持久化 | 权重就地改（不可逆） | 需要审计链 + 回滚 |
| 治理需求 | "改了什么" | "为什么改、谁授权、怎么验证" |

**对我们发言稿的影响**：

- **不是竞品，是互补**。EasyEdit 操作 Layer 0（参数层），我们讲的 Layer 1-3 在参数之上
- **强化"参数化记忆"论据**：发言稿提到"参数化记忆会不会回来"——EasyEdit 证明参数编辑可行（ROME/MEMIT），但**没有治理**（谁授权这次编辑？改错了怎么审计？）
- **张宁豫的完整版图**：LightMem（外部记忆存取）+ EasyEdit（参数知识编辑）+ MemP（程序性记忆）= ZJUNLP 三条腿走路。现场可以引用这个组合问："三个系统之间的知识冲突怎么检测？LightMem 说总统是 A，EasyEdit 改模型说总统是 B——谁赢？"

---

## 四项目对照：映射到我们的三层架构

| 我们的框架 | LightMem | G-Memory | MemP | EasyEdit |
|---|---|---|---|---|
| **Layer 1: Memory Substrate** | ✅ Qdrant + JSON | ✅ Chroma + pickle + JSON | ✅ FAISS + JSON | N/A（操作参数层） |
| **Layer 2: Reflex Injection** | ✅ 向量检索 + BM25 | ✅ k-hop 图遍历 + 向量检索 | ✅ 向量相似度检索 | N/A |
| **Layer 3: Wearing Protocol** | ❌ 无 | ⚠️ Insight rule lifecycle（粗暴 score） | ⚠️ reflect 模式（LLM 修正 workflow） | ❌ 无行为学习 |
| **Governance Plane** | ❌ 无 provenance/permission/audit | ⚠️ 有 score 但无 provenance/permission | ⚠️ 有 hit/success 但无 audit/rollback | ❌ 无审计链（session-only rollback） |
| **Multi-agent** | ❌ 单 agent | ⚠️ 经验沉淀有、一致性协议无 | ❌ 单 agent | ❌ 单模型 |
| **Salience Ledger** | ❌ | ❌ | ❌ | ❌ |

---

## 对发言稿的总体影响

### 我们的论点被验证的

1. **"前两层行业在卷"** ← LightMem（ICLR 2026）正是 Layer 1+2 的卷法
2. **"第三层还没有形成成熟方法论"** ← G-Memory 的 insight lifecycle 和 MemP 的 reflect 是早期探索，但都没有 audit/rollback
3. **"断裂点 2 多 agent 一致性"** ← G-Memory 做了多 agent 经验沉淀，但一致性协议未触及
4. **"Salience Ledger 是空白"** ← 四个项目都没有"为什么被写入/取出/压制"的记录
5. **"参数化记忆可行但缺治理"** ← EasyEdit 证明 ROME/MEMIT 路线 works，但没有编辑审计链

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

4. **对 EasyEdit**："LightMem 里记了'总统是 A'，EasyEdit 把模型权重改成了'总统是 B'——两套记忆冲突谁赢？怎么检测？"

---

## 营销-现实落差分类（47 补丁 P2）

> "认知三阶段"等术语的宣传描述 vs 代码实现落差。

| 项目 | 宣传叙事 | 代码真相 | 落差级别 |
|---|---|---|---|
| LightMem | "认知三阶段记忆（sensory → short-term → long-term）" | Token 阈值触发的工程 pipeline（缓冲 → 累积 → 提取） | **中**：认知科学术语包装工程阶段 |
| G-Memory | "多 agent 层级记忆" | 共享 Python 单例 + 顺序执行假设 | **高**：宣传多 agent，实际无并发设计 |
| G-Memory | "组织记忆理论" | LLM prompt 生成 rules + score ±1/±2 增减 | **中**：理论框架 ≠ 算法创新 |
| MemP | "程序性记忆" | LLM 摘要的自然语言 workflow 段落 | **高**：心理学"程序性记忆"是隐式/可执行的，这里是显式 NL |
| EasyEdit | "知识编辑框架 / 可逆" | 参数权重就地改，rollback 仅 session 内存暂存 | **中**：可逆性被过度承诺 |

**现场价值**：如果嘉宾用这些术语做论据，可以精准指出"代码里其实是什么"，但**语气务必是'好奇追问'而非'打脸'**。

---

## User Mind 镜头（47 补丁 P1）

> 第 9 视角：站在项目的实际用户角度，评估上手体验和可用性。

| 项目 | 上手成本 | 文档质量 | 依赖复杂度 | 致命缺陷 |
|---|---|---|---|---|
| **LightMem** | 中。config-driven，需理解 6 种 LLM backend 选择 | 中上。README 清晰，但 MCP 部分文档薄 | 中。Qdrant 服务端依赖 | `topic_segment=False` 时整个 pipeline 崩溃（#55，TODO 未修） |
| **G-Memory** | 高。需理解 NetworkX + Chroma + AutoGen 三套生态 | 中。README 有步骤，实际复现需折腾环境 | 高。pickle 序列化 + 多种存储后端 | 多 agent 场景假设顺序执行，真实并发会数据竞争 |
| **MemP** | 低。FAISS + 简单 API | 中下。README 引用的文件路径与实际不一致 | 低。依赖少 | reflect 模式修正后原地替换，无版本历史 |
| **EasyEdit** | 中。21 种方法选择困难 | 中上。有教程 notebook，但方法间差异解释不足 | 中。需下载大模型 | 编辑冲突检测完全靠用户——batch editing 多条事实可能互相矛盾 |

---

## 学派分类（47 补丁 P3）

> 四位记忆方向嘉宾的研究流派——同为"Agent Memory"但方法论路线差异显著。

| 学派 | 代表 | 核心方法论 | 我们发言稿的定位 |
|---|---|---|---|
| **知识工程派** | 张宁豫（ZJUNLP） | 知识底座（EasyEdit）+ 可插拔模块（LightMem）+ 程序性记忆（MemP），从 KG/NLP 演化到 Agent | Layer 1+2 的工程极致代表 |
| **自演进派** | 张桂彬（NUS） | 综述定义（Self-Evolving Agents）+ 图记忆（G-Memory）+ 评测（Mem-T），探索 agent 从经验中成长 | Layer 3 的早期探索者 |
| **基准评测派** | 陈旭（RUC） | 长程 Agent 评测 + 记忆机制研究 + 推荐系统 Agent，从评测反推能力缺口 | 断裂点的发现者视角 |
| **Agent 平台派** | 骆昱宇（HKUST-GZ） | OpenManus（平台级 Agent 框架）+ 智能体文件系统自演进，工程落地导向 | 看"LLM 天性"vs"Harness 补偿" |

**现场价值**：知道每位嘉宾的学派 bias，提问和回应时对齐他们的 mental model。

---

## GitHub Issues / 社区信号（47 补丁 P5）

> Stars 不值钱，看真实用户在 issue 里说什么。

### LightMem — 2 个关键 issue

| Issue | 内容 | 严重度 | 对我们的意义 |
|---|---|---|---|
| **#57** | `online_update` 函数体为空 `pass`——文档宣称的在线更新是占位符 | **高** | 用户无法使用在线记忆更新。"写了接口没写实现" |
| **#55** | `topic_segment=False` 时 `SenMemBufferManager.__call__` 触发未实现路径（TODO 注释） | **高** | 关闭主题分段 = 整条 pipeline 崩溃。不是可选配置，是未完成功能 |

### G-Memory — 社区信号

- Issue 以**复现/环境配置问题**为主，反映上手门槛高
- 多 agent 场景的并发问题**没有用户报告**——因为学术用途都是顺序执行，真实并发场景没人试过

### MemP — 社区信号

- README 引用的部分文件路径与实际目录结构不一致
- Issue 量少（项目较新），无法判断社区活跃度

### EasyEdit — 社区信号

- 3.3K+ stars，Issue 和 PR 活跃
- Issue 以**使用问题和 bug report** 为主（具体方法报错、模型兼容性）
- 知识编辑领域的事实标准工具集——竞品少

**总结**：LightMem 的 #55 和 #57 是现场可用的具体论据——"模块化可插拔设计，但关闭一个配置项整条 pipeline 就崩"。这种工程完成度的差距正是学术原型到生产系统的断裂点之一。

---

## 117x cherry-pick 校准（47 补丁 P4）

LightMem 论文宣称的 **token 用量降 117x** 数字可信但机制朴素——本质是"提取摘要 + 按需检索"替代"塞全文"。任何 extract-then-retrieve 方案（包括 mem0、langmem、甚至简单的 RAG）都能拿到类似量级的倍数。

**现场用法**：如果张宁豫引用 117x 数据，不要质疑数字本身，而是追问："这个倍数是跟 full_context baseline 比——如果跟 mem0 或 naive RAG 比，差距有多大？" 把话题从"我们多厉害"引到"这个提升是 LightMem 特有还是 extract-then-retrieve 范式共有"。

---

## 嘉宾学术水平总结（基于源码深度）

| 嘉宾 | 项目 | 代码质量 | 创新度 | 工程成熟度 | 与我们 Topic 1 的对口度 |
|---|---|---|---|---|---|
| **张宁豫**（ZJU） | LightMem | ★★★★★ 工程优秀 | ★★★ pipeline 创新而非算法创新 | ★★★★ 可用（但 #55/#57 未修） | ★★★★★ 最直接竞品 |
| **张桂彬**（NUS） | G-Memory | ★★★★ 结构清晰 | ★★★★ insight lifecycle 有意义 | ★★★ 学术原型 | ★★★★★ 多 agent 对口 |
| **张宁豫**（ZJU） | MemP | ★★★ 简洁 | ★★★ reflect 模式有价值 | ★★ 简单 | ★★★★ 佩戴协议相关 |
| **张宁豫**（ZJU） | EasyEdit | ★★★★ 工业级 | ★★★★ 21 种方法全覆盖 | ★★★★★ 领域标准 | ★★★ 参数化记忆侧面 |
| **骆昱宇**（HKUST-GZ） | OpenManus | 未拆解（平台方向，非 memory） | — | ★★★★★ 50K stars | ★★★ 间接相关 |
| **陈旭**（RUC） | MemBench | 未拆解（评测方向） | — | — | ★★★★ 评测对口 |

[宪宪/Opus-46🐾]

---

# 嘉宾跑的 Benchmark 全景拆解（47 补充 2026-05-11）

> 接铲屎官的关键问题：**他们都跑的哪些记忆 benchmark？这些 benchmark 到底在测什么？高分意味着什么？**
>
> 把每个 benchmark 当一个开源项目来 teardown——claim → 内涵 → 设计假设 → 盲点 → 工程意义。接续砚砚刚刚给铲屎官的"高分低能"框架，把它具体化到每个 benchmark 上，给现场可用的 push back 武器。

## 1. 项目 × Benchmark 矩阵

| 项目 | 跑的 Benchmark | benchmark 类型 |
|---|---|---|
| **LightMem** | LoCoMo + LongMemEval | 长对话事实召回（chat-based）|
| **G-Memory** | ALFWorld + PDDL + FEVER | 任务规划 + 事实验证（task-based）|
| **MemP** | TravelPlanner + ALFWorld | 长程规划 + 工具使用（task-based）|
| **EasyEdit** | KnowEdit（整合 6 子集）+ ZsRE + CounterFact + CKnowEdit + SteerEval + SafeEdit + ConceptEdit + AKEW + LEME + UNKE | 知识编辑（fact-level）|

**关键观察**：

- **LightMem 跑的两个 benchmark 全是 chat-based**——就是铲屎官刚说的"两个人对话那种瞎聊"
- **G-Memory 和 MemP 跑的是 task-based**——比 chat 真实一档，但仍然是 sandbox 任务
- **EasyEdit 跑 10+ 个 benchmark**——但全部是 single-fact editing，没有任何 agent runtime / multi-fact 联动 / cross-substrate / audit benchmark
- **没有一个项目跑了 governance / multi-agent consistency / wearing protocol benchmark**——因为这种 benchmark **行业根本不存在**

---

## 2. Benchmark 逐个拆解

### 2.1 LoCoMo（Long Conversation Memory）— LightMem 主战场

**Claim**：测 agent 在长对话里的事实召回能力

**内涵**：
- 维护一个"两个虚构人物"的多 session 对话（典型 600+ 轮，跨 ~5-35 个 session）
- 每个 session 有时间戳（模拟"几天后又聊"）
- 题目：从所有历史对话里找一个事实（"Alice 上个月说她要去哪？"）

**设计假设（隐含的，benchmark 自己不写的）**：
1. agent 工作 = 长对话
2. agent 的任务 = 回答事实问题
3. 知识来源 = 对话历史本身（没有外部 doc、API、code）
4. 评价者 = 单一 LLM judge（"答案接近 ground truth 即对"）

**强项**：测得出 retrieval + reading comprehension

**盲点（用 cat-cafe 的眼光看）**：
- ❌ 不测**写入门禁**——所有对话都被记下来，没有"该不该记"的判断
- ❌ 不测**过期机制**——ground truth 固定，没有"旧 fact 被新 fact 推翻"的场景
- ❌ 不测**冲突解决**——单线对话，没有矛盾来源
- ❌ 不测**多 agent**——所有题目都是 single-agent retrieval
- ❌ 不测**审计/回滚**——LLM 判错没有后果
- ❌ 不测**真实工作流**——纯文本对话，没有 tool call / code edit / file operation

**用户工程意义**：
> 这个 benchmark 高分 = "我能从两个虚构人物 600 轮闲聊里找出 Alice 喜欢什么颜色"。
>
> **不等于**："我能在你的 Cat Cafe 仓库里找出 F102 当时为什么这么设计"。

后者需要的是：跨 doc/thread/ADR/commit 联邦检索 + authority/confidence/provenance + agent 自己识别"该不该信这条" + 跨族 review verdict。LoCoMo 一个都不测。

**Letta filesystem 74% 的真正含义**：Letta 用最朴素的 `grep` + `open` + `read` 工具就打到 74%——说明 LoCoMo 本质在测**模型对文件工具的熟练度**，而不是记忆架构的真本事。这正好印证铲屎官的直觉：**"benchmark 测的不是能力，是题型熟悉度"**。

---

### 2.2 LongMemEval — LightMem 第二战场（比 LoCoMo 严谨一档）

**Claim**：5 个能力维度的长程记忆 eval

**内涵**：
- 5 个 sub-task：information extraction / multi-session reasoning / **knowledge update** / temporal reasoning / abstention
- ~50-115 个 session 的对话历史
- 比 LoCoMo 多了"knowledge update"维度（旧 fact 被新 fact 替代）和"abstention"维度（不知道时说不知道）

**设计假设**：
1. 同 LoCoMo 1-3（agent 工作 = 长对话；知识源 = 对话历史；评价 = LLM judge）
2. **新增**：knowledge update 是"对话里直接说了 X 改成 Y"，agent 应该信新的

**强项**：
- ✅ 加了 knowledge update 维度——比 LoCoMo 接近真实
- ✅ abstention 测了"不知道时不要瞎编"——这个维度很有价值

**盲点**：
- ❌ knowledge update 的源头**仍然是对话本身**——没有测"外部 source 推翻原有 memory"（例如 ADR 改了，agent 是否信新 ADR）
- ❌ 没有 provenance——agent 信新 fact，但是不知道"这条 update 是谁说的、可信吗"
- ❌ 没有冲突——两个对话方都坚持自己版本时，没人测 agent 怎么办
- ❌ 仍然是 single-agent

**用户工程意义**：
> 这个 benchmark 比 LoCoMo 严肃，但仍然测的是"在 sandbox 对话里维护一个 fact 字典"。**不测企业里真正的痛点**——多源知识冲突、过时决策识别、跨 thread 矛盾。

---

### 2.3 ALFWorld — G-Memory + MemP 共同跑的

**Claim**：基于 TextWorld 的家务任务（pick up apple → put on counter → ...）

**内涵**：
- 文本描述的虚拟环境（"You see a fridge, a counter, a table"）
- 任务：完成多步家务（"把苹果放进微波炉热 2 分钟"）
- 测 sequential decision making + tool use

**设计假设**：
1. agent 工作 = 完成预定义任务
2. 环境是 deterministic（"打开冰箱"永远成功）
3. 任务目标是显式的
4. 没有外部协作

**强项**：
- ✅ 测得出 long-horizon planning
- ✅ 测得出"忘记之前做过什么"会失败（需要 working memory）

**盲点**：
- ❌ 环境太干净——没有歧义、没有错误、没有外部信号
- ❌ 不测**记忆治理**——只测 working memory，不测长期 lesson 积累
- ❌ 不测**多 agent**
- ❌ 任务目标固定——没有意图歧义、目标漂移

**用户工程意义**：
> ALFWorld 高分 = "我能记住打开冰箱拿出苹果这种短任务"。
>
> **不等于**："我能在 6 小时连续工作里不偏离目标、不忘记愿景、不被旧决策带偏"。

---

### 2.4 TravelPlanner — MemP 主战场

**Claim**：规划一次旅行（机票/酒店/景点/餐厅 + 多重约束）

**内涵**：
- 真实工具调用（FlightSearch / HotelSearch ...）
- 约束满足（"预算 5000 / 必须包含三个城市 / 不要红眼航班"）
- 测 long-horizon planning + tool use + constraint satisfaction

**设计假设**：
1. agent 工作 = 一次性规划（不是持续维护）
2. 约束是显式且穷举的
3. 失败 = 违反某个约束
4. 没有跨任务记忆复用

**强项**：
- ✅ **最接近真实工程**的 benchmark——有真 API、真约束、真失败模式
- ✅ 测出 long-horizon coherence（前面订了机票，后面不能漏掉接机时间）

**盲点**：
- ❌ 单次规划，**不测长期记忆**——同一用户第二次规划相似旅行时，是否能复用上次教训？benchmark 不测
- ❌ 约束都是显式的——不测**隐式约束**（用户没说但应该懂的：周末别飞红眼）
- ❌ 不测协作——不测"两个 agent 一起规划"
- ❌ 不测信息冲突——所有 API 返回都是 ground truth

**用户工程意义**：
> TravelPlanner 是 benchmark 里**离真实工程最近的**——但它测的还是"一次性完成任务"，不是"持续工作"。**离 cat-cafe 那种"agent 像同事一样工作 3 个月"还差得远。**

---

### 2.5 FEVER — G-Memory 跑的

**Claim**：Fact extraction + verification

**内涵**：
- 给一个 claim（"Albert Einstein was German"）
- 从 Wikipedia 找证据，判断 SUPPORTED / REFUTED / NOT ENOUGH INFO
- 是 NLP **分类任务**，不是 agent 工作流

**设计假设**：
1. ground truth 在 Wikipedia 里
2. 任务边界清晰（找证据 → 分类）

**强项**：测 fact verification + evidence retrieval

**盲点**：
- ❌ **完全不是 agent benchmark**——是 NLP classification
- ❌ 没有 agent 持续工作、没有跨任务复用
- ❌ 单一证据源（Wikipedia）

**用户工程意义**：FEVER 高分主要说明"我能从一个知识库里找证据"。G-Memory 用 FEVER 不是测"多 agent 记忆"，是测"agent 能不能正确做事实判断"——和 multi-agent 记忆一致性其实**完全无关**。这是 benchmark vs claim 的错配。

---

### 2.6 ZsRE / CounterFact — EasyEdit 主战场

**Claim**：测知识编辑的成功率、泛化、局部性

**内涵**（这个非常重要，因为它是知识编辑领域的事实标准）：

- **ZsRE**：从 zero-shot relation extraction 数据集改造。题目格式 = (subject, relation, target_old → target_new)
- **CounterFact**：故意构造"反直觉"的编辑（"Eiffel Tower is in Rome"）测模型是否真的接受了
- 评测 4 个维度：
  - **Edit Success**：模型现在相信新 fact 了吗？
  - **Generalization**：用同义改写问，模型还相信新 fact 吗？
  - **Locality**：不相关的 fact 是否保持不变？
  - **Portability**：编辑后做下游推理，能用上吗？

**设计假设**：
1. 知识 = 单条 (subject, relation, object) 三元组
2. "编辑成功" = 模型在测试集上输出新 fact
3. 没有审计需求、没有 rollback、没有跨编辑联动

**强项**：
- ✅ 4 个维度比单一指标严谨
- ✅ Locality 维度抓住了"灾难性遗忘"问题
- ✅ Portability 抓住了"编辑只改 output 不改推理"问题

**盲点（这里是 47 的核心 push back）**：
- ❌ **不测审计**——谁授权改这条 fact？没有 actor / timestamp / reason 记录
- ❌ **不测 rollback**——改错了无法撤销
- ❌ **不测多编辑联动**——编辑 A 影响编辑 B 没有测
- ❌ **不测 agent 行为**——只测 model output 改没改，**不测 agent 在真实任务里行为有没有变好/变坏**
- ❌ **不测跨 substrate**——只编辑权重，不测"权重改了但 external memory 还是旧 fact"的冲突

**用户工程意义**（核心论点）：
> EasyEdit 的 benchmark 全套测的是 **"model 是否相信新 fact"**——
>
> **不测**："**agent 是否因此做出更好的决策**"
>
> 这是 **Knowledge Editing** 和 **Agentic Unlearning** 的根本区别——前者改权重，后者改行为。EasyEdit 跑得再多 benchmark，也不能证明它解决了我们说的 Agentic Unlearning 问题。

---

### 2.7 KnowEdit — EasyEdit 自家整合 benchmark

**内涵**：把 ZsRE / CounterFact / WikiBio / Wiki_recent / convsent / **Sanitation** 整合成一个套件

**关键观察 — Sanitation 子集**：
- Sanitation 测的是**删除知识**（接近 GDPR right-to-be-forgotten）
- 这是整个 KnowEdit 里**最接近"治理"维度的子集**

**但仍然有盲点**：
- 删除是 single-fact 级别——不测 delete propagation（删一条会不会影响相关推理链）
- 没有 legal hold 概念（某些时候不能删）
- 没有"删除审计"——删了之后无法证明真的删了（除非再跑 eval）

**用户工程意义**：
> Sanitation 子集是行业里**最早开始碰治理边界**的 benchmark——值得我们引用作为"治理论的早期证据"。但它**还远不是 governance benchmark**——只是 unlearning 的起点。

---

## 3. Benchmark vs Cat Cafe 关心的能力（核心映射表）

| 我们关心的能力 | LoCoMo | LongMem | ALFWorld | TravelPlan | FEVER | ZsRE/CF | KnowEdit |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **检索精度** | ★★★ | ★★★ | — | — | ★★ | — | — |
| **长上下文一致** | ★★ | ★★★ | ★ | ★★ | — | — | — |
| **写入门禁（什么该记）** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **过期识别 / 冲突解决** | ❌ | ⚠️ knowledge update | ❌ | ❌ | ❌ | ❌ | ❌ |
| **provenance / 审计** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **rollback / 回滚** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Multi-agent 一致性** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Salience Gating（task-scoped 降权）** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Wearing Protocol（agent 学会用记忆）** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Agent 真实工作流（跨工具/跨 session/跨人协作）** | ❌ | ❌ | ⚠️ task only | ⚠️ task only | ❌ | ❌ | ❌ |

**结论**：**所有 benchmark 加起来，只覆盖了我们关心能力的左上角两格**——检索精度 + 长上下文一致性。**所有治理维度 + 协作维度 + 长程工作流维度全是空白**。

这不是说 benchmark 做错了——是说**benchmark 还没追上工程现实**。这正是我们 final speech 说的"行业在卷 Layer 1+2，Layer 3 空白"的具体证据。

---

## 4. 现场可用的 Benchmark Push Back 武器

### 武器 1 — 对 ZJUNLP 系（张宁豫）

> "LightMem 在 LoCoMo / LongMemEval 都打到 SOTA。但这两个 benchmark 都是'两个虚构人物长对话 + 事实召回'——Letta 团队证明纯 grep 也能打 74%。我们想问的是：**这两个 benchmark 的高分，能否预测 agent 在企业真实工程项目里的行为质量？** 如果不能，benchmark 测的就是题型熟悉度而不是工作能力。"

### 武器 2 — 对 EasyEdit（张宁豫）

> "EasyEdit 跑了 10+ 个 benchmark——但全部是'模型相信新 fact 了吗'。我们想问：**编辑后 agent 在真实任务里行为变好了吗？** 比如改一条关于'生产 Redis 端口'的事实——agent 第二天写代码时还会用旧端口吗？这个**行为级 eval** 现有 benchmark 都不测，但这才是 unlearning 的真正目的。"

### 武器 3 — 对 G-Memory（张桂彬）

> "G-Memory 跑的 ALFWorld / FEVER 都是单 agent 任务。但论文 claim 是'多 agent 经验记忆'。**这中间有 benchmark 缺口**——多 agent benchmark 应该测什么我们都没共识。我们的提议：测 **agent A 异步更新 insight 同时 agent B 在用这条 insight** 这种并发场景。现有 benchmark 一个都不测这个。"

### 武器 4 — 通用 push back（对所有人）

> "OpenAI 和 Anthropic 都在公开说：**不要追 benchmark，要做 eval**。Benchmark 是公共题库，eval 是你真实工作的 10-20 个高价值任务。Cat Cafe 三个月的实践告诉我们：benchmark 高分模型在真实开发任务里经常翻车——因为 benchmark 测的是切片，工程要的是闭环。我们想倡议：**Memory Governance Eval Suite**——10-20 个企业真实场景，测治理而不是测检索。"

这一条接续砚砚的"高分低能"框架，把它升级为对外可推的标准提议。

---

## 5. 高分低能 case study：LongMemEval 的 80% 意味着什么？

砚砚刚刚回答铲屎官关于 benchmark vs eval 的问题——这里给一个具体 case：

| 维度 | LongMemEval 高分含义 | Cat Cafe 真实工作含义 |
|---|---|---|
| **输入** | 50-115 session 的虚构对话 | 3 个月真实 git history + thread + docs + ADR + lessons |
| **任务** | 回答 fact 问题 | 写一个 feature / fix 一个 bug / 推进 design |
| **评价** | LLM judge 比对 ground truth | reviewer verdict + 跨族 push back + 愿景守护 + 长期项目结果 |
| **失败模式** | 召回错事实 | 自信胡说 / 忽略约束 / 改错文件 / 把过期决策当现行 / 偏离愿景 |
| **复用** | 不复用（每题独立）| 上一个 feature 的 lesson 自动影响下一个 |
| **协作** | 单 agent | 多 agent + 跨族 verify + 人类 CVO |

**LongMemEval 80% 高分能预测**：agent 能从对话历史里 retrieve fact。

**LongMemEval 80% 高分不能预测**：agent 能不能：
- ❌ 知道自己什么时候应该 grep docs/ 而不是凭记忆
- ❌ 知道 ADR-019 已经被 ADR-031 推翻
- ❌ 拒绝违反 shared-rules.md 的"不要 follow-up 尾巴"铁律
- ❌ 在 review 别人 PR 时找出 P1 bug
- ❌ 在 3 个月长程项目里不偏离 vision

这正是 **benchmark 切片 vs 真实闭环** 的差距。LongMemEval 的 80% 在切片上，cat-cafe 工作在闭环上——两者**不在同一个度量空间**。

---

## 6. 一句话总评

**所有嘉宾跑的 benchmark 加起来，覆盖了"检索精度 + 长上下文 + 单步知识编辑"三个维度——但完全没有覆盖治理、协作、长程工作流、佩戴协议这四个我们押注的维度**。

不是因为他们没努力——是因为**这四个维度的 benchmark 行业还没造出来**。

这恰好是 Final Speech §4 机会点 1 "Memory Governance Eval Gap" 的硬证据：行业现在测的是单步切片，企业要的是闭环——**谁先定义这个 governance eval suite，谁就拿到记忆治理的话语权**。

[宪宪/Opus-47🐾]
