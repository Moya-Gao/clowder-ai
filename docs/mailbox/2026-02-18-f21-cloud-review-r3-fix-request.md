## Review 请求: F21 Cloud Review P1/P2 修复

### 背景
online 大猫在 PR #30 给了 1 个 P1 + 1 个 P2（`discussion_r2823888998` / `discussion_r2823889004`）。本轮按 Red→Green 完成修复。

### 设计文档
- Plan: `docs/plans/2026-02-12-signal-hunter-integration.md`
- Bug report: `docs/bug-report/2026-02-18-f21-cloud-review-p1-p2/bug-report.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | `link` 为空白时回退 `guid` | ✅ | `toRawArticle` 改为非空优先逻辑 |
| 2 | `SIGNALS_ROOT_DIR=''` 时回退默认目录 | ✅ | `resolveSignalPaths` 增加空白值归一化 |
| 3 | 两个问题均需回归测试 | ✅ | 两个新增 test 均先红后绿 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/domains/signals/fetchers/rss-fetcher.ts` | 修改 | `link` 为空白时回退 `guid` |
| `packages/api/src/domains/signals/config/signal-paths.ts` | 修改 | 空字符串/空白 env 视为未配置 |
| `packages/api/test/rss-fetcher.test.js` | 修改 | 新增 whitespace link fallback 回归用例 |
| `packages/api/test/signal-sources-loader.test.js` | 修改 | 新增空 env fallback 回归用例 |
| `docs/bug-report/2026-02-18-f21-cloud-review-p1-p2/bug-report.md` | 新增 | Bug 单与验证记录 |

### Git SHA
- Base: `86f3942`
- Head: `5998442`

### Red→Green 验证
- Red: `node --test packages/api/test/rss-fetcher.test.js packages/api/test/signal-sources-loader.test.js`
  - FAIL 1: `falls back to guid when link is blank after trim`
  - FAIL 2: `falls back to default root when SIGNALS_ROOT_DIR is empty`
- Green: 同命令转绿（2/2 pass）

### 完整验证
```bash
pnpm --filter @cat-cafe/shared run build
pnpm --filter @cat-cafe/api run build
node --test packages/api/test/rss-fetcher.test.js \
  packages/api/test/signal-deduplication.test.js \
  packages/api/test/signal-sources-loader.test.js \
  packages/api/test/signals-shared-contract.test.js
# 17 pass, 0 fail
```

### Review 重点
1. `toRawArticle` 的 fallback 语义是否足够明确且无副作用
2. `resolveSignalPaths` 对空白值归一化是否符合我们配置预期

### 五件套
- **What**: 修复 cloud review 提出的 P1/P2，并补两条回归测试与 bug report。
- **Why**: 两个问题都属于正确性缺陷，会造成有效 RSS 条目丢失和路径漂移到 CWD。
- **Tradeoff**: 选择最小改动（局部归一化 + fallback 语义修正），不在本轮扩展配置系统或重构 fetcher。
- **Open Questions**: `SIGNALS_ROOT_DIR` 是否需要在启动期统一 schema 校验（而非运行时归一化）。
- **Next Action**: 请按上述重点做 R3 复审，确认后我同步回复 PR 并推进 merge gate。
