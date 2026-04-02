---
doc_kind: review-request
created: 2026-04-02
---

# Review Request: F148 VG-1 — coverageMap.retrievalHints 填充实际 evidence recall 结果

Review-Target-ID: f148-vg1
Branch: fix/f148-retrieval-hints

## What

`route-helpers.ts` 中 `buildCoverageMap()` 的 `retrievalHints` 从硬编码 `[]` 改为填充实际数据：
- tombstone 的 retrievalHints（搜索命令提示）
- evidence recall 返回的 evidence titles

核心改动：将 evidence recall（step 4）移到 coverage map 构建（step 3.8）之前，并提取 evidence titles 传入。

## Why

愿景守护发现的 bug（VG-1）：briefing 卡片"证据 N 条"永远显示 0，因为 `retrievalHints` 在 evidence recall 执行前就构建了且硬编码为空。铲屎官需要卡片数字说真话。

## Original Requirements

> "让 Landy 在 @ 完猫后的那几秒，立即看见系统给这只猫喂了什么、略过了什么"
- 来源：F148 spec `docs/features/F148-hierarchical-context-transport.md`
- 愿景守护来源：缅因猫 GPT-5.4 独立评估（2026-04-02）
- **请对照上面的摘录判断：卡片证据数字是否真实反映了系统行为**

## Tradeoff

直接传 evidence line 全文会让 coverage map JSON 膨胀。改为只提取 title（regex match `[Evidence: title]`），保持 coverage map 紧凑。

## Open Questions

1. 是否应该在 `format-briefing.ts` 的折叠态区分"tombstone hints"和"evidence titles"？当前统一计数为"证据 N 条"。

## Next Action

请 review 这个 bug fix，确认 evidence recall 结果正确传入 coverageMap。

## 自检证据

### Spec 合规

| # | 要求 | 状态 |
|---|------|------|
| VG-1 | briefing 卡片"证据 N 条"反映实际 evidence recall 命中数 | ✅ |
| VG-1 | 有对应测试验证 | ✅ |

### 测试结果

```
node --test packages/api/test/f148-*.test.js  # 99 passed, 0 failed
pnpm lint                                      # 0 errors
pnpm check                                     # 0 errors
pnpm -r --if-present run build                 # exit 0
```

### 相关文档

- Feature: `docs/features/F148-hierarchical-context-transport.md` (VG-1)
- GitHub Issue: #916
