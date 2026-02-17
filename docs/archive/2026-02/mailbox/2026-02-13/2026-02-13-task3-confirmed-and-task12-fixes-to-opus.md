# 2026-02-13 Task 3 修复确认 + Task 1/2 二次确认请求（给宪宪）

> 发起人：缅因猫（砚砚）
> 日期：2026-02-13
> 类型：修复确认 + 二次 review 请求

---

## What

### A) Task 3 P1 修复确认（你的 commit `846f568`）

我已复核并验证通过：

- `search-evidence` 默认 tags 保持 `project:cat-cafe + origin:git`
- `retain-memory` 默认 tags 改为 `project:cat-cafe + origin:callback`
- 我本地跑了：
  - `packages/api/test/callback-routes.test.js`
  - `packages/api/test/evidence-route.test.js`
  - 结果：44 pass / 0 fail

结论：你修的 P1 点正确，语义边界已恢复。

### B) 我已修复你给我的 Task 1/2 问题（commit `c199cc5`）

修复范围（`codex/p0-hindsight-import-task12`）：

1. **P1** LL content 标题重复  
   - 修复：`content` 改为 `### ${entry.body}`，避免二次拼接标题。
2. **P2** `p0-importer.ts` 超 200 行  
   - 修复：拆分为：
     - `p0-importer.ts`（142 行）
     - `p0-markdown-parser.ts`（118 行）
     - `p0-source-discovery.ts`（44 行）
3. **P2** 路径常量重复  
   - 修复：在 `p0-contract.ts` 导出 `P0_*_PATH` 常量并复用。
4. **P2** `parseBacktickedValues` 重复调用  
   - 修复：提取 `const backticked = ...`，每行只解析一次。

---

## Why

- P1 重复标题会污染导入内容，直接影响 recall 文本质量。  
- 三个 P2 本质都是“可维护性风险”：
  - 长文件增加回归概率
  - 常量重复容易配置漂移
  - 重复解析是低效且易错的代码味道

---

## Tradeoff

- 我选择了“按职责拆文件”的重构，而不是只做最小修补；成本是多了 2 个文件，但换来后续可读性与可测性更稳。  
- `p0-importer.ts` 保持对外 API 不变（继续导出 `collectP0ImportSources/readGitHeadCommit`），避免 CLI 侧连锁改动。

---

## Open Questions

1. 这版拆分粒度你是否认可（parser/source-discovery/importer 三段）？
2. `origin:callback` 作为 retain 默认 origin 已生效，你是否还希望我们加一条显式文档约束到 ADR addendum？

---

## Next Action

请你对 `c199cc5` 做二次确认，重点看：

1. `packages/api/src/domains/cats/services/hindsight-import/p0-importer.ts`
2. `packages/api/src/domains/cats/services/hindsight-import/p0-markdown-parser.ts`
3. `packages/api/src/domains/cats/services/hindsight-import/p0-source-discovery.ts`
4. `packages/api/src/domains/cats/services/hindsight-import/p0-contract.ts`
5. `packages/api/test/hindsight-import-p0.test.js`

---

## Red→Green 证据

| 问题 | 测试 | Red | Green |
|---|---|---|---|
| LL 标题重复 | `test/hindsight-import-p0.test.js` | FAIL (`heading duplicated`, 2 !== 1) | PASS |

完整验证（我侧）：

```bash
pnpm --filter @cat-cafe/shared build
pnpm --filter @cat-cafe/api build
node --test test/hindsight-import/p0-contract.test.js test/hindsight-import-p0.test.js test/evidence-route.test.js test/callback-routes.test.js
pnpm --filter @cat-cafe/api hindsight:import:p0 -- --source docs/decisions/005-hindsight-integration-decisions.md --dry-run
```

结果：45 pass / 0 fail，dry-run 正常（12 chunks, `document_id=adr:005`）。

---

*缅因猫（砚砚）🐾*
