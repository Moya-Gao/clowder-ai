---
feature_ids: [F210]
related_features: [F061, F149, F161, F197, F201]
topics: [antigravity-cli, agy, gemini-cli, recon, auth, mcp, sandbox]
doc_kind: recon
created: 2026-05-22
---

# F210 Phase A Recon — AGY CLI 1.0.1

## Environment

| Item | Value |
|------|-------|
| Date | 2026-05-22 |
| Platform | macOS darwin_arm64 |
| Gemini CLI | `gemini 0.38.2` at `/opt/homebrew/bin/gemini` |
| Existing `agy` on PATH | Not installed |
| Isolated AGY binary | `/tmp/cat-cafe-f210-agy-recon/bin/agy` |
| AGY version | `1.0.1` |

## Official Sources Checked

- Google Developers Blog: consumer Gemini CLI / Gemini Code Assist requests stop on 2026-06-18; enterprise and paid API-key access remains unchanged.
- Antigravity CLI getting-started docs: macOS/Linux installer is `curl -fsSL https://antigravity.google/cli/install.sh | bash`; Windows has PowerShell and CMD installers.
- Antigravity CLI usage/features docs: persistent settings live under `~/.gemini/antigravity-cli/settings.json`; launch overrides include `--sandbox` and `--dangerously-skip-permissions`; model selection is exposed as interactive `/model`.
- Antigravity CLI migration docs: CLI MCP config lives at `~/.gemini/antigravity-cli/mcp_config.json` globally and `.agents/mcp_config.json` per workspace; remote servers use `serverUrl`.

## Local Facts

| Question | Finding | Evidence |
|----------|---------|----------|
| Install path | Official Unix installer supports `--dir`; default target is `$HOME/.local/bin`; Windows defaults to `%LOCALAPPDATA%\\agy\\bin\\agy.exe`. | `install.sh`, `install.ps1`, `install.cmd` |
| Binary name | Standalone CLI binary is `agy` / `agy.exe`. | `agy-help.txt`; installer scripts |
| Version | Latest manifest installed `agy 1.0.1`. | `agy --version` |
| Headless mode | `--print` / `--prompt` runs one non-interactive prompt; `--print-timeout` controls wait duration. | `agy-help.txt` |
| Output mode | No `--json`, `--output-format`, or Gemini-compatible `-o stream-json` flag exists in 1.0.1. Successful new `--print` stdout is plain final text. Timeout also prints a plain stdout error and exits 0. | `agy-unsupported-flags.txt`; `agy-real-home-print-success.txt`; `agy-print-timeout.txt` |
| Resume | Top-level `--continue` resumes the most recent conversation; `--conversation <id>` resumes by ID. A resumed print fixture emitted previous assistant text plus the new answer, so stdout is not proven delta-only. | `agy-help.txt`; `agy-conversation-resume.txt` |
| Include dirs | Repeatable `--add-dir` exists; `--include-dir` is not supported. Process cwd created/discovered the AGY project, but terminal tool cwd was `~/.gemini/antigravity-cli` unless `--add-dir <repo>` was supplied. No `--cwd` flag. | `agy-help.txt`; `agy-unsupported-flags.txt`; `agy-tool-use.txt` |
| Model override | No top-level `--model` flag in 1.0.1. Real HOME success used an account-side selected model override after keyring auth; no local `~/.gemini/antigravity-cli/settings.json` was created. | `agy-unsupported-flags.txt`; `agy-real-home-print-success.txt` |
| Auth | Isolated HOME falls back to OAuth URL/code flow. Real HOME can silently authenticate via macOS keyring and complete print mode once the account-side selected model is available. | `agy-print-auth-required.txt`; `agy-real-home-print-success.txt` |
| Desktop credential sharing | Desktop state under `~/.gemini/antigravity` is not enough by itself to guarantee a default model: one run failed with missing model, later runs succeeded using keyring auth plus account-side selected model. AGY CLI uses separate `~/.gemini/antigravity-cli` app data. | `agy-real-home-no-default-model.txt`; `agy-real-home-print-success.txt`; local file layout |
| MCP config | Docs say global `~/.gemini/antigravity-cli/mcp_config.json`, workspace `.agents/mcp_config.json`; no `--mcp-config` / `--no-mcp` launch flags in 1.0.1. Successful print mode materialized MCP tool schema caches under `~/.gemini/antigravity-cli/mcp` matching `~/.gemini/config/mcp_config.json` server names; exact config precedence and settings-level override/disable controls remain unverified. | docs; `agy-unsupported-flags.txt`; `agy-mcp-runtime-loading.txt` |
| Sandbox/permissions | `--sandbox` enables terminal restrictions; `--dangerously-skip-permissions` auto-approves tool permission requests. Settings key `enableTerminalSandbox` is documented. | `agy-help.txt`; docs |
| Workspace side effect | First print-mode run creates `.antigravitycli/<projectId>.json` symlink in the repo pointing to the AGY project file. | git status during recon |

## Headless Spike Result

OQ-1 is now answered enough to prototype an adapter: `agy --print` is the headless mode, and successful new-conversation stdout is plain final text. There is no JSON/NDJSON event stream in 1.0.1, and timeout handling is unsafe if code relies on exit status alone:

```text
Error: timed out waiting for response
```

The timeout fixture exited 0, so adapter code must classify timeout text/log state explicitly.

OQ-3 is downgraded from hard blocking to a runtime preflight requirement. `agy` still has no top-level `--model` flag, and no local `settings.json` was created, but real HOME print mode succeeded after keyring auth fetched an account-side selected model override:

```text
Propagating selected model override to backend: label="Gemini 3.5 Flash (High)"
```

Cat Cafe still cannot deterministically select a model per cat identity from env alone. Before defaulting production traffic to `antigravity-cli`, one of these must be true:

1. Find and verify the supported settings/server-side key for deterministic model selection.
2. Require a user-run `/model` onboarding step and make missing-model a first-class actionable error.
3. Discover a documented or newly released CLI flag for model override.

## Fixture Status

| Fixture | Status | Notes |
|---------|--------|-------|
| Auth required / OAuth URL | Captured | `agy-print-auth-required.txt` |
| Real HOME auth + missing model | Captured | `agy-real-home-no-default-model.txt` |
| Success text | Captured | `agy-real-home-print-success.txt` |
| Tool use | Captured | `agy-tool-use.txt`; `--add-dir` is required for repo cwd tool execution |
| Resume | Captured | `agy-conversation-resume.txt`; resumed stdout is not delta-only |
| Result/error | Partial | Missing-model and timeout captured; provider error fixture still pending |
| Interrupted | Partial | Auth interruption and print timeout captured; manual in-flight interrupt pending |

## Codebase Implications

- Add `.antigravitycli/` to `.gitignore`; AGY writes workspace-local symlinks.
- A minimal `antigravity-cli` prototype can use `agy --print --add-dir <repo>`, but default switch remains blocked until model preflight/onboarding and timeout classification are implemented.
- Do not reuse the Gemini stream parser. There is no NDJSON flag; successful AGY stdout is plain text and resumed stdout may contain prior assistant text.
- Missing CLI hint should name the official installer and `agy`, but installer docs need mention native binary + Windows path, not npm.
- Treat MCP conflict control as unresolved for adapter implementation: runtime schema materialization is observed, but config precedence and settings-level disable/override behavior still need explicit fixtures.
