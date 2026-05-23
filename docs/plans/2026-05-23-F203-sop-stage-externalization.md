---
feature_ids: [F203, F192]
topics: [sop, sop-definition, predicate, harness-eval, workflow-sop]
doc_kind: plan
created: 2026-05-23
related_issues: [748]
---

# F203 SOP Stage Externalization Implementation Plan

**Feature:** F203 — `docs/features/F203-native-system-prompt-l0.md`
**Goal:** Implement clowder-ai #748 by making SOP stage definitions a single machine-readable source, while preserving hard rules and pitfalls as predicate-backed ground truth for future `eval:sop`.
**Acceptance Criteria:** #748 ships `SopDefinition` as the single source for development SOP stages; all existing `sop_navigation` hard rules and pitfalls are ported with predicates; `WorkflowSop` gains a `sopDefinitionId` seam with `development` default; `nextSkill` becomes an explicit override over definition-derived `suggestedSkill`; static SOP docs/skills stop duplicating the stage table; cross-domain stub SOP definitions validate without participating in runtime codegen; `writing-plans` is corrected to the confirmed `writing-plans -> worktree -> tdd` sequence. F192 Phase E-sop runtime registration is explicitly out of scope for this PR.
**Architecture cell:** harness-eval
**Map delta:** update required
**Map delta why:** `SopDefinition` becomes the canonical ground truth for future `eval:sop` predicates, so the harness-eval ownership cell needs new anchors for SOP definitions, schema validation, and generated stage types.
**Architecture:** Add a domain-generic `SopDefinition` schema plus a first real `development` definition. Runtime codegen reads only real definitions, while `stubs/*.yaml` prove the schema is not coding-specific. Existing `WorkflowSop` records keep their persisted state, but stage labels and suggested skill hints come from `SopDefinition` unless a record explicitly overrides `nextSkill`.
**Tech Stack:** YAML definitions, TypeScript schema/codegen, node:test, Redis-backed `WorkflowSop` store, Fastify routes, React Mission Hub panel, existing skill/docs validation scripts.
**前端验证:** Yes — `WorkflowSopPanel` display changes to show definition-derived suggested skill vs explicit override; author and reviewer should inspect rendered markup or run the component test coverage.

---

## Finish Line

One F203 follow-up PR lands #748 in Cat Cafe:

- `cat-cafe-skills/manifest.yaml:sop_navigation` is removed as a dead second source.
- `sop-definitions/development.yaml` is the single source for the six development stages and their 18 existing navigation rules.
- Each hard rule / pitfall has a stable `id`, `text`, `severity`, owner semantics, and a predicate.
- `manual_only` is a first-class predicate result path, not a fake pass/fail.
- Existing `WorkflowSop` records keep working; missing `sopDefinitionId` reads as `development`.
- `nextSkill: null` means "use the definition's suggestedSkill"; non-null `nextSkill` is an explicit override.
- `docs/SOP.md`, `quality-gate`, `request-review`, `merge-gate`, `BOOTSTRAP.md`, and `writing-plans` are aligned to the new source.
- Cross-domain stub fixtures validate, but do not affect the current `SopStage` runtime union.

## Not Building

- No F192 `eval:sop` runtime registration in this PR.
- No predicate evaluator over live traces in this PR.
- No Verdict Handoff Packet, scheduled eval-cat invocation, or re-eval closure in this PR.
- No implementation of video co-creation / tech article / family office SOPs beyond schema stub fixtures.
- No hook injection decisions. Hooking is downstream of future eval data, not this design.

## Clarification Decisions

1. **`id` vs `domain`**: keep both, but make them non-redundant.
   - `id`: concrete registry key, e.g. `development`, `video-cocreation`.
   - `domain`: broad future categorization, e.g. `engineering`, `creative`, `writing`, `finance`.
   - `domain` is a non-empty string in this PR, not a closed enum.
2. **`severity`**: add explicit `severity: blocker | warn | info`; schema default is `warn` for future authoring, but all 18 ported rules must set it explicitly.
3. **`owner`**: default owner derives from `stage.suggestedSkill`; per-rule `owner` override is optional for cross-skill edge cases.
4. **Boundary rules**:
   - "合入后擅自更新 runtime" uses `command_sequence` where feasible: cwd/path references runtime plus pull/restart command patterns. If the trace cannot prove intent, evaluator later returns unknown, not pass.
   - "压缩后忘了当前在做什么" is `manual_only` with `future_candidate: trace_pattern_post_compact_recall`.

## Terminal Schema

```ts
export type SopDefinitionId = string;
export type SopDomain = string;
export type SopRuleSeverity = 'blocker' | 'warn' | 'info';

export interface SopDefinition {
  readonly id: SopDefinitionId;
  readonly title: string;
  readonly domain: SopDomain;
  readonly schemaVersion: 1;
  readonly stages: readonly SopDefinitionStage[];
}

export interface SopDefinitionStage {
  readonly id: string;
  readonly label: string;
  readonly suggestedSkill: string;
  readonly description?: string;
  readonly hardRules: readonly SopRule[];
  readonly pitfalls: readonly SopRule[];
}

export interface SopRule {
  readonly id: string;
  readonly text: string;
  readonly severity: SopRuleSeverity;
  readonly owner?: SopRuleOwner;
  readonly predicate: SopPredicate;
}

export type SopRuleOwner =
  | { readonly type: 'stage_suggested_skill' }
  | { readonly type: 'skill'; readonly id: string }
  | { readonly type: 'feature_owner'; readonly featureId: string };

export type SopPredicate =
  | CommandPatternPredicate
  | CommandSequencePredicate
  | ShaDedupPredicate
  | EnvCheckPredicate
  | GitStatePredicate
  | HandleCheckPredicate
  | ManualOnlyPredicate;

export interface CommandPatternPredicate {
  readonly type: 'command_pattern';
  readonly mustMatch?: readonly string[];
  readonly mustNotMatch?: readonly string[];
  readonly scope?: 'current_stage' | 'whole_work_item';
}

export interface CommandSequencePredicate {
  readonly type: 'command_sequence';
  readonly antiPattern?: readonly CommandSequenceStep[];
  readonly requiredSequence?: readonly CommandSequenceStep[];
  readonly absent?: readonly string[];
  readonly scope?: 'current_stage' | 'whole_work_item';
}

export interface CommandSequenceStep {
  readonly cwdContains?: string;
  readonly commandRegex: string;
}

export interface ShaDedupPredicate {
  readonly type: 'sha_dedup';
  readonly scope: 'cloud_review' | 'pr_checks' | string;
  readonly key: 'head_sha' | string;
}

export interface EnvCheckPredicate {
  readonly type: 'env_check';
  readonly mustSet?: Record<string, string>;
  readonly mustNotSet?: readonly string[];
  readonly portPolicy?: { readonly allowed?: readonly number[]; readonly forbidden?: readonly number[] };
}

export interface GitStatePredicate {
  readonly type: 'git_state_predicate';
  readonly condition:
    | 'main_synced'
    | 'clean_worktree'
    | 'feature_doc_has_ac'
    | 'feature_doc_has_requirements_checklist'
    | 'check_features_passed';
}

export interface HandleCheckPredicate {
  readonly type: 'handle_check';
  readonly condition:
    | 'reviewer_not_author'
    | 'review_request_has_original_requirement'
    | 'vision_guardian_not_author_or_reviewer'
    | 'baton_transferred';
}

export interface ManualOnlyPredicate {
  readonly type: 'manual_only';
  readonly reason: string;
  readonly future_candidate?: string;
}
```

Generated runtime exports:

```ts
export const SOP_DEFINITION_IDS = ['development'] as const;
export type SopDefinitionId = (typeof SOP_DEFINITION_IDS)[number];

export const DEVELOPMENT_SOP_STAGE_IDS = [
  'kickoff',
  'impl',
  'quality_gate',
  'review',
  'merge',
  'completion',
] as const;
export type SopStage = (typeof DEVELOPMENT_SOP_STAGE_IDS)[number];

export const DEVELOPMENT_SOP_DEFINITION = /* generated from development.yaml */;
```

Stub definitions under `sop-definitions/stubs/*.yaml` are schema-validated but excluded from `SOP_DEFINITION_IDS` and `SopStage`.

## Current `sop_navigation` Port Map

Source: `cat-cafe-skills/manifest.yaml:1113-1156`.

| Stage | Kind | Source text | Predicate | Severity |
|---|---|---|---|---|
| kickoff | hard | Feature spec 必须有 AC + 需求点 checklist | `git_state_predicate`: `feature_doc_has_ac` + `feature_doc_has_requirements_checklist` | blocker |
| kickoff | pitfall | 没有铲屎官确认就直接开始实现 | `manual_only` | warn |
| impl | hard | worktree 开之前必须 main 双向同步 (ahead=0 behind=0) | `git_state_predicate`: `main_synced` | blocker |
| impl | hard | Redis 只用 6398，禁碰 6399 | `env_check`: forbidden port 6399, allowed dev port 6398 | blocker |
| impl | pitfall | 跳过 Design Gate 直接写代码 | `manual_only` | warn |
| impl | pitfall | 压缩后忘了当前在做什么 | `manual_only`, `future_candidate: trace_pattern_post_compact_recall` | warn |
| quality_gate | hard | 自检报告必须包含愿景覆盖度 | `manual_only` | warn |
| quality_gate | pitfall | 声称完成但没跑全量测试 | `command_pattern`: require gate/test evidence in stage trace | blocker |
| review | hard | 同一个体不能 review 自己的代码 | `handle_check`: `reviewer_not_author` | blocker |
| review | hard | Review 请求必须附原始需求摘录 | `handle_check`: `review_request_has_original_requirement` | warn |
| review | pitfall | 收到 P1 修完后没 re-trigger review | `sha_dedup`: `cloud_review` by `head_sha` plus future evaluator trace check | blocker |
| merge | hard | 必须用 gh pr merge --squash（禁止本地 squash） | `command_pattern`: must `gh pr merge.*--squash`, must-not local squash patterns | blocker |
| merge | hard | 云端 review 同一 SHA 不重复触发 | `sha_dedup`: `cloud_review`, key `head_sha` | warn |
| merge | pitfall | 本地 squash + push + gh pr close（PR 显示 closed 不是 merged） | `command_sequence`: anti-pattern `git push` + `gh pr close`, absent `gh pr merge` | blocker |
| merge | pitfall | 合入后擅自更新 runtime | `command_sequence`: runtime cwd/path + `git pull` or restart commands | blocker |
| completion | hard | feat close 前必须跨猫愿景守护 | `handle_check`: `vision_guardian_not_author_or_reviewer` | blocker |
| completion | hard | PR merged + check:features 通过 | `git_state_predicate`: `check_features_passed` plus PR merged evidence | blocker |
| completion | pitfall | 没有 @ 其他猫做愿景守护就直接 close | `handle_check`: `vision_guardian_not_author_or_reviewer` | blocker |

## Task 0: Ownership Map Anchor Update

**Files:**
- Modify: `docs/architecture/ownership/cells/harness-eval.md`
- Run: `node docs/architecture/ownership/generate-readme.mjs`

**Step 1: Red — ownership map lacks SopDefinition anchors**

Run:

```bash
rg -n 'SopDefinition|sop-definitions' docs/architecture/ownership/cells/harness-eval.md
```

Expected: no match.

**Step 2: Green — add anchors**

Add planned anchors:

- `sop-definitions/*.yaml`
- `sop-definitions/schema.ts`
- `scripts/gen-sop-definitions.mjs`
- generated shared type file

**Step 3: Regenerate README**

Run:

```bash
node docs/architecture/ownership/generate-readme.mjs
git diff -- docs/architecture/ownership/README.md
```

Expected: ownership README reflects new anchors.

**Step 4: Commit**

```bash
git add docs/architecture/ownership/cells/harness-eval.md docs/architecture/ownership/README.md
git commit -m "docs(F203): map SOP definitions to harness eval"
```

## Task 1: SopDefinition Schema and Fixtures

**Files:**
- Create: `sop-definitions/schema.ts`
- Create: `sop-definitions/development.yaml`
- Create: `sop-definitions/stubs/video-cocreation.yaml`
- Create: `sop-definitions/stubs/tech-article.yaml`
- Create: `sop-definitions/stubs/family-office.yaml`
- Test: `test/sop-definition-schema.test.js` or `scripts/sop-definition-schema.test.mjs`

**Step 1: Red — schema loader missing**

Add test:

```js
const { loadSopDefinitionFiles } = await import('../dist-or-script-path');
const result = await loadSopDefinitionFiles({ includeStubs: true });
assert.equal(result.real.map((d) => d.id).includes('development'), true);
```

Expected: import fails.

**Step 2: Green — schema parser**

Implement parser with:

- unique definition `id`
- non-empty `domain`
- unique stage ids per definition
- unique rule ids per definition
- `severity` default `warn`
- `owner` default `{ type: 'stage_suggested_skill' }`
- `manual_only.reason` required
- predicate type-specific required fields

**Step 3: Fixture validation**

Tests:

- `development.yaml` passes and has 6 stages.
- stubs pass with non-development ids/domains.
- duplicate stage/rule ids fail closed.
- `manual_only` without reason fails.
- `severity` omitted resolves to `warn` in normalized output.

**Step 4: Commit**

```bash
git add sop-definitions test scripts
git commit -m "feat(F203): add SOP definition schema"
```

## Task 2: Port All 18 Navigation Rules

**Files:**
- Modify: `sop-definitions/development.yaml`
- Test: `test/sop-definition-schema.test.js`

**Step 1: Red — coverage guard for manifest source count**

Add a test fixture or inline expected count:

```js
assert.equal(countRules(development), 18);
assert.equal(countHardRules(development), 10);
assert.equal(countPitfalls(development), 8);
```

Expected: fails until all rules are present.

**Step 2: Green — port 18 rules**

Port exactly the table in "Current `sop_navigation` Port Map".

Important choices:

- `id` must be stable and grep-friendly.
- all ported rules set `severity` explicitly.
- `quality_gate` full-test evidence can be a broad `command_pattern` in v0; evaluator runtime can refine later.
- "合入后擅自更新 runtime" uses `command_sequence`, not `manual_only`, because the physical action is command-observable.

**Step 3: Negative tests**

Add tests that removing one hard rule / pitfall fixture causes coverage failure.

**Step 4: Commit**

```bash
git add sop-definitions/development.yaml test
git commit -m "feat(F203): port development SOP navigation rules"
```

## Task 3: Runtime Codegen for Development Only

**Files:**
- Create: `scripts/gen-sop-definitions.mjs`
- Create: `packages/shared/src/types/sop-definition.generated.ts`
- Modify: `packages/shared/src/types/workflow-sop.ts`
- Modify: `packages/shared/src/types/index.ts`
- Test: `packages/shared/src/types/__tests__` if existing, otherwise `test/sop-definition-codegen.test.js`
- Modify: `package.json` scripts if needed

**Step 1: Red — generated file missing**

Add test:

```js
const generated = readFileSync('packages/shared/src/types/sop-definition.generated.ts', 'utf8');
assert.match(generated, /DEVELOPMENT_SOP_STAGE_IDS/);
assert.doesNotMatch(generated, /video-cocreation/);
```

Expected: fails.

**Step 2: Green — generator**

`scripts/gen-sop-definitions.mjs`:

- validates all real + stub YAML definitions
- generates only real definitions into runtime code
- writes stable sorted output
- fails if generated file is stale in `--check` mode

**Step 3: `SopStage` from generated development stages**

Change `packages/shared/src/types/workflow-sop.ts`:

```ts
import type { DevelopmentSopStageId, SopDefinitionId } from './sop-definition.generated';

export type SopStage = DevelopmentSopStageId;

export interface WorkflowSop {
  readonly sopDefinitionId: SopDefinitionId;
  // existing fields...
}

export interface UpdateWorkflowSopInput {
  readonly sopDefinitionId?: SopDefinitionId;
  // existing fields...
}
```

Compatibility: store reads old records without `sopDefinitionId` as `development`.

**Step 4: Add check script**

Add package script:

```json
"check:sop-definitions": "node scripts/gen-sop-definitions.mjs --check"
```

Wire into `pnpm check` if current check composition has a suitable place; otherwise include in `pnpm gate` via existing check runner path.

**Step 5: Commit**

```bash
git add scripts packages/shared package.json pnpm-lock.yaml
git commit -m "feat(F203): generate SOP stage types"
```

## Task 4: WorkflowSop Compatibility and Derived Suggested Skill

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/redis/RedisWorkflowSopStore.ts`
- Modify: `packages/api/src/routes/workflow-sop.ts`
- Modify: `packages/api/src/routes/callback-workflow-sop-routes.ts`
- Modify: `packages/api/src/routes/callbacks.ts`
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-parallel.ts`
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-serial.ts`
- Test: `packages/api/test/workflow-sop-store.test.js`
- Test: `packages/api/test/workflow-sop-routes.test.js`
- Test: `packages/api/test/workflow-sop-callback.test.js`
- Test: `packages/api/test/thread-context-workflow-sop.test.js`

**Step 1: Red — old record defaults to development**

Add store test:

```js
await redis.set(key, JSON.stringify(oldWorkflowSopWithoutDefinitionId));
const sop = await store.get(itemId);
assert.equal(sop.sopDefinitionId, 'development');
```

Expected: fails.

**Step 2: Green — defaulting**

Normalize on read:

- missing `sopDefinitionId` => `development`
- invalid `sopDefinitionId` => fail closed or default? Decision: fail closed for explicitly invalid, default only when missing legacy field.

**Step 3: Red — route hint derives suggested skill**

Add routing test:

- persisted `nextSkill: null`, `stage: impl` => `suggestedSkill: 'worktree'` or confirmed definition value.
- persisted `nextSkill: 'custom-skill'` => `suggestedSkill: 'custom-skill'` plus override metadata in context if exposed.

**Step 4: Green — derive from definition**

Introduce helper:

```ts
resolveWorkflowSopHint(sop): {
  stage: SopStage;
  suggestedSkill: string | null;
  suggestedSkillSource: 'definition' | 'override';
  featureId: string;
  sopDefinitionId: SopDefinitionId;
}
```

Use in serial/parallel routing and callback thread context.

**Step 5: Commit**

```bash
git add packages/api packages/shared
git commit -m "feat(F203): derive workflow SOP hints from definition"
```

## Task 5: Mission Hub UI Shows Definition vs Override

**Files:**
- Modify: `packages/web/src/components/mission-control/WorkflowSopPanel.tsx`
- Test: `packages/web/src/components/__tests__/workflow-sop-panel.test.ts`

**Step 1: Red — UI distinguishes suggested skill source**

Add tests:

- `nextSkill: null`, `definitionSuggestedSkill: 'worktree'` renders `定义建议：worktree`
- `nextSkill: 'tdd'` renders `手动 override：tdd`

If API response does not expose `definitionSuggestedSkill`, add shared/API field first in Task 4.

**Step 2: Green — render with existing visual primitives**

Keep the panel dense and consistent:

- stage pills from generated stage order
- skill line shows source
- no nested cards

**Step 3: Commit**

```bash
git add packages/web packages/shared
git commit -m "feat(F203): show SOP skill source in Mission Hub"
```

## Task 6: Remove `manifest.yaml:sop_navigation`

**Files:**
- Modify: `cat-cafe-skills/manifest.yaml`
- Test: `cat-cafe-skills` or manifest validation tests if present
- Search updates: any direct `sop_navigation` references

**Step 1: Red — manifest still has duplicated SOP nav**

Add a validation test:

```js
const manifest = readFileSync('cat-cafe-skills/manifest.yaml', 'utf8');
assert.equal(manifest.includes('sop_navigation:'), false);
```

Expected: fails.

**Step 2: Green — delete the block**

Delete `sop_navigation` entirely. Do not leave a pointer there; the single source is `sop-definitions/development.yaml`.

**Step 3: Ensure consumers do not regress**

Run:

```bash
rg -n 'sop_navigation' .
```

Expected remaining hits only in historical docs/plans or this plan, not runtime code.

**Step 4: Commit**

```bash
git add cat-cafe-skills/manifest.yaml test
git commit -m "feat(F203): remove manifest SOP navigation duplicate"
```

## Task 7: Static Docs and Skill Alignment

**Files:**
- Modify: `docs/SOP.md`
- Modify: `cat-cafe-skills/quality-gate/SKILL.md`
- Modify: `cat-cafe-skills/request-review/SKILL.md`
- Modify: `cat-cafe-skills/merge-gate/SKILL.md`
- Modify: `cat-cafe-skills/writing-plans/SKILL.md`
- Modify: `BOOTSTRAP.md` if present / relevant
- Test: new consistency checker or existing docs checker

**Step 1: Red — docs/skills duplicate stale stage data**

Add consistency checker:

```bash
node scripts/check-sop-definition-consistency.mjs
```

Checks:

- `docs/SOP.md` stage table has same stage ids/order/suggested skills as `development.yaml`.
- the three SOP skill headers mention their canonical stage id or source pointer.
- `writing-plans` does not say both "run in worktree" and "next load worktree".

Expected: fails before edits.

**Step 2: Green — docs point to `SopDefinition`**

Decisions:

- `docs/SOP.md` keeps philosophy and human narrative.
- Stage table is either generated into a marked block or validated against `development.yaml`.
- skill docs avoid re-listing all hard rules; they may link to `sop-definitions/development.yaml`.
- `writing-plans` says: plans are written on main, committed/pushed, then `worktree`, then `tdd`.

**Step 3: Commit**

```bash
git add docs cat-cafe-skills BOOTSTRAP.md scripts
git commit -m "docs(F203): align SOP docs with definitions"
```

## Task 8: Cross-Domain Stub Validation

**Files:**
- Modify: `sop-definitions/stubs/video-cocreation.yaml`
- Modify: `sop-definitions/stubs/tech-article.yaml`
- Modify: `sop-definitions/stubs/family-office.yaml`
- Test: `test/sop-definition-schema.test.js`

**Step 1: Red — stubs accidentally enter runtime codegen**

Add test:

```js
assert.doesNotMatch(generated, /video-cocreation/);
assert.equal(validated.stubDefinitions.length, 3);
```

Expected: fails until loader returns stub metadata separately.

**Step 2: Green — validate stubs separately**

Each stub should have:

- `id`
- non-`engineering` domain when appropriate
- at least two stages
- at least one `manual_only` rule
- at least one machine-checkable predicate if plausible

**Step 3: Commit**

```bash
git add sop-definitions/stubs test
git commit -m "test(F203): validate cross-domain SOP fixtures"
```

## Task 9: Feature Docs and Design Notes

**Files:**
- Modify: `docs/features/F203-native-system-prompt-l0.md`
- Modify: `docs/features/F192-socio-technical-harness-eval.md` if plan decisions need AC text tightening
- Modify: `docs/decisions/030-system-prompt-engineering.md` only if it contains live SOP source guidance

**Step 1: Update F203**

Add Timeline entry:

- #748 implementation PR
- 18 rule port
- `manual_only` / domain-generic schema / `sopDefinitionId` seam

Mark AC-G5 from deferred to completed only after PR implementation is done.

**Step 2: Update F192 if needed**

Clarify:

- `manual_only` returns `not_evaluable`
- predicate runtime is future Phase E-sop, not #748
- owner defaults from `stage.suggestedSkill` with per-rule override

**Step 3: Commit**

```bash
git add docs/features docs/decisions
git commit -m "docs(F203): sync SOP stage externalization"
```

## Task 10: Full Verification and Review

Run targeted verification first:

```bash
pnpm --filter @cat-cafe/shared build
pnpm --filter @cat-cafe/api build
node --test packages/api/test/workflow-sop-store.test.js
node --test packages/api/test/workflow-sop-routes.test.js
node --test packages/api/test/workflow-sop-callback.test.js
node --test packages/api/test/thread-context-workflow-sop.test.js
pnpm --filter @cat-cafe/web test -- workflow-sop-panel
node scripts/gen-sop-definitions.mjs --check
node scripts/check-sop-definition-consistency.mjs
pnpm check:features
```

Then full gate:

```bash
pnpm gate
```

Review path:

1. Request Opus-47 architecture/code review because he owns the F203 #748 thread and F192 eval control-plane scope.
2. Local review pass.
3. Merge-gate with cloud review, because shared/API/web/test/docs code changes are non-trivial.
4. After merge, outbound sync to clowder-ai and ask 天一 to review the upstream issue implementation.

## Open Questions

All current OQs are technical and will be resolved during implementation; none require CVO escalation before starting.

1. **Definition-derived suggested skill field shape**: expose `definitionSuggestedSkill` directly on `WorkflowSop`, or only in route hint/UI view model. Default: view model/helper to avoid changing persisted store more than needed.
2. **Docs table generation**: generate a marked block in `docs/SOP.md` vs validate manually-written table. Default: validate first; generate only if drift persists.
3. **Predicate evaluator helper extraction**: no runtime evaluator in #748. Do not extract shared evaluator helpers unless schema tests make duplication real.

## Handoff Checklist

- [ ] 18 source rules ported: 10 hard rules + 8 pitfalls.
- [ ] `manual_only` exists and cannot produce pass/fail.
- [ ] stubs validate but do not enter runtime codegen.
- [ ] old `WorkflowSop` records read as `sopDefinitionId: development`.
- [ ] `nextSkill: null` uses definition; explicit non-null value overrides.
- [ ] `manifest.yaml:sop_navigation` removed.
- [ ] `writing-plans` says main-plan first, then worktree, then tdd.
- [ ] F192 runtime `eval:sop` remains out of scope.
