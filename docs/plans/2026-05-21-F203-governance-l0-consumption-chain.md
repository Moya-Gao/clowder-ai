---
feature_ids: [F203]
topics: [governance-l0, system-prompt, rules-sop, implementation-plan]
doc_kind: plan
created: 2026-05-21
related_issues: [747, 749]
---

# F203 Governance L0 Consumption Chain Implementation Plan

**Feature:** F203 — `docs/features/F203-native-system-prompt-l0.md`
**Goal:** Make `shared-rules.md` the single source for governance L0, then show the actual prompt consumption chain in the Rules & SOP panel.
**Acceptance Criteria:** #747 shared-rules compiles into native/fallback L0 through one compiler; `.local/.local-override` applies at that compiler layer; #749 Rules & SOP distinguishes actual prompt content, reference docs, and skill-on-demand docs. #748 is explicitly out of scope for this pass.
**Architecture cell:** harness/system-prompt-injection
**Map delta:** none
**Map delta why:** Existing F203 ownership cell already covers system prompt injection and Rules/SOP visibility; this is source-of-truth tightening plus UI metadata, not a new subsystem.
**Architecture:** Add a deterministic governance-L0 compiler that reads `cat-cafe-skills/refs/shared-rules.md` with local overlay support and emits the compact governance block. Both `compile-system-prompt-l0.mjs` and `SystemPromptBuilder` fallback consume that same compiled block. `/api/rules` exposes consumption metadata so the settings panel shows what actually enters prompt vs what is reference or skill-loaded on demand.
**Tech Stack:** TypeScript API helpers, Node ESM compile script, node:test, Vitest `renderToStaticMarkup`, existing Console settings primitives.
**前端验证:** Yes — Rules & SOP panel copy/badges change; reviewer should inspect UI or rendered markup, and author should run targeted Vitest plus a local API sanity.

---

## Finish Line

One F203 follow-up PR covers #747 then #749:

- `shared-rules.md` is the only editable governance-rule source for L0.
- Native L0 (`system-prompt-l0.md` + `compile-system-prompt-l0.mjs`) and fallback L0 (`SystemPromptBuilder.getGovernanceDigest`) consume the same compiled governance block.
- `.local.md` and `.local-override.md` for `shared-rules.md` are resolved before governance L0 compilation, so native/fallback see the same local override behavior.
- Rules & SOP UI presents a consumption chain: `实际进 prompt`, `只是参考`, `skill 按需加载`.

## Not Building

- No #748 SOP vocabulary unification in this PR.
- No web editor for prompt/rules content.
- No Gemini native L0 migration.
- No F203 close / runtime AC-C5 claim.

## Terminal Schema

```ts
export type GovernanceL0Source = 'base' | 'local' | 'override';

export interface CompiledGovernanceL0 {
  content: string;
  sourcePath: string;
  source: GovernanceL0Source;
  overlayPath: string | null;
  generatedFrom: 'cat-cafe-skills/refs/shared-rules.md';
}

export type PromptConsumptionKind = 'actual-prompt' | 'reference' | 'skill-on-demand';

export interface PromptConsumptionInfo {
  kind: PromptConsumptionKind;
  label: string;
  detail: string;
  consumers: string[];
}

export interface RuleFileResponse {
  path: string;
  content: string;
  exists: boolean;
  consumption: PromptConsumptionInfo;
}
```

## Task 1: Governance L0 Compiler (#747)

**Files:**
- Create: `packages/api/src/domains/cats/services/context/governance-l0.ts`
- Test: `packages/api/test/governance-l0.test.js`

**Step 1: Red — compiler extracts required governance anchors from shared-rules**

Add tests that call the built `dist/.../governance-l0.js` pure compiler with fixture markdown containing Rule 0, P1-P5, W1-W8, Magic Words, routing, main-only, and per-family governance snippets.

Expected fail: module missing.

**Step 2: Green — deterministic projection**

Implement `compileGovernanceL0FromMarkdown(markdown: string): string`.

Rules:
- Extract by heading/table anchors, not by LLM summarization.
- Emit a compact block with stable headings that existing L0 tests can assert.
- Fail closed when required anchors are missing.

**Step 3: Local overlay loader**

Implement `loadCompiledGovernanceL0(root = findMonorepoRoot())`.

It reads `cat-cafe-skills/refs/shared-rules.md` through `resolveWithLocalOverlay`, then compiles. Return source metadata for `/api/rules`.

## Task 2: Native L0 Consumes `{{GOVERNANCE_L0}}` (#747)

**Files:**
- Modify: `assets/system-prompts/system-prompt-l0.md`
- Modify: `scripts/compile-system-prompt-l0.mjs`
- Test: `scripts/compile-system-prompt-l0.test.mjs`

**Step 1: Red — template no longer owns governance prose**

Add test that the template contains `{{GOVERNANCE_L0}}` and does not contain hand-maintained Rule 0 / P1-P5 body under §3.

**Step 2: Green — compile script injects shared compiler output**

Import `loadCompiledGovernanceL0` from API dist and replace `{{GOVERNANCE_L0}}`.

**Step 3: Guard local override**

Add a temp-root test where `shared-rules.local-override.md` changes a unique Magic Word marker. Verify compiled native L0 reflects the override.

## Task 3: Fallback Consumes Same Compiled Block (#747)

**Files:**
- Modify: `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts`
- Test: `packages/api/test/system-prompt-builder.test.js`

**Step 1: Red — fallback digest equals compiler output**

Add test that `initGovernanceOverlay()` / `getGovernanceDigest()` returns the compiled governance block from `shared-rules.md`, not the old hardcoded constant.

**Step 2: Green — remove hardcoded digest body**

Replace `GOVERNANCE_L0_DIGEST` with `loadCompiledGovernanceL0()` in `initGovernanceOverlay`.

**Step 3: Native/fallback equivalence check**

Add a test comparing the `## 3. 家规` block from compiled native L0 to `getGovernanceDigest()` for the same source.

## Task 4: Rules API Consumption Metadata (#749)

**Files:**
- Modify: `packages/api/src/routes/rules.ts`
- Test: `packages/api/test/rules-route.test.js`

**Step 1: Red — response includes consumption metadata**

Expected examples:
- `cat-cafe-skills/refs/shared-rules.md`: `actual-prompt`
- `assets/system-prompts/system-prompt-l0.md`: `actual-prompt`
- `docs/SOP.md`: `reference`
- `CLAUDE.md` / `AGENTS.md` / `GEMINI.md`: `reference`
- skill previews: `skill-on-demand`

**Step 2: Green — extend `readRuleFile` and `readL0Prompts`**

Attach `consumption` to every rule/guide/L0 template/compiled item. Do not change auth behavior.

## Task 5: Rules & SOP UI Shows Consumption Chain (#749)

**Files:**
- Modify: `packages/web/src/components/settings/RulesPromptsContent.tsx`
- Test: `packages/web/src/components/settings/__tests__/RulesPromptsContent.test.tsx`

**Step 1: Red — UI badge/copy coverage**

Vitest static render must show:
- `实际进 prompt`
- `只是参考`
- `skill 按需加载`
- `shared-rules.md → governance L0 → native/fallback`

**Step 2: Green — badges and section copy**

Use existing `SettingsBadge` and `RuleFileCard` pattern. Keep card radius/visual density consistent with current Console settings UI.

**Step 3: No misleading copy**

Remove text implying `shared-rules.md` is merely a manually summarized input. Copy should state it is compiled into governance L0.

## Task 6: Documentation Sync

**Files:**
- Modify: `docs/features/F203-native-system-prompt-l0.md`
- Modify: `docs/decisions/030-system-prompt-engineering.md`

Add:
- New F203 Phase G/GH entry for #747/#749 follow-up.
- KD: governance L0 compiler is the single bridge from `shared-rules.md` to native/fallback prompt.
- ADR table update: no hand-maintained `GOVERNANCE_L0_DIGEST`; fallback/native share compiler.

## Task 7: Verification & Review

Run targeted checks:

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/governance-l0.test.js packages/api/test/system-prompt-builder.test.js packages/api/test/rules-route.test.js
node --test scripts/compile-system-prompt-l0.test.mjs
pnpm --filter @cat-cafe/web test -- RulesPromptsContent
pnpm biome
```

Then run full gate before review:

```bash
pnpm gate
```

Review path:
- Request architecture/code review from 宪宪 (`opus-47`) because this touches F203 owner surface and prompt truth-source design.
- After local review approve, run merge-gate with cloud review because API/web/script code changed.
