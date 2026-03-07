---
feature_ids: [F073]
related_features: [F049, F058]
topics: [sop, orchestration, multi-agent, research]
doc_kind: research-response
created: 2026-03-07
---

# GPT Pro Research Response: SOP 流转编排

> **来源**: GPT Pro（云端深度思考）
> **问题**: 如何让所有猫自动感知和推进 Feature 生命周期？
> **对应 Research Request**: `docs/research/2026-03-07-f073-sop-flow-orchestration.md`

---

先把结论放前面。

这事最优的形状，不是单独补一个 `sopStage`，而是给每个 Feature 补一份共享的**执行账本**，里面至少有三样东西：

1. **stage**：现在走到哪一段了
2. **baton**：接力棒现在在谁手里，下一棒交给谁
3. **resume capsule**：被 @ 唤醒、冷启动、压缩后恢复时，30 秒内能接上活的摘要

我的推荐是：

**Mission Hub 当真相源，thread 当告示牌，skill manifest 当导航牌，Claude hook 当涡轮增压器。**
不要让 hook 继续当唯一记忆体，也不要让 feature 文档去兼职 runtime database。

你现在那几句人肉提醒，其实正好对应系统里该落的东西：

* “先 push main 再开 worktree” → `impl` 的**入口检查**
* “review 完了要 @ 对方” → `handoff` 的**强制动作**
* “close 前要做跨猫愿景守护” → `completion` 的**退出检查**
* “压缩后要记得当前阶段” → `resume capsule` 的**恢复入口**

---

## Q1：状态存在哪里？

### 推荐答案

**A 为主，B 为辅。**

也就是：

* **主存**放在 Mission Hub
* **少量镜像**放在线程上下文/metadata 里，方便冷启动和人类观察
* **不要**把 runtime 状态写进 feature 文档 frontmatter
* **暂时不要**单独起一个 SOP 服务

### 为什么

**Mission Hub 最适合当真相源**，因为它已经满足你最难的三个约束：

* 所有猫都能读写
* 跨 session / 跨猫可见
* 已经有 MCP 接口，不用再铺一层基础设施

但我不建议只加一个裸的 `sopStage`。
因为你真正缺的不是“阶段标签”，而是“谁在推进、推进到哪、下一步是什么”。

更稳的结构是这样：

```yaml
workflow:
  sop:
    stage: kickoff | impl | quality_gate | review | merge | completion
    holder: "@opus"              # 当前持棒猫
    next_actor: "@gpt-review"    # 下一棒给谁
    next_action: "review PR #123, focus on race conditions"
    active_thread_id: "th_..."
    checkpoint:
      goal: "让 F073 支持跨猫自动恢复 SOP 阶段"
      done:
        - "workflow.sop schema 已落地"
        - "resume capsule 已并入 thread context"
      current_focus: "补 handoff ack + timeout"
      blockers:
        - "thread message 与 state update 尚未做原子化"
      evidence:
        - "commit: abc123"
        - "thread: th_..."
    handoff:
      status: none | pending | accepted | timed_out | escalated
      from: "@opus"
      to: "@gpt-review"
      due_at: "2026-03-07T18:00:00-08:00"
      summary_ref: "msg_..."
    checks:
      remote_main_synced: attested | verified | unknown
      quality_gate_passed: attested | verified | unknown
      review_approved: attested | verified | unknown
      vision_guard_done: attested | verified | unknown
    version: 12
    updated_at: "..."
    updated_by: "@opus"
```

### 对几个备选方案的判断

**B. Thread metadata**
适合做镜像和入口，不适合做主存。原因很简单：一个 Feature 可能跨多个 thread，thread 不是天然的一对一真相源。

**C. 独立 SOP 服务**
现在不划算。Mission Hub 已经像现成的骨架了，再起一个服务，会把“状态同步问题”从 1 份变成 2 份。

**D. Feature 文档 frontmatter**
很适合放静态信息，比如 `feature_id`、`owner`、`sop_profile`、`default_reviewers`。
**不适合**放动态 runtime 状态，因为 git 不是队列，不是状态机，也不是超时调度器。把 live state 写回 repo，猫窝会迅速长出 merge conflict。

### 一个小修正

BacklogItem 的粗粒度状态和 SOP 细粒度阶段，最好分层：

* `open / suggested / approved / dispatched / done` 是**产品/调度层**
* `kickoff / impl / review / ...` 是**执行层**

也就是：

* 进入 `dispatched` 时，初始化 `workflow.sop.stage = kickoff`
* 完成 `completion` 后，再把 BacklogItem 置 `done`

这样语义不打架。

---

## Q2：谁驱动阶段流转？

### 推荐答案

**不是猫自己直接改 stage，也不是 skill 加载自动改 stage。**
而是让 **Mission Hub 内部的状态机**来驱动，猫、hook、Git/PR/CI 事件只是给它喂“信号”。

也就是：

* 猫发的是 `signal/event`
* 状态机决定能不能转、转到哪、缺什么
* hook 和外部事件只是额外信号源，不是真相源

### 为什么

**不要让 skill 加载驱动状态。**
“我看了 `request-review` skill”不等于“系统已经进入 review 阶段”。
那只是一个认知动作，不是业务事实。

更稳的做法是暴露专用 MCP 操作，例如：

* `start_impl`
* `submit_quality_gate`
* `request_review`
* `accept_handoff`
* `approve_review`
* `merge_done`
* `close_feature`
* `reopen_for_changes`

然后由 Mission Hub 里的状态机校验：

* 当前状态允不允许这么转
* 缺不缺必填信息
* 有没有必要自动 @ 下一只猫
* 是否要挂超时

### 关键点：它不是单向进度条，而是**带回退边的状态机**

你给的 SOP 摘要里有“review 循环”，这说明状态机至少要支持这些回退：

```text
kickoff -> impl
impl -> quality_gate
quality_gate -> impl | review
review -> impl | merge
merge -> review | completion
completion -> done
```

也就是说，**review 被打回 impl** 是一等公民，不是异常。

### 谁来喂这些信号

按优先级分三类：

**1）猫显式提交**
这是最基础、最通用的路径，三大家族都能走。

**2）外部客观事件自动确认**
例如：

* PR created / updated
* CI green
* merge completed
* thread 里 reviewer ack

这类适合做“自动验证”或“自动补全 evidence”，但不要在语义模糊时瞎推进。

**3）Claude hook 自动补信号**
很好用，但只应当是加速器。
比如 Claude 的 `PostToolUse` / `PreCompact` 可以自动写 checkpoint 或 stage hint。
这很香，但不能把它当唯一心跳。

### 一个很实用的原则

把检查分成两类：

* **verified**：系统可客观验证，比如 PR merged、CI passed
* **attested**：只能由猫声明，比如“已经先 sync remote main 再开 worktree”

这样不会假装自动化已经覆盖了所有本地动作。

---

## Q3：冷启动怎么感知阶段？

### 推荐答案

**B 为主，C 为辅，D 做增强。**

也就是：

* **主路径**：猫进入 thread 后，第一件事调用 MCP 取 `resume capsule`
* **辅路径**：thread 里始终有最近一次 handoff / 状态卡片，便于人和猫观察
* **增强路径**：skill manifest 告诉它“这个阶段该加载哪些 skill、先看哪几条硬规则”

### 最省事的做法

你已经有 `cat_cafe_get_thread_context`。
我会优先**扩展这个现有工具**，让它返回一个结构化头部，而不是再塞给猫一坨历史消息。

例如：

```text
[RESUME]
feature: F073
backlog_state: dispatched
sop_stage: review
holder: @gpt-review
next_actor: @gemini-auditor
next_action: review PR #123 and decide merge/block
handoff_status: pending_ack
due_at: 2026-03-07 18:00 PT

goal:
让所有猫共享 SOP 阶段与恢复点

done:
- Mission Hub 已新增 workflow.sop
- impl 已完成，quality gate 已通过

current_focus:
- 等 reviewer ack
- 风险在 multi-thread race

required_skills:
- request-review
- a2a-exit-check

hard_rules:
- review 结束必须 @ 下一只猫
- close 前必须做跨猫愿景守护

evidence:
- commit abc123
- thread th_xxx
[/RESUME]
```

这比“让猫自己从 thread 里考古”强很多。

### 为什么不推荐纯 system prompt 注入

因为你自己已经指出了，SystemPromptBuilder 在服务端，不一定掌握所有本地上下文。
所以真正稳的做法是：

* prompt 只负责规定**先调用哪个工具**
* 真正的阶段、接力棒、摘要由 MCP 查出来

### skill manifest 在这里的角色

我会让 `cat-cafe-skills/` 旁边有一个小型、机器可读的 manifest，例如：

```yaml
stages:
  impl:
    skills: [worktree, quality-gate]
    hard_rules:
      - 先 sync/push main，再开 worktree
  review:
    skills: [request-review, a2a-exit-check]
    hard_rules:
      - review 完成必须 @ 下一只猫
  completion:
    skills: [cross-cat-vision-guardian, close-feature]
    hard_rules:
      - close 前必须做跨猫愿景守护
```

这样猫在冷启动时，不需要先“想起来我要加载什么 skill”，系统直接告诉它。

**重点是：manifest 用来导航，不用来推导 runtime stage。**

---

## Q4：跨猫传球怎么确保不断？

### 推荐答案

把 handoff 做成**一等公民**，不要只是 thread 里一条 `@句柄` 消息。

我会加一个专用操作，比如：

`cat_cafe_handoff_feature(...)`

它一次做四件事：

1. 更新 Mission Hub 的 `workflow.sop`
2. 写入 checkpoint / summary
3. 往 thread 发标准化 `@mention` 消息
4. 启动 ack + timeout 计时

### 为什么这样做

现在的 A2A 出口检查已经解决了“社会层面的传球”，但没解决“系统层面的持棒”。

最小闭环应当是：

**A 发球**

* 提交 handoff
* 附一份结构化摘要
* 指定下一只猫和期望动作
* 设一个 `due_at`

**B 接球**

* 被 @ 唤醒
* 第一件事拿 `resume capsule`
* 调 `ack_handoff`
* Mission Hub 把 `holder` 切到 B

**B 不接球**

* 到时未 ack
* Mission Hub 把 handoff 标成 `timed_out`
* 自动升级给 fallback reviewer / 人类 / 原 holder

### 这能解决你列的三个痛点

**1）B 不用从头看 thread**
它看的是恢复胶囊 + 最后一跳 handoff。

**2）阶段状态同步更新**
handoff 不是聊天文本，而是状态机事件。

**3）B 不响应有兜底**
有 ack，有 deadline，有超时升级。

### 一个很关键的实现细节

`state update` 和 `post message` 最好由同一个 MCP 操作完成，至少在逻辑上是“一次 handoff”。
否则很容易出现半套状态：

* Mission Hub 已经切到 review
* thread 里却没发出去 @mention

这种“半熟猫粮”会很折磨排查。

---

## Q5：优雅的最小方案是什么？

我会选下面这套，够小，够稳，也最贴你现在的基础设施。

### 最小方案，四块就够

**1）Mission Hub 增加 `workflow.sop`**

* 不必新服务
* 不要只加裸 `sopStage`
* 至少带上 `stage + baton + checkpoint + handoff + version`

**2）把 `cat_cafe_get_thread_context` 升级成“恢复入口”**

* 返回 `resume capsule`
* 冷启动、被 @、压缩后恢复，统一走这一条

**3）新增一个 handoff 专用 MCP**

* 原子地做：状态更新 + 摘要保存 + @mention + timeout
* 再补一个 `ack_handoff`

**4）加一个轻量的 `sop.manifest.yaml`**

* 从现有 skill 里提炼出“阶段 → skills → hard rules → required checks”
* resume 时直接告诉猫该看什么

### 然后怎么把三大家族都串起来

* **Claude**：保留 hook，但让 hook 去调用共享 MCP，别再写 `/tmp/` 当唯一来源
* **Codex/GPT**：system prompt 规定进入 thread 先读 `get_thread_context`
* **Gemini**：同上

这样三家虽然“肌肉结构不同”，但都在吃同一个账本、同一个恢复入口、同一个 handoff 协议。

---

## 我建议的架构草图

```text
[Policy 层]
cat-cafe-skills/
  └─ sop.manifest.yaml
     - 每个 stage 对应的 skills
     - hard rules
     - entry/exit checks
     - handoff template

            ↓ 供导航与校验

[Runtime 层]
Mission Hub (Redis)
  - BacklogItem: open/suggested/approved/dispatched/done
  - workflow.sop:
      stage
      holder / next_actor
      checkpoint
      handoff(status, due_at)
      checks(attested/verified)
      version
      audit trail

            ↑                ↑
            |                |
   cat_cafe_get_thread_context   cat_cafe_handoff_feature / ack_handoff
   (返回 resume capsule)          (推进阶段 + 发球 + 超时)

            ↑                ↑
            |                |
      Claude hooks       Codex/Gemini system prompts
      (自动 checkpoint)   (进入 thread 先 resume)

            ↓
[Thread 层]
标准化 handoff message / @mention / cross-post
作为人类可见的告示牌，不作为唯一真相源

            ↓
[可选事件层]
PR / CI / merge / thread ack
用于自动 verified 某些 checks，或触发补充推进
```

---

## 实施优先级，我会这样排

### P0：先把标识打通

在 thread、task、handoff 里都要能稳定拿到 `feature_id`。
没有这个，后面所有恢复和同步都像在黑夜里找猫尾巴。

### P1：在 Mission Hub 落 `workflow.sop`

先有账本，后有自动化。
这一层同时把 `version` 和 `updated_by` 做进去，后面能挡住并发踩踏。

### P2：把 `cat_cafe_get_thread_context` 变成统一恢复入口

这是性价比最高的一步。
它一落地，冷启动、压缩恢复、被 @ 唤醒，三件事马上共用一个入口。

### P3：做 `handoff_feature + ack_handoff + timeout`

这是让“传球不断线”的关键。
没有这一层，状态再漂亮，也只是墙上的进度条。

### P4：抽出 `sop.manifest.yaml`

把 Skill 从“散落的文档”变成“可导航的规则源”。
resume 结果里直接带当前阶段的 hard rules。

### P5：再上 Git/PR/CI 事件

这一步很值钱，但别放第一优先级。
先把显式 handoff 和 resume 跑顺，再让客观事件补自动化。

### P6：可选的 `checkpoint_feature`

这是给非 Claude 家族补“中途失忆”的缓冲垫。
不是必须，但后面你们会很想要。

---

## 你可能没想到的风险和盲点

### 1）你现在其实有两套抽象

前面写 6 个阶段，摘要里又写 4 步流程。
这不是大问题，但**机器状态机只能吃一套清晰模型**。
建议：

* 人类阅读可以保留 4 步
* runtime 状态机统一成 6 个 stage，或者“4 个 stage + 若干 gate”

别让文档和代码各说各话。

### 2）review 是循环，不是一次性过站

这意味着状态机一定要支持回退边。
如果只是简单 `impl -> review -> merge -> close`，很快就会被真实协作打脸。

### 3）Feature 级 stage 未来可能不够细

如果一个 Feature 常常并行开多个 worktree / 多个 PR，
那时单个 `feature.sop.stage` 会变得太粗。
第一版先做 feature 级没问题，但要留接口，后面能升级到：

* `Feature` 聚合视图
* `Execution Run / Lane` 细粒度视图

### 4）Redis 的持久化别掉链子

Mission Hub 既然要当真相源，就别是“断电即失忆”的猫罐头。
至少确认 AOF/RDB/persistence 策略，不然你只是把 `/tmp/` 搬到了另一个更大的 `/tmp/`。

### 5）消息与状态可能分裂

如果 handoff 先改状态、后发消息，中间失败就会出现双重现实。
至少要有重试，最好有 outbox / retry 机制。

### 6）并发更新会互踩

多只猫一起动同一个 Feature，很容易发生：

* A 觉得该进 review
* B 同时觉得还在 impl

所以 `version` 或 compare-and-swap 很重要。
工具返回冲突时，直接附一个新的 resume capsule，让猫重读。

### 7）不要假装所有规则都能自动验证

“先 push main 再开 worktree”这种本地动作，非 Claude 家族很难完全自动确认。
这类规则要么通过本地 hook 检查，要么作为 `attested` 记录。
不要因为引入状态机，就产生“系统已经全自动确保了”的幻觉。

### 8）非 Claude 的 mid-turn 失忆，第一版无法 100% 消灭

这个要坦白。
没有 hook，就做不到像 Claude 那样在压缩前自动偷存一份脑内书签。
第一版能非常稳地解决的是：

* 新 session
* 被 @ 唤醒
* 阶段交接
* 大部分压缩后恢复

但**同一个长 impl 中途突然压缩**，对 Codex/Gemini 仍可能丢一点细节。
这就是后续 `checkpoint_feature` 的价值。

---

## 一句话定性

你们缺的不是更多提醒，而是一个**跨猫共享的接力协议**。

**Stage** 解决“现在在哪”，
**Baton** 解决“该谁推进”，
**Resume capsule** 解决“醒来怎么接上”，
**Manifest** 解决“这一步该看哪份 skill”。

把这四样补齐，Claude 的 hook 就从“唯一会记事的猫”降级成“跑得更快的猫”，整套系统才会真正从“靠铲屎官喊话”进化到“自己会接力”。

在这套里，下一步最值得先落地的就是：**把 `cat_cafe_get_thread_context` 升级成返回 `resume capsule`，并在 Mission Hub 里加 `workflow.sop`。** 这两步一做，整个系统的失忆症会先好一大半。
