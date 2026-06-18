---
title: "F167 Gate-Keeping Thread Guard — Implementation Plan"
feature: F167
type: implementation-plan
date: 2026-06-17
---

# F167 Gate-Keeping Thread Guard — Implementation Plan

**Feature:** F167 — `docs/features/F167-zombie-hold.md`（关联 F168 community-ops board 守门 thread 规范）
**Goal:** 在 trigger-time 硬层 default-block 守门 thread 调用 `register_pr_tracking` / `register_issue_tracking` / `hold_ball`，防止"已 cross_post / propose 后还在守门 thread hold/挂 tracking"的双 owner、球权死锁事故。
**Architecture cell:** infrastructure/harness-enforcement
**Map delta:** none（在现有 callbacks 路由 + F229 threadKind union 上扩展）
**Map delta why:** 复用 F229 `Thread.threadKind` 持久化机制（已 wired ThreadStore / RedisThreadStore），不引入新 cell；只在 callbacks 路由层加 trigger-time guard + 在 GitHubRepoWebhookHandler 加 marker 设置。
**Architecture:** 三层 harness（ADR-031）：① 硬层 — `Thread.threadKind` union 加 `'gate-keeping'`，callbacks 三端点 default-block + `override='i-am-the-downstream-owner'` 反思窗口；② 软层 — opensource-ops SKILL.md trigger-time reflex；③ eval 层 — `gateKeepingHarnessAttemptCount` counter + F192 weekly verdict。
**Tech Stack:** TypeScript / Fastify routes / Zod / Redis (threadStore persist) / OpenTelemetry (counter+span)
**前端验证:** No — 服务端 enforcement，无 UI surface
**Source context:** 来自主 thread `thread_mp3ab0r9xqxrkrc5` 的诊断（同 session 同天 2 只猫连续在守门 thread 违规挂 PR tracking + hold_ball），propose 出 fix thread `thread_mqiwk2ir6u1jyrbk` 执行。

---

## 现状证据

- `cat-cafe-skills/opensource-ops/SKILL.md` L20-22 / L49 / L206 文字层 100%「守门 thread 不修 bug / 不替下游 hold」，trigger-time 0 enforcement
- `packages/shared/src/types/concierge.ts:69`：`ConciergeThreadKind = 'concierge'`（F229 已 wired）
- `packages/api/src/domains/cats/services/stores/ports/ThreadStore.ts:180,466,857-864`：`threadKind?: 'concierge'` + `setThreadKind(threadId, kind)` API ready
- `packages/api/src/routes/callbacks.ts:2230-2244` / `callback-hold-ball-routes.ts:74-101`：三个目标端点已用 `opts.threadStore`（L2850/2855/2860 注入），加 guard 不增依赖
- `packages/api/src/infrastructure/connectors/github-repo-event/GitHubRepoWebhookHandler.ts:482` `ensureInboxThread` = 唯一新建 inbox thread 路径，是 marker 唯一注入点

## Stateful Object Gate（必填）

`Thread.threadKind` 是有 lifecycle 的状态对象。Census：

| Stateful 对象 | Lifecycle owner | 旁路禁止 |
|--------------|----------------|---------|
| `Thread.threadKind = 'concierge'` | `ConciergeThreadService` (F229 已写) | F128 propose 不可标 |
| `Thread.threadKind = 'gate-keeping'`（本 PR 新增） | `GitHubRepoWebhookHandler.ensureInboxThread` + 一次性 migration script | F128 propose / 普通 thread 创建路径不可标 |

### 状态×事件转移表

| 当前 | 事件 | 新状态 | 备注 |
|------|------|-------|------|
| `undefined` | `ensureInboxThread` 创建新 inbox thread | `'gate-keeping'` | 唯一 happy path |
| `undefined` | migration script 扫已绑定 ConnectorThreadBindingStore inbox | `'gate-keeping'` | Phase 7 一次性 |
| `'gate-keeping'` | 任何重复 ensureInboxThread / migration | `'gate-keeping'` | Idempotent（不变） |
| `'concierge'` | 任何 inbox 路径 | **rejected** | INV-G1 互斥 |
| `'gate-keeping'` | `threadStore.setThreadKind(id, null)` 显式清除 | `undefined` | 现有 API，不在本 PR 调用 |
| 任何 | F128 proposal 创建 thread | 不变（不打标） | INV-G6 |

### 不变量清单

- **INV-G1**: `threadKind` 是 union 单值（`'concierge'` XOR `'gate-keeping'` XOR `undefined`），不可并存。测试：`thread-kind-mutual-exclusion.test.ts`
- **INV-G2**: 守门 thread (`threadKind === 'gate-keeping'`) 调用 `register_pr_tracking` / `register_issue_tracking` / `hold_ball` 无 `override` → 400。测试：`gate-keeping-guard-*.test.ts` 各 3 个
- **INV-G3**: 守门 thread 调用 + `override === 'i-am-the-downstream-owner'` → 通过（路径正常） + telemetry counter `outcome='override_used'`。测试：同上 each
- **INV-G4**: 非守门 thread (`threadKind !== 'gate-keeping'`) 调用 = noop guard，零行为差异。测试：同上 each（regression cover）
- **INV-G5**: `ensureInboxThread` 创建新 thread 后 `thread.threadKind === 'gate-keeping'`；已存 thread 不变。测试：`ensure-inbox-thread-sets-kind.test.ts`
- **INV-G6**: F128 propose 出来的 thread 不被打 gate-keeping kind。测试：`propose-thread-no-gate-keeping-leak.test.ts`
- **INV-G7**: `threadStore.get` 失败（503 / null）→ guard fail-open（不 block），但记 telemetry `outcome='guard_skipped'`，避免 threadStore 抖动让现有 PR tracking 链路挂掉。测试：`guard-fail-open-on-thread-store-error.test.ts`

### 对抗场景

- Crash window：`ensureInboxThread` 创建 thread 成功但 `setThreadKind` 还没跑 → 下次 webhook 触发 `ensureInboxThread` 走 getByExternal 命中现有 binding，**不会**重设 threadKind。**解决方案**：把 `setThreadKind` 放进 binding 同事务（NX lock 保护范围内），且 `ensureInboxThread` 加 self-heal —— 命中现有 binding 时检查 thread.threadKind，若缺则补打（F229 R19 P2 同模式）。测试：`ensure-inbox-thread-self-heal-missing-kind.test.ts`
- 并发双写：两个 webhook 同时触发同 repo `ensureInboxThread`，已有 KD-20 NX lock 保护
- 旁路滥用：F128 propose 路径调用 `threadStore.create` 不经 `ensureInboxThread`，**默认 `threadKind = undefined`**，受 type system 保护。INV-G6 cover
- `threadStore.get` 抖动：fail-open（INV-G7）

---

## Phases

### Phase 1: Schema 扩展（packages/shared）

**Files:**
- Modify: `packages/shared/src/types/concierge.ts:69`
- Modify: `packages/shared/src/types/index.ts:279`

**Step 1.1**: 扩展 `ConciergeThreadKind` 为通用 `ThreadKind` union
```typescript
// 现状：
export type ConciergeThreadKind = 'concierge';

// 改为：
export type ConciergeThreadKind = 'concierge';
export type GateKeepingThreadKind = 'gate-keeping';
/** F167 Phase X: Union of all special thread kinds (concierge | gate-keeping). */
export type ThreadKind = ConciergeThreadKind | GateKeepingThreadKind;
```

**Step 1.2**: 更新 `index.ts` 导出
```typescript
export type {
  ConciergeThreadKind,
  GateKeepingThreadKind,
  ThreadKind,
} from './concierge.js';
```

**Step 1.3**: 扩展 `ThreadStore.ts:180` 和 `setThreadKind` signature
```typescript
// 现状：threadKind?: 'concierge';
// 改为：
threadKind?: ThreadKind;

// setThreadKind:
setThreadKind(threadId: string, kind: ThreadKind | null): Promise<void>;
```

**Step 1.4**: 更新 `RedisThreadStore.ts:1226-1227` 反序列化白名单
```typescript
if (data.threadKind === 'concierge' || data.threadKind === 'gate-keeping') {
  result.threadKind = data.threadKind;
}
```

**Step 1.5**: `pnpm --filter @cat-cafe/shared build` → commit

### Phase 2: 硬层 Guard — callbacks.ts (`register_pr_tracking` + `register_issue_tracking`)

**Files:**
- Modify: `packages/api/src/routes/callbacks.ts:2232-2244, 2354-2361`
- Test: `packages/api/test/gate-keeping-guard-register-pr-tracking.test.js`（新）
- Test: `packages/api/test/gate-keeping-guard-register-issue-tracking.test.js`（新）

**Step 2.1 RED**: 写测试 `gate-keeping thread + register_pr_tracking 无 override → 400`
- 用 RedisThreadStore 真测（feedback_inmemory_store_tests_miss_redis_behavior P1）
- 测试矩阵 4 项（INV-G2/G3/G4/G7）：
  - thread `kind='gate-keeping'` + no override → 400 with `error: 'gate_keeping_thread_default_blocked'`
  - thread `kind='gate-keeping'` + `override='i-am-the-downstream-owner'` → 200，task 创建
  - thread `kind=undefined` + no override → 200，task 创建（regression cover）
  - threadStore.get throws → 200（fail-open）

**Step 2.2 RED 实测**：跑 test 看红 — `gate_keeping_thread_default_blocked` 错误码不存在

**Step 2.3 GREEN**: 在 `callbacks.ts:2246` `register-pr-tracking` handler 内、`taskStore.upsertBySubject` 之前加 guard：
```typescript
// F167 Phase X gate-keeping thread guard
let guardOutcome: 'blocked' | 'override_used' | 'pass' | 'guard_skipped' = 'pass';
let threadKind: string | undefined;
try {
  const thread = opts.threadStore ? await opts.threadStore.get(record.threadId) : null;
  threadKind = thread?.threadKind;
} catch (err) {
  guardOutcome = 'guard_skipped';
  log.warn({ threadId: record.threadId, err }, 'F167 gate-keeping guard: threadStore.get failed — fail-open');
}
if (threadKind === 'gate-keeping') {
  if (parsed.data.override !== 'i-am-the-downstream-owner') {
    guardOutcome = 'blocked';
    metrics.gateKeepingHarnessAttemptCount.add(1, { tool: 'register_pr_tracking', outcome: 'blocked' });
    reply.status(400);
    return {
      error: 'gate_keeping_thread_default_blocked',
      reason: '守门 thread 默认不挂 PR tracking——把球 cross_post 或 propose_thread 给下游 owner（opensource-ops SKILL 红线）',
      remediation: '若你确认自己是 PR 的下游 owner，传 override: "i-am-the-downstream-owner"；否则 cross_post 到负责 thread 或 propose 新 thread',
      threadKind: 'gate-keeping',
    };
  }
  guardOutcome = 'override_used';
  metrics.gateKeepingHarnessAttemptCount.add(1, { tool: 'register_pr_tracking', outcome: 'override_used' });
  log.warn({ threadId: record.threadId, catId, repoFullName, prNumber }, 'F167 gate-keeping override used');
}
if (guardOutcome === 'guard_skipped') {
  metrics.gateKeepingHarnessAttemptCount.add(1, { tool: 'register_pr_tracking', outcome: 'guard_skipped' });
}
```

**Step 2.4**: schema 加 override field：
```typescript
const registerPrTrackingSchema = z.object({
  // ... existing
  override: z.literal('i-am-the-downstream-owner').optional(),
});
```

**Step 2.5**: 同样改 `register-issue-tracking` handler (line 2363)

**Step 2.6 GREEN 实测**: 跑测试，4 项全绿

**Step 2.7**: commit `feat(F167): gate-keeping thread guard for PR/issue tracking`

### Phase 3: 硬层 Guard — `hold_ball` route

**Files:**
- Modify: `packages/api/src/routes/callback-hold-ball-routes.ts:74-78, 106-120`
- Test: `packages/api/test/gate-keeping-guard-hold-ball.test.js`（新）

**Step 3.1 RED**: 测试矩阵 4 项（同 Phase 2）
**Step 3.2 GREEN**: `holdBallSchema` 加 override；handler 内 parse 成功后、currentCount 检查之前加 guard。**注意**：复用 L249 的 `threadStore.get(threadId)`——抽到 guard 前避免重复 query
**Step 3.3**: commit

### Phase 4: 客户端 Schema — MCP tools

**Files:**
- Modify: `packages/mcp-server/src/tools/callback-tools.ts:1131-1155`（register_pr_tracking）
- Modify: `packages/mcp-server/src/tools/callback-tools.ts:1181-1206`（register_issue_tracking）
- Modify: `packages/mcp-server/src/tools/callback-tools.ts:2194-2217`（hold_ball — schema 推断在 L2209 reason 附近）
- Test: `packages/mcp-server/test/tool-registration.test.js`（regression — 三 tool 加 override 不破坏现有 schema 注册）

**Step 4.1**: 三 tool schema 加 `override: z.enum(['i-am-the-downstream-owner']).optional()` + handler body 透传
**Step 4.2**: `pnpm --filter @cat-cafe/mcp-server build` + tool-registration test 跑
**Step 4.3**: commit

### Phase 5: Marker 设置路径 — `ensureInboxThread`

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/github-repo-event/GitHubRepoWebhookHandler.ts:482-520`
- Test: `packages/api/test/ensure-inbox-thread-sets-gate-keeping-kind.test.js`（新）

**Step 5.1 RED**: 测试 3 项
- 新建 inbox thread 后 `thread.threadKind === 'gate-keeping'`（INV-G5）
- 已有 binding 但 `threadKind === undefined`（pre-PR thread）→ self-heal 补打（crash window 补救）
- 已有 binding 且 `threadKind === 'gate-keeping'` → idempotent，不重复打

**Step 5.2 GREEN**: 在 `ensureInboxThread` 创建 thread + bindingStore.bind 之后、return 之前加 `await this.deps.threadStore.setThreadKind(thread.id, 'gate-keeping')`；已有 binding 路径加 self-heal check

**Step 5.3**: commit

### Phase 6: Telemetry — F192 instrumentation

**Files:**
- Modify: `packages/api/src/infrastructure/telemetry/instruments.ts`（注册 counter）
- Modify: `packages/api/src/infrastructure/telemetry/metric-allowlist.ts`（or 同 file）

**Step 6.1**: 注册 `gateKeepingHarnessAttemptCount` counter
- attributes: `tool` ∈ {register_pr_tracking, register_issue_tracking, hold_ball}, `outcome` ∈ {blocked, override_used, guard_skipped}
- allowlist 加入

**Step 6.2**: commit

### Phase 7: Migration — 已绑定 inbox thread 批量标记

**Files:**
- Create: `packages/api/src/scripts/migrate-mark-gate-keeping-threads.ts`（一次性 script）
- Test: `packages/api/test/migrate-mark-gate-keeping-threads.test.js`

**Step 7.1 RED**: 测试两项
- 给定 ConnectorThreadBindingStore 里有 `CONNECTOR_ID` 的 binding，对应 thread `threadKind === undefined` → script 跑后变 `'gate-keeping'`
- 非 `CONNECTOR_ID` (e.g. feishu/telegram) binding 对应的 thread 不被打标

**Step 7.2 GREEN**: 写 script，扫 `bindingStore.listByUser`（or 类似 batch API）filter CONNECTOR_ID，对每个 thread 调 `setThreadKind`

**Step 7.3**: commit；script 入仓不自动跑，**Phase X close 后另开 small PR 执行 + CVO signoff**（不可逆操作 = 走 §4 选项 3 硬条件）

### Phase 8: 软层 — opensource-ops SKILL.md

**Files:**
- Modify: `cat-cafe-skills/opensource-ops/SKILL.md`

**Step 8.1**: 顶部 Repo Inbox 红线段（L13 后）插入 reflex line：
```markdown
> **🛑 trigger-time reflex 三选一**：守门 thread 首反完成后下一步**必须**是：
> ① `cat_cafe_cross_post_message` 到已有负责 thread / ② `cat_cafe_propose_thread` 开新 thread 派下游 / ③ 留 `needs-info` 等 daily sweep。
> **禁三件套**：① `cat_cafe_register_pr_tracking` ② `cat_cafe_register_issue_tracking` ③ `cat_cafe_hold_ball`。硬层 guard（F167 gate-keeping thread）会 default-block —— 传 `override: "i-am-the-downstream-owner"` 仅限你**确认自己是下游 owner**（不是守门猫）。
```

**Step 8.2**: B Inbound PR 段后追加 B0 段（守门猫 vs 下游 owner 判据）

**Step 8.3**: Common Mistakes 表第 8 行增强（带"硬层 default-block"补充）

**Step 8.4**: `pnpm sync:skills` 同步 HOME symlinks（feedback_sync_skills_after_new_skill）

**Step 8.5**: commit

### Phase 9: Quality-gate + Review + Merge

**Step 9.1**: `pnpm check` + `pnpm lint` + `pnpm --filter @cat-cafe/api test:redis`
**Step 9.2**: 自检 spec 合规（quality-gate skill）
**Step 9.3**: `request-review` → @gpt52（缅因猫跨族找 bug）
**Step 9.4**: review 修完 → `receive-review` → reviewer approve
**Step 9.5**: `merge-gate` → PR open + 云端 review → squash merge
**Step 9.6**: cross_post 回主 thread + 关闭本 fix thread

## Open Questions

- **OQ-1 [技术 OQ]**: telemetry counter 是否需要 per-fire span event（参考 F192 c1.zombie_hold_sample 模式）？**自决**：MVP 只需 counter；如果 verdict 显示需要 attribute 分桶再加 span event
- **OQ-2 [技术 OQ]**: 一次性 Migration script 在 PR 合入后什么时机跑？**自决**：Phase 7 script 入仓但不自动执行，Phase X close 后另开 small PR 由 CVO signoff 执行
- **OQ-3 [技术 OQ]**: `concierge` thread 是否要受同样 guard？**自决**：concierge 是前台猫专属，按定义不会接守门任务，guard 只 match `'gate-keeping'` exact，不扩展

## 验证策略

**TDD red-then-green**：每 phase 先红测后实现，跑 `pnpm --filter @cat-cafe/api test:redis` 而非纯 in-memory（feedback_inmemory_store_tests_miss_redis_behavior）。

**Regression**：Phase 2/3 必须含「非守门 thread = noop guard」测试（INV-G4），防止误伤现有 PR tracking 链路。

**Fail-open 验证**：threadStore.get throw 测试（INV-G7）防止 guard 抖动让生产挂掉。

---

## R1 Review Updates (@gpt52 review 2026-06-17)

### P1 #1 — Override 机制整体删除
- Override 字面量 `'i-am-the-downstream-owner'` 设计错误：三个端点都把状态绑到当前 invocation 的 threadId，守门 thread 内传 override 复现 dual-owner，下游 thread 内 guard 根本不触发——override 只是无意义且危险的逃生门。
- 整体删除：schema (callbacks.ts / callback-hold-ball-routes.ts) / helper (gate-keeping-guard.ts) / MCP client (callback-tools.ts) / 三个测试 INV-G3' (override claim ignored, guard still blocks)。
- Remediation 文本改为"请先 cross_post / propose 把球分发，守门 thread 没有 override 通道"。

### P1 #2 — Reconciliation deliver path 加入 self-heal
- 原 plan 漏覆盖：ensureInboxThread 只在 webhook 走（GitHubRepoWebhookHandler.handleWebhook → ensureInboxThread → marker stamp），但 reconciliation 路径（RepoScanTaskSpec.execute）直接 `bindingStore.getByExternal → binding.threadId` 不经 ensureInboxThread → pre-rollout 静默 repo（只有 reconciliation 没有 live webhook）的 inbox thread 永远不会被 stamp。
- 修：抽 `inbox-thread-resolver.ts` helper，导出 `resolveInboxThread()` (full lifecycle) + `selfHealInboxThreadKind()` (narrow, 不创建 thread)。Webhook 用 resolver，Reconciliation 用 selfHeal-only。Plugin factory (github-schedule-factories.ts) 接 threadStore.updateThreadKind 到 repo-scan factory。
- 测试新增 `repo-scan-gate-keeping-self-heal.test.js` 4 项：stamp on pre-rollout / idempotent / backward compat warn / fail-open delivery。

### INV 增补
- **INV-G8** (R1 fix #2): 所有 inbox deliver 路径必须先 self-heal 守门 marker 再 deliver。当前两条路径（webhook + reconciliation deliver）共享同一 resolver/helper 模块，新增 path 必须接同一 helper，否则违反 INV。
- **INV-G9** (R2 fix P2, 新增): self-heal 时机不能依赖 deliver 时序——guard 在猫调 MCP tool 时触发，可能早于下一次 deliver。所以**每个 reconciliation tick 的 admission.gate 必须 self-heal 所有 allowlisted repo 的 inbox binding**（per-repo loop 内调用 selfHealInboxThreadKind），独立于 run.execute 是否会 fire。当前实现：`RepoScanTaskSpec.admission.gate` 每个 repo iter 起始处调用。Failure-mode 同型升级 (R1 P1#2 + R2 P2 都是 "marker stamping timing assumption" 错位)，**坐标系修正**——不是补一个 deliver path，是把 stamping 提到 lifecycle owner 的更高边界（gate tick = 周期性 owner-side repair）。

### R2 Review Updates (@codex cloud review 2026-06-18, on HEAD `9d997e559`)

#### P2 — Repair existing inbox bindings before waiting for new signals
Cloud P2: "Because this self-heal only runs inside run.execute, it is skipped whenever admission.gate finds no unnotified PR/issue and returns run:false. In deployments with pre-rollout repo-inbox bindings, a quiet repo or an already-delivered inbox thread can keep threadKind undefined indefinitely."

- **VERIFY 三道门**: 通过。Spec Gate ✅ (INV-G8 措辞掩盖了 trigger-time vs deliver-time 不同步)、Mechanism Gate ✅ (quiet repo + pre-rollout binding → guard 绕过)、Feature Gate ✅ (gate tick 加 self-heal 独立 + 不破坏现有路径)。
- **Failure-mode audit (R2+ 强制)**: R1 P1#2 + R2 P2 同型——"marker stamping timing assumption" — self-heal 时机假设了 deliver/signal 时序。坐标系修正 = INV-G9 (gate tick 周期性 owner-side repair)。不是补第三个 deliver path，是把 stamping 提到周期性 owner 边界。
- **修复**: `RepoScanTaskSpec.admission.gate` 在 per-repo loop 起始处加 selfHealInboxThreadKind 调用（每个 tick 每个 repo 都 self-heal 一次）。Best-effort + fail-open。Plan INV-G9 同步。
- **测试**: `repo-scan-admission-gate-self-heal.test.js` 4 项（quiet repo stamp / idempotent / fail-open / 跨 connector 不泄漏）。全绿。
- **80/80 F167 + critical regression tests pass**。pnpm check 27/27 pass。

[宪宪/Opus 4.7🐾]
