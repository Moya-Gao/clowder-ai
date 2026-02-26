---
feature_ids: []
topics: [github, email, watcher]
doc_kind: plan
created: 2026-02-18
---

# GitHub Review Email Watcher 设计方案

> 记录日期：2026-02-18（初版）/ 2026-02-24（更新：砚砚 R1/R2 + 实现）
> 状态：Phase 1+2 已实现，待 review
> 来源：铲屎官 + 布偶猫对话 + 砚砚 review

---

## 背景 & 问题

云端缅因猫（Cloud Codex）review PR 后，当前流程需要布偶猫**手动**去 GitHub 查看结果。铲屎官睡着时没人看，猫猫只能等到下次被调用才能处理 review 意见。

## 方案选型

### 为什么不用 GitHub Actions Webhook？

Cat Cafe 跑在本地（localhost:3002），GitHub 无法推 webhook 到本地。需要公网 endpoint 或 ngrok tunnel，成本高、维度复杂。

### 为什么用邮件监控？

GitHub review 完成时会自动发邮件通知到铲屎官的 QQ 邮箱（@qq.com）。

- QQ 邮箱支持标准 IMAP 协议（`imap.qq.com:993`）
- 无需公网 endpoint，本地 IMAP poll 即可
- GitHub 邮件格式稳定，subject 带 PR 号 + review 类型
- Node.js 有成熟的 `imapflow` 库

---

## 完整流程

```
Cloud Codex review PR
  → GitHub 发邮件到铲屎官 QQ 邮箱
  → Cat Cafe GithubReviewWatcher IMAP 轮询（默认 2 min）
  → 检测到 GitHub review 邮件（from: notifications@github.com）
  → GithubReviewMailParser 解析 subject → PR 号/repo/review 类型/cat 标签
  → ReviewRouter 3 层路由（下文详述）
  → 系统消息发到对应 thread，@mention 对应猫
  → 猫自主处理 review 意见
  → 猫完成后发系统消息通知铲屎官确认合入
```

---

## 3 层路由策略（砚砚 R1/R2 设计）

### Layer 1: PrTrackingStore Registry（主路径）

猫猫提 PR 时通过 `POST /api/pr-tracking` 注册 `{ repoFullName, prNumber, catId, threadId }`。
邮件到达时先查注册表：`repo+pr → catId+threadId`。

**优点**：精确路由到猫的原始对话 thread，上下文连续。

### Layer 2: PR Title Fallback

如果注册表无命中，从 PR title 解析 `[猫名🐾]` 标签。
匹配到猫后，路由到该猫的 **Review Inbox thread**（懒创建，per-cat 单例缓存）。

**适用场景**：PR 未注册（手动开的 PR、旧 PR 等）但 title 含猫名标签。

### Layer 3: Triage（兜底）

注册表无命中 + title 无猫名标签 → 路由到 **铲屎官 Triage thread**。
铲屎官手动指派或补注册。

### 路由结果类型

```typescript
type RouteResult =
  | { kind: 'routed'; threadId: string; catId: string; source: 'registry' | 'fallback' }
  | { kind: 'triage'; threadId: string; reason: string }
  | { kind: 'skipped'; reason: string };  // dedup 命中
```

---

## 去重（Dedup）

1. **IMAP UID 级**：每封邮件只处理一次（`ProcessedEmailStore.isProcessed(uid)`）
2. **PR 级时间窗口**：同一 PR 在 5 分钟内只触发一次（防同一 review 的多封通知）

---

## 关键设计决策

### 1. 猫猫识别：PR title 必须带 `[猫名🐾]` 标签

PR 创建时 title 必须包含作者猫标签，作为 Layer 2 fallback 的路由依据。

| 标签 | 对应猫 | catId |
|------|--------|-------|
| `[布偶猫🐾]` | 布偶猫（Opus/宪宪） | `opus` |
| `[缅因猫🐾]` | 缅因猫（Codex/砚砚） | `codex` |
| `[暹罗猫🐾]` | 暹罗猫（Gemini） | `gemini` |

### 2. 自动唤醒，人工合入

- **猫猫自主处理**：review 处理完全自动化
- **人工最终确认**：merge to main 必须铲屎官明确说"合入"

### 3. PR Tracking API

| Method | Path | 用途 |
|--------|------|------|
| `POST /api/pr-tracking` | 注册 PR 跟踪 | `{ repoFullName, prNumber, catId, threadId }` |
| `GET /api/pr-tracking` | 列出所有跟踪 | 调试/管理 |
| `DELETE /api/pr-tracking/:repo/:pr` | 移除跟踪 | PR 合入后清理 |

安全：`userId` 从 `x-cat-cafe-user` header 读取，不从 body 传入。

### 4. IMAP 配置

```env
GITHUB_REVIEW_IMAP_USER=铲屎官QQ号@qq.com
GITHUB_REVIEW_IMAP_PASS=QQ邮箱授权码
GITHUB_REVIEW_IMAP_HOST=imap.qq.com
GITHUB_REVIEW_IMAP_PORT=993
GITHUB_REVIEW_POLL_INTERVAL_MS=30000
```

---

## 实现文件

### Phase 1: IMAP 基础设施
- `infrastructure/email/GithubReviewMailParser.ts` — Subject 解析 + cat 标签提取
- `infrastructure/email/GithubReviewWatcher.ts` — IMAP 轮询服务
- `infrastructure/email/github-review-bootstrap.ts` — 生命周期管理
- `config/env-registry.ts` — 5 个环境变量注册

### Phase 2: 路由 + 跟踪
- `infrastructure/email/PrTrackingStore.ts` — PR 跟踪注册表（Memory impl）
- `infrastructure/email/ProcessedEmailStore.ts` — 邮件去重层（Memory impl）
- `infrastructure/email/ReviewRouter.ts` — 3 层路由核心逻辑
- `routes/pr-tracking.ts` — PR tracking REST API
- `infrastructure/email/index.ts` — barrel exports

### 测试
- `test/github-review-mail-parser.test.js` — 19 tests（解析）
- `test/pr-tracking-store.test.js` — 7 tests（注册表 CRUD）
- `test/processed-email-store.test.js` — 8 tests（去重）
- `test/review-router.test.js` — 12 tests（3 层路由 + 消息内容）
- **Total: 46 new tests, all pass**

### 依赖
- `imapflow` — Node.js IMAP 客户端

---

## 待做（Phase 3+）→ 已升级为 Connector Messages 抽象

Phase 3 已从 Email Watcher 局部升级为**通用 Connector Messages 抽象**（BACKLOG #97）。
GitHub Review 是第一个 connector，将来 iMessage/Slack 等共享同一框架。

**详见**：[`docs/plans/2026-02-25-connector-messages-phase3.md`](./2026-02-25-connector-messages-phase3.md)

已完成：
- [x] `requesting-cloud-review` skill 自动调 `POST /api/pr-tracking`（Step 2.5, `454fe72`）

待做（在 #97 中追踪）：
- [ ] ConnectorSource 类型 + connectorRegistry（Phase 3a）
- [ ] 前端 connector 气泡（Phase 3a）
- [ ] 自动唤起猫 invoke（Phase 3b）
- [ ] Redis impl for PrTrackingStore + ProcessedEmailStore（Phase 3c）
- [ ] IMAP IDLE 替代轮询（可选优化，待验证 QQ 邮箱支持）
