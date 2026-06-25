---
doc_kind: research-note
topics:
  - openviking
  - open-source-teardown
  - memory
  - retrieval
  - mcp
  - agent-surface
created: 2026-06-24
status: draft
source_repo: https://github.com/volcengine/OpenViking
source_local_path: /Users/lysander/projects/ref/OpenViking
source_commit: 1494bdeae70c06954f81a5d192639871317f2173
source_status: clean
baseline_report: ./cat-cafe-memory-agent-surface.md
authored_by: "@codex"
covers:
  - mcp-surface
  - retrieval-recall
  - raw-drilldown
  - skills-surface
  - tenant-scoping
  - comparison
---

# OpenViking Agent Surface Deep Dive

This is report 2 in the memory-system comparison series. It inspects OpenViking only, using the Cat Cafe baseline axes from `cat-cafe-memory-agent-surface.md`.

Scope boundaries:

- Focus: agent-facing surface, MCP tools, retrieval/recall chain, raw drill-down, skill contract, and tenant scoping.
- Out of scope: full ingestion prompt teardown. That already lives in `../2026-06-23-openviking-deep-dive/ingestion-llm-judge-deep-dive.md`.
- Source snapshot: `/Users/lysander/projects/ref/OpenViking` at `1494bdeae70c06954f81a5d192639871317f2173`, working tree clean.

## 0. Executive Verdict

OpenViking is a real agent-facing context system, not a research demo. It exposes a built-in HTTP MCP endpoint, a broad tool surface, URI-based raw drill-down, exact grep/glob, code navigation tools, watch/resource ingestion controls, and server-side account/user/actor-peer scoping.

The important shape:

```text
resources / memories / skills in viking:// namespaces
  -> L0 .abstract.md / L1 .overview.md / L2 raw content
  -> dense+sparse vector retrieval + hierarchical L0/L1/L2 traversal
  -> optional rerank model + hotness heuristic
  -> MCP tools: find/search/read/list/remember/add_resource/grep/glob/code tools/etc.
  -> optional plugin skills that teach agents to search then read exact URI
```

The strongest OpenViking idea for Cat Cafe is not "LLM summaries are enough." It is the operational contract: every semantic result is a `viking://` URI and the agent is repeatedly taught to `read` that URI for full content. It also exposes deterministic tools around semantic search: `grep`, `glob`, `code_outline`, `code_search`, and `code_expand`.

The main weakness is still epistemic. OpenViking returns `score`, `level`, `context_type`, `abstract`, and sometimes `match_reason`/`provenance` in HTTP JSON, but it does not label whether the displayed text is original observation, generated sidecar, extracted memory, derived summary, or user-authored content. MCP output is even flatter: `[resource 82%] uri` plus an abstract. The agent can drill down, but the result itself does not carry source-tier/authority semantics.

Compared with Cat Cafe:

- OpenViking has a broader production MCP/tool surface than Cat Cafe's current memory tool family.
- Cat Cafe has a stronger epistemic result schema: authority/provenance/sourcePath/passages/ranking factors.
- Cat Cafe has BM25/FTS + vector RRF hybrid recall. OpenViking uses dense+sparse vector search and a separate exact `grep` path; I did not find a BM25/FTS fusion path in the semantic retriever.
- OpenViking tenant/actor-peer scoping is real and should get credit. It is much stronger than AtomMem's demo-style `conversation_id` namespace.

## 1. Claim Ledger

| Claim | Verdict | Evidence | Caveat |
| --- | --- | --- | --- |
| OpenViking has a first-class MCP endpoint. | Supported | `docs/en/guides/06-mcp-integration.md:1-13` says the server has built-in HTTP MCP at `/mcp`; `openviking/server/mcp_endpoint.py:207-210` constructs `FastMCP("openviking")`. | Tool docs drift from source: docs say 14 tools and `store`; source has 15 tools and names the memory-write tool `remember`; lifespan log says 13 tools. |
| MCP result surface gives agents a search -> read loop. | Supported | `find`/`search` return formatted URI+abstract+score and append "Use the read tool to expand a URI" in `mcp_endpoint.py:265-290`; `read` batches one or more `viking://` URIs in `mcp_endpoint.py:296-323`. | The formatted MCP output drops `level`, `match_reason`, query-plan provenance, and source-tier labels. |
| Retrieval is hierarchical vector search, not BM25+embedding RRF. | Supported | `viking_fs.py:1343-1432` and `1434-1562` call `HierarchicalRetriever`; the retriever embeds the query, runs global root vector search, then recursive child vector search in `hierarchical_retriever.py:134-215` and `367-543`. | It passes dense and sparse query vectors, so "embedding-only" is too narrow. Exact lexical search exists as `grep`, but not as a fused semantic-search branch. |
| `search` is not always LLM query planning. | Supported | `viking_fs.py:1490-1503` runs `IntentAnalyzer` only when `session_summary` or `current_messages` exist; otherwise it creates a direct `TypedQuery`. | The docs simplify this as "search adds intent analysis"; the code path is conditional. |
| Raw source is reachable from results. | Supported | MCP `read` returns full content for exact URIs; OpenClaw plugin skill says `ov_search` returns virtual URIs and agents must call `ov_read` for full content in `examples/openclaw-plugin/.../SKILL.md:210-229`. | Search output itself is still a generated sidecar/summary view unless the agent drills down. |
| OpenViking exposes deterministic recovery tools beyond semantic search. | Supported | MCP has `grep`, `glob`, `code_outline`, `code_search`, and `code_expand` in `mcp_endpoint.py:707-911`. | These tools are side paths; semantic result ranking does not automatically incorporate exact grep/BM25 hits. |
| Tenant/account/actor-peer scoping is enforced server-side. | Supported | MCP middleware resolves identity; default target dirs include user, resources, and actor-peer subtrees; vector filters add `account_id` and visible roots in `viking_vector_index_backend.py:1294-1338`. | Root role bypasses tenant filter by design. The security model depends on correct server/API-key deployment. |
| OpenViking supports skills as searchable/importable context. | Supported | `docs/en/api/04-skills.md:1-18` defines skills as callable capabilities stored under user skills root; `04-skills.md:80-91` says MCP tool format can be auto-converted to skill format. | Skills are context/metadata inside OpenViking, not necessarily active runtime tool dispatch unless an integrating agent/plugin consumes them. |
| OpenViking solves generated-vs-observed labeling. | Not supported | `MatchedContext` fields are `uri`, `context_type`, `level`, `abstract`, `overview`, `category`, `score`, `match_reason`, `relations` in `openviking_cli/retrieve/types.py:280-293`. | It has optional retrieval provenance for query traces, but that is not epistemic source-tier. |

## 2. MCP Tool Surface

Source truth: `openviking/server/mcp_endpoint.py` has 15 `@mcp.tool` functions.

| Tool | Agent-facing role | Inputs | Output shape | State mutation | Risk / note |
| --- | --- | --- | --- | --- | --- |
| `find` | Fast semantic retrieval without session context. | `query`, `target_uri`, `limit`, `min_score`, `level`. | Text list: `[ctx_type score%] uri` plus abstract. | No | Uses `service.search.find`; no intent analysis. |
| `search` | Deeper retrieval with optional session context. | `query`, `target_uri`, `session_id`, `limit`, `min_score`, `level`. | Same formatter as `find`. | No | LLM intent analysis only when session context exists. MCP formatter hides query plan. |
| `read` | Expand one or many exact `viking://` URIs. | `uris` string or list. | Full content, batched with headers. | No | Core raw drill-down path. |
| `list` | List a VikingFS directory. | `uri`, `recursive`. | `[dir] name` / `[file] uri`. | No | Good zero-prior browse path. |
| `remember` | Store messages into long-term memory. | `messages[]` with role/content. | Success text. | Yes | Triggers async memory extraction from stored session. Docs call this `store`, source calls it `remember`. |
| `add_resource` | Import URL or local file into resources. | `path`, `temp_file_id`, `description`, `watch_interval`, `to`, `args`. | Success text or two-step upload instruction. | Yes | Strong agent ergonomics for sandboxed local-file upload; ingestion is async. |
| `list_watches` | Show visible refresh subscriptions. | none | Lines with target URI, interval, status, next time. | No | Filtered by account/user/role. |
| `cancel_watch` | Delete a watch subscription by URI. | `to_uri`. | Success/error text. | Yes | Minimal watch closure; pause/resume/trigger intentionally not exposed. |
| `grep` | Exact regex content search. | `uri`, `pattern`, `case_insensitive`, `node_limit`. | URI + line hits. | No | Important complement to semantic search. |
| `glob` | Filename matching. | `pattern`, `uri`, `node_limit`. | Matching file URIs. | No | Helps discover exact URI before read/code tools. |
| `forget` | Delete a `viking://` URI. | `uri`, `recursive`. | `Deleted: uri`. | Yes, irreversible | Tool docstring tells agents to confirm first, but the tool itself cannot enforce human confirmation. |
| `code_outline` | Show symbols in one source file. | file `uri`. | Classes/functions/methods and line ranges. | No | Requires ingested code as `viking://` file. |
| `code_search` | Search symbol names under a code subtree. | `query`, directory `uri`. | Symbol type, class context, file URI, line range. | No | Capped at 200 source files; explicit scope required. |
| `code_expand` | Return one named symbol body. | file `uri`, `symbol`. | Source body. | No | Good precise-code drill-down. |
| `health` | Server health check. | none | Health text. | No | Operational sanity check. |

### Tool Count / Naming Drift

There are three inconsistent source-of-truth surfaces:

- Source has 15 MCP tools: `find`, `search`, `read`, `list`, `remember`, `add_resource`, `list_watches`, `cancel_watch`, `grep`, `glob`, `forget`, `code_outline`, `code_search`, `code_expand`, `health`.
- Docs say "14 tools" and list `store`, not `remember`, in `docs/en/guides/06-mcp-integration.md:110-130`.
- The MCP lifespan log says "13 tools" and omits `list_watches` / `cancel_watch` in `mcp_endpoint.py:932-938`.

This is not a core architecture failure, but it matters for an agent-facing product. Tool names are the contract.

## 3. Retrieval / Recall Chain

### Public Entrypoints

MCP `find` calls:

```text
mcp.find
  -> service.search.find
  -> VikingFS.find
  -> HierarchicalRetriever.retrieve
```

MCP `search` calls:

```text
mcp.search
  -> optionally load session by session_id
  -> service.search.search
  -> VikingFS.search
  -> optional IntentAnalyzer if session context exists
  -> one or more TypedQuery
  -> HierarchicalRetriever.retrieve
```

`find` and `search` share the same MCP formatter. The backend `FindResult.to_dict()` can include more fields, but MCP turns it into a compact textual list.

### Retrieval Mechanics

The actual retriever is a hierarchical vector traversal:

1. Build dense and sparse vectors for the query.
2. Resolve target directories from `target_uri` or request context.
3. Run global root vector search in the current tenant scope.
4. Merge explicit root directories with global hits as starting points.
5. Recursively search children under L0/L1 directories.
6. Propagate scores from parent to child with `score_propagation_alpha`.
7. Optionally rerank child docs with a reranker client.
8. Stop on convergence/stagnation after bounded rounds.
9. Convert candidates into `MatchedContext`, append L0/L1 suffixes, and optionally blend hotness score.

This is meaningful production engineering. It is not just "ask an LLM to pick memories."

### What It Is Not

I did not find Cat Cafe-style BM25/FTS + embedding RRF fusion in the semantic search path. OpenViking uses dense/sparse vector retrieval and exposes deterministic exact search as separate MCP/filesystem tools:

- Semantic/vector path: `find` / `search`.
- Exact content path: `grep`.
- Filename path: `glob`.
- Code symbol path: `code_search` / `code_outline` / `code_expand`.

That separation is workable, but it pushes recall strategy to the agent. If the agent only calls `search`, exact IDs, feature numbers, path fragments, and command snippets may be weaker than Cat Cafe's hybrid mode. If the agent knows to fall back to `grep`/`glob`, OpenViking has the primitives.

### Result Shape

Underlying `MatchedContext` has:

```text
uri
context_type
level
abstract
overview
category
score
match_reason
relations
```

`FindResult.to_dict(include_provenance=True)` can also include `query_plan` and retrieval provenance: searched directories, matched contexts, thinking trace. That is useful for debugging why a query hit.

But MCP `find`/`search` reduce this to:

```text
Found N item(s):

- [resource 82%] viking://...
    abstract text

Use the read tool to expand a URI.
```

That means the most common agent interface does not display:

- L0/L1/L2 level.
- Whether the abstract is generated, user-authored, or extracted.
- Source authority / trust tier.
- Query plan or retrieval provenance.
- Match reason.

The drill-down path exists. The epistemic label is missing.

## 4. Raw Drill-Down / Exact Recovery

OpenViking is much stronger than AtomMem here.

| Need | OpenViking tool | Why it matters |
| --- | --- | --- |
| Expand semantic hit | `read` | Every search hit is a `viking://` URI and the MCP output tells the agent to expand it. |
| Inspect a directory | `list` | Agent can browse tree structure without guessing exact filenames. |
| Find exact phrase / command / ID | `grep` | Regex hits include URI and line number. |
| Find file by pattern | `glob` | Helps recover exact source file paths. |
| Navigate ingested code | `code_outline`, `code_search`, `code_expand` | Avoids reading huge code files when the agent needs a symbol. |
| Import new evidence | `add_resource` | URL and local-file flows are agent-safe enough for MCP clients, including signed progressive upload. |

This is the part Cat Cafe should study seriously. Cat Cafe already has `cat_cafe_read_file_slice`, session-chain drill-down, and source paths. OpenViking's added lesson is the closure around exact recovery: semantic search should sit beside grep/glob/code navigation, not replace them.

## 5. Tenant / Multi-Collection Scoping

OpenViking has real scoping at several layers:

- MCP requests pass through identity middleware, resolving API key/OAuth and request headers into `RequestContext`.
- Default target directories are derived from role, current user root, resources, skills, and actor-peer visibility.
- VikingFS read/write/delete call access guards before touching content.
- Vector searches build filters from `account_id`, visible roots, context type, and target directories.
- Actor-peer mode can restrict default memory/resource targets to current user plus one peer subtree.

This is a genuine strength. It is not the same class of risk as AtomMem's global JSON directory plus `conversation_id`. For Cat Cafe comparison, OpenViking should be treated as a serious multi-user backend with some caveats, not a single-user demo.

Caveats:

- Root role intentionally bypasses tenant filtering.
- Skill roots are user-scoped, not peer-scoped, per `docs/en/api/04-skills.md:189-192`.
- Correct isolation still depends on deployment discipline: API keys, OAuth, trusted headers, and not running production in local-dev no-auth mode.

## 6. Skills / Agent Contract

OpenViking has three surfaces that can all be called "skills"; they should not be conflated.

### 6.1 MCP Tools

The MCP endpoint is the external agent runtime surface. It is executable: agents can call `search`, `read`, `remember`, `add_resource`, `grep`, and the rest.

### 6.2 Skills Stored In OpenViking

OpenViking stores skills under `viking://user/{user_id}/skills/` with:

```text
.abstract.md
.overview.md
SKILL.md
auxiliary files
```

It supports `SKILL.md` files, structured skill data, and MCP tool format auto-conversion. This is useful: tools/skills are searchable context, not only local files.

But stored skills are not automatically active runtime tools by themselves. An integrating agent/plugin must decide how to discover, load, and invoke them.

### 6.3 OpenClaw Plugin Skill

The OpenClaw plugin skill is the clearest agent-contract document I found. It tells agents:

- Use `memory_recall` for preferences/known facts.
- Use `memory_store` when the user asks to remember.
- Use `ov_search` for OpenViking-managed resources/skills.
- Use `ov_read` on exact `viking://` URIs returned by search.
- Use archive search/expand for old session details.
- Use recall trace tools to debug why recall returned something.

This is strong ergonomics. It explicitly says OpenViking virtual URIs are not local file paths and instructs the agent to use `ov_read` for full content.

The gap versus Cat Cafe is not "no skills." The gap is that the skill contract still mostly says how to navigate results, not how to reason about source authority. It gives a read-back path, but not an epistemic schema.

## 7. Algorithm Peel

| Mechanism | Category | Real role | Agent-visible? | Risk |
| --- | --- | --- | --- | --- |
| Dense+sparse query embedding | Model retrieval | Turns query into vectors for vector store search. | No, except scores. | Semantic recall can miss exact IDs unless agent uses grep/glob. |
| Hierarchical L0/L1/L2 traversal | Engineering algorithm | Searches roots and recursively descends directories/sidecars. | Partly via URI levels. | MCP formatter hides level, so agent may not know whether it got L0 or L2. |
| Optional reranker | Model rerank | Reorders child candidates when configured. | No | Adds another opaque relevance score. |
| IntentAnalyzer | LLM query planner | Generates typed queries from session context. | HTTP JSON can include query_plan; MCP hides it. | Query rewrite is generated content unless surfaced clearly. |
| Hotness score | Heuristic rerank | Blends active_count/updated_at into final score when configured. | No | Reuse/freshness can improve ergonomics but is not truth authority. |
| `grep` / `glob` | Deterministic retrieval | Exact content / filename recovery. | Yes | Not fused into semantic retrieval; agent has to choose it. |
| Code symbol tools | Deterministic-ish parser tooling | Outline/search/expand code symbols from ingested code. | Yes | Only useful after code is ingested and URI known. |
| `remember` / session commit | LLM memory extraction pipeline | Stores messages and triggers extraction. | Yes as mutation tool, internals hidden. | Extracted memory inherits ingestion-time LLM-judge risks from the sibling report. |
| Tenant filters | Security/policy | Enforces account and visible-root scope in vector queries. | Mostly hidden. | Deployment/config mistakes still matter. |

## 8. 9-Axis Comparison Against Cat Cafe Baseline

| Axis | OpenViking verdict | Cat Cafe baseline contrast | Takeaway |
| --- | --- | --- | --- |
| Truth source | Mixed but workable: raw files/resources remain reachable, while L0/L1 sidecars are generated first-class context. | Cat Cafe treats markdown/human-readable source and runtime traces as truth; DB/vector are compiled layers. | OV's raw `read(uri)` path is strong, but sidecar-generated text needs source-tier labels. |
| Ingestion | LLM sidecars and memory extraction are central; previous ingestion report found real engineering guardrails but no generated-vs-observed label. | Cat Cafe indexes existing docs/traces and uses generated summaries with raw source links and provenance fields. | OpenViking is stronger than AtomMem operationally, but same epistemic class at ingestion. |
| Recall | Dense+sparse vector + hierarchical traversal + optional rerank + separate exact tools. | BM25/FTS + vector + RRF hybrid in one `search_evidence` surface. | OV has good primitives; Cat Cafe has stronger fused exact+semantic default. |
| MCP surface | Very broad and production-shaped: 15 tools including resource ingestion, watches, grep/glob, code tools, health. | Cat Cafe memory surface is narrower but typed around evidence/provenance. | Borrow OV's broad closure, not its flat search result schema. |
| Raw drill-down | Strong: every result is a URI; `read`, `grep`, `glob`, code tools exist. | Strong: `sourcePath`, `read_file_slice`, session-chain tools. | Both are good; OV's exact-recovery tool breadth is worth copying. |
| Epistemic labels | Weak: score/level/context_type, but no authority/source-tier/generated-vs-observed. | Stronger: authority/provenance/sourcePath/passages/status/ranking factors. | Cat Cafe's direction is right; tighten naming around `confidence`. |
| Skill contract | Good: OpenClaw skill tells agents when to recall/store/search/read/trace. | Good: `memory-navigation` and search best-practices route anchor/fuzzy/recent cases. | OV validates that skills are product surface, not docs garnish. |
| Feedback loop | Partial: active_count/updated_at hotness, watches, recall traces, session commit flow. | Partial-to-stronger design: F200 consumption signals, ranking factors, outputVerified bridge pending. | Both need care not to treat usage as truth. |
| Multi-collection / tenant scoping | Strong: account/user/actor-peer filters are server-side and vector-store enforced. | Cat Cafe has collection/dimension routing and server-derived visibility boundaries. | OV is a serious reference for tenant/actor-peer ergonomics. |

## 9. User-Mind Evaluation

The question: if an autonomous agent uses OpenViking memory/search results, can it continue work, distinguish evidence quality, and close the loop?

### L1: Can Continue Work - Pass

OpenViking gives agents usable next actions:

- Search returns concrete `viking://` URIs.
- MCP output explicitly says to use `read`.
- `list`, `grep`, `glob`, and code tools provide fallback routes when semantic search is insufficient.
- OpenClaw plugin skill adds a tool-selection guide for recall/store/search/read/trace.

### L2: Can Distinguish Evidence Quality - Fail

The agent can distinguish coarse context type (`memory`, `resource`, `skill`) and L0/L1/L2 level in HTTP JSON, but those are storage/type and summary-depth labels, not epistemic labels. Neither layer distinguishes:

- User-authored raw observation.
- LLM-generated abstract/overview.
- LLM-extracted long-term memory.
- Query-planner-generated search intent.
- Retrieval score vs truth confidence.
- Authority/trust tier.

The system gives a path to inspect raw content, but the result object itself does not warn the agent that the summary is generated. Under the User-Mind L2 rubric, that is a fail, not a partial pass.

### L3: Can Close The Loop - Fail

OpenViking has useful operational tools:

- `read` verifies raw content.
- `grep` can search exact text with line numbers.
- `remember` can store new user facts.
- `add_resource` can import missing context.
- `forget` can delete wrong/obsolete content.
- `list_watches` / `cancel_watch` close the resource refresh loop.

But mutation is not the same as epistemic loop closure. If an LLM-generated memory is wrong, the tool surface lets an agent delete/import/store, but it does not expose a structured correction API with authority/confidence transitions or a verify -> mark observed -> re-rank path. `forget` is irreversible and relies on the agent honoring the docstring's "confirm first" instruction.

### Layer C: Engineering Mind Fit

| Check | Verdict | Note |
| --- | --- | --- |
| Natural next action visible? | Yes | Search output says read; plugin skill says search -> read. |
| Deterministic verification path? | Yes | `read`, `grep`, `glob`, code tools. |
| Provenance/debug path? | Partial | Retrieval provenance/query_plan exists in HTTP JSON; MCP formatted text hides it. Recall trace exists in plugin, gated by config. |
| Epistemic source-tier visible? | No | No authority/generated/observed split in result schema. |
| Safe mutation path? | Partial | Add/store/watch are ergonomic; forget is irreversible with soft confirmation only. |

Overall: OpenViking is an excellent exploration and context-recovery substrate, but not an epistemically labeled memory backend.

## 10. What Cat Cafe Should Learn / Not Follow

### Learn

1. Expose exact recovery beside semantic search.

   `grep`, `glob`, `code_outline`, `code_search`, and `code_expand` are not fluff. They close the gap when semantic search misses exact commands, IDs, filenames, or code symbols.

2. Make `read(uri)` the obvious next move.

   OpenViking repeatedly encodes the agent loop as search -> URI -> read. Cat Cafe already has this shape with source paths and `cat_cafe_read_file_slice`; the lesson is to make it more visible and boringly reliable.

3. Treat MCP upload/import ergonomics as product surface.

   The progressive upload flow for local files is a practical answer to sandboxed MCP clients. It avoids pretending a remote server can read the agent's local path.

4. Keep watch management minimal in MCP.

   `list_watches` and `cancel_watch` are enough for common agent operation. More powerful watch operations are intentionally held back for REST/CLI.

5. Study actor-peer scoping.

   OpenViking's account/user/actor-peer split is a useful reference for any future Cat Cafe memory surface that needs assistant/person scoped memories.

### Do Not Follow

1. Do not ship tool/docs naming drift.

   `store` vs `remember`, 14 vs 15 vs 13 tools is exactly the kind of mismatch that makes agents hallucinate capabilities.

2. Do not collapse epistemic state into `score`.

   Relevance score is not truth confidence. Generated abstract is not raw observation. Hotness is not authority.

3. Do not hide query planning when the agent needs auditability.

   If a backend LLM rewrites a query, the MCP response should surface that plan or at least mark it as generated. HTTP JSON has query_plan; MCP text drops it.

4. P0反模式: Do not rely on docstring-only confirmation for irreversible deletes.

   `forget` says to confirm, but the tool cannot enforce that. A default-permitted destructive action guarded only by prompt text is a P0 safety pattern for Cat Cafe. Irreversible state changes need a hard confirmation boundary, not just a tool docstring.

5. Do not assume semantic search covers exact recall.

   OpenViking's own broad tool surface proves the opposite: exact recovery needs first-class tools.

## 11. OpenViking vs AtomMem Preview

This report should not be used to flatten OpenViking into the same bucket as AtomMem.

OpenViking is stronger on:

- First-class MCP endpoint.
- Raw URI drill-down.
- Tenant/account/actor-peer scoping.
- Exact recovery tools.
- Resource ingestion/watch ergonomics.
- Tests around MCP and retrieval behavior.

AtomMem appears weaker on:

- No first-class MCP surface found in the previous teardown.
- Demo/benchmark orientation.
- LoCoMo category coupling in answer prompt path.
- Single-process JSON namespace and no multi-tenant/concurrency story.

But they share one architectural blind spot: generated memory/search artifacts enter the agent surface without source-tier/authority labeling. That is the cross-project lesson.

## 12. Reviewer Questions

1. Does this report give enough credit to OpenViking's tenant/actor-peer scoping, or should that become a separate comparison axis in the final synthesis?
2. Should Cat Cafe copy OpenViking's code navigation MCP tools as memory-adjacent tools, or keep code navigation separate from memory search?
3. Is "no BM25+embedding fusion" too strong given OpenViking's sparse query vector support? My current wording is: dense+sparse vector retrieval exists, but not Cat Cafe-style BM25/FTS + vector RRF fusion.
4. Should the final trilogy synthesis treat OpenViking's OpenClaw plugin skill as part of the product surface, or only the built-in MCP endpoint?
5. For AtomMem next, should the main axis start from "no MCP / demo API" or from its retrieval graph path and then map back up to absent agent surface?

[砚砚/gpt-5.5🐾]
