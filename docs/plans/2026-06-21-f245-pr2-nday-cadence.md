# F245 PR2: N-day Cadence + Last-run Gate Implementation Plan

**Feature:** F245 — `docs/features/F245-friction-signal-eval.md`
**Goal:** 给 eval-domain 注册层加 N-day 周期支持（`every-Nd` 格式），加 Redis last-run gate 防止同窗口内重复触发，把 `eval-friction` 从 `weekly` 改成 `every-3d`（本家 3 天默认）。
**Acceptance Criteria:**
- `eval-domain-registry.ts` 的 `frequency` 字段接受 `every-Nd` 格式（如 `every-3d`）
- 新 `createEvalDomainNDaySpec` factory：以每日 cron 为底，gate 层用 Redis last-run key 判断是否到期
- N-day gate 到期判断：`now - lastDispatchMs >= N * 86400000`（无 lastDispatch 记录 → 视为到期）
- execute 成功 deliver 后更新 Redis `eval-nday-last-dispatch:{domainId}` = 当前 epoch ms string
- `eval-friction.yaml` `frequency: weekly` → `frequency: every-3d`
- 既有 daily/weekly tests 不回归；eval:friction 不再出现在 weekly gate
**Architecture cell:** `harness-eval`
**Map delta:** none（仅扩展既有 scheduler + registry 合同，不新增 ownership cell）
**Tech Stack:** TypeScript, Redis (ioredis), `node --test`
**前端验证:** No

---

## Straight-Line Check

- **Finish line:** `eval:friction` 以每 3 天周期自动触发 eval cat，不在 weekly cron 里空跑
- **Not building:** N-day per-domain 独立 cron（过度工程）；Phase D；任何 UI 改动
- **Terminal schema:**
  - `EvalDomainRegistryEntry.frequency` 接受 `'daily' | 'weekly' | 'every-${N}d'` (runtime string)
  - Redis key: `eval-nday-last-dispatch:{domainId}` → epoch ms string（keyPrefix 自动加）
  - `createEvalDomainNDaySpec` 导出，与 Daily/Weekly 同级在 `eval-domain-daily.ts`

## Architecture: N-day last-run gate

N-day 域挂在**每日 cron**上（`0 3 * * *`），gate 层按 domain 检查 Redis last-dispatch key：

```
gate():
  for each n-day domain:
    nDays = parseInt(match /^every-(\d+)d$/[1])
    lastMs = parseInt(await redis.get(`eval-nday-last-dispatch:${domain.domainId}`))
    if !lastMs || Date.now() - lastMs >= nDays * 86400000:
      include in workItems
    else:
      skip (not due yet)

execute(domain):
  ... buildEvalCatInvocation + deliver (existing logic) ...
  await redis.set(`eval-nday-last-dispatch:${domain.domainId}`, Date.now().toString())
```

**Fail-open:** `redis` 未注入 → 所有 N-day 域视为到期（退化为每日触发，安全方向）

## Stateful Object Gate

无新生命周期对象。Redis key 是无结构 string → epoch ms，无 TTL（domain 不运行不过期）。

## Task 1: Write failing tests (Red)

**File:** `packages/api/test/harness-eval/eval-domain-nday.test.js` (新建)

测试点（全部先写，全部 FAIL 因为 `createEvalDomainNDaySpec` 不存在）：

1. `createEvalDomainNDaySpec` 返回有效 TaskSpec（id/trigger/profile/state/outcome/display）
2. Gate：Redis 无 last-run 记录 → `every-3d` 域视为到期，进 workItems
3. Gate：last-run 2 天前 → `every-3d` 域跳过（`cadence not due`）
4. Gate：last-run 4 天前 → `every-3d` 域到期，进 workItems
5. Gate：last-run 8 天前 → `every-7d` 域到期，进 workItems
6. Gate：last-run 6 天前 → `every-7d` 域跳过（cadence not due）
7. Gate：redis 未注入 → fail-open，域视为到期
8. Execute：deliver 成功 → redis `eval-nday-last-dispatch:{domainId}` 被写入

**Step 1:** 写红测（import `createEvalDomainNDaySpec` from dist — 还不存在）

**Step 2:** 验证 fail（ImportError / undefined）

```bash
cd ../cat-cafe-f245-pr2 && pnpm --filter @cat-cafe/api test -- eval-domain-nday.test.js
```

Expected: fail with `Cannot find module` or similar

## Task 2: Schema extension + impl

**Files:**
- Modify: `packages/api/src/infrastructure/harness-eval/domain/eval-domain-registry.ts`
- Modify: `packages/api/src/infrastructure/harness-eval/domain/eval-domain-daily.ts`

**Step 1: Extend frequency schema**

```typescript
// eval-domain-registry.ts
frequency: z.enum(['daily', 'weekly']).or(
  z.string().regex(/^every-\d+d$/, 'N-day frequency must match every-{N}d (e.g. every-3d)')
),
```

**Step 2: Add to eval-domain-daily.ts**

```typescript
// Helper
export function parseNDayFrequency(frequency: string): number | null {
  const m = /^every-(\d+)d$/.exec(frequency);
  return m ? parseInt(m[1], 10) : null;
}

// Loader
function loadNDayDomains(harnessFeedbackRoot: string): EvalDomainRegistryEntry[]

// Factory
export function createEvalDomainNDaySpec(opts: EvalDomainScheduleOpts): TaskSpec_P1<EvalDomainRegistryEntry>
```

N-day spec:
- cron: `0 3 * * *` (daily cron, gate decides)
- id: `eval-domain-nday`
- Gate: load N-day domains, for each check Redis `eval-nday-last-dispatch:{domainId}`
- Execute: after deliver, set Redis key to `Date.now().toString()`

**Step 3:** Run targeted tests green

```bash
cd ../cat-cafe-f245-pr2 && pnpm --filter @cat-cafe/api build && pnpm --filter @cat-cafe/api test -- eval-domain-nday.test.js
```

## Task 3: Update eval-friction.yaml + verify no weekly regression

**File:** `docs/harness-feedback/eval-domains/eval-friction.yaml`

Change:
```yaml
# before
frequency: weekly
```
to:
```yaml
frequency: every-3d
```

Update comment block (remove "本家 3-day override comes in PR2" placeholder).

**Verify weekly regression test still passes** (eval:friction should NOT appear in weekly gate after change):

```bash
cd ../cat-cafe-f245-pr2 && pnpm --filter @cat-cafe/api test -- eval-domain-daily.test.js eval-domain-nday.test.js
```

Expected: all pass; weekly gate no longer includes eval:friction (tests don't assert its presence in weekly — inclusion of `every-3d` domains in N-day gate verified by new tests).

## Task 4: Bootstrap registration + full regression

**File:** `packages/api/src/index.ts`

Add `createEvalDomainNDaySpec` to the existing import + register:

```typescript
const { createEvalDomainDailySpec, createEvalDomainWeeklySpec, createEvalDomainNDaySpec } = await import(
  './infrastructure/harness-eval/domain/eval-domain-daily.js'
);
...
taskRunnerV2.register(createEvalDomainDailySpec(evalScheduleOpts));
taskRunnerV2.register(createEvalDomainWeeklySpec(evalScheduleOpts));
taskRunnerV2.register(createEvalDomainNDaySpec(evalScheduleOpts));
```

**Full regression:**

```bash
cd ../cat-cafe-f245-pr2 && pnpm --filter @cat-cafe/api build && pnpm --filter @cat-cafe/api test
```

Expected: all existing tests pass; new N-day tests green.

**Biome:**

```bash
cd ../cat-cafe-f245-pr2 && pnpm biome check packages/api/src/infrastructure/harness-eval/domain/ packages/api/test/harness-eval/eval-domain-nday.test.js
```

## Task 5: Plan commit + F245 feat doc sync

After green + biome clean:

```bash
# Plan to main (from cat-cafe/)
git add docs/plans/2026-06-21-f245-pr2-nday-cadence.md
git commit -m "plan: add F245 PR2 N-day cadence plan"

# F245 feat doc update (mark AC-C1 complete after PR2 lands)
# (to be done after merge, not before)
```

## Open Questions

- **None**: Redis fail-open design confirmed (砚砚 Design Gate didn't specify fail-closed for missing Redis — daily trigger is safer direction than silent skip)
- **`every-0d` / `every-1d` guard**: fail at schema parse time (same as `daily`) — out of scope; document as undefined behavior

## Verification Notes

- No `npx biome` — use `pnpm biome` (feedback_verify_with_repo_toolchain)
- Redis key uses domain's own ioredis client (prefix `cat-cafe:` applied automatically)
- N-day spec shares the same `evalScheduleOpts` as daily/weekly — Redis is already wired there
