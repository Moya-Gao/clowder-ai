---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-06-18-eval-a2a-c1-zombie-hold-semantics-fix
source_snapshot: "snapshot:bundle/2026-06-18-eval-a2a-c1-zombie-hold-semantics-fix/snapshot"
---

# Live Verdict — 2026-06-18-eval-a2a-c1-zombie-hold-semantics-fix

- Verdict: `fix`
- Phenomenon: PR #2337 closed the C1 sample-window gap: the 2026-06-18 eval fetched 1212 spans and reports c1.zombie_hold_count sampleCoverage 4/4 complete. With complete samples, C1 remains high at 4 replacements over 6 hold_ball calls (66.7%), and 3/4 sampled fires are prior_long single-slot replacements, so the current zombie-hold metric is mostly measuring replacement semantics rather than true zombie timeout.
- Harness: F167/C1 (hold_ball replacement / zombie-hold metric semantics)
- Owner ask: Split C1 hold replacement telemetry semantics. Keep the current single-slot replacement signal as c1.hold_replacement_count (or rename the existing metric), introduce a true c1.hold_zombie_count gated on overdue/imminent wake-delay semantics rather than all replacements, and update F167 eval attribution/SAMPLED_METRICS/YAML formatting/drilldown refs/tests so eval reports replacement churn separately from true zombie holds. Preserve HMAC-safe per-fire refs, priorTaskIdHash/newTaskIdHash extras, and sampleCoverage.
- Re-eval: After the fix reaches runtime, the next eval:a2a run reports separate C1 replacement and true-zombie metrics. The true zombie metric is either below count < 3 or ratio <= 5%, or any remaining true-zombie finding has complete per-fire samples without a benign prior_long replacement majority. C2 verdict_without_pass and void-hold remain below threshold. at 2026-06-19T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-06-18-eval-a2a-c1-zombie-hold-semantics-fix/snapshot
- attribution:bundle/2026-06-18-eval-a2a-c1-zombie-hold-semantics-fix/AR-2026-06-18-001
- metric:traceStore.span_count=1212
- metric:traceStore.max_spans=10000
- metric:c1.hold_ball_calls=6
- metric:c1.zombie_hold_count=4
- metric:c1.zombie_hold_ratio=0.667
- metric:sampleCoverage:c1.zombie_hold_count=4/4 complete=true
- metric:c1.sample.trigger.prior_long=3/4
- metric:c1.sample.trigger.prior_short=1/4
- metric:c2.verdict_without_pass_count=0/174=0
- metric:c2.void_hold_hint_emitted=7/175=0.040
- metric:action_rate=1/2=0.5
- C1/c1.zombie_hold_count/80a244a377696d7e
- C1/c1.zombie_hold_count/6ce1327206e21300
- C1/c1.zombie_hold_count/5009f9a62c694c64
- C1/c1.zombie_hold_count/05e66fe0bda272fa

Counterarguments:
- The 4/4 complete sample set is still a small absolute sample; a future higher-volume window could shift the trigger mix.
- A prior_long replacement may be operationally undesirable even if it is not a true zombie hold, so replacement churn should stay observable under a clearer metric.
- The count might naturally fall below threshold tomorrow, but the current metric label would still be ambiguous and would re-open the same diagnosis problem later.
