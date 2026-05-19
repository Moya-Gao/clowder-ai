# Review Request: #723 P2/P3 Visual Normalization Batch

Review-Target-ID: 723-p2p3-visual-normalization
Branch: fix/723-p2p3-visual-normalization

## What

14 files, 5 commits — Chinese i18n for 8 English UI surfaces + CDS border/token normalization + density alignment.

| Commit | Scope |
|--------|-------|
| P2-1/P2-2 | ServiceStatusPanel + InstallPreviewModal → Chinese labels |
| P2-3 | SkillConflictBanner `bg-amber-600` → `bg-conn-amber-text` CDS token + 官方/我的 |
| P2-5 | SettingsStatusStrip + GithubConfigPanel + PushServiceConfig → CDS border tokens |
| P2-8 | MemoryNav (6 tabs) + SignalNav (2 tabs) → Chinese |
| P3-8/P3-11 | ServiceStatusPanel density + MCP modal Chinese placeholders |

## Why

Issue #723 P1 items merged in PR #1778. This batch covers the remaining P2 (9 items) + P3 (2 items) visual/i18n fixes. 铲屎官 directive: 都搞完之后再 full sync clowder-ai。

## Original Requirements

> P2 十项基本还没做：语音页中文化/开关、语音安装弹窗中文化、Skills 黄色调色/描述缺失、Settings nav 箭头、跨页边框滥用、字体碎片化、SettingsRow/Card 模式不一致、Memory/Signals/Ops 英文标签。P3 还剩 4 项：系统配置绿色 token/密度、成员页开关/卡片样式、账户页卡片/行一致性、MCP 弹窗中文/cafe 风格。
- 来源：#723 + 铲屎官 2026-05-19 消息
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

P2-6 (font fragmentation in modals) 和 P2-7 (card pattern in modals) deferred — modal 内部 deep refactor，用户极少见到的 UI 面。P3-9 (members toggle) 和 P3-10 (accounts card) 验证后已使用正确 primitives（SettingsBadge, SettingsRow），无需改动。

## Architecture Ownership

Architecture cell: web/settings
Map delta: none
Why: 纯 UI 字符串 / CSS token 替换，无架构变化

## Open Questions

### 技术 OQ（给 reviewer）
1. SkillConflictBanner 用 `bg-conn-amber-text` 做实心按钮背景色 — 视觉上 OK？这是 CDS 里最接近原 `amber-600` 的 token。
2. PushServiceConfig inputStyle 从 inline `style={}` 改为 `className={inputClass}` — 确认无视觉 regression。

### 价值 OQ
无

## Next Action

请 review 14 个文件的改动，重点关注：
1. 中文翻译准确性（是否有更自然的措辞）
2. CDS token 替换后的视觉一致性
3. 是否有遗漏的英文残留

## Review Sandbox

- Path: `/tmp/cat-cafe-review/723-p2p3-visual-normalization/codex`
- Start Command: `pnpm review:start`
- Ports: 按 review:start 自动分配（3201/3202 起步）

## 自检证据

### Spec 合规
- P2-1 ServiceStatusPanel: Install/Start/Stop → 安装/启动/停止 ✅
- P2-2 InstallPreviewModal: 8 English strings → Chinese ✅
- P2-3 SkillConflictBanner: amber-600 → conn-amber-text + 官方/我的 ✅
- P2-5 Borders: 3 files, 7 violations → CDS tokens ✅
- P2-8a MemoryNav: 6 tabs → Chinese ✅
- P2-8b SignalNav: 2 tabs → Chinese ✅
- P2-13 Settings nav arrows: ALREADY FIXED (pre-existing) ✅
- P3-8 Density: paddingBlock 1rem → 0.75rem ✅
- P3-11 MCP modal: 3 placeholders → Chinese ✅
- P2-6/P2-7: Deferred (modal font/card deep refactor)
- P3-9/P3-10: Already correct (verified)

### 测试结果
pnpm --filter @cat-cafe/web test       # 3041 passed, 0 failed
pnpm biome check packages/web/src/     # 0 errors

### 相关文档
- Plan: `docs/plans/2026-05-19-723-p2p3-visual-normalization.md`
- BACKLOG: #723
