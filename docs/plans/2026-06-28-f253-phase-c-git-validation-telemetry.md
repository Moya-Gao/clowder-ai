# F253 QC Loop — Phase C Implementation Plan

**Feature:** F253 — `docs/features/F253-qc-loop.md`
**Goal:** Git-triggered validation tiers + QC telemetry — push 前拦一道、CI 挂了自动修、收集质量数据看门禁有没有用
**Acceptance Criteria:**
- AC-C1: `pre-push` soft hook 存在，提醒未跑 gate（验证：`git push` 前 hook 触发提醒）
- AC-C2: CI repair loop 实现 same-class detection + max 2 rounds escalate（验证：模拟连续同类 CI failure，第 3 次 escalate 到猫）
- AC-C3: `eval:qc` domain 注册在 F192 eval domain registry，weekly cron 聚合 4 指标趋势，verdict 通过 `cat_cafe_publish_verdict` 发布到 Eval Hub（验证：Eval Hub 可见 QC domain verdict + 4 个指标有数据）
**Architecture cell:** `harness-eval` (F192)
**Map delta:** none
**Map delta why:** Phase C 扩展现有 harness-eval cell（加一个 eval domain + 一个 generator adapter），不改 ownership 边界
**Architecture:** 三件事：(1) 扩展 `.githooks/pre-push` 加 Layer 4 gate-reminder（soft warning）；(2) CI repair loop 作为 merge-gate skill 的行为协议 + 错误分类脚本；(3) 注册 `eval:qc` eval domain（YAML + generator adapter + index.ts wiring）走 F192 标准管线
**Tech Stack:** Bash (hook), Node.js/TypeScript (generator adapter), YAML (domain registry)
**前端验证:** No — 纯后端/工具链

---

## What we're NOT building

- ❌ 新的存储层（走 F192 Eval Hub 管线）
- ❌ pre-push 硬门禁（soft warning only，可 `--no-verify` 跳过）
- ❌ 自动修复逻辑 bug / test failure（只修 lint/format/auto-import 级别）
- ❌ 实时 QC dashboard（趋势在 Eval Hub 并列展示，不建新 UI）

## Stateful Object Gate

**Census**：Phase C 引入一个新消费侧状态对象——

### CI Repair Round Counter（AC-C2）

这不是持久存储的状态机——是 merge-gate skill 执行 CI repair 时的**行为协议**，"状态"活在单次 merge-gate session 的执行上下文中（PR label 标记轮次）。

| 状态 | 事件 | 下一状态 | 动作 |
|------|------|----------|------|
| idle | ci_fail(deterministic) | attempt_1 | auto-fix + push |
| idle | ci_fail(non_deterministic) | escalated | escalate to cat |
| attempt_1 | ci_fail(same_class) | attempt_2 | auto-fix + push |
| attempt_1 | ci_fail(different_class) | attempt_1' | reset counter, auto-fix + push |
| attempt_1 | ci_pass | idle | done |
| attempt_2 | ci_fail(any) | escalated | escalate to cat, label PR `ci-repair-exhausted` |
| attempt_2 | ci_pass | idle | done |
| escalated | — | terminal | cat takes over |

**Lifecycle owner**: merge-gate skill session (per-PR)
**Storage**: PR label `ci-repair-round:N` (ephemeral, per-PR)
**Invariants**:
- INV-1: max 2 auto-fix attempts per error class → test with 3 consecutive same-class failures
- INV-2: non-deterministic errors NEVER auto-fix → test with test failure CI output
- INV-3: different error class resets counter → test with lint→type error sequence

---

## PR 拆分

一个 PR（Phase C scope 适中，三个 AC 都是独立文件组）。

---

## Task 1: Pre-push Gate Reminder (AC-C1)

**Files:**
- Modify: `.githooks/pre-push:161` (add Layer 4 after existing Layer 3)
- Create: `scripts/pre-push-gate-reminder.test.mjs`

### Step 1: Write test for gate reminder

```javascript
// scripts/pre-push-gate-reminder.test.mjs
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('pre-push Layer 4: gate reminder', () => {
  test('warns when .gate-last-run is missing', () => {
    // Setup: temp git repo with our pre-push hook, no .gate-last-run
    // Push to non-main branch → should print warning but exit 0
  });

  test('warns when .gate-last-run is stale (>1 hour)', () => {
    // Setup: .gate-last-run with old timestamp
    // Push → should print warning but exit 0
  });

  test('no warning when .gate-last-run is fresh (<1 hour)', () => {
    // Setup: .gate-last-run with recent timestamp
    // Push → no warning, exit 0
  });

  test('gate --auto-fix writes .gate-last-run timestamp', () => {
    // Verify pnpm gate writes the sentinel file
  });
});
```

### Step 2: Run test to verify it fails

```bash
node --test scripts/pre-push-gate-reminder.test.mjs
```
Expected: FAIL — functions not implemented

### Step 3: Implement Layer 4 in pre-push hook

Extend `.githooks/pre-push` after Layer 3 (line ~231, before `exit 0`):

```bash
    # ═══════════════════════════════════════════════════════════════
    # Layer 4: Gate Reminder (soft — never blocks push)
    # Checks if pnpm gate was run recently. Warn-only.
    # ═══════════════════════════════════════════════════════════════
    (
      GATE_SENTINEL="$REPO_ROOT/.gate-last-run"
      if [ ! -f "$GATE_SENTINEL" ]; then
        echo "" >&2
        echo "  💡 REMINDER: pnpm gate has not been run in this session." >&2
        echo "     Run 'pnpm gate' before pushing to catch issues early." >&2
        echo "     (This is a reminder, not a blocker.)" >&2
        echo "" >&2
      else
        GATE_TIME=$(cat "$GATE_SENTINEL" 2>/dev/null || echo "0")
        NOW=$(date +%s)
        AGE=$(( NOW - GATE_TIME ))
        if [ "$AGE" -gt 3600 ]; then
          echo "" >&2
          echo "  💡 REMINDER: pnpm gate was last run $(( AGE / 60 )) minutes ago." >&2
          echo "     Consider re-running 'pnpm gate' if you made changes since." >&2
          echo "     (This is a reminder, not a blocker.)" >&2
          echo "" >&2
        fi
      fi
    ) || true
    # ^ Subshell + || true = fail-open. Reminder errors → silent skip.
```

Also extend `scripts/pre-merge-check.sh` (the gate script from Phase A) to write the sentinel:

```bash
# At the end of successful gate run:
date +%s > "$REPO_ROOT/.gate-last-run"
```

Add `.gate-last-run` to `.gitignore`.

### Step 4: Run test to verify it passes

```bash
node --test scripts/pre-push-gate-reminder.test.mjs
```
Expected: PASS

### Step 5: Commit

```bash
git add .githooks/pre-push scripts/pre-push-gate-reminder.test.mjs scripts/pre-merge-check.sh .gitignore
git commit -m "feat(F253): AC-C1 pre-push gate reminder (Layer 4, soft warning)"
```

---

## Task 2: CI Repair Loop — Error Classifier (AC-C2)

**Files:**
- Create: `scripts/classify-ci-error.mjs`
- Create: `scripts/classify-ci-error.test.mjs`

### Step 1: Write test for error classifier

```javascript
// scripts/classify-ci-error.test.mjs
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

describe('classifyCiError', () => {
  test('classifies biome format error as deterministic:format', async () => {
    const { classifyCiError } = await import('./classify-ci-error.mjs');
    const output = 'packages/api/src/foo.ts format ━━━\n × Formatter would have printed';
    const result = classifyCiError(output);
    assert.equal(result.errorClass, 'format');
    assert.equal(result.deterministic, true);
    assert.deepEqual(result.autoFixCommand, ['pnpm', 'exec', 'biome', 'check', '--write', '.']);
  });

  test('classifies TypeScript error as deterministic:typecheck', async () => {
    const { classifyCiError } = await import('./classify-ci-error.mjs');
    const output = "error TS2307: Cannot find module './foo'";
    const result = classifyCiError(output);
    assert.equal(result.errorClass, 'typecheck');
    assert.equal(result.deterministic, false); // type errors need human judgment
  });

  test('classifies test failure as non-deterministic', async () => {
    const { classifyCiError } = await import('./classify-ci-error.mjs');
    const output = '1 failing\n  AssertionError: expected 3 to equal 4';
    const result = classifyCiError(output);
    assert.equal(result.errorClass, 'test_failure');
    assert.equal(result.deterministic, false);
  });

  test('classifies lint error as deterministic:lint', async () => {
    const { classifyCiError } = await import('./classify-ci-error.mjs');
    const output = 'packages/api/src/foo.ts lint ━━━\n × lint/suspicious/noDoubleEquals';
    const result = classifyCiError(output);
    assert.equal(result.errorClass, 'lint');
    // lint errors may or may not be auto-fixable
  });

  test('unknown error is non-deterministic', async () => {
    const { classifyCiError } = await import('./classify-ci-error.mjs');
    const result = classifyCiError('some random error output');
    assert.equal(result.errorClass, 'unknown');
    assert.equal(result.deterministic, false);
  });
});
```

### Step 2: Run test → FAIL

### Step 3: Implement classifier

```javascript
// scripts/classify-ci-error.mjs
/**
 * F253 Phase C — CI error classifier for repair loop.
 *
 * Classifies CI output into error classes and determines if auto-fix is safe.
 * Used by merge-gate skill CI repair behavior protocol.
 */

/** @typedef {{ errorClass: string, deterministic: boolean, autoFixCommand?: string[], summary: string }} CiErrorClassification */

/**
 * @param {string} ciOutput
 * @returns {CiErrorClassification}
 */
export function classifyCiError(ciOutput) {
  // Pattern matching against known CI error signatures
  if (/format ━+/.test(ciOutput) && /Formatter would have printed/.test(ciOutput)) {
    return {
      errorClass: 'format',
      deterministic: true,
      autoFixCommand: ['pnpm', 'exec', 'biome', 'check', '--write', '.'],
      summary: 'Biome format error (auto-fixable)',
    };
  }

  if (/lint ━+/.test(ciOutput) || /lint\//.test(ciOutput)) {
    const hasUnsafe = /lint\/suspicious|lint\/correctness/.test(ciOutput);
    return {
      errorClass: 'lint',
      deterministic: !hasUnsafe,
      autoFixCommand: hasUnsafe ? undefined : ['pnpm', 'exec', 'biome', 'lint', '--write', '.'],
      summary: hasUnsafe ? 'Lint error (needs human review)' : 'Lint error (auto-fixable)',
    };
  }

  if (/error TS\d+/.test(ciOutput)) {
    return {
      errorClass: 'typecheck',
      deterministic: false,
      summary: 'TypeScript type error (needs human judgment)',
    };
  }

  if (/failing|FAIL|AssertionError|assert\.|ERR_ASSERTION/.test(ciOutput)) {
    return {
      errorClass: 'test_failure',
      deterministic: false,
      summary: 'Test failure (needs human fix)',
    };
  }

  return {
    errorClass: 'unknown',
    deterministic: false,
    summary: 'Unknown CI error',
  };
}
```

### Step 4: Run test → PASS

### Step 5: Commit

```bash
git add scripts/classify-ci-error.mjs scripts/classify-ci-error.test.mjs
git commit -m "feat(F253): AC-C2 CI error classifier for repair loop"
```

---

## Task 3: CI Repair Loop — Protocol Documentation (AC-C2 cont.)

**Files:**
- Modify: `cat-cafe-skills/merge-gate/SKILL.md` (add CI repair section)
- Create: `scripts/ci-repair-loop.test.mjs` (integration test for round counting)

### Step 1: Write integration test for repair loop protocol

```javascript
// scripts/ci-repair-loop.test.mjs
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

describe('CI repair loop protocol', () => {
  test('deterministic error → auto-fix on first occurrence', async () => {
    const { shouldAutoFix } = await import('./classify-ci-error.mjs');
    const classification = { errorClass: 'format', deterministic: true };
    assert.equal(shouldAutoFix(classification, 0), true);
  });

  test('same-class error on round 2 → still auto-fix', async () => {
    const { shouldAutoFix } = await import('./classify-ci-error.mjs');
    const classification = { errorClass: 'format', deterministic: true };
    assert.equal(shouldAutoFix(classification, 1), true);
  });

  test('same-class error on round 3 → escalate (max 2 rounds)', async () => {
    const { shouldAutoFix } = await import('./classify-ci-error.mjs');
    const classification = { errorClass: 'format', deterministic: true };
    assert.equal(shouldAutoFix(classification, 2), false);
  });

  test('non-deterministic error → never auto-fix', async () => {
    const { shouldAutoFix } = await import('./classify-ci-error.mjs');
    const classification = { errorClass: 'test_failure', deterministic: false };
    assert.equal(shouldAutoFix(classification, 0), false);
  });
});
```

### Step 2: Run test → FAIL

### Step 3: Implement `shouldAutoFix` + add merge-gate skill docs

Add to `scripts/classify-ci-error.mjs`:

```javascript
const MAX_REPAIR_ROUNDS = 2;

/**
 * @param {CiErrorClassification} classification
 * @param {number} sameClassRound - how many times this error class has been auto-fixed (0 = first time)
 * @returns {boolean}
 */
export function shouldAutoFix(classification, sameClassRound) {
  if (!classification.deterministic) return false;
  if (sameClassRound >= MAX_REPAIR_ROUNDS) return false;
  return true;
}
```

Add CI Repair Protocol section to merge-gate SKILL.md:

```markdown
## CI Repair Loop (F253 Phase C)

When CI fails after push:

1. Read CI output → `classifyCiError(output)` → get error class + deterministic flag
2. If non-deterministic → **escalate immediately** (post to thread, @ author)
3. If deterministic + round < 2 → run `autoFixCommand`, commit, push
4. If deterministic + round ≥ 2 → **escalate** (same error class won't auto-fix after 2 tries)
5. Track round count via PR label `ci-repair-round:N`

**Allowlisted auto-fixes**: biome format, biome lint (non-suspicious)
**Never auto-fix**: test failures, type errors, lint/suspicious, unknown errors
```

### Step 4: Run test → PASS

### Step 5: Commit

```bash
git add scripts/classify-ci-error.mjs scripts/ci-repair-loop.test.mjs cat-cafe-skills/merge-gate/SKILL.md
git commit -m "feat(F253): AC-C2 CI repair loop protocol + shouldAutoFix"
```

---

## Task 4: eval:qc Domain Registration (AC-C3)

**Files:**
- Create: `docs/harness-feedback/eval-domains/eval-qc.yaml`

### Step 1: Create domain YAML

Follow existing pattern (e.g. `eval-sop.yaml`):

```yaml
---
domainId: eval:qc
displayName: QC Pipeline Eval
systemThreadId: thread_eval_qc
evalCat:
  catId: opus
  handle: "@opus"
  model: claude-opus-4-6
frequency: weekly
sourceAdapter: qc-metrics-eval
sourceRefsKind: qc-metrics-rollup
threadPolicy:
  role: working-home
  stateSot: registry
  allowedContent:
    - longitudinal-analysis
    - verdict-discussion
    - handoff-drafts
legacyScheduledTaskIds: []
handoffTargetResolver:
  featureId: F253
  ownerCatId: opus
  threadLookup: feature-thread
sla:
  acknowledgeHours: 48
  reevalWithinHours: 336
```

### Step 2: Commit

```bash
git add docs/harness-feedback/eval-domains/eval-qc.yaml
git commit -m "feat(F253): AC-C3 register eval:qc domain in F192 registry"
```

---

## Task 5: eval:qc Generator Adapter + Wiring (AC-C3 cont.)

**Files:**
- Create: `packages/api/src/infrastructure/harness-eval/publish-verdict/qc-generator-adapter.ts`
- Create: `packages/api/src/infrastructure/harness-eval/qc-metrics-provider.ts`
- Modify: `packages/api/src/infrastructure/harness-eval/eval-cat-invocation.ts:31` (add DOMAIN_INSTRUCTIONS entry)
- Modify: `packages/api/src/index.ts:1850` (wire verdictGenerators)
- Create: `packages/api/test/qc-generator-adapter.test.js`

### Step 1: Write test for QC metrics provider

```javascript
// packages/api/test/qc-generator-adapter.test.js
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

describe('QC metrics provider', () => {
  test('aggregates finding yield from source refs', async () => {
    // Test that given per-PR finding counts, it computes average yield
  });

  test('computes reviewer delta from fresh-context vs formal findings', async () => {
    // Test delta metric calculation
  });

  test('returns 4 metric values', async () => {
    // Verify all 4 metrics are present in output
  });
});
```

### Step 2: Run test → FAIL

### Step 3: Implement provider + adapter

QC metrics provider reads per-PR data from memory (review findings stored in thread messages) and computes 4 metrics:

```typescript
// packages/api/src/infrastructure/harness-eval/qc-metrics-provider.ts
/**
 * F253 Phase C — QC Metrics Provider.
 *
 * Aggregates per-PR quality data into 4 eval:qc metrics:
 * 1. Finding Yield: average actionable findings per review
 * 2. False Positive Rate: findings rejected by author / total findings
 * 3. Reviewer Delta: formal reviewer new findings vs fresh-context coverage
 * 4. Post-Merge Bug Rate: hotfixes within 14-day window per merged PR
 *
 * Data source: PR metadata in memory (review thread messages, merge records).
 * Does NOT self-build storage — reads existing data from memory search.
 */
export interface QcMetricsSnapshot {
  findingYield: number;
  falsePositiveRate: number;
  reviewerDelta: number;
  postMergeBugRate: number;
  prCount: number;
  windowDays: number;
}
```

Generator adapter follows `sop-generator-adapter.ts` pattern:

```typescript
// packages/api/src/infrastructure/harness-eval/publish-verdict/qc-generator-adapter.ts
import type { VerdictGenerator } from './types.js';

export function createQcGeneratorAdapter(/* provider */): VerdictGenerator {
  return async (packet, sourceRefs, deps) => {
    // 1. Validate sourceRefs kind is 'qc-metrics-rollup'
    // 2. Read QC metrics from provider
    // 3. Generate verdict markdown with trends
    // 4. Return verdictPath + bundleDir
  };
}
```

### Step 4: Wire into index.ts

Add `eval:qc` to verdictGenerators map in `packages/api/src/index.ts` and add domain instructions to `eval-cat-invocation.ts`.

### Step 5: Run test → PASS

### Step 6: Commit

```bash
git add packages/api/src/infrastructure/harness-eval/publish-verdict/qc-generator-adapter.ts \
  packages/api/src/infrastructure/harness-eval/qc-metrics-provider.ts \
  packages/api/src/infrastructure/harness-eval/eval-cat-invocation.ts \
  packages/api/src/index.ts \
  packages/api/test/qc-generator-adapter.test.js
git commit -m "feat(F253): AC-C3 eval:qc generator adapter + index.ts wiring"
```

---

## Task 6: Final Integration + Spec Update

**Files:**
- Modify: `docs/features/F253-qc-loop.md` (update Phase C status + AC checkboxes)

### Step 1: Run full gate

```bash
pnpm gate
```

### Step 2: Update spec

Mark Phase C ACs as checked, update Timeline.

### Step 3: Final commit

```bash
git add docs/features/F253-qc-loop.md
git commit -m "docs(F253): Phase C progress — AC-C1/C2/C3 implementation"
```

---

## Open Questions

- **OQ-1 (技术, 自决)**: `.gate-last-run` sentinel vs. checking `pnpm gate` exit code in pre-push — sentinel 更简单且不重跑 gate。倾向 sentinel。
- **OQ-2 (技术, 自决)**: QC metrics provider 的数据源 — 从 memory search 读 review finding counts vs. 从 PR tracking task 元数据读。实现时探索哪个更可靠。
