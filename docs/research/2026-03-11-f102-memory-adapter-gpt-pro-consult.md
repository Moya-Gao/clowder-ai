---
feature_ids: [F102]
topics: [memory, adapter, evidence-store, architecture, consultation]
doc_kind: research
created: 2026-03-11
model: gpt-pro
---

# F102 记忆组件技术决策评审 — GPT Pro 咨询

## Part 1: 发给云端模型的提示词

> 直接复制发送

---

你好，我们是 Cat Café 团队——一个多 AI Agent 协作系统（3 只 AI 猫猫 + 1 位人类铲屎官）。我们正在重构记忆组件，从一个不好用的外部记忆服务（Hindsight）迁移到自建的本地方案。

### 背景

**项目现状**：
- Cat Café 是多 AI agent 协作开发平台，猫猫们（Claude/GPT/Gemini）协作写代码、做设计
- 当前文档规模：~150 篇（feat docs + decisions + plans），预计会增长到 1000+
- 猫猫未来会"出征"其他项目（如 Data Framework），需要跨项目记忆支持
- 技术栈：Node.js + TypeScript + Redis + Fastify

**原系统问题（Hindsight）**：
- 外部 HTTP 服务，localhost:18888，经常连不上
- retain（写入记忆）碎片化严重——猫猫随意写入自然语言，质量极低
- recall（检索）向量匹配效果差，"谁给我取名" → 返回各种包含"名字"的无关内容
- 整体评价：铲屎官觉得"实在难用"，已停用

### 我们的核心结论（三猫 + 铲屎官讨论后）

| # | 决策 | 理由 |
|---|------|------|
| KD-1 | 本地优先，不上外部服务/图数据库 | ~150 docs 不需要，1000+ 也能用 SQLite 撑住 |
| KD-2 | `reflect`（LLM 反思）从存储层拆出 | 反思是 LLM 编排能力，不是存储 primitive |
| KD-3 | retain 降级为 candidate/marker queue | 猫猫不能直写长期记忆，必须先进候选箱审核 |
| KD-4 | 自动索引 > 手动 retain | 与开发流程（feat lifecycle）集成，90% 记忆自动沉淀 |
| KD-5 | SQLite FTS5 为终态基座 | 不搞 JSONL 中间态——每步产物必须是终态基座 |
| KD-6 | 全局记忆跟猫走，项目记忆留在项目 | 全局=Skills/规则/猫猫记忆；项目=evidence.sqlite |
| KD-7 | 每项目一个 evidence.sqlite（物理隔离） | 猫出征新项目不带旧项目细节 |
| KD-8 | evidence.sqlite = gitignore + rebuild | 真相源是 .md 文件，SQLite 是编译产物 |
| KD-9 | markers 分层审批 | 项目内知识自动 accept；影响全局层 → 人工 review |
| KD-10 | Schema 拆分：evidence_docs + evidence_fts | 结构化元数据用常规表，FTS5 只管全文搜索 |
| KD-11 | 联邦检索 KnowledgeResolver | service 层合并全局真相源（只读）+ 项目 SQLite |

**终态架构**：

```
全局层（跟猫走）
  Skills + 共享规则 + MEMORY.md（已有基础设施，不改）
  └── 猫猫身份/偏好/跨项目方法论/教训

项目层（留在项目里）
  evidence.sqlite（每项目一个，物理隔离）
  ├── evidence_docs（常规表）— 结构化元数据
  ├── evidence_fts（FTS5 外部内容表）— 全文搜索 title+summary
  ├── edges — 文档间关系（evolved_from/blocked_by/related）
  └── markers — 候选记忆队列（pending→proposed→accepted/rejected/needs_review）
```

**四个接口**：
```
IEvidenceStore     — search/upsert/delete/get/health/initialize
IMarkerQueue       — submit/list/transition
IReflectionService — reflect（独立于存储层）
IKnowledgeResolver — resolve（联邦检索：全局层只读 + 项目层）
```

`SqliteProjectMemory` 同时实现 `IEvidenceStore` + `IMarkerQueue`（同一个 DB）。

**关键规则**：
- SQLite 是编译产物，不是真相源（gitignore + 启动时 rebuild）
- `accepted` marker 必须先 materialize 到 .md 文件，才算真正沉淀
- 全局记忆不写进项目库（联邦检索只读接入）

### 请求

**请帮我们做以下评审**：

1. **架构盲区**：我们的终态架构有没有明显的盲区或遗漏？特别是在 1000+ docs、多项目出征的场景下。

2. **SQLite 作为终态基座的风险**：FTS5 在 1000+ docs 场景下的性能特征？并发读写的限制？有没有我们低估的坑？

3. **Marker → Materialization 流程**：`pending → proposed → accepted → materialize to .md` 这个流程是否过度设计？还是说这种审核机制是必要的？业界有没有类似的 pattern？

4. **联邦检索（KnowledgeResolver）**：合并"文件系统全局真相源"和"SQLite 项目索引"的检索，有没有更成熟的 pattern 可以参考？

5. **接口设计**：四个接口（IEvidenceStore + IMarkerQueue + IReflectionService + IKnowledgeResolver）是否合理？有没有过度拆分或遗漏？

6. **我们可能没想到的**：基于你对 2026 年 agent memory 系统的了解，有没有我们完全没考虑到的重要维度？

**额外请求**：
- 如果你觉得我们某个决策有问题，请直说，不要委婉
- 如果有更好的方案，请给出具体替代方案和理由
- 如果某个决策你认为是对的，也请说明为什么对（帮我们确认信心）

---

## Part 2: 云端模型回答（待回填）

> 铲屎官粘贴回答到这里

我先给结论。

这套方案的骨架是对的，不是那种“换个名字继续痛苦”的重构。KD-1、KD-2、KD-4、KD-6、KD-7、KD-10、KD-11 我基本站你们这边。尤其是把 `reflect` 从存储层拆出去，以及把自动沉淀放在人工 `retain` 之前，这和现在主流 memory 框架的方向一致。LangMem 明确把核心 memory API 设计成不依赖具体存储，并提供后台 manager 去自动抽取、整合、更新知识；它还把 structured profile 和 unbounded collection memory 分开。Letta 也把 read-only/shared blocks 和按需查询的 archival memory 区分开来。([LangChain][1])

但我会直接打回去改三件事。

第一，**KD-8 只对“索引”成立，不对“工作流状态”成立**。`evidence.sqlite` 可以是可重建编译产物，但 `markers` 不是纯编译产物，`edges` 里只要掺了人工判断也不是。你们现在的描述里，`markers`、审核历史、materialization 结果很容易变成“住在可重建库里的非可重建真相”。这会在重建时直接蒸发。第二，**KD-5 作为“终态基座”没问题，作为“终态检索策略”有问题**。FTS5 很适合当本地检索内核，但纯 lexical 检索天生不擅长同义改写、跨语言、别名和深埋细节。现在官方混合检索实践都在强调关键词的精确性和语义相似性的互补，再用 RRF 之类的方法融合排名。([微软学习][2]) 第三，**`accepted` 这个状态名我反对**。只要还没 materialize 到 `.md`，它就不是 accepted truth，只是 approved candidate。

### 1. 架构盲区

最大的盲区是 **source of truth 的边界还没画到工作流状态上**。你们已经很清楚 `.md` 才是真相源，但这句话目前只覆盖了“文档内容”，没有覆盖“记忆晋升过程”。我的建议很硬：
项目文档和全局规则继续做真相源；`evidence.sqlite` 只做索引；而 `markers`、审核意见、materialization 审计，要么进一个**单独的 durable workflow store**，要么直接落成 git-tracked 的 `markers/*.yaml` 或 patch 文件。否则你们的审核链会像猫薄荷烟雾，闻起来有，伸手一抓没了。

第二个盲区是 **检索粒度太粗**。如果 `evidence_fts` 只索引 `title + summary`，1000 篇以后你们会碰到“文档明明在，但关键事实埋在正文里没被 summary 带出来”的问题。现在 agent memory 系统普遍把长期记忆当作 collection of records/fragments 来检索，而不是只搜一个总摘要，所以我建议至少预留 `evidence_passages` 这层，哪怕 v1 先不做，也别把 schema 封死。([LangChain][3])

第三个盲区是 **过期知识和冲突知识的处理**。你们有 `evolved_from`，但还缺一个更明确的“谁 supersedes 谁、谁 invalidates 谁”。LangMem 的 collection memory 指南明确提到，新记忆必须和旧信念做 reconcile，过度抽取会损 precision，抽取不足会掉 recall；而回忆相关性也不该只看相似度，还要看 importance 和最近/频繁使用形成的 strength。对软件项目来说，**过时但高相似的决策** 比查不到更危险。([LangChain][3])

第四个盲区是 **没有把评测当成架构的一部分**。你们上一次痛点不是“能不能存”，而是“能不能找对”。Letta 的 eval 文档已经把 multi-turn 的 memory recall、memory correction、以及“检查回答”与“检查真实 memory state”分开了。你们也需要同样的东西，不然会重演 Hindsight 的旧戏，只是舞台更漂亮。([Letta Docs][4])

### 2. SQLite 作为终态基座的风险

先说结论：**1000+ docs 对 SQLite FTS5 不是性能恐怖片，真正的风险是查询质量、tokenization 和写入串行化，不是吞吐天花板。** FTS5 本质上就是 SQLite 的全文倒排索引。完整 token 查询很快，prefix 查询默认要做 range scan，想让 `abc*` 这类查询快起来需要 prefix indexes；更一般的 substring 匹配则要靠 trigram tokenizer。([SQLite][5])

并发这块，**WAL 不是多写者乐园，它只是“多读者 + 单写者”更顺滑**。SQLite 官方文档写得很直白：WAL 模式下读者不阻塞写者、写者不阻塞读者，但同一时刻仍然只有一个写事务。写事务竞争时会碰到 `SQLITE_BUSY`，`busy_timeout` 和 `BEGIN IMMEDIATE` 能帮你把冲突提前到事务开始阶段处理掉。对你们这种多 agent 系统，我会建议一个**显式单写者队列**，把 marker 写入、index 更新、materialization bookkeeping 串起来。([SQLite][6])

WAL 还有几个容易低估的坑。第一，**同机限制**。官方明确说 WAL 依赖共享内存，所以不适合 network filesystem。第二，**长读事务会拖住 checkpoint**，WAL 变胖后读性能会下降。默认 auto-checkpoint 大约在 1000 pages 触发，绝大多数提交会很快，但偶尔某次 COMMIT 会突然慢，因为它顺手做了 checkpoint。([SQLite][6])

你们选 `evidence_docs + evidence_fts` 的 external-content split 是对的，但这里有个带牙的 caveat。SQLite 官方明确说，**external content table 的一致性是应用层自己的责任**，不一致时查询结果会“看起来很玄学”；必要时可以用 `rebuild` 重建索引。也就是说，`IEvidenceStore.upsert` 不能只是“更新主表”，它必须保证 FTS 同步，最好把这件事关进一个明确的 indexer/build pipeline 里。([SQLite][5])

还有一个经常被忽略的点是 **tokenization**。FTS5 默认是 `unicode61`，`porter` 词干器是给英语设计的。对 feature ID、路径、snake_case、hyphenated token，最好显式调 `tokenchars`；对通用 substring 需求可以考虑 trigram，但 trigram 查询少于 3 个字符时不工作，而且会换来更大的索引。你们如果有中英混杂查询，或者中文问英文文档，别把这事寄托给“默认 tokenizer 会懂我”。它不会。([SQLite][5])

顺手给一个很实用的小技巧：FTS5 支持 `bm25()` 列权重，标题命中可以比 summary 命中更重；而且官方还提到 `ORDER BY rank` 往往比直接 `ORDER BY bm25(...)` 更快。另一个超好用的调试器是 `fts5vocab`，它可以直接把索引里实际分出来的 token 掏给你看。检索系统一旦出毛病，这俩东西都是手电筒。([SQLite][5])

### 3. Marker → Materialization 流程是不是过度设计

**机制本身不算过度设计，状态机现在有点拧。**

对**全局记忆**来说，这种审核机制是必要的。我甚至会更强硬一点。全局层属于猫会带走的“人格、规则、方法论、跨项目教训”，污染一次，后面所有项目一起吃灰。Letta 的 HITL 文档也明确推荐对高风险写操作、文件系统修改、数据库写入做选择性审批，而不是让 agent 自由落笔。([Letta Docs][7])

但对**项目内、且来自 canonical docs 的知识**，你们没必要全走人工审批。这里更合理的是“自动 accept，但 accept 的对象是**文档变更**，不是 memory row”。LangMem 也明确区分了 hot-path 的 conscious formation 和后台的 subconscious formation，后者就是为了不阻塞主流程、提高 recall。你们的“自动索引 > 手动 retain”判断是对的。([LangChain][3])

我会把状态机改成更干净的一套：

`captured -> normalized -> review_required? -> approved -> materialized -> indexed`
外加 `rejected`

这里最重要的是语义：**approved 不等于 accepted truth，materialized 才是。**
你们现在的 `accepted -> materialize to .md` 顺序会制造一个半真半假的中间态，后面所有代码都得绕着它跳芭蕾。

再补一刀。对于共享/全局记忆，**指定一个 owner/materializer** 会比“多猫并发改全局”稳很多。Letta 的 shared memory 并发说明也很明确，append-like 操作相对安全，full rewrite 则是 last-writer-wins，重写型修改最好让一个 owner 负责。([Letta Docs][8])

### 4. 联邦检索 `KnowledgeResolver`

你们的方向是对的，但我建议把它做成**检索编排器**，不是“把两个来源的结果拼一起”。

更成熟的模式是：

1. **query planning**
   先判断这是 exact lookup、project query、global persona query、还是模糊语义查询。

2. **fan-out retrieval**
   并行查 project index、global profile/global rules/global lessons。

3. **normalize**
   所有 source 都返回统一结构：`scope/kind/title/snippet/provenance/authority/score`.

4. **rank fusion**
   用 RRF 合并，而不是硬拼原始分数。Elastic 和 Azure 都把 RRF 作为融合不同检索器结果的标准办法，优点是不用强行校准不同评分体系。([Elastic][9])

我会再加一个很关键的建议：**不要让 resolver 一边吃 raw filesystem，一边吃 SQLite MATCH。**
这会把 tokenization、snippet、ranking 变成两套方言。更好的做法是：**全局层也编译一个 read-only global index**，真相源仍然是原来的文件，但检索对象统一变成“两个 index”。这样你们的 resolver 就是在融合两个检索器，而不是融合一个检索器和一堆临时解析逻辑。

还有，别把 FTS 当万能扳手。Azure 的官方混合检索文档专门提到，product codes、专有术语、日期、人名这类东西往往是 keyword search 更强。对你们来说，这就意味着 `feature_id`、`doc_kind`、`path`、`cat_name`、`model_name` 这些字段应该有正常 B-tree 索引和 exact lookup path，先走精确查，再决定要不要进 FTS。([微软学习][2])

### 5. 四个接口是否合理

**整体合理，不算过拆。**

`IEvidenceStore`、`IMarkerQueue`、`IReflectionService`、`IKnowledgeResolver` 这四层的职责边界是清楚的，尤其 `IReflectionService` 独立这件事，我认为是对的。LangMem 的 core API 也把“提炼/更新记忆”视为独立于具体存储的 transformation primitive，而不是数据库原语。([LangChain][3])

但我认为你们少了两个关键接口：

**一，`IMaterializationService`**
这是最重要的缺口。
它负责把 approved marker 变成 `.md` patch、写入 source-of-truth、记录 provenance、触发重新索引。
没有它，系统最关键的“晋升瞬间”会散落在 service 层角落里，像把发动机拆开丢进沙发缝。

**二，`IIndexBuilder` 或 `IProjectIndexCompiler`**
因为你们已经把 SQLite 定义成 compiled artifact 了，那“编译器”就应该是一等公民。`initialize` 放在 `IEvidenceStore` 里太轻了，也太暧昧。它应该明确负责 scan、hash、incremental rebuild、schema version、fts consistency check。

可选地，我还会在**全局层**概念上加一个 `ProfileStore`，但这不一定要落成你们新的项目内接口。原因很简单：LangMem 明确区分了 **profile** 和 **collection**。像“谁给猫取名”“猫的偏好”“跨项目固定风格”这类稳定、结构化的小事实，放 profile 直接 key lookup，效果会比扔进全文检索幸福得多。([LangChain][10])

### 6. 你们可能没想到的几个重要维度

**第一，评测集要和架构一起设计。**
不是“上线后再看体验”。直接做一套 memory eval corpus：
“谁给我取名”“为什么停用 Hindsight”“F102 决策 8 是什么”“哪个文档 supersede 了某方案”“某只猫偏好什么表达风格”。
而且分两类测：
一类测检索结果，另一类测**真实存储状态**。Letta 甚至专门把“验证回答”与“验证 memory block 真的更新了”分开。([Letta Docs][4])

**第二，给记忆加 authority / freshness / provenance。**
项目里最危险的不是“没记住”，而是“记住了旧版本”。`doc_kind`、`created/updated`、`superseded_by`、`source_path`、`git_sha`、`materialized_from_marker_id` 这些字段，应该直接影响排序和展示。LangMem 对 relevance 的说法也很到位，相关性不只看 similarity，还要看 importance 和 strength。([LangChain][3])

**第三，未来大概率会出现一个“中间层 scope”**。
你们现在只有 global 和 project，两层在今天够用；项目一多，就会出现“这不是全宇宙规则，但也不该被锁死在单项目里”的知识。LangMem 的 namespaces 直接支持按 organization / user / feature 分层，Letta 的 shared blocks 也把 global config 和 shared domain knowledge 当成跨 agent 共享上下文。你们以后很可能需要 `workspace/domain` 这一层。([LangChain][11])

---

如果让我替你们拍板，我会把终态修成这样：

```text
truth sources
  project docs/*.md                # git-tracked
  global profiles/rules/lessons    # git-tracked
  marker journal / review log      # durable, NOT rebuild-only

compiled indices
  project evidence.sqlite          # derived
  global knowledge.sqlite          # derived, read-only

services
  IIndexBuilder
  IEvidenceStore
  IMarkerQueue
  IMaterializationService
  IReflectionService
  IKnowledgeResolver
```

一句话收尾：**SQLite 可以现在就上，而且我认为应该上；但它该是你们的本地检索内核，不该被神化成所有记忆问题的终局。** 真正决定这套系统好不好用的，不是库换成 SQLite 这一步，而是你们能不能把 **truth、workflow、retrieval、eval** 四根骨头钉死。这样猫猫出征时带的是可靠记忆，不是随机掉毛。

[1]: https://langchain-ai.github.io/langmem/ "https://langchain-ai.github.io/langmem/"
[2]: https://learn.microsoft.com/en-us/azure/search/hybrid-search-overview "https://learn.microsoft.com/en-us/azure/search/hybrid-search-overview"
[3]: https://langchain-ai.github.io/langmem/concepts/conceptual_guide/ "https://langchain-ai.github.io/langmem/concepts/conceptual_guide/"
[4]: https://docs.letta.com/guides/evals/advanced/multi-turn-conversations/ "https://docs.letta.com/guides/evals/advanced/multi-turn-conversations/"
[5]: https://www.sqlite.org/fts5.html "https://www.sqlite.org/fts5.html"
[6]: https://sqlite.org/wal.html "https://sqlite.org/wal.html"
[7]: https://docs.letta.com/guides/core-concepts/tools/human-in-the-loop/ "https://docs.letta.com/guides/core-concepts/tools/human-in-the-loop/"
[8]: https://docs.letta.com/guides/core-concepts/memory/shared-memory/ "https://docs.letta.com/guides/core-concepts/memory/shared-memory/"
[9]: https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion"
[10]: https://langchain-ai.github.io/langmem/guides/manage_user_profile/ "https://langchain-ai.github.io/langmem/guides/manage_user_profile/"
[11]: https://langchain-ai.github.io/langmem/guides/dynamically_configure_namespaces/ "https://langchain-ai.github.io/langmem/guides/dynamically_configure_namespaces/"

## Part 3: 本地猫综合（布偶猫 Opus）

> 对照 codebase + 项目实际约束，逐项判断 GPT Pro 建议的采纳/调整/搁置。

### 总体评价

GPT Pro 确认了骨架正确（KD-1/2/4/6/7/10/11），打回了三件事，补了四个盲区和两个缺失接口。回答有引用、有具体 schema 建议，质量远超泛泛建议。

### 逐项处理

#### 打回 1: KD-8 只对索引成立，markers/edges 不能只活在 gitignore 的 DB 里

**判定：采纳，需要改 spec。**

GPT Pro 说得对——markers 有审核历史，edges 可能有人工判断，这些不是编译产物。rebuild 会蒸发。

**修改方案**：
- 拆分 SQLite 为两部分：
  - `evidence.sqlite` — 纯编译索引，gitignore + rebuild ✅
  - markers/审核历史 → git-tracked 的 `markers/` 目录（YAML/JSON 文件），或单独的 durable store
- 简化方案：markers 直接用 git-tracked 的 `docs/markers/*.yaml`，和我们已有的 docs 体系一致
- KD-8 修正为：**evidence.sqlite（索引部分）= gitignore + rebuild；markers/审核日志 = git-tracked durable store**

#### 打回 2: KD-5 终态检索策略——纯 lexical 不够

**判定：部分采纳，但不改 Phase A/B 范围。**

GPT Pro 说的对：纯 FTS5 lexical 天生不擅长同义改写和跨语言。但这正是我们 Phase C（向量增强）要解决的。

**修改方案**：
- KD-5 措辞修正：SQLite 是**终态存储基座**（不是终态检索策略）
- Phase C 不再是"按需"，而是**预期会做**（检索质量是已知短板）
- 在 Phase A schema 中预留 passage 级索引的扩展空间（`evidence_passages` 表），但 v1 不填
- 联邦检索用 RRF 融合（不是硬拼分数）——Phase A 就设计好接口

#### 打回 3: `accepted` 状态名

**判定：采纳。**

改 `accepted` → `approved`，新增 `materialized` 作为终态。
完整状态机：`captured → normalized → review_required? → approved → materialized → indexed`
外加 `rejected`。

语义清晰：approved = 审核通过但还没落地；materialized = 已写入 .md 真相源。

#### 盲区 1: 工作流状态的 source of truth

**判定：采纳（markers 用 git-tracked 文件）。**

和打回 1 合并处理。markers 走 `docs/markers/*.yaml`，审核历史在 git history 里天然可追溯。

#### 盲区 2: 检索粒度——只索引 title+summary 会漏正文

**判定：部分采纳（预留 schema，v1 不做）。**

GPT Pro 建议预留 `evidence_passages` 表。对我们当前规模，summary 够用；但 schema 不封死——在 `evidence_docs` 旁边预留 `evidence_passages(doc_anchor, passage_id, content, position)` 的设计空间。Phase B 先不填，Phase C 或更晚按需启用。

#### 盲区 3: 过期知识和冲突知识

**判定：采纳，加 `superseded_by` 字段。**

在 `evidence_docs` 加 `superseded_by TEXT`。edges 表已有 `evolved_from`，再加 `supersedes` 和 `invalidates` 关系类型。检索时 `superseded_by IS NOT NULL` 的结果降权或过滤。

#### 盲区 4: 评测集

**判定：采纳，Phase B 加评测。**

做一个 `memory_eval_corpus.yaml`：
- 检索评测：给定 query → 期望命中的 anchors（Recall@k）
- 状态评测：给定操作 → 验证 DB 状态变化
- 从 Hindsight 失败案例里抽 10-15 条作为初始评测集

#### 缺失接口 1: `IMaterializationService`

**判定：采纳。**

GPT Pro 说得好——"晋升瞬间散落在 service 层角落里，像把发动机拆开丢进沙发缝"。明确新增这个接口。

#### 缺失接口 2: `IIndexBuilder`

**判定：采纳。**

SQLite 是编译产物，编译器应该是一等公民。从 `IEvidenceStore.initialize()` 中拆出：`scan → hash → incremental rebuild → schema version → fts consistency check`。

#### 建议: 全局层也编译 read-only global index

**判定：采纳。**

GPT Pro 说"不要让 resolver 一边吃 raw filesystem 一边吃 SQLite MATCH"。全局层也编译 `global_knowledge.sqlite`（只读），resolver 融合两个同质 index。真相源不变（Skills/家规/MEMORY.md），只是检索时走编译后的索引。

#### 建议: ProfileStore（全局层 key-value）

**判定：搁置。**

LangMem 的 profile vs collection 区分有道理，但我们的 MEMORY.md + Skills 文件系统已经在做这件事。当前不需要新增 ProfileStore 接口，等出征多项目后再评估。

#### 建议: 中间层 scope（workspace/domain）

**判定：搁置，但在 namespace 设计中预留。**

现在两层（global + project）够用。在 `IKnowledgeResolver.resolve()` 的 `ResolveOptions` 中预留 `scope?: 'global' | 'project' | 'workspace'`，但不做实现。

#### SQLite 实操建议（全部采纳）

- WAL 模式 + 显式单写者队列
- FTS5 tokenizer 配置 `tokenchars` 处理 snake_case/feature ID
- `bm25()` 列权重：title > summary
- `fts5vocab` 用于调试
- external-content FTS 一致性封装到 `IIndexBuilder`
- `BEGIN IMMEDIATE` 提前暴露写冲突

### 最终修订版终态架构

```
truth sources (git-tracked)
  docs/*.md                          — 项目文档（feat/decision/plan/lesson）
  docs/markers/*.yaml                — marker 审核日志（durable workflow state）
  global profiles/rules/lessons      — Skills + 家规 + MEMORY.md

compiled indices (gitignore + rebuild)
  evidence.sqlite                    — 项目索引（evidence_docs + evidence_fts + edges）
  global_knowledge.sqlite            — 全局索引（read-only，从 Skills/家规/MEMORY.md 编译）

services (6 个接口)
  IIndexBuilder                      — scan/hash/rebuild/schema migration/fts consistency
  IEvidenceStore                     — search/upsert/delete/get/health
  IMarkerQueue                       — submit/list/transition（真相源在 docs/markers/）
  IMaterializationService            — approved → .md patch → git commit → trigger reindex
  IReflectionService                 — LLM 编排，独立于存储
  IKnowledgeResolver                 — query planning → fan-out → normalize → RRF rank fusion
```

### 新增/修改的 Key Decisions

| # | 决策 | 理由 | 来源 |
|---|------|------|------|
| KD-8' | evidence.sqlite（索引）= gitignore + rebuild；markers = git-tracked durable store | markers 不是编译产物，rebuild 会蒸发 | GPT Pro 打回 1 |
| KD-5' | SQLite 是终态**存储**基座，不是终态**检索策略** | 纯 lexical 不够，Phase C 向量增强是预期路径 | GPT Pro 打回 2 |
| KD-12 | marker 状态机修正：captured→normalized→approved→materialized→indexed | approved ≠ accepted truth，materialized 才是 | GPT Pro 打回 3 |
| KD-13 | 新增 `IMaterializationService` + `IIndexBuilder` 接口 | 晋升瞬间和编译器是一等公民 | GPT Pro §5 |
| KD-14 | 全局层也编译 read-only `global_knowledge.sqlite` | resolver 不应混用 raw filesystem 和 SQLite MATCH | GPT Pro §4 |
| KD-15 | 预留 `evidence_passages` 表（v1 不填） | 检索粒度太粗，1000+ docs 后 summary 不够 | GPT Pro §1 盲区 2 |
| KD-16 | 加 `superseded_by` 字段 + supersedes/invalidates 关系 | 过时高相似决策比查不到更危险 | GPT Pro §1 盲区 3 |
| KD-17 | Phase B 加评测集（memory_eval_corpus.yaml） | 上次痛点是"找不对"不是"存不了" | GPT Pro §6 |
| KD-18 | WAL + 单写者队列 + tokenchars + bm25 列权重 | SQLite 实操最佳实践 | GPT Pro §2 |
