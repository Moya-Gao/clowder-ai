---
feature_ids: [F210]
related_features: [F089, F198, F210]
topics: [antigravity-cli, agy, interactive-cli, local-api, model-selection, phase-g]
doc_kind: recon
created: 2026-05-23
---

# F210 Phase G Interactive/API Probe — AGY CLI 1.0.1

## Environment

| Item | Value |
|------|-------|
| Date | 2026-05-23 |
| Platform | macOS darwin_arm64 |
| Installed AGY | `/Users/lysander/.local/bin/agy` |
| AGY version | `1.0.1` |

## Why

The CVO asked whether AGY can be integrated like F198's Claude Code rescue path:
not just one-shot `--print`, but an interactive carrier with session continuity,
model selection, and Hub observability.

F198's successful path was not raw terminal key simulation. It found a first-party
daemon/control plane (`claude --bg` plus jsonl state/timeline/transcript files).
For AGY, this probe checks whether an equivalent control plane exists before
falling back to PTY/tmux screen scraping.

## Commands

```bash
PATH="$HOME/.local/bin:$PATH" agy --help
PATH="$HOME/.local/bin:$PATH" strings -n 8 "$(command -v agy)" \
  | rg -i "agentapi|ANTIGRAVITY_LS_ADDRESS|ANTIGRAVITY_CSRF_TOKEN|ANTIGRAVITY_CONVERSATION_ID|LanguageServerService"

PATH="$HOME/.local/bin:$PATH" agy \
  --log-file /tmp/cat-cafe-agy-pty-probe.log \
  --dangerously-skip-permissions \
  --add-dir /Users/lysander/projects/relay-station/cat-cafe \
  --prompt-interactive "Reply exactly AGY_PTY_PROBE_OK, then wait for my next input."

PATH="$HOME/.local/bin:$PATH" agy \
  --log-file /tmp/cat-cafe-agy-live-api-probe.log \
  --dangerously-skip-permissions \
  --add-dir /Users/lysander/projects/relay-station/cat-cafe

curl -sS -X POST -H 'Content-Type: application/json' --data '{}' \
  http://127.0.0.1:<http_port>/exa.language_server_pb.LanguageServerService/GetStatus
curl -sS -X POST -H 'Content-Type: application/json' --data '{"conversationId":"<uuid>"}' \
  http://127.0.0.1:<http_port>/exa.language_server_pb.LanguageServerService/GetConversationMetadata
curl -sS -X POST -H 'Content-Type: application/json' --data '{}' \
  http://127.0.0.1:<http_port>/exa.language_server_pb.LanguageServerService/GetCascadeModelConfigData
curl -sS -X POST -H 'Content-Type: application/json' --data '{}' \
  http://127.0.0.1:<http_port>/exa.language_server_pb.LanguageServerService/GetAvailableModels
curl -sS -X POST -H 'Content-Type: application/json' --data '{}' \
  http://127.0.0.1:<http_port>/exa.language_server_pb.LanguageServerService/GetMcpServerStates
```

## Findings

| Question | Finding | Evidence |
|----------|---------|----------|
| Can AGY interactive mode be driven from a PTY? | Yes. `agy --prompt-interactive` accepted an initial prompt and produced `AGY_PTY_PROBE_OK`. It exits cleanly after double Ctrl-D and prints a resume command. | PTY run with `/tmp/cat-cafe-agy-pty-probe.log`; terminal output showed `Resume: agy --conversation=<uuid>` |
| Is PTY output suitable as the primary Cat Cafe carrier? | No. It is an alternate-screen ANSI UI, not an event stream. It is viable for F089-style observation/manual takeover, but parsing it as the main protocol would be fragile. | PTY captured cursor control, spinner redraws, completion UI, and statusline text interleaved with answer text |
| Does AGY expose a hidden local control plane? | Yes. Every interactive and print run starts a localhost language server with HTTPS/gRPC and HTTP ports. | Log lines: `Language server listening on random port ... for HTTPS (gRPC)` and `... for HTTP` |
| Is that control plane callable with plain HTTP/Connect JSON? | Partially yes. Read-only methods such as `GetStatus`, `GetConversationMetadata`, `GetCascadeModelConfigData`, `GetAvailableModels`, and `GetMcpServerStates` respond over the logged HTTP port. | `curl` to `/exa.language_server_pb.LanguageServerService/GetConversationMetadata` returned metadata for a known conversation |
| Does the control plane expose model catalog details? | Yes, but not yet as a proven per-invocation selector. `GetCascadeModelConfigData` and `GetAvailableModels` return labels, model keys, placeholder ids, quota fractions, and reset times. | Local responses listed Opus 4.6, Gemini 3.1 Pro, Gemini 3.5 Flash, Sonnet 4.6, and GPT-OSS 120B entries |
| Are the model ids stable enough to wire profiles immediately? | Not yet. The two local model endpoints expose overlapping but not identical ids for some labels, so Cat Cafe must validate which id is accepted by a message/session API before profile routing. | Example: model selector config and available-model map disagreed for at least one Gemini 3.1 Pro high placeholder id |
| Does `agentapi` exist? | Yes internally, but not as a documented top-level CLI subcommand. The installed `~/.gemini/antigravity-cli/bin/agentapi` wrapper calls `AGY agentapi`; outside an injected AGY environment it falls back into the normal TUI path. | Binary strings show `agentapi.newConversationHandler`, `getConversationMetadataHandler`, `ANTIGRAVITY_LS_ADDRESS`, `ANTIGRAVITY_CSRF_TOKEN`, `ANTIGRAVITY_CONVERSATION_ID`; `agy help agentapi` returns unknown subcommand |
| Can Cat Cafe send/stream messages through the local API yet? | Not proven. `SendUserCascadeMessage` exists, but an empty request returns `trajectory not found`, so request schema, conversation lifecycle, and stream semantics still need a dedicated spike. | `curl` to `SendUserCascadeMessage` with `{}` returned a server error without creating a useful turn |
| Can the local API inspect MCP state? | Yes. `GetMcpServerStates` returns configured MCP server specs, readiness, and tool schemas. | Local response included MCP server states and tool schema entries |

## Model Catalog Snapshot

Local model endpoints exposed the following candidate profile surfaces during this
probe. These are not yet accepted Cat Cafe selector ids.

| Label / key | Local model id | Notes |
|-------------|----------------|-------|
| `Claude Opus 4.6 (Thinking)` / `claude-opus-4-6-thinking` | `MODEL_PLACEHOLDER_M26` | Vertex id surfaced as `claude-opus-4-6@default` |
| `Claude Sonnet 4.6 (Thinking)` / `claude-sonnet-4-6` | `MODEL_PLACEHOLDER_M35` | Vertex id surfaced as `claude-sonnet-4-6@default` |
| `Gemini 3.1 Pro (Low)` / `gemini-3.1-pro-low` | `MODEL_PLACEHOLDER_M36` | Appears consistently in both endpoints |
| `Gemini 3.1 Pro (High)` / `gemini-3.1-pro-high` | endpoint mismatch observed | Must validate before wiring; selector config and available-model map did not fully agree |
| `Gemini 3.5 Flash (Medium)` / `gemini-3.5-flash-low` | `MODEL_PLACEHOLDER_M20` | Product label says Medium while key says low |
| `Gemini 3.5 Flash (High)` / `gemini-3-flash-agent` | `MODEL_PLACEHOLDER_M132` | Product label and key naming do not match intuitively |

## Decision

If Cat Cafe needs an F198-like AGY carrier, the preference order should be:

1. **Supported ACP or documented model/session API** if AGY ships one.
2. **Local language-server HTTP/Connect API** if a follow-up spike proves
   message send, update stream, model selection, and cancellation semantics.
3. **`agy --print` with isolated profile settings** as the current practical
   headless path.
4. **PTY/tmux interactive wrapper** only as a rescue/oversight fallback, because
   the screen protocol is ANSI UI rather than structured events.

## Implications For Phase G

- The internal local API is now the best F198-like lead; Phase G should not stop
  at PTY screen scraping.
- Model profile work should first prove either a valid API-level selector or a
  per-profile `settings.json` sandbox. Candidate ids from the model catalog are
  evidence for the next spike, not production routing ids.
- A future API carrier must still use `--dangerously-skip-permissions` only
  inside a scoped HOME/AGY profile sandbox with explicit worktree/MCP access.
- If the local API stays undocumented and unstable, Cat Cafe should keep
  `agy --print` as the default AGY carrier and expose the interactive bridge only
  for debugging/manual takeover.

## 2026-05-26 Refresh: AGY CLI 1.0.2 + Gemini 3.5 Flash Dogfood

- Official updater manifest now advertises AGY CLI `1.0.2`; local
  `/Users/lysander/.local/bin/agy` was updated from `1.0.1` to `1.0.2` with
  `agy update`.
- The major integration gaps remain in `1.0.2`: `agy help acp` is still
  `unknown subcommand`, `agy --model ...` is still rejected, and `agy changelog`
  still only lists `1.0.0`.
- Current practical model selection remains account-side settings. Local
  `~/.gemini/antigravity-cli/settings.json` has
  `"model": "Gemini 3.5 Flash (High)"`; a direct `agy --print` smoke logged
  `Propagating selected model override to backend: label="Gemini 3.5 Flash (High)"`.
- Live dogfood config switches `gemini` to the non-ACP Google path by setting
  `.cat-cafe/cat-catalog.json` variant `gemini-default.acp` to `null`; `gemini25`
  intentionally remains on `gemini --acp` as a comparison fallback.
- Verification: `/api/cats` reports `gemini.adapterMode = "cli"` and
  `gemini25.adapterMode = "acp"`; `GeminiAgentService({ catId: "gemini" })`
  returned `CAT_CAFE_RUNTIME_GEMINI_AGY_OK` with metadata model
  `account-selected (antigravity-cli)`.
