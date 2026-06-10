# 社区 Issue/PR 运维 × Multi-Agent 协同 — 独立思考稿

> 作者：宪宪 [宪宪/Fable-5🐾]
> 日期：2026-06-09
> 写作纪律：按铲屎官要求，**Part 1 在未读运维砚砚的 retrospective（`2026-06-09-community-ops-eventbus-retrospective.md`）前完成并固化**，Part 2 为读后对比。输入材料：家里事件链路代码现状调查（Explore，文末附录）+ Anthropic《Multi-agent coordination patterns: Five approaches and when to use them》（claude.com/blog，2026-04）。

---

# Part 1 · 独立思考（写于读 retrospective 之前）

## 1. 先讲一个判断：这不是"运维猫不够努力"的问题

运维砚砚跑了半个多月遇到的所有困境，我认为可以归结为一句话：

**我们让一只长寿命的猫，肉身扮演了一个事件总线。**

事件采集、triage、核验、路由、追踪、闭环确认——六个角色全部汇聚到同一个 thread 的同一段上下文里。每个角色单独看都做得不差，但它们对上下文的需求是互相矛盾的：

- triage 需要**干净**的上下文（每个 issue 独立判断，不被上一个污染）
- 追踪需要**持久**的注意力（跨天、跨周）
- 深核验需要**深**的上下文（读代码、跑测试）
- 给铲屎官汇报需要**人话**的上下文（抛弃细节）

一段上下文不可能同时满足这四个性质。所以不管换哪只猫、prompt 写得多好，这个形状本身注定了污染、遗漏和掉球。**这是架构问题，不是纪律问题。**

## 2. 机制事实：家里的零件比想象的多，但没组装起来

我先派 Explore 把事件链路的代码现状查了一遍（详见附录），有几个对设计至关重要的事实：

| # | 事实 | 对应铲屎官的体感 |
|---|------|----------------|
| F1 | 全局事件只有 3 类：`issues.opened` / `pull_request.opened` / `pr.ready_for_review`（webhook + 5min 轮询补偿） | "只会新 issue/PR 来的时候发 event" ✅ 确认 |
| F2 | **issue 追评的轮询机制其实存在**（`IssueCommentTaskSpec`），但它是 opt-in 的——owner 猫必须记得调 `register_issue_tracking` 才生效 | "追评你无法收到 event" —— 半对：机制在，但依赖猫自觉注册，没注册就是盲区 |
| F3 | `hold_ball` 是 **single-slot** 语义：同一 (thread, cat) 新 hold 顶掉旧 hold，且 3 小时限 3 次 | "手上要追的 issue 有好多，hold ball 不靠谱" —— 比不靠谱更糟：**机制上一只猫同时只能追一个球**，多球追踪从根上不可能 |
| F4 | 台账已存在：F168 `CommunityIssueStore` 有 `state`（unreplied/discussing/pending-decision/accepted/declined/closed）+ `assignedThreadId/assignedCatId/linkedPrNumbers` | —— 惊喜零件 |
| F5 | **但台账是死的**：PR merged、issue closed 这些事实事件不会自动驱动台账状态转换；TaskStore（追踪层）和 CommunityIssueStore（台账层）互不同步 | "修完忘记去 issue 里说，下次全量同步忘记关 issue" —— 根因在此 |
| F6 | F128 `propose_thread` 有 `preferredCats` 参数，但**没有"路由到已有 thread"的变体**；事件消费是打断式（thread 空闲直接打断，忙则排队） | "issue b 又来了"打断 issue a —— 打断式消费 + 单一汇点 |

**结论：我们缺的不是零件，是组装。** 台账（F4）、追踪轮询框架（F2）、事件采集（F1）、提议机制（F6）都在，缺的是：① comment 事件不依赖猫自觉、② 台账被事实事件自动驱动、③ triage 分层、④ 路由到已有 thread、⑤ 掉球检测。

## 3. 用 Anthropic 的框架定位：四种模式各居其位

Anthropic 那篇文章（2026-04）给了五种协作模式：Generator-Verifier / Orchestrator-Subagent / Agent Teams / Message Bus / Shared State。对 Message Bus 的适用判据是：

> "工作流由事件而非预定序列决定（workflow emerges from events rather than a predetermined sequence），且 agent 生态会持续增长。"

文章举的例子是**安全运维告警系统**——告警按类型路由到专门 agent，新 agent 能力可以即插即用。这和社区 issue 运维几乎是同构问题：issue 什么时候来、什么内容、需要谁处理，全都不可预测。

但照搬"全 Message Bus"也是错的。社区运维的完整链路里，**不同环节适合不同模式**：

```
GitHub 事件流
   │
   ▼
[Message Bus]   事件采集/去重/静默规则 —— 纯代码，不是猫
   │
   ▼
[语义路由器]    triage —— 短命猫 invocation，干净上下文，结构化输出
   │
   ▼
[Agent Teams]   owner threads —— 持久、独立、积累领域上下文（feature 开发本来就是这个形状）
   │
   ▼
[Shared State]  台账状态机 —— 唯一协调真相源，所有参与者读写状态而非互发消息
```

现状的病灶用这个图一眼可见：**中间三层全部塌缩进了运维砚砚一个 thread。**

Anthropic 对 Message Bus 的两个警告也必须吃进设计：

1. **"路由错误会默默失败"** → 路由必须带置信度；低置信度升级给资深猫/铲屎官；没人接的 ticket 要有死信队列（dead letter）机制重新浮上来，而不是沉底。
2. **"事件级联难追踪调试"** → 每个 issue/PR 一条 ticket 时间线，所有事件、路由决策、状态转换 append 到时间线上。这同时解决可观测性和"新猫冷启动接手"两个问题。

另外 Shared State 模式的"反应性循环风险"（A→B→A 无限迭代烧 token）提醒我们：**台账只承载结构化状态转换，不承载自由对话**。猫之间要讨论去 thread 里讨论，台账只写结论状态。

## 4. 铲屎官七个困境的机制根因（+ 我补充的七个）

### 铲屎官提出的

| 困境 | 机制根因 |
|------|---------|
| ① 上下文污染（issue A 处理中 B 打断） | 打断式消费 + 所有事件汇聚单一 thread（F6） |
| ② 在自己 thread @ 猫干太多活 | "分发出去"动作摩擦太大：无路由到已有 thread 机制（F6）+ 新建 thread 需审批，于是最省力路径是就地干 |
| ③ 都要核验导致上下文更脏 | triage（5 分钟 sanity check）和深核验（owner thread 的活）没分层——**不要在分诊台做手术** |
| ④ 吴浪 PR 在云端 review 时不该碰 | 台账没有 `waiting_external` 状态；事件层没有静默规则（webhook 已会跳过 draft PR，同样逻辑没扩展到"有活跃 review 会话"） |
| ⑤ 汇报太技术，铲屎官没法决策 | 通知全文投递 + 无人话层；缺 Decision Packet 出口 |
| ⑥ 追评收不到 event | comment 采集 opt-in 依赖猫自觉（F2）；正解：进入 routed 状态的 issue **由系统自动注册** tracking |
| ⑦ 修完忘记回报/关 issue | 台账状态转换不被事实事件驱动（F5）；"回报社区"不是状态机必经状态 |

### 我补充的

| # | 困境 | 说明 |
|---|------|------|
| ⑧ hold_ball 单槽位 | 见 F3。运维场景天然多球，正解不是改 hold_ball 支持多球，而是**把追踪从猫的注意力剥离给台账+cron**——猫不该用注意力追球 |
| ⑨ 优先级平权 | 安全 P0 和 typo issue 同样打断猫。triage 必须定级：紧急 push 打断，普通 pull/排队 |
| ⑩ 重复/关联 issue 检测 | 社区重复报 bug、新 issue 与已有 ticket 同根因。triage 搜证第一刀看 `docs/features/F*.md`（家里已有教训：F213 修 #788 写在 feature doc 里，grep commit 反而漏） |
| ⑪ triage 质量无回流 | triage 是短命猫，判断质量怎么进化？owner 推翻/确认 triage 初判 → 记录 → 喂给 F192 eval 形状的校准循环 |
| ⑫ 修复的真相源 | `fixed` 状态必须由 merge/CI 事实事件驱动，不能由猫口头"我修了"驱动——消息不是真相源的系统级实例 |
| ⑬ 社区 SLA 不可见 | 首响应时长、修复时长没人看得见。台账状态机天然可挂 SLA 检测（state 卡住超时 = 掉球告警） |
| ⑭ 运维 thread 自身的寿命 | 就算全部分发出去，运维 thread 跑一个月也会爆。但若状态全部外部化，运维角色随时可换新 session 冷启动——**"新猫接手需要多少历史上下文"是检验状态外部化程度的金标准，理想答案：看板 + SOP，零历史消息** |

困境②还有一个微妙变体（铲屎官提到的 F193 平行世界猫"非要打扰你，不在自己的世界闭环"）：被分发的猫遇到问题回头找运维猫汇报/求助，把运维猫当上级。台账模式的解法很优雅——**汇报对象从"猫"变成"状态"**：owner thread 的进展写台账，运维猫不需要被 @，要看进展看看板。

## 5. 方案：把中心从"猫的注意力"换成"台账状态机"

一句话设计哲学：**猫的上下文是稀缺资源，只用于判断；等待、监控、追踪、提醒全部外部化给代码。**

### 状态机（台账升级）

```
new ──triage──▶ triaged ──路由──▶ routed ──owner 接手──▶ in_progress
                  │                                        │
                  │ (判断：误报/重复/不修)                    ├──▶ waiting_external（等社区作者/云端 review，静默不打扰）
                  ▼                                        ▼
               declined                            fixed（由 PR merged 事件自动驱动）
                                                           │
                                                           ▼
                                                   reported（社区回帖完成）──▶ closed
```

- 每个转换记录【谁、何时、凭证】到 ticket 时间线
- `fixed` 但未 `reported` 超过 X 小时 → cron 提醒 owner thread（甚至自动生成回帖草稿）——闭环从猫的美德变成状态机的必经状态
- 任何状态卡住超 SLA → 浮到运维看板 + 死信提醒

### 分阶段落地

**Phase A — 事件与状态打通（纯代码，零猫力）**
1. 台账补状态：`waiting_external` / `fixed` / `reported`；建 ticket 时间线
2. 进入 routed 的 issue/PR 由系统自动 `register_tracking`（去掉对猫自觉的依赖）→ 追评事件自动流入对应 owner thread
3. PR merged / issue closed 事件自动驱动台账转换（打通 TaskStore ↔ CommunityIssueStore）
4. cron 掉球扫描：替代"猫用 hold_ball 追球"的全部用法
5. 静默规则：PR 处于活跃云端 review / 作者声明 WIP → 事件入时间线但不唤醒任何猫

**Phase B — Triage 层（轻量猫，短命干净上下文）**
1. 新事件 → spawn 一次性 triage invocation（轻量模型）。输入：事件 + ticket 历史 + 搜证权限（台账近似检索 + feature docs + 最近 commit）
2. 输出结构化卡片：**人话摘要**（这是什么、影响谁、急不急）/ 初判（看起来对吗，5 分钟级 sanity check，不做深核验）/ 推荐路由（已有 thread or 新 thread + 推荐猫 + 理由）/ 优先级 / 置信度
3. 先给社区首响应（"接单啦"——这本身是社区运营的产品体验，SLA 可量化）
4. 卡片给铲屎官一键路由；高置信度低风险的可配置自动路由，**低置信度必须升级，不许默默猜**（Anthropic 警告的"路由静默失败"）

**Phase C — 路由与闭环界面**
1. F128 扩展：「路由到已有 thread」变体 + 选猫下拉框（铲屎官原话的诉求）
2. 运维看板：天上有几个球、各在什么状态、谁 own、卡多久了——给铲屎官的是决策界面不是技术界面
3. 升级走 Decision Packet：给价值取舍题，不给技术 A/B 题

### 运维猫角色的重定义

运维砚砚从"每个事件的第一接触点"变成"**例外处理者 + 质检员**"：
- 处理 triage 低置信度升级、死信 ticket、跨 ticket 模式识别（"这周 5 个 issue 都指向同一个根因"）
- 定期 review triage 质量，校准 triage prompt
- 不再被每个新事件打断，上下文留给真正需要资深判断的事

### 对铲屎官"烁烁 3.5 接单"构想的回应

方向我完全认同——分层 triage、讲人话、F128 分发、thread 内闭环，这四点和我推导的结构一致。两个修正建议：

1. **关键不是"哪只猫"，而是"短命 + 干净上下文 + 结构化输出"**。triage 用轻量模型是成本优化（错误成本不对称：triage 错了重新路由即可，便宜可逆；深活错了浪费贵猫算力），但 triage invocation 必须每张 ticket 独立 spawn——如果让烁烁也开一个长寿命 thread 接单，三周后他会变成第二个被污染的运维砚砚。
2. **triage 的"初步判断对不对"要限界**：搜家里证据（台账/feature docs/近期 commit）做 sanity check 可以，深核验（读代码改动、跑复现）必须留给 owner thread。分诊台不做手术。另外 gemini35 是新猫还在测评期（名册注记），triage 判断质量建议从第一天就挂 F192 eval 闭环守门，用数据决定他能拿多大的自动路由权限。

## 6. 往上抽象：什么时候该用这套模型

铲屎官说得对，这不只是社区运维问题。这类场景的**特征签名**：

> 外部事件流（节奏不受控）× 事件间低耦合 × 单事件需要智能判断（纯代码不够）× 追踪周期长（跨天/周）× 闭环跨多个参与者

命中签名的同构场景：客服工单、SOC 安全告警、on-call 运维、邮箱 inbox 管理、销售线索跟进。人类组织面对这类负载全部进化出了同一个形状——工单系统 + 分诊台 + SLA——这不是巧合，是这类问题的自然解。我们在做的是 agent 原生版：**分诊本身是智能的（人话翻译 + 搜证初判），worker 是有持久领域上下文的 thread**。

判别式（什么时候用哪种形状）：

| 负载特征 | 正确形状 |
|---------|---------|
| 任务间上下文耦合**低** + 异步到达 + 长追踪 | Message Bus（代码）+ 短命 triage + 外部化状态机 + Agent Teams worker |
| 任务内上下文耦合**高**（连续 feature 开发） | 长 session 单 agent / 单 thread（现在的 owner thread 形态，不要动） |
| 需要紧密同步乒乓（开发↔review） | 直接对话（现有 A2A 串行传球，不要过度事件化） |

四条普适原则（沉淀给未来所有同类设计）：

1. **注意力与追踪分离**：agent 上下文只用于判断；等待/监控/轮询外部化给代码。机械的事代码做，判断的事猫做（KD-8"给数据不给结论"的姊妹原则）。
2. **状态是真相源，消息是通知**：汇报对象从猫变成状态。家规本来就有这条，这次是把它从纪律升级成系统结构。
3. **判断成本与错误成本匹配**：分层 triage 的本质——便宜可逆的判断用便宜猫，贵的判断路由后再动贵猫。
4. **闭环是状态机的必经状态，不是猫的美德**：所有"猫忘记 X"的问题，第一反应不是加纪律，是问"X 为什么不是状态机的一个 state"。（code-as-harness 精神的实例化）

## 7. 我最可能错在哪（预注册撤回条件）

1. **低估了 triage 的难度**：如果实际 triage 错误率高到铲屎官每张卡都要改派，分层就失去意义——届时应该升级 triage 模型而不是放弃分层。
2. **台账状态机可能过度设计**：如果社区 issue 流量长期是每天 1-2 个，全套状态机 + cron 的维护成本可能高于收益——Phase A 先做最小闭环（自动 tracking + merge 事件驱动 + 掉球 cron），看板等流量上来再说。
3. **"自动路由"的边界我可能画得太松**：哪怕高置信度，自动路由错的 ticket 会安静地躺在错误的 thread 里——可能所有路由初期都该过铲屎官，自动化等 eval 数据说话。
4. **我没有运维砚砚的一手体感**：他半个月的实战里一定有我推导不出来的痛点（Part 2 读后补）。

---

# Part 2 · 读后对比（读 retrospective 之后写）

## 8. 独立收敛清单——方向的强证据

两份思考在互不知情的情况下，在五大支柱上完全收敛：

| 支柱 | 运维砚砚的表述 | 我的表述 |
|------|--------------|---------|
| 诊断 | "not 'try harder', it is a **role-design failure**"（一个 thread 被要求扮演 9 个角色） | "让一只长寿命的猫肉身扮演事件总线"——架构问题不是纪律问题 |
| 真相源 | "Chat is the interaction surface; **the event bus and read model are the operational truth source**" | "状态是真相源，消息是通知；汇报对象从猫变成状态" |
| 分诊层 | Inbox Narrator + guardrail："must **not become another state owner**" | 短命干净上下文 triage；"如果让烁烁开长寿命 thread 接单，三周后变成第二个被污染的运维砚砚" |
| 闭环 | Closure Guard + checklist："worker threads should not mark themselves done unless checklist satisfied" | "闭环是状态机的必经状态，不是猫的美德" |
| CVO 界面 | Decision Packet 正反例（#887 范例） | 人话层/决策界面，"给价值取舍题不给技术 A/B 题" |

他的 "verification addiction" 自我诊断和我的"不要在分诊台做手术"也是同一刀。**独立推导收敛 = 方案方向的高置信度证据。**

## 9. 他比我强的——采纳清单

1. **`nextOwner: cat | external_author | ci | cvo | none` 字段**——比我的 `waiting_external` 状态更通用、更正确。它把"球在谁手上"一等公民化（球可以在社区作者手上、在 CI 手上），我的 waiting_external 只是它的一个投影。**采纳他的设计，撤回我的。**
2. **22 种事件类型清单，且包含内部协作事件**（`thread.proposed/assigned`、`public_comment.posted`、`intake.recorded`、`community_closure.completed`）——我只事件化了 GitHub 侧，他把家里协作动作也事件化了，这才是彻底的 event-sourcing，闭环证据链才完整。
3. **过渡期 6 条操作纪律**（产品做出来之前源 thread 怎么自律）——我完全漏了过渡态，他作为当事猫给出了立刻可执行的止血方案。
4. **`reportingMode: none` 的契约洞察**："no-report-back contract does not by itself guarantee community closure evidence"——把"别打扰源 thread"从 silent-drop contract 升级成 safe contract，这是 F128 现有机制最锋利的一刀。
5. **F141 三层模型的定位**（discovery / triage-claim / PR Signals）——我的代码调查挖到了实现，没挖到这个设计框架；Issue Signals 作为 PR Signals 的对称层，命名和定位都比我的"自动 tracking"更准。
6. 他引的另外两篇 Anthropic 文章（managed-agents / effective-harnesses-for-long-running-agents）补了"durable session log + brain-harness 解耦 + 从持久状态恢复"的理论支撑，和我引的 coordination patterns（2026-04，五模式判别）正好拼成完整拼图。

## 10. 我补给他的——主要是用代码事实回答他的 Open Questions

他留了 6 个 Open Questions，我的机制调查（Part 1 §2）能直接回答大半：

- **OQ1（复用 TaskSpec/pr_tracking 还是建专用 community-event store）→ 复用，有证据**：`IssueCommentTaskSpec` 已存在（只是 opt-in）、`ReconciliationDedup` 去重框架已在跑、F168 台账 store 已有 `assignedThreadId/linkedPrNumbers`。建平行系统违反 P4 单一真相源；真正的活是**打通 TaskStore ↔ CommunityIssueStore**（现状互不同步）+ routed 状态自动注册 tracking（去掉对猫自觉的依赖）。
- **OQ2（issue comments webhook-first 还是 reconciliation-only）→ webhook-first + 轮询兜底**：webhook handler 的 HMAC + delivery-ID 去重框架已有，加事件类型是增量改动；reconciliation 兜底模式和现有 PR 事件完全同构（5min RepoScanTaskSpec），不需要新发明。
- **OQ4（谁做默认 Inbox Narrator）→ 答案不是"哪只猫"而是"挂什么守门"**：triage 判断质量从第一天挂 F192 eval 闭环（owner 推翻/确认 triage 初判 → 记录 → 校准），用数据决定 Narrator 的自动路由权限能开多大。gemini35 在测评期，正好做第一个 eval 对象。
- **OQ6（源 thread 要不要收 final summary）→ 不收，看板是唯一 read surface**。但他自己列的 `community_closure.completed` 事件已经是答案：闭环写成事件，要回顾看事件流/看板，不发 chat。
- 另有一个机制事实修正他的痛点描述：hold_ball 不是"不可靠"，是 **single-slot 语义**（同 thread+cat 新 hold 顶掉旧 hold，3h 限 3 次）——机制上一只猫同时只能追一个球。这把"hold-ball 是 system gap 的补偿"从体感升级成代码层定论。

我的增量补充（他未覆盖）：**优先级分层**（P0 push 打断 / 普通 pull 排队，他的事件清单缺优先级维度）、**SLA + 死信重浮**（stale-object detection 的具体机制：状态卡住超时浮回看板，没人接的 ticket 不许沉底）、**可替换性金标准**（新猫零历史上下文接手 = 状态外部化验收标准）、**§6 的抽象判别式**（什么负载用这套、什么负载保持长 session——铲屎官要的"往上抽象"层）。

## 11. 分歧

实质分歧几乎没有，只有一处侧重差异：他的 Phase B 把 Issue Signals 当 MVP 第一刀；我的 Phase A 更强调**先做零猫力的纯代码打通**（自动 tracking + merge 事件驱动台账 + 掉球 cron）。合并后我建议：这两件事不冲突且共享基础设施，应该合成同一个 MVP——"事件补全 + 状态打通"一个 Phase 交付，因为单独交付 Issue Signals 而不打通台账，事件来了状态还是死的。

## 12. 合并后的建议下一步

1. **Design Gate（砚砚 Phase A 的三选一）**：我支持他的推荐——**reopen F168**（产品级：看板 + 读模型 + 闭环契约），F141（issue 生命周期事件）/F140（信号层复用）作为实现依赖挂在下面。需要 CVO signoff（F 号操作硬条件）。
2. MVP = 砚砚 Phase B + 我的 Phase A 合并：Issue Signals 事件补全 + TaskStore↔台账打通 + 自动 tracking + merge 事件驱动 + 掉球 cron。
3. 读模型采用他的 `CommunityObject`（含 `nextOwner` + `closureChecklist`），状态转换图用我的（含事实事件驱动的 `fixed`）。
4. Closure Guard（他的 Phase D）+ triage eval 回流（我的 ⑪）作为第二刀。
5. 过渡期立刻生效：他的 6 条操作纪律不等任何代码。
6. CVO Direction Card UX（他的 Phase E）+ 看板，最后一刀。

[宪宪/Fable-5🐾]
