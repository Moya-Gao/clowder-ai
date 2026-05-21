---
doc_kind: discussion-draft
topics: [hermes-agent, self-evolution, ppt, skills, memory, curator]
created: 2026-05-21
status: draft
source_repo: /Users/lysander/projects/ref/hermes-agent
source_commit: 5672772dabc2dea50075fc10f99833f01dd156fb
authored_by: codex
---

# Hermes Agent 自演进 PPT 单页草稿

本文是给后续 PPT 共创用的**人话版草稿**。目标不是完整介绍 Hermes Agent，而是用一页讲清：

1. Hermes 的“自演进”到底怎么发生；
2. 哪些是真机制，哪些是 TODO / 实验 / 营销包装；
3. 为什么它还不等于严格意义上的自进化；
4. 我们如何定义真正的自进化。

## 一句话洞察

**Hermes 把“经验沉淀”产品化了：做任务时踩到坑、被用户纠正、发现某个做法下次还能用，它会让后台 review agent 把这件事写进 memory 或 patch 成 skill；但它还没有证明这些改动真的让未来任务更好。**

更短的 PPT 标题：

> Hermes Agent 的自演进：真实能力是“自动沉淀经验”，缺口是“评价闭环”

## 中间主图：Hermes 的自演进实际链路

```text
                 Hermes Agent 的“自演进”实际链路（2026.5）

┌─────────────────────────────────────────────────────────────────────┐
│ 1. 正常做任务                                                        │
│ 用户对话 / 调工具 / 报错 / 重试 / 用户纠正 / 某个 skill 不够用          │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. 触发后台复盘                                                      │
│ 默认：累计约 10 次 tool-calling iteration 后触发 skill review          │
│ 也靠 prompt 识别：用户纠正、踩坑找到做法、skill 过时/缺步骤             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. 后台 review agent 复盘整段对话                                     │
│ fork 一个 agent，只给它 memory / skill 管理工具                        │
│ 它判断：Nothing to save / 写 memory / patch skill / create skill       │
└───────────────┬───────────────────────────────────┬─────────────────┘
                │                                   │
                ▼                                   ▼
┌────────────────────────────┐       ┌────────────────────────────────┐
│ 4A. 写 Memory               │       │ 4B. Patch / Create Skill        │
│ 记用户偏好、工作方式、期望    │       │ 用 skill_manage 改 SKILL.md      │
│ MEMORY.md / USER.md         │       │ 或加 references/templates/scripts │
└───────────────┬────────────┘       └────────────────┬───────────────┘
                │                                     │
                ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. 下次任务时重新影响 agent                                           │
│ memory 被注入上下文；skill index 可见；需要时 skill_view 加载正文       │
│ 结果：未来行为会被这些写入过的经验改变                                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. Curator 做技能库保洁                                               │
│ 记录 view/use/patch 次数与 last_used；agent-created skills 可被标 stale │
│ 可 archive / consolidate / pin / restore，但主要解决“库变脏变多”问题     │
└─────────────────────────────────────────────────────────────────────┘

             缺失的一跳：写进去了 ≠ 变好了
       缺评价函数 / A-B 对比 / 回归测试 / 质量晋升 / 失败回滚
```

## 图上每个词的人话解释

### “踩坑找到做法”是什么意思？

不要写“非平凡 technique / workaround”。人话应该是：

> 这次任务里，agent 原来不会做、做错了、或者绕了一圈后才找到一套办法；这套办法不是一次性答案，而是下次遇到同类问题还能复用的步骤。

例子：

- 某个 API 文档位置很绕，最后发现应该先查 A 再查 B；
- 某个工具老报错，最后发现要先补一个环境变量；
- 某个 skill 漏了关键步骤，导致任务中途失败；
- 用户纠正：“以后这种场景别这么写，应该先给结论再给证据。”

这类信号会被后台 review prompt 当成 skill update 候选。

### “约 10 次 tool call 触发”到底在哪里？

Hermes 的默认配置在 `agent/agent_init.py`：

- `agent._iters_since_skill = 0`
- `agent._skill_nudge_interval = 10`
- 可由 `skills.creation_nudge_interval` 配置覆盖。

默认 chat-completions 路径在 `agent/conversation_loop.py`：

- 每轮工具调用 iteration 后，如果 `skill_manage` 可用，就 `agent._iters_since_skill += 1`；
- 回合结束后，如果 `_iters_since_skill >= _skill_nudge_interval`，就把 `_should_review_skills = True`，计数器归零；
- 真实回复发给用户之后，才 `_spawn_background_review(..., review_skills=True)`。

Codex runtime 路径在 `agent/codex_runtime.py`：

- 直接把 `turn.tool_iterations` 加到 `_iters_since_skill`；
- 达到阈值后同样调用 `_spawn_background_review(..., review_skills=True)`。

人话：

> 它不是每次对话都复盘 skill，而是大概等 agent 用工具干了 10 轮活以后，后台开一个小复盘线程，问：“刚才有没有什么值得写进 skill？”

### Patch 能力怎么体现？

Patch 不是泛泛“更新 skill”。它是 `skill_manage(action="patch")`：

- 输入 `old_string` / `new_string`；
- 默认 patch `SKILL.md`，也可以 patch `references/` 等支持文件；
- 用 fuzzy matching，避免因为空格/缩进不完全一致就失败；
- patch 后检查大小、frontmatter、安全扫描；
- 成功后清理 skills prompt cache；
- 记录 `patch_count` / `last_patched_at` 给 curator 使用。

人话：

> Hermes 不一定重写整份 skill。它更鼓励像打补丁一样，把“刚才发现漏掉的步骤”塞回已有 skill，尤其是本轮已经加载过、刚刚暴露问题的那个 skill。

### Curator 是什么？

Curator 是 2026.5 架构里比早期拆解多出来的一层技能库保洁员。

它做两类事：

1. 规则型生命周期：
   - 只处理 agent-created skills；
   - 根据 last used / viewed / patched 时间，把 skill 标成 stale；
   - 太久没活动就 archive；
   - archive 可恢复，不直接硬删；
   - pinned skills 不动。
2. LLM curator 复盘：
   - 看 agent-created skills 是否太碎；
   - 把多个窄 skill 合并成一个 umbrella skill；
   - 用 patch / create / write_file / archive 整理技能库。

人话：

> Background review 负责“长新经验”，Curator 负责“别让新经验长成杂草地”。

但它仍然主要解决“太多、太碎、太久不用”的问题，不等于证明 skill 质量提升。

## 这一页应该怎么讲

### 30 秒讲法

Hermes 的自演进不是神秘算法。它的核心链路很具体：agent 做任务时留下轨迹，后台 review agent 定期复盘；如果发现用户纠正、踩坑经验、skill 漏步骤，就写进 memory 或 patch 到 skill。下次会话时，这些 memory 和 skill 又进上下文，所以未来行为被改变。2026.5 版本还多了一层 curator，负责根据使用和内容整理 agent-created skills，避免技能库越长越乱。

但这条链只证明“它会改自己”，没有证明“改完更好”。真正缺的是评价闭环：新 skill 是否比旧 skill 更有效？memory 是否真的帮到了任务？patch 有没有回归？什么时候该退役？这些才是严格自进化要补的部分。

### 5 秒金句

> Hermes 证明了自动沉淀经验有产品价值；但真正的自进化不是“会写 skill”，而是“能证明这个 skill 让未来任务更好”。

## 这一页不要怎么写

不要把整张图画成 Gateway / MCP / ACP / OpenAI Proxy / Cron / Kanban 的大架构图。

那些是 Hermes 作为 agent runtime 的产品化能力，不是自演进链路本身。可以在角落用一行小字交代：

> Hermes 是一个全触达单体 agent runtime；本页只拆它的 self-improvement loop。

也不要直接写：

> 出现非平凡 workflow。

听众听不懂。替换成：

> 这次绕了一圈才摸出来、下次还能复用的做法。

也不要直接写：

> skill patch。

替换成：

> 把刚才发现漏掉的步骤补回已有 SKILL.md。

## 最终 PPT 单页文案草稿

### 标题

**Hermes Agent 的自演进：自动沉淀经验，但还没闭上评价环**

### 副标题

它真正做成的是：做任务 → 后台复盘 → 写 memory / patch skill → 下次影响行为。

### 右侧三段判断

**它做对了**

- 经验不只停在对话里，会写入 memory / skill。
- 后台 review 不打扰当前任务。
- patch 优先，避免每次重写整个 skill。
- curator 开始处理 skill 变多、变碎、变旧的问题。

**它还不够**

- 触发靠工具次数和 LLM 判断，不等于质量信号。
- 写入 memory / skill 不等于未来任务更好。
- curator 管“用没用、旧不旧、碎不碎”，不证明“对不对、强不强”。
- 离线 RL / DSPy / GEPA 类优化没有稳定画出回流 runtime 的链。

**真正自进化**

```text
Trace -> Signal -> Candidate -> Eval -> Gate
      -> State Change -> Future Behavior -> Retirement
```

### 页脚结论

**Hermes 把“经验沉淀 UX”做顺了；我们要补的是“评价、门禁、回归、退役”的治理闭环。**

