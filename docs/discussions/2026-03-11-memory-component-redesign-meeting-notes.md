---
feature_ids: [F102]
topics: [memory, architecture, adapter, evidence-store]
doc_kind: discussion
created: 2026-03-11
participants: [opus, gemini, gpt52]
thread_id: thread_mmmsovftp3gitjm9
---

# 记忆组件重构 — 三猫头脑风暴纪要

**Thread ID**: `thread_mmmsovftp3gitjm9` | **日期**: 2026-03-11 | **参与者**: 布偶猫(opus), 暹罗猫(gemini), 缅因猫(gpt52)

## 背景

铲屎官决定停用 Hindsight（外部记忆服务），要求：
1. 把 HindsightClient 硬编码改造为可插拔 Adapter 接口
2. 设计轻量级的替代方案（可能只是 Link Index）
3. 调研 2026 年的最佳实践和开源组件

## 各方观点

### 暹罗猫（烁烁）
- **核心立场**："认清规模，拒绝过度工程，降维回受控的本地结构化数据"
- 接口命名建议 `consult/crystallize/reconcile`（语义化）
- Link Index 本质是"受控视图"——区分有效决策和废案，比 grep 信噪比高
- 提出 "File-as-Database"：`EVIDENCE_INDEX.json` 自动编译，零外部依赖
- 推荐 Orama / MiniSearch（纯 JS 进程内）作为进阶方案
- 150 篇文档连 1M context window 都填不满，不需要数据库

### 布偶猫（宪宪）
- **核心立场**：接口已有骨架（`IHindsightClient`），保守重命名 + DI 注入
- 建议 `recall→search`, `retain→store`, `reflect→删除或拆出`
- 列出 5 个具体耦合文件的改造地图
- 提出"自动索引 > 手动 retain"——与 feat-lifecycle SOP 集成
- MVP 三层：LocalIndexStore → OramaStore → HindsightStore(legacy)
- Phase 1 纯 JSON 索引足够，Orama 留给 Phase 2

### 缅因猫 GPT-5.4（砚砚）
- **核心立场**："不该把 Hindsight 三个动词原样抽象化，应拆成检索/沉淀/反思三层"
- 接口最小化：`search/upsert/deleteByAnchor/getByAnchor/health`
- **独特贡献 P1**：`retain-memory` 必须降级为 candidate/marker queue，不能直写长期库——否则重蹈"碎片化垃圾入库"覆辙
- 发现额外耦合点：`index.ts` 启动注入 + `hindsight-import-p0.ts` 导入脚本
- 发现 evidence fallback 只覆盖 3 个目录，漏了 `docs/features/`
- 建议 SQLite FTS5 作为底层，加 `edges` 表存显式关系
- 外部组件排序：借鉴模式 > 引入运行时，Phase 1 不接任何全栈 memory product
- **反对先走 Deep Research**：Phase 1 方向已够清楚，Deep Research 留给 Phase 2 选型

## 共识（全票通过）

| # | 共识 | 证据 |
|---|------|------|
| 1 | **~150 docs 不需要外部服务/图数据库** | 三猫一致：本地优先 |
| 2 | **`reflect` 从存储层拆出** | 三猫一致：它是 LLM 编排能力，不是存储 primitive |
| 3 | **`bankId` 从业务层移除** | 三猫一致：单共享知识域，ADR-005 已决 |
| 4 | **Link Index > raw grep** | 三猫一致：受控视图、噪音过滤、token 节省 |
| 5 | **Hindsight 保留为 legacy adapter** | 三猫一致：降级不删除 |
| 6 | **自动索引 > 手动 retain** | 三猫一致：与 feat-lifecycle 集成 |
| 7 | **Phase 1 不上向量/图/外部服务** | 三猫一致 |
| 8 | **retain-memory 降级为 marker/candidate** | GPT-5.4 提出，opus/gemini 未反对 |

## 分歧（需铲屎官或后续讨论决定）

| # | 分歧点 | 各方立场 | 建议 |
|---|--------|---------|------|
| 1 | **接口方法命名** | gemini: `consult/crystallize/reconcile` / opus: `search/store` / gpt52: `search/upsert/deleteByAnchor/health` | **采用 GPT-5.4 的最小化版本**——它最完整且语义通用。gemini 的命名虽有创意但对新开发者不友好 |
| 2 | **索引格式** | opus: `EVIDENCE_INDEX.json` / codex: `.jsonl` / gpt52: `.jsonl` 或 SQLite FTS5 | **Phase 1 用 `.jsonl`**（流式追加友好），Phase 2 按需升级 SQLite FTS5 |
| 3 | **Phase 1 搜索引擎** | gemini/codex: Orama/MiniSearch / opus: 纯 JSON / gpt52: SQLite FTS5 | **Phase 1 纯 JSONL + 内存过滤**（150 docs 不需要搜索引擎），Phase 2 再选 |
| 4 | **接口拆分粒度** | opus: 单接口 `IEvidenceStore` / gpt52: 三接口 `IKnowledgeIndex` + `IMemoryCapture` + `IReflectionService` | **Phase 1 用单接口**（YAGNI），如果 Phase 2 发现需要再拆 |
| 5 | **是否需要 Deep Research** | opus: 可能需要 / gpt52: Phase 1 不需要，Phase 2 再做 | **采用 GPT-5.4 意见**——Phase 1 方向已明确，Deep Research 留给 Phase 2 选型 |

## 待决事项

1. **立项**：需要铲屎官确认是否立为正式 feat（建议 F101 或下一个可用编号）
2. **索引 Schema**：具体字段待定（参考 GPT-5.4 建议：`anchor/sourceHash/kind/status/featIds/title/summary/keywords/outlinks/updatedAt`）
3. **Phase 2 触发条件**：什么情况下认为纯 JSONL 不够用？（建议：文档超 500 篇 或 检索 latency > 200ms）

## 行动项

| # | 行动 | 负责 | 依赖 |
|---|------|------|------|
| 1 | 铲屎官确认方向 + 立项 | @landy | 本纪要 |
| 2 | 写实施计划（Adapter 接口 + LocalIndexStore + 路由解耦） | opus | 铲屎官确认 |
| 3 | Phase 2 选型 Deep Research（Orama vs MiniSearch vs SQLite FTS5 vs Mem0） | opus + gpt52 | Phase 1 跑出真实缺口后 |

---

## 第二轮：铲屎官反馈 + GPT-5.4 终态评审（19:36-19:53）

### 铲屎官反馈（19:36, 19:39）

1. **P1 面向终态**：JSONL 是脚手架，违反家规"Phase N 的产物在 Phase N+1 还在吗？不在=绕路"。直接上 SQLite FTS5 作为终态基座。
2. **多项目扩展**：猫猫未来出征其他项目（Data Framework 等），架构必须支持 1000+ docs。
3. **全局记忆跟猫走**：确认方案 C — 全局层 = Skills + 家规 + MEMORY.md（F100 体系），项目层 = evidence.sqlite（每项目一个，物理隔离）。

### GPT-5.4 终态评审（19:46）

三个 P1 全部被采纳：

**P1-1: Schema 拆分**
- 结构化元数据不该塞 FTS5 → 拆成 `evidence_docs`（常规表）+ `evidence_fts`（FTS5 外部内容表）
- 理由：精确过滤、freshness check、join、schema migration、向量列扩展都更顺

**P1-2: Materialization 规则**
- SQLite = 编译产物（gitignore + rebuild），不是真相源
- `accepted` marker 必须先 materialize 到稳定 source anchor（.md 文件）才算沉淀
- 否则 rebuild 会丢 accepted knowledge，违反 P1/P4

**P1-3: 联邦检索**
- F100 定了"不发明新沉淀库，路由到现有真相源"
- 新增 `KnowledgeResolver` 在 service 层合并 F100 全局真相源（只读）+ 项目 evidence.sqlite
- 全局层不写进项目库

**接口拆分**（收敛版）：一个 DB，两个接口，一个服务，一个联邦检索器
- `SqliteProjectMemory` 同时实现 `IEvidenceStore` + `IMarkerQueue`
- `IReflectionService` 独立
- `IKnowledgeResolver` 联邦检索全局 + 项目

**Markers 状态流**：`pending → proposed → accepted | rejected | needs_review`
- 项目内知识有 anchor + dedupe + confidence 过线 → 自动 accept
- 影响全局层（身份/偏好/方法论）→ `needs_review`，走 F100 真相源

### 新增 Key Decisions（KD-5 ~ KD-11）

| # | 决策 | 日期 |
|---|------|------|
| KD-5 | 面向终态：SQLite 为基座，不搞 JSONL 中间态 | 2026-03-11 |
| KD-6 | 全局记忆跟猫走，项目记忆留在项目 | 2026-03-11 |
| KD-7 | 每项目一个 evidence.sqlite（物理隔离） | 2026-03-11 |
| KD-8 | evidence.sqlite = gitignore + rebuild | 2026-03-11 |
| KD-9 | markers 分层审批（自动/needs_review） | 2026-03-11 |
| KD-10 | Schema 拆分：evidence_docs + evidence_fts | 2026-03-11 |
| KD-11 | 联邦检索 KnowledgeResolver | 2026-03-11 |

---

## 第三轮：铲屎官要求找云端 GPT Pro 讨论（19:58）

铲屎官反馈：技术决策太多（markers 表等概念没交代清楚），要求：
1. 把上下文交代清楚
2. 加载 deep-research skill，找云端 GPT Pro 讨论技术决策
3. 把增量讨论都更新到 markdown 文档（本纪要）

---

## 第四轮：云端 GPT Pro 咨询结果（21:40-04:43）

### 咨询方式

Deep Research Mode B：布偶猫准备自含上下文提问文档（Part 1），铲屎官手动贴到云端 GPT Pro，GPT Pro 回答（Part 2），布偶猫本地综合（Part 3）。

完整咨询文档见 `docs/research/2026-03-11-f102-memory-adapter-gpt-pro-consult.md`。

### GPT Pro 评审结果

**骨架确认**（无需修改）：KD-1/2/4/6/7/10/11 全部认可。

**打回 3 项**：

| # | 打回内容 | 修改 |
|---|---------|------|
| 1 | KD-8 只对索引成立——markers/edges 有审核历史，不是编译产物 | KD-8 拆分：索引=gitignore+rebuild；markers=git-tracked `docs/markers/*.yaml` |
| 2 | KD-5 混淆了存储和检索——纯 lexical 不够 | KD-5 改为"终态**存储**基座"，Phase C 从"按需"改为"预期路径" |
| 3 | `accepted` 命名不精确——approved ≠ materialized | KD-12：状态机 `captured→normalized→approved→materialized→indexed` |

**补 4 盲区**：

| # | 盲区 | 处理 |
|---|------|------|
| 1 | 工作流状态的 source of truth | 与打回 1 合并：markers 走 git-tracked YAML |
| 2 | 检索粒度——只索引 title+summary 会漏正文 | KD-15：预留 `evidence_passages` 表，v1 不填 |
| 3 | 过期/冲突知识 | KD-16：`superseded_by` 字段 + `supersedes/invalidates` 关系 |
| 4 | 评测集 | KD-17：Phase B 加 `memory_eval_corpus.yaml` |

**新增 2 接口**：

| 接口 | 职责 |
|------|------|
| `IIndexBuilder` | scan/hash/incremental rebuild/schema migration/FTS5 consistency |
| `IMaterializationService` | approved → .md patch → git commit → trigger reindex |

**其他建议**：
- 全局层也编译 read-only `global_knowledge.sqlite`（KD-14），resolver 融合两个同质 index
- WAL + 单写者队列 + FTS5 tokenchars + bm25 列权重（KD-18）
- 联邦检索用 RRF rank fusion
- 预留 `scope: 'workspace'`（中间层 scope），但 v1 不做
- ProfileStore 搁置（MEMORY.md + Skills 已在做）

### 新增 Key Decisions（KD-12 ~ KD-18）

| # | 决策 | 日期 |
|---|------|------|
| KD-12 | marker 状态机：captured→normalized→approved→materialized→indexed | 2026-03-11 |
| KD-13 | 新增 IMaterializationService + IIndexBuilder（共 6 接口） | 2026-03-11 |
| KD-14 | 全局层也编译 read-only global_knowledge.sqlite | 2026-03-11 |
| KD-15 | 预留 evidence_passages 表（v1 不填） | 2026-03-11 |
| KD-16 | superseded_by 字段 + supersedes/invalidates 关系 | 2026-03-11 |
| KD-17 | Phase B 加评测集 memory_eval_corpus.yaml | 2026-03-11 |
| KD-18 | WAL + 单写者队列 + tokenchars + bm25 列权重 | 2026-03-11 |

### 终态架构（收敛版）

```
truth sources (git-tracked)
  docs/*.md                          — 项目文档
  docs/markers/*.yaml                — marker 审核日志
  global profiles/rules/lessons      — Skills + 家规 + MEMORY.md

compiled indices (gitignore + rebuild)
  evidence.sqlite                    — 项目索引
  global_knowledge.sqlite            — 全局索引（read-only）

services (6 个接口)
  IIndexBuilder, IEvidenceStore, IMarkerQueue,
  IMaterializationService, IReflectionService, IKnowledgeResolver
```

---

## 外部参考（三猫汇总）

**学术**:
- Mnemis (分层记忆 + 双路检索): https://arxiv.org/abs/2602.15313
- Mem2ActBench (记忆→行动): https://arxiv.org/abs/2601.19935
- LongMemEval (ICLR 2025): https://proceedings.iclr.cc/paper_files/paper/2025/file/d813d324dbf0598bbdc9c8e79740ed01-Paper-Conference.pdf

**开源框架**:
- Mem0 OSS (metadata/filter/search + graph memory): https://docs.mem0.ai/open-source/overview
- OpenMemory (Mem0 本地优先): https://mem0.ai/openmemory
- Letta (memory blocks + MemGPT): https://docs.letta.com/guides/agents/memory
- LangMem (background memory manager): https://langchain-ai.github.io/langmem/guides/background_quickstart/
- Graphiti (时间演化图记忆): https://github.com/getzep/graphiti

**嵌入式搜索**:
- Orama (纯 JS 全文+向量): https://docs.orama.com/
- MiniSearch (纯 JS 全文): https://lucaong.github.io/minisearch/
- SQLite vec1 (官方向量扩展): https://sqlite.org/vec1
- LanceDB embedded: https://docs.lancedb.com/quickstart
