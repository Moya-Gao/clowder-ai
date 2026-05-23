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
```

## Findings

| Question | Finding | Evidence |
|----------|---------|----------|
| Is AGY globally installed? | Yes. The official installer installed `/Users/lysander/.local/bin/agy` and updated shell profiles. | Installer output, `command -v agy`, `agy --version` |
| Does AGY 1.0.1 expose a supported ACP server mode? | No supported/documented mode was found. Top-level help lists `--print`, `--prompt-interactive`, `--conversation`, `--sandbox`, `plugin`, `install`, `update`, etc., but no `--acp` or ACP subcommand. | `agy --help`; `agy help acp` returned `Error: unknown subcommand: acp` |
| Does Gemini CLI expose ACP? | Yes. Gemini CLI `0.42.0` help lists `--acp`, `--experimental-acp`, `--model`, and `-o stream-json`. | `gemini --help` |
| Can AGY headless print work from the global install? | Yes. A global-install smoke returned exactly `CAT_CAFE_AGY_GLOBAL_OK`. | `/tmp/cat-cafe-f210-global-agy-smoke.log` plus stdout |
| Which model did the global smoke use? | Account-side sticky selection resolved to `Gemini 3.5 Flash (Medium)`. No local per-invocation model flag was used. | Redacted AGY log line: `Propagating selected model override to backend: label="Gemini 3.5 Flash (Medium)"` |

## Decision

Cat Cafe should prefer an ACP integration if AGY later exposes an ACP-compatible server mode, because the existing Gemini ACP runtime already supports session lifecycle, MCP injection, tool-result surfacing, and session model control concepts.

AGY CLI `1.0.1` does not currently expose that supported mode. Therefore F210 must not wire AGY into `GeminiAcpAdapter` by swapping `command: "agy"`. The current `antigravity-cli` plain-text adapter remains the correct production default for Siamese until AGY releases a documented ACP surface or an equivalent programmatic model-selection API.

## Implications For Phase G

- `Opus 4.6`, `Gemini 3.1 Pro`, and `Gemini 3.5 Flash` remain real Antigravity product model targets.
- Cat Cafe still cannot claim deterministic per-cat AGY routing until one of these is proven:
  1. AGY exposes a supported ACP server mode with session model control.
  2. AGY exposes a documented per-invocation model flag.
  3. AGY exposes a stable settings/statusline model id that Cat Cafe can isolate per invocation or per profile.
- If the only available surface remains interactive `/model`, Phase G should ship preflight/onboarding diagnostics rather than user-facing multi-profile cats.
