# Review Request: F098 Phase B — Evidence Panel dark + Connector themes

## What

1. **EvidencePanel + EvidenceCard** dark slate theme: owner-color CSS vars → slate-800/900 dark cards with high-contrast text and emerald/amber/slate confidence badges
2. **ConnectorBubble** 3 new themes: multi-mention-result (emerald), feishu (blue), telegram (sky)
3. Design spec alignment: feishu corrected from indigo→blue to match .pen wireframe `#DBEAFE`

## Why

铲屎官反馈 Evidence Panel 在深色背景上不可读（"你看你的证据地方的字，我是看不见的"），connector 消息缺乏视觉区分。Phase B 专注这两个视觉问题。

## Original Requirements（必填）

> "你看你的证据地方的字，我是看不见的。还有，你不觉得它超级突兀吗？跟你的其他的东西是不是一个设计感？"

- 来源：`docs/features/F098-callback-message-ux.md` L19
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 使用固定 slate 色系而非 CSS variable 方案：Evidence Panel 是跨猫共用组件，不应跟随单只猫的品种色。深色固定主题更通用。
- feishu 用 blue 而非 indigo：按设计稿 `#DBEAFE` 对齐，和 default connector 的 blue-gray 有细微色差但足够区分（default 用 blue-50/100，feishu 用 blue-100/200 + ring）。

## Open Questions

1. Evidence Panel 的 STATUS_CONFIG（draft/pending/archived badges）仍用 light-mode 颜色（gray-100/amber-100），Phase B 未改——是否需要一并适配？
2. Connector default theme 是否需要更新以配合新主题的视觉统一？

## Next Action

请 review 代码变更，重点看：
- slate 色系选择是否合理（对比度、层次感）
- 3 个 connector 主题的色系区分度
- 设计稿对齐度

## 自检证据

### Spec 合规

| AC | Status |
|----|--------|
| B1: Evidence Panel dark slate readable | ✅ EvidencePanel.tsx + EvidenceCard.tsx |
| B2: Connector themes (multi-mention/feishu/telegram) | ✅ ConnectorBubble.tsx |

### 设计稿对照

- `designs/f098-callback-message-ux.pen` frame `bhnGK` 逐项对照 ✅
- feishu 色系修正 indigo→blue ✅

### 测试结果

```
vitest run (F098 tests) → 9/9 pass ✅
vitest run (full suite) → 1105 pass, 25 fail (全部 pre-existing on main)
pnpm lint → 0 errors ✅
```

### 相关文档

- Feature: `docs/features/F098-callback-message-ux.md`
- Plan: `docs/plans/2026-03-12-f098-phase-b-evidence-connector.md`
- Design: `designs/f098-callback-message-ux.pen`
