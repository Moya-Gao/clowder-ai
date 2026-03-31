---
doc_kind: review-request
feature_ids: [F102]
created: 2026-03-31
---

# Review Request: F102 Phase I Follow-up — Passage Enrichment + Context Window

Review-Target-ID: f102-phase-i-followup
Branch: feat/f102-phase-i-followup

## What

4 个 AC 让 passage 搜索从"知道某个 thread 讨论过 X"升级到"定位到具体消息"：

1. **AC-I7**: `searchPassages()` 返回 `createdAt` 字段（SELECT p.created_at）
2. **AC-I8**: `searchPassages()` 支持 `contextWindow` 参数，返回命中 passage 前后 N 条（类似 grep -C）
3. **AC-I9**: `search(depth=raw)` 返回结构化 `passages[]`（passageId + speaker + createdAt），API route + MCP handler 都透传
4. **AC-I10**: SystemPromptBuilder + CLAUDE.md 检索策略表更新 depth=raw 用法

## Why

金渐层痛点："搜到了只知道某个 thread 讨论过 X，不知道具体哪条消息"。Phase I 的 passage 已存了消息级内容，但返回字段太少、没有上下文窗口。Phase J Memory Hub 前端需要消费这些丰富的返回值。

## Original Requirements（必填）

> 金渐层："evidence 只有摘要，搜到了只知道'某个 thread 讨论过 X'，不知道具体哪条消息"
> 铲屎官："返回字段丰富化 + 上下文窗口作为一个小 follow-up 追加到 Phase I spec 里"
> 铲屎官："猫猫也要能用啊！这可能涉及到 mcp 以及 skills 的优化修改！"
- 来源：F102 spec `docs/features/F102-memory-adapter-refactor.md` Phase I Follow-up 段落
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- context window 用 position-based 查询（`WHERE position BETWEEN ? AND ?`），不是 time-based。Position 在同一 doc_anchor 内连续，更直观且不受时间间隔影响。
- MCP 格式化保持纯文本（不返回 JSON），和现有 MCP 响应风格一致。

## Open Questions

1. `searchPassages` 的第 4 参数 `options?: { contextWindow?: number }` 是否应该和 `timeFilter` 合并为一个 options 对象？当前分开是为了不改已有调用方签名。
2. `EvidenceItem.passages` 只在 `depth=raw` 时填充——是否需要在 `depth=summary` 时也返回 passage count？

## Next Action

请 review 代码改动，特别关注：
- SQL 查询正确性（context window 的 position BETWEEN）
- `search()` 方法中 passages 分组逻辑
- MCP handler 格式化是否足够让猫定位消息

## 自检证据

### Spec 合规

| AC | 状态 | 代码位置 | 测试 |
|----|------|----------|------|
| I7 | ✅ | SqliteEvidenceStore.ts:551,588 | passage-permanence.test.js |
| I8 | ✅ | SqliteEvidenceStore.ts:593-614 | passage-permanence.test.js |
| I9 | ✅ | SqliteEvidenceStore.ts:215-245, evidence.ts:79, evidence-tools.ts:97-103 | passage-permanence.test.js |
| I10 | ✅ | SystemPromptBuilder.ts:207, CLAUDE.md:89 | system-prompt-builder.test.js |

### 测试结果

```
passage-permanence.test.js  → 6/6 pass ✅
index-builder.test.js       → 33/33 pass ✅
system-prompt-builder.test.js → 76/76 pass ✅
pnpm check                  → 0 errors ✅
pnpm lint                   → 0 errors ✅
pnpm -r --if-present run build → exit 0 ✅
```

### 相关文档

- Plan: `docs/plans/2026-03-31-f102-phase-i-followup-passage-enrichment.md`
- Feature: F102 — `docs/features/F102-memory-adapter-refactor.md`
