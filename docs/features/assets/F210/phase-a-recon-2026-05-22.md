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
| Output mode | No `--json`, `--output-format`, or Gemini-compatible `-o stream-json` flag exists in 1.0.1. Treat stdout as plain text until a successful run proves otherwise. | `agy-unsupported-flags.txt` |
| Resume | Top-level `--continue` resumes the most recent conversation; `--conversation <id>` resumes by ID. Interactive `/resume` also exists per docs. | `agy-help.txt`; docs |
| Include dirs | Repeatable `--add-dir` exists; `--include-dir` is not supported. CWD comes from process cwd; no `--cwd` flag. | `agy-help.txt`; `agy-unsupported-flags.txt` |
| Model override | No top-level `--model` flag in 1.0.1. Docs expose model selection via interactive `/model`, persisted in settings. | `agy-unsupported-flags.txt`; docs |
| Auth | Isolated HOME falls back to OAuth URL/code flow; real HOME silently authenticated via macOS keyring, then failed later due no default model. | `agy-print-auth-required.txt`; `agy-real-home-no-default-model.txt` |
| Desktop credential sharing | Desktop state under `~/.gemini/antigravity` is not enough to provide a default model; AGY CLI uses separate `~/.gemini/antigravity-cli` app data but can reuse OS keyring auth. | `agy-real-home-no-default-model.txt`; local file layout |
| MCP config | Docs say global `~/.gemini/antigravity-cli/mcp_config.json`, workspace `.agents/mcp_config.json`; no `--mcp-config` / `--no-mcp` launch flags in 1.0.1. Runtime MCP loading behavior in `--print` mode remains unverified. | docs; `agy-unsupported-flags.txt` |
| Sandbox/permissions | `--sandbox` enables terminal restrictions; `--dangerously-skip-permissions` auto-approves tool permission requests. Settings key `enableTerminalSandbox` is documented. | `agy-help.txt`; docs |
| Workspace side effect | First print-mode run creates `.antigravitycli/<projectId>.json` symlink in the repo pointing to the AGY project file. | git status during recon |

## Blocking Result

OQ-1 is not ready for adapter implementation. `agy --print` is real, but the first successful reply is blocked by missing default model configuration:

```text
failed to construct executor: neither PlanModel nor RequestedModel specified. You must specify a valid model.
```

Because 1.0.1 does not expose `--model`, Cat Cafe cannot yet construct a fully deterministic headless invocation from env alone. Before Phase B adapter work, one of these must be true:

1. Find and verify the supported settings file key for default model and set it intentionally.
2. Require a user-run `/model` onboarding step and make missing-model a first-class actionable error.
3. Discover a documented or newly released CLI flag for model override.

## Fixture Status

| Fixture | Status | Notes |
|---------|--------|-------|
| Auth required / OAuth URL | Captured | `agy-print-auth-required.txt` |
| Real HOME auth + missing model | Captured | `agy-real-home-no-default-model.txt` |
| Success text | Blocked | Needs default model selected or verified settings key |
| Tool use | Blocked | Needs success text first |
| Result/error | Partial | Missing-model error captured; provider error fixture still pending |
| Interrupted | Partial | Auth interruption captured; in-flight generation interruption pending |

## Codebase Implications

- Add `.antigravitycli/` to `.gitignore`; AGY writes workspace-local symlinks.
- Do not map `GEMINI_ADAPTER=antigravity-cli` to `agy --print` until missing-model behavior is handled.
- Do not reuse the Gemini stream parser. There is currently no NDJSON flag; a future parser should start from actual successful AGY output.
- Missing CLI hint should name the official installer and `agy`, but installer docs need mention native binary + Windows path, not npm.
- Treat MCP as unresolved for adapter implementation: config paths and missing launch flags are known, but non-interactive runtime loading and conflict behavior still need a successful `--print` fixture.
