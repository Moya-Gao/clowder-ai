---
feature_ids: [F041]
topics: [review, capability, dashboard, mcp]
doc_kind: review-request
created: 2026-02-27
---

## Review 请求: F041 能力看板 — Hub MCP/Skills 统一管理

### 背景

铲屎官 2026-02-26 明确提出："我都不知道你们三只猫到底挂了什么！"

F041 实现了：
1. `.cat-cafe/capabilities.json` 作为唯一真相源，自动生成三猫 CLI 配置
2. Hub 新增「能力看板」tab，展示所有 MCP + Skills，支持过滤和开关
3. 三猫统一走原生 MCP，HTTP callback 降级为 fallback
4. McpPromptInjector 收敛为降级短路注入

### 设计文档

- Spec: `docs/features/F041-capability-dashboard.md`
- Discussion: `docs/discussions/2026-02-26-capability-dashboard/README.md`
- Tech Discussion: `docs/discussions/2026-02-26-capability-dashboard/tech-discussion-open-questions.md`
- Research (Codex MCP): `docs/research/codex-支持动态加载mcp.md`
- Research (Gemini MCP): `docs/research/gemini-cli支持动态加载mcp.md`

### Spec Compliance 自检

| # | Spec 要求 | 状态 | 代码位置 |
|---|-----------|------|----------|
| 1 | Hub 能力看板 tab 无硬编码假数据 | ✅ | `HubCapabilityTab.tsx` |
| 2 | 按类型/来源过滤 | ✅ | `HubCapabilityTab.tsx:77-81` |
| 3 | 全局开关 | ✅ | `capabilities.ts` PATCH `scope:'global'` |
| 4 | 每猫覆盖 | ✅ | `capabilities.ts` PATCH `scope:'cat'` |
| 5 | 猫 tab 精简 | ✅ | `config-viewer-tabs.tsx` |
| 6 | `.cat-cafe/capabilities.json` 唯一真相源 | ✅ | `capability-orchestrator.ts` |
| 7 | 编排器生成三猫 CLI 配置 | ✅ | `mcp-config-adapters.ts` + `capability-orchestrator.ts` |
| 8 | 三猫原生 MCP | ✅ | `cat-config.json` all `mcpSupport: true` |
| 9 | McpPromptInjector 降级短路 | ✅ | `McpPromptInjector.ts:39` |
| 10 | 多项目隔离 | ✅ | `.cat-cafe/` per-project |
| 11 | 降级路径 | ✅ | `route-serial.ts:102` `mcpAvailable` check |
| 12 | 热加载验证 | ✅ | PATCH → persist → regenerate CLI configs |

### 改动文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `packages/shared/src/types/capability.ts` | 新增 | 统一能力类型定义 |
| `packages/shared/src/types/index.ts` | 修改 | 导出 capability 类型 |
| `packages/api/src/config/capabilities/mcp-config-adapters.ts` | 新增 | 三格式读写适配器 |
| `packages/api/src/config/capabilities/capability-orchestrator.ts` | 新增 | 配置编排器 |
| `packages/api/src/routes/capabilities.ts` | 重写 | GET 返回 `CapabilityBoardItem[]`，新增 PATCH |
| `packages/api/src/domains/.../McpPromptInjector.ts` | 修改 | `mcpSupport` → `mcpAvailable` 参数语义变更 |
| `packages/api/src/domains/.../route-serial.ts` | 修改 | 计算 `mcpAvailable` 传入 |
| `packages/api/src/domains/.../route-parallel.ts` | 修改 | 同上 |
| `cat-config.json` | 修改 | 全部 8 variants `mcpSupport: true` |
| `packages/web/src/components/HubCapabilityTab.tsx` | 新增 | 能力看板 UI |
| `packages/web/src/components/CatCafeHub.tsx` | 修改 | 新增 capabilities tab |
| `packages/web/src/components/config-viewer-tabs.tsx` | 修改 | 移除假数据，精简猫 tab |
| `packages/api/test/mcp-config-adapters.test.js` | 新增 | 24 tests |
| `packages/api/test/capability-orchestrator.test.js` | 新增 | 19 tests |
| `packages/api/test/f041-integration.test.js` | 新增 | 11 red-green integration tests |
| `packages/api/test/capabilities-route.test.js` | 重写 | 7 tests |
| `packages/api/test/mcp-prompt-injector.test.js` | 修改 | 更新描述 |
| `packages/api/test/integration/mcp-prompt-e2e.test.js` | 修改 | 更新注释 |
| `packages/api/test/mock-agent-integration.test.js` | 修改 | 适配新 API 格式 |
| `.gitignore` | 修改 | 忽略 `.cat-cafe/` |
| `packages/api/package.json` | 修改 | 添加 `smol-toml` 依赖 |

### Git SHA

- Base: `ef5a235` (origin/main)
- Head: `dfbd380` (feat/f041-capability-dashboard)
- Commits: 6 (5 implementation + 1 .gitignore)

### 测试状态

```
pnpm --filter @cat-cafe/api test: 2042 passed, 0 failed, 1 skipped
```

### Review 重点

1. **配置编排安全性**：`capability-orchestrator.ts` 的 bootstrap 逻辑——发现、去重、生成是否正确？
2. **PATCH 覆盖逻辑**：`capabilities.ts` 的 per-cat override upsert + cleanup 是否有边界遗漏？
3. **mcpAvailable 语义变更**：`route-serial.ts:102` 和 `route-parallel.ts:67` 的 `mcpAvailable = mcpSupport && !!mcpServerPath`——是否覆盖了所有降级场景？
4. **TOML 读写**：`mcp-config-adapters.ts` 的 Codex TOML 适配——保留非 MCP section 的逻辑是否健壮？
5. **能力真空防护**：翻 `mcpSupport=true` 后，如果 `.cat-cafe/capabilities.json` 尚未 bootstrap，是否仍安全？

### 五件套

**What**: F041 完整实现——配置适配器 + 编排器 + 统一 API + 看板 UI + mcpSupport 翻转 + 红绿测试

**Why**: 铲屎官需要知道三猫挂了什么工具，并能统一管理开关。旧架构假设"只有 Claude 支持 MCP"已被砚砚实测推翻，三猫都支持原生 MCP。

**Tradeoff**:
- 选择 `.cat-cafe/capabilities.json` 作为真相源而非直接读写三猫 CLI 配置，增加了一层抽象但获得了统一视图
- Codex TOML 格式需要 `smol-toml` 新依赖（零依赖，6KB）
- 没有做 Skills 的动态开关（当前只展示，不控制），留给后续

**Open Questions**:
- Gemini CLI `--session` 模式下的动态开关是否需要额外处理？（砚砚确认暂无可复现 bug）
- Skills 过滤按猫加载范围控制待后续 Feature

**Next Action**: 请 review 上述 21 个文件，重点关注 Review 重点 1-5
