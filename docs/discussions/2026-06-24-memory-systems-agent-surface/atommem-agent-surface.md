---
doc_kind: research-note
topics:
  - atommem
  - open-source-teardown
  - memory
  - retrieval
  - mcp
  - agent-surface
created: 2026-06-24
status: draft
source_repo: https://github.com/MINE-USTC/AtomMem
source_local_path: /Users/lysander/projects/ref/AtomMem
source_commit: 776f880941a02b10c495c126fe775d5e88ede5d4
source_commit_date: 2026-06-14 13:44:45 +0800
source_status: source files clean; untracked __pycache__ directories present and ignored
baseline_report: ./cat-cafe-memory-agent-surface.md
prior_report: ../2026-06-24-atommem-deep-dive/README.md
authored_by: "@codex"
covers:
  - mcp-surface
  - demo-api-surface
  - python-surface
  - retrieval-recall
  - raw-drilldown
  - sft-data-branch
  - comparison
---

# AtomMem Agent Surface Deep Dive

This is report 3 in the memory-system comparison series. It inspects AtomMem only, using the Cat Cafe baseline axes from `cat-cafe-memory-agent-surface.md` and the OpenViking agent-surface report as the production-system contrast.

Scope boundaries:

- Focus: agent-facing contract, demo/HTTP/Python surfaces, retrieval/recall chain, raw drill-down, SFT fact-extractor branch, and 9-axis comparison.
- Out of scope: redoing the full AtomMem architecture teardown. That lives in `../2026-06-24-atommem-deep-dive/README.md`.
- Source snapshot: `/Users/lysander/projects/ref/AtomMem` at `776f880941a02b10c495c126fe775d5e88ede5d4`.
- Worktree note: tracked source files are clean; untracked `__pycache__/` directories exist and were ignored.

## 0. Executive Verdict

AtomMem does not have an MCP or tool surface for agents. The public surfaces are:

1. A local FastAPI browser demo.
2. A benchmark/evaluation CLI.
3. Python classes such as `AtomMemGraphQueryResponder` for internal pipeline use.

That matters. Cat Cafe and OpenViking expose agent-callable memory tools. AtomMem exposes a research/demo pipeline that an agent runtime would have to wrap itself.

The real retrieval path is not fake:

```text
query
  -> LLM query intent: people / keywords / time / need_attribute
  -> sentence-transformer embedding
  -> base retrieval:
       facts: cosine embedding 0.7 + keyword Jaccard 0.3
       events: same scoring, then event compensation
       profiles: person filter + embedding/keyword score
  -> graph rerank:
       seed facts -> keyword/event/turn graph -> PPR/RWR
  -> answer LLM over selected facts/profiles
```

The agent-surface problem is that the useful bits are not packaged as agent tools. The demo `/api/chat` returns only `session_id` and `assistant_message`; the richer evidence appears in `/api/memory/{session_id}` snapshots or Python return values, not in an MCP-like contract with raw read, grep, correction, or provenance tools.

SFT clarification: the user memory was right that AtomMem includes a small-model/fine-tuning branch, but the precise claim is narrower. The repo provides `data/SFT_training_data.json` with 4352 instruction/output records for building a Fact Executor. It does not ship trained weights, a training script, LoRA/PEFT config, or a small-model benchmark table. So this is **BYO fine-tuning data**, not a delivered small fact-extractor model.

Compared with the other two:

- Cat Cafe: agent-facing MCP + BM25/FTS/vector hybrid + epistemic labels + raw drill-down.
- OpenViking: broad MCP + raw URI read + exact grep/glob/code tools + tenant scoping, but weak epistemic labels.
- AtomMem: graph rerank and temporal profiles are interesting, but the agent surface is absent and raw/correction paths are not exposed.

## 1. Claim Ledger

| Claim | Verdict | Evidence | Caveat |
| --- | --- | --- | --- |
| AtomMem has no first-class MCP surface. | Supported | Source scan for `MCP`, `FastMCP`, `@mcp.tool`, and Model Context terms found no MCP implementation; README only documents demo/eval usage. | It could be wrapped by another project, but this repo does not provide that wrapper. |
| Public HTTP surface is a local demo, not an agent API. | Supported | `scripts/run_demo_server.py:562-603` defines FastAPI endpoints for `/`, `/api/defaults`, `/api/session`, `/api/memory/{session_id}`, `/api/chat`, and `/api/flush-profiles`. | Useful for humans watching a live memory panel; not a typed memory tool contract. |
| Demo chat output does not return retrieval evidence. | Supported | `OnlineAtomMemSession.answer` returns only `session_id` and `assistant_message` in `scripts/run_demo_server.py:278-311`. | `/api/memory/{session_id}` exposes a full snapshot, but it is a separate human/debug endpoint. |
| Python `answer_query` returns richer retrieval artifacts. | Supported | `scripts/run_atommem_pipeline.py:379-396` returns `answer`, `retrieved_evidence`, `retrieved_facts`, `retrieved_profiles`, `event_contexts`, `graph_debug`, `query_info`, latency. | This is internal Python shape, not an MCP/agent surface with schemas and recovery tools. |
| AtomMem includes SFT data for a Fact Executor. | Supported | README says `data/SFT_training_data.json` helps users fine-tune their own Fact Executor; the file contains 4352 instruction/output records. | No training script, model weights, adapter config, or small-model metric table found. |
| Retrieval is not BM25+embedding hybrid. | Supported | `src/retrieval.py:154-158`, `220-235`, and `254-265` combine embedding cosine and keyword Jaccard; no FTS/BM25 index is present. | Keyword Jaccard helps, but it is not Cat Cafe-style BM25/FTS + vector RRF. |
| Graph rerank is real and on the QA path. | Supported | `AtomMemGraphQueryResponder` defaults `enable_graph=True`; `scripts/run_atommem_pipeline.py:346-355` builds `MultiChannelFactGraphIndex` and calls `SeedOnlyGraphReranker.retrieve_ranked_topk`; `graph_rerank.py:116-191` runs seed graph ranking. | The graph is per-query/local, not a persistent graph DB; it reranks selected facts only. |
| Raw evidence drill-down is weak. | Supported | Results expose `dia_id` and `fact_id`; no `read(dia_id)`, `grep`, or raw conversation expansion tool exists in HTTP/Python surface. | Raw LoCoMo split samples are in `data/split_samples`, but the agent must know dataset internals to recover them. |
| Multi-tenant / concurrency isolation is absent. | Supported | `FileStorage` writes `facts_{conversation_id}.json`, `events_{conversation_id}.json`, `profiles_{conversation_id}.json` under global `config.FACTS_DIR` in `src/file_storage.py:16-29`; demo mutates module-global LLM config in `run_demo_server.py:272-276`. | Demo has per-session `RLock`, but that does not make file storage or module globals multi-tenant safe. |
| Epistemic source-tier labeling is absent. | Supported | Fact/profile/result schemas use IDs, scores, people, keywords, time, event IDs; source-tier/authority/observed/generated/correction fields are not part of the surface. | `dia_id` is weak provenance, but it does not distinguish observation from generation. |

## 2. Agent-Facing Surface Map

### 2.1 No MCP

AtomMem has no MCP endpoint, no tool registry, and no agent-tool schema. That is the first comparison point, not a footnote. For an agent runtime, "use AtomMem" currently means one of:

- Run its Python classes in-process.
- Call the local demo's HTTP endpoints.
- Reimplement a wrapper around its storage/retrieval code.

There is no equivalent of:

- Cat Cafe `cat_cafe_search_evidence` / `graph_resolve` / `list_recent`.
- OpenViking `search` / `read` / `grep` / `glob` / `remember`.

### 2.2 Demo HTTP Surface

`scripts/run_demo_server.py` exposes:

| Endpoint | Purpose | Agent-surface verdict |
| --- | --- | --- |
| `GET /` | Serve browser UI. | Human demo only. |
| `GET /api/defaults` | Return configured model defaults. | UI setup helper. |
| `POST /api/session` | Create a session from submitted LLM/fact-extractor settings. | Creates state, but accepts per-session credentials and later writes some into global config. |
| `GET /api/memory/{session_id}` | Return full snapshot: messages, facts, events, profiles, status. | Debug/inspection endpoint; not scoped by auth or designed as an agent search/read tool. |
| `POST /api/chat` | Answer one user message from existing memory, then schedule background memory extraction. | Main demo path, but returns only assistant message. |
| `POST /api/flush-profiles` | Force pending profile extraction. | Coarse maintenance action, not a correction API. |

The demo loop is:

```text
chat(user_message)
  -> retrieve memory from current JSON state
  -> generate answer
  -> append user/assistant message to demo session
  -> background task extracts facts from user turn
  -> write facts/events/profiles JSON
```

This is a good browser demonstration, but poor as an agent tool. The caller does not get retrieval evidence in the chat response and cannot ask the API to "read the raw turn for D17" or "mark fact F3 as user-verified."

### 2.3 Python Surface

The real developer-facing surface is Python:

- `AtomMemPipeline` builds memory and owns `query_responder`.
- `AtomMemGraphQueryResponder.answer_query(query, category=None)` runs intent extraction, base retrieval, optional graph rerank, and answer generation.
- Return shape includes:
  - `query`
  - `answer`
  - `retrieved_evidence` as `dia_id` list
  - `retrieved_facts`
  - `retrieved_profiles`
  - `event_contexts`
  - `graph_debug`
  - `retrieval_rounds`
  - `query_info`
  - `latency_breakdown`

This is better than the demo `/api/chat` response because it exposes facts and graph debug. But it is still not an agent contract:

- No JSON schema documented for external tool callers.
- No raw read function by `dia_id`.
- No exact lexical search or grep.
- No correction/writeback API.
- No tenant/security boundary.
- No epistemic labels.

### 2.4 SFT Fact Executor Branch

AtomMem has two fact-extraction modes:

- Prompted OpenAI-compatible fact extractor, used by demo and end-to-end extraction.
- Public SFT dataset for users to train their own fact executor.

The SFT branch is a positive reproducibility signal compared with a pure README claim: the data exists and is inspectable. But the repo stops before a delivered model:

- `data/SFT_training_data.json` exists and contains 4352 `{instruction, output}` records.
- README says this is to "help you fine-tune your own Fact Executor model."
- Source scan found no training script, LoRA/PEFT config, trainer invocation, model weights, or small-model evaluation table.

So the correct wording is:

```text
AtomMem provides SFT data for BYO fact-extractor fine-tuning.
It does not provide a trained small fact-extractor model.
```

## 3. Retrieval / Recall Chain

### 3.1 Base Retrieval

`LayeredRetriever.retrieve_for_query` returns facts, profiles, and event contexts.

Fact retrieval:

1. Main recall filters facts by people/time.
2. It scores candidates with:

   ```text
   score = 0.7 * cosine(fact.embedding, query.embedding)
         + 0.3 * jaccard(fact.keywords, query.keywords)
   ```

3. It returns top facts.
4. Compensation recall retrieves top events, expands event facts, and fuses event score with fact self-score.

Profile retrieval:

1. Filter profiles by person.
2. Score with the same embedding + keyword formula.
3. Apply temporal profile version filter in the newer responder chain.

This is a simple hybrid, but not BM25. It has no inverted index, no exact anchor protection, and no RRF fusion of independent lexical/vector result sets.

### 3.2 Graph Rerank

Graph rerank is the strongest algorithmic component:

1. Seed facts come from base retrieval.
2. `MultiChannelFactGraphIndex` builds:
   - keyword -> facts
   - event -> facts
   - turn -> facts
3. `SeedOnlyGraphReranker` normalizes seed scores.
4. It builds a local node set around seeds using keyword/event/turn neighbors.
5. It builds channel adjacency.
6. It runs PPR/RWR from seed scores.
7. It returns top ranked facts and `graph_debug`.

This is real engineering algorithm content. It is also not a full agent memory surface. The graph improves the answer context, but it does not give the caller a navigation graph or raw read path.

### 3.3 Benchmark Category Coupling

`answer_query(category=...)` can choose different answer prompts:

- default prompt
- category 2 temporal prompt
- category 3 commonsense prompt

`scripts/run_atommem_pipeline.py:486` passes `item.get("category")` from question items into `answer_query`. That is benchmark-aware answer generation, not a general deployment assumption. A production user query will not normally arrive with a LoCoMo category label.

### 3.4 Recall Output Shape

Python output contains useful anchors:

- `fact_id`
- `dia_id`
- `event_ids`
- `profile_id`
- `score`
- `graph_score`
- `is_graph_seed`
- `query_info.people/keywords/time`

Missing for agent closure:

- raw source text for `dia_id`
- source file/line/turn read API
- authority/source-tier
- observed vs generated
- correction status
- verification status
- exact-search fallback path
- tenant/account scope

## 4. Raw Drill-Down / Exact Recovery

AtomMem has weak anchors but no drill-down surface.

What exists:

- `dia_id` on facts.
- `fact_id` on facts.
- `profile.evidence` / `history[]` in temporal profiles.
- LoCoMo raw data in `data/split_samples`.
- Full demo snapshot through `/api/memory/{session_id}`.

What does not exist:

- `read(dia_id)`.
- `read_fact(fact_id)` as a documented API.
- `grep` / `glob` / exact lexical search.
- Raw dialogue expansion from a retrieval hit.
- Line-numbered or turn-numbered raw evidence in the answer result.
- Structured "this generated fact came from this raw message span" provenance.

This is the main agent-usability failure. An agent can see `D17`, but the repo does not give it a first-class way to ask "show me the original turn D17." That forces wrapper code or dataset-specific knowledge.

## 5. State Mutation / Feedback Loop

AtomMem has real memory-write loops:

| Loop | Signal | Decision | State mutation | Future behavior | Verdict |
| --- | --- | --- | --- | --- | --- |
| Demo turn -> facts | User message | Fact extractor LLM | Append/update facts JSON | Future chat uses facts | Real loop |
| Facts -> events | New fact + existing events | Similarity prefilter + LLM same-event decision | Mutate event `fact_ids`, fact `event_ids`, event summary | Event compensation and graph event edges change | Real but LLM-judged |
| Facts -> profiles | Profile-worthy pending facts | LLM extraction + temporal merge decision | Add/update profile with version history | Attribute queries retrieve profile | Real but LLM-judged |
| Retrieval -> answer | Query + selected facts/profiles | Answer LLM | No memory mutation | Current answer only | Retrieval loop |
| Eval -> runtime | F1/BLEU/Recall/Judge label | None | None | No automatic correction | Missing |
| User correction -> memory repair | User says memory is wrong | No tool/API | None, unless manual JSON/code | No governed correction path | Missing |

The demo writes memory after the assistant reply appears. That is an intentional UX decision: answer current turn from existing memory, then update memory in background. It is fine for a demo. It is not sufficient for agent memory correctness because a failed extraction has no structured retry/correction surface.

## 6. Tenant / Concurrency / Safety

AtomMem is single-process research code:

- Storage namespace is `conversation_id`, not user/account/tenant.
- Files are written under one global `FACTS_DIR`.
- JSON writes are load-mutate-save.
- No cross-process lock or transactional store is present.
- Demo per-session `RLock` protects `OnlineAtomMemSession` fields, not shared JSON files or module-global config.
- Demo writes user-submitted general LLM settings into global `config.API_KEY`, `config.API_BASE`, and `config.LLM_MODEL`.

This is materially weaker than OpenViking's server-side account/user/actor-peer filters and Cat Cafe's repo/runtime identity boundaries.

Security surface note: the demo accepts API keys through settings and returns defaults through `/api/defaults`. It is a local demo, but it should not be described as production-ready or multi-user safe.

## 7. Algorithm Peel

| Mechanism | Category | Real role | Agent-visible? | Mutates future behavior? | Risk |
| --- | --- | --- | --- | --- | --- |
| Fact extraction prompt | LLM extraction | Turn -> fact strings. | Only via stored facts/demo panel. | Yes | Generated facts can look like observations. |
| SFT Fact Executor data | Training data | Allows user to train own extractor. | No runtime tool. | Indirect | No weights/training script/metrics. |
| Metadata extraction prompt | LLM extraction | People/keywords/time/profile flag. | Indirect via JSON facts. | Yes | Bad metadata harms retrieval. |
| Embedding cosine + Jaccard | Heuristic/model retrieval | Base fact/event/profile scoring. | Scores on fact dicts. | No | Not BM25; weaker exact-ID recall. |
| Event attribution | Heuristic + LLM judge | Group facts into events. | Indirect via event IDs/summaries. | Yes | Wrong groupings become future graph edges. |
| Profile extraction/merge | LLM judge + heuristic | Build temporal profile versions. | Indirect via profiles. | Yes | Generated profile can be promoted as user state. |
| PPR/RWR graph rerank | Engineering algorithm | Re-rank local facts from keyword/event/turn graph. | `graph_debug` in Python output. | No | Only as good as seed facts/metadata. |
| Category-specific answer prompt | Benchmark-conditioned prompt | Improves LoCoMo cat2/cat3 answer behavior. | Hidden unless caller passes category. | No | Benchmark coupling. |
| LLM judge eval | Eval metric | Labels answer quality. | Eval report only. | No | Does not repair memory. |

## 8. 9-Axis Comparison Against Cat Cafe Baseline

| Axis | AtomMem verdict | Cat Cafe baseline contrast | Takeaway |
| --- | --- | --- | --- |
| Truth source | Facts/events/profiles are JSON rows generated/merged by LLM-heavy pipeline; raw LoCoMo data exists but is not first-class in result surface. | Cat Cafe treats markdown/runtime traces as truth and indexes as compiled layers. | AtomMem needs raw-source surfacing before agent use. |
| Ingestion | LLM fact extraction, SFT data option, metadata LLM, event/profile LLM judges. | Cat Cafe indexes authored docs/traces with authority/provenance fields. | SFT data is useful, but generated memory still needs labels. |
| Recall | Embedding cosine + keyword Jaccard + event compensation + PPR graph rerank. | BM25/FTS + vector + RRF hybrid plus graph/recent tools. | Borrow graph rerank idea; do not copy recall surface. |
| MCP surface | None. | First-party MCP memory tools. | This is the sharpest gap. AtomMem is not agent-pluggable as shipped. |
| Raw drill-down | Weak `dia_id` / `fact_id` anchors, no read/grep/raw-turn API. | `sourcePath`, `read_file_slice`, session-chain drilldown. | IDs without a read path are partial L1 only. |
| Epistemic labels | Missing. Facts/events/profiles are mixed observation/generation artifacts. | Authority/provenance/sourcePath/status/ranking factors. | Same blind spot as OpenViking, worse surface. |
| Skill contract | None. README gives commands for humans; no agent skill or decision tree. | `memory-navigation` and search best-practices. | Agent would need external wrapper/skill. |
| Feedback loop | Writes future memory, but eval/user corrections do not feed repair. | F200 behavior signals affect ranking; source authority remains separate. | AtomMem has memory mutation but no epistemic correction. |
| Multi-collection / tenant scoping | None beyond `conversation_id` file names. | Collection/dimension routing and server-derived visibility. | Treat as research prototype, not backend. |

## 9. User-Mind Evaluation

### L1: Can Continue Work - Partial

AtomMem gives some anchors:

- `fact_id`
- `dia_id`
- `event_ids`
- `profile_id`
- `graph_debug`

But it does not provide agent-callable follow-up tools. There is no `read`, `grep`, `list_recent`, or graph navigation API. The agent can continue only if it knows the internal JSON/data layout.

### L2: Can Distinguish Evidence Quality - Fail

AtomMem does not distinguish:

- raw user observation
- fact extracted by LLM
- event summary generated by LLM
- profile merged by LLM
- benchmark-conditioned answer prompt output
- retrieval relevance score vs truth confidence

The classic failure fingerprint is present: generated content is dressed as memory fact/profile state.

### L3: Can Close The Loop - Fail

AtomMem can mutate memory, but does not close an epistemic correction loop:

- No correction API.
- No verify/approve/revoke state.
- No authority transition.
- No raw evidence read path.
- No benchmark/user feedback writeback into memory repair.
- No safe multi-user delete/update contract.

Manual JSON editing is not an agent-facing correction loop.

### Layer C: Engineering Mind Fit

| Check | Verdict | Note |
| --- | --- | --- |
| Natural next action visible? | Partial | Python output has IDs; demo has memory panel. No tool contract. |
| Deterministic verification path? | No | No raw-turn read or grep by ID. |
| Failure next step? | No | Bad extraction/merge/retrieval gives no structured next action. |
| Provenance retained? | Partial | `dia_id` exists but no source-tier/observed/generated split. |
| Can shrink/delete safely? | No | JSON can be edited, but no governed correction/cascade API. |

Overall: AtomMem is a benchmarkable research memory pipeline, not an agent-facing memory backend.

## 10. What Cat Cafe Should Learn / Not Follow

### Learn

1. Seed-only graph rerank.

   Keep base retrieval simple, then run a local graph over selected facts. This is a clean way to add associative context without making the whole store a graph DB.

2. Turn-neighborhood edges.

   Conversation memory benefits from "nearby turns" as an edge channel. Cat Cafe can consider turn/session adjacency in memory ranking while preserving source authority.

3. Temporal profile version chains.

   Do not overwrite user profile summaries as if identity were static. `valid_from` / `valid_to` / history versions are the right shape if every profile stays source-anchored and correctable.

4. SFT data as an honest reproducibility artifact.

   Publishing the fact-extractor SFT dataset is better than claiming "small model support" with no data. Cat Cafe should prefer inspectable training/eval artifacts when making model-capability claims.

### Do Not Follow

1. Do not ship memory as generated facts without source-tier labels.

   Fact extraction is useful, but LLM-extracted fact rows need authority/provenance and raw-source links.

2. Do not call a demo API an agent contract.

   `/api/chat` returning only assistant text is not enough. Agent memory needs typed search/read/correct tools.

3. Do not depend on benchmark labels in primary answer prompts.

   LoCoMo category-conditioned prompts improve benchmark handling but are not general production inputs.

4. Do not rely on `conversation_id` file names as isolation.

   This is not tenant scoping, not auth, and not concurrent safety.

5. Do not write per-session/user LLM settings into module-global config.

   That is a multi-session contamination bug waiting to happen.

6. Do not confuse "can train your own small model" with "ships a working small model."

   SFT data is valuable, but the delivered product boundary is still BYO training.

## 11. Trilogy Synthesis Notes

The three reports now give a clean gradient:

| System | Agent surface | Retrieval | Raw drill-down | Epistemic labels | Tenant/scoping |
| --- | --- | --- | --- | --- | --- |
| Cat Cafe | First-party MCP memory tools + skills | BM25/FTS + vector + RRF, graph/recent paths | Source slice + session-chain tools | Stronger, but `confidence` naming still hazardous | Project/collection/runtime identity boundaries |
| OpenViking | Broad HTTP MCP + plugin skills | Dense+sparse vector + hierarchy + exact side tools | Strong `read(uri)` / grep / glob / code tools | Weak | Strong account/user/actor-peer scoping |
| AtomMem | No MCP; demo HTTP + Python internals | Embedding+Jaccard + event compensation + graph PPR rerank | Weak `dia_id`; no read tool | Fail | None beyond `conversation_id` |

Cross-project lesson:

> Retrieval cleverness is not enough. Agent memory systems need a surface that returns anchors, raw read paths, source-tier labels, and correction loops.

AtomMem proves the "algorithm" side can be interesting while the product surface is still not agent-ready.

## 12. Reviewer Questions

1. Is it too harsh to label AtomMem "no agent surface" when Python `answer_query` returns a rich dict, or is "no MCP/tool contract" the correct boundary for this comparison?
2. Should SFT data count as a stronger small-model story than OpenViking's Ollama/local-embedder claim, or should both be marked "BYO model, unproven runtime quality"?
3. Should the final synthesis give AtomMem positive credit for graph rerank equal to OpenViking's exact-recovery credit, or is graph rerank less product-relevant without raw drill-down?
4. Should `dia_id` be scored as L1 partial or fail? I marked partial because it is an anchor, but no read path makes it weak.
5. For the trilogy synthesis, should we create a new `README.md` index in this comparison directory, or a separate `memory-systems-agent-surface-synthesis.md`?

[砚砚/gpt-5.5🐾]
