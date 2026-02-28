## Review 请求: GitHub 云端 review 邮件未入 thread（subject 解析修复）

### 背景
铲屎官反馈：云端 Codex review 已经在 GitHub PR 上出结果，但 Hub/thread 没收到 connector 消息通知。

我们在 QQ IMAP 收件箱里验证到该邮件存在，示例：
- From: `chatgpt-codex-connector[bot] <notifications@github.com>`
- Subject: `Re: [zts212653/cat-cafe] ... (PR #96)`

但 `GithubReviewWatcher` 会跳过这类邮件，因为 `parseGithubReviewSubject()` 的 guard 要求 subject 必须包含 `pull request` 或 `@user ... on pull request` 动作文本。
上述 subject 不含 `pull request` 关键词，因此被误判为“非 review 邮件”，导致整个通知链路断。

### 铲屎官原始需求（摘录）
> “他已经出review结果了,但是你好像并没有收到消息？”
> “你要不要确认一下 IMAP watcher收到了！”

### 设计/约束
- 仍需拒绝 issue 邮件（例如 `Re: [owner/repo] Issue: ... (#123)`）。
- 仅放宽到明确标识 PR 的 subject 形态：`(PR #N)`。

### Spec Compliance 自检（Step 2）

| # | 要求 | 状态 | 代码位置 | 测试 |
|---|------|------|----------|------|
| 1 | 接受 `Re: [owner/repo] ... (PR #N)` 并解析 repo/pr/title | ✅ | `packages/api/src/infrastructure/email/GithubReviewMailParser.ts` | `packages/api/test/github-review-mail-parser.test.js` |
| 2 | 继续拒绝 issue `Re: ... (#N)`（无 pull request/PR marker） | ✅ | 同上 | 既有测试 + 仍保留 |

### 改动文件
- `packages/api/src/infrastructure/email/GithubReviewMailParser.ts`
- `packages/api/test/github-review-mail-parser.test.js`

### Git SHA
- Base: `9d0240a`
- Head: `6be14d3`

### 测试状态
```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/github-review-mail-parser.test.js
node --test packages/api/test/review-router.test.js
```

### 五件套
- **What**: 放宽 review subject guard，支持 `(PR #N)` 邮件；补充回归测试
- **Why**: QQ/GitHub 云端 review 邮件 subject 不含 `pull request` 关键词，导致 watcher skip
- **Tradeoff**: 不做 body 解析（watcher 仍只读 envelope）；仅接受明确 PR marker，避免误收 issue
- **Open Questions**: 是否还存在其它 PR subject 形态（例如无括号的 `PR #N`）需要支持？
- **Next Action**: 请宪宪 review `6be14d3` 的两个文件与测试覆盖

