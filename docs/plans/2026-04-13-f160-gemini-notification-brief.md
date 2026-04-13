# F160 Gemini Design Brief

Date: 2026-04-13
Feature: F160 Unified Notification & Dialogue Contract

## Goal

为聊天界面里的“通知”和“对话”建立统一视觉入口。重点不是重画整个 chat，而是把不同语义的内容拉开层级，让用户一眼知道：

- 这是猫真的在跟我说话
- 这是外部接入消息，但它和对话共用消息轨道
- 这是系统状态提醒，不是对话
- 这是临时 toast，不是时间线真相源

补充原则：

- **Trigger ≠ Presentation**。例如 GitHub 消息即便由 scheduler 触发，最终仍应按 `external_message` 设计，而不是长成 scheduler notice。

## Visible Tiers

### 1. Agent Message

用于：

- 猫真正给用户的回复
- reminder 的用户可见提醒正文

要求：

- 这是主对话层
- 使用当前 persona token，不要统一改成冷蓝气泡
- reminder 不应再显示成 raw `[定时任务] xxx`

### 2. External Message

用于：

- 飞书 / 微信等外部机器人消息
- GitHub review / CI / repo inbox
- 投票结果和其他 connector 信号

要求：

- 与 `agent_message` 共用左侧消息轨道和 message shell
- 通过 connector avatar / label / 弱 accent 区分身份
- 不要画成居中漂浮卡片
- 不要冒充猫 persona

### 3. System Notice

用于：

- 定时任务已注册
- 已暂停 / 已恢复 / 已移除
- 周期任务本次执行完成
- 其他系统状态提醒

要求：

- 出现在聊天时间线
- 采用居中或通栏 `notice-bar`
- 弱存在感，但不能看不见
- 固定样式，不跟随模板自由发挥

对于定时任务：

- 和普通系统通知保持接近的骨架
- 通过前缀、图标、浅背景色区分
- 不要为 scheduler 单独发明一套气泡系统

## Auxiliary Mechanisms

### 4. Toast / Banner

用于：

- 临时成功/失败反馈
- 不进入时间线真相源

要求：

- 不替代聊天里的长期记录
- 不要和 `system_notice` 视觉混淆
- 回贴现有 `cafe` 体系，不要用默认 SaaS 黑白灰

### 5. Hidden Trigger

用于：

- scheduler 或系统内部唤醒

要求：

- 不进入用户可见聊天正文
- 不作为设计主层输出

## Scheduler-specific Guidance

- `reminder` 默认不是 raw trigger 直接展示
- `reminder` 的可见正文默认落 `agent_message`
- lifecycle 事件默认落 `system_notice`
- `web-digest` 可以根据路径区分 direct summary vs agent-triggered
- `repo-activity` 可以是 direct delivery
- `once` 任务默认 success/delete 静默

## Visual Constraints

- 回贴现有 `cafe` token：`#fdf8f3`, `#f5ede3`, `#e0d5c7`
- 外部接入回贴 `connector` token，不新造一套冷白蓝语系
- agent persona 保持现有猫的颜色逻辑
- 小字号 system notice 仍需保证可读性

## What To Draw

请输出 1 组统一方案，而不是只画单卡片：

1. `agent_message` / `external_message` 同屏时的左侧轨道关系
2. `system_notice` 作为 notice-bar 的样式
3. scheduler 场景示例：
   - 注册成功
   - 一次性任务触发后的真正提醒
   - 周期任务完成
4. toast/banner 的轻量样式方向

## Anti-goals

- 不要把所有通知做成同一种 bubble
- 不要把 GitHub / 飞书 / 微信消息漂浮在中间
- 不要只换颜色，不改层级
- 不要把 raw trigger 文本当成最终用户提醒
- 不要让 system notice 比 agent message 更显眼
