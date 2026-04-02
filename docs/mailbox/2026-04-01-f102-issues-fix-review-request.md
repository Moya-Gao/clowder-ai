---
doc_kind: review-request
created: 2026-04-01
topics: [F102, memory, recall-feed, knowledge-feed, evidence-search]
---

# Review Request: F102 Known Issues 1-6 Fix

## What

修复铲屎官 2026-04-01 审查 + 砚砚愿景守护发现的 6 个 Known Issues：

- **Issue 1 (P1)**: Recall Feed 全部显示 (unknown) → 参数名 `q` → `query` 修正
- **Issue 3 (P1)**: 展开 5 hits 只看到 1 条 → tool_result 截断 220→800 字符
- **Issue 4 (P1)**: KnowledgeFeed "已沉淀" 语义不准 → 改名 "已确认"
- **Issue 5 (P2)**: classifySource 9 种 doc_kind 压扁成 4 种 → 新增 mapKindToSourceType + 8 种 sourceType
- **Issue 6 (P2)**: IndexStatus 缺少 AC-J4 承诺的字段 → 后端 + 前端补充 threads/passages/embedding
- **Issue 2 (P2)**: EvidenceSearch UX 粗糙 → 分色 badge、中文标签、limit 10

12 files changed, 337 insertions, 33 deletions. 3 new test files.

## Why

铲屎官在 runtime 上实际使用 Memory Hub 后发现多处功能不达标。砚砚做愿景守护补充了 3 个额外 Issue。全部 6 个 Issue 需要一轮修复。

## Original Requirements（必填）

> 铲屎官："为什么都是unknown啊？"
> 铲屎官："不对啊你这个p1 也不好用啊！你看这个 你hit了5 我的展开呢？每个都是啥啊？"
> 铲屎官："这个就是你们能搜到的全部吗？还是你搜到的不是这样展示的问题？"
- 来源：铲屎官 2026-04-01 runtime 审查截图 + 语音反馈
- 砚砚愿景守护：`docs/features/F102-memory-adapter-refactor.md` Known Issues 4-6
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Issue 3 用了简单的 limit 增大（220→800）而非结构化序列化。这避免了改变 `StoredToolEvent.detail` 的格式约定，代价是超长 output（>800 chars）仍会被截断。5 条结果 ~650 chars 安全覆盖。
- Issue 5 `mapKindToSourceType` 是纯映射函数，没有改 `classifySource()` 去真正读 frontmatter（读 frontmatter 需要异步 IO）。主搜索路径走 `mapKindToSourceType(item.kind)` 不需要再读文件。`classifySource()` 仍在 degraded search 里用路径匹配，但已补充 features/lessons/research 路径识别。

## Open Questions

1. Issue 4 改名"已确认"是否准确？还是应该更细分为 approved / materialized / indexed 三栏？
2. Issue 3 的 800 字符是否足够？如果有超过 5 条结果的场景，可能需要进一步讨论序列化策略。

## Next Action

请 reviewer：
1. 逐 Issue 对照 spec Known Issues 描述验证修复
2. 重点关注 Issue 5 的 sourceType 映射是否覆盖所有 EvidenceKind
3. 判断 tradeoff 是否合理

Review-Target-ID: f102-issues-fix
Branch: feat/f102-issues-fix

## 自检证据

### Spec 合规

6/6 Issues 全部修复，逐项对照 `F102-memory-adapter-refactor.md` Known Issues 段落通过。

### 测试结果

```
pnpm --filter @cat-cafe/web test  → 265 files, 1882 tests, 0 failed ✅
node --test api/test/tool-event-truncation.test.js api/test/classify-source.test.js → 17 pass ✅
pnpm lint → 0 errors ✅
pnpm biome check → 0 errors ✅
pnpm -r --if-present run build → exit 0 ✅
```

### 相关文档

- Feature: `docs/features/F102-memory-adapter-refactor.md` (Known Issues section)
- Commit: `fix(F102): resolve 6 known issues from 铲屎官 + 砚砚 vision audit`
