---
feature_ids: [F168]
topics: [community, github, sync, review-request]
doc_kind: mailbox
created: 2026-04-19
---

# Review Request: F168 Phase E — GitHub Issue Sync Pipeline

Review-Target-ID: f168-phase-e
Branch: feat/f168-phase-e

## What

新增 GitHub Issue 同步管线——社区看板的"进货通道"：

1. **State Mapper** (`GitHubIssueFetcher.ts`): 纯函数，将 GitHub issue 的 labels/state/comments 映射到 CommunityIssueStore 的 6 种状态
2. **Sync Endpoint** (`POST /api/community-issues/sync?repo=xxx`): 接受 `fetchIssues` 回调，拉 GitHub issues → mapGitHubIssue → upsert CommunityIssueStore
3. **Production Wiring** (`index.ts`): 用 `gh api` CLI + `--paginate` + `state=all` 实现真实 fetch
4. **Frontend** (`CommunityPanel.tsx`): sync 按钮改为先 POST sync 再 GET board

## Why

铲屎官发现社区看板 Issues 全是 0——根因是 CommunityIssueStore 没有数据来源。PR 通过 `pr_tracking` TaskStore 有数据，但 issues 缺少类似的 ingestion 管线。这是 Phase E 的"地基"。

## Original Requirements（必填）

> "好像全部都是0 为什么呢？不是应该按道理需要能看到我们到底看了什么没看什么吗？"
> "记得记录issue 到你的168哈哈哈怎么什么都干了 地基没干！然后开干？"

- 来源：铲屎官当面语音 + 截图（2026-04-19 session）
- **请对照上面的摘录判断：sync 后看板是否能真实反映 GitHub issue 状态**

## Tradeoff

- 选择了 `gh api` CLI 而非 REST/GraphQL SDK：复用现有 `fetchGhApi` 模式，无额外依赖
- 同步是手动触发（点按钮），不是自动定时：MVP 先验证，后续 Phase 可加 cron
- `fetchIssues` 作为 DI 回调注入 routes：测试可 mock，生产在 index.ts 提供真实实现

## Open Questions

1. `state=all` 会拉所有 issue（含 closed），数据量大的 repo 是否需要分页上限？当前 `--paginate` 无限制
2. 同步后 CommunityIssueStore 条目的 `issueType` 不会被后续同步更新（只有 state 和 title 会更新）——这是有意的（type 由首次创建时的 label 决定），reviewer 请确认这个行为是否合理

## Next Action

请 review 代码质量 + 愿景对齐。特别关注：
- state mapping 优先级链是否正确（closed > closed-labels > declined-labels > accepted > pending-decision > discussing > unreplied）
- sync endpoint 的 upsert 逻辑是否有 race condition 风险
- 前端 handleSync 的 error handling 是否足够

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f168-phase-e/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: review sandbox 自动分配（起点 3201/3202）

## 自检证据

### Spec 合规

AC-E1~E4 全覆盖（见 quality-gate report）：
- E1: POST sync → GitHub API → CommunityIssueStore ✅
- E2: 6 种状态映射 + 4 种 issueType ✅
- E3: sync button → POST sync → fetchBoard ✅
- E4: getByRepoAndNumber dedup + update only ✅

### 测试结果

```
pnpm test → 8757 tests, 8756 pass, 0 fail ✅
pnpm lint → 0 errors ✅
pnpm check → 0 errors ✅ (biome format + lint)
pnpm -r --if-present run build → exit 0 ✅
```

Phase E 新增测试：
- `github-issue-fetcher.test.js`: 15 tests (state mapping 8 + issueType 5 + priority 2)
- `community-issues-routes.test.js`: 4 sync tests (create + update + dedup + missing-repo)

### 根目录工件闸门

```
git status --short | rg root artifacts → CLEAN
git diff --name-only origin/main...HEAD | rg root artifacts → CLEAN
```

### 相关文档

- Plan: `docs/plans/2026-04-19-f168-phase-e-issue-sync.md`
- Feature: `docs/features/F168-community-ops-board.md` Phase E section
