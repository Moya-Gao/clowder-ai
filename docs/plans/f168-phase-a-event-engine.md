# F168 Phase A — 社区事件引擎 Implementation Plan

**Feature:** F168 — `docs/features/F168-community-ops-board.md`（reopened 2026-06-10）
**终态设计:** `docs/discussions/2026-06-09-f168-community-ops-final-design.md`（v1.1，砚砚 review 放行 5972a7a16）
**Goal:** 所有社区事件写入持久化 Event Log，CommunityObject 投影可从事件流重建，状态机自带最小 closure invariant，看板 API 读投影——看板与守门 thread 状态自此同源。
**Acceptance Criteria（从终态设计 §7 Phase A 提取）:**
1. 现有 3 类入口事件（webhook / RepoScan 轮询 / 看板手动 dispatch）全部 append 进 Event Log，`sourceEventId` 幂等去重
2. CommunityObject 投影由事件流推导，删掉物化数据后可全量重建且 diff 为空
3. 状态机拒绝 `fixed → closed` 直接转换；必经 `reported` 或 `waived(reason, actor, evidence)`
4. PR merged / issue closed 事实事件自动驱动投影状态转换（不依赖猫口头声明）
5. 看板聚合 API 读 CommunityObject 投影（响应 shape 向后兼容，前端零改动）
6. 现存 CommunityIssueStore 数据通过 bootstrap 事件迁入投影（dry-run diff 可验证）

**Architecture cell:** community-ops（新建）
**Map delta:** new cell required
**Map delta why:** 社区事件引擎是新领域（事件 log + 投影 + 状态机），现有 cells（dispatch/transport）只覆盖通知投递，不覆盖案件状态。Task 0 建 cell。
**Architecture:** Event-sourcing 轻量版：append-only Event Log（家里内部案件状态 canonical）→ 纯函数状态机 → CommunityObject 物化投影（可重建）。现有通知路径（ConnectorInvokeTrigger）原样保留，Phase A 只新增事件副作用，不切换唤醒逻辑。
**Tech Stack:** TypeScript + Redis（参考 `RedisRuntimeSessionStore` 的 store 风格）+ node:test
**前端验证:** No（纯后端，API shape 兼容由测试断言）

---

## NOT building（Phase A 明确不做，防 scope 膨胀）

- ❌ issue comment / review / label 等新事件类型采集（Phase B）
- ❌ 唤醒逻辑切换——`ConnectorInvokeTrigger` 现路径原样不动（Phase B/C 才切投影驱动）
- ❌ 投递 cursor 逻辑（schema 预留字段，Phase B 实现；Phase A 的"采集 cursor"语义见 Task 2 注记）
- ❌ narrator / Role Registry / F128 路由扩展（Phase C）
- ❌ reconciler cron / closure 完整 checklist UX（Phase D；**最小 invariant 在本 Phase**）
- ❌ 看板前端改版（Phase E）
- ❌ 删除 `CommunityIssueStore` / `CommunityPrStore`（标 deprecated 注释，Phase B 末投影验证通过后删）

## 给实现猫的纪律注记

- **Redis 测试**：所有 store 行为用 `pnpm --filter @cat-cafe/api test:redis` 验证（in-memory stub 测不出索引/分页/并发行为——LL：F211 PR #1940）。worktree 只用 6398。
- **持久化**：事件与投影是用户可追溯数据，**TTL=0 默认持久**（铁律 #5 / LL-048）。
- 改 `packages/shared` 后跑 `pnpm --filter @cat-cafe/shared build` 再测下游。
- 引擎代码**零猫名/零品牌/零 repo 常量**（终态设计 §5 多租户边界；guardian 路由的 `getRoster()` 耦合是 Phase C 的 RoleResolver 迁移点，本 Phase 不碰）。
- 每个 Edit 看 LSP `<new-diagnostics>`。

---

## Task 0: ownership map 新 cell

**Files:**
- Create: `docs/architecture/ownership/cells/community-ops.md`
- Modify: `docs/architecture/ownership/README.md`（cells 表加一行）

**Step 1:** 仿照 `cells/dispatch.md` 格式写 community-ops cell：scope = 社区事件 log / 投影 / 状态机 / 看板读模型；features = F168；关键文件 = 本 plan Task 1-9 的 Create 清单。
**Step 2:** README 表格加行，commit `docs(F168): add community-ops ownership cell`。

## Task 1: shared types — 事件 schema + 状态机类型

**Files:**
- Create: `packages/shared/src/types/community-event.ts`
- Modify: `packages/shared/src/types/index.ts`（导出）
- Test: 类型为主无运行时测试；transition 表测试在 Task 3

**Step 1: 写类型（完整代码）**

```typescript
// packages/shared/src/types/community-event.ts
export type CommunityEventKind =
  // Phase A 外部事实（现有 3 入口 + 终态事实事件）
  | 'issue.opened' | 'pr.opened' | 'pr.ready_for_review'
  | 'pr.merged' | 'pr.closed' | 'issue.closed' | 'issue.reopened'
  // Phase A 内部决策事件
  | 'case.triaged' | 'case.routed' | 'case.reported' | 'case.waived' | 'case.declined'
  // 迁移合成
  | 'case.bootstrap';

export type CommunityEventClassification =
  | 'state-changing' | 'needs-human' | 'needs-owner' | 'informational' | 'stale';

export interface CommunityEvent {
  /** 幂等去重键：webhook delivery ID / `scan:{repo}:{number}:{kind}` / `manual:{uuid}` */
  sourceEventId: string;
  /** 复用现有 tracking 约定：`issue:{owner}/{repo}#{n}` | `pr:{owner}/{repo}#{n}` */
  subjectKey: string;
  kind: CommunityEventKind;
  classification: CommunityEventClassification;
  payload: Record<string, unknown>;
  at: number;
}

export type CommunityObjectState =
  | 'new' | 'triaged' | 'routed' | 'in_progress' | 'awaiting_external'
  | 'needs_info' | 'fixed' | 'reported' | 'closed' | 'declined';

export type CommunityNextOwner = 'role' | 'external_author' | 'ci' | 'cvo' | 'none';

export interface CommunityClosureWaiver {
  reason: string;
  actor: string;     // role 或 catId（引擎不校验 roster——多租户边界）
  evidence: string;  // 链接/commit/说明
}

export interface CommunityObjectProjection {
  repo: string;
  type: 'issue' | 'pr';
  number: number;
  subjectKey: string;
  state: CommunityObjectState;
  ownerThreadId: string | null;
  ownerRole: string | null;
  nextOwner: CommunityNextOwner;
  lastExternalActivityAt: number | null;
  lastPublicCommentAt: number | null;
  linkedIssues: number[];
  linkedPrs: number[];
  closureWaiver: CommunityClosureWaiver | null;
  /** 已消费的事件数（per-subject log 内序号），重建一致性校验用 */
  appliedEventCount: number;
  /** Phase B 投递 cursor 预留：本 Phase 不写逻辑 */
  deliveryCursor: number | null;
  createdAt: number;
  updatedAt: number;
}
```

**Step 2:** `pnpm --filter @cat-cafe/shared build` 过 + commit。

## Task 2: CommunityEventLog store（Redis append-only + 幂等去重）

**Files:**
- Create: `packages/api/src/domains/community/CommunityEventLog.ts`（接口 + Redis 实现，参考 `RedisRuntimeSessionStore` 风格）
- Test: `packages/api/test/redis/community-event-log.test.ts`

**接口（完整）：**

```typescript
export interface CommunityEventLog {
  /** 幂等 append：sourceEventId 已存在 → { appended: false }，不重复写 */
  append(event: CommunityEvent): Promise<{ appended: boolean; sequence: number }>;
  /** per-subject 顺序读，fromSequence 起（重建/投影消费用） */
  read(subjectKey: string, fromSequence?: number): Promise<CommunityEvent[]>;
  listSubjects(): Promise<string[]>;
}
```

**Redis key schema：**
- `community:events:log:{subjectKey}` — LIST，per-subject 有序事件
- `community:events:seen` — SET，sourceEventId 全局去重
- key 常量放 `packages/api/src/domains/community/community-keys.ts`（参考 `redis-keys/` 惯例）

**TDD 步骤：**
1. 失败测试：append 两次同 `sourceEventId` → 第二次 `{ appended: false }`，`read` 只返回 1 条；append 不同事件 → 顺序保持
2. 跑红（`pnpm --filter @cat-cafe/api test:redis` 指向新文件）→ 最小实现（MULTI/EXEC 保证 seen+log 原子）→ 跑绿 → commit

**采集 cursor 注记（防过度建设）**：Phase A 三个入口的"采集 cursor"天然存在——webhook 是推送（HTTP ack 即完成）、RepoScan 复用现有 `ReconciliationDedup`、手动 dispatch 是单击动作。**append 成功 = 采集完成**，不需要新 cursor 存储。真正的 cursor 改造（`IssueCommentTaskSpec:194` 语义修正）属于 Phase B。

## Task 3: 状态机纯函数（closure invariant 先红）

**Files:**
- Create: `packages/api/src/domains/community/community-state-machine.ts`
- Test: `packages/api/test/community-state-machine.test.ts`（纯函数，普通 node:test 即可）

**接口与转换表（完整）：**

```typescript
export type TransitionResult =
  | { ok: true; next: CommunityObjectState }
  | { ok: false; reason: 'closure_invariant' | 'invalid_transition' };

/** 事件 → 目标状态意图的映射 + guard。纯函数，不碰 IO。 */
export function transition(
  current: CommunityObjectState,
  event: CommunityEvent,
  snapshot: Pick<CommunityObjectProjection, 'lastPublicCommentAt' | 'closureWaiver'>,
): TransitionResult;
```

转换规则（实现为显式表，不写 if 链）：
- `issue.opened`/`pr.opened`/`pr.ready_for_review` → `new`（仅当无既有状态）
- `case.triaged` → `triaged`；`case.routed` → `routed`；`case.declined` → `declined`
- `pr.merged`（subject 为 pr 或 linked）→ `fixed`
- `case.reported` → `reported`（同时投影层写 `lastPublicCommentAt`）
- `case.waived` → 不变更 state，投影层写 `closureWaiver`（payload 必须含 reason/actor/evidence，缺字段 → 拒绝）
- `issue.closed` → `closed`，**guard**：current 为 `fixed` 时要求 `snapshot.lastPublicCommentAt != null`（reported 已发生）**或** `snapshot.closureWaiver != null`，否则 `{ ok: false, reason: 'closure_invariant' }`
- 其余未定义组合 → `invalid_transition`

**TDD 步骤：**
1. **先红测试（invariant 核心）**：`fixed` + `issue.closed` + 无 reported 无 waiver → `closure_invariant` 拒绝；带 waiver → ok；经 `reported` → ok；`case.waived` 缺 evidence → 拒绝
2. 跑红 → 实现转换表 → 跑绿 → commit

## Task 4: CommunityObjectStore 投影 + projector（可重建）

**Files:**
- Create: `packages/api/src/domains/community/CommunityObjectStore.ts`（投影物化，Redis）
- Create: `packages/api/src/domains/community/community-projector.ts`（消费事件 → 调状态机 → 写投影）
- Test: `packages/api/test/redis/community-projector.test.ts`

**Redis key：** `community:object:{subjectKey}`（JSON）+ `community:objects:index`（SET）

**projector 核心约定：**
- `apply(event)`：读投影 → `transition()` → ok 则更新投影（state + 字段副作用 + `appliedEventCount++`）→ 写回；`closure_invariant` 拒绝 → 事件留在 log（事实不可删），投影记 `lastRejectedEvent`（可观测），状态不变
- `rebuild(subjectKey)`：删物化 → 从 log 顺序重放 → 全量重建
- `rebuildAll()`：遍历 `listSubjects()` 重建

**TDD 步骤：**
1. 失败测试：append 事件序列（opened→triaged→routed→pr.merged→reported→closed）→ 投影 state 逐步正确；`rebuild` 后投影与增量 apply 结果 deep-equal；invariant 拒绝路径投影不变
2. 跑红 → 实现 → 跑绿（Redis-backed）→ commit

## Task 5: bootstrap 迁移（CommunityIssueStore 现存台账 → 事件 + 投影）

**Files:**
- Create: `packages/api/src/domains/community/community-bootstrap.ts`
- Create: `scripts/community-bootstrap.mjs`（CLI 入口，`--dry-run` 默认开）
- Test: `packages/api/test/redis/community-bootstrap.test.ts`

**约定：**
- 读 `CommunityIssueStore` 全部记录 → 每条合成一个 `case.bootstrap` 事件（payload = 原记录完整快照；`sourceEventId = bootstrap:{subjectKey}`，幂等可重跑）→ projector 消费 → 投影初始 state 按映射表：`unreplied→new`、`discussing→triaged`、`pending-decision→triaged`、`accepted→routed`、`declined→declined`、`closed→closed`（bootstrap 的 closed 豁免 closure invariant——历史数据既成事实，豁免逻辑只对 `case.bootstrap` kind 生效）
- `--dry-run`：输出 will-create 投影 diff 报告，不写
- 原 store **只读不删**（deprecated 注释 + Phase B 末删除点）

**TDD：** 失败测试（造 3 条不同 state 的台账记录 → bootstrap → 投影正确 + 重跑幂等）→ 红 → 实现 → 绿 → commit。

## Task 6: 入口接线 1 — webhook 产生事件

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/github-repo-event/GitHubRepoWebhookHandler.ts`
- Test: 现有 webhook 测试旁新增事件断言

**约定：** 在现有"投递 Repo Inbox + 唤醒"逻辑**之后**新增副作用：构造 `CommunityEvent`（`sourceEventId` = webhook delivery ID，复用现有去重头）→ `eventLog.append` → `projector.apply`。**现有通知行为零改动**（断言旧路径输出不变）。append 失败不阻塞通知（log error + 继续——事件补偿靠 RepoScan 兜底）。

**TDD：** 失败测试（模拟 `issues.opened` webhook → 事件入 log + 投影 state=new + 原通知照发）→ 红 → 实现 → 绿 → commit。

## Task 7: 入口接线 2 — RepoScan 轮询 + 手动 dispatch 产生事件

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/github-repo-event/RepoScanTaskSpec.ts`
- Modify: `packages/api/src/routes/community-issues.ts`（`POST /:id/dispatch` handler，~:151）
- Test: 对应测试文件各加事件断言

**约定：** RepoScan 发现的漏网对象 → 合成 `sourceEventId = scan:{repo}:{number}:{kind}` append（webhook 已收过的因 dedup 自动 no-op）。手动 dispatch → `case.triaged` 内部决策事件（`manual:{uuid}`）。TDD 同上节奏，分两个 commit。

## Task 8: 事实事件接线 — PR merged/closed 驱动状态

**Files:**
- Modify: `packages/api/src/infrastructure/email/ConflictCheckTaskSpec.ts` 或 PR 终态检测既有位置（实现猫 trace `pr_tracking` task 标 `done` 的代码路径，在同一检测点 emit `pr.merged`/`pr.closed` 事件）
- Test: Redis-backed——PR tracking 检测到 merged → 事件入 log → linked issue 投影转 `fixed`

**约定：** linked issue 解析用投影的 `linkedPrs`（bootstrap/路由事件已填）；找不到 linked subject 时只写 PR 自身投影，不猜。TDD 节奏同上。

## Task 9: 看板聚合 API 读投影 + 全链路验证

**Files:**
- Modify: `packages/api/src/routes/community-issues.ts`（聚合端点 ~:569 三 store 聚合 → 读 `CommunityObjectStore`）
- Test: API 响应 shape 兼容性测试（对照现 shape 逐字段断言）+ 全链路 Redis 集成测试

**约定：** 响应 shape 向后兼容（前端零改动）：投影字段映射回现有响应字段，新增字段（`state`/`nextOwner`/`closureWaiver`）以扩展字段附加。旧 store 读路径保留 fallback？——**不**：投影经 bootstrap 已覆盖全量数据，直接切；万一数据缺失是 bootstrap bug，修 bootstrap 而不是留双读（双读=隐性脚手架）。
**收尾：** `pnpm gate` 全绿 → PR（merge-gate skill 接管）。

---

## Open Questions

**技术 OQ（实现猫自决）：**
1. Event log 用 LIST 还是 Redis Stream——LIST 简单够用，Stream 给 Phase B 消费组留余地；实现猫按现有 store 惯例选，写进 PR 描述
2. projector 并发 apply 的锁粒度（per-subject WATCH/MULTI 还是单 worker 串行）——按现有 TaskSpec 并发模型对齐

**价值 OQ：** 无。Phase A 纯后端、可逆（≤1 commit revert + bootstrap 不删原数据）、不碰外部契约。

## 验收口径

Phase A 完成 = 6 条 AC 全绿 + `pnpm gate` 过 + 砚砚 review 放行 + 合入 main 后跑一次真实 bootstrap（dry-run → 实跑）→ 看板数据与投影一致性抽查。验收用 alpha 通道（铁律 #4）。

[宪宪/Fable-5🐾]
