---
feature_ids: [F210]
related_features: [F089, F198, F210]
topics: [antigravity-cli, agy, interactive-cli, local-api, carrier-decision]
doc_kind: decision
created: 2026-06-01
---

# F210 Phase G Interactive Carrier Decision — AGY CLI 1.0.3

## Environment

| Item | Value |
|------|-------|
| Date | 2026-06-01 |
| Platform | macOS darwin_arm64 |
| Installed AGY | `/Users/lysander/.local/bin/agy` |
| AGY version | `1.0.3` |
| HOME used | real user HOME, already keyring-authenticated |
| Selected CLI model | `Gemini 3.5 Flash (High)` |

## Why

AC-G6 asks whether Cat Cafe should build an F198-like interactive AGY carrier.
The earlier AGY 1.0.1 probe found a promising local language-server API, but
only read-only methods were proven. This refresh tests AGY 1.0.3 enough to
decide whether Cat Cafe can safely ship that local API as a user-facing
interactive bridge, or must reject it and keep PTY/tmux as a bounded manual
fallback.

## Commands

```bash
PATH="$HOME/.local/bin:$PATH" agy --version
PATH="$HOME/.local/bin:$PATH" agy --help

PATH="$HOME/.local/bin:$PATH" agy \
  --log-file /tmp/cat-cafe-f210-acg6-api-probe.log \
  --add-dir /Users/lysander/projects/relay-station/cat-cafe \
  --prompt-interactive "Reply exactly CAT_CAFE_AC_G6_READY and then wait for the next input."
```

The live run opened:

- HTTPS/gRPC port: `55281`
- HTTP/Connect port: `55282`
- conversation / cascade id: `a7209261-6377-4c58-94d1-1a7003daadef`
- trajectory id: `6a4fee15-cd84-4ffb-8559-9f336c5e0eeb`

Local HTTP/Connect probes then called
`/exa.language_server_pb.LanguageServerService/<method>` with sanitized JSON
payloads.

## Findings

| Question | Finding | Evidence |
|----------|---------|----------|
| Does AGY 1.0.3 still expose the local language-server API? | Yes. Interactive startup logs the random HTTP/Connect port and the read-only methods remain callable. | `GetStatus`, `GetConversationMetadata`, `GetAllCascadeTrajectories`, `GetCascadeTrajectory`, and `GetCascadeTrajectorySteps` responded on port `55282`. |
| Which id does trajectory read use? | `GetCascadeTrajectory` / `GetCascadeTrajectorySteps` require `cascadeId`, which equals the conversation UUID. Supplying `conversationId` fails. | `{"cascadeId":"a720..."}` returned steps; `{"conversationId":"a720..."}` returned `trajectory not found`. |
| Which id does idle wait use? | `WaitForConversationFullyIdle` requires `conversationId`, not `cascadeId`. | `{"conversationId":"a720..."}` returned `{}`; `{"cascadeId":"a720..."}` returned `conversation_id is required`. |
| Can the API stream structured state updates? | Partially yes. `StreamAgentStateUpdates` works only with Connect JSON framing and `conversationId`; plain JSON returns `415`. | A framed `application/connect+json` request returned a state update containing steps, status, model usage, and planner response text. |
| Are the older stream endpoints usable? | No. `StreamUserTrajectoryReactiveUpdates` is deprecated and `StreamCascadeReactiveUpdates` reports deprecated reactive state. | Connect-framed calls returned `unimplemented: user trajectory reactive updates are deprecated` and `reactive state is deprecated`. |
| Can Cat Cafe send a follow-up user message through the API? | Not safely proven. `SendUserCascadeMessage` requires `cascadeId` and can create a user step, but the tried schemas all failed before model execution. | `cascadeId + items`, `cascadeId + items + requestedModel`, and `cascadeId + items + userConfig` created steps, then failed with `neither PlanModel nor RequestedModel specified`. |
| Can the API-level model selector be used as production routing? | No. The stream exposes `requestedModel: MODEL_PLACEHOLDER_M132` for the CLI-created turn, but no successful API-created turn accepted an explicit model config. | Successful initial turn was created by the CLI UI path, not by a proven API write path. Profile `settings.json` remains the only production setter. |
| Can cancellation semantics be proven? | No. Since an API-created active turn could not be started successfully, calling cancel methods would not prove a real send/stream/cancel lifecycle. | `CancelCascadeInvocation`, `CancelCascadeSteps`, and `ForceStopCascadeTree` are present in the binary, but no successful API-created invocation existed to cancel. |

## Decision

Cat Cafe must not ship AGY 1.0.3's local language-server API as the production
interactive carrier.

The local API is useful for observation and future research: it can expose
metadata, trajectory steps, model usage, MCP state, and a structured
`StreamAgentStateUpdates` stream when called with the correct Connect envelope.
It is not a safe carrier contract because write semantics are not fixture-backed,
identifier semantics are split across methods, older stream methods are
deprecated, model selection cannot be proven from an API-created turn, and the
surface is undocumented and version-unstable.

The production path remains:

1. `agy --print` through `GeminiAgentService`.
2. Per-cat `agyProfile` HOME/settings/trusted-workspace sandbox.
3. Runtime-owned `--dangerously-skip-permissions` only after sandbox proof.
4. Post-run selected-model verification from AGY logs.

## PTY / tmux Fallback Boundary

PTY/tmux is allowed only as an observation or manual takeover fallback.

Allowed:

- Launch or attach to a real `agy` TUI for a human-supervised rescue session.
- Capture the AGY log file, real conversation UUID, and resume command.
- Use TUI output to help an operator understand current state.
- Use local API read/stream endpoints as optional observability during the same
  manual session.

Not allowed:

- Parse alternate-screen ANSI output into Cat Cafe `AgentMessage` / tool events
  as if it were a durable protocol.
- Use `agy --continue` for deterministic Cat Cafe thread routing.
- Inject `--dangerously-skip-permissions` against the user's shared real HOME.
- Claim a per-call model selector from local placeholder ids.
- Start unattended write/send flows through the local API until a future spike
  proves send, stream, cancel, and model-select together under a version guard.

## Implications For Phase G

- AC-G6 closes by explicit rejection of the current structured local API as a
  production carrier, with the PTY/tmux fallback boundary documented above.
- AC-G2 remains open. This decision does not prove live per-profile Opus /
  Gemini 3.1 Pro / Gemini 3.5 Flash runs or user-facing profile exposure.
- Future AGY carrier work should prefer a documented ACP/session API if Google
  ships one. If the local language-server API is revisited, the minimum new gate
  is a successful API-created turn with structured state streaming, real cancel,
  and verified selected model under the same version.
