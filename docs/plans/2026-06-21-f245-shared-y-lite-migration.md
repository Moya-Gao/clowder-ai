# F245 Shared Y-lite Migration Implementation Plan

**Feature:** F245 — `docs/features/F245-friction-signal-eval.md`
**Goal:** 把 F245 / F236 共用的 eval-domain 注册 contract 从中心 enum-bump 迁到 Y-lite：新增 domain 只加 YAML + 显式 wiring，不再改中心 `domainId` / `sourceAdapter` enum。
**Acceptance Criteria:**
- `eval-domain-registry` 不再用中心 `z.enum(...)` 锁死 `domainId` / `sourceAdapter`；改为受约束的 registered string 校验，新增 domain 不需要再改中心 enum。
- registry entry 显式声明 `sourceRefsKind`，`publish-verdict` 对 sourceRefs 的 kind 约束从 registry 读取，而不是继续维护 `EXPECTED_REFS_KIND_BY_DOMAIN` 硬编码表。
- `verdict-handoff` 的 `domainId` 不再要求中心 enum-bump，未来 domain 只要满足命名约束即可通过 packet schema。
- `eval-cat-invocation` / `publish-verdict` / runtime wiring 仍然 fail-closed：没有显式 instruction / generator / sourceRefs validator 的 domain 不能悄悄工作。
- 既有 domains（含 `eval:friction`）行为不回归；F245 继续通过现有测试，F236 Track-2 以后可以沿同一 Y-lite contract 扩展。
**Architecture cell:** `harness-eval`
**Map delta:** none
**Map delta why:** 本次迁移只重写既有 `harness-eval` contract surface，不新增 ownership cell，也不引入新的 canonical artifact 路径。
**Architecture:** 终态是“registry-driven contract + explicit wiring”。registry 负责声明 `domainId` / `sourceAdapter` / `sourceRefsKind` 这些开放字符串和基本命名约束；代码仍显式持有 domain-specific instructions / generator adapters / sourceRefs validators。这样既去掉中心 enum-bump 的高 blast-radius，又保留 fail-closed，不把 eval-domain 变成插件系统。
**Tech Stack:** TypeScript, zod, yaml registry, `node --test`
**前端验证:** No

---

## Straight-Line Check

- **Finish line:** F245/F236 后续再加 eval domain 时，只需要加 YAML + 该 domain 自己的显式 wiring，不再改中心 enum 合同。
- **Not building:** 不做“自动插件化 domain loader”；不把 domain-specific instructions / generators 改成动态反射；不在这次顺手做 PR2 N-day cadence 或 Phase D。
- **Terminal schema:**
  - `EvalDomainRegistryEntry.domainId: string` with `^eval:[a-z0-9-]+$`
  - `EvalDomainRegistryEntry.sourceAdapter: string` with naming constraint
  - `EvalDomainRegistryEntry.sourceRefsKind: 'a2a-snapshot-attribution' | 'capability-wakeup-trial-window' | 'memory-recall-snapshot' | 'sop-trace-eval' | 'task-outcome-snapshot' | 'friction-rollup-snapshot'`
  - `VerdictHandoffPacket.domainId: string` with the same `^eval:[a-z0-9-]+$` constraint
  - runtime wiring remains separate: `DOMAIN_INSTRUCTIONS[domainId]`, `verdictGenerators[domainId]`, `wiredPublishDomains.has(domainId)`

## Stateful Object Gate

本次不新增生命周期对象。变更面是静态 registry contract + fail-closed routing，不引入新的持久状态机。

## Task 1: Lock the Y-lite contract with failing tests

**Files:**
- Modify: `packages/api/test/harness-eval/eval-domain-registry.test.js`
- Modify: `packages/api/test/harness-eval/verdict-handoff.test.js`
- Modify: `packages/api/test/harness-eval/eval-cat-invocation.test.js`
- Modify: `packages/api/test/harness-eval/publish-verdict-friction-validation.test.js`

**Step 1: Write the failing tests**

- registry test:
  - syntactically valid new domain like `eval:anchor-first` + new `sourceAdapter` string + `sourceRefsKind` parses without editing a central enum list
  - invalid `domainId` / invalid `sourceAdapter` / missing `sourceRefsKind` still fail
- verdict handoff test:
  - `domainId: 'eval:anchor-first'` passes packet schema
  - malformed domain id fails
- eval-cat invocation test:
  - a registry entry with unknown `domainId` but no matching instruction mapping fails closed with a clear error
- publish-verdict validation test:
  - sourceRefs kind mismatch is computed from registry `sourceRefsKind`, not a hardcoded domain table

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @cat-cafe/api test -- eval-domain-registry.test.js verdict-handoff.test.js eval-cat-invocation.test.js publish-verdict-friction-validation.test.js
```

Expected: fail because current code still hardcodes central enums / hardcoded sourceRefs kind mapping.

## Task 2: Migrate the central contract from enums to registered strings

**Files:**
- Modify: `packages/api/src/infrastructure/harness-eval/domain/eval-domain-registry.ts`
- Modify: `packages/api/src/infrastructure/harness-eval/verdict-handoff.ts`
- Modify: `packages/api/src/infrastructure/harness-eval/publish-verdict/types.ts`
- Modify: `packages/api/src/infrastructure/harness-eval/publish-verdict/validation.ts`

**Step 1: Implement minimal contract changes**

- replace `domainId` / `sourceAdapter` central enums with string validators:
  - `domainId` regex `^eval:[a-z0-9-]+$`
  - `sourceAdapter` regex for lowercase slug-like ids
- add required `sourceRefsKind` to registry schema
- export a reusable `EvalSourceRefsKind` type from the publish-verdict types layer or registry helper so validation code and tests share one definition
- relax `VerdictHandoffPacket.domainId` to the same `domainId` validator

**Step 2: Re-run targeted tests**

Expected: registry + handoff tests turn green; invocation / publish-verdict tests may still fail because routing is still domain-table-based.

## Task 3: Move runtime routing to registry-driven checks, while staying fail-closed

**Files:**
- Modify: `packages/api/src/infrastructure/harness-eval/eval-cat-invocation.ts`
- Modify: `packages/api/src/infrastructure/harness-eval/publish-verdict/publish-verdict.ts`
- Modify: `packages/api/src/index.ts`
- Modify: `packages/api/src/routes/eval-hub.ts`
- Modify: `packages/api/src/infrastructure/harness-eval/manual-trigger/trigger-now.ts`

**Step 1: Replace hardcoded contract tables where they should be registry-driven**

- `publish-verdict.ts`
  - remove `EXPECTED_REFS_KIND_BY_DOMAIN`
  - read `domainEntry.sourceRefsKind` from loaded registry entry and use that for mismatch checks
- `eval-cat-invocation.ts`
  - keep domain-specific instruction strings explicit, but switch from `Record<union, string>` assumptions to fail-closed lookup by string
  - if a registry domain has no instruction mapping, throw / reject clearly instead of widening silently
- `index.ts` / `eval-hub.ts` / manual-trigger
  - relax `EvalDomainId`-based `Record<>` / `Set<>` typing to string-keyed runtime wiring so future domains don’t need central union edits
  - keep generator registration explicit: no generator entry = unwired = no publish instructions / 501 at publish time

**Step 2: Re-run the same targeted tests**

Expected: all new Y-lite tests pass; existing friction / memory / task-outcome routing still behaves identically.

## Task 4: Regression verification and truth-source sync

**Files:**
- Modify if needed: `packages/api/test/harness-eval/eval-cat-invocation-publish-verdict.test.js`
- Modify if needed: `packages/api/test/harness-eval/eval-domain-daily.test.js`
- Modify if needed: `docs/features/F245-friction-signal-eval.md`

**Step 1: Run regression suites around publish/invocation flow**

Run:

```bash
pnpm --filter @cat-cafe/api test -- eval-domain-registry.test.js verdict-handoff.test.js eval-cat-invocation.test.js eval-cat-invocation-publish-verdict.test.js publish-verdict-friction-validation.test.js eval-domain-daily.test.js
```

**Step 2: If code reality changed any wording in the feature doc, sync it**

- only touch F245 if implementation reality diverges from the freshly-pushed owner/migration wording

**Step 3: Commit**

```bash
git add docs/plans/2026-06-21-f245-shared-y-lite-migration.md
git commit -m "plan: add F245 shared Y-lite migration plan"
```

## Open Questions

- **技术 OQ:** `sourceAdapter` naming constraint should stay simple slug regex or accept `:` names too. Default plan: slug regex first, widen only if an existing adapter breaks.
- **技术 OQ:** whether to colocate `EvalSourceRefsKind` in registry or publish-verdict types. Default plan: place it where both registry and handler can import without cycles.

## Verification Notes

- No code before failing tests.
- No pluginization detour.
- No direct edits on `main` for implementation code; plan lands on `main`, implementation goes to feature worktree.
