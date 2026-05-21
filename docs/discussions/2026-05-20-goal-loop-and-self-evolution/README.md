---
title: Goal Loop and Self-Evolution Notes
date: 2026-05-20
status: discussion
authors:
  - 砚砚/GPT-5.5
source:
  thread: Hermes Agent / self-evolution discussion
---

# Goal Loop and Self-Evolution Notes

## 0. User Question

Landy asked whether `/goal` is a form of reflective evolution:

> Does it analyze failure causes from execution traces, then optimize prompts,
> tool descriptions, or skills? What task can be defined as a goal if the
> validation function is also decomposed by the agent?

This note records the code/documentation evidence from Codex CLI and Claude Code,
then extracts the implication for Cat Cafe.

## 1. Evidence Snapshot

### Codex CLI

- Local ref path: `/Users/lysander/projects/ref/codex-cli`
- Checked commit: `0b4f86095c8005d8f74e9c62b971d72c1670aa88`
- Commit date: `2026-05-20 18:01:22 -0700`
- Installed CLI checked: `codex-cli 0.131.0`

Key files:

- `codex-rs/features/src/lib.rs`
- `codex-rs/state/src/model/thread_goal.rs`
- `codex-rs/state/src/runtime/goals.rs`
- `codex-rs/core/src/goals.rs`
- `codex-rs/core/templates/goals/continuation.md`
- `codex-rs/core/src/tools/handlers/goal_spec.rs`
- `codex-rs/tui/src/chatwidget/slash_dispatch.rs`
- `codex-rs/tui/src/app/thread_goal_actions.rs`

### Claude Code

- Installed CLI checked: `claude 2.1.146`
- Official docs checked: `https://code.claude.com/docs/en/goal`
- Local help confirms `--permission-mode plan` and cloud `ultrareview`, but the
  `/goal` semantics were taken from the official Claude Code goal docs.

## 2. Codex `/goal` Shape

Codex has a real runtime feature, not just a prompt convention:

- `Feature::Goals` is stable and default-enabled. Its description is:
  "persisted thread goals and automatic goal continuation".
- `ThreadGoal` is persisted state with:
  `objective`, `status`, `token_budget`, `tokens_used`, `time_used_seconds`,
  `created_at`, and `updated_at`.
- TUI slash command supports `/goal`, `/goal clear`, `/goal edit`, `/goal pause`,
  and `/goal resume`.
- The model can see three tools when the feature and host context allow it:
  `get_goal`, `create_goal`, `update_goal`.
- `update_goal` is deliberately narrow: the model may only mark the goal
  `complete` or `blocked`. Pause/resume/budget-limit/usage-limit are controlled
  by user or system.
- Runtime may inject hidden `<goal_context>` user fragments to continue an active
  goal when the thread is idle.

Important implementation detail: Codex treats the objective as untrusted user
data. The continuation template tells the model to use worktree/external state as
authoritative, audit every requirement before completion, and only call
`update_goal(status="complete")` when current evidence proves completion.

Verdict: Codex `/goal` is a persisted long-running objective state machine with
budget accounting and automatic continuation. It is not knowledge self-evolution.

## 3. Claude Code `/goal` Shape

Claude Code official docs describe `/goal` as a higher-level wrapper around Stop
hooks:

- User sets a completion condition.
- After each turn, Claude Code invokes a lightweight evaluator model.
- The evaluator sees the goal and conversation transcript, then answers yes/no.
- If no, the failure reason is fed back into the next Claude turn.
- If yes, the goal is cleared.
- The evaluator has no file-system, tool, or command access; it can only judge
  what is visible in the transcript.
- The mechanism is session-scoped and invisible in the normal transcript unless
  the user enables debug logging.

Verdict: Claude Code `/goal` is an evaluator loop. Its strongest design choice is
separating "worker" and "completion judge". Its hard boundary is that the judge
does not observe reality directly; it observes the transcript.

## 4. What `/goal` Is Not

Neither implementation is GEPA-style prompt evolution.

`/goal` does not:

- mutate skill files,
- rewrite tool descriptions,
- optimize system prompts,
- run A/B tests,
- keep success-rate ledgers for future prompt selection,
- promote a lesson into a stable skill.

It may generate useful failure signals, but those signals only become
self-evolution after a separate knowledge pipeline turns them into a candidate,
reviews them, validates them, and activates them.

Short version:

```text
/goal = execution closure
self-evolution = knowledge mutation with validation and governance
```

## 5. What Tasks Can Be Goals?

A task is a good `/goal` only if its completion can be proven from observable
evidence available to the evaluator or explicitly delegated to the right judge.

Good goal:

```text
Fix failing test X; goal is complete when command Y passes and changed files
match requirement Z.
```

Borderline goal:

```text
Make this PPT good enough for Landy.
```

This can only be a goal after the subjective part is converted into explicit
criteria or a CVO review gate:

```text
Produce deck v1, run visual QA checklist, then ask Landy for acceptance.
```

Bad goal:

```text
Have X make 1,000,000 by stock trading.
```

This is not a valid autonomous `/goal` completion condition:

- reward is delayed, noisy, and market-dependent;
- the agent cannot safely observe or control the full real-world state;
- risk tolerance and irreversible financial decisions belong to the user/CVO;
- a short-term profit outcome does not prove the process was good;
- a loss does not necessarily prove the analysis was bad.

It can be decomposed into bounded goals:

- build a research memo,
- define risk constraints,
- backtest a strategy,
- produce a decision checklist,
- ask CVO to approve any real trade.

The actual "earn 1,000,000" target is an external life/financial outcome, not an
agent runtime goal.

## 6. Who Owns the Validation Function?

The evaluator must match the task type.

| Task type | Valid evaluator | Example evidence |
| --- | --- | --- |
| Objective engineering | machine / CI / tests | command output, diff, runtime behavior |
| Professional judgment | peer expert | architecture review, code review, design review |
| Subjective value | CVO / user | explicit approval, preference, decision record |
| Real-world irreversible outcome | CVO + external system | broker state, legal/financial signoff |

If the agent both decomposes the validation function and judges success alone,
the system is vulnerable to reward hacking:

- narrowing the scope,
- redefining success around what was already done,
- treating weak evidence as proof,
- stopping because the answer looks plausible.

Codex tries to fight this by telling the model to preserve scope and audit every
requirement against current evidence. Claude Code fights it by using a separate
small evaluator. Neither fully solves subjective or real-world goals.

## 7. Cat Cafe Implication

Cat Cafe should treat `/goal` as a runtime closure primitive, not as the
knowledge-evolution layer.

Recommended shape:

```yaml
goal:
  objective: concrete end state
  non_goals: what must not be silently redefined
  success_criteria: observable criteria
  evidence_sources: files / commands / UI / docs / human gate
  evaluator:
    type: machine | peer_cat | cvo | external
    owner: explicit judge
  budget:
    tokens: optional
    time: optional
  stop_states:
    - complete
    - blocked
    - budget_limited
    - needs_cvo
  learning_policy:
    record_failure_pattern: true
    create_skill_candidate: only_after_repeated_validated_pattern
```

Runtime loop:

```text
GoalSpec
  -> execute one turn
  -> collect real evidence
  -> evaluator judges completion
  -> inject failure reason / next constraint
  -> continue or stop
```

Knowledge loop:

```text
repeated goal failures or successes
  -> candidate lesson / skill draft
  -> review gate
  -> validated activation
  -> later stale / regression audit
```

The key separation:

- `/goal` keeps work moving until an end state is proven.
- self-evolution changes future behavior only after evidence-backed governance.

## 8. Current Position

Codex gives us the stronger state machine:

- persistent objective,
- explicit statuses,
- budget accounting,
- automatic continuation,
- model-visible goal tools.

Claude Code gives us the cleaner evaluator split:

- worker model does work,
- evaluator model checks transcript,
- no direct self-declaration of success without a second pass.

Cat Cafe should combine the useful pieces but add our missing layer:

```text
evaluation subject routing = machine / peer cat / CVO / external
```

That routing is the difference between "agent says it is done" and "the right
judge can prove it is done".
