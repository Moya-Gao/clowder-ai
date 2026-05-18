# OpenHuman Memory Tree 核心链路（47 scope — Step 2 追链路）

> Owner: 布偶猫🐾 (Opus-47) / 数据快照: HEAD `db087a7d3` / v0.53.49-staging
> 范围: hot path / fast-score / engine.rs / hotness router / leaf 状态机 / 6 retrieval primitive
> 状态: **47 scope complete（第二波 R1+R2）** — §1-§5 全闭，可进 Step 5+6 合流
> 方法: open-source-teardown — 每个 claim 追到 `file:line`，断环就降级措辞

## §1. Hot path 真实代码（A3 验证）— ⚠️ **partial，推翻 first-pass 乐观**

### 入口链路（已追实）

```
RPC openhuman.memory_tree_ingest
  → memory/tree/rpc.rs:48 ingest_rpc
  → memory/tree/ingest.rs ingest_chat / ingest_email / ingest_document  (ingest.rs:73/96/118)
      · already_ingested 快路径去重（document 才有 source-level gate；chat/email 是 stream id 不 gate）
  → ingest.rs:155 persist()
      1. chunk_markdown(input, ChunkerOptions::default())          ingest.rs:180  — 纯切分，无 LLM
      2. content_store::stage_chunks(content_root, &chunks)        ingest.rs:189  — 落盘 markdown，无 LLM
      3. score::score_chunks_fast(&chunks, &scoring_cfg).await     ingest.rs:193  — ⚠️ 见下
      4. spawn_blocking → SQLite tx:                               ingest.rs:213
           · document source-level claim gate（防并发重复摄入）
           · 读 pre-upsert lifecycle 快照 → upsert_staged_chunks_tx
           · 仅 None|pending_extraction 的 chunk 重置 + 入 to_schedule
             （admitted/buffered/sealed/dropped 不回退 — 防 re-ingest 重复进树）
           · score::persist_score_tx + jobs::enqueue_tx(extract_chunk)  ingest.rs:304-308
      5. jobs::wake_workers()                                      ingest.rs:326
      6. publish_global(DocumentCanonicalized{...})                ingest.rs:337  — Phase-2 producer 钩子
```

慢路径（jobs 队列异步）：full extraction / admission / tree buffering / sealing / topic routing / daily digest —— 与 `ingest.rs:1-7` 模块注释一致。

### A3 verdict 修订：⚠️ **partial**（first-pass 是 ❓，曾乐观假设"验证通过=可借鉴的无 LLM 热路径"）

**断环点**：`score_chunks_fast` 不是纯规则。

- `ScoringConfig::from_config`（`score/mod.rs:121`）：**`llm_backend="cloud"` 为默认**，doc 原文 "always wires the LLM extractor against the cloud provider, using the configured `cloud_llm_model` (defaulting to `summarization-v1`)"。
- `score_chunk` pipeline（`score/mod.rs` doc，§ "Pipeline 1-4"）：always-on regex extractor → cheap signals（**排除 `llm_importance` 权重**）combine → short-circuit：
  - cheap total ≥ `definite_keep_threshold` → admit，**不调 LLM**
  - cheap total ≤ `definite_drop_threshold` → drop，**不调 LLM**
  - 否则 **borderline → 在 ingest 热路径内同步 `.await` 调 cloud LLM extractor**，merge 输出后 recombine
- 守护测试印证：`score/mod_tests.rs:105` `short_circuit_skips_llm_when_cheap_total_is_definite_keep`（`assert_eq!(llm.calls(), 0)`）/ `:125` definite_drop 同理 / `:143` `borderline_chunk_consults_llm`（borderline 确实调 LLM）。
- 仅 3 种 fallback regex-only：`resolve_extractor_model` 不可解析 / `llm_backend=local` 缺 endpoint+model / `build_chat_provider` 失败（注意：build 失败才 fallback；**LLM 慢响应不 fallback，成功但慢的 cloud 调用仍阻塞 ingest**）。

**结论**：OpenHuman 自家 `ingest.rs:1-7` 的 "no LLM in this lane" 对默认 cloud 配置是**过度简化**。真实形态 = **regex-first 两段式 + borderline 同步 LLM**，short-circuit 让多数 chunk 免 LLM 但 borderline band 付 LLM 延迟。

**对 Cat Café（预对照，Step 5 细化）**：模式可学（cheap-signal short-circuit 省 LLM），但若我们 F102 ingest 借鉴，**不能照抄"热路径无 LLM"的措辞**——要写清"borderline 仍同步 LLM，需 timeout/降级"，否则重蹈他们 doc-vs-code 不一致。

## §2. tree_summarizer/engine.rs 610 行 — ✅ **LLM 层级摘要，由 seal/digest job 驱动**

跨猫已交叉追实，本节做架构 owner 综合（不重复追，断环已闭）：

- **类型确认**（46 §1 算法表）：`tree_summarizer/engine.rs` 610 行 = 真 LLM 层级摘要（hour→day→month→year→root），Provider LLM 生成，是 11 个算法组件中仅有的 2 个真 LLM 之一。
- **触发链确认**（砚砚 §2 handler）：engine.rs **不在 ingest 热路径**，由 LLM-bound job 驱动 —— `seal` job（`handlers/mod.rs:357-429`，每次 seal 一层 + label extractor + commit summary + cascade follow-up）/ `digest_daily`（`handlers/mod.rs:488-503`，UTC end-of-day global digest）/ `topic_route` 经 `maybe_spawn_topic_tree → backfill_topic_tree` 触发 summariser（`jobs/types.rs:55-65`）。
- **架构结论**：层级摘要是 OpenHuman "LLM Wiki" 的核心引擎，但被正确隔离在异步 job worker（慢路径），与 §1 热路径 + §3 hotness 解耦。这是扎实工程模式 —— LLM 重活全在可重试 job 队列，hot path 只 enqueue。

## §3. Topic tree hotness router — ✅ **纯算术，非 LLM judge**（遗留 2 闭）

46 §1 已追实（`tree_topic/hotness.rs:7-12`），本节确认 claims-ledger A2 caveat 结案：

- 物化分数 = `ln(mentions+1) + 0.5×distinct_sources + recency_decay(age) + graph_centrality + 2.0×query_hits` —— **纯算术，无 LLM**
- recency decay = 分段线性（≤1d→1.0；1-7d→1.0→0.5；7-30d→0.5→0.0；>30d→0.0，`hotness.rs:63-84`）
- 阈值常数（creation=10.0 / archive=2.0 / recheck_every=100，`tree_topic/types.rs:23-30`）
- **结论**：topic tree 是否物化是**可解释规则阈值**，不是 LLM judge。A2 caveat 结案 ✅。

## §4. Leaf 状态机 pending→admitted→buffered→sealed→dropped — ✅ **转移图闭合**

我 §1（热路径侧）+ 砚砚 §2（job handler 侧）交叉拼出完整转移图：

```
[ingest 热路径]                          [jobs worker 慢路径]
pending_extraction ──(extract_chunk handler: handle_extract)──┬─→ admitted ──(append_buffer)──→ buffered ──(seal)──→ sealed
  │ §1 ingest.rs:251-295 仅 None|pending     │ 砚砚 handlers/mod.rs:51-163        │ handlers:219-354    │ handlers:357-429
  │ 才 reset+enqueue（admitted/buffered/     └─→ dropped（fast-score !kept）
  │ sealed/dropped 不回退，防 re-ingest 重复进树）
  └ flush_stale（handlers:506-526）扫 stale buffer → 强制 enqueue seal
```

- **关键守护**（§1 已钉）：re-ingest 同 content 不把已进度 chunk 打回 `pending_extraction`（`ingest.rs:251-295` pre-upsert snapshot）—— 防重复进同一 summary tree。
- **原子性**（砚砚 §2）：`append_buffer` 在单 tx 内做 buffer upsert + 条件 enqueue seal + lifecycle→buffered，显式消掉 "buffer committed but seal job lost" 的 crash window。
- **结论**：状态机转移有明确 handler 归属 + 单 tx 原子性 + crash recovery（stale lock），工程严谨。转移图闭合 ✅。

## §5. 6 retrieval primitive 排序与一致性 — ✅ **非统一 ranker，recency + 可选 cosine rerank**（我新追）

`tools/impl/memory/tree/mod.rs:10-24` 把 6 个 primitive consolidate 成单一 `memory_tree` tool 用 `mode` 路由。排序逻辑分两类：

| Primitive | 默认排序 | 有 `query` 时 | 语义? | 证据 |
|-----------|---------|--------------|-------|------|
| `search_entities` | `ORDER BY mention_count DESC, last_seen_ms DESC` | **不变**（纯 SQL LIKE，无 rerank） | ❌ 纯 SQL substring | `retrieval/search.rs:109-129`；blank-query guard 防 `LIKE '%%'` dump（`search.rs:41`）；DEFAULT_LIMIT=5/MAX=100 |
| `query_source` | recency：`time_range_end DESC` | cosine 相似度 rerank（embed query → `cosine_similarity` vs node embedding，sim DESC then time，无 embedding 的 hit fallback） | ⚠️ 可选 embedding | `retrieval/source.rs:85-88,149-189` |
| `query_topic` | `score DESC, timestamp DESC` | cosine rerank | ⚠️ 可选 | `retrieval/schemas.rs:160-169`（跨 source/topic/global 三树 + entity 的 materialised root） |
| `query_global` | recency / score DESC | cosine rerank | ⚠️ 可选 | `retrieval/global.rs` 同 source 模式 |
| `drill_down` | 子节点遍历顺序 | cosine rerank 子节点（limit 在 rerank 后取 top-K，relevance-based） | ⚠️ 可选 | `retrieval/drill_down.rs:78-146` |
| `fetch_leaves` | leaf 原序（raw 取回） | n/a | ❌ | `retrieval/fetch.rs` |

**架构结论（直喂 Step 5 对照）**：

- OpenHuman retrieval = **recency-default + 可选 cosine 语义 rerank**，`search_entities` 是纯 SQL 频次-时近排序。
- **无 BM25 / 无 RRF 融合 / 无 consumption 权重 / 无 query-cluster prior** —— 与 46 §4「零反馈闭环」一致：排序信号全是 ingest-time 静态（score/mention/recency/embedding），没有 recall 行为反推。
- 跨树一致性：`query_topic` 按 entity id 跨三树取回 + materialised root，各树独立排序后合并，不做全局再融合。
- **对照 Cat Café F200**：我们是 consumption-weighted RRF（BM25 + vector NN + 消费先验 + MMR dedup）三路融合 + recall_events 闭环。OpenHuman 是单路 recency/cosine、零消费反馈。**不同护城河，不是优劣**（Step 5 细化）。

## Round 2 交付小结 — 47 scope（Memory Tree 核心）completed

| § | 结论 | 状态 |
|---|------|------|
| §1 | Hot path 入口链路追实；**A3 修订 ⚠️partial**（默认 cloud borderline 同步调 LLM） | ✅ R1 |
| §2 | engine.rs 610 = 真 LLM 层级摘要，由 seal/digest/topic_route job 驱动（慢路径，与热路径解耦） | ✅ 交叉闭 |
| §3 | hotness router = 纯算术规则阈值，**非 LLM judge**（遗留 2 结案） | ✅ 交叉闭 |
| §4 | leaf 状态机转移图闭合（热路径+job handler 拼合），单 tx 原子 + crash recovery | ✅ 交叉闭 |
| §5 | retrieval 非统一 ranker = recency + 可选 cosine rerank，无 RRF/消费权重（我新追） | ✅ R2 |

**Memory Tree 核心 verdict（给合流）**：A1「不是 vector store 套壳」✅ 成立 —— 三树 + 6 primitive + 状态机 + job 队列都是真代码；但 A3 措辞需降级（borderline 同步 LLM），retrieval 是 recency/cosine 单路无消费反馈（与 46 零闭环、砚砚 raw provenance 一致收敛）。**47 scope 完成，可进 Step 5+6 合流。**
