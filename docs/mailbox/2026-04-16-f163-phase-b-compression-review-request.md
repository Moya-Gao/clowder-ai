# Review Request: F163 Phase B — Non-Replacement Compression + Source Backlinks

Review-Target-ID: f163-phase-b
Branch: feat/f163-phase-b

## What

Phase B implements the memory entropy reduction compression pipeline:

1. **Schema V14** — 3 new columns on `evidence_docs`: `source_ids`, `summary_of_anchor`, `compression_rationale`
2. **TF-IDF Duplicate Scanner (AC-B1)** — Pairwise cosine similarity on title+summary, single-linkage clustering via Union-Find
3. **Compression Apply API (AC-B2)** — `POST /compress/apply` creates canonical summary, demotes originals to `activation=backstop`
4. **Backstop Suppression + Expand API (AC-B3)** — Search excludes backstop docs when compression active; `GET /expand/:anchor` drills into sources
5. **Shared-Rules Condensation (AC-B4)** — `analyzeSharedRules()` clusters markdown sections by TF-IDF similarity, outputs merge proposals
6. **Cascade Guard (AC-B5)** — Architectural block on summary-of-summary at both upsert() and createSummary() level
7. **Experiment Logging** — `logCompressionScan`/`logCompressionApply` in f163_logs
8. **Zero-Behavior Regression** — Confirms `compression=off` has no side effects

## Why

三猫共识（Round 2 讨论）：知识只增不减导致搜索信噪比退化。Phase A 建了实验框架 + 多轴元数据，Phase B 补上压缩管线。

## Original Requirements (mandatory)

> "我们家其实一直没做的是记忆的熵减。什么东西都越来越多。"
> "压缩而非累积 — 多条同根因教训合并为1条精准规则"
> "猫不自主执行合并——产出 pruning 建议，铲屎官拍板。"

- Source: `docs/discussions/2026-04-15-harness-engineering-triad-study/round2-overfitting-and-entropy.md`
- **请对照上述摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- TF-IDF over embedding similarity: 选择了纯算法 TF-IDF 而非 LLM embedding，因为 evidence.sqlite 是本地离线组件，不依赖外部 API
- Backstop suppression via flag gating: 用 `freezeFlags().compression` 动态判断，而非硬编码，保证 `off` 状态完全无副作用
- shared-rules 浓缩只产出提案不自动执行: 匹配 spec "猫不自主执行合并" 的约束

## Open Questions

1. **f163-admin.ts 222 行**: Phase A 89 行 + Phase B 3 个 endpoint = 222 行，过了 200 warn。是否需要拆分？
2. **AC-B4 实际 11.3%**: `analyzeSharedRules` 在真实 shared-rules.md 上跑出 11.3% reduction（threshold=0.15）。≥15% 靠 CVO 手工审批合并。这是否符合 AC "至少完成一轮浓缩" 的定义？
3. **Biome import reorder**: `pnpm check:fix` 把 `freezeFlags` 从 search() 内的 dynamic import 提升为顶层 static import。功能正确（f163-types 无循环依赖），但改变了原始的惰性加载策略。

## Next Action

请 @codex review 以下重点：
- Cascade guard 的完整性（upsert + createSummary 两层是否有遗漏路径）
- Backstop suppression 是否覆盖 search() 的所有 3 条 SQL 分支
- TF-IDF tokenizer 对中英混合文本的鲁棒性
- Flag gating 一致性：scan 允许 suggest|apply，apply 仅允许 apply

## Self-Check Evidence

### Spec Compliance

Quality Gate 通过 — AC-B1~B5 全部实现 + 测试覆盖。详见本轮 gate report。

### Test Results

```
pnpm test → 8201 pass, 13 fail (all Redis store isolation guard — pre-existing)
pnpm lint → 0 errors
pnpm check → 0 errors (biome format + lint)
pnpm --filter @cat-cafe/api run build → exit 0
```

F163 Phase B 新增测试: 8 test files, 36 tests, all pass.

### Artifact Hygiene

```
git status --short | rg '^.. [^/]+\.(png|...)$' → empty ✅
git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|...)$' → empty ✅
```

### Related Documentation

- Feature: `docs/features/F163-memory-entropy-reduction.md`
- Plan: `docs/plans/2026-04-16-f163-phase-b-compression.md`
- Phase A PR: #1214 (merged)

### Commits (11)

```
cc7570c79 style(F163): biome format + import ordering
368671b98 feat(F163): zero-behavior regression for Phase B
698e8173a feat(F163): compression logging
53f7ae0e1 feat(F163): shared-rules condensation (AC-B4)
436ffd501 feat(F163): source expansion API (AC-B3)
70a2a8d67 feat(F163): backstop suppression (AC-B3)
895afbed7 feat(F163): compression apply API (AC-B2)
a93535b45 feat(F163): compression scan API (AC-B1)
d0a9296f3 feat(F163): TF-IDF duplicate scanner (AC-B1)
f79f6a89e feat(F163): cascade compression guard (AC-B5)
1b2aacc4e feat(F163): Schema V14
```

### Diffstat

19 files changed, 1899 insertions(+), 12 deletions(-)
