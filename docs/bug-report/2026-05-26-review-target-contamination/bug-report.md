---
topics: [review, recall, memory, thread-export, a2a, target-validation]
doc_kind: bug-report
created: 2026-05-26
severity: P2
status: documented
related_features: [F128, F200, F209]
---

# Bug Report: Short Review Query Picked an Archived Thread Export Instead of PR85

> Reporter: Landy
> Incident cat: Codex / 砚砚
> Thread: `thread_mpglte6wgt4pxh7z`
> Incident window: 2026-05-25 PT

## 1. Summary

In a thread whose active work was open-source PR review for
`zts212653/clowder-ai#85`, Landy sent a short follow-up:

```text
来review 看看？
```

Given the immediate prior context, this should have meant:

```text
Review PR #85 again.
```

Instead, Codex started reviewing an unrelated local Cat Cafe worktree,
`feat/mention-union`, found two P1 issues, and routed the result to local Opus.
That created a false A2A branch inside the PR85 thread and briefly led Opus
toward merge-gate for the unrelated feature.

Landy interrupted before any merge happened.

## 2. Impact

- Wrong review target selected: `feat/mention-union` instead of PR #85.
- Local Opus was pulled into an unrelated repair/review loop.
- The PR #85 review was delayed and the thread's context became polluted.
- No repository files were modified by the wrong review itself.
- No merge was completed from the wrong path.

Severity is P2: no data loss or security issue, but the failure created a
high-confidence wrong workflow and could have led to an unrelated merge if not
interrupted.

## 3. What Actually Happened

The first explanation incorrectly blamed a later Opus handoff. That was wrong.
The actual sequence was:

1. The thread had been tracking PR #85 / F128 proposal-first thread creation.
2. Landy asked `来review 看看？`.
3. Codex did not anchor the review target to the current thread objective.
4. Codex ran broad recall / local context search for recent review-like work.
5. A generated archive under the legacy path
   `docs/discussions/exported-threads/` contained another thread's
   `feat/mention-union` review request.
6. Codex treated that archive hit as the current review target.
7. Codex found a real local worktree for `feat/mention-union`, which created a
   false confirmation loop.
8. Codex reviewed that worktree and routed the result to `@opus`.
9. Opus responded in the current thread because Codex had created a valid
   current-thread A2A route.

There is no evidence that the runtime delivered a live message from another
thread into this thread. The cross-thread-looking Opus message was caused by
Codex's own wrong `@opus` route after the target selection error.

## 4. Evidence

### Current Thread Context

In the current thread, the relevant sequence was:

- User: `来review 看看？`
- Codex: "最近轨迹里有一条非常像这次 review 目标:
  `parseGroupMentions / group mention union routing / @ autocomplete`"
- Codex: reviewed `/Users/lysander/projects/relay-station/cat-cafe-mention-union`
- Codex: ended with `@opus`
- Opus then fixed the two reported P1s inside this same thread.

This proves the Opus branch was downstream of Codex's wrong route, not the
upstream cause.

### Archive Pollution Source

At incident time, `docs/discussions/exported-threads/` contained generated
thread markdown exports. One exported thread included a `feat/mention-union`
review request with fields like:

```text
Branch: feat/mention-union
Review-Target-ID: fix-mention-union
Review request: docs/mailbox/2026-05-25-mention-union-review-request.md
```

The same exported conversation also contained a system warning that the Opus
message was not a valid handoff unless `@codex` was placed on its own line. That
context was not used before Codex selected the wrong target.

### Existing Mitigation Commit

After the incident, main already contained:

```text
58f0a43ec fix(memory): keep thread exports out of docs corpus (#1897)
```

That fix moved thread markdown exports out of the curated docs corpus and added
scanner protection for `exported-threads` directories.

## 5. Root Cause

The failure was not "memory recall became too strong."

The deeper root cause was a missing target-validation step between retrieval and
action:

1. **Short-query ambiguity**: `来review 看看？` relied on current-thread context.
2. **Broad retrieval over current-thread anchoring**: Codex searched for
   "recent review-like work" instead of inheriting the active PR85 target.
3. **Generated archives were in the docs search surface**:
   `docs/discussions/exported-threads/` made raw thread dumps look like curated
   discussion docs.
4. **Archive hit was treated as instruction**: Codex treated a recall/search hit
   as a live task handoff.
5. **False filesystem confirmation**: the `cat-cafe-mention-union` worktree was
   real, so the wrong target felt confirmed.

The hard failure is step 4: retrieval results are indexes, not commands.

## 6. What Should Have Happened

For a short review request inside an active PR-review thread, Codex should have
performed this target anchor check before any broad recall:

```text
Current thread objective: PR #85 / F128 proposal-first thread creation
Last known PR state: CHANGES_REQUESTED at 6995d01c
User's new request: "来review 看看？"
Resolved target: zts212653/clowder-ai#85 latest head
```

Only after that should Codex have checked GitHub for the latest PR head, CI,
comments, and diff.

If a recall result points to another worktree or archived thread, it must stay a
candidate until validated against the current thread objective.

## 7. Corrective Actions

### Already Done

- `58f0a43ec` moved thread exports out of `docs/` and excluded
  `exported-threads` from memory evidence indexing.

### Recommended Follow-ups

1. **Review Target Anchor Gate**
   - For short review queries, require the agent to resolve and state the target
     before reading unrelated diffs.
   - Minimum target fields: repo/PR or worktree path, head SHA, source message,
     and why this is the current task.

2. **Archive Source Guard**
   - Search results from generated archives, mailbox, or exported threads should
     be visibly labeled as non-live context.
   - Agents must not treat these results as handoff or task ownership evidence.

3. **Recall UI / Tool Metadata**
   - Retrieval results should expose source category (`live-thread`,
     `sealed-session`, `curated-doc`, `archive-export`, `mailbox`) so agents can
     apply different trust rules.

4. **A2A Route Sanity Check**
   - Before sending `@author` after a review, confirm the author belongs to the
     resolved target, not merely to a retrieved archive.

5. **F128 PR Review Handoff**
   - PR #85 review should be restarted from a fresh context or another thread.
   - This incident thread is polluted by the wrong-target investigation and
     should not be used for final PR85 approval.

## 8. Lessons

- Recall is an index, not authority.
- Current thread objective beats broad workspace recency.
- Generated recovery artifacts must not live inside curated docs search space.
- A real worktree is not proof that it is the user's requested target.
- A2A routing after a wrong target selection can make the wrong branch look
  legitimate.

## 9. Open Questions for Memory Feature Owners

- Should `search_evidence` hard-exclude generated archives, or only down-rank
  and label them?
- Should invocation-level auto recall be allowed to surface archived thread
  dumps at all?
- Can the tool enforce "open source/current thread first" when a query has an
  active thread-local target?
- Should review workflows have a formal "target anchor" schema in the
  request-review / receive-review skills?

## 10. Current Decision

Codex will not continue PR85 review inside this polluted thread. The immediate
deliverable is this incident report. A fresh thread/agent should pick up PR85
from live GitHub state.

[砚砚/gpt-5.5🐾]

## 11. Three-Cat Postmortem Discussion (2026-05-26)

> Discussion thread: `thread_mpglte6wgt4pxh7z` (same thread as the incident)

CVO convened opus-47, opus-46, and codex to independently analyze the incident.
Below is a summary of each cat's diagnosis, the CVO's feedback, and the
conclusion.

### 砚砚 (codex / GPT-5.5) — Self-diagnosis

- Root cause: "I treated a recall candidate as a goal instead of validating it
  against the current thread objective."
- Proposed: review skills should add a target anchor gate (state the target
  before acting, refuse to proceed if target is unclear).
- Later refined: distinguish three planes — Task (what am I doing), Evidence
  (what did I find), Action (what can I do). Evidence must not be treated as
  Task.

### 宪宪 47 (opus-47) — Protocol-layer diagnosis

- Root cause: `search_evidence` returns results without scope metadata
  (`source_kind`, `thread_scope`). Agent cannot structurally distinguish live
  context from archived exports.
- First proposal: add `source_kind` to search results, add `memory-target-
  validation` skill, add magic word.
- After CVO magic word "数学之美" correction: collapsed 7 patches into 1
  structural change — MCP invocation should carry `current_task_id` so search
  defaults to current task scope.
- CVO rejected: `current_task_id` assumes thread = task 1:1, which breaks when
  a thread named "猫猫贴贴" suddenly gets a PR review request.

### 宪宪 46 (opus-46) — Kill-chain + data-model diagnosis

- Root cause: 4-step cascade (search pollution → candidate-as-goal → A2A no
  task context → human last line of defense). Emphasized that opus-46 was pulled
  into the wrong review loop and had no signal to detect the misroute.
- First proposal: A2A messages should carry task provenance, search results
  should add `source_kind` + warning, review skills add target anchor gate.
- After CVO magic word correction: collapsed to `activeTarget` field on thread
  — thread remembers what it's tracking, navigation injection tells the cat.
- CVO rejected: same 1:1 assumption as opus-47.
- Final refinement: "Active Context" line extracted dynamically from
  conversation history (not a thread property). Regardless of thread name, if
  the conversation discussed PR85, the navigation injection surfaces it.

### CVO Feedback (Landy)

1. "你们的 context 里是有之前在干嘛的呀！" — Navigation injection already
   provides thread opener, anchors, and recent messages. The information was
   there; Codex did not consume it.
2. "猫猫贴贴" counter-example: users do not say "review" out of nowhere. If
   PR85 is mentioned, it will be in the conversation history. Thread-level
   metadata is the wrong abstraction.
3. "先作为失败模式保存下来" — One case is not enough to design a systemic fix.
   Collect failure modes first, analyze patterns later.
4. "下次再出现类似的失败模式，我们就能把这个找回来" — This incident report
   should be findable when a similar failure occurs.

### Conclusion

- **Direct bug fixed**: `58f0a43ec` removed `exported-threads` from the
  `CatCafeScanner` search surface.
- **Systemic fix deferred**: one case is insufficient to justify protocol-level
  changes. All three cats' proposals (target anchor gate, current_task_id,
  activeTarget, active context extraction) are recorded here as candidate
  solutions for future evaluation.
- **Next trigger**: when a second similar failure mode occurs, revisit this
  report and the candidate solutions to identify the common pattern.
- **Key insight from CVO**: the navigation injection already contained the
  correct context. The failure was not "missing information" but "information
  not consumed." Future analysis should focus on why agents skip available
  context in favor of broad recall.
