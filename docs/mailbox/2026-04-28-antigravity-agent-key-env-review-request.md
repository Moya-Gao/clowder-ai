# Review Request: Antigravity agent-key env reaches MCP config

Review-Target-ID: fix-antigravity-agent-key-env
Branch: fix/antigravity-agent-key-env

## What

- Fixed API startup CLI config regeneration to resolve the monorepo root before reading `.cat-cafe/capabilities.json`.
- Added `resolveStartupCliConfigContext()` plus a regression test for runtime startup from `packages/api`.
- Isolated Antigravity MCP config adapter tests from host `CAT_CAFE_AGENT_KEY_*` env.
- Applied one Biome format-only cleanup in `cat-catalog-store.ts` so `pnpm check` can pass.

## Why

Runtime API process cwd is `cat-cafe-runtime/packages/api`. The old startup regeneration used `process.cwd()` directly, so it looked for `packages/api/.cat-cafe/capabilities.json`, found nothing, and skipped rewriting `~/.gemini/antigravity/mcp_config.json`. That meant F178 sidecar files existed, but Antigravity MCP servers did not receive `CAT_CAFE_AGENT_KEY_FILE(S)`, so readonly mode did not expose `get_thread_context` / `list_threads`.

## Original Requirements

> "你是不是 get thread 也没有！！ 我记得有个很重要的mcp 读其他thread 内容的！"
> "看看有多少漏了！如果有的话 你push一下砚砚/宪宪（gpt / opus）让他们两只大猫猫帮你闭环一下"
> "Error: The model produced an invalid tool call."

- 来源：当前 thread，铲屎官 2026-04-28 09:34 / 09:40
- 请对照上面的摘录判断：这个补丁是否闭环 Antigravity agent-key MCP 工具未出现在 tools/list 的根因。

## Tradeoff

没有把 `cat_cafe_get_thread_context` / `cat_cafe_list_threads` 直接塞进 `READONLY_ALLOWED_TOOLS`。这些工具属于 F178 agent-key 边界，绕过 sidecar credential 会破坏身份模型，而且现有 `tool-registration.test.js` 会阻止把 write/callback 类工具误加进 readonly 白名单。

## Open Questions

- 重点看启动阶段 helper 是否放对层级，是否应复用到 capabilities routes，还是当前只服务 startup 更清晰。
- 重点看测试隔离 `CAT_CAFE_AGENT_KEY_*` env 的方式是否足够干净。
- merge 后 runtime 仍需重启或触发一次 startup/config regeneration，Antigravity LS 也需要重新加载 MCP 配置。

## Next Action

请 review。若放行，我走 merge gate；若有 P1/P2，我按 receive-review 修。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/fix-antigravity-agent-key-env/opus`
- Start Command: `pnpm review:start`（本次 backend/config-only，通常不需要启动 web）
- Ports: not started

## 自检证据

### Spec 合规

- Root cause verified from runtime: current API cwd is `cat-cafe-runtime/packages/api`; startup log had sidecar ready but no `CLI configs regenerated at startup`.
- `~/.gemini/antigravity/mcp_config.json` lacked `CAT_CAFE_AGENT_KEY_FILE(S)` while sidecar files existed under `~/.cat-cafe/agent-keys/`.
- Existing `mcp-config-adapters.test.js` already verifies writer injects sidecar env when process env exists; new test covers the missing startup root.

### 测试结果

- `node --test packages/api/test/startup-cli-config.test.js` -> 1 pass, 0 fail
- `node --test packages/api/test/mcp-config-adapters.test.js` -> 50 pass, 0 fail
- `pnpm --dir packages/api build` -> pass
- `pnpm --dir packages/mcp-server build` -> pass
- `node --test packages/mcp-server/test/tool-registration.test.js` -> 16 pass, 0 fail
- `pnpm check` -> pass
- `git diff --check` -> pass
- Artifact hygiene root media checks -> no matches

### 相关文档

- Feature context: F178 Antigravity image and MCP access
