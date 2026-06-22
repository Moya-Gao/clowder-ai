---
feature_ids: [F192, F200]
topics: [harness-eval, memory-recall, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:memory
packet_id: 2026-06-21-eval-memory-shadow-stable-week3-keep-observe
window_days: 30
source_snapshot: "snapshot:bundle/2026-06-21-eval-memory-shadow-stable-week3-keep-observe/snapshot"
---

# Live Verdict — 2026-06-21-eval-memory-shadow-stable-week3-keep-observe

- Verdict: `keep_observe`
- Phenomenon: Mandatory weekly re-eval per PR #2187 acceptanceReevalPlan, 96h overdue due to 7 consecutive cron sessions (#18-24) interrupted before publish. Shadow apples-to-apples ratio = shadowConsumedMRR / liveOnShadowSubsetMRR = 1.0000 exactly sustained 16+ consecutive days post-B'-fix (PR #2108 merge 3e2effdf7) across sample evolution. F188 library coverage gap emerged day-12 spike (zeroHit 11, lowHit 24), self-recovered day-14, sustained recovery day-15+. Both signals match closureCondition.
- Harness: F200/recall_metrics_computer (memory-recall)
- Owner ask: No further action on shadow promotion (16-day apples-to-apples ratio = 1.0000 exactly). Continue weekly cadence. F188 spike self-recovered. BETA calibration experiment opportunity noted for future verdict cycle if data warrants.
- Re-eval: next eval at 2026-06-28T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-06-21-eval-memory-shadow-stable-week3-keep-observe/snapshot
- attribution:bundle/2026-06-21-eval-memory-shadow-stable-week3-keep-observe/eval-F200-memory-2026-06-21:no-finding
- metric:consumed_mrr
- metric:consumed_at_3
- metric:search_abandon_rate
- metric:shadow_consumed_mrr
- metric:live_on_shadow_subset_mrr
- metric:non_first_selection_rate
- metric:traversal_completion
- metric:orphan_edge_count
- metric:search_zero_hit_count
- metric:search_low_hit_count
