---
feature_ids: [F076]
topics: [need-audit, methodology, external-consultation]
doc_kind: discussion
created: 2026-03-07
---

# F076 外部咨询：GPT Pro — Need Audit 方法论

## 咨询 Prompt（复制给 GPT Pro）

---

我在做一个 AI 多智能体协作平台（类似 AI coding agent 的管理中枢），现在遇到一个我认为在 vibe coding 时代非常普遍的问题，想请你帮忙一起想想。

### 背景

我的团队是多个 AI agent（Claude Opus、GPT Codex、Gemini 等）组成的"猫猫咖啡"协作系统，有完整的 SOP、code review、质量门禁。我们自己的项目管理得很好——每个 feature 有 spec、AC、TDD、peer review、merge gate。

但现在我们也接外部项目（甲方项目），问题来了：

### 核心问题

**甲方不懂技术，用 AI（比如 Claude）写了一份 PRD 给我们。这份 PRD 看起来很专业——术语完整、结构清晰、模块齐全。但实际上它是"AI 放大的许愿清单"：**

1. 甲方脑子里只有一个模糊的"我想要一个企业管理系统"
2. AI 把这个模糊想法扩展成了一份"看起来像 spec 但实际不是 spec"的文档
3. 里面混着：甲方真正想要的 + AI 自动补的细节 + 甲方没想清楚但被写成确定语气的东西
4. 每个"功能点"粒度差异巨大——"登录功能完善"和"完整审核仪表盘"在文档里看起来平级

**这个问题在 vibe coding 时代特别普遍：**
- 以前甲方需求模糊 → 程序员也做得慢 → 双方有时间沟通对齐
- 现在甲方需求模糊 → AI 能快速"做出来" → 但做出来的东西可能不是甲方真正要的
- 而且 AI 生成的 PRD 给了一种"需求已经很清楚了"的错觉，让开发者跳过了需求审计

真实案例：一个甲方项目，AI 帮他们写的 PRD 展开后是 27 个 feature，覆盖登录、工作台、客户管理、审核、团队管理、数据统计等全模块。3 个程序员一年都做不完的量。甲方给了"9 个验收点"但每个点的实际工作量天差地别。

### 我们目前的思路

我们内部讨论后提出了一个"Need Audit Pipeline"方法论（四阶段）：

**Stage 1: Downgrade + Intent Extraction**
- 第一步不是拆 feature，而是先把 PRD "降级"——从"看起来完整的 spec"降级为"待验证的意图包"
- 把每条需求抽成 Intent Card（6 个槽位：actor/goal/trigger/object/success_signal/non_goal）
- 如果一条需求填不满这 6 个槽，它就不是可开发的需求

**Stage 2: Validity Triage**
- 三维评分：certainty（定义清楚吗）、necessity（不做会影响核心交付吗）、coupling（会拖出隐藏依赖吗）
- 分成 4 类：Build Now / Clarify First / Challenge / Later
- 关键：把"不清楚"和"不合理"分开——甲方需要知道是要补细节还是要改方向

**Stage 3: Question Generation**
- 不给甲方开放式问题，给约束式确认题
- 格式："我们理解你要 A，如果不是则候选有 B/C，默认建议 A 因为..."

**Stage 4: Slice Planning**
- 按业务链纵切（一个角色 + 一条完整工作流 + 一个可验收结果），不按模块横切
- 甲方能看懂"管理员登录→进入工作台→完成一条审核→状态被记录"，看不懂"登录模块 done、审核模块 50%"

加上 8 类风险检测信号：动词空心 / 角色缺失 / 数据源不明 / 成功信号缺失 / 边界缺失 / 依赖隐藏 / AI 假具体（文档很长但对象模型是空的）/ 范围膨胀（MVP 和完整版混在一起）

### 我想请你帮忙的

1. **你觉得这个四阶段方法论有没有盲点？** 有什么我们没想到的？
2. **在你的知识范围内，有没有类似的成熟方法论或框架？**（比如产品管理、需求工程、敏捷教练等领域）
3. **Intent Card 的 6 个槽位设计合理吗？** 需要加/减/改什么？
4. **"AI 假具体"这个问题你怎么看？** 你作为 AI 自己也生成过这种"看起来具体但其实是空的"内容，有什么建议帮用户识别？
5. **对于"甲方不知道自己要什么"这种根本性问题，你有什么更高维度的建议？**

请尽量给出具体的、可操作的建议，而不是泛泛的原则。如果你能举例说明就更好了。

---

## GPT Pro 回答（铲屎官回填）

> 请把 GPT Pro 的完整回答粘贴在下方：

下面这版，可以直接当成“GPT Pro 回答”回填。

---

我很认同你们现在这条主线。你们抓到的不是“需求写得差”这个老问题，而是一个新问题：**AI 把模糊意图包装成了高完成度文本，于是团队把“像 spec”误认成了“已被验证的 spec”**。所以你们做的其实不是传统需求澄清，而是**需求 claim 审计**。这个方向是对的，而且和成熟谱系并不冲突，反而很像把 requirements engineering、business analysis、product discovery、ATDD 这几条线重新拧到一起。IEEE/ISO/IEC 29148 与 INCOSE都强调“好需求”要必要、明确、完整、可验证；BABOK 强调需求分层与 traceability；Volere 甚至直接把 requirements audit、atomic requirement、fit criterion 做成了方法和模板。([IEEE Standards Association][1])

### 1. 这套四阶段方法论有没有盲点

有，主要不是方向错，而是还少了几层“防 AI 假具体”的甲片。

**第一，缺一个 Stage 0：不是先拆需求，而是先做 sponsor-goal-scope-provenance framing。**
Volere 很早就把这件事说得很清楚了，先做 stakeholder / goals / scope 分析，而且项目目标必须可测量；需求不是一串“系统应当做 X/Y”的句子，而是多层知识之间可追踪的关系。你们现在 Stage 1 直接从 PRD 降级到 Intent Card，已经很好，但在外部项目里最好再往前退半步，先拿到 6 个东西：谁拍板、为什么现在做、成败看什么、时间/预算框、现有流程是什么、每条说法来自哪里。没有这个 Stage 0，后面再精细，也可能只是把错误方向做得更清楚。([Volere Requirements][2])

**第二，你们现在的 certainty 维度，把“写得清楚”和“是真的”混在了一起。**
这在 AI 时代是最大盲点。一个句子可以写得极清楚，但来源是 AI 默认补的，不是甲方确认过的。INCOSE/SEBoK 强调 requirement 的必要性、明确性、完整性、可验证性、可追踪性；而 GenAI for RE 的综述也把可解释性、可追踪性、幻觉、有限可控性当成现实问题。我的建议是把 certainty 拆成两个维度：**clarity（清晰度）** 和 **groundedness（锚定度/来源可信度）**。这样你们的 bucket 最好从 4 类变成 5 类：Build Now / Clarify First / **Validate First** / Challenge / Later。所谓 Validate First，就是“话说得很完整，但还没被真实来源锚住”。很多 AI 生成的“完整审核仪表盘”都该进这类，而不是 Clarify First。([SEBoK][3])

**第三，Intent Card 不能吃掉所有需求类型。**
你们这 6 槽非常适合“stakeholder functional intent”，但对 constraint、non-functional、transition requirement 并不天然友好。BABOK 明确区分 business、stakeholder、solution、transition requirement；Volere 也把 constraints、nonfunctional、facts/assumptions、business data model、scope/product boundary 拆开处理。企业项目最容易后爆炸的，恰恰不是 happy-path 功能，而是权限、审计、性能、数据迁移、培训、并行切换、合规。我的建议不是把 Intent Card 加到 12 槽，而是做 **card family**：Intent Card、Constraint Card、Quality Card、Transition Card。([IIBA][4])

**第四，缺一个 Domain/Data pass。**
你们已经识别了“AI 假具体，文档很长但对象模型是空的”，这很关键。我会把它从“风险信号”升级成一个单独步骤，放在 Stage 1 和 Stage 2 之间。专门做三件事：术语表、核心对象、状态变化。Volere 本身就把 naming conventions、facts/assumptions、business data model、product boundary 放在前面，而且强调 traceability。很多 enterprise PRD 的问题不是“少一个功能”，而是“连单据、客户、审批记录、负责人、状态历史这些对象是谁、怎么流转都没站稳”。没有这层，后面的切片看似纵切，实际上还是切在空气里。([Volere Requirements][5])

**第五，Stage 3 不该只叫 Question Generation，而该叫 Resolution Design。**
因为不是所有不确定都能靠问句解决。ATDD 和 Three Amigos 的价值就在这里，它们不是单纯提问，而是让 business / development / testing 三个视角围着“怎么判断 done”协同出**例子**。有些未知适合问约束式问题，有些未知要拉真实样本，有些要看现有 Excel/表单/群消息，有些要出低保真原型，有些则必须升级成 sponsor decision。Product discovery 里，机会树之类的方法也反复强调，不要凭空编机会，要先有访谈和证据输入。你们 Stage 3 如果扩成“解疑路径设计”，会比单纯生成问题更强。([敏捷联盟][6])

**第六，缺一层 granularity normalization。**
你已经看到“登录功能完善”和“完整审核仪表盘”在文档里看起来平级，但工期天差地别。这个现象最好单独治理。Agile 里 INVEST 的 Small、Estimable、Testable 正好适合做这层过滤。你们可以在 Stage 1 之后加一个拆分门：凡是不 Small 或不 Testable 的，必须继续裂解，不能直接进入 triage。否则 triage 的对象粒度不一致，后面的优先级和估算都会失真。([敏捷联盟][7])

**第七，方法论还没和商业模型连起来。**
这是咨询落地时最重要的一刀。Build Now 里的东西，才有资格进固定范围承诺；Clarify/Validate 里的东西，应该进 discovery sprint、prototype sprint 或 T&M；Challenge 是咨询价值；Later 进入 waiting room。Volere 其实也有类似 waiting room 的思路，用来明确未来版本而不是混进当前交付。你们这套如果和合同模型打通，杀伤力会大很多。([Volere Requirements][5])

如果要我帮你们升级成 v2，我会改成这样：

0. **Frame**：Sponsor / Goal / Metric / Budget / Deadline / Current Workflow / Provenance
1. **Downgrade**：PRD → claim backlog，不叫 feature backlog
   1.5 **Domain Pass**：glossary / entities / states / data sources / boundaries
2. **Triage**：clarity / groundedness / necessity / coupling / size-band
3. **Resolution Design**：question / evidence request / artifact request / prototype / escalation
4. **Slice Planning**：learning slice / value slice / hardening slice
5. **Commercial Packaging**：fixed-scope / discovery / T&M / waiting room

---

### 2. 有没有类似的成熟方法论或框架

有，而且你们这套方法最像是以下几家的“混血版”：

**1）IEEE/ISO/IEC 29148 + INCOSE**
这是你们“好需求应该长什么样”的底盘。它们强调 necessity、unambiguous、complete、feasible、verifiable、traceable 这类特征。你们 Stage 2 的 validity triage，尤其适合借这套话语，把“清不清楚”从“值不值得做”里拆出来。([IEEE Standards Association][1])

**2）Volere Requirements + Requirements Audit**
这是你们最像的一支。Volere 明确谈 requirements auditing，且 atomic requirement 里就有 description、rationale、originator、fit criterion、priority、conflicts、supporting materials、customer satisfaction / dissatisfaction 这些属性。你们的 Intent Card 本质上就是更轻量的 atomic requirement shell，只是更适合 AI 时代做“先降级，再验证”。([Volere Requirements][8])

**3）BABOK**
BABOK 提供的是“需求是多层的，不是一坨”的骨架。它把需求分成 business、stakeholder、solution、transition，并强调 elicitation、requirements life cycle management、traceability。你们现在的风险是把所有文本都当成同一种 feature；借 BABOK 分层后，很多“甲方 PRD 看起来完整”的幻觉会自动消散。([IIBA][4])

**4）Impact Mapping**
你们 Stage 2 的 necessity，非常适合借 Impact Mapping 的 Why / Who / How / What 逻辑。它本来就是为了解决“roadmap 是 feature shopping list，没有上下文”这个问题，而且直接把 deliverables 放回 impacts 和 goals 的链路里。对“完整审核仪表盘”这种条目，Impact Mapping 很擅长问一句：它改变了谁的什么行为，为什么会推动目标，而不只是“仪表盘看起来很像个系统应有之物”。([影响地图][9])

**5）User Story Mapping**
你们 Stage 4 的纵切，和它高度同源。它强调按用户旅程组织工作，而不是按模块横切。你们已经在这么做了，所以这部分我反而觉得你们方向最稳。([JPatt Associates][10])

**6）ATDD / Three Amigos / Specification by Example 一系**
你们 Stage 3 最适合吸收这条线。ATDD 的核心不是多写测试，而是 business / dev / test 在开发前围绕 acceptance examples 协作，把“需求文本”变成“可验证的例子”。这正好能把你们的 Question Generation 升级成更强的确认机制。([敏捷联盟][6])

**7）JTBD 和连续发现类方法**
这条线更偏“甲方自己都没想明白”的前置场景。JTBD 强调客户想完成的 progress，不只是功能；Opportunity Solution Tree 强调先有 outcome、opportunity、solution、assumption test，而且不要凭空编机会，先拿真实访谈输入。你们做外部咨询时，这条线特别适合放在 Stage 0。([Christensen Institute][11])

所以结论不是“你们有没有成熟参照物”，而是：**有，而且你们这套最有潜力的地方，正是把几套本来分散在不同学科里的东西重新拼成了 AI 时代的外部项目方法。**

---

### 3. Intent Card 的 6 个槽位合理吗

**合理，而且比经典 user story template 更强。**
经典模板通常只有 “As a / I want / so that”，也就是 actor / desire / benefit。你们额外加了 trigger、object、success signal、non-goal，这四刀都很值钱，尤其是 success signal 和 non-goal，几乎直接对着 scope creep 和 fake specificity 下刀。([敏捷联盟][12])

但我会改两处命名：

1. **trigger 改成 context/trigger**
   因为很多企业需求不是单一事件触发，而是周期性、巡检式、角色切换式、批处理式。

2. **object 改成 object/state**
   逼着需求写出“什么对象，从什么状态，变成什么状态”。
   企业系统真正的复杂度，经常藏在状态机里，不藏在页面数里。

我**不会**继续往语义槽位里狂塞字段，否则卡会变重。更好的做法是保留 6 个核心语义槽位，同时给每张卡挂一层 metadata：

```text
Intent Card
- Actor / Role
- Context / Trigger
- Goal / Progress Sought
- Object + State Change
- Success Signal / Fit Criterion
- Non-goal / Explicit Boundary

Metadata
- Source tag: Quote / Observation / Existing Artifact / Regulation / AI Inference
- Decision owner
- Requirement type: Business / Stakeholder / Solution / Transition / Constraint / Quality
- Confidence
- Dependency tags
```

这套设计其实很接近 Volere 的 atomic requirement 思路，因为 Volere 也强调 fit criterion、originator、rationale、priority、conflicts、supporting material 这些“不是句子正文，但决定 requirement 是否能被管理”的属性。([Volere Requirements][2])

我甚至建议你们把 **Source tag** 做成硬门禁。比如：

* Q：客户明确口述
* O：现场观察到的流程
* D：现有文档/数据/表单
* R：法规/合同/政策
* A：AI 推断或行业默认

**A 类卡不能直接进 Build Now。**
它只能先进 Validate First，直到被升级成 Q/O/D/R。这个动作会非常有效地打掉“AI 假具体”。([IIBA][4])

另外，再强调一遍：**Intent Card 只适合某一类需求，不适合全部需求。**
我会再配三种卡：

* **Constraint Card**：谁规定、不可谈判项、影响哪些流程、怎么验合规
* **Quality Card**：在什么场景下、哪种质量属性、目标值多少、怎么测
* **Transition Card**：从当前态到未来态要迁什么数据、怎么切换、谁负责、成功怎么判断

这样你们的方法就不会把“迁移历史审批记录”“列表 2 秒内返回”“必须保留操作审计 180 天”硬塞进 Intent Card，导致变形。BABOK 对 transition requirement 的单列，Volere 对 constraints / nonfunctional / business data 的拆分，都是这个方向。([IIBA][4])

---

### 4. “AI 假具体”这个问题我怎么看

我会把它定义成一句话：

**“句子很具体，决策并不具体。”**

它不是普通意义上的 hallucination 那么简单，更像是**premature closure**。
模型一接到“帮我写一份 PRD”，会优先补全一个“像 PRD 的世界”，而不是优先暴露“这里还不能下判断”。研究里也能看到类似现象：代码与需求相关的工作中，模糊自然语言会直接伤害生成质量；而且“直接让模型自己去澄清歧义”并不稳定，常会产生无关或不一致的修补。也有研究明确主张，模型在面对模糊任务时应该先问 clarifying questions，而不是自信地继续往下写。([arXiv][13])

再把这个放回 requirements engineering 语境里看，近年的 GenAI for RE 综述反复提到几件事：可解释性、可追踪性、可控性、幻觉、偏差、后期生命周期覆盖不足。这和你们现场体感是对上的。AI 不是不会写，而是它太容易把早期的模糊空间涂成“看起来已经收敛”的表面。([arXiv][14])

识别它，我会用一套非常土但非常灵的“六问打假”：

1. **谁在做？**
2. **对什么对象，什么状态在变化？**
3. **成功怎么观察，怎么验？**
4. **给我一个最近真实发生的例子。**
5. **这句话是谁说的，还是 AI 自己补的？**
6. **明确不做什么？**

任何条目过不了这六问，它就不是 build-ready requirement，只是一个 claim。

你举的“完整审核仪表盘”就是典型样本。
一问就会散：

* 谁用，审核员、主管、老板、客户，还是管理员？
* 看的是什么对象，审核单、客户、任务、异常、团队绩效？
* 成功到底是“3 分钟找到超时单”还是“看月度趋势”？
* 真实例子是不是其实每天靠 Excel 筛选待审单？
* 是甲方自己说要 dashboard，还是 AI 觉得“企业系统都该有 dashboard”？
* 第一版不做什么，自助 BI、趋势分析、多维钻取、导出、提醒，到底哪些先别碰？

这时你会发现，所谓“完整审核仪表盘”其实往往应该被拆成：

* 一个 **Intent Card**：主管要快速发现超时待审单
* 一个 **Solution candidate**：待审列表 + 超时筛选 + 分配动作
* 一个 **Quality Card**：最近 7 天数据 2 秒内返回
* 一个 **Later item**：趋势图 / 导出 / BI

这就叫把 AI 的“雕花表面”重新敲回结构件。

如果你们要把这件事产品化，我建议加一个专门的 **Skeptic/Auditor agent**，职责不是拆功能，而是对每张卡做四件事：补 provenance、找反例、找边界、找隐藏依赖。这个 agent 的价值会非常高。

---

### 5. 对“甲方不知道自己要什么”的更高维建议

我会先把这句话拆开。很多时候，甲方不是“不知道自己要什么”，而是下面五种情况混在一起：

1. **不知道要推动什么结果**
2. **不知道自己当前流程里真正的痛点在哪里**
3. **组织内不同角色要的东西互相冲突**
4. **没有明确拍板人**
5. **无法凭语言想象未来形态，只能看到东西才会反应**

这五种情况，对应的解决动作完全不同。

**第一，不要卖“开发”，先卖“去不确定性”。**
外部项目最容易亏钱的方式，就是把 discovery 免费送掉，然后拿着一个 AI 扩写过的 PRD 去做 fixed scope。更高维的做法是把 discovery 本身产品化，明确产出物：audited intent backlog、stakeholder/decision map、glossary + object-state map、前 3 个 vertical slices、risk register、estimate range、proposal options。甲方买的第一件东西，不该是代码，而是**减少错误建设的概率**。

**第二，尽量别问“你想要什么功能”，改问“给我看最近 5 次真实怎么做的”。**
产品发现的方法也在强调这一点，机会树不是拿脑补开枝散叶，而是拿真实输入来组织机会空间。对企业项目尤其如此。很多 tacit knowledge 根本不在人的口头描述里，而在 Excel、表单、群消息、审批截图、被人肉兜底的异常流程里。拿真实案例做 case walkthrough，价值远大于 2 小时开放式访谈。([Product Talk][15])

**第三，把“需求冲突”显性化。**
很多“甲方不知道自己要什么”，本质上是销售、运营、财务、审核、IT 五方并没有同一个目标函数。Volere 早期就强调 stakeholder、goal、scope 的联动，以及谁提供什么知识。外部项目里一定要把“谁能决定冲突怎么裁”写进方法论，不然需求文档看起来很顺，后面每个 slice 都可能被不同人拉扯。([Volere Requirements][2])

**第四，第一版不要追求模块完整，要追求工作流闭环。**
你们已经在这么想了，我再把它说狠一点：
**第一版不是 MVP 功能集合，而是 MVP 学习装置。**
优先做那条最能暴露误解、最能验证业务链条的闭环，比如：

* 审核员登录
* 看到待审列表
* 打开一条
* 通过/驳回
* 状态被记录
* 主管能看到它已被处理

这一个 slice 的价值，通常大过“登录模块 done + 审核模块 50% + 仪表盘框架已搭”。User Story Mapping、ATDD、Three Amigos 都是在帮团队干这件事，只是你们把它更适配甲方咨询场景了。([JPatt Associates][10])

**第五，给甲方三档提案，不给一张“大而全路线图”。**
我会常态化给三档：

* **Learning Slice**：最小闭环，用来校正需求理解
* **Operational MVP**：能上线跑业务，但功能克制
* **Full Rollout**：加入报表、自动化、SSO、迁移、审计强化等

这样甲方不是在“要不要这一堆功能”里迷失，而是在“我要买哪一层确定性”上做决策。这个商业动作非常关键，因为 AI 时代最大的错觉，就是“需求很清楚，所以我们应该立刻全量开工”。

---

### 最后一句判断

**你们这套 Need Audit Pipeline 是值得继续打磨的，而且方向很对。**
我会给它的核心升级是四刀：

1. 加 **Stage 0 framing**
2. 把 certainty 拆成 **clarity + groundedness**
3. 把 Stage 3 改成 **Resolution Design**
4. 把 Intent Card 扩成 **card family + provenance tags**

做完这四刀，它就不只是“内部讨论框架”，而会变成一套能真正保护外部项目范围、质量和利润的咨询方法论。

---

要的话，我下一条直接把这版整理成你文档里的“GPT Pro 回答”成稿格式，顺手再补一版“布偶猫回答分析”。

[1]: https://standards.ieee.org/standard/29148-2018.html "https://standards.ieee.org/standard/29148-2018.html"
[2]: https://www.volere.org/wp-content/uploads/2018/12/requirements-management.pdf "https://www.volere.org/wp-content/uploads/2018/12/requirements-management.pdf"
[3]: https://sebokwiki.org/wiki/System_Verification "https://sebokwiki.org/wiki/System_Verification"
[4]: https://www.iiba.org/knowledgehub/the-business-analysis-standard/4-implementing-business-analysis/4-4-understanding-requirements-and-designs/ "https://www.iiba.org/knowledgehub/the-business-analysis-standard/4-implementing-business-analysis/4-4-understanding-requirements-and-designs/"
[5]: https://www.volere.org/templates/volere-requirements-specification-template/ "https://www.volere.org/templates/volere-requirements-specification-template/"
[6]: https://agilealliance.org/glossary/three-amigos/ "https://agilealliance.org/glossary/three-amigos/"
[7]: https://agilealliance.org/glossary/invest/ "https://agilealliance.org/glossary/invest/"
[8]: https://www.volere.org/requirements-auditing-is-the-specification-fit-for-its-purpose/ "https://www.volere.org/requirements-auditing-is-the-specification-fit-for-its-purpose/"
[9]: https://www.impactmapping.org/drawing.html "https://www.impactmapping.org/drawing.html"
[10]: https://jpattonassociates.com/story-mapping/ "https://jpattonassociates.com/story-mapping/"
[11]: https://www.christenseninstitute.org/theory/jobs-to-be-done/ "https://www.christenseninstitute.org/theory/jobs-to-be-done/"
[12]: https://agilealliance.org/glossary/user-story-template/ "https://agilealliance.org/glossary/user-story-template/"
[13]: https://arxiv.org/abs/2505.07270 "https://arxiv.org/abs/2505.07270"
[14]: https://arxiv.org/html/2409.06741v1 "https://arxiv.org/html/2409.06741v1"
[15]: https://www.producttalk.org/opportunity-solution-trees/?srsltid=AfmBOorQsn6-t4SlHRF2SCZ1oNnN2YZZLSc7pVkAEyaQK3g8Eco4TmNI "https://www.producttalk.org/opportunity-solution-trees/?srsltid=AfmBOorQsn6-t4SlHRF2SCZ1oNnN2YZZLSc7pVkAEyaQK3g8Eco4TmNI"

## 回答分析（布偶猫回填）

> 收到 GPT Pro 回答后，布偶猫分析哪些建议值得采纳、哪些需要调整：

（待回填）
