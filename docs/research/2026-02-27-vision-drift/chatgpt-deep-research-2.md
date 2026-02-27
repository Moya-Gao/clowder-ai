---
feature_ids: [F041]
topics: [multi-agent, vision-alignment, goal-drift, research]
doc_kind: research-report
created: 2026-02-27
source: ChatGPT Deep Research
run: 2/2
note: Chinese report (deep-research-report download)
---

# 多 Agent 系统的愿景漂移调研

## 摘要与关键结论

这次 F041 事件呈现的是一种非常典型、而且在 2025H2–2026.02 多 Agent 编码产品里反复出现的系统性失效模式：**“代码正确性”与“用户意图正确性”被不同的验证回路看守，且后者常常没有被显式纳入流水线**。你们的根因复盘（review 链路 12 轮无人回读原始需求）其实与业界公开文档中反复强调的风险是一致的：当上下文变长、发生压缩/截断、以及多会话并行拆工后，模型/代理会更容易“忘掉早期指令、开始犯错或朝看似合理但不对的方向推进”。citeturn12view1

从 2025–2026 年的论文与产品机制来看，“防愿景漂移”的有效方案几乎都可以归入三个互补层：

第一层是**上下文锚定**：把“愿景/需求/不可违背约束”放进可持续加载的、**跨会话稳定注入**的渠道（例如 repo 级规则文件、目录作用域指令、全局/工作区 rules、或固定加载的记忆文件）。Claude Code 的 `CLAUDE.md` 被定义为“每次会话都会加载的持久上下文”，并且官方给出“保持在 ~500 行以内，把参考资料移到技能”的规模化建议，本质上就是把愿景放在更不易被对话噪声挤掉的位置。citeturn12view0  同类机制也出现在 Windsurf 的 “Memories & Rules + 目录/仓库规则搜索路径”citeturn9search0 与 Cursor 的规则系统“始终注入到 AI 上下文”。citeturn8search0turn8search3

第二层是**结构化工作流与早期纠偏**：把“先探索→再计划→再实现→可验证证据→人类验收”做成默认节奏，并且尽量把“愿景验收”前置到小里程碑，而不是只在合并前看测试是否全绿。Claude Code 官方最佳实践把“给代理一个可验证方式（tests/screenshot/expected output）”作为最高杠杆建议之一，并明确提示上下文变长会导致遗忘与错误增多，因此需要“早纠偏、强上下文管理”。citeturn12view1  Devin 的产品流程将 Ticket→Plan→Test→PR 明确化，同样是在产品层面把“计划审阅/阶段验证”变成必经门。citeturn3search2turn3search5

第三层是**技术嵌入的漂移监测/隔离**：用可度量的 drift 指标、检查点（checkpoint）、可回放轨迹（trace）、以及沙盒隔离来把“偏了”变成可检测、可回滚、可审计的工程事件。学术上，2026 年的《Agent Drift》把 drift 分成语义漂移/协作漂移/行为漂移，并在模拟框架中给出一个非常贴近你们提问的量化结论：语义漂移最早出现，**到约 600 次交互时接近一半**（“nearly half”）的工作流出现语义漂移迹象，并提出“情景记忆整合（episodic consolidation）+ 漂移感知路由（drift-aware routing）+ 自适应锚定（adaptive anchoring）”等缓解思路。citeturn6search2  另一个关键证据来自 2025 年《Evaluating Goal Drift》：即便强模型在最难设置下可以在 **>100,000 tokens** 的长程里保持接近完美的目标遵循，但**所有**被评估模型仍会出现不同程度的目标漂移，而且漂移与“上下文变长后更易陷入模式匹配”相关。citeturn21search0

把这三层对齐到你们当前“流程嵌入”方案：你们已经补上了 **第二层** 的大部分（节点化的愿景对照检查点），但业界更前沿的实践往往会再补齐 **第一层（上下文锚定）** 与 **第三层（技术嵌入监测）**，否则一旦团队 lead 或 review agent 的上下文被压缩，仍然可能“按自己的理解把活干完”，而不是“按用户想要的把活干对”。

image_group{"layout":"carousel","aspect_ratio":"16:9","query":["multi-agent coordinator specialist agents shared task list diagram","LLM agent memory architecture episodic semantic working memory diagram"],"num_per_query":1}

## 愿景漂移的操作性定义与失效机理

在你们的语境里，“愿景漂移（Vision Drift / Goal Drift）”最实用的定义不是“模型输出变差”，而是更接近工程上的“**交付物不满足用户意图**，即使 AC 与测试都通过”。这与研究里对 goal drift 的定义兼容：代理在长时程执行中，行为逐步偏离初始目标（通常是 system prompt/初始指令所表达的 objective），而这种偏移往往是渐进的、隐性的。citeturn21search0

把你们 F041 事件抽象成可复用的“漂移链路”，通常包含四个环节（它们在多 Agent 场景里会叠加放大）：

上下文可得性断裂：原始需求文档未进入任何一个 reviewer 的可见上下文，于是系统整体只在“代码质量/边界条件”子空间里优化，而没有对“这是用户要的吗”建模。Claude Code 官方明确提醒：上下文窗口装载了会话、读过的文件与命令输出，越满越容易遗忘早期指令并犯错，因此“管理上下文”是关键工程工作。citeturn12view1

成功标准不一致：AC 与测试代表“已编码的规范”，但用户体验/核心价值往往以“原始需求中的 UX 描述、交互预期、视觉可用性”承载。citeturn12view1  如果这部分没有被结构化成可检查证据（截图、交互 demo、golden path），就会产生“全绿但错”的结果。

多 Agent 的局部最优：当任务被拆成多段并行（lead + teammate / 多子代理）时，各 agent 对目标的表征可能在压缩、转述、再压缩中逐渐从“用户原话”滑向“工程师化解释”。学术上《Agent Drift》把这类偏移显式命名为 semantic drift（语义漂移）与 coordination drift（协作漂移），并强调长交互序列是触发条件之一。citeturn6search2

持久化状态的污染风险：一旦系统开始引入跨会话记忆与自动注入（这是业界正在做的方向），愿景锚定更强的同时，也会引入“记忆被错误写入/被注入攻击污染/被过期信息拖偏”的新风险。一个直接例子是安全界对 OpenClaw 这类持久化代理的担忧：**持久状态（memory）可能被修改，从而让代理长期遵循攻击者指令**。citeturn17search22

这解释了你们委托问题里最尖锐的那句话：“如果 team leader 上下文有限，压缩着压缩着失忆了，那不是更可能干歪？”——答案是：**是的**，除非系统把“愿景”从“易被压缩的对话历史”迁移到“更稳定的外部状态/始终注入通道/可验证证据链”，并用监测与门禁机制不断重锚。

## 业界产品与框架的愿景守护做法

这一节按你们点名的必覆盖对象优先，然后补充 2025H2–2026.02 出现的高相关机制与“新玩家/新方案”。每个条目尽量用“它到底怎么防漂移（尤其在上下文压缩时）”来写，而不是功能列表。

### Claude Code Agent Teams（必覆盖）

在 entity["company","Anthropic","ai company"] 的 Claude Code 体系里，Agent Teams 的定义是：**一个会话作为 team lead，协调任务分配与结果综合；多个 teammate 会话各自独立运行、各自拥有独立上下文窗口，并且队友之间可以点对点消息沟通**。官方文档把它与 subagents 区分得很清楚：subagents 在单会话内“干活后把总结回传主会话”，而 agent teams 是“多个独立会话协同 + 共享任务列表”。citeturn10search21turn12view0

它对“愿景漂移”的直接价值主要来自两个点。其一，**共享任务列表**天然是一个“外部化目标/计划”的载体：即使 lead 会话被压缩，任务列表仍然可以作为持续的目标锚；其二，teammate 会话彼此独立，能降低“同一上下文污染导致集体幻觉”的概率，更容易做“互相质疑/交叉验证”。不过，这并不自动解决你们 F041 的根因：如果共享任务列表里只写了工程任务而没挂原始需求链接/用户原话摘录，那么系统仍可能在“自恰的工程解释”里跑偏。Claude Code 的官方扩展层提供了一个更直接的愿景锚定工具：`CLAUDE.md` 被明确描述为“每次会话自动加载的持久上下文”，并建议把“永远要遵守的规则/项目结构/构建命令/禁区”放进去；当内容过大时，把参考资料移入技能（Skills），保持 `CLAUDE.md` 轻量。citeturn12view0

### OpenCode（必覆盖的一部分）

OpenCode 在官方介绍中把自己定义为开源 AI 编码 agent，并强调支持“multi-session（在同一项目上并行启动多个 agent）”以及多形态（终端/桌面/IDE）。citeturn13view0turn13view1  更关键的是它的“代理分工”设计：在 Agents 文档里，OpenCode 内置 Build 与 Plan 两个 primary agents，其中 Plan 默认对“文件编辑与 bash”采取 **ask（询问许可）**策略，目标是让你先把“计划与改动建议”跑出来，而不是让模型直接动代码。citeturn13view2

这对防愿景漂移的意义在于：Plan agent 本质上是一个“低破坏性、可先验收理解是否正确”的阶段门（stage gate）。当任务复杂且容易做歪时，这种“计划先行 + 变更需许可”的结构，能把“偏了再返工”的成本显著前移为“先纠偏再写代码”。但它的局限也明显：Plan 只能降低“误改代码”的风险，无法自动保证“Plan 读过原始需求”。因此它更像一个“可插入你们 SOP 的构件”，而不是完整的愿景守护方案。citeturn13view2

### Oh My OpenCode（必覆盖的一部分）

Oh My OpenCode 把自己定位为 OpenCode 上层的编排/插件系统，核心卖点反而非常贴近你们关心的点：它不仅提供多专精 agent（Planner-Sisyphus / Librarian / Explore / Oracle），还提供大量 “Hooks”，其中明确分出了 “Context Management（context-window-monitor、compaction-context-injector、preemptive-compaction）”以及 “Task Management（todo-continuation-enforcer 等）”。citeturn14view1turn14view2  在 Features 页里还把“Directory-specific agents / rules injector / directory README injector”写成显式能力，意思是：可以按目录自动注入规则/README/代理配置，从而更稳定地给模型提供“就地上下文”。citeturn14view2

换句话说，它试图用“技术嵌入”把你们现在靠流程提醒做的事自动化：监测上下文窗口、提前压缩、压缩时回注关键规则、检测空任务响应、强制 todo 续跑等。对愿景漂移来说，这类 hooks 的强项是**对抗上下文压缩的鲁棒性**：如果压缩不可避免，那就让系统在压缩点自动“再锚定”。但风险也对应上升：一旦配置不当，hook 本身可能成为新的不可解释行为源（比如自动注入了错误/过期规则）。因此它更适合“你们这种已经有 SOP、想把 SOP 变成系统级自动化”的团队，而不适合把它当成开箱即用的愿景守门人。citeturn14view1turn14view2

### OpenClaw（必覆盖）

OpenClaw 的公开定位是一个自托管 Gateway，把 WhatsApp/Telegram/Discord/iMessage 等聊天渠道连接到“具备工具使用、会话、记忆、多 agent 路由”的代理系统，并宣称 Gateway 是 sessions 与 routing 的单一事实源。citeturn17search15  它最值得你们借鉴的不是“能 24/7 运行”，而是它对“记忆”的工程化定义：OpenClaw 文档把 memory 规定为**工作空间里的纯 Markdown 文件**，并强调“文件是事实源；模型只‘记得’写到磁盘上的东西”；`memory_search`/`memory_get` 只是围绕这些 Markdown 的检索工具。citeturn17search0turn17search1  这是一种强烈的“可审计记忆”：你可以 `git diff`、可以人工编辑、可以手动删改纠偏。

这套架构对愿景漂移的价值在于：它把“愿景/约束”从易丢失的对话上下文迁移到“人类可直接查看与修订的持久化状态”，并且提供语义检索把关键记忆回注到当前回合，从而降低 leader 被压缩后失忆的概率。与之配套的还有工具层的“硬边界”：例如工具 allow/deny、tool profiles、以及内置的 loop-detection（工具调用循环防护）。citeturn15view1  但你们必须同时看到它的对称风险：安全研究与厂商博客指出，持久化 memory 也可能被攻击者修改，从而让代理“在未来回合持续遵循攻击者写入的指令”，这在长期运行代理里属于真实威胁面。citeturn17search22turn17search5  所以 OpenClaw 更像是一套“把愿景变成可写文件并可检索回注”的底层范式，而不是可以不加治理直接搬到生产的方案。

### OpenAI Codex（商业补充）

entity["company","OpenAI","ai company"] 的 Codex 在 2025–2026 的产品设计里，把“可靠性”很大一部分押在 **可验证证据链 + 沙盒隔离** 上：官方介绍明确写到 Codex agent 在云端隔离容器中运行，至少在发布时默认禁用互联网访问，并且会给出终端日志与测试输出等可核查证据，让用户能追溯 agent 做过什么。citeturn4view0  这类设计对防愿景漂移的作用是间接但强：它把“是不是做了你说的事”变成“你能验的证据”，从而把“错误但看起来合理”的漂移更早暴露在 review 阶段。

更贴近你们问题的，是 Codex 的平台层正在把“上下文与记忆管理”产品化：官方 changelog 在 2026-02-26 的条目里直接提到“改进 memory 行为：diff-based forgetting 与 usage-aware memory selection”，也就是把“忘什么”“记什么”从纯 prompt 工程转向系统机制。citeturn4view1  另外，OpenAI 也在公开材料中强调“给 agent 分配 well-scoped tasks”以及并行分配多个 agent 来互相对照，这与“复杂 feat 丢给一个 agent 更容易干歪”的观察是同方向的。citeturn4view0

### Devin（商业补充）

entity["company","Cognition","ai company"] 的 Devin 对外展示的协作流程有一个非常明确的“防偏结构”：Ticket→Plan→Test→PR，并把“先 review proposal/plan，再看变更”作为协作默认节奏的一部分。citeturn3search2turn3search5  在其主页信息里还出现了“Approved new knowledge / Rejected new knowledge”的交互暗示：即它将“学到的知识/规则”作为可治理对象，而不是让模型在暗处自发改变行为。citeturn3search2

这些机制对愿景漂移的核心贡献是：把“愿景校验”压进“Plan gate”里，并用“测试与 PR 审核”形成硬回路。但它同样不会自动保证“Plan 与用户原始需求一致”，除非系统把原始需求作为 Ticket 的一部分（或作为 always-on rules）强制进入上下文。因此你们可以把 Devin 的关键点抽象为：**愿景守护不是发生在 review 末端，而是发生在 plan 阶段门**。citeturn3search2turn3search5

### Cursor 与 Windsurf（长会话 IDE 场景补充）

Cursor 的规则系统在官方文档中被描述为通过 `.cursor/rules`（或 UI 创建的规则文件）来持续注入“项目/用户级规则”，并且 Agent 还有不同 “modes” 来匹配不同任务能力与工具开启范围。citeturn8search0turn8search1  社区讨论还显示其历史上的 Memories 功能被移除并引导用户迁移到 Rules，意味着行业正在从“自动记忆”转向“可控规则注入”作为更可预测的长期对齐手段。citeturn8search2turn8search11  Cursor 2.2 的“multi-agent judging”公告也反映了一种常见的抗漂移策略：**多样本并行 + 自动评估择优**，用分歧暴露潜在偏差。citeturn8search26

Windsurf 的官方文档把 “Memories & Rules” 定义为跨对话持久化上下文的系统，并明确区分自动生成的 Memories 与手写 Rules；Rules 具有 global/workspace 级别，并且会在工作区目录、子目录与 git root 等范围内查找与去重。citeturn9search0turn9search2  更接近“愿景锚定”的是它把 Workflows 做成可复用的 markdown 流程，并可通过 slash command 触发，这非常像你们的 SOP 技能化版本；同时它也提供 `AGENTS.md` 这类“按目录作用域自动生效的指令”能力。citeturn9search10turn9search22  这意味着：在 IDE 场景里，行业解决“长会话失忆”的主流做法不是无限扩 context，而是把关键意图沉淀到可持续注入的规则/流程/目录指令里。

### LangGraph、AutoGen、CrewAI（编排框架补充）

LangGraph 的核心贡献在于“把对话与工具调用从线性 session 变成可持久化的状态机”：官方文档明确指出它的 persistence 通过 checkpointers 在每个 super-step 保存 graph state，保存到 thread 后就能支持 human-in-the-loop、memory、time travel 与 fault tolerance。citeturn7search0  对愿景漂移来说，这提供了一个非常直接的“技术嵌入”落点：把“愿景（goal）/约束/需求摘要/已确认决策”变成 graph state 的字段，并在每一步运行前后校验它是否被破坏，而不是靠某个 agent “记得去读”。同时 LangGraph 自己也承认长对话会带来上下文挑战，模型会被陈旧内容“分心”，这进一步说明外部化状态的重要性。citeturn7search4

AutoGen 的官方教程则明确提供“保存与加载 agents / teams / termination conditions 的状态”的能力，用于把多 agent 应用从无状态 API 端点后面恢复出来。citeturn7search9  这类持久化对于防止 lead “压缩失忆”非常关键：至少可以保证“系统知道自己当前的状态与规则是什么”，而不是完全依赖上下文窗口。

CrewAI 把多 agent 协作结构化为“层级式（hierarchical）manager-worker”：文档中写到 hierarchical process 会自动创建 manager agent 来协调、委派并验证结果；Task guardrails 则用于在任务输出交给下一任务前进行验证与变换。citeturn7search6turn7search23  这正对应你们的痛点：review 链路缺少“这是用户要的吗”的角色时，可以把它实现为 manager 的 guardrail（例如必须对照原始需求摘要/关键 UX 原话做一致性检查），从流程提醒升级为系统门禁。

### OpenHands 与 SWE-agent（开源 benchmark/工程化补充）

OpenHands 的 SDK 文档强调可用本地或 ephemeral workspaces（如 Docker/Kubernetes）运行代理，并提供 conversation persistence，包含 message history、tool outputs、agent config、execution state 等，目标是可恢复与可审计。citeturn11search26turn11search30  OpenHands 还公开发布过“context condenser”来应对对话上下文增长问题，直接把“上下文管理”当作架构模块而非 prompt 技巧。citeturn11search32  对你们而言，这意味着：在开源工程化路径里，主流方向同样是“把该持久化的持久化，把该压缩的可控压缩，并让恢复与审计成为一等能力”。

SWE-agent（NeurIPS 2024）提供了一个更细粒度的、可直接迁移的经验：论文明确写到它使用 history processors 来保持上下文“简洁且信息量高”，并在错误处理上“丢弃多余的历史错误消息”，避免上下文被噪声淹没；同时通过 linter/工具接口校验来丢弃无效编辑并提示重试。citeturn11search1  这本质上是“技术嵌入的抗漂移”：不是指望 agent 自控，而是让系统不断清理会导致偏航的上下文污染源。

## 上下文压缩失忆与 goal-persistent design

你们的问题 Q2 可以拆成两个可操作子问题：第一，“上下文变长为什么更容易漂移？”第二，“业界把哪些东西从上下文里搬走，搬到哪里？”

### 研究证据：漂移与长时程强相关，但并非不可控

《Evaluating Goal Drift in Language Model Agents》（arXiv:2505.02709）给出的关键结论是三段式的：首先它给出了 goal drift 的评估范式（给定初始目标，再施加环境竞争目标）；然后它在最难设置下观察到**最佳 agent（scaffolded Claude 3.5 Sonnet）可以在 >100,000 tokens 内维持近乎完美的 goal adherence**；但同时也指出所有模型都会出现某种程度的 goal drift，并且漂移与上下文变长后更易陷入模式匹配相关。citeturn21search0  这非常贴近你们的现象：“记得怎么写代码，但忘了为什么写”。

《Agent Drift》（arXiv:2601.04170）则把问题推进到多 agent 领域：它提出 Agent Stability Index（ASI）做多维度漂移量化，并在模拟框架里展示 drift incidence 随交互次数增长；其中语义漂移在约 600 次交互时达到“nearly half”，并被作者视为最早出现的漂移类型。citeturn6search2  这给了你们一个非常务实的判断标准：**当一个 feat 的协作回合数/消息数逼近几百量级时，仅靠“记忆在对话里”极不稳健**，必须引入外部化锚点与监测。

### 业界做法：把“愿景”从聊天上下文迁移到可持久化状态

从 2025–2026 的产品文档里，最一致的趋势是：把关键意图迁移到三类容器中。

规则/指令文件：Claude Code 的 `CLAUDE.md` 是“每次会话自动加载的持久上下文”，并建议把永远要遵守的项目规则放进去。citeturn12view0  Windsurf 的 Rules（global/workspace）与目录规则搜索路径也是同构思路。citeturn9search0  Cursor 则通过 rules 文件/目录规则把“AI 行为约束”变成持久配置。citeturn8search0turn8search3

结构化状态与检查点：LangGraph 通过 checkpointer 在每个 super-step 保存状态到 thread，使得 human-in-the-loop 与 time travel 成为可能。citeturn7search0  AutoGen 提供保存/加载 agents 与 teams 状态。citeturn7search9  OpenHands 记录并可恢复 conversation state（含工具输出与执行状态）。citeturn11search30

可审计的长记忆：OpenClaw 把 memory 定义为 Markdown 文件并提供语义搜索/读取工具，强调“文件是 source of truth”。citeturn17search0turn17search1  这类设计更接近你们想要的“愿景不能被压缩掉”，因为愿景不在对话里，而在磁盘里。

### goal-persistent design 的可落地定义

你们提到的 “goal-persistent design（目标持久化设计）”，在 2025–2026 的公开材料里更常以“anchoring/外部化目标/漂移监测”出现。把它抽象成工程定义，可以是：

把“目标”建模为一个可持久化、可版本化、可审计的对象（goal object），并在每一个代理回合/关键节点强制执行三件事：读取当前 goal object → 执行动作 → 用监测器判定动作是否仍与 goal 一致；若不一致则触发纠偏（回滚/再计划/人类确认）。

这与《Agent Drift》提出的缓解策略非常贴合：episodic memory consolidation（把关键经验整合沉淀）、drift-aware routing（把不稳定的任务路由到更稳定的子代理/策略）、adaptive behavioral anchoring（持续重锚定目标）。citeturn6search2  同时也与 Claude Code 官方“上下文满了就会遗忘，需要强上下文管理与早纠偏”的工程提示方向一致。citeturn12view1

## 与 Cat Cafe 当前流程方案对比、盲区与可补强点

你们当前方案是典型的“流程嵌入（process-embedded）愿景守护”：在 spec-compliance-check、review、receiving-review、PR、completion 五个技能节点强制回读原始需求并交叉验证。这一套对“F041 根因（无人回读原始需求）”是直接命中的：它让“需求回读”成为必经步骤，而不是靠个人自觉。

问题在于：**流程嵌入的鲁棒性取决于两件事**——(a) 该步骤是否真的发生（自动化程度），(b) 回读的内容是否在上下文压缩后仍保真（信息通道）。业界在 2025–2026 的补强方向，是把这两件事分别用“技术嵌入”和“上下文锚定”兜底。

### 对比表：流程嵌入 vs 业界典型方案

| 方案/系统 | 防偏机制类型（流程/技术/上下文） | 上下文压缩鲁棒性 | 实施成本 | 适用场景 | 对你们最有价值的可迁移点 |
|---|---|---|---|---|---|
| 你们的 SOP 五节点愿景对照 | 流程为主 | 中：取决于是否真回读、是否贴原文 | 低–中 | 团队协作、PR 流程明确的工程团队 | 已经解决“没人回读需求”的根因，但需要自动化与更硬的锚点 |
| Claude Code（CLAUDE.md + subagents + Agent Teams） | 上下文 + 流程 + 并行协作 | 中–高：愿景可写入 `CLAUDE.md`，并行会话降低污染 | 中 | 复杂 repo、多并行调研/实现/审查 | 用 `CLAUDE.md` 把“愿景摘要+不可违背约束”变成 always-on；用 team roles 强制一个“PM/UX 审查”agentciteturn12view0turn10search21 |
| OpenCode（Plan/Build 分离 + 权限 ask） | 流程 + 技术（权限门禁） | 中：限制误改，但不保证读到需求 | 低–中 | 终端工作流、先计划再改代码 | 把“计划先行”变成强制 gate；将你们 SOP 的“愿景回读”塞进 Plan 阶段citeturn13view2 |
| Oh My OpenCode（Hooks：compaction/规则注入/todo） | 技术 + 上下文 | 高：专门对抗 compaction 与上下文窗口问题 | 中–高 | 大工程/长会话/高自动化 | 直接借鉴其“context-window-monitor + compaction-context-injector + rules-injector”思路，把你们 SOP 自动化citeturn14view1turn14view2 |
| OpenClaw（Markdown 记忆 + 语义检索 + 工具白名单） | 上下文 + 技术 | 高：愿景可长期存盘并检索回注 | 中–高（还要治理安全） | 长期运行 agent、跨会话协作 | 把“愿景/关键 UX 原话/决定记录”写进可 diff 的文件；但必须配套防记忆投毒与权限隔离citeturn17search1turn15view1turn17search22 |
| Codex（沙盒隔离 + 可核查日志/测试证据 + memory 策略） | 技术为主 | 中–高：证据链不依赖记忆；平台改进 memory | 中 | 云端并行 agent、可审计交付工作流 | 用“证据交付（日志/截图/可复现步骤）”替代口头承诺；关注 diff-based forgetting 等 memory 策略citeturn4view0turn4view1 |
| Devin（Ticket→Plan→Test→PR + 可治理知识） | 流程 + 上下文 | 中：计划门禁强，但输入仍关键 | 高（商业与集成成本） | 企业级 backlog 自动化、强协作 | 把“Plan 审阅”作为产品级硬门；把“学到的规则”显式审批化citeturn3search2 |
| LangGraph（checkpoints/threads） | 技术（状态机） | 高：状态外部化 + 可回滚/回放 | 中 | 自建 agent 系统、需要可恢复与人类介入 | 把“愿景”做成 graph state 字段 + 每步校验；实现 time travel 式的“回到分叉前”citeturn7search0 |
| AutoGen（持久化 teams state） | 技术（持久化） | 中：取决于你存什么状态 | 中 | 多 agent 应用、服务端无状态架构 | 把“需求摘要+约束”作为可序列化状态，与 team 一起保存/加载citeturn7search9 |
| CrewAI（manager + task guardrails） | 流程 + 技术（guardrails） | 中–高：guardrail 可强制对照检查 | 中 | 任务流编排、角色分工明显 | 用 manager/guardrail 实现“愿景审查员”：每个输出必须映射回需求条目，否则打回citeturn7search6turn7search23 |
| OpenHands / SWE-agent（上下文压缩与验证接口） | 技术 + 流程 | 中–高：history processors/condensation 降噪 | 中 | 以 benchmark/可重复评估驱动的 agent 工程 | 学习其“压缩不是总结，而是清除噪声 + 保留关键动作证据”的策略citeturn11search1turn11search32 |

### 你们方案的关键盲区

盲区不是“你们没做愿景对照”，而是“愿景对照仍可能被三类机制击穿”。

对照发生了，但对照对象不稳定：如果对照时看的是“agent 自己总结的需求”，而不是用户原话/需求文档关键段落，那么压缩与转述就会把“对照”变成自证循环。Claude Code 官方强调上下文满了会遗忘早期指令，侧面说明“把关键约束放在更稳定的注入位置”比“偶尔回读一次”更稳。citeturn12view1turn12view0

对照发生了，但缺乏可验证证据：你们这次的失败点主要在 UI/核心功能缺失，这类问题很难仅靠 unit tests 覆盖。业界在 Codex/Claude Code 的建议里反复强调“给 agent 一个可验证方式（tests/screenshot/expected outputs）”，否则看起来对但不工作会大量出现。citeturn4view0turn12view1

对照发生了，但没有“硬门禁”：流程节点如果只是 prompt 里的提醒，遇到并行拆工、上下文溢出或赶进度时，最容易被“跳过”。相比之下，CrewAI 的 task guardrails、LangGraph 的 checkpoint gate、OpenCode Plan 的权限 ask、Oh My OpenCode 的 hooks，都是把这件事工程化成“做不到就不让往下走”。citeturn7search23turn7search0turn13view2turn14view2

### Q4：复杂 feat 容易做歪的可落地解法

业界最有效的一组实践并不反直觉：**把“复杂”拆成“可验证的小复杂”，并把用户验收前置到每个 slice**。这在传统项目管理里类似“阶段门（stage-gate）”，即每个阶段有明确验收门槛与放行决策。citeturn20search23  在软件工程里也对应“vertical slice / thin slice”这类做法：用端到端可体验的最小切片来早验证假设，避免最后交付才发现“这不是用户要的”。citeturn20search2

你们可以把它翻译成 agent 协作里的四个具体招式（都能和现有 SOP 兼容）：

把“需求”变成“不可压缩的锚 + 可勾稽的矩阵”：不要只贴链接，而是从原始需求里抽取 5–15 条“用户原话/UX 预期”作为 quote block，写入一个短文件（类似 CLAUDE.md / AGENTS.md / Rules），并给每条分配 requirement id（R1, R2…）。这契合 2025–2026 的 industry pattern：用规则文件作为 always-on 注入通道。citeturn12view0turn9search0turn8search0

强制“Plan gate + 用户可读输出”：对所有复杂 feat，先交付一个 plan（包含 R1–Rn 的覆盖映射）再写代码。这是 OpenCode Plan、Devin、Claude Code best practice 都在强调的节奏。citeturn13view2turn3search2turn12view1

把“愿景验证”做成产物而不是对话：例如每个 milestone 必须产出 3 样证据：交互截图/动图、golden path 的手动步骤、以及与需求矩阵的映射表。Codex 把“终端日志与测试输出作为可核查证据”写进产品哲学，本质就是同一路径。citeturn4view0

引入“反直觉”方案：复杂任务反而更要并行多 agent，但不是并行写代码，而是并行做“需求审查/UX 审查/实现审查”。多 agent 并行如果只是加速实现，漂移会加速；但如果并行的是“互相挑错”，漂移暴露会更早。《Agent Drift》对 coordination 的讨论也印证：多 agent 的问题在协作一致性，但反过来，通过设计好的对抗式角色也能把一致性从“盲目同意”变成“通过挑战达成的共识”。citeturn6search2

在传统项目管理语境里，你们这类“交付正确但不是客户要的”也与 scope creep / gold plating 同构：当团队在没有客户确认的情况下扩展/偏移交付内容，就会出现“做了很多，但价值不对齐”。PMI 对 scope creep 的定义本质上就是“未经客户批准增加功能”。citeturn20search0  这提醒我们：愿景漂移不仅是模型问题，也是“变更控制与验收门禁”问题。

## 已确认事实与推测、推荐方向与主要风险

这一节按你们要求，明确区分“已确认”与“推测/待验证”，并给出可立即借鉴与需要适配的方向。

### 已确认事实

长上下文会导致遗忘与错误增多，需要强上下文管理与早纠偏：Claude Code 官方最佳实践明确指出上下文窗口会很快填满，且“性能会随着上下文填满而下降”，并提到可能开始忘记更早的指令。citeturn12view1

Goal/semantic drift 在研究里可被量化，并与长时程强相关：2025 的 goal drift 研究给出 >100k tokens 的长程评估现象与“漂移与长上下文模式匹配相关”的发现。citeturn21search0  2026 的多 agent drift 研究给出“600 次交互近半语义漂移”的模拟观察与缓解策略方向。citeturn6search2

业界产品正在系统化“愿景锚定”：`CLAUDE.md` 被定义为每次会话自动加载的持久上下文。citeturn12view0  Windsurf 的 Memories & Rules 提供跨对话持久化与规则注入路径。citeturn9search0  Cursor 的规则体系用于持续注入用户/项目规则。citeturn8search0turn8search3

技术嵌入的 checkpointers/guardrails 是可行且已在主流框架中内建：LangGraph 的 checkpointers/threads，CrewAI 的 manager 与 task guardrails，AutoGen 的状态保存/加载，都在官方文档中明确提供。citeturn7search0turn7search23turn7search9

持久化记忆会引入新的对抗面：安全界明确指出持久状态/记忆可能被修改进而影响未来行为。citeturn17search22

### 推测与待验证的判断

你们的“流程嵌入”方案会显著降低“无人回读需求”类型错误，但在长时程/多并行/上下文溢出场景下仍可能被击穿，除非补齐“上下文锚定（always-on）”与“硬门禁（guardrail/checkpoint）”。这一点需要你们在 Cat Cafe 代码库里做一次 A/B：同一复杂 feat，用“流程提醒 only” vs “流程提醒 + always-on 需求锚文件 + 产物证据门禁”，对比返工率与首次交付满意度。

把“愿景锚文件”做成 repo 里可 diff 的 artifact（类似 `CLAUDE.md/AGENTS.md/.windsurf/rules/.cursor/rules`）会显著提升跨 agent 一致性，但也会引入“锚文件过期/被错误修改”的治理需求；是否需要签名、review、版本化与权限控制，取决于你们对安全与一致性的权衡。

### 推荐方向与风险

推荐方向可以分成“立刻可用”和“需要适配”。

立刻可用的三件事：

把“原始需求链接”升级为“原始需求摘录 + requirement ids + always-on 注入”。具体做法：在 repo 根目录新增一个短文件（例如 `VISION.md`），内容只放 5–15 条用户原话/UX 预期 + 不可违背约束 + 非目标（anti-goals），并在每次 review/PR 自动注入到上下文（你们现在是手工附链接；下一步是系统级 always-on）。这一点直接对齐 Claude Code/Windsurf/Cursor 的规则文件范式。citeturn12view0turn9search0turn8search0

把 Plan gate 做硬：复杂 feat 必须先产出“需求矩阵覆盖的 plan”，并由另一个 agent 扮演“用户代理/PM/UX reviewer”对 plan 逐条打勾（而不是审代码）。这利用多 agent 并行来暴露漂移，而不是加速漂移。citeturn10search21turn6search2

把“完成定义（DoD）”扩展出“可体验证据”：除测试外强制提交截图/动图、golden path 手动步骤、以及与 requirement ids 的映射表；这与 Codex 的“可核查证据链”一致，也能补齐你们这次 UI 不可用型失败。citeturn4view0

需要适配但回报高的两件事：

技术嵌入的 drift 监测器：参考《Agent Drift》的思路，给你们的多 agent 工作流增加一个轻量 ASI-like 指标（不需要全套 12 维，先做 3–4 个：需求覆盖一致性、与愿景锚文件的语义距离、是否出现非目标功能、以及“重复无进展循环”）。当指标恶化时强制触发“回到需求锚 + 重新计划”。citeturn6search2turn15view1

检查点与可回滚执行：借鉴 LangGraph 的 checkpointer/thread 思想，把每个 milestone 的状态外部化存盘（包括“当前 plan、当前 requirement 覆盖、关键决策与非目标”），并支持“回到上一个 checkpoint”。这能把“做歪了”从灾难变成一次可控回滚。citeturn7search0

主要风险（需要提前设计预案）：

记忆/规则污染：一旦你们开始用持久化 memory 或 auto-generated memories（类似 Windsurf/OpenClaw），必须有“忘记/回滚/审计”机制，否则错误规则会长期拖偏。安全界对持久状态被修改的担忧说明这不是小概率事件。citeturn17search22turn9search0

过度仪式化：如果 requirement ids、证据链、plan gate 变成“为了填表而填表”，会降低速度并造成形式主义。解决办法是让这些 artifact 尽量短、自动生成大部分内容、人类只做关键确认。

错误的度量驱动错误优化：如果你们只量化“测试通过/agent 完成率”，系统会继续在工程子空间里优化，重演 F041。建议把“用户第一次打开是否满意/关键任务是否可完成”纳入指标（哪怕是人工 3 分钟验收），否则愿景类失败不会被反馈回系统。citeturn12view1