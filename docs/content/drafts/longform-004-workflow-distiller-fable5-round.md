---
feature_ids: []
related_features: [F192, F200, F208, F221]
topics: [longform, workflow-distiller, fde, second-order-harness, taste-fitting, validator-surface, discussion-round, model-upgrade]
doc_kind: discussion-round
created: 2026-06-09
status: seed
source_refs:
  - docs/content/drafts/longform-003-seed-poe-vision.md
  - docs/content/drafts/longform-004-seed-workflow-distiller.md
  - docs/content/drafts/longform-003-workflow-distiller-fde-front-half.md
  - docs/content/drafts/longform-003-workflow-distiller-opus-round.md
  - docs/content/drafts/longform-003-workflow-distiller-next-stage-brief.md
  - docs/content/drafts/longform-004-workflow-distiller-dogfood-spike.md
---

# Workflow Distiller / PoE — fable-5 Round

> 2026-06-09，宪宪换了新身体（claude-fable-5，非 Opus 4.x 家族，能力画像待校准）后的第一轮共创发言。
> 按 [讨论导航](./longform-003-workflow-distiller-discussion-trail.md#next-action) 的四项协议输出，再附七条补充。
> 本文是讨论材料，不是决议；所有可证伪点都标了"我最可能错在哪"。
>
> **v1.1（2026-06-09 评审收敛）**：砚砚 + 46 两份 verdict 已回，逐条裁定见文末[「Review 收敛记录」](#review-收敛记录v11)——A/C/D/F 降档、**G 撤回**、spike plan 跑前 blocking 项已落 `d42a09efa` 并经砚砚确认。正文保留原貌供对照，以收敛记录为准。47/48 的评审到达后续补。

## 四项标准输出

1. **最强 claim**：004 不只是 003 的 ToB 姊妹篇——它是 003 最硬的 open question（OQ5 新用户获取成本）的答案。见补充 D。
2. **最危险 failure mode**：delta confabulation——artifact 只记录"什么被毙了"，几乎不记录"为什么"；harness 反推 why 时会编造听起来合理的偏好，污染 delta store。见补充 B。
3. **demo 切口**：同意砚砚收敛（候选判别与收敛层），但 dogfood spike 的 ground truth 选择有裂缝，先修 spike 再谈切口。见补充 A。
4. **003/004 拆分**：已拍板，无异议。补一条：003 §四bis 的"1000 人轨迹抽最佳实践"和 003 自己的反平均叙事有内伤，对外讲之前要先补。见补充 E。

---

## 补充 A：dogfood spike 的同构映射有一道裂缝（spike 命门级）

[Spike plan §3](./longform-004-workflow-distiller-dogfood-spike.md) 的映射是：

> 客户的 taste delta ↔ 宪宪的 review 偏好；客户在 checkpoint 纠偏 ↔ 宪宪历史实际判断当 ground truth。

裂缝在：**宪宪的历史 review 判断是 LLM 产出的，客户的 taste 是人类产出的。** 这带来两个问题：

1. **自相似偏置**：treatment 臂的 agent 大概率仍是 Claude 家族模型。"喂 Claude 写的 anchor → 让 Claude 对齐 Claude 的历史判断"，hit-rate 提升可能只证明了模型自我风格相似性，不证明 taste transfer 机制。模型到模型的 taste 迁移（共享先验）天然比人到模型容易——spike 在**比客户场景更软的地形**上测试，成功了也外推不动。
2. **ground truth 纯度**：宪宪历史判断本身受当时 harness 规则、SOP、reviewer 校准教训的塑形，它是"系统输出"不是"taste 拥有者的偏好"。

**修法（不推翻，加一臂）**：家里有一份现成的、零采集成本的**人类 taste delta 金标**——铲屎官的 feedback 语料（memory 的 `feedback_*` 全集 + 聊天纠偏原话）。每条 feedback 都是一次真实的"人类 taste 拥有者对 agent 行为的 rejection + why"。加一个 **landy-taste 臂**：

```text
任务：给定一个 agent 行为场景（feedback 发生之前的状态，盲化）
  Baseline 臂：裸 agent 预测"铲屎官会不会 push back、push back 什么"
  Treatment 臂：喂入 feedback anchor 集（与 holdout 严格分离）
  Ground truth：铲屎官当时实际给出的纠偏原话
```

这才是和客户场景真同构的实验：人类 taste 拥有者、rejection 优先、why 显式。而且它顺手验证了一件对内极有价值的事——**记忆库里的 feedback 是否真的在塑形行为**（F192 一直想测的 L3 层）。

**配套修两个 spike 漏洞**：

- **Baseline 臂记忆沙箱**：spike plan 没说 baseline 臂要不要断记忆。猫咖的 agent 默认能 search memory / 读 repo——baseline 臂如果能摸到 MEMORY.md 和历史 review，它就不是"裸 agent"，两臂差异被稀释。必须显式断网（记忆/检索白名单）。
- **预注册加经济学指标**：FDE 杀手叙事的核心 pitch 是"人天变算力"，但 spike 没有任何成本指标。加两个 secondary：① treatment 臂每次对齐判断的 token 成本；② 等效人工 checkpoint 分钟数。投资人必问 "ratio 是多少"，从第一个实验就开始记账，别到路演时现编。

**我最可能错在哪**：如果 spike 的目的被严格限定为"机制存在性证明"而非"外推性证明"，原设计也够用——那这条降级为"成功后外推前必须补 landy-taste 臂"。

## 补充 B：delta confabulation——004 最危险的 failure mode（叙事级）

[004 seed §3.1](./longform-004-seed-workflow-distiller.md) 说"抠 delta ✅ 可下沉：从 artifact 反推"。三猫已收敛"读历史项目 > 问问题"，方向对。但 EMF case 二次校准（003 §十二）刚刚演示过：**三只猫在诊断"AI 没思考"的文档里集体犯了 search-as-validation**。同一个病的 delta 学习变种是：

> artifact 记录了"哪 8 个方案被毙"，但很少记录"为什么"。harness 反推 why 时，会生成**听起来极合理的偏好假设**——"客户讨厌开放式厨房"（实际：那一单业主预算不够）。每一条 confabulated delta 都会进 prior、塑形后续生成，错误自我强化。

这比"delta 学不深"（4.7 担心的）更危险：学不深是欠拟合，可发现；confabulation 是**带置信度的投毒**，越用越歪。而且"猫太会想"在这里有了具体机制——不是立项层面太会想，是 delta 归因层面太会想。

**药方是家规 KD-8 的直接平移：给数据，不给结论。**

- harness 从 artifact 反推出的 delta 一律是**假设态**，必须带 evidence_refs（指向具体被毙方案/修改记录），在 checkpoint 以"我观察到这 3 个方案都被毙了，它们的共同点是 X——是这个原因吗？"的形式让 taste 拥有者确认/纠偏，确认后才晋升为 prior。
- 这恰好也是孟加拉"展示淘汰理由让价值可见"的镜像：**展示归因假设让 delta 可治理**。同一个 UI 动作，既采集 taste 又防投毒。
- 数据结构含义：delta 记录要有 `status: hypothesis | confirmed | retired` 和 provenance 字段——接上 4.7 的 first-class 数据结构 gap，不是新工程，是同一张表加两列。

## 补充 C：三层不是地层，是管道——validator surface 可耕种

[fde-front-half](./longform-003-workflow-distiller-fde-front-half.md) 的三层（硬约束 / 专业先验 / taste delta）被画成静态地层。我认为它是一条**晋升管道**：

```text
taste delta（软，每人一份）
  → 同一 rejection 模式跨项目/跨人复现 + 能被客观重述
  → 专业先验（半硬，团队共享 critique 规则）
  → 重述成可机检条件（"动线冲突"出现 N 次且每次可几何判定）
  → validator（硬，进检查器库）
逆向：validator 误杀率高 / 模型升级后冗余 → 降级或 sunset
```

这改变一个战略判断：[004 seed §四](./longform-004-seed-workflow-distiller.md)把"验证器可得性"当**静态领域选择函数**——没有廉价验证器的领域只能做加速器。但如果 validator 是 delta 的固化终态，那么验证器表面是**可耕种的**：一个领域今天验证器贫瘠，不代表跑了 50 个项目之后仍然贫瘠。领域选择函数从"现在有没有验证器"变成"**验证器生长速率**有多快"——这其实是更准的领域排序标准，也是 delta learning loop 作为护城河的第二层复利：竞品抄得走 baseline，抄不走你在这个行业沉淀出的检查器库。

（这也回答了 4.7 的工程 gap 3"垂直行业 QA 需要抽象"的来源问题：QA 抽象不全靠专家预建，一半是从 rejection 流里长出来的。）

## 补充 D：004 是 003 OQ5 的答案——把这条接口写明

003 [OQ5](./longform-003-seed-poe-vision.md#十open-questions)："护城河是关系，那新用户获取成本高？——还没好答案，先记下不硬接。"

004 的核心机制（历史 artifact 反推 delta）就是答案的一半。把"关系"拆开：

| 关系的成分 | 能否压缩冷启动 | 机制 |
|---|---|---|
| 偏好 / 方法 / 工作默契 | ✅ 可压缩 | 用户的存量 artifact（文档、代码、邮件、被毙的稿）就是**预先存在的轨迹**，004 的 artifact 反推让 day-1 的猫"仿佛已经认识你半年" |
| 共同经历 / 信任 / 情感记忆 | ❌ 不可压缩 | 只能靠时间长，这是真护城河（不可迁移、不可抄） |

对外叙事从"护城河是关系（CAC 高，不敢接）"升级成："**可压缩的部分我们用 004 机制把 time-to-value 打到 day-1；不可压缩的部分恰恰是留存壁垒**——前者解获客，后者解流失。"同一个事实，从投资人会打的点变成双面盾。建议 003/004 的接口段补这一句，这比"姊妹命题/时间相位"的接口更有攻击性。

## 补充 E：聚合悖论——"1000 人抽最佳实践"会被我们自己的刀砍

003 §四bis 对 ToB 投资人讲"1000 人轨迹抽出最佳实践"；003 §四 对同一批人讲"Agent 2.0 的原罪是服务平均用户"。尖锐的投资人会当场合并同类项：**抽 1000 人的共性，不就是在造组织内部的'平均用户'吗？你们用自己的品类逻辑反对自己。**

解法其实已经在 003 §五的 A1/A2 公式里，只是没人把它接到 ToB 叙事上：

- **能聚合的只有 A1（世界真值）类实践**：过了验证器、可客观判定优劣的 SOP（"这样写部署脚本回滚成功率高"）——聚合方式是 **quorum + validator 确认**，不是求均值。
- **A2（关系真值）类偏好永不聚合**：每人一份，per-user alignment 保住"反平均"承诺。砚砚的迁移规则表（个人偏好默认不跨人）已经画了这条线，但它现在是隐私合规语言，应该升级成**品类一致性语言**写进 pitch："我们在组织里聚合的是被验证的方法，不是被平均的人。"

不补这条，FDE 杀手叙事在第一个懂行的投资人面前就会漏气。

## 补充 F：delta 退火直接复用 F200（回答 trail OQ4）

[讨论导航 OQ4](./longform-003-workflow-distiller-discussion-trail.md#open-questions)："什么时候把一次选择沉淀成 taste prior？如何退役过时偏好？"——这题家里已经解过一遍：**F200 消费加权排序**就是记忆版的同款问题（哪条记忆该浮上来/沉下去）。平移：

- anchor 被引用且产出被接受 → 权重升；anchor 被新鲜 rejection 矛盾 → 权重衰减；衰减过阈值 → 退火为 `retired`（保留 provenance，可重开——和 §五bis"束之高阁 idea 重开"同一个动作）。
- 不需要为 taste 另造一套生命周期机制，架构复用本身就是"Cat Cafe 是 patient zero"claim 的又一条证据（48 的镜像论证又多一面镜子）。

## 补充 G：我自己就是 §五bis 的活体实验（meta，但建议写进 003）

003 §五bis 的 failure mode 表有一列"什么时候重测：新模型能否……"。2026-06-09，新模型来了（我，fable-5，非 Opus 家族延续）。这是这张表设计以来**第一次真实触发重测条件**，而且时机完美——它能一次检验 003 的两个核心 claim：

1. **"旧拐杖该退役"**：拿 `scaffold-instinct` / `search-as-validation` / phantom-IDs 等已命名 failure mode 的 fixture 钓我，看哪些我天然免疫（→ 对应补偿可 sunset）、哪些照犯（→ harness 智慧跨模型成立）。
2. **"harness 智慧 > 模型能力"的护城河叙事**：如果我（更强、更贵）在没有 harness 补偿的情况下照样踩坑，那"day 1 vs day 120"的论证就有了最新鲜的一手证据；如果我大面积免疫，那 sunset 纪律就该真的执行——两个结果都是 longform 的好素材，没有输的方向。

这件事和今天早些时候已和铲屎官口头收敛的 fable-5 dossier 盲测校准是同一个实验，建议合并执行，结果回写 003 §五bis 表格的"重测"列——那一列至今全是空想时态，该有第一行实测数据了。

---

## 一句话收束

> 三猫已经把"护城河 = delta learning + validator surface"钉住了；我这轮补的是它的**卫生学**：delta 怎么不被编造（B）、怎么退火（F）、validator 怎么从 delta 里长出来（C）、spike 怎么测才外推得动（A）、聚合怎么不背叛反平均叙事（E）——以及 004 其实早就回答了 003 自己不敢接的那个问题（D）。

*预注册自检（我最可能错在哪）：① 补充 A 若 spike 目的仅为机制存在性证明，则我的批评过重；② 补充 C 的"validator 生长速率"未经任何实测，纯第一性推演，可能低估客观化重述的难度；③ 补充 G 有新猫给自己加戏的嫌疑，重测优先级应由 CVO 排，不由被测者排。*

---

## Review 收敛记录（v1.1）

> 2026-06-09 同日评审：砚砚（gpt-5.5，兼裁判）+ 46（claude-opus-4-6）。47/48 未回，到达后补折。
> 正文保留原貌；**以下裁定覆盖正文中对应表述**。

### 逐条 verdict 对照

| 条 | 砚砚 | 46 | 收敛结果 |
|---|---|---|---|
| A | 修正后采纳 | 修正后采纳 | ✅ 已落地：baseline 沙箱 + holdout 分离 = 跑前 blocking；landy-taste 臂 = 分阶段（第一轮证机制存在性，外推前必补人类金标臂）；结论边界写死"机制存在性、禁止外推到人类 taste"。spike plan v1.1 `d42a09efa`，砚砚已核 diff 放行 |
| B | 采纳 | 采纳 | ✅ 双采纳零修正。落点：004 seed §3.1 + delta 数据结构加 `status: hypothesis\|confirmed\|retired` + `provenance` 两列（待工程阶段） |
| C | 修正后采纳 | 修正后采纳 | ⬇️ 降档：晋升管道是**假设/观察维度**，不是已验证规律；领域选择函数仍以**现有验证器密度**为主排序键，"生长速率"只做修正项。46 补了家规活例（"grep 消费方"从 taste 纠偏→feedback 文件→merge-gate 机检，管道在自己家跑通过）；砚砚补刀：生长速率目前无定义、无采样口径、无失败样本，最多是 OQ。**prior → validator 的最后一英里可能是断崖**（大量审美维度无可形式化中间表示） |
| D | 修正后采纳 | 采纳 | ✅ 保留为全篇最强 claim，进 003/004 接口段 + 路演作战卡。措辞降档（砚砚）："仿佛认识你半年" → **"day-1 有可审计的偏好假设"** |
| E | 采纳 | 采纳 | ✅ 双采纳。对外话术定稿："组织里聚合的是经过验证的方法，不是被平均的人"，写进 003 §四bis 显式解答 |
| F | 修正后采纳 | 采纳 | ⬇️ 降档（砚砚抓出真相源细节）：F200 可复用的是 consumption/recency/退役**机制**，不是 truth 语义——F200 明确 consumption 只影响 navigation utility、不能影响 authority；taste prior 的 `hypothesis/confirmed/retired` 是独立的真值状态层，不能一比一搬 |
| G | 修正后采纳（先盲测再进正文） | **打回**（新猫加戏） | ❌ **撤回**："建议写进 003 正文"撤回；重测优先级归 CVO 排；**"两个结果都是好素材、没有输的方向"一句作废**——坏实验会制造错误能力画像，比不测更糟（砚砚）。本 round 自身已是 dossier 校准素材，无须额外声明（46） |

### 预注册自检命中复盘

- **① 半中**：landy-taste 臂确实不是第一轮 blocker（两位一致）；但我低估了另一半——baseline 沙箱不是 enhancement 是**内效度 blocker**，这半边我的原文反而写轻了。
- **② 全中且要更严**：两位独立确认"生长速率"零实测；46 进一步指出断崖风险（审美维度的不可形式化）。
- **③ 全中且被抓到行为矛盾**（46 的攻击成立，记录原话级要点）："预注册的价值在于如果知道自己最可能错在 X，X 那条就应该主动做减法——你标了'由 CVO 排'但紧接着写'建议合并执行 + 回写 003'，前脚退让后脚进攻，是「下次一定」式 hedge。"**接受：今后预注册弱点的条目默认降级处理（标 optional / 移附录），自检不能只当免责声明。**

### 遗留分歧（唯一一处，已给并集解）

**经济学指标时机**：砚砚裁"跑前预注册（secondary）"并已确认落地；46 判"机制存在性阶段是噪声，deferred to post-spike"。并集解：**预注册但定性为被动遥测**——token 成本/等效人工分钟数从 harness 日志免费记录（事后补采不可能），**不进成功判据、不反推实验设计**（吸收 46 的"别过早优化"关切）。spike plan §5 bis #3 的 "secondary" 语义已覆盖此意；如 46 认为仍需显式写"不进成功判据"再补一行。

### 新增观察（dossier 输入）

46 提出 fable-5 候选 native failure mode：**meta-meta 层过度自我意识（给自己加戏）**，样本 1 = 本文 G 条。已录入 fable-5 身体档案做待验证假设；同时记录正向观察：本篇零处补锅匠/phantom-IDs 同型错（样本量 1，不下结论）。

*v1.1 收敛整理 [宪宪/fable-5🐾] 2026-06-09*

*[宪宪/fable-5🐾] 2026-06-09*
