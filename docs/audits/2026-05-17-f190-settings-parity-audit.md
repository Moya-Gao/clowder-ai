---
title: F190 Settings Parity Audit
created: 2026-05-17
feature: F190
baseline:
  cat_cafe: 62a6af4bba20c012fe39882d07d992f5e356df98
  clowder_ai: 44ab1dcdf872fa236577d07420dfc2c9213abac5
scope: settings sections plus chat shell
---

# F190 Settings Parity Audit — content-level pass

> 背景：前一版 Phase F/G 审计把 Notify 判断成“基本一致”，但实测发现开源有通知偏好 UI、家里没有。这个文件重做一轮内容级对比：不是看 section 是否存在，而是看每个 section 的实际功能、交互、视觉和 outbound sync 风险。

## 审计基线

| 仓库 | HEAD | 说明 |
|---|---|---|
| `cat-cafe` | `62a6af4b` | main，已含 PR #1720 Phase F/F190 learnable patterns |
| `clowder-ai` | `44ab1dcd` | main，最新社区前端参考 |

两仓 `settings-nav-config.ts` 都是 12 个 section：`members` / `accounts` / `im` / `skills` / `mcp` / `plugins` / `marketplace` / `voice` / `system` / `rules` / `notify` / `ops`。

## 总结

**同步前不能再按“家里已完全领先”处理。** Phase G 的 token 体系已收敛，但 settings 内容层还有 4 个需要明确处理的 outbound sync 风险：

1. **Notify 是最大漏项**：开源有 5 类通知偏好、双通道卡片、默认收起诊断；家里没有偏好控制，但家里有设备列表、测试回执、PWA 引导，必须合并而不是覆盖。
2. **Skills 是双路线分叉**：开源用 capability board 做 per-cat toggles / uninstall；家里用 skills registry 做 sync、conflict resolver、MCP dependency。同步前要合并能力，否则任何一边都会丢功能。
3. **Service lifecycle UI contract 不一致**：开源 `ServiceStatusPanel` 有 toggle/log polling/progress/安装状态；家里是较安全的 read/action list DTO。不能直接套文件，需要先统一 `/api/services` DTO 和支持面。
4. **Chat shell 视觉仍突兀**：家里对话区/输入区仍有 `cafe-surface`/纯白残留，开源用 console shell/card 背景更连贯；这不是功能风险，但会直接影响同步版本观感。

## Section 差异矩阵

| Section | 开源有我们没有 | 家里有开源没有 | 视觉差异 | 优先级 |
|---|---|---|---|---|
| `members` | 无关键功能缺口。开源 owner/member card 更直接用 `settingsResourceCardClass`。 | 完整成员 CRUD、默认猫选择、停用成员、拖拽排序；还有较完整的 co-creator/member 编辑链路。 | 家里部分成员概览仍有旧 `cafe-*`/toolbar 视觉痕迹，开源更接近 console-list-card。 | P3 visual only |
| `accounts` | 开源空态更完整；账号列表视觉更 console-card。 | 家里有 `normalizeBuiltinClientIds` / `resolveAccountActionId`，能处理内置 provider id 与动作 id 的差异，避免保存/删除错对象。 | 家里仍有说明文字和按钮色的旧风格；开源更轻。 | P3 visual only，保留家里 id 正规化 |
| `im` | 开源把权限配置和 WeCom credential validation 挂到同一个“保存配置”流，`HubPermissionsTab` 通过 ref 暂存后统一提交。 | 家里已补测试连接；权限配置可独立保存；secret write 使用 `/api/config/secrets`，保留 redacted placeholder 防写入和 F136 hot reload 路径。 | 家里 `HubPermissionsTab` 仍有较多旧按钮/蓝绿硬色；开源视觉更统一。 | P2：视觉归一可做；保存模型是 trade-off，不直接覆盖 |
| `skills` | **Capability board per-cat toggles / enable-disable / uninstall / project selector**。这是开源用户会用到的控制面。 | **Skill sync / conflict resolver / staleness / MCP dependency badges / SKILL.md preview**。这是家里独有的 registry 和冲突治理面。 | 两边都是 console card，但信息架构完全不同。 | **P1 sync blocker**：必须合并两套能力，不能单向覆盖 |
| `mcp` | 开源有 `SettingsPageHeader` 包住新增按钮，空态文案指向能力市场。 | 家里保留 `ProjectSelector`、error chip、`buildEditData`、`mcpSubInfo`，read-only 与 editable transport/env 信息更安全完整。 | 基本一致，家里略工程向。 | P3 copy polish；保留家里安全编辑模型 |
| `plugins` | 开源有 `PLUGIN_CATALOG` 视图，把 GitHub 作为 platform plugin，状态 badge 更像产品目录。 | 家里展示真实 `/api/services` 服务清单、endpoint、features、error，并保留 GitHub config panel。 | 家里服务卡仍有 `border-cafe bg-cafe-surface` 和 hardcoded emerald/rose；开源目录视觉更干净。 | P2：吸收 catalog shell，但保留真实服务诊断 |
| `marketplace` | 无 diff。 | 无 diff。 | 无 diff。 | None |
| `voice` | 开源 `VoiceSettingsPanel` 用 eyebrow + `console-list-card`，输入/按钮全面 console token；service panel 有更完整生命周期 UI。 | 家里功能项相同：自定义术语、内置词典、语言、Whisper prompt、reset；PR #1720 已加 voice service availability hook。 | 家里 voice settings 仍是旧 `border-cafe bg-cafe-surface-elevated/70`，显得比开源粗。 | P2 visual；service lifecycle 见 `system/plugins` contract |
| `system` | 开源环境变量按 `EnvCategoryGroup` 可折叠，显示即时/需重启/废弃状态，并统计 pending restart。 | 家里有 PageIntro、路径打开动作、redacted URL hint、明确重启提示、exclude connector categories；安全提示更直接。 | 家里 env rows 更重、更旧；开源更适合长列表扫描。 | P2：吸收折叠组 + pending restart，保留安全提示 |
| `rules` | 无关键功能缺口。 | 家里多 `HubGovernanceTab`、`BrakeSettingsPanel`、F203/L0 相关规则面。 | 家里信息更多，复杂度来自真实功能。 | Deliberate divergence，保留家里 |
| `notify` | **5 类通知偏好 checkbox（reply/permission/mention/schedule/signal）、localStorage 持久化、浏览器推送/应用内通知双卡片、诊断默认收起、console-list-card 布局。** | **设备订阅列表、投递回执 attempted/delivered/failed/removed、repair hints、iPhone PWA 引导、VAPID config。** | 家里诊断矩阵全部展开，且 `border-cafe`/slate/rose/blue hardcoded 色残留；开源普通用户视图更干净。 | **P0/P1 sync blocker**：必须补偏好 UI，并保留家里诊断能力 |
| `ops` | 无 diff。 | 无 diff。 | 无 diff。 | None |
| Chat shell / 对话区 | 开源 AppShell 接管 desktop ThreadSidebar，ChatContainer 只管 mobile overlay；对话输入区使用 `console-shell-bg`，bootcamp modal 使用 `console-card-bg`。 | 家里保留 desktop sidebar resize + localStorage 宽度；右侧 status/workspace/transcript 三态更多；ChatContainer 顶栏能力更多。 | 家里中间对话区/输入区仍显白，bootcamp modal 还有 `bg-white`；AppShell ownership 分散，左右栏和对话区底色割裂。 | **P1 visual shell**：先改背景/token；sidebar ownership 若改，必须保留 resize |

## 同步前建议

### 必须先收口

| # | 项 | 原因 | 处理建议 |
|---|---|---|---|
| A-1 | Notify preferences | 开源有、家里没有；全量同步出去会让社区用户失去通知分类控制。 | 在家里 `PushSettingsPanel` 增加 5 类偏好 + 双卡片 + 默认收起诊断；同时保留家里设备列表、投递回执、repair hints、PWA 引导。 |
| A-2 | Skills dual model | 两边各有关键能力，任何整文件覆盖都会丢功能。 | 在家里 SkillsContent 合并 capability board 控制面，保留 registry sync/conflict/dependency。 |
| A-3 | Chat shell background | CVO 已实测觉得“白色突兀”，这是同步版本第一眼观感。 | 对话主区、ChatInput、bootcamp modal 统一到 `console-shell-bg` / `console-card-bg` / `console-card-soft-bg`；不要动消息渲染链路。 |

### 不建议同步前硬做，但要标 known

| # | 项 | 理由 |
|---|---|---|
| B-1 | Service lifecycle toggle/log/progress | 开源 UI 依赖不同 `/api/services` DTO（`manifest/status/running`），家里当前 DTO 是 `healthy/unhealthy/not_configured`。先做 contract 设计，避免把 process control 伪装成已验证能力。 |
| B-2 | System env collapsible groups | 主要是长列表 UX，非功能缺口。 |
| B-3 | Plugins catalog shell | 是产品化外观，不是功能阻塞；可以和 service lifecycle 一起收。 |
| B-4 | IM permissions save model | 家里即时保存权限是可用方案；开源统一保存是另一种事务模型，不能只为一致改行为。 |
| B-5 | Voice settings card polish | 视觉改善，非功能阻塞。 |

### 明确不学 / 保留家里

- Settings mobile 响应式：家里领先，开源桌面限定不学。
- Resizable desktop sidebar：开源固定宽度不学；如果迁到 AppShell，也要带上 resize/persisted width。
- Rules/Governance/Brake：家里是多猫协作平台，不退回开源极简 rules。
- MCP 安全编辑：家里 read-only/editable/transport/env 信息更完整，不退回开源简化版。
- Notify 的诊断深度：开源普通用户界面更好，但家里的设备/投递/PWA/repair 信息必须保留，只是默认折叠。

## 证据索引

| 结论 | 主要文件 |
|---|---|
| Notify 偏好缺口 | `packages/web/src/components/PushSettingsPanel.tsx` vs `../clowder-ai/packages/web/src/components/PushSettingsPanel.tsx` |
| Skills 双路线分叉 | `packages/web/src/components/settings/SkillsContent.tsx` vs `../clowder-ai/packages/web/src/components/settings/SkillsContent.tsx` |
| Service lifecycle contract 不一致 | `packages/web/src/components/settings/ServiceStatusPanel.tsx` vs `../clowder-ai/packages/web/src/components/settings/ServiceStatusPanel.tsx` |
| Chat shell owner/background | `packages/web/src/components/AppShell.tsx`, `packages/web/src/components/ChatContainer.tsx` vs source 同名文件 |
| System env 折叠组 | `packages/web/src/components/HubEnvFilesTab.tsx` vs source 同名文件 |
| IM save model | `packages/web/src/components/HubConnectorConfigTab.tsx`, `packages/web/src/components/HubPermissionsTab.tsx` vs source 同名文件 |

## 结论

这轮审计推翻“Settings 已全部收口”的说法。**Phase G token 收敛是真的完成了，但 Settings 内容级 parity 仍有缺口。**

全量 outbound sync 前，至少要处理 Notify、Skills、Chat shell 三项；否则不是“把家里更好的版本同步出去”，而是会把社区当前已有的一部分 UX/功能覆盖掉。
