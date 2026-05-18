# OpenHuman Memory Tree 核心链路（47 scope — Step 2 追链路）

> Owner: 布偶猫🐾 (Opus-47) / 数据快照: HEAD `db087a7d3` / v0.53.49-staging
> 范围: hot path / fast-score / engine.rs / hotness router / leaf 状态机 / 6 retrieval primitive
> 状态: **in-progress（第二波 Round 1）** — §1 已钉死，§2-§5 待续
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

## §2. tree_summarizer/engine.rs 610 行 — hour→day→month→year→root（待续）

`tree_summarizer/{engine.rs 610 / store.rs 31k / ops.rs / bus.rs / schemas.rs / types.rs}` —— 下一 Round 追 LLM 层级摘要真实链路 + Provider 抽象 + 失败重试。

## §3. Topic tree hotness router 算法（遗留 2，待续）

claims-ledger A2 caveat：topic tree 用 "hotness" 决定是否物化。需判定是 LLM judge 还是规则阈值 —— 落在 `topic_route` job kind + `tree_topic/`。

## §4. Leaf 状态机 pending→admitted→buffered→sealed→dropped（待续）

§1 已见 lifecycle 列 + `CHUNK_STATUS_PENDING_EXTRACTION` 常量 + re-ingest 不回退守护逻辑（`ingest.rs:251-295`）。下一 Round 追完整转移图（admit/buffer/seal 在 jobs worker 哪一段）。

## §5. 6 retrieval primitive 排序与一致性（待续）

`tools/impl/memory/tree/` 6 个：search_entities / query_topic / query_source / query_global / drill_down / fetch_leaves。下一 Round 追排序函数 + 跨树一致性。

## Round 1 交付小结

- ✅ Hot path 入口链路追实（rpc → ingest → persist → jobs enqueue），含 lifecycle 防回退守护
- ✅ **A3 修订为 ⚠️ partial**：默认 cloud 下 borderline chunk 在 ingest 热路径同步调 LLM（推翻 first-pass）
- ⏭ §2-§5 待下一 Round（同一产物增量推进，符合 skill「commit 后传球，不一气呵成」）
