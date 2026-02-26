---
feature_ids: []
topics: [gpt, pro, hindsight]
doc_kind: research
created: 2026-02-14
---

# GPT Pro Deep Research Prompt: Hindsight Memory Quality Optimization

## Project Background

We run **Cat Café**, a multi-AI-agent collaboration system where three AI agents (Claude Opus, Codex/GPT, Gemini) work together on a shared codebase. The system is built with Node.js + Fastify + TypeScript.

We use **Hindsight** (by Vectorize.io) as our long-term memory layer. Hindsight is a self-hosted memory service (Docker, API port 8888, UI port 9999) that provides:
- **Retain**: Store memories with tags and metadata
- **Recall**: Semantic search over stored memories
- **Reflect**: Generate reflections from stored knowledge

Our current Hindsight version: **API 0.4.11**, `bank_config_api: false`.

## How We Use Hindsight

We have a **P0 Import Pipeline** that:
1. Scans `docs/decisions/*.md` (Architecture Decision Records) and `docs/discussions/*.md`
2. Parses each Markdown file by H2 sections into chunks
3. Applies governance tags (`origin:git`, `project:cat-cafe`, `kind:decision`, `visibility:public`, etc.)
4. Calls `hindsight.retain(bankId, items)` with document_id-based upsert for idempotent imports

At runtime, two API routes query Hindsight:
- `GET /api/evidence/search` — UI-facing evidence search with docs fallback
- `GET /api/callbacks/search-evidence` — MCP callback for AI agents to search knowledge

Both call `hindsight.recall(bankId, query, { limit, budget, tags, tagsMatch })`.

## Current Data Quality Problem

We inspected our `cat-cafe-shared` bank and found **two overlapping quality issues**:

### Issue 1: Observation noise (primary pollutant)
- **491 total nodes**: 286 world, 15 experience, 190 observation
- The 190 observation nodes have **no chunk_id or document_id** — they're Hindsight's auto-extracted observations from our retain calls
- Many are low-value summaries like "Phase 5 focused on evidence governance" — accurate but not useful for evidence retrieval
- These pollute recall results with untraceable, low-confidence filler

### Issue 2: Low-value H2 sections imported wholesale
- Our P0 importer treats all H2 sections equally: "Background", "Decision", "Tradeoffs" get the same treatment as "Participants", "Date", "References", "Revision History"
- The metadata sections produce chunks like `"> Date: 2026-02-09"` — technically tagged correctly but zero retrieval value
- **48 nodes** contain the `" | When:"` pattern from table metadata

### Issue 3: Historical UUID garbage (minor)
- 28 documents from early development (manual MCP writes, test residue)
- Predates our P0 governance pipeline, will be cleaned up

## What We Already Know

1. **Hindsight's extraction modes**: `concise` (default), `verbose`, `custom` — controlled via `HINDSIGHT_API_RETAIN_EXTRACTION_MODE` env var
2. **Custom extraction**: `HINDSIGHT_API_RETAIN_CUSTOM_INSTRUCTIONS` can give Hindsight guidance on what to extract
3. **Observations can be toggled**: `HINDSIGHT_API_ENABLE_OBSERVATIONS` env var
4. **bank_config_api is false** on our version — can't adjust per-bank settings via API, must use env vars + container restart
5. **A reference project** (pangu-doer-router) uses structured atomic entries via batch retain, not whole-document dumps — each entry is short and template-based with clear semantic boundaries
6. **Recall API** accepts `tags`, `tagsMatch`, `limit`, `budget` — but we haven't confirmed if it supports `types` filtering (world/experience/observation)

## Constraints

- Hindsight API version 0.4.11, self-hosted Docker
- `bank_config_api: false` — no online config changes
- We control the retain-side completely (our P0 importer code)
- We control the recall-side completely (our Fastify route code)
- We cannot modify Hindsight source code
- Our documents are structured Markdown (ADRs, design docs, discussion records) — not free-form text

## Research Questions

### Q1: Observation Control Strategy
- What exactly does Hindsight extract as "observations" vs "world" vs "experience" facts? What determines the classification?
- Is disabling observations entirely (`ENABLE_OBSERVATIONS=false`) the right move for our use case, or would we lose valuable auto-extracted insights?
- If we keep observations on, can we filter them at recall time? Does the recall API support a `types` parameter or equivalent?
- What are the tradeoffs of post-filtering observations in our application code vs disabling them at the Hindsight level?

### Q2: Custom Extraction Optimization
- What should `HINDSIGHT_API_RETAIN_CUSTOM_INSTRUCTIONS` look like for governance/architectural documents (ADRs, design docs)?
- Are there examples or best practices for custom extraction instructions that maximize world-fact density while minimizing summary noise?
- How does `chunk_size` interact with extraction quality? Our ADR H2 sections range from 50 to 2000 characters.

### Q3: Retain Strategy for Structured Documents
- Should we retain each H2 section as a separate item (current approach) or retain the whole document as one item and let Hindsight chunk it?
- What are the tradeoffs of pre-chunking (our code) vs letting Hindsight's internal chunker handle it?
- For structured documents with known section semantics (Background, Decision, Tradeoffs, Rejected Alternatives), is there an optimal retain pattern?

### Q4: Recall Quality Improvement
- Beyond types filtering, what recall parameters can improve precision for our use case?
- How does the `budget` parameter (low/mid/high) actually affect recall behavior? Is there documentation on what it controls?
- Can we use negative tags or tag exclusions in recall to suppress known-noisy results?

### Q5: Quality Metrics and Evaluation
- Before we build our #69 weekly evaluation pipeline, what metrics should we track to measure memory quality?
- How do other Hindsight users evaluate recall precision/relevance?
- Is there a way to inspect/audit what Hindsight extracted from a given retain call (to verify extraction quality before it goes live)?

### Q6: Version-Specific Capabilities
- What changed between Hindsight 0.4.x versions? Are there features in newer versions that would solve our problems?
- Is there a migration path to enable `bank_config_api`?
- Are there undocumented recall parameters we should know about?

## Desired Output

1. Concrete recommendations for each question, with configuration examples where applicable
2. If you find Hindsight documentation, cookbook examples, or GitHub issues relevant to our problems, cite them
3. Prioritized action list: what gives us the highest quality improvement with lowest effort
4. Any pitfalls or anti-patterns you find that we should avoid
