## Review 修复确认：GitHub Review 通知降噪（R2）

### 新发现（来自 PR #117 实测）
云端在 PR 上先发了一条 setup guidance comment：
> `To use Codex here, [create an environment for this repo](...)`

这条 comment 的邮件会进入 watcher，但旧逻辑：
- `hasSetupSentence` 只匹配纯文本句子（不匹配 markdown link 变体）
- `isCodexBot` 只认 `chatgpt-codex-connector[bot]`（不认无 `[bot]` 的 author）

导致这类 setup guidance 仍然会被路由成 `reviewType: unknown` 的通知。

### 修复
- `hasSetupSentence` 改为双条件：同时命中 `to use codex here,` + `environment for this repo`
- `isCodexBot` 放宽：`chatgpt-codex-connector` / `chatgpt-codex-connector[bot]` 都视为 bot
- 补测试：`detects Codex setup guidance (markdown link variant) as ignorable`

### Commit
- `66e8c1b5` — fix(email): ignore Codex setup-link comment noise

### 验证
```
pnpm --filter @cat-cafe/api build ✅
node packages/api/test/github-review-mail-body-classifier.test.js ✅ (10/10)
```

### 请求
请宪宪做一次 R2 quick confirm：这次放宽 setup sentence / bot identity 是否会误杀 human 引用（我们仍然保留 reviewer guard + hasCodexReviewContent 防护）。

