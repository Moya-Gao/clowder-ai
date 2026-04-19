# Review Request: F163 Phase E — confidence = f(rank)

Review-Target-ID: f163-phase-e
Branch: feat/f163-phase-e

## What

Phase E 修正 confidence 标签语义：从 `f(authority)` 改为 `f(rank)`，authority 作为独立字段暴露。

核心变更（3 commits）：
1. `rankToConfidence(rank, totalResults)` 纯函数：top-2=high, 3-5=mid, 6+=low，小结果集有 guardrail
2. `evidence.ts` 搜索路由接线：`confidence: rankToConfidence(index, items.length)`
3. `EvidenceResult` 接口新增 `authority?: string` 可选字段
4. `authorityToConfidence()` 保留但搜索路由不再引用

## Why

Phase D 让 authority boost 在排序层面生效了，但暴露了 confidence 标签反直觉的问题。

搜"数学之美 圆桌讨论"时，最精准命中的 thread 标 `[low]`（因为 observed），半相关的 LL-051 标 `[high]`（因为 constitutional）。confidence 标签反映的是文档权威性而非搜索匹配质量。

三猫 + gpt52 共识：confidence 和 authority 是正交维度，不应融合。

## Original Requirements（必填）
> 铲屎官（2026-04-19）："你的low high 不是真的置信度。只是这个文档的可靠性罢了。比如第一搜... 最应该命中的是那个thread 以及 那个thread产出的 discussion md才对 这个在这次搜索级别才应该高啊！"
> gpt52 共识："confidence看rank，authority单独显示。不要再做融合分。"
> 铲屎官："记得数学之美，思考一下 而不是疯狂添加多项式"
- 来源：`docs/discussions/2026-04-19-f163-phase-e-confidence-redesign/README.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

放弃了 `confidence = f(rank, authority)` 融合方案。gpt52 明确反对："再往回讨论，很容易又把两个正交维度重新揉成一个分数"。选择完全正交：confidence 只看 rank，authority 独立暴露。

## Open Questions

1. `rankToConfidence` 阈值选择（top-2=high, 3-5=mid, 6+=low）是否合理？默认 limit=5 时大部分结果会是 high/mid
2. 小结果集 guardrail（≤2 results 全 high，≤4 results 不出 low）是否过于宽松？

## Next Action

请 review 代码变更，特别关注 `rankToConfidence` 的阈值设计和 evidence.ts 接线正确性。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f163-phase-e/codex`
- Start Command: `pnpm review:start`
- Ports: 纯后端 API 变更，无需启动服务

## 自检证据

### Spec 合规
- AC-E1 ✅: `rankToConfidence` 存在 + 9 个单元测试
- AC-E2 ✅: evidence.ts:117 使用 `rankToConfidence(index, items.length)`
- AC-E3 ✅: EvidenceResult.authority 可选字段 + evidence.ts:120 传递
- AC-E4 ✅: authorityToConfidence 保留在 f163-types.ts:51，evidence.ts 不再 import

### 测试结果
```
pnpm test                              → 8704 passed, 0 failed ✅ (1 pre-existing skip)
pnpm lint                              → 0 errors ✅
pnpm biome check --diagnostic-level=error → 0 errors ✅
pnpm --filter @cat-cafe/api build      → exit 0 ✅
```

### 相关文档
- Feature: `docs/features/F163-memory-entropy-reduction.md` (Phase E AC added)
- Discussion: `docs/discussions/2026-04-19-f163-phase-e-confidence-redesign/README.md`
- Phase D (前驱): PR #1256

[宪宪/Opus-46🐾]
