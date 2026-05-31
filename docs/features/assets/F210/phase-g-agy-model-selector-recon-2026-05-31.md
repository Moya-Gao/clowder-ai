---
feature_ids: [F210]
related_features: [F198, F210, F211]
topics: [antigravity-cli, agy, phase-g, model-selection, profile-sandbox]
doc_kind: recon
created: 2026-05-31
---

# F210 Phase G AGY Model Selector Recon

## Environment

| Item | Value |
|------|-------|
| Date | 2026-05-31 |
| Platform | macOS darwin_arm64 |
| Installed AGY | `/Users/lysander/.local/bin/agy` |
| AGY version | `1.0.3` |
| Antigravity Desktop LS | `language_server`, Antigravity `2.0.10` process, sanitized local HTTPS connection |

## Commands

```bash
agy --version
agy --help
jq '{model, trustedWorkspaces, permissions, statusLine, theme, telemetry}' \
  ~/.gemini/antigravity-cli/settings.json

# Sanitized local read-only model catalog probes.
# The script discovers the running Antigravity language_server from ps/lsof,
# strips the CSRF token from output, then calls:
# - GetUserStatus
# - GetCascadeModelConfigData
# - GetAvailableModels
node <<'NODE'
/* see working-tree command history for the one-off local probe */
NODE
```

Official docs checked during this refresh:

- https://antigravity.google/docs/models
- https://antigravity.google/docs/cli-settings
- https://antigravity.google/docs/cli-reference

## Findings

| Question | Finding | Evidence |
|----------|---------|----------|
| Are the target reasoning models officially available? | Yes. Current official model docs list Gemini 3.5 Flash, Gemini 3.1 Pro high/low, Claude Sonnet 4.6 thinking, Claude Opus 4.6 thinking, Gemini 3 Flash, and GPT-OSS 120B. | official models doc, fetched 2026-05-31 |
| Does AGY 1.0.3 expose a documented per-call `--model` flag? | No. Top-level help still has no `--model`; settings docs describe persistent preferences and command-line overrides for some settings, but model choice remains a settings/UI selector surface, not a proven per-call flag. | `agy --help`; official CLI settings/reference docs |
| What is the persistent model-selection storage surface? | `~/.gemini/antigravity-cli/settings.json`, key `model`, with the human selector label as the stored value. Local settings currently store `"Gemini 3.5 Flash (High)"`. | official CLI settings doc; redacted local settings snapshot |
| What does the local language-server expose? | Read-only `GetUserStatus`, `GetCascadeModelConfigData`, and `GetAvailableModels` expose current model labels, placeholder ids, quota metadata, and capability metadata. | sanitized local LS probe |
| Which value should Cat Cafe write/verify in profile settings? | The selector label string, not the placeholder id. PR #2004 writes `settings.model` and verifies the post-run log label `Propagating selected model override to backend: label="..."`. | `agy-profile-manager.ts`; `antigravity-cli-event-parser.ts`; local settings/log behavior |
| Is `GetAvailableModels` alone safe as a production selector-id source? | No. It still contains duplicate Gemini 3.1 Pro High entries with different placeholders. The currently coherent runtime selector source is the label used by settings/logs plus `GetUserStatus` / `GetCascadeModelConfigData` for supporting evidence. | local LS probe |

## Model Selector Snapshot

The current production selector surface for Cat Cafe profile configuration is the
label in the first column. Placeholder ids are recon evidence only; Cat Cafe
must not treat them as a per-call model flag.

| Target | `settings.model` / status label | `GetUserStatus` model | `GetCascadeModelConfigData` model | `GetAvailableModels` evidence | Notes |
|--------|---------------------------------|-----------------------|-----------------------------------|-------------------------------|-------|
| Claude Opus 4.6 | `Claude Opus 4.6 (Thinking)` | `MODEL_PLACEHOLDER_M26` | `MODEL_PLACEHOLDER_M26` | `MODEL_PLACEHOLDER_M26`, `vertexModelId: claude-opus-4-6@default` | Official target for Opus profile |
| Claude Sonnet 4.6 | `Claude Sonnet 4.6 (Thinking)` | `MODEL_PLACEHOLDER_M35` | `MODEL_PLACEHOLDER_M35` | `MODEL_PLACEHOLDER_M35`, `vertexModelId: claude-sonnet-4-6@default` | Not required for R6, but present |
| Gemini 3.1 Pro Low | `Gemini 3.1 Pro (Low)` | `MODEL_PLACEHOLDER_M36` | `MODEL_PLACEHOLDER_M36` | `MODEL_PLACEHOLDER_M36` | Stable across observed endpoints |
| Gemini 3.1 Pro High | `Gemini 3.1 Pro (High)` | `MODEL_PLACEHOLDER_M16` | `MODEL_PLACEHOLDER_M16` | `MODEL_PLACEHOLDER_M37` and `MODEL_PLACEHOLDER_M16` both appear | Use label verification; do not route by raw placeholder |
| Gemini 3.5 Flash High | `Gemini 3.5 Flash (High)` | `MODEL_PLACEHOLDER_M132` | `MODEL_PLACEHOLDER_M132` | `MODEL_PLACEHOLDER_M132` | Local selected model; tagged `Fast` / `Limited time` |
| Gemini 3.5 Flash Medium | `Gemini 3.5 Flash (Medium)` | `MODEL_PLACEHOLDER_M20` | `MODEL_PLACEHOLDER_M20` | `MODEL_PLACEHOLDER_M20` | Current default override model in local selector config |
| Gemini 3.5 Flash Low | `Gemini 3.5 Flash (Low)` | available in `GetUserStatus` | available in `GetCascadeModelConfigData` | available in `GetAvailableModels` | Available, but not the target Cat Cafe profile |

## Local Settings Snapshot

Redacted, non-secret fields only:

```json
{
  "model": "Gemini 3.5 Flash (High)",
  "trustedWorkspaces": [
    "/Users/lysander/projects/relay-station/cat-cafe"
  ],
  "permissions": {
    "allow": [
      "mcp(cat-cafe-memory/cat_cafe_search_evidence)",
      "mcp(cat-cafe-memory/cat_cafe_get_thread_context)",
      "mcp(cat-cafe/cat_cafe_get_thread_context)",
      "command(agy)",
      "command(strings)",
      "command(antigravity)"
    ]
  },
  "statusLine": {
    "type": "",
    "command": "",
    "enabled": true
  },
  "theme": null,
  "telemetry": null
}
```

## Implications For Phase G

- AC-G1 can close: official model availability is current, and the exact AGY
  model-selection storage surface is `settings.json` key `model` with the
  human selector/status label.
- AC-G2 remains open: PR #2004 can create isolated profile settings and verify
  post-run labels, but Cat Cafe still needs live per-profile onboarding/E2E
  smoke for the Opus / Gemini 3.1 Pro / Gemini 3.5 Flash profiles before
  exposing user-facing AGY profile cats.
- The correct implementation contract is still verification-first: write the
  intended label into the isolated profile, run AGY inside that HOME, and fail
  closed unless the log-observed label matches.
- The local language-server model catalog is useful recon, not a supported
  production model setter. AC-G6 remains open until send/stream/cancel/model
  selection semantics are proven or rejected.
