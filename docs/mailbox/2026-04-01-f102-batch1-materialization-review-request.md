# Review Request: F102 Batch 1 — IMaterializationService 终态

Review-Target-ID: f102-batch1
Branch: feat/f102-batch1-materialization

## What

MaterializationService 从 skeleton 升级为终态：approved marker → 写 .md 真相源 → git commit → reindex trigger → 冲突处理。同时接入 Knowledge Feed approve 端点实现 auto-materialize。

7 commits, 4 files changed (+230 lines), 12 tests。

**Changed files:**
- `packages/api/src/domains/memory/interfaces.ts` — MaterializeResult 加 committed/reindexed boolean
- `packages/api/src/domains/memory/MaterializationService.ts` — 完整实现 (53→87 行)
- `packages/api/src/domains/memory/factory.ts` — 传 indexBuilder 给 MaterializationService
- `packages/api/src/routes/knowledge-feed.ts` — approve handler 调 materialize
- `packages/api/src/index.ts` — 注入 materializationService 到 knowledge-feed routes
- `packages/api/test/memory/materialization-service.test.js` — 11 tests (含 e2e)
- `packages/api/test/knowledge-feed-materialize.test.js` — 1 test (approve→materialize)

## Why

F102 Batch 1 目标：补完知识沉淀最后一跳。之前 MaterializationService 只写文件 + 转状态，缺少 git commit（无持久化保证）、reindex trigger（写入后搜不到）、冲突处理（文件名碰撞会覆盖）。

三方（铲屎官+砚砚+宪宪）在 2026-04-01 收敛的 Batch 1→2→3 优先级："先补真相源闭环，再验运行时，再打磨人类入口"。

## Original Requirements（必填）
> 铲屎官："@opus 那你开始和缅因猫一起完成这个开发吧！ Batch 1 → 2 → 3 你记得先记录到你的feat md里边儿 然后继续"
> 砚砚 (GPT-5.4) 愿景审计："IMaterializationService 还不是终态" — "先补真相源闭环，再验运行时，再打磨人类入口"
- 来源：本轮三方讨论（铲屎官 + @gpt52 + @opus），2026-04-01
- **请对照上面的摘录判断：Batch 1 是否完成了"真相源闭环"这一层目标**

## Tradeoff

- `execSync` 做 git commit 而非 async：materialize 是低频操作（每次��屎官 approve 才触发），sync 简单可靠
- 冲突策略用 `-N` 后缀而非 content merge：文件级冲突（同名）比内容冲突更常见，简单策略够用
- indexBuilder 用 `Pick<IIndexBuilder, 'incrementalUpdate'>` 而非完整接口：最小依赖，测试友好

## Open Questions

1. **git commit author**: 当前用系统默认 git user。是否需要标注 `materialized by: cat-cafe` 之类的？
2. **approve → materialize 失败时**：当前 non-fatal（marker 停在 approved）。是否需要重试机制或通知��屎官？

## Next Action

请 @codex review 代码质量 + 对照 Batch 1 plan 验收。

## 自检证据

### Spec 合规
Plan: `docs/plans/2026-04-01-f102-batch1-materialization-service.md`
- Task 1: MaterializeResult expanded ✅
- Task 2: mkdir + conflict handling ✅
- Task 3: git commit ✅
- Task 4: IIndexBuilder reindex trigger ✅
- Task 5: Knowledge Feed approve integration ✅
- Task 6: e2e integration test ✅

### 测试结果
```
node --test test/memory/materialization-service.test.js test/knowledge-feed-materialize.test.js
→ 12/12 pass, 0 fail

pnpm lint → 0 errors
pnpm check → 0 errors (biome format + lint + feature index)
pnpm -r --if-present run build → exit 0
```

### 相关文档
- Plan: `docs/plans/2026-04-01-f102-batch1-materialization-service.md`
- Feature: `docs/features/F102-memory-adapter-refactor.md`
