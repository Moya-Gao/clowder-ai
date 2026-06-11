---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-06-10-eval-a2a-c2-void-hold-samples-build
source_snapshot: "snapshot:bundle/2026-06-10-eval-a2a-c2-void-hold-samples-build/snapshot"
---

# Live Verdict — 2026-06-10-eval-a2a-c2-void-hold-samples-build

- Verdict: `build`
- Phenomenon: The 2026-06-10 eval shows C2 verdict_without_pass still above threshold with the new per-fire samples present, so the 06-08 sample-evidence build has reached runtime. The dominant new gap is C2 void_hold_hint_emitted: 25/181 = 13.8% versus 9/227 = 4.0% yesterday, with no per-fire drilldown; legacyScheduledTaskIds remains empty, so this is not a duplicate legacy trigger.
- Harness: F167/C2 (exit-check (forced-pass guard))
- Owner ask: Build per-fire sample evidence for C2 void_hold_hint_emitted, analogous to PR #2144's verdict_without_pass samples: trace/span refs, HMAC message/invocation/thread ids, agentId, thread_system_kind, firedAt, and the matched void-hold trigger/reason if available. After it reaches runtime, classify the sampled fires and only then decide whether to tune the void-hold guard.
- Re-eval: Close this build verdict when a subsequent void_hold finding includes per-fire drilldown refs/sampleCoverage, or when void_hold remains below count < 3 or ratio <= 5% for two consecutive daily evals. If samples show false positives, open a focused fix verdict with the exact pattern/context. at 2026-06-11T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-06-10-eval-a2a-c2-void-hold-samples-build/snapshot
- attribution:bundle/2026-06-10-eval-a2a-c2-void-hold-samples-build/AR-2026-06-10-002
- metric:cat_cafe_a2a_c2_void_hold_hint_emitted_total=25
- metric:cat_cafe_a2a_c2_void_hold_checked_total=181
- metric:cat_cafe_a2a_c2_verdict_without_pass_count_total=17
- metric:c2.verdict_without_pass_sample_coverage=10/17
- C2/c2.void_hold_hint_emitted

Counterarguments:
- Void-hold crossed threshold only in the 2026-06-10 window; waiting one more day could avoid work if it is a transient spike.
- The earlier verdict_without_pass sample build is now present but not complete because of the intentional 10-sample cap; owner attention may still be better spent classifying those samples first.
- A build verdict risks adding instrumentation before proving user-visible harm, but aggregate-only void-hold data cannot support a precise fix.
