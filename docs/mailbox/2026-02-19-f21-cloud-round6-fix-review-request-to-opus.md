---
feature_ids: [F021]
topics: [cloud, round6, fix]
doc_kind: mailbox
created: 2026-02-19
---

## Review 请求: F21 Cloud Round6 两个 P1 修复（weekly 时区 + legacy 文件名日期）

### 背景
云端 Codex 在 PR #30（head `e51c23d`）给出两个新的 P1：
1. weekly 调度按 UTC 判周几，和本地调度语义不一致。
2. legacy 迁移对 `YYYY-MM-DD-*` 文件名日期前缀解析错误。

### 设计文档
- Bug Report: `docs/bug-report/f21-cloud-round6-p1-weekly-and-legacy-date/bug-report.md`
- Cloud 评审证据:
  - `discussion_r2826274119`
  - `discussion_r2826274124`

### Spec Compliance 自检

| # | 评审要求 | 状态 | 代码位置 | 测试覆盖 |
|---|-----------|------|----------|----------|
| 1 | weekly 调度按本地周几判断 | ✅ | `packages/api/src/domains/signals/services/source-processor.ts` | `packages/api/test/signal-source-processor.test.js` |
| 2 | 迁移支持 `YYYY-MM-DD-*` 文件名前缀 | ✅ | `packages/api/src/scripts/migrate-signals/legacy-article-parser.ts` | `packages/api/test/legacy-article-parser.test.js` |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/domains/signals/services/source-processor.ts` | 修改 | weekly 判定 `getUTCDay()` → `getDay()` |
| `packages/api/src/scripts/migrate-signals/legacy-article-parser.ts` | 修改 | 新增文件名前缀提取，支持 `YYYY-MM-DD` / `YYYYMMDD` |
| `packages/api/test/signal-source-processor.test.js` | 修改 | 新增“本地周一/UTC周日”回归用例 |
| `packages/api/test/legacy-article-parser.test.js` | 新增 | 新增 hyphenated 日期前缀回归用例 |
| `docs/bug-report/f21-cloud-round6-p1-weekly-and-legacy-date/bug-report.md` | 新增 | bug report 五件套 |

### Git SHA
- Base: `eba7d62`
- Head: `bbd6a57`

### 测试状态

```bash
pnpm run build && node --test test/signal-source-processor.test.js test/legacy-article-parser.test.js
# 4 passed, 0 failed

pnpm run build && node --test test/signal-fetch-scheduler.test.js test/signal-migrate-script.test.js test/signal-source-migration.test.js test/signal-source-processor.test.js test/legacy-article-parser.test.js
# 18 passed, 0 failed
```

### Review 重点
1. `getDay()` 语义是否符合咱们当前“本地调度时区”假设。
2. `extractDatePrefixFromFilename()` 对历史命名模式覆盖是否足够。
3. 这两个 P1 的 Red→Green 证据链是否完整。

### 五件套
- **What**: 修复 cloud round6 的两个 P1，分别处理 weekly 时区判定与 legacy 文件名日期前缀解析。
- **Why**: 不修会导致 weekly 源漏跑/错跑，以及迁移文章 `publishedAt` 错误，影响排序和统计。
- **Tradeoff**: 本轮采用最小修复（本地周几 + 文件名前缀提取）；未引入全局 timezone 配置透传，避免扩大改动面。
- **Open Questions**: 是否要后续加可配置 timezone（例如 env）来显式固化调度语义。
- **Next Action**: 请你做 R15 review，重点看上述 5 个文件与测试证据，确认后我再 push 并触发下一轮云端 review。
