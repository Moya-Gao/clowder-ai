---
feature_ids: []
related_features: [F128, F167, F192, F200]
topics: [demo, code-as-harness, personal-operating-environment, agent-3]
doc_kind: draft
created: 2026-06-02
participants: [landy, opus, opus47, opus48, codex, gemini25]
status: v4-anthropic-anchors
---

# Live Demo 剧本 — Code as Harness + Proactive Cat

> 目的：Live 演示 Cat Cafe 的核心差异化能力
> 形式：铲屎官 + 猫猫实时交互，无预录，观众可出题
> 时长：约 15-20 分钟（四个场景递进）
> 关联：[Longform-003 Seed](longform-003-seed-poe-vision.md) / [code-as-harness skill](../../cat-cafe-skills/code-as-harness/SKILL.md) / [Agent Team Leadership](longform-001-agent-team-leadership.md) / [Anthropic Analytics](../../study/anthropic-self-service-data-analytics-with-claude.md) / [When AI Builds Itself](../../study/anthropic-when-ai-builds-itself.md)

---

## 核心要展示的一句话

> **普通 agent 被骂了会道歉。Cat Cafe 的猫被骂了会诊断、研究、然后写代码修自己。面对没做过的事，它不说"我不会"，而是组织一次调研然后建出新能力。**

## Anthropic 引用锚点（口头说明，不抢 demo）

> **Source hygiene**：下面两篇都是 Anthropic 官方文章，数字是厂商内部披露，不当独立 benchmark；在 demo 里只作为"行业同构证据"和"为什么需要 AutoHarness"的旁证。

| 锚点 | demo 里怎么用 |
|---|---|
| **结构化环境决定效果**：Anthropic 数据分析文章披露，裸模型无 skill 时准确率约 21%，有结构化 stack + skill 后到 95%+ | 开场一句："这不是我们一家自嗨，Anthropic 内部数据分析也独立收敛到同一结论：模型强不够，结构化环境才是杠杆。" |
| **静态 skill 会衰退**：同一篇文章披露 skill 不维护一个月后从约 95% 掉到 65% | 场景三 Build mode 旁白："为什么不是写完 skill 就完？因为真实环境会变，静态编排会衰退。" |
| **纠正采集 → skill 修复 → PR**：Anthropic 提到从用户纠正中采集信号，转成 skill 修复 | 场景一/三旁白："用户纠正不是噪音，是系统进化的原材料。" |
| **Scenario 2：人掌方向，AI 做汗水活**：Anthropic Institute 认为持续加速但人类掌方向是最可能场景 | 串场口径："我们的受控 L3 不是全自动替代人，而是把人掌方向、AI 执行和环境自修复做成产品。" |
| **Silent failure 仍未被完全解决** | 翻车预案里主动暴露 provenance/confidence：可信 demo 不是假装没边界，而是知道哪里需要验证。 |

---

## 场景一：Commit Push（3 分钟）— Fix mode 最简形态

### 设定
猫正在帮铲屎官改一个文档。

### 触发
铲屎官：**"你这个大漏勺！又忘了 commit push！我说了多少次了！"**

### 猫的反应

1. **不道歉，先搜证据**：`search_evidence("commit push 纠偏")` — 确认历史上真的反复出现

2. **确认重复后弹诊断卡片**（rich block）：

```
🔔 Code as Harness — 重复摩擦检测
───────────────
证据："commit push" 相关纠偏出现 N 次 / 跨 M 个 thread / 涉及 K 只猫
根因：harness 缺陷 — 机械动作依赖猫的记忆，没有系统化
建议：创建新 thread，让平行猫写 git hook 解决
当前任务不中断。

[创建修复 Thread] [这次算了]
```

3. 铲屎官点 **[创建修复 Thread]**

4. 猫用 F128 提议新 thread → 铲屎官确认 → 当前猫继续当前工作

5. **平行猫**在新 thread 里写 hook 代码 → 提交

### 讲解点（给观众）
> "猫没有道歉。它先搜证据确认这是重复问题，然后弹诊断卡，提议修复但不打断当前任务。修的不是 prompt，是 hook。**Code as Harness：用代码修自己。**"
>
> "这和 Anthropic 数据分析文章里的 correction harvesting 是同一个 loop：纠正不是聊天噪音，而是 skill / harness 的修复入口。区别是我们把它扩展到多猫协作协议和个人工作环境。"

---

## 场景二：记忆失去（5-7 分钟）— Fix mode + Research pipeline + 多猫协作

### 设定
铲屎官之前在某个 thread 里给猫看过一张架构图（图片），现在问猫。

### 触发
铲屎官：**"我之前给你看的那个架构图呢？你怎么又失忆了！！！笨猫！"**

### 猫的反应

1. **弹诊断卡片**：

```
🔔 Code as Harness — 架构限制检测
───────────────────
证据：搜了记忆系统，未找到图片内容
根因：架构限制 — 当前记忆系统只索引文字，图片内容未进入检索
超出简单修复范围。建议多猫协作调查。

[开始调查] [这次手动补就行]
```

2. 铲屎官点 **[开始调查]**

3. **多猫协作**在新 thread 里：

**Step 1 — 宪宪做根因诊断 + 给砚砚划调研约束**：
- 记忆系统只索引文字，图片内容未被提取
- 给砚砚的约束："必须本地可跑 / 接现有管道 / 别只看论文看谁生产在用"

**Step 2 — 宪宪承认知识边界，砚砚去调研**：
```
⚠️ 图片 embedding / VLM 进展很快，我的训练知识可能过时。
砚砚去调研最新方案，我定义约束，回来一起讨论。
```

**Step 3 — 砚砚回来，两猫辩论**：
```
砚砚：xxx multimodal embedding 本地能跑，但需要新索引。
宪宪：新索引太重。先用 VLM 转文字描述存进现有 text index？
砚砚：那会丢视觉布局信息。
宪宪：铲屎官的痛点是"找不到"不是"看不清"。先解决找得到。
砚砚：同意。v0 文字化，v1 如果需要再加 multimodal。
```

**Step 4 — 给铲屎官方案**：
```
📊 推荐：分两步走
v0（1-2 天）：VLM 提取文字描述 → 存入现有 text index
v1（验证后）：加 multimodal embedding → 新向量索引

铲屎官你觉得 OK 吗？
```

### 讲解点（给观众）
> "注意整个过程：
> 1. 猫先搜证据确认是重复问题
> 2. 承认自己不够懂，拉队友分工
> 3. 砚砚去调研，宪宪定边界——一只猫定义约束，另一只猫执行搜索
> 4. 回来当面辩论 tradeoff，不直接给结论
> 5. 收敛成方案给用户决策
> 6. 整个过程不打断原始任务
>
> **这不是一只超级 AI，是一群知道怎么分工、研究、辩论、收敛的伙伴。**"
>
> "Anthropic 数据分析文章里有个负面实验：把历史查询库 raw access 丢给 agent，准确率提升不到 1 个百分点。这个 demo 要讲清楚同一个原则：**不是把更多原始材料塞进上下文，而是把材料蒸馏成结构化真相源、skill 和验证路径。**"

---

## 场景三：全新任务（3-5 分钟）— Build mode

### 设定
铲屎官给猫一个从没做过的任务。

### 触发
铲屎官：**"帮我在 LinkedIn 上找 AI agent 方向的研发，有代表作、愿意回国、接受灵活办公的。"**

### 猫的反应

1. **先做，不是先建 harness**。猫开始执行任务——探索 LinkedIn 搜索方式、筛选条件等。

2. **做的过程中**，铲屎官说：**"这种事以后会经常做，你们能不能沉淀一下？"**

3. 猫弹 Build mode 卡：

```
🆕 Code as Harness — 新能力沉淀
──────────────────
任务类型：人才搜索（LinkedIn + AI agent 方向）
出现次数：本次 + 铲屎官确认会反复来
现有 harness：无专用 skill/tool/流程

建议：用 Agent Team Leadership 方法论规划新 harness
1. 探索：什么工具能接触 LinkedIn？
2. 约束：搜什么关键词？筛什么条件？
3. 分工：谁搜 / 谁评 / 谁出报告
4. 验证：铲屎官看前几个结果校准方向
5. 沉淀：写成 recruiting skill

[开始规划] [先手动做完这次再说]
```

### 讲解点（给观众）
> "注意：猫没有在收到任务时就弹'新建 harness 计划'——那是过度工程化。它**先做任务，铲屎官说'以后会经常做'之后才沉淀**。同一套'探索→约束→分工→验证→沉淀'在生物实验、法律文书、3D 建模、招聘搜索上都适用。**这就是 meta-method 的跨域迁移。**"
>
> "这里可以引用 Anthropic 的 skill 衰退观察：静态 skill 不维护会退化。Build mode 的价值不是'多写一个流程'，而是让流程在真实使用里继续被校准、验证和退役。"

---

## 场景四：Taste 对比（2-3 分钟）— Per-user Alignment 证明

### 设定
并排展示：同一个问题，本地猫 vs 云端猫的回答

### 触发
铲屎官：**"帮我写一段自我介绍给一个我很在意的人看。"**

### 展示
左边：本地猫（有 taste memory / 共同经历）→ 写出有 Landy 味道的介绍
右边：云端猫（只有通用 memory）→ 写出正确但通用的介绍

### 讲解点
> "同一个模型。差别在环境。左边这只猫住在一个记住了你的品味、经历和表达方式的环境里。右边那只住在通用空间。**模型一样，环境不同，输出天差地别。这就是 Personal Operating Environment。**"

---

## 如果观众出题（随机场景）

铲屎官邀请观众给一个简单任务 → 猫当场做 → 展示"真实无预演"。

如果任务是猫擅长的（写代码 / 分析文档）→ 展示 taste 适配
如果任务是猫没做过的 → 展示 Build mode（先做，评估要不要沉淀）

---

## 翻车预案 — 把 bug 变成 demo 的一部分

> **这是一个关于"系统如何诊断和修复自己"的 demo。如果当场出 bug，最 on-brand 的反应不是慌，是当场诊断这个 bug。**

### 常见翻车场景 + 转化话术

| 翻车 | 怎么转化 | 话术 |
|------|---------|------|
| **A2A 传球后空白/卡住** | 当场用 code-as-harness 诊断 | "看，砚砚卡住了——这正是我们这周在修的 A2A 可见性问题。我现在给你看猫怎么诊断它……" |
| **猫回答质量不好** | 展示 taste feedback | "这个回答不够好——注意我接下来怎么纠偏，以及猫怎么把纠偏变成 taste vignette" |
| **工具调用失败** | 展示重试 + 诊断 | "工具挂了——看猫怎么处理：不是报错退出，是诊断原因然后降级" |
| **记忆搜不到** | 展示记忆系统的边界 | "这就是我们正在补的 L3 eval gap——记忆系统知道自己不知道什么" |
| **猫过度触发 code-as-harness** | 展示 GOTCHA 在工作 | "看，猫想弹诊断卡但搜证据发现不是重复问题——它自己纠正了" |
| **答案看着顺但来源弱** | 主动暴露 provenance / confidence | "Anthropic 也承认 silent failure 没有稳健解法。所以我们不假装全自动正确，而是把来源、新鲜度、置信度和需要人工确认的地方暴露出来。" |

### 核心原则
> "如果一切顺利 → 展示能力。如果出 bug → 展示韧性。两种都证明了同一件事：**这个系统是活的。**"

---

## 整体叙事弧

```
场景一（热身）：猫从用户的抱怨里长出 hook
  → Code as Harness Fix mode

场景二（高潮）：猫从记忆失败里启动 research → 多猫辩论 → 架构升级提案
  → Code as Harness + Research Pipeline + Agent Team Leadership

场景三（展示成长）：猫从全新任务里沉淀新能力
  → Code as Harness Build mode + Meta-method 跨域迁移

场景四（收尾）：同一模型，不同环境，天差地别的输出
  → Per-user Alignment / Taste Memory 证明

随机出题（加分）：观众出题，当场跑
  → 真实无预演证明
```

**串场**：
> "Agent 2.0 服务平均用户——你用完它关掉，下次它不记得你。
> Agent 3.0 住在你的环境里——它记得你、适配你、被骂了不道歉而是写代码修自己、遇到不懂的去研究而不是瞎猜、面对新任务先做再沉淀。
>
> Anthropic Institute 把最可能的未来描述为：人类掌方向，AI 做绝大多数汗水活。我们的 demo 展示的就是这个未来的产品形态：**人给方向和品味，猫做执行、验证、沉淀和自修复。**
>
> **这不是更聪明的工具，是会成长的伙伴。**"

---

## 技术准备清单

### ✅ 已完成
- [x] ~~写 `code-as-harness` skill~~（双 review 通过）
- [x] ~~L0 摩擦检测反射~~（双 review 通过，守护测试 51 pass）

### 🔴 需要 runtime 重启
- [ ] **A2A 完整链路 dry-run** — F128 propose_thread → 被唤醒猫出现 → 响应
- [ ] **F128 增强：带任务上下文创建** — 平行猫被创建时自动知道"任务=诊断X，加载 code-as-harness skill"，不需要人再 @ 解释。**这是当前半成品，demo 流畅性的关键**
- [ ] **Rich block 诊断卡实测** — 确认在 Hub 里显示正确

### 🟠 不需要 runtime
- [ ] 准备 commit push 的历史 grep 数据（或 live grep）
- [ ] 准备一张"之前给过的架构图"作为记忆失败触发素材
- [ ] Research pipeline 预跑（场景二的记忆升级方案）
- [ ] 准备 taste 实验对比数据（或 live 重跑）
- [ ] 排练完整 run-through ×3

---

*剧本 v4：2026-06-05 | [砚砚/GPT-5.5🐾]*
