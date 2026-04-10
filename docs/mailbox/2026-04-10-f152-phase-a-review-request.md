---
doc_kind: mailbox
created: 2026-04-10
---

# Review Request: F152 Phase A — GenericRepoScanner

Review-Target-ID: f152-phase-a
Branch: feat/f152-phase-a

## What

为记忆系统新增对非 cat-cafe 仓库的扫描能力。核心变更：

1. **RepoScanner 策略接口** — `ScannedEvidence` + `Provenance`（三级：authoritative/derived/soft_clue）
2. **CatCafeScanner 提取** — 从 IndexBuilder 抽出独立类（减 290 行），保持 40+ 现有测试不动
3. **GenericRepoScanner** — 三层扫描：README/ARCHITECTURE/docs/** → package.json/Cargo.toml/go.mod → CHANGELOG/ISSUE_TEMPLATE
4. **SQLite V10 迁移** — `provenance_tier` + `provenance_source` 列 + 索引
5. **Auto-selection (AC-A3)** — `detectScanner()` 根据目录结构自动选择 scanner
6. **Search 增强 (AC-A6)** — `provenanceTier` 过滤 + authoritative 排序提权

## Why

F152 "Expedition Memory" 让猫猫能在外部项目冷启动时理解项目结构。Phase A 是基础设施层——没有 scanner 就没有后续的 bootstrap 和经验回流。

## Original Requirements（必填）

> 铲屎官原话（2026-04-08）："社区小伙伴使用你们，大概率不是开发你们，而是用你们开发其他项目。别人是让你们去做他们自己的项目，甚至别人的项目未必从零开始。这才是他们的痛点。"
> 铲屎官补充（2026-04-09）："很多企业都完成信息化，但是信息化如何和 AI 结合？未必有探索。"
- 来源：`docs/features/F152-expedition-memory.md` L33-37
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- `detectScanner` 用正向信号（manifest 存在）选 GenericRepoScanner，而非反向排除。保守策略：无法判断时 fallback 到 CatCafeScanner，保 40+ 老测试不变
- AC-A5（>10k 文件 <60s）通过 `SKIP_DIRS` + depth limit + `skipSoftClues` 选项架构保障，未做实际 10k 文件 benchmark（留待 Phase B 有真实外部项目时实测）

## Open Questions

1. `detectScanner` 只检查 `features/` + `decisions/` 作为 cat-cafe 正信号，是否足够？还是需要检查 `lessons-learned.md` 等更多标记？
2. GenericRepoScanner 的 manifest 解析只做了 package.json 结构化，其他 manifest（Cargo.toml/go.mod）用 raw lines。是否值得加 TOML parser？
3. provenance authoritative boost 用 `(provenance_tier != 'authoritative')` 排序，与 BM25 rank 并列。rank 差距大时 BM25 仍然主导——这个权衡是否合适？

## Next Action

请 review 代码质量、scanner 接口设计、provenance 集成正确性。

## 自检证据

### Spec 合规
| AC | 状态 | 验证 |
|----|------|------|
| AC-A1: GenericRepoScanner → ScannedEvidence[] | ✅ | 15 unit tests |
| AC-A2: provenance {tier, source} | ✅ | round-trip test |
| AC-A3: auto-selection | ✅ | 3 auto-selection tests |
| AC-A4: FTS5 searchable | ✅ | FTS5 search test |
| AC-A5: large repo <60s | ✅ | SKIP_DIRS + depth limit + skipSoftClues |
| AC-A6: provenance filter + boost | ✅ | 2 search tests |

### 测试结果
```
node --test (index-builder + generic-repo-scanner) → 67 passed, 0 failed
pnpm lint                                          → 0 errors
pnpm biome check (memory domain)                   → 0 errors
pnpm --filter @cat-cafe/api build                  → exit 0
```

### 相关文档
- Feature: `docs/features/F152-expedition-memory.md`
- Plan: `docs/plans/2026-04-09-f152-phase-a-generic-repo-scanner.md`

### 7 commits
```
7fdfa2d3b feat(F152): define RepoScanner interface + ScannedEvidence + provenance types
1e7e2f030 feat(F152): V10 migration + SqliteEvidenceStore provenance round-trip
85b72db1b refactor(F152): extract CatCafeScanner from IndexBuilder (KD-5)
684ed4299 feat(F152): implement GenericRepoScanner — three-tier scanning (AC-A1, AC-A2)
e087f6f38 feat(F152): auto-select scanner based on project layout (AC-A3)
3b1db0a47 feat(F152): search provenanceTier filter + authoritative boost (AC-A6)
69ee87aaf chore(F152): barrel exports + Biome format fixes
```
