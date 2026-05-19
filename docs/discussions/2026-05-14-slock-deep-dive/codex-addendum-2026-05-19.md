---
doc_kind: research-note
topics: [slock-ai, open-source-teardown, agent-collaboration, cat-cafe-comparison]
created: 2026-05-19
status: draft
source_repo: https://github.com/botiverse/slock
source_package: "@slock-ai/daemon@0.50.0"
authored_by: codex
covers: [source-refresh, comparison, lessons]
---

# Slock.ai vs Cat Cafe - Codex Addendum

## Verdict

Slock is best understood as an **agent collaboration carrier**: it gives agents
channels, DMs, threads, task claims, persistent local workspaces, runtime
drivers, and a daemon/cloud message transport.

Cat Cafe is closer to an **agent quality operating system**: we care less about
"agents can chat in a Slack-like surface" and more about whether collaboration
has durable memory, review gates, skill-triggered workflows, governance, rich
artifacts, and recoverable state.

So the maintainer judgment is: **Slock is strong infrastructure, not a
replacement for our skills/memory/governance model.** We should learn from its
runtime carrier and human-commit UX, but not copy its trust model or prompt
shape.

## Source Refresh

The previous report is based on `@slock-ai/daemon@0.48.0`. I refreshed against:

- Website claim: <https://slock.ai/> says Slock is a real-time platform where
  humans and AI agents work together in channels and DMs; it also claims
  persistent memory and local daemon execution.
- npm latest on 2026-05-19: `@slock-ai/daemon@0.50.0`; package published
  `2026-05-17T17:34:34.445Z`, registry modified
  `2026-05-19T06:41:04.643Z`.
- Local package used for evidence:
  `/Users/lysander/projects/ref/slock-ai-0.50.0/package/`.

Important delta from `0.48.0` to `0.50.0`: the old large MCP chat bridge has
shrunk to a tiny runtime-control bridge. Day-to-day communication has clearly
moved toward the `slock` CLI, while MCP remains for special runtime actions such
as Runtime Profile migration.

## Claim Ledger Delta

| Claim | 0.50.0 evidence | Verdict |
|---|---|---|
| Multi-runtime agents | `driverFactories` still registers `claude`, `codex`, `copilot`, `cursor`, `gemini`, `kimi`, `opencode`. | **TRUE** |
| Task claim before work | System prompt and CLI both require `slock task claim`; failed claim tells the agent to move on. | **TRUE** |
| Persistent memory | Agent startup creates `MEMORY.md` plus `notes/` in the agent data dir; prompt says `MEMORY.md` is the recovery entry point. | **TRUE** |
| Local execution / privacy | Runtime process runs locally, but daemon connects to Slock cloud over WebSocket and package includes trace upload paths. | **PARTIAL**: local agents, not purely local collaboration. |
| MCP integration | `@modelcontextprotocol/sdk` remains, but `dist/chat-bridge.js` now only exposes `runtime_profile_migration_done`. | **PARTIAL**: MCP is no longer the primary chat surface. |
| Human-commit actions | `slock action prepare` posts action cards for human commit: `channel:create`, `agent:create`, `channel:add_member`. | **TRUE** and important. |
| Self-improving intelligence | No code evidence of eval-driven improvement or validated learning loop. | **FALSE** if implied. |

## Architecture Read

Slock's core path is:

```text
daemon websocket wake
  -> AgentProcessManager
  -> runtime driver
  -> local agent process
  -> slock CLI / minimal MCP runtime action
  -> server-side channels/tasks/reminders/actions
```

The strong part is not "AI algorithm". It is the boring but necessary carrier:
process lifecycle, runtime adapters, direct/gated busy delivery, task claim, CLI
transport, attachment handling, reconnect watchdog, and trace/error envelopes.

The weak part is also clear: memory is a file discipline, task quality is mostly
protocol/prompt discipline, and the platform does not prove that agents get
better except by reading their own `MEMORY.md` later.

## Cat Cafe Comparison

| Dimension | Slock | Cat Cafe | Judgment |
|---|---|---|---|
| Collaboration surface | Channels / DMs / threads, close to Slack. | Thread + A2A baton + rich blocks + workspace views. | Slock is easier to explain; Cat Cafe has tighter task semantics. |
| Runtime abstraction | Formal drivers with `probe/spawn/parseLine/buildSystemPrompt`. | Family-specific harnesses, MCP surfaces, skills, L0 prompt. | **Learn**: formalize a runtime driver profile if we keep adding carriers. |
| Task ownership | Task claim is server-checked and conflict-aware. | `@` routing + `hold_ball` + yarn-ball tasks; some discipline is prompt/tool-level. | **Learn**: system-enforced claim is cleaner than prompt-only ownership. |
| Waiting / continuation | Reminders and daemon wake. | `cat_cafe_hold_ball` has bounded wake, single-slot semantics, counters, A2A rules. | We are more explicit about ball ownership; Slock is more productized. |
| Memory | `MEMORY.md` as entry point, optional notes. | `search_evidence`, `graph_resolve`, `list_recent`, session chain, Knowledge Feed. | Slock is simpler; Cat Cafe is more powerful and searchable. |
| Skills / workflows | Prompt playbooks and CLI commands. | Skill-triggered SOPs, guides, quality gates, merge gate, review discipline. | **Do not follow** mega-prompt-only workflow. Our progressive skill loading is the right direction. |
| Human commit UX | `slock action prepare` lets agent draft, human commits under own identity. | Rich blocks / guides / scheduled-task preview, but less unified for resource creation. | **Gap**: typed human-commit cards are worth copying. |
| Permission posture | Claude skip permissions; Codex `danger-full-access`; server scopes exist. | Redis sanctuary, review gates, callback auth, readonly toolsets, permission tools. | **Do not follow** default full-trust runtime posture. |
| Observability | OTel-like traces, runtime error classification/redaction, WebSocket watchdog. | Session chain, invocation detail, digests, telemetry, rich statuses. | **Learn**: runtime error fingerprinting and standard trace vocabulary. |

## What We Should Learn

1. **Runtime driver profile**  
   The four-method shape is good: `probe`, `spawn`, `parseLine`,
   `buildSystemPrompt`. Our family model is richer, but runtime-carrier code
   would benefit from this explicit boundary.

2. **CLI as stable daily command layer, MCP for narrow runtime controls**  
   Slock's direction is pragmatic: chat/task/file operations use `slock` CLI;
   MCP stays for special in-process control such as runtime migration. This
   reduces MCP schema sprawl and avoids every runtime needing identical tool
   discovery behavior.

3. **Human-commit action cards**  
   `slock action prepare` is the best product idea in this refresh. Agent drafts
   a typed action; the human reviews and commits under human identity. This is
   better than asking the human to copy specs into a form.

4. **Runtime Profile migration gate**  
   Before normal inbox handling, Slock can force a one-shot runtime-control
   acknowledgement. This is a useful pattern for carrier migrations, model
   swaps, or prompt contract changes.

5. **Runtime watchdog + error fingerprinting**  
   The 70s inbound watchdog, reconnect backoff, scrubbed runtime diagnostics,
   and error fingerprints are boring but production-grade.

6. **Simple local memory index as a fallback**  
   Even though our memory system is stronger, a tiny always-readable
   `MEMORY.md`-style recovery index can be valuable when semantic tools are
   down or not exposed.

## What We Should Not Follow

1. **Do not overclaim privacy**  
   "Agents run locally" is true. "Full privacy" is too broad when collaboration
   messages and traces go through Slock cloud.

2. **Do not collapse workflow into one giant prompt**  
   Slock's prompt contains communication, tasks, reminders, threads, memory,
   etiquette, onboarding, and action-card guidance. That is explainable for a
   fresh product, but it is not how we should scale Cat Cafe. We should keep L0
   small, skills progressive, and gates executable.

3. **Do not default to full filesystem/runtime trust**  
   `--dangerously-skip-permissions` and `danger-full-access` are convenient for
   demos. Our review/security posture should stay stricter.

4. **Do not treat text memory as knowledge governance**  
   `MEMORY.md` is a good bootstrap file, not a substitute for evidence search,
   graph relations, session replay, or Knowledge Feed confirmation.

5. **Do not optimize only for Slack-like familiarity**  
   Channels are legible, but our differentiator is not "agents in chat"; it is
   recoverable, reviewable, skill-governed collaboration with a living shared
   memory.

## Candidate Lessons

- **Lesson A**: For runtime carrier code, define a formal driver interface
  before adding the next runtime. Runtime differences should be isolated at
  `probe/spawn/parse/standing-prompt`, not leaked into collaboration logic.
- **Lesson B**: Any agent-prepared irreversible or identity-bearing action
  should become a human-commit card: typed payload, server validation, human
  executes under human identity.
- **Lesson C**: Keep MCP for high-value structured tools, but do not force every
  high-frequency chat/task action through MCP when a CLI command layer gives
  better portability across runtimes.
- **Lesson D**: Claims like "local", "private", and "persistent memory" need
  source-level caveats in our teardown reports. Local process execution does not
  imply local-only data flow.

## Bottom Line

If Slock and Cat Cafe are in the same broad category, the split is:

- **Slock**: "Give agents a Slack-like workplace and a runtime daemon."
- **Cat Cafe**: "Make a multi-agent team reliable, reviewable, memorable, and
  emotionally/operationally coherent."

Slock is ahead in productized carrier UX and runtime-driver cleanliness. Cat
Cafe is ahead in memory depth, governance, review/merge discipline, skills, and
shared-state philosophy. The right move is to copy the carrier primitives, not
the whole worldview.

[砚砚/GPT-55🐾]
