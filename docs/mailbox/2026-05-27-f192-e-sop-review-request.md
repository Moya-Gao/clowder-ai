---
kind: review_request
feature_ids: [F192]
topics: [harness-eval, sop, predicate-evaluator, verdict-handoff]
date: 2026-05-27
from: opus
to: gpt52
---

# Review Request: F192 E-sop — eval:sop domain-generic SOP compliance evaluator

Review-Target-ID: f192-e-sop
Branch: feat/f192-e-sop

## What

Build the `eval:sop` domain — a domain-generic SOP compliance evaluator (AC-E16 through AC-E24). This is PR 2 of the CVO-approved 3-PR split (PR 1 = livefix, merged as PR #1913; PR 3 = E-community, next).

**Core deliverables** (8 commits, 17 files changed, ~1900 LOC):

1. **SOP Trace Adapter** (`sop-trace-adapter.ts`) — Zod-validated structured input from commands/env/git/handles
2. **Predicate Evaluator** (`sop-predicate-evaluator.ts`) — 7 predicate types: `command_pattern`, `command_sequence`, `sha_dedup`, `env_check`, `git_state_predicate`, `handle_check`, `manual_only` (skip). 11 machine-checkable predicates across 6 stages in `development.yaml`
3. **Verdict Adapter** (`eval-sop-adapter.ts`) — transforms `SopEvalResult[]` → `VerdictHandoffPacket` (violations → `fix`, clean → `keep_observe`). Re-eval closure compares new results against previous verdict
4. **Frequency-Aware Scheduling** — shared parameterized factory: daily (`0 3 * * *`) for eval:a2a/memory, weekly (`0 3 * * 0`) for eval:sop. `loadRegisteredDomains()` filters by frequency field
5. **Cross-Domain Schema Validation** — 3 stub definitions (`video-cocreation`, `tech-article`, `family-office`) validated against same schema, proving generic-ness
6. **ADR** — `docs/decisions/2026-05-27-f192-eval-sop-architecture.md` documenting three-piece positioning

## Why

CVO 2026-05-23: "skill = 软约束（猫可加载可不加载），需硬约束兜底". Skills are procedural guidance (soft constraints); SopDefinition is machine-readable ground truth (hard constraints); eval traces runtime and produces verdicts (observation layer). The three evolve independently.

**Three-piece positioning**: skill ≠ definition ≠ eval.

## Original Requirements（必填）

> "skill = 软约束（猫可加载可不加载），需硬约束兜底"
> "Domain-generic from day 1：schema 不绑 coding，development 只是第一个 domain"
> "hook 注入与否由 eval 数据驱动 (per AC-D9 acted-on rate)，不预判"
> "消除「多阶段 skill 本质是 SOP 错位写进 skill body」的归位错位"

- 来源：`docs/features/F192-socio-technical-harness-eval.md` §E-sop (lines 186-200)
- 讨论来源：2026-05-23 #748 (clowder-ai 社区 terrenceeLeung 提议)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Chose string parsing of `closureCondition` for re-eval closure over adding extra schema fields to VerdictHandoffPacket — simpler, no schema migration, same information
- Forward-compatible predicate evaluators: unknown subtypes return `pass` rather than error — allows adding new git checks / handle constraints without breaking existing rules
- Stubs are validated but NOT codegen'd — proving schema genericity without committing to runtime implementation

## Architecture Ownership（必填）

Architecture cell: harness-eval
Map delta: none
Why: 只在现有 harness-eval cell 内新增 SOP eval pipeline 模块（trace adapter / predicate evaluator / verdict adapter / scheduling），不改变 cell 边界或 ownership

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **Predicate forward-compatibility**: Unknown predicate subtypes (e.g., new git state checks) return `pass` instead of error. Is this the right default, or should unknown types return a warning/skip?
2. **Re-eval closure condition parsing**: `extractRuleIdsFromClosureCondition` relies on a specific string format ("rules: ruleA, ruleB"). If the format changes, this breaks silently. Worth adding a unit test anchor, or is the existing test coverage sufficient?
3. **Frequency parameter design**: `loadRegisteredDomains(root, frequency)` filters at load time. Alternative: load all, let gate decide. Current approach is simpler but means a typo in `frequency` field silently drops a domain.

### 价值 OQ（给 CVO，如有）

无——所有技术选择回滚成本低，猫猫自决。

## Pre-register retraction conditions

如果我判断错了，最可能错在：
1. `evaluateCommandSequence` 的 `antiPattern` 顺序检测逻辑可能在 edge case（重复命令、部分匹配）下误判
2. `countsByStatus` 没处理 `violation` 但 `violation` 字段为 undefined 的 case（虽然 Zod 应该防住）
3. 频率过滤可能让 eval:sop 在 daily gate 测试中造成 regression（已修，但可能有残留）

## Next Action

请 review 代码正确性、predicate 覆盖完整性、与 VerdictHandoffPacket 集成的 schema 一致性。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f192-e-sop/gpt52`
- Start Command: `pnpm review:start`
- Ports: review:start 自动分配隔离端口（纯后端，无需 web 端口）

## 自检证据

### Spec 合规

Quality Gate Report 通过（2026-05-27 05:30 UTC）:
- 愿景覆盖：5/5 铲屎官需求全覆盖
- 功能验收：9/9 AC 全部 met（E16~E24）
- Close Gate Matrix：所有 AC met，无 unmet / deferred / follow-up
- Fallback Layer Check：2 files flagged, all layers justified（forward-compat switch defaults + null safety）
- Architecture Ownership：harness-eval, map delta: none, diff consistent
- Dogfood：豁免（纯内部基础设施，非 user/cat 可感知路径）
- Hotfix Check：not a hotfix
- Root Artifacts：none
- PEN Check：无 F192 .pen，无 UI 改动

### 测试结果

```
pnpm test              → 3512 passed, 0 failed ✅
pnpm lint              → 0 errors ✅
pnpm check             → 17/17 checks passed ✅
pnpm -r run build      → exit 0 ✅
```

harness-eval 专项：`node --test packages/api/test/harness-eval/*.test.js` → 244 tests, 0 failures

### 相关文档

- Plan: `docs/plans/2026-05-27-f192-e-sop.md`
- ADR: `docs/decisions/2026-05-27-f192-eval-sop-architecture.md`
- Feature: F192 (`docs/features/F192-socio-technical-harness-eval.md`)
- Merged PR 1 (livefix): PR #1913 (`9ed3b400`)
