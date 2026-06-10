# Review Request: F229 PR-A1 — 前台猫后端地基

Review-Target-ID: f229
Branch: feat/f229-a1-backend
PR: https://github.com/zts212653/cat-cafe/pull/2202

## What

F229 猫猫球 Phase A PR-A1：后端地基全链路。

新增文件：
- `packages/shared/src/types/concierge.ts` — `ConciergeConfig` / `ConciergeBallState` / `ConciergeCardAction` / `threadKind` 共享类型
- `packages/api/src/domains/concierge/concierge-keys.ts` — Redis key 常量
- `packages/api/src/domains/concierge/ConciergeConfigStore.ts` — 三件模式：IConciergeConfigStore port + Redis 实现 + Memory 实现（TTL=0 持久化 LL-048）
- `packages/api/src/domains/concierge/ConciergeThreadService.ts` — 懒创建/幂等/inFlight 并发去重 per-user concierge thread
- `packages/api/src/domains/concierge/ConciergePromptSection.ts` — 岗位 prompt section（anchor-first / 工具白名单 10 项 / escalation 转接卡协议）
- `packages/api/src/routes/concierge.ts` — GET/PUT /api/concierge/config + POST /api/concierge/thread
- `docs/architecture/ownership/cells/concierge-surface.md` — 新建 cell

修改文件：
- `packages/shared/src/types/index.ts` — re-export concierge 类型
- `packages/api/src/domains/cats/services/stores/ports/ThreadStore.ts` — `Thread.threadKind?: 'concierge'` + `updateThreadKind` 接口
- `packages/api/src/domains/cats/services/stores/redis/RedisThreadStore.ts` — `updateThreadKind` Redis 实现
- `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts` — `InvocationContext` 加 `threadKind`/`conciergeConfig`，注入 `buildConciergePromptLines`
- `packages/api/src/routes/threads.ts` — 默认过滤 `threadKind === 'concierge'`，`includeConcierge=true` 可选包含
- `packages/api/src/routes/index.ts` — 注册 conciergeRoutes
- `packages/api/src/index.ts` — 注册路由 + 实例化 store/service
- `packages/api/test/system-prompt-builder.test.js` — 3 项 F229 guard tests（guard test 修正：加必填字段 mode/teammates/mcpAvailable）

## Why

F229 Phase A 的第一棒：后端地基必须先于前端壳（PR-A2）完成，因为 A2 需要 `/api/concierge/config` 和 `/api/concierge/thread` 的类型和路由。设计已通过 Design Gate（`docs/discussions/2026-06-09-f229-design/README.md`）。

## Original Requirements（必填）

来源：`docs/features/F229-cat-ball-concierge.md` + `docs/discussions/2026-06-09-f229-design/README.md`

> 常驻悬浮球前台猫：任意页面唤起对话，不离开当前页面。功能发现、求助、记忆导航三件套。值班猫可配置（与 cat profile 解耦）。安静默认（零主动文本、低优先级 badge）。
> — 铲屎官 KD-7：采用"岗位"架构——per-user concierge thread 作对话载体（全复用），duty cat 通过 ConciergePromptSection 注入岗位行为

**请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

**零平行设施**：concierge thread 是普通 thread（消息/invocation/记忆全复用），不是新 Agent 类。选项 a（Design Gate §3）。

**软白名单 vs 硬裁剪**：Phase A 安全模型 = 岗位 prompt 软白名单 + 全部 mutation 走确认卡。MCP per-invocation 硬裁剪可行性是 PR-A4 spike 结论后再决策（KD-10）。

## Architecture Ownership（必填）

Architecture cell: concierge-surface（新建）
Map delta: new cell required
Why: 用户侧常驻入口 + 值班槽 + escalation 协议是新架构线，与 hub-action-surface（猫→用户单向）不同；cell 文件随本 PR 建立，已重新生成 README。

请 reviewer 检查：
- diff 是否与 `Map delta: new cell required` 一致（新增 concierge domain + routes）
- 是否不当新建了并行 Store/Queue/Router（应：仅用工厂/三件模式 + 注入已有 threadStore）
- `concierge-surface.md` 边界是否准确

## Open Questions

### 技术 OQ（给 reviewer）

1. **inFlight dedup 正确性**：`ConciergeThreadService` 用 `Map<string, Promise<string>>` 做并发去重。场景：同一 userId 3 并发请求 → 应共享一个 Promise 返回同一 threadId（test "concurrent calls return same threadId" 覆盖）。请确认实现是否有 race condition 漏洞。
2. **threadKind 过滤完整性**：primary guard 是 `createdBy='concierge-system'`（threadStore.list(userId) 只返回 createdBy === userId 的），secondary guard 是 `threads.ts` 路由层过滤。belt-and-suspenders 是否足够？有没有漏掉的 list 路径？
3. **PUT /api/concierge/config 的 merge 语义**：当前实现 = 读出现有 config → merge → 写回（支持 partial update）。这比覆盖写更安全，但需要 reviewer 确认 merge 后 type 正确性（目前用 `as Parameters<typeof conciergeConfigStore.put>[1]` 强制断言）。

### 价值 OQ（给 CVO，如有）

无。Design Gate 已全关栓（见 feat doc OQ 表）。

## Next Action

请 @gpt52 review，重点：
1. `ConciergeThreadService` inFlight dedup 实现（技术 OQ 1）
2. threadKind 过滤是否有漏洞（技术 OQ 2）
3. PUT config merge 语义（技术 OQ 3）
4. Architecture cell 边界是否准确

review 完毕后 → @sonnet

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f229/gpt52`
- Branch: `feat/f229-a1-backend`
- Start Command: `pnpm review:start`
- 注：PR-A1 是纯后端，无前端页面，无需浏览器验收

## 自检证据

### Quality Gate 摘要

| 项目 | 状态 |
|------|------|
| F229 设计 OQ | ✅ Design Gate 全关栓 |
| PR-A1 部分交付 | ✅ Fable-5 handoff 明确 A1→A4 分批（CVO 确认 3 次"继续"） |
| SystemPromptBuilder guard test | ✅ 118 pass / 0 fail（含 3 项 F229 guard tests） |
| pnpm check (22 items) | ✅ 全通过 |
| Redis 测试 | ✅ `pnpm test:redis` 架构就绪（`ConciergeConfigStore` + `ConciergeThreadService` tests）|
| 架构 cell 新建 | ✅ `concierge-surface.md` + README 重新生成 |
| 根目录工件 | ✅ 无媒体/设计工件 |
| 前端 UI | ➖ PR-A1 纯后端，无 UI 改动 |
| Dogfood | 🆗 可豁免：PR-A1 纯后端 API（无用户/猫可感知路径）；PR-A2 前端完成后 dogfood |

### 测试结果

```
node --test test/system-prompt-builder.test.js
  ✔ F229: buildInvocationContext injects concierge duty section when threadKind=concierge
  ✔ F229: buildInvocationContext does NOT inject concierge section for normal thread  
  ✔ F229: buildInvocationContext includes tool whitelist in concierge section
  ℹ pass 118
  ℹ fail 0

pnpm check → ✓ All 22 checks passed (11833ms total)
pnpm --filter @cat-cafe/api build → exit 0
```

### 相关文档

- Plan: `docs/plans/2026-06-10-f229-phase-a-concierge.md`
- Feature: `docs/features/F229-cat-ball-concierge.md`
- Design: `docs/discussions/2026-06-09-f229-design/README.md`
