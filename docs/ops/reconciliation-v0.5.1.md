---
version: v0.5.1
type: patch
date: 2026-04-09
sync_pr: clowder-ai#394
sync_tag: sync/2026-04-09-050925
---

# Community Reconciliation: v0.5.1

## Summary

Patch release addressing P0 startup crash and ACP stability issues reported by community users on linux.do. No open GitHub issues directly closed by this release.

## Bug Fixes Shipped

| Fix | Source | Community Impact |
|-----|--------|-----------------|
| .mcp.json ENOENT graceful degrade | linux.do report | **P0**: users without .mcp.json could not start the app |
| ACP prompt retry + better error | internal | transient Gemini failures now auto-retry |
| ACP permission notification routing | internal | permission dialogs now show in Hub |
| ACP timeout 120s→300s | internal | multi-tool sessions no longer timeout prematurely |
| ACP idle stall 45s→90s | internal | slow MCP tools no longer trigger false stall |
| Auto-clean stale ~/.claude.json overrides | internal | resolver-backed MCP config doesn't conflict |
| Workspace search prune hidden dirs | clowder-ai#1014 | .venv no longer overflows search results |
| Pin oh-my-opencode@3.15.3 | internal | v3.16.0 agent registration breakage avoided |

## Feature Intake Shipped

| Feature | Source PR |
|---------|----------|
| Connector dark mode (conn-* tokens) | clowder-ai#372 |

## Reviewed Open Issues (kept open)

| Issue | Title | Verdict | Evidence |
|-------|-------|---------|----------|
| #373 | stale Claude CLI config on provider switch | keep open | F145 fix targets ~/.claude.json overrides, not runtime catalog CLI fields — different root cause |
| #338 | GLM sleeping (opencode + GLM config) | keep open | ACP timeout/stall fixes help but don't address prompt loop root cause (partially by #330 in v0.5.0) |

## CVO Sign-off

- Pending @lysander approval
