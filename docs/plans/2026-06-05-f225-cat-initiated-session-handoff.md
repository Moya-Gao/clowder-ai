# F225 Cat-Initiated Session Handoff Implementation Plan

**Feature:** F225 — `docs/features/F225-cat-initiated-session-handoff.md`
**Goal:** 猫在干净断点主动提议封印当前 session → 铲屎官 gate → spawn 同 thread 同 catId 续接 + 注入猫亲手写的五件套交接留言
**Acceptance Criteria:**
- AC-A1: `cat_cafe_propose_session_handoff` MCP tool 注册 + 附五件套留言 → proposal + 确认卡
- AC-A2: gate 双路径——reject/expire 不 seal、approve 才封印
- AC-A3: discriminated `SessionHandoffProposal`，复用 CAS 不复用 `ThreadProposal` shape
- AC-A4: 滥用边界——≤1 pending/active session + per (user,thread,cat) cooldown
- AC-B1: approve 后 seal，`sealReason='cat_initiated_handoff'`
- AC-B2: 五件套 typed 字段 + always-keep 注入，extractive/compress 默认下续接第一眼可见
- AC-B3: 续接同 thread 同 catId、seq+1
- AC-B4: approve 两阶段——commit point 前 fail/expire、后 recover-forward，不留半封印孤儿
- AC-B5: stale note 隔离——仅 `cat_initiated_handoff` + 对应 proposal 注入
- AC-B6: crash window 闭合——accepted 后 checkpoint 前崩 → session 侧反推 backfill + enqueue 恰好一次
**Architecture cell:** identity-runtime-session
**Map delta:** update required
**Map delta why:** 新增 `sealReason='cat_initiated_handoff'` + `SessionRecord.catHandoffNote` typed 字段 + `SessionHandoffProposal` 类型 + propose_session_handoff 触发源；落地后更新 cell cited_by。
**Architecture:** 复用现有 `requestSeal` / `buildSessionBootstrap` / proposal CAS 思路；新增 discriminated `SessionHandoffProposal` + commit-point approve 事务（pre-commit fail/expire → commit point 不可逆 → post-commit recover-forward → crash recovery session 侧反推 backfill）+ `catHandoffNote` always-keep bootstrap 注入（不依赖 `bootstrapDepth`）。
**Tech Stack:** TypeScript, Redis-backed stores（6398 worktree）, MCP callback route, `node:test`
**前端验证:** Yes（Phase A 确认卡是 rich block，reviewer 需 Playwright/Chrome 验渲染 + approve/reject 按钮）

---

## Straight-Line Check

**Finish line (B):** 猫调 `propose_session_handoff` → 确认卡 → 铲屎官 approve → 当前 session seal（`cat_initiated_handoff`）+ `catHandoffNote` 持久化 → 续接 session bootstrap 第一眼（extractive/compress 默认下）含五件套 → F128 thread opus-48 dogfood 成功。

**NOT building:** 自动 handoff（仍靠 compress/threshold）；跨 thread handoff（F128 管）；多 pending proposal 队列（≤1 硬限）；改 `requestSeal` 签名（用 note.proposalId 反推，不动 SessionRecord 之外接口）。

**Terminal schema（围绕这个建，不是脚手架）:**

```typescript
// packages/shared/src/types/session.ts — SessionRecord 扩展
interface CatHandoffNote {
  proposalId: string;       // 反推 commit point 的 key（KD-9）
  sourceSessionId: string;
  done: string;             // 五件套
  worktreeBranch?: string;
  commits?: string[];
  nextSteps: string;
  gotchas?: string;
  persistedAt: number;
}
interface SessionRecord {
  // ...现有字段
  catHandoffNote?: CatHandoffNote;  // typed，非 continuityCapsule:unknown
}
type SealReason = /* 现有 */ | 'cat_initiated_handoff';

// packages/shared/src/types/session-handoff-proposal.ts — 新文件（不碰 ThreadProposal）
type HandoffProposalStatus = 'pending' | 'approving' | 'approved' | 'rejected' | 'expired';
interface SessionHandoffProposal {
  kind: 'session_handoff';
  proposalId: string;
  status: HandoffProposalStatus;
  sourceThreadId: string;
  sourceSessionId: string;
  sourceCatId: CatId;
  userId: string;
  note: CatHandoffNote;
  // commit-point checkpoints（KD-8/9）
  handoffNotePersistedAt?: number;
  sealedSessionId?: string;
  sealAcceptedAt?: number;
  continuationEntryId?: string;
  createdAt: number;
  updatedAt: number;
}
```

---

## Phase A — 提议 + Gate

### Task A1: `SessionHandoffProposal` 类型 + Redis-backed store（CAS claim）

**Files:**
- Create: `packages/shared/src/types/session-handoff-proposal.ts`
- Create: `packages/api/src/domains/cats/services/stores/ports/SessionHandoffProposalStore.ts`（in-memory + Redis 双实现，对齐既有 ProposalStore 模式）
- Test: `packages/api/test/session-handoff-proposal-store.redis.test.ts`（**Redis-backed**，不靠 in-memory dense store）

**Step 1–5 (TDD):**
1. 写失败测试：`claimForApproval` 对 `pending` proposal 原子 CAS 成功置 `approving`；并发第二次 claim 返回 null（断言只有一个赢）。
2. 跑测试 → FAIL（store 未实现）。
3. 最小实现：Redis Lua CAS（对齐 `ProposalStore` 的 `claimForApproval`），`create`/`get`/`claimForApproval`/`patch`/`finalize`/`reject`/`expire`。
4. 跑测试 → PASS。
5. Commit：`feat(F225): SessionHandoffProposal type + Redis store with CAS claim`

**关键断言**：并发 claim 只有一个成功（防 replay，AC-A3/B4）；`patch` 能写 checkpoint 字段。

### Task A2: `sealReason='cat_initiated_handoff'` + `SessionRecord.catHandoffNote` typed 字段

**Files:**
- Modify: `packages/shared/src/types/session.ts`（加 `catHandoffNote` + `SealReason` union 扩展）
- Modify: `SessionRecordPatch`（允许 patch `catHandoffNote`）
- Modify: `SessionChainStore` in-memory + Redis update（持久化 catHandoffNote）
- Test: `packages/api/test/session-chain-store-handoff-note.redis.test.ts`

**Step 1–5:** Red（patch catHandoffNote → get 回读一致；Redis 序列化往返）→ Green（store update 支持新字段）→ Commit `feat(F225): catHandoffNote typed field + cat_initiated_handoff seal reason`。

**关键断言**：catHandoffNote Redis 往返不丢字段；`shared` 改后 `pnpm --filter @cat-cafe/shared build`。

### Task A3: MCP tool `cat_cafe_propose_session_handoff` + 确认卡

**Files:**
- Create: `packages/api/src/routes/callback-propose-session-handoff-routes.ts`（callback route，cat auth，对齐 `callback-propose-thread-routes.ts`）
- Modify: `packages/mcp-server/src/tools/` 注册新 tool（五件套参数 schema）
- Create: 确认卡 builder `buildHandoffProposalCardBlock`（rich card，approve/reject 按钮，展示五件套）
- Test: `packages/api/test/propose-session-handoff-route.test.ts`

**Step 1–5:** Red（POST propose → 创建 SessionHandoffProposal + append 确认卡到 source thread）→ Green → Commit `feat(F225): propose_session_handoff MCP tool + confirmation card`。

**关键断言**：tool 参数 schema 校验五件套；卡片含 sessionId + 五件套 + approve/reject。

### Task A4: 滥用边界（≤1 pending/active session + cooldown）

**Files:**
- Modify: `callback-propose-session-handoff-routes.ts`（propose 前查 active session 是否已有 pending handoff proposal + per (user,thread,cat) cooldown 窗口）
- Test: `packages/api/test/propose-session-handoff-ratelimit.redis.test.ts`

**Step 1–5:** Red（同 active session 第 2 张 pending → 拒；cooldown 窗口内 → 拒；reject/expire 后释放）→ Green → Commit `feat(F225): handoff propose rate limit (1 pending/session + cooldown)`。〔AC-A4 / FX-4〕

---

## Phase B — 封印 + 续接 + 注入

### Task B1: commit-point approve dispatcher

**Files:**
- Create: `packages/api/src/routes/session-handoff-approve-routes.ts`（user auth，**不混入** `proposal-routes.ts` 旧建-thread approve）
- Test: `packages/api/test/session-handoff-approve.redis.test.ts`

**事务顺序（spec Approve 事务顺序节）:**
```
Pre-commit:  claim → 校验 sourceSessionId 仍是同(user,thread,cat,seq)active → 持久化 catHandoffNote + 记 handoffNotePersistedAt
Commit pt:   requestSeal → rejected=pre-commit fail/expire；accepted → 记 sealedSessionId/sealAcceptedAt（自此禁 rollback）
Post-commit: enqueue 同thread continuation(idempotency key) + 记 continuationEntryId → finalize approved
```

**Step 1–5:** Red（多个测试：happy path approve → seal + catHandoffNote 落 SessionRecord；reject → 不 seal；session 已变 → reject）→ Green → Commit `feat(F225): commit-point approve dispatcher`。〔AC-A2/B1/B4〕

### Task B2: `catHandoffNote` always-keep bootstrap 注入

**Files:**
- Modify: `packages/api/src/domains/cats/services/session/SessionBootstrap.ts`（在 identity 块附近加 always-keep handoff note block，**不依赖 `bootstrapDepth`**；读 prevSession.catHandoffNote）
- Test: `packages/api/test/session-bootstrap-handoff-note.test.ts`

**Step 1–5:** Red（**bootstrapDepth 未配/extractive** 时，续接 bootstrap text 含五件套内容）→ Green（always-keep block + HANDOFF_MARKER 包裹 + sanitize）→ Commit `feat(F225): always-keep catHandoffNote injection (extractive-visible)`。〔AC-B2 / FX-3〕

**关键断言**：extractive 模式断言 prremium含五件套（这是 R1 P1 的核心修复，必须 Redis/真实 bootstrap 路径测，非 mock）。

### Task B3: crash recovery（session 侧反推 backfill）

**Files:**
- Modify: `session-handoff-approve-routes.ts` + 加 recovery 函数 `recoverStaleHandoffProposal`
- Test: `packages/api/test/session-handoff-crash-recovery.redis.test.ts`

**Recovery 规则（KD-9）:**
```
proposal 有 handoffNotePersistedAt 无 sealedSessionId →
  cross-check session: 已 sealing/sealed + cat_initiated_handoff + note.proposalId 匹配
    → backfill sealedSessionId/sealAcceptedAt → 续跑 enqueue/finalize
  session 仍 active → 真 pre-commit fail/expire
有 sealedSessionId 无 continuationEntryId → idempotent enqueue
有 continuationEntryId 无 finalize → finalize
```

**Step 1–5:** Red（**模拟 crash**：accepted 后不写 checkpoint，跑 recovery → 从 session 反推 backfill + enqueue 恰好一次；session 仍 active → fail/expire）→ Green → Commit `feat(F225): crash-window recovery via session-side backfill`。〔AC-B6 / FX-2c〕

### Task B4: stale note 隔离

**Files:**
- Modify: `SessionBootstrap.ts` 注入处（catHandoffNote 仅在 session `sealReason='cat_initiated_handoff'` + note.proposalId 对应 approved/recovering proposal 时注入）
- Test: `packages/api/test/session-bootstrap-stale-note-isolation.test.ts`

**Step 1–5:** Red（note 已写但 session 被 threshold seal 抢先 → 续接不注入该 note）→ Green → Commit `feat(F225): stale note isolation (threshold-seal-steals guard)`。〔AC-B5 / FX-2b〕

### Task B5: continuation idempotency + seq 续接验证

**Files:**
- Modify: enqueue 处带 idempotency key（`proposalId`/`sourceSessionId`）
- Test: `packages/api/test/session-handoff-continuation.redis.test.ts`

**Step 1–5:** Red（续接 session 同 thread 同 catId seq+1；重放同 proposalId → 不重复唤醒）→ Green → Commit `feat(F225): continuation idempotency key + seq+1 continuation`。〔AC-B3 / FX-1〕

---

## 收尾（实现后）

1. `pnpm gate`（worktree 6398）全绿 + 全部 FX-1~4/2b/2c 红→绿证据
2. quality-gate（spec 合规 + 愿景对照）
3. @砚砚 receive-review（重点 commit-point/recovery/stale note 的 Redis-backed 测试覆盖）
4. merge-gate → 云端 review → squash merge
5. 更新 identity-session cell cited_by（F225 delta）
6. 愿景守护（非作者非 reviewer 猫）
7. F128 thread opus-48 dogfood
8. feat-lifecycle close

## Open Questions（实现时自决，无价值 OQ 需升级）

- OQ-5（spec）：`catHandoffNote` 用 `SessionRecord` 字段（本 plan 选）vs 独立 `SessionHandoffStore` → 选字段（绑 session 生命周期 + 复用 SessionChainStore 读取，Task A2）。技术 OQ，自决。
- continuation enqueue 复用 `QueueProcessor` 现有入口（砚砚 R1 OQ-2 确认现成路径）→ Task B5 验证 busy/active-session 校验。
