---
doc_kind: research-note
topics: [openviking, open-source-teardown, context-database, memory, retrieval]
created: 2026-06-23
status: draft
source_repo: https://github.com/volcengine/OpenViking
source_commit: 1494bdeae70c06954f81a5d192639871317f2173
authored_by: "@codex"
covers: [scope, claim-ledger, architecture-map, star-features, algorithms, feedback-loops, comparison]
---

# OpenViking Deep Dive

> 第一波拆解：Step 0 + Step 1 + 三条主链路追证。
> 方法：clone 源码到 `/Users/lysander/projects/ref/OpenViking`，从 README claims 追到代码路径、状态突变点、反馈闭环。
> 作者：砚砚 (@codex, gpt-5.5) · 2026-06-23

## 0. Scope

- User question: `https://github.com/volcengine/OpenViking`，按开源组件拆解 skill 开始。
- Project: OpenViking, "The Context Database for AI Agents".
- Source repo: https://github.com/volcengine/OpenViking
- Local path: `/Users/lysander/projects/ref/OpenViking`
- Commit: `1494bdeae70c06954f81a5d192639871317f2173`
- Commit time: `2026-06-24 11:33:41 +0800`
- Last commit subject: `fix(path_lock): restore 'Still waiting for lock' progress logs disabled by #2700 (#2768)`
- Git status at inspection: clean.
- Tags observed locally: `cli@0.4.4`, `python-sdk/v0.1.2`, `v0.4.4`, `v0.4.3`, `v0.4.2`.
- GitHub latest release via `gh repo view`: `v0.4.2`, published `2026-06-17T06:32:35Z`. Caveat: tags are newer than GitHub latest-release metadata.
- GitHub metadata via `gh repo view` at 2026-06-23 PDT: 25,969 stars, 2,012 forks, 62 issues, 182 PRs, updated `2026-06-24T03:33:46Z`.
- Code surface: 2,986 tracked files, about 1,002,279 lines by `git ls-files | xargs wc -l`.
- License: AGPL-3.0.

Claims selected for this first pass:

1. Context database with a `viking://` filesystem paradigm.
2. L0/L1/L2 tiered context loading.
3. Directory recursive retrieval with semantic search.
4. Visualized/observable retrieval trajectory.
5. Automatic session management and "context self-iteration".
6. Benchmark claims across LoCoMo, tau2-bench, and HotpotQA.

## 1. Claim Ledger

| Claim | Source wording | Evidence paths | Verdict | Caveat |
|-------|----------------|----------------|---------|--------|
| Context DB / filesystem paradigm | README calls OpenViking a "Context Database" and says memories/resources/skills are mapped to virtual directories under `viking://`. | `README.md:46-58`, `README.md:692-723`, `openviking/storage/viking_fs.py:4-13`, `openviking/storage/viking_fs.py:246-254`, `openviking_cli/client/base.py:78-166` | Yes, real architecture. | It is a filesystem abstraction over AGFS + vector index, not just a vector DB replacement. Operational complexity is correspondingly higher. |
| L0/L1/L2 tiered loading | README says L0 abstract, L1 overview, L2 full detail are loaded on demand. | `README.md:725-750`, `openviking_cli/client/base.py:134-152`, `openviking/storage/viking_fs.py:1219-1264`, `openviking/storage/viking_fs.py:1266-1323`, `openviking/storage/queuefs/semantic_processor.py:84-93` | Yes, implemented. | L0/L1 generation depends on semantic processing and VLM/LLM quality; missing sidecars return "not ready" fallbacks. |
| Directory recursive retrieval | README says vector retrieval locates high-score directories, then drills down recursively. | `README.md:752-762`, `openviking/retrieve/hierarchical_retriever.py:92-239`, `openviking/retrieve/hierarchical_retriever.py:367-543`, `openviking/storage/viking_fs.py:1343-1562` | Yes, substantive engineering algorithm. | It is still embedding/vector backed; optional rerank and query planning are model-assisted, not deterministic truth. |
| Visualized retrieval trajectory | README says retrieval trajectory is preserved for observability. | `openviking_cli/retrieve/types.py:22-75`, `openviking_cli/retrieve/types.py:129-229`, `openviking_cli/retrieve/types.py:348-370`, `openviking/server/routers/search.py:190-229`, `openviking/server/routers/search.py:232-280`, `web-studio/src/routes/retrieval/-components/retrieval-results.tsx:160-205` | Partly verified. | Data structures and API provenance flag exist. Web Studio first pass shows query plan/results, but I did not find full trace event visualization wired into the retrieval page. |
| Automatic session management / self-iteration | README says session end can analyze execution results and update user/agent memory directories. | `README.md:770-777`, `openviking_cli/client/base.py:293-307`, `openviking/session/session.py:1260-1355`, `openviking/session/compressor_v2.py:230-460`, `openviking/session/compressor_v2.py:500-920`, `openviking/session/memory/memory_updater.py:786-827`, `openviking/session/memory/memory_updater.py:1027-1278` | Yes, procedural memory loop exists. | This is not model-weight learning. Quality is delegated to LLM extraction + templates + later retrieval. |
| Usage feedback changes future retrieval | Sessions can record used contexts/skills and commit updates `active_count`; retriever can blend hotness. | `openviking/session/session.py:513-550`, `openviking/session/session.py:1544-1556`, `openviking/storage/viking_vector_index_backend.py:1273-1292`, `openviking/retrieve/memory_lifecycle.py:19-64`, `openviking/retrieve/hierarchical_retriever.py:545-606`, `openviking_cli/utils/config/retrieval_config.py:7-29` | Real but configurable. | `hotness_alpha` defaults to `0.0`, so usage does not affect final ranking unless enabled. |
| Benchmark superiority | README reports strong gains on LoCoMo, tau2-bench, HotpotQA/RAG datasets. | `README.md:616-674`, `benchmark/locomo/openviking/run_eval.py:1-260`, `benchmark/tau2/vikingbot/README.md:1-24`, `benchmark/tau2/vikingbot/README.md:97-208`, `benchmark/RAG/src/pipeline.py:21-260` | Evidence scripts exist; numbers not reproduced. | I did not rerun benchmarks. Treat README numbers as project claims until independently reproduced. |

## 2. Architecture Map

```text
User / agent / CLI / SDK / Web Studio
  -> HTTP routers, MCP endpoint, Rust ov CLI, Python/Go SDK
  -> ResourceService / Session / Search service
  -> VikingFS facade
  -> AGFS/RAGFS storage + vector index + semantic queue
  -> L0/L1 sidecars, L2 files, memory files, relations, active_count
```

### Entrypoints

- Python package and server:
  - `openviking/server/routers/*.py` exposes resources, content, filesystem, search, sessions, skills, observer, system.
  - `openviking/server/mcp_endpoint.py` exposes MCP tools for find/search/filesystem style access.
- Rust CLI:
  - `crates/ov_cli/src/main.rs` defines `ov read`, `ov abstract`, `ov overview`, `ov find`, `ov search`, skill commands, pack/import/export, observer, system commands.
  - `crates/ov_cli/src/client.rs` maps CLI calls to HTTP endpoints.
- SDKs and integrations:
  - `openviking/client/local.py`, `openviking/async_client.py`, `openviking/sync_client.py`.
  - `sdk/python/openviking_sdk`, `sdk/go`.
  - `openviking/integrations/langchain`.
- UI:
  - `web-studio` is a Vite/React SPA for resources, retrieval, bot sessions, and diagnostics.

### Core Write Path

```text
add_resource(path, to/parent, wait, watch)
  -> ResourceService.add_resource()
  -> ResourceProcessor.process_resource()
  -> parser writes temp tree
  -> TreeBuilder.finalize_from_temp()
  -> ResourceProcessor commits temp tree to final viking:// URI
  -> SemanticQueue
  -> SemanticProcessor generates .abstract.md/.overview.md and vectors
  -> future find/search/read/ls can consume sidecars and L2
```

Evidence:

- `openviking/service/resource_service.py:506-627`
- `openviking/parse/tree_builder.py:39-60`
- `openviking/parse/tree_builder.py:146-210`
- `openviking/storage/queuefs/semantic_processor.py:84-93`

### Core Retrieval Path

```text
find(query, target_uri)
  -> VikingFS.find()
  -> HierarchicalRetriever.retrieve()
  -> query embedding
  -> global vector search for starting points
  -> recursive child search by directory
  -> optional rerank
  -> matched contexts with level and URI suffix

search(query, session_id)
  -> load session info
  -> IntentAnalyzer creates typed queries
  -> same hierarchical retriever per typed query
  -> aggregate memories/resources/skills + query_plan/provenance
```

Evidence:

- `openviking/storage/viking_fs.py:1343-1432`
- `openviking/storage/viking_fs.py:1434-1562`
- `openviking/retrieve/intent_analyzer.py:38-122`
- `openviking/retrieve/hierarchical_retriever.py:92-239`
- `openviking/retrieve/hierarchical_retriever.py:367-543`

### Core Session Memory Path

```text
add_message / used()
  -> Session persists messages.jsonl and L0/L1
  -> commit_session()
  -> archive messages under history/archive_N
  -> phase 2 generates archive summary
  -> SessionCompressorV2 runs LLM extraction
  -> MemoryUpdater applies write/edit/delete ops
  -> writes memory_diff.json
  -> vectorizes touched memory files
  -> active_count increments for used contexts/skills
  -> later retrieval can see new memories and optionally hotness
```

Evidence:

- `openviking/session/session.py:513-550`
- `openviking/session/session.py:1260-1355`
- `openviking/session/session.py:1536-1562`
- `openviking/session/compressor_v2.py:230-460`
- `openviking/session/compressor_v2.py:500-920`
- `openviking/session/memory/memory_updater.py:786-827`
- `openviking/session/memory/memory_updater.py:1027-1278`

### State Stores

- AGFS/RAGFS filesystem mounted behind `VikingFS`.
- Vector store via `VikingVectorIndexBackend` and adapters: local, Qdrant, OpenGauss, VikingDB/Volcengine backends.
- QueueFS semantic and embedding queues.
- Memory files in `viking://user/{user}/memories/...`.
- Resource files in `viking://resources/...` and user/peer scoped resource roots.
- Session archive files under `viking://user/{user}/sessions/{session}/history/archive_N`.
- Relation sidecars such as `.relations.json`.
- Usage counters in vector records: `active_count`.

### Extension Points

- Parser/resource ingestion pipeline.
- VLM, embedding, rerank, query planner providers.
- Vector DB adapters.
- Skill ingestion and semantic skill search.
- MCP endpoint and LangChain integration.
- Web Studio and SDK client layers.
- Watch tasks for resource reprocessing.

### Empty / Placeholder Dirs

`find . -type d -empty` only showed `.git/objects/info` and `.git/refs/tags`. No obvious empty product-module placeholders in tracked source.

## 3. Star Feature Deep Dives

### 3.1 Filesystem Context Paradigm

- Public API / command:
  - `BaseClient.ls/tree/stat/mkdir/rm/mv/read/abstract/overview/write/find/search/grep/glob`.
  - HTTP `content/read`, `content/abstract`, `content/overview`, `search/find`, `search/search`.
  - Rust CLI dispatch for `Read`, `Abstract`, `Overview`, `Find`, `Search`.
- Core modules:
  - `openviking/storage/viking_fs.py`
  - `openviking_cli/client/base.py`
  - `openviking/server/routers/content.py`
  - `openviking/server/routers/search.py`
- State mutation:
  - Writes go through VikingFS, which also updates vector index on rm/mv and semantic refresh on content write.
  - Resource ingestion commits temp parse output to final `viking://` URI.
- Future behavior:
  - New files and generated sidecars become searchable/readable by URI.
  - Directory abstracts influence agent-facing `tree/ls` output and retrieval starting points.
- Tests:
  - API filesystem tests under `tests/api_test/filesystem`.
  - CLI filesystem/search tests under `tests/cli`.
  - VikingFS/retrieval tests under `tests/misc/test_vikingfs_find_without_rerank.py`, `tests/server/test_api_search.py`.
- Verdict:
  - Real. The important product idea is not "store chunks in vectors", but "give agent URI-addressable context with filesystem operations".

### 3.2 L0/L1/L2 Tiered Context

- Public API / command:
  - `read(uri)` is L2.
  - `abstract(uri)` is L0.
  - `overview(uri)` is L1.
- Core modules:
  - `BaseClient` defines the contract.
  - `VikingFS.abstract()` and `VikingFS.overview()` read `.abstract.md` and `.overview.md`.
  - `SemanticProcessor` generates sidecars bottom-up.
- State mutation:
  - `SemanticProcessor` writes sidecars during async semantic processing.
  - Session writes also maintain `.abstract.md` and `.overview.md` for current session and archive.
- Future behavior:
  - Search results can return level 0/1/2 URIs.
  - Agent can drill from L0/L1 to L2 via URI.
- Tests:
  - `tests/api_test/filesystem/test_get_abstract.py`
  - `tests/api_test/filesystem/test_get_overview.py`
  - semantic processor and session context tests.
- Verdict:
  - Real mechanism. The quality boundary is summarization quality and readiness of semantic sidecars.

### 3.3 Directory Recursive Retrieval

- Public API / command:
  - `find` is semantic search without session context.
  - `search` is semantic search with optional session context and intent analysis.
- Core modules:
  - `VikingFS.find/search`
  - `IntentAnalyzer`
  - `HierarchicalRetriever`
  - vector store backend
- State mutation:
  - Retrieval itself mostly reads state and records telemetry.
  - If session later calls `used()` and commits, used result URIs can update `active_count`.
- Future behavior:
  - With `hotness_alpha > 0`, usage can affect ranking.
  - With session context, `search()` changes query plan through LLM intent analysis.
- Tests:
  - `tests/server/test_api_search.py`
  - `tests/api_test/retrieval/test_find.py`
  - `tests/api_test/retrieval/test_search.py`
  - `tests/misc/test_vikingfs_find_without_rerank.py`
- Verdict:
  - Real algorithmic core: embedding retrieval, priority-queue recursive directory expansion, score propagation, optional rerank. Not pure graph RAG; README table itself calls OpenViking "Vector retrieval" in HotpotQA comparison.

### 3.4 Session Self-Iteration

- Public API / command:
  - `create_session`, `add_message`, `used`, `commit_session`.
- Core modules:
  - `openviking/session/session.py`
  - `openviking/session/compressor_v2.py`
  - `openviking/session/memory/memory_updater.py`
- State mutation:
  - Writes session archive `.abstract.md`, `.overview.md`, `.meta.json`.
  - Writes `memory_diff.json` to archive.
  - Applies memory write/edit/delete operations.
  - Vectorizes touched memory files.
  - Increments `active_count` for used contexts/skills.
- Future behavior:
  - New memories and vector records enter future retrieval.
  - Usage counters can influence future ranking if hotness is enabled.
- Tests:
  - `tests/session/test_session_commit.py`
  - `tests/session/memory/test_memory_diff.py`
  - `tests/session/memory/test_compressor_v2.py`
  - `tests/integration/test_compressor_v2_e2e.py`
- Verdict:
  - Real procedural memory loop. It is not automatically validated "improvement"; it is a loop that can improve if extraction quality and ranking configuration are good.

## 4. Algorithm Peel Table

| Mechanism | Input | Output | Type | Code path | Mutates future behavior? |
|-----------|-------|--------|------|-----------|---------------------------|
| Viking URI filesystem | `viking://` URI + request identity | AGFS path + access-controlled file operation | Engineering abstraction + rules | `openviking/storage/viking_fs.py` | Yes, for write/rm/mv/link operations |
| L0/L1 sidecar generation | Parsed resource tree or session archive | `.abstract.md`, `.overview.md`, vectors | LLM summarization + queue orchestration | `openviking/storage/queuefs/semantic_processor.py`, `openviking/session/session.py` | Yes |
| Hierarchical retrieval | Query embedding, target directories, vector index | Ranked contexts, searched directories | Engineering algorithm | `openviking/retrieve/hierarchical_retriever.py` | No direct mutation |
| Intent analysis | Session summary, recent messages, current query | Typed queries | LLM planner | `openviking/retrieve/intent_analyzer.py` | No direct mutation |
| Rerank | Query + candidate abstracts | Reranked scores | External rerank model | `openviking/retrieve/hierarchical_retriever.py:266-296` | No direct mutation |
| Session memory extraction | Messages, archive overview, schemas | Memory write/edit/delete ops | LLM ReAct + structured operations | `openviking/session/compressor_v2.py` | Yes |
| Memory updater | Resolved operations | Memory files, overviews, vectors | Rules + embedding | `openviking/session/memory/memory_updater.py` | Yes |
| Usage hotness | `active_count`, `updated_at` | Hotness score blended into ranking | Heuristic | `openviking/retrieve/memory_lifecycle.py`, `openviking/retrieve/hierarchical_retriever.py:545-606` | Only if `hotness_alpha > 0` |
| Benchmark judge | Generated answer + expected answer/evidence | Accuracy / reward scores | Dataset metric + LLM judge depending benchmark | `benchmark/locomo/*/judge.py`, `benchmark/RAG/src/pipeline.py`, `benchmark/tau2/vikingbot` | No runtime mutation except tau2 train trajectory commit flow |

## 5. Feedback Loops

| Claimed loop | Signal | Decision | State mutation | Future behavior | Verdict |
|--------------|--------|----------|----------------|-----------------|---------|
| Resource ingestion improves context retrieval | New resource content | Parser + SemanticProcessor chooses sidecars/vectors | Writes L0/L1/L2 and vector records | `find/search/ls/tree/read` can discover and drill into it | Yes |
| Session commit extracts long-term memory | Messages, used contexts, tool outputs, user feedback | LLM extraction loop generates memory operations | Memory files, `memory_diff.json`, vectors | Future retrieval can recall memory | Yes, procedural memory |
| Agent experience consolidation | New trajectory memory | Phase 2 reads trajectories and extracts experiences | Experience memory files and source trajectory links | Future agent can retrieve experience | Yes, but LLM quality-dependent |
| Usage affects ranking | `used()` contexts/skills | Commit increments `active_count` | Vector records updated | Hotness can blend into ranking | Partial: configured off by default |
| Retrieval observability optimizes behavior | Query plan/provenance/trace types | Human or agent inspects | No automatic mutation found in first pass | Can debug manually | Partial |

## 6. Community Signals

Top visible issue signals from `gh issue list --search 'sort:reactions-+1-desc'`:

- #1082 "OpenViking Maintainer Map / 模块找人地图与贡献入口" - open, 6 thumbs up.
- #350 "[Feature]: Decoupling Ingestion from Indexing & Summarization" - open, 3 thumbs up.
- #717 "[Feature]: Add knowledge Graphs for Code & relational data" - open, 3 thumbs up.
- #1251 "RFC: dedicated agent content API for stable named memory carriers" - open, active through 2026-06-23.
- #2489 fatal bug: server segfault when started in child process and hit by health/summary checks - open, updated 2026-06-23.
- #1549 bug: events memory L2 stores raw dialogue while L0/L1 unreachable by vector retrieval - open.
- #1595 bug: large text import can consume tens of millions of tokens unexpectedly - open.
- #2256 bug: `api/v1/search/find` mode parameter silently dropped - open.
- #2263 bug: security context omitted from storage identity/account key derivation - open.

Interpretation: users and maintainers are pushing on the exact hard parts: ingestion/indexing separation, graph/code structure, stable agent content APIs, memory layer reachability, token blowups, and security/identity boundaries. That is consistent with a real system under active stress, not a pure demo.

## 7. Cat Café Comparison

| Dimension | OpenViking | Cat Café | Learn / Gap / Do Not Follow | Agent User Fit | Reason |
|-----------|------------|----------|-----------------------------|----------------|--------|
| Context as filesystem | Strong: `viking://`, file ops, sidecars, CLI/API/UI | Strong but more project-specific: docs/memory/tools/anchors | Learn | L1 ✅ / L2 ⚠️ / L3 ✅ | URI-addressed context helps agent continue work. Authority/provenance labels look weaker than our memory authority model in first pass. |
| L0/L1/L2 context layers | Product core | Our L0 native + skill refs + docs anchors; less generalized product API | Learn | L1 ✅ / L2 ⚠️ / L3 ✅ | Their explicit `abstract/overview/read` API is clean. We should not copy blind summarization without provenance labels. |
| Recursive retrieval | Directory-first vector recursion + query planner + rerank | search_evidence has authority/confidence/scope and graph/drilldown split | Learn + Do Not Follow | L1 ✅ / L2 ⚠️ / L3 ⚠️ | Directory recursion is useful. But "score" without source authority can become epistemic flattening. |
| Session self-iteration | Session commit extracts memories/experiences and writes files | Cat Café has persistent memory + feature docs + skills + human/cat review | Learn | L1 ✅ / L2 ⚠️ / L3 ✅ | Real procedural loop. Need peer/CVO quality gates for subjective memory, not only LLM extraction. |
| Usage hotness | `active_count` + recency heuristic, disabled by default | Consumption-weighted ranking exists in memory search | Already aligned | L1 ✅ / L2 ✅ / L3 ⚠️ | Nice that they default off. Usage ranking can drift toward popularity unless authority remains separate. |
| Visual observability | API provenance structures, UI query-plan cards | Cat Café memory returns anchors, authority, drilldown hints | Gap for UI only if full trace is mature | L1 ⚠️ / L2 ⚠️ / L3 ⚠️ | I found data types, not full trace UI in first pass. |
| Benchmarks | Broad scripts and strong README numbers | We usually require harness/verdict provenance | Do Not Follow raw claims | L1 ⚠️ / L2 ⚠️ / L3 ❌ | Scripts exist, but numbers are not reproduced this round. |
| License | AGPL-3.0 | Internal project | Do Not Follow blindly | n/a | AGPL matters for adoption/embedding decisions. |

## 8. First-Pass TL;DR

OpenViking is not a README shell. It has a large, actively maintained implementation around a `viking://` filesystem facade, semantic sidecars, hierarchical retrieval, session memory extraction, SDK/CLI/UI surfaces, and benchmark harnesses.

The main real idea worth learning is: make context an addressable filesystem with L0/L1/L2 drilldown, not an opaque vector result. That matches Cat Café's "agent needs a continuation path" principle.

The main caution is epistemic: OpenViking's retrieval result model carries URI/level/score/provenance, but first-pass evidence does not show authority/confidence/source-tier semantics as explicit as Cat Café memory. For agent users, that means "I can continue" is strong, but "I know what kind of evidence this is" is weaker unless caller conventions add it.

The self-iteration loop is real but should be named precisely: session messages become memory files and vectors through an LLM extraction pipeline. This is procedural memory, not model learning, and not automatic quality improvement without eval/review.

## 9. Next Pass

Recommended next 1-2 products:

1. `architecture-map.md`: full module map with mermaid/ASCII, request flows, and storage/index boundaries.
2. `star-feature-session-memory.md`: deep dive on session commit, memory schemas, extraction prompts, memory operation safety, and tests.
3. Optional later: benchmark audit, only after reading result artifacts/scripts enough to identify sample sizes, judge prompts, seeds, and reproducibility gaps.

[砚砚/gpt-5.5🐾]
