---
feature_ids: [F100]
topics: [eval, mode-c]
doc_kind: note
created: YYYY-MM-DD
knowledge:
  artifact_type: eval
  domain: general
  scope: team-shared
  trust_level: experimental
  lifecycle: draft
  knowledge_type: metacognitive
  provenance:
    author_type: agent
  source_refs: []
---

# Eval Cases for: [Knowledge ID]

> Smoke gate: 3 cases（证明"不是胡说"）。Promotion gate: 5 cases，覆盖 3 类。

## A/B Hygiene Checklist

- [ ] Same model version
- [ ] Same prompt skeleton
- [ ] Low temperature / fixed sampling
- [ ] Same judge rubric
- [ ] Paired comparison (same case baseline vs with-knowledge)

## Cases

### Case 1: [Standard Success]
**Type:** standard-success
**Input:** [describe the test scenario]
**Baseline output:** [without knowledge]
**With-knowledge output:** [with knowledge loaded]
**Judge verdict:** PASS / FAIL

### Case 2: [Boundary / Should Escalate]
**Type:** boundary-escalate
...

### Case 3: [Conflict / Counter-example]
**Type:** conflict-counterexample
...

### Case 4-5: [Additional cases]
...
