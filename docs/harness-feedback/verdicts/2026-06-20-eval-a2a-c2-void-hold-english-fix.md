---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-06-20-eval-a2a-c2-void-hold-english-fix
source_snapshot: "snapshot:bundle/2026-06-20-eval-a2a-c2-void-hold-english-fix/snapshot"
---

# Live Verdict — 2026-06-20-eval-a2a-c2-void-hold-english-fix

- Verdict: `fix`
- Phenomenon: The 2026-06-20 F167 eval reports C2 void-hold hints at 10/122 = 8.2%, above the 5% floor. The sampled fires are dominated by English `hold_ball` / `holdball` lexical mentions (`en_hold_ball_underscore`, `en_holdball_space`), indicating the detector is counting English tool/status text as missing hold-ball action rather than true routing exits.
- Harness: F167/C2 (A2A Chain Quality — exit-check void-hold guard)
- Owner ask: Tune the C2 void-hold detector so English tool/status mentions such as `hold_ball` / `holdball` do not fire `c2.void_hold_hint_emitted` unless the final routing slot is genuinely asserting an unbacked hold. Preserve true missing-hold coverage, add regressions for `en_hold_ball_underscore` and `en_holdball_space`, and keep per-fire sample attribution intact.
- Re-eval: After the fix reaches runtime, the next eval:a2a run reports C2 void-hold at or below 5% (or count < 3) and sampled fires are no longer dominated by English `hold_ball` / `holdball` lexical mentions. Any remaining C2 finding must have concrete samples pointing to true unbacked hold declarations rather than tool/status prose. at 2026-06-21T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-06-20-eval-a2a-c2-void-hold-english-fix/snapshot
- attribution:bundle/2026-06-20-eval-a2a-c2-void-hold-english-fix/AR-2026-06-20-001
- metric:C2/c2.void_hold_hint_emitted=10
- metric:C2/c2.void_hold_checked=122
- metric:C2/c2.void_hold_ratio=0.082
- metric:traceStore.span_count=1117
- metric:sampleCoverage:C2/c2.void_hold_hint_emitted=7/10 complete=false
- C2/c2.void_hold_hint_emitted/6b90e2407a22fddf
- C2/c2.void_hold_hint_emitted/15ba159cb99c5e6e
- C2/c2.void_hold_hint_emitted/787f01096170c228
- C2/c2.void_hold_hint_emitted/642e23857c2879f1
- C2/c2.void_hold_hint_emitted/0f042154b451477f
- C2/c2.void_hold_hint_emitted/d541c372f7698c94
- C2/c2.void_hold_hint_emitted/61779720534ad38d

Counterarguments:
- The sample coverage is 7/10 rather than complete; the unsampled 3 fires could include true positives.
- The route-serial inline-action finding is also slightly above threshold at 7/122 = 5.7%, so C2 may not be the only A2A friction source in this window.
- English `hold_ball` wording might sometimes correlate with a real missing tool call; the fix must narrow by routing-slot semantics rather than blanket-ignore all English terms.
