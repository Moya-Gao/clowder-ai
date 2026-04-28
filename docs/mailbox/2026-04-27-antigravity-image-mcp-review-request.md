# Review Request: Antigravity image input + persistent MCP tool surface

Review-Target-ID: fix-antigravity-image-mcp
Branch: fix/antigravity-image-mcp

## What

- Antigravity invocation now extracts uploaded image `contentBlocks` and appends local image path hints to the prompt before sending through the Bridge.
- API startup now creates a 0600 Antigravity agent-key sidecar file and exposes only `CAT_CAFE_AGENT_KEY_FILE` to managed Antigravity MCP servers.
- Antigravity MCP config writer now carries the sidecar file path into `~/.gemini/antigravity/mcp_config.json` while stripping raw `CAT_CAFE_AGENT_KEY_SECRET`.
- `@antig-opus` now advertises MCP support in both `cat-config.json` and `cat-template.json`.

## Why

Landy observed two separate failures: Antigravity could not inspect image uploads, and its persistent MCP server list did not include thread tools such as `cat_cafe_get_thread_context`. Root cause was split:

- Image path: `AntigravityAgentService.invoke()` only sent text to Bridge; it never consumed `options.contentBlocks`.
- MCP path: persistent Antigravity MCP ran readonly with no agent-key file, so agent-key tools were omitted by the MCP server toolset.

## Original Requirements

> 我们的antigravity好像看不了图片，是为什么？因为权限？还是antigravity没有读图的能力？不应该啊
> 我发现antigravity mcp暴露的给他不全 get thread 他也和我说他没有。 你好像需要做两个事情！一个是图片的！ 还有一个是mcp tools 的 是不是完整加入到他的list了

- 来源：当前 Cat Cafe thread，Landy 于 2026-04-27 18:34 / 18:42 的直接指令。
- 请对照上面的摘录判断交付物是否同时解决图片输入和 MCP tool surface 两条线。

## Tradeoff

- 没有给 Antigravity Bridge 新增二进制 image item 传输，因为当前 Bridge `sendMessage` payload 是文本 `items: [{ text }]`；本轮采用和 Gemini CLI 分支一致的 local image path hint，风险更小。
- sidecar 写入文件路径而不是把 secret 写进 long-lived MCP config，避免把长期凭证落进 `mcp_config.json`。
- 当前 sidecar 默认 catId 是 `antigravity`。请重点 review：`@antig-opus` 的 native MCP 写回如果走 agent-key，会不会需要 variant-aware sidecar；per-invocation callback path 仍由 runtime env 保持 variant-correct。

## Open Questions

- `CAT_CAFE_AGENT_KEY_FILE` 注入 Antigravity MCP config 是否足够覆盖 `cat-cafe-collab` / `cat-cafe-memory` / `cat-cafe-signals` 的 persistent tool list？
- sidecar helper 的 best-effort startup 失败策略是否合适，还是应该让 API fail closed？
- 图片路径 hint 方案是否需要在 prompt 文案里进一步提醒 Antigravity 读取 `[Local image path: ...]`？

## Next Action

请 review `fix/antigravity-image-mcp`，重点看安全边界、tool list 解锁是否完整、以及 `antigravity` / `antig-opus` 身份边界。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/fix-antigravity-image-mcp/opus`
- Start Command: `pnpm review:start`
- Ports: backend-only review expected; if running app, use review sandbox allocated ports, not 3001/3002/3011/3012/4111.

## 自检证据

### Spec 合规

- 图片：新增失败测试覆盖 uploaded image `contentBlocks` 会进入 Antigravity prompt local path hint。
- MCP：新增 agent-key sidecar 文件测试，验证 0600 权限、registry-backed key、只写 `CAT_CAFE_AGENT_KEY_FILE`。
- MCP config：新增 Antigravity config writer 测试，验证 managed cat-cafe server 获得 key file path 且不落 raw secret。
- Roster/prompt：新增 config loader 测试，验证 `antigravity` 和 `antig-opus` 都 advertise `mcpSupport: true`。
- Artifact hygiene：根目录媒体/设计工件检查无输出。

### 测试结果

```bash
node --test packages/api/test/antigravity-agent-service.test.js packages/api/test/antigravity-agent-key-sidecar.test.js packages/api/test/mcp-config-adapters.test.js packages/api/test/cat-config-loader.test.js packages/mcp-server/test/tool-registration.test.js packages/mcp-server/test/callback-tools-agent-key.test.js packages/api/test/callback-auth-agent-key.test.js packages/api/test/callback-routes-agent-key.test.js packages/api/test/antigravity-agent-service-fatal-errors.test.js
# tests 222, pass 222, fail 0

pnpm check
# PASS

pnpm --dir packages/api build && pnpm --dir packages/mcp-server build
# PASS

pnpm -r --if-present run build
# PASS; web build emitted existing hardcoded-color/react-hook warnings unrelated to this backend change
```

### 相关文档

- Feature context: `docs/features/F178-persistent-mcp-agent-key-auth.md`
- Generated index refreshed: `docs/features/index.json`
