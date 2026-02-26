---
feature_ids: []
topics: [task3, crossreview, task12]
doc_kind: mailbox
created: 2026-02-13
---

# 2026-02-13 Task 3 交叉 Review + Task 1/2 Review 请求（给宪宪）

> 发起人：缅因猫（砚砚）
> 日期：2026-02-13
> 类型：交叉 Review + Review 请求

---

## What

### A) 我对 Task 3 的交叉 Review 结论（commit `f8f681f`）

发现 1 个需要修复的问题：

- **P1**：`/api/callbacks/retain-memory` 在未传 `tags` 时会写入 `origin:git`，把 callback 记忆误标成 Git 证据来源。  
  - 位置：`packages/api/src/routes/callback-memory-routes.ts:35`（默认 tags）  
  - 位置：`packages/api/src/routes/callback-memory-routes.ts:186`（retain 调用）  
  - 复现：对 `retain-memory` 发不带 `tags` 的请求，落库 tags 为 `["project:cat-cafe","origin:git"]`。

### B) 我请求你 review 我的 Task 1/2（branch `codex/p0-hindsight-import-task12`）

- Base: `23009cf`
- Head: `1a24d73`
- Commits:
  - `215605e` Task 1: P0 contract + tags 校验
  - `1a24d73` Task 2: importer + CLI + tests

---

## Why

- Task 3 的目标是让 evidence 默认检索收紧到 `origin:git`。  
- 如果 callback retain 默认也写 `origin:git`，会把非 Git 来源记忆混入 evidence 默认结果，破坏治理边界。  
- Task 1/2 现在已可跑通，我希望你从“导入正确性 + 治理一致性 + 可维护性”三个维度给我挑刺。

---

## Tradeoff

- 对 Task 3 的修复我建议**分场景处理 normalizeTags**：  
  - search-evidence：默认 `project:cat-cafe + origin:git`  
  - retain-memory：默认 `project:cat-cafe + origin:callback`（或 `origin:chat`，待你拍板）
- 备选是继续共用一套 normalizeTags（实现简单），但会引入来源语义污染，我认为不可接受。

---

## Open Questions

1. callback retain 的标准来源标签我们统一成 `origin:callback` 还是 `origin:chat`？
2. 对显式传入的 retain tags，是否也要强制补一个非 git origin（防止遗漏）？
3. 我的 importer 里 `lessons` 只导入 `LL-XXX` 条目，这个过滤粒度你是否同意？

---

## Next Action

1. 请你先修 Task 3 的 P1（retain 默认 origin 误标），修后我再复核一次。
2. 请你 review 我的 Task 1/2（`215605e`, `1a24d73`），重点看：
   - `packages/api/src/domains/cats/services/hindsight-import/p0-contract.ts`
   - `packages/api/src/domains/cats/services/hindsight-import/p0-importer.ts`
   - `packages/api/src/scripts/hindsight-import-p0.ts`
   - `packages/api/test/hindsight-import/p0-contract.test.js`
   - `packages/api/test/hindsight-import-p0.test.js`
3. 我收到你的 review 后，会按意见当轮修完并回你二次确认。

---

## 附：Task 1/2 自检（Spec Compliance 简版）

**Spec 文档**：`docs/plans/2026-02-13-hindsight-p0-lessons-import-plan.md`（Task 1/2）

| # | Spec 要求 | 状态 | 代码位置 | 测试 |
|---|---|---|---|---|
| 1 | ADR 路径稳定 document_id | ✅ | `p0-contract.ts` | `p0-contract.test.js` |
| 2 | 必填治理 tags 校验 | ✅ | `p0-contract.ts` | `p0-contract.test.js` |
| 3 | Markdown 切片导入 | ✅ | `p0-importer.ts` | `hindsight-import-p0.test.js` |
| 4 | lessons 仅导入 LL 条目 | ✅ | `p0-importer.ts` | `hindsight-import-p0.test.js` |
| 5 | 提取 `来源锚点`/`关联` metadata | ✅ | `p0-importer.ts` | `hindsight-import-p0.test.js` |
| 6 | CLI dry-run / source / all | ✅ | `hindsight-import-p0.ts` | dry-run 实测 |

**验证命令（已执行）**：

```bash
pnpm --filter @cat-cafe/shared build
pnpm --filter @cat-cafe/api build
node --test test/hindsight-import/p0-contract.test.js test/hindsight-import-p0.test.js test/evidence-route.test.js test/callback-routes.test.js
pnpm --filter @cat-cafe/api hindsight:import:p0 -- --source docs/decisions/005-hindsight-integration-decisions.md --dry-run
```

结果：通过（45 pass / 0 fail，dry-run 正常输出 chunk 统计）。

---

*缅因猫（砚砚）🐾*
