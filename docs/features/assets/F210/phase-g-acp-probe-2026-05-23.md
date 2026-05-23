---
feature_ids: [F210]
related_features: [F149, F161, F197]
topics: [antigravity-cli, agy, acp, model-selection, phase-g]
doc_kind: recon
created: 2026-05-23
---

# F210 Phase G ACP Probe — AGY CLI 1.0.1

## Environment

| Item | Value |
|------|-------|
| Date | 2026-05-23 |
| Platform | macOS darwin_arm64 |
| Installed AGY | `/Users/lysander/.local/bin/agy` |
| AGY version | `1.0.1` |
| Gemini CLI version | `0.42.0` |

## Commands

```bash
curl -fsSL https://antigravity.google/cli/install.sh -o /tmp/cat-cafe-agy-install.sh
bash /tmp/cat-cafe-agy-install.sh
PATH="$HOME/.local/bin:$PATH" agy --version
PATH="$HOME/.local/bin:$PATH" agy --help
PATH="$HOME/.local/bin:$PATH" agy help acp
PATH="$HOME/.local/bin:$PATH" gemini --help | rg -i "acp|model"
PATH="$HOME/.local/bin:$PATH" agy \
  --log-file /tmp/cat-cafe-f210-global-agy-smoke.log \
  --print-timeout 30s \
  --dangerously-skip-permissions \
  --add-dir /Users/lysander/projects/relay-station/cat-cafe-f210-agy-acp-probe \
  --print "Reply exactly: CAT_CAFE_AGY_GLOBAL_OK"
jq "." ~/.gemini/antigravity-cli/settings.json
find ~/.gemini/antigravity-cli -maxdepth 2 -type f \
  \( -name "*.json" -o -name "*.toml" -o -name "*.yaml" -o -name "*.yml" \) \
  -not -path "*/mcp/*"
```

## Findings

| Question | Finding | Evidence |
|----------|---------|----------|
| Is AGY globally installed? | Yes. The official installer installed `/Users/lysander/.local/bin/agy` and updated shell profiles. | Installer output, `command -v agy`, `agy --version` |
| Does AGY 1.0.1 expose a supported ACP server mode? | No supported/documented mode was found. Top-level help lists `--print`, `--prompt-interactive`, `--conversation`, `--sandbox`, `plugin`, `install`, `update`, etc., but no `--acp` or ACP subcommand. | `agy --help`; `agy help acp` returned `Error: unknown subcommand: acp` |
| Does Gemini CLI expose ACP? | Yes. Gemini CLI `0.42.0` help lists `--acp`, `--experimental-acp`, `--model`, and `-o stream-json`. Runtime alpha logs also show Gemini ACP pool initialization from catalog `acp` config. | `gemini --help`; alpha start logs |
| Can AGY headless print work from the global install? | Yes. A global-install smoke returned exactly `CAT_CAFE_AGY_GLOBAL_OK`. | `/tmp/cat-cafe-f210-global-agy-smoke.log` plus stdout |
| Which model did the global smoke use? | Account-side sticky selection resolved to `Gemini 3.5 Flash (Medium)`. No local per-invocation model flag was used. | Redacted AGY log line: `Propagating selected model override to backend: label="Gemini 3.5 Flash (Medium)"` |
| Does the AGY adapter replace current catalog ACP cats? | No. `packages/api/src/index.ts` checks `getAcpConfig(id)` first and instantiates `GeminiAcpAdapter`; only configs without `acp` fall back to `GeminiAgentService` and its `GEMINI_ADAPTER` default. | `packages/api/src/index.ts`; alpha start logs |
| Where does AGY persist interactive model/depth selection? | `~/.gemini/antigravity-cli/settings.json` appears after interactive `/model` use and contains a string `model` value such as `Gemini 3.5 Flash (High)`, plus `trustedWorkspaces`, `statusLine`, theme, and telemetry keys. | Local `jq` inspection after CVO interactive AGY session |
| What is the AGY auto-approval control? | The only verified CLI-level yolo equivalent is `--dangerously-skip-permissions`. It must be explicit for unattended Cat Cafe runtime calls; relying on interactive approvals makes agent turns unusable and trains users to approve unread scripts. | `agy --help`; CVO runtime observation 2026-05-23 |
| What does profile sandboxing need to preserve? | A per-cat sandbox must carry isolated `settings.json` model/depth, `trustedWorkspaces`, MCP config, and worktree access. Isolating HOME/config without granting the assigned worktree or MCP servers would make AGY unable to operate. | CVO runtime observation; local config layout |

## Decision

Cat Cafe should prefer an ACP integration if AGY later exposes an ACP-compatible server mode, because the existing Gemini ACP runtime already supports session lifecycle, MCP injection, tool-result surfacing, and session model control concepts.

AGY CLI `1.0.1` does not currently expose that supported mode. Therefore F210 must not wire AGY into `GeminiAcpAdapter` by swapping `command: "agy"`. The current `antigravity-cli` plain-text adapter remains the correct non-ACP Google default, while catalog ACP cats continue to use `gemini --acp` until AGY releases a documented ACP surface or an equivalent programmatic model-selection API.

## Implications For Phase G

- `Opus 4.6`, `Gemini 3.1 Pro`, and `Gemini 3.5 Flash` remain real Antigravity product model targets.
- Cat Cafe still cannot claim deterministic per-cat AGY routing until one of these is proven:
  1. AGY exposes a supported ACP server mode with session model control.
  2. AGY exposes a documented per-invocation model flag.
  3. AGY exposes a stable settings/statusline model id that Cat Cafe can isolate per invocation or per profile.
- The current best lead is profile sandboxing around `~/.gemini/antigravity-cli/settings.json`, not a CLI flag. Phase G must validate whether a per-cat HOME / AGY config root can isolate model choice while preserving auth, `trustedWorkspaces`, MCP config, and worktree access.
- Cat Cafe AGY runtime should use `--dangerously-skip-permissions` inside that sandbox. The permission model should move from human popup approval to environment scoping, because users cannot realistically review every script an agent asks to execute.
- If the only available surface remains interactive `/model`, Phase G should ship preflight/onboarding diagnostics rather than user-facing multi-profile cats.
