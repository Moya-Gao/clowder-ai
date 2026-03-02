---
feature_ids: [F041]
topics: [capabilities, mcp, skills, review]
doc_kind: mailbox
created: 2026-03-02
---

# Review Request: F041 MCP 探活 + Skills 描述展开

## What

- 新增 MCP 探活模块：对 MCP server 执行短超时 `tools/list`，返回 `connectionStatus/tools`。
- `GET /api/capabilities` 支持 `probe=true`，把探活结果回填到 MCP items。
- 能力中心前端请求改为携带 `probe=true`。
- 卡片展开区新增完整 `描述:`，修复 Skills description 只有截断摘要的问题。
- MCP tools 描述从硬截断改为可完整阅读。
- 补充 Red→Green 回归测试（API + Web）。

## Why

- 能力中心当前 MCP 区域只有“Tools 信息暂不可用”占位，无法定位挂载问题。
- Skills 描述被截断后可读性差，铲屎官无法快速理解 skill 的完整用途。

## Original Requirements（必填）

> “我们的mcp探活功能可以做一下吗？”
> “需要能看到mcp下面挂了什么tools 和我们的skills。”
> “skills 这里 的description 需要让他能够点击展开完整的desciption 现在这样截断很难受。”

- 来源：`docs/discussions/2026-03-02-mcp-probe-and-skill-description/README.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 采用 `probe=true` 显式开关，而不是默认在所有请求上探活；避免在非能力中心场景引入额外进程探测成本。
- 探活失败统一标记为 `disconnected` 并返回空 tools，先保证可观测性；暂未引入错误详情透出，避免泄露环境路径与敏感配置。

## Open Questions

1. 探活超时时间当前固定 2500ms，是否需要通过配置中心可调？
2. 探活失败时是否要在 UI 上补充“重试”按钮（而不是依赖刷新）？
3. 是否要对 `connected` 状态加缓存，减少频繁 toggle 时的重复探测？

## Next Action

请按 P1/P2 标准 review 本次实现与测试覆盖，重点看探活的稳定性和 UI 交互是否满足原需求。

@gpt52

## 自检证据

### Spec 合规

- quality-gate 报告：`docs/mailbox/2026-03-02-mcp-probe-and-skill-description-quality-gate.md`
- 实施计划：`docs/plans/2026-03-02-mcp-probe-and-skills-description-expand.md`

### 测试结果

```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/capabilities-route.test.js
# 20 passed, 0 failed

pnpm --filter @cat-cafe/web test -- capability-board-ui-description-expand.test.ts
# 1 passed, 0 failed

pnpm lint
# exit 0

pnpm build
# exit 0

REDIS_URL=redis://localhost:6398/15 CAT_CAFE_REDIS_TEST_ISOLATED=1 pnpm test
# workspace 全量通过
```

### 相关文档

- Discussion: `docs/discussions/2026-03-02-mcp-probe-and-skill-description/README.md`
- Plan: `docs/plans/2026-03-02-mcp-probe-and-skills-description-expand.md`
- Quality Gate: `docs/mailbox/2026-03-02-mcp-probe-and-skill-description-quality-gate.md`
