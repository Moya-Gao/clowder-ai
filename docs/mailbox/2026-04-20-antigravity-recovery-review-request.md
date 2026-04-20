# Review Request: fix/antigravity-recovery continuity fallback

Review-Target-ID: fix-antigravity-recovery
Branch: fix/antigravity-recovery
Head: a9f514932

## What
- 打开孟加拉猫 breed 级 `sessionChain`，让 `antigravity` / `antig-opus` 的 session 真正进入 chain
- 给 Antigravity service 补 callback fallback instructions，在没有原生 MCP 注入时仍能通过 callback API 拿 thread context / 回贴
- 收敛 Antigravity 正文 replay 的 overlap 去重，避免非前缀重写时整段 snapshot 重放

改动范围只在 7 个文件：
- `cat-config.json`
- `cat-template.json`
- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- `packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-step-delta.ts`
- `packages/api/test/antigravity-agent-service.test.js`
- `packages/api/test/antigravity-streaming.test.js`
- `packages/api/test/cat-config-loader.test.js`

## Why
`thread_mo3wo2p9m00wkb0f` 的孟加拉猫链路同时踩了 3 个问题：
- `sessionChain=false`，所以重启后 session 不持久化，看起来像“失忆”
- Antigravity 不走 Cat Café MCP fallback 注入，重启后无法靠 callback 主动拉 thread context / 回贴
- step delta 对非前缀重写会整段回放 snapshot，导致正文重复，不只是 thinking 重复

这次范围只救 3 件事：
- 重启后仍能拿到 thread 上下文
- 仍能回贴
- session 能持续

原生 MCP 注册留到下一 PR。

## Original Requirements（必填）
> `thread_mo3wo2p9m00wkb0f` 这里的孟加拉猫 我和他深度聊了一小时 我发现。  
> 1. thinking还有那个重复！ 甚至有的时候cli 的返回都有！  
> 2. 他的mcp似乎用不了 你可以看他最新的发言他甚至似乎失去记忆了！我们猫猫咖啡重启之后 他之前的记忆都没了？
>
> 直接定义成：  
> 重启后仍能拿到 thread 上下文 / 仍能回贴 / session 能持续

- 来源：当前 thread `thread_mnux2eewbo4otg17`，铲屎官消息 `0001776670267484-000004-83139b22` 与 `0001776671679882-000046-e99def4a`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- **没做** Antigravity 原生 MCP 注册 / `mcpServers` 接线；那条还没证实 bridge API 支持，塞进来会把“能先救回来”变成“又一个假设”
- callback fallback 走显式 instructions，不改 `McpPromptInjector` 的 antigravity 禁用策略，避免把 provider 设计面和本轮 recovery 混在一起
- 全量 `pnpm gate` 目前没绿；我没有顺手去修无关 web 红灯，先把 recovery 行为 fix 和外部 blocker 分离

## Open Questions
1. 这版 callback fallback 是否足够保守，还是你认为应该在本轮就把 `McpPromptInjector` 的 antigravity guard 一并拆掉？
2. `antigravity-step-delta` 的 overlap 去重是否有遗漏边界，尤其是“中间插入改写”这种非单调增长场景？
3. 在 `pnpm gate` 被无关 web 测试阻塞的前提下，这组改动是否允许先继续 review 流程，再由铲屎官决定是否临时放宽门禁？

## Next Action
请你做 peer review，重点看：
- 这 3 个修复是否准确覆盖用户定义的恢复目标
- 是否有把“原生 MCP 注册”偷偷混进本轮范围
- `pnpm gate` 红灯可否合理定性为无关 blocker，而不是这次 diff 引入

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/fix-antigravity-recovery/opus-47`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- 用户重新定义本轮目标为：`thread context` / `回贴` / `session 持续`
- 代码范围保持在 API provider + breed config + API tests，没有把原生 MCP 注册塞进来
- 相关 thread 证据链已查明：
  - `/api/threads/thread_mo3wo2p9m00wkb0f/sessions` 查不到 `antig-opus`
  - runtime 日志反复出现 `Session init: binding session`
  - `cat-config.json` 里孟加拉猫 breed 级 `sessionChain` 原本为 `false`
  - `McpPromptInjector.ts` 对 `clientId === 'antigravity'` 明确禁用 fallback 注入

### 测试结果
```bash
# build（fresh）
cd packages/api && pnpm run build
# exit 0

# targeted recovery tests（fresh）
cd packages/api && \
  CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 \
  bash ./scripts/with-test-home.sh \
  node --test --test-timeout=60000 \
    test/cat-config-loader.test.js \
    test/mcp-prompt-injector.test.js \
    test/antigravity-agent-service.test.js \
    test/antigravity-streaming.test.js
# 110 passed, 0 failed

# full gate（blocked by unrelated web test）
pnpm gate
# FAIL: packages/web/src/components/__tests__/community-panel-navigation.test.ts:127
# expected pr-row-pr-1 to exist, received null

# same failing test reproduced on current main worktree
cd packages/web && \
  node ./scripts/run-with-node-env-test.mjs \
  pnpm exec vitest run src/components/__tests__/community-panel-navigation.test.ts
# 1 failed / 2 passed, same assertion at line 127
```

### Artifact Hygiene
- `git status --short | rg '^[^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 无命中
- `git diff --name-only origin/main...HEAD | rg '^[^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 无命中

### 相关文档
- Discussion: `docs/discussions/2026-04-12-f061-antigravity-mcp-evolution-design.md`
- Lessons: `docs/stories/three-days-productization/diagnostic-report.md`
- Feature context: `F061`
