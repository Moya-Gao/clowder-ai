## Review 请求: GitHub Review 通知 — 修正 reviewType + 过滤 @codex review 触发噪音

### 背景
铲屎官现场反馈 PR #116 的 GitHub Review 通知：
- 真实存在 review（Codex bot 模板 review comment），但通知显示 `Review 类型: unknown`
- 同时 PR 里我们自己发的 `@codex review` 触发 comment 也会进通知，容易把“触发动作”误当“反馈意见”

### 铲屎官原始反馈（摘录）
> “116 有两个 comments… 导致你觉得他没留有效信息”

（UI 时间线里其实是 1 条 trigger comment + 1 条 Codex PR review，但我们确实需要把类型识别与降噪做得更清晰。）

### 需求/设计文档
- 相关上下文：`docs/features/F039-message-queue-delivery.md`（GitHub review watcher 链路）
- IMAP/通知链路相关：`packages/api/src/infrastructure/email/GithubReviewMailParser.ts`

### Spec Compliance 自检

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | Codex 模板 review（含 “### Codex Review / Reviewed commit”）不再归类为 unknown | ✅ | `GithubReviewMailParser.ts` `inferReviewActionFromEmailSource` | `github-review-mail-body-classifier.test.js` 新增用例 |
| 2 | 我们自己的 `@codex review` 触发 comment 邮件被标记为 ignorable（不路由成“请处理意见”） | ✅ | 同上 | 同上 |
| 3 | 修复 body 提取不应截断多段落（split limit bug） | ✅ | 同上 | 触发 comment 用例覆盖（多段落） |

### 改动文件
- `packages/api/src/infrastructure/email/GithubReviewMailParser.ts`
- `packages/api/test/github-review-mail-body-classifier.test.js`

### Git SHA
- Base: `1c2705aca6922aed3955b6d6cb5b1750279a884c` (origin/main)
- Head: `950b333e6d9a5a59d4aa1e0c0d8fa2dd9c11f930`

### 测试状态
```
pnpm --filter @cat-cafe/api build ✅
node packages/api/test/github-review-mail-body-classifier.test.js ✅ (9/9)

pnpm --filter @cat-cafe/api test ❌
  - 失败原因：Redis isolation guard（需要 CAT_CAFE_REDIS_TEST_ISOLATED=1，需用 test:redis 跑）
  - 与本次改动无关（纯 email parser + unit test）
```

### Review 重点
1. 新增的 “Codex review template” 判定是否过宽（误把 human 文本当 codex）
2. `@codex review` trigger 降噪规则是否会误杀“真正包含问题描述”的 comment（目前要求命中我们的固定模板句）

### 五件套
- **What**：把 Codex 模板 review 识别为 `reviewed`；把我们自己的 `@codex review` 触发模板 comment 标记为 ignorable；修复 body 提取截断
- **Why**：减少 unknown/虚假“请处理意见”提醒，让通知更贴近真实反馈
- **Tradeoff**：trigger 降噪只针对我们固定模板（更安全，可能漏掉其它风格 trigger）
- **Open Questions**：是否要进一步把 `reviewed` 拆分出 `reviewed_passed`（不同措辞都算 pass）？（先不做）
- **Next Action**：请宪宪 R1 review，上述两文件即可

