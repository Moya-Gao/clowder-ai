---
doc_kind: research-note
topics: [echomem, memrouter, open-source-teardown, memory-system]
created: 2026-06-25
status: stable
source_repo: https://github.com/tech-innovation-group/EchoMem
source_branch: origin/develop
source_local_path: /Users/lysander/projects/ref/EchoMem-develop
source_commit: c7e4f10642fb30a60c6bd8f5df74ae42565c1756
compared_with_main_commit: 6e42e2b7ba646a062447387efb3e2d8148213923
authored_by: "@codex [砚砚/GPT-5.5🐾]"
reviewed_by: "@opus47 [宪宪/Opus 4.7🐾]"
covers: [architecture, star-features, algorithms, comparison, user-mind]
---

# EchoMem Deep Dive: `origin/develop`

## 0. Scope / Branch Truth

- User correction: `origin/develop` should be treated as EchoMem's real mainline for this teardown.
- Source repo: <https://github.com/tech-innovation-group/EchoMem>
- Analyzed worktree: `/Users/lysander/projects/ref/EchoMem-develop`
- Analyzed commit: `c7e4f10642fb30a60c6bd8f5df74ae42565c1756`
  - Date: `2026-06-25 14:47:27 +0800`
  - Subject: `Merge pull request #75 from ShaoxinLi/feature/memrouter-template`
- Default `origin/main` at analysis time: `6e42e2b7ba646a062447387efb3e2d8148213923`.
- Branch judgment:
  - `main` is a small MemRouter package: route templates + LLM fallback + thin OpenViking adapter.
  - `develop` is a near-whole-project replacement: local-first runtime, `echo://` filesystem, auth, sessions, engine registry, HTTP API, MCP server, `echo0_plugin`, atom/graph/episode memory, and spec-template router.
  - Therefore the old main-branch conclusion "good router, not memory engine" is not the right conclusion for `develop`. The correct statement is: `develop` contains a real local memory runtime, but its memory quality still depends heavily on LLM extraction/summarization and lacks a strong correction/source-tier loop.
- Verification:
  - `python -m compileall -q src tests` passed.
  - `python -m unittest discover -s tests -v` failed in a raw checkout because `src` is not on import path (`ModuleNotFoundError: No module named 'echomem'`).
  - `PYTHONPATH=src python -m unittest discover -s tests -v` ran 374 tests but failed with 30 import errors because the local environment lacks `prometheus-client` (`prometheus_client` import). `pyproject.toml` declares `prometheus-client>=0.25`, so this is a setup/dependency gap in this local verification run, not direct evidence that the tested code paths fail.

## 1. Executive Verdict

EchoMem `origin/develop` is not just "MemRouter with marketing". It has three real layers:

1. Runtime substrate: `EchoMemRuntime`, local workspace layout, tenant-scoped `echo://` filesystem, auth keys, HTTP API, optional MCP server, session/archive/commit service, engine loader.
2. Memory engine substrate: dynamic engine registry plus built-in `echo0_plugin`, which processes `session.committed` events and stores engine projections under `echo://engine/<engine_id>`.
3. Memory algorithms: atom-first extraction/merge, vector and keyword candidate retrieval, graph spreading activation, episode lifecycle/retrieval, layered L0/L1/L2 search, and spec-template recall routing.

The important split:

- Real algorithms: path-safe FS mapping, commit log/gate state machine, template prototype scoring with hard-negative penalty, atom merge heuristics, hybrid atom retrieval/ranking, graph diffusion, episode entity/time/vector fusion, layered search short-circuiting, engine isolation.
- LLM-dependent parts: atom extraction, entity merge/protocol output, session overview/abstract generation, LLM intent classification fallback, LLM recall router, optional cross-encoder rerank, and template evolution / GEPA paths when enabled.
- Weak spots for agent memory: generated memories are not consistently source-tiered as "observed vs inferred", default config enables no engine, MCP is off by default, destructive APIs rely mostly on auth rather than explicit confirmation, and there is no first-class user correction/review loop comparable to Cat Cafe's provenance/drilldown expectations.

My bottom line: EchoMem develop is much stronger than AtomMem/main-branch EchoMem on runtime and agent surface. Its evidence anchors (`source_uri`, `source_turn_ids`, `evidence_text`) are in the same class as Cat Cafe source paths/passages; the remaining gap is epistemic tier labeling (observed vs inferred), honest default configuration, governance, and first-class correction/retract semantics.

## 2. Claim Ledger

| Claim | Evidence paths | Verdict | Caveat |
| --- | --- | --- | --- |
| `develop` is a local-first memory runtime, not just a router | `README.md`, `src/echomem/runtime/runtime.py`, `src/echomem/entrypoints/cli.py`, `src/echomem/entrypoints/server.py` | Supported | Default `RuntimeConfig.default().engine.enabled` is empty, so a bare default workspace has no memory engine until config enables one. |
| `echo://` gives tenant-scoped local storage | `src/echomem/membase/filesystem.py`, `src/echomem/runtime/workspace.py`, `src/echomem/runtime/auth.py` | Supported | Good path containment checks; writes are simple file writes, not an append-only/audit-grade store. |
| Default auth mode is local | `src/echomem/runtime/config.py:29-34` | Supported | Hosted deployment must explicitly override `AuthSettings.mode`; the default creates `local/local_user`. |
| Engines are pluggable and loaded from workspace/built-in locations | `src/echomem/index_engine/engine_loader.py`, `src/echomem/index_engine/engine/echo0_plugin/manifest.json`, `entry.py` | Supported | Dynamic Python import is local-powerful; safety depends on trusting engine directories. |
| Built-in `echo0_plugin` processes session commits into long-term memory | `src/echomem/index_engine/engine/echo0_plugin/application/echo0_memory_engine.py`, `src/echomem/req_coordinator/session_service.py` | Supported | Event path is real; extraction quality depends on downstream echo0 LLM/heuristic pipeline. |
| Recall routing is template-first with LLM fallback | `src/echomem/runtime/config.py`, `src/echomem/runtime/runtime.py`, `src/echomem/memrouter/router/spec_recall_router.py`, `_spec_pipeline.py`, `llm_recall_router.py` | Supported | Router chooses tool calls/engine routing; `echo0_plugin.recall` intentionally strips upstream memory-type hints and runs echo0 full-chain recall. |
| Atom memory is a concrete algorithmic subsystem | `src/echo0/workers/atom_first_pipeline.py`, `src/echo0/workers/raw_atom_extractor.py`, `src/echo0/workers/atom_merge_engine.py`, `src/echo0/index_engine/atom/storage.py`, `retriever.py` | Supported | Atom extraction is LLM; merge in main pipeline is mostly heuristic because `enable_llm_arbitration=False`. |
| Graph memory is real, not just an idea | `src/echo0/index_engine/graph/*`, `src/echo0/provider_adaptor/graph_index/query.py`, `src/echo0/index_engine/search_service.py`, `src/echo0/index_engine/graph/memory_service.py:317-360` | Supported | Search-time retrieval is spreading activation rather than PPR/RWR, but deserves the same non-LLM graph-retrieval credit. Edge half-life decay exists; search-time `write_activation_log` is currently a no-op, so persistence of query activations is not proven. |
| Episode memory is real | `src/echo0/index_engine/episode/*`, `src/echo0/index_engine/search_service.py` | Supported | Episode creation can be heuristic from organized memory and optional LLM event extraction; quality depends on projection quality. |
| MCP surface exists | `src/echomem/entrypoints/mcp/server.py`, `tools.py`, `identity.py`, `tests/entrypoints/mcp/test_mcp_server.py` | Supported | First-batch tools are health/query/transform/prefetch/add/read/list/glob. MCP starts only when `config.mcp.enabled`. |
| Observability exists | `src/echomem/metrics/*`, echo0 token/trace/status writes | Supported | Metrics/trace are operational observability, not a closed eval/correction loop. |
| Template evolution / dream engine are core memory runtime | `src/echomem/workers/template_evolve/*`, `workers/dream_engine/*`, `memory_evolve/*` | Present but not proven core path | Default config disables template evolution; these are large auxiliary/experimental subsystems and should not be counted as always-on memory behavior. |

## 3. Architecture Map

```text
CLI / HTTP API / optional MCP
  -> EchoMemRuntime.open(workspace)
      -> WorkspaceManager
      -> LocalAuthService
      -> LocalFS / TenantBoundFS
      -> EngineLoader + LocalEngineRegistry
      -> LocalEngineService
      -> LocalSessionService
      -> ResourceService / SkillService
      -> LocalRecallOrchestrator
          -> SpecRecallRouter ("template-2")
          -> TemplateRecallRouter ("template")
          -> LlmRecallRouter ("llm")

Session write path:
  session-open/add-message
    -> echo://sessions/<session>/current/*
    -> commit()
       -> echo://system/commit/<session>__<archive>.jsonl
       -> echo://sessions/<session>/history/<archive>/*
       -> EngineEvent(type="session.committed")
       -> LocalEngineRegistry.dispatch()
       -> echo0_plugin.process()
       -> Echo0Core.ingest_from_messages_jsonl()
       -> atom / overview / abstract / vector / graph / episode projections

Recall path:
  /api/retrieval/search or MCP memory_query
    -> RetrievalService.retrieve()
    -> LocalRecallOrchestrator.recall()
    -> first accepted router intent
    -> engine.recall()
    -> echo0_plugin.recall()
    -> Echo0Core.retrieve()
    -> SearchService.search()
       -> L0 current session abstract
       -> L1 overview vector search
       -> L2 episode + summary/short vector + atom + graph + text fallback
```

Important state boundaries:

- Workspace root: `config.json`, `engines`, `auth`, `log`, `tenants`.
- Tenant root: `sessions`, `resources`, `skills`, `traces`, `engines`.
- Engine projection root: `echo://engine/<engine_id>`.
- Built-in engine: `src/echomem/index_engine/engine/echo0_plugin`.

## 4. Star Feature Trace

### 4.1 Runtime + `echo://` filesystem

- Entry: `echomem` CLI and HTTP server.
- Core code: `runtime.py`, `workspace.py`, `filesystem.py`, `auth.py`.
- Algorithmic content:
  - URI parsing and path containment prevent `echo://` escape.
  - Tenant-bound FS rewrites context to the bound tenant.
  - Auth keys are hashed and mapped to tenant/user identity.
- Mutates future behavior:
  - Yes. Sessions/resources/skills/engine projections become durable local state.
- Caveat:
  - `AuthSettings.mode` defaults to `local`, with `default_tenant_id="local"` and `default_user_id="local_user"`. This is fine for local-first use, but hosted/multi-user deployments must explicitly configure stronger auth.

### 4.2 Session archive + commit gate

- Entry: `session-open`, `session-add-message`, `session-commit`, retrieval APIs.
- Core code: `req_coordinator/session_service.py`, `commit_gate.py`, `index_engine/engine_registry.py`.
- Algorithmic content:
  - Current messages are accumulated under `current/`.
  - `commit()` snapshots to `history/<archive_id>/`.
  - A system commit log records stages such as pending/running/completed/failed per engine.
  - Commit gate polls completion and recovers unfinished commits.
- Mutates future behavior:
  - Yes. `session.committed` is the boundary where conversational state becomes long-term engine projection.
- Caveat:
  - Append/write operations are simple read+write file operations, not transactional database writes. Registry completion marking has a lock; broader filesystem writes are not atomic.

### 4.3 Engine plugin architecture

- Entry: `RuntimeConfig.engine.enabled`, engine loader.
- Core code: `engine_loader.py`, `engine_registry.py`, `engine_service.py`.
- Algorithmic content:
  - Engine id path validation.
  - Workspace engine override first, built-in fallback second.
  - Manifest must match engine id and cannot declare projection root.
  - Engine runs behind a bound filesystem and event dispatch contract.
- Mutates future behavior:
  - Yes. Any enabled engine can consume events and populate recall tools/projections.
- Caveat:
  - Dynamic import means plugins are code, not declarative safe extensions.

### 4.4 `echo0_plugin` ingest pipeline

- Entry: engine event `session.committed`.
- Core code: `index_engine/engine/echo0_plugin/application/echo0_memory_engine.py`, `src/echo0/api.py`, `workers/atom_first_pipeline.py`.
- Algorithmic content:
  - Reads committed archive messages.
  - Normalizes transcript blobs.
  - Runs `Echo0Core.ingest_from_messages_jsonl`.
  - Writes commit index/status/trace.
  - Maintains one event loop runner shared by process/recall.
- Mutates future behavior:
  - Yes. Projection files, vector indexes, atoms, graph, episode summaries influence future recall.
- Caveat:
  - Only enabled if `echo0_plugin` is configured. README examples enable it; `RuntimeConfig.default()` does not.

### 4.5 Atom-first memory

- Entry: `Echo0Core.ingest_from_messages_jsonl`.
- Core code: `workers/atom_first_pipeline.py`, `workers/raw_atom_extractor.py`, `workers/atom_merge_engine.py`, `index_engine/atom/storage.py`.
- Algorithmic content:
  - Only user turns are extracted in the main atom pipeline.
  - Extraction is incremental by `last_extracted_turn_id`.
  - Granularity has turn/window/session knobs, but current extractor chooses window mode by default.
  - Existing atoms/overviews are prefetched and injected into extraction prompts to reduce duplicates.
  - JSON repair/validation strips thinking/fences and handles partial malformed output.
  - Merge uses simhash, semantic fingerprint, subject/object/predicate overlap, Jaccard neighbors, contradiction/replacement rules.
  - Main pipeline sets `AtomMergeEngine(..., enable_llm_arbitration=False)`, so ambiguous merge falls to `CONFLICT` rather than LLM judge.
- Mutates future behavior:
  - Yes. Active/superseded atoms, inverted indexes, vectors, relations, entity files, and timeline indexes drive future retrieval.
- Caveat:
  - The atom statements are LLM-extracted facts. `source_uri`, `source_turn_ids`, and evidence text exist, but the product surface still needs clear "observed from source" vs "LLM inferred/generated" labeling.

### 4.6 Layered recall/search

- Entry: `Echo0Core.retrieve()` -> `SearchService.search()`.
- Core code: `index_engine/search_service.py`, `atom/retriever.py`, `episode/retriever.py`, `graph_index/query.py`.
- Algorithmic content:
  - Query normalization strips benchmark wrappers and instruction suffixes.
  - Intent classification uses template regex fast path and optional LLM fallback.
  - Expand level can short-circuit at L0/L1; temporal/order/entity-relation queries force L2.
  - L0 loads current session abstract.
  - L1 searches overview vectors.
  - L2 searches episode, summary/short vectors, atom layer, graph layer, compound subqueries, and text fallback.
  - Atom retrieval combines semantic vector hits, exact keyword/ngram/CJK hits, structured filters, and timeline candidates; then follows linked atoms and ranks with semantic score, confidence, token overlap, subject/object bonus, temporal bonus, vagueness penalty, active status, and optional cross-encoder rerank.
  - Graph retrieval is spreading activation: seed nodes start at 1.0, edge weight and hop decay propagate activation, top-k per hop limits explosion, threshold prunes weak activations, and path edge ids make the recall reason explainable.
  - Graph storage also has edge half-life decay (`temporal_decay = exp(-ln(2) * days_since_last_activation / half_life_days)`) and support-count/significance updates. That gives EchoMem a PPR-like long-term reinforcement shape at the edge layer, though the explicit `write_activation_log` hook is currently a no-op.
  - Episode retrieval fuses entity hints, temporal phrases, semantic vector search, and ongoing episodes.
- Mutates future behavior:
  - Search itself records access logs and can influence recency/access-ranking signals.
- Caveat:
  - `confidence` is retrieval/ranking confidence, not truth confidence. Same hazard as Cat Cafe's prior memory-surface warning.

### 4.7 Spec-template recall router (`template-2`)

- Entry: `LocalRecallOrchestrator` router order default `("template-2", "llm")`.
- Core code: `memrouter/router/spec_recall_router.py`, `_spec_pipeline.py`, `_spec_adapters.py`, `configs/prompts/recall/templates/spec/*.yaml`.
- Algorithmic content:
  - Five stages: normalize query, build features, match template, decide route, build engine tool spec.
  - Normalizer uses placeholder recognition, lexicons, Chinese/English person/place generalization, date/number normalization, contractions, word forms, and stopwords.
  - Matcher embeds query/prototypes/hard negatives and caches template embeddings.
  - Score formula: `positive_score = top1_weight * p1 + top2_weight * p2`; hard-negative risk is `max(0, n1 - p1 + margin)`; final score subtracts `hard_negative_penalty * risk`.
  - Diagnostics expose template count, cache status, top ranking, score components, route decision.
- Mutates future behavior:
  - Router does not learn online by default. Template evolution can be enabled separately.
- Caveat:
  - This router controls tool-call routing. In built-in `echo0_plugin`, recall intentionally ignores upstream `memory_types` hints and runs full-chain echo0 recall to avoid over-narrow misses.

### 4.8 MCP / agent surface

- Entry: `config.mcp.enabled`.
- Core code: `entrypoints/mcp/server.py`, `tools.py`, `identity.py`.
- Tools:
  - `health`
  - `memory_query`
  - `memory_transform`
  - `memory_prefetch`
  - `add_memory`
  - `read`
  - `list`
  - `glob`
- Mutates future behavior:
  - `add_memory` opens a session and stores user/assistant messages.
  - Query/transform/prefetch read retrieval state.
- Caveat:
  - Good first agent surface, but not yet Cat Cafe-grade drilldown/governance. There is no explicit correction/retract/verify memory tool.

## 5. Algorithm Peel Table

| Mechanism | Input | Output | Type | Mutates future behavior? | Notes |
| --- | --- | --- | --- | --- | --- |
| `echo://` path mapping | URI + tenant context | Local path | Deterministic security algorithm | Yes, for reads/writes | Prevents path escape and binds tenant. |
| Auth key identity | `X-Auth-Key` / local default | tenant/user/agent identity | Rule + hashed key lookup | Yes | Local default identity is convenient but weak as hosted security. |
| Session commit gate | Current messages | Archive + engine event + status log | State machine | Yes | Real durable memory boundary. |
| Engine loader | Engine id + manifest | Engine instance | Plugin loading algorithm | Yes | Workspace override + built-in fallback. |
| Raw atom extraction | User turns + context | Candidate atoms | LLM extraction + JSON repair | Yes | Main memory facts are model-generated. |
| Atom merge | Candidate + existing atoms | ADD/UPDATE/REPLACE/NOOP/CONFLICT | Heuristic algorithm | Yes | Simhash/fingerprint/Jaccard/predicate-object rules; LLM arbitration disabled in main pipeline. |
| Atom storage indexes | Atoms | subject/keyword/type/timeline indexes | Indexing algorithm | Yes | Single per-account atoms file plus indexes. |
| Entity merge/protocol | Entity facts/aliases | entity files | LLM + heuristics | Yes | Needs source-tier caution. |
| Overview/abstract | Session messages | summary docs | LLM summarization | Yes | Useful L0/L1 substrate; generated content risk. |
| Vector search | Query embedding | similar chunks/atoms/episodes | External embedding + ANN | No direct learning | hnswlib/pgvector adapters exist. |
| Search intent | Query | memory types/strategy | Regex/template + optional LLM | No | Classifies retrieval plan, not truth. |
| L0/L1/L2 search | Query + budget | context items | Layered retrieval algorithm | Yes, through access logs | Includes short-circuit and force-L2 rules. |
| Atom retriever | Query + filters | atom context items | Hybrid retrieval/ranking | Yes, access logs | Vector + keyword + structured + timeline + link expansion + rerank. |
| Graph diffusion | Seed nodes | related graph context | Spreading activation algorithm | No direct search update observed | Same class of non-LLM graph-retrieval credit as AtomMem PPR/RWR: weighted hop decay, top-k inhibition, path trace, multiple-path reinforcement. |
| Graph edge decay/reinforcement | edge `last_activated_at`, support count, half-life | updated edge weights | Temporal-decay persistence algorithm | Yes | Edge layer has PPR-like long-term reinforcement/decay. `write_activation_log` is currently no-op, so query-result activation persistence remains unproven. |
| Episode retrieval | Query | episode context | Multi-path fusion | No direct learning | Entity, temporal, semantic, ongoing. |
| Compound query split | Multi-entity query | subqueries | Regex heuristic | No | Helps avoid dominant-entity embedding collapse. |
| Text fallback | Sparse results | file scan hits | Fallback search | No | Useful but can be I/O heavy. |
| Spec template scoring | Query/prototype embeddings | route score | Engineering algorithm | No | Top1/top2 positive score minus hard-negative penalty. |
| LLM recall router | Query + tool specs | tool calls | LLM planner/judge | No | Fallback planner, not memory algorithm. |
| Template evolution / GEPA | traces/eval data | candidate templates | Optimization framework | Potentially | Present but disabled by default; do not count as core runtime unless enabled. |

## 6. Feedback Loops

| Loop | Signal | Decision | State mutation | Verdict |
| --- | --- | --- | --- | --- |
| Session commit -> engine projection | Committed messages | Engine dispatch by event type | Archive, commit log, engine projection | Real runtime loop |
| Atom extraction -> future recall | User turns | LLM extraction + merge heuristics | Atoms, indexes, vectors, relations | Real memory loop, LLM-origin facts |
| Atom invalidation/versioning | New atom conflicts/extends old | merge decision | Active/superseded atoms and relations | Real but heuristic |
| Overview/abstract -> L0/L1 recall | Session content | LLM summary generation | Summary docs + vector tier | Real but generated |
| Graph/episode projection -> L2 recall | atoms/entities/events | graph/episode sync | graph nodes/edges, episodes | Real |
| Graph edge half-life | edge activation metadata | temporal decay / retained minimum weight | updated graph edge weights | Real edge-level reinforcement, but search activation logging is not closed |
| Access log/recency ranking | retrieval results | ranking boosts | access log / in-memory access counts | Real ranking loop, not truth loop |
| Template routing diagnostics | query/template scores | route decision | trace only by default | Operational loop |
| Template evolution | trace/eval input | optimizer proposes templates | only when enabled | Potential, not default |
| User correction | user says memory is wrong | no first-class API observed | none | Missing/weak |
| Source-tier governance | observed vs generated memory | no consistent hard label observed | none | Missing/weak |
| Engine failure recovery | engine stage failed | CommitGate calls `transfail`; startup recovery retriggers only unfinished non-terminal commits | failed commit log finalized | Mostly mark-failed-and-skip; retry/backoff policy not evident |

## 7. Comparison: AtomMem, EchoMem Develop, Cat Cafe

| Dimension | AtomMem teardown baseline | EchoMem `origin/develop` | Cat Cafe memory baseline | Judgment |
| --- | --- | --- | --- | --- |
| Product surface | Human demo + benchmark runner; not agent-native | CLI + HTTP + optional MCP + local client | First-party MCP/search/graph/session drilldown | EchoMem is much closer to agent-native than AtomMem. |
| Storage boundary | JSON/project files, benchmark-oriented | Tenant-scoped `echo://` workspace + engine projections | Human-readable docs/traces -> rebuildable SQLite/FTS/vector/graph indexes | EchoMem has a cleaner local runtime boundary; Cat Cafe still wins on source transparency. |
| Main non-LLM algorithm | Graph PPR/RWR rerank | Template scoring, atom merge heuristics, hybrid retrieval, graph diffusion, episode fusion | Hybrid search, RRF/FTS/vector/graph, source drilldown | EchoMem has more algorithm breadth than AtomMem, but not necessarily stronger truth semantics. |
| LLM use | Heavy extraction/judging/organization | Heavy extraction/summary/entity/event/LLM router, but merge can be heuristic | LLM can be used, but memory truth source is anchored to files/events | EchoMem needs source-tier labels because generated atoms can look like facts. |
| Graph | PPR/RWR credit | Spreading activation over association graph, with edge decay/reinforcement hooks | Graph resolve/drilldown for project knowledge | Same class of non-LLM graph-retrieval credit. EchoMem SA is more explainable through path trace/lateral inhibition; AtomMem PPR/RWR has a more classical stationary-distribution basis. Neither verifies truth. |
| Retrieval | Benchmark/demo retrieval | L0/L1/L2 layered recall + atom/episode/graph/text | MCP search/graph/recent/drill-down | EchoMem has a serious recall stack. |
| Provenance | Weak for agent use | `source_uri`, `source_turn_ids`, evidence text exist, but generated/observed boundary is soft | Source paths/passages plus governance/eval culture | EchoMem's evidence anchors are same-class with Cat Cafe anchors; Cat Cafe's real advantage is epistemic tier labels and human-governed source hygiene, not the anchor primitive itself. |
| Correction loop | Missing | Missing/weak | No programmatic retract API either; relies on readable files, review culture, and Knowledge Feed governance | Both need first-class retract/correct tools. Cat Cafe is stronger culturally, not because the tool API is complete. |
| Default surprise | Demo path works | Default config enables no engine, MCP is off, auth mode is local | Cat Cafe tools are explicit surfaces | EchoMem's defaults are onboarding-hostile: README-level capability requires opt-in config for engine/MCP/auth. |

## 8. Agent User-Mind Evaluation

Using the prior "L1/L2/L3" user-mind lens:

- L1: Can an agent continue the task?
  - Verdict: pass.
  - Reason: CLI/HTTP/MCP/local client can search/add/read/list memory. Runtime and engine projections are inspectable enough for a normal agent workflow.
- L2: Can an agent distinguish observation from generation?
  - Verdict: partial.
  - Reason: `source_uri`, `source_turn_ids`, `evidence_text`, traces, and commit archives exist. But atom statements, summaries, entity/event projections, and episode summaries are often LLM-generated, and the output surface does not consistently label source-tier or generated-vs-observed status.
- L3: Can an agent close the loop when memory is wrong?
  - Verdict: fail/partial.
  - Reason: resource/skill/session APIs exist, but I did not find a first-class correction/retract/review memory API. There is no obvious "this memory is wrong; demote/supersede with provenance" loop exposed to the agent.

## 9. What Cat Cafe Should Learn

Good ideas worth borrowing:

- Commit boundary for memory extraction: session current state should not silently become long-term memory; an archive/commit/status boundary is good.
- Engine projection root: `echo://engine/<engine_id>` is a clean ownership boundary for memory plugins.
- Spec-template router diagnostics: expose p1/p2/n1, hard-negative penalty, accepted template, and cache state so routing failures are debuggable.
- Full-chain recall composition: atom + episode + graph + text fallback is more robust than pretending one index solves memory.
- Spreading-activation graph retrieval with path traces and lateral inhibition deserves real algorithm credit; Cat Cafe should study the explainability shape even if we do not copy the exact graph store.
- Evidence anchors (`source_uri`, `source_turn_ids`, `evidence_text`) are worth copying as projection-level primitives. Cat Cafe's differentiator should be the extra epistemic tier label on top of those anchors.
- User-turn-only extraction in the atom pipeline is a conservative way to avoid hallucinated assistant self-talk polluting user memory.
- Heuristic merge first, LLM arbitration disabled by default, is a good taste choice for memory safety.

Do not copy blindly:

- Do not let generated summaries/atoms surface as if they were source facts.
- Do not rely on `confidence` to mean truth. It is ranking confidence unless explicitly grounded.
- Do not make default config look ready while no engine is enabled, MCP is disabled, and auth is local-only.
- Do not ship destructive deletes as normal authenticated API calls without an agent-visible confirmation/audit policy if hosted.
- Do not let two routing layers disagree silently. EchoMem's spec router computes `memory_types`, but `echo0_plugin` pops them and runs full-chain recall; either router or engine should be the contract source of truth.
- Do not put benchmark-specific prompt normalization in the generic search service. EchoMem strips LOCOMO-style wrappers in `SearchService`; that belongs in a benchmark adapter, not production recall.
- Do not hard-code the same threshold default in two places. EchoMem has `_DEFAULT_AUTO_MODE["l0_l1_threshold"] = 0.45` while `__init__` falls back to `0.55`, which is threshold drift waiting to happen.
- Do not count optional GEPA/template-evolution code as a solved eval loop unless it is wired into release/runtime gates.

## 10. Open Questions / Post-Review Notes

1. Is `echo0_plugin` stripping upstream `memory_types` hints the right design tradeoff?
   - Updated judgment after review: technically acceptable as a recall-safety default, but the deeper issue is a double-routing contract mismatch. `SpecRecallRouter` spends real work computing `memory_types`; `echo0_plugin` then `pop`s those hints and runs full-chain recall. Cat Cafe should treat this as a counterexample: either the router is source of truth and the engine trusts it, or the engine is source of truth and the router is diagnostics-only.
2. Should Cat Cafe borrow the commit gate shape?
   - Current judgment: yes. The pending/running/completed/failed status machine and archive boundary are worth copying, but only if sourcePath/source-tier survives from raw event to projection and projection adds epistemic tier labels.
3. Does EchoMem's graph diffusion deserve the same "algorithm credit" we gave AtomMem's PPR/RWR?
   - Current judgment: yes, same class of non-LLM graph-retrieval credit. EchoMem has path trace, multiple-path reinforcement, top-k inhibition, and edge half-life decay. AtomMem has the more classical PPR/RWR mathematical basis. Neither is truth verification.
4. Is template evolution/GEPA part of the evaluated system?
   - Current judgment: no, not for default runtime. It is a present experimental subsystem and follow-up target.
5. How should we phrase the main lesson?
   - Stable phrasing: EchoMem `origin/develop` is a credible local-first agent memory runtime. Commit gate, L0/L1/L2 recall, spreading-activation graph retrieval, spec-router hard-negative penalty, and evidence anchors are real engineering. The trust layer still rests on LLM-extracted atoms plus ranking confidence, and defaults are misleading (`engine.enabled=()`, `mcp.enabled=False`, `auth.mode="local"`). Cat Cafe should copy the runtime mechanics and evidence anchors, then add explicit observed/inferred tier labels and stricter governance.
6. What happens after `engine.process` fails during commit?
   - Current evidence: `LocalEngineRegistry` marks the engine stage `failed` and re-raises; `CommitGate` sees a required stage failed and calls `_on_gate_failed(..., "stage_failed")`; startup recovery retriggers only non-terminal commit logs and finalizes `transfail` logs. I did not find retry/backoff after a terminal failed engine stage. This should stay open because it affects how "durable" the memory commit really is under extraction failure.
