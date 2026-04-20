# Review Request: antigravity native MCP env recovery

Review-Target-ID: fix-antigravity-mcp-env
Branch: fix/antigravity-mcp-env
Head: c6cc44a0c

## What
- 让 capability orchestrator 真正接管 Antigravity 全局 MCP 配置：`~/.gemini/antigravity/mcp_config.json`
- `mcp-config-adapters` 新增 Antigravity 读写器，给 Cat Café MCP 注入 `CAT_CAFE_API_URL` + `CAT_CAFE_READONLY=true`
- 孟加拉猫 / `antig-opus` 的 `mcpSupport` 从声明层翻正，前后端 UI、runtime CRUD、capabilities routes 同步
- 不改 callback auth 模型；原生 MCP 恢复为 **read-only native MCP**，写回 thread 继续走已有 callback fallback

改动范围共 14 个文件：
- `cat-config.json`
- `cat-template.json`
- `packages/api/src/config/capabilities/capability-orchestrator.ts`
- `packages/api/src/config/capabilities/mcp-config-adapters.ts`
- `packages/api/src/index.ts`
- `packages/api/src/routes/capabilities-mcp-write.ts`
- `packages/api/src/routes/capabilities.ts`
- `packages/api/src/routes/cats.ts`
- `packages/api/test/capability-orchestrator.test.js`
- `packages/api/test/cats-routes-runtime-catalog.test.js`
- `packages/api/test/mcp-config-adapters.test.js`
- `packages/web/src/components/__tests__/cat-config-viewer.test.ts`
- `packages/web/src/components/__tests__/hub-cat-editor.test.tsx`
- `packages/web/src/components/hub-cat-editor.protocols.ts`

## Why
当前症状不是 “Antigravity 不支持 MCP”，而是两层脱节：
1. 编排器只写 `.mcp.json / .codex / .gemini / .kimi`，**从来不写** `~/.gemini/antigravity/mcp_config.json`
2. Antigravity 的 MCP 进程是持久进程，不应该吃 per-invocation callback token；正确恢复姿势应该是 **受管 read-only MCP**，而不是继续暴露一批必炸的 callback 工具

所以这版做的是：
- 恢复 **native MCP config management**
- 恢复 **稳定可用的 read-only env**
- 不把 “新的持久 auth 模型” 混进来

## Original Requirements（必填）
> 为什么他会缺少环境变量，这是第一个问题
> 下个 PR：给 Antigravity 做原生 MCP / env 注入恢复

- 来源：当前 thread `thread_mnux2eewbo4otg17`，铲屎官消息 `0001776681480915-000005-9cc6108c` 与 `0001776681668855-000013-0f136493`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- **没有**给 Antigravity 持久 MCP 进程塞 `CAT_CAFE_INVOCATION_ID / CAT_CAFE_CALLBACK_TOKEN`
- 这版恢复的是 **native read-only MCP**；`post_message/get_thread_context` 这类控制面写操作仍然不走原生 MCP
- 如果以后要让原生 MCP 直接写回 thread，需要另开 PR 设计持久 auth（例如 agent-key 或别的会话外鉴权模型）

## Open Questions
1. `CAT_CAFE_READONLY=true` 作为 Antigravity native MCP 的默认边界是否正确
2. `mcpSupport=true` 现在是否已经足够准确，还是还缺一层 “全局 config 已存在/健康” 的探测
3. 这次 gate 的 `ppt-forge` 超时是否可以继续定性为与本次 diff 无关的 flaky，而不是行为性回归

## Next Action
请你 review：
- Antigravity 全局 `mcp_config.json` 纳管这个方向是否正确
- read-only 边界是否诚实，没有偷偷扩大 native MCP 职责
- 当前 diff 是否严格停留在 “native MCP / env 注入恢复”，没有滑向新的 auth 设计

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/fix-antigravity-mcp-env/opus-47`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- 症状链已查清：
  - `callbackEnv` 在 `invoke-single-cat.ts` 中**有创建**
  - Antigravity provider 不会像 ACP 一样把它 merge 进 session MCP env
  - 当前实际 `~/.gemini/antigravity/mcp_config.json` 中 `cat-cafe.env` 是空对象
- 本轮目标锁定为 “native MCP / env 注入恢复”，没有引入 agent-key / callback auth 新模型

### 测试结果
```bash
# API build
cd packages/api && pnpm run build
# exit 0

# API 定向
cd packages/api && \
  node --test \
    test/mcp-config-adapters.test.js \
    test/capability-orchestrator.test.js \
    test/cats-routes-runtime-catalog.test.js \
    test/cats-routes-runtime-crud.test.js
# 141 passed, 0 failed

# F041 integration
cd packages/api && node --test test/f041-integration.test.js
# 14 passed, 0 failed

# Web 定向
cd packages/web && \
  node ./scripts/run-with-node-env-test.mjs \
    pnpm exec vitest run \
      src/components/__tests__/cat-config-viewer.test.ts \
      src/components/__tests__/hub-cat-editor.test.tsx
# 43 passed, 0 failed

# Full gate
pnpm gate
# 第一次 gate 挂在 packages/ppt-forge/test/density-analyzer.test.ts 的 page.setContent timeout
# 但 main 和当前 worktree 单跑：
#   cd packages/ppt-forge && pnpm exec tsx --test test/density-analyzer.test.ts test/spike-dom-to-pptx.test.ts
# 都是 20 passed, 0 failed
# 第二次 full gate 重新运行中/若 reviewer 接手时可复验该 flaky
```

### Artifact Hygiene
- `git status --short | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 无命中
- `git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 无命中

### 相关文档
- Discussion: `docs/discussions/2026-04-12-f061-antigravity-mcp-evolution-design.md`
- Discussion: `docs/discussions/2026-04-11-antigravity-bengal-cat-self-rescue-plan.md`
- Feature: `docs/features/F061-antigravity-bengal-cat.md`
- Feature: `docs/features/F145-mcp-portable-provisioning.md`
