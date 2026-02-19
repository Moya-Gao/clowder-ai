## Review 请求: F21 S5/S6 Cloud Review P1/P2 修复

### 背景
PR #30 最新 cloud review（commit `27bfd38`）给出 2×P1 + 1×P2。已按 Red→Green 修复，现请求布偶猫复核。

### 设计文档
- Plan: `docs/plans/2026-02-19-f21-s5-integration-implementation-plan.md`
- Plan: `docs/plans/2026-02-19-f21-s6-migration-plan.md`
- Bug report: `docs/bug-report/2026-02-19-f21-cloud-review-s5-s6-followup/bug-report.md`
- Cloud review 记录: PR #30 comments `discussion_r2825540067`, `discussion_r2825540074`, `discussion_r2825540078`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | RSS 空 link + 非 URL guid 不应污染调度 | ✅ | `rss-fetcher` 仅接受 http/https URL，非 URL 条目过滤 |
| 2 | PATCH 清空 summary 后持久层不得回弹 | ✅ | `toUpdatedFrontmatter` 先移除旧 `summary` 再按新值写回 |
| 3 | migration source dedup 不能误合并 query 不同 URL | ✅ | `normalizeUrl` 保留 query，`mergeSources` 不再误合并 |
| 4 | 每条修复有 Red→Green 证据 | ✅ | 3 个失败用例先红后绿，见下方 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/domains/signals/fetchers/rss-fetcher.ts` | 修改 | URL 有效性校验，优先选第一个合法 URL（link/guid） |
| `packages/api/src/domains/signals/services/article-document.ts` | 修改 | 更新 frontmatter 时移除陈旧 summary |
| `packages/api/src/scripts/migrate-signals/shared.ts` | 修改 | URL 归一化保留 query 参数 |
| `packages/api/test/rss-fetcher.test.js` | 修改 | 新增非 URL guid 过滤回归测试 |
| `packages/api/test/signals-route.test.js` | 修改 | 新增 summary 清空后不回弹回归测试 |
| `packages/api/test/signal-source-migration.test.js` | 新增 | 新增 query 不同 URL 不合并测试 |
| `docs/bug-report/2026-02-19-f21-cloud-review-s5-s6-followup/bug-report.md` | 新增 | 本轮 bug report |

### Red→Green 验证

| 问题 | Red (失败点) | Green |
|------|--------------|-------|
| P1-A 非 URL guid | `rss-fetcher.test.js:97`，期望 `articles.length === 0` 实际 `1` | 通过 |
| P2 清空 summary 回弹 | `signals-route.test.js:226`，期望 `summary === undefined` 实际旧值 | 通过 |
| P1-B query 合并错误 | `signal-source-migration.test.js:29`，期望 `sources.length === 2` 实际 `1` | 通过 |

### 测试状态

```bash
pnpm --filter @cat-cafe/api run build && cd packages/api && node --test test/rss-fetcher.test.js test/signals-route.test.js test/signal-source-migration.test.js
# RED: 15 tests, 3 fail

pnpm --filter @cat-cafe/api run build && cd packages/api && node --test test/rss-fetcher.test.js test/signals-route.test.js test/signal-source-migration.test.js
# GREEN: 15 tests, 0 fail

pnpm --filter @cat-cafe/api run build && cd packages/api && node --test test/signal-*.test.js test/rss-fetcher.test.js test/signals-route.test.js
# 回归: 56 tests, 0 fail

pnpm -r --if-present run build
# 全包 build 通过（web 有既有 lint warning，无新增 error）
```

### Review 重点
1. `rss-fetcher` 过滤非 URL 条目的策略是否符合我们对 feed 兼容性的边界。
2. `toUpdatedFrontmatter` 的 summary 删除语义是否覆盖 PATCH 清空场景。
3. migration `normalizeUrl` 保留 query 后，是否会引入不期望的 source 重复。

### 五件套

**What**: 修复 cloud review 的 2×P1 + 1×P2，并补 3 条回归测试。

**Why**: 这三处都会造成真实数据一致性风险（调度中断、summary 状态回弹、source 误合并），不能带入合入阶段。

**Tradeoff**: RSS 过滤改为“仅接收 http/https URL”，会丢弃部分非标准 feed 条目；但相比让调度链路在 store 阶段报错更稳妥。

**Open Questions**: 是否还需要在 `source-processor` 层增加 store 异常隔离（单条失败不影响整源），作为后续增强。

**Next Action**: 请布偶猫做 R9 复核，重点看上述 3 个实现文件和 3 个回归测试。
