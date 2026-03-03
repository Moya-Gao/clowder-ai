# F051 Quota Probe Architecture Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 将猫粮采集从单体路由重构为可观测的 Probe Registry 架构，并在看板展示探针状态。

**Architecture:** 在 API 层新增统一 probe 描述模型，通过 `/api/quota/probes` 提供采集源元数据；前端在现有猫粮看板消费该元数据并显示状态提示。保留 F051 的手动抓取链路与止血开关，不引入额外抓取频率。

**Tech Stack:** Fastify + TypeScript + Vitest + Node test runner

---

### Task 1: Probe Registry API

**Files:**
- Modify: `packages/api/src/routes/quota.ts`
- Test: `packages/api/test/quota-api.test.js`

1. 写失败测试：`GET /api/quota/probes` 默认返回 official-browser disabled
2. 实现 `QuotaProbeDescriptor` + `listQuotaProbeDescriptors`
3. 增加 `/api/quota/probes` 路由
4. 跑 `pnpm --filter @cat-cafe/api build && node --test packages/api/test/quota-api.test.js`

### Task 2: Hub 显示探针状态

**Files:**
- Modify: `packages/web/src/components/HubQuotaBoardTab.tsx`
- Test: `packages/web/src/components/__tests__/hub-quota-board-v2.test.ts`

1. 写失败测试：`buildOfficialProbeHint` 根据 enabled 输出“已禁用/已启用”
2. 在 `HubQuotaBoardTab` 拉取 `/api/quota/probes` 并渲染提示
3. 跑 `pnpm --filter @cat-cafe/web test -- hub-quota-board-v2`

### Task 3: Feature 真相源同步（F051）

**Files:**
- Modify: `docs/features/F051-real-quota-dashboard.md`
- Modify: `docs/BACKLOG.md`
- Create: `docs/plans/2026-03-03-f051-quota-probe-phase2.md`

1. 在 F051 下补齐 Phase 2 spec（Why/What/AC/Decisions）
2. BACKLOG 维持单一 F051，不新增 feature 编号
3. 回归验证（API + Web）并准备 review 请求给 `@gpt52`
