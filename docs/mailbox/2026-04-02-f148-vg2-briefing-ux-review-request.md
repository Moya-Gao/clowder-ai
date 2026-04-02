---
feature_ids: [F148]
doc_kind: review-request
created: 2026-04-02
---

# Review Request: F148 VG-2 — Collapsible Briefing Card with Source Label

Review-Target-ID: f148-vg2
Branch: fix/f148-vg2-briefing-ux

## What

Briefing card UX upgrade: source label + default collapsed + evidence hints in expanded view.

4 files changed (+98 -2):
- **`format-briefing.ts`**: Added `证据召回` section to bodyMarkdown when `retrievalHints` present
- **`BriefingCard.tsx`** (NEW): Collapsible card — SVG source icon + "Context Briefing" label, default collapsed showing title only, expand to see bodyMarkdown + fields
- **`ChatMessage.tsx`**: Routes `origin=briefing` to `BriefingCard` instead of generic `RichBlocks`
- **`f148-context-briefing.test.js`**: 2 new tests for evidence hint rendering (11/11 pass)

## Why

Vision Guard gap #917 from Phase E review. 铲屎官 runtime 实测后反馈三点 UX 问题：消息来源不明、无法折叠、展开态缺少证据。

## Original Requirements

> "最好和飞书 IM那些一样标明这个消息的来源是什么"
> "这个最好是可以折叠的"
> "记得用svg禁止使用丑丑的 emoji"
- 来源：铲屎官 runtime 实测反馈（2026-04-02 00:23）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 选择 `CafeIcon("search")` 作为来源图标 — 搜索镜暗示"上下文检索"语义，比 `architecture` 更直觉
- 默认 collapsed 牺牲了一点信息可见性，但减少 chat 流中的视觉噪音（飞书同类设计）

## Open Questions

1. SVG chevron 是 inline 而非 CafeIcon — CafeIcons 里没有 chevron-down，是否需要补入？
2. `sm:grid-cols-3` fields 布局在移动端是否合理？

## Next Action

请 review 代码 + UX 合理性。

## 自检证据

### Spec 合规
- 来源标签：CafeIcon SVG + "Context Briefing" uppercase label
- 默认折叠：`useState(false)`，click toggle
- 展开态包含 bodyMarkdown（含证据召回）+ fields
- 零 emoji，全 SVG

### 测试结果
```
node --test f148-context-briefing.test.js  # 11/11 pass, 0 fail
pnpm lint                                  # 0 errors
pnpm check                                 # 0 errors
pnpm -r --if-present run build             # exit 0
```

### 相关文档
- Feature: `docs/features/F148-hierarchical-context-transport.md` (Vision Guard Gaps section)
- Issue: https://github.com/zts212653/cat-cafe/issues/917
