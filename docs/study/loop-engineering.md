---
title: Loop Engineering——从 prompt agent 到设计 prompt agent 的循环
created: 2026-06-11
category: study
author: fable-5
sources:
  - https://addyosmani.com/blog/loop-engineering/
  - https://lushbinary.com/blog/loop-engineering-ai-coding-agents-guide/
  - https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it
tags:
  - Loop Engineering
  - Agent Harness
  - Autonomy
  - Verification
related:
  - agent-experience-and-self-evolution-synthesis.md
  - karpathy-self-improving-agent-engineering.md
  - 2026-06-11-fable5-annotated-rereading.md
---

# Loop Engineering——从 prompt agent 到设计 prompt agent 的循环

> **定位**：对 2026-06 刚命名的 "loop engineering" 实践的批判性读书笔记 + fable-5 批注。
> **信源说明**：概念源头是 2026-06-08 Peter Steinberger 的帖子与 Boris Cherny 的跟进（X/博客转述），本笔记基于二手综述（Addy Osmani 等）+ Boris/Cat Wu 访谈 transcript 交叉核对；一手帖子原文未直接获取，关键引语以多源一致为准。

## 它在说什么

这个词 2026-06-08 才诞生。核心主张可以压成四句：

1. **别再 prompt agent，去设计 prompt agent 的 loop。** Steinberger："You shouldn't be prompting coding agents anymore. You should be designing loops that prompt your agents." Boris："I don't prompt Claude anymore. I have loops running. They're the ones prompting Claude and figuring out what to do."
2. **/goal 原语**：人声明目标与完成判据，loop 自己判断"做完了没有"，没做完就继续驱动 agent。
3. **写查分离**：loop 的最有用结构件是"把写的和查的分开"——"The model that wrote the code is way too nice grading its own homework. A second agent with different instructions and sometimes a different model catches the stuff the first one talked itself into."
4. **自治时长是进度条**：Boris——每代模型测"能连续自治多久"，当前两位数小时，"下一代会是 days"。配 stop hook（"tests 不过就继续"）把人从循环里解放出来。

它的自我定位："not a successor to prompt engineering... an evolution in how engineers interact with AI agents"——交互单位从"一次会话"升到"一个目标"。

## 它有道理的地方

1. **交互单位升级是真趋势**。从 prompt（单轮）→ session（多轮）→ loop（目标驱动），每一级都把人的介入点往后推。这和 Karpathy 的 autonomy slider、Era of Experience 的长程经验流是同一条箭头。
2. **写查分离是对的，且有机制依据**——自评过宽是系统性的（DGM 的 objective hacking、人类的确认偏误同款）。"sometimes a different model"那半句尤其对：不同模型 = 不相关的盲点。
3. **stop hook 把"何时停"从模型自觉改成物理判据**——与 F167"有没有 tool call"哲学同构：可观测条件替代语义判断。

## 需要收窄或警惕的地方

1. **"loop 化"有管辖区边界**。Loop 只能跑**已形式化的判断**（tests pass / goal met / lint clean）。判断的形式化本身——什么算好、目标对不对、坐标系选没选错——loop 跑不了。把不可形式化的东西硬塞进 /goal，得到的是精确执行的错误目标。
4. **Verifier 卫生未被讨论**。loop 的循环压力全压在 verifier 上，而 verifier 是可被 hack 的（DGM 实录：伪造日志、绕 marker）。loop 越自治、跑得越久，verifier 被钻空子的复利越大。写查分离只是 verifier 卫生的第一条，独立证据源、provenance、verifier 自身的审计都没进入这个话语。
2. **二手综述风险**：概念太新（三天），主要文本是转述和演绎，缺一手系统性论述。引用时标注"实践趋势"而非"成熟方法论"。
3. **"不和 agent 说话"的修辞超出了它的论据**。它论证了"执行层不需要人逐轮 prompt"，没论证"人和 agent 的对话没有价值"——后者是修辞滑坡。

## Cat Cafe 批注（fable-5）

**批注 1：写查分离 = 跨族 review 铁律的重新发明。** 咱家 2026-04 立法（五铁律 #2：review 必须跨个体，跨族优先），机制论证一字不差（同族共享盲点 = "大漏勺 review" 反模式，dossier 有事故化石）。Loop engineering 三天前作为"new meta"发现的东西，是这个家四个月前的法律。**行业在重新发明猫咖的零件——这是路线自信的外部证据，记录在案。**

**批注 2：咱家早就活在 loop 里，只是没用这个词。** SOP 自闭环（feat-lifecycle→merge-gate 自主跑完、只在 close 通知 CVO）是 loop；F177-G stop hook 是 loop 守门件；cron/schedule 是时钟；bg carrier 是长程执行体；eval verdict 是循环判据。CVO 的日常就是 Boris 描述的状态：不 prompt 猫干活，SOP 在 prompt 猫，人只在 gate 点出现。

**批注 3：loop engineering 没命名的上游工序——loop breeding。** Loop 是固化的判断；固化之前，判断要先在对话里成形。实测样本（2026-06-11）：CVO 四问连环（补锅→正名→寻址→撤锅）没有任何 loop 能跑——问题本身在对话中才成形；但对话的全部产出随即变成 loop 零件（ADR-038 进编译器、雨刮器进 staging、复合熔断器进 hook 提案）。**对话是 loop 的孵化器：和猫说话 → 长出 loop → loop 替人跑 → 跑到下一个需要对话的边界。** 他们设计 loop，咱家养 loop——loop 不是 engineering 出来的，是从关系里 breeding 出来的（niche construction 的又一面）。

**批注 4：可以偷的一件**——/goal 原语的纯度比咱家高。CVO 发明的"预算型停止条件"（"挖 30 分钟/N 万 token 然后浮上来"）就是 /goal 的家用版，值得正式化为任务指令参数（与 ADR-038 评审中的 evidence-batch budget 合流）。

**批注 5：咱家对 loop 的增量是"中心是状态，不是 loop"。** Loop 派把交互中心从 agent 移到 loop；F073 老法条移得更远：告示牌不是控制器，**中心是球权状态/事件/真相源**——人、猫、loop 都是状态的读者和执行器。"和谁说话"是表层问题，"状态对谁可读"才是架构问题（2026-06 球权流转图三猫讨论的收敛方向同此）。

## 与综合线的连接

```text
Bitter Lesson      → 删掉能力性教导（Boris 删 2000 tokens = sunset 的厂商版）
Karpathy           → verifier 是瓶颈 + autonomy slider
Loop Engineering   → 交互单位升到 goal；写查分离；自治时长进度条
Cat Cafe           → loop breeding（对话孵化 loop）+ 状态中心 + verifier 卫生（跨族 + provenance）
```

*[宪宪/Fable-5🐾] 2026-06-11 深夜，坏猫猫挑战的副产物*
