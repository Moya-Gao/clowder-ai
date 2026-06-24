---
doc_kind: research-note
topics: [openviking, open-source-teardown, ingestion, llm-judge, memory, epistemics]
created: 2026-06-24
status: draft
source_repo: https://github.com/volcengine/OpenViking
source_local_path: /Users/lysander/projects/ref/OpenViking
source_commit: 1494bdeae70c06954f81a5d192639871317f2173
parent_report: ./README.md
authored_by: "@codex"
covers: [semantic-ingestion, l0-l1-sidecars, prompts, compressor-v2, benchmark-coupling, comparison]
---

# OpenViking Ingestion LLM-Judge Deep Dive

> Scope: focused follow-up to [README.md](./README.md), requested after the AtomMem teardown. This does not re-tear down the whole OpenViking repo. It checks whether OpenViking's ingestion-time L0/L1 and memory extraction are the same epistemic class as AtomMem's "LLM judge plus prompts" design.
>
> Source snapshot: `/Users/lysander/projects/ref/OpenViking` at `1494bdeae70c06954f81a5d192639871317f2173`, clean when inspected.

## 0. Executive Verdict

The CVO suspicion is directionally right, but the right split is sharper than "OpenViking is just AtomMem with more stars".

OpenViking does put generated text on the retrieval and memory path:

- Resource ingestion uses VLM/LLM prompts to summarize files, generate directory `.overview.md`, derive `.abstract.md`, then vectorize those L0/L1 sidecars (`semantic_processor.py:84-93`, `semantic_dag.py:789-856`, `embedding_utils.py:253-350`).
- Session memory extraction lets the model output memory write/edit/delete operations, and the executor applies those operations to storage (`compressor_v2.py:223-239`, `extract_loop.py:41-50`, `memory_updater.py:609-615`).
- Retrieval results still flatten evidence quality into `score` plus trace/provenance of *how it was found*, not authority/confidence/source tier of *what kind of evidence it is* (`hierarchical_retriever.py:545-606`, `types.py:280-293`, `types.py:348-385`).

But OpenViking is materially stronger than AtomMem as system engineering:

- It has a real async sidecar pipeline with coalescing, stale checks, exact sidecar locks, tenant filters, and vector hierarchy (`semantic_msg.py:14-23`, `semantic_queue.py:16-73`, `semantic_sidecar.py:14-60`, `viking_vector_index_backend.py:1327-1338`).
- L2 text files can still be vectorized from raw content by default; it is not "all retrieval is over LLM summaries" (`embedding_utils.py:416-443`).
- Session memory has schemas, read-before-edit rules, patch validation/retry, isolation, locks, and a `memory_diff.json` audit artifact (`extract_loop.py:157-303`, `compressor_v2.py:303-420`).
- I did not find the AtomMem-style smoking gun where LoCoMo category labels branch the production answer path. OpenViking's benchmark scripts are prompt-engineered, but production semantic ingestion does not appear benchmark-category-coupled from inspected evidence.

So the verdict is:

**OpenViking and AtomMem share the same epistemic hazard at the ingestion layer: generated sidecars/memories become first-class retrieval material without per-result authority/confidence/source-tier. OpenViking has much better engineering guardrails around writes and concurrency, but those guardrails do not solve "wrong but valid generated memory/index" as a trust problem.**

## 1. Claim Ledger

| Claim | Verdict | Evidence | Caveat |
|-------|---------|----------|--------|
| L0/L1 sidecars are real and on the retrieval path. | Supported. | `SemanticProcessor` says it generates `.abstract.md` and `.overview.md` bottom-up, writes sidecars, and enqueues vectorization (`semantic_processor.py:84-93`, `semantic_dag.py:789-856`, `semantic_sidecar.py:14-60`, `embedding_utils.py:253-350`). Retrieval uses non-L2 global hits as starting directories and recurses into non-L2 contexts (`hierarchical_retriever.py:298-339`, `hierarchical_retriever.py:500-543`). | Missing sidecars are visible as "not ready"; wrong-but-valid sidecars are still written and indexed. |
| `parsing.context_generation` is the current production resource sidecar prompt. | Not supported at this commit. | The template exists and self-describes L0/L1 JSON extraction (`context_generation.yaml:1-8`, `context_generation.yaml:40-111`), but the current production resource path renders `semantic.code_ast_summary`, `semantic.code_summary`, `semantic.document_summary`, `semantic.file_summary`, and `semantic.overview_generation` (`semantic_processor.py:1081-1120`, `semantic_processor.py:1357-1369`). | [prompt-quality-blind-test.md](./prompt-quality-blind-test.md) is still useful as an OV-style prompt-shape test, but it is not a faithful reproduction of the current production resource sidecar path. |
| L0/L1 extraction is "all LLM judge". | Mostly supported, with a nuance. | File summaries are VLM/LLM-generated except AST-only code mode; directory L1 overview is VLM/LLM-generated; L0 abstract is mechanically extracted from the generated L1 first paragraph (`semantic_processor.py:1028-1121`, `semantic_processor.py:1149-1179`, `semantic_processor.py:1344-1385`). | L2 text retrieval can use raw file content by default, so the whole retrieval system is not summary-only (`embedding_utils.py:416-443`). |
| Prompt branching exists by file/domain type. | Supported. | Code, documentation, generic file, AST-code, and directory overview have separate semantic templates. `find` shows 42 total YAML templates, 5 semantic templates, and 10 memory templates. | This is product-domain branching, not by itself benchmark cheating. |
| Prompt branching exists by benchmark category in production ingestion. | Not found. | LoCoMo benchmark has category constants and skips adversarial category 5 (`locomo_prompts.py:7-15`, `run_eval.py:811-813`), but answer/judge prompt builders ignore category for branching (`locomo_prompts.py:93-123`, `locomo_prompts.py:240-259`). Production semantic ingestion imports/render IDs under `semantic.*`, not benchmark modules. | Benchmark answer prompts are still heavily engineered; that is different from AtomMem's main-path category prompt split. |
| Wrong extraction has a semantic fallback. | Not supported. | Missing abstract/overview returns explicit not-ready fallback (`viking_fs.py:1219-1323`); summary/overview failures can write empty summary or generated placeholder (`semantic_dag.py:651-698`, `semantic_processor.py:1380-1385`). | There is no semantic validator that rejects a plausible-but-wrong summary before vectorization. |
| Session memory write/edit/delete is LLM-decided. | Supported, with operational guardrails. | The ReAct loop lets the LLM either call read tools or output final operations; the updater directly applies final output (`extract_loop.py:41-50`, `extract_loop.py:221-303`, `extract_loop.py:591-690`, `memory_updater.py:609-615`, `memory_updater.py:699-827`). | Schema, locks, read-before-edit, patch validation, URI resolution, and system-managed field preservation reduce operational damage; they do not make the semantic decision non-LLM. |
| "Small model is enough" is proven by the repo or our local evaluation. | Not proven. | README says OpenViking can run with local/Ollama models and can recommend local embedding/VLM models (`README.md:274-296`). Local dense embedding default is `bge-small-zh-v1.5-f16` (`local_embedders.py:21-45`). Our local index precision evaluation explicitly says it was a strong-model paper pass and does not prove the small-model claim (`index-precision-evaluation.md:14-29`). | Local/offline model support is real. Quality sufficiency for L0/L1 extraction under small VLM/LLM is a separate claim and remains unverified. |
| Multi-tenant/concurrency isolation is nonexistent. | Too strong for current OV. | `SemanticMsg` carries account/user/peer IDs and coalesce keys; queue dedupes/coalesces; vector backend applies account and visible-root filters; sidecars use exact locks (`semantic_msg.py:14-23`, `semantic_msg.py:41-100`, `semantic_queue.py:16-73`, `viking_vector_index_backend.py:1327-1338`, `namespace.py:196-200`, `semantic_sidecar.py:14-60`). | GitHub issue #2263 is open: storage identity and account key derivation still have lower-level identity gaps. Code confirms local vector labels hash only `data[pk]`, and HKDF info uses account ID only (`str_to_uint64.py:6-10`, `local_collection.py:588-610`, `crypto/providers.py:46-108`). |

## 2. Resource Sidecar Pipeline

Actual production resource sidecar path at this commit:

```text
SemanticMsg
  -> SemanticProcessor.on_dequeue
  -> SemanticDagExecutor
  -> per-file summary
       code AST summary / code summary / doc summary / generic file summary / media summary
  -> directory overview prompt from file summaries + child abstracts
  -> extract L0 abstract from generated L1 overview
  -> write .overview.md + .abstract.md under exact locks and stale check
  -> vectorize L0 abstract + L1 overview records
  -> hierarchical retriever uses non-L2 hits as starting directories
```

The sidecar prompt surface is smaller and more specific than the earlier blind-test protocol assumed:

| Prompt group | Files | Used by current resource sidecar path? |
|--------------|-------|-----------------------------------------|
| `semantic/code_ast_summary.yaml` | code skeleton to prose summary | Yes, in `code_summary_mode=ast_llm`. |
| `semantic/code_summary.yaml` | code content summary, 80-200 words, classes/functions/dependencies/architecture role/keywords | Yes (`semantic_processor.py:1098-1106`, template lines `25-53`). |
| `semantic/document_summary.yaml` | document summary, 60-180 words, sections/concepts/audience/keywords | Yes (`semantic_processor.py:1108-1121`, template lines `25-59`). |
| `semantic/file_summary.yaml` | generic file summary | Yes. |
| `semantic/overview_generation.yaml` | directory L1 overview, 400-800 words, title/brief/quick navigation/details | Yes (`semantic_processor.py:1357-1369`, template lines `30-75`). |
| `parsing/context_generation.yaml` | single JSON output with `semantic_title`, `abstract`, `overview` | Template exists, but I did not find current production resource sidecar code calling `parsing.context_generation`. |

This changes the interpretation of [prompt-quality-blind-test.md](./prompt-quality-blind-test.md):

- It correctly evaluated the architectural idea "L0/L1 as index surface", and the boundary in [index-precision-evaluation.md](./index-precision-evaluation.md) is still valid.
- It should not be read as "we reproduced OpenViking's current production sidecar pipeline", because current code generates file summaries and directory overviews in multiple passes rather than one `context_generation` JSON call.

## 3. Failure-Mode Lens

| Failure mode | What OV does | Assessment |
|--------------|--------------|------------|
| Missing sidecar | `abstract()` and `overview()` return explicit not-ready strings (`viking_fs.py:1219-1323`). | Good operational visibility. |
| VLM unavailable for text summary | Returns empty summary (`semantic_processor.py:1054-1057`). | Prevents crash, but can degrade index quality silently. |
| Directory overview generation exception | Writes/generated returns `"[Directory overview is not generated]"` placeholder (`semantic_processor.py:1380-1385`). | Visible but still becomes a sidecar candidate unless downstream blocks it. |
| Concurrent semantic writes | Coalesce version, stale checks, and exact sidecar locks (`semantic_queue.py:22-73`, `semantic_sidecar.py:14-60`). | Real system engineering; much stronger than AtomMem's JSON-file style. |
| Wrong but plausible generated L0/L1 | No semantic quality gate found before sidecar write and vectorization (`semantic_dag.py:789-856`, `embedding_utils.py:253-350`). | Main epistemic risk. It can look healthy and still mis-index. |
| Generated-vs-observed label | Not present on `MatchedContext` output fields (`types.py:280-293`, `types.py:373-385`). | Retrieval consumer cannot tell whether a field is raw content, generated summary, or user-stated fact from the result alone. |

## 4. Session Memory Path

The memory extraction path is a second ingestion-time LLM judge surface:

```text
session commit
  -> compressor_v2.extract_long_term_memories
  -> SessionExtractContextProvider instruction + memory schemas
  -> ExtractLoop ReAct call
       model may read/search
       model eventually outputs memory operations JSON
  -> resolve operations + patch validation/refetch
  -> MemoryUpdater.apply_operations
       write / edit / delete memory files
       vectorize changed memories
       regenerate overviews
```

There are meaningful safeguards:

- The instruction says only read/search tools are available, existing files must be fully read before edit, user-role content is the source for user profile/preferences/entities/events, and assistant-role content is the source for agent cases/patterns/tools/skills (`session_extract_context_provider.py:210-239`).
- The final model output must follow a JSON schema (`extract_loop.py:157-193`).
- The loop retries for format errors, refetches unread existing files, and validates patch operations before applying (`extract_loop.py:205-303`).
- The updater reads current disk state before patching, preserves system-managed fields, writes through VikingFS, deletes through `rm`, and vectorizes written/edited memories (`memory_updater.py:699-827`, `memory_updater.py:856-960`, `memory_updater.py:1013-1030`).
- Memory prompt templates are concrete and narrower than a generic "summarize chat" prompt. Example: `profile.yaml` says to extract only facts stated/confirmed by user and no guesses; `events.yaml` enforces atomic event extraction and date normalization (`profile.yaml:1-52`, `events.yaml:1-22`, `events.yaml:89-148`).

The remaining gap is still first-principles:

**The LLM decides what deserves write/edit/delete. The system constrains shape and race behavior, but not truth authority.**

This is not as loose as AtomMem's fact JSON pipeline, but it has the same class of risk for agent memory: a wrong-but-valid memory operation can become durable and later retrievable unless another layer catches it.

## 5. Benchmark Coupling

OpenViking does have benchmark-specific prompt engineering:

- `locomo_prompts.py` contains a long answer-generation prompt with LoCoMo-specific reasoning steps, reference-date grounding, "all events occurred in 2022-2024", and "never return empty answer" behavior (`locomo_prompts.py:18-76`).
- LoCoMo categories exist, and category 5 adversarial questions are excluded from evaluation (`locomo_prompts.py:7-15`).
- The single-search harness excludes `.abstract.md` and `.overview.md` basenames when selecting contexts for direct answer generation, then reads context contents and reranks (`run_eval.py:301-326`, `run_eval.py:508-560`).

But the AtomMem smoking gun does not reproduce here:

- I did not find production semantic ingestion branching on LoCoMo category.
- `get_answer_generation_prompt()` does not accept category; judge prompt helpers accept category but delete it (`locomo_prompts.py:93-123`, `locomo_prompts.py:240-259`).
- The resource sidecar code path renders `semantic.*` templates, not benchmark prompt modules (`semantic_processor.py:1081-1120`, `semantic_processor.py:1357-1369`).

Verdict:

**OpenViking's benchmark harness is prompt-engineered, but from inspected evidence it is not benchmark-category-coupled in the production ingestion path the way AtomMem was.**

## 6. OpenViking vs AtomMem

| Axis | AtomMem | OpenViking | Verdict |
|------|---------|------------|---------|
| Ingestion unit | LLM extracts atomic facts/events/profiles. | VLM/LLM generates resource sidecars and session memory operations. | Same epistemic class: generated memory/index becomes durable retrieval material. |
| Real algorithmic/system core | Graph PPR/RWR reranker plus LLM orchestration. | Hierarchical vector retrieval, async semantic queue, sidecar locking, virtual filesystem, session memory executor. | OV has more real system engineering. |
| Benchmark coupling | Main QA path branches on LoCoMo category prompt files. | Benchmark answer prompts are engineered; no production ingestion category split found. | AtomMem worse on benchmark-coupling evidence. |
| Missing/wrong fallback | JSON/demo style; weak production story. | Explicit not-ready fallbacks, empty/placeholder handling, stale/lock controls. | OV stronger operationally. |
| Trust labeling | Generated facts treated as facts. | `MatchedContext` exposes score/level/category/retrieval trace, not authority/confidence/source tier. | Same trust gap for agent consumption. |
| Multi-tenant/concurrency | Weak/no production isolation in inspected demo. | Identity model, tenant filters, coalescing, locks; open #2263 storage identity issue remains. | OV stronger, not done. |
| Small-model claim | Not central. | Local/Ollama support exists; small-model L0/L1 quality not proven. | Unsupported quality claim. |

Short version:

**AtomMem is a research demo with one clean graph idea and benchmark-coupled prompt plumbing. OpenViking is a serious context database system that still uses LLM-generated sidecars/memories as first-class index material. The latter deserves more respect and more stringent epistemic gating.**

## 7. Cat Cafe Takeaways

Learn:

- Sidecar pipeline discipline: explicit L0/L1 files, bottom-up generation, stale checks, coalescing, exact write locks.
- API ergonomics: `abstract(uri)`, `overview(uri)`, `read(uri)` is a clean L0/L1/L2 contract.
- Session memory executor guardrails: schema-driven operations, read-before-edit, patch validation, preserved system-managed fields, diff artifact.
- Benchmark humility: separate "retrieval path/answer prompt benchmark" from "ingestion quality benchmark".

Do not follow:

- Do not let generated sidecars or generated memory become primary evidence without `sourceTier`, `authority`, `confidence`, and `generated_from` pointers.
- Do not evaluate L0/L1 with a strong model and infer small-model viability.
- Do not use retrieval trace/provenance as a substitute for epistemic provenance. "How it was found" is not "what kind of evidence it is".
- Do not treat prompt rules like "no guesses" as a verification layer. They are useful steering, not an authority boundary.

Suggested Cat Cafe gates if we borrow this design:

- Every generated sidecar/memory stores source spans or source message ranges.
- Retrieval result objects carry `observed | generated | inferred`, source tier, confidence, and owner/scope.
- Generated memories require a correction/write-back path and an audit diff visible to the agent.
- Small-model claims get a separate eval matrix: model, prompt, corpus hardness, query set, false-positive rate.

## 8. Reviewer Questions

1. Should we amend [prompt-quality-blind-test.md](./prompt-quality-blind-test.md) or add a short note there that `parsing.context_generation` is not the current production resource sidecar path at `1494bdeae`?
2. Should #2263 stay as a caveat in this ingestion note, or move into a separate OpenViking storage/security audit?
3. Do we want a follow-up live test that runs current `semantic.*` prompts over the same 10 F243 docs, instead of the older `parsing.context_generation` protocol?

[砚砚/gpt-5.5🐾]
