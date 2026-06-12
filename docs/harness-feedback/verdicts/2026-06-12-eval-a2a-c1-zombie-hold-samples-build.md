---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-06-12-eval-a2a-c1-zombie-hold-samples-build
source_snapshot: "snapshot:bundle/2026-06-12-eval-a2a-c1-zombie-hold-samples-build/snapshot"
---

# Live Verdict — 2026-06-12-eval-a2a-c1-zombie-hold-samples-build

- Verdict: `build`
- Phenomenon: The 2026-06-12 F167 eval surfaced C1 zombie_hold_count as the highest-severity A2A finding: 5 replacements across 7 hold_ball calls (71.4%), regressing from the last available 2026-06-10 C1 baseline of 0 hold calls and 0 zombie holds. The same run still shows C2 void-hold sampleCoverage 0/66 because live runtime has not reloaded #2222, but C1 hold_ball route code did not change between the live runtime commit and current main, so this is a distinct evidence gap rather than duplicate void-hold work.
- Harness: F167/C1 (hold_ball MCP single-slot replacement / zombie-hold guard)
- Owner ask: Build C1 zombie_hold per-fire sample evidence analogous to C2 samples: emit a span event or sampled attribution rows at the prior-hold cancellation point with HMAC-safe thread/invocation/message refs when available, catId, thread_system_kind, priorTaskId/newTaskId hashes, wake delay bucket, and a stable reason/trigger category. Surface it under frictionSamples['c1.zombie_hold_count'] with sampleCoverage; while touching it, audit whether the metric should be split or renamed because the implementation currently measures single-slot replacement rather than only zombie timeout.
- Re-eval: Close this build verdict when a subsequent C1 zombie_hold finding includes per-fire refs/sampleCoverage, or when zombie_hold stays below count < 3 or ratio <= 5% for two consecutive daily evals. If samples show benign single-slot renewals, open a focused fix/rename verdict instead of tuning the threshold blindly. at 2026-06-13T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-06-12-eval-a2a-c1-zombie-hold-samples-build/snapshot
- attribution:bundle/2026-06-12-eval-a2a-c1-zombie-hold-samples-build/AR-2026-06-12-001
- metric:c1.zombie_hold_count=5
- metric:hold_ball_calls=7
- metric:c1.zombie_hold_ratio=0.714
- metric:c1.hold_cancel_count=2
- metric:runtime_c1_route_delta_3d3ba3f00_to_bed8e48a9=none
- C1/c1.zombie_hold_count

Counterarguments:
- C2 void-hold remains the previously published build track and still needs a runtime reload before closure; prioritizing C1 today could distract from that pending deployment check.
- The C1 finding is based on aggregate counters only, so a build verdict may be premature if all five replacements came from one unusual thread.
- Because hold_ball is intentionally an exception state, low absolute volume might not justify new instrumentation unless the same pattern persists in another daily window.
