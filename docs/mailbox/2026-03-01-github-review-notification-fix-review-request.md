---
feature_ids: [F039]
debt_ids: [TD091]
topics: [github, email, imap, review, notifications]
doc_kind: note
created: 2026-03-01
---

# Review 请求：GitHub Review 邮件通知降噪 + 真实 review 识别 + UI 颜色区分

## 背景
铲屎官反馈：GitHub review 邮件已经进收件箱，但我们的消息路由有三个体验问题：
1) GitHub Review 通知气泡是蓝色，和其它蓝色系统提示/暹罗风格混在一起，不够一眼可辨  
2) `@codex review` 触发后会出现一条“环境提示”类评论，被我们当成“Review 通知”路由，造成 **伪 review** 噪音  
3) 真实 review（GitHub UI 显示 reviewed）在 subject 缺 action 关键词时会落到 `reviewType=unknown`，猫猫容易误判“没收到/没触发”

## 铲屎官原始需求（摘录，≤5 行）
> 1. 颜色是蓝色和暹罗一样？  
> 2. pr 的模板似乎会触发一次虚假的 codex review  
> 3. 后续 codex 真实的 review 猫猫似乎收不到

## 设计/参考
- 相关 debt：`docs/TECH-DEBT.md` → TD091
- Bug report：`docs/bug-report/2026-03-01-github-review-notification-misclassification/bug-report.md`

## Spec Compliance 自检（按需求拆解）

| # | 需求点 | 状态 | 说明 |
|---|--------|------|------|
| 1 | “环境提示”不再路由成 review 通知 | ✅ | body 命中 `create an environment` → ignorable skip |
| 2 | 真实 review 能识别 reviewed/commented | ✅ | IMAP fetch source + body 推断覆盖 `unknown` |
| 3 | GitHub Review bubble 视觉区分 | ✅ | `source.connector==='github-review'` → slate theme |

## 改动文件

| 文件 | 改动 | 说明 |
|------|------|------|
| `packages/api/src/infrastructure/email/GithubReviewMailParser.ts` | 修改 | 新增 `inferReviewActionFromEmailSource`（reviewed/commented/ignorable） |
| `packages/api/src/infrastructure/email/GithubReviewWatcher.ts` | 修改 | IMAP fetch 增加 `source: true` + 应用 body 推断/降噪 |
| `packages/api/src/infrastructure/email/ReviewRouter.ts` | 修改 | 支持 `reviewed` 显示 |
| `packages/api/test/github-review-mail-body-classifier.test.js` | 新增 | 3 个 UT 覆盖 reviewed/commented/ignorable |
| `packages/web/src/components/ConnectorBubble.tsx` | 修改 | 按 connector 选择主题（github-review → slate） |
| `packages/web/src/components/__tests__/connector-bubble-theme.test.ts` | 新增 | UT 验证 theme 分流 |

## Git SHA
- Branch: `fix/github-review-notify`
- Head: `960faf0e`

## 测试状态（本地验证）
```
@cat-cafe/api build + node --test packages/api/test/github-review-mail-body-classifier.test.js  ✅
@cat-cafe/web  vitest run src/components/__tests__/connector-bubble-theme.test.ts ✅
```

## Review 重点
1. `inferReviewActionFromEmailSource` 的规则是否足够稳健（会不会误判/漏判）？
2. `source: true` 的 IMAP fetch 是否会显著增加负担（poll interval 120s，影响可接受？）
3. ignorable skip 的策略是否太激进（是否需要 triage thread 留痕？）
4. connector theme：github-review 用 slate 是否符合我们整体风格（比蓝色更清晰？）

## 五件套
- **What**: 邮件正文推断 reviewed/commented + 跳过环境提示；GitHub Review connector 改为 slate 主题
- **Why**: 降噪 + 防误导 + 提升“真实 review 到达”的可见性与可辨识度
- **Tradeoff**: 增加 IMAP fetch payload（source），但 poll 频率低且只对匹配到 subject 的邮件做轻量 regex
- **Open Questions**: “环境提示”是否需要单独路由到 triage（避免完全丢失）？
- **Next Action**: 请宪宪 review 上述文件与策略

