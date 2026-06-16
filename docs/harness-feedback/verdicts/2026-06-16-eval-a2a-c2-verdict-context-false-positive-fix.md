---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-06-16-eval-a2a-c2-verdict-context-false-positive-fix
source_snapshot: "snapshot:bundle/2026-06-16-eval-a2a-c2-verdict-context-false-positive-fix/snapshot"
---

# Live Verdict — 2026-06-16-eval-a2a-c2-verdict-context-false-positive-fix

- Verdict: `fix`
- Phenomenon: The 2026-06-16 F167 eval still reports C2 verdict_without_pass friction at 6/89 checks (6.7%), flat versus 2026-06-15's 7/104 (6.7%) and above the 5% threshold. Per-fire sample coverage is complete, so the remaining work is context-aware guard tuning rather than more sample-evidence buildout.
- Harness: F167/C2 (A2A exit-check forced-pass guard / verdict-without-pass detector)
- Owner ask: Tune C2 verdict_without_pass detection to distinguish in-progress review/merge/status narratives from final un-routed verdicts. Preserve the guard for true final verdict-without-pass cases, and add regression coverage using the 2026-06-15/2026-06-16 approve/reject/approve_cn/p1p2 sample pattern.
- Re-eval: After the guard-tuning fix is merged and runtime is reloaded, close when two consecutive daily evals show c2.verdict_without_pass_count < 3 or c2.verdict_without_pass_count / c2.checked <= 5%, while sampleCoverage remains complete for any residual C2 finding. at 2026-06-17T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-06-16-eval-a2a-c2-verdict-context-false-positive-fix/snapshot
- attribution:bundle/2026-06-16-eval-a2a-c2-verdict-context-false-positive-fix/AR-2026-06-16-001
- metric:cat_cafe_a2a_c2_verdict_without_pass_count_total=6
- metric:cat_cafe_a2a_c2_exit_checked_total=89
- metric:ratio:c2.verdict_without_pass_count/c2.checked=6.7%
- metric:sampleCoverage:sampleCount=6,metricCount=6,complete=true
- metric:legacyScheduledTaskIds=[]
- C2/c2.verdict_without_pass_count/1c2c6527a8e2bb1b
- C2/c2.verdict_without_pass_count/713dde82233eff63
- C2/c2.verdict_without_pass_count/42cb91a868695d43
- C2/c2.verdict_without_pass_count/24fd97270bff201e
- C2/c2.verdict_without_pass_count/b819a6e2b95a8c80
- C2/c2.verdict_without_pass_count/d161d6523badea6a

Counterarguments:
- The raw count improved from 7 to 6, so one more observe day might avoid work if the cluster fades naturally.
- The ratio stayed flat at 6.7%, but the 2026-06-16 window is 18.62h rather than a full 24h, which weakens direct day-over-day comparison.
- AR-002 void-hold remains above threshold at 5/92 (5.4%); focusing AR-001 first follows generator selection and avoids mixing two guard-tuning asks in one verdict.
