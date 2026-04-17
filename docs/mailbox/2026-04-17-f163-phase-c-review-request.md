---
doc_kind: review-request
feature_ids: [F163]
created: 2026-04-17
---

# Review Request: F163 Phase C — 三触发知识审计

Review-Target-ID: f163-phase-c
Branch: feat/f163-phase-c

## What

F163 Phase C 完整实现——三触发知识审计框架：

1. **Schema V15**: 3 new columns on evidence_docs (contradicts TEXT, invalid_at TEXT, review_cycle_days INTEGER)
2. **Write-time contradiction detector** (AC-C1): TF-IDF cosine similarity checks incoming docs against existing knowledge, flag-gated by F163_CONTRADICTION_DETECTION
3. **Retrieval-time flag-review** (AC-C2): POST endpoint marks docs as status=review with invalid_at timestamp
4. **Review-time queue** (AC-C3): Pure SQL query finds stale knowledge (verified_at + review_cycle_days threshold)
5. **Health report** (AC-C4): Aggregated metrics — totalDocs, byKind, byAuthority, contradictions, staleReview, backstopRatio, compressionRatio
6. **Zero-regression** (AC-C5): All flags default off, no behavior change
7. **Issue #1221 verification**: freezeFlags() reads process.env per-call, F136 PATCH /api/config/env already works

New files: 5 source + 6 test files. All routes extracted into `f163-audit-routes.ts` (separate from `f163-admin.ts`).

## Why

铲屎官核心痛点："我们家其实一直没做的是记忆的熵减。什么东西都越来越多。" Phase A (多轴元数据) + Phase B (压缩框架) 已合入，Phase C 补齐"知识会过时"的检测能力。

## Original Requirements（必填）

> "我们家其实一直没做的是记忆的熵减。什么东西都越来越多。"
> "所有基于大模型的 AI 应用其最终的有效价值本质上是对使用者个体思维的过拟合！"
> "到时候你这个做完我们一把体验完整版？包括刚刚的issue"

- 来源：`docs/discussions/2026-04-15-harness-engineering-triad-study/round2-overfitting-and-entropy.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- ContradictionDetector 复制了 DuplicateScanner 的 TF-IDF helpers 而非抽取共享模块——避免跨文件依赖增加，两处逻辑简单且独立演化
- 审计路由提取到 `f163-audit-routes.ts` 而非追加到 `f163-admin.ts`——后者已 243 行，追加会超 350 行限制
- ReviewQueue 用纯 SQL (julianday) 而非 JS 日期计算——减少 row fetch 量，SQLite 原生日期函数足够

## Open Questions

1. **ContradictionDetector 阈值**: 当前 cosine similarity > 0.3 标记为潜在矛盾。这个阈值是否合理？reviewer 可以检查 `f163-contradiction-detector.ts:24`
2. **Health report 是否需要 flag gate**: 当前 health-report 不受任何 flag 控制（always-on 诊断端点）。是否应该 gate？
3. **DEFAULT_CYCLE_DAYS**: `f163-review-queue.ts` 导出了默认 review cycle 天数但未在查询中使用（仅用于未来 UI 提示）——这是有意设计还是遗漏？

## Next Action

请 @codex 做 code review，重点关注：
- Schema migration 安全性
- Flag gating 是否完备（off/suggest/apply 三态）
- SQL injection 风险（nowClause 参数构造）
- 接口契约合理性

## Review Sandbox（纯后端，无前端页面）

无前端改动，不需要 dev server。Reviewer 可在沙盒内直接跑测试验证：
```bash
git clone --branch feat/f163-phase-c --depth 1 . /tmp/cat-cafe-review/f163-phase-c/codex
cd /tmp/cat-cafe-review/f163-phase-c/codex
pnpm install && pnpm --filter @cat-cafe/api run build
node --test packages/api/test/memory/f163-*.test.js packages/api/test/memory/schema-v15-f163c.test.js
```

## 自检证据

### Spec 合规

AC-C1~C5 全部实现，逐项有对应测试。Issue #1221 已验证（freezeFlags per-call env read）。

### 测试结果（本次真实运行）

```
Phase C tests → 18/18 pass, 0 fail ✅
Dependent schema tests → 33/33 pass, 0 fail ✅
pnpm check → 0 errors ✅
pnpm lint → 0 errors ✅
pnpm --filter @cat-cafe/api build → exit 0 ✅
```

### 相关文档

- Plan: `docs/plans/2026-04-16-f163-phase-c-knowledge-audit.md`
- Feature: `docs/features/F163-memory-entropy-reduction.md`
- Discussion: `docs/discussions/2026-04-15-harness-engineering-triad-study/round2-overfitting-and-entropy.md`
