---
feature_ids: [F101]
related_features: [F011]
topics: [mode, game, werewolf, game-engine]
doc_kind: spec
created: 2026-03-11
---

# F101: Mode v2 — 游戏系统引擎 + 狼人杀

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

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
- `ModeName/ModeConfig/ModeState` 从写死 3 种协作模式 → 支持 `workflow`（legacy）+ `game` 双轨
- 新增 `GameDefinition`（规则集）/ `GameRuntime`（运行时状态机）/ `GameView`（视图裁剪）三层抽象
- `seat / actor / role` 三层分离：seat=P1-Pn, actor=人类/猫/system, role=游戏角色

**A2. 执行模型改造**
- 从"用户发消息触发一轮 handler"→ 系统驱动 tick（GameEngine 自主推进夜晚/结算/投票）
- 支持超时自动结算（夜间动作超时 → 默认动作）
- ModeStore 从内存 Map → Redis 持久化（进程重启不丢局）

**A3. 信息隔离层**
- 统一 event log（append-only + version），每个事件带 `scope = public | seat:x | faction:wolf | judge | god`
- API 和 socket 只发 `GameView`（裁剪后视图），**禁止**全量 state 直出
- `GET /mode` 和 `mode_changed` socket 按请求者身份裁剪返回

**A4. 旧 mode 兼容**
- brainstorm/debate/dev-loop 标记 `legacy workflow`
- 前端 `/mode` 命令和 ModeStatusBar 下线旧入口
- 保留 API 兼容（不破坏已有 thread 历史）

### Phase B: 狼人杀 v1 — 首个游戏实现

在 Phase A 基座上实现标准狼人杀。

**B1. 规则引擎（WerewolfRuleset）**
- 角色配置：7 人局（3 狼人 + 预言家 + 女巫 + 守卫 + 1 村民，可配置）
- 状态机：`lobby → deal → night(action collection) → resolve → day(discuss) → vote → exile → check(win?) → end`
- 结构化动作：`vote / attack / guard / divine / use_potion`，服务端做 phase+role+alive 校验
- 胜负判定：狼人全灭=好人胜 / 好人≤狼人=狼人胜

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

**B5. 前端游戏 UI（与暹罗猫协作）**
- `PlayerGrid`：玩家阵型板（存活/出局/警长标记）
- `PhaseTimeline`：阶段进度条
- 翻牌仪式：interactive rich block 点击揭牌
- 日夜氛围联动：CSS 变量切换主题
- 子 Thread 做夜间频道 UX 呈现（真相源在 server scoped event log）

## Acceptance Criteria

### Phase A（Mode v2 通用基座）
- [ ] AC-A1: `GameDefinition / GameRuntime / GameView` 类型定义完成，支持 workflow+game 双轨
- [ ] AC-A2: GameEngine 可自主驱动 tick（不依赖用户消息），超时自动结算
- [ ] AC-A3: Event log append-only + scope 裁剪，API/socket 只返回 GameView
- [ ] AC-A4: ModeStore Redis 持久化，进程重启后可恢复游戏
- [ ] AC-A5: 旧三 mode 标记 legacy，前端旧入口下线，API 兼容
- [ ] AC-A6: 信息泄漏红线测试：不同 scope 的 actor 看不到不该看的事件

### Phase B（狼人杀 v1）
- [ ] AC-B1: 7 人局可完整跑通（lobby→deal→night/day 循环→结局）
- [ ] AC-B2: 铲屎官可选 player 或 god-view 参与
- [ ] AC-B3: 猫猫 AI 玩家能合理发言和执行夜间动作
- [ ] AC-B4: 信息隔离：村民看不到狼队夜聊、玩家看不到他人私密技能结果
- [ ] AC-B5: 非法动作被拒绝（死人不能投票、白天不能用夜间技能等）
- [ ] AC-B6: 断线重连后可恢复游戏状态
- [ ] AC-B7: PlayerGrid + PhaseTimeline 前端组件可用

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "狼人杀这种需要额外制作一个系统的" | AC-A1,A2 | test | [ ] |
| R2 | "铲屎官可以选择当你们的玩家" | AC-B2 | manual | [ ] |
| R3 | "也可以选择是上帝视角去观看" | AC-B2 | manual | [ ] |
| R4 | "甚至我可以选择我来当法官" | — | v2 | [ ] |
| R5 | "不同规则、不同剧本都是怎么样做的" | AC-A1 | test | [ ] |
| R6 | "你们是需要开发一个法官" | AC-B1 | test | [ ] |
| R7 | "开源仓有蛮多的，如何让 agent 玩起来狼人杀的" | KD-1 | — | [x] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求→证据映射表（Phase B 设计时补）

## Dependencies

- **Evolved from**: F011（模式系统 v1 — brainstorm/debate/dev-loop）
- **Related**: F086（Cat Orchestration — multi_mention 可复用于游戏内猫猫协作）

## Risk

| 风险 | 缓解 |
|------|------|
| 信息隔离不严导致"作弊" | 服务端 scope 裁剪 + 红线测试（AC-A6, AC-B4） |
| 猫猫 LLM 不遵守游戏规则（自然语言泄露身份） | 结构化动作强制 function call，发言内容由 LLM 自主但不影响结算 |
| 执行模型改造影响旧 mode | 双轨设计，旧 mode 走 legacy 路径不受影响（AC-A5） |
| 游戏状态丢失（进程重启） | Redis 持久化 + append-only event log 可重放（AC-A4, AC-B6） |
| 前端复杂度高 | Phase B5 与暹罗猫协作，先组件化再组合 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 狼人杀的具体角色配置（几狼几神几民）是否需要铲屎官可自定义？ | ⬜ 未定 |
| OQ-2 | 夜间动作超时时间多少合适？猫猫 vs 人类是否不同？ | ⬜ 未定 |
| OQ-3 | 是否需要"警长竞选"机制？v1 还是 v2？ | ⬜ 未定 |
| OQ-4 | 死亡玩家是否有遗言阶段？ | ⬜ 未定 |
| OQ-5 | judge 模式的具体交互细节（v2 再设计） | ⬜ 未定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 借鉴 AIWolf 协议边界，不抄 prompt | AIWolf 的 vote/attack/guard/divine + talk/whisper 分离 + 服务器驱动生命周期最成熟 | 2026-03-11 |
| KD-2 | 法官 = 纯代码 GameEngine，不用 LLM | 规则裁判必须确定性，LLM 只做发言策略 | 2026-03-11 |
| KD-3 | 信息隔离 = 服务端 scoped event log + 视图裁剪 | 前端子 Thread 只做 UX 呈现，真相源在 server | 2026-03-11 |
| KD-4 | seat/actor/role 三层分离 | seat=位置, actor=实体(人/猫), role=游戏角色，让人类和猫在架构上完全对称 | 2026-03-11 |
| KD-5 | v1 只做 player + god-view，judge 放 v2 | judge 模式 scope 翻倍，v1 先跑通核心 | 2026-03-11 |
| KD-6 | 旧三 mode 标记 legacy，不删除 | 保留 API 兼容和 thread 历史 | 2026-03-11 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-11 | 四猫讨论收敛 + 立项 |

## Review Gate

- Phase A: 缅因猫 review（安全重点：信息隔离 + 非法动作拒绝）
- Phase B: 缅因猫 review + 暹罗猫 design review（前端组件）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Evolved from** | `docs/features/F011-mode-system.md` | Mode v1（brainstorm/debate/dev-loop） |
| **Discussion** | Thread `thread_mmmt16riklhir6e4` | 2026-03-11 四猫讨论 |
| **Design doc** | `docs/plans/2026-02-10-f11-mode-system-design.md` | 旧 mode 设计文档 |
| **External** | [AIWolf](https://aiwolf.org/) | 协议参考 |
| **External** | [Sentient werewolf-template](https://github.com/sentient-agi/werewolf-template) | 频道隔离参考 |
| **External** | [ChatArena Werewolf](https://github.com/xuyuzhuang11/Werewolf) | 环境裁决参考 |
