---
feature_ids: [F160]
related_features: [F079, F109, F139, F157]
topics: [notification, chat, scheduler, connector, ux]
doc_kind: spec
created: 2026-04-13
updated: 2026-04-13
---

# F160: Unified Notification & Dialogue Contract — 聊天通知与对话形态统一契约

> **Status**: spec | **Owner**: Maine Coon | **Priority**: P1

## Why

team lead 连续指出当前聊天里的“通知”和“对话”边界是混的：

> "这里我理解重点在于没有统一的系统通知的样式还有设计"
> "哪些内容只是作为一个系统通知应该是固定的样式"
> "定时任务本身的内容不用出现或者说需要 agent 通过 post message 来通知用户"
> "github 的通知当前好像不是和正常对话一样都是左对齐的吧"
> "外部机器人比如飞书和微信的消息通知，我理解应该和我们的 agent 回复形态是差不多的"

当前问题不是单点样式，而是缺少统一契约：

- scheduler lifecycle 通知、raw trigger、agent 真正回复都可能混在同一条聊天时间线里
- “怎么触发” 与 “最终怎么呈现” 容易被错误绑定；例如 GitHub 消息虽然可以由 scheduler 唤醒，但不应因此长成 scheduler notice
- 部分“系统通知”会重新进入 agent context，形成语义污染
- connector bubble、system message、toast、receipt、agent 对话分别在不同 feature 中各自演化，没有统一入口
- 新需求（投票结果、GitHub 通知、飞书 receipt、scheduler 提醒）都在重复回答同一个问题：这条内容到底是“通知”、"对话"、还是“内部触发”？

F160 的目标不是再做一套局部样式，而是定义一份统一 contract，作为后续所有通知/对话设计和实现的唯一入口。

## What

### Phase A: Notification/Dialog Audit + Contract

建立统一审计表，梳理当前聊天内所有“通知/对话/触发”形态，并将其拆成 **3 个用户可见层** 与 **2 个辅助机制**。

#### Visible Tiers

- `agent_message`
  - 猫与用户的真实对话内容
  - 真正提醒正文如果需要“说人话”，默认落这一层
- `external_message`
  - 外部接入消息，如飞书、微信、GitHub review / CI
  - 与 `agent_message` 共用左侧消息轨道与 message shell，但通过 connector avatar / label / accent 区分，不冒充猫
- `system_notice`
  - 系统状态提醒
  - 居中或通栏 `notice-bar`
  - 定时任务 lifecycle 是其子类，不再发明独立气泡形态

#### Auxiliary Mechanisms

- `hidden_trigger`
  - 调度或系统内部触发
  - 不直接作为用户可见正文
- `toast_or_banner`
  - 非时间线内的临时反馈
  - 不是真相源

同时定义三件套 contract：

- `deliveryMode`: `system_notice_only` / `direct_delivery` / `agent_triggered`
- `lifecyclePolicy`: `register` / `pause` / `resume` / `delete` / `success` / `failure` -> `silent` / `meta_notice` / `full_notice`
- `timelineVisibility`: `visible_timeline` / `ui_only` / `hidden`

并补充一条总原则：

- **Trigger ≠ Presentation**：消息由什么机制触发，与它最终落成 `agent_message` / `external_message` / `system_notice` 是两套正交维度

### Phase B: Scheduler Template Semantics

把“不是所有模板都该 hidden_trigger”明确写成策略，而不是口头约定：

- `reminder` 默认 `agent_triggered`
- `web-digest` 允许 hybrid：普通抓取 `direct_delivery`，JS/browser 路径 `agent_triggered`
- `repo-activity` 默认 `direct_delivery`

并把 lifecycle policy 提升为全局默认 + 模板 override：

- `once` 任务默认 `success/delete` 静默
- `failure` 永远可见
- `register/resume/pause/delete` 默认走弱存在感 `system_notice`

补充 scheduler 的渲染边界：

- scheduler 不是独立用户可见 tier，它只能落成 `system_notice` 或 `agent_message`
- scheduler lifecycle 默认走 `system_notice`
- 真正提醒正文默认走 `agent_message`
- `system_notice` 内部可通过前缀、图标、浅背景色区分 scheduler 与其他系统状态
- 即便某条 GitHub / repo 类消息是 scheduler 唤醒后投递的，只要语义属于外部接入，最终仍应呈现为 `external_message`

### Phase C: Unified Chat Rendering Rules

为前端统一定义通知与对话的呈现边界：

- `agent_message` 与 `external_message` 共用左侧消息轨道
- `external_message` 不再使用居中漂浮卡片语义
- `system_notice` 使用统一 `notice-bar` 骨架，不带头像，不抢主对话
- `hidden_trigger` 不进入聊天正文，不进入上下文拼接
- `toast/banner` 只承担即时反馈，不替代时间线真相源
- 触发来源（scheduler / webhook / connector inbox / cat callback）不能直接决定 UI 形态；UI 形态只由最终语义决定

视觉和设计系统约束：

- 外部接入视觉回贴现有 `connector` token，而不是新造一套冷白蓝 SaaS 风格
- 系统通知回贴现有 `cafe` 语义 token
- 猫的 persona token 只用于 `agent_message`

### Phase D: Existing Feature Refresh

把现有局部 feature 统一挂到 F160：

- F079 投票结果 connector bubble
- F109 message actions 的 toast / revision 通知
- F139 scheduler lifecycle / template behavior
- F157 飞书 receipt ack

后续凡涉及聊天里的通知/对话新设计，都先回指 F160，再做局部 feature。

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | 统一整理聊天里的各类通知和对话形式 | AC-A1, AC-D1 | spec review | [ ] |
| R2 | 固定系统通知样式，降低存在感但可感知 | AC-C1 | design review / screenshot | [ ] |
| R3 | 区分 system notice、真正对话、hidden trigger | AC-A2, AC-B1 | spec review | [ ] |
| R4 | 不是所有 scheduler 模板都走 hidden trigger | AC-B2 | spec review | [ ] |
| R5 | scheduler raw trigger 不应以普通对话方式污染用户与 agent 语义 | AC-B3 | code review / test | [ ] |
| R6 | 后续所有通知/对话设计都有统一入口 | AC-D2 | feature link audit | [ ] |
| R7 | GitHub / 飞书 / 微信等外部接入与正常对话共用左侧消息轨道 | AC-C2 | design review / screenshot | [ ] |
| R8 | 定时任务与系统通知形态接近，但可通过前缀 / 图标 / 浅背景区分 | AC-C1, AC-C3 | design review / screenshot | [ ] |
| R9 | 触发机制与最终呈现解耦；GitHub 消息即便由 scheduler 触发，也不自动变成 scheduler notice | AC-A4, AC-B4, AC-C2 | spec review / code review | [ ] |

### 覆盖检查

- [ ] 每个需求点都能映射到至少一个 AC
- [ ] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求→证据映射表（若适用）

## Acceptance Criteria

### Phase A（Audit + Contract）

- [ ] AC-A1: 形成一份当前聊天通知/对话形态总表，覆盖 scheduler / connector / toast / system message / agent dialogue
- [ ] AC-A2: F160 明确定义 `deliveryMode`、`lifecyclePolicy`、`timelineVisibility` 三件套 contract
- [ ] AC-A3: 明确定义 `agent_message`、`external_message`、`system_notice`、`hidden_trigger`、`toast_or_banner` 的语义边界
- [ ] AC-A4: 明确 Trigger 与 Presentation 解耦，不能用触发来源直接推导 UI tier

### Phase B（Scheduler Semantics）

- [ ] AC-B1: 当前 3 个 scheduler template 完成语义归类：`reminder` / `web-digest` / `repo-activity`
- [ ] AC-B2: 文档明确“模板并非一律 hidden_trigger”，而是按 `deliveryMode` 决定
- [ ] AC-B3: scheduler lifecycle / hidden trigger / user-facing reminder 的上下文可见性规则明确，默认不污染 agent context
- [ ] AC-B4: 至少一个跨域样例被明确写入文档：`scheduler-triggered GitHub message -> external_message`

### Phase C（Rendering Rules + Design System）

- [ ] AC-C1: 形成统一的 `system_notice` 视觉规范，scheduler 与普通系统状态共用 `notice-bar` 骨架
- [ ] AC-C2: `external_message` 与 `agent_message` 共用左侧消息轨道，身份差异由 avatar / label / accent 表达
- [ ] AC-C3: 形成给设计的 brief，要求视觉稿回贴 `cafe` / `connector` / persona token，不接受冷白蓝新体系

### Phase D（Unified Entry）

- [ ] AC-D1: F079 / F109 / F139 / F157 在 F160 中完成挂接与范围说明
- [ ] AC-D2: 后续新增通知/对话相关 feature 需以 F160 为统一入口或 related feature

## Dependencies

- **Evolved from**: —（新建 umbrella feature，不挂靠单一旧 feature）
- **Blocked by**: —（spec 可先行）
- **Related**: F079（投票结果 connector bubble）
- **Related**: F109（message actions toast / revision 通知）
- **Related**: F139（scheduler 模板与 lifecycle）
- **Related**: F157（飞书 receipt / 非撤回式即时反馈）

## Risk

| 风险 | 缓解 |
|------|------|
| scope 过大，变成“重做整个聊天系统” | F160 只定义 contract、审计入口和 lane 边界；局部实现仍落到各相关 feature phase |
| 把所有通知强行归一，抹平真正需要差异化的 connector UX | `external_message` 与 `system_notice` 分层；外部接入共享 message shell 但保留 connector 身份 |
| 只做视觉统一，没解决上下文污染 | AC-B3 明确要求语义/上下文规则，不接受纯 UI 方案 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | `system_notice` 是否需要出现在导出/搜索结果中，还是仅保留在线时间线？ | ⬜ 未定 |
| OQ-2 | `direct_delivery` 是否允许“系统借用 agent persona 发言”，如果允许，消息上需要保留怎样的元数据提示？ | ⬜ 未定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 新建 F160 作为统一入口，而不是把问题硬塞进 F139 | 当前问题跨 scheduler、toast、connector、receipt、agent dialogue，多 feature 横切 | 2026-04-13 |
| KD-2 | 契约以 `deliveryMode + lifecyclePolicy + timelineVisibility` 三件套为核心 | 样式、语义、上下文可见性必须同时建模，不能只谈颜色 | 2026-04-13 |
| KD-3 | scheduler 模板不做“一刀切 hidden_trigger” | `reminder`、`web-digest`、`repo-activity` 的用户可见语义本来就不同 | 2026-04-13 |
| KD-4 | 用户可见内容收敛为三层：`agent_message` / `external_message` / `system_notice` | 这三层覆盖真实对话、外部接入和系统状态；`hidden_trigger` / `toast` 退回辅助机制 | 2026-04-13 |
| KD-5 | Trigger 与 Presentation 解耦 | GitHub 消息可以由 scheduler 触发，但最终仍应按 `external_message` 呈现，而不是因触发方式变成 scheduler notice | 2026-04-13 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-13 | Kickoff F160，建立聊天通知与对话统一契约入口 |
| 2026-04-13 | 收敛“三层可见体系 + 两类辅助机制”，并同步 design-system |

## Review Gate

- Phase A-C: 先完成 contract + audit + design-system，再进入具体实现

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F079-voting-system.md` | 投票结果 connector bubble 先例 |
| **Feature** | `docs/features/F109-message-actions-overhaul.md` | toast / revision 通知先例 |
| **Feature** | `docs/features/F139-unified-schedule-abstraction.md` | scheduler 模板与 lifecycle 现状 |
| **Feature** | `docs/features/F157-feishu-receipt-ack.md` | 即时反馈/receipt 先例 |
| **Design** | `docs/design-system.md` | F160 对应的统一设计系统约束 |
