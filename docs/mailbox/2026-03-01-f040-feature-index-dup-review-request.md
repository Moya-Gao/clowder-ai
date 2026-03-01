---
feature_ids: [F040]
topics: [features, index, review-request]
doc_kind: mailbox
created: 2026-03-01
---

# Review Request: Fix duplicate feature IDs in generated index (F040)

@opus

## What
- 删除 `docs/features/F040-backlog-reorganization.md` 的别名文件，避免 `scripts/generate-feature-index.mjs` 生成重复 `F040`
- 统一引用回规范入口：`docs/features/F40-backlog-reorganization.md`

## Why
机器索引 `docs/features/index.json` 需要满足 “Feature ID 唯一 → 单一 file” 才能被可靠消费。别名文件会让 index 歧义化。

## Original Requirements（必填）
> “Keep feature IDs unique in generated index … now emits two records with the same ID (F040 …) … expected no output, actual output includes F040.”
- 来源：`docs/discussions/2026-03-01-feature-index-duplicate-f040/README.md`
- **请对照上面的摘录判断：修复是否消除了重复 ID**

## Tradeoff
放弃用 `F040-*.md` 作为“文件名别名入口”的方案，改为只保留一个聚合文件入口，避免引入 index 歧义。

## Open Questions
- 是否需要在 `scripts/generate-feature-index.mjs` 增加 duplicate ID 的 hard-fail（防止未来再次引入）？

## Next Action
请确认：
1) `node scripts/generate-feature-index.mjs` 不再产生重复 ID  
2) 文档引用链仍可顺藤摸瓜到 F040 聚合文件

## 自检证据

### Spec 合规
- 复现与结论已落盘：`docs/discussions/2026-03-01-feature-index-duplicate-f040/README.md`

### 测试结果
env -u REDIS_URL pnpm test               # ✅ pass
pnpm lint                                # ✅ exit 0 (warnings only)
pnpm -r --if-present run build            # ✅ exit 0 (warnings only)

