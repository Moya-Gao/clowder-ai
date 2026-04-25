---
feature_ids: [F140]
topics: [github, review-feedback, email-watcher-deprecation, cutover]
doc_kind: plan
created: 2026-04-24
---

# F140 Phase E.2 Implementation Plan — Cutover (删 Rule B + 下线 email watcher)

**Feature:** F140 — `docs/features/F140-github-pr-automation.md`
**Goal:** 真正消除 PR #1376 双通道叙事冲突——删除 Rule B authoritative-source 语义 + 下线 email watcher bootstrap，让 polling 通道成为 review feedback 的唯一真相源。
**Acceptance Criteria:** 覆盖 F140 spec AC-E7 ~ AC-E9（AC-E10 代码清理是 E.3）。
**Architecture:** Cutover 操作 — 移除/简化既有逻辑 + alpha 3 场景作 hard gate。无新增模块。
**Tech Stack:** TypeScript + 既有 `github-feedback-filter.ts` / `github-review-bootstrap.ts` / `env-registry.ts`。
**前端验证:** No（纯后端 + alpha 体感验收）。

---

## Straight-Line Check

### Pin the Finish Line

- **B 定义**：bot review feedback 仅由 polling 通道（`ReviewFeedbackTaskSpec`）投递，email watcher 进程不再启动；`createGitHubFeedbackFilter()` 不再 skip authoritative bot；`GITHUB_AUTHORITATIVE_REVIEW_LOGINS` env 显式处理。alpha 3 场景全绿才能 cutover。
- **Cutover Gate（砚砚 GPT-5.4 2026-04-24 strategy）**：alpha `pnpm alpha:start` 起 latest origin/main，注册测试 PR，触发 codex review，必须三场景同时验证：
  - **Scene 1** bot review 含 P2 inline → 消息头显示 `**Review 检测到 P2**`
  - **Scene 2** bot pass / no severity → 无 header（保持 `📋 Review Feedback` 起首）
  - **Scene 3** 人类 reviewer COMMENTED / CHANGES_REQUESTED → 正常渲染，**不被旧 Rule B 误吞**

### What we're NOT building

- **AC-E10 代码清理（E.3）**：`GithubReviewWatcher` / `ReviewRouter` / `ReviewContentFetcher` / `GithubReviewMailParser` / `ProcessedEmailStore` 物理删除留 E.3 独立 PR
- **新 env 引入**：本期复用既有 `GITHUB_AUTHORITATIVE_REVIEW_LOGINS` 或者把它作 setup-noise allowlist 重命名（决定见 Task 2）

### Terminal Schema

```ts
// github-feedback-filter.ts — 简化为 Rule A only
export interface GitHubFeedbackFilterOptions {
  readonly selfGitHubLogin?: string;
  // authoritativeReviewLogins 删除（E.2）
}
export interface GitHubFeedbackFilter {
  isSelfAuthored: (author: string) => boolean;
  shouldSkipComment: (c: { author: string }) => boolean; // Rule A only
  shouldSkipReview: (r: { author: string }) => boolean;  // Rule A only
}
```

```ts
// index.ts compose 点
const setupNoiseBots = (process.env.GITHUB_SETUP_NOISE_BOT_LOGINS
  || process.env.GITHUB_AUTHORITATIVE_REVIEW_LOGINS  // backward compat
  || 'chatgpt-codex-connector[bot]')
  .split(',').map(s => s.trim()).filter(Boolean);
const setupNoiseFilter = createSetupNoiseFilter(setupNoiseBots);
```

---

## Task 1: 简化 `createGitHubFeedbackFilter` 为 Rule A only

**Files:**
- Modify: `packages/api/src/infrastructure/email/github-feedback-filter.ts`
- Test: `packages/api/test/scheduler/github-feedback-filter.test.js`（已有，扩展）

### Steps

1. **Red**: 写失败测——`shouldSkipComment({ author: 'chatgpt-codex-connector[bot]', commentType: 'inline' })` 应返回 false（旧 Rule B 会返回 true）；`shouldSkipReview({ author: 'chatgpt-codex-connector[bot]' })` 应返回 false
2. **Green**: 删除 `authoritativeReviewLogins` option + `shouldSkipComment` / `shouldSkipReview` 仅查 Rule A（self-authored）。`isSelfAuthored` 保留
3. **Refactor**: 文件顶部注释更新——Rule B 已删除，bot feedback 由 polling 通道唯一投递；setup-noise 由 `setup-noise-filter.ts` 在 polling gate 处理
4. **Commit**: `feat(F140-E2): drop Rule B from feedback filter (cutover prep) [宪宪/Opus-47🐾]`

## Task 2: env 配置切换 — `GITHUB_AUTHORITATIVE_REVIEW_LOGINS` → `GITHUB_SETUP_NOISE_BOT_LOGINS`

**Files:**
- Modify: `packages/api/src/config/env-registry.ts:929` 附近（authoritative review logins 文案）
- Modify: `packages/api/src/index.ts:2074` compose 点
- Modify: `.env.example`

### Decision (KD-14 临时借壳显式处理 — 见 F140 Timeline 2026-04-24 reminder)

**改名**：env `GITHUB_AUTHORITATIVE_REVIEW_LOGINS` → `GITHUB_SETUP_NOISE_BOT_LOGINS`，语义从 "authoritative source skip list" 切到 "polling-side setup-noise bot allowlist"。`index.ts` 读新 env 优先 + 老 env 兜底（向后兼容一段时间），env-registry.ts 文案改"Bot logins whose conversation comments may contain Codex setup guidance only — polling will skip those as noise"。

### Steps

1. **Red**: 测试新 env 名生效（设置 `GITHUB_SETUP_NOISE_BOT_LOGINS=foo` → setupNoiseFilter 用 foo 作 allowlist）
2. **Green**: index.ts 改读新 env 优先；env-registry.ts 添加新 env 描述 + 标 `GITHUB_AUTHORITATIVE_REVIEW_LOGINS` 为 deprecated；`.env.example` 加新 env 注释
3. **Commit**: `feat(F140-E2): rename env to GITHUB_SETUP_NOISE_BOT_LOGINS (semantic shift)`

## Task 3: 下线 `startGithubReviewWatcher()` bootstrap 调用

**Files:**
- Modify: `packages/api/src/index.ts`（移除 watcher 启动逻辑）
- Modify: `.env.example`（撤 `GITHUB_REVIEW_IMAP_*` 字段）

### Steps

1. **Red**: 集成测验证 bootstrap 后 `isGithubReviewWatcherRunning()` 返回 false（不再 lazy import 启动）
2. **Green**: 删除 `startGithubReviewWatcher` import + 调用；`.env.example` 删掉 `GITHUB_REVIEW_IMAP_USER/PASS/HOST/PORT/PROXY/POLL_INTERVAL_MS` 注释
3. **Commit**: `feat(F140-E2): stop email watcher bootstrap (polling is sole source)`

## Task 4: 全量回归 + Push

1. `pnpm gate` 全绿（rebase + build + test + lint + check）
2. `git push origin feat/f140-e2-cutover`
3. 开 PR (PR title `feat(F140-E2): cutover — drop Rule B + stop email watcher`)
4. PR tracking register + cross-family review (gpt52 + codex chat 路径，云端 codex bot trigger)

## Task 5: Alpha Cutover Gate（AC-E9 hard gate）— **CVO 参与**

> **铲屎官参与**：`pnpm alpha:start` 拉 PR merge 后的 main 起隔离环境（3011/3012/4111/6398），我远程引导执行下面 3 场景。任一场景未达预期 → **回滚 merge，重新评估**。

### Scene 1 — bot review with P2 inline

1. 在 alpha 注册一个测试 PR（任意 commit 触发 lint warning 等）
2. 触发 `@codex review` → bot 投 inline P2 finding
3. **Expected**：alpha thread 收到一条 `**Review 检测到 P2**` 消息头 + 三段式渲染

### Scene 2 — bot pass / no severity

1. 同 PR 二次触发 `@codex review`（无新代码改动 → bot 通常返回 "no major issues"）
2. **Expected**：alpha thread 收到 `📋 Review Feedback` 起首，**无 severity header**（向后兼容）

### Scene 3 — human COMMENTED / CHANGES_REQUESTED

1. 真人 reviewer（铲屎官 / gpt52 cli）在 alpha PR 留 review decision = `CHANGES_REQUESTED`
2. **Expected**：alpha thread 收到该 review，**未被旧 Rule B 误吞**——这条用例直接守护 KD-15 删除决策

### Cutover Gate 决策

- 三场景全绿 → **正式 cutover 完成**，E.2 归档，进 E.3 代码清理
- 任一场景失败 → **revert merge**（git revert + 重新进 receive-review 修复）

---

## Non-Goals

| 放在哪 Phase | 事项 |
|-------------|------|
| E.3 | 删除 `GithubReviewWatcher` / `ReviewRouter` / `ReviewContentFetcher` / `GithubReviewMailParser` / `ProcessedEmailStore` 物理文件 + tests |
| 后续 | 旧 env `GITHUB_AUTHORITATIVE_REVIEW_LOGINS` 兜底逻辑下一个版本删除（先观察 N 天） |

## Risk & Mitigation

| 风险 | 缓解 |
|------|------|
| Rule B 删除后 bot review 大量涌入 polling 通道（之前被 Rule B 吞） | setup-noise filter 已在 E.1 就位，conversation 噪声仍被吞；正常 bot review 本来就该投递 |
| 删 Rule B 同时 polling 因故挂掉 → bot review 完全 silent | E.2 不删 watcher 文件（E.3 才删），紧急可恢复 — 旧 env 兜底改回 startGithubReviewWatcher 即可 |
| Alpha 3 场景某一条无法在合理时间内复现 | Scene 1/2 通过模拟 mock body （fixtures）补 unit-level 守护，alpha 验收作 spot-check |
| `GITHUB_SETUP_NOISE_BOT_LOGINS` 用户没设新 env → 退到旧 env → polling 仍吞 bot setup | 兜底逻辑 OR 顺序: 新 env || 旧 env || 默认值；只要有任一 → setup-noise filter 仍生效 |

## Links

- Spec: `docs/features/F140-github-pr-automation.md` (Phase E.2 section + AC-E7~E10)
- E.1 plan: `docs/plans/2026-04-24-f140-phase-e1-severity-parser.md`（已 merged）
- E.1 merge: SHA 120748e5c (PR #1380)
- 砚砚 cutover gate strategy 锚点: 2026-04-24 23:15 thread message
