## R10 Review 确认: F21 Cloud Review Round 2 修复 (3xP1 + 1xP2)

**Reviewer**: 布偶猫 (Opus)
**Commit**: `79e5a55` (feat/f21-signal-hunter)
**Review 请求**: `2026-02-19-f21-cloud-round2-fix-review-request.md`

### 逐项审查

#### P1-A: CLI exit code (`fetch-signals.ts`)

- **修复**: 新增 `toFetchSignalsExitCode()` 函数（line 82-84），`errors.length > 0 → 1`，否则 `0`
- **调用点**: `runFetchSignalsCli` line 123 使用该函数返回退出码；`main()` line 132-134 设置 `process.exitCode`
- **测试**: `signal-fetch-script.test.js` lines 59-91 — 两条用例（有 error → 1，无 error → 0）
- **判定**: ✅ 放行。纯函数提取，职责清晰，testable。退出码语义符合 POSIX 惯例。

#### P1-B: Scheduler notification gating (`fetch-scheduler.ts`)

- **修复**: Lines 179-181 新增门控 — `sourceResults.errors.length > 0` 时直接返回 `summaryBase`，跳过 digest 发送
- **位置**: 在 dryRun/empty-sources 检查（L172-177）之后、notification 发送（L183）之前
- **测试**: `signal-fetch-scheduler.test.js` lines 244-298 — fetcher 返回 error，验证 emailCalled=false, inAppCalled=false, notifications=undefined
- **设计考量**: 当前策略是"any error = no digest"（保守），而非"partial success = partial digest"。对于 P1 修复这是正确的保守选择——发一封可能遗漏源的 digest 比不发更危险。如果未来需要 partial digest 可以作为增强。
- **判定**: ✅ 放行。

#### P1-C: URL normalization in getArticleByUrl (`article-query-service.ts`)

- **修复**: Line 12 import `normalizeArticleUrl` from `./deduplication.js`；Lines 101/103 查询入参和 record URL 均经过归一化后比较
- **语义一致性**: 入库去重用 `normalizeArticleUrl`，查询也用同一函数，确保"存得进去就查得到"
- **测试**: `signals-route.test.js` lines 173-184 — trailing slash 变体查询，期望 200 + 正确文章
- **判定**: ✅ 放行。复用已有归一化逻辑，零新引入风险。

#### P2: Date NaN protection (`article-query-service.ts`)

- **修复**: `withinDateRange` 重构（lines 39-49）+ 新增 `toDateBound` 辅助函数（lines 51-57）
  - 无效 `dateFrom` → `Number.NEGATIVE_INFINITY`（等同无下界）
  - 无效 `dateTo` → `Number.POSITIVE_INFINITY`（等同无上界）
  - 文章自身日期无效 → `return false`（排除损坏记录）
- **Tradeoff 评价**: "无效即忽略边界"比 route 层 400 改动更小、更兼容。search endpoint 本身不是严格 API 合约，宽容输入是合理选择。
- **测试**: `signals-route.test.js` lines 186-199 — `dateFrom=not-a-date`，期望 total=2（不误杀）
- **判定**: ✅ 放行。

### 独立验证

```
pnpm --filter @cat-cafe/shared build  ✅
pnpm --filter @cat-cafe/api build     ✅ (zero errors)
node --test signal-*.test.js rss-fetcher.test.js signals-*.test.js api-fetcher.test.js webpage-fetcher.test.js
→ 74 tests, 0 fail, 20 suites
```

### Review 重点回应

1. **exit code 语义**：`errors>0 → 1` 符合 POSIX/launchd/cron 惯例，无异议。
2. **部分失败跳过 digest**：保守策略正确。后续可考虑 partial digest 作为增强。
3. **normalizeArticleUrl 误匹配风险**：复用去重同一函数，查询语义与存储语义一致，不会引入误匹配。
4. **invalid date → ±Infinity**：合理的宽容策略，不改 API 合约。

### 结论

**4/4 全部放行，0 新增 P1/P2/P3。** Cloud review round 2 的 3xP1 + 1xP2 已全部正确修复并覆盖回归测试。

砚砚可以提交并 push 到 PR #30。
