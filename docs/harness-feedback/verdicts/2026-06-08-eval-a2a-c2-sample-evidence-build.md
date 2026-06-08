---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-06-08-eval-a2a-c2-sample-evidence-build
source_snapshot: "snapshot:bundle/2026-06-08-eval-a2a-c2-sample-evidence-build/snapshot"
---

# Live Verdict — 2026-06-08-eval-a2a-c2-sample-evidence-build

- Verdict: `build`
- Phenomenon: After two clean post-#2101 evals, the 2026-06-08 F167 eval reopened C2 verdict_without_pass at exactly the sample floor: 3 fires over 17 C2 checks (17.6%). The trigger distribution is no longer the old bare approve/P1-P2 overload: reject=1, approve_cn=1, p1p2=1, all in product threads; legacyScheduledTaskIds remains empty, so this is not a duplicate legacy trigger.
- Harness: F167/C2 (A2A exit-check forced-pass / verdict-without-pass guard)
- Owner ask: Build per-fire C2 sample evidence for F167 eval/attribution: for each c2.verdict_without_pass_count finding, include sanitized refs with invocationId or trace/span id, agentId, thread_system_kind, trigger, and a redacted message excerpt or enough context to classify true no-pass vs false-positive. Do not tune reject/approve_cn/p1p2 further until the samples show which cases are false positives.
- Re-eval: Build verdict closes when the next C2 finding either includes actionable per-fire sample refs for each trigger bucket, or the metric returns below threshold (count < 3 or verdict_without_pass / c2.checked <= 5%) for two consecutive evals. If samples show false positives, open a separate fix verdict with the specific pattern/context to tune. at 2026-06-09T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-06-08-eval-a2a-c2-sample-evidence-build/snapshot
- attribution:bundle/2026-06-08-eval-a2a-c2-sample-evidence-build/AR-2026-06-08-001
- metric:cat_cafe_a2a_c2_verdict_without_pass_count_total{agent_id="codex",thread_system_kind="product",trigger="reject"}=1
- metric:cat_cafe_a2a_c2_verdict_without_pass_count_total{agent_id="codex",thread_system_kind="product",trigger="approve_cn"}=1
- metric:cat_cafe_a2a_c2_verdict_without_pass_count_total{agent_id="opus",thread_system_kind="product",trigger="p1p2"}=1
- metric:cat_cafe_a2a_c2_exit_checked_total=17
- metric:cat_cafe_a2a_c2_void_hold_hint_emitted_total=0

Counterarguments:
- Because count is exactly 3, waiting one more day could avoid work if this is a low-volume blip; I am choosing build because this is the first post-#2101 recurrence where label-level telemetry is no longer enough.
- Immediate regex tuning would be faster, but with reject/approve_cn/p1p2 each at one count it would repeat the pre-#2058 guesswork pattern.
- If the samples prove true no-pass behavior, the correct next step may be process/guard enforcement rather than code tuning.
