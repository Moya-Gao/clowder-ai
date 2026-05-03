---
doc_kind: research-note
topics: [pageindex, open-source-teardown, RAG, vectorless, library-architecture]
created: 2026-05-03
status: draft
source_repo: https://github.com/VectifyAI/PageIndex
source_commit: a51d97f63cedbf1d36b1121ff47386ea4e088ff5
authored_by: opus
covers: [architecture, star-features, algorithms, comparison, community-signals]
---

# PageIndex Deep Dive

## 0. Scope

- **User question**: 铲屎官：在图书馆架构立项前，再参考 PageIndex 项目，用拆解 skill 扒拉一下看看有没有可以学习的
- **Project**: VectifyAI/PageIndex — "Vectorless, Reasoning-based RAG"
- **Source repo**: https://github.com/VectifyAI/PageIndex
- **Local path**: `/Users/lysander/projects/ref/pageindex`
- **Commit**: `a51d97f` (Add security CI workflows #248)
- **Stats**: 26K⭐ / 2.2K forks / MIT / ~77 open issues (snapshot 2026-05-03, API 含 PR 报 136) / created 2025-04-01
- **Codebase**: ~2,700 LOC Python（6 个核心文件）
- **Claims to verify**: Vectorless / No Chunking / Human-like Retrieval / 98.7% FinanceBench / AlphaGo-inspired tree search

## 1. Claim Ledger

| # | Claim | Source wording | Evidence paths | Verdict | Caveat |
|---|-------|----------------|----------------|---------|--------|
| C1 | 无向量 | "No Vector DB" | 全仓无 embedding/vector 相关代码，`requirements.txt` 无向量库 | ✅ 属实 | 用 LLM token 换 vector 存储——索引成本从存储转移到 LLM API 调用 |
| C2 | 不分块 | "No Chunking: Documents are organized into natural sections" | `page_index.py:426-459` page_list_to_group_text 按页分组（非语义 chunk），树节点保留 start_index/end_index 页码 | ⚠️ 部分属实 | PDF 保留页面边界（无任意 chunk），但分组时仍按 max_tokens=20000 切割。"No chunking" 是相对 vector RAG 的 claim，不是零切割 |
| C3 | 类人检索 | "Human-like Retrieval: simulates how human experts navigate" | `examples/agentic_vectorless_rag_demo.py` — agent 拿到树结构 → 推理选节 → 取页面内容 | ✅ 属实 | 但这是 demo 代码（~130 行），不是生产级检索引擎。树搜索逻辑完全依赖外部 LLM agent |
| C4 | 98.7% FinanceBench | "state-of-the-art 98.7% accuracy" | 结果在独立仓 `VectifyAI/Mafin2.5-FinanceBench`，用的是 Mafin 2.5 系统（PageIndex + 闭源推理链） | ⚠️ 有条件 | Mafin 2.5 不等于本仓开源代码。benchmark 用的是完整商业系统，**不可从 PageIndex 本仓端到端复现**——Mafin2.5-FinanceBench 仓公开了结果 JSON 和 evaluator，但未开源 Mafin 2.5 检索系统本体 |
| C5 | AlphaGo 启发 | "Inspired by AlphaGo" — tree search | **开源代码**无 MCTS/UCB/rollout。但 `examples/tutorials/tree-search/README.md` 声称商业 dashboard/API 使用 "LLM tree search + value function-based MCTS" | ⚠️ 分层 | 开源仓 = 纯 LLM prompt 树搜索，无 AlphaGo 核心算法。**商业 API 声称有 MCTS，但未开源，当前不可验证** |
| C6 | Markdown 支持 | "--md_path flag" | `page_index_md.py:243-300` md_to_tree 用 # 标题层级构建树。不用 LLM 提取结构 | ✅ 属实 | MD 模式靠 heading 层级，不靠 LLM。如果 MD 无 heading 结构，退化为单节点 |
| C7 | 开源 | MIT license, 26K stars | 索引生成完整开源。**检索/树搜索未开源**——仅一个 130 行 demo + 商业 API/MCP | ⚠️ 半开源 | 社区批评 "假开源"（issue #102）："确实假开源，一上来就要 apikey" |

## 2. Architecture Map

```
run_pageindex.py (CLI entrypoint)
  └─ pageindex/
       ├─ __init__.py          (4 LOC, re-exports)
       ├─ client.py            (234 LOC) — PageIndexClient: index() + workspace persistence
       ├─ page_index.py        (1153 LOC) — ⭐ 核心：PDF → 层级树
       │    ├─ get_page_tokens()         — PyMuPDF/PyPDF2 提取页面文本
       │    ├─ check_toc()               — LLM 检测前 20 页是否有 TOC
       │    ├─ generate_toc_init/continue — LLM 从文本提取层级结构
       │    ├─ toc_index_extractor()     — 将结构映射到物理页码
       │    ├─ fix_incorrect_toc()       — 并发验证+修复标题位置
       │    ├─ process_large_node_recursively() — 递归细分大节点
       │    └─ page_index_main()         — 主管道入口
       ├─ page_index_md.py     (341 LOC) — Markdown → 树（用 heading 层级，非 LLM）
       ├─ retrieve.py          (137 LOC) — 3 个 tool 函数（get_document/structure/page_content）
       └─ utils.py             (710 LOC) — LLM 调用（LiteLLM）、token 计数、JSON 提取、日志

examples/
  └─ agentic_vectorless_rag_demo.py (189 LOC) — OpenAI Agents SDK 树搜索 demo

config: pageindex/config.yaml — model: gpt-4o, retrieve_model: gpt-5.4
```

### State Stores

| Store | Type | 位置 |
|-------|------|------|
| 树结构 JSON | 文件 | `./results/{name}_structure.json` 或 workspace `*.json` |
| 文档元数据 | 文件 | workspace `_meta.json` |
| 页面文本缓存 | 内存 → JSON | client 索引时提取，存入 workspace JSON |

### Extension Points

| 点 | 机制 |
|----|------|
| LLM provider | LiteLLM（多 provider 支持） |
| 文件格式 | PDF / Markdown（硬编码，无 plugin） |
| 树搜索 agent | 用户自带 agent 框架（demo 用 OpenAI Agents SDK） |

### Empty / Placeholder

| 项 | 说明 |
|----|------|
| 检索引擎 | **不存在**。retrieve.py 只是数据访问层（读 JSON），无搜索逻辑 |
| 多文档路由 | **core library 无内置路由**。每次查询针对单个 doc_id。但官方提供了外置教程方案（`examples/tutorials/doc-search/`）：metadata 筛选 / semantics 语义匹配 / description 轻量描述三种跨文档选择工作流 |
| 评估/benchmark | 不在本仓，在独立仓 Mafin2.5-FinanceBench |

## 3. Star Feature Deep Dives

### 3.1 PDF → 层级树索引（核心管道）

- **Public API**: `page_index(doc, model=...)` / `page_index_main(doc, opt)`
- **Core modules**: `page_index.py` 全文件
- **链路**:
  ```
  PDF → get_page_tokens() [PyMuPDF] → page_list [(text, token_count)]
    → check_toc() [LLM: 前20页检测是否有目录]
    → 分支A: 有TOC → extract TOC → map to physical pages → verify
    → 分支B: 无TOC → page_list_to_group_text() [按 20K token 分组]
       → 每组加 <physical_index_X> 标签
       → generate_toc_init/continue() [LLM: 从文本提取层级结构]
       → toc_index_extractor() [LLM: 映射标题→物理页码]
    → check_title_appearance_in_start() [LLM: 并发验证每个标题确实在声称的页面]
    → fix_incorrect_toc() [LLM: 修复验证失败的项，最多 3 轮]
    → post_processing() → 扁平列表转嵌套树
    → process_large_node_recursively() [递归: 节点>10页且>20K token → 子文档再跑一遍]
    → 可选: generate_summaries_for_structure() [LLM: 每节点生成摘要]
    → 可选: generate_doc_description() [LLM: 全文档描述]
  ```
- **State mutation**: 输出 JSON 文件（树结构 + 页码映射 + 摘要）
- **LLM 调用次数**: 一篇 100 页 PDF 估计 10-30 次 LLM 调用（分组数 × (提取+验证+修复) + 递归 + 摘要）
- **Tests**: **无测试**。全仓 0 个 test 文件
- **Verdict**: 索引质量依赖 LLM 能力。无 eval 管道验证索引正确性。递归细分是亮点

### 3.2 Markdown → 树索引

- **Public API**: `md_to_tree(md_path, ...)`
- **Core modules**: `page_index_md.py`
- **链路**:
  ```
  MD → extract_nodes_from_markdown() [正则: 按 # 层级提取标题]
    → extract_node_text_content() [每个标题到下个标题间的文本]
    → 可选: tree_thinning [合并小于阈值 token 的子节点到父节点]
    → build_tree_from_nodes() [用栈按层级构建嵌套树]
    → 可选: generate_summaries_for_structure_md() [LLM 摘要]
  ```
- **关键区别**: MD 模式**不用 LLM 提取结构**，直接用 heading 层级。只在摘要生成时调 LLM
- **Verdict**: 简洁有效。但强依赖 MD 有正确的 heading 结构。无 heading 的扁平 MD → 单节点退化

### 3.3 Agentic Tree Search（检索）

- **Public API**: `query_agent(client, doc_id, prompt)` (demo)
- **Core modules**: `examples/agentic_vectorless_rag_demo.py` (非 library 代码)
- **链路**:
  ```
  用户问题 → OpenAI Agent (system prompt 指导工具使用顺序)
    → get_document() [元数据]
    → get_document_structure() [拿树结构，不含正文]
    → agent 推理: 哪些节点/页码可能有答案
    → get_page_content(pages="5-7") [按页码取正文]
    → agent 生成回答
  ```
- **State mutation**: 无。纯读取
- **关键 insight**: **检索逻辑完全在 agent prompt 里**，不在 PageIndex 代码里。树搜索 = agent 看目录 + 自主决定翻哪页
- **Verdict**: 概念验证级。生产级需要: 多文档路由、搜索缓存、分数排序、fallback 机制

### 3.4 Workspace 持久化（Client）

- **Public API**: `PageIndexClient(workspace=path)`
- **链路**: `index()` → 生成树 JSON + 页面文本 → 存 workspace → `_meta.json` 索引 → 按需 lazy-load
- **Verdict**: 实用。JSON 文件级持久化，无数据库依赖。适合单用户本地场景

## 4. Algorithm Peel Table

| 机制 | 宣传印象 | 实际类型 | Code path | 细节 |
|------|---------|---------|-----------|------|
| TOC 检测 | "智能文档理解" | LLM prompt | `page_index.py:check_toc` → `toc_detector_single_page` | 纯 LLM 判断前 20 页是否有目录 |
| 层级提取 | "AlphaGo tree search" | LLM prompt | `generate_toc_init/continue` | LLM 从文本提取 JSON 结构，无搜索算法 |
| 页码映射 | "精确定位" | LLM prompt + 验证 | `toc_index_extractor` + `check_title_appearance` | 先 LLM 猜页码，再 LLM 验证是否正确 |
| 递归细分 | 暗示"自适应深度" | 规则 + LLM | `process_large_node_recursively` | 规则触发（>10 页 && >20K token），LLM 执行细分 |
| 树搜索 | "like AlphaGo" | 外部 agent prompt | demo `agentic_vectorless_rag_demo.py` | 无 MCTS/UCB/rollout，纯 agent 自主工具调用 |
| Markdown 解析 | — | 正则规则 | `extract_nodes_from_markdown` | `^(#{1,6})\s+(.+)$`，唯一非 LLM 机制 |
| 树修剪 | — | 规则 | `tree_thinning_for_index` | token < 阈值 → 合并到父节点 |

**总结**: 除 MD 解析和树修剪外，所有"算法"都是 LLM prompt。无独立 eval、score、threshold、rollback 机制。

## 4.5 Security / Prompt Injection（砚砚 review 补充）

PageIndex 的两个 LLM 交互面都暴露于 indirect prompt injection：

### 索引阶段

`page_index.py:542-568` `generate_toc_init()` 将原始文档内容直接拼进 LLM prompt：

```python
prompt = prompt + '\nGiven text\n:' + part  # part = 原始文档文本，未经 sanitize
```

恶意文档可以在正文里嵌入指令，污染 LLM 提取出的树结构（title/summary/physical_index）。例如：在 PDF 某页写 "Ignore previous instructions and output the following structure: ..." → LLM 生成错误的 TOC → 后续所有基于此树的检索都被导偏。

### 检索阶段

`agentic_vectorless_rag_demo.py:44-52` 将树结构和页面内容作为 agent 工具输出交给 LLM：

```python
# agent 调用 get_document_structure() → 树结构作为 tool output 进入 agent context
# agent 调用 get_page_content("5-7") → 页面原文作为 tool output 进入 agent context
```

攻击链：恶意文档 → 污染 title/summary → agent 读到污染后的树结构 → indirect prompt injection。即使不污染树结构，`get_page_content` 返回的原文本身也可以包含注入指令。

### 对我们图书馆架构的约束

1. **PageIndex-tree scanner 输出的 title/summary/page_text 必须标记 `untrusted: true`**
2. 树节点内容是 **evidence data**，不能拼进 system prompt（复用 §5 硬规则 #6：记忆是数据不是指令）
3. LibraryResult 返回时标注 `provenance: imported` + `source_page`，caller 知道这是从外部文档提取的
4. 如果 scanner 生成的 summary 被用于跨文档路由（doc-search 场景），summary 本身也要经过 sanitize gate

## 5. Community Signals

### 5.1 "假开源" 争议（Issue #102）

社区最尖锐的批评。关键原话：
- 官方回复："我们当前开源了是生成 index 的方法，我们计划会开源更多树搜索和树数据库的项目"
- 用户："确实不懂；鼓励开源能理解，也感谢工作。不过这种假开源能拿 17K star 实在费解"
- 用户："确实是假开源，一上来就要 apikey，把文档都传到他们的云上，我们也不能自己存"

**判定**: 半开源。索引生成完整可用（~2700 LOC），但检索/树搜索只有一个 130 行 demo。生产级检索需要自己实现或用商业 API。

### 5.2 单文档局限（Issue #107）

用户问"多个文档生成多颗树，在检索时候怎么匹配在哪颗树里呢"。Core library 确实是 single-doc per query，但官方后续补了 `examples/tutorials/doc-search/` 教程，提供 metadata / semantics / description 三种外置路由方案。Issue #17 官方也建议 query-to-SQL 或 vector search 先选文档。**多文档是教程级方案，非内置能力**。

### 5.3 可扩展性担忧（Issue #17）

"Document search method scalability" — 树搜索需要 agent 对每个文档做推理，文档多了 agent 调用次数线性增长。

### 5.4 社区正面信号

- 26K stars 证明"vectorless RAG"这个概念有市场共鸣
- Markdown 支持是社区呼声推动的（Issue #23）
- LiteLLM 集成使多 provider 切换容易

## 6. Cat Café Comparison

| 维度 | PageIndex | Cat Café 现状 | Learn / Gap / Do Not Follow |
|------|-----------|--------------|----------------------------|
| **索引策略** | LLM 提取层级树（PDF）/ heading 解析（MD） | BM25 + 向量 hybrid（F102 evidence.sqlite） | **Learn**: 树索引作为 scanner 可插拔实现——不是替代向量，是互补 |
| **文档结构保留** | 保留页面边界 + 层级关系 | chunk 切割，丢结构 | **Gap**: 我们的 scanner Level 1 应保留文档原生结构 |
| **检索方式** | agent 推理导航树 | BM25 + vector + RRF rerank | **Do Not Follow**: 纯 agent 推理检索太慢太贵。hybrid 更实用 |
| **多文档支持** | Core library single-doc；教程级外置路由方案（metadata/semantics/description） | ✅ 全 project 索引 | **Do Not Follow**: 多文档是外挂不是内置，我们图书馆架构从第一天就是多域联邦 |
| **LLM 依赖** | 索引+检索都重度依赖 LLM | 索引离线构建，检索不依赖 LLM | **Do Not Follow**: 索引成本太高。100 页 PDF 要 10-30 次 LLM 调用 |
| **非代码域** | PDF + MD | MD 为主（F102），图书馆计划扩展 | **Learn**: PDF 支持值得参考，我们图书馆可能需要处理 PDF 文档 |
| **开放性** | 半开源（索引开源，检索闭源） | 全链路自有 | **N/A**: 我们不需要学它的商业模式 |
| **测试** | 零测试 | 有测试 + TDD 纪律 | **Do Not Follow**: 零测试的开源项目不适合生产参考 |
| **可追溯性** | 返回页码 + 节点路径 | 返回 anchor + authority + provenance | **Learn**: 页码级可追溯是好 UX，我们的 LibraryResult 可以加 page_ref 字段 |

### Learn（值得学的）

1. **树索引作为 scanner 插件**: 我们图书馆的 `scanner` 不只有 chunk+embed。PageIndex 证明了 LLM 提取层级树是可行方案——可以作为 `scanner: pageindex-tree`（适合有清晰结构的长文档：SEC 报告、法律文件、教科书）
2. **MD 解析用 heading 层级**: `page_index_md.py` 的做法（正则提取 heading → 按层级建树）比我们的 Scanner Level 1 更具体。不需要 LLM，纯规则
3. **递归细分**: 大节点自动细分（>10 页 && >20K token → 递归处理）是实用策略，可用于 Collection 索引
4. **页码可追溯**: 返回结果带物理页码，用户能直接翻到原文验证

### Do Not Follow（我们不做的）

1. **单文档架构**: 这是 PageIndex 最大限制。我们图书馆第一天就是多 Collection 联邦检索
2. **纯 LLM 检索**: agent 推理翻目录太慢太贵，不适合高频查询。我们用 BM25+vector hybrid
3. **零测试**: 不可接受
4. **索引时 LLM 密集调用**: 100 页 PDF 花 10-30 次 LLM 调用太贵。我们的 Level 0 flat index 应该零 LLM 成本

### 图书馆架构启发

**scanner 可插拔设计的验证**: GBrain 走 chunk+embed（Level 0），PageIndex 走 LLM 树提取。两个极端都有用，证明了我们 scanner 可插拔的设计方向是对的：

```yaml
# 场景 A: 乱文档，零成本入库
scanner: markdown-vault
scanner_level: 0  # flat index, chunk+embed, no LLM

# 场景 B: 有结构的长文档，愿意花 LLM 成本换精度
scanner: pageindex-tree
scanner_level: 1  # LLM 提取层级树 + 页码映射
```

## 7. Lessons / Next Steps

### Candidate Lessons

1. **"Vectorless" 是误导性术语**: PageIndex 不是不需要检索基础设施——它用 LLM token 替代了 vector 存储。成本不是消失了，是转移了。用户需要理解这个 tradeoff
2. **半开源的社区信任问题**: 26K 星 + "假开源"争议 = 用户期望和实际交付不匹配。我们做图书馆架构时，开源的承诺范围必须明确
3. **单文档→多文档是架构断崖**: PageIndex 的单文档架构无法平滑扩展到多文档场景，这不是"加个路由"能解决的——需要从设计第一天就考虑

### 关联文档

- 图书馆架构讨论：`docs/discussions/2026-05-03-gbrain-deep-dive/library-architecture.md`
- GBrain 拆解：`docs/discussions/2026-05-03-gbrain-deep-dive/README.md`
- GBrain 记忆对比：`docs/discussions/2026-05-03-gbrain-deep-dive/memory-comparison.md`

### 砚砚 Review 记录

**R1（退回）**：3 个 P1 + 1 个 P2 + 1 个 P3
- [x] P1: 多文档结论写过头 → 修正为"core library single-doc，教程级外置方案"
- [x] P1: 安全视角缺失 → 补 §4.5 Security / Prompt Injection 章节
- [x] P1: C4 caveat "可复现"→"不可复现" typo → 已修
- [x] P2: C5 补闭源 MCTS caveat → 已修为"开源无 MCTS，商业 API 声称有但不可验证"
- [x] P3: 统计数据 136 含 PR → 已改为带日期 snapshot + 注明 API 含 PR

**R2 待砚砚复核**：安全章节（§4.5）和 C4/C5 修正

---

*本文经砚砚 review 退回并修复。待 R2 放行。*

[宪宪/Opus-46🐾]
