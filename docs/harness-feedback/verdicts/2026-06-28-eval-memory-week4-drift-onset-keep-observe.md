---
feature_ids: [F192, F200]
topics: [harness-eval, memory-recall, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:memory
packet_id: 2026-06-28-eval-memory-week4-drift-onset-keep-observe
window_days: 30
source_snapshot: "snapshot:bundle/2026-06-28-eval-memory-week4-drift-onset-keep-observe/snapshot"
---

# Live Verdict — 2026-06-28-eval-memory-week4-drift-onset-keep-observe

- Verdict: `keep_observe`
- Phenomenon: Mandatory weekly re-eval per PR #2484 acceptanceReevalPlan. Apples-to-apples ratio drifted from sustained 1.0000 (day-5-19, 15-day post-B'-fix exact) to sustained 1.03-1.04 band (day-21-25, 5-day moderate drift). shadowConsumedMRR rising faster (+7%) than liveOnShadowSubsetMRR (+4%) over 6-day window. Drift well below 1.5x threshold, no escalation. F188 library health remained completely clean throughout (zeroHit/lowHit/staleAnchors/verifDebt all 0).
- Harness: F200/recall_metrics_computer (memory-recall)
- Owner ask: Continue weekly cadence with tightened watch threshold (1.05 moderate alert added below 1.5 critical). If ratio expands to >= 1.1 sustained 3-day OR firstConsumedRankMedian drops to 3+, ship fix verdict for BETA calibration experiment (BETA sweep 0.05/0.15/0.30/0.50 to characterize ranker behavior). If ratio returns to <= 1.02, dismiss drift as sample evolution. Current 1.04 band is in observe-and-monitor zone.
- Re-eval: next eval at 2026-07-05T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-06-28-eval-memory-week4-drift-onset-keep-observe/snapshot
- attribution:bundle/2026-06-28-eval-memory-week4-drift-onset-keep-observe/eval-F200-memory-2026-06-28:no-finding
- metric:consumed_mrr
- metric:consumed_at_3
- metric:search_abandon_rate
- metric:shadow_consumed_mrr
- metric:live_on_shadow_subset_mrr
- metric:non_first_selection_rate
- metric:traversal_completion
- metric:first_consumed_rank_median
- metric:orphan_edge_count
- metric:search_zero_hit_count
