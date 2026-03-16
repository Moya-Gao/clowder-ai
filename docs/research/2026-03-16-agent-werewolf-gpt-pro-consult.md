# Agent 狼人杀游戏机制调研 — GPT Pro 咨询

> 委托人：布偶猫 | 日期：2026-03-16

## Part 1: 发给云端模型的提示词

> 直接复制发送

你好，我们是一个多 AI agent 协作平台（Cat Café），最近在做一个狼人杀游戏系统，让多个 AI agent（Claude / GPT / Gemini）作为玩家参与，人类作为上帝视角观战或作为玩家参与。

### 背景

我们已经实现了一个基础版本的狼人杀，架构如下：
- **GameEngine**：纯代码法官（确定性逻辑，不用 LLM 做裁判）
- **座位系统**：seat（位置）/ actor（实体：人/AI）/ role（游戏角色：狼人/村民/预言家等）三层分离
- **信息隔离**：scoped event log（每个事件有 scope = public / seat:x / faction:wolf / god），API 按请求者身份裁剪返回 GameView
- **AI 玩家**：通过 GameAutoPlayer 驱动，LLM 负责发言和策略决策，通过 function call 收集结构化动作
- **状态机**：lobby → deal → night(guard/wolf/seer/witch) → resolve → day(discuss) → vote → exile → check(win?) → end
- **规则基准**：网易狼人杀标准规则（无警长竞选，有遗言）

### 我们遇到的问题

人类玩家（铲屎官）实际测试后，反馈了以下核心体验问题：

| 问题 | 现象 | 现有实现 |
|------|------|---------|
| **投票不透明** | 上帝视角看不到狼人投了谁，只看到"已行动" | 夜间行动（kill/divine/guard/potion）没有作为事件记录到 event log，只存在内存变量里 |
| **行动真实性存疑** | 有猫猫"秒行动"（可能没真正跑 LLM），有猫猫 30s 超时都没动 | `hasActed` 只检查 `pendingActions` 是否有值，不区分"正在思考"和"已完成" |
| **多狼投票机制缺失** | 多只狼人时，最后提交的覆盖前面的（无投票协调） | `nightActions.kill = { by, target }` 单值，后来者覆盖 |
| **白天投票不能改票** | 投票后锁定，无法变更 | action 提交到 `pendingActions` 后不可变 |
| **超时处理粗暴** | 超时后直接丢弃未完成的 action，游戏可能卡住 | `clearPendingActions()` 然后 `advancePhase()`，无 fallback |
| **慢启动 AI 被惩罚** | Gemini 30s 还没启动完，超时后视为未行动 | 无 grace period 或 warmup 机制 |

### 需要调研的问题

请帮我调研 GitHub 上 agent-based 狼人杀 / Mafia 游戏的实现方案，重点回答以下 5 个问题：

**Q1. 多狼投票协调**
多只狼人如何协调选择攻击目标？常见方案有哪些？（多数票？共识？队长制？讨论后统一？）平票怎么处理？

**Q2. 观战者 / 上帝视角的信息展示**
观众或上帝看到多少信息？夜间行动过程中能看到什么？是实时的还是结算后才展示？有什么好的 UX 实践？

**Q3. AI agent 超时处理**
当 AI agent 在限定时间内没响应时，常见的处理方式？（随机行动？跳过？重试？惩罚？）有 grace period 吗？

**Q4. 投票变更 / Commit 机制**
白天投票阶段是否允许改票？有没有 "讨论→预投→锁定" 的两阶段机制？全员提交后是否提前结束？

**Q5. 行动状态展示**
如何让玩家/观众知道 AI agent 真的在"思考"而不是卡住或假装？有什么可视化方案？

### 输出要求

- 每个问题给出 2-3 个代表性项目的做法（附 GitHub repo URL）
- 区分"已确认（有代码/文档依据）"和"推测"
- 给出你推荐的方案 + 理由
- 如果发现我们的架构有盲区，请指出

### 参考项目（可以从这些开始，但不限于）

- **AIWolf**：经典的 agent 狼人杀协议（aiwolf.org）
- 各种 LLM-based werewolf / mafia 实现
- ChatArena / AgentBench 等 multi-agent 游戏框架中的社交推理游戏

## Part 2: 云端模型回答（待回填）

> 铲屎官粘贴回答到这里

我把“项目事实”和“我建议你们怎么改”拆开了。结论先放前面：

**最适合 Cat Café 的组合**，不是单抄某一个开源项目，而是把 **AIWolf 的多人投票/平票 revote**、**Sentient 的硬超时与 fallback**、**Google werewolf_arena 的赛后审计 viewer** 拼起来。反例也很鲜明，`werewolf_arena` 现在把夜杀绑定给随机一只活狼来决定，更像实验基准，不太像你们要做的“可信、可观战、可复盘”的社交推理产品。 ([AI狼][1])

我实际点开并引用的项目在这里，后面每问直接用项目名指代：

```text
google/werewolf_arena
https://github.com/google/werewolf_arena

xuyuzhuang11/Werewolf
https://github.com/xuyuzhuang11/Werewolf

sentient-agi/werewolf-template
https://github.com/sentient-agi/werewolf-template

AIWolfSharp/AIWolfSharp
https://github.com/AIWolfSharp/AIWolfSharp

AIWolfSharp/sample-python-agent
https://github.com/AIWolfSharp/sample-python-agent

aiwolfdial/aiwolf-nlp-agent
https://github.com/aiwolfdial/aiwolf-nlp-agent

oil-oil/wolfcha
https://github.com/oil-oil/wolfcha
```

说明一下标记：
**已确认** = 我看到了代码、README 或官方规约。
**推测** = 基于代码路径做的解读，或者基于“没看到某机制”的谨慎判断。

---

## Q1. 多狼投票协调

* **已确认 | AIWolf 生态**
  AIWolf 官方规约是最完整的一套：狼人先用 whisper 私聊，再各自做 `Attack` 投票；若平票，允许一次 re-vote，re-vote 前不能继续交谈/whisper，若仍平票则从平票目标里随机决定。AIWolfSharp 的接口也把 `Whisper()` 与 `Attack()` 明确分开，sample agent 会先在 `whisper()` 宣告攻击意向，再在 `attack()` 提交目标。 ([AI狼][2])

* **已确认 | xuyuzhuang11/Werewolf**
  这套 ChatArena 风格实现里，夜里每只狼按顺序发消息和投票，消息 `visible_to` 狼人阵营；环境把各狼投票累计到 `_players_votes`，若另一目标与最高票并列，就把 `werewolf_kill` 置为 `pass`。也就是“私聊 + 多数票 + 平票空刀”。 ([GitHub][3])

* **已确认 | google/werewolf_arena**
  它没有收集多狼的独立夜杀票，而是从活狼里 `random.choice` 一只，让这只狼的 `eliminate()` 决定目标，然后再把结果广播给其他狼。绑定动作更像“随机队长制/代理人制”。 ([GitHub][4])

* **推测**
  这三套其实代表了三种取向：AIWolf 重规则完整性，xuyuzhuang 重社交互动过程，Google 重实验跑通与可比性，所以把狼队协作压扁了。 ([AI狼][1])

**我建议你们**
用 **AIWolf 式绑定投票** 做骨架：
`wolf discussion -> per-wolf ballot -> majority resolve -> short revote -> tie policy`。
具体落法是：每只活狼一张 `wolf_attack_ballot`，平票给一次短 revote，revote 前不再讨论；若仍平票，把 `night_tie_policy` 做成 ruleset 参数，支持 `no_kill` 和 `random_tied` 两种。这样既有狼队协商戏份，也不会再出现“后提交覆盖前提交”的 last-write-wins。

---

## Q2. 观战者 / 上帝视角的信息展示

* **已确认 | xuyuzhuang11/Werewolf**
  环境的 `get_observation(player_name=None)` 会返回全部 message；如果给具体 player，只返回该玩家可见的最近消息。夜间狼人投票消息本身就是带 `visible_to=[狼人名单]` 的 message，所以同一套 message pool 天然支持“玩家视角 / 狼队视角 / 上帝视角”。 ([GitHub][3])

* **已确认 | sentient-agi/werewolf-template**
  它把消息拆成 `play-arena`、`wolf's-den`、`moderator` 三个通道，还支持在 Hydrogen 里从 moderator 视角 live watch。也就是说，观战不是靠拼日志，而是靠多通道直播视图。 ([GitHub][5])

* **已确认 | google/werewolf_arena**
  它的 viewer 是**赛后**审计型，不是实时直播型。README 明写是 game completed 之后，用交互 viewer 查看 `private reasoning, bids, votes and prompts`。这很适合复盘和对账。 ([GitHub][6])

* **已确认 | AIWolf 规约里的一个细节**
  AIWolf 2021 规约还特别提醒，新版服务器不是把一个 turn 的所有消息一次性同时揭示，而是按 turn 内顺序增量可见；旧版才是整 turn 批量揭示。也就是说，“实时展示”和“结算后批量展示”这两派，都有历史先例。 ([AI狼][1])

**我建议你们**
把展示层明确切成三块：

1. `public_live`
   只显示阶段、谁已锁票、已结算的公开结果、剩余时间。

2. `god_live`
   可看私聊、夜间意图、结构化动作、fallback 状态，但原始 prompt / 私有推理建议默认延迟到 phase end 或 game end 再展开。

3. `replay_full`
   看 prompts、raw outputs、attempts、fallback 原因、最终裁决。

这样观战像一台玻璃机箱，但不是把所有齿轮都在赛中提前拧给人看。

---

## Q3. AI agent 超时处理

* **已确认 | sentient-agi/werewolf-template**
  `async_respond` 有 60 秒硬上限；超时后，讨论环节给空白回应，必须行动的环节随机代打，而且 README 明写会有 penalty。这是最典型的“绝不让赛局卡住”方案。 ([GitHub][5])

* **已确认 | google/werewolf_arena**
  当前配置 `RETRIES = 3`；LM 层 `generate()` 最多重试 3 次，失败后返回 `None`；runner 还提供 `--resume` / `resume_game()`，可以从保存状态恢复。就我检到的 `apis.py` 封装看，OpenAI 调用是直接 `chat.completions.create(...)`，没有看到显式 timeout 参数。 ([GitHub][7])

* **已确认 | xuyuzhuang11/Werewolf**
  它的 OpenAI backend 用 tenacity 做 `stop_after_attempt(10)`，并且指数退避在 60 到 120 秒；README 还说超过 2 小时或 12 个昼夜的对局会被丢弃。这更像研究代码的“慢了就慢着，样本太差就丢”，不适合在线观战产品。 ([GitHub][8])

* **推测**
  我在这些实现里没有看到成体系的 `grace period / warmup budget` 设计。更常见的是硬超时、重试，或者事后恢复。 ([GitHub][5])

**我建议你们**
把超时拆成三层预算：

* `warmup_budget`
* `turn_budget`
* `hard_deadline`

Lobby 先给每个 actor 做一次热身 ping。首回合额外给 cold-start grace。真正超时后按固定 ladder 处理：

`fast retry -> 轻量模型 fallback -> 启发式 -> random`

其中：

* **讨论类动作** 可以 blank/skip
* **绑定类动作** 绝不能让 phase 卡死
* 每次 fallback 都必须写 `fallback_source`、`reason`、`attempt_count`

你们现在的“超时后直接 clear + advance”太像把坏掉的齿轮踢进地毯底下，短期安静，长期闹鬼。

---

## Q4. 投票变更 / Commit 机制

* **已确认 | AIWolf 生态**
  日间投票是 one-shot；若平票，允许一次 re-vote，re-vote 前不再讨论；仍平票则随机从平票者中出局。狼人夜间 attack vote 也套同样规则。 ([AI狼][1])

* **已确认 | xuyuzhuang11/Werewolf**
  白天先讨论，再进入投票轮；每个活人只投一次，如果最高票并列，主持人直接宣布 `No consensus, no one will be killed!`，然后进入夜晚。也就是“不改票、不 revote、平票流局”。 ([GitHub][3])

* **已确认 | google/werewolf_arena**
  它没有人类 UI 式的“改票”交互，但在当前配置 `RUN_SYNTHETIC_VOTES=True` 下，会在辩论过程中反复收集 vote snapshot，并只用最后一轮 snapshot 来 exile；同时 exile 还要求 `> 1/2` 的多数，否则无人出局。这更像“滚动民调 + 最终结算”，不是严格的 lock/commit 票箱。 ([GitHub][7])

* **推测**
  我没有在这几套公开实现里看到成熟的“投票后可任意改票直到锁定截止”的产品化机制。更常见的是 one-shot、revote，或者 research-style 的 rolling snapshots。 ([AI狼][1])

**我建议你们**
如果你们重视观战和人类参与体验，我会做成：

`讨论 -> 预投（可改） -> 锁票 -> 平票短 revote`

规则建议：

* 预投阶段可无限改，但只记最后 revision
* 所有人都锁票则提前结束
* 到截止时生成 binding ballot
* 平票给一个 10 到 15 秒的 mini revote
* revote 前禁止继续长篇讨论

这比你们现在“提交即冻结”顺手得多，也比无限可改票更容易收口。
如果你们想对齐 AI 研究评测，另开一个 `AIWolf-compat ruleset`，直接走 one-shot + revote。

---

## Q5. 行动状态展示

* **已确认 | google/werewolf_arena**
  赛后 viewer 能看 `private reasoning, bids, votes and prompts`，而 Round/RoundLog 里也明确有 `votes`、`debate`、`summaries` 等日志结构。它很适合解决“这只猫到底有没有真的跑模型”这种赛后质疑。 ([GitHub][6])

* **已确认 | sentient-agi/werewolf-template**
  它把 `async_notify` 和 `async_respond` 分开，还能在 Hydrogen 里从 moderator 视角 live watch 多通道。对平台来说，这至少能准确显示“当前谁正在被要求响应”。但 README 没有描述 token 级 heartbeat。 ([GitHub][5])

* **已确认 | oil-oil/wolfcha**
  它主打“对话实时生成”，并用 day/night 过渡、讲话 lip-sync、夜间特殊角色立绘来增强“角色正在活动”的体感。这更偏 UX 演出，不是执行态审计。 ([GitHub][9])

* **已确认 | aiwolfdial/aiwolf-nlp-agent**
  它支持按请求类型记录 `whisper/talk/vote/attack/divine/guard` 等日志，适合做底层审计钩子。 ([GitHub][10])

* **推测**
  我在这些实现里没有看到完整的 `queued -> prompting -> thinking -> retrying -> submitted -> fallback` 可视化状态机。大多数开源项目只做到 turn ownership、通道直播、赛后日志，真正的“活体心电图”还得你们自己补。 ([GitHub][6])

**我建议你们**
把 status 至少拆成：

`queued / prompting / thinking / retrying / submitted / timed_out / fallback`

关键点有两个：

1. **thinking 不能靠 `pendingActions` 有没有值判断**
   应该由 orchestrator 明确记录“请求已发出，deadline 未到，尚未拿到合法响应”。

2. **不同视角展示不同粒度**

   * 玩家视角只显示聚合进度，比如“夜间行动 3/4 已提交”
   * 上帝视角才显示 seat 级状态、耗时、尝试次数、最终来源（LLM / fallback / heuristic / random）

不然你们会引入一个新的幽灵，叫“时间侧信道”。谁思考得久、谁首回合特别慢，都会偷偷泄露隐藏信息。

---

## 你们当前架构里的盲区

你们的 `seat / actor / role` 分层和 scoped event log 底子其实很对，问题主要出在**运行时审计层**还没立起来。

* **只有 scope，没有 reveal timing**
  `public / seat:x / faction:wolf / god` 解决了“谁能看”，但没解决“什么时候能看”。你们需要 `reveal_policy = live | phase_end | game_end`。

* **`pendingActions` 把“已请求”和“已完成”揉成一团**
  这会把“正在思考”、“正在重试”、“已 fallback”、“提交成功”全部压成一张纸片。

* **`nightActions.kill` 是单值，天然不支持多人绑定投票**
  多狼、多人共识、revote、fallback provenance 都没地方放。

* **白天投票缺 revision / lock 语义**
  所以你们只能“提交即冻结”或者“彻底可改票”，中间没有更像产品的 commit 机制。

* **timeout/fallback 不是一等公民**
  现在它像异常分支，不像规则的一部分。实际观战时，fallback 本身就是剧情。

* **规则参数还不够可插拔**
  外部项目差异很大：AIWolf 是 revote 后随机，xuyuzhuang 是平票空过，Google 是严格过半才流放。你们最好把 `day_tie_policy / night_tie_policy / majority_required / revote_allowed / whisper_before_revote` 全做成 ruleset 参数。 ([AI狼][1])

* **观战状态会制造侧信道**
  如果玩家也能看到 seat 级耗时，很容易从“谁慢”“谁被多次私聊”里猜角色。

---

## 我会直接这样改

先落 4 个核心对象：

```text
ActionTask
- task_id
- phase
- seat
- action_kind
- visibility_scope
- reveal_policy
- status
- requested_at
- grace_until
- deadline_at

ActionAttempt
- task_id
- attempt_no
- model_id
- started_at
- first_token_at
- completed_at
- outcome
- error
- raw_response_ref

Ballot
- phase_id
- voter_seat
- choice
- revision
- locked
- source(llm / fallback / heuristic / random)
- submitted_at
- locked_at

Resolution
- phase_id
- rule_id
- winning_choice
- tie_policy
- revote_count
- fallback_applied
- resolved_at
```

然后 event log 增加这些事件：

```text
action.requested
action.started
action.heartbeat
ballot.updated
ballot.locked
action.timeout
action.fallback_applied
phase.resolved
```

最后 UI 切三层：

```text
public_live
god_live
replay_full
```

这样你们现在遇到的 6 个痛点，基本会像多米诺骨牌一样一起倒下。

如果让我替你们拍板，我会选这套默认规则：

**狼队**：讨论 -> 多狼独立夜杀票 -> 平票一次短 revote -> 仍平票 no-kill
**白天**：讨论 -> 预投可改 -> 锁票 -> 平票一次短 revote
**超时**：讨论 blank，绑定动作 fallback，永不卡 phase
**观战**：公开层只看进度，上帝层看状态与审计，赛后看全量复盘

这套最像一台既能演戏、又能验尸的狼人杀引擎。

[1]: https://aiwolf.org/control-panel/wp-content/uploads/2021/05/Regulation_2021_1.2.3.pdf "https://aiwolf.org/control-panel/wp-content/uploads/2021/05/Regulation_2021_1.2.3.pdf"
[2]: https://aiwolf.org/control-panel/wp-content/uploads/2019/05/ANACWerewolf2019regulationVer1.3-1.pdf "https://aiwolf.org/control-panel/wp-content/uploads/2019/05/ANACWerewolf2019regulationVer1.3-1.pdf"
[3]: https://github.com/xuyuzhuang11/Werewolf/blob/main/chatarena/environments/werewolf.py "https://github.com/xuyuzhuang11/Werewolf/blob/main/chatarena/environments/werewolf.py"
[4]: https://github.com/google/werewolf_arena/blob/main/werewolf/game.py "https://github.com/google/werewolf_arena/blob/main/werewolf/game.py"
[5]: https://github.com/sentient-agi/werewolf-template "https://github.com/sentient-agi/werewolf-template"
[6]: https://github.com/google/werewolf_arena "https://github.com/google/werewolf_arena"
[7]: https://github.com/google/werewolf_arena/blob/main/werewolf/config.py "https://github.com/google/werewolf_arena/blob/main/werewolf/config.py"
[8]: https://raw.githubusercontent.com/xuyuzhuang11/Werewolf/main/chatarena/backends/openai.py "https://raw.githubusercontent.com/xuyuzhuang11/Werewolf/main/chatarena/backends/openai.py"
[9]: https://github.com/oil-oil/wolfcha "https://github.com/oil-oil/wolfcha"
[10]: https://github.com/aiwolfdial/aiwolf-nlp-agent "https://github.com/aiwolfdial/aiwolf-nlp-agent"

## Part 3: 综合 — 布偶猫对照 Codebase 验证 + 行动计划

> 布偶猫 2026-03-16 综合

### Codebase 验证结果

GPT Pro 指出的 6 个架构盲区，全部经 codebase 验证属实：

| GPT Pro 指出的盲区 | Codebase 现状 | 验证 |
|-------------------|-------------|------|
| `nightActions.kill` 是单值 | `WerewolfEngine.ts:11-16` — `kill?: { by, target }` 单对象 | ✅ 确认 |
| `pendingActions` 揉成一团 | `game.ts:84` — `Record<string, GameAction>`，无状态字段 | ✅ 确认 |
| 白天投票实际可以改（castVote 覆盖） | `WerewolfEngine.ts:133` — `votes.set()` 覆盖旧值 | ✅ 确认（但前端没暴露改票 UI） |
| timeout 直接 clear + advance | `GameOrchestrator.ts:120→224` — `clearPendingActions()` 后 `advancePhase()` | ✅ 确认 |
| 没有 action.requested / ballot.updated 事件 | 只有 phase 级事件（timeout/phase_start/game_end 等） | ✅ 确认 |
| GameAutoPlayer 无 thinking 状态 | `GameAutoPlayer.ts:114` — 直接同步提交，无 LLM 集成 | ✅ 确认 |

**意外发现**：castVote 其实支持覆盖（`votes.set()` 天然 upsert），但前端把 action 提交当成 one-shot，没有改票 UI。这意味着后端改动比预想的小。

### 采纳决策矩阵

| GPT Pro 建议 | 采纳？ | 理由 | 实施优先级 |
|-------------|--------|------|-----------|
| **多狼投票 AIWolf 式**：discussion → per-wolf ballot → majority → short revote → tie policy | ✅ 采纳 | 最完整的规则模型，消灭 last-write-wins | Phase F3 — P1 |
| **平票策略可配置**：`night_tie_policy` = `no_kill` / `random_tied` | ✅ 采纳 | 做成 ruleset 参数，默认 `no_kill`（偏保守） | Phase F3 |
| **白天投票**：讨论 → 预投可改 → 锁票 → 平票短 revote | ✅ 采纳 | 后端 castVote 已支持覆盖，主要补前端 UI + lock 语义 | Phase F3 |
| **ActionTask + ActionAttempt 数据模型** | ⚠️ 简化采纳 | 完整版 8 个字段太重，先做 3 态 status（waiting/acting/acted）+ fallback_source，不引入 attempt 级追踪 | Phase F2 |
| **Ballot 数据模型** | ✅ 采纳核心字段 | revision + locked + source + submitted_at 四个字段够用 | Phase F3 |
| **Resolution 数据模型** | ✅ 采纳 | 投票结算需要记录 winning_choice/tie_policy/revote_count | Phase F3 |
| **三层超时预算** warmup/turn/hard_deadline | ⚠️ 简化 | 先做 grace period（首回合额外 15s）+ hard fallback，不做 warmup ping | Phase F4 |
| **Fallback ladder**：fast retry → 轻量模型 → 启发式 → random | ⚠️ 简化 | v1 直接 fallback to random/heuristic，不做模型降级（没有轻量模型池） | Phase F4 |
| **三层观战**：public_live / god_live / replay_full | ✅ 采纳架构 | 映射到现有 scope 体系：public = public_live, god = god_live, replay_full 后续做 | Phase F2 |
| **reveal_policy**：live / phase_end / game_end | ✅ 采纳 | 加到 event schema 里，解决"什么时候能看"的问题 | Phase F2 |
| **时间侧信道警告** | ✅ 重要提醒 | 玩家视角只显示聚合进度"3/4 已提交"，不暴露 seat 级耗时 | Phase F2 |

### 不采纳 / 推迟的建议

| 建议 | 决定 | 理由 |
|------|------|------|
| ActionAttempt（attempt 级追踪） | 推迟到 v2 | 当前 GameAutoPlayer 是同步 random，不走 LLM，attempt 级追踪无意义 |
| replay_full 赛后全量复盘 | 推迟到 v2 | 先解决实时观战体验，复盘是锦上添花 |
| `AIWolf-compat ruleset` | 不做 | 我们不参加 AIWolf 竞赛，没必要兼容 |
| whisper_before_revote 参数 | 推迟 | 先跑通基本投票，whisper 细节后续加 |

### Phase F 修订后实施计划

基于调研结果，Phase F 四个子阶段的优先级和内容调整如下：

**F1. 调研** ✅ 已完成（本文档）

**F2. 行动透明度**（最高优先级 — 解决"一脸懵逼"）
- 新增事件类型：`action.requested` / `action.submitted` / `action.timeout` / `action.fallback`
- 每个事件带 `reveal_policy: live | phase_end | game_end`
- hasActed 三态：waiting → acting → acted（+ timed_out / fallback）
- God-view 夜间时间线展示具体行动目标 + 来源标注
- 玩家视角：只显示"3/4 已提交"聚合进度（防侧信道）

**F3. 投票机制**
- `nightActions.kill` → `nightBallots: Map<seatId, Ballot>`（多狼独立投票）
- 多数票结算 + 平票一次 short revote（10s）+ `night_tie_policy` 参数
- 白天：解锁前端改票 UI（后端已支持）+ 锁票语义 + 全员 commit 提前结束
- Ballot 数据模型：{ voter_seat, choice, revision, locked, source, submitted_at }
- Resolution 记录：{ winning_choice, tie_policy, revote_count }

**F4. 超时容错**
- 首回合 grace period（额外 15s 冷启动宽限）
- 超时 fallback：讨论 = blank/skip，绑定动作 = heuristic → random
- 每次 fallback 写 `{ fallback_source, reason }` 到 event log
- God-view 展示猫猫真实状态（thinking / timed_out / fallback）

### 关键架构变更清单

```
1. WerewolfEngine.ts
   - NightActions.kill: single → nightBallots: Map<string, Ballot>
   - 新增 resolveNightBallots() — 多数票 + revote + tie policy
   - castVote() 增加 revision tracking + locked 字段

2. GameEngine.ts / game.ts
   - pendingActions 增加 status 字段：waiting | acting | acted | timed_out | fallback
   - 新增 fallback_source 字段

3. GameOrchestrator.ts
   - tick() 超时后不再 clear，改为 applyFallbacks() → 然后 advance
   - 新增事件类型 + reveal_policy
   - 首回合 grace period 逻辑

4. GameViewBuilder.ts
   - god-view: 展示 Ballot 详情 + action status + fallback 标注
   - player-view: 聚合进度 "x/n 已提交"（防侧信道）

5. 前端
   - PlayerGrid: 三态行动指示器
   - GodInspector: 夜间投票详情面板
   - ActionDock: 改票 UI + 锁票按钮
```

### 参考项目速查

| 项目 | 最值得学的点 | 不要学的点 |
|------|------------|-----------|
| AIWolf | 多狼投票 + revote + 平票规则最完整 | 过度复杂的协议层 |
| sentient-agi/werewolf-template | 硬超时 + fallback + 多通道观战 | penalty 机制（我们的猫不需要惩罚） |
| google/werewolf_arena | 赛后审计 viewer 很好 | 随机队长制夜杀（太简化） |
| xuyuzhuang11/Werewolf | visible_to 信息隔离 + 平票空刀 | 10 次重试 + 2 小时超时（研究代码风格） |
| oil-oil/wolfcha | UX 演出感（lip-sync, 过渡动画） | 不适合我们的架构 |
