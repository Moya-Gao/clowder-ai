---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-06-17-eval-a2a-c1-sample-window-build
source_snapshot: "snapshot:bundle/2026-06-17-eval-a2a-c1-sample-window-build/snapshot"
---

# Live Verdict — 2026-06-17-eval-a2a-c1-sample-window-build

- Verdict: `build`
- Phenomenon: The 2026-06-17 F167 eval no longer shows C2 verdict_without_pass above ratio threshold after PR #2314, but it surfaces C1 zombie_hold_count at 4 over 3 hold_ball calls. The C1 sampled metric has incomplete sampleCoverage (2/4) even though PR #2250 added per-fire samples, so C1 cannot be safely classified or tuned yet.
- Harness: F167/C1 (hold_ball / zombie-hold sampled attribution coverage)
- Owner ask: Build a full-window sample retrieval path for eval:a2a sampled metrics before tuning C1. Options include a privileged/paginated eval trace fetch, a time-range/sample-event endpoint, or changing run-f167-eval so it can retrieve all spans needed for the 24h metric window. Then rerun the next daily eval and require C1 sampleCoverage to be complete before deciding whether to tune, split, or rename c1.zombie_hold_count.
- Re-eval: Close this build verdict when a subsequent C1 zombie_hold finding has sampleCoverage complete (sampleCount == metricCount) or when C1 zombie_hold stays below count < 3 or ratio <= 5% for two consecutive daily evals. Continue separately observing the PR #2314 C2 slot-scope fix; do not reopen C2 unless verdict_without_pass again exceeds threshold after runtime reload. at 2026-06-18T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-06-17-eval-a2a-c1-sample-window-build/snapshot
- attribution:bundle/2026-06-17-eval-a2a-c1-sample-window-build/AR-2026-06-17-001
- metric:cat_cafe_a2a_c1_zombie_hold_count_total=4
- metric:cat_cafe_a2a_c1_hold_cancel_count_total=4
- metric:cat_cafe_a2a_hold_ball_calls_total=3
- metric:sampleCoverage:c1.zombie_hold_count=2/4 complete=false
- metric:traceStore.span_count=1826
- metric:/api/telemetry/traces.max_limit=500
- metric:c2.verdict_without_pass_count=3/274=1.1%
- metric:c2.void_hold_hint_emitted=13/281=4.6%
- metric:legacyScheduledTaskIds=[]
- C1/c1.zombie_hold_count/4dfbb4df21678c72
- C1/c1.zombie_hold_count/48332d5426011282

Counterarguments:
- The two available C1 samples are prior_short/prior_imminent, so a real C1 behavior issue may remain after coverage is fixed.
- The 500-span telemetry route cap may be intentional for UI safety; the right build may be an internal eval-only path rather than raising the public endpoint cap.
- Because this eval used the current runtime on 3002, a runtime reload or process boundary could change trace availability before the next daily eval.
