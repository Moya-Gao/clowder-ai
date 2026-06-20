# F245 Phase C — eval:friction Domain + 周期 Rollup + Verdict Implementation Plan

**Feature:** F245 — `docs/features/F245-friction-signal-eval.md`
**Goal:** 注册 `eval:friction` eval domain，到周期点把 Phase B 的 `FrictionRollupInput` 聚成已分类报告（Top-N 配额 + 五类传感器形态 + 7-class 根因），复用 F192 Verdict Handoff Packet 产出 verdict。
**Acceptance Criteria（抄自 feat doc）:**
- **AC-C1**: `eval-friction.yaml` 注册，frequency 可配置（weekly/N-day/daily），默认社区 weekly / 本家 3 天
- **AC-C2**: 周期 rollup 报告——Top-N 配额（Top-10 深挖 + 长尾折叠），按五类传感器形态 + 7-class 根因分类（命令产出可复核）
- **AC-C3**: verdict 产出复用 F192 Verdict Handoff Packet schema（缺字段不得 handoff）
**Architecture cell:** `harness-eval`
**Map delta:** update required
**Map delta why:** 新增 `eval:friction` domain + friction report producer + verdict 接线，harness-eval cell 的 canonical files 需登记这些新组件。
**Architecture:** 镜像现有 `eval:a2a` domain pattern（cat-driven：`eval-domain-daily` 周期触发 → friction eval cat 在 system thread 收到结构化 rollup input → 产 verdict via `publish-verdict`）。Phase B 的 `buildFrictionRollupInput` 作为 friction 专属 source 喂给 eval cat；friction-specific report producer 做 Top-N 配额 + 分类。**不依赖 `publish-policy.ts` 的 `rollup_deferred`（砚砚 Design Gate：那是未来意图不是现成机制）——走 per-period 单 verdict（eval:a2a 同款 publish-verdict 路径）。**
**Tech Stack:** TypeScript, zod, `node --test`, 既有 harness-eval `domain/` + `publish-verdict/` 基建
**前端验证:** No（Phase C 是 infra；Eval Hub friction 视图是 Phase D）

---

## PR 拆分（de-risk：consumer-driven，不先建投机 infra）

- **PR1（friction pipeline on weekly）**：domain 注册 + report producer + 分类 + verdict 接线，全部落在**既有 weekly cadence**（零 shared-scheduler 改动）。端到端跑通 friction eval。满足 AC-C2 + AC-C3 + AC-C1 的 weekly 部分。
- **PR2（N-day cadence infra）**：扩展 registry `frequency` + scheduler due-ness gate → 本家 friction 翻 3 天。隔离的 shared-infra 改动，review 须验 5 个既有 domain 兼容。补齐 AC-C1 的 N-day/3-天部分。
- **理由**：N-day 是「3 天默认」的前置，但**不是 friction eval 跑通的前置**——weekly 用既有 `daily|weekly` enum 就能跑。先 PR1 证明 pipeline，PR2 才建 cadence infra（消费者就绪才建，不投机；也把跨 5-domain 的高 blast-radius 改动隔离成独立可 revert 的 PR）。

---

## Straight-Line Check（A→B 直线）

1. **Finish line**：周期触发 → friction eval cat 在 `thread_eval_friction` 收到结构化 rollup input → 产 Top-N 分类报告 → publish friction `VerdictHandoffPacket`（per-period 单 verdict）。
2. **Terminal schema**（steps 围绕它建，非脚手架）：

```ts
// packages/shared/src/types/friction-signal.ts （Phase C 追加）
export type FrictionSensorForm =        // 五类传感器形态 — 精确枚举 pin from F192 §八 @ Task P1-4
  | 'tool_call_friction' | 'cancel_signal' | 'user_feedback' | 'eval_domain_metric' | 'paw_feel_marker';
export type FrictionRootCause =         // 7-class 根因 — pin from Design Gate/feat doc @ Task P1-4
  | 'harness_misfit' | 'tool_gap' | 'environment_drift' | 'capability_gap'
  | 'process_friction' | 'doc_gap' | 'unclassified';

export interface ClassifiedFrictionCluster extends FrictionCluster {
  sensorForm: FrictionSensorForm;
  rootCause: FrictionRootCause;
  depth: 'deep' | 'tail';              // Top-10 深挖 vs 长尾折叠
}
export interface FrictionRollupReport {
  window: { sinceMs: number; untilMs: number };
  generatedAt: string;                 // ISO8601 with offset
  topClusters: ClassifiedFrictionCluster[];      // 深挖（≤10，排序 severity×count×channelDiversity）
  tailSummary: { clusterCount: number; signalCount: number; byChannel: Record<FrictionChannel, number> };
  degraded: boolean;                   // 透传 rollupInput.degraded
  droppedChannels: FrictionChannel[];  // 透传
  tokenBudget: { cap: number; estimated: number };  // 硬上限 ~4000
}
```

   → 映射 `VerdictHandoffPacket`（12 字段，见 `verdict-handoff.ts:7-52`）：`phenomenon`=Top friction 摘要；`evidencePacket.sampleTraceRefs`=cluster members 的 rawRef；`rootCauseHypothesis`=分类聚合（confidence+alternatives）；`verdict`=默认 `keep_observe`（无 actionable）/ `fix|build` （有）；`dailyTrend`=本期 vs 上期 cluster count。
3. **三问**：每个 task 输出留在终态（report producer/分类/verdict 接线都是终态组件，非脚手架）✓；每 task 有可测产出（红绿）✓；删任一 task 的代价可述 ✓。
4. **NOT building**：Phase D 出口闭环（propose_thread 修复 thread）；Eval Hub 可视化；`publish-policy` 的 verdict-batching `rollup_deferred`（独立关注点，friction 走 per-period 单 verdict）。

---

## Stateful Object Gate — Census（F229 🔴）

普查 Phase C 全部生命周期对象：

- **PR1 — 无新 lifecycle 对象**：
  - friction report producer = **纯函数**（`FrictionRollupInput → FrictionRollupReport`，零存储，同 Phase B pull 管道）→ 派生值规则：报告是纯投影，不落独立存储。
  - verdict 产出 = 一次性 artifact（`docs/harness-feedback/verdicts/{id}.md`，非 lifecycle 对象，由既有 publish-verdict 处理）。
  - 触发复用**既有** `eval-domain-daily` scheduler（不新增状态）。
- **PR2 — cadence due-ness 状态**：每 domain「上次何时跑」→ 判定 due/not-due → fire → 更新 last-run。**有生命周期，必做三件套**（下）。

### PR2 Cadence State — 三件套

**① 状态 × 事件转移表**（lifecycle owner = scheduler；last-run 真相源 = SQLite run ledger，见 `TaskRunnerV2.ts:114 lastRunAt`）：

| 状态 | 事件 `schedulerTick(now)` | 动作 | 新状态 |
|------|--------------------------|------|--------|
| `neverRun` | tick | due → fire | `ran(now)` |
| `ran(lastRunAt)` | tick, `now - lastRunAt >= intervalDays*86400e3` | due → fire | `ran(now)` |
| `ran(lastRunAt)` | tick, `now - lastRunAt < intervalDays*86400e3` | not-due → skip | `ran(lastRunAt)` |

- **唯一 lifecycle owner**：scheduler（`eval-domain-daily` 的 due-ness gate）。last-run 写入只此一处。
- **旁路 API 禁止**：N-day domain 不走 cron-slot fire（`computeNextCronSlot`），只走 interval due-ness gate——two paths 禁混用（否则双触发）。

**② 不变量清单**：
- **INV-1**：同一 due window 只 fire 一次（rapid ticks / clock skew 下不双触发）。测：interval 内两次 tick → 1 fire。
- **INV-2**：last-run 更新发生在 fire **成功后**（crash-before-update → 下次 tick 重触发=at-least-once；crash-after → 不重触发）。测：模拟 crash window（fire 后不更新 ledger）→ 下 tick 重触发。
- **INV-3**：既有 `daily|weekly` 行为**零变化**（backward-compat）。测：5 个既有 domain 的 due-ness 与扩展前逐一相等。
- **INV-4**：并发 tick 不双触发（ledger 单飞/锁）。测：并发两 tick → 1 fire。
- **INV-5**：at-least-once 重触发下 verdict publish 必须**幂等或可容重**（crash window 副作用）。测：同窗口连发两次 → 不产生重复污染 verdict（或 publish 幂等键）。⚠️ 这条是 crash-window 的真实副作用，PR2 必须显式处理（见 Adversarial）。

**③ 对抗场景**（每个一条测试）：
- **crash window**：fire 成功、update last-run 前进程挂 → 重启后下 tick 重触发 → INV-2 + INV-5（verdict 幂等）。
- **并发双 tick**：同 domain 两 tick 同时到 → INV-4。
- **restore**：进程重启，last-run 从 SQLite ledger 恢复不丢 → INV-2。
- **clock skew**：系统时钟回拨 → 不提前/重复 fire → INV-1。

---

## PR1 Tasks（friction pipeline on weekly）

> test import `dist/` → 改 src 后必 `pnpm --filter @cat-cafe/api build` 再 `node --test packages/api/test/harness-eval/<file>.test.js`；shared 改后 `pnpm --filter @cat-cafe/shared build`。biome：短签名单行。

### Task P1-1: 注册 `eval:friction` 到 domainId 枚举（additive contract）
**Files:** Modify `packages/api/src/infrastructure/harness-eval/domain/eval-domain-registry.ts:12`（domainId enum）+ `packages/api/src/infrastructure/harness-eval/verdict-handoff.ts:10`（verdict domainId enum）。Test: `packages/api/test/harness-eval/eval-domain-registry.test.js`（既有则追加）。
- **红**：断言 registry/verdict schema `parse({domainId:'eval:friction', ...})` 通过；当前 enum 不含 → fail。
- **绿**：两处 enum 各加 `'eval:friction'`（**只加不改既有值** = backward-compat）。
- **验**：既有 5 domainId 仍 parse 通过（回归）。Commit。

### Task P1-2: `eval-friction.yaml` domain 定义
**Files:** Create `docs/harness-feedback/eval-domains/eval-friction.yaml`（template = `eval-a2a.yaml:1-26`）。Test: registry loader 测试加载该 yaml 通过 schema。
- 字段：`domainId: eval:friction`；`frequency: weekly`（PR2 翻本家 3 天）；`evalCat`（默认见 OQ，配置可调）；`systemThreadId: thread_eval_friction`（见 OQ：需 provision）；`sourceAdapter: f245-friction-rollup`；`handoffTargetResolver`（friction 可行动项 → owner，Phase D 用）。
- 红→绿（loader 解析）→ Commit。

### Task P1-3: Friction report producer（纯函数，AC-C2 主体）
**Files:** Create `packages/api/src/infrastructure/harness-eval/friction/friction-rollup-report.ts`。Test: `packages/api/test/harness-eval/friction-rollup-report.test.js`。
- `buildFrictionRollupReport(input: FrictionRollupInput): FrictionRollupReport`
- **红**：给 12 cluster 的 fixture → 断言 Top-10 进 `topClusters`（排序 = severity×count×channelDiversity 降序），其余折进 `tailSummary`（clusterCount/signalCount/byChannel 正确）；`degraded`/`droppedChannels` 透传；`tokenBudget.estimated <= cap` 或超限时 tail 进一步折叠。
- **绿**：实现排序 + Top-N 切分 + tail 聚合 + token 估算（粗略 char/4）。
- 边界测：<10 cluster（全 deep 无 tail）/ 空 input / 全 dropped。Commit。

### Task P1-4: Cluster 分类（sensorForm + rootCause，AC-C2）
**Files:** Modify `friction-rollup-report.ts`（分类注入 `ClassifiedFrictionCluster`）+ shared types。Test: 同 report 测试加分类断言。
- **先 pin 枚举**：读 `docs/discussions/2026-06-01-f192-eval-coverage-audit.md` §八（五类传感器形态）+ feat doc/Design Gate（7-class 根因）核实精确枚举值，校正 terminal schema 的占位枚举。
- **红**：fixture cluster（paw-feel channel → `paw_feel_marker`/cancel → `cancel_signal` 等）→ 断言 `sensorForm` 由 channel 确定性映射；`rootCause` 规则映射（symptom 关键词 → harness_misfit/tool_gap/...；不确定 → `unclassified`，不硬猜）。
- **绿**：channel→sensorForm 确定性表 + rootCause 规则（KD-8：给数据不硬分类，低置信 → unclassified 留给 eval cat 判断）。Commit。

### Task P1-5: 接入 `eval-domain-daily` 触发 + eval-cat-invocation 指令
**Files:** Modify `packages/api/src/infrastructure/harness-eval/domain/eval-domain-daily.ts`（weekly 批次纳入 eval:friction）+ `eval-cat-invocation.ts`（friction-specific domain 指令 + sourceRefs：rollup window + report 路径）。Test: invocation builder 测试。
- 镜像 eval:a2a（`eval-cat-invocation.ts:32-33,94-100`）。红（friction domain 指令缺失）→ 绿（加 friction case）→ Commit。

### Task P1-6: Friction verdict source-refs + publish 接线（AC-C3）
**Files:** Modify `packages/api/src/infrastructure/harness-eval/publish-verdict/publish-verdict.ts`（friction sourceRefs union + generator）+ verdict generator 注册（`eval-hub.ts:319` verdictGenerators map）。Test: publish-verdict 测试（friction packet → 验证 12 字段完整 + `assertCanCrossThreadHandoff` 通过）。
- 红（eval:friction generator 缺失）→ 绿（friction generator：report → bundle snapshot.json + verdict.md）→ Commit。

### Task P1-7: 端到端集成 + Map delta
**Files:** Create `packages/api/test/harness-eval/friction-eval-domain.integration.test.js`；Modify `docs/architecture/ownership/cells/harness-eval.md`（登记 friction-rollup-report.ts + eval-friction.yaml + friction generator）→ `node docs/architecture/ownership/generate-readme.mjs`。
- 集成测：rollupInput fixture → report → verdict packet（验 AC-C2 Top-N+分类 + AC-C3 schema 完整）。Commit。

---

## PR2 Tasks（N-day cadence infra → 本家 friction 3 天）

> ⚠️ 改 shared eval-scheduler 契约——review 须含 harness-eval cell 兼容性（见 Review Routing）。先做上面 Stateful Object Gate 三件套定义的测试。

### Task P2-1: 扩展 `frequency` schema（backward-compat）
**Files:** Modify `eval-domain-registry.ts:20`。Test: registry schema 测试。
- 红：`parse({frequency:{type:'everyNDays',intervalDays:3}})` 通过 + 既有 `'daily'`/`'weekly'` 仍通过（INV-3）。
- 绿：`frequency` 改 union：`z.union([z.enum(['daily','weekly']), z.object({type:z.literal('everyNDays'), intervalDays:z.number().int().min(2)})])`。Commit。

### Task P2-2: Due-ness gate（crash-window 安全，INV-1/2/4/5）
**Files:** Create `packages/api/src/infrastructure/harness-eval/domain/cadence-gate.ts`。Test: `cadence-gate.test.js`（覆盖 INV-1..5 + 4 对抗场景）。
- `isDomainDue(domain, lastRunAt, now): boolean` — daily|weekly 委托既有 cron 逻辑（INV-3）；everyNDays 走 `now - lastRunAt >= intervalDays*86400e3`。
- 红（三件套全部测试先写，fail）→ 绿（最小实现 + last-run 更新在 fire 成功后）→ 逐对抗场景补绿。Commit（每 INV 一 commit）。

### Task P2-3: Wire N-day 进 scheduler
**Files:** Modify `eval-domain-daily.ts:296-310`（`loadRegisteredDomains` frequency filter → due-ness gate）+ everyNDays domain 用 daily catch-all cron + gate。Test: scheduler 测试 5 既有 domain due-ness 不变（INV-3 回归）。
- 红→绿→Commit。

### Task P2-4: 本家 friction 翻 3 天 + 兼容回归
**Files:** Modify `eval-friction.yaml`（本家 override `frequency:{type:everyNDays,intervalDays:3}`；社区保持 weekly）。Test: 全 harness-eval 套件 + `pnpm --filter @cat-cafe/api test:redis`（last-run ledger Redis/SQLite backed）。
- 验 5 既有 domain 调度无变化。Commit。

---

## Open Questions（技术 OQ，自决；可逆回滚成本低，不升 CVO）
- **evalCat for eval:friction**：默认拟 `codex`（砚砚，懂 harness-eval）或 harness-eval owner 轮值；配置在 yaml 可调 → 自决默认值，review 可调。
- **systemThreadId `thread_eval_friction`**：需 provision system thread（查 eval:a2a 的 thread 怎么建的 @ P1-2）。
- **5 sensor forms + 7-class root cause 精确枚举**：pin from F192 §八 + Design Gate @ Task P1-4（terminal schema 占位枚举届时校正）。
- **crash-window verdict 幂等（INV-5）**：friction verdict publish 是否需幂等键（同窗口去重）@ Task P2-2 决定。

## Review Routing
- **PR1**：跨族 review（缅因猫 gpt52 / 砚砚），friction pipeline 逻辑。
- **PR2**：**须含 harness-eval cell 兼容性 review**（5 既有 domain 调度不受影响）——优先 gpt52 或砚砚（懂 eval-scheduler infra）；这是 shared-contract 改动，blast radius 大。

## 下一步（SOP）
plan commit 到 main（`git commit -- <path>` 防共享 index 竞态）→ `worktree`（PR1 隔离环境，Redis 6398）→ `tdd`（逐 Task 红绿 commit）。PR1 跑完 merge → PR2。
