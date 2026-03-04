---
feature_ids: [F051]
topics: [quota, notification, ui, implementation-plan]
doc_kind: plan
created: 2026-03-03
updated: 2026-03-03
---

# F051 Phase 3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 交付“官方同值猫粮看板 + 系统级通知可达 + 产品级 UI”的一体化体验。

**Architecture:** 保持现有 quota probe 架构不回退，在其上增加通知能力矩阵与投递诊断 API；前端以统一状态模型重构猫粮看板与通知页，保证可读性与可操作性。

**Tech Stack:** Fastify API, React/Next.js, Service Worker(Web Push), Vitest + Node test。

---

### Task 0: 开发环境通知链路打通（前置）

**Files:**
- Modify: `packages/web/next.config.js`
- Modify/Create: `packages/web/src/utils/push-dev-env.ts`（按实现需要）
- Test: `packages/web/src/hooks/__tests__/usePushNotify-subscribe.test.ts`

**Steps:**
1. 写失败测试：开发环境下给出明确通知能力状态（不是静默不可用）。
2. 决策并实现两选一：
   - `dev` 支持 SW（仅 push 相关能力，禁用缓存策略），或
   - 明确 `prod-like` 启动验证流程并在 UI 暴露提示。
3. 更新通知页“环境状态”文案，确保铲屎官可一步判断是否可测。
4. 跑测试确认通知链路在开发流程可验证。

### Task 1: 通知能力矩阵 API（后端）

**Files:**
- Modify: `packages/api/src/routes/push.ts`
- Create/Modify: `packages/api/test/push-routes.test.js`（或同目录既有测试文件）

**Steps:**
1. 写失败测试：`GET /api/push/status` 返回 capability + subscription + delivery hints。
2. 实现最小接口：输出 `supported/enabled/subscribedCount/lastDelivery/errorHints`。
3. 运行测试确认通过。

### Task 2: 测试投递结果结构化（后端）

**Files:**
- Modify: `packages/api/src/routes/push.ts`
- Modify: `packages/api/test/push-routes.test.js`

**Steps:**
1. 写失败测试：`/api/push/test` 返回统一 `deliverySummary` 字段（attempted/delivered/failed/removed）。
2. 实现结构化返回并保留错误分支可读信息。
3. 回归现有 push 测试。

### Task 3: 通知设置页重构（前端）

**Files:**
- Modify: `packages/web/src/components/PushSettingsPanel.tsx`
- Modify: `packages/web/src/hooks/usePushNotify.ts`
- Test: `packages/web/src/components/__tests__/push-settings-panel.test.ts`

**Steps:**
1. 写失败测试：渲染能力矩阵、设备状态、测试投递摘要与修复建议。
2. 实现 UI：从“开关 + 链接”升级为“状态卡 + 操作区 + 诊断区”。
3. 回归测试并补齐异常态断言。

### Task 4: 猫粮看板 UI 产品化重做（前端）

**Files:**
- Modify: `packages/web/src/components/HubQuotaBoardTab.tsx`
- Modify: `packages/web/src/components/quota-cards/*`（按实际文件）
- Test: `packages/web/src/components/__tests__/hub-quota-board-v2.test.ts`

**Steps:**
1. 先输出文字版 wireframe（桌面/移动）并经铲屎官确认。
2. 写失败测试：状态层级（ok/error/disabled）与动作提示可见。
3. 实现视觉重构：标题层、风险层、操作层、更新时间层。
4. 确认移动端布局不塌陷。

**UI Direction（v1）**
- 信息层级：`总览条 -> 平台卡片 -> 告警区 -> 操作区`
- 视觉风格：浅底对比卡片、状态色统一（正常绿/风险橙/失败红）
- 卡片语义：每张卡必须同时显示 `当前值 + 状态 + 下一步动作`
- 约束：避免“纯文本堆叠”，每一屏最多一个主按钮

### Task 5: 阈值告警与去重策略

**Files:**
- Modify: `packages/api/src/routes/messages.ts` / `packages/api/src/routes/quota.ts`（按触发点）
- Modify: `packages/web/src/utils/push-notification-policy.ts`
- Test: `packages/web/src/utils/__tests__/push-notification-policy.test.ts`

**Steps:**
1. 写失败测试：同线程短时间重复事件不刷屏；决策类通知强提醒。
2. 实现 tag/窗口去重策略与阈值事件触发。
3. 回归已有通知策略测试。

### Task 6: 质量门禁与证据

**Files:**
- Modify: `docs/features/F051-real-quota-dashboard.md`
- Create: `docs/mailbox/2026-03-03-f051-phase3-quality-gate.md`

**Steps:**
1. 更新 AC 完成状态与需求映射。
2. 附上桌面/移动端截图与“需求→证据”映射。
3. 准备 review 请求（跨家族 reviewer）。
