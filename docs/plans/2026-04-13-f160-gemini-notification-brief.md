# F160 Gemini Design Brief

Date: 2026-04-13
Feature: F160 Unified Notification & Dialogue Contract

## Goal

为聊天界面里的“通知”和“对话”建立统一视觉入口。重点不是重画整个 chat，而是把不同语义的内容拉开层级，让用户一眼知道：

- 这是系统弱通知
- 这是结构化 connector 通知
- 这是猫真的在跟我说话
- 这是临时 toast，不是时间线真相源

## Design Lanes

### 1. System Notice

用于：

- 定时任务已注册
- 已暂停 / 已恢复 / 已移除
- 周期任务本次执行完成

要求：

- 出现在聊天时间线
- 弱存在感，但不能看不见
- 固定样式，不跟随模板自由发挥
- 不能像主对话气泡那样抢戏
- 应区别于 connector bubble

建议：

- 更轻的背景色
- 更薄的边框或分割线
- 更小的标题层级
- 适合连续出现时不形成视觉噪音

### 2. Connector Notice

用于：

- GitHub review / CI / repo inbox
- 投票结果
- 其他结构化外部信号

要求：

- 保持独立 bubble 语义
- 比 system notice 更强，但仍弱于真实 agent 对话
- 允许 icon + label + fields

### 3. Agent Dialogue

用于：

- 猫真正给用户的回复
- reminder 的用户可见提醒正文

要求：

- 这是主对话层
- reminder 不应再显示成 raw `[定时任务] xxx`
- 若 scheduler 需要叫醒猫，应该由猫最终说人话给用户

### 4. Toast / Banner

用于：

- 临时成功/失败反馈
- 不进入时间线真相源

要求：

- 不替代聊天里的长期记录
- 不要和 system notice 视觉混淆

## Scheduler-specific Guidance

- `reminder` 默认不是 raw trigger 直接展示
- `web-digest` 可以根据路径区分 direct summary vs agent-triggered
- `repo-activity` 可以是 direct delivery
- `once` 任务默认 success/delete 静默

## What To Draw

请输出 1 组统一方案，而不是只画单卡片：

1. 聊天时间线中 `system_notice` 的样式
2. `connector_notice` 与 `system_notice` 并排时的层级关系
3. `agent_dialogue` 与上述两者同屏时的主次关系
4. scheduler 场景示例：
   - 注册成功
   - 一次性任务触发后的真正提醒
   - 周期任务完成
5. toast/banner 的轻量样式方向

## Anti-goals

- 不要把所有通知做成同一种 bubble
- 不要只换颜色，不改层级
- 不要把 raw trigger 文本当成最终用户提醒
- 不要让 system notice 比 agent dialogue 更显眼
