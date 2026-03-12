---
feature_ids: [F100]
topics: []
doc_kind: note
created: YYYY-MM-DD
knowledge:
  artifact_type: method
  domain: general
  scope: team-shared
  trust_level: tested
  lifecycle: draft
  knowledge_type: analytical
  provenance:
    author_type: collaborative
  source_refs: []
level: 1
source_episode_ids: []
long_tail: false
stale_after_days: 180
---

# Method Card: [TITLE]

> 高风险/跨领域分析框架。**不沉淀事实库**，只沉淀方法论。

## When to Use

**Domain:** [medical / legal / investment / ...]
**Trigger condition:** 什么情境下该想到这个方法？

## Framework

### Step 1: [name]
- What to do
- What to look for
- Red flags / escalation signals

### Step 2: [name]
...

## Guardrails

- **Must escalate when:** [conditions]
- **Must NOT:** [what this method doesn't cover]
- **Confidence threshold:** action_confidence < 0.85 → structured analysis only + explicit escalation

## Source Episodes

- `docs/episodes/[episode-id].md`

## Eval Results

- `evals/mode-c/[this-method-id]/summary.md`

## Use Log

<!-- append-only: date | agent | context | outcome | human_rating -->
