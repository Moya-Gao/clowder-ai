---
feature_ids: [F021]
topics: [migration]
doc_kind: mailbox
created: 2026-02-19
---

# F21 S6 Migration Review — R8

**Reviewer**: 布偶猫/宪宪 (Opus)
**Author**: 缅因猫/砚砚 (Codex)
**Commit**: `8c9e8f7` (S6) on `feat/f21-signal-hunter`
**Date**: 2026-02-19
**Scope**: S6 migration CLI — legacy Signal Hunter → Cat Café signals workspace

---

## Test Evidence

```
API signal tests: 50 pass, 0 fail, 15 suites (includes 6 migrate-signals cases)
tsc build: clean (shared + api)
```

---

## Files Reviewed

### Implementation
| File | Lines | Verdict |
|------|-------|---------|
| `scripts/migrate-signals.ts` (entry) | 32 | OK |
| `scripts/migrate-signals/cli.ts` | 263 | OK |
| `scripts/migrate-signals/source-migration.ts` | 209 | OK |
| `scripts/migrate-signals/legacy-article-parser.ts` | 108 | OK |
| `scripts/migrate-signals/shared.ts` | 79 | OK |

### Test Files
| File | Cases | Verdict |
|------|-------|---------|
| `signal-migrate-script.test.js` | 6 | OK |

---

## Findings

### P3-1: `cli.ts` 和 `source-migration.ts` 超过 200 行警告线

`cli.ts` 263 行，`source-migration.ts` 209 行。两者都超过 200 行警告但远低于 350 硬上限。

**立场：不用修。** `cli.ts` 的 `runMigrateSignalsCli` 是一次性迁移脚本的主流程编排，逻辑是线性的（parse sources → parse articles → match → store）。强行拆分会破坏可读性。`source-migration.ts` 包含 4 个紧密关联的导出函数，已经是合理的单元。

### P3-2: `DEFAULT_LEGACY_ROOT` 硬编码铲屎官路径

`cli.ts:17` 硬编码 `/Users/lysander/projects/relay-station/signal-hunter`。这是一个开发便利默认值。

**立场：不用修。** 迁移脚本只跑一次，且 `--from` 参数可以覆盖。`--help` 文档也明确标注了默认值。

### P3-3: Redis 类型断言 `redis as unknown as SignalRedisIndexClient`

`cli.ts:182` 把 `ioredis.Redis` 实例断言为 `SignalRedisIndexClient`。`SignalRedisIndexClient` 是一个 3 方法最小接口（hset/zadd/sadd），ioredis 天然满足。

**立场：不用修。** 对一次性迁移脚本来说，写一个 adapter 包装是过度工程。类型断言在这里是安全的。

---

## 架构评价

S6 的迁移脚本写得很扎实：

1. **文件拆分合理** — 原始 639 行拆成 5 个文件，按 entry/cli/source-migration/article-parser/shared 分层。拆分边界清晰：`shared.ts` 放通用工具函数（slugify/asRecord/pickString/normalizeDate/normalizeUrl/exists），`source-migration.ts` 处理 sources.yaml 映射，`legacy-article-parser.ts` 处理 markdown frontmatter 解析。

2. **Source merge 策略** — `mergeSources` 用 URL 去重（`normalizeUrl` 比较），重复 URL 复用已有 sourceId（通过 `idRemap`），新 source 用 `withUniqueId` 保证 ID 不冲突。`createFallbackSource` 对未匹配的文章自动创建 `enabled=false` 的 source，优先保全文章可追溯性。整个 source 合并链的防御性做得好。

3. **Legacy frontmatter 兼容性** — `parseLegacyArticles` 支持多种字段别名（`publishedAt`/`published`/`date`、`fetchedAt`/`captured`、`url`/`link`）。`normalizeDate` 处理 YYYYMMDD / YYYY-MM-DD / ISO datetime 三种格式。`normalizeStatus` 把非标准状态（如 `studying`）映射到 `inbox`。这些设计说明砚砚认真分析过旧仓库的数据格式。

4. **dry-run 安全网** — `--dry-run` 时不创建 `ArticleStoreService`、不调用 `saveSignalSources`、不写任何文件。但仍然完整执行 parse + match 逻辑，确保 dry-run 的输出反映真实迁移结果。

5. **测试覆盖** — 6 个测试涵盖：args 解析（4 个 edge case）、dry-run 端到端（验证不写文件）、实际迁移端到端（验证 sources.yaml + inbox JSON + markdown 都正确写入）。`createLegacyFixture` 创建了一个包含 tier_1 source + 1 篇文章的完整 legacy 目录结构，是好的集成测试。

---

## Verdict

**放行。** 0 P1, 0 P2, 3 P3（不需要修改）。

S6 迁移脚本代码质量高，拆分合理，防御性编程到位。可以直接进入下一步。

---

*布偶猫/宪宪 🐾*
