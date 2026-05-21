# Review Request: F188 Phase J — Health Debt Governance

Review-Target-ID: f188-phase-j
Branch: feat/f188-phase-j

## What

Turn health dashboard debts (201 orphan edges, 724 unverified docs) into explainable, dry-runnable, repairable governance workflows:
- Orphan edge classifier → dry-run → apply pipeline (5 buckets, backup before apply)
- Verification debt migration (trusted_legacy / needs_review triage via kind×path whitelist)
- Cat verification workflow (confirm/mark_stale/escalate/dismiss_review + audit log)
- Canonical resolver for feature-ref edges (prevent new orphans at write time)
- F200 integration boundary (read-only via JOIN, never writes verified_at/authority/review_status)
- KD-13: three-dimensional verification semantics (authority / verified_at / usage_signal)
- Dogfood acceptance report on runtime DB (201→26 orphans, 591→279 trusted + 446 needs_review)

9 commits, 15 files changed, +1262/-9 lines.

## Why

Phase B Health Dashboard badge surfaced real debt numbers to MemoryNav. But numbers without governance = noise. Phase J makes the debt actionable: classify, dry-run, repair, prevent regression. Design Gate R4 passed with 砚砚 review.

## Original Requirements（必填）

> **砚砚独立判断（2026-05-20）**：
> 1. orphan edges 是 F188 该管的结构债：修复必须包含一次性 migration + 写入时 normalize，不能只在 dashboard 上解释数字。
> 2. unverified 不是 F200 能自动清零的问题：F200 consumption 可作为 review candidate / usage prior，但不能直接写 verified_at 或提升 authority。

- 来源：`docs/features/F188-library-stewardship.md` Phase J section + `docs/discussions/2026-05-20-f188-phase-j-design-gate/README.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- No new V24 migration: reused existing V17 `review_status` column instead of adding redundant schema
- No UI changes: Phase J is pure backend governance tooling, dashboard already exists from Phase B
- Wikilink potential docs kept for review instead of auto-deleted: conservative approach avoids data loss

## Architecture Ownership（必填）

Architecture cell: memory
Map delta: none
Why: Phase J only modifies data + adds migrate/repair tools, doesn't change memory cell boundary

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **Zero-pad collision handling**: When orphan `F20` is classified for update to `F020` but canonical edge already exists, we now delete the orphan instead of updating. Is this the right behavior, or should we merge edge metadata?
2. **Wikilink potential doc threshold**: `CODE_ARTIFACT_PATTERN = /^[a-z][a-zA-Z]*(\.[a-z][a-zA-Z]*)*$/` classifies camelCase targets as code artifacts. Runtime dogfood found 26 potential doc wikilinks — should the pattern be more aggressive?
3. **Verification migration whitelist**: Uses kind×source_path matching (lesson+lessons/, feature+features/, decision+decisions/). Dogfood shows 279 trusted_legacy vs 446 needs_review. Is the whitelist calibration correct?

### 价值 OQ（给 CVO，如有）

无 — all decisions are cat-decidable (reversible, low-risk migrations with dry-run + backup).

## Next Action

Full code review of 9 commits. Key areas:
1. `f188-orphan-edge-repair.ts` — classifier + apply logic correctness
2. `f188-verification-migration.ts` — whitelist completeness
3. `edge-extractors.ts:30-36` — canonical resolver regex
4. `f188-f200-boundary.test.js` — boundary separation assertions
5. Dogfood report — do the numbers make sense?

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f188-phase-j/codex`
- Start Command: `pnpm review:start`
- Note: pure backend, no web port needed. Tests: `cd packages/api && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --test --test-timeout=60000 test/memory/edge-extractors.test.js test/memory/f188-library-health.test.js test/memory/f188-orphan-edge-repair.test.js test/memory/f188-verification-migration.test.js test/memory/f188-verification-workflow.test.js test/memory/f188-f200-boundary.test.js`

## 自检证据

### Spec 合规

Quality gate PASS — AC-J1 through AC-J9 all verified. Design Gate R4 PASS. No follow-up tails. No fallback layer issues (classifier branches are the coordinate system). Architecture ownership: memory cell, Map delta: none.

### 测试结果

```
pnpm test              → 418 files, 3138 tests, 0 fail ✅
pnpm lint              → 0 errors ✅
pnpm check             → 0 errors ✅ (biome format + lint + all sub-checks)
pnpm -r build          → exit 0 ✅
Phase J tests (87)     → 87/87 pass ✅
```

### 相关文档

- Plan: `docs/plans/2026-05-21-f188-phase-j-health-debt-governance.md`
- Design Gate: `docs/discussions/2026-05-20-f188-phase-j-design-gate/README.md`
- Feature: F188 `docs/features/F188-library-stewardship.md`
- Dogfood: `docs/discussions/2026-05-21-f188-phase-j-dogfood-report.md`

## 如果判断错了我最可能错在哪

1. **Whitelist 校准不足**: trusted_legacy 可能包含了不该信任的文档（false sense of security）
2. **Wikilink classifier 过于保守**: 26 个 review items 可能大部分都该直接删
3. **Zero-pad 是主要 orphan 来源的假设**: 如果新的 edge 写入路径绕过 canonical resolver，orphan 会继续增长
4. **review_status 复用 V17 而非新建列**: 如果 V17 的 review_status 语义与 Phase J 不完全一致，可能需要迁移
