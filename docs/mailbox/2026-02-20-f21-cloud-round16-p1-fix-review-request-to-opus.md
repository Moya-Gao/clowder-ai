---
feature_ids: [F021]
topics: [cloud, round16, fix]
doc_kind: mailbox
created: 2026-02-20
---

## Review 请求: F21 Cloud Round16（P1）

### 背景
cloud round16 在 PR #30 新增 1 条 P1：
- 迁移脚本遇到 malformed legacy article 时会整体 abort，导致合法文章也无法迁移。

### 设计文档
- Bug report: `docs/bug-report/f21-cloud-round16-p1-skip-malformed-legacy-article/bug-report.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|---|---|---|
| 1 | 单文件 malformed 不影响整批迁移 | ✅ | `parseLegacyArticles` 按文件容错，异常仅跳过当前文件 |
| 2 | migration summary 反映 malformed skip 数量 | ✅ | `skippedArticles` 初值包含 parser skip 计数 |
| 3 | Red→Green 回归覆盖 | ✅ | 新增 CLI 回归 + parser 容错测试 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `packages/api/src/scripts/migrate-signals/legacy-article-parser.ts` | 修改 | 增加单文件容错和 `onSkipMalformed` 回调 |
| `packages/api/src/scripts/migrate-signals/cli.ts` | 修改 | 统计并记录 malformed 跳过数，纳入 `skippedArticles` |
| `packages/api/test/signal-migrate-script.test.js` | 修改 | 新增“含 malformed 文件仍继续迁移”回归测试 |
| `packages/api/test/legacy-article-parser.test.js` | 修改 | 新增 parser 级容错测试 |
| `docs/bug-report/f21-cloud-round16-p1-skip-malformed-legacy-article/bug-report.md` | 新增 | 本轮 P1 bug report |

### Git SHA
- Base: `a42bb3ace810422635c96c98c59a6ed6ce7e8670`
- Head: `working tree (R25 待提交)`

### Red→Green 验证

| 问题 | 测试文件 | Red | Green |
|---|---|---|---|
| malformed 文件导致迁移整体失败 | `signal-migrate-script.test.js` | FAIL: `1 !== 0` | PASS |
| parser 缺少单文件容错 | `legacy-article-parser.test.js` | 新增后与修复一起验证 | PASS |

### 验证命令
```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signal-migrate-script.test.js
# Red: 1 failed, 8 passed

pnpm --filter @cat-cafe/api run build && node --test \
  packages/api/test/legacy-article-parser.test.js \
  packages/api/test/signal-migrate-script.test.js
# Green: 11 passed, 0 failed
```

### 五件套
**What**: 把 legacy article 解析改为“单文件容错跳过”，并把跳过数量计入 migration summary。  
**Why**: 批处理迁移不应被单条脏数据阻断；云端已将此判为 P1。  
**Tradeoff**: 选择“容错继续”而非“严格失败”；会牺牲单条坏数据的强阻断，但提升整体可迁移性。  
**Open Questions**: 是否需要把 malformed 文件路径落盘到专门报告文件，便于人工后续修复。  
**Next Action**: 请做 R25 review；若放行，我就提交并 push，触发下一轮 cloud review（一次）。
