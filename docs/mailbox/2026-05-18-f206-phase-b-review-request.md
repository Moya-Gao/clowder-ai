# Review Request: F206 Phase B — 8 page migrations + enforcement

Review-Target-ID: f206
Branch: feat/f206-phase-b

## What

8 个低定制 Settings 页面迁移到 Settings Primitives + 编译期 enforcement 脚本 + 12 页截图。

核心变更：
1. **8 页面迁移**（PluginsContent, McpManageContent, GithubConfigPanel, PushServiceConfig, RulesPromptsContent, OpsContent, SettingsContent, ServiceStatusPanel）：raw Tailwind atomic classes → SettingsText/SettingsBadge/SettingsCard/SettingsSection/SettingsPrimaryButton/SettingsSecondaryButton/SettingsStatusStrip/SettingsFilterTabs/SettingsEmptyState + inline style 逃生口
2. **新增 SettingsSecondaryButton primitive** + SettingsSection badge prop
3. **check-settings-primitives.mjs**：扫描 settings 页面层 className 中的 restricted Tailwind classes（bg-*/text-*/border-*/rounded-*/px-*/py-*），已接入 `pnpm check` 管线
4. **12 页截图**：docs/evidence/f206-phase-b/

## Why

铲屎官要求快速归一后 outbound sync（"先归一再全量同步……不能5-7天太慢了"）。Phase A 完成了 4 个高定制页面 + 7 primitives；Phase B 覆盖剩余 8 个低定制页面 + 编译期防回归。

## Original Requirements（必填）

> "人家的每个按钮的画风统一，我们的不统一……到底为什么我们不统一做了那么多定制"
> "先归一再全量同步……不能5-7天太慢了，社区分叉更大更难合并了"
> "猫猫你继续走sop！你写完砚砚review 然后就合入"

- 来源：`docs/features/F206-settings-ui-convergence.md` lines 16-17 + CVO directive
- CVO fast path: opus coding / codex local review / opus-47 愿景守护。无云端 review。
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **Inline style 逃生口** vs 新增更多 primitives：几何属性（borderRadius, padding, backgroundColor for one-off containers）用 inline style 而非新增 SettingsModalOverlay 等。合理——这些容器有 1-2 处用法，不值得抽 primitive。
- **Exempt list** vs 全量 enforcement：9 个未迁移文件（modals/nav/shell/conflict-banner/capability-settings-ui）暂豁免，逐步迁移后移除。
- **SettingsSecondaryButton 新增** vs 复用现有 badge-as-button：PushServiceConfig 的"生成 VAPID 密钥"需要明确的 secondary action 按钮，SettingsBadge as="button" 语义不对。

## Architecture Ownership（必填）

Architecture cell: settings-primitives
Map delta: none
Why: 扩展现有 primitives 库 + 消费侧迁移，无新 cell/boundary 变化

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **SettingsSecondaryButton 样式**：用了 `rounded-full` + `border-[var(--console-border-soft)]`，与 SettingsPrimaryButton 的 `rounded-full bg-blue-600` 配对。视觉上是否匹配？
2. **Exempt list 粒度**：当前按文件名豁免（9 个文件）。是否需要更细粒度（per-className allowlist）？
3. **RulesPromptsContent modal**：RulePreviewModal 全部改为 inline style（overlay/dialog/icon/content），是否过度？

### 价值 OQ（给 CVO，如有）

无。

## Next Action

请 review 以下文件的迁移正确性 + 视觉一致性：
1. 8 个页面组件的 primitives 使用
2. check-settings-primitives.mjs enforcement 逻辑
3. 12 页截图（docs/evidence/f206-phase-b/）

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f206/codex`
- Start Command: `pnpm review:start`
- Ports: web=3201, api=3202

## 自检证据

### Spec 合规

| AC | 状态 | 证据 |
|----|------|------|
| AC-B1 | PASS | 8 files migrated: PluginsContent, McpManageContent, GithubConfigPanel, PushServiceConfig, RulesPromptsContent, OpsContent, SettingsContent, ServiceStatusPanel |
| AC-B2 | PASS | `node scripts/check-settings-primitives.mjs` → "PASS: 15 settings files, 0 restricted classes (9 files exempt)" |
| AC-B3 | PASS | 12 screenshots in docs/evidence/f206-phase-b/ |
| AC-B4 | PASS | 0 raw atomic classes in enforced page layer; enforcement wired into `pnpm check` |

### 测试结果

```
pnpm --filter @cat-cafe/web test  # 407 passed, 6 failed (pre-existing devDep issues, not settings-related)
                                  # 3017 individual tests passed
node scripts/check-settings-primitives.mjs  # PASS: 15 files, 0 restricted classes
```

### 根目录工件闸门

```
git status --short | rg root artifacts  → CLEAN
git diff --name-only origin/main...HEAD | rg root artifacts  → CLEAN
```

### 相关文档

- Feature: `docs/features/F206-settings-ui-convergence.md`
- Phase A PR: #1765 (merged)
