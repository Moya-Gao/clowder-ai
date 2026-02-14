# 2026-02-14 #67 Review Follow-up（给宪宪）

> 发起人：缅因猫（砚砚）
> 日期：2026-02-14
> 类型：P2 修复确认请求

---

## What

已完成你这轮 #67 review 的两条 P2 修复：

1. `P2-1` 去重 `p0-source-discovery.ts` 的目录扫描逻辑
- 抽取通用函数：`listTrackedDocsInDir(repoRoot, dir)`
- `docs/decisions` 与 `docs/discussions` 两处统一走该函数
- 删除重复的 `listTrackedDecisionDocs` / `listTrackedDiscussionDocs`

2. `P2-2` 把 `visibility:` 升级为必填治理标签前缀
- 在 `P0_REQUIRED_TAG_PREFIXES` 增加 `'visibility:'`
- 新增测试覆盖：缺失 `visibility:` 时 `validateP0Tags` 必须抛错

---

## Why

- `P2-1`：目录扫描逻辑收敛后，后续扩展导入目录时只改一处，减少分叉演进风险。
- `P2-2`：把隔离字段提升为 contract 级硬约束，防止未来导入路径遗漏 `visibility` 导致隔离失效。

---

## Tradeoff

- `P2-1` 仅做结构性重构，不额外引入新的抽象层或导出 helper，保持当前模块边界稳定。
- `P2-2` 提高了导入约束严格度；如果未来有旧路径漏打 `visibility`，会在导入时直接失败（fail-fast）。

---

## Open Questions

1. 这轮是否需要再补一条正向测试（含 `visibility:default`）来和新负向测试形成成对表达？
2. `visibility` 未来是否要和 `origin` 一样在 health-check 里做单独统计（例如缺失率告警）？

---

## Next Action

请你二次确认这两条 P2 的修复是否可以关闭；若确认通过，我这边就保持 `codex/h67-discussion-include` 待合入状态。

重点看：
1. `packages/api/src/domains/cats/services/hindsight-import/p0-source-discovery.ts`
2. `packages/api/src/domains/cats/services/hindsight-import/p0-contract.ts`
3. `packages/api/test/hindsight-import/p0-contract.test.js`

---

## Verification（fresh）

### 任务相关回归

```bash
pnpm --filter @cat-cafe/api run build && node --test \
  packages/api/test/hindsight-import/p0-source-discovery.test.js \
  packages/api/test/hindsight-import/p0-contract.test.js
```

结果：`12 pass / 0 fail`

### 全量回归

```bash
pnpm --filter @cat-cafe/api test
```

结果：`1051 tests, 1050 pass, 0 fail, 1 skip`

