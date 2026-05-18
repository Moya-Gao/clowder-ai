# Review Request: F206 Phase A — Settings Primitives + 4 Page Migration

Review-Target-ID: f206
Branch: feat/f206-settings-convergence

## What

Create 7 shared Settings primitives and migrate 4 high-customization page controllers to 0 raw Tailwind visual classes (AC-A6). +820/-611 across 17 files.

**Primitives** (`settings/primitives/`): SettingsSection, SettingsRow, SettingsCard, SettingsFilterTabs, SettingsStatusStrip, SettingsBreadcrumb, SettingsField.

**Migrated pages**:
- `config-viewer-tabs.tsx` (成员管理 + 系统配置): SettingsSection, SettingsField, SettingsStatusStrip, BubbleToggle extracted
- `HubAccountsTab.tsx` (账户与密钥): SettingsBreadcrumb, SettingsPageHeader, SettingsPrimaryButton, SettingsStatusStrip
- `SkillsContent.tsx` (Skill 管理): SettingsFilterTabs, SettingsStatusStrip + extracted SkillsFilterToolbar/SkillsEmptyState/SkillsSummaryFooter
- `HubEnvFilesTab.tsx` (环境与路径): Rewritten from 547→120 lines, all rendering extracted to EnvSubComponents.tsx

**Extracted sub-components**: BubbleToggle.tsx, SettingsPrimaryButton.tsx, EnvSubComponents.tsx, SkillsSubComponents additions.

## Why

铲屎官："人家的每个按钮的画风统一，我们的不统一"。12 Settings 页面各自发明交互模式。PR #1758 完成颜色 token 迁移，本 feat 解决结构层归一，完成后做全量 outbound sync。

CVO fast path: opus coding → codex review → opus-47 愿景守护，不走云端 review。

## Original Requirements

> "人家的每个按钮的画风统一，我们的不统一……到底为什么我们不统一做了那么多定制"
> "先归一再全量同步……不能5-7天太慢了，社区分叉更大更难合并了"
- 来源: F206 spec `docs/features/F206-settings-ui-convergence.md`，铲屎官 2026-05-18 讨论
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

**不重写复杂子组件**: HubMemberOverviewCard（拖拽排序+可用性切换+badge）和 HubAccountItem（折叠/展开+chips 编辑）保留原有渲染，不强塞 SettingsRow。原因：这些组件功能丰富，SettingsRow API 无法完全覆盖，硬塞会丢功能或让 SettingsRow 变成 god-component。归一目标在 page controller 层，sub-component 层在 Phase B 按需渐进。

**AC-A2/A3 partial**: 成员管理和账户页的 page controller 已 0 raw Tailwind，但未使用 spec 中指定的 SettingsRow/SettingsFilterTabs/SettingsCard 包装成员卡/账户行。这是"归一 ≠ 砍功能"原则下的实现判断，请 reviewer 决定是否需要补充。

## Architecture Ownership

Architecture cell: console-settings (frontend UI layer)
Map delta: none
Why: 只新增 primitives 子模块并重构 page controller 导入，不改变 settings 的路由/数据流/API 边界

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ

1. **AC-A2/A3 scope**: 成员卡和账户行保留现有 sub-component 而未用 SettingsRow 包装——这是否可接受，还是需要在 Phase A 补上？
2. **EnvSubComponents 体积**: 从 HubEnvFilesTab 提取出的 EnvSubComponents.tsx 约 398 行，包含所有渲染逻辑。是否需要进一步拆分？

### 价值 OQ

无

## Next Action

请 review 代码变更，特别关注：
1. 7 primitives 的 API 设计是否合理（粒度、props 命名）
2. AC-A2/A3 partial 是否可接受
3. 提取后的 sub-component 封装是否清晰

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f206/codex`
- Start Command: `pnpm review:start`
- Ports: reviewer 自行分配（禁止 3001/3002/3011/3012/4111）

## 自检证据

### Spec 合规

| AC | Status | Notes |
|----|--------|-------|
| AC-A1 | PASS | 7 primitives created, typed, barrel-exported |
| AC-A2 | PARTIAL | CatOverviewTab uses SettingsStatusStrip; member cards retain HubMemberOverviewCard (see Tradeoff) |
| AC-A3 | PARTIAL | HubAccountsTab uses Breadcrumb/PageHeader/PrimaryButton/StatusStrip; account items retain own rendering |
| AC-A4 | PASS | SkillsContent uses SettingsFilterTabs/SettingsStatusStrip + extracted filter/empty/footer |
| AC-A5 | PASS | SystemTab uses SettingsSection/SettingsField/BubbleToggle |
| AC-A6 | PASS | 0 banned raw Tailwind classes in all 4 page files (verified by grep) |
| AC-A7 | PASS | 3089 tests, pnpm check green, tsc clean, build OK |
| AC-A8 | DEFERRED | Before/after screenshots pending (will capture during review) |

### 测试结果

```
pnpm --filter @cat-cafe/web test  → 3089 passed, 0 failed
pnpm check                        → 0 errors (biome format + lint)
tsc --noEmit                       → clean
pnpm -r --if-present run build    → exit 0
```

### Artifact Hygiene
- Root media artifacts (worktree): none
- Root media artifacts (committed): none

### Fallback Layer Check
- `check-fallback-layers.mjs`: net +3 layers (UI component optional-prop defaults in SettingsRow). Not architectural fallback layers — standard React prop defaulting patterns.

### 相关文档

- Feature: `docs/features/F206-settings-ui-convergence.md`
- Related: F190, F199, F056, PR #1758
