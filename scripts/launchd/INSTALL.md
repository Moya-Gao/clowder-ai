# Cat Café MCP Cleanup launchd Agent — Install Runbook

> F247 KD-19 / B1c-0 hygiene gate. Daily auto-cleanup of stale MCP wrapper processes
> (agent-browser-mcp / @playwright/mcp / pinchtab-mcp) via existing `pnpm process:cleanup`.

## Why a template, not auto-install

Installing a launchd agent persists OS-level automation that survives reboots and runs
as the logged-in user. PR merge alone should NOT cause that — the CVO must explicitly
opt in after reviewing what gets killed. The PR ships the plist template + this runbook;
`launchctl load` is a one-time manual step.

## Pre-flight check (dry-run, takes 2s)

Verify what would be killed on your machine:

```bash
cd /Users/lysander/projects/relay-station/cat-cafe
pnpm process:doctor   # detects + prints findings, kills nothing
```

Output rows tagged `rule=stale-{agent-browser,playwright,pinchtab}-mcp-wrapper` are
the new B1c-0 targets. If anything looks wrong (e.g. an active session got flagged),
**do not install** — file an issue against this PR.

## Install

```bash
# 1. Render template with your absolute repo path
REPO=/Users/lysander/projects/relay-station/cat-cafe
sed "s|{{REPO_PATH}}|${REPO}|g" \
  "${REPO}/scripts/launchd/cat-cafe.mcp-cleanup.plist.template" \
  > ~/Library/LaunchAgents/cat-cafe.mcp-cleanup.plist

# 2. Load into launchd (registers, but does not run until 04:00 next day)
launchctl load -w ~/Library/LaunchAgents/cat-cafe.mcp-cleanup.plist

# 3. (optional) Trigger one run immediately to smoke-test
launchctl start cat-cafe.mcp-cleanup
cat /tmp/cat-cafe-mcp-cleanup.log   # check output
```

## Uninstall

```bash
launchctl unload ~/Library/LaunchAgents/cat-cafe.mcp-cleanup.plist
rm ~/Library/LaunchAgents/cat-cafe.mcp-cleanup.plist
```

## Troubleshooting

- **Nothing in `/tmp/cat-cafe-mcp-cleanup.log`**: launchd may have skipped the run. Check
  `launchctl list cat-cafe.mcp-cleanup` and `launchctl print user/$(id -u)/cat-cafe.mcp-cleanup`.
- **`pnpm` not found**: the template uses `/opt/homebrew/bin/pnpm`. Adjust to your install
  path (e.g. `/usr/local/bin/pnpm` on Intel macOS) before loading.
- **Killed the wrong process**: see `findStaleDevProcesses` rules + negative test fixtures
  in `scripts/cleanup-stale-dev-processes.{mjs,test.mjs}`. The script is the only authority;
  launchd just calls it.

## Safety inheritance

This agent owns ZERO kill logic. Every match / age threshold / sanctuary guard lives in
the existing tested script. Pattern changes go through PR review, not the plist.
