---
feature_ids: [F021]
topics: [cloud, round5, fix]
doc_kind: mailbox
created: 2026-02-19
---

## Review 请求: F21 Cloud Round5 两个 P1 修复

### 背景
cloud review（head `a984195`）新增 2 个 P1：
1. 坏文章文件会让 inbox/search/stats 整体 500
2. `SignalSource.id` 未限制路径穿越字符

本轮按 Red→Green 已修复并完成 signals 回归。

### 设计文档
- Plan: `docs/plans/2026-02-12-signal-hunter-integration.md`
- Bug report: `docs/bug-report/f21-cloud-review-round5-p1-inbox-sourceid/bug-report.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | 坏文件不拖垮列表/搜索/统计 | ✅ | `Promise.allSettled` 隔离失败记录 |
| 2 | 不安全 source id 在 schema 层拒绝 | ✅ | `SignalSourceSchema.id` 改为安全 slug regex |
| 3 | 新增回归测试覆盖 | ✅ | route 合规 + shared contract 各 1 条 Red→Green |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/domains/signals/services/article-query-service.ts` | 修改 | 批量读取改为 safe all-settled，跳过坏记录 |
| `packages/shared/src/schemas/signals.schema.ts` | 修改 | source id 安全正则校验 |
| `packages/api/test/signals-route.test.js` | 新增测试 | 坏文件隔离后 inbox/search/stats 仍 200 |
| `packages/api/test/signals-shared-contract.test.js` | 新增测试 | 非法 source id（路径字符）被拒绝 |
| `docs/bug-report/f21-cloud-review-round5-p1-inbox-sourceid/bug-report.md` | 新增文档 | 本轮 5 件套 bug report |

### Git SHA
- Base: `a984195`
- Head: （待本次 commit）

### 测试状态
```bash
pnpm --filter @cat-cafe/shared build                                            # pass
pnpm --filter @cat-cafe/api build                                               # pass
pnpm --filter @cat-cafe/api exec node --test test/signals-route.test.js test/signals-shared-contract.test.js  # pass
pnpm --filter @cat-cafe/api exec node --test 'test/signal-*.test.js'           # pass (50/50)
```

### Review 重点
1. `Promise.allSettled` 跳过坏记录的行为是否符合我们可用性优先策略
2. `SignalSource.id` 正则边界是否合理（安全 vs 兼容）
3. 新增测试是否准确复现并锁住本轮两个 P1

### 五件套

**What**: 修复 cloud round5 两个 P1（坏文件隔离 + source id 安全约束），并补回归测试。  
**Why**: 两个问题都属于高优先级正确性/安全边界缺陷，会导致接口整体不可用或潜在越界写风险。  
**Tradeoff**: 坏记录选择“跳过”而非失败；source id 改为严格校验可能拒绝历史非常规 id。  
**Open Questions**: 是否需要在响应中暴露“坏记录数量”用于可观测性（不影响本轮 P1 清零）。  
**Next Action**: 请做 R14 review，确认这两个 P1 可放行。
