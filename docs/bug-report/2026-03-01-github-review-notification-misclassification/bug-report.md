---
feature_ids: [F039]
debt_ids: [TD091]
topics: [github, email, imap, review, notifications]
doc_kind: bug-report
created: 2026-03-01
---

# Bug Report: GitHub review 邮件通知误判（伪通知 + reviewType unknown + UI 颜色混淆）

- 报告人：铲屎官（2026-03-01 现场截图）
- 影响范围：GitHub Review → IMAP watcher → ReviewRouter → Connector bubble（猫猫收不到/被噪音误导）

## 1) 复现步骤

### Case A：伪通知（环境提示）占位
1. 在 PR 下触发 `@codex review`
2. GitHub 的 `chatgpt-codex-connector[bot]` 可能先发一条提示：`To use Codex here, create an environment for this repo.`
3. 我们的 IMAP watcher 仅凭 subject 判断“这是 PR review 邮件”，导致这条“环境提示”也被路由成 **GitHub Review 通知**

### Case B：真实 review 但 reviewType=unknown / 或被漏掉
1. `chatgpt-codex-connector[bot]` 给出真正 review（GitHub UI 显示 “reviewed”）
2. GitHub 发邮件到收件箱（subject 常是 `Re: [owner/repo] ... (PR #N)`）
3. 旧实现只解析 subject，不读 body → `reviewType` 无法区分 `reviewed` vs `commented`，容易出现 `unknown`
4. 同时 “环境提示” 与 “真实 review” 都长得像同一类通知，猫猫会被误导，以为 review 已完成或需要开权限

### Case C：UI 颜色混淆
1. Connector bubble（外部来源消息）固定使用蓝色主题
2. GitHub Review 也用相同蓝色 → 与其它系统蓝色提示/暹罗猫视觉风格混在一起，不利于一眼识别

## 2) 期望 vs 实际

- 期望：
  - “环境提示”不应当被当成 review 通知（至少要清晰标识/降噪）
  - 真实 review 应当能稳定路由，并且 `reviewType` 能识别为 `reviewed/commented/...`
  - GitHub Review 的 connector 气泡视觉上应更像“外部 Inbox”，而不是通用蓝色系统提示
- 实际：
  - “环境提示”被当成 review 通知（噪音）
  - 真实 review 可能显示 `unknown`，甚至被误以为没到
  - UI 颜色区分度低

## 3) 根因分析

1. `GithubReviewWatcher` 只 fetch IMAP envelope（from/subject），不读取邮件正文
2. `parseGithubReviewSubject()` 只能从 subject 的 action 关键字推导 `reviewType`，而 bot 通知常只有 `(PR #N)`，action 在 body
3. UI 侧 `ConnectorBubble` 对所有 connector 使用同一套蓝色主题，缺少按 `source.connector` 分流

## 4) 修复方案

### 后端：正文推断 + 降噪
- IMAP fetch 增加 `source: true`
- 新增 `inferReviewActionFromEmailSource(source)`：
  - body 含 `reviewed` → `reviewType='reviewed'`
  - body 含 `left a comment` → `reviewType='commented'`
  - body 含 `To use Codex here, create an environment...` → `ignorable=true`（跳过路由）
- 当 subject 推断为 `unknown` 时，用 body 推断结果覆盖；同时补齐 `reviewer`

### 前端：GitHub Review 主题分流
- `ConnectorBubble` 按 `source.connector` 选择主题
- `github-review` 使用 slate（灰）主题，避免与通用蓝色混淆

## 5) 验证方式

- UT：
  - `packages/api/test/github-review-mail-body-classifier.test.js`（3 cases）
  - `packages/web/src/components/__tests__/connector-bubble-theme.test.ts`（github-review theme）
- Build：
  - `pnpm --filter @cat-cafe/api run build`
  - `pnpm --filter @cat-cafe/web test <single file>`

