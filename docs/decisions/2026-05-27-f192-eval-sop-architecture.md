---
feature_ids: [F192]
related_features: [F167, F200]
doc_kind: decision
created: 2026-05-27
topics: [sop-eval, harness-eval, predicate-evaluator, three-piece-positioning]
---

# F192 E-sop Architecture: Three-Piece SOP Compliance Positioning

## Context

Cat Café's SOP compliance was previously enforced through skills (soft
constraints loaded per-cat, per-session). This works for guidance but
provides no systematic verification — a cat can skip steps, a skill can
be outdated, and nobody notices until a post-merge incident.

## Decision: Three-Piece Positioning

| Layer | Role | Format | Who consumes it |
|-------|------|--------|-----------------|
| **Skill** | 软约束 — procedural guidance for cats | SKILL.md (markdown) | Cat agent at session time |
| **SopDefinition** | 硬约束 — machine-readable ground truth | YAML → codegen TS const | Predicate evaluator |
| **Eval** | 观测层 — traces runtime, evaluates predicates, produces verdicts | SopTrace → SopEvalResult[] → VerdictHandoffPacket | Eval cat + owner cat |

**Key insight**: skill ≠ definition ≠ eval. A skill says "do this"; a
definition says "this must be true"; eval checks "was it true?". They
evolve independently — a skill can add guidance without a new predicate;
a predicate can be added without skill changes.

## Architecture

```
session commands/env/git/handles
        ↓
   SopTrace (sop-trace-adapter.ts)
        ↓
   evaluateSopDefinition(definition, trace)
        ↓  (sop-predicate-evaluator.ts)
   SopEvalResult[] (pass | violation | skipped per rule)
        ↓
   buildSopVerdictHandoff / reevalSopVerdict
        ↓  (eval-sop-adapter.ts)
   VerdictHandoffPacket → cross-thread handoff to owner
```

### Predicate types (7)

| Type | Machine-checkable | Example |
|------|-------------------|---------|
| `command_pattern` | ✅ | Must run `pnpm gate` before merge |
| `command_sequence` | ✅ | Anti-pattern: merge before review |
| `env_check` | ✅ | Redis port must be 6398, not 6399 |
| `git_state_predicate` | ✅ | ahead=0, behind=0, clean worktree |
| `handle_check` | ✅ | Reviewer ≠ author |
| `sha_dedup` | ✅ | No duplicate cloud review triggers |
| `manual_only` | ❌ (skip) | "Check tone and clarity" |

### Domain-generic schema

`development` is the first runtime instance. The schema accepts any SOP
domain — stub definitions for `video-cocreation`, `tech-article`,
`family-office` validate against the same schema. All predicates are
domain-agnostic (they operate on commands, env, git state, handles).

### Scheduling

Daily domains (eval:a2a, eval:memory) run at 03:00 UTC every day.
Weekly domains (eval:sop) run at 03:00 UTC every Sunday. Both share the
same gate + execute factory, parameterized by frequency.

## Reuse

- **Domain registry**: eval:sop is a standard `EvalDomainRegistryEntry`
- **Verdict handoff**: same `VerdictHandoffPacket` schema as eval:a2a and eval:memory
- **Re-eval closure**: same pattern — check if previously-violated rules now pass
- **Scheduling**: shared factory with frequency parameter

## Consequences

- Adding a new SOP domain (e.g., `tech-article`) requires only:
  1. YAML definition in `sop-definitions/`
  2. eval-domains registry entry with appropriate frequency
  3. No code changes to the evaluator
- Predicate coverage grows incrementally — `manual_only` rules can be
  upgraded to machine-checkable predicates as trace data improves
