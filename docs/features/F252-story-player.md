---
feature_ids: [F252]
related_features: [F226, F128, F225, F102]
topics: [replay, demo, story, timeline, presentation, multi-thread]
doc_kind: spec
created: 2026-06-25
---

# F252: Story Player

> **Status**: spec | **Owner**: 宪宪 (Opus-4.6) | **Priority**: P1

## Why

铲屎官需要向外界展示 Cat Cafe 多猫协作的真实工作流，但现有手段全都不行：

- **现场跑**：复杂特性要跑几十分钟到几小时，观众等不了
- **跑简单的**：没意义，展示不出协作深度
- **看聊天记录**：缺乏冲击力——静态文字无法传达猫猫飞速工作、传球协作、事件驱动的动态感

> 铲屎官原话（2026-06-25）：
> - "如果直接在现场跑你们这群猫的速度 复杂的特性要跑很久，如果展示简单的特性那没意义"
> - "直接看聊天内容好像有点缺乏冲击力，我更想的是真实的回放 比如10倍数 100倍速"
> - "toolcall 1s 10s 现在这个本质只是回放那就是立刻马上好 你们吐字可能也贼快 一秒几千那种"
> - "回放然后到某个节点我能点暂停 好像也挺好"
> - "那如果涉及多个thread呢！！你们现在f128 f225等等用的可6了 甚至有的是事件驱动的！"

**价值**：让铲屎官能用一个 URL 向投资人/用户/同行展示"一群 AI 猫如何真实地协作完成一个复杂 feature"——以 100 倍速看到多猫并行开发、跨 thread 传球、事件驱动触发的完整叙事，任意时刻暂停深入讲解。**这是其他 AI 产品没有的展示形态。**

## Current State / 现状基线

**数据层已 90% ready**（2026-06-25 宪宪实测）：

- **events.jsonl**：每个 session 的完整事件流，每条事件带毫秒级时间戳 `t`（epoch ms）、顺序 `eventNo`、`invocationId` 分组。事件类型覆盖 `text`/`tool_use`/`tool_result`/`session_init`/`done`。
- **Session API 已有**：`GET /api/sessions/:sessionId/events?view=raw` 分页返回原始事件（cursor + limit）；`view=chat` 返回对话视图；`view=handoff` 返回按 invocation 聚合的摘要。
- **跨 thread 因果数据已有**：`cross_post_message` 事件带 `threadId` + `targetCats`；`propose_thread` 有 `parentThreadId`；`register_pr_tracking` 有 webhook 回调记录；`hold_ball` 有唤醒事件。
- **Feature → Thread 映射已有**：`docs/features/F*.md` 含关联 thread 列表 + `cat_cafe_feat_index` 提供 feature 到 thread 索引。
- **前端渲染组件已有**：`bubble-event-adapter.ts`、`useAgentMessages.ts`、`chatStore.ts` 知道如何渲染消息/工具调用。

**缺失**：
- 无回放引擎（时间轴管理、倍速、暂停、seek）
- 无多 thread 泳道视图
- 无因果链可视化
- Sealed transcript 只有最终文本，**无逐 token 流式数据**（需模拟打字效果）

## What

### Phase A: 单 Session 回放引擎 + 基础 UI

核心回放能力。选一个 session，以可变速度回放其事件流。

- **Replay Engine（纯逻辑层）**：
  - 读取 session events（via API），按 `t` 排序
  - 计算相邻事件间的 time delta
  - 根据倍速系数计算播放时刻：`playbackTime = delta / speedMultiplier`
  - 状态机：`idle → playing → paused → playing → ended`
  - 支持 seek（跳到任意 eventNo）

- **Speed Control**：
  - 固定倍速：1x / 10x / 50x / 100x
  - MAX 模式：瞬间跳到下一事件（无等待）
  - 键盘快捷键：空格暂停/继续，左右箭头单步

- **Text Animator**：
  - 文本消息逐字符/逐词显现（模拟打字），速度随全局倍速联动
  - 100x 时 = 一秒几千字的视觉效果
  - 可切换为"整段显现"模式

- **Tool Call Renderer**：
  - 显示工具名 + 参数摘要
  - 结果用折叠面板展示（可展开看完整输出）
  - 原始等待时间压缩为短动画（spinner 0.3s → 展开）

- **基础 UI（新页面 `/replay/:sessionId`）**：
  - 聊天区：复用现有 bubble 组件渲染消息
  - 底部控制条：播放/暂停 + 倍速选择 + 进度条（可拖动 seek）+ 时间显示（原始时长 / 回放时长）
  - 全屏沉浸式布局，干净背景

### Phase B: 自适应节奏 + 章节系统

智能回放节奏，让观众不需要手动调速。

- **自适应节奏引擎**：
  - 根据事件密度自动调速——密集段减速，稀疏段加速
  - Idle gap > 配置阈值（默认 5 min）→ 自动跳过，显示"⏩ 跳过 23 分钟"
  - 传球事件（@mention / cross_post）→ 自动减速 + 高亮
  - 用户可切换为固定倍速覆盖

- **Chapter System（章节）**：
  - 从 session digest 自动提取叙事节拍：session 开始、首次工具调用、关键决策点、session 结束
  - 时间轴上显示章节标记，点击跳转
  - 支持手动添加章节标注

### Phase C: Thread Story 模式（多 Thread 泳道 + 因果链）

从单 session 升维到 feature 级全景叙事。

- **Feature Story 构建器**：
  - 输入 Feature ID → 查 `feat_index` + feature doc → 获取关联 thread 列表
  - 每个 thread 查 session chain → 获取所有 session 的时间范围
  - 按绝对时间 `t` 对齐所有 session 事件

- **泳道视图（Swimlane View）**：
  - 每个 thread 一条泳道，显示 thread 名称 + 参与猫猫头像
  - Session 活动期显示为色块（颜色按猫猫区分）
  - 时间轴水平滚动，垂直堆叠泳道
  - 点击色块 → 跳入 Phase A 的单 session 回放

- **因果链可视化**：
  - 从 events 提取因果信号：`cross_post_message`、`@mention`、`propose_thread`、`hold_ball` wake、PR event
  - 用动画箭头连接 thread 间的因果事件
  - 箭头标注类型和标签（"@codex request-review" / "PR #2547 merged"）
  - 回放时箭头随时间轴动态出现

- **三层缩放**：
  - **鸟瞰（Birdseye）**：Feature 级泳道图，全景概览
  - **剧场（Theater）**：点击泳道色块 → 单 thread/session 回放
  - **显微镜（Microscope）**：暂停后点击消息 → 展开完整内容（代码 diff / 工具输出 / 思考过程）

- **路由**：`/story/:featureId`（自动构建 story）/ `/story/custom`（手动选 thread 组合）

### Phase D: 注解层 + 分享

演示增强和传播能力。

- **Annotation Layer**：
  - 在任意时间点/事件上添加注解卡片
  - 注解类型：文字旁白、高亮框、箭头指示
  - 注解数据独立存储（`data/stories/:storyId/annotations.json`），不污染原始 transcript
  - 回放时注解自动弹出 / 暂停模式下手动浏览

- **Story 编辑器**：
  - 选择 Feature / Thread 组合创建 Story
  - 添加标题、描述、注解
  - 保存为可分享的 Story 实体

- **分享**：
  - 生成 `/story/:storyId` URL
  - 无需登录即可观看（public replay 模式）
  - 嵌入式 iframe 支持

## Acceptance Criteria

<!-- 立项愿景硬度自检（F216→F219）：每条 AC ① trace 回 Why「现场跑太慢+看记录没冲击力→要高速回放」② 非作者可复核（命令/截图/操作路径）。 -->

### Phase A（单 Session 回放引擎 + 基础 UI）
- [ ] AC-A1: 选择任意 sealed session → `/replay/:sessionId` 页面以 100x 速度回放完整事件流，文本消息以打字机效果逐字显现（trace Why「100倍速+一秒几千字」；复核：选一个 ≥50 event 的 session 回放，录屏对比）
- [ ] AC-A2: 工具调用显示工具名+参数摘要，原始等待时间压缩为 ≤1s 动画（trace Why「toolcall 回放就是立刻马上好」；复核：包含 ≥3 个 tool_use 的 session 回放验证）
- [ ] AC-A3: 播放/暂停/倍速切换（1x/10x/50x/100x/MAX）+ 进度条拖动 seek 全部可用（trace Why「到某个节点能暂停」；复核：手动操作每个控件）
- [ ] AC-A4: 空格键暂停/继续，← → 单步前进/后退（trace Why「暂停讲解」；复核：键盘操作测试）

### Phase B（自适应节奏 + 章节）
- [ ] AC-B1: Idle gap > 5min 自动跳过 + 显示跳过提示；传球事件（@mention）自动减速 + 高亮（trace Why「回放节奏合理」；复核：含长 idle 段的 session 验证自动跳过）
- [ ] AC-B2: 时间轴显示自动提取的章节标记，点击跳转到对应位置（trace Why「到某个节点暂停讲解」；复核：验证章节标记与 session 关键事件对应）

### Phase C（Thread Story 多泳道 + 因果链）
- [ ] AC-C1: 输入 Feature ID → 自动构建多 thread 泳道图，每个 thread 一条泳道，session 活动期为色块（trace Why「涉及多个thread」；复核：选一个 ≥2 thread 的 Feature 验证）
- [ ] AC-C2: 跨 thread 因果链（cross_post / @mention / propose_thread）以动画箭头显示，随时间轴动态出现（trace Why「事件驱动」；复核：选一个有 cross_post 的 Feature 验证箭头出现）
- [ ] AC-C3: 三层缩放可用——鸟瞰点色块 → 剧场回放 → 暂停点消息 → 显微镜展开完整内容（trace Why「既能看全景又能看细节」；复核：从鸟瞰一路 drill-down 到消息详情）

### Phase D（注解 + 分享）
- [ ] AC-D1: 可在任意时间点添加文字注解，回放时自动弹出（trace Why「暂停讲解」；复核：添加注解后回放验证弹出）
- [ ] AC-D2: Story URL 可分享，无需登录即可观看（trace Why「向外展示」；复核：隐身窗口打开 URL 验证）

## Dependencies

- **Related**: F226（Presentation Surface / Demo Mode — 互补关系：F226 的浮窗可以在 Story Player 回放时常驻讲稿）
- **Related**: F128（propose_thread — Story Player 的因果链数据源之一）
- **Related**: F225（Context Self-Management — 展示事件驱动协作的素材来源）
- **Related**: F102（Memory System — session digest 是章节提取的数据源）

## Risk

| 风险 | 缓解 |
|------|------|
| Sealed transcript 无 token 流，模拟打字可能看起来不自然 | Phase A 先做 MVP 打字效果 + 可配置速度；调参让视觉效果自然 |
| 大 session（>1000 events）一次加载可能慢 | 已有分页 API（cursor + limit），Replay Engine 分批预加载 |
| 多 thread 时间对齐复杂（不同猫的时钟可能有微小偏差） | 所有事件用服务器端 `Date.now()` 记录，偏差在 ms 级可忽略 |
| 跨 thread 因果链可能有遗漏（部分传球走 chat 而非 cross_post） | Phase C 先做显式信号（cross_post/mention/propose_thread），后续可加启发式匹配 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Story Player 页面应该在 Hub 主导航加入口，还是作为 Feature doc / Thread 详情的附属入口？ | ⬜ 未定 |
| OQ-2 | 公开分享时需要考虑哪些隐私过滤（tool output 可能含路径/token 等敏感信息）？ | ⬜ 未定 |
| OQ-3 | 是否需要离线模式（把 story 数据打包成静态 JSON 供离线播放）？ | ⬜ 未定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 模拟打字而非整段显现作为默认渲染方式 | 铲屎官要"一秒几千字"的视觉冲击力；整段显现缺乏动态感 | 2026-06-25 |
| KD-2 | 回放引擎是纯前端，不需要后端新 endpoint | 数据层 API 已完备，回放是客户端时间轴管理 | 2026-06-25 |
| KD-3 | 多 thread 用绝对时间 `t` 对齐而非相对时间 | 所有事件的 `t` 是服务器 epoch ms，天然可对齐；相对时间需要额外锚点 | 2026-06-25 |
| KD-4 | 因果链只使用显式信号（cross_post/mention/propose_thread/hold_ball/PR event），不做启发式推断 | 显式信号数据已有且准确；启发式推断（如"时间临近"）误报率高 | 2026-06-25 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-06-25 | 立项。铲屎官提出回放 demo 需求，讨论收敛到 Story Player 终态设计，CVO 授权立项 |

## Review Gate

- Phase A: @codex + @opus47 审 design spec → 实现后 @codex review code
- Phase B-D: 每 Phase 完成后 @codex review

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F226-presentation-surface-demo-mode.md` | 互补：F226 浮窗 + F252 回放 |
| **Discussion** | 本 thread（thread_mqt8cr0yf5k3l96e） | 立项讨论原始对话 |

## Tips Contribution (F244)

- 计划新增 1 条 tip：指向 `/replay` 或 `/story` 入口的使用引导（"想展示猫猫协作？试试 Story Player"）
- Phase D 分享功能上线后更新 tip 内容
