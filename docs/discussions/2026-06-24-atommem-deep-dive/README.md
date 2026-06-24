---
doc_kind: research-note
topics: [atommem, open-source-teardown, memory-system]
created: 2026-06-24
status: reviewed-v2
source_repo: https://github.com/MINE-USTC/AtomMem
source_local_path: /Users/lysander/projects/ref/AtomMem
source_commit: 776f880941a02b10c495c126fe775d5e88ede5d4
authored_by: "@codex [砚砚/GPT-5.5🐾]"
covers: [architecture, star-features, algorithms, comparison]
---

# AtomMem Deep Dive

## 0. Scope

- User question: `https://github.com/MINE-USTC/AtomMem`，按开源组件拆解 skill 判断它的真实能力和 Cat Cafe 可学习点。
- Project: AtomMem, "a long-term memory system for personalized LLM agents".
- Source repo: <https://github.com/MINE-USTC/AtomMem>
- Local path: `/Users/lysander/projects/ref/AtomMem`
- Commit: `776f880941a02b10c495c126fe775d5e88ede5d4` (`2026-06-14 13:44:45 +0800`, `Update README.md`)
- Repo snapshot: created `2026-06-08`, pushed `2026-06-14`, 84 commits on GitHub page, `gh repo view` saw 14 stars / 1 fork / 0 open issues / 0 open PRs.
- Verification run:
  - `python -m compileall -q atommem_core src scripts` passed.
  - `python scripts/run_atommem_pipeline.py --dry-run --conv-id conv-30 --data-file data/split_samples/conv-30.json --facts-file data/locomo_preextracted_facts/conv-30.json --questions-file data/split_samples/conv-30.json --output-dir /tmp/atommem-dry-run` passed.
  - No `pytest` / `unittest` / `def test_` style test suite found by `rg`.

## 1. Claim Ledger

| Claim | Source wording | Evidence paths | Verdict | Caveat |
|---|---|---|---|---|
| Atomic facts are the base memory representation | README says continuous dialogue is distilled into self-contained, information-dense atomic facts | `scripts/run_atommem_pipeline.py:105-207`, `atommem_core/preextracted_pipeline.py:126-172`, `src/fact_storage.py:35-136`, `src/file_storage.py:72-85` | Supported | Extraction is LLM-prompt based. Atomicity is a prompt contract, not a deterministic parser. |
| Tri-partite memory: facts, events, temporal user profiles | README lists Atomic Facts, Event Memories, Temporal User Profiles | `src/file_storage.py:24-27`, `src/file_storage.py:72-197`, `src/event_manager.py:30-114`, `atommem_core/incremental_temporal_profile.py:118-174` | Supported | All three views are JSON files under one namespace. Event/profile construction depends heavily on LLM judgment. |
| Associative graph retrieval with RWR/PPR | README claims localized graph over entities/events/neighboring dialogue turns and PPR/RWR retrieval | `atommem_core/multichannel_graph.py:83-162`, `atommem_core/multichannel_graph.py:167-245`, `atommem_core/multichannel_graph.py:426-486`, `atommem_core/graph_rerank.py:76-191`, `scripts/run_atommem_pipeline.py:281-396` | Supported | It is a runtime-local graph built from JSON facts/events, then used to rerank a seed set. It is not a persistent graph DB. |
| Stable memory evolution | README claims stable user-state evolution | `src/fact_storage.py:62-127`, `atommem_core/temporal_profile_version_chain.py:151-207`, `atommem_core/temporal_profile_version_chain.py:350-560`, `atommem_core/incremental_temporal_profile.py:55-117` | Partially supported | There is dedupe/conflict handling and profile version chains, but no rollback, confidence, reviewer gate, or eval feedback into memory writes. |
| Scalable and economically viable | README frames AtomMem as scalable/economically viable | `scripts/run_atommem_pipeline.py:529-544`, `scripts/evaluate_locomo.py:216-240`, `src/file_storage.py:24-27`, `src/file_storage.py:76-85`, `src/utils.py:44-48` | Weak / unproven | Code loads JSON collections into memory and calls LLMs for extraction, metadata, conflicts, events, profiles, intent, and answers. Storage is a single-process `conversation_id` namespace, not multi-tenant isolation; JSON read-modify-write is not concurrent-write safe. Token stats exist, but scale claims are not established by infra. |
| Plug-and-play pipeline | README says developers can effortlessly equip conversational agents with long-term memory | `scripts/run_atommem_pipeline.py:547-658`, `scripts/run_demo_server.py:83-104`, `scripts/run_demo_server.py:272-276`, `.env.example`, `config.py` | Partially supported | CLI and local demo are usable. It is not packaged as a library, assumes OpenAI-compatible endpoints, and the demo writes user-provided model settings into module-global `config`, which can cross-contaminate sessions in one process. |
| LoCoMo benchmark reproducibility | README says `scripts/evaluate_locomo.py` reproduces reported metrics using provided data | `data/split_samples/`, `data/locomo_preextracted_facts/`, `scripts/evaluate_locomo.py:1-6`, `scripts/evaluate_locomo.py:141-146`, `scripts/evaluate_locomo.py:262-307`, `scripts/run_atommem_pipeline.py:486`, `prompts/answer_generation_prompt_cat2.txt`, `prompts/answer_generation_prompt_cat3.txt` | Supported, but benchmark-coupled | Data and runner exist, but public QA code passes LoCoMo `category` into prompt selection. Category 2 uses a temporal-reasoning prompt and category 3 uses a commonsense-reasoning prompt, so benchmark metrics rely on benchmark labels that ordinary deployments will not have. The repo also has no CI fixture or checked-in expected metric snapshot. |

## 2. Architecture Map

```text
raw dialogue / pre-extracted facts
  -> FactExtractor or load_preextracted_facts
  -> build_fact_tuple
       - LLM metadata: people / keywords / time / profile flag
       - sentence-transformers embedding
  -> FactStorageManager.process_new_fact
       - duplicate check: embedding threshold
       - conflict check: similarity prefilter + LLM judge
       - save facts_{conversation_id}.json
       - event attribution
            -> fact-seeded top-k event/singleton candidates
            -> LLM selects same-event candidates
            -> mutate event.fact_ids and fact.event_ids
            -> LLM updates event summary/keywords
       - profile extraction
            -> batch trigger
            -> LLM extracts stable profile candidates
            -> temporal merge: similarity + direct decision + LLM decision
            -> save profiles_{conversation_id}.json with history versions

QA path
  -> LLM query intent: people / keywords / time / need_attribute
  -> query embedding
  -> LayeredRetriever seed facts/profiles
  -> MultiChannelFactGraphIndex over keyword/event/turn channels
  -> SeedOnlyGraphReranker runs PPR/RWR from seed facts
  -> answer LLM receives selected facts/profiles

online demo
  -> answer first from current memory
  -> background task extracts facts from latest user turn
  -> same memory construction pipeline writes JSON memory
```

- Entrypoints:
  - CLI/eval: `scripts/run_atommem_pipeline.py`, `scripts/evaluate_locomo.py`
  - Demo: `scripts/run_demo_server.py`, `demo/static/*`
- State stores:
  - `facts_{conversation_id}.json`, `events_{conversation_id}.json`, `profiles_{conversation_id}.json`, optional `entity_graph_{conversation_id}.json` in `config.FACTS_DIR`.
  - Generated run artifacts under `runs/atommem` or `runs/demo_memory`.
- Extension points:
  - OpenAI-compatible LLM endpoint variables in `config.py`.
  - Separate fact extractor endpoint via `ATOMMEM_FACT_EXECUTOR_*`.
  - Retrieval hyperparameters in `config.py` (`GRAPH_RHO_*`, `GRAPH_MAX_*`, top-k values).
  - Prompt files under `prompts/`.
- Empty / placeholder dirs: none found by `find . -type d -empty -not -path './.git/*'`.
- High-risk monoliths:
  - `scripts/evaluate_locomo.py` 947 lines.
  - `scripts/run_atommem_pipeline.py` 658 lines.
  - `scripts/run_demo_server.py` 650 lines.
  - `atommem_core/temporal_profile_version_chain.py` 666 lines.
  - `atommem_core/multichannel_graph.py` 636 lines.

### Community / Reproducibility Audit

- Community signal is too early to treat as validation. On 2026-06-24, `gh issue list --state all` and `gh pr list --state all` both returned `[]`; `gh repo view` returned 14 stars and 1 fork. For a memory system, 0 issues / 0 PRs means "not externally shaken down yet", not "low defect rate".
- Benchmark reproducibility needs a separate source-audit before quoting numbers. `.env.example:17` and `scripts/evaluate_locomo.py:51` default the judge model to `deepseek-v4-pro`; this may work only if the caller's DashScope/OpenAI-compatible endpoint exposes that model string. The repo does not include a checked-in expected metric table, so running the script is reproducibility tooling, not proof that public users can reproduce a specific score.
- Runtime shape is single-process research code. `src/file_storage.py:24-27` writes `facts/events/profiles/entity_graph` files by `conversation_id` under global `config.FACTS_DIR`; `src/utils.py:44-48` overwrites JSON directly. There is no `user_id` / `tenant_id` / `org_id` dimension and no cross-process write lock.

## 3. Star Feature Deep Dives

### 3.1 Atomic Fact Pipeline

- Public API / command: `scripts/run_atommem_pipeline.py --facts-file ...` or `--extract-facts`; demo uses `/api/chat`.
- Core modules:
  - Raw extraction: `FactExtractor.extract_turn` in `scripts/run_atommem_pipeline.py:142-207`.
  - Metadata and tuple assembly: `PreExtractedFactsPipeline.build_fact_tuple` in `atommem_core/preextracted_pipeline.py:126-172`.
  - Storage and post-processing: `FactStorageManager.process_new_fact` in `src/fact_storage.py:35-136`.
- State mutation:
  - Facts are appended or conflict-updated in `src/fact_storage.py:78-95`.
  - Deduped facts are ignored before mutation.
- Future behavior:
  - Saved facts become retrieval seed candidates and graph nodes in future QA.
- Tests:
  - No formal unit tests found. Compile and CLI dry-run pass.
- Verdict:
  - Real pipeline, not vaporware. The weak point is that "atomic fact" quality is only as good as the extraction prompt/model.

### 3.2 Event Memory

- Public API / command: same build pipeline; online demo calls it in background after a user turn.
- Core modules:
  - Baseline event manager: `src/event_manager.py`.
  - Public pipeline uses fact-seeded event-level manager: `atommem_core/fact_seeded_event_pipeline.py:51-169`.
  - Event-level LLM selection and mutation: `atommem_core/event_level_pipeline.py:18-78`, `atommem_core/event_level_pipeline.py:166-258`.
- State mutation:
  - Existing events get `fact_ids.append(new_fact["fact_id"])` and updated summary/embedding.
  - Singleton facts can become new events.
  - Selected facts receive `event_ids`.
- Future behavior:
  - Events participate in compensation recall and graph event-channel edges.
- Tests:
  - No formal test suite found.
- Verdict:
  - Functionally meaningful episodic grouping exists. The "same event" decision is an LLM judge plus embedding/keyword prefilter, so it should be treated as probabilistic curation, not a verified ontology.

### 3.3 Temporal User Profiles

- Public API / command: profile extraction is triggered during build; demo exposes "Flush Profiles".
- Core modules:
  - Batch profile extraction: `src/profile_manager.py:27-102`.
  - Incremental temporal profile manager: `atommem_core/incremental_temporal_profile.py:118-174`.
  - Temporal merge/version chain: `atommem_core/temporal_profile_version_chain.py:151-207`, `atommem_core/temporal_profile_version_chain.py:350-560`.
  - Query-time profile version selection: `atommem_core/temporal_profile_version_chain.py:563-664`, `atommem_core/incremental_temporal_profile.py:226-270`.
- State mutation:
  - Profile candidates are merged into current profile or `history[]` versions with `valid_from` / `valid_to`.
- Future behavior:
  - Attribute queries can retrieve profiles; time-scoped queries can select historical profile views.
- Tests:
  - No formal test suite found.
- Verdict:
  - This is one of the better engineering ideas in the repo: temporal profile versions are explicit state, not just summary replacement. Caveat remains LLM-based profile extraction and LLM-based update decisions.

### 3.4 Associative Graph Retrieval

- Public API / command: QA phase of `scripts/run_atommem_pipeline.py`; demo retrieval path.
- Core modules:
  - Graph index: `MultiChannelFactGraphIndex` in `atommem_core/multichannel_graph.py:83-162`.
  - PPR/RWR retriever: `MultiChannelFactGraphRetriever.retrieve` and `_run_ppr` in `atommem_core/multichannel_graph.py:167-245`, `atommem_core/multichannel_graph.py:426-486`.
  - Public reranker: `SeedOnlyGraphReranker.retrieve_ranked_topk` in `atommem_core/graph_rerank.py:116-191`.
  - Public QA wiring: `AtomMemGraphQueryResponder.answer_query_with_query_info` in `scripts/run_atommem_pipeline.py:312-396`.
- State mutation:
  - None during retrieval. It computes a local graph and ranked facts for the current query.
- Future behavior:
  - It changes answer context for this query, but does not learn from success/failure.
- Tests:
  - No formal test suite found.
- Verdict:
  - Real algorithmic content. It is the strongest "non-LLM judge" part of AtomMem. Its ceiling is bounded by seed retrieval and metadata quality.

## 4. Algorithm Peel Table

The shape is LLM-orchestration first, graph algorithm second. `prompts/` contains 11 prompt files, covering fact metadata, event attribution, event generation, profile extraction, temporal profile update, query intent, category-specific answer prompts, demo answer generation, and judge scoring. The main non-LLM algorithmic node is the graph PPR/RWR reranker; most memory-writing decisions before retrieval are LLM extraction/judgment plus heuristic prefilters.

| Mechanism | Input | Output | Type | Code path | Mutates future behavior? |
|---|---|---|---|---|---|
| Atomic fact extraction | Dialogue turn + previous turn | List of fact strings | LLM extraction | `scripts/run_atommem_pipeline.py:105-207`, `scripts/run_demo_server.py:118-209` | Yes, if stored |
| Fact metadata extraction | Fact + previous context + session time | People, keywords, time, profile flag | LLM classifier/extractor | `atommem_core/preextracted_pipeline.py:67-124`, `prompts/fact_metadata_extraction_prompt.txt` | Yes |
| Embedding generation | Text | Vector | External model inference | `src/embedding.py:18-66` | Indirectly |
| Deduplication | New fact + existing facts | Ignore/create decision | Heuristic threshold | `src/fact_storage.py:138-165` | Yes |
| Conflict detection | New fact + similar facts | Update existing fact or create | Heuristic prefilter + LLM judge | `src/fact_storage.py:167-273` | Yes |
| Event attribution | New fact + event/singleton candidates | Selected events/facts | Heuristic prefilter + LLM judge | `atommem_core/event_level_pipeline.py:36-78`, `atommem_core/event_level_pipeline.py:166-258` | Yes |
| Event summary update | Event facts + new fact | Summary, keywords, embedding | LLM summarization | `src/event_manager.py:229-327` | Yes |
| Profile extraction | Pending facts by person | Profile candidates | LLM extraction | `src/profile_manager.py:47-146` | Yes |
| Temporal profile merge | Candidate profile + existing timeline | confirm/update/new/history | Embedding/keyword heuristic + LLM judge + deterministic fallback | `atommem_core/temporal_profile_version_chain.py:188-207`, `atommem_core/temporal_profile_version_chain.py:284-391` | Yes |
| PPR/RWR graph rerank | Seed fact scores + keyword/event/turn graph | Ranked facts | Engineering algorithm | `atommem_core/multichannel_graph.py:426-486`, `atommem_core/graph_rerank.py:116-191` | No |
| LoCoMo scoring | Gold answer/evidence + generated answer | F1, BLEU-1, Recall@10, LLM judge label | Metric + LLM judge | `scripts/evaluate_locomo.py:113-146`, `scripts/evaluate_locomo.py:262-307` | No |

## 5. Feedback Loops

| Claimed loop | signal | decision | state mutation | future behavior | verdict |
|---|---|---|---|---|---|
| Conversation memory improves future answers | User message / pre-extracted facts | LLM extraction + pipeline decisions | JSON facts/events/profiles | Future retrieval/answers use saved memory | Real loop |
| Events capture coherent episodic context | New fact similarity and candidate event summaries | LLM event attribution | event `fact_ids`, fact `event_ids`, event summary | Event recall and graph event edges change | Real but LLM-judged |
| Temporal user profiles track evolving attributes | Profile-worthy facts and evidence time | similarity/direct/LLM temporal decision | current profile plus `history[]` versions | Time-aware profile retrieval changes | Real but LLM-judged |
| Graph retrieval surfaces implicit context | Seed facts and local graph edges | PPR/RWR ranking | No persistent mutation | Current answer context changes | Retrieval algorithm, not learning loop |
| Quality/eval improves memory construction | Benchmark results / judge labels | None in runtime | None | No automatic correction | Missing loop |
| User correction loop | User says memory is wrong | No explicit correction API | None, except manual JSON/code paths | No governed correction path | Missing loop |

## 6. Agent-User Fit Verdict

True user for this class of tool is the agent/runtime using memory to continue work, not only the human looking at the demo panel. From that angle, AtomMem is a human-facing demo plus benchmark runner, not an agent-facing memory tool.

| Layer | Question | AtomMem status | Verdict |
|---|---|---|---|
| L1: Can continue | Can an agent follow up from a result? | `fact_id` and `dia_id` exist, so there is a weak anchor back to JSON/dialogue data. | ⚠️ Partial |
| L2: Can distinguish | Does the tool distinguish observation vs generated memory? | Facts, events, and profiles are presented as memory records even when produced or merged by LLM prompts. No authority/confidence/source-tier label is attached. | ❌ Fail |
| L3: Can close the loop | Can an agent verify, correct, write back, and re-observe? | No correction API, no targeted fact/profile revoke path, no reviewer/approval gate, and no verification loop after benchmark judgments. | ❌ Fail |

Engineering checklist:

- Natural path: partial. CLI and demo exist, but there is no MCP/tool interface designed for agent use.
- Reality interface: partial. `dia_id` is a useful weak anchor, but retrieval output does not expose original utterance text or authority class.
- Failure next step: fail. Zero-hit, bad extraction, wrong profile merge, and wrong event attribution do not carry structured recovery guidance.
- Provenance: partial. Evidence IDs exist, but generated summaries/profiles blur source observation and LLM interpretation.
- Deletable/shrinkable: partial. JSON can be edited or removed, but there is no governed cascade/correction workflow.

Bottom line: useful research prototype ideas; unsafe as a drop-in agent memory provider without provenance labels and correction loops.

## 7. Cat Cafe Comparison

| Dimension | AtomMem | Cat Cafe | Learn / Gap / Do Not Follow | Agent User Fit | Reason |
|---|---|---|---|---|---|
| Atomic evidence units | Fact IDs and `dia_id` anchors are first-class | `search_evidence` returns anchors, authority/confidence, source paths | Learn | ✅ L1 / ⚠️ L2 / ⚠️ L3 | AtomMem gives IDs and source dialogue IDs, but not authority/confidence labels or correction workflow. |
| Graph retrieval | Local keyword/event/turn PPR rerank | F188 graph/list_recent/search_evidence family, consumption-weighted ranking | Learn | ✅ L1 / ⚠️ L2 / ⚠️ L3 | The turn-edge channel is worth studying. Cat Cafe should keep epistemic labels stronger than AtomMem's plain ranked facts. |
| Temporal profiles | Explicit `valid_from`, `valid_to`, history versions | Cat Cafe memory currently emphasizes anchored docs/threads and event memory, not user profile timeline UX | Gap / Learn | ✅ L1 / ⚠️ L2 / ⚠️ L3 | Versioned user attributes are a useful shape if kept reviewable and source-anchored. |
| Persistent truth writes | LLM decisions write facts/events/profiles directly | Cat Cafe uses truth-source docs, review gates, authority labels | Do Not Follow | ⚠️ L1 / ❌ L2 / ⚠️ L3 | LLM judge writes are convenient but too easy to promote generated interpretation into "memory truth". |
| Scale story | JSON store, in-process graph, token accounting | SQLite/Redis/tool telemetry/eval loops in repo-specific systems | Do Not Follow | ⚠️ L1 / ❌ L2 / ❌ L3 | AtomMem's "scalable" claim is not backed by infra or CI. Treat as research prototype. |
| Demo UX | Live memory panel: facts/events/profiles update after answer | Cat Cafe Hub wants agent-facing tool closure, not just human panels | Learn carefully | ✅ L1 / ⚠️ L2 / ⚠️ L3 | The panel is useful for observability, but observation/generation labels are not explicit enough for agent trust. |
| Multi-tenant / concurrency isolation | Single `conversation_id` path namespace; JSON read-modify-write; module-global config mutation in demo | Thread/cat identity boundaries, Redis namespace discipline, commit-as-truth docs | Do Not Follow | ⚠️ L1 / ❌ L2 / ❌ L3 | The public code has research-demo isolation, not production/user-state isolation. |
| Benchmark coupling | Category-specific answer prompts for LoCoMo temporal and commonsense questions | Eval Hub should measure product behavior, not leak benchmark labels into primary runtime | Do Not Follow | ⚠️ L1 / ❌ L2 / ❌ L3 | Benchmark engineering is not general agent memory capability. |

## 8. Lessons / Next Steps

Candidate lessons:

- Seed-only graph rerank is a clean pattern: keep base retriever simple, then let a localized graph reranker improve context diversity.
- Turn-neighborhood edges are cheap and domain-relevant for conversation memory; Cat Cafe memory search could borrow this as a retrieval feature if it preserves source authority labels.
- Temporal profile version chains are more honest than overwriting "current profile" summaries. The state model is worth adapting only with explicit provenance and correction controls.
- Early `--dry-run` before heavy imports in `scripts/run_atommem_pipeline.py:49-91` is a good CLI ergonomics pattern.
- Reproducibility claims for research memory systems need source-audit by default: model name, endpoint availability, dataset availability, benchmark labels, and checked-in expected metrics all matter.

Do not follow:

- Do not write persistent truth rows from LLM judges without authority/confidence/provenance and review/correction paths.
- Do not call a JSON-file, load-all in-process prototype "scalable" without benchmarked limits.
- Do not treat LoCoMo LLM judge metrics as proof of open-ended personalized-agent memory quality.
- Do not write user/session model settings into module-global runtime state, as the demo does with `config.API_KEY`, `config.API_BASE`, and `config.LLM_MODEL`.
- Do not hardwire benchmark category labels into the primary answer path and then generalize the result as product capability.
- Do not ship memory tools without formal tests. This repo has script-level validation but no regression suite.

Follow-up questions:

- Run `scripts/evaluate_locomo.py` with fixed keys and compare `--disable-graph` against graph-enabled retrieval to quantify the graph contribution.
- Inspect any paper/preprint if/when the authors publish one; the current repo does not include a paper link or checked-in metric table.
- If Cat Cafe wants to borrow temporal profiles, write a source-audited design gate first: what user-visible data can be persisted, what stays candidate-only, and who approves corrections.
