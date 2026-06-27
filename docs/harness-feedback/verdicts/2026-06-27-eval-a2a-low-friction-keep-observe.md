---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-06-27-eval-a2a-low-friction-keep-observe
source_snapshot: "snapshot:bundle/2026-06-27-eval-a2a-low-friction-keep-observe/snapshot"
---

# Live Verdict — 2026-06-27-eval-a2a-low-friction-keep-observe

- Verdict: `keep_observe`
- Phenomenon: A fresh 2026-06-27 eval:a2a run against localhost:3002 covered 5/5 F167 components with 0 telemetry gaps and no attribution findings. Residual C2 verdict_without_pass (2/48 = 4.2%) and route-serial feedback (1/48 = 2.1%) stayed below the count and 5% ratio gates; grounding Phase O produced 3 verdicts with 0 mismatches, while the 1.31h counter window keeps confidence at medium.
- Harness: F167/F167-runtime-eval (A2A chain quality runtime eval across C1, C2, route-serial, L1, and grounding Phase O)
- Owner ask: No new code action from this eval cycle. Keep observing eval:a2a; reopen route-serial or C2 work only if a fresh eval window reaches count >= 3 and ratio > 5%, or if grounding mismatch_sample_count becomes nonzero.
- Re-eval: Remain keep_observe if the next fresh eval has 5/5 component coverage, zero telemetry gaps, no attribution findings, grounding mismatch_sample_count stays 0, and legacyScheduledTaskIds remains empty. Escalate if sourceAdapter base-url drift recurs after PR #2574 or if counterWindow remains under 2h for consecutive windows. at 2026-06-28T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-06-27-eval-a2a-low-friction-keep-observe/snapshot
- attribution:bundle/2026-06-27-eval-a2a-low-friction-keep-observe/eval-F167-2026-06-27:no-finding
- metric:components.covered=5/5
- metric:telemetry_gaps=0
- metric:counter_window.duration_hours=1.307754
- metric:C1/c1.hold_zombie_count=0
- metric:C2/c2.verdict_without_pass_count=2
- metric:C2/c2.verdict_without_pass_ratio=0.0417
- metric:C2/c2.void_hold_hint_emitted=0
- metric:route-serial/inline_action.checked=48
- metric:route-serial/inline_action.feedback_written=1
- metric:route-serial/inline_action.feedback_ratio=0.0208
- metric:grounding.check_total=3
- metric:grounding.verdict_total=3
- metric:grounding.sample_count=428
- metric:grounding.mismatch_sample_count=0
- metric:legacyScheduledTaskIds=0
- no-finding:eval-F167-2026-06-27
- sourceAdapter:run-f167-eval:2026-06-27:localhost-3002
- legacyScheduledTaskIds:0
- grounding-phase-o:mismatch_sample_count=0

Counterarguments:
- Because counter_window.duration_hours is only 1.307754, counter-based per-hour rates are downgraded one confidence level after the recent API restart.
- C2 verdict_without_pass increased from 0 to 2, so this is not proof of zero friction; it is below the count floor and ratio gate only in the current window.
- The eval script on current main still defaults to localhost:3102; the sourceAdapter succeeded with an explicit localhost:3002 override, while PR #2574 is still pending merge.
