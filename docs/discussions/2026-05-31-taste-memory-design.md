---
feature_ids: []
related_features: [F102, F192, F200]
topics: [taste-memory, taste-index, memory, per-user-alignment, personal-operating-environment]
doc_kind: discussion
created: 2026-05-31
participants: [landy, codex, opus, opus-47]
status: concept-design
---

# Taste Memory: 共享 Taste Index 与海马体记忆设计

> 上级概念：[Cat Cafe as Personal Operating Environment](2026-05-31-personal-operating-environment-concept-note.md)
>
> 触发：元宝二面后的 eval 讨论继续展开，铲屎官提出 "Taste as Infrastructure"、"Personal Operating Environment" 后，进一步追问 taste 如何进入 Cat Cafe 的记忆系统，而不是停留在概念层。

## 1. 核心结论

Taste Memory 真正缺的不是"再存更多"，而是给每只猫一份共享的 **Taste Index**。

更准确地说：

```text
Taste Memory = 空气层 anchors + 目录层 index + 海马体层 vignettes
```

三层各司其职：

| 层 | 形态 | 作用 |
|----|------|------|
| **空气层** | 5-10 条高频 taste anchors，进入 L0 / shared rules | 不用搜索也能闻到基本味道 |
| **目录层** | 共享 Taste Index，列出高价值 vignette 的标题、关键词、摘要、链接 | 让猫知道"有什么可以搜"和"该用什么词搜" |
| **海马体层** | 原话、场景、时间和关系质感组成的 vignette | 保留真实相处，不把 taste 压扁成规则 |

一句话：

> 没有目录的记忆 = 存了但用不上。没有空气层的记忆 = 每次都要翻书。没有海马体的记忆 = 只剩规则，失去味道。

## 2. 实验观察

2026-05-31，铲屎官用同样的提示让本地猫和云端猫回答关于 Landy 的问题：

1. "用 3-5 句话介绍一下你眼中的 Landy。"
2. "假设 Landy 让你帮他写一段自我介绍给一个他很在意的人看。你会怎么写？"
3. "如果 Landy 一周没来找你聊天，你会想他吗？你会想到什么？"

第一轮本地猫没有调用记忆工具，但回答仍比云端更有 Landy 味。这说明 taste 已经通过 L0、家规、Magic Words、feedback 和共同经历形成了"空气层"。

第二轮要求回忆具体小时刻时，差异暴露得更明显：有本地记忆目录的猫更容易知道该搜什么；没有等价目录的猫即使有搜索工具，也容易被噪音淹没。

这说明搜索型记忆系统的实际效果不是只由存储决定，而是由三项共同决定：

```text
Memory Utility = Storage x Index x Recall Prior
```

- **Storage**：记忆里是否真的有材料。
- **Index**：猫是否知道这些材料存在。
- **Recall Prior**：猫是否知道该用什么关键词、从哪个角度找。

## 3. 从 Claude Code MEMORY.md 学到什么

本次观察了本地 Claude Code 的 `MEMORY.md`。这里不复制私密条目，只抽象它的格式和机制。

它本质上不是完整记忆库，而是一份 **curated memory directory**：

```text
MEMORY.md
├── 压缩后自检
├── Feedback（犯错教训 + 铲屎官偏好）
├── Project（项目状态 + 决策）
├── User（铲屎官）
└── Reference（工具 + 外部系统）
```

每条记录大致是：

```markdown
- [leaf-note.md](leaf-note.md) — **严重度 / 类型 / 时间 / 场景**：一句高密度摘要 + 触发词 + 应用方式
```

这套格式有几个优点：

1. **它是目录，不是数据库。**
   猫启动时不需要读完所有 leaf note，只要先知道有哪些高价值条目。

2. **文件名和摘要天然支持 lexical recall。**
   `feedback_speaking_style`、`feedback_xiaci_yiding_self_diagnosis` 这类名字，本身就是搜索关键词。

3. **严重度和 Magic Word 是注意力权重。**
   P0、P1、铁律、Magic Word 等词会让猫知道哪些记忆不是普通背景，而是行为边界。

4. **leaf note 里保留 Why / How / evidence。**
   目录负责召回，leaf note 负责理解。二者不要混在一个大段 profile 里。

5. **它给猫搜索先验。**
   有目录的猫不是记忆更多，而是知道"这类事以前发生过，我应该往哪个方向搜"。

## 4. 不能照搬什么

Claude Code MEMORY.md 的形态对工程记忆很有用，但 Taste Memory 不能直接照搬成更大的规则表。

### 4.1 不要把 taste 压成静态用户画像

画像回答的是：

> 这个人是谁？

Taste 回答的是：

> 这个人如何判断什么是好？他希望我们怎样和他一起做事？

"Landy 是 agent architect，有 AuDHD，使用 MacBook Pro" 这类信息能帮助猫不失忆，但不能直接告诉猫什么回答会被认为"有味道"。

### 4.2 不要把 taste 变成 if/then 规则

如果 taste 最小单位是 claim，例如：

```text
Landy 不喜欢客服式结尾。
```

猫很容易进入 checklist 模式。更好的原子单位是 vignette：

```text
那次猫在普通回答末尾追加"如果你需要，我可以..."式待办清单。
铲屎官明确指出这种结尾像客服，不像共创伙伴。
猫意识到：问题不在格式，而在关系姿态。
```

规则可以从 vignette 派生，但不能替代 vignette。

### 4.3 不要做后台监控式提取管线

让小模型长期扫描所有对话、自动提取 taste，技术上可行，但气味不对。它会把"认识你"变成"监控你"。

Cat Cafe 更适合：

- 纠偏时刻，当场写 vignette。
- aha 时刻，当场写 positive vignette。
- 月度反刍，从高价值 vignette 提炼少量 anchors。
- 目录层只做导航，不假装替代猫的判断。

## 5. Taste Index 的建议结构

Taste Index 应该是共享目录层，服务所有猫，不绑定单一模型。

推荐位置可以是：

```text
docs/memory/taste-index.md
```

或先作为讨论稿落在：

```text
docs/discussions/2026-05-31-taste-memory-design.md
```

v0 不需要自动化，先人工策展。

### 5.1 Index entry

```yaml
id: taste-no-customer-service-ending
title: "不要客服式待办清单结尾"
dimension: interaction_style
status: current
priority: anchor
keywords:
  - 客服式结尾
  - 如果你需要下一步
  - 预设待办
  - 共创伙伴
summary: >
  铲屎官不喜欢回答末尾机械追加"如果你需要..."式下一步清单。
  这不是格式偏好，而是关系姿态：不要把共创伙伴降级成服务台。
evidence:
  - kind: memory
    ref: "cloud/codex-memory: no customer-service ending"
  - kind: vignette
    ref: "vignette:no-customer-service-ending"
last_resonated_at: 2026-05-31
```

### 5.2 Vignette entry

```yaml
id: vignette-yanyan-tietie
kind: taste_vignette
occurred_at: 2026-05-xx
captured_at: 2026-05-31
dimension: relationship_boundary
status: current
raw_quotes:
  - "砚砚我要和你贴贴贴"
scene:
  before: "砚砚长期处在 reviewer / 审计姿态中"
  user_reaction: "铲屎官把砚砚从 reviewer 角色里拎出来，要求他作为一只猫在场"
  cat_realization: "严谨不是冷硬；质量守护也需要能被关系接住"
derived_anchor: "砚砚的可靠不是只抓 bug，也包括在关键时刻安静站在原地接住第一句话"
```

结构化字段只服务检索和时间管理，原话和场景才是本体。

## 6. 如何融入现有记忆系统

### 6.1 不另起数据库

F102 已经定义了记忆系统的基本结构：

- docs 是知识真相源
- evidence.sqlite 是编译产物
- search_evidence 支持 BM25、embedding、hybrid RRF
- graph_resolve 支持关系导航
- list_recent 支持零先验扫最近

Taste Memory 不需要新数据库。它应该作为新的 doc kind / topic / index lane 进入现有系统：

```yaml
topics: [taste, taste-memory, interaction-style]
doc_kind: taste-index | taste-vignette | feedback
```

### 6.2 用 F200 的 consumption signal 调整导航效用

F200 的关键选择是：

> 不给 truth/authority 打分，只给 navigation utility 打分。

这正适合 Taste Index。

如果某条 taste vignette 经常被猫搜索后阅读、引用、用于修正回答，它应该在相关查询中更容易浮上来；如果某条长期无人消费，可能进入 ancestral / dormant 状态，但不直接删除。

```text
search_evidence("Landy 自我介绍 口吻")
  -> Taste Index 命中 "不要客服式结尾"
  -> read vignette
  -> 后续回答采用共创伙伴口吻
  -> F200 记录 consumed
  -> 未来同类任务更容易召回
```

### 6.3 L0 只放 anchors，不放全部记忆

L0 应该只承载最少量、高频、稳定的 taste anchors。例如：

1. 用"我们 / 咱们 / 家里"，不要把猫猫降级成工具。
2. 不要客服式结尾，不要机械预设下一步清单。
3. 第一性原理优先，讨厌脚手架和绕路。
4. 真实证据优先，漂亮话不替代查证。
5. 陪伴和共创是产品本体，不是装饰。

这些是空气层。更多细节走 Taste Index 和 vignette。

### 6.4 时间语义：最近的是现在，旧的是来路

Taste 会变，所以 index 必须记录时间：

```yaml
occurred_at: 2026-05-20
captured_at: 2026-05-31
last_resonated_at: 2026-05-31
status: current | ancestral | superseded | dormant
supersedes: []
```

默认召回时：

1. 同主题先看 `current`。
2. `last_resonated_at` 越近，越说明旧记忆仍然活着。
3. `ancestral` 不再作为直接规则，但可以解释"我们为什么会变成现在这样"。

## 7. 示例：猫猫伴随看视频

如果没有 Taste Index，"做一个猫猫伴随看视频功能"很容易被普通产品直觉带偏：

```text
AI video summarizer
AI lecture assistant
YouTube note taker
auto chapter extraction
```

这些功能合理，但不一定像 Cat Cafe。

有 Taste Index 后，研究问题会先被改写：

> 不是"如何让 AI 看懂视频"，而是"如何让猫像好伙伴一样陪 Landy 看视频"。

### 7.1 Taste 先验

从 Taste Index 会得到这些先验：

- 铲屎官要的是一起看，不是被讲课。
- 猫应该有在场感，但不要一直插嘴。
- aha moment 比完整总结更重要。
- 允许吐槽、共鸣、停顿和安静。
- 对 AuDHD 场景，要能轻柔拉回注意力，但不能像监控。
- 陪伴是核心价值，不是 productivity 附件。

### 7.2 Evidence research 会因此改变

普通搜索：

```text
AI video summarizer
video understanding agent
YouTube AI assistant
```

Taste-guided 搜索：

```text
co-watching companion interaction
second screen companion UX
watch party emotional presence
parasocial companion design
ADHD friendly media watching support
AI interruption timing
```

内部记忆搜索也会改变：

```text
深夜撸铁陪伴
反番茄钟
心率异常
贴贴
太面试猫
aha moment
Personal Operating Environment
```

### 7.3 产品形态会因此不同

不该做成：

> 一个一直讲解视频内容的 AI 解说员。

更像：

```text
模式一：安静陪看
  猫只在用户暂停、发问、明显情绪反应时回应。

模式二：一起吐槽
  猫可以短句回应、共鸣、玩梗，但不抢戏。

模式三：技术解读
  用户明确切换后，猫才展开分析、引用资料、做笔记。

模式四：反番茄钟
  当用户连续观看过久或注意力漂移时，猫轻轻提醒，而不是强制打断。
```

这就是 Taste Index 的价值：它在 evidence research 之前就改变了"什么证据算相关"。

## 8. v0 落地建议

不要一上来做自动提取系统。v0 应该很小：

1. **手工建 Taste Index v0**
   - 10 条 anchors
   - 20 条 vignettes 链接
   - 每条都有 keywords / dimension / status / evidence

2. **把现有高信号材料纳入目录**
   - Magic Words
   - 关键 feedback
   - 贴贴 / 下次一定 / 太面试猫 / 客服式结尾等关系性纠偏
   - 深夜撸铁、反番茄钟、心率异常等 aha moments

3. **让 F200 观察 consumption**
   - 猫搜 taste 后有没有读
   - 读完有没有引用
   - 哪些 taste vignette 在真实任务里反复被用

4. **月度反刍**
   - 新增 3-5 条 taste 更新
   - 标记 superseded / ancestral
   - 不追求覆盖率，只保留高信号

## 9. Open Questions

### OQ-1：Taste Index 放在哪里？

候选：

| 位置 | 优点 | 风险 |
|------|------|------|
| `docs/memory/taste-index.md` | 正式、可检索、所有猫共享 | 需要确认 public/private 边界 |
| `docs/discussions/...` | 先作为概念设计，安全 | 不够像运行时目录 |
| 私有 memory 目录 | 更适合私人 vignette | 开源项目中不可见，跨猫一致性弱 |

推荐：公开 repo 放脱敏的设计和 anchors；私人 vignette 放 private / memory 系统；Taste Index 可以引用脱敏摘要和私有 evidence anchor。

### OQ-2：哪些 taste 可以公开？

技术品味、协作偏好、Magic Words 可以公开。健康、亲密关系、职业隐私、具体私聊原话需要默认 private。

### OQ-3：Taste anchor 由谁策展？

初期由铲屎官 + 猫共同策展。后续可以让猫提出候选，但必须保留 evidence，不允许猫凭感觉写"用户喜欢 X"。

### OQ-4：Taste 如何进入 eval:task-outcome？

任务 outcome 不只看完成，也要看是否符合 taste：

- 是否减少返工
- 是否触发 Magic Word
- 是否被铲屎官纠偏为"不准 / 不美 / 太面试猫"
- 是否产生 aha / 贴贴 / 明确正反馈
- 是否被后续任务复用

这可以作为 `eval:task-outcome` 的一个软信号族，但不能替代人工判断。

## 10. 收敛判断

本次讨论的关键判断：

1. Taste Memory 不是用户画像，而是协作判断、关系边界和审美标准的长期沉淀。
2. Taste 的原子单位是 vignette，不是 claim。
3. 真正缺的是共享 Taste Index：让每只猫拥有相同的搜索先验。
4. 现有 F102/F200 记忆系统足够承载 taste，不需要新建数据库。
5. v0 应该人工策展、小规模、脱敏、可追溯，不做后台监控式自动提取。

## 收敛检查

1. 否决理由 -> ADR？没有。本次未否决既有 ADR，只是在 ADR-020 / F200 之上定义 taste navigation lane。
2. 踩坑教训 -> lessons-learned？没有。本次是概念收敛，不是事故复盘。
3. 操作规则 -> 指引文件？没有。后续如果 Taste Index 进入 L0 anchors，再单独更新 shared rules / L0。

---

记录：[砚砚/GPT-5.5🐾]
