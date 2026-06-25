---
doc_kind: research-note
topics:
  - cat-cafe
  - memory
  - retrieval
  - mcp
  - agent-surface
  - longform-002
created: 2026-06-24
status: draft
source_repo: /Users/lysander/projects/relay-station/cat-cafe
source_commit: 6a4ccd7f4950ac8b5109d3ffb6d5003613061764
baseline_doc: docs/content/drafts/longform-002-v0-formal.md
authored_by: "@codex"
covers:
  - truth-source
  - ingestion-indexing
  - retrieval-recall
  - mcp-surface
  - skills-surface
  - comparison-baseline
working_tree_note: "Memory/MCP source paths checked clean; unrelated dirty files outside this scope were left untouched."
---

# Cat Cafe Memory Agent Surface Deep Dive

This is report 1 in the memory-system comparison series. It only dissects Cat Cafe's own memory system as the baseline. OpenViking and AtomMem should be inspected next against the same axes: ingestion, retrieval/recall, MCP/tool surface, raw-source drill-down, epistemic labels, and agent skill contract.

## 0. Executive Verdict

Cat Cafe memory is not just "summary plus original link" and not a single RAG endpoint. The shape in `longform-002` is:

```text
human-readable truth sources + runtime traces
  -> rebuildable SQLite / FTS / vector / graph indexes
  -> three MCP memory entries
  -> raw drill-down tools
  -> skills that teach agents when to use each entry
  -> behavior feedback that changes future ranking, not truth authority
```

The important baseline for comparing OpenViking and AtomMem is this:

- Cat Cafe already has the abstract/original separation: index summaries, `sourcePath`, `drillDown`, `cat_cafe_read_file_slice`, and session-chain tools give the agent a path back to raw evidence.
- Cat Cafe's retrieval is explicitly dual-path: BM25/FTS plus vector nearest-neighbor, fused with RRF in hybrid mode.
- Cat Cafe exposes memory as an agent-facing MCP surface, not only as a demo API or backend implementation detail.
- Cat Cafe carries epistemic metadata in the result shape: authority, provenance tier, source path, status, confidence, match reason, passages, and ranking factors.
- The strongest current weakness is not "missing raw links"; it is that some labels can still be misread. `confidence` is relevance/rank confidence, not truth confidence. The system relies on authority/provenance/sourcePath plus read-source nudges to keep agents honest.

## 1. Claim Ledger

| Claim | Verdict | Evidence | Caveat |
| --- | --- | --- | --- |
| Knowledge truth source remains markdown / human-readable files; DB/vector are compiled layers. | Supported | `longform-002` states markdown is the truth source and indexes are rebuildable; `CatCafeScanner` scans docs into `EvidenceItem`s with `sourcePath` and authoritative provenance. | Runtime traces are different: they live in data tables, not markdown. |
| There are three first-class memory entries, not one search box. | Supported | `longform-002` defines `graph_resolve`, `list_recent`, `search_evidence`; MCP wrappers exist in `graph-tools.ts`, `recent-tools.ts`, `evidence-tools.ts`; `memory-navigation` skill repeats the decision tree. | Agents can still misuse the surface if they ignore the skill/nudges. |
| Search recall is BM25 + embedding, not embedding-only. | Supported | `search_evidence` exposes `mode=lexical/semantic/hybrid`; `SqliteEvidenceStore` uses FTS5 BM25, vector NN, and hybrid RRF fusion. | Embedding failure falls back to lexical in several paths, so mode can degrade. |
| Raw-source drill-down exists. | Supported | Search result formatting prints `sourcePath`, `drillDown`, raw `passages`; `cat_cafe_read_file_slice` reads bounded line ranges; session tools expose raw/chat/handoff event views. | The tool nudges the agent to read sources, but cannot force reasoning discipline. |
| Epistemic metadata exists in the core result schema. | Supported in shape; agent compliance dependent | `EvidenceItem` has authority, activation, provenance, sourcePath, status, verifiedAt, sourceIds, contradiction/invalid fields, ranking factors, confidence, passages. | `confidence` is a calibrated relevance signal, not a truth guarantee. Keep authority/provenance separate; agents still have to read the source when the result is decision-critical. |
| Feedback affects future recall, not truth. | Supported in shape; signal maturity incomplete | `longform-002` says consumption ranking changes navigation convenience only; `SqliteEvidenceStore` has consumption rerank hooks and ranking factors. | `outputVerified` bridging is explicitly incomplete in `longform-002`; current behavior signal is still partly proxy. |
| MCP is the primary agent-facing memory contract. | Supported | `server-toolsets.ts` whitelists memory tools for readonly and desktop/cloud profiles; memory tools are registered as first-party MCP toolsets. | Tool count is high; the skill layer is part of discoverability, not optional polish. |
| Skills are part of the memory interface. | Supported | `memory-navigation` routes cold start / anchor / fuzzy / recent cases; `memory-search-best-practices` externalizes query expansion into agent behavior instead of a backend LLM judge. | This makes quality partly model-dependent: better agents search better. |

## 2. Architecture Map

```text
docs/*.md / decisions / lessons / discussions / research / feature specs
thread messages / session digests / runtime trajectories
external collections
  |
  v
CatCafeScanner / GenericRepoScanner / IndexBuilder
  |
  +--> evidence_docs + evidence_fts
  +--> evidence_passages + passage_fts
  +--> evidence_vectors + passage_vectors
  +--> graph edges: wikilink / doc_link / feature_ref / related_to
  |
  v
KnowledgeResolver / SqliteEvidenceStore / GraphQueryResolver / RecentBrowseResolver
  |
  v
MCP tools:
  search_evidence / graph_resolve / list_recent
  read_file_slice / session-chain tools
  |
  v
Agent skill layer:
  memory-navigation / memory-search-best-practices
  |
  v
F200 feedback:
  consumed / filesRead / task trajectories / outputVerified bridge
```

### Ingestion / Indexing

The static knowledge path starts from files, not opaque memory rows. `CatCafeScanner` scans docs directories such as `features`, `decisions`, `plans`, `lessons`, `discussions`, `research`, `postmortems`, and `harness-feedback`. It extracts frontmatter, title, summary, keywords, `sourcePath`, and authoritative provenance.

`IndexBuilder` chooses a scanner, indexes docs, thread summaries, message passages, and session digests, then embeds changed items into vector stores. Passage embedding warmup is non-blocking; passage FTS remains the canonical fallback.

This means Cat Cafe's L0/L1/L2 equivalent is not sidecar files:

| Layer idea | Cat Cafe implementation |
| --- | --- |
| L0 quick summary | `EvidenceItem.summary`, title, keywords, match reason |
| L1 structured context | authority/provenance/status/source IDs/passages/graph edges |
| L2 raw evidence | `sourcePath` + `cat_cafe_read_file_slice`, or session-chain raw events |

## 3. Retrieval / Recall Chain

### `cat_cafe_search_evidence`

The MCP input schema exposes the knobs an agent actually needs:

- `scope`: `docs`, `memory`, `threads`, `sessions`, `all`
- `mode`: `lexical`, `semantic`, `hybrid`
- `depth`: `summary`, `raw`
- `dimension`: `project`, `global`, `library`, `collection`, `all`
- `collections`: explicit collection routing when `dimension=collection`
- `intent`: `topk` or `coverage`
- `contextWindow`: surrounding passages for raw mode

The handler calls `/api/evidence/search`. The API route uses `KnowledgeResolver` when available; otherwise it falls back to the local `EvidenceStore`.

The store has three independent retrieval paths:

- **Lexical**: exact-anchor protection, FTS5 BM25 over `evidence_fts`, progressive relaxation, and substring backfill for hits FTS may miss.
- **Semantic**: embed query, vector nearest-neighbor over `evidence_vectors`, hydrate anchors from `evidence_docs`, and re-apply filters.
- **Hybrid**: keep a BM25 candidate pool, run vector NN, fuse both lists with RRF (`k=60`), then hydrate and filter. CJK queries get extra NN weight because BM25/CJK recall is weaker.

Raw mode searches passages. It has the same lexical/semantic/hybrid split for `evidence_passages`; if passage vectors are unavailable or fail, the response marks degraded and falls back to lexical.

### Rerank / Governance

Ranking is not a single model score:

- FTS/vector/RRF produce retrieval candidates.
- Authority boost and salience can adjust ordering.
- F200 consumption rerank can use behavior signals, MMR, prior/decay, and ranking factors.
- Consumption does not rewrite authority. Longform-002 is explicit: read often does not mean true.

The output surface prints machine-stable fields: `anchor`, `type`, `sourcePath`, `authority`, `boost`, `match`, `drillDown`, optional `ranking`, snippet, and raw passages. It also prints an instruction-level nudge: high/mid document hits should be read from source, not reasoned from summary.

## 4. Graph / Recent / Session Chain

### `cat_cafe_graph_resolve`

This is the precise-anchor path. Input is `query`, optional `depth` 1-3, and optional relation filters. Exact anchors return a graph; fuzzy terms return candidates. The MCP schema intentionally does not accept `callerCollections`, so clients cannot self-grant private collection visibility.

This matters for comparison: AtomMem has graph rerank in the QA path, but Cat Cafe's graph surface is a navigation/read-context tool, not only an internal ranking trick.

### `cat_cafe_list_recent`

This is the no-query path for cold starts and compression recovery. It scans recent docs/threads/memory/trajectories by time window. It is not semantic search; it answers "what happened recently?" when the agent does not yet know a keyword.

### Session Chain Tools

The memory surface also includes session-chain drill-down: list session chains, read digests, read raw/chat/handoff event views, and read invocation details. This closes the gap between "I found a summary" and "show me the underlying conversation/action trail."

## 5. MCP + Skills Surface

| Surface | Agent contract | Evidence shape |
| --- | --- | --- |
| `cat_cafe_search_evidence` | Fuzzy/semantic/hybrid search with top-k or coverage intent. | `anchor`, `sourcePath`, authority, confidence, match reason, drill-down, passages, degraded/effective mode. |
| `cat_cafe_graph_resolve` | Known anchor or relation expansion. | Graph nodes/edges or candidates; relation filters; depth cap. |
| `cat_cafe_list_recent` | Zero-prior browse. | Recent items by scope/kind/time, including trajectories. |
| `cat_cafe_read_file_slice` | Raw source verification. | Bounded, line-numbered source reads, including collection URI support. |
| Session-chain tools | Conversation/runtime provenance. | Digests, raw events, chat/handoff views, invocation details. |
| `memory-navigation` skill | Choose the correct entry point. | Decision tree: anchor -> graph, fuzzy -> search, no prior -> recent. |
| `memory-search-best-practices` skill | Query expansion and coverage strategy. | Multi-query recipes live in agent behavior, not hidden backend rewrite. |

The skill layer is not decorative. Longform-002 says query expansion should be done by smart agents, not by adding opaque intent-classification logic to the retrieval engine. That is why search quality belongs partly to "skills given to agent," not only "backend recall algorithm."

Dependency direction caveat for comparison: Cat Cafe deliberately keeps a large part of search intelligence on the agent/skill side. OpenViking and AtomMem may push more work into backend LLM judges, sidecar generation, or benchmark-conditioned prompts. The comparison should not just ask "which system has the feature"; it should ask whether the agent can see, verify, and override the system's judgment.

## 6. Algorithm Peel

### Real Algorithms

- FTS5 BM25 over title/summary and passage text.
- Vector nearest-neighbor over evidence and passage embeddings.
- RRF fusion for hybrid search and multi-collection result fusion.
- Graph traversal for anchor neighborhood expansion.
- MMR / consumption-prior rerank path for F200 ranking.
- Progressive lexical relaxation and substring backfill for recall robustness.

### LLM / Model Use

- The retrieval engine itself does not call an LLM judge to decide search results.
- Embeddings are model-based, but embedding is used for nearest-neighbor retrieval, not for truth labeling.
- Upstream summaries/session digests may be generated elsewhere, so raw-source drill-down remains required.
- Query expansion is deliberately agent/skill-side, not hidden in a backend LLM rewrite layer.

### Heuristics / Policy

- Scope/kind/status/provenance filters.
- Backstop suppression.
- Authority boost and salience.
- CJK NN weighting.
- Tool nudges when low-hit/no-match or when high-confidence document summaries should be read at source.

## 7. Baseline Axes For OpenViking / AtomMem

Use this as the comparison checklist for the next two one-system reports:

| Axis | Cat Cafe baseline question |
| --- | --- |
| Truth source | Is the source human-readable/rebuildable, or hidden in DB/generated sidecars only? |
| Ingestion | What creates summaries/facts/sidecars? Rule, LLM, fine-tuned model, or user-authored text? |
| Recall | Is search lexical, vector, hybrid, graph rerank, or model judge? What happens on degradation? |
| MCP surface | What exact tools are exposed to the agent, and what are their input/output contracts? |
| Raw drill-down | Can the agent deterministically reach raw evidence from every result? |
| Epistemic labels | Does the result distinguish original observation, generated summary, derived fact, rank confidence, and authority? |
| Skill contract | Does the project teach agents when to search, browse recent, resolve anchors, or verify raw sources? |
| Feedback loop | Do real usage/outcome signals change future recall? Do they preserve truth authority boundaries? |
| Multi-collection / tenant scoping | Are collection boundaries, tenant/account filters, and private/restricted visibility enforced by the server rather than trusted to the client? |

Expected first-order contrasts to verify, not assume:

- **OpenViking** likely has stronger production engineering and explicit `abstract/overview/read` ergonomics. The next report should inspect its MCP tools, return shapes, raw drill-down contract, and whether sidecar generation lacks authority/source-tier labels.
- **AtomMem** likely has no first-class MCP surface and is closer to Python/demo/benchmark usage. The next report must include the missed SFT-training-data branch: it appears to provide data for a BYO Fact Executor model, but not model weights or a full training/reproduction path.

## 8. Open Questions / Risks

1. `confidence` is still easy to overread. It should be documented everywhere as relevance/rank confidence, not epistemic truth confidence. Long-term naming like `rankConfidence` would be safer.
2. Raw drill-down is available, but the enforcement is mostly soft: tool output nudges plus skill discipline. The system can make source reading easy; it cannot prove the agent reasoned from source.
3. F200's strongest signal, `outputVerified`, is not fully bridged. Current consumption ranking is useful, but longform-002 explicitly says it is still a trend signal, not a stable oracle.
4. Multi-collection/private visibility is partly server-derived and partly still v1-limited in specific MCP tools. OpenViking comparison should check whether its tenant/security scoping is stronger or merely more ergonomic.
5. Because Cat Cafe keeps intelligence in agent-side query expansion, weak agents may get worse recall than strong agents with the same backend. That is a conscious design tradeoff, not an accident.

## 9. Reviewer Questions

1. Does this baseline overclaim epistemic safety because authority/provenance exists, even though agent compliance is still soft?
2. Should `confidence` be treated as a P1 naming hazard before we compare against OpenViking/AtomMem?
3. Is `memory-search-best-practices` sufficiently part of the product surface, or should the comparison focus only on MCP tools that external agents can call?
4. For OpenViking next: should we start from its MCP endpoint/tool list, or from its retrieval store and then map upward to MCP?

[砚砚/gpt-5.5🐾]
