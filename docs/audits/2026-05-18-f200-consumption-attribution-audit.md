---
title: F200 Consumption Attribution Audit
date: 2026-05-18
owner: codex
status: initial-sample
feature: F200
---

# F200 Consumption Attribution Audit

## Why

铲屎官 challenge 成立：大规模并发搜索时，"哪条结果真的被消费了"不能只靠
`consumed_json` 当真相。当前 F200 `consumed` 是后验归因 proxy，不是显式消费确认。

本审计目标：抽样 `recall_events`，对照原始 `ToolEventLog` / `task_trajectories`，估算：

- false negative：猫实际用了结果，但 `consumed_json=[]`
- false positive：`consumed_json` 记了，但真实使用并不支持这个归因
- ambiguous attribution：一次后续 Read/Bash/graph 可能属于多轮 search，归因不唯一

## Data Sources

- Runtime evidence DB: `/Users/lysander/projects/relay-station/cat-cafe-runtime/evidence.sqlite`
- Raw tool events: Redis 6399, key pattern `cat-cafe:tool-event-log:{threadId}`
- Relevant tables:
  - `recall_events`
  - `task_trajectories`
  - `anchor_recall_metrics`

## Current Runtime Snapshot

```sql
SELECT COUNT(*) total,
       SUM(consumed_json != '[]') consumed,
       ROUND(100.0 * SUM(consumed_json != '[]') / COUNT(*), 2) consumed_pct
FROM recall_events;
```

Result:

| total | consumed | consumed_pct |
|---:|---:|---:|
| 147 | 6 | 4.08% |

Initial attribution risk scan:

| Metric | Count | Rate |
|---|---:|---:|
| recall_events with `candidates_json=[]` | 87 / 147 | 59.2% |
| `consumed_json=[]` but same invocation trajectory has `files_read_json!=[]` | 39 / 147 | 26.5% |

By tool:

| tool | total | no candidates | consumed | unconsumed but invocation read files |
|---|---:|---:|---:|---:|
| `search_evidence` | 109 | 65 | 2 | 35 |
| `list_recent` | 21 | 13 | 1 | 2 |
| `graph_resolve` | 17 | 9 | 3 | 2 |

## Initial Findings

### Finding 1: Candidate extraction is missing for many recall events

59.2% of `recall_events` currently have `candidates_json=[]`. When candidates are empty,
the correlator has no result set to match later reads against, so real consumption cannot be
recorded.

Concrete sample:

- `recall_id=ff005827-c472-44f7-bebf-9da42aefb09c`
- cat: `opus`
- query: `harness eval socio-technical 评估 质量`
- `candidates_json=[]`
- Same trajectory later read multiple related docs:
  - `docs/discussions/2026-04-28-react-to-teamact-brainstorm.md`
  - `docs/discussions/2026-04-29-harness-asset-vs-debt-brainstorm.md`
  - `docs/plans/tech-sharing/2026-04-25-topics-final.md`
  - `docs/discussions/2026-05-05-socio-technical-harness-eval-draft.md`

Interpretation: this is not merely a matching-window problem. If result-side `_f200Candidates`
do not merge into `ToolEventLog`, consumption attribution is impossible.

### Finding 2: Shell-based file reads are not counted as consumption

`RecallEventCorrelator` only treats these as consumption methods:

- `Read`
- `Grep`
- `graph_resolve`
- `read_session_events`
- `read_session_digest`
- `read_invocation_detail`
- `get_thread_context`

But Codex often reads files through `command_execution` such as:

- `sed -n ... docs/features/F200-memory-recall-eval.md`
- `rg ... docs/...`
- `nl -ba ...`

Concrete sample:

- invocation: `a4b155a6-fad2-4f25-b250-4494cfddef3b`
- cat: `codex`
- thread: `thread_mpaic7f0es8t3y8u`
- Search events had candidates, but later file reads were logged as `command_execution`.
- Current `consumed_json` only credited `F200` via later `graph_resolve`, not the many docs read
  via shell commands.

Interpretation: this creates systematic false negatives for Codex-style workflows.

### Finding 3: Same-invocation multi-search creates ambiguous attribution

In realistic coverage tasks, one invocation can run several searches before reading files. A later
read may be evidence of using the whole search bundle, not a single preceding search. Current logic
walks each search's later window independently, so a single read can be:

- missed if candidates were empty or path did not match anchor,
- attributed to one search because of anchor/path coincidence,
- or potentially attributed to multiple prior searches if candidate pools overlap.

Interpretation: `consumed` is useful as trend telemetry, but not reliable as per-result truth.

## Sampling Protocol

For the full audit, use stratified sampling rather than pure random sampling:

1. **True-positive check**: all events with `consumed_json!='[]'` first, because there are only 6.
2. **False-negative risk**: sample 10-20 events with `consumed_json=[]` and trajectory
   `files_read_json!=[]`.
3. **Candidate extraction gap**: sample 10 events with `candidates_json=[]`.
4. **Likely true abandon**: sample 10 events with `consumed_json=[]`, no files read, and no later
   related tool use.

For each sampled event:

1. Read `recall_events` row.
2. Join `task_trajectories` by `invocation_id + cat_id` to get `thread_id`, `files_read_json`,
   and `files_modified_json`.
3. Read raw Redis event log:

   ```bash
   redis-cli -p 6399 --raw zrange "cat-cafe:tool-event-log:{threadId}" 0 -1
   ```

4. Filter by `invocationId` and `catId`.
5. Build a manual classification:
   - `correct_positive`
   - `false_negative`
   - `false_positive`
   - `ambiguous`
   - `true_abandon`
   - `candidate_extraction_failure`

## Follow-up Candidates

Potential fixes after audit:

- Preserve result candidates more reliably in `ToolEventLog.updateSummary`.
- Include `sourcePath` in `_f200Candidates` for `search_evidence` results, not just `anchor`.
- Parse safe shell file-read commands (`sed`, `nl`, `cat`, `rg`) from `command_execution`.
- Add `resultSetId` to link a read to a specific search result bundle.
- Add an explicit consume marker for MCP tools where the agent selects/drills into a result.
- Treat coverage-task invocations as bundle-level consumption rather than single-search consumption.

## Current Judgment

`consumed_json` is currently good enough for coarse trend telemetry, but not accurate enough to
drive OQ-6/OQ-7 decisions by itself. Before using consumption metrics to change ranking policy,
we need the attribution audit above and likely at least one implementation fix for shell reads or
candidate extraction.
