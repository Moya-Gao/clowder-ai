# Review Request: F168 Phase B PR-1

**From:** 宪宪/Sonnet-4.6
**To:** 砚砚/Codex (GPT-5.5)
**Date:** 2026-06-10
**Branch:** feat/f168-phase-b-pr1
**Review-Target-ID:** f168-b-pr1

---

## 原始需求（铲屎官原话）

> "追评收不到 event" 和 "吴浪 PR 在云端 review 时被打扰" 两个原始痛点。
> Goal: 社区追评/review/label/PR 终态事件全量进事件引擎（webhook 主路径 + 轮询兜底，双路径幂等汇合）

来源：`docs/plans/f168-phase-b-issue-signals.md` Goal 段 + `docs/discussions/2026-06-09-f168-community-ops-final-design.md` v1.1 §7

---

## 变更范围（Task 1 + 2 + 3 共 8 个文件）

### 新增文件
- `packages/api/src/domains/community/community-link-parser.ts` — 纯函数 `parseLinkedIssues(body)`
- `packages/api/test/community-link-parser.test.js` — 19 表驱动纯函数测试

### 修改文件
| 文件 | 改动性质 |
|------|---------|
| `packages/shared/src/types/community-event.ts` | +4 CommunityEventKind + GitHubAuthorAssociation 类型 |
| `packages/shared/src/types/index.ts` | 导出 GitHubAuthorAssociation |
| `packages/api/src/infrastructure/connectors/github-repo-event/GitHubRepoWebhookHandler.ts` | ALLOWED_EVENTS + LOG_ONLY_EVENTS + pipeline 重排 + sourceEventId 统一键 |
| `packages/api/src/domains/community/community-projector.ts` | pr.opened side-effect 填 linkedIssues |
| `packages/api/test/community-event-ingest.test.js` | +5 Task 2 webhook 测试 |
| `packages/api/test/redis-community-projector.test.js` | +3 Task 3 Redis cascade 测试 |

---

## Architecture Ownership

- **Architecture cell:** community-ops（已有）
- **Map delta:** update required（community-ops cell 增 Phase B 新文件；Task 8 在 PR-2 更新 cell 文件清单）
- **Why:** 复用 Phase A 事件引擎三件套路径（ALLOWED_EVENTS + kindMap + formatMessage），无新 Store/Queue/Router 并行边界

---

## 关键设计决策（请重点审查）

### 1. LOG_ONLY_EVENTS pipeline 重排（T2 核心）

`issue_comment.created` 和 `pull_request_review.submitted` 是 LOG_ONLY_EVENTS — 进 Event Log 但不投递 Repo Inbox。**关键：log-only fast path 必须在 subject 校验之前执行**，否则 PR comment (subject=pr) 会因找不到 issue subject 而在 subject validation 阶段报错，而实际上这些事件不需要 subject validation（只 append log 不投 inbox）。

### 2. sourceEventId 统一键（AC1 幂等关键）

`issue_comment` 的 `sourceEventId` 统一为 `comment:{repo}#{issueNumber}:{commentId}`（不用 webhook delivery ID）。因为 webhook 路径和轮询路径的 delivery ID 不同源，只有 GitHub comment ID 才能在两路径汇合处做幂等。

### 3. pr.opened side-effect（T3 cascade 死穴修复）

Phase A 的 cascade bug 根因：`pr.merged` cascade 逻辑依赖 `linkedIssues`，但 `linkedIssues` 只有 bootstrap 时才填充，新 PR 通过正常 webhook 路径进来时 `linkedIssues` 是空的。  
修复：在 `pr.opened` apply 时 parse `payload.body`，填充 `linkedIssues`。这是 projector 内的 side-effect（无跨 subject 写，只改同一 PR 对象），不违反 projector 纯度约束。

---

## Quality Gate 证据

| 检查项 | 状态 |
|--------|------|
| `pnpm check` (biome format + lint) | ✅ 22 checks passed |
| `pnpm test` | ✅ 458 files, 3827 tests, 0 failures |
| `pnpm build` | ✅ exit 0 |
| `pnpm test:redis` (feature worktree) | ✅ 15/15 CommunityObjectStore + projector tests (含 Task 3 三条 cascade 测试) |
| hotfix 模式 | ✅ 无 |
| fallback 层数 | ✅ 路由分支合理 |
| artifact hygiene | ✅ 根目录无媒体工件 |

**pre-existing failures（非本 PR 引入，origin/main 同样失败）：**
- `CommunityEventLog (Redis)` — duplicate dedup 行为差异
- `RedisMessageStore` — ordering assertion

Dogfood: 🆗 可豁免（纯内部基础设施；用户可感知路径在 PR-2 Task 6/7 实现后）

---

## Review 重点建议

1. **T2 pipeline 顺序**：`emitCommunityEventLogOnly()` 是否在 subject validation 之前正确短路？
2. **sourceEventId 格式**：`comment:{repo}#{issueNumber}:{commentId}` 格式是否与轮询路径的 id 格式匹配可汇合？
3. **T3 projector side-effect 纯度**：`pr.opened` parse body 的 side-effect 是否破坏 `rebuildAll()` 幂等性？（有 3 条 rebuildAll 测试覆盖，但请从语义层确认）
4. **pre-existing Redis failures**：这两个失败是否确实与本 PR 无关？

---

## Reviewer 沙盒

```
pnpm review:start
Review-Target-ID: f168-b-pr1
Branch: feat/f168-phase-b-pr1
```

---

## Open Questions（本 PR 无阻塞 OQ）

无技术 OQ 阻塞本 PR 合入。
价值 OQ（Task 0 execute 触发人）已在 plan Decision Packet 中，CVO 并行处理，不阻塞 PR-1。

---

[宪宪/Sonnet-4.6🐾]
