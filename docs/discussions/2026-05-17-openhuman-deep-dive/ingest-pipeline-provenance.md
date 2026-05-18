# OpenHuman Ingest Job + Provenance 链路（砚砚 scope — Step 2）

> Owner: 缅因猫/砚砚 (GPT-5.5) / 数据快照: HEAD `db087a7d3` / v0.53.49-staging
> 范围: async job queue / integrations 真实度 / periodic auto-fetch / raw provenance
> 状态: **second-wave complete for Codex scope** — 可交给 47 做 Step 5 合流
> 方法: open-source-teardown — 每个 claim 追到 `file:line`，断环就降级措辞

## 一句话 verdict

OpenHuman 的 ingest/job/provenance 不是 PPT：job queue 有真实 dedupe、lease、retry、stale-lock recovery、claim-token settlement 和 downstream-priority draining；Gmail/Slack 还有 raw archive → `RawRef` → chunk body reconstruction 的硬 provenance 链。

但两个 marketing 口径要降级：

1. **"118+ integrations" 不是 118 个 native memory ingest provider**。本地 core build 的 `CAPABILITY_TOOLKITS` 是 27 个；production 默认注册的 native provider 只有 Gmail / Notion / Slack 三个（`providers/mod.rs:59-87`, `registry.rs:80-83`）。
2. **"auto-fetch every 20 minutes" 不是每个 integration 都 20 分钟同步**。全局 scheduler tick 是 1200s；真正会 periodic sync 的只有 active connection + registered provider；per-provider 最小间隔是 Gmail 15m / Slack 15m / Notion 30m；direct mode 还有 trigger webhook gap（`periodic.rs:18-24`, `periodic.rs:55-65`, `periodic.rs:195-205`）。

## §1. Job queue 真实度 — ✅ verified

### 六种 job kind

`memory/tree/jobs/types.rs:13-27` 定义 6 个持久化 job kind：

| Kind | Handler | 主要职责 | LLM-bound |
|------|---------|----------|-----------|
| `extract_chunk` | `handle_extract` | 读 full body → fast score / extraction → embedding → lifecycle admitted/dropped → enqueue source append + topic route | yes |
| `append_buffer` | `handle_append_buffer` | 把 chunk/summary 作为 leaf 推进 source/topic L0 buffer，必要时 enqueue seal | no |
| `seal` | `handle_seal` | seal 单层 buffer；source tree 做 label extractor；提交 summary + cascade follow-up | yes |
| `topic_route` | `handle_topic_route` | 根据 entity index 物化/路由 topic tree，enqueue topic append | yes |
| `digest_daily` | `handle_digest_daily` | 生成 global daily digest | yes |
| `flush_stale` | `handle_flush_stale` | 扫 stale buffers，强制 enqueue seal | no |

`JobKind::is_llm_bound()` 明确把 `ExtractChunk / Seal / DigestDaily / TopicRoute` 归入 LLM-bound；注释解释 `TopicRoute` 会经 `maybe_spawn_topic_tree → backfill_topic_tree` 触发 summariser（`types.rs:55-65`）。

### Queue guarantees

| 机制 | 证据 | 结论 |
|------|------|------|
| Active dedupe | `enqueue_conn` 用 `INSERT OR IGNORE`，dedupe key 被 partial unique index 约束 active ready/running row（`store.rs:40-84`） | 同一 active job 不重复入队；完成后同 key 可再次 enqueue |
| Lease claim | `claim_next` 用单条 `UPDATE ... WHERE id=(SELECT ... LIMIT 1) RETURNING`，设置 `running / attempts+1 / started_at / locked_until`（`store.rs:96-150`） | SQLite 写锁下不会双 claim |
| Downstream priority | claim order: `digest_daily` → `seal` → `flush_stale` → `topic_route` → `append_buffer` → `extract_chunk`（`store.rs:107-130`） | 慢 extract 不会饿死下游 digest/seal |
| Retry backoff | base 60s, cap 1h, max attempts 5；未到 max 回 `ready`，到 max 终态 `failed`（`store.rs:35-38`, `store.rs:190-258`） | 失败路径不是 fire-and-forget |
| Claim-token settlement | `mark_done/mark_failed/mark_deferred` 都用 `attempts + started_at_ms` gate（`store.rs:153-188`, `store.rs:190-258`, `store.rs:261-310`） | stale worker 不能覆盖新 lessee |
| Stale lock recovery | startup `recover_stale_locks` 把 expired `running` row 翻回 `ready`（`store.rs:312-331`, `worker.rs:64-71`） | process crash 后 job 不会永久卡死 |
| Defer primitive | `JobOutcome::Defer` 存在并会 revert attempts，不烧失败预算（`types.rs:68-88`, `worker.rs:190-207`） | 机制已接好；但当前 in-tree handler 还没 emit defer（`handlers/mod.rs:34-40`） |

### Worker and scheduler gate

`worker.rs` 起 4 个 worker (`WORKER_COUNT=4`)，每轮先 `wait_for_capacity()` 再 `claim_next()`，避免在 paused/throttled 状态下持有 DB lease（`worker.rs:26-43`, `worker.rs:122-143`）。

一个细节：因为 gate 在 claim 前，**非 LLM jobs 也会被 gate 延迟**。代码注释承认这个 tradeoff：在 Throttled/Paused 下，所有 DB-write batch 都让机器喘口气（`worker.rs:123-139`）。这不是 bug，但它说明 scheduler gate 是 host-level brake，不是严格的 LLM-only semaphore。

## §2. Handler side effects — ✅ verified

### `extract_chunk`: score + enqueue follow-ups in one tx

`handle_extract` 先从 content store 读 full body（SQLite `content` 只是 <=500 字 preview），再 `score_chunk`，kept 时建 embedding；随后在同一个 SQLite tx 里：

- `persist_score_tx`
- chunk lifecycle → `admitted` 或 `dropped`
- enqueue source `append_buffer`
- enqueue `topic_route`

证据：`handlers/mod.rs:51-163`。这条链路直接接上 47 已追实的 hot path：`ingest.rs` 先 persist chunk + enqueue `extract_chunk`，worker 再异步把它推进树。

### `append_buffer`: buffer push + seal enqueue + lifecycle update in one tx

`handle_append_buffer` 读 chunk/summary full body，构造 `LeafRef`，resolve target tree，然后在同一个 tx 里：

- upsert L0 buffer
- 若 `should_seal`，enqueue `seal`
- source-target leaf chunk lifecycle → `buffered`

证据：`handlers/mod.rs:219-354`。这个原子性比 first-pass 想象更扎实：它显式消掉了“buffer committed but seal job lost”的 crash window。

### `seal / topic_route / digest_daily / flush_stale`

- `seal`: 每次只 seal 一个 level；follow-up cascade seal + summary-side topic_route 在 `seal_one_level(..., true)` 的同 tx 内提交（`handlers/mod.rs:357-429`）。
- `topic_route`: 按 entity id `maybe_spawn_topic_tree`，topic tree 存在后 enqueue topic `append_buffer`（`handlers/mod.rs:432-485`）。
- `digest_daily`: parse UTC date → `end_of_day_digest`（`handlers/mod.rs:488-503`）。
- `flush_stale`: 找 stale buffers → enqueue forced `seal`（`handlers/mod.rs:506-526`）。

## §3. Integrations 真实度 — ⚠️ partial / marketing overcount

### Capability matrix: 27，不是 118+

OpenHuman core 本地静态 capability matrix 是 `CAPABILITY_TOOLKITS`，共 **27** 个：

`gmail / notion / slack / github / discord / googlecalendar / googledrive / googledocs / googlesheets / outlook / microsoft_teams / linear / jira / trello / asana / dropbox / twitter / spotify / telegram / whatsapp / shopify / stripe / hubspot / salesforce / airtable / figma / youtube`

证据：`providers/mod.rs:59-87`。

这 27 个里，`native_provider` 只对 Gmail / Notion / Slack 为 true（`providers/mod.rs:89-101`），production startup 也只注册这三个 provider（`registry.rs:80-83`）。其它大多是 curated tool catalog / Composio action allowlist，不是 native memory ingest。

### Native provider 也不是同一条 Memory Tree pipeline

| Provider | Periodic cadence | 真实写入路径 | 进入 Memory Tree? | 证据 |
|----------|------------------|--------------|-------------------|------|
| Gmail | 15m | `GMAIL_FETCH_EMAILS` → `ingest_page_into_memory_tree` → per-message `ingest_email` + `RawRef` | yes | `gmail/provider.rs:1-20`, `gmail/provider.rs:119-121`, `gmail/ingest.rs:240-275` |
| Slack | 15m | `SLACK_FETCH_CONVERSATION_HISTORY` → per-message `ingest_chat` + `RawRef` | yes | `slack/provider.rs:1-32`, `slack/provider.rs:103-105`, `slack/ingest.rs:103-145` |
| Notion | 30m | `NOTION_FETCH_DATA` → `persist_single_item` → `store_skill_sync` | **no, not Memory Tree** | `notion/provider.rs:1-16`, `notion/provider.rs:77-79`, `notion/provider.rs:283-292`, `sync_state.rs:301-335` |

这里有个重要 caveat：`ComposioCapability.memory_ingest` 的布尔值目前等于 `native_provider`（`providers/mod.rs:113-126`, `composio/types.rs:74-95`），所以 Notion 会被标成 `memory_ingest=true`。但 Notion 的实际写入是 namespace memory document，不是 `memory/tree` chunk/job pipeline。这个字段如果对外解释成“进入 Memory Tree”，会误导。

### Auto-fetch 真实 cadence

全局 periodic scheduler 是一个 tick loop：

- 实际 const `TICK_SECONDS = 1200`，也就是 20 分钟（`periodic.rs:55-65`）。
- 每次 tick 扫 active Composio connections；无 registered provider 就跳过；provider 没 `sync_interval_secs` 也跳过（`periodic.rs:185-205`）。
- per-provider due check 依赖 process-global `LAST_SYNC_AT` map；成功才 `record_sync_success`，失败不更新，下个 tick 继续试（`periodic.rs:208-239`）。
- direct mode 下同步 tool execution 和 periodic poll-based sync 可以跑，但 real-time `composio:trigger` webhook 不到 core（`periodic.rs:18-24`）。

**小问题**：`periodic.rs` 文件顶部 design notes 还写“One global tick (5min)”（`periodic.rs:27-39`），但实际 const 是 1200s；这是 doc drift，不影响运行但会误导读源码的人。

### Scheduler gate

Scheduler gate 的真实信号是 power/CPU/server mode，不是网络：

- signals: AC/battery >=80%、CPU <70%、server/container mode（`scheduler_gate/mod.rs:8-17`）。
- policy: explicit Off → Paused；AlwaysOn/server → Aggressive；`require_ac_power` on battery → Paused；CPU severe → Paused；否则 battery/cpu 不满足 → Throttled（`policy.rs:78-151`）。
- `wait_for_capacity` 在 Aggressive/Normal 立即拿 permit，在 Throttled 先 sleep，在 Paused poll（`gate.rs:389-465`）。

因此 README/文档层若把它讲成“battery / network / idle gate”，源码里我只看到 battery + CPU + deployment mode；**network gate 没追到真实实现**。

## §4. Provenance 链路 — ✅ verified, with gap

### Chunk ID: content-addressed-ish

`chunk_id` 是：

```text
sha256(source_kind | "\0" | source_id | "\0" | seq | "\0" | content)[0..32]
```

证据：`types.rs:256-279`。这不是“纯 content hash”，而是 `(source_kind, source_id, seq, content)` 混合；好处是相同 source 下重复 ingest 同一 canonical content 仍稳定 upsert，不同 source/seq 不冲突。

`chunker` 默认 `DEFAULT_CHUNK_MAX_TOKENS = 3000`，chat/email 按消息边界再 greedy pack；document 按 paragraph budget（`chunker.rs:28-39`, `chunker.rs:57-83`）。所以 A4 可以从 ❓ 升到 ✅，但措辞应是“≤3k token 预算 + deterministic id”，不是“纯 content-addressed ID”。

### Raw archive: source bytes 独立于 chunker

`content_store/raw.rs` 明确把 raw provider items 写到：

```text
<content_root>/raw/<source_slug>/<kind>/<created_at_ms>_<uid>.md
```

原始文件 atomic write (`tempfile + rename`)；同一 `(source, uid, ts)` 路径重写是 idempotent（`raw.rs:1-24`, `raw.rs:88-138`）。

这条设计比单纯把 chunk content 存 SQLite 更可靠：raw 是“上游事实”，chunk 是“派生表示”。我们 F200 HW-4 刚修的 `sourcePath` / `resultSetId` / `provenance_json` 本质也在补同一类断链。

### Gmail/Slack: raw → RawRef → read_chunk_body

Gmail per-account path：

- 先 best-effort 写 raw archive，避免 chunker bug 阻塞 source bytes 捕获（`gmail/ingest.rs:250-260`）。
- 每个 upstream message 单独 `ingest_email`，成功后给每个 chunk 写 `RawRef { path, start:0, end:None }`（`gmail/ingest.rs:327-385`）。

Slack path类似：

- source id 是 `slack:{connection_id}`，workspace-wide，不按 channel 分 source（`slack/ingest.rs:7-20`）。
- 每条 message 单独 `ingest_chat`，成功后写 `RawRef` 到 chunk（`slack/ingest.rs:103-145`, `slack/ingest.rs:148-217`）。

`RawRef` 持久化在 `mem_tree_chunks.raw_refs_json`，`read_chunk_body` 先尝试 raw_refs；有 raw_refs 就从 raw archive 读，不走 `content_path`（`store.rs:791-835`, `content_store/read.rs:142-160`）。

这个链路是 OpenHuman 最值得我们学习的一块：**raw source artifact 和 derived chunk 明确解耦**，而且 read path 用结构化指针，不靠重新 parse 渲染文本。

### Gap: Notion 没有同级 raw provenance

Notion provider 写的是 `persist_single_item(... "notion" ...)`，落到 `store_skill_sync` 的 namespace memory（`notion/provider.rs:283-292`, `sync_state.rs:301-335`）。我没有看到 Notion page 进入 `memory/tree/ingest_document`，也没有看到 Notion raw archive + RawRef。

所以“native provider 3 家”要再拆：

- **Memory Tree native ingest with raw provenance**：Gmail / Slack
- **Namespace-memory incremental provider**：Notion

这也解释了为什么 `memory_ingest = native_provider` 这个矩阵字段偏粗。

## §5. 对 Cat Café 的可学习点

### Learn

1. **Raw artifact first**：先保存 raw source，再派生 chunk/summary/eval。F200 HW-4 之后我们已经开始补 `sourcePath` 和 `provenance_json`，OpenHuman 的 RawRef 模式证明这条路工程上成立。
2. **Job settlement 要有 claim token**：`attempts + started_at_ms` gate 很干净，能防 stale worker settlement 覆盖当前 worker。
3. **Capability matrix 要拆 tier**：OpenHuman 同时暴露 `native_provider / curated_tools / periodic_sync / memory_ingest` 是好方向；但字段语义还可以更细。我们未来写 MCP/tools 能力说明时，也应该显式区分“可调用工具”与“可自动摄入记忆”。
4. **Downstream-priority draining**：job queue 不按 FIFO，而优先 drain digest/seal/flush/topic_route，避免 heavy extract 堆积堵后续。

### Gap / Follow-up

1. **`memory_ingest` 语义过宽**：Notion 不进 Memory Tree，却被矩阵标 true。若 47 做 Step 5 对比，需要避免把三家 native provider 都说成 raw-provenance Memory Tree ingest。
2. **periodic doc drift**：`periodic.rs` 注释写 5min，但 const 是 20min。claims-ledger E2 应以 const 为准。
3. **Defer 已接线但未使用**：job outcome 支持 defer，handler 注释也承认 in-tree handler 还没 emit。这不是 P0，但说明 rate-limit graceful defer 还不是完整闭环。
4. **Notion provenance 不如 Gmail/Slack**：如果 OpenHuman 未来要把 Notion 也当 LLM Wiki source，应该给 page raw archive + tree ingest/document path。

### Do Not Follow

1. 不要把 catalog 数字说成 native memory integrations。我们自己的工具/技能对外也要避免这种“平台能力 ≠ 已落地链路”的混淆。
2. 不要写“no LLM hot path”这种过强文案，除非代码保证所有默认路径都不 await LLM。47 已经钉死 OpenHuman 默认 cloud borderline 会同步 LLM。
3. 不要让 eval/recall attribution 依赖渲染文本重解析。OpenHuman 的 RawRef 正例和我们 F200 HW-4 的反例指向同一教训：机器链路要吃结构化 provenance。
