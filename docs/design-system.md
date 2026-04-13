---
feature_ids: [F160]
topics: [design, system, notification, chat]
doc_kind: note
created: 2026-02-26
updated: 2026-04-13
---

# Cat Café Design System

> **Version**: 1.1.0
> **Maintainer**: Gemini (Siamese)
> **Last Updated**: 2026-04-13

## 1. Brand Identity

Cat Café 的界面应保持 `cozy / warm / collaborative`，像一间有猫、有木头、有阳光的工作室，而不是通用 SaaS 白板。

### Core Values

- **Warmth**: 优先使用 `cafe` 语义 token，避免冷白、冷灰、默认 Tailwind 蓝白灰直接入场。
- **Clarity**: 语义层级靠布局和组件职责区分，不靠纯颜色硬切。
- **Personality**: 猫的 persona 只用于真实对话层；系统通知和外部接入不应冒充猫。

## 2. Source Of Truth

视觉 token 以 [globals.css](/Users/lang/workspace/github/clowder-ai/packages/web/src/app/globals.css) 为准，而不是散落的静态色卡。

### Core Tokens

| Token | Value | Usage |
|------|------|------|
| `--cafe-surface` | `#fdf8f3` | 主背景 / 主气泡底色 |
| `--cafe-surface-elevated` | `#f5ede3` | 弱提示 / 次级面 |
| `--cafe-text` | `#1e1e24` | 主文本 |
| `--cafe-text-secondary` | `#666666` | 次级文本 |
| `--cafe-text-muted` | `#888888` | 弱说明 |
| `--cafe-border` | `#e0d5c7` | 常规边框 |
| `--cafe-border-subtle` | `#ebe3d9` | 弱边框 |

### Persona Tokens

真实猫消息使用 persona token：

- `--color-opus-*`
- `--color-codex-*`
- `--color-gemini-*`
- `--color-kimi-*`
- `--color-dare-*`

### Connector Tokens

外部接入消息使用 `--conn-*` token 体系，例如：

- `--conn-slate-*` for GitHub review / CI
- `--conn-amber-*` for schedule / warning-like connector states
- `--conn-green-*` / `--conn-indigo-*` / `--conn-violet-*` for chat connectors

## 3. Conversation Architecture (F160)

F160 将聊天里的内容分成 **3 个可见层** 和 **2 个辅助机制**。不要再把 toast、hidden trigger 当成第四种消息。

总原则：

- **Trigger ≠ Presentation**。消息是由 scheduler、webhook、connector inbox 还是 cat callback 触发，与它最终长成哪一种 UI 是解耦的。

### Visible Tiers

| Tier | Semantic Role | Layout Rule | Visual Rule |
|------|---------------|-------------|-------------|
| `agent_message` | 猫与用户的真实对话；提醒正文如需“说人话”落这里 | 左侧消息轨道，保留头像 + bubble | 使用 persona token，保持当前 breed/persona 差异 |
| `external_message` | 飞书 / 微信 / GitHub / 其他 connector 的外部接入消息 | 与 `agent_message` 共用左侧消息轨道和 message shell | 更换为 connector avatar / label / accent，不冒充猫 |
| `system_notice` | 系统状态提醒；scheduler lifecycle 属于其子类 | 居中或通栏的 `notice-bar`，不使用头像 | 弱存在感；通过前缀 / 图标 / 浅背景区分具体分支 |

### Auxiliary Mechanisms

| Mechanism | Role | Rule |
|-----------|------|------|
| `ephemeral_toast` | 临时成功/失败反馈 | 不进入时间线真相源，不替代消息 |
| `hidden_trigger` | 系统内部调度/唤醒 | 不渲染成聊天正文，不进入 agent context |

## 4. Component Mapping

| Component | Maps To | Notes |
|-----------|---------|-------|
| `AgentDialogueBubble` | `agent_message` | 继续保留猫 persona 差异化边角与配色 |
| `ExternalMessageBubble` | `external_message` | 与 agent 共享左侧轨道；区别靠 connector 身份而不是对齐方式 |
| `SystemNoticeBar` | `system_notice` | 默认浅底、弱字重、弱边框或无边框 |
| `EphemeralToast` | `ephemeral_toast` | 悬浮反馈；可深色，但仍需服从 cafe 氛围 |

## 5. Scheduler Notice Rules

定时任务不是独立消息物种。它只有两种可见落点：

- `system_notice`
  - 用于注册 / 暂停 / 恢复 / 删除 / 周期任务本次完成
  - 应与其他系统通知样式接近
  - 通过前缀、图标、浅背景色做轻区分
- `agent_message`
  - 用于真正提醒正文
  - 不再直接展示 raw `[定时任务] xxx`

### Scheduler Styling Guardrails

- 与普通 `system_notice` 保持同一种 `notice-bar` 骨架
- 区分手段只允许落在：
  - 前缀
  - 图标
  - 浅背景色 / 轻微 accent
- 不允许为 scheduler 单独发明一种居中大卡片或拟人 bubble

## 6. External Integration Rules

飞书、微信、GitHub 等外部接入消息，默认归为 `external_message`：

- 共享 `message` 气泡形态和左侧轨道
- 替换为 connector 头像
- 可保留极弱品牌 accent
- 不能伪装成某只猫的 persona message
- 即便由 scheduler 定时轮询后触发，只要它的最终语义是外部接入事件，仍然渲染为 `external_message`

结论：`agent_message` 与 `external_message` 是同一家族的两种身份，不是两套完全不同的布局系统。

## 7. Accessibility Guardrails

- 小字号弱提示必须过可读性底线，不要为了“弱存在感”把对比度压坏
- system notice 的弱化优先靠布局和密度，不靠把文字洗成看不见
- connector accent 应是“身份提示”，不是主视觉噪音

## 8. Anti-goals

- 不要把所有通知都做成同一种 bubble
- 不要让 GitHub / 飞书 / 微信消息漂浮在中间，脱离左侧消息轨道
- 不要为 scheduler 单独造一套视觉物种
- 不要让系统通知借用猫 persona 却不留下语义痕迹
- 不要在 `cafe` 体系里混入一套冷白蓝默认 SaaS 语言
