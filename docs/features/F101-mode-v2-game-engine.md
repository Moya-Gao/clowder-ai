---
feature_ids: [F101]
related_features: [F011, F107]
topics: [mode, game, werewolf, game-engine]
doc_kind: spec
created: 2026-03-11
reopened: 2026-03-14
updated: 2026-03-23
---

# F101: Mode v2 — 游戏系统引擎 + 狼人杀

> **Status**: in-progress (Phase I in progress) | **Owner**: 布偶猫 | **Priority**: P1 | **Reopened**: 2026-03-14
>
> **重新打开原因**：2026-03-12 声称 done 并通过愿景守护，但铲屎官 2026-03-14 实际启动 dev 点开狼人杀后发现：(1) 无关闭/返回按钮，用户被困在全屏游戏界面；(2) 无大厅/配置流程，7 只猫自动塞入无法选择；(3) 猫猫不会自动行动，游戏永远卡在 night_guard 等待中；(4) 整体不可用。92 个单元测试全绿但零 E2E 真实验证。教训见 LL-032。

## Why

铲屎官原话（2026-03-11）：
> "我们的这个 mode 其实应该是类似于什么，就比如说是假设狼人杀、三国杀这种是需要我们自己额外制作一个系统的，这样子好像才是需要启动一个这种 mode 模式。"

现有 mode（brainstorm/debate/dev-loop）已被 skill 流程吸收，几乎没人使用。Mode 应重新定位为**强机制游戏系统容器**，第一个目标是狼人杀。铲屎官可选择当玩家、上帝视角观战、或法官。

四猫讨论收敛（布偶猫 + 暹罗猫 + 缅因猫 GPT-5.4 + 缅因猫 Codex），核心共识：
- 法官 = 纯代码 GameEngine（确定性逻辑），LLM 只做玩家发言和策略
- seat/actor/role 三层分离（gpt52 提出）
- 服务端 scoped event log 做信息隔离
- 参考 AIWolf 协议边界，不抄 prompt

## What

分两大部分：**Part A — Mode 机制改造**（通用游戏引擎基座）、**Part B — 狼人杀 v1**（首个游戏实现）。

### Phase A: Mode v2 — 通用游戏引擎基座

将现有 mode 从"协作流程容器"改造为"游戏系统容器"。

**A1. 类型抽象改造**
- **删除**旧三 mode（brainstorm/debate/dev-loop），不做兼容，面向终态开发
- 新增 `GameDefinition`（规则集）/ `GameRuntime`（运行时状态机）/ `GameView`（视图裁剪）三层抽象
- `seat / actor / role` 三层分离：seat=P1-Pn, actor=人类/猫/system, role=游戏角色

**A2. 执行模型改造**
- 从"用户发消息触发一轮 handler"→ 系统驱动 tick（GameEngine 自主推进夜晚/结算/投票）
- 超时自动结算：默认 3-5 分钟，全员提交可提前进入下一阶段（不用等满时间）
- ModeStore 从内存 Map → Redis 持久化（进程重启不丢局）

**A3. 信息隔离层**
- 统一 event log（append-only + version），每个事件带 `scope = public | seat:x | faction:wolf | judge | god`
- API 和 socket 只发 `GameView`（裁剪后视图），**禁止**全量 state 直出
- `GET /mode` 和 `mode_changed` socket 按请求者身份裁剪返回

**A4. 旧 mode 清理**
- 删除 brainstorm/debate/dev-loop 的 handler、类型、路由、前端入口
- 前端 `/mode` 命令和 ModeStatusBar 重写为游戏模式入口
- 不做向后兼容，直接清理干净

### Phase B: 狼人杀 v1 — 首个游戏实现

在 Phase A 基座上实现标准狼人杀。

**B1. 规则引擎（WerewolfRuleset）**
- 规则基准：**网易狼人杀**（大众熟悉的版本）
- 角色配置：可自定义（铲屎官开局时选角色组合），默认 7 人局
- 状态机：`lobby → deal → night(action collection) → resolve → day(discuss+遗言) → vote → exile → check(win?) → end`
- 结构化动作：`vote / attack / guard / divine / use_potion`，服务端做 phase+role+alive 校验
- 胜负判定：狼人全灭=好人胜 / 好人≤狼人=狼人胜
- 遗言阶段：被投票出局的玩家可发遗言
- 无警长竞选机制（网易标准规则）
- 投票复用现有 `cat_cafe_start_vote` 能力

**B2. 法官系统（GameEngine）**
- 纯代码实现，不走 LLM 推理
- 角色分配：`shuffle(roles) → assign(seats)`
- 回合流转：系统驱动，不依赖用户消息
- 技能结算：确定性逻辑（女巫毒/救、守卫保护、预言家查验、狼人刀人）
- 并发控制：每局单写锁，避免重复结算和竞态投票

**B3. 铲屎官参与模式（v1 支持 player + god-view）**
- `player`：只看自己可见事件，可发言/投票，战争迷雾
- `god-view`：只读全量状态（所有角色+夜间动作），不可干预
- `judge`：放 v2（可手动推进 phase/override + 审计日志）

**B4. 猫猫 AI 玩家**
- 猫猫作为玩家参与：LLM 负责发言策略和社交推理
- 系统 prompt 按角色注入：狼人知道队友、村民只知公开信息
- 结构化动作通过 function call 收集，不从自然语言猜测

**B5. 语音模式（可选）**
- 开局时铲屎官可选择"文字模式"或"语音模式"
- 语音模式下：猫猫发言通过 audio rich block 输出（TTS 合成），不用文字
- 复用 F066 Voice Pipeline（Qwen3-TTS，各猫各有声线）

**B6. 前端游戏 UI**（KD-12 + KD-13，与 gpt52 讨论定案）
- **GameShell**：全屏接管，替换常规 chat chrome，隐藏左大厅+右状态栏
- **玩家视角布局（C 方案）**：
  - 顶部常驻：`PhaseTimeline` + 倒计时
  - 次顶部：`PlayerGrid`（存活/出局/投票指示）
  - 中间：事件流（公共事件+发言）
  - 底部 sticky：`ActionDock`（技能选择/投票/发言，用 interactive rich block）
- **上帝视角布局（C 变体）**：
  - 同上，但中间区 70% 事件流 + 30% **God Inspector** 右侧面板
  - God Inspector 三层：Seat Matrix（角色+存活+行动状态）→ Night Timeline（结算顺序）→ Scope Tabs（All/Wolves/Seer/Witch/Resolve）
  - 移动端降级为右侧抽屉
- **夜间等待体验**：只显示阶段名+倒计时+个人状态+氛围文案，不显示行动进度数字（防泄露）
- 翻牌仪式：interactive rich block 点击揭牌
- 日夜氛围联动：CSS 变量切换（夜间压暗+降饱和度）

### Phase D: 狼人杀重做 — 铲屎官 1v1 采访定案（2026-03-14）

基于铲屎官 1v1 采访（2026-03-14 22:30），Phase D 是对 Phase A-C 的体验重做。

**D1. 独立游戏 Thread**
- 游戏在**独立 thread** 中运行（类似 bootcamp 训练营），不在现有聊天 thread 上叠加
- 归档分类：`游戏-狼人杀`，在左侧栏可快速定位（参考现有 cat-cafe / studio-flow / 未分类 project 分类体系）
- **KD-18**: 游戏和日常聊天完全隔离，游戏有专属空间

**D2. 猫猫身份保留**
- 猫猫在游戏内**保留咖啡馆身份**（宪宪/砚砚/烁烁），不需要新 persona
- 复用现有头像系统（CatAvatar + `/avatars/{catId}.png`）
- **KD-19**: 不需要"玩家3"之类的通用身份，猫猫就是猫猫

**D3. 上帝操控面板**
- 发牌（手动分配角色）✅
- 暂停/恢复（"我要去上厕所你们总得等等我"）✅
- 跳过当前阶段（帮卡住的局面推进）✅
- ~~踢人~~（铲屎官："太过分了 猫猫做错什么了"）❌
- **KD-20**: 上帝面板三个核心按钮：发牌、暂停/恢复、跳过当前阶段

**D4. 真实到达/就绪状态**
- 展示每只猫的**真实加载状态**，不做假动画
- 卡住的猫要有 loading 指示，铲屎官担心猫猫卡住看不到
- **KD-21**: ready 状态必须反映真实情况

**D5. 狼人猫猫风 UX**
- 设计关键词：**可爱 + 暗色调 + 猫猫穿狼人服装/装扮**
- 不是纯暗黑 RPG，不是纯可爱，是**猫猫 cosplay 狼人**的混搭风格
- 铲屎官原话："猫猫装狼人那种可爱的带点黑色的风格"
- **KD-22**: 视觉风格 = 狼人猫猫风（cute dark）

**D6. 战绩统计 + MVP**
- 游戏结束后需要**结算画面**：胜负、各玩家表现统计、MVP 评选
- 对接 Leaderboard F075
- **KD-23**: 每局结束必须有完整的战绩和 MVP

## Acceptance Criteria

### Phase A（Mode v2 通用基座）✅
- [x] AC-A1: `GameDefinition / GameRuntime / GameView` 类型定义完成，支持 workflow+game 双轨
- [x] AC-A2: GameEngine 可自主驱动 tick（不依赖用户消息），超时自动结算
- [x] AC-A3: Event log append-only + scope 裁剪，API/socket 只返回 GameView
- [x] AC-A4: ModeStore Redis 持久化，进程重启后可恢复游戏
- [x] AC-A5: 旧三 mode 代码完全删除，前端入口重写为游戏模式
- [x] AC-A6: 信息泄漏红线测试：不同 scope 的 actor 看不到不该看的事件

### Phase B（狼人杀 v1）⚠️ 重新打开
- [x] AC-B1: 7 人局可完整跑通（lobby→deal→night/day 循环→结局）— ⚠️ 单元测试通过但 E2E 未验证
- [x] AC-B2: 铲屎官可选 player 或 god-view 参与
- [x] AC-B3: 猫猫 AI 玩家能合理发言和执行夜间动作 — ✅ Phase C GameAutoPlayer 修复（PR #454），PR #478 补 hasActed 状态反馈
- [x] AC-B4: 信息隔离：村民看不到狼队夜聊、玩家看不到他人私密技能结果
- [x] AC-B5: 非法动作被拒绝（死人不能投票、白天不能用夜间技能等）
- [x] AC-B6: 断线重连后可恢复游戏状态（v1 简单刷 GameView）
- [x] AC-B7: PlayerGrid + PhaseTimeline 前端组件可用
- [x] AC-B8: 语音模式可选，猫猫用 audio rich block 发言

### Phase C（2026-03-14 补充 — 可用性修复）✅
- [x] AC-C1: GameShell 有关闭/返回按钮，用户可退出游戏回到聊天界面
- [x] AC-C2: 大厅流程 — 选板子（6/7/8/9/10/12人局）+ 配置参赛猫 + 确认开始
- [x] AC-C3: 猫猫 AI 自动行动 — GameAutoPlayer 驱动夜间技能 + 白天投票，游戏可推进
- [ ] AC-C4: **E2E 验收标准** — codex 或 gpt52 启动 dev 环境，铲屎官能真正进入并完成一局游戏

### Phase D（狼人杀重做 — 铲屎官采访定案）✅
- [x] AC-D1: 游戏在独立 thread 运行，归档分类 `游戏-狼人杀`，左侧栏可见
- [x] AC-D2: 猫猫保留咖啡馆身份（宪宪/砚砚/烁烁），复用现有头像系统
- [x] AC-D3: 上帝面板三按钮（发牌、暂停/恢复、跳过阶段），无踢人功能
- [x] AC-D4: 每只猫展示真实 ready 状态 + 卡住时有 loading 指示
- [x] AC-D5: 狼人猫猫风 UX（可爱+暗色调+猫猫 cosplay 狼人）— 需暹罗猫参与视觉资产
- [x] AC-D6: 结算画面 — 胜负 + 各玩家统计 + MVP 评选

### Phase E（Detective Mode 视觉增强）🚧
- [x] AC-E1: 上帝推理模式（Detective Mode）— 观战者开局选定一只猫，只能看到该玩家的身份和信息权限，其余座位只看到公开信息。铲屎官原话："只能选择一只猫看他身份，狼人杀观战模式那种"
  - 视觉：塔罗牌卡背 + 灵魂链接光效 + 翻牌仪式（烁烁提案）— ⬜ 视觉资产待暹罗猫
  - 技术：`GameViewBuilder` 新增 `detective` 视角，绑定 seatId 后继承该座位信息域 ✅
  - 前端视觉：紫色侦探主题 + soul-link-pulse + tarot-back — 🔄 PR review 中

### Phase F（核心体验修复 — 投票/透明度/超时）✅
- [x] AC-F1: GitHub agent werewolf 调研报告完成，覆盖 ≥3 个项目
- [x] AC-F2: God-view 夜晚时间线实时展示每个角色的具体行动目标
- [x] AC-F3: 已行动状态从二态改为五态（waiting/acting/acted/timed_out/fallback）
- [x] AC-F4: 多狼独立投票 + 多数票结算 + 平票处理
- [x] AC-F5: 白天投票可改票 + 全员 commit 提前结束
- [x] AC-F6: 超时未行动自动 fallback，游戏不卡住
- [x] AC-F7: 慢启动猫猫有 grace period + god-view 展示真实连接状态
- [x] AC-F8: 铲屎官在 god-view 能清楚理解"正在发生什么"（不再一脸懵逼）

### Phase H6（Chat UI 重做 — 对齐 .pen 设计稿）✅

愿景守护 review by 布偶猫 Opus 4.5（2026-03-19）→ 踢回 → 修复 → codex review 放行 → merged

| # | AC | 承诺 | 当前状态 |
|---|-----|------|----------|
| 1 | — | 系统报幕渲染为**卡片样式**（红色/金色） | ✅ ANNOUNCE_CARD_TYPES + getAnnounceCardStyle |
| 2 | — | 聊天气泡带**头像圆圈** | ✅ 32px avatar + seatToActor 映射 |
| 3 | — | `activeSeatId` 传递到 PlayerGrid | ✅ GameOverlay 推导 + 传递 |
| 4 | — | displayName 格式 "布偶猫(opus)" | ✅ GameViewBuilder.enrichDisplayName via catRegistry |
| 5 | — | 发言中玩家**金色边框** | ✅ border-[var(--ww-state-speaking)] |
| — | AC-H12 | `<EventFlow>` 替换为 `<ChatMessageList>` | ⚠️ EventFlow 已重做样式但未换成 ChatMessageList 组件（非阻塞，渲染效果已对齐设计稿） |

### Phase H3+H4（LLM AI Bridge + AI Speech with Context）✅

- [x] AC-H3: 夜间动作通过 LLM 推理决定（不再是 pickRandom），10s 超时 fallback
- [x] AC-H4: 讨论/遗言/投票理由通过 LLM 生成真实中文文本，有角色特征
- [x] AC-H7: LLM 超时 10s 后降级到 random，游戏不卡住
- [x] AC-H11: LLM 上下文连贯 — 后发言猫的 context 包含前面猫的发言

**改动概要**：
- `LlmAIProvider.ts`（新增）: Anthropic/OpenAI/Google HTTP API 路由，10s 超时
- `GameAutoPlayer.ts`: buildAction 先 LLM 后 random，phase+role 白名单校验
- WerewolfAIPlayer（死代码）激活，连接到 GameAutoPlayer
- messageStore 注入 GameAutoPlayer（3 处）用于 H4 对话上下文
- 237 tests（+2 new regression guards）

### Phase I（Agent-Driven Game — 猫猫真正玩游戏）🚧

铲屎官 2026-03-20 批评：当前 `GameAutoPlayer` + `LlmAIProvider` 只是裸调 LLM API，猫猫根本不知道自己在玩游戏。三猫（金渐层诊断 + 布偶猫架构 + 缅因猫审查）一致同意重做驱动层。

**P0 前置条件（信息隔离安全加固，缅因猫审查门禁：不加就不开工）**：
- [x] AC-I-P0a: Session API catId 授权 — `list_session_chain` / `read_session_events` / `read_invocation_detail` 默认只返回调用者自己的 session，防跨猫读取内心独白
- [x] AC-I-P0b: Evidence 索引排除游戏 thread — `threadListFn` 过滤 `projectPath.startsWith('games/')`，游戏内容不入检索
- [x] AC-I-P0c: 游戏行动走结构化工具 `submit_game_action`（gameId/round/phase/seat/action/target/nonce），引擎端做 phase/seat/role/合法性校验；`post_message` 只用于公开发言和叙事播报

**核心功能**：
- [ ] AC-I1: 猫猫通过 A2A mention 协议（`post_message` → dispatch → CLI `--resume`）参与游戏，不再裸调 HTTP API
- [ ] AC-I2: GameNarrator 发叙事消息到游戏 thread（天黑请闭眼 → 守卫请睁眼 → ...），可见节奏
- [ ] AC-I3: 首次唤醒 Briefing — 猫猫收到完整上下文：身份、队友（如有）、存活状况、行动指引、规则约束
- [ ] AC-I4: 后续 Resume Capsule — 导航指引 + 关键摘要 + 搜索提示（KD-35），不做全量状态 dump
- [ ] AC-I5: Session seal 后 re-briefing — 如果 CLI session 因上下文溢出被 seal，新 session 注入完整 resume capsule
- [ ] AC-I6: 讨论环节顺序发言 — 按座位序轮流 @猫猫，后发言者能看到前面猫说了什么
- [ ] AC-I7: 时限从固定相位超时改为每角色预算制（夜晚 45s/角色，讨论 30s/发言者，投票 20s/投票者）+ 全局单局 30min 天花板
- [ ] AC-I8: `GameDriver` 接口兼容层 — `GameAutoPlayer` 包装为 `LegacyAutoDriver`（✅ PR #654），新 `GameNarratorDriver` 实现同接口，feature flag 切换（待做）
- [ ] AC-I9: 游戏 thread 创建时自动设 `thinkingMode: 'play'`（心里话模式），CLI 内思考不广播（KD-36）
- [ ] AC-I10: 端到端验证 — 7 人局完整跑通，猫猫 CLI agent 真正接入，叙事流可观，信息隔离红线测试通过

### Phase H1+H2（报幕层 + 模板发言 + messageStore 双写）✅

- [x] AC-H1: 天亮公告 — `day_announce` 阶段产出 `scope: 'public'` 的 dawn_announce 事件 + messageStore 双写
- [x] AC-H2: 模板发言 — 讨论阶段每只猫提交带文本的 speech 事件 + messageStore 双写
- [x] AC-H8: 规则引擎 bug RB-1~RB-8 修复（SKIP_PHASES 拆分、announce 事件、遗言、exile 公告）
- [x] AC-H9: 所有报幕/发言/投票结果写入 gameThread 的 messageStore

**改动概要**：
- `GameAutoPlayer.ts`: SKIP_PHASES → ANNOUNCE_PHASES 分离 + 模板发言
- `GameOrchestrator.ts`: writeAnnounce/writeSpeech 双写 + resolveLastWords（entering 时机）
- `WerewolfDefinition.ts`: 阶段重排 day_last_words+day_hunter 在 day_exile 之后（⚠️ day_hunter 编排层当前 auto-skip，引擎层保留，需 special resolve phase 接通）
- 3 处 messageStore 注入（games.ts / messages.ts / index.ts）+ observerUserId
- 4 个新 regression guard 测试

### Phase G（AutoPlayer 存活性 — loop 恢复 + 运行时日志）✅
- [x] AC-G1: API 启动时扫描活跃游戏（Redis status=playing），自动恢复 `startLoop()`
- [x] AC-G2: `GameAutoPlayer` 有运行时日志（loop started/tick/action submitted/error/exited）
- [x] AC-G3: 铲屎官开局后 API 重启，游戏自动恢复推进（不卡在"全员等待"）

**根因（2026-03-16 砚砚 GPT-5.4 + 宪宪联合定位）**：
- `GameAutoPlayer.startLoop()` 是纯内存异步循环，只在创建游戏时挂一次
- API 进程退出/崩溃后，Redis 里游戏状态还在，但驱动循环丢失
- 前端倒计时是纯本地 `setInterval`，API 死了照样倒到 0，造成"倒计时结束无事发生"假象
- 当前自动行动是本地随机逻辑（`pickRandom`），不是 CLI/LLM — 所以不是"Gemini 启动慢"

### Phase F: 核心体验修复 — 投票/透明度/超时/行动真实性（2026-03-16）

铲屎官 2026-03-16 实测发现的核心体验 bug。先调研 GitHub agent 狼人杀项目（AIWolf 等），再设计修复方案。

**F1. 调研 + 设计**
- GitHub agent werewolf 项目竞品调研（AIWolf、LLM werewolf 等）
- 重点：多狼投票协调、观战者信息透明度、超时处理、改票机制、行动真实性
- 输出调研报告 `docs/research/2026-03-16-agent-werewolf-survey/`

**F2. 行动透明度 + God-View 信息丰富**
- 夜间行动提交时立刻写入 event log（scope: `faction:wolf` / `god` / `seat:x`）
- God-view 夜晚时间线实时展示具体行动目标（不只是"已行动"）
- `hasActed` 从二态改为三态：`waiting` / `acting` / `acted`

**F3. 多狼投票 + 白天投票改票**
- 多狼场景：每只狼独立提交 kill target，多数票结算，平票处理
- 白天投票：可改票 + 全员 commit 提前结束 + 实时可见

**F4. 超时 Fallback + 慢猫容错**
- 超时未行动 → 自动 fallback（wolf: 随机杀、seer: 随机查、村民: 弃票）
- 慢启动猫猫（Gemini 等）增加 warmup grace period
- God-view 展示猫猫真实状态：connecting / thinking / timed-out

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "狼人杀这种需要额外制作一个系统的" | AC-A1,A2 | test | [x] |
| R2 | "铲屎官可以选择当你们的玩家" | AC-B2 | manual | [x] |
| R3 | "也可以选择是上帝视角去观看" | AC-B2 | manual | [x] |
| R4 | "甚至我可以选择我来当法官" | — | v2 | [-] |
| R5 | "不同规则、不同剧本都是怎么样做的" | AC-A1 | test | [x] |
| R6 | "你们是需要开发一个法官" | AC-B1 | test | [x] |
| R7 | "开源仓有蛮多的，如何让 agent 玩起来狼人杀的" | KD-1 | — | [x] |
| R8 | "可能需要用语音玩...开游戏的时候选择要不要让你们用语音玩" | AC-B8 | manual | [x] |
| R9 | "网易的狼人杀的规则，大家知道的多" | AC-B1 | test | [x] |
| R10 | "允许你们说遗言" | AC-B1 | test | [x] |
| R11 | "新建独立 thread，类似新手训练营那样独立" | AC-D1 | manual | [x] |
| R12 | "还是猫猫咖啡的猫猫！！！" | AC-D2 | manual | [x] |
| R13 | "发牌✅ 暂停✅ 踢人❌ 跳过超时✅" | AC-D3 | manual | [x] |
| R14 | "展示真实状态，不是假动画" | AC-D4 | manual | [x] |
| R15 | "猫猫装狼人那种可爱的带点黑色的风格" | AC-D5 | manual+design | [x] |
| R16 | "要战绩统计 + MVP" | AC-D6 | manual | [x] |
| R17 | "只能选择一只猫看他身份，狼人杀观战模式那种" | AC-E1 | manual | [x] |
| R18 | "看不到他们投了谁" | AC-F2 | manual + screenshot | [ ] |
| R19 | "gemini 还没启动起来…30s到及时结束gemini还没行动整个游戏又卡了" | AC-F6, AC-F7 | test + manual | [ ] |
| R20 | "太不透明了…真的有输出吗？几乎秒行动" | AC-F3, AC-F8 | manual + screenshot | [ ] |
| R21 | "到底我们现在是出bug了还是猫猫在吗了" | AC-F8, AC-F7 | manual | [ ] |
| R22 | "票数一样就随机？可以一直改票？以timeout为准？全部commit？" | AC-F4, AC-F5 | test + manual | [ ] |
| R23 | "猫猫 agent 都没接入！能不能想想看人类是如何玩狼人杀的！天黑请闭眼→等待谁行动→真的调 AI Agent" | AC-I1~I9 | E2E + manual | [ ] |
| R24 | "第一次拉起来要告诉身份/队友/状态/怎么行动" | AC-I3 | test | [ ] |
| R25 | "后面 resume 要告诉别人现在什么样子" | AC-I4, AC-I5 | test | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [x] 前端需求已准备需求→证据映射表

### 需求→证据映射

| 需求 | 证据 |
|------|------|
| R1 (游戏系统) | `GameDefinition` / `GameRuntime` / `GameView` 类型体系 + 92 API tests |
| R2 (player 模式) | `GameViewBuilder` humanRole='player' + `humanSeat` 裁剪 |
| R3 (god-view 模式) | `GameViewBuilder` humanRole='god-view' + `GodInspector` 组件 |
| R4 (judge 模式) | v2 scope（KD-5） |
| R5 (可扩展规则) | `GameDefinition` 抽象 + `WerewolfDefinition` 首个实现 |
| R6 (纯代码法官) | `GameEngine` 确定性结算，0 LLM 依赖 |
| R8 (语音模式) | `voiceMode` config + audio rich block 输出 |
| R9 (网易规则) | `WerewolfDefinition` 遵循网易标准 + 无警长竞选 |
| R10 (遗言) | `day_last_words` phase ✅ + `day_hunter` shoot ⚠️ deferred（引擎层支持但编排层需 special resolve phase，见 TODO） |

## Dependencies

- **Evolved from**: F011（模式系统 v1 — brainstorm/debate/dev-loop）
- **Related**: F086（Cat Orchestration — multi_mention 可复用于游戏内猫猫协作）
- **Related**: F066（Voice Pipeline — 语音模式复用 TTS 能力）
- **Related**: F103（Per-Cat Voice Identity — 多猫语音模式需要独立声线）

## Risk

| 风险 | 缓解 |
|------|------|
| 信息隔离不严导致"作弊" | 服务端 scope 裁剪 + 红线测试（AC-A6, AC-B4） |
| 猫猫 LLM 不遵守游戏规则（自然语言泄露身份） | 结构化动作强制 function call，发言内容由 LLM 自主但不影响结算 |
| 删除旧 mode 影响现有 thread | 旧 mode 几乎没人用，直接清理 |
| 游戏状态丢失（进程重启） | Redis 持久化 + append-only event log 可重放（AC-A4, AC-B6） |
| 前端复杂度高 | Phase B5 与暹罗猫协作，先组件化再组合 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 角色配置是否可自定义？ | ✅ 是，铲屎官开局可选（KD-7） |
| OQ-2 | 夜间动作超时时间？ | ✅ 3-5 分钟，全员提交可提前（KD-8） |
| OQ-3 | 是否需要警长竞选？ | ✅ 不要，用网易狼人杀标准规则（KD-9） |
| OQ-4 | 是否有遗言阶段？ | ✅ 有（KD-10） |
| OQ-5 | judge 模式的具体交互细节 | ⬜ v2 再设计 |
| OQ-6 | 同一 thread 是否支持多局并发？ | ✅ 不支持，单局/thread（KD-15） |
| OQ-7 | 断线重连 UX？ | ✅ 技术细节找 gpt52 讨论（KD-17），v1 简单刷 GameView |
| OQ-8 | 历史战绩如何查看？ | ✅ 对接 Leaderboard F075（KD-16） |
| OQ-9 | Phase D 独立 thread 如何创建和归档？ | ⬜ 需调研现有 thread/project 分类系统 |
| OQ-10 | 上帝面板 UX 细节（发牌/暂停/跳过的交互） | ⬜ 需设计 |
| OQ-11 | 狼人猫猫风视觉资产（头像装扮/氛围图） | ⬜ 可能需要暹罗猫参与设计 |
| OQ-12 | 平票时随机 vs 按座位序 vs 重新投票（PK）？ | ✅ no_kill（空刀），铲屎官确认"一般是这样"（KD-25） |
| OQ-13 | 白天投票实名公开还是匿名后揭晓？ | ✅ 实名公开，"推理的重要信息"（KD-26） |
| OQ-14 | 狼人内部讨论要不要做成聊天形式（faction channel）？ | ✅ 要做，只在夜间，讨论时间待定（KD-27） |
| OQ-15 | 猎人死亡开枪（day_hunter death-trigger）如何实现？ | ⚠️ **v1 降级**：引擎层 `hunterShoot()` 已实现，但编排层需要 special resolve phase（死座位不能提交 action）。当前 auto-skip，不卡局。需要在 `skipEmptyPhases` 之外新建死后触发机制。GPT-5.4 review 2026-03-19 确认。 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 借鉴 AIWolf 协议边界，不抄 prompt | AIWolf 的 vote/attack/guard/divine + talk/whisper 分离 + 服务器驱动生命周期最成熟 | 2026-03-11 |
| KD-2 | 法官 = 纯代码 GameEngine，不用 LLM | 规则裁判必须确定性，LLM 只做发言策略 | 2026-03-11 |
| KD-3 | 信息隔离 = 服务端 scoped event log + 视图裁剪 | 前端子 Thread 只做 UX 呈现，真相源在 server | 2026-03-11 |
| KD-4 | seat/actor/role 三层分离 | seat=位置, actor=实体(人/猫), role=游戏角色，让人类和猫在架构上完全对称 | 2026-03-11 |
| KD-5 | v1 只做 player + god-view，judge 放 v2 | judge 模式 scope 翻倍，v1 先跑通核心 | 2026-03-11 |
| KD-6 | 旧三 mode **直接删除**，不做兼容 | 铲屎官拍板：面向终态开发，垃圾清掉 | 2026-03-11 |
| KD-7 | 角色配置可自定义 | 铲屎官开局选角色组合，默认 7 人局 | 2026-03-11 |
| KD-8 | 超时 3-5 分钟，全员提交可提前进入下阶段 | 猫猫推理慢（几秒不够），但全员完成不用空等 | 2026-03-11 |
| KD-9 | 网易狼人杀规则，无警长竞选 | 大家都熟悉的规则 | 2026-03-11 |
| KD-10 | 有遗言阶段 | 铲屎官确认 | 2026-03-11 |
| KD-11 | 语音模式可选 | 开局选文字/语音，语音模式猫猫用 audio rich block 发言 | 2026-03-11 |
| KD-12 | 全屏接管布局 | 进入游戏后收掉左侧大厅+右侧状态栏，狼人杀专属全屏体验 | 2026-03-11 |
| KD-13 | 玩家 C 方案 + 上帝 C 变体 + 夜间无泄露 | 顶部局势带+中间事件流+底部操作区；上帝加右侧 God Inspector 30%；夜间不显示行动进度数字 | 2026-03-11 |
| KD-14 | 头像复用现有 CatAvatar 系统，不做独立管线 | 见下方「头像系统调查」，已有完整的 catId→avatar 解析链，游戏内 PlayerGrid 直接用 `/avatars/{catId}.png` + `CatAvatar.tsx` fallback | 2026-03-11 |
| KD-15 | 同一 thread 单局，不做多局并发 | 铲屎官拍板：一个 thread 只跑一局游戏，想开新局就新 thread | 2026-03-11 |
| KD-16 | 游戏战绩对接 Leaderboard（F075） | 所有游戏模式（狼人杀/三国杀/猜猜我是谁等）统一接入现有排行榜系统，历史战绩通过排行榜查看 | 2026-03-11 |
| KD-17 | 技术细节（断线重连/AI策略等）找 gpt52 讨论，不找铲屎官 | 铲屎官："涉及技术你找 GPT-5.4 讨论都比我靠谱" | 2026-03-11 |
| KD-18 | 游戏在独立 thread 运行，归档分类 `游戏-狼人杀` | 铲屎官希望游戏和日常聊天完全隔离 | 2026-03-14 |
| KD-19 | 猫猫保留咖啡馆身份，不需要新 persona | 铲屎官："还是猫猫咖啡的猫猫！！！" | 2026-03-14 |
| KD-20 | 上帝面板：发牌+暂停+跳过，**不要踢人** | 铲屎官："太过分了 猫猫做错什么了" | 2026-03-14 |
| KD-21 | 展示真实 ready 状态，不做假动画 | 铲屎官担心猫猫卡住看不到 | 2026-03-14 |
| KD-22 | 狼人猫猫风 UX = 可爱+暗色调+猫猫 cosplay 狼人 | 铲屎官："猫猫装狼人那种可爱的带点黑色的风格" | 2026-03-14 |
| KD-23 | 结算画面：胜负+统计+MVP | 铲屎官确认 | 2026-03-14 |
| KD-24 | 上帝推理模式（Detective Mode）列入 Phase E | 观战者绑定单座位视角，增加悬念和代入感，不在 Phase D scope | 2026-03-15 |
| KD-25 | 平票 = no_kill（空刀），默认保守 | 铲屎官："no_kill 好像确实？一般是这样！" | 2026-03-16 |
| KD-26 | 白天投票实名公开（实时可见） | 铲屎官："要公开吧？这是推理的重要信息" | 2026-03-16 |
| KD-27 | 狼队 faction channel 讨论 — 只在夜间，讨论时间需考虑猫猫 LLM 响应速度 | 铲屎官确认要做，担心猫猫"大屁股太慢了"讨论不完 | 2026-03-16 |
| KD-28 | 狼队讨论 30s + 投票在同一阶段；首回合 grace：布偶猫 +6s / 缅因猫 +12s / 暹罗猫 +30s | 铲屎官确认 30s 可以，"走起" | 2026-03-16 |
| KD-29 | 猫猫通过 A2A mention 协议参与游戏，不再裸调 HTTP API | 铲屎官批评"猫猫 agent 都没接入"——`LlmAIProvider` 只是无状态 HTTP 调 LLM，猫猫根本不知道自己在玩游戏。三猫（金渐层诊断 + 布偶猫架构 + 缅因猫审查）一致同意 | 2026-03-20 |
| KD-30 | 保留 WerewolfEngine 规则引擎，只重写驱动层（GameAutoPlayer → GameNarratorDriver） | 规则核 + 信息隔离层 + 事件日志已验证，只有"谁来驱动猫猫行动"需要重做 | 2026-03-20 |
| KD-31 | 驱动契约兼容层 — 抽 `GameDriver` 接口，新旧 driver 实现同契约，feature flag 切换 | 砚砚审查发现 `GameAutoPlayer` 被 routes/startup/recovery 硬依赖，直删会破主流程（P1 风险） | 2026-03-20 |
| KD-32 | 时限从固定相位超时改为每角色预算制 | 砚砚审查发现顺序唤醒猫猫（30-60s/只）会和当前固定 180s/120s 相位超时冲突，导致误 fallback（P1 风险） | 2026-03-20 |
| KD-33 | 复用现有 `invoke-single-cat.ts` session 管理，同 thread = 同 session chain（自动 resume） | 铲屎官提醒"CLI new session vs resume 别搞错"——游戏在独立 thread，`sessionManager.get(userId, catId, threadId)` 天然按 thread 隔离 session | 2026-03-20 |
| KD-34 | Session seal 后必须注入完整 re-briefing（不假设猫猫还记得） | resume 时默认不注入 systemPrompt，briefing 放在消息内容里；session seal 后新 session 需完整 resume capsule | 2026-03-20 |
| KD-35 | Resume capsule = 导航指引 + 关键摘要 + 搜索提示，不做全量状态 dump | 铲屎官指出猫猫有 MCP 搜索 thread 能力（search_evidence / get_thread_context / read_session_events）。Resume 时给关键信息（身份/阶段/存活）+ 提示猫猫主动搜索 thread 历史恢复策略记忆。这考验每只猫的搜索和上下文恢复能力——更像人类凭记忆+回忆玩游戏 | 2026-03-20 |
| KD-36 | 信息隔离 = 心里话模式（`thinkingMode: 'play'`），不需要额外 MCP 权限层 | 铲屎官指出：CLI 内 = 心里话（`origin: 'stream'`，play 模式不 broadcast），`post_message` = 说话（`origin: 'callback'`，进入 thread）。游戏 thread 全程 play 模式，猫猫内心推理天然私密，只有 post_message 发出的才是公开/定向消息。比"三层 MCP 过滤"优雅得多 | 2026-03-20 |
| KD-37 | 游戏 thread 不入 evidence 索引 | 铲屎官指出：写代码的猫搜狼人杀搜出游戏内容很奇怪。`threadListFn` 应过滤 `projectPath.startsWith('games/')` 的 thread，不送入 IndexBuilder | 2026-03-20 |
| KD-38 | 游戏行动走结构化 MCP 工具 `submit_game_action`，不走 `post_message` whisper | 缅因猫审查：自由文本解析不可靠，whisper scope 和游戏 scope 不完全对齐。结构化工具带 `gameId/round/phase/seat/action/target/nonce`，引擎端做完整校验。`post_message` 只用于公开发言和叙事播报 | 2026-03-20 |
| KD-39 | Session API 加 catId 授权（P0 安全加固） | 缅因猫审查实锤：`list_session_chain` + `read_session_events` 按 userId 授权不按 catId，狼人可读预言家完整 session 内心独白。必须封堵后才能推进 Phase I | 2026-03-20 |
| KD-40 | 信息隔离四层架构：play 模式（心里话不广播）+ Session catId 授权 + Evidence 索引排除 + 结构化行动工具 | play 模式只防 WebSocket broadcast（Layer 1），不是唯一隔离层。需要 Session 权限（Layer 2）+ 索引排除（Layer 3）+ 行动分流（Layer 4）形成完整防线。缅因猫门禁：Layer 2+3 不加就不放行 | 2026-03-20 |

## 头像系统调查（KD-14 依据）

> 2026-03-11 调查，铲屎官指出 @ 弹出面板已有完整头像映射

### 现有系统数据流

```
cat-config.json (breeds[].avatar + variants[].avatar)
    ↓
API: GET /api/cats（routes/cats.ts）
    ↓
useCatData() hook（hooks/useCatData.ts:59-69）
    ↓
buildCatOptions()（chat-input-options.ts:21-32）→ CatOption.avatar
    ↓
ChatInputMenus.tsx:50  <img src={opt.avatar} />
CatAvatar.tsx:44       src={cat?.avatar ?? `/avatars/${catId}.png`}
    ↓
packages/web/public/avatars/*.png（静态文件服务）
```

### 可用头像文件（`packages/web/public/avatars/`）

| catId | 文件名 | 说明 |
|-------|--------|------|
| opus | `opus.png` | 布偶猫 Opus 4.6（紫垫子） |
| sonnet | `sonnet.png` | 布偶猫 Sonnet（坐在玻璃杯里） |
| opus-45 | `opus-45.png` | 布偶猫 Opus 4.5（躺在纸箱里，紫项圈） |
| codex | `codex.png` | 缅因猫 Codex（GPT 铭牌） |
| gpt52 | `gpt52.png` | 缅因猫 GPT-5.4（趴在 RGB 键盘上） |
| spark | `sliced-finial/codex_box.png` | 缅因猫 Spark |
| gemini | `gemini.png` | 暹罗猫 Gemini（蓝垫子+画笔） |
| gemini25 | `gemini25.png` | 暹罗猫 Gemini 2.5 |
| dare | `dare.png` | 狸花猫 Dare |
| antigravity | `antigravity.png` | 孟加拉猫（豹纹+棱镜吊坠） |
| owner | `owner.jpg` | 铲屎官（`Landy.png` 在 assets/avatars/ 也有一份海豚版） |

### 游戏集成方案

GameView 的 `SeatView` 只需携带 `actorId`（= catId），前端直接用 `<CatAvatar catId={seat.actorId} />` 渲染，**零额外开发**。铲屎官的 seat 用 `owner` 作为 actorId，fallback 到 `/avatars/owner.jpg`。

设计稿里的座位命名规范：`{昵称}-{模型简称}`（如"宪宪-Opus"、"砚砚-GPT"），与 @ 面板一致。

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-11 | 四猫讨论收敛 + 立项 + 铲屎官决策落实 |
| 2026-03-11 | UX 设计稿完成（3屏 Pencil wireframe）+ 头像系统调查 |
| 2026-03-11 | **Design Gate 通过**：铲屎官确认设计稿 + 补充 KD-15/16/17 |
| 2026-03-12 | Phase A+B backend merged (PR #400) — 92 tests, 21 commits squashed |
| 2026-03-12 | Phase B frontend merged (PR #406) — 98 game tests, 13 commits squashed |
| 2026-03-12 | **愿景守护通过**（缅因猫 GPT-5.4）→ F101 v1 完成 |
| 2026-03-12 | AC-A5 补充清理：前端旧 mode UI 删除 (PR #415) |
| 2026-03-13 | AC-A5 修复：恢复游戏入口 — 两层菜单 + SVG 图标 (PR #426) |
| 2026-03-14 | Bug fix: outside-click handler React 18 flush 竞态 (PR #444) |
| 2026-03-14 | Bug fix: /game command bridge — intercept chat command to start game (PR #446) |
| 2026-03-14 | **重新打开** — 铲屎官实际测试发现不可用：无关闭按钮/无大厅/猫不行动（LL-032） |
| 2026-03-14 | Phase C merged (PR #454) — close button, lobby, AI auto-play, security hardening (codex review 2 rounds) |
| 2026-03-14 | **Phase D 愿景采访** — 铲屎官 1v1 回答 6 个关键问题，定案独立 thread + 猫猫身份保留 + 上帝面板 + 狼人猫猫风 + 战绩 MVP |
| 2026-03-15 | Phase D merged (PR #463) — 独立 thread + 上帝面板(pause/resume/skip) + 结算 MVP + win condition + ready state + race fix (codex review 3 rounds) |
| 2026-03-15 | AC-D5 视觉设计稿完成 — 4 屏狼人猫猫风主题（三猫讨论收敛 + 布偶猫画 pen），Phase E backlog 加入上帝推理模式 |
| 2026-03-15 | AC-D5 PR-A merged (PR #466) — token-only CSS vars + data-theme/data-phase 挂载（零视觉变化，PR-B 待做组件替换） |
| 2026-03-15 | AC-D5 PR-B merged (PR #467) — 12 组件 token 替换 + 5 soft token + GameLobby/NightActionCard 全量迁移（codex review 3 rounds） |
| 2026-03-15 | Phase D game startup API merged (PR #471) — dedicated POST /api/game/start + HTTP navigation, eliminates 布偶猫思考中 loading (codex 3-round local + 3-round cloud review) |
| 2026-03-15 | Phase E detective mode merged (PR #474) — scoped observer view, GameViewBuilder detective viewer, lobby binding UI (codex 1-round local + 2-round cloud review) |
| 2026-03-15 | i18n + lobby fix merged (PR #477) — 游戏 UI 中文化 + lobby 默认不全选猫猫 |
| 2026-03-15 | 3x P1 game state fixes merged (PR #478) — observer broadcast + real countdown + seat hasActed status + info-isolation regression tests (codex 1-round local + 3-round cloud review) |
| 2026-03-16 | Bug fix: auto-skip empty phases merged (PR #481) — GameOrchestrator.skipEmptyPhases() skips action phases when no alive seat matches actingRole (codex 1-round local + cloud review) |
| 2026-03-16 | Phase E detective visuals PR 提交 — soul-link-pulse + tarot-back + purple theme（codex review 中） |
| 2026-03-16 | **Phase F 立项** — 铲屎官实测反馈：投票不透明/行动真实性存疑/超时卡游戏/Gemini 启动慢。启动 GitHub agent werewolf 调研 |
| 2026-03-16 | Phase F gameplay fixes merged (PR #491) — resolution bridge, multi-wolf ballot, day vote transparency, timeout fallback, grace period, god-view ballot panel (codex 2-round local + 5-round cloud review) |
| 2026-03-16 | Phase G AutoPlayer recovery merged (PR #505) — startLoop recovery on API startup + runtime logs + keyPrefix fix (codex 1-round local + 1-round cloud review) |
| 2026-03-17 | **Phase H 立项** — 铲屎官实测：1s 出全部结果/无天亮公告/发言空壳/消息无承载。三层架构设计（报幕层 + AI 行动层 + 发言层） |
| 2026-03-19 | Phase H1+H2 merged (PR #576) — announce layer + template speech + messageStore dual-write + phase order fix + observerUserId fix (codex 6-round local review) |
| 2026-03-19 | Phase H3+H4 merged (PR #577) — LLM AI bridge + AI speech with messageStore context + phase+role whitelist + route-level tests (codex 3-round local review) |
| 2026-03-20 | **Phase I 立项** — 铲屎官批评猫猫 agent 未接入。三猫讨论（金渐层诊断 + 布偶猫架构 + 缅因猫审查）收敛：保留引擎层，重写驱动层为 A2A mention 协议，复用现有 session 管理。KD-29~34 |
| 2026-03-22 | Phase I P0 security + GameDriver merged (PR #654) — session catId auth, evidence exclusion, submit_game_action three-layer auth, GameDriver interface + LegacyAutoDriver (codex 3-round local review) |
| 2026-03-23 | Phase I bug fix merged (PR #685) — narrator eventLog routing + briefing info leak fix + OCC stale-runtime fix. 砚砚 2-round code review + 布偶猫愿景守护 + cloud review (P1→P3 downgrade). Squash merged `c1a0d625` |
| 2026-03-25 | Phase I bug fix merged (PR #703) — game thread virtual projectPath (`games/werewolf`) triggered F070 governance gate in invokeSingleCat → cats failed silently. Fix: skip `games/` prefix in workingDirectory resolution. 砚砚 1-round local review + Codex cloud review (0 findings). Squash merged `b6add125` |
| 2026-03-26 | **铲屎官实测 Phase I — 四个 runtime 问题（布偶猫自查）** |
| 2026-03-25 | Phase I bug fix merged (PR #729) — briefing tool name `submit_game_action` → `cat_cafe_submit_game_action` (R1) + overlay minimize instead of abort (R3) + "返回游戏" button with thread scope. 砚砚 local review + Codex cloud review |
| 2026-03-25 | Phase I bug fix merged (PR #743) — `GET /api/threads/:threadId/game` returns 200/null instead of 404 for non-game threads. Eliminates `reconnectGame()` 404 noise on every thread switch. 砚砚 local review + Codex cloud review (0 findings) |
| 2026-04-05 | Phase I round-2 bug fix merged (PR #976) — single-clock `forceSettle` (P1 dual-timeout fix) + `expectedPhase` guard (P1 double-advance race) + `appendGameSystemMessage` (P2 empty avatar). 砚砚 2-round local review + Codex cloud review (0 findings) |
| 2026-04-06 | Phase I round-3 bug fix merged (PR #980) — P0 Codex MCP 401 (`CAT_CAFE_CAT_ID` missing from `callbackKeys`) + P1 `night_thought` scope leak (village→god) + P2 displayName/actorId + narrator `startLoop` re-entry guard. 砚砚(codex) 2-round local review + 砚砚(gpt52) independent analysis + Codex cloud review |
| 2026-04-06 | Phase I UX fix merged (PR #981) — TIME_BUDGETS extended to 60s (night/discuss) + GodInspector emergency stop button. 砚砚(codex) 1-round local review + Codex cloud review |
| 2026-04-06 | Phase I witch fix merged (PR #982) — P0 non-wolf fallback→skip (no random potion use) + P0 witch briefing (kill target/potion state/heal-poison-skip) + P1 game composition in all briefings + P2 stop button feedback + e2e narrator test fix. 砚砚(codex) 1-round local review + Codex cloud 2-round review (P1 fix + re-review) |
| 2026-04-06 | Game thread UX fix merged (PR #983) — thread title with Asia/Shanghai timestamp + auto-pin on creation. 砚砚(codex) 1-round local review + Codex cloud review |
| 2026-04-06 | Phase I callback + witch fix merged (PR #985) — P0 non-Claude cats missing `cat_cafe_submit_game_action` (new `/api/callbacks/submit-game-action` route) + P0 witch heal missing target (healed player still died) + P1 cross-game thread isolation. 砚砚(codex) 2-round local review + Codex cloud review |
| 2026-04-12 | Callback route comment corrected (`cad7c89d7`) — "non-Claude cats lack MCP" was wrong; all major cats have `mcpSupport: true`. Callback route re-positioned as fallback safety net |
| 2026-04-12 | Game action observability merged (PR #1120) — three-layer evidence chain (wakeCat log + MCP stderr trace + API route structured logging) with `x-callback-invocation-id` correlation header. 砚砚(gpt52) implemented, 布偶猫 reviewed + Codex cloud review |

### Phase I Runtime Bugs（2026-03-26 铲屎官实测）

铲屎官开局后发现四个问题（thread_mn5nlufmcgjalg2j）：

**Bug I-R1（P0）：猫猫 MCP 调不通**
- 现象：缅因猫被成功唤醒（不再 "completed without textual output"），但调 `submit_game_action` 失败
- 已确认根因之一：briefing 里写 `submit_game_action` 但 MCP 工具注册名是 `cat_cafe_submit_game_action`（`briefing.ts:68`）。猫猫可能调了错误的工具名
- 待排查：是否还有其他原因（env var 传递、MCP server 连接等）

**Bug I-R2（P0，依赖 R1）：游戏界面无事发生**
- 现象：天黑请闭眼后 30 秒，游戏 UI 空白
- 原因：猫猫 MCP 调不通 → 行动提交失败 → ActionNotifier 等不到 action → narrator 卡在 waitForAllActions → 游戏不推进
- 修好 R1 后应自动解决

**Bug I-R3（P1）：聊天界面和游戏界面不通**
- 现象：猫猫的回应在聊天视图可见，但游戏 UI（GameShell z-50 全屏遮罩）看不到；从聊天界面点返回回不到游戏界面
- 根因：GameShell 的关闭按钮调用 `abortGame()`（发 DELETE 请求）直接结束游戏，不是"最小化"
- KD-13 原始设计："中间：事件流（公共事件+发言）"——事件流应同时显示叙事和猫猫发言
- 当 MCP 正常工作后，猫猫通过 `submit_game_action({ action: 'speak' })` 提交的发言会作为 speech 事件出现在 eventLog → EventFlow 已有 chat bubble 渲染逻辑。但当前因 R1 阻塞无法验证

**Bug I-R4（P2）：游戏进入时空头像**
- 现象：游戏一进去就有一个空头像和奇怪的发言
- 待排查：可能是 EventFlow 渲染了缺少 actorId/seatId 的事件

**Bug I-R5（P3）：非游戏 thread 切换时 reconnectGame 404 噪声**
- 现象：每次切换到非游戏 thread，控制台/网络面板出现 404
- 根因：金渐层 `ec24045c` 在 ChatContainer useEffect 里无条件对所有 thread 调 `reconnectGame(threadId)` → `GET /api/threads/:threadId/game` → 无活跃游戏 → 404
- 修复（PR #743）：API 语义修正，"查询无结果"从 404 改为 200/null。DELETE/POST 等写操作保持 404

### Phase I Runtime Bugs — 第二轮（2026-04-05 铲屎官 6 人局 thread_mnmeq5y0u44oj6k7）

**Bug I-R6（P1）：重复"狼人/预言家/女巫请睁眼" — narrator 重复开同一阶段** ✅ PR #976
- 现象：同一个 night phase 被 narrator 反复进入，重复唤醒猫猫，重复发"请睁眼"叙事
- 根因：`waitForAllActions` 超时返回后，narrator 外层 `runGameLoop` 重新读 gameStore → phase 未变 → 重新进入 `runNightRole` → 再发一次叙事再唤醒猫猫
- 砚砚修法：`waitForPhaseSettlement` 轮询等 orchestrator.tick() 推进 phase。方向正确，但 **引入了新的 P1**——见 I-R8
- 最终修法（PR #976）：narrator 用 `forceSettle(gameId, expectedPhase)` 直接推进，不依赖 `tick()` 轮询

**Bug I-R7（P2）：空头像 — 系统消息被渲染为普通用户气泡** ✅ PR #976
- 现象：开局"🎮 狼人杀 — 6人局 开始"和游戏公告显示为空头像的用户消息
- 根因：`writeAnnounce` 和 game start 消息用 `userId: observerUserId, catId: null` 存入 messageStore。API timeline 映射 `catId: null` → `type: 'user'` → 前端渲染为用户气泡
- 砚砚修法：`appendGameSystemMessage` helper，用 `userId: 'system', catId: 'system'`，API 优先判断 `isSystemUserMessage` → `type: 'system'`。正确

**Bug I-R8（P1）：`waitForPhaseSettlement` × `tick()` 双超时不同步 → 无限循环（砚砚修法引入）** ✅ PR #976
- 现象：铲屎官报"女巫请睁眼完全没有给我结束一局 bug 游戏"
- 根因：narrator `waitForAllActions(45s)` 和 orchestrator `tick()` 的 `phaseDef.timeoutMs` 是两套独立超时。narrator 超时返回后调 `tick()`，但 `tick()` 判断 `elapsed < effectiveTimeout` 认为"还没超时" → `tick()` 不推进 → `waitForPhaseSettlement` 每 200ms 轮询但 phase 永远不变
- `waitForPhaseSettlement` 没有 max-retry 或自身超时守卫，唯一出口是 signal.aborted 或 phase 变化
- 最终修法（PR #976）：`GameOrchestrator.forceSettle(gameId, expectedPhase?)` — narrator 直接调用跳过 elapsed-time 检查。`expectedPhase` 守卫防止 action route 已推进时双推进竞态

**Bug I-R9（P2）：暂停按钮不生效**
- 现象：铲屎官按暂停按钮但游戏继续循环
- 待验证：`pauseGame` 写 `status: 'paused'`，`waitForPhaseSettlement` 检查 `status !== 'playing'` 应该返回。可能是前端 API 调用问题或 gameStore 并发写覆盖

**Bug I-R10（P2）：`action.requested` + `action.submitted` 双事件显示**
- 现象：EventFlow 显示"P2 kill"和"P2 kill → P1"两条系统事件
- 根因：`handlePlayerAction` 每次提交 append 两个事件（`action.requested` 和 `action.submitted`），两者都匹配 `type.startsWith('action.')` → 都渲染为 system event
- 修法：EventFlow 过滤掉 `action.requested`（仅保留 `action.submitted`）

**Observation：为什么每次都 kill 布偶猫？**
- 不是代码 bug。角色分配有 Fisher-Yates 随机。但 seat 分配是确定性的（catIds 按 config 顺序排列）。LLM 可能有位置/名字偏好
- 建议：`buildGameSeats` 前 shuffle catIds 数组

### Pre-Design Gate TODO
- [x] **网易狼人杀规则调研**：详见 `docs/research/2026-03-11-netease-werewolf-rules.md`

## Review Gate

- Phase A: 缅因猫 review（安全重点：信息隔离 + 非法动作拒绝）
- Phase B: 缅因猫 review + 暹罗猫 design review（前端组件）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Evolved from** | `docs/features/F011-mode-system.md` | Mode v1（brainstorm/debate/dev-loop） |
| **Discussion** | Thread `thread_mmmt16riklhir6e4` | 2026-03-11 四猫讨论 |
| **Design doc** | `docs/plans/2026-02-10-f11-mode-system-design.md` | 旧 mode 设计文档 |
| **Research** | `docs/research/2026-03-11-netease-werewolf-rules.md` | 网易狼人杀规则（实现基准） |
| **UX Design** | `designs/f101-werewolf-game-ui.pen` | 7屏 Pencil（3 wireframe + 4 themed: Day/Night/God/Result 狼人猫猫风） |
| **Avatar system** | `packages/web/src/components/CatAvatar.tsx` | 头像渲染组件（fallback 到 `/avatars/{catId}.png`） |
| **Avatar data** | `packages/web/src/hooks/useCatData.ts` | catId→avatar 数据获取 |
| **Mention panel** | `packages/web/src/components/ChatInputMenus.tsx:50` | @ 面板头像展示 |
| **Avatar files** | `packages/web/public/avatars/` | 静态头像文件目录 |
| **External** | [AIWolf](https://aiwolf.org/) | 协议参考 |
| **External** | [Sentient werewolf-template](https://github.com/sentient-agi/werewolf-template) | 频道隔离参考 |
| **External** | [ChatArena Werewolf](https://github.com/xuyuzhuang11/Werewolf) | 环境裁决参考 |
| **PR** | PR #400 | Phase A+B backend（92 tests, 21 commits squashed） |
| **PR** | PR #406 | Phase B frontend（98 game tests, 13 commits squashed） |
| **PR** | PR #415 | AC-A5 supplementary cleanup — frontend old mode UI deletion |
| **PR** | PR #426 | AC-A5 fix — restore game entry with two-layer menu + SVG icons |
| **PR** | PR #444 | Bug fix — outside-click handler React 18 flush race |
| **PR** | PR #446 | Bug fix — /game command bridge (intercept → GameOrchestrator) |
| **PR** | PR #463 | Phase D — 独立 thread + 上帝面板 + 结算 MVP (codex 3-round review) |
| **PR** | PR #466 | AC-D5 PR-A — token-only CSS vars (werewolf-cute theme layer) |
| **PR** | PR #471 | Phase D — game startup via dedicated API + HTTP navigation (codex 3-round local + 3-round cloud review) |
| **PR** | PR #703 | Bug fix — game thread projectPath governance gate bypass (1-line fix + regression test) |
| **PR** | PR #729 | Bug fix — briefing tool name + overlay minimize (R1+R3) |
| **PR** | PR #743 | Bug fix — reconnectGame 404→200/null for non-game threads (R5) |
| **Plan** | `docs/plans/2026-03-12-f101-b8-frontend-game-ui.md` | B8 前端实施计划 |
| **Reflection** | `docs/reflections/2026-03-12-f101-mode-v2-capsule.md` | 完成反思胶囊 |
