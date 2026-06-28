---
feature_ids: [F192, F236]
topics: [harness-eval, eval-anchor-first, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:anchor-first
packet_id: 2026-06-28-eval-anchor-first-empty-window-keep-observe
source_snapshot: "snapshot:bundle/2026-06-28-eval-anchor-first-empty-window-keep-observe/snapshot"
---

# Live Verdict — 2026-06-28-eval-anchor-first-empty-window-keep-observe

- Verdict: `keep_observe`
- Phenomenon: The selected eval:anchor-first window from 2026-06-27T03:00:00Z to 2026-06-28T03:00:00Z produced no anchor preview events in the live Track-2 rollup, so this first weekly fire yields no cost signal for any tool. The current runtime is younger than the nominal 24 hour window, and the latest published eval:task-outcome verdict, dated June 25, 2026, remains keep_observe with 0 cancel signals and no correctness-regression claim, so there is no blindness evidence to pair with the empty anchor window.
- Harness: F236/anchor-telemetry-rollup (anchor-first preview/drill open-rate rollup)
- Owner ask: No new code change from eval:anchor-first this cycle. Merge this empty-window baseline evidence, then re-evaluate on the next weekly fire after a full runtime window; escalate only if a non-empty rollup appears with concrete anchorTax or if a newer eval:task-outcome verdict starts showing correlated quality regression.
- Re-eval: Keep observing if the next weekly fire still has no preview events or only low-sample data. Escalate to fix only when a non-empty anchor rollup shows concrete per-tool anchorTax or when a newer eval:task-outcome verdict adds correlated blindness evidence. at 2026-07-05T03:00:00.000Z

Sunset Signal Assessment:

Open-Rate Detail:
- Orphan drills: 0

Evidence:
- snapshot:bundle/2026-06-28-eval-anchor-first-empty-window-keep-observe/snapshot
- attribution:bundle/2026-06-28-eval-anchor-first-empty-window-keep-observe/eval-F236-2026-06-28:no-finding
- metric:selected_window.duration_hours=24
- metric:runtime.uptime_hours=22.14
- metric:task_outcome.day20_cancel_total=0
- metric:task_outcome.day20_proposal_reject_total=1
- metric:task_outcome.day20_completed_total=5
- metric:task_outcome.day20_in_progress_total=1
- sample:anchor-window-2026-06-27T03Z-2026-06-28T03Z
- sample:task-outcome-2026-06-25-day20-keep

Counterarguments:
- An empty window is not proof that the feature is unused; it may only show that this exact scheduled cutoff preceded meaningful anchor traffic.
- Because eval:task-outcome is currently stale by several days, absence of blindness evidence is weaker than a fresh same-day publish would be.
- If post-cutoff activity is already accumulating, the next weekly fire could look materially different without any code change.
