---
feature_ids: [F021]
topics: [cloud, round3, fix]
doc_kind: mailbox
created: 2026-02-19
---

## Review 请求: F21 Cloud Round3 P1/P2 修复（source-processor）

### 背景
Cloud review 新一轮指出 `source-processor` 两个阻塞项：
1. `articleStore.store` 单条异常会中断整源处理（P1）
2. `source.filters.keywords` include/exclude 未执行（P2）

这轮修复目标是把两项都在编排层一次性收敛，并补回归测试。

### 设计文档
- Bug report: `docs/bug-report/f21-cloud-review-round3-source-processor/bug-report.md`
- Integration spec: `docs/plans/2026-02-12-signal-hunter-integration.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | 单条 store 失败不应中断整源处理 | ✅ | `packages/api/src/domains/signals/services/source-processor.ts` | `packages/api/test/signal-source-processor.test.js` |
| 2 | include/exclude 关键词过滤在 dedup/store 前生效 | ✅ | `packages/api/src/domains/signals/services/source-processor.ts` | `packages/api/test/signal-source-processor.test.js` |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/domains/signals/services/source-processor.ts` | 修改 | 新增关键词过滤 + per-article store 异常隔离 |
| `packages/api/test/signal-source-processor.test.js` | 新增 | 两条 Red→Green 回归测试 |
| `docs/bug-report/f21-cloud-review-round3-source-processor/bug-report.md` | 新增 | bug 五件套记录 |

### Git SHA
- Base: `7e2fa21` (`origin/main`)
- Head: `7dbdc0a`

### Red→Green 验证

| 问题 | 测试文件 | Red | Green |
|------|----------|-----|-------|
| P1: store 单条失败中断流程 | `packages/api/test/signal-source-processor.test.js` | FAIL（抛 `disk full` 直接中断） | PASS |
| P2: keywords 过滤未生效 | `packages/api/test/signal-source-processor.test.js` | FAIL（dedup/store 收到 3 条） | PASS（仅 1 条） |

### 测试状态

```bash
cd packages/api && pnpm run build && node --test test/signal-source-processor.test.js
# 2 passed, 0 failed

cd packages/api && pnpm run build && node --test test/signal-*.test.js test/signals-*.test.js
# 59 passed, 0 failed

pnpm --filter @cat-cafe/mcp-server test
# 30 passed, 0 failed

pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useChatCommands-signals.test.ts
# 5 passed, 0 failed
```

### 五件套

**What**: 修复 source-processor 的 P1/P2：store 异常隔离 + keywords 过滤落地。  
**Why**: 避免单条脏数据导致整轮任务失败；保证 sources 配置语义真正生效。  
**Tradeoff**: 仍复用现有 `FetchErrorCode`（按 source method 归类），未引入新 error code，保持改动最小。  
**Open Questions**: 是否要在后续引入 `STORE_FAILED` 独立错误码，便于观测区分抓取失败 vs 存储失败。  
**Next Action**: 请重点确认 `source-processor` 的错误聚合语义和关键词过滤边界是否符合预期。

