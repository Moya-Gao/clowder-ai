---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-06-19-eval-a2a-c1-zombie-split-keep
source_snapshot: "snapshot:bundle/2026-06-19-eval-a2a-c1-zombie-split-keep/snapshot"
---

# Live Verdict — 2026-06-19-eval-a2a-c1-zombie-split-keep

- Verdict: `keep_observe`
- Phenomenon: The 2026-06-19 F167 eval reports zero attribution findings after PR #2368 split C1 hold replacement churn from true zombie holds. The runtime window is 15.31h with 1566 spans; the prior 2026-06-18 C1 zombie-hold semantics finding is counted acted-on.
- Harness: F167/C1 (hold_ball C1 zombie/replacement split in A2A chain-quality harness)
- Owner ask: No new code action. Keep scheduled eval active; reopen owner action only if c1.hold_zombie_count reaches count >= 3 with ratio > 5%, if c1.hold_replacement_count leaks back into friction findings, or if residual samples show actionable prior_overdue/prior_imminent recurrence.
- Re-eval: Remain closed if attribution has no findings, c1.hold_zombie_count stays below count<3 or ratio<=5%, replacement remains activation-only, and C2/route-serial stay below thresholds. Open a new verdict only with concrete metric attribution and sample evidence. at 2026-06-20T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-06-19-eval-a2a-c1-zombie-split-keep/snapshot
- attribution:bundle/2026-06-19-eval-a2a-c1-zombie-split-keep/eval-F167-2026-06-19:no-finding
- metric:C1/hold_ball_calls=10
- metric:C1/c1.hold_replacement_count=4
- metric:C1/c1.hold_zombie_count=1
- metric:C1/c1.hold_cancel_count=1
- metric:C2/c2.void_hold_hint_emitted=10
- metric:C2/c2.void_hold_checked=205
- metric:route-serial/inline_action.feedback_written=5
- trace-store:2026-06-19-F167-eval:span_count=1566:max_spans=10000

Counterarguments:
- The runtime window is shorter than 24h, so one no-finding record should not sunset the guard.
- Replacement churn still exists at 4 events; it is benign for zombie semantics but could indicate separate workflow ergonomics if it grows.
- C2 void-hold is close to threshold by ratio, so the no-finding record is not a blanket statement that all A2A guards are permanently stable.
