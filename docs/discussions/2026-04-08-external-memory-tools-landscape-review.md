---
feature_ids: [F102]
topics: [memory, knowledge-graph, retrieval, architecture, competitive-analysis]
doc_kind: discussion
created: 2026-04-08
participants: [opus, gpt52, gemini]
thread_id: thread_mnoltzx6fdik0s4m
---

# 外部记忆工具横评 — Graphify / GitNexus / MemPalace vs F102

**Thread ID**: `thread_mnoltzx6fdik0s4m` | **日期**: 2026-04-08 | **参与者**: 布偶猫(opus), 缅因猫(gpt52), 暹罗猫(gemini)

## 背景

铲屎官注意到近期 GitHub 上出现了多个高星标记忆/知识图谱工具，要求三猫对比调研。本文档整合三猫的源码级审计结论，提炼可落地的增强点。

| 仓库 | 星标 | 创建时间 | License | 定位 |
|------|------|---------|---------|------|
| [safishamsi/graphify](https://github.com/safishamsi/graphify) | 4.5k | 2026-04-03 | MIT | 多模态语料 → 知识图谱 → 导航视图 |
| [abhigyanpatwari/GitNexus](https://github.com/abhigyanpatwari/GitNexus) | 22.6k | — | PolyForm NC | 代码 → AST 图 → 精准查询 |
| [milla-jovovich/mempalace](https://github.com/milla-jovovich/mempalace) | 21k | 2026-04-05 | MIT | 对话原文 → ChromaDB → 语义召回 |

## 一、各工具核心能力实锤

### 1.1 Graphify — 多模态结构发现

**核心管线**：tree-sitter AST（Pass A，确定性）+ Claude subagent 语义提取（Pass B，LLM）→ NetworkX 图 → Leiden 社区检测 → 交互式 HTML/GRAPH_REPORT.md

**真实能力**：
- 19 种语言 AST 解析，零 LLM 成本
- EXTRACTED/INFERRED/AMBIGUOUS 置信度三级 + 数值分数（0.0-1.0）
- Leiden 社区检测（纯图拓扑，不依赖 embedding）
- 多因子 surprise scoring 发现跨域隐含关联
- 多模态输入（代码 + 文档 + PDF + 图片 + URL）
- SHA256 缓存 + git hooks + watch mode 增量更新

**局限**：
- 查询时无语义搜索（关键词子串匹配 → 图遍历）
- Hyperedges 是 sidecar 数据，MCP 查询不遍历
- 无对话记忆、无知识审批、无多 agent 协作
- LLM 语义 pass 成本不可忽略

### 1.2 GitNexus — 代码结构分析

**核心管线**：tree-sitter AST → 静态分析（import/调用链/继承）→ Leiden 聚类 → BM25 索引 → 可选 embedding

**真实能力**：
- **零 LLM** 纯确定性建图（18.5 秒 / 40w+ 行代码）
- 11 个 MCP 工具（context 360° 视图、impact 爆炸半径、rename dry-run、route_map、shape_check）
- 支持外部 HTTP embedding（已验证对接 Qwen3-Embedding）

**局限**：
- 只吃代码，不处理文档/图片
- impact 分析偏浅（只找直接依赖，间接影响链不足）
- 中文语义搜索不稳定
- PolyForm Noncommercial 许可

**当前状态**：已完成 PoC，使用指南在 `docs/research/2026-04-06-gitnexus-poc-usage-guide.md`，等待铲屎官安排实际试用打分。

### 1.3 MemPalace — 对话保真记忆

**核心管线**：对话/文件 → 800 字符切片 → ChromaDB（wing/room metadata）→ `collection.query()` 语义召回

**真实能力**：
- 时序知识图谱（`knowledge_graph.py`）：SQLite 三元组 + `valid_from`/`valid_to` + `as_of` 时间点查询 + 事实失效标记
- 实体检测（`entity_detector.py`）：双 pass + 多信号类别交叉验证 + Wikipedia fallback
- 层级上下文预算（`layers.py`）：L0 身份 ~50 token + L1 关键事实 ~120 token + L2 按需 + L3 深搜
- 挖矿管线（`miner.py`）：完整 .gitignore 解析、Q&A 成对切片

**营销 vs 实质**：
- **96.6% LongMemEval 标题是误导** — benchmark 脚本（`longmemeval_bench.py`）的 "raw" 模式零行代码 import mempalace，只用了临时 ChromaDB collection。当 palace 特性真正被测时：rooms -7 分、AAAK -12 分
- **AAAK "压缩"** — 代码自注 "NOT lossless compression"，实际是 regex/词频/关键句/情绪关键词查表的启发式摘要
- **palace 搜索** — `searcher.py` 就是 `collection.query()` + wing/room metadata filter，ChromaDB 开箱即用能力
- **"+34% palace boost"** — README 已自行更正：本质是标准 ChromaDB metadata filtering

## 二、与 F102 记忆组件对比矩阵

| 维度 | F102 | Graphify | GitNexus | MemPalace |
|------|------|----------|----------|-----------|
| **检索模式** | BM25 + 向量 NN + RRF 三路融合 | 关键词 → 图遍历 | BM25 + 可选 embedding | ChromaDB `.query()` 单路 |
| **知识治理** | 5 状态 marker pipeline | 无 | 无 | 无 |
| **时序建模** | ❌ edges 无时间维度 | ❌ | ❌ | ✅ `valid_from`/`valid_to` |
| **置信度标记** | ❌ edges 无置信度 | ✅ 三级 + 数值分数 | ❌（全确定性） | ✅ confidence 字段 |
| **代码理解** | ❌（靠 Grep/LSP） | ✅ 19 语言 AST | ✅ AST + 调用链 | ❌ |
| **多模态** | ❌（Markdown only） | ✅ 代码+文档+PDF+图片 | ❌（代码 only） | ❌（文本 only） |
| **Session 追踪** | ✅ per-cat chain + digest | ❌ | ❌ | ❌ |
| **摘要压缩** | ✅ LSM 三层（Opus abstractive） | ❌ | ❌ | AAAK（负收益） |
| **可视化** | ❌ | ✅ HTML + SVG + Wiki | ❌（有 Cypher 导出） | ❌ |
| **降级策略** | ✅ embedding → lexical fallback | ❌（>50% 失败中止） | ❌ | ❌ |
| **多 Agent** | ✅ per-cat session + federated | ❌ | ❌ | ❌ |
| **上下文预算** | 隐式（SystemPromptBuilder） | ❌ | ❌ | ✅ L0-L3 分层 |

## 三、值得落地的增强点

三猫一致认同可吸收的能力，按 ROI 排序：

### E1: edges 表增加时序 + 置信度（来源：MemPalace KG + Graphify）

**现状**：`edges(from_anchor, to_anchor, relation)` — 无时间维度、无置信度。

**风险先澄清**：现有主键 `PRIMARY KEY (from_anchor, to_anchor, relation)` 只能表达“一条当前关系”，不能表达同一关系多次失效/恢复的历史。

**增强方案（分两阶段）**：
**Phase A（V10，先拿到 80% 价值）**：
```sql
ALTER TABLE edges ADD COLUMN confidence TEXT NOT NULL DEFAULT 'extracted';
  -- 'extracted' (从 frontmatter 解析) / 'inferred' (语义推断) / 'ambiguous'
ALTER TABLE edges ADD COLUMN confidence_score REAL NOT NULL DEFAULT 1.0;
  -- 0.0-1.0, extracted=1.0
ALTER TABLE edges ADD COLUMN valid_from TEXT NOT NULL DEFAULT (datetime('now'));
  -- ISO8601, 当前关系生效时间
ALTER TABLE edges ADD COLUMN valid_to TEXT;
  -- ISO8601, 当前关系失效时间 (NULL=仍有效)
ALTER TABLE edges ADD COLUMN source TEXT NOT NULL DEFAULT 'indexer';
  -- 谁创建的 (indexer/summarizer/manual)

CREATE INDEX IF NOT EXISTS idx_edges_from_relation_active
  ON edges(from_anchor, relation, valid_to);
CREATE INDEX IF NOT EXISTS idx_edges_to_relation_active
  ON edges(to_anchor, relation, valid_to);
```

**Phase B（V11，可选）**：如果后续确认需要完整历史（同一关系多次开关），新增 `edge_events` 事件表，避免在现有主键下硬塞多版本关系。

**价值**：
- "这个 ADR 什么时候被推翻的" → `valid_to IS NOT NULL`
- "这个关联是明确引用还是猜的" → `confidence` 过滤
- superseded 处理从 `evidence_docs.superseded_by` 下沉到 edges 级别

**实施复杂度**：中。除 schema migration V10 外，还要同步改 `Edge` 类型、`SqliteEvidenceStore.addEdge/getRelated` 返回结构、以及 `IndexBuilder` 的边提取逻辑（当前在 `build()` 中内联，而不是 `generateEdges()` 独立函数）。

### E2: 知识导航报告（来源：Graphify GRAPH_REPORT.md）

**现状**：evidence.sqlite 只有 API 接口，无全局鸟瞰视图。

**增强方案**：定期（或按需）生成知识导航报告，类似 GRAPH_REPORT.md，包含：
- **核心节点**（degree 最高的 evidence_docs，即被引用最多的 feature/ADR）
- **跨域关联**（edges 跨 kind 的连接，如 feature↔decision↔lesson）
- **知识盲区**（有 feature 引用但无 ADR 支撑的区域）
- **建议问题**（基于图结构生成的值得深入的问题）

**交付形态**：Rich Block（card 形式）投递到 Knowledge Feed，不需要力导向图交互。

**实施复杂度**：中。需要遍历 edges 表 + evidence_docs 统计 degree，生成 Markdown，通过 `create_rich_block` 投递。

### E3: 上下文预算显式化（来源：MemPalace layers.py）

**现状**：SystemPromptBuilder 隐式管理上下文，但没有 L0/L1/L2/L3 的显式分层。

**增强方案**：
- **L0**（~100 token）：猫猫身份 + 铁律 — 永远注入
- **L1**（~200 token）：当前 thread 的 topic + 最近 3 条 summary_segments — session 启动时注入
- **L2**（按需）：search_evidence 召回 — 猫猫主动搜索时
- **L3**（按需）：raw passages + context window — 深入追溯时

**价值**：让上下文预算在代码中可审计，而不是隐藏在 SystemPromptBuilder 的拼接逻辑里。

**实施复杂度**：中。除 SystemPromptBuilder 外，还需要同步 `assembleIncrementalContext`（warm/cold path）、route serial/parallel 两条路由预算扣减逻辑，以及回归测试。

### E4: GitNexus trial 继续推进

**现状**：PoC 完成，使用指南已写好，等铲屎官安排试用。

**行动**：铲屎官在下次 debugging/feature session 中 link 使用指南给猫猫，积累 5+ 次打分后决定是否正式集成。

**实施复杂度**：零（已就绪）。

### E5: Graphify 轻量 spike（可选，优先级低）

**方案**：在 `docs/` 目录上跑一次 `graphify .`，看 GRAPH_REPORT.md 对我们项目知识的产出质量。如果有价值，考虑定期生成。

**安全前提**：Graphify 的 LLM pass 会把语料送到外部模型；只能在公开或已脱敏语料上跑。默认不对含内部敏感信息的 `docs/` 全量执行，除非铲屎官明确授权。

**实施复杂度**：低（一次性命令），但有合规前置条件 + LLM token 成本评估。

## 四、不学的（三猫一致否决）

| 不学什么 | 来源 | 原因 |
|----------|------|------|
| Q&A 自回流到正式记忆 | Graphify `save_query_result()` / MemPalace drawers | 自污染风险。我们有 marker pipeline 做审批门禁，不允许绕过 |
| AAAK "压缩" | MemPalace | 有损启发式，自己基准上 -12 分。我们的 LSM 三层 Opus abstractive 是正收益 |
| 替换 F102 为图优先系统 | Graphify | F102 的价值在真相源治理 + 审计链 + 晋升链，图是探索层不是基座 |
| ChromaDB 替代 SQLite FTS5 | MemPalace | ChromaDB 只有语义搜索没有 BM25，我们的三路融合更强。SQLite FTS5 十年 battle-tested |
| 把 palace 叙事搬进来 | MemPalace | 我们已有 kind/scope/threadId 查询维度，比 wing/room/hall 更精确 |

## 五、关于 GitHub 星标的观察

铲屎官说得对 — **星标是 attention index，不是 quality index**。

| 仓库 | 星标 | 创建天数 | 星/天 | 实质评级 |
|------|------|---------|-------|---------|
| GitNexus | 22.6k | ~数月 | — | 实质最高（纯确定性 AST，零噱头） |
| MemPalace | 21k | 3 天 | ~7k | 营销 > 实质（标题基准不用自己系统） |
| Graphify | 4.5k | 4 天 | ~1.1k | 实质中等（AST 强，LLM pass 真实，查询弱） |

更可靠的信号：
- claim 和代码是否对得上
- 出了问题后是否快速更正（MemPalace 的 April 7 勘误加分）
- benchmark 是否可复现、是否测的是自己的系统
- issue/PR 是否在收敛
- 核心实现是系统设计还是一层 wrapper

## 六、结论

**F102 在检索能力、知识治理、多 Agent 协作三个维度上仍然是最强的。** 外部工具各有亮点但都不构成替代。

可落地增强排序：E1（edges 时序+置信度）> E2（导航报告）> E3（上下文预算显式化）> E4（GitNexus trial 继续）> E5（Graphify spike）。

E1 和 E3 实施复杂度低、ROI 高，建议优先推进。

---

*[宪宪/Opus-46🐾] 初稿 | 待 @codex review 完善*
