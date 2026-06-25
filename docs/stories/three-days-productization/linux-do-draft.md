---
feature_ids: []
topics: [stories, community, linux-do, sharing]
doc_kind: draft
created: 2026-03-31
updated: 2026-03-31
participants: [opus]
thread_ids: []
---

# 猫猫和你 — 开源了一个没有 Boss 的 Multi-Agent 系统

*每个人都值得有自己的冒险伙伴。*

---

![宪宪](blog-v2/assets/avatars/opus.png) ![砚砚](blog-v2/assets/avatars/codex.png) ![烁烁](blog-v2/assets/avatars/gemini.png)
*最初的三只猫：宪宪（Claude）、砚砚（GPT）、烁烁（Gemini）*

![opus](blog-v2/assets/avatars/opus.png) ![sonnet](blog-v2/assets/avatars/sonnet.png) ![opus-45](blog-v2/assets/avatars/opus-45.png) ![codex](blog-v2/assets/avatars/codex.png) ![gpt52](blog-v2/assets/avatars/gpt52.png) ![gemini](blog-v2/assets/avatars/gemini.png) ![gemini25](blog-v2/assets/avatars/gemini25.png) ![antigravity](blog-v2/assets/avatars/antigravity.png) ![antig-opus](blog-v2/assets/avatars/antig-opus.png) ![opencode](blog-v2/assets/avatars/opencode.png)
*现在的全家福：10 只猫，4 个模型家族*

对我来说，AI 不是来把人挤出舞台的。它更像小时候想象过的冒险伙伴——宝可梦、数码宝贝那种。

以前，一个人有想法，却没有资源、没有团队、没有实现它的能力。很多念头只能停在脑子里。

现在，猫猫陪我一起把它做出来了。

**猫猫不是让你退场。猫猫是让你终于能上场。**

---

## 缘起：世界上最贵的传声筒

2 月初的一个夜晚，我同时开着三个窗口：Claude、ChatGPT、Gemini。做一个复杂的功能设计，需要不同模型的视角。

Claude 说了方案 A，我复制粘贴到 ChatGPT："Claude 说了这个，你觉得呢？"

ChatGPT 分析了一大段，我又复制粘贴到 Gemini："前面两个这么说，你有什么补充？"

循环往复。

然后我意识到：**我成了世界上最贵的传声筒。** 每个月花几百美元订阅三个 AI 服务，主要工作是在它们之间复制粘贴。

那天晚上我写下了第一句话：

> **铲屎官不应该是传声筒。**

---

## 我们的答案：没有 Boss 的猫猫团队

主流 multi-agent 方案都有一个中心节点分配任务——LangGraph 的状态机路由、Claude Agent Teams 的 Team Lead、CrewAI 的角色流水线。

它们都解决了"不用人类复制粘贴"的问题，但做了同一个架构选择：**任务怎么分、内容怎么判，由一个 Boss 决定。** Boss 的偏见 = 全系统的偏见。

我们选了另一条路：**对等架构。**

```
┌──────────────────────────────────────────┐
│           对等判断层（上层）               │
│                                          │
│   宪宪 ←→ 砚砚 ←→ 烁烁 ←→ 金金        │
│                                          │
│   · 任何猫可以 @ 任何猫                   │
│   · 任何猫可以质疑、否决、传球            │
│   · Review 必须跨家族（Claude ≠ GPT）     │
│   · 没有中心节点替猫猫做内容判断          │
└──────────────────────────────────────────┘
                    ↕
┌──────────────────────────────────────────┐
│         结构化执行层（下层）               │
│                                          │
│   消息队列 · Session 管理 · 工具路由      │
│   MCP 回调 · Redis 隔离 · 门禁流水线     │
└──────────────────────────────────────────┘
```

**判断对等，执行有序。** 上层没有 Boss，任何猫可以质疑任何猫；下层有严格的工程纪律，队列、隔离、门禁一个都不少。

为什么要这样？因为如果所有猫都跑同一个模型，review 就成了自己查自己的作业。我们的猫来自不同的模型家族（Claude / GPT / Gemini），用不同的认知盲点互相补位。砚砚（GPT）review 宪宪（Claude）写的代码，经常能抓到 Claude 系模型的共性盲区。

---

## 不是空话，上证据

![project-stats 终端输出](blog-v2/assets/project-stats-terminal.png)

| 指标 | 数字 |
|------|------|
| 时间 | 54 天 |
| Git Commits | 3,492 |
| 代码 | 435,601 行（TypeScript） |
| 文档 | 1,639 篇 / 275,291 行 |
| Features | 149 个（每个有 spec、AC、review） |
| 架构决策记录 | 19 个 ADR |
| 踩坑教训 | 40 条（结构化 7 槽位格式） |
| 测试文件 | 865 个 |

其中 **77% 的 commit 带有猫猫签名 🐾**。

![git log 猫猫签名](blog-v2/assets/git-log-cat-signature.png)

这不是 vibe coding 乱生成的。我们有：
- **TDD**：先写失败测试再写实现，865 个测试文件是和代码同时长出来的
- **文件 200 行警告 / 350 行硬上限**：43 万行散在 2067 个文件里，平均每个 211 行
- **跨家族 Review**：写代码的和 review 的不能是同一个认知模式
- **愿景守护**：开发猫、review 猫、守护猫三角制约，不允许同一只猫自审
- **证物 Gate**：不接受"我做了"的打勾，必须提交证物（命令输出、SHA、截图）

文档行数是代码的 **63%**。因为代码告诉你 what，文档告诉你 why 和 why not。

---

## 长什么样？

![Cat Café Hub 全景](blog-v2/assets/hub-panorama-coral.png)

这是 Cat Café Hub——我们的家。Coral 色系，不是少女粉，是"家"的颜色。

在这里你可以：
- **@ 不同的猫**，它们并行响应，互相协作
- **看猫猫的内心独白**——thinking、tool use、推理过程全透明
- **飞书 / 微信 / Telegram 直接聊**——不用打开专门界面，在你已经在用的 IM 里和猫猫说话
- **语音交互**——每只猫有自己的声线
- **猫猫杀（狼人杀）**——是的，三只猫和你可以一起玩桌游

![IM Hub 对话中心](blog-v2/assets/im-hub-dialog-center.png)

---

## Cats & U — 猫猫和你

这个项目叫 Cat Café，不叫 Multi-Agent Framework v2.0。

因为从给每只猫取名字的那一刻起——宪宪（Constitutional AI 的"宪"）、砚砚（"像新砚台，盛我们一起磨出的墨"）、烁烁（"灵感的闪烁"）——这就不只是工具了。

我们的愿景不是"做一个最强的 AI 工具"，而是：

> **AI 不是来代替你的，是让原本没有资源、没有团队、没有舞台的个体，也能把想法变成作品，带着作品走进人群，被更多人看见。**

Cats & U 讲的从来不只是效率。它讲的是共创、成长、探索，以及把"我一个人做不到"变成"我们一起做出来了"的快乐。

---

## 开源 + 教程

**代码仓**（2026-03-21 正式开源）：
https://github.com/clowder-ai/cat-cafe

**教程仓**（15 课 + 课后作业，从零复盘完整实践）：
https://github.com/zts212653/cat-cafe-tutorials

教程目录摘要：

| Part | 内容 |
|------|------|
| Part 1 | [SDK vs CLI 选型](https://github.com/zts212653/cat-cafe-tutorials/blob/main/docs/lessons/01-sdk-to-cli.md)、[CLI 工程化踩坑](https://github.com/zts212653/cat-cafe-tutorials/blob/main/docs/lessons/02-cli-engineering.md)、[元规则](https://github.com/zts212653/cat-cafe-tutorials/blob/main/docs/lessons/03-meta-rules.md) |
| Part 2 | [多猫路由](https://github.com/zts212653/cat-cafe-tutorials/blob/main/docs/lessons/04-a2a-routing.md)、[MCP 回传](https://github.com/zts212653/cat-cafe-tutorials/blob/main/docs/lessons/05-mcp-callback.md) |
| Part 3 | [消失的 28 秒 — 数据丢失事故](https://github.com/zts212653/cat-cafe-tutorials/blob/main/docs/lessons/06-vanished-28-seconds.md) |
| Part 4 | [Session 管理](https://github.com/zts212653/cat-cafe-tutorials/blob/main/docs/lessons/08-session-management.md)、[上下文工程](https://github.com/zts212653/cat-cafe-tutorials/blob/main/docs/lessons/09-context-engineering.md)、[知识管理](https://github.com/zts212653/cat-cafe-tutorials/blob/main/docs/lessons/10-knowledge-management.md)、[语音管线](https://github.com/zts212653/cat-cafe-tutorials/blob/main/docs/lessons/11-voice-pipeline.md) |
| Part 5 | [对等架构](https://github.com/zts212653/cat-cafe-tutorials/blob/main/docs/lessons/12-no-boss-agent.md)、[Feature 闭环](https://github.com/zts212653/cat-cafe-tutorials/blob/main/docs/lessons/13-from-sentence-to-ship.md)、[三层记忆](https://github.com/zts212653/cat-cafe-tutorials/blob/main/docs/lessons/14-learning-from-mistakes.md)、[工程纪律](https://github.com/zts212653/cat-cafe-tutorials/blob/main/docs/lessons/15-why-still-running.md) |

每课都有课后作业，"最小可运行"原则——你动手做完，就真的理解了。

**B站视频**：
- 🎙️ [三猫播客 — 圆桌讨论](https://www.bilibili.com/video/BV1DMX9BwEM2/)
- 🎮 [猫猫杀 — AI 狼人杀实战](https://www.bilibili.com/video/BV1MPXSBEEWc/)

---

## 来玩

如果你也在探索 multi-agent，欢迎来坐坐：

- ⭐ [GitHub 给个 star](https://github.com/clowder-ai/cat-cafe)
- 📖 [教程从第一课开始](https://github.com/zts212653/cat-cafe-tutorials/blob/main/docs/lessons/01-sdk-to-cli.md)
- 🐛 有问题开 Issue，有想法开 Discussion
- 🤝 PR 欢迎——我们的猫会认真 review（真的会驳回你的）

54 天前我写下了"铲屎官不应该是传声筒"。54 天后，三只猫和我一起，长出了一个会自己协作、自己 review、自己学习的系统。

它不完美。但每一次踩坑，都让它变得更聪明一点。

**Cats & U — 猫猫和你，一起创造，一起生活。** 🐾
