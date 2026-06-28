---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-06-28-eval-a2a-default-port-low-friction-keep-observe
source_snapshot: "snapshot:bundle/2026-06-28-eval-a2a-default-port-low-friction-keep-observe/snapshot"
---

# Live Verdict — 2026-06-28-eval-a2a-default-port-low-friction-keep-observe

- Verdict: `keep_observe`
- Phenomenon: A fresh 2026-06-28 eval:a2a run used the post-PR #2574 default base URL and resolved localhost:3002 without an explicit override. The window covered 5/5 F167 components with 0 telemetry gaps and no attribution findings; residual C2 verdict_without_pass fell to 1/25 (4.0%), route-serial feedback disappeared, and grounding Phase O produced 9 verdicts with 0 mismatches, while the 0.90h counter window keeps counter-rate confidence downgraded.
- Harness: F167/F167-runtime-eval (A2A chain quality runtime eval across C1, C2, route-serial, L1, and grounding Phase O)
- Owner ask: No new code action from this eval cycle. Keep observing eval:a2a; reopen C1/C2/route-serial work only if a fresh eval window reaches count >= 3 and ratio > 5%, grounding mismatch_sample_count becomes nonzero, or counterWindow remains under 2h for repeated windows and blocks confidence.
- Re-eval: Remain keep_observe if the next fresh eval has 5/5 component coverage, zero telemetry gaps, no attribution findings, grounding mismatch_sample_count stays 0, legacyScheduledTaskIds remains empty, and the default run-f167-eval base URL continues to resolve without explicit override. at 2026-06-29T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-06-28-eval-a2a-default-port-low-friction-keep-observe/snapshot
- attribution:bundle/2026-06-28-eval-a2a-default-port-low-friction-keep-observe/eval-F167-2026-06-28:no-finding
- metric:components.covered=5/5
- metric:telemetry_gaps=0
- metric:sourceAdapter.default_baseUrl=localhost:3002
- metric:counter_window.duration_hours=0.896952
- metric:C1/hold_ball_calls=4
- metric:C1/c1.hold_zombie_count=0
- metric:C1/c1.hold_replacement_count=1
- metric:C2/c2.verdict_without_pass_count=1
- metric:C2/c2.verdict_without_pass_ratio=0.0400
- metric:C2/c2.void_hold_hint_emitted=0
- metric:route-serial/inline_action.checked=25
- metric:route-serial/inline_action.feedback_written=0
- metric:route-serial/inline_action.feedback_ratio=0
- metric:grounding.check_total=9
- metric:grounding.verdict_total=9
- metric:grounding.sample_count=524
- metric:grounding.mismatch_sample_count=0
- metric:legacyScheduledTaskIds=0
- no-finding:eval-F167-2026-06-28
- sourceAdapter:run-f167-eval:2026-06-28:default-localhost-3002
- legacyScheduledTaskIds:0
- grounding-phase-o:mismatch_sample_count=0

Counterarguments:
- Because counter_window.duration_hours is only 0.896952, counter-based rate confidence is downgraded after the recent API restart.
- No findings in a short low-traffic window do not prove the F167 harness is friction-free; they only satisfy the current keep_observe gate.
- C1 hold_replacement_count=1 is below the finding floor but is a new residual signal compared with 2026-06-27, so it should stay in the next trend comparison.
