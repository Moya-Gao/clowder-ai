---
title: F200 Consumption Attribution Audit
date: 2026-05-18
owner: codex
status: stratified-sample-round-1
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

## Stratified Sampling Round 1 (2026-05-18)

This round sampled:

- all 6 rows with `consumed_json!='[]'`
- recent post-v1.1 / post-SW rows after `1779060000000`
- candidate-gap rows with raw Redis `ToolEventLog` comparison
- Codex-style shell-read invocations

### Result 1: candidate gap is mostly result-summary merge failure, not search-result parsing

Post-v1.1 sample after `1779060000000`:

| cat | tool | total | no candidates | consumed |
|---|---:|---:|---:|---:|
| codex | `search_evidence` | 5 | 0 | 1 |
| codex | `list_recent` | 1 | 0 | 1 |
| codex | `graph_resolve` | 1 | 0 | 0 |
| opus | `search_evidence` | 9 | 9 | 0 |
| opus-47 | `search_evidence` | 4 | 4 | 0 |
| opus-47 | `list_recent` | 1 | 1 | 0 |

Raw Redis evidence:

- Codex MCP results have `_resultMerged=true`, `resultCount`, and `_f200Candidates`.
- Opus / Opus-47 candidate-gap rows only have input-side fields such as
  `query/scope/mode/limit`; no `_resultMerged`, no `resultCount`, no `_f200Candidates`.

Examples:

| recall_id | cat | tool | query | raw event summary |
|---|---|---|---|---|
| `ff005827-c472-44f7-bebf-9da42aefb09c` | opus | `search_evidence` | `harness eval socio-technical 评估 质量` | input fields only |
| `c87d1e80-c35b-473f-8a38-926a390854c0` | opus-47 | `search_evidence` | `agent-native software engineering harness eval socio-technical` | input fields only |
| `959ba88a-efc0-4f43-b873-66d680c08f33` | opus-47 | `search_evidence` | `karpathy llm wiki 拆解 对照 cat-cafe 记忆系统` | input fields only |
| `235883f6-d4a3-444b-80d9-86ea60983770` | codex | `search_evidence` | `F200 memory recall eval agent-native...` | `_resultMerged + _f200Candidates` |

Mechanism:

- `derive-result-summary.ts` can parse the current MCP text format when it is actually called
  with the correct normalized tool name.
- Codex `mcp_tool_call` results include a first-line label like `mcp:server/tool (completed)`,
  so `route-parallel.ts` can infer the tool name and call `updateSummary`.
- Claude/Opus parallel tool results often do not carry a result-side `toolName`, `toolUseId`, or
  `mcp:` first-line label. In that path, `route-parallel.ts` has no pending-tool FIFO fallback
  equivalent to `route-serial.ts`, so result-side summaries are never merged into the original
  tool event.

Conclusion:

Root cause 1 is **not primarily** the `deriveSearchEvidence()` anchor regex. The first fix should
be route-level: make parallel routing reliably pair result summaries back to their tool_use events
for all cats, either by propagating `toolUseId` or by maintaining a per-cat pending tool-result FIFO
like serial routing. After that, add `sourcePath` to F200 candidates so path-based reads can match.

### Result 2: shell reads are a real Codex false-negative class

Concrete invocation:

- invocation: `a4b155a6-fad2-4f25-b250-4494cfddef3b`
- cat: `codex`
- thread: `thread_mpaic7f0es8t3y8u`

Raw events show multiple memory searches with candidates, then many `command_execution` file reads:

- `sed -n '1,260p' docs/features/F200-memory-recall-eval.md`
- `sed -n '1,240p' docs/features/F192-socio-technical-harness-eval.md`
- `sed -n ... docs/discussions/...`
- `rg --files docs | ...`
- `nl -ba ...`

Current correlator behavior:

- `CONSUMED_METHODS` excludes `command_execution`.
- `task_trajectories.files_read_json` is also `[]` for this invocation because shell reads are not
  normalized into read artifacts.
- The only consumed credit in this invocation comes from a later `graph_resolve(F200)`, not from
  the shell-read documents that were actually used for the answer.

Conclusion:

Root cause 2 should be fixed in the same HW-4 batch: parse safe read-only shell commands
(`sed`, `nl`, `cat`, `rg`, possibly `find` when it resolves concrete files) into doc read targets.
This should feed both consumption correlation and trajectory `filesRead`.

### Result 3: all current positives are ambiguous, not clean per-search truth

All 6 `consumed_json!='[]'` rows come from only 2 Codex invocations:

| invocation | consumed rows | common consumed signal |
|---|---:|---|
| `538bac66-81ab-4309-b966-abc38e92e8ab` | 4 | repeated later `graph_resolve(F200)` |
| `a4b155a6-fad2-4f25-b250-4494cfddef3b` | 2 | later `graph_resolve(F200)` |

The positives are not obviously wrong-document false positives: both invocations were genuinely
about F200 / memory recall. But they are **not clean per-search positives** either:

- one later `graph_resolve(F200)` can credit multiple previous searches,
- `list_recent` credited F200 at rank 16 because a later graph query selected F200,
- repeated `graph_resolve(F200)` calls create duplicate positive rows in the same invocation.

Conclusion:

Root cause 3 is real enough to include in this repair. HW-4 should introduce result-set or
bundle-level provenance for attribution. Minimum acceptable v1:

- keep per-search `consumed`, but attach the consuming event id / method / distance;
- group searches in one invocation into a `resultSetId` or `searchBundleId` when they are run before
  the first downstream read/graph drill;
- mark ambiguous bundle consumption separately from clean single-result consumption.

Without this, OQ-6/OQ-7 would be decided from duplicated/ambiguous positives.

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

## Round 1 Repair Scope

The next implementation batch should include:

1. **Result-summary merge reliability**
   - Add parallel-route result pairing for Claude/Opus path.
   - Prefer exact `toolUseId` if available.
   - Otherwise use a per-cat pending FIFO, matching serial route behavior.
   - Add regression tests where a `tool_result` has result text but no result-side tool name.
2. **Structured F200 candidates**
   - Preserve `sourcePath` in `_f200Candidates` for `search_evidence` / `list_recent` where the API
     already has it.
   - Do not rely solely on anchors for file-path matching.
3. **Shell-read consumption**
   - Parse safe `command_execution` reads (`sed`, `nl`, `cat`, `rg`) into file read targets.
   - Feed the same normalized paths into both `RecallEventCorrelator` and task trajectory
     `filesRead`.
4. **Ambiguity-aware attribution**
   - Add consuming event provenance and a bundle / result-set marker.
   - Separate clean per-result consumption from ambiguous coverage-bundle consumption.

Out of scope for this batch:

- explicit human "I used this result" confirmation UI;
- ranking policy changes based on consumption metrics;
- OQ-6 / OQ-7 close decisions.

## Current Judgment

`consumed_json` is currently good enough for coarse trend telemetry, but not accurate enough to
drive OQ-6/OQ-7 decisions by itself. Round 1 sampling changed the repair direction:

- candidate gaps are primarily a route-level result-summary merge bug for Claude/Opus paths;
- shell reads are a real Codex false-negative class;
- existing positives are mostly ambiguous bundle-level signals, not clean per-search truth.

Therefore HW-4 should repair the telemetry substrate before any consumption-based ranking decision.
