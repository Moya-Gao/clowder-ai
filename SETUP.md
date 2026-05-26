# Clowder AI Setup Guide

This guide covers the minimum configuration required to run Clowder AI locally, plus the optional tooling that unlocks the full experience.

## 1. Prerequisites

- Node.js 20+
- pnpm 9+
- Git
- At least one supported agent CLI installed:
  - Claude Code
  - Codex CLI
  - Gemini CLI
  - Antigravity
  - opencode

## 2. Minimum Runtime

The smallest usable local setup is:

1. Install dependencies
2. Provide one model API key
3. Start in memory mode

```bash
pnpm install
cp .env.example .env
# Add at least one provider key to .env
pnpm start:direct --memory
```

If you do not want to use `--memory`, provide a Redis instance and set `REDIS_URL`.

## 3. Required Configuration

Clowder AI expects:

- `API_SERVER_PORT`
- `FRONTEND_PORT`
- One or more provider keys:
  - `ANTHROPIC_API_KEY`
  - `OPENAI_API_KEY`
  - `GOOGLE_API_KEY`

Optional but recommended:

- `REDIS_URL` for persistent local state
- `CAT_CONFIG_PATH` if you want to load a custom roster file

## 4. Design Tooling

### Pencil MCP (recommended)

If you want design tasks, UI iteration, screenshots, and design-to-code workflows to feel like the screenshots in our README, install a design-capable MCP.

We recommend **Pencil MCP** — install the [Pencil extension](https://marketplace.visualstudio.com/items?itemName=highagency.pencildev) in VS Code, Cursor, or Antigravity.

Without Pencil or an equivalent design MCP:

- Clowder AI still runs
- coding tasks still work
- design tasks degrade to plain text guidance and generic frontend output

If you skip Pencil, bring your own MCP or design workflow.

#### How Pencil auto-configuration works

Clowder AI's capability orchestrator automatically detects your Pencil installation and generates the correct MCP config. It scans these locations in order:

1. `PENCIL_MCP_BIN` environment variable (explicit path — highest priority)
2. `~/.antigravity/extensions/highagency.pencildev-*/`
3. `~/.vscode/extensions/highagency.pencildev-*/`
4. `~/.cursor/extensions/highagency.pencildev-*/`
5. `~/.vscode-insiders/extensions/highagency.pencildev-*/`

The resolver picks the **newest version** across all editors. When two editors have the same version, Antigravity is preferred (as a specialty editor, its presence signals intent).

#### Environment variable overrides

| Variable | Purpose | Example |
|----------|---------|---------|
| `PENCIL_MCP_BIN` | Force a specific Pencil binary path | `/path/to/mcp-server-darwin-arm64` |
| `PENCIL_MCP_APP` | Force which editor to connect to | `vscode`, `antigravity`, `cursor`, `vscode-insiders` |

Set `PENCIL_MCP_APP` if the resolver picks the wrong editor (e.g., you have both VS Code and Antigravity installed but only use VS Code).

#### Diagnostics

```bash
pnpm mcp:doctor    # shows ready / missing / unresolved MCP status
```

## 5. Optional Integrations

### Voice

Optional voice features may require:

- ASR provider
- TTS provider

If voice is not configured, Clowder AI still runs normally in text mode.

### Memory Embedding

To enable local semantic rerank for the memory system, install the **Embedding** service from Console settings. The service lifecycle installer prepares the platform-specific runtime and only starts the sidecar when Console records it as installed and enabled.

### Messaging / IM

Optional chat platform integrations may require additional credentials:

- Feishu
- Telegram
- GitHub notification polling

These are not required for local development.

## 6. Safe Local Ports

Do not assume the default runtime ports are free in your environment.

For isolated local runs, set explicit ports, for example:

```bash
API_SERVER_PORT=3004 FRONTEND_PORT=3003 pnpm start:direct --memory
```

## 7. Troubleshooting

### `pnpm check` fails after sync

Run:

```bash
pnpm check:fix
pnpm check
```

### Design output looks generic

You are probably missing Pencil MCP or another design-capable MCP. Run `pnpm mcp:doctor` to check.

### Pencil MCP: "WebSocket not connected to app: xxx"

The Pencil MCP server started but cannot reach the editor. Common causes:

1. **Editor not running** — open VS Code / Antigravity / Cursor with the Pencil extension active
2. **Wrong editor selected** — the resolver picked an editor you don't use. Set `PENCIL_MCP_APP=vscode` (or `antigravity`) and restart your agent CLI
3. **Stale config** — run `pnpm mcp:doctor` and re-run `pnpm dev` to regenerate configs

### No persistent memory

This is expected when running with `--memory`.

## 8. What Is Not Included

The public Clowder AI repository does **not** include our private deployment topology, private endpoints, or internal memory services.

If a document references an internal-only system, treat it as historical context, not a required dependency.
