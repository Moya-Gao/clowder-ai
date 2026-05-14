---
doc_kind: discussion
topics: [hermes-agent, kanban, multi-agent, project-management, teardown]
created: 2026-05-14
status: draft
source_repo: /Users/lysander/projects/ref/hermes-agent
source_commit: 55ba02bef
source_tag: v2026.5.7
---

# Hermes Agent Kanban 最新特性拆解

## Scope

本稿只拆 Hermes Agent v0.13.0 之后最相关的项目管理能力：

- durable multi-agent Kanban
- triage specifier
- dependency promotion
- worker lifecycle / retry / reclaim
- structured handoff
- `/goal` persistent goal loop

不重复 2026-04-28 Hermes 全量 deep dive 的 skills / RL / gateway 拆解。

## Source Snapshot

- Upstream: `https://github.com/NousResearch/hermes-agent`
- Local ref: `/Users/lysander/projects/ref/hermes-agent`
- Latest fetched `origin/main`: `55ba02bef` (2026-05-13)
- Latest tag seen: `v2026.5.7`
- Official release: `RELEASE_v0.13.0.md`
- Official docs: `website/docs/user-guide/features/kanban.md`, `website/docs/user-guide/features/kanban-tutorial.md`, `website/docs/user-guide/features/kanban-worker-lanes.md`

## Claims Ledger

| Claim | Evidence | Verdict | Caveat |
|---|---|---|---|
| Durable multi-agent board | `hermes_cli/kanban_db.py` SQLite schema: `tasks`, `task_runs`, `task_events`, `task_links`; docs say rows live in `~/.hermes/kanban.db` | Real | Single-host/local-first model, not SaaS project management |
| Multi-project boards | docs describe per-board DB/workspaces/logs and `HERMES_KANBAN_BOARD` isolation | Real | Board isolation is hard; tenant isolation is soft namespace inside board |
| Dependency engine | `create_task(... parents=...)` starts child in `todo`; `claim_task` refuses `ready -> running` if parents are not done | Real | DAG is task-level, not full product/feature dependency model |
| Durable worker handoff | `task_runs.summary` + `metadata`; `build_worker_context()` injects prior attempts and parent results | Strong | Quality depends on workers writing good metadata |
| Crash/retry/reclaim | `claim_expires`, heartbeat, `task_runs` outcomes, failure counter, `release_stale_claims`, zombie handling | Real | Complex surface; many release notes are bug fixes around this exact area |
| Triage specifier | `hermes_cli/kanban_specify.py` turns triage one-liner into Goal/Approach/AC/Out-of-scope and promotes `triage -> todo` | Real but shallow | This is spec expansion, not product strategy or priority decision |
| Hallucination recovery | `complete_task(... created_cards=...)` verifies claimed child cards and records phantom-card events | Real | Mostly protects worker-created card IDs, not general factual correctness |
| `/goal` keeps agent on target | `hermes_cli/goals.py` stores goal per session and asks auxiliary judge DONE/CONTINUE | Real | LLM judge loop, not deterministic proof of goal completion |

## Architecture Map

```text
Human / orchestrator
  -> CLI / dashboard / slash command / kanban_* tools
  -> kanban_db SQLite kernel
      tasks        : title/body/assignee/status/priority/tenant/workspace
      task_links   : parent -> child dependency
      task_runs    : every attempt, summary, metadata, error, outcome
      task_events  : audit stream
      comments     : human/agent discussion
  -> dispatcher loop
      reclaim stale/dead runs
      promote dependency-satisfied todo -> ready
      claim ready task atomically
      spawn `hermes -p <assignee> chat`
  -> worker profile
      env: HERMES_KANBAN_TASK / BOARD / WORKSPACE / RUN_ID / TENANT
      tools: kanban_show / heartbeat / complete / block / comment / create
  -> task_runs.summary + metadata
  -> downstream worker_context
```

## What Is Actually New For Us

### 1. Kanban Is Runtime Coordination, Not Just UI

Hermes treats the board as a local coordination kernel. The dashboard is a lens over durable state; the real feature is the state machine plus dispatcher. This is the strongest input for our project board: do not begin with card UI. Begin with the lifecycle kernel.

### 2. Attempt History Is First-Class

Hermes does not overwrite a task with latest state only. Each claim creates a `task_runs` row. Retry context includes prior run outcome, summary, error, and metadata. This is directly relevant to our eval/tracing vision: "agent performance" should be attached to attempts, not only tasks.

### 3. Structured Handoff Beats Comment Archaeology

`kanban_complete(summary, metadata)` is the primary handoff channel. Downstream tasks read parent summaries and metadata structurally. We should copy this shape: every execution slice needs machine-readable `handoff_metadata`.

### 4. Triage Exists, But It Is Not Product Management Yet

Hermes has a `triage` column and `kanban specify` auxiliary model. It expands a rough idea into Goal / Approach / AC / Out-of-scope. That is useful, but it does not solve:

- source credibility
- priority
- value / urgency / risk scoring
- user vs agent suitability
- accepted / rejected / later decision

So it validates Landy's point: traditional Kanban needs an upstream PM layer. Hermes has the beginning of it, not the full thing.

### 5. Worker Lanes Are a Strong Abstraction

Hermes separates:

- Kanban kernel owns lifecycle truth.
- Worker lane executes one assigned card.
- Reviewer gates "done" by convention.
- External CLI worker lanes are documented but not paved.

This maps well to our "人 / 猫 / 外部 agent" world. Our equivalent should define lane contracts before UI.

## Learn / Do Not Follow

### Learn

- SQLite/local-first board kernel before UI.
- `Task` vs `TaskRun` split.
- Parent-result injection into downstream worker context.
- Retry metadata as a product surface, not hidden logs.
- Worker lane contract with explicit env/tool boundary.
- `triage -> specified -> executable` as a separate transition.
- Dashboard as read/write lens over canonical kernel.

### Do Not Follow Blindly

- Do not equate `triage_specifier` with PM intelligence. It is one-shot spec expansion.
- Do not treat tenant as hard isolation; Hermes itself calls tenant soft.
- Do not rely on worker convention for review gates if our task can change shared code/data.
- Do not start from "multi-agent execution" before deciding what counts as an accepted demand.
- Do not copy CLI-centric ergonomics if our primary workflow is chat + workspace panel.

## Implications For Our New Board

Recommended core object split:

```text
Signal       raw issue / feedback / trace anomaly
Intent       product-readable need with source/evidence/confidence
Decision     accept / reject / clarify / validate / later / human-only / cat-suitable
WorkItem     executable task with owner/AC/dependencies
WorkRun      each attempt by human/cat/agent, with trace and handoff metadata
Outcome      accepted result + review/eval/postmortem summary
```

Hermes's strongest lesson is the `WorkItem -> WorkRun -> structured handoff` part. Our differentiator should be the `Signal -> Intent -> Decision` part plus agent suitability analytics.

## Suggested Synthesis Owner

Use **@opus-47** for the first synthesis draft.

Reason: this is still an abstraction/product-architecture problem, not implementation planning. 47 already framed F049/F076/F121/F150 as reusable pieces and is better suited to produce the first "what are we building" spec. 46 should be the second-pass feasibility reviewer, especially for kernel/state-machine/API boundaries.

## Open Questions For Discussion

1. Do we adopt Hermes's local SQLite board kernel, or start with Redis/SQLite dual-mode because Cat Cafe already has Redis task stores?
2. Is our "triage" an LLM specifier like Hermes, or a stronger Need Audit / PM Decision pipeline?
3. Should execution runs be derived from Cat Cafe traces, or explicitly created like Hermes `task_runs`?
4. Do we support external worker lanes from day one, or only Cat Cafe cats first?
5. Should this be a new repo now, or code-organized-as-new-repo inside Cat Cafe until dogfood stabilizes?
