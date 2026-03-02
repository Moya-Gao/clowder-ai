---
feature_ids: [F041]
topics: [capabilities, mcp, skills, quality-gate]
doc_kind: quality-gate-report
created: 2026-03-02
---

## Quality Gate Report — F041 MCP 探活 + Skills 描述展开

Spec: `docs/plans/2026-03-02-mcp-probe-and-skills-description-expand.md`  
原始需求: `docs/discussions/2026-03-02-mcp-probe-and-skill-description/README.md`  
检查时间: 2026-03-02

### 愿景覆盖（Step 0）

| # | 铲屎官原始需求 | 覆盖情况 | 说明 |
|---|---------------|----------|------|
| 1 | MCP 探活 | ✅ | `GET /api/capabilities?probe=true` 增加 tools/list 探测 |
| 2 | 看见 MCP 挂载 tools | ✅ | MCP 卡片展开后显示 tools 名称与描述 |
| 3 | Skills 描述可点击展开完整内容 | ✅ | 卡片展开区域新增完整 `描述:` 区块 |

### 功能验收

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | probe=true 返回 `connectionStatus/tools` | ✅ | `packages/api/src/routes/mcp-probe.ts`, `packages/api/src/routes/capabilities.ts` | `packages/api/test/capabilities-route.test.js` |
| 2 | probe=false 不引入探活字段 | ✅ | 同上 | 同上 |
| 3 | Skills 展开可见完整描述 | ✅ | `packages/web/src/components/capability-board-ui.tsx` | `packages/web/src/components/__tests__/capability-board-ui-description-expand.test.ts` |
| 4 | 前端实际触发 probe | ✅ | `packages/web/src/components/HubCapabilityTab.tsx` | `pnpm build` + 手动逻辑检查 |

### 验证命令输出（本轮新鲜证据）

```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/capabilities-route.test.js
# 20 passed, 0 failed

pnpm --filter @cat-cafe/web test -- capability-board-ui-description-expand.test.ts
# 1 passed, 0 failed

pnpm lint
# exit 0（仅 warnings）

pnpm build
# exit 0

REDIS_URL=redis://localhost:6398/15 CAT_CAFE_REDIS_TEST_ISOLATED=1 pnpm test
# workspace 全量通过（api 2405 passed, mcp-server 38 passed）
```

### 备注

- `pnpm test` 在默认环境会被 Redis 测试门禁拦截（缺少隔离 DB）；按项目约束使用 `REDIS_URL=redis://localhost:6398/15 CAT_CAFE_REDIS_TEST_ISOLATED=1` 后通过。
