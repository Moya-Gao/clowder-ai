---
feature_ids: [F192, F200]
topics: [harness-eval, memory-recall, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:memory
packet_id: 2026-06-10-eval-memory-shadow-artifact-fixed-keep-observe
window_days: 30
source_snapshot: "snapshot:bundle/2026-06-10-eval-memory-shadow-artifact-fixed-keep-observe/snapshot"
---

# Live Verdict — 2026-06-10-eval-memory-shadow-artifact-fixed-keep-observe

- Verdict: `keep_observe`
- Phenomenon: Day-1-4 (cron #1-9) 4-day '6.7× shadow:live MRR divergence' confirmed as 1/c indicator-asymmetry artifact (consumedMRR denominator = rows.length all events vs shadowConsumedMRR denominator = shadowRows.length subset). Fixed by B' PR #2108 (merge 3e2effdf7) adding liveOnShadowSubsetMRR mirror metric. Day-5/6/7/8/9 apples-to-apples ratio = shadowConsumedMRR / liveOnShadowSubsetMRR = 1.0000 exactly sustained 5 consecutive days across sample evolution (n: 802→915, shadowMRR 0.5998→0.6490). No ranker promotion signal post-fix.
- Harness: F200/recall_metrics_computer (memory-recall)
- Owner ask: No further action on shadow promotion. 5-day apples-to-apples ratio = 1.0000 exactly + opus-46 BETA insight confirms shadow ranker effectively noop on consumed-event evaluation. Continue weekly eval. If future ratio > 1.5x, investigate (artifact fixed, true signal would surface cleanly). BETA calibration sub-finding tracked for future verdict cycle if data warrants.
- Re-eval: next eval at 2026-06-17T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-06-10-eval-memory-shadow-artifact-fixed-keep-observe/snapshot
- attribution:bundle/2026-06-10-eval-memory-shadow-artifact-fixed-keep-observe/eval-F200-memory-2026-06-10:no-finding
- metric:consumed_mrr
- metric:consumed_at_3
- metric:search_abandon_rate
- metric:shadow_consumed_mrr
- metric:live_on_shadow_subset_mrr
- metric:non_first_selection_rate
- metric:traversal_completion
- metric:grep_fallback_rate
- metric:orphan_edge_count
- metric:stale_anchor_count
- metric:verification_debt_count
- metric:search_zero_hit_count
