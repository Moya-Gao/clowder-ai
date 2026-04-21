---
feature_ids: [F148]
topics: [briefing-card, navigation, collapsed-view]
doc_kind: review-request
created: 2026-04-20
---

# Review Request: F148 navigation-first briefing card

Review-Target-ID: f148-briefing-card
Branch: feat/f148-briefing-card

## What

Briefing card 折叠态从覆盖率统计（看到/省略/锚点）改为导航信息（传球/真相源/下一步），让铲屎官第一眼看到该看哪、下一步做什么。

核心变更：
- **format-briefing.ts**: 新增 4 个纯函数（formatBatonField/formatSourceField/formatNextStepField/buildNavigationTitle），card title 和 fields 从 coverage 改为 navigation
- **BriefingCard.tsx**: fields 从展开态移到折叠态，always visible
- **f148-briefing-card.test.js**: 14 个新测试覆盖所有 field 组合 + fail-closed 路径
- **f148-context-briefing.test.js**: 3 个旧测试适配新 field 结构

## Why

GPT-5.4 做 Phase H 用户体感反馈：工程 80 分/体感 45 分。铲屎官体验不够"第一眼"。三猫 + 铲屎官收敛决定：一个概念（Context Briefing Card）、两个视图（猫看 nav header、人看 UI card），不新建第二概念。

## Original Requirements（必填）
> 铲屎官（2026-04-20）："我在想你们这个是不是得和原本148做的真相卡放一起啊？别搞出两个概念？"
> 铲屎官（2026-04-20）："来吧那我们先做一下？把这个前端的小特性做出来方便我们人猫共同后续优化148？"
- 来源：当前 thread 对话历史（2026-04-20 13:52 + 14:05）
- 收敛决策已记录：`docs/features/F148-hierarchical-context-transport.md` (commit `b23dc4683`)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 放弃了 `formatContextBriefing` 的 summary 也同步改为 navigation 格式——该函数在内部还被其他地方引用做 coverage 统计，保持不变避免波及
- 折叠态只取 rankedSources[0]（top-1）做"真相源"和"下一步"，不展示完整列表——collapsed view 追求极简

## Open Questions

1. **BriefingCard field 样式**：当前用 blue label + secondary value，没有设计稿。是否需要调整视觉层级？
2. **"下一步" 文案**：有真相源时显示 `先看 {label}`，无时显示 `搜索 search_evidence(...)`。这个文案对铲屎官足够直观吗？

## Next Action

请 review 代码变更，重点关注：
- field 数据是否覆盖了铲屎官需要的"第一眼"信息
- fail-closed 路径（无 baton / 无 rankedSources / 无 searchSuggestions）是否正确

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f148-briefing-card/codex`
- Start Command: `pnpm review:start`
- Ports: 按 review:start 自动分配（禁止 3001/3002/3011/3012/4111）

## 自检证据

### Spec 合规
- 一个概念两个视图 ✅
- 折叠态 3 项（传球/真相源/下一步）✅
- Fail-closed: 未定位 + 搜索建议 ✅
- 展开态保留完整详情 ✅
- 向后兼容 bodyMarkdown ✅

### 测试结果
pnpm --filter @cat-cafe/api test → 8922 passed, 0 failed, 1 skipped ✅
pnpm lint → 0 errors ✅
pnpm biome check → 0 errors ✅
新增测试: 14 pass / 0 fail ✅

### 相关文档
- Feature: `docs/features/F148-hierarchical-context-transport.md`
- 收敛决策: commit `b23dc4683` (2026-04-20 Briefing Card 概念收敛)
