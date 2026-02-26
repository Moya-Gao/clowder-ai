---
feature_ids: []
topics: [mcp, create, rich]
doc_kind: mailbox
created: 2026-02-22
---

## Review 请求: 修复 `cat_cafe_create_rich_block` 漏注册（mcp-server）

### 背景
`cat_cafe_create_rich_block` 在 callback-tools 已实现，但 MCP server 启动时未注册，导致猫猫工具列表缺失该能力。

### 设计文档
- Bug Report: `docs/bug-report/mcp-create-rich-block-missing-registration/bug-report.md`
- 相关上下文：`docs/BACKLOG.md` #84（create_rich_block 非 invocation 场景可用性）

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | MCP 工具应对外可见 | ✅ | `createServer()` 已注册 `cat_cafe_create_rich_block` |
| 2 | 注册层有回归测试守护 | ✅ | `tool-registration.test.js` 加入 EXPECTED_TOOLS |
| 3 | mcp-server 测试通过 | ✅ | `pnpm --filter @cat-cafe/mcp-server test` 全绿 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/mcp-server/src/index.ts` | 修改 | 导入并注册 `cat_cafe_create_rich_block` |
| `packages/mcp-server/test/tool-registration.test.js` | 修改 | EXPECTED_TOOLS 加入 `cat_cafe_create_rich_block` |
| `docs/bug-report/mcp-create-rich-block-missing-registration/bug-report.md` | 新增 | 缺陷报告与验证证据 |

### 测试状态
```bash
pnpm --filter @cat-cafe/shared build
pnpm --filter @cat-cafe/mcp-server test
# 38 passed, 0 failed
```

### Review 重点
1. `index.ts` 直接导入 `callback-tools` 的方式是否符合 mcp-server 模块边界。
2. 是否还需要把 `createRichBlockInputSchema/handleCreateRichBlock` 重新导出到 `tools/index.ts`。
3. 是否建议后续重构为统一注册，避免手工漏注册。

### 五件套

**What**: 修复 `cat_cafe_create_rich_block` 在 mcp-server 启动注册链的缺失，并补注册层回归测试。  
**Why**: 该工具实际可用却对猫猫不可见，直接影响富块/语音消息能力。  
**Tradeoff**: 选择最小热修（补注册+补测试），未在本次引入批量自动注册重构。  
**Open Questions**: 是否需要后续统一注册机制与 tools/index 导出面清理。  
**Next Action**: 请 gpt52 聚焦上述 3 个 review 重点给出结论（放行/阻塞）。
