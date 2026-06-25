---
doc_kind: index
topics:
  - memory
  - retrieval
  - mcp
  - agent-surface
  - cat-cafe
  - openviking
  - atommem
created: 2026-06-24
status: draft
authored_by: "@codex"
covers:
  - report-index
  - reading-order
  - comparison-map
---

# Memory Systems Agent Surface Comparison

This directory collects the agent-facing memory surface comparison for three systems:

1. Cat Cafe as the baseline.
2. OpenViking as a production context system.
3. AtomMem as a research memory pipeline.

It is a navigation index, not the final synthesis. Use the paired reviewer audits as the quality gate for each primary report.

## Read Order

| Step | File | Role | One-line purpose |
| --- | --- | --- | --- |
| 1 | [cat-cafe-memory-agent-surface.md](./cat-cafe-memory-agent-surface.md) | Baseline report | Defines the comparison axes from Cat Cafe's own longform-002 memory design and current MCP/tool surface. |
| 1r | [reviewer-audit-cat-cafe-baseline.md](./reviewer-audit-cat-cafe-baseline.md) | Cross-family review | Approves the baseline and adds the missing multi-collection / tenant-scoping axis. |
| 2 | [openviking-agent-surface.md](./openviking-agent-surface.md) | External system report | Dissects OpenViking's MCP endpoint, retrieval shape, raw URI recovery, exact tools, skills, and tenant scoping. |
| 2r | [reviewer-audit-openviking.md](./reviewer-audit-openviking.md) | Cross-family review | Approves the OpenViking report and tightens the User-Mind L2/L3 verdicts to Fail. |
| 3 | [atommem-agent-surface.md](./atommem-agent-surface.md) | External system report | Dissects AtomMem's lack of MCP, demo HTTP/Python surfaces, graph rerank, SFT data branch, and weak raw drill-down. |
| 3r | [reviewer-audit-atommem.md](./reviewer-audit-atommem.md) | Cross-family review | Approves the AtomMem report and confirms the SFT/no-MCP/retrieval/storage claims by independent spot-check. |

## System Positioning

| System | Agent-facing surface | Retrieval / recall | Raw drill-down | Main lesson |
| --- | --- | --- | --- | --- |
| Cat Cafe | First-party MCP memory tools plus navigation skills. | BM25/FTS + vector hybrid with RRF, plus graph/recent routes. | Source paths, file slices, session-chain drill-down. | Strongest baseline for agent contract and epistemic metadata, with a known `confidence` naming hazard. |
| OpenViking | Broad HTTP MCP with search/read/grep/glob/code/resource/memory tools. | Dense+sparse vector hierarchy, optional rerank, exact tools as side paths. | Strong `viking://` URI `read`, plus grep/glob/code expansion. | Best production surface ergonomics; still weak on generated-vs-observed labels. |
| AtomMem | No MCP; demo HTTP plus Python internals. | Embedding + keyword Jaccard + event compensation + PPR/RWR graph rerank. | Weak `dia_id` anchors; no first-class raw read tool. | Strong algorithm idea, weak agent product surface. |

## Shared Axes

All three primary reports use the same comparison axes:

1. Truth source.
2. Ingestion / indexing.
3. Retrieval / recall.
4. MCP / tool surface.
5. Raw-source drill-down.
6. Epistemic labels.
7. Skill / agent contract.
8. Feedback loop.
9. Multi-collection / tenant scoping.

## Follow-Up Slots

- `synthesis.md`: judgment layer for cross-system conclusions, ADR candidate, and CVO decision packet.
- ADR candidate: generated content must preserve source-tier / authority metadata before it is consumed as memory.
- Lesson candidate: retrieval quality and ranking cleverness do not replace raw recovery, epistemic labels, and correction loops.

[砚砚/gpt-5.5🐾]
