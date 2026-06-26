---
doc_kind: research-note
topics: [raft, slock-ai, open-source-teardown, agent-collaboration, ax, cat-cafe-comparison]
created: 2026-06-26
status: draft
authored_by: codex-gpt55
source_version: "@botiverse/raft-daemon@0.63.7"
covers: [claims-ledger, architecture-delta, longform-comparison, lessons]
---

# Codex Refresh: Raft 0.63.7 vs Cat Cafe 2026-06-26

This is an independent pass after the 2026-06-26 Opus refresh. The short verdict:

**Raft is no longer just "Slock with more runtimes"; it is becoming an Agent Experience
product layer. Cat Cafe is no longer just "Slock but with better memory"; it is becoming
a consequence-and-eval operating system.**

The two projects overlap at the surface: named agents, shared rooms, task claims, messages,
and runtime adapters. The deeper bets are different:

- **Raft** optimizes the agent-facing room: how an agent notices, sends, gets interrupted,
  logs in, and runs across heterogeneous runtimes.
- **Cat Cafe** optimizes the consequence physics around the room: who holds responsibility,
  what counts as evidence, how mistakes become harness, and how eval closes the loop.

## Scope And Sources

Primary sources used in this pass:

- npm registry: `npm view @botiverse/raft-daemon version dist.tarball time --json`
  returned `0.63.7`, published 2026-06-26 13:56 UTC.
- Local package snapshot:
  `/Users/lysander/projects/ref/raft-daemon-0.63.7/package`.
- Raft official blog:
  - https://raft.build/resources/blog/
  - https://raft.build/resources/blog/is-having-agents-in-the-room-meant-to-be-chaotic/
  - https://raft.build/resources/blog/a-comfortable-ax-for-agent-search/
- Existing project notes:
  - `docs/discussions/2026-05-14-slock-deep-dive/opus-refresh-2026-06-26.md`
  - `docs/discussions/2026-05-14-slock-deep-dive/codex-addendum-2026-05-19.md`
- Cat Cafe current architecture:
  - `docs/content/drafts/longform-002-v0-formal.md`
  - `docs/content/drafts/longform-003-teamact-evolution-v0.md`
  - `docs/content/drafts/longform-004-seed-workflow-distiller.md`
  - `docs/content/drafts/longform-005-convergence-is-a-function-of-consequences.md`
  - F167 / F192 / F208 / F233 / F236 / F245 / F251 / F252 feature docs and architecture cells.

X/Twitter note: I could not independently retrieve a readable X thread body from the
public page. Treat X screenshots/second-hand summaries as weak product-positioning signal,
not architecture evidence.

## Claim Ledger

| Claim | Evidence | Verdict | Cat Cafe relevance |
|---|---|---:|---|
| Slock is now Raft, core daemon package is `@botiverse/raft-daemon` | package name/version in `package.json:2-7`; repo still points to `github.com/botiverse/slock` at `package.json:21-24` | True | Rebrand migration discipline is good: old naming remains as compatibility surface. |
| Runtime set grew to 10 | `chunk-6OMBWTF5.js:1395-1408` lists `claude`, `codex`, `antigravity`, `kimi-sdk`, deprecated `kimi`, `copilot`, `cursor`, `gemini`, `opencode`, `pi` | True | Their runtime surface is now broader than ours as a packaged product. |
| CLI is now the agent chat transport | Codex/Kimi/Pi drivers all declare `communication.chat = "slock_cli"` (`chunk-6OMBWTF5.js:6278-6281`, `8106-8109`, `9132-9135`) | True | Confirms MCP-to-CLI was not cosmetic; daily chat moved to a common command surface. |
| Per-agent credentials are carried by wrapper files/env, not typed MCP calls | `prepareCliTransport` writes token/proxy files, creates `slock` and `raft` wrappers, prepends wrapper dir to `PATH`, and strips raw credential env (`chunk-6OMBWTF5.js:4480-4634`) | True | Solves cross-runtime setup but weakens typed client-side schema. Good for simple chat commands, not for our structured knowledge/eval tools. |
| In-process SDK runtimes exist | Kimi SDK session has no PID, calls SDK session directly, and uses `session.steer()` for busy input (`chunk-6OMBWTF5.js:7854-7956`); Kimi/Pi drivers throw on child-process spawn (`8135-8137`, `9164-9166`) | True | This is an important runtime axis we should model explicitly. |
| Busy delivery is runtime-modeled | Runtime descriptor records lifecycle, idle/busy input, in-flight wake, busy delivery, and post-turn behavior (`chunk-6OMBWTF5.js:9194-9215`) | True | Strongest architecture lesson besides Held Draft. |
| Content-free inbox notification is first-class | System prompt says new messages may be delivered as content-free notices and should be checked at natural breakpoints (`chunk-6OMBWTF5.js:2477-2487`, `2620-2643`) | True | Overlaps with F167/F225, but Raft's UX language is cleaner. |
| Held Draft/freshness hold exists in code, not just blog | Held envelope returns `state:"held"`, `reason:"newer_messages_available"`, and actions `check_messages/send_draft/send_anyway` (`chunk-6OMBWTF5.js:133-198`); CLI saves draft on held send (`dist-7ZEXJWIW.js:18286-18428`) | True | This is the most directly learnable feature. |
| External agent protocol exists | External agent schemas define protocol version, comms modes, isolation, lifecycle states, wake proof levels (`chunk-6OMBWTF5.js:1166-1301`) | True | Useful if Cat Cafe wants self-hosted external cats/plugins beyond the current roster. |
| Raft still chooses high-permission runtime defaults | Codex driver launches with `approvalPolicy:"never"` and `sandbox:"danger-full-access"` (`chunk-6OMBWTF5.js:6298-6308`) | True | Do not copy. This trades product smoothness for a safety posture we explicitly reject. |
| Raft's memory layer is still file/prompt-heavy | Prompt instructs agent to read `MEMORY.md` at startup (`chunk-6OMBWTF5.js:2492-2498`, `2513-2518`) | True | Recovery aid, not equivalent to evidence graph + eval-fed dossier. |

## What Raft Is Actually Doing Now

### 1. Agent Experience, Not Just Agent Messaging

The official "chaotic room" post frames the core problem as a mismatch between
turn-based agents and continuous human rooms. Its two surfaces are:

- **Agent inbox**: pending messages become queryable items instead of being pushed into
  the working context.
- **Held draft**: outgoing messages carry a freshness marker; if the room moved, the
  server holds the send and gives the agent explicit choices.

The code confirms both ideas. The prompt teaches content-free inbox notices and natural
breakpoint checks; the send CLI stores held drafts and exposes `--send-draft` / `--anyway`.

That is real AX. It is not just "agent uses Slack"; it is a surface designed around how
models perceive, decide, and commit actions.

### 2. Runtime Capability Becomes Data

Raft has moved from "each driver has some behavior" toward a capability descriptor:

```text
transport, lifecycle, stdout, input.initial, input.idle, input.busy,
readiness, turnBoundary, inFlightWake, busyDelivery, postTurn
```

That descriptor is the right shape. It separates "this runtime exists" from "this runtime
can accept a busy wake", "this runtime must be gated", and "this runtime is child process
vs native SDK session".

Cat Cafe has comparable facts scattered across runtime code, feature docs, and L0 mode
rules. We should not let those remain as folklore.

### 3. CLI Won Because Their Hot Path Is Simple And Per-Agent

The earlier MCP question becomes clearer in 0.63.7:

- Each spawned Raft agent needs agent-specific identity and credentials.
- Every runtime has a different MCP config entrypoint.
- The daily communication tools are simple: send/check/read/task-claim/update.

So Raft moved the hot path to a per-agent `raft`/`slock` wrapper. The wrapper carries
identity through env/token files, and all runtimes call the same command.

This is sensible for Raft. It does **not** imply Cat Cafe should move rich tools to CLI.
Our high-value tools are schema-bearing state operations: evidence search, graph resolve,
rich blocks, verdict publish, hold-ball wake contracts, and grounding checks. Losing MCP
schemas there would be a regression.

The right takeaway for us is narrower:

> CLI is good as a cross-runtime common denominator for simple, high-frequency chat
> actions. MCP stays right for structured knowledge, eval, state, and governance actions.

## What Changed On The Cat Cafe Side Since The May Comparison

Opus's "we are stronger in memory and quality gates" is directionally true but now too
coarse. The last 30+ days changed the comparison baseline:

- **F208 Capability Profile Routing** made names into evolving capability dossiers, not
  static labels. It explicitly rejects algorithmic central dispatch; current holder uses
  profile + task + evidence to route (`F208:51-76`).
- **F233 Ball Custody** turned responsibility into append-only event-sourced state. The
  event log is canonical and the projection is rebuildable (`ball-custody.md:28-49`).
- **F236 Anchor-First Context Entry** moved from "tool output is text" to "tool output is
  an agent-facing surface with preview + drilldown + telemetry" (`F236:20-47`, `60-80`).
- **F192 Harness Eval** made harness behavior subject to verdict handoff and re-eval, not
  just dashboards (`harness-eval.md:52-74`).
- **F245 Friction Eval** closed the loop from paw-feel/cancel/user-feedback/eval friction
  into clustered rollups and actionable follow-up (`F245:23-40`, `66-86`, `132-138`).
- **F167 Phase O/P** added claim grounding and conditional `hold_ball(wakeWhen)` for local
  long commands (`F167:800-838`, `1020-1066`).
- **F252 Story Player** uses the F233 trajectory projection as a story renderer, not a
  separate demo script (`F252:40-58`).

In longform terms:

- Longform 002 says our core is capability profiles + shared state + eval feedback, not
  role agents (`longform-002:37-43`, `128-140`).
- Longform 003 says TeamAct needs State / Owner / Action / Evidence / Verdict / Route,
  plus explicit termination conditions (`longform-003:156-179`).
- Longform 004 says the moat is delta learning + reference eval + validator surface, not
  generic baseline knowledge (`longform-004:49-60`, `101-109`).
- Longform 005 says convergence is a function of consequences: ball custody, ledger,
  artifact obligations, and live fitness function (`longform-005:41-69`, `117-149`).

That means the comparison should no longer be "Raft communication vs Cat Cafe memory".
It should be:

| Axis | Raft 0.63.7 | Cat Cafe 2026-06-26 |
|---|---|---|
| Product surface | Strong: agent-native workspace, blogged AX theory, SaaS pricing | Internal-first; Story Player just starting to externalize workflow |
| Runtime breadth | Strong: 10 runtimes, child process + SDK sessions + external agents | Strong for our roster, less productized as runtime capability descriptors |
| Agent attention UX | Strong: inbox, content-free notices, Held Draft | Partial: hold_ball/event callbacks, anchor-first; weaker outgoing freshness UX |
| Responsibility physics | Task claim + prompt rules | Stronger: ball custody event log, TeamAct, claim grounding, merge/review gates |
| Knowledge/memory | `MEMORY.md` + prompt recovery | Stronger: evidence search, graph resolve, dossiers, eval feedback |
| Eval loop | Product analytics + some code-level traces | Stronger: F192 domains, verdict handoff, friction rollups, anchor-first sunset |
| Permission model | Product-smooth, high trust (`danger-full-access`) | Stronger safety discipline; Redis 6399, review gate, CVO boundaries |

## What We Should Learn

### 1. Side-Effect Freshness Hold

This is the big one.

Raft holds an outgoing send if newer room state exists. It preserves the draft and forces
an informed choice: check messages, revise, send draft, send anyway, or stay silent.

Cat Cafe has pieces of this:

- F233 knows ball state.
- F167 knows ownership / wait / callback grounding.
- F236 knows preview/drill freshness and returned context boundaries.
- Message/callback routes already have source timestamps and message IDs.

But we do **not** yet have a universal pre-side-effect freshness envelope:

```text
Attempting to @route / post_message / publish_verdict / hold_ball
while modelSeenSeq < threadLatestSeq
→ hold side effect
→ return newer anchors + available actions
→ let the cat choose: read latest / revise / send anyway where allowed
```

This is not "more prompt". It is a state machine around side effects. It fits Longform 005:
the system should make the consequence boundary explicit at the moment of action.

### 2. Runtime Capability Descriptor

We should steal the shape, not necessarily the code. A Cat Cafe runtime descriptor should
make these facts explicit:

- carrier: interactive CLI / `-p` / bg-cron / cloud / connector
- tool-call availability
- can receive busy wake?
- can receive content-free notice?
- can run merge-gate?
- can receive cloud review callback?
- turn boundary: process exit / parsed event / external callback
- permission/sandbox posture
- safe background-command policy

This would reduce mode myths like "`-p` means lower capability" and make F167 Phase P /
L0 staging rules data-backed.

### 3. Content-Free Inbox Notice

Raft's exact UX is clean: "something changed, bodies withheld, check at a natural
breakpoint." Cat Cafe has event-driven wake and hold_ball, but our delivery language is
more governance-heavy. For busy agents, a content-free notice could be better than dumping
messages or forcing immediate pivot.

This should integrate with F233 ball projection and F225 context management, not bypass
them.

### 4. External Agent Login / Profile-Scoped Credentials

Raft's external agent protocol and agent-side integration login are worth watching:
profile-scoped/session-scoped isolation, wake proof levels, lifecycle states, and service
login through agent profiles.

Cat Cafe's current roster model is stronger for trusted household cats. If we want
third-party/self-hosted contributors later, Raft's external-agent contract is a better
starting point than ad hoc "drop a token in env".

### 5. Product Packaging Of AX

Their "Agent Experience" vocabulary is good. It turns hidden implementation taste into a
product-facing thesis. We have implemented several AX-grade surfaces already, especially
F236, but our story is still buried in feature docs. F252 can become the bridge.

## What We Should Not Copy

- **Do not move structured Cat Cafe tools wholesale to CLI.** CLI is good for simple chat
  verbs; MCP remains the right contract for schema-rich state operations.
- **Do not copy the permission posture.** `danger-full-access` and no approvals may be
  acceptable for demo velocity; it is not our safety baseline.
- **Do not collapse memory into `MEMORY.md`.** File memory is useful for runtime recovery,
  but not a substitute for evidence graph, search, provenance, and eval-fed profiles.
- **Do not centralize routing into algorithmic dispatch.** F208 already made the correct
  call: give profile data, not conclusions.
- **Do not copy "agent as fractional seat" as worldview.** It may be SaaS pricing logic,
  but it conflicts with Cat Cafe's team/identity philosophy.

## Correction To The Current Thread Takeaway

Opus's Raft refresh is solid on Raft-side deltas: rebrand, 10 runtimes, SDK sessions,
external agents, CLI transport, Held Draft/blog AX.

The part I would sharpen is the Cat Cafe-side comparison. If the comparison is based on
May 19 assumptions, it underweights:

- F233 ball custody as a canonical responsibility ledger.
- F236 anchor-first as agent-facing AX plus eval, not merely token saving.
- F245 friction eval as a full feedback-to-harness loop.
- F208 dossiers as a stronger form of "agents need names".
- F252 as the first public product surface for real multi-thread collaboration.
- Longform 005's consequence physics as the real moat.

So the accurate sentence is:

> Raft is ahead in productized agent-room UX and runtime abstraction; Cat Cafe is ahead in
> consequence physics, eval, governance, and learning loops. The most valuable cross-pollination
> is to bring Raft's Held Draft/runtime-descriptor ideas into Cat Cafe's ball-custody/eval world.

## Candidate Follow-Up Feature Seeds

1. **Fxxx Side-Effect Freshness Gate**
   - Owner cell: ball-custody + callbacks/message routes.
   - Trigger: `post_message`, `@route`, `publish_verdict`, `hold_ball`, review/merge verdict surfaces.
   - Output: held envelope with newer anchors + available actions.
   - Eval: stale-send prevented, false-hold rate, send-anyway rate, rollback incidents.

2. **Fxxx Runtime Capability Registry**
   - Owner cell: runtime/harness mode.
   - Data: per runtime/mode descriptor inspired by Raft's `descriptorFromDriver`.
   - Consumers: L0 staging, hold_ball wakeWhen, merge-gate, cloud review callback, background command guard.

3. **Fxxx Busy Inbox Notice**
   - Owner cell: ball-custody + context management.
   - Output: content-free pending signal, no bodies unless the cat drills.
   - Boundary: must not become "silent unbounded wait"; integrate with F167 route rules.
