---
doc_kind: review-request
feature_ids: [F145]
created: 2026-03-27
review_target_id: f145
branch: feat/f145-mcp-portable-provisioning
reviewer: opus
author: gpt52
---

# Review Request: F145 Phase A — MCP Portable Provisioning

Review-Target-ID: f145
Branch: feat/f145-mcp-portable-provisioning

## What

实现 F145 Phase A 的最小闭环：

- 给 `McpServerDescriptor` 增加 `resolver`，允许 resolver-backed MCP 不再把机器特定绝对路径写进 `capabilities.json`
- 用 `pencil` 作为试点，把本机解析结果落到 `.cat-cafe/mcp-resolved.json`
- 生成 Claude/Codex/Gemini MCP 配置时，改为“先解析再写出”；unresolved 时不再写坏路径
- 删除 Gemini 针对 stale pencil path 的临时绕路
- 补 resolver migration / config generation / probe 的回归测试

## Why

F041 只做到了“统一真相源 + 自动生成三份 CLI 配置”，但真相源里混进了机器态。结果是：

- 新机器 clone 下来会带着旧机器的 pencil 绝对路径
- pencil 只认 Antigravity，不认 VS Code 扩展
- Gemini 要靠 workaround 躲 stale path

这轮先不做通用 resolver 框架，只把 pencil 这条真实痛点链路跑通。

## Original Requirements

> "我搞了一个新电脑，要把你们从 GitHub 下载回来，然后我这些 MCP 如果还要我自己一个个去挂就很奇怪了。"
> "我们现在就有个 bug，pencil MCP 写死用 antigravity 的插件，但是 vscode 其实也有插件，是一个东西。"

- 来源：`docs/features/F145-mcp-portable-provisioning.md`
- **请对照上面的摘录判断交付物是否真的解决了“新机器 clone 后 MCP 可移植 + pencil 双宿主”这两个核心问题**

## Tradeoff

- 没上通用 provisioner / resolver registry，只做 `pencil` 单 case
- 没把 `playwright @latest` pin 版本，这个仍是 follow-up
- 没进入 Phase B；`manifest requires_mcp` 和 doctor 报告还没做

## Open Questions

- `hasUsableTransport()` 对 resolver-backed stdio MCP 的放宽是否只影响我们预期的路径，不会把别的“空 command”错误放行
- stale path migration 是否足够稳妥；现有 `.cat-cafe/capabilities.json` 被清洗成 resolver 形态时有没有漏掉兼容点
- unresolved 时我们现在选择“配置里直接省略该 MCP + probe 返回 unknown”，这个语义是否合适

## Next Action

请按严格标准 review：

- 先看 resolver gating 有没有把旧 enablement 逻辑改坏
- 再看 migration / resolved-state / config adapters 三段链路是否闭合
- 最后挑测试盲区，不要顺着我来

## 自检证据

### Spec 合规

- AC-A1: pencil 不再把机器绝对路径留在 `capabilities.json`；bootstrap / route 入口都带 migration
- AC-A2: 解析顺序为 `PENCIL_MCP_BIN` → Antigravity → VS Code → unresolved
- AC-A3: `.cat-cafe/mcp-resolved.json` 读写已实现并有回归测试
- AC-A4: unresolved 时不把坏路径写进 `.mcp.json` / `.codex/config.toml` / `.gemini/settings.json`
- AC-A5: Gemini pencil workaround 已删除
- AC-A6: resolver / route / adapter / integration 相关测试已补并通过
- AC-A7: resolver-backed MCP 不再被旧 `hasUsableTransport()` 误判 disabled

### 设计稿对照

- `find designs -name '*.pen' | rg 'F145|pencil|mcp|capability'` → 无匹配
- 本次无前端 UI 改动

### Artifact Hygiene

- `git status --short | rg '^\\?\\? [^/]+\\.(png|jpe?g|webm|mp4)$'` → 无输出

### 测试结果

- `pnpm --filter @cat-cafe/shared run build` → pass
- `pnpm --filter @cat-cafe/api run build` → pass
- `cd packages/api && node --test test/capability-orchestrator.test.js test/mcp-config-adapters.test.js` → 78/78 pass
- `cd packages/api && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 node --test test/capabilities-route.test.js` → 23/23 pass
- `cd packages/api && node --test test/f041-integration.test.js` → 14/14 pass
- `pnpm lint` → pass（仓库既有 web warnings，不是 error）
- `pnpm -r --if-present run build` → pass
- `pnpm check:features` → pass
- `pnpm check:env-ports` → pass
- `pnpm check` → **blocked by pre-existing unrelated formatter error** at `packages/api/src/domains/cats/services/agents/invocation/InvocationQueue.ts`
- `pnpm test` → **blocked by environment-level unrelated Redis isolation guard** at `packages/api/test/workflow-sop-store.test.js` (`REDIS_URL` set without `CAT_CAFE_REDIS_TEST_ISOLATED=1`)

### 相关文档

- Feature: `docs/features/F145-mcp-portable-provisioning.md`
- Related: `docs/features/F041-capability-dashboard.md`
- Related: `docs/features/F043-mcp-unification.md`
