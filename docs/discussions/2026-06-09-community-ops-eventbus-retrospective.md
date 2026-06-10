---
doc_kind: discussion
topics: [community, opensource, eventbus, multi-agent, orchestration, repo-inbox]
related_features: [F128, F140, F141, F168, F222, F227]
created: 2026-06-09
participants: [landy, codex]
status: draft
---

# Community Ops Event Bus Retrospective

## Purpose

This note captures the current pain around community issue / PR operations in Cat Cafe and proposes a direction for the next design thread. It is intentionally a discussion input, not a final spec.

The immediate goal is to give the next thread enough context for Fable5 and a parallel Codex invocation to own the upgrade without pulling the long-running Repo Inbox thread back into every decision.

## Trigger

On 2026-06-09, Landy pointed out that the current Repo Inbox thread has been running for weeks and is accumulating several systemic problems:

- New issue / PR events arrive while the current cat is still triaging or routing previous objects.
- Work delegated through F128 or cross-thread messages sometimes comes back to the source thread instead of closing inside the destination thread.
- The source thread sometimes mentions local teammates again, causing the source thread to do too much implementation / review / coordination.
- The source cat often re-validates whether every issue report or PR review is correct, which improves local confidence but pollutes context and turns the source thread into a global second reviewer.
- GitHub only reliably notifies the system about new issue / PR events and tracked PR follow-up signals; issue follow-up comments are not treated as first-class events, so cats compensate with manual polling or hold-ball.
- Downstream threads may fix code but forget the community closure work: public comment, labels, linked PR, issue closure decision, intake ledger, or final status.
- Reports to Landy can be too technical: lots of evidence, not enough "what is this in human terms, what do I need to decide?"

## Existing House Context

F141 already defines a three-layer model:

1. Repo Inbox discovery: "something new arrived."
2. Triage / claim: "who owns it?"
3. PR Signals tracking: "what changed on the tracked PR?"

F141's initial webhook scope covers new PRs, new issues, and PR ready-for-review. That leaves a gap for issue lifecycle and issue-comment follow-ups.

F140 solves a mature version of the PR side: CI, conflict, and review feedback are tracked after a PR is registered. There is no equivalent Issue Signals layer with the same durability.

F168 already named the broader product goal: Landy should stop being the human dispatcher. Cats should discover, classify, assign, track, and guard community work, with Landy only handling real decision points.

F128 is the current mechanism for forking work into a dedicated thread. Its `reportingMode` contract is useful, especially `none` for autonomous downstream work, but a no-report-back contract does not by itself guarantee community closure evidence.

## External Reference: Anthropic Multi-Agent Lessons

Anthropic's multi-agent research system writeup is relevant but should not be copied blindly. The useful takeaways are:

- Multi-agent systems are most useful when work benefits from breadth, parallelism, and larger combined context.
- They are not automatically better for tightly coupled implementation tasks.
- A lead agent coordinating subagents synchronously can become a bottleneck.
- Asynchronous agents improve throughput but create state-consistency and error-propagation problems.

Anthropic's managed / long-running agent material reinforces the same direction:

- Long-running agents need durable session logs outside the context window.
- Agent "brain" and execution harness should be decoupled.
- Recovery should rely on persisted event/session state, not on one long chat remaining coherent forever.

Sources:

- <https://www.anthropic.com/engineering/multi-agent-research-system>
- <https://www.anthropic.com/engineering/managed-agents>
- <https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents>

## Diagnosis

The current failure is not "the source cat should try harder." It is a role-design failure.

The Repo Inbox source thread is being asked to act as:

- event inbox
- router
- evidence checker
- CVO translator
- PR reviewer
- downstream progress monitor
- GitHub public-response scribe
- intake closure guard
- status board

Those roles require different state boundaries. A chat thread can carry conversation, but it is a poor durable state machine. Once several unrelated issue / PR objects interleave, the source cat naturally over-checks, over-explains, and accumulates stale facts.

The worst local behavior pattern for Codex is "verification addiction": when a report comes in, Codex reads issue, PR, code, history, tests, and comments to avoid being wrong. That is correct for code review, but too expensive for inbox routing. At scale it turns one source thread into a full-time maintainer brain.

## Event Bus Model

The proposed direction is not "more cats talking more." It is:

> Community operations should be event-sourced. Chat is the interaction surface; the event bus and read model are the operational truth source.

Candidate event types:

- `issue.opened`
- `issue.commented`
- `issue.edited`
- `issue.labeled`
- `issue.closed`
- `issue.reopened`
- `issue.linked_pr_changed`
- `pr.opened`
- `pr.synchronize`
- `pr.checks_pending`
- `pr.checks_passed`
- `pr.checks_failed`
- `pr.review_submitted`
- `pr.review_dismissed`
- `pr.merge_state_changed`
- `pr.merged`
- `thread.proposed`
- `thread.approved`
- `thread.assigned`
- `public_comment.posted`
- `community_closure.completed`
- `intake.recorded`
- `intake.advanced`

The read model should project these into per-object state:

```text
CommunityObject {
  repo
  type: issue | pr
  number
  state
  ownerThreadId
  ownerCatId
  nextOwner: cat | external_author | ci | cvo | none
  blockedOn
  lastExternalActivityAt
  lastPublicCommentAt
  linkedIssues
  linkedPrs
  closureChecklist
}
```

The source thread should read this projection, not reconstruct the world from chat history.

## Proposed Operating Model

### 1. Inbox Narrator / Lightweight Triage

For new issue / PR events, use a lightweight first-pass cat or role. Landy's idea of using a cheaper, more conversational cat is directionally right, with one guardrail: this role must not become another state owner.

Its job:

- Explain in plain language what the object is.
- Check minimal evidence: issue body, labels, linked PRs, author association, obvious related feature / prior issue.
- Produce a Direction Card.
- Post a public "we are looking" / "needs info" response when appropriate.
- Route to an owner thread or propose a new thread.

Its non-job:

- Deep code review.
- Running merge gate.
- Owning long polling.
- Re-validating every downstream conclusion.

### 2. Worker Thread Owns Lifecycle

Once an issue / PR is assigned to a worker thread, that thread owns the lifecycle until completion or explicit blocker.

For `reportingMode: none`, the worker thread should not report routine status back to the source thread. Instead, it must write closure events:

- public GitHub comment posted
- labels updated
- PR linked
- merge decision recorded
- issue close decision recorded
- intake plan / record / ledger advance completed if applicable

This turns "don't bother the source thread" into a safe contract instead of a silent-drop contract.

### 3. CVO Queue Only Contains Decision Packets

The CVO view should receive value decisions, not raw engineering noise.

Good CVO packet:

```text
#887 is a real product bug: external projects receive Cat Cafe's own port instructions.
Recommendation: route to a dedicated F070 bugfix thread.
CVO decision needed: none; this is a reversible bugfix.
```

Bad CVO packet:

```text
I checked governance-pack.ts, governance-bootstrap.ts, commit 3497d1a9,
three test files, and the current issue body...
```

The evidence still exists, but it belongs behind the card.

### 4. Issue Signals

Add an Issue Signals layer parallel to PR Signals. The missing cases are exactly the current pain:

- reporter adds logs after `needs-info`
- reporter says they will open a PR
- author links a PR
- maintainer asks a follow-up question
- issue is closed/reopened
- labels change from `needs-info` to `accepted`

These should wake the owner thread or update the board, not require the source cat to hold dozens of reminders.

### 5. Closure Guard

Community worker threads should not be allowed to mark themselves done unless the closure checklist is satisfied or explicitly waived.

Suggested default checklist:

- GitHub public comment posted or not-needed reason recorded.
- Labels reflect current state.
- Linked PR / issue references are correct.
- If merged: intake decision recorded.
- If intake needed: ledger record + advance attempted.
- If issue should stay open: open reason recorded.
- If issue should close: close reason recorded and executed.

This directly addresses the "fixed but forgot to say so, next full sync forgets to close issue" failure mode.

## Immediate Behavior Changes Before Product Work

Until the event-bus/read-model upgrade exists, the source Repo Inbox cat should follow stricter operating discipline:

1. Do enough triage to route, not enough investigation to solve, unless Landy explicitly asks to solve in the source thread.
2. For active PRs still under author/cloud review, avoid intervening until a new tracked event indicates it is ready.
3. Use `reportingMode: none` for autonomous community dispatch, but include a closure checklist in the child thread prompt.
4. Do not mention a local teammate in the source thread when a F128 child thread is the chosen route.
5. Present Landy with human-readable Direction Cards first; evidence comes second.
6. Treat issue follow-up tracking as a system gap, not as a reason for the source cat to maintain a pile of hold-ball reminders.

## Candidate Implementation Phases

### Phase A: Design Gate

Decide whether this is:

- F168 reopen: Community Ops Event Bus / Issue Signals
- F141 reopen: Issue lifecycle events
- New feature: Community Event Bus

Recommendation: reopen F168 for the product-level board and split F141/F140 follow-up work as implementation dependencies.

### Phase B: Issue Signals MVP

Extend GitHub repo event handling / reconciliation to include issue comments and issue lifecycle changes.

Deliverable:

- event schema
- dedup / cursor handling
- owner thread wake logic
- focused tests for `needs-info -> reporter comment -> owner thread wake`

### Phase C: Community Read Model

Implement or harden the `CommunityIssueItem` / PR projection model so every community object has a single owner, state, and next action.

Deliverable:

- board/API projection
- manual sync button
- next-owner field
- stale-object detection

### Phase D: Worker Closure Guard

Add a community closure checklist to worker-thread prompts and, ideally, a callback/tool that records closure completion.

Deliverable:

- F128 child prompt template for community work
- `community_closure.completed` event
- test fixture proving a fixed issue cannot disappear without public closure evidence

### Phase E: CVO Direction Card UX

Turn the first-pass triage output into a compact rich card:

- What is it?
- Why does it matter?
- Recommendation
- Owner / route
- Decision needed, if any

## Open Questions For The Next Thread

1. Should the event bus reuse existing TaskSpec / pr_tracking infrastructure, or introduce a dedicated community-event store?
2. Should issue comments be webhook-first, reconciliation fallback, or reconciliation-only in v1?
3. What is the minimum viable "closure event" implementation: tool call, checklist in task state, or GitHub comment parser?
4. Which cat/role should be the default Inbox Narrator?
5. How should F128 proposal approval surface "self-contained community closure" so Landy can trust `reportingMode: none`?
6. Should the source thread ever receive final summaries for autonomous community tasks, or should the board be the only read surface?

## Handoff Recommendation

Give this discussion to Fable5 + a parallel Codex invocation in a new thread.

Suggested thread task:

```text
Use this discussion as problem statement. Produce a design proposal for a Community Ops Event Bus / Issue Signals upgrade.
Do not solve by adding more chat reminders. The target is durable event state + read model + self-contained worker thread closure.
Decide whether to reopen F168, F141, or create a new feature. Include MVP scope, risks, and migration plan.
```

## Source Notes

Internal anchors used:

- F141: GitHub Repo Inbox discovery layer.
- F140: PR Signals tracking layer.
- F168: Community Operations Board and human-dispatcher pain.
- F128: Thread proposal / reportingMode contract.
- F222: Friction signals as structured feedback.
- F227: Event Memory as a nearby pattern for turning high-signal moments into first-class events.

External references:

- Anthropic, "How we built our multi-agent research system": <https://www.anthropic.com/engineering/multi-agent-research-system>
- Anthropic, "Managed agents": <https://www.anthropic.com/engineering/managed-agents>
- Anthropic, "Effective harnesses for long-running agents": <https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents>

[砚砚/GPT-5.5🐾]
