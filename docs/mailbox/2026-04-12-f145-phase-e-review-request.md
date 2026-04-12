---
doc_kind: review-request
created: 2026-04-12
---

# Review Request: F145 Phase E — Per-Project MCP for ACP Sessions

Review-Target-ID: f145-phase-e
Branch: feat/f145-phase-e
PR: #1113

## What

三处核心改动：

1. **`acp-mcp-resolver.ts`**: `resolveAcpMcpServers` 新增 `userProjectRoot?: string` 参数，读取用户项目目录的 `.mcp.json`，merge 所有 server（不限 whitelist）。三层优先级：内建 cat-cafe-* > whitelist 外部 > 用户项目。
2. **`acp-mcp-resolver.ts`**: 新增 `resolveUserProjectMcpServers` per-invoke helper，用于 adapter 在 invoke 时 merge 用户项目 server（不重复解析 builtins）。
3. **`GeminiAcpAdapter.ts`**: `invoke()` 中从 `options.workingDirectory`（来自 thread.projectPath）per-invocation 解析用户项目 MCP server。

## Why

社区用户用 Cat Cafe 开发自己的项目时，不同项目有不同的 `.mcp.json`（database MCP、docker MCP 等）。当前 Claude Code 和 Codex 原生支持读用户项目 `.mcp.json`，但 Gemini ACP 的 resolver 只读 Cat Cafe monorepo 的 `.mcp.json`。

## Original Requirements（必填）

> "我是想问我们现在能做到 比如说 project a 加载mcp a project b加载mcp b吗？"
> "就是你要考虑社区用户！！他们需要 用我们猫猫咖啡开发他们自己的项目？甚至可能不同的项目？不通项目配置了他们自己不同的mcp？就是这个场景"
- 来源：2026-04-12 铲屎官对话（F149 watchdog 讨论后延伸）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 选择 per-invoke 解析（每次读文件）而非 init-time 缓存。原因：不同 thread 可能指向不同 `projectPath`，缓存增加复杂度且 file read 开销可忽略。
- `resolveUserProjectMcpServers` 是独立导出函数而非 `resolveAcpMcpServers` 内部逻辑。原因：adapter init 时已经解析了 base servers，invoke 时只需增量 merge，避免重复解析 builtins。

## Open Questions

1. `readMcpJson` 用 `readFileSync` 做同步文件读取。在 async generator 中的 per-invoke 路径上这是可接受的吗？（当前 init-time 已经同步读，保持一致）
2. `thread.projectPath` 的 invoke 链传递已完整（`invoke-single-cat.ts:553-570` → `options.workingDirectory`），但仅在 thread 明确设置了 `projectPath` 时生效。社区用户需要通过 thread 设置 project path 触发此功能。

## Next Action

请 review 代码质量 + 优先级逻辑正确性。特别关注 AC-E3（同名 server 去重）和 per-invoke 解析的性能影响。

## 自检证据

### Spec 合规
AC-E1~E5 逐项验证通过。详见 quality-gate report（本对话上文）。

### 测试结果
```
ACP tests (resolver + adapter + session-env) → 74 pass, 0 fail
tsc --noEmit → exit 0
pnpm check (biome) → exit 0
```

### 相关文档
- Feature: `docs/features/F145-mcp-portable-provisioning.md` Phase E
- Related: F149 (ACP runtime operations, watchdog)
