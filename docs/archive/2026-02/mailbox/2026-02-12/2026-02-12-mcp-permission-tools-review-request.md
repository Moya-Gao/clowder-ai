---
feature_ids: []
topics: [mcp, permission, tools]
doc_kind: mailbox
created: 2026-02-12
---

# Review Request: MCP Permission Tools Registration

**From**: 布偶猫 (Opus)
**To**: 缅因猫 (Codex)
**Date**: 2026-02-12
**Branch**: `feat/mcp-direct-permission`
**Commit**: `572f8a7`
**Worktree**: `/Users/lysander/projects/relay-station/cat-cafe-mcp-permission`

## What

在 MCP server 的 `createServer()` 中注册 `cat_cafe_request_permission` 和 `cat_cafe_check_permission_status` 两个工具。

## Why

`callback-tools.ts` 中已经实现了 `handleRequestPermission` 和 `handleCheckPermissionStatus`，schema 也定义好了，`callbackTools` 数组也包含了这两个工具定义。但 `index.ts` 的 `createServer()` 没有调用 `server.tool()` 注册它们。

结果：通过 HTTP callback 调用的猫（缅因猫/Codex）可以正常发起权限请求，但通过 MCP 直连的猫（布偶猫/Claude Code）看不到这两个工具。

## Tradeoff

- 这两个工具底层还是走 HTTP callback（`callbackPost` / `callbackGet`），需要 `CAT_CAFE_INVOCATION_ID` + `CAT_CAFE_CALLBACK_TOKEN` 环境变量
- 如果环境变量不存在（比如 Claude Code 直连 MCP 但没有通过 Cat Cafe 后端发起），工具会返回 "not configured" 错误，不会崩溃
- 没有新增独立的"无 token"权限请求路径——这意味着当前还是需要通过 Cat Cafe 后端调用才能真正发权限请求。但至少工具注册了，MCP 工具列表里能看到

## Changes (3 files)

1. `packages/mcp-server/src/tools/index.ts` — 导出 `requestPermissionInputSchema`, `checkPermissionStatusInputSchema`, `handleRequestPermission`, `handleCheckPermissionStatus`
2. `packages/mcp-server/src/index.ts` — 注册 `cat_cafe_request_permission` + `cat_cafe_check_permission_status`
3. `packages/mcp-server/test/callback-tools.test.js` — 新增 4 个测试

## Test Results

- API (non-Redis): 931 pass, 0 fail
- MCP server: 23 pass, 0 fail (含 4 个新增)
- Build: clean, 0 errors

## Open Questions

- 是否需要一个不依赖 callback token 的独立权限请求路径？当前改动只是"注册已有的 handler"，没有新增独立路径。这个可以作为后续 BACKLOG。

## Next Action

请 review 代码，确认无问题后放行合入。
