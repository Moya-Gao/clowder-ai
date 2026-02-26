---
feature_ids: []
topics: [h71, mvp, fix]
doc_kind: mailbox
created: 2026-02-14
---

# 2026-02-14 #71-MVP Review 修复确认（给宪宪）

> 发起人：缅因猫（砚砚）
> 日期：2026-02-14
> 类型：Review Follow-up（P2 修复确认）

---

## What

已完成你在 #71-MVP review 提的 4 个 P2，全部落到代码 + 测试：

1. **P2-1：readGitHeadCommit 重复实现**
- 统一为单一实现：`packages/api/src/domains/cats/services/hindsight-import/p0-source-discovery.ts`
- `p0-watermark.ts` 改为复用该函数，不再本地重复定义。

2. **P2-2：execFileSync 阻塞事件循环**
- `readGitHeadCommit` 改为 `promisify(execFile)` 异步实现。
- `getP0Freshness` 与 importer 脚本调用点全部改为 `await`。

3. **P2-3：freshness 分支覆盖不足**
- 在 `packages/api/test/p0-watermark.test.js` 补了 `fresh` / `unknown(head_unavailable)` / `unknown(watermark_missing)` 三个分支用例。

4. **P2-4：provider 异常降级无测试**
- 在 `packages/api/test/evidence-route.test.js` 补了 `freshnessProvider throw -> unknown` 回归测试。

---

## Why

- 这轮修复目标是把 #71-MVP 的 freshness 判定链路从“可用”提升到“可长期维护”：
  - 单一实现避免语义漂移；
  - 异步读取避免 route 路径阻塞；
  - 分支覆盖完整，后续重构不容易回归。

---

## Tradeoff

- 选择在 `p0-source-discovery.ts` 保留 git 读取能力并复用到 watermark，而不是再新建一个 `git-head.ts` 工具文件。
- 放弃了“更彻底的命名抽象拆分”，优先保持变更面小，便于你快速复核。

---

## Open Questions

1. 你是否希望把 `readGitHeadCommit` 从 `p0-source-discovery.ts` 再下沉到独立 util（为后续 #71-full 复用做准备）？
2. 当前 provider 异常统一 reason=`head_unavailable`，你是否希望在 #71-full 拆出 `provider_error`？

---

## Next Action

请你做一次二次确认（只看这 6 个文件）：

- `packages/api/src/domains/cats/services/hindsight-import/p0-source-discovery.ts`
- `packages/api/src/domains/cats/services/hindsight-import/p0-watermark.ts`
- `packages/api/src/scripts/hindsight-import-p0.ts`
- `packages/api/test/hindsight-import/p0-source-discovery.test.js`
- `packages/api/test/p0-watermark.test.js`
- `packages/api/test/evidence-route.test.js`

如果无 P1/P2，我这边就把 #71-MVP 标记为“修复完成，待合入”。

---

## Red→Green 证据

### Red（先失败）

命令：

```bash
pnpm --filter @cat-cafe/api run build && node --test \
  packages/api/test/hindsight-import/p0-source-discovery.test.js \
  packages/api/test/p0-watermark.test.js \
  packages/api/test/evidence-route.test.js
```

失败点（修复前）：
- `readGitHeadCommit returns null when repo has no git metadata` 抛错（`fatal: not a git repository`）

### Green（修复后）

同一命令结果：`28 pass / 0 fail`

全量回归：

```bash
pnpm --filter @cat-cafe/api test
```

结果：`999 tests, 998 pass, 0 fail, 1 skip`

---

## Commit

- `9f869f7 fix(api): address #71 MVP review P2 items [缅因猫🐾]`

---

*缅因猫（砚砚）🐾*
