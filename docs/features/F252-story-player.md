---
feature_ids: [F252]
related_features: [F233, F226, F128, F225, F102]
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

### 事件级数据（Phase A/B 数据源）

- **events.jsonl**：每个 session 的完整事件流，每条事件带毫秒级时间戳 `t`（epoch ms）、顺序 `eventNo`、`invocationId` 分组。
- **事件类型**：TranscriptFormatter 兼容 `text`/`assistant`/`user`/`system`/`tool_use`/`tool_result`/`session_init`/`done`；工具名存在 `toolName` / `name` 双形态（`TranscriptFormatter.ts:87`）。**Phase A 需要 `TranscriptEvent → ReplayEvent` adapter 做归一化**。
- **Session API 已有**：`GET /api/sessions/:sessionId/events?view=raw` 分页返回原始事件（cursor + limit）；`view=chat` 返回对话视图；`view=handoff` 返回按 invocation 聚合的摘要。
- **前端渲染组件已有**：`bubble-event-adapter.ts`、`useAgentMessages.ts`、`chatStore.ts` 知道如何渲染消息/工具调用。

### Feature 级轨迹数据（Phase C 数据源）— F233 已有资产

**F233 Phase C C2a/C2b 已 merged（2026-06-21）**，落地了 feature trajectory 投影框架。**注意区分 schema 声明 vs projector 实现状态**（R2 review 教训：schema declaration ≠ runtime behavior）：

| 资产 | 位置 | 当前实现状态 | F252 消费方式 |
|------|------|-------------|---------------|
| `FeatTrajectoryProjection` schema（13 kinds） | `shared/types/feat-trajectory.ts:261` | ✅ schema ready | 泳道 + 章节 + 里程碑的数据源 |
| `FeatTrajectoryEntry`（entryId / subjectKey / at / kind / source / provenance） | 同上:225 | ✅ schema ready | 因果边 + 时间轴节拍 |
| `FeatTrajectoryProjector` + `RedisFeatTrajectoryStore` | `api/domains/feat-trajectory/` | ✅ 框架 ready | 服务端投影，F252 只读消费 |
| `GET /api/feat-trajectory/:featId` | `api/index.ts:2911-2922` | ✅ 路由 ready | Phase C 查询入口 |
| 三源 contract（event-stream / historical-stitched / git-ref-snapshot） | 同上:26-29 | ⚠️ 见下方 | 覆盖实时 + 历史 + git 三维数据 |
| provenance + confidence invariant | 同上:73-78 | ✅ schema ready | 箭头实线/虚线（high/medium/low） |
| `closed` kind（ball-shaped） | `FeatTrajectoryProjector.ts:58-64` | ✅ **已实现**：`ball.handed_cvo intent=done_notify → closed` | feature 关闭标记 |
| git-shaped kinds（`branch_pushed` / `pr_opened` / `branch_merged_to_main` / `branch_stale_unmerged`） | `GitRefSnapshotCollector` | ✅ **已实现**（server-side cron census） | git 事件标记 |
| `thread_split` / `thread_merge` / `pr_merged` / `phase_transition` / `verdict` / `reopened` | schema:36-43 | ❌ **schema 已声明但 projector 未实现**——`mapBallCustodyEventToTrajectory` 对这些 kinds return null → skip（`FeatTrajectoryProjector.ts:53`） | **F252 Phase C 的跨 thread 因果边依赖这些 kinds。须先补 F233 emitters（见 Dependencies）** |
| `applyStitchedEntry`（历史回填） | `FeatTrajectoryProjector.ts:278` | ❌ **throw 'step 5+ RED'** | 老 feature 的历史叙事暂无 |

**关键洞察**：F252 Phase C 是 **Feature Story Renderer**（消费 F233 投影做可视化），不是 Feature Story Builder（从零建数据层）。一套真相源——观众看到的故事和 CVO 在值班简报里看到的轨迹是同一份账本。**但 F233 projector 当前只产 `closed` + git-shaped entries。Phase C 的杀手叙事（跨 thread 传球 + 因果链）依赖 F233 补齐 `thread_split`/`thread_merge`/`pr_merged`/`phase_transition` 四个 ball-shaped emitters**。

### 缺失

- 无回放引擎（时间轴管理、倍速、暂停、seek）
- 无 `TranscriptEvent → ReplayEvent` adapter（事件类型归一化）
- 无多 thread 泳道视图
- 无因果链可视化渲染
- 无 Story 持久化 / 脱敏导出 / 公开分享
- Sealed transcript 只有最终文本，**无逐 token 流式数据**（需模拟打字效果）

## What

### Phase A: 单 Session 回放引擎 + 基础 UI

核心回放能力。选一个 session，以可变速度回放其事件流。**纯前端，不需要后端新 endpoint**。

- **TranscriptEvent → ReplayEvent Adapter**：
  - 归一化事件类型：`text`/`assistant` → `message`；`tool_use` + 对应 `tool_result`（via `toolUseId`）→ `tool_call`
  - 归一化工具名：`toolName` / `name` 双形态统一为 `toolName`
  - 输出 `ReplayEvent { type, timestamp, duration?, content, toolName?, toolInput?, toolResult? }`

- **Replay Engine（纯前端逻辑层）**：
  - 读取 session events（via 现有 API），经 adapter 转为 ReplayEvent 序列
  - 计算相邻事件间的 time delta
  - 根据倍速系数计算播放时刻：`playbackTime = delta / speedMultiplier`
  - 状态机：`idle → playing → paused → playing → ended`
  - 支持 seek（跳到任意 eventNo）

- **Speed Control**：
  - 固定倍速：1x / 10x / 50x / 100x
  - MAX 模式：瞬间跳到下一事件（无等待）
  - 键盘快捷键：空格暂停/继续，左右箭头单步

- **Text Animator**：
  - 文本消息逐字符/逐词显现（cinematic/simulated 模式，默认），速度随全局倍速联动
  - 100x 时 = 一秒几千字的视觉效果
  - 保留 **faithful 模式**：整段显现，忠实于事件粒度（UI 标注 "cinematic" vs "faithful"）

- **Tool Call Renderer**：
  - 显示工具名 + 参数摘要
  - 结果用折叠面板展示（可展开看完整输出）
  - 原始等待时间用 **log 压缩**（不是固定时长）：10s→3s, 60s→6s, 600s→12s。保留"等 npm install 期间多猫并行干别的"的叙事感（opus-47 review）

- **基础 UI + 路由**：
  - 统一路由模型 `/story/:storyId`（opus-47 P2）
  - **storyId 语义**：`session:<sessionId>` = ephemeral 单 session 回放（前端直接用 sessionId 查 events API，无需后端持久化）；持久化 story 用 UUID storyId（Phase D 创建）。Phase A 只用 ephemeral 模式，故**纯前端成立**
  - 聊天区：复用现有 bubble 组件渲染消息
  - 底部控制条：播放/暂停 + 倍速选择 + 进度条（可拖动 seek）+ 时间显示（原始时长 / 回放时长）
  - 全屏沉浸式布局，干净背景

### Phase B: 自适应节奏 + 章节系统

智能回放节奏，让观众不需要手动调速。**优先使用 F233 entries 当章节锚**。

- **自适应节奏引擎**：
  - 根据事件密度自动调速——密集段减速，稀疏段加速
  - Idle gap > 配置阈值（默认 5 min）→ 自动跳过，显示"⏩ 跳过 23 分钟"
  - 传球事件（@mention / cross_post）→ 自动减速 + 高亮
  - 用户可切换为固定倍速覆盖

- **Chapter System（章节）**：
  - **多 session story**：从 `FeatTrajectoryProjection.entries` 提取章节锚——`launched`、`phase_transition`、`pr_merged`、`verdict`、`closed` 等 kinds 天然就是叙事节拍
  - **单 session story**：从 session digest + 事件密度变化提取章节（session 开始、首次工具调用、关键传球、session 结束）
  - 时间轴上显示章节标记，点击跳转
  - 支持手动添加章节标注

### Phase C: Feature Story Renderer（多 Thread 泳道 + 因果链）

从单 session 升维到 feature 级全景叙事。**数据层复用 F233 `FeatTrajectoryProjection`，本 Phase 只做渲染层**。

- **双层数据架构**：
  - **骨架层**：`GET /api/feat-trajectory/:featId` → `FeatTrajectoryProjection`（F233 已有）。提供 feature 级时间线、thread 关联、因果边（`thread_split`/`thread_merge`/`pr_merged` 等 kinds）、provenance + confidence
  - **细节层**：`GET /api/sessions/:sessionId/events` → 事件级回放（Phase A 已有）。用户点击泳道色块 → drilldown 到对应 session 的单 session 回放器
  - **薄 BFF 层**（新建）：`GET /api/story/:storyId/rendering` — 把 F233 投影 entries 映射成 Story rendering DTO（泳道布局坐标 + 因果边几何），前端直接消费

- **泳道视图（Swimlane View）**：
  - Thread 列表从 `payload.snapshot.associatedThreadIds`（git-ref entries）+ story metadata + thread/session store 提取。**不从 `subjectKey` 反推**——`subjectKey` 语义是 `feat:{featId}` 或 `git-ref:{branchName}`，不含 thread 信息（`feat-trajectory.ts:234`）
  - 每个 thread 一条泳道，显示 thread 名称 + 参与猫猫头像
  - Session 活动期显示为色块（颜色按猫猫区分）
  - 时间轴水平滚动，垂直堆叠泳道
  - 点击色块 → 跳入 Phase A 的单 session 回放（三层缩放的"剧场"层）

- **因果链可视化**：
  - 因果边来自 F233 投影的 `thread_split` / `thread_merge` / `pr_merged` 等 kinds（**不是**从 events 启发式推断）
  - 每条边带 provenance + confidence：`high` → 实线箭头，`medium` → 虚线，`low` → 点线
  - 箭头标注 kind 和 payload 摘要（"thread_split: @codex request-review" / "pr_merged: #2547"）
  - 回放时箭头随时间轴动态出现

- **三层缩放**：
  - **鸟瞰（Birdseye）**：Feature 级泳道图，全景概览（数据源 = F233 投影）
  - **剧场（Theater）**：点击泳道色块 → 单 session 回放（数据源 = events.jsonl）
  - **显微镜（Microscope）**：暂停后点击消息 → 展开完整内容（代码 diff / 工具输出 / 思考过程）

- **路由**：统一 `/story/:storyId`。Story 可以包含 1 个 session（= Phase A 视图）或 N 个 thread（= feature 视图）。Session 是 Story 的一种特例，URL 模型不分裂。

### Phase D: 注解层 + 脱敏分享

演示增强和传播能力。**公开分享需要脱敏 export 包**。

- **Annotation Layer**：
  - 在任意时间点/事件上添加注解卡片
  - 注解类型：文字旁白、高亮框、箭头指示
  - 注解数据独立存储（`data/stories/:storyId/annotations.json`），不污染原始 transcript
  - 回放时注解自动弹出 / 暂停模式下手动浏览

- **Story 编辑器**：
  - 选择 Feature / Thread / Session 组合创建 Story
  - 添加标题、描述、注解
  - 保存为可分享的 Story 实体

- **脱敏 Export 包**（新建后端 API）：
  - `POST /api/story/:storyId/export` → 生成脱敏后的 Story 数据包
  - 过滤范围覆盖**所有 content 字段**（不只 tool 边界）：
    - tool args / tool output 中的路径、token、env、API key
    - assistant text 中的代码路径、worktree 路径、内部票据
    - 私有 repo 细节、个人信息
    - 平行猫内部名字（保留公开猫名）
  - 脱敏审核记录入 ledger
  - 默认**关闭**公开分享；需手动生成 export 包后才能开启

- **公开分享**：
  - 生成 `/story/:storyId/public` URL
  - Public URL 只读**脱敏 export 包**，不直连 raw transcript API（现有 transcript API 有身份 + thread/cat 访问控制，`session-transcript.ts:71`）
  - 嵌入式 iframe 支持

## Acceptance Criteria

<!-- 立项愿景硬度自检（F216→F219）：每条 AC ① trace 回 Why「现场跑太慢+看记录没冲击力→要高速回放」② 非作者可复核（命令/截图/操作路径）。 -->

### Phase A（单 Session 回放引擎 + 基础 UI）
- [ ] AC-A1: 选择任意 sealed session → `/story/:storyId` 页面以 100x 速度回放完整事件流，文本消息以 cinematic 模式逐字显现，可切换为 faithful 整段显现（trace Why「100倍速+一秒几千字」；复核：选一个 ≥50 event 的 session 回放，录屏对比两种模式）
- [ ] AC-A2: 工具调用显示工具名+参数摘要，原始等待时间用 log 压缩渲染（10s→3s, 60s→6s），非固定时长（trace Why「toolcall 回放就是立刻马上好」+ 保留多猫并行叙事感；复核：包含 ≥3 个 tool_use 的 session 回放验证压缩比例）
- [ ] AC-A3: 播放/暂停/倍速切换（1x/10x/50x/100x/MAX）+ 进度条拖动 seek 全部可用（trace Why「到某个节点能暂停」；复核：手动操作每个控件）
- [ ] AC-A4: 空格键暂停/继续，← → 单步前进/后退（trace Why「暂停讲解」；复核：键盘操作测试）
- [ ] AC-A5: `TranscriptEvent → ReplayEvent` adapter 正确处理 `text`/`assistant`/`user` 多形态事件 + `toolName`/`name` 双形态工具名，有单元测试覆盖（trace Why「数据正确性是回放可信度基础」；复核：`pnpm test` 相关 adapter 测试全绿）

### Phase B（自适应节奏 + 章节）
- [ ] AC-B1: Idle gap > 5min 自动跳过 + 显示跳过提示；传球事件（@mention）自动减速 + 高亮（trace Why「回放节奏合理」；复核：含长 idle 段的 session 验证自动跳过）
- [ ] AC-B2: 多 session story 的章节标记来自 F233 `FeatTrajectoryProjection.entries`（`phase_transition`/`pr_merged`/`verdict` 等 kinds），点击跳转（trace Why「到某个节点暂停讲解」；复核：选一个有 phase_transition 的 Feature 验证章节标记出现且可跳转）

### Phase C（Feature Story Renderer 多泳道 + 因果链）
- [ ] AC-C0: **前置条件**：F233 emitters 补齐 `thread_split`/`thread_merge`/`pr_merged`/`phase_transition` 四个 ball-shaped kinds 已 merged 且在生产环境产出 entries（trace Why「Phase C 灵魂依赖跨 thread 因果边」；复核：`GET /api/feat-trajectory/:featId` 返回含 `thread_split` kind 的 entries）
- [ ] AC-C1: 输入 Feature ID → 消费 `GET /api/feat-trajectory/:featId` 自动构建多 thread 泳道图，thread 列表从 `payload.snapshot.associatedThreadIds` + story metadata + thread/session store 提取（不从 subjectKey 反推），每个 thread 一条泳道（trace Why「涉及多个thread」；复核：选一个 ≥2 thread 的 Feature 验证泳道与 F233 投影一致）
- [ ] AC-C2: 因果边来自 F233 投影的 `thread_split`/`thread_merge`/`pr_merged` kinds（不是事件层启发式），以动画箭头显示，箭头样式反映 provenance.confidence（high=实线, medium=虚线, low=点线）（trace Why「事件驱动」；复核：选一个有 thread_split 的 Feature 验证箭头+样式）
- [ ] AC-C3: 三层缩放可用——鸟瞰（F233 投影）点色块 → 剧场（events.jsonl 回放）→ 暂停点消息 → 显微镜展开完整内容（trace Why「既能看全景又能看细节」；复核：从鸟瞰一路 drill-down 到消息详情）

### Phase D（注解 + 脱敏分享）
- [ ] AC-D1: 可在任意时间点添加文字注解，回放时自动弹出（trace Why「暂停讲解」；复核：添加注解后回放验证弹出）
- [ ] AC-D2: 公开分享读脱敏 export 包（不直连 raw transcript API），过滤覆盖 tool args/output + assistant text + system event 中的路径/token/env/个人信息，脱敏审核入 ledger（trace Why「向外展示」；复核：生成 export 包 → 隐身窗口打开 public URL → 搜索已知敏感字符串确认不泄露）

## Dependencies

- **Evolved from**: F233（FeatTrajectoryProjection — Phase C 的数据骨架层。F233 投影 feature 轨迹，F252 渲染为可视化 story）
- **Blocked by**: F233 emitter 补齐（**Phase C 前置依赖**）— F233 `mapBallCustodyEventToTrajectory` 当前只实现 `closed` 一条 rule。F252 Phase C 的跨 thread 因果叙事依赖至少 4 个 ball-shaped kinds 被实现：`thread_split`（propose_thread→child thread）、`thread_merge`（cross_post 回合并）、`pr_merged`（PR 合入）、`phase_transition`（Phase 推进）。**路径选择 A（KD-6）**：F252 主动驱动 F233 补 emitters，这些 PR 算 F233 范畴。F252 Phase C kickoff 前确认这 4 个 emitters 已 merged
- **Related**: F226（Presentation Surface / Demo Mode — 互补关系：F226 的浮窗可以在 Story Player 回放时常驻讲稿）
- **Related**: F128（propose_thread — `thread_split` kind 的上游事件源）
- **Related**: F225（Context Self-Management — 展示事件驱动协作的素材来源）
- **Related**: F102（Memory System — session digest 是单 session 章节提取的数据源）

## Risk

| 风险 | 缓解 |
|------|------|
| Sealed transcript 无 token 流，模拟打字可能看起来不自然 | Phase A cinematic 模式 + 可配置速度 + faithful 备选；调参让视觉效果自然 |
| 大 session（>1000 events）一次加载可能慢 | 已有分页 API（cursor + limit），Replay Engine 分批预加载 |
| F233 投影可能缺少某些因果边（历史 feature 只有 stitched 数据） | F233 三源 contract 已覆盖历史（stitched）+ 实时（event-stream）+ git（snapshot）；stitched 带 provenance.confidence 标注可信度 |
| 脱敏过滤可能遗漏 assistant text 中的敏感信息 | 脱敏层覆盖所有 content 字段（不只 tool 边界）+ 审核记录入 ledger + 默认关闭公开分享 |
| F233 emitter 补齐可能延迟，阻塞 Phase C | 路径 A（KD-6）：每个 emitter 是 `mapBallCustodyEventToTrajectory` 加一条 rule，工作量可控；可提前与 F233 owner 协调排期。Phase A/B 不受阻塞 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Story Player 页面应该在 Hub 主导航加入口，还是作为 Feature doc / Thread 详情的附属入口？ | ⬜ 未定 |
| OQ-2 | 脱敏过滤的具体规则集（regex patterns / 允许/拒绝列表）如何维护和演进？ | ⬜ 未定（方向已定：默认关闭 + 生成脱敏 export 包 + 覆盖所有 content 字段） |
| OQ-3 | 是否需要离线模式（把 story 数据打包成静态 JSON 供离线播放）？ | ⬜ 未定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | cinematic 模拟打字作为默认渲染方式，保留 faithful 整段显现模式 | 铲屎官要"一秒几千字"的视觉冲击力；UI 标注模式名避免误导（砚砚+47 review） | 2026-06-25 |
| KD-2 | 后端需求按 Phase 分层：Phase A 纯前端 / Phase C 复用 F233 API + 薄 BFF / Phase D 新建 story persistence + 脱敏 export API | 初版写"纯前端不需要后端"只对 Phase A 成立；Phase C/D 有持久化、脱敏、公开分享需求（砚砚+47 P1） | 2026-06-25 |
| KD-3 | 多 thread 用绝对时间 `t` 对齐做泳道布局 | 所有事件的 `t` 是服务器 epoch ms，天然可对齐；F233 entries 的 `at` 也是 Unix ms | 2026-06-25 |
| KD-4 | 因果边来自 F233 投影的显式 kinds（`thread_split`/`thread_merge`/`pr_merged` 等），不做事件层启发式推断 | F233 已投影因果边并带 provenance/confidence；从 events 反推 proposalId→threadId 链路是重复造轮子且容易遗漏（47 review 核心发现） | 2026-06-25 |
| KD-5 | Phase C 是 Feature Story Renderer，不是 Feature Story Builder。数据层复用 F233 `FeatTrajectoryProjection`，本 feature 只建渲染层。**但 F233 projector 当前只产 `closed` + git-shaped kinds**，Phase C 依赖补齐 emitters（见 KD-6） | 一套真相源——观众看到的故事和 CVO 看到的轨迹是同一份账本；F233 invariant（rebuild=replay 逐字段相同）保证因果边可信度（47 review + 砚砚 R2 纠正：schema declaration ≠ runtime behavior） | 2026-06-25 |
| KD-6 | F233 emitter 补齐路径选 **A**（F252 主动驱动 F233 补 emitters），不选 B（拆 C1/C2） | Phase C 灵魂是跨 thread 因果叙事。拆 C1 = git 时间线 = 不值得单独做一个 Phase。驱动 F233 补 4 个 emitters 是前置工作但工作量可控（每个是 `mapBallCustodyEventToTrajectory` 加一条 rule）（47 R2 提出，我同意） | 2026-06-25 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-06-25 | 立项。铲屎官提出回放 demo 需求，讨论收敛到 Story Player 终态设计，CVO 授权立项 |
| 2026-06-25 | Design review R1：砚砚 3×P1 + 1×P2，47 blocking Phase C（F233 复用）。全部接受，返工 spec |
| 2026-06-25 | Design review R2：砚砚 2×P1 blocking（"已投影"事实错误 + subjectKey 语义错误），47 背书 + 补 F233 emitter 前置依赖。返工 R3：区分 schema declaration vs runtime behavior，明确前置依赖路径选 A |

## Review Gate

- Design spec R2: @codex + @opus47 确认返工后放行
- Phase A: 实现后 @codex review code
- Phase B-D: 每 Phase 完成后 @codex review

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F233-ball-custody-euthanasia.md` | F233 Phase C = F252 Phase C 的数据骨架层 |
| **Feature** | `docs/features/F226-presentation-surface-demo-mode.md` | 互补：F226 浮窗 + F252 回放 |
| **Source** | `packages/shared/src/types/feat-trajectory.ts` | FeatTrajectoryProjection schema（F252 消费端） |
| **Source** | `packages/api/src/domains/feat-trajectory/` | F233 投影 + store 实现 |
| **Discussion** | 本 thread（thread_mqt8cr0yf5k3l96e） | 立项讨论原始对话 |

## Tips Contribution (F244)

- 计划新增 1 条 tip：指向 `/story` 入口的使用引导（"想展示猫猫协作？试试 Story Player"）
- Phase D 分享功能上线后更新 tip 内容
