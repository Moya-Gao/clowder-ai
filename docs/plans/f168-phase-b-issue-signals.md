# F168 Phase B — Issue Signals Implementation Plan

**Feature:** F168 — `docs/features/F168-community-ops-board.md`（reopened；Phase A merged `10c3c9bfdb`）
**终态设计:** `docs/discussions/2026-06-09-f168-community-ops-final-design.md` v1.1 §7 Phase B
**Goal:** 社区追评/review/label/PR 终态事件全量进事件引擎（webhook 主路径 + 轮询兜底，双路径幂等汇合），采集与投递 cursor 分离，routed 自动注册 tracking，awaiting_external 唤醒抑制闭环——杀死"追评收不到 event"和"吴浪 PR 在云端 review 时被打扰"两个原始痛点。
**Acceptance Criteria:**
1. `issue.commented` / `issue.labeled` / `pr.review_submitted` / `pr.merged|closed`（webhook 路径）事件双路径进 Event Log，`sourceEventId` 幂等（webhook 主 + 既有轮询兜底，同一事实只 append 一次）
2. **采集 cursor 语义修正**（终态设计 P1#2 落地）：comment 轮询 append 成功即推进采集 cursor；投递（唤醒通知）失败不回滚采集，由投递 cursor 独立重试——`IssueCommentTaskSpec` 现 notified-才-commit 语义重构
3. 新 PR body 的 `Fixes/Closes/Resolves #N` 解析 → `linkedIssues` 自动维护 → merged cascade 对非 bootstrap 链接生效（修 Phase A cascade 死穴）
4. `case.routed` 事件 → 系统自动注册 issue/PR tracking（副作用在 ingest 侧，**禁止放 projector**——重建不得重复注册）
5. awaiting_external 闭环：owner 可声明等待（MCP 工具 + callback 端点）；该状态下家系活动（`author_association ∈ {OWNER, MEMBER}`）不唤醒，外部活动（reporter comment / review submitted）唤醒并自动恢复 `in_progress`
6. focused 集成测试：`needs-info → reporter comment → owner thread wake` 与 `awaiting_external → maintainer comment 静默 → reporter comment 唤醒+恢复` 两条链路 Redis-backed 全绿
7. **Task 0（Phase A 验收遗留）**：production bootstrap 执行完成，64 条积压台账进投影，看板一致性抽查通过

**Architecture cell:** community-ops（已有）
**Map delta:** update required
**Map delta why:** community-ops cell 增加 Phase B 新文件（classification 规则、await-external 端点、双 cursor 模块）；Task 8 更新 cell 文件清单。
**Architecture:** 复用 Phase A 事件引擎。webhook 扩展走 Phase A 实战已趟通的三件套路径（ALLOWED_EVENTS + kindMap + formatMessage）；轮询兜底复用既有 `IssueCommentTaskSpec`/PR tracking 检测点，改其消费语义不改其调度；唤醒抑制是投递层纯函数规则表，不碰 projector 纯度。
**Tech Stack:** 同 Phase A（TypeScript + Redis + node:test）
**前端验证:** No（纯后端；看板新字段由 Phase A 兼容层自然透出）

---

## NOT building（Phase B 边界）

- ❌ `pr.synchronize` / `issue.edited` / milestone 事件（YAGNI：对状态机无转换语义；lastExternalActivityAt 由已纳入事件覆盖）
- ❌ `pr.edited` 的 linked 关系重解析（只在 `pr.opened` 解析 body；编辑漏网由 Phase D reconciler 补）
- ❌ comment 语义分类（"reporter 说要提 PR"之类的意图判断是 narrator 的活，Phase C；本 Phase 只用 `author_association` 静态规则表）
- ❌ narrator / Role Registry / F128 路由扩展（Phase C）；reconciler cron / closure UX（Phase D）；看板前端（Phase E）
- ❌ 不删 `CommunityIssueStore` / `CommunityPrStore`（原定 Phase B 末删——**推迟到 Task 0 production bootstrap 验证通过 + 一个观察窗后**，由 Phase C plan 接手；数据安全优先）

## 纪律注记（同 Phase A + 增量）

- Redis-backed 测试（`pnpm --filter @cat-cafe/api test:redis`）；worktree 只用 6398；TTL=0；shared 改后 build；LSP 必看；引擎零猫名零品牌（`author_association` 是 GitHub 通用语义，不耦合家里 ✓）
- **quality gate report 交付清单逐项 `ls` 验证后再写**（Phase A 教训：报告抄 plan 不验证 → 守护轮抓到失实）
- **跨 subject 投影副作用警惕**（Phase A 三轮 review 才收敛 rebuildAll 三 pass）：本 Phase 新事件 kind 若触发跨 subject 写（linkedIssues 维护），必须加 rebuild 顺序无关性测试 + updatedAt 不回退测试
- projection-only synthesis 映射同步（Phase A 两个分支都踩过 hardcode state）：新增 kind 影响 board synthesis 时同步更新映射表

---

## Task 0: production bootstrap 验收（Phase A 遗留闭环）⚠️ CVO 触点

**性质：** 运维操作，不是代码 PR。**生产 Redis = 6399 圣域**——写入操作必须铲屎官知情。

**Step 1:** sonnet 在 runtime 环境跑只读 dry-run（代码已验证零写路径 + sanctuary guard 拦 `--execute` 误连）：
`REDIS_URL=<prod> node scripts/community-bootstrap.mjs --dry-run > /tmp/f168-bootstrap-report.txt`
**Step 2:** dry-run 报告贴 thread，检查：64 条积压全部 will-create、state 映射无 unknown、零 error
**Step 3:** **铲屎官审查报告后亲自跑（或当轮明确授权）** `--execute`
**Step 4:** 看板一致性抽查：board API 响应中抽 5 条对照 GitHub 实际状态 + 投影 state
**价值 OQ（CVO）：** execute 触发人——建议铲屎官亲自，理由：首次向生产 Redis 写迁移数据，不可逆性中等（事件可清、但混入真实事件流后清理成本高）。Decision Packet 已含于此，无需另发。

## Task 1: shared types 扩展

**Files:**
- Modify: `packages/shared/src/types/community-event.ts`

**Step 1: 扩展类型（完整代码）**

```typescript
// CommunityEventKind 新增（外部事实）
  | 'issue.commented'        // webhook issue_comment.created / 轮询 IssueCommentTaskSpec
  | 'issue.labeled'          // webhook issues.labeled|unlabeled（payload.label 带名）
  | 'pr.review_submitted'    // webhook pull_request_review.submitted
// （pr.merged / pr.closed 已存在——本 Phase 为其补 webhook 主路径，kind 不新增）
// 内部决策事件新增
  | 'case.awaiting_external' // owner 声明等外部（payload: { reason, declaredBy }）

// 新增：投递抑制规则输入（GitHub 通用语义，多租户安全）
export type GitHubAuthorAssociation =
  | 'OWNER' | 'MEMBER' | 'COLLABORATOR' | 'CONTRIBUTOR'
  | 'FIRST_TIME_CONTRIBUTOR' | 'FIRST_TIMER' | 'NONE';

/** 家系活动（默认不唤醒）判定：OWNER/MEMBER。规则表函数见 community-delivery-policy.ts */
```

**Step 2:** `pnpm --filter @cat-cafe/shared build` → commit。

## Task 2: webhook 扩展三件套（Phase A 已趟通的路径）

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/github-repo-event/GitHubRepoWebhookHandler.ts`
- Test: 现有 webhook 测试文件 + `community-event-ingest.test.js` 扩展

**改动点（三件套）：**
1. `ALLOWED_EVENTS` 增：`issue_comment: ['created']`、`pull_request_review: ['submitted']`、`issues` 增 `'labeled', 'unlabeled'`、`pull_request` 增 `'closed'`（merged 事实从 payload `pull_request.merged: boolean` 区分 → kind `pr.merged` | `pr.closed`）
2. kindMap 对应映射；`sourceEventId` 沿用 webhook delivery ID
3. `formatMessage` actionLabel 表补全（Phase A R3 教训：漏 formatMessage 会让 inbox 通知标签错）
4. **通知行为差异**：`issue_comment`/`pull_request_review`/`labeled` 事件 **append 进 log 但不投递 Repo Inbox 通知**（噪音控制——这些事件的唤醒走 Task 6 投递策略，面向 owner thread 而非守门 inbox）；`pull_request.closed` 照常通知
5. `issue_comment` 的 dedup 注意：webhook delivery ID 与轮询合成 ID 不同源——**`sourceEventId` 统一为 `comment:{repo}#{issueNumber}:{commentId}`**（GitHub comment id 全局唯一），webhook 与轮询路径在此汇合幂等（AC1 的关键）

**TDD：** 失败测试（4 类新事件 → log 有/inbox 通知按上表有无）→ 红 → 实现 → 绿 → commit。

## Task 3: linked PR 解析（修 cascade 死穴）

**Files:**
- Create: `packages/api/src/domains/community/community-link-parser.ts`
- Modify: `packages/api/src/domains/community/community-projector.ts`（`pr.opened` apply 时消费 payload.body）
- Test: `packages/api/test/community-link-parser.test.js` + `redis-community-projector.test.js` 扩展

**parser（完整核心）：**

```typescript
/** 解析 PR body 中的 closing keywords。GitHub 官方语法：fix/fixes/fixed/close/closes/closed/resolve/resolves/resolved + #N 或 owner/repo#N（跨仓忽略——Phase B 只处理同仓） */
const CLOSING_RE = /\b(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?)\s*:?\s+#(\d+)/gi;
export function parseLinkedIssues(body: string | null | undefined): number[];
```

**projector 集成：** `pr.opened` apply 时 `linkedIssues = parseLinkedIssues(payload.body)`。
**强制回归测试（纪律注记第 3 条）：** 新 PR opened(body="Fixes #42") → merged → cascade 使 issue 42 → fixed；`rebuildAll()` 两种 subject 顺序结果一致 + updatedAt 不回退。

**TDD：** parser 纯函数表驱动测试（大小写/多引用/无引用/跨仓忽略）红→绿；projector 集成红→绿；commit ×2。

## Task 4: 双 cursor 重构（终态设计 P1#2 落地）

**Files:**
- Modify: `packages/api/src/infrastructure/email/IssueCommentTaskSpec.ts`
- Create: `packages/api/src/domains/community/community-delivery-policy.ts`（Task 6 共用，先建骨架）
- Test: 既有 IssueCommentTaskSpec 测试重写断言 + Redis 测试

**语义改造（现 `:159` notified-才-commitCursor → 分离）：**
1. **采集**：每轮拉到的新 comments **先逐条 append 进 Event Log**（`comment:{repo}#{n}:{commentId}` 幂等）→ append 成功即 `advanceCursor`（**无论是否通知**）
2. **投递**：append 后查投递策略（Task 6 规则表）决定是否走既有 `issueCommentRouter.route` 通知 owner；通知失败 → 投影 `deliveryCursor` 滞后标记 + 下轮重试投递（**不重新采集**）
3. 既有 owner 通知行为兼容：已注册 tracking 且策略放行 → 通知照旧格式发

**TDD 核心红测试：** 模拟 route 失败 → 断言采集 cursor 已推进 + 事件在 log + deliveryCursor 滞后；下轮重试只投递不重复 append。

## Task 5: routed 自动注册 tracking

**Files:**
- Modify: `packages/api/src/routes/community-issues.ts`（routed 事件 ingest 处）+ 未来 F128 路由共用的注册 helper
- Create: `packages/api/src/domains/community/community-auto-tracking.ts`
- Test: Redis 测试——`case.routed` append 成功 → TaskStore 出现对应 `issue_tracking`/`pr_tracking` 记录（threadId/catId 来自 routed payload）

**设计约束（写死）：** 副作用挂在 **ingest 成功回调**（首次 append 返回 `appended: true` 时触发），**绝不放 projector.apply**——rebuild 重放时 `appended: false`（dedup 命中）天然不触发，重建零副作用。注册幂等（同 subjectKey 已有 tracking → no-op）。

## Task 6: awaiting_external 闭环

**Files:**
- Modify: `packages/api/src/routes/community-issues.ts`：`POST /api/community-issues/:subjectKey/await-external`（callback auth；append `case.awaiting_external`）
- Modify: `packages/mcp-server/src/tools/`（薄 MCP 工具 `cat_cafe_community_await_external`，描述按 writing-skills 价值门禁写）
- Modify: `packages/api/src/domains/community/community-state-machine.ts`（转换：`in_progress → awaiting_external`（case.awaiting_external）；`awaiting_external → in_progress`（外部活动事件））
- 完成: `community-delivery-policy.ts`

**投递策略规则表（完整核心，纯函数）：**

```typescript
export type DeliveryDecision = 'wake-owner' | 'silent-log';
export function decideDelivery(input: {
  state: CommunityObjectState;
  eventKind: CommunityEventKind;
  authorAssociation?: GitHubAuthorAssociation;
}): DeliveryDecision {
  // 家系活动（OWNER/MEMBER 发的 comment/review）→ 静默：自己家的动作不吵 owner
  // awaiting_external + 外部活动（其余 association 的 comment / review_submitted / CI 终态）→ wake + 状态机自动恢复 in_progress
  // 非 awaiting_external 状态：外部 comment → wake-owner（现行为兼容）
  // labeled → silent-log（label 变化进投影，不吵猫——needs-info→accepted 的语义判断留 narrator）
}
```

**TDD：** 规则表全组合表驱动测试红→绿；状态机新转换测试（含 closure invariant 回归不破）红→绿；端点 + MCP 工具集成测试；commit ×3。

## Task 7: focused 集成测试（终态设计 Phase B 指定交付物）

**Files:**
- Create: `packages/api/test/redis-community-issue-signals-e2e.test.js`

两条链路（Redis-backed，全真组件，仅 GitHub IO stub）：
1. **needs-info 链**：issue routed（自动 tracking 注册 ✓）→ owner 标 needs_info → reporter comment（webhook 路径）→ append + 采集 cursor 推进 → decideDelivery=wake → owner thread 收通知，投影 lastExternalActivityAt 更新
2. **awaiting_external 链**：owner 声明 await-external（MCP→端点→事件）→ maintainer comment（OWNER association）→ silent-log（log 有、通知无）→ reporter comment → wake + 投影自动恢复 in_progress

## Task 8: ownership cell 更新 + 收尾

cell 文件清单补 Phase B 新文件；`pnpm gate`；quality gate report（**交付清单逐项 ls 验证**）。

---

## 交付切分建议（避免 Phase A 式 6 轮巨型 review）

| PR | 内容 | 依赖 |
|---|---|---|
| PR-1 采集面 | Task 1+2+3（types / webhook 三件套 / link parser） | 无；Task 0 运维验收并行推进 |
| PR-2 消费语义面 | Task 4+5+6+7+8（双 cursor / 自动 tracking / awaiting 闭环 / e2e） | PR-1 merged |

每个 PR 独立过 gate + 本地 review + 云端 review；PR-1 合入即对"追评收不到 event"产生用户可见价值。

## Open Questions

**技术 OQ（实现猫自决）：** deliveryCursor 滞后标记的具体存储（投影字段 vs 独立 retry 队列）——按最小实现选投影字段，重试随下轮轮询自然发生；webhook `pull_request.closed` 与轮询检测点（CiCdRouter/ReviewFeedback）的 dedup 验证（sourceEventId 不同源：delivery ID vs 合成 ID——**两路径的 merged 事实需统一合成键 `prstate:{repo}#{n}:merged`**，实现时确认轮询侧现有 sourceEventId 格式后对齐）。
**价值 OQ：** 仅 Task 0 的 execute 触发人（已附 Decision Packet，铲屎官在 Task 0 流程内拍板，不阻塞 PR-1 开发）。

## 验收口径

7 条 AC 全绿 + 两个 PR 各自过完整 review 链 + Task 0 production bootstrap 完成 + alpha 验收：真实 webhook 投一条 issue comment（测试 issue）观察 log→投影→唤醒全链路。

[宪宪/Fable-5🐾]
