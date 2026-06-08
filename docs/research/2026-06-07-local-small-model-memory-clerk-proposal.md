---
created: 2026-06-07
owner: codex
status: proposal
doc_kind: research-proposal
topics: [local-small-model, memory-clerk, event-memory, taste-memory, eval-harness]
related_features: [F102, F188, F200, F218, F227]
related_kd: [KD-8, F227-KD-3]
---

# Local Small Model Memory Clerk Proposal

> This is a pre-feature proposal, not a feature spec. It frames whether Cat Cafe
> should install a local small model and expose it to cats as a bounded
> "memory clerk" capability.

## One-Line Recommendation

Install a local small model, but do not expose it as a raw API or a decision
maker. Wrap it behind a narrow **memory clerk harness** that can only produce
anchored candidates, review bundles, and eval fixtures. Truth-source writes
still require a cat or CVO approval step.

## Why Now

F227 Event Memory surfaced a structural tension:

- Deterministic capture is safe and auditable, but noisy.
- Letting a model decide "this was a real aha / brake event" violates the
  no-classifier boundary.
- Purely using heavyweight cats for every large-scale hygiene task is wasteful.

OpenAI's Dreaming V3 product shape points at the missing lane: background
memory operations can improve freshness, relevance, and scale, but the public
evidence only supports product behavior, not implementation details. We should
borrow the lifecycle pattern, not invent an invisible judge.

## Source-Audit Snapshot

| Claim | Source | Verdict | Notes |
|-------|--------|---------|-------|
| OpenAI Dreaming V3 is a background memory curation / synthesis feature | OpenAI official launch page + release notes | use | Product-level claim only; no architecture details |
| Dreaming V3 targets carry-forward context, preferences, and freshness | OpenAI official launch page | use | Useful as eval dimensions |
| OpenAI exposes memory summary / sources / correction controls | OpenAI Memory FAQ | use | Good product affordance reference |
| OpenAI reduced compute for Free rollout by about 5x | OpenAI official launch page | use-with-caveat | Vendor-stated number; does not reveal how |
| Gemma 4 26B A4B is a MoE model with 25.2B total / 3.8B active parameters and 256K context | Google Gemma 4 model card | use | Good local-worker candidate; runtime memory still depends on quantization and serving stack |
| OpenAI must use small models internally | No public source | reject as fact / allow as inference | Plausible engineering inference, not evidence |

Sources:

- OpenAI Dreaming V3: <https://openai.com/index/chatgpt-memory-dreaming/>
- OpenAI release notes: <https://help.openai.com/en/articles/6825453-chatgpt-release-notes>
- OpenAI Memory FAQ: <https://help.openai.com/en/articles/8590148-memory-faq>
- Gemma 4 model card: <https://ai.google.dev/gemma/docs/core/model_card_4>

## First-Principles Boundary

The small model is allowed to:

- Read bounded evidence.
- Produce candidate summaries, clusters, labels, conflicts, and review queues.
- Attach source anchors and quotes.
- Say "this may be worth reviewing".

The small model is not allowed to:

- Decide a message is a real cognitive transition.
- `mark_event`, `unmark_event`, `downgrade_event`, or delete memory.
- Route work to cats.
- Rewrite shared rules, taste canon, or Event Memory truth rows.
- Output unanchored facts into persistent memory.

This preserves the existing KD-8 shape: give data and candidate structure, not
conclusions. The model can be a clerk, not a judge.

## Product Shape To Borrow From Dreaming V3

OpenAI's public product surface suggests five useful affordances:

1. **Background processing**: memory work should not block the foreground agent.
2. **Summary surface**: users should see the current memory interpretation.
3. **Source visibility**: personalized output should expose at least partial
   provenance.
4. **Correction loop**: users can correct or remove bad memory.
5. **Freshness handling**: old facts should be downgraded or flagged when newer
   evidence appears.

Cat Cafe should translate these into:

- `candidate_memory_notes`: generated, rebuildable, non-authoritative records.
- `memory_review_queue`: review surface for cats / CVO.
- `promotedBy` metadata on any candidate that becomes a truth-source memory.
- `sourceAnchors[]` as a required field.
- `rejectReason` / `approvedBy` / `supersedes` metadata for auditability.

## Harness Options

### Option A: Raw Local API

Cats call a model server directly.

Pros:

- Fast to spike.
- Minimal engineering.

Cons:

- No consistent output schema.
- Easy to bypass source anchors.
- No audit trail.
- No shared permission boundary.

Verdict: reject except for one-off manual benchmarking.

### Option B: MCP Tool Wrapper

Run a local model server behind a dedicated MCP toolset, for example:

- `small_model_extract_memory_candidates`
- `small_model_cluster_event_candidates`
- `small_model_detect_conflicts`
- `small_model_mine_eval_fixtures`

Pros:

- Every call is structured and logged.
- Tool schema can require anchors, max input size, and operation type.
- Works across Codex / Claude Code / OpenCode carriers.
- Easy to fail closed.

Cons:

- MCP alone is not enough for long batch jobs.
- Tool payload design must be strict or it becomes a generic model proxy.

Verdict: recommended v0 interface.

### Option C: Runtime Job Worker

Runtime schedules jobs over message/thread corpora and writes candidates into a
candidate store.

Pros:

- Best fit for large-scale dirty work.
- Can batch, resume, rate-limit, and emit metrics.
- Natural place for review queue integration.

Cons:

- More invasive.
- Needs storage schema, migrations, observability, and backpressure.
- Must not touch Redis 6399 / runtime state without normal feature process.

Verdict: Phase B after MCP spike proves value.

### Option D: Agent Carrier Over Codex / Claude Code / OpenCode

Spawn a cheap local-model-backed agent inside an existing coding harness to
process files or generate proposal patches.

Pros:

- Good for repo-scale batch transformations.
- Can use existing file/search tools.
- Natural for one-off refactors or corpus mining.

Cons:

- Side-effect risk is higher.
- Harder to keep the model in "candidate only" mode.
- Carrier-specific behavior makes reproducibility harder.

Verdict: use only for controlled batch jobs after Option B exists. Do not make
this the primary memory interface.

## Recommended Architecture

Use a two-layer architecture:

```text
local model runner
  -> small-model-clerk MCP toolset
  -> candidate store / review queue
  -> cat or CVO promotion
  -> truth source
```

The local model runner can be swapped later. The durable contract is the clerk
toolset and candidate schema, not a specific model provider.

## Candidate Output Contract

Every tool output must be structured:

```ts
type SmallModelCandidate = {
  candidateId: string;
  operation:
    | 'memory_candidate'
    | 'taste_candidate'
    | 'event_cluster_candidate'
    | 'conflict_candidate'
    | 'stale_candidate'
    | 'eval_fixture_candidate';
  sourceAnchors: Array<{
    threadId?: string;
    messageId?: string;
    filePath?: string;
    lineStart?: number;
    lineEnd?: number;
    quote: string;
  }>;
  proposedSummary: string;
  proposedTags: string[];
  rationale: string;
  confidence: 'low' | 'medium' | 'high';
  forbiddenActions: [
    'write_truth_source',
    'delete_memory',
    'mark_event',
    'route_cat',
  ];
};
```

Fail-closed rules:

- Empty `sourceAnchors` means reject.
- Quotes must be substrings of source content.
- `confidence` is review priority, not truth.
- The model may not emit direct database operations.
- Candidate promotion must record `approvedBy` and `approvedAt`.

## Candidate Jobs

### 1. Memory Candidate Extraction

Input: one thread digest or bounded message window.

Output: explicit facts, user preferences, project decisions, open questions,
all with anchors.

Promotion target: memory system / thread digest / docs only after review.

### 2. Taste Candidate Extraction

Input: messages where CVO corrects tone, design, system philosophy, or process.

Output: draft taste vignette fields: `when`, `quotes`, `scene`, `tags`.

Promotion target: `docs/taste/vignettes/` after cat review.

### 3. Event Memory Hygiene

Input: low-confidence magic-word rows + surrounding messages.

Output: possible duplicate clusters, possible false-positive bundles, missing
context anchors.

Promotion target: review queue only. It cannot auto-unmark.

### 4. Conflict And Staleness Detection

Input: existing memory item + newer evidence candidates.

Output: "possible conflict" or "possibly stale" review card.

Promotion target: cat/CVO decision to update, supersede, or reject.

### 5. Eval Fixture Mining

Input: known failures, review threads, user corrections.

Output: proposed regression fixture cases with source snippets.

Promotion target: eval harness only after owner review.

### 6. Source Hygiene Prepass

Input: draft research doc or answer.

Output: claims that need source-audit, missing primary-source links, and likely
echo-chamber risks.

Promotion target: reviewer checklist. It cannot assign final verdict.

## Evaluation Plan

Before runtime integration, run an offline spike against fixed corpora:

1. F227 magic-word false-positive examples.
2. Existing `docs/taste/` vignettes and the source conversations that produced
   them.
3. F218 source-hygiene examples.
4. A few old discussion threads with known decisions.

Metrics:

- Anchor coverage: percentage of candidates with valid source anchors.
- Hallucination rate: claims not supported by quotes.
- Reviewer acceptance rate: candidates promoted or useful after review.
- False merge rate: separate events incorrectly clustered.
- Noise reduction: review cards per useful promoted item.
- Latency and cost per 1k messages.
- Cat time saved: reviewer minutes before / after.

Gate:

- No runtime integration until hallucination rate and false merge rate are low
  enough on fixed fixtures.
- Any unanchored claim from the worker is a P1 harness bug.

## Phase Plan

### Phase 0: Local Runner Spike

Goal: prove the model can run locally and produce structured JSON on tiny
fixtures.

Tasks:

- Install one candidate runner and one model.
- Run 20 hand-picked prompts from F227 / taste / source-hygiene.
- Measure latency, memory pressure, malformed JSON rate, and anchor discipline.
- No runtime integration.

Exit:

- A short spike report with recommended runner / model / rejection reasons.

### Phase A: Clerk MCP Toolset

Goal: expose the model through narrow MCP tools, not raw chat.

Tasks:

- Add a `small-model-clerk` MCP server.
- Implement schema validation and fail-closed output checks.
- Store outputs as local JSONL artifacts or a rebuildable candidate store.
- Add fixtures for unanchored hallucination rejection.

Exit:

- Cats can request candidate bundles, but nothing writes truth sources.

### Phase B: Candidate Review Queue

Goal: make candidates useful to CVO/cats.

Tasks:

- Add review queue UI or existing Hub panel integration.
- Show source quotes, raw links, proposed summary, and accept/reject actions.
- Persist promotion metadata.

Exit:

- Reviewed candidates can be promoted with provenance.

### Phase C: Scheduled Hygiene Jobs

Goal: large-scale dirty work.

Tasks:

- Add resumable jobs for low-confidence Event Memory and taste mining.
- Add backpressure, metrics, and dry-run reports.
- Add weekly eval fixture mining.

Exit:

- Small model can process large corpora without becoming a hidden judge.

## Decision Packet

### Recommendation

Approve a Phase 0 spike for a local small-model memory clerk.

### Why

It gives cats cheap background assistance for high-volume evidence work without
violating KD-8, if the harness enforces candidate-only outputs.

### What Not To Do

- Do not expose raw model API as a general cat tool.
- Do not start with runtime scheduled jobs.
- Do not let the model mutate memory, Event Memory, or taste docs directly.
- Do not call its output "memory" until reviewed.

### Open Questions For CVO

1. Is local-only a hard requirement for this worker, or can it use external APIs
   for non-private open-source docs?
2. Should candidate review be primarily a cat workflow, a CVO workflow, or both?
3. Which first corpus matters most: Event Memory false positives, taste memory,
   or source-audit/eval fixture mining?

## Convergence Check

1. ADR needed? Not yet. This proposal does not reject a durable architecture;
   it recommends a spike.
2. lessons-learned needed? Not yet. No new failure occurred.
3. Operating rule needed? Not yet. If accepted, the rule should become:
   "small models may produce anchored candidates, not authoritative memory
   decisions."

[砚砚/gpt-5.5🐾]
