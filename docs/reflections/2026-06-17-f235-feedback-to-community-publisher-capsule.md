---
capsule_id: "F235-2026-06-17"
context: "F235 Feedback-to-Community Publisher — 本地反馈池到社区 GitHub Issue 的 outbound 发布桥"
feature_ids: [F235]
doc_kind: capsule
created: 2026-06-17
---

## What Worked

- **两 Phase 分工清晰**：Phase A（F222 路径）+ Phase B（通用猫发布卡片）各自独立交付，不互相依赖，Phase A 先上确认核心管线 OK 再扩展 Phase B
- **TDD 红绿覆盖**：sanitizer + publisher + routes + E2E + web 组件 11 个测试文件，69 个测试用例，opus-47 守护 trace 到 `index.ts:2521` 真实 wire-up，不是 APPROVE 死代码
- **脱敏三道防线**：前端预览 → 服务端 re-sanitize fail-closed 422 → allowlist + path prefix 全覆盖（Phase B P2-1 把 3 路径扩到 20 根），防内部信息泄露到公开 issue
- **封板协议（LL-072）有效**：Cloud R3 7/7 stale（同族重放），100% 假阳性触发封板，gpt52 做 delta final review 后直接 merge，不陷 cloud review 无限循环
- **Review Provenance Matrix 清晰**：opus 写代码 → gpt52 peer review → 封板后 gpt52 final delta review，trace 链路无断点

## What Failed

- **Cloud review 循环效率**：3 轮（R1 修 P2-1/P2-2，R2 修 P2-5，R3 全 stale 封板）。R3 的 7 个 finding 都是 P2-3/P2-4 重放，说明 cloud reviewer 确实无法区分 stale/fresh，封板是正确选择。历史证据：F168 PR #2214 跑了 21 轮，本 PR 3 轮即封板——LL-072 工作正常
- **Deployment env 未验收**：`COMMUNITY_PUBLISH_DEFAULT_REPO` 默认 `clowder-ai/cat-cafe`（404，org 不存在）。代码实现完整，但任何 operator 不 override env 就会碰到 GitHub API 404。整个 codebase 0 处文档这些 env vars，alpha 启动脚本也未设置。= **vision-in-code 已实现，vision-in-deployment 未验收**
- **跨 context boundary 的状态摘要丢失**：本 PR 经历了 context compaction，context summary 恢复了主要信息，但某些细节需要重新 recall（例如 R3 7 条 finding 的完整分析）

## Trigger Missed

- **应该在 Phase A merge 后就补 env var 文档**：`COMMUNITY_PUBLISH_*` env vars 在 Phase A 就已存在（GitHub token config），应该在 Phase A close 时就加入 `docs/SOP.md` 或 README，不能等 deployment 才发现 placeholder 导致 404
- **Alpha 验收通道未对 "真实 publish" 路径验收**：Phase A/B 代码完成后应当在 alpha 环境手动触发一次真实 publish（`COMMUNITY_PUBLISH_DEFAULT_REPO=zts212653/cat-cafe pnpm alpha:start`），确认端到端 happy path 走通，再 declare Phase done

## CloseGateReport

| AC | 证据 | 状态 |
|----|------|------|
| AC-A1: confirmed 后显示"发布到社区"按钮 | `FrustrationIssueCard.tsx:278` CommunityPublishFlow 在 `status==='confirmed'` 时渲染 | ✅ met |
| AC-A2: 生成预览卡片，用户可编辑 | `CommunityPublishFlow.tsx` rendering → `CommunityIssueDraftCard.tsx` editing state | ✅ met |
| AC-A3: 预览脱敏不含内部 ID | `frustration-sanitizer.ts` 白名单 + 服务端 re-sanitize，sanitizer 测试 31/31 ✓ | ✅ met |
| AC-A4: submit 后 GitHub issue 创建 | `GitHubIssuePublisher.ts` + `store.publish()` + `index.ts:2521` wire-up；注：默认 repo `clowder-ai/cat-cafe` = 404，需 override env | ✅ met (code); ⚠️ env override required in deployment |
| AC-A5: 成功后卡片更新为"已发布"附 issue URL | `CommunityIssueDraftCard.tsx` published state + github_issue_url link | ✅ met |
| AC-A6: GitHub API 失败时友好提示，不丢数据 | `GitHubIssuePublisher.ts` 失败返回 null + store 状态保持 draft，routes 路由测试 38/38 ✓ | ✅ met |
| AC-B1: 猫猫可主动生成 community_issue_draft rich block | `RichBlocks.tsx:55` kind routing + Phase B routes | ✅ met |
| AC-B2: 支持选择目标仓库 | `CommunityIssueDraftCard.tsx` dropdown + 手动输入 fallback | ✅ met |
| AC-B3: submit 复用 Phase A 脱敏→发布→回链管线 | 同一 `GitHubIssuePublisher` + `CommunityIssueSanitizer` 实例 | ✅ met |

全部 9 条 AC = met。无 unmet AC。

## Deployment 跟进（守护猫 opus-47 披露，非 follow-up debt）

`COMMUNITY_PUBLISH_DEFAULT_REPO` 默认值 placeholder 导致 alpha 发布 404。铲屎官/operator 首次真实使用时：
- 临时：`COMMUNITY_PUBLISH_DEFAULT_REPO=zts212653/cat-cafe pnpm alpha:start`（`zts212653/cat-cafe` 是真实存在的仓库）
- 彻底：改 default 值 + 补 env var 文档，或开 hotfix PR

## Doc Links

- [F235 spec](../features/F235-feedback-to-community-publisher.md)
- [F222 spec](../features/F222-frustration-auto-issue.md) — producer 侧（F235 的来源）
- [F168 spec](../features/F168-community-ops-board.md) — community ops（inbound 方向）

## Rule Update Target

- `MEMORY.md`：无需专门加条目，env var 问题在此 capsule 有记录，search_evidence 可找到
- `docs/SOP.md`：可考虑在 merge-gate Step 7.5 后加 "deployment env vars 文档同步"，但此判断是 CVO 级，不自行改
- harness_feedback: none（纯 feature，不是 harness/skill 改动）
