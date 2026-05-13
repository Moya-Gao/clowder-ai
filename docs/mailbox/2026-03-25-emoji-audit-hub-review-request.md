---
feature_ids: []
topics: [emoji, hub, settings, svg]
doc_kind: review-request
created: 2026-03-25
---

# Review Request: Hub/Settings Emoji Cleanup

## What
Replace ~35 user-visible emoji in Hub/Settings UI with inline SVG icons and CSS-styled text. 10 files changed (7 components + 3 tests), 116 insertions, 38 deletions.

## Why
铲屎官审计后决定：Hub/Settings 页面的 emoji 与"扁平、简洁、苹果风"设计语言不一致，跨平台渲染差异大。只修高优先（用户可见的 Hub/Settings），中低优先靠后。

## Original Requirements
> "其他地方别用emoji了，其他emoji都很丑"
> "只修高优先（Hub/Settings 的 ~40 处）→ 换成 SVG/CSS styled 组件"
> "扁平？简洁？苹果？那个类型的"
- 来源：本线程对话，铲屎官直接指示
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 使用 inline SVG 而非外部 SVG 文件/图标库：避免引入新依赖，SVG 体积小（单个 < 200 bytes）
- Leaderboard 标题去除装饰 emoji 而非替换为 SVG：标题本身已有足够区分度，不需要额外图标
- 保留 🐾 在 "CVO 能力等级" 标题中：铲屎官明确批准的品牌 emoji

## Open Questions
1. SVG icon 风格（Heroicons outline/24px）是否与现有 UI 协调？
2. HubPermissionsTab 的 numbered circles (1/2/3) 是否比原来的 ❶❷❸ 更易读？
3. hub-cat-editor.sections.tsx 的 cat SVG fallback avatar 是否合适？

## Next Action
请 review 代码质量 + 视觉一致性，放行后走 merge gate。

Review-Target-ID: emoji-audit-hub
Branch: feat/emoji-audit-hub

## 自检证据

### Spec 合规
- 7 个 Hub/Settings 组件文件清除了全部目标 emoji
- 3 个测试文件更新断言匹配新文本
- 🐾 品牌 emoji 保留在 CVO 能力等级标题

### 测试结果
```
pnpm --filter @cat-cafe/web test  → 240 files, 1697 tests, 0 failed
pnpm --filter @cat-cafe/shared test → passed
pnpm tsc --noEmit                 → 0 errors
pnpm lint                         → 0 errors
pnpm check                        → 52/52 pass
pnpm -r --if-present run build    → exit 0
pnpm biome check [7 files]        → 19 warnings (pre-existing), 0 new
```

### 相关文档
- Audit report: 本线程之前的全面 emoji 审计报告
- Previous: PR #716 (F056 connector icons, merged)
