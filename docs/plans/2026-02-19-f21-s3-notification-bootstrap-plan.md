---
feature_ids: [F021]
topics: [notification, bootstrap]
doc_kind: plan
created: 2026-02-19
---

# F21 S3 Notification Bootstrap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 F21 S3 落地可测试的通知基础能力：加载通知配置、渲染日报模板、发送邮件摘要。

**Architecture:** 在 `domains/signals` 内新增 `notifications-loader`（配置来源）、`daily-digest` 模板（内容渲染）、`email-service`（传输封装）。服务边界保持纯函数/DI 优先，避免提前耦合调度脚本和路由。

**Tech Stack:** TypeScript, Zod, YAML, Nodemailer, Node test runner。

---

### Task 1: 通知配置加载器（TDD）

**Files:**
- Create: `packages/api/src/domains/signals/config/notifications-loader.ts`
- Create: `packages/api/test/signal-notifications-loader.test.js`

**Step 1: 写失败测试**
- 缺失 `notifications.yaml` 时写入默认配置并返回。
- 读取合法 YAML 配置并通过 schema。
- 非法配置（例如 email.to 非邮箱）时报错并包含字段路径。

**Step 2: 跑红灯**
Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signal-notifications-loader.test.js`
Expected: FAIL（模块不存在）。

**Step 3: 最小实现**
- 定义 `SignalNotificationConfigSchema`。
- 实现 `loadSignalNotifications(paths?)` 与 `ensureSignalNotificationsFile(paths?)`。

**Step 4: 跑绿灯**
执行同命令，Expected: PASS。

---

### Task 2: 日报模板渲染（TDD）

**Files:**
- Create: `packages/api/src/domains/signals/templates/daily-digest.ts`
- Create: `packages/api/test/signal-daily-digest-template.test.js`

**Step 1: 写失败测试**
- 生成 subject：`🐱 Cat Café 信号日报 - YYYY-MM-DD`。
- HTML 包含 tier 分组、标题链接、来源、摘要。
- 输入空文章时生成“今日无新增”的降级文案。

**Step 2: 跑红灯**
Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signal-daily-digest-template.test.js`
Expected: FAIL。

**Step 3: 最小实现**
- `renderDailyDigestEmail(input)` 返回 `{ subject, html, text }`。
- tier 排序（1→4）+ source/title/summary 渲染。

**Step 4: 跑绿灯**
执行同命令，Expected: PASS。

---

### Task 3: 邮件服务封装（TDD）

**Files:**
- Create: `packages/api/src/domains/signals/services/email-service.ts`
- Create: `packages/api/test/signal-email-service.test.js`
- Modify: `packages/api/package.json`（添加 nodemailer）

**Step 1: 写失败测试**
- `enabled=false` 时返回 skipped，不发送。
- `enabled=true` 时调用 transporter.sendMail，并带上 subject/html/text。
- send 失败时返回结构化错误，不 throw 给调用方。

**Step 2: 跑红灯**
Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signal-email-service.test.js`
Expected: FAIL。

**Step 3: 最小实现**
- `SignalEmailService.sendDailyDigest(...)`。
- DI 注入 transporter 工厂（默认 nodemailer.createTransport）。
- 严格使用配置中的 SMTP/recipient 字段，禁止硬编码。

**Step 4: 跑绿灯**
执行同命令，Expected: PASS。

---

### Task 4: 导出与回归验证

**Files:**
- Modify: `packages/api/src/domains/signals/services/index.ts`

**Step 1: 导出新服务**
- 导出 `SignalEmailService`。

**Step 2: 回归验证**
Run:
- `pnpm --filter @cat-cafe/shared run build`
- `pnpm --filter @cat-cafe/api run build`
- `node --test packages/api/test/signal-notifications-loader.test.js packages/api/test/signal-daily-digest-template.test.js packages/api/test/signal-email-service.test.js packages/api/test/rss-fetcher.test.js packages/api/test/api-fetcher.test.js packages/api/test/webpage-fetcher.test.js packages/api/test/signal-deduplication.test.js packages/api/test/signal-sources-loader.test.js packages/api/test/signal-article-store.test.js packages/api/test/signals-shared-contract.test.js`

Expected: PASS。

---

### Task 5: 提交与请求 review

**Step 1: 提交**
```bash
git add docs/plans/2026-02-19-f21-s3-notification-bootstrap-plan.md \
  packages/api/src/domains/signals/config/notifications-loader.ts \
  packages/api/src/domains/signals/templates/daily-digest.ts \
  packages/api/src/domains/signals/services/email-service.ts \
  packages/api/src/domains/signals/services/index.ts \
  packages/api/test/signal-notifications-loader.test.js \
  packages/api/test/signal-daily-digest-template.test.js \
  packages/api/test/signal-email-service.test.js \
  packages/api/package.json pnpm-lock.yaml

git commit -m "feat(signals): bootstrap s3 notification services [缅因猫🐾]" \
  -m "Why: establish configurable digest notification pipeline before scheduler integration."
```

**Step 2: 请求布偶猫 review**
- 五件套 + Red→Green 证据。

---

## DoD

1. `notifications.yaml` 默认生成、可验证加载。
2. 日报模板可输出 HTML/Text。
3. 邮件服务可在测试中验证发送/跳过/错误分支。
4. 本轮新增测试与 signals 相关回归全绿。
