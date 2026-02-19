# R16 确认: Cloud Round7 修复 (1×P1 + 2×P2) — 全部通过

## Review 结论

**0 P1 / 0 P2 / 0 P3 — 放行 ✅**

## 逐项审查

### P1: article detail/by-url/update 对缺失文件返回 500 → 404

| 项目 | 结果 |
|------|------|
| 修复文件 | `packages/api/src/domains/signals/services/article-query-service.ts` |
| 修复方式 | 新增 `readArticleDetailOrNull` 包装函数 (L65-71)，try/catch 异常返回 null |
| 覆盖范围 | `getArticleById` (L102)、`getArticleByUrl` (L125)、`updateArticle` (L178) 三处单记录路径全改为 null-safe |
| 与批量路径的一致性 | 批量操作 (`listInbox`/`search`/`getStats`) 仍走 `readArticleDetailsSafely`（Promise.allSettled），单记录走 null 降级，两条路径语义清晰 |
| 测试覆盖 | `signals-route.test.js` 新增"returns 404 (not 500) for detail/by-url/update when article file is missing"，覆盖 GET detail + GET by-url + PATCH 三个端点 |
| 判定 | ✅ 通过 |

### P2-A: migrate CLI 机器绑定默认路径

| 项目 | 结果 |
|------|------|
| 修复文件 | `packages/api/src/scripts/migrate-signals/cli.ts` |
| 修复方式 | 移除硬编码 `/Users/lysander/...` 默认值，`--from` 缺失时打印 usage + exit 1 (L154-159) |
| USAGE 文本 | L17-26 明确标注 `--from <path>` 为 `(required)` |
| 测试覆盖 | `signal-migrate-script.test.js` 新增"fails fast when --from is missing"，验证 exit=1 + 错误信息包含"--from is required" |
| 判定 | ✅ 通过 |

### P2-B: SignalArticleList 嵌套 button

| 项目 | 结果 |
|------|------|
| 修复文件 | `packages/web/src/components/signals/SignalArticleList.tsx` |
| 修复方式 | 外层行从 `<button>` 改为 `<div role="button" tabIndex={0}>` (L52-62)，保留键盘可达性 (Enter/Space) |
| 事件隔离 | `onKeyDown` 检查 `event.target !== event.currentTarget` 防止拦截内层按钮键盘事件；内层 `已读`/`收藏` button 保留 `stopPropagation()` |
| HTML 合规性 | 不再有 `<button>` 嵌套 `<button>` 的语义违规 |
| 测试覆盖 | `signal-article-list.test.ts` 新增 1 用例：验证无嵌套 button + action 点击隔离 |
| 判定 | ✅ 通过 |

## 构建 & 测试

```bash
# shared + api build
pnpm --filter @cat-cafe/shared build  # ✅ clean
pnpm --filter @cat-cafe/api build     # ✅ clean

# API signal tests (全量回归)
node --test test/signals-route.test.js test/signal-migrate-script.test.js \
  test/signal-source-processor.test.js test/legacy-article-parser.test.js \
  test/signal-fetch-scheduler.test.js test/signal-source-migration.test.js \
  test/signals-shared-contract.test.js
# 33 passed, 0 failed ✅

# Web component test
npx vitest run src/components/__tests__/signal-article-list.test.ts
# 1 passed ✅
```

## Git SHA

- Base: `bbd6a57` (cloud round6 fix)
- Head: `b0b11a5` (cloud round7 fix)

## 下一步

砚砚可以 push + 触发下一轮云端 review。

---
*R16 by 布偶猫🐾 — 2026-02-20*
