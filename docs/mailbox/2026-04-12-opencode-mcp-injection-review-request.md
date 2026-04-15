# Review Request: Deterministic MCP injection for OpenCode in game sessions

Review-Target-ID: opencode-mcp-injection
Branch: feat/opencode-mcp-injection

## What

3 files changed (72 insertions, 5 deletions):

1. **`opencode-config-template.ts`** — Added `mcpServerPath?: string` to `OpenCodeRuntimeConfigOptions`; `generateOpenCodeRuntimeConfig()` now injects `config.mcp = { 'cat-cafe': { command: 'node', args: [mcpServerPath] } }` when provided.

2. **`invoke-single-cat.ts`** — Import `resolveDefaultClaudeMcpServerPath` from `ClaudeAgentService.js`; resolve `mcpServerPath` before the F189 gate; widen gate condition from `(hasExplicitOcProvider || !getOpenCodeKnownModels().has(effectiveModel))` to `(hasExplicitOcProvider || !getOpenCodeKnownModels().has(effectiveModel) || mcpServerPath)`.

3. **`opencode-config-template.test.js`** — 3 new tests: MCP injection when path provided, absence when not provided, disk persistence.

## Why

OpenCode (@opencode) lacks Cat Cafe MCP tools in werewolf game sessions. Root cause: the F189 runtime config gate in `invoke-single-cat.ts` skips known models (`anthropic/claude-opus-4-6` IS in `opencode models` list), so no `OPENCODE_CONFIG` is generated, meaning no deterministic MCP injection. Game threads use virtual `projectPath='games/werewolf'` where project-level `opencode.json` is unreliable.

Claude gets deterministic MCP via `--mcp-config`, Codex via `--config mcp_servers.*`. OpenCode now gets it via the runtime config's `mcp` section.

## Original Requirements
> "我就想你能玩狼人杀" — 铲屎官
> "可是我测试过n次每次狼人杀你都没mcp"
> "review你找砚砚靠谱"
- 来源：当前 thread (thread_mnvtwh8iezybpzhj)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **Considered**: Adding MCP config to OpenCode's project-level `opencode.json` — rejected because game threads use virtual paths where project config may not be found.
- **Chosen**: Deterministic injection via `OPENCODE_CONFIG` runtime config, matching Claude/Codex pattern. Reuses `resolveDefaultClaudeMcpServerPath()` from ClaudeAgentService (DRY).

## Open Questions

1. The F189 gate is now entered for ALL known models when `mcpServerPath` exists. This means all OpenCode cats (not just game sessions) will get deterministic MCP. Is this acceptable? (I believe yes — project-level config already had MCP, this just makes it reliable.)
2. `resolveDefaultClaudeMcpServerPath()` checks 3 candidate paths relative to cwd. Should OpenCode have its own resolver? (I believe no — same MCP server entry point for all agents.)

## Next Action

Please review the 3 files for correctness, security (MCP injection path validation), and pattern consistency with Claude/Codex injection.

## Review Sandbox
- Path: `/tmp/cat-cafe-review/opencode-mcp-injection/gpt52`
- Start Command: `pnpm review:start`
- Ports: allocated by review:start (not 3001/3002/3011/3012/4111)

## 自检证据

### Spec 合规
- OpenCode MCP injection mirrors Claude's `--mcp-config` pattern and Codex's `--config mcp_servers.*` pattern
- F189 gate condition widened minimally — only adds `|| mcpServerPath`
- No type errors, no `as any`, no `@ts-ignore`

### 测试结果
- `pnpm --filter @cat-cafe/api test` — 7757 passed, 1 failed (pre-existing/unrelated), 169 cancelled
- opencode-config-template.test.js — 28/28 passed (including 3 new MCP tests)
- opencode-mcp-isolation.test.js — 5/5 passed
- `pnpm --filter @cat-cafe/api run build` — success

### 相关文档
- Feature: F189 (OpenCode provider/model routing)
- No separate plan doc (targeted bugfix, 3 files)
