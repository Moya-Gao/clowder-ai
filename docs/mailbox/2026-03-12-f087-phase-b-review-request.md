# Review Request: F087 Phase B — Bootcamp Runtime Tools

## What

给猫猫补上 bootcamp-guide skill 需要的 MCP 工具，让训练营引导流程能真正跑起来。

核心变更：
1. **Callback route**: `POST /api/callbacks/update-bootcamp-state` — 猫猫推进训练营 phase + 更新 leadCat/selectedTaskId 等
2. **Callback route**: `POST /api/callbacks/bootcamp-env-check` — 猫猫触发环境检测 + 自动存结果到 bootcampState
3. **MCP tools**: `cat_cafe_update_bootcamp_state` + `cat_cafe_bootcamp_env_check`（两个新 MCP 工具注册到 callback-tools.ts）
4. **Env check 重构**: 从 bootcamp.ts 提取到共享 helper（`env-check.ts`），GET 和 callback 端点复用
5. **Skill 更新**: bootcamp-guide SKILL.md 添加具体 MCP 工具引用（之前写 "PATCH /api/threads" 但猫猫没有对应工具）

## Why

Phase A 建了数据层（bootcampState schema/API/Redis/前端入口），但猫猫作为 Claude agent 通过 MCP 工具与后端交互——Phase A 没有提供 MCP 工具来更新训练营状态或调用环境检测。Phase B 补上这个缺口。

## Original Requirements（必填）

> "gogogo 按照家规不要什么都老问～ 现在进入大猫猫你们自治区了！为我交付完整的f87"
> "你别再问啦。你跟你的小伙伴直接自主闭环。"

- 来源：Thread `thread_mmloli8kv9kelsl2`，2026-03-11~12
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **不做 phase transition validation**（不强制顺序）— 猫猫是自主 agent，服务端不需要强制 phase 顺序。过度工程。
- **不做前端改动** — Interactive Rich Block 渲染已由 F096 完成，Phase B 只需后端工具。
- **用 `as unknown as BootcampStateV1` 绕过 exactOptionalPropertyTypes** — Zod 的 optional 产出 `T | undefined` 而 BootcampStateV1 用 `T?`，类型不兼容。运行时安全（Zod 验证过了）。

## Open Questions

1. **callback-tools.ts 新增 ~74 行**：两个工具定义 + handler，是否合理？还是应该拆到独立文件？
2. **env-check 自动存储**：`POST /api/callbacks/bootcamp-env-check` 除了返回结果还自动写入 bootcampState.envCheck——这个"副作用"是否应该拆开？

## Next Action

请 review 代码质量 + 架构合理性。

## 自检证据

### Spec 合规

| # | Phase B 要求 | 状态 | 代码位置 |
|---|-------------|------|----------|
| 1 | 猫猫能更新 bootcamp 状态 | ✅ | callback-bootcamp-routes.ts |
| 2 | 猫猫能调用环境检测 | ✅ | callback-bootcamp-routes.ts + env-check.ts |
| 3 | MCP 工具定义 | ✅ | callback-tools.ts |
| 4 | Skill 工具引用 | ✅ | bootcamp-guide/SKILL.md |
| 5 | 全流程集成测试 | ✅ | bootcamp-flow.test.js |

### 测试结果

```
pnpm test (bootcamp suite) → 26/26 pass, 0 failed ✅
pnpm lint → 0 new errors (warnings pre-existing) ✅
pnpm biome check (changed files) → 0 errors ✅
pnpm build → exit 0 ✅
```

基线失败（非 Phase B 引入）：system-prompt-builder size guard tests (8)

### 相关文档

- Feature: `docs/features/F087-cvo-bootcamp.md`
- Plan: `docs/plans/2026-03-12-f087-phase-b-bootcamp-runtime.md`
- Phase A: PR #375 (merged `d26feec3`)
