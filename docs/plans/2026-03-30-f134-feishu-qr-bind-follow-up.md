# F134 Follow-up: Feishu QR Bind in IM Hub — Implementation Plan

**Feature:** F134 — `docs/features/F134-feishu-group-chat.md`
**Goal:** 把 `clowder-ai#287` 的 Feishu QR bind 能力按我们家的 F134/F136 架构手工接入 IM Hub，做到扫码绑定可用、状态刷新正确、配置持久化走统一 secrets/hot-reload 链路。
**Acceptance Criteria:**
- AC-FU1: IM Hub 的飞书配置卡片内可直接发起扫码绑定，不需要离开当前配置面板
- AC-FU2: `POST /api/connector/feishu/qrcode` 返回可显示的二维码 URL 与后续轮询所需的 payload
- AC-FU3: `GET /api/connector/feishu/qrcode-status` 在确认成功后，通过**我们现有的配置写入/热更新链路**持久化 `FEISHU_APP_ID` / `FEISHU_APP_SECRET`（而不是在 route 中复制一套 `.env` 写入逻辑）
- AC-FU4: 当当前模式为 `webhook` 且未配置 `FEISHU_VERIFICATION_TOKEN` 时，扫码成功后自动切到 `websocket`；已有显式模式/verification token 时不擅自覆盖
- AC-FU5: 扫码成功后 IM Hub 状态即时刷新，save hint / configured 状态与后端真实配置一致
- AC-FU6: 现有手动填写飞书配置、现有 Webhook / WebSocket 模式选择、现有 Weixin QR onboarding 均无回归
**Architecture:** 不直接移植 `clowder-ai#287` 的 route-local `.env` 持久化。后端拆成两块：(A) `FeishuQrBindClient` 负责调用飞书 registration API，(B) 可复用的 connector secret updater 负责统一写入 `.env` / `process.env` / `configEventBus`。`connector-hub.ts` 只做编排和 HTTP 出口，前端在现有 `HubConnectorConfigTab` 中内嵌 `FeishuQrPanel`，形态对齐 `WeixinQrPanel`，但成功后刷新的是飞书 connector status。
**Tech Stack:** Fastify route, Node fetch, `configEventBus`, existing `/api/config/secrets` semantics, React client component, Vitest, node:test
**前端验证:** Yes — reviewer 必须在 IM Hub 的飞书卡片里实测扫码面板、状态刷新和 mode 切换文案

---

## Terminal Schema

```typescript
// packages/api/src/infrastructure/connectors/FeishuQrBindClient.ts
export interface FeishuQrCreateResult {
  qrUrl: string;
  qrPayload: string;
  intervalMs: number;
  expireMs: number;
}

export interface FeishuQrPollResult {
  status: 'waiting' | 'confirmed' | 'expired' | 'denied' | 'error';
  appId?: string;
  appSecret?: string;
  error?: string;
}

export interface FeishuQrBindClient {
  create(): Promise<FeishuQrCreateResult>;
  poll(qrPayload: string): Promise<FeishuQrPollResult>;
}

// packages/api/src/config/connector-secret-updater.ts
export interface ConnectorSecretUpdate {
  name: string;
  value: string | null;
}

export interface ConnectorSecretUpdaterOptions {
  envFilePath?: string;
}

export async function applyConnectorSecretUpdates(
  updates: ConnectorSecretUpdate[],
  opts?: ConnectorSecretUpdaterOptions,
): Promise<{ changedKeys: string[] }>;
```

```typescript
// packages/api/src/routes/connector-hub.ts
POST /api/connector/feishu/qrcode
// -> { qrUrl, qrPayload, intervalMs, expireMs }

GET /api/connector/feishu/qrcode-status?qrPayload=...
// -> { status: 'waiting' | 'confirmed' | 'expired' | 'denied' | 'error' }
// confirmed 时内部调用 applyConnectorSecretUpdates([
//   { name: 'FEISHU_APP_ID', value: appId },
//   { name: 'FEISHU_APP_SECRET', value: appSecret },
//   { name: 'FEISHU_CONNECTION_MODE', value: 'websocket' } // 仅在 AC-FU4 条件满足时
// ])
```

## What We're NOT Building

- 不直接 cherry-pick `clowder-ai#287` 的 route 内 `.env` 写入实现
- 不新开第二套 connector config persistence 逻辑（只复用/抽取我们已有链路）
- 不改现有飞书群聊/权限/WebSocket 模式主流程
- 不把 QR bind 扩展成其他 connector 的通用框架（这次只做 Feishu follow-up）
- 不在这一轮解决非公开 registration API 的长期稳定性问题（只做好封装、测试和降级）

---

## Task 1: 抽取统一的 Connector Secret Updater

**Files:**
- Create: `packages/api/src/config/connector-secret-updater.ts`
- Modify: `packages/api/src/routes/config-secrets.ts`
- Test: `packages/api/test/connector-secret-updater.test.js`

**Step 1: Write the failing test**

测试点：
- 写入 allowlist 内的 connector keys 时，`.env` 和 `process.env` 同步更新
- 删除值时会移除 env
- 仅真实变更时返回 `changedKeys`
- 会发出 `configEventBus` 事件（可通过 mock bus 或事件订阅断言）

**Step 2: Run test to verify it fails**

Run:
```bash
pnpm --filter @cat-cafe/api build && node --test packages/api/test/connector-secret-updater.test.js
```

Expected: FAIL（模块不存在）

**Step 3: Write minimal implementation**

- 从 `config-secrets.ts` 抽出共享逻辑到 `connector-secret-updater.ts`
- 保留 `config-secrets.ts` 的 loopback / identity / allowlist / audit，只把“写文件 + 更新 process.env + emit event”收口到共享函数

**Step 4: Rewire existing route**

- `packages/api/src/routes/config-secrets.ts` 改为调用 `applyConnectorSecretUpdates()`
- 确保现有 `/api/config/secrets` 行为不变

**Step 5: Run tests**

Run:
```bash
pnpm --filter @cat-cafe/api build && node --test packages/api/test/connector-secret-updater.test.js packages/api/test/config-secrets.test.js
```

Expected: PASS

**Step 6: Commit**

```bash
git add packages/api/src/config/connector-secret-updater.ts packages/api/src/routes/config-secrets.ts packages/api/test/connector-secret-updater.test.js
git commit -m "feat(F134): extract connector secret updater [砚砚/GPT-5.4🐾]"
```

---

## Task 2: Feishu QR Bind Backend Routes

**Files:**
- Create: `packages/api/src/infrastructure/connectors/FeishuQrBindClient.ts`
- Modify: `packages/api/src/routes/connector-hub.ts`
- Test: `packages/api/test/connector-hub-route.test.js`

**Step 1: Write the failing tests**

在 `connector-hub-route.test.js` 新增用例：
- `POST /api/connector/feishu/qrcode` 返回 `qrUrl` / `qrPayload`
- `GET /api/connector/feishu/qrcode-status` 在 `waiting` 时不写配置
- `GET /api/connector/feishu/qrcode-status` 在 `confirmed` 时写入 `FEISHU_APP_ID` / `FEISHU_APP_SECRET`
- AC-FU4：当当前模式是 `webhook` 且无 `FEISHU_VERIFICATION_TOKEN` 时，额外写入 `FEISHU_CONNECTION_MODE=websocket`
- 当已有 `FEISHU_VERIFICATION_TOKEN` 或显式模式时，不覆盖现值
- 飞书 registration API 返回错误/拒绝/过期时，HTTP 返回对应状态，不污染现有配置

**Step 2: Run tests to verify they fail**

Run:
```bash
pnpm --filter @cat-cafe/api build && node --test packages/api/test/connector-hub-route.test.js
```

Expected: FAIL（Feishu QR routes 不存在）

**Step 3: Implement `FeishuQrBindClient`**

- 封装 registration API 调用，不把 fetch 细节散落在 route 内
- 支持注入 fetch 以便测试
- 明确把非公开 endpoint 风险压在单文件边界内

**Step 4: Implement routes in `connector-hub.ts`**

- 增加 `POST /api/connector/feishu/qrcode`
- 增加 `GET /api/connector/feishu/qrcode-status`
- 路由内调用 `applyConnectorSecretUpdates()`，不直接手写 `.env`
- 复用当前 trusted hub identity guard

**Step 5: Run backend tests**

Run:
```bash
pnpm --filter @cat-cafe/api build && node --test packages/api/test/connector-hub-route.test.js packages/api/test/connector-status.test.js
```

Expected: PASS

**Step 6: Commit**

```bash
git add packages/api/src/infrastructure/connectors/FeishuQrBindClient.ts packages/api/src/routes/connector-hub.ts packages/api/test/connector-hub-route.test.js
git commit -m "feat(F134): add feishu QR bind backend routes [砚砚/GPT-5.4🐾]"
```

---

## Task 3: Feishu QR Panel + IM Hub Integration

**Files:**
- Create: `packages/web/src/components/FeishuQrPanel.tsx`
- Modify: `packages/web/src/components/HubConnectorConfigTab.tsx`
- Test: `packages/web/src/components/__tests__/feishu-qr-panel.test.tsx`
- Test: `packages/web/src/components/__tests__/hub-connector-config-tab.test.tsx`

**Step 1: Write the failing tests**

`feishu-qr-panel.test.tsx`：
- 初始态显示“生成二维码”
- 生成成功后显示二维码与 waiting 文案
- confirmed 后调用 `onConfirmed`
- stale response 不会把终态打回 waiting
- 错误/过期态文案正确

`hub-connector-config-tab.test.tsx`：
- 飞书卡片展开时渲染 `FeishuQrPanel`
- QR confirmed 后触发 `fetchStatus`
- save hint 以 `platform.configured` 为准，不因为局部敏感字段存在而误绿

**Step 2: Run tests to verify they fail**

Run:
```bash
pnpm --filter @cat-cafe/web test -- src/components/__tests__/feishu-qr-panel.test.tsx src/components/__tests__/hub-connector-config-tab.test.tsx
```

Expected: FAIL（组件不存在或未接线）

**Step 3: Implement UI**

- `FeishuQrPanel.tsx` 形态对齐 `WeixinQrPanel.tsx`
- 但确认成功后不走 “connected” 常驻态，而是回调 `fetchStatus()` 刷新平台状态
- 保留 `FEISHU_CONNECTION_MODE` 选择器和 mode-aware steps，不覆盖现有 F134-E UI

**Step 4: Run frontend tests**

Run:
```bash
pnpm --filter @cat-cafe/web test -- src/components/__tests__/feishu-qr-panel.test.tsx src/components/__tests__/hub-connector-config-tab.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/web/src/components/FeishuQrPanel.tsx packages/web/src/components/HubConnectorConfigTab.tsx packages/web/src/components/__tests__/feishu-qr-panel.test.tsx packages/web/src/components/__tests__/hub-connector-config-tab.test.tsx
git commit -m "feat(F134): add feishu QR bind panel in IM Hub [砚砚/GPT-5.4🐾]"
```

---

## Task 4: End-to-End Verification + Review Readiness

**Files:**
- Modify: `docs/features/F134-feishu-group-chat.md`
- Modify: `docs/mailbox/...`（review request 时生成）

**Step 1: Run focused gate**

Run:
```bash
pnpm --filter @cat-cafe/api build
pnpm --filter @cat-cafe/web build
node --test packages/api/test/connector-hub-route.test.js packages/api/test/connector-status.test.js
pnpm --filter @cat-cafe/web test -- src/components/__tests__/feishu-qr-panel.test.tsx src/components/__tests__/hub-connector-config-tab.test.tsx
```

Expected: PASS

**Step 2: Manual verification**

- 打开 IM Hub 飞书卡片
- 确认二维码可显示
- 模拟 confirmed 后，`configured` 变为 true
- 验证 `FEISHU_CONNECTION_MODE` 在无 verification token 的 webhook 初始场景下被切到 websocket

**Step 3: Update feature doc**

- 在 F134 Follow-up 区补充 implementation status / PR 链接（开发完成后）

**Step 4: Request cross-family review**

- Reviewer: `@opus` 或 `@codex` 以外的跨家族 reviewer 优先；若由我写代码，则 reviewer 不能是我自己

---

## Review Focus

- 是否彻底避免了 route-local `.env` 持久化复制
- `applyConnectorSecretUpdates()` 是否与现有 `/api/config/secrets` 语义保持一致
- Feishu QR confirm → status refresh 是否存在 stale response / false green
- manual config、Weixin QR、现有 Feishu Webhook/WebSocket 模式是否零回归

## Next Step

计划已落盘后，**直接加载 `worktree`** 创建 `feat/f134-feishu-qr-bind-follow-up` 隔离分支，然后按 `tdd` 开始实现。
