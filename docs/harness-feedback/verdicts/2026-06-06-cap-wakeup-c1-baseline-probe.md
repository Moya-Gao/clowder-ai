---
feature_ids: [F192, F203]
topics: [harness-eval, capability-wakeup, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:capability-wakeup
packet_id: 2026-06-06-cap-wakeup-c1-baseline-probe
source_snapshot: "snapshot:bundle/2026-06-06-cap-wakeup-c1-baseline-probe/snapshot"
---

# Live Verdict — 2026-06-06-cap-wakeup-c1-baseline-probe

- Verdict: `keep_observe`
- Phenomenon: First scheduled cw eval fire post-PR-2 wire (T+19h, merged 2026-06-06 08:21Z). Workspace-navigator probe across 4 codex sessions selected by grep-hit on open/see file phrases (top hits: 63/21/9/8). Raw weekly tool-stats: workspace_navigate calls opus-45=9 opus=1 opus-47/codex/gpt52/sonnet=0. Codex received open-file phrases 101+ times across 4 sessions, called workspace_navigate 0 times this week.
- Harness: F203/workspace-navigator (workspace-navigator)
- Owner ask: Ship durable trial store + global window scan PR so next weekly fire produces autonomous (unbiased) baseline; tune workspace-navigator predicate thresholds as real verdicts accumulate.
- Re-eval: next eval at 2026-06-13T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-06-06-cap-wakeup-c1-baseline-probe/snapshot
- attribution:bundle/2026-06-06-cap-wakeup-c1-baseline-probe/CW-workspace_navigator-2026-06-07
- metric:miss_rate
- metric:miss_count
- metric:negative_count
- metric:false_positive_count
- metric:raw_navigate_calls_week
- metric:grep_hits_open_phrase
