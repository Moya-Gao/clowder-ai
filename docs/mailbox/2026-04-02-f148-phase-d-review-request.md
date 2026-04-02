---
feature_ids: [F148]
doc_kind: review-request
created: 2026-04-02
---

# Review Request: F148 Phase D — Structured State

Review-Target-ID: f148-phase-d
Branch: feat/f148-phase-d

## What

Phase D 升级 threadMemory 从活动日志到产品导向格式，并注入结构化 coverage map JSON 到 context packet。

核心变更：
1. **AC-D1**: `toolNameToOp` 新增 Read/Grep/Glob → `read` ops；`formatSessionLine` 重写为按操作分组（Created/Modified/Deleted/Read）
2. **AC-D2**: `buildCoverageMap()` 纯函数 + `assembleSmartWindowContext` 注入 `[Context Coverage Map]` JSON + `[Thread Memory]` 到 smart window context；token trim 在 evidence 之后、anchors 之前降级

## Why

铲屎官痛点：冷启动猫猫只看到 flat 消息流，缺乏结构化上下文。Phase A-C 已解决 burst/tombstone/anchors，Phase D 补齐 threadMemory 产品化 + coverage map 自描述，让猫猫知道"我看到了什么、遗漏了什么"。

## Original Requirements（必填）

> "我觉得感觉最重要的，增量上下文的传输"
> "最便宜的 haiku 把它带到沟里面去了"（关于 cheap-model summarization 的失败实验）
- 来源：`docs/features/F148-hierarchical-context-transport.md` lines 18-20
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 未实现 state ledger（Phase D spec item 3 "explore if regex can"）— 纯后端无 LLM
- 未实现 prompt cache ordering（Gemini 建议，独立关注点）
- Coverage map + threadMemory 共同降级（而非独立），简化 token trim 逻辑

## Open Questions

1. `formatSessionLine` 多 ops 文件的优先级顺序 `create > edit > delete > read` 是否合理？
2. Coverage map 降级时机（evidence 之后、anchors 之前）是否正确？
3. `maxThreadMemoryTokens: 300` 默认值是否合适？

## Next Action

请 review 代码质量、接口设计、token trim 降级顺序。

## 自检证据

### Spec 合规

| AC | 状态 | 代码位置 |
|----|------|----------|
| AC-D1: buildThreadMemory 区分 read/write | ✅ | `TranscriptWriter.ts:260-264`, `buildThreadMemory.ts:25-50` |
| AC-D2: coverage map JSON 随 context packet 投递 | ✅ | `context-transport.ts:7-40`, `route-helpers.ts:507-534` |

### 测试结果

```
F148 tests: 99 passed, 0 failed (17 new in Phase D)
pnpm lint (tsc --noEmit): 0 errors
pnpm biome check: 0 errors
pnpm build: exit 0
```

### 相关文档

- Plan: `docs/plans/2026-04-02-f148-phase-d-structured-state.md`
- Feature: `docs/features/F148-hierarchical-context-transport.md`
