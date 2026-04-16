# Review Request: F163 Phase A — Memory Entropy Reduction

Review-Target-ID: f163-phase-a
Branch: feat/f163-phase-a

## What

Phase A 为 evidence.sqlite 知识系统引入 **multi-axis metadata + experiment framework**，为后续熵减（降级/归档/压缩）建立量化基线和安全切换基础设施。

核心变更（15 tasks, 17 commits, 35 files, +2487/-16）：

1. **Schema V13**: evidence_docs 加 authority/activation/verified_at 列 + 3 张实验表（f163_cohorts, f163_suggestions, f163_logs）
2. **Types + Flag System**: F163Authority × F163Activation 正交轴 + 7 个 feature flags via env-registry + variant_id (SHA-256)
3. **Authority Boost**: post-retrieval RRF-style boosting `(1/(rank+60)) × weight` with shadow/on mode
4. **Kill-switch**: try-catch fail-open — boost 出错回退到原始 BM25 排序
5. **Constitutional Knowledge**: tag shared-rules/LL as constitutional → always_on 直注入 SystemPromptBuilder（不走检索管道）
6. **Promotion API**: POST /api/f163/promote — upward-only (observed→candidate→validated), constitutional blocked (CVO-only)
7. **Experiment Infrastructure**: logger + cohort sticky routing + zero-behavior regression guard
8. **Eval Baseline**: 55-query gold set + NDCG@10/MRR computation utils

## Why

三猫共识（Round 2 讨论）：**知识系统"只增不减"是 P0 级基础设施缺口**。shared-rules 449 行、LL 51 条、feedback 40 个，全部等权涌入同一检索管道，搜什么都是 mid 置信度。

Phase A 的目标不是做熵减本身，而是：
- 量化当前 baseline（NDCG/MRR），为后续熵减提供 before/after 对比
- 建立 authority 分级，区分"铁律"和"临时备忘"
- 建立安全实验切换（flags off = 零副作用），让 Phase B 的降级/归档有安全网

## Original Requirements（必填）

> "我们家其实一直没做的是记忆的熵减。什么东西都越来越多。"
>
> "为什么猫猫对我而言这么好用？我和你们一起创造了他。"
>
> 三猫共识："记忆熵减是 P0 级基础设施缺口"——目标不是 recall more，而是 compress better。

- 来源：`docs/discussions/2026-04-15-harness-engineering-triad-study/round2-overfitting-and-entropy.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题（Phase A scope: 基线量化 + 分级 + 实验框架）**

## Tradeoff

- **RRF vs learned weights**: 选了静态 RRF (`1/(rank+60) × weight`) 而非可训练权重。Phase A 是基线，复杂度留给 Phase B eval-driven tuning。
- **always_on 直查 evidence_docs vs FTS5**: FTS5 external-content 表只有 title/summary 列没有 anchor，constitutional 查询需要 WHERE authority + activation + status 过滤，直查主表更简单可靠。
- **Promotion API localhost-only**: 没做 token auth，Phase A 只需要 CVO 手动操作。Phase B 加 RBAC。
- **Write queue Promise-chain vs Worker Thread**: 单写者 Promise mutex 够用且 debug 简单。

## Open Questions

1. **authority_weight 1.0–1.3 范围合理吗？** — 保守选择，constitutional 只 +30% boost，避免压倒 relevance signal。需要 eval data 验证。
2. **Gold set 55 queries 覆盖面够吗？** — 7 categories (exact anchor, semantic, process, pitfall, cross-domain, infra, hybrid)。如有遗漏请补充。
3. **EvidenceWriteQueue 是否需要 back-pressure?** — 当前无界队列。高并发场景下可能需要限流。

## Next Action

请 review 代码质量 + 架构合理性。重点关注：
- Schema V13 migration 是否安全（ALTER TABLE on existing data）
- Authority boost 算法的 fail-open 是否健壮
- always_on injection 的 SystemPromptBuilder 集成是否干净
- Promotion API 的安全边界

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f163-phase-a/codex`
- Start Command: `pnpm review:start`
- Ports: 纯后端改动，无需启动前端。`node --test` 即可验证。

## 自检证据

### Spec 合规

Quality Gate 2026-04-16 通过：
- 愿景覆盖 4/4 ✅（量化基线 / 分级治理 / 安全回滚 / 铁律区分）
- AC-A1~A7 全部实现 ✅
- 15 tasks 全部 TDD Red→Green→Refactor ✅

### 测试结果

```
pnpm test (unset REDIS_URL) → 8155 pass, 0 fail, 1 skipped ✅
pnpm lint                   → 0 errors ✅
pnpm check                  → 0 errors (biome format + lint) ✅
pnpm -r --if-present build  → exit 0 ✅
```

F163 新增测试：91 tests across 14 test files（schema, types, write-queue, store-metadata, authority-boost, experiment-logger, eval, cohort, tag-constitutional, killswitch, always-on, promotion, zero-behavior, evidence-route）

### 相关文档

- Plan: `docs/plans/2026-04-16-f163-phase-a-plan.md`
- Feature: `docs/features/F163-memory-entropy-reduction.md`
- Discussion: `docs/discussions/2026-04-15-harness-engineering-triad-study/round2-overfitting-and-entropy.md`
