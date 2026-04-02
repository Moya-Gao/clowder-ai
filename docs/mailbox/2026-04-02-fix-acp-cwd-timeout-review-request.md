# Review Request: ACP prompt timeout — wrong cwd + silent stderr

Review-Target-ID: fix-acp-cwd-timeout
Branch: fix/acp-cwd-timeout
PR: (pending — will create at merge-gate)

## What

Bug fix: ACP `session/prompt` always times out at 120s. Four changes across 4 files:

1. `AcpClient.ts:104` — stderr log `debug` → `warn` (with pid)
2. `index.ts:752` — Pool spawn cwd: `process.cwd()` → `findMonorepoRoot()`
3. `GeminiAcpAdapter.ts` — Added `projectRoot` config field; session cwd defaults to `projectRoot`; diagnostic logging around `newSession`/`promptStream`
4. `gemini-acp-adapter.test.js` — Added `projectRoot: '/tmp'` to all adapter instantiations

## Why

烁烁 (Gemini) 每次被 @ 都 120s 超时后被 SEALED，完全无法使用。Runtime 日志证据：

- `07:55:52` PID 31096: `ACP timeout: session/prompt did not respond within 120000ms`
- `11:02:15` PID 41464: 同上（重启后仍然复现）
- 两次之间 0 次成功 prompt，0 条 stderr/agent-request（因为 stderr 是 debug 级别）

根因链：
1. `gemini --acp` 子进程 cwd = `packages/api/`（`process.cwd()`）
2. `.gemini/settings.json` 在 monorepo root，配了 6 个 MCP server
3. MCP server 的 env vars（`${CAT_CAFE_INVOCATION_ID}` 等）是按次注入的，不在 API server 的 `process.env` 里
4. Gemini CLI 找到 settings → 尝试启动 MCP servers → env vars 空 → 卡死
5. `session/prompt` 永远无响应 → 120s timeout

## Original Requirements

> "烁烁出现bug了！！他又被禁言了！！"
> "还有一个这个问题这个是gemini吗？at一次封印一次的？"
> "笨蛋 我之前at的时候就是重启的 所以你就是有bug"
- 来源：铲屎官 2026-04-02 对话历史（thread_mnb0em5zthyw0snl 附近）
- **请对照上面的摘录判断：修复后烁烁能否正常响应 prompt**

## Tradeoff

- 未在此 PR 处理 MCP server 显式传递（`mcpServers` 参数）——目前依赖 Gemini CLI 从 `.gemini/settings.json` 自动加载，cwd 修正后 env vars 能从 process.env 继承
- 未改变 `handleAgentRequest` 仅处理 `requestPermission` 的逻辑——`fsReadTextFile`/`fsWriteTextFile` 仍返回 `-32601`，但这是 Phase D 范畴

## Open Questions

1. **cwd 修正是否足够**：修正后子进程从 monorepo root 启动，`.gemini/settings.json` 的 MCP server env vars 能否从 `process.env` 正确继承？需要 runtime 验证
2. **stderr 实际内容**：提升到 warn 后，下次 timeout 能看到子进程报什么错——这是诊断的关键一步
3. **session chain 问题关联**：thread_mnh9m39lx49leuqk 中的 session 异常（unexpected sealing, missing ownership）是否与此 timeout 有因果关系？

## Next Action

请 review 代码改动（4 files, +26/-14），重点关注：
- cwd 修正是否完整覆盖了所有路径
- `projectRoot` 从 `findMonorepoRoot()` 获取是否可靠
- 是否还有其他 `process.cwd()` 遗漏

同时请结合 session chain 问题一起分析：这个 timeout 是否是 session 异常 SEALED 的直接原因。

## 自检证据

### Spec 合规
- F149 Phase C AC 已全部交付（PR #921 merged）
- 本 PR 是 Phase C 合入后发现的 runtime bug 修复

### 测试结果
```
ACP tests (37/37): 0 failures
  - acp-client.test.js:      11 passed
  - acp-process-pool.test.js: 16 passed
  - gemini-acp-adapter.test.js: 10 passed
pnpm lint:  0 errors
pnpm check: 2 pre-existing format errors (NOT in changed files)
pnpm build: exit 0
```

### 相关文档
- Feature: `docs/features/F149-acp-runtime-operations.md`
- Plan: `docs/plans/2026-04-02-f149-phase-c-acp-process-pool.md`
