---
feature_ids: [F051]
topics: [quota, menu-bar, widget, swiftbar, implementation-plan]
doc_kind: plan
created: 2026-03-03
updated: 2026-03-03
---

# F051 Phase 4-5 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 交付 F051 Phase 4/5 的第一版可用能力：菜单栏摘要（SwiftBar）+ 小组件页面（Widget 路由）+ 统一摘要 API。

**Architecture:** 复用现有 `/api/quota` + `/api/quota/probes` 数据源，在 API 侧新增稳定的 `/api/quota/summary` 聚合层；菜单栏和 Widget 都消费 summary，避免各端重复拼装和语义漂移。

**Tech Stack:** Fastify API, Next.js/React, SwiftBar shell script, Node test + Vitest。

---

### Task 1: 新增 quota summary API（后端）

**Files:**
- Modify: `packages/api/src/routes/quota.ts`
- Modify: `packages/api/test/quota-api.test.js`

**Step 1: 写失败测试**
- 新增 `GET /api/quota/summary` 用例，断言返回 `risk/probes/platforms/fetchedAt` 结构。
- 新增风险语义断言：`official disabled -> warn`、`high utilization -> high`。

**Step 2: 运行测试确认红灯**
- Run: `pnpm --filter @cat-cafe/api test -- quota-api.test.js`

**Step 3: 写最小实现**
- 在 quota route 增加 summary types + risk 计算函数。
- 注册 `GET /api/quota/summary` 路由，输出轻量聚合结构。

**Step 4: 运行测试确认绿灯**
- Run: `pnpm --filter @cat-cafe/api test -- quota-api.test.js`

### Task 2: 菜单栏插件（SwiftBar）

**Files:**
- Create: `scripts/swiftbar/cat-cafe-quota.1m.sh`
- Create: `docs/guides/swiftbar-menubar-setup.md`

**Step 1: 写基础脚本**
- 顶栏显示：风险色 + 当前可用额度摘要。
- 下拉菜单显示：平台详情、探针状态、最后检查时间、手动刷新命令。

**Step 2: 本地脚本验证**
- Run: `bash scripts/swiftbar/cat-cafe-quota.1m.sh`

### Task 3: Widget 页面（前端）

**Files:**
- Create: `packages/web/src/components/QuotaSummaryWidget.tsx`
- Create: `packages/web/src/app/widget/quota/page.tsx`
- Create: `packages/web/src/components/__tests__/quota-summary-widget.test.tsx`

**Step 1: 写失败测试**
- 断言 `warn/high/ok` 风险文案和样式分支。
- 断言“下一步动作”提示来自 summary。

**Step 2: 运行测试确认红灯**
- Run: `pnpm --filter @cat-cafe/web test -- quota-summary-widget`

**Step 3: 写最小实现**
- 构建轻量卡片布局，支持移动端优先。
- 30 秒轮询 summary，支持手动刷新。

**Step 4: 运行测试确认绿灯**
- Run: `pnpm --filter @cat-cafe/web test -- quota-summary-widget`

### Task 4: 文档收口 + review 准备

**Files:**
- Modify: `docs/features/F051-real-quota-dashboard.md`
- Create: `docs/mailbox/2026-03-03-f051-phase45-quality-gate.md`
- Create: `docs/mailbox/2026-03-03-f051-phase45-review-request-to-gpt52.md`

**Steps:**
1. 回填 AC 与路线图状态（Phase 4/5 已落地的范围和边界）。
2. 记录验证命令输出和截图证据映射（widget + menu bar 输出）。
3. 发 review 请求给 `@gpt52`，等待复审。
