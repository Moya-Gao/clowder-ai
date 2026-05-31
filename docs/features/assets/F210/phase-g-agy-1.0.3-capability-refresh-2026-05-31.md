---
feature_ids: [F210]
related_features: [F149, F198, F211]
topics: [antigravity-cli, agy, phase-g, model-selection, profile-sandbox, auth]
doc_kind: recon
created: 2026-05-31
---

# F210 Phase G AGY 1.0.3 Capability Refresh

## Environment

| Item | Value |
|------|-------|
| Date | 2026-05-31 |
| Platform | macOS darwin_arm64 |
| Installed AGY | `/Users/lysander/.local/bin/agy` |
| AGY version | `1.0.3` |

## Commands

```bash
agy --version
agy --help
agy help plugin
agy help acp
agy help model
agy help conversation
agy help continue
agy help config
jq '{model, trustedWorkspaces, permissions, statusLine, theme, telemetry}' ~/.gemini/antigravity-cli/settings.json
```

Official docs checked during this refresh:

- https://antigravity.google/docs/models
- https://antigravity.google/docs/cli-settings
- https://antigravity.google/docs/cli-conversations
- https://antigravity.google/docs/cli-permissions
- https://antigravity.google/docs/cli-using

## Findings

| Question | Finding | Evidence |
|----------|---------|----------|
| Does AGY 1.0.3 expose command-line resume? | Yes. `--conversation <uuid>` resumes a specific conversation; `--continue` resumes the most recent conversation in the active workspace. | `docs/features/assets/F210/agy-1.0.3-help.txt`; official CLI conversations doc |
| Does AGY 1.0.3 expose a per-call model selector? | No verified top-level selector. Top-level help still has no `--model`; `agy help model` is unknown. Official docs describe model selection through the UI/model selector and interactive settings, not a documented per-call `--model`. | `agy --help`; `agy help model`; official models/settings docs |
| Does AGY 1.0.3 expose ACP? | No supported/documented ACP server mode was found. `agy help acp` still returns unknown subcommand. | `agy help acp` |
| Are the requested target models officially real Antigravity targets? | Yes. Official model docs list Gemini 3.1 Pro and Claude Opus 4.6 thinking. Gemini 3.5 Flash is also present in current Antigravity model/product docs and is the local selected CLI model on this machine. | official models docs; local settings snapshot |
| Where is persistent CLI selection stored? | The official CLI settings doc names `~/.gemini/antigravity-cli/settings.json`. Local settings now contains `model: "Gemini 3.5 Flash (High)"`, `trustedWorkspaces`, and `permissions`. | official settings doc; redacted local `jq` snapshot |
| Can an isolated HOME run unattended immediately? | No. A smoke with a fresh temporary HOME plus copied `settings.json` reached OAuth onboarding and printed the Google auth URL to stdout with exit 0. It did not reuse the real HOME keyring session. | 2026-05-31 temporary-HOME smoke |
| What parser gap did the isolated HOME smoke expose? | Auth-required stdout was provider text, not assistant text. Before this refresh, `classifyAntigravityCliPlainText` would classify it as normal text because AGY can exit 0. | New parser/service regression tests |
| Is `--dangerously-skip-permissions` available? | Yes. It remains the only verified CLI-level unattended approval flag. It is not enough by itself for Phase G: it must be paired with profile HOME/settings/trusted-workspace isolation. | `agy --help`; official permissions/settings docs |
| Does plugin support help profile routing? | Not directly. `plugin`/`plugins` manages imported plugins; it does not provide model/profile selection or ACP. | `agy help plugin` |

## Local Settings Snapshot

Redacted, non-secret fields only:

```json
{
  "model": "Gemini 3.5 Flash (High)",
  "trustedWorkspaces": ["/Users/lysander/projects/relay-station/cat-cafe"],
  "permissions": {
    "allow": [
      "mcp(cat-cafe-memory/cat_cafe_search_evidence)",
      "mcp(cat-cafe-memory/cat_cafe_get_thread_context)",
      "mcp(cat-cafe/cat_cafe_get_thread_context)",
      "command(agy)",
      "command(strings)",
      "command(antigravity)"
    ]
  }
}
```

## Implications For Phase G

- `--conversation` is now production-useful and PR #1992 correctly maps Cat Cafe resume to real AGY-created UUIDs.
- `--continue` is not a Cat Cafe session-chain primitive: it resumes the most recent workspace conversation, so it is sticky/global and unsafe for deterministic thread routing.
- `--dangerously-skip-permissions` is necessary for unattended operation, but a shared real HOME makes model selection, workspace trust, and permissions sticky across cats.
- A per-cat HOME/profile is still the right isolation axis, but it requires explicit onboarding/auth per profile. Cat Cafe must classify auth-required stdout as an error and show onboarding guidance instead of surfacing OAuth text as a model reply.
- AC-G1 is partially advanced by this recon, but AC-G2/G4/G5 remain open until profile HOME onboarding, selected-model verification, trusted workspace, MCP config, and permission posture are proven in a repeatable smoke.
