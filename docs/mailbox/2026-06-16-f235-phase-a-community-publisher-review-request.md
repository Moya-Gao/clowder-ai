---
feature_ids: [F235]
topics: [community, publisher, review-request]
doc_kind: mailbox
created: 2026-06-16
---

# Review Request: F235 Phase A — Community Issue Publisher

Review-Target-ID: f235
Branch: feat/f235-community-publisher

## What

F235 Phase A: FrustrationIssueCard confirmed 后新增"发布到社区"按钮。完整管线：

1. **CommunityIssueDraft 共享类型** — `packages/shared/src/types/community-issue-draft.ts`（draft/published/cancelled 状态机，6 invariants）
2. **CommunityIssueSanitizer** — 白名单 + fail-closed 脱敏（threadId/userId/catId/Redis key/绝对路径等 forbidden patterns 全剥离）
3. **InMemoryCommunityIssueDraftStore** — Port 接口 + InMemory 实现，enforces INV-1~6（只 draft 可转移、published 需 github URL、一个 source 只能有一个 draft）
4. **FrustrationIssueSourceAdapter** — 从 confirmed FrustrationIssue 生成 sanitized draft（signal-type 感知标题、结构化 body）
5. **GitHubIssuePublisher** — raw fetch → GitHub REST API，repo allowlist defense-in-depth
6. **4 Fastify API routes** — create-from-frustration-issue / get / publish / cancel，全部有 auth + ownership + Zod validation + server-side re-sanitize on publish (KD-4)
7. **Preview card builder** — 两种 rich block：preview (info tone) + published (success tone + GitHub link)
8. **FrustrationIssueCard 扩展** — confirmed 后出现 "Publish to Community" 按钮
9. **CommunityIssuePreviewCard** — 完整 React 组件，loading→editing→publishing→published/cancelling→cancelled/error 状态机
10. **Integration wiring** — routes + store + publisher 注入 API server

12 commits，88 F235 tests (78 API + 10 shared) + 全量 suite 15,509+ tests，0 failures。

## Why

铲屎官原话：本地反馈池（F222 confirmed）和社区看板之间缺一座桥——用户点了"已提交"以为问题反馈出去了，实际只是本地存了一条记录。F235 补上 outbound 方向。

## Original Requirements（必填）
> 铲屎官（2026-06-15）："社区小伙伴让猫猫整理完问题，或者你们 F222 这里的卡片他们填写完，这两个场景之后他们可以要么让猫猫发送到社区，要么就是前者猫猫整理完问题变成类似 F128 或者 F225 的卡片，我点 submit 这样直接按照我们开源社区的格式提过来。"
>
> 砚砚实测确认：F222 confirmed 只在本地 Redis，无外发路径。"已提交"文案在误导用户。
- 来源：`docs/features/F235-feedback-to-community-publisher.md` Why 章节
- **请对照上面的摘录判断：用户确认问题后能否一键预览+编辑+发布到 GitHub issue？**

## Tradeoff

- Phase A 用 bot token 而非 OAuth（KD-2）：降低复杂度，issue body 标明 "Reported via Cat Cafe"
- InMemory store 而非 Redis（Phase A 仅本地开发验证阶段）：Phase B 升级 Redis
- 不做 F168 inbound reconciliation（Phase B scope）

## Architecture Ownership（必填）

Architecture cell: community-ops
Map delta: update required（community-ops 从纯 inbound 扩展为双向，新增 outbound publisher 子域：sanitizer + draft store + GitHub issue publisher）
Why: F235 在 community-ops cell 新增 outbound 方向，不需要新 cell

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
  - 新建了 CommunityIssueDraftStore（port + InMemory）+ GitHubIssuePublisher + FrustrationIssueSourceAdapter，全部在 community-ops 域内
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
1. **脱敏完整性（KD-4，安全重点）**：CommunityIssueSanitizer 的 FORBIDDEN_PATTERNS 列表是否完整？有没有漏掉的内部 ID pattern？
2. **Re-sanitize 时机**：publish route 先 sanitize 再 updateContent 再 publish——顺序是否正确？
3. **InMemory store 的 sourceIndex 竞态**：cancel→recreate 流程中 sourceIndex 清理是否正确？

### 价值 OQ（给 CVO，如有）
无——Phase A 的所有 KD 已在宪宪×砚砚讨论中收敛并获 CVO 同意（KD-1~6）。

## Next Action

请 reviewer 做跨家族 code review，重点关注：
1. 脱敏完整性（安全）
2. 状态机 invariants 覆盖
3. API route 的认证/授权边界
4. React 组件状态管理（loading/editing/publishing/error recovery）

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f235/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: reviewer 自动分配（默认 3201/3202）

## 自检证据

### Spec 合规
- AC-A1 ✅：FrustrationIssueCard confirmed 后显示 "Publish to Community" 按钮（`FrustrationIssueCard.tsx` L277-287）
- AC-A2 ✅：CommunityIssuePreviewCard 可编辑标题+描述（`CommunityIssuePreviewCard.tsx` L194-215）
- AC-A3 ✅：CommunityIssueSanitizer 17 tests 覆盖所有 forbidden patterns（`community-issue-sanitizer.test.js`）
- AC-A4 ✅：GitHubIssuePublisher 9 tests + 路由集成 14 tests（含 publish 到 mock GitHub API）
- AC-A5 ✅：Published 状态卡片含 GitHub issue URL 链接（`CommunityIssuePreviewCard.tsx` L147-167）
- AC-A6 ✅：Publish route 返回 502 + 友好错误信息，draft 保留 draft 状态不丢失

### 测试结果
```
F235 tests: 88 pass, 0 fail (78 API + 10 shared)
Full suite: 15,509+ pass, 0 fail, 13 skipped (pre-existing)
pnpm check: 22/22 pass (biome + all gates)
pnpm lint: 0 errors (warnings only — pre-existing)
pnpm -r --if-present run build: exit 0
```

### 相关文档
- Plan: `docs/plans/2026-06-15-f235-phase-a-community-publisher.md`
- Feature: `docs/features/F235-feedback-to-community-publisher.md`
- Design: `docs/designs/F235-publish-to-community.html`
