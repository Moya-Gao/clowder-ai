---
feature_ids: [F192]
topics: [harness-eval, eval-hub, control-plane, scheduled-task-migration]
doc_kind: discussion
created: 2026-05-21
---

# F192 Phase E Kickoff: Harness Eval Control Plane / Eval Hub

## Trigger

铲屎官在 F188/F192/F200 交叉 dogfood 后指出，猫猫们把问题带偏成"内部事件路由 / 通知 / 看板"。第一性原理应是：

> 对 harness 的运行效果做长期追踪和解释，产出 delete / build / fix / keep 的证据化 verdict，并把诊断交给负责 feature 的猫处理，再由后续 eval 验证。

补充修正：

> delete 还有一种情况是 sunset，比如猫猫变强了，不需要了；接入完成后要清理 F192 等遗留定时任务，避免双触发。

## Related Source

- `docs/features/F192-socio-technical-harness-eval.md` — existing harness eval feature and runtime pipeline owner
- `docs/features/F200-memory-recall-eval.md` — memory recall eval vertical line
- `docs/features/F188-library-stewardship.md` — memory/library health governance vertical line
- `docs/content/drafts/longform-002-v0-formal.md` — 第 5 章 "Eval——Harness 的自我代谢系统"，尤其 "Harness Eval Control Plane" / "Eval Hub"

## Related Detection Verdict

**Do not create a new F number.** F192 already owns socio-technical harness eval, runtime eval pipeline, eval contracts, digest and action-rate. The new requirement is the terminal-state control plane named in the longform draft: F192 Phase E.

If implemented as a new feature, F192 would become a half-finished vertical line and the system would duplicate ownership. Phase E extends the existing F192 authority boundary instead.

## First Principles

1. **Eval is not monitoring.** F153 answers "what happened"; eval answers "against the expected harness behavior, what should change?"
2. **Eval output is a verdict, not a metric.** The valuable output is `delete/sunset`, `build`, `fix`, or `keep_observe`, backed by evidence.
3. **Eval cat and feature cat are different roles.** The eval cat diagnoses; the feature owner investigates / changes the harness; later eval verifies.
4. **Domain thread is the working home.** `eval:a2a`, `eval:memory`, etc. preserve long-term analysis context. They are not a global notification dump.
5. **Thread is not the SOT.** Trends, verdicts, handoffs and closure state must be queryable in Eval Hub / registry.
6. **Legacy scheduled tasks must be retired or redirected.** A unified control plane that leaves old F192/F200/F188 tasks firing creates duplicate verdicts and erodes trust.

## Synthesis of Cat Views

| View | Useful Part | Correction |
|------|-------------|------------|
| 4.6 internal event bus / registry | A unified substrate matters; F192/F200/F188 should not each invent one-off loops | Plumbing is subordinate. The core is harness lifecycle verdict and domain eval analysis |
| 47 control loop / Finding Store | Store-backed state, dedupe, and closure invariants are useful | Per-domain eval thread must stay first-class; deep diagnosis needs long-running context |
| Gemini bounty / actionable cards | Eval results should become tangible actions, not inert charts | Cards are Eval Hub presentation, not the architecture root |
| 砚砚 handoff contract | Evidence packet is enforceable review-like boundary | Must be codified as schema / validation, not just culture |

## Architecture Decision Packet

### Decision 1: Phase E belongs to F192

- **Decision**: Add F192 Phase E "Harness Eval Control Plane / Eval Hub".
- **Why**: F192 already owns Eval Contract, harness runtime eval, digest, action-rate and sunset logic. Longform 第 5 章 explicitly says F192/F200 are current vertical lines and unified Eval Hub is the terminal control plane.
- **Tradeoff**: Keeps one ownership path, but increases F192 scope. Mitigation: Phase E is its own Design Gate and implementation phases.

### Decision 2: Verdict Handoff Packet is mandatory

Eval-to-feature handoff without an evidence packet is invalid. Minimum fields:

| Field | Why |
|-------|-----|
| `phenomenon` | What changed or failed |
| `harness_under_eval` | Which harness / skill / SOP / MCP / rule is being judged |
| `evidence_packet` | Trace ids, thread refs, metrics queries, sample events, logs |
| `daily_trend` | Current value, baseline, window, threshold, day-over-day trend |
| `root_cause_hypothesis` | Eval cat's explanation + confidence |
| `verdict` | `delete/sunset` / `build` / `fix` / `keep_observe` |
| `owner_ask` | Which feature owner must do what |
| `acceptance_re_eval_plan` | How later eval proves it worked |
| `counterarguments` | What evidence would refute this verdict |

This is the eval equivalent of a review packet. It prevents "你去看看" from being treated as an actionable handoff.

### Decision 3: Eval Hub is a lifecycle control plane

Eval Hub v1 should show:

- active verdicts
- stale / unowned verdicts
- domain trend windows
- feature-owner handoff status
- re-eval closure state
- harnesses with sunset candidates
- duplicate-trigger / legacy-task migration status
- community reports and exportable issue packets

It is not a metrics dashboard. A number without verdict / owner / re-eval plan is not an Eval Hub item.

### Decision 4: Legacy scheduled-task cleanup is part of adapter acceptance

When a domain adapter is connected to unified runtime, the corresponding old scheduled task must be inventoried and either:

1. disabled,
2. redirected to the unified runtime,
3. or explicitly marked as intentionally retained with non-overlap proof.

Acceptance requires a dry-run report proving no double trigger for that domain.

## Initial Domain Map

| Domain | Existing Source | Phase E Role | Legacy Cleanup Target |
|--------|-----------------|--------------|------------------------|
| `eval:a2a` | F192/F167 harness-fit digest + F153 telemetry | First control-plane pilot | `harness-fit-digest` scheduled task |
| `eval:memory` | F200 recall eval + F188 health governance | Memory eval pilot | F200 recall reports / F188 health repair routines that emit duplicate notices |
| `eval:connectors` | future | Later domain | N/A |
| `community:<project>` | external project checker / issue reports | Extension path | Project-local tasks only |

## Design Gate Required Questions

| # | Question | Why |
|---|----------|-----|
| OQ-1 | Eval Domain Registry SOT: SQLite, docs registry, or hybrid? | Needs queryable state and reviewable diffs |
| OQ-2 | Eval Hub surface: Console page, Observability page, or domain-specific hub? | UI must be visible in working context |
| OQ-3 | Delete/sunset signoff threshold | Some sunset verdicts can remove active harness behavior |
| OQ-4 | Legacy scheduled-task migration mechanism | Prevent duplicate reports while preserving rollback |
| OQ-5 | Community report privacy boundary | Issue packets must be useful and safe |

## Architecture Cell

Architecture cell: observability / harness-eval (existing F192 boundary over F153 telemetry)

Map delta: update required

Why: Phase E changes F192 from a vertical harness-eval pipeline into a cross-domain control plane extension point. It needs an ownership-map update before implementation.

## Meta-Aesthetics Check

This is a coordinate change, not a pile of patches:

- wrong coordinate: each feature registers its own scheduled task and handoffs are free-form messages
- corrected coordinate: each harness declares an eval contract; domain eval threads analyze; Eval Hub tracks verdict lifecycle; legacy tasks are migrated into one control plane

The purpose is to delete duplicated scheduled loops, not add another notification layer.
