---
feature_ids: [F041, F046]
topics: [multi-agent, vision-alignment, goal-drift, research]
doc_kind: research-report
created: 2026-02-27
source: ChatGPT Deep Research
run: 2/2
note: Chinese report (网络波动 duplicate, deep-research-report (1) download)
---

# 多 Agent 系统愿景漂移调研

## 概念与诊断框架

你们这次在 F041（能力看板）上遇到的“AC 全过、测试全绿、review 很多轮，但交付物完全不是用户想要的”，本质上不是传统意义上的“代码质量问题”，而是**目标/愿景对齐链路断裂**：评价信号被“可局部验证的 proxy（测试、边界条件、可编译、可跑）”占满，而“是否满足原始意图/UX 叙事/关键场景”没有进入任何强制门禁。这个失效模式与学术里常说的 **goal drift / intent drift** 对应：agent 在长程执行中逐渐偏离初始目标，即使每一步都“看起来合理”。citeturn36search0turn36search7

从业界与研究的交叉视角看，愿景漂移常见有三类诱因（这三类在多 agent 场景会叠加放大）：

第一类是**上下文污染与上下文衰退**：长会话把大量探索日志、报错堆栈、grep 大输出、工具回显等噪声不断塞进主线程，导致真正的“需求、约束、决策”被埋没，表现为越做越偏或越做越不稳。Codex 的多 agent 设计文档把这种现象明确称为 *context pollution* 与 *context rot*，并把“把噪声工作移出主线程、只回传摘要”作为多 agent 的理由之一。citeturn14view2turn13view0 这也与 entity["company","Chroma","vector db company"] 的长上下文研究一致：在控制任务复杂度的前提下，随着输入长度增加，多模型表现会变得更不可靠（并非“越长越稳”）。citeturn15view0

第二类是**分工结构导致的“责任空洞”**：多轮 review 里每个人都做得“很专业”，但大家各自盯的是局部（代码风格、边界条件、性能、并发、错误处理），没人承担“回看原始需求并对照验收”的角色责任。这在多 agent 也会发生：每个子 agent 都能把自己的子任务做漂亮，但如果 orchestrator/lead 没有把“愿景对照”作为硬约束，系统整体就可能朝一个“高质量但错方向”的局部最优滑去。Codex 文档甚至直接提醒：角色定义应当“狭窄且有主见（narrow and opinionated）”，给每个角色清晰职责与工具面，并用指令防止其漂移到邻近工作。citeturn13view4

第三类是**可验证性结构失衡**：工程体系往往天然偏好“可自动验证”的东西（编译、单测、lint、静态检查），而愿景/UX/产品叙事的可验证性弱，容易在自动化门禁里缺席。entity["known_celebrity","Ryan Lopopolo","openai mts"] 的 “Harness engineering” 文章强调：当团队把“人类不写代码、只 steer”作为约束时，工程工作的中心会转向“把意图、结构、反馈回路做成 agent 可读、可检查的工件（docs, plans, scorecards, linters, CI）”，否则 agent 很难可靠推进高层目标。citeturn32view0turn32view2turn32view4

## 业界防漂移全景

这一节按你们要求覆盖关键产品/框架，并补充 2025H2–2026.02 出现的“结构性新做法”。由于你们提到的内部背景文档路径（`docs/research/2026-02-27-vision-drift-in-multi-agent-systems.md`）在本次对话环境中无法直接访问，我以下对你们内部实践只引用你在问题里给出的描述，不做额外内部延展。

**Claude Code Agent Teams（Anthropic）**  
Claude 的 Agent Teams 把协作结构显式化：lead agent + multiple teammate agents，共享 task list，并提供 inter-agent messaging；每个 agent 都有独立上下文窗口，lead 不会自动“看见”teammate 的完整对话，只能通过消息与共享任务列表获得关键产出。这个设计天然逼迫“愿景/意图”要以**结构化、可传递的外显工件**存在（例如任务列表、明确的 spawn prompt 或项目上下文文件），否则就会在跨 agent 时丢失。citeturn1view0turn3view0  
防漂移的关键不在“上下文更大”，而在**把目标放进共享、可复查、可重复加载的位置**：例如把项目约束写入 repo 的固定文件（类似 CLAUDE.md/项目说明），并要求 review 时回指这些原始工件，而不是只审代码片段。Agent Teams 文档也强调在复杂任务中要监控并及时纠偏，并把任务拆成可管理的单元，避免让 agent 在巨大模糊任务里自我发散。citeturn3view0

**OpenCode（anomalyco/opencode）**  
OpenCode 的“防漂移”更像是把软件工程里成熟的**权限/阶段分离**移植进 agent 工作流：它给出内置 “plan（受限、偏分析）/ build（全工具）”两种模式（或 agent 配置），plan 模式默认禁用写文件、编辑、打补丁、跑 shell，只允许在特定计划文件目录写计划，从机制上把“做决定/定方案”与“落代码/执行命令”拆开。citeturn24view1turn22view0  
同时，OpenCode 把“可持续对齐”的载体明确为 AGENTS.md（规则文件），并建议版本控制、可团队共享；还兼容 Claude Code 的 CLAUDE.md 约定作为回退路径。这等于把“愿景与规则”放在一个**跨会话、可重复注入上下文的锚点**上，而不是依赖对话历史不断累积。citeturn24view2 在会话层面，它提供 `/compact`（也叫 `/summarize`）把会话压缩成摘要以继续工作，并通过“隐藏系统 agent（compaction/title/summary）”自动化标题与摘要生成，试图降低长会话对目标保持的破坏。citeturn24view0turn24view3  
另外，OpenCode 在 GitHub 里支持通过评论触发在 Actions runner 内执行并开 PR，这把“交付物”强行落到可 review 的 PR 形态，天然提高了“对照需求+diff 检查”的机会，但它本身不保证 reviewers 会审愿景；你们这次事故说明“有 PR + 有 review”不等于“有愿景审查”。citeturn24view4

**Oh My OpenCode（OpenCode 上的编排/工作流层）**  
Oh My OpenCode 的核心贡献是把“防漂移”做成**事件驱动的 hooks 链路**：它把任务管理（todo-continuation-enforcer）、上下文管理（context-window-monitor、preemptive-compaction）、输出治理（tool-output-truncator）、规则注入（rules-injector）、README 注入（directory-readme-injector）等作为默认启用的“自动化护栏”。citeturn25view0turn25view1 其中，preemptive compaction 默认阈值 0.85，意味着它试图在触顶前主动压缩，以避免“到极限才 panic summarize”造成关键愿景信息丢失。citeturn25view0turn19search7  
但这种“自动化压缩/注入”也展示了一个现实风险：压缩与恢复本身可能引入新的误解。例如社区 issue 描述了 compaction 后把“Suggested Next Steps”误当成需立即执行的任务，属于典型的“摘要语用歧义”导致的二次漂移。citeturn19search17 这类案例说明：**把愿景守护交给自动 compaction 并不免费**，需要对“摘要格式、不可执行区段、任务/历史的语义边界”做更严格的结构化约束（后文会给出可直接落地的做法）。

**OpenClaw（原 Clawd/Moltbot）**  
OpenClaw 把“多 agent + 长时间运行”当成平台级能力来设计，其防漂移思路非常“系统工程”化：  
- 多 agent 不只是 spawn 子线程，而是“Multi-Agent Routing”：每个 agent 拥有独立 workspace（含规则文件）、独立 agentDir（含 auth/profile）、独立 session store（对话与路由状态），并由 Gateway 通过 bindings 把不同来源消息路由到不同 agent。这样做的直接好处是：**不同身份/不同项目/不同愿景被硬隔离成不同状态空间**，比“一个聊天室里混所有任务”更不容易漂移。citeturn30view0turn29search4  
- 在记忆与压缩上，OpenClaw 明确：记忆的 source of truth 是 workspace 里的 Markdown 文件；模型只“记得”写到磁盘里的东西。它提供 vector memory search（对 MEMORY.md 与 memory/*.md 建索引），并在 compaction 前触发“memory flush”（软阈值触发、默认 NO_REPLY 静默写入，且每次 compaction 周期只 flush 一次），把“临界点前把 durable 信息落盘”变成机制，而不是靠人提醒。citeturn27view2turn27view3turn27view0  
- 在 agent-to-agent 协作上，OpenClaw 给 session tools（sessions_list/history/send/spawn）做成“小而难滥用”的工具集，并对 sub-agent 的工具权限按深度限制：默认子 agent 禁用 session/system 工具，只有 depth-1 orchestrator 在允许更深 spawn 时才拿到部分会话工具以管理子任务。这是一种“最小能力 + 分层授权”的技术型防漂移：避免子 agent 在不该跨会话/跨身份时跨出去。citeturn30view2turn30view3  
关于你提到的 star 数与演进：OpenClaw 官方博客在 2026-01-29 的发布文中声称项目“已超过 100,000 GitHub stars”，并回顾了从 Clawd/Moltbot 更名而来。citeturn35view0 你写的“145k+ stars、134+ MCP 工具”等数字在本次可引用材料里未找到同源证据，因此应当视为**待核对信息**（见后文“已确认 vs 待验证”）。

**Codex（OpenAI）与 Harness Engineering（OpenAI）**  
从“愿景守护”角度看，Codex 系列最值得借鉴的不只是“能写代码”，而是它把多个关键防漂移点产品化/工程化：  
- 在多 agent 方面，Codex 文档直接把多 agent 的价值定位为避免 context pollution/context rot：把探索、测试、日志分析这种高噪声工作交给子 agent 并返回摘要，让主线程保持“需求、约束、决策、最终输出”的干净轨道。这和你们事故的根因高度同构：review 线程全是噪声式的“代码细节正确性”，但缺少“需求与决策”的主轴。citeturn14view2turn13view0  
- Codex CLI 的 multi-agent 还允许定义角色，并让每个角色加载 role-specific config 与 developer_instructions，文档强调“每个角色一个清晰工作、匹配的工具面、以及防止漂到邻近工作的指令”。这是把“愿景守护”部分下沉到**配置层面**，而不是只靠临场 prompt。citeturn13view4  
- 更“硬核”的愿景守护来自 Harness engineering：OpenAI 这篇文章把“仓库知识（docs、exec plans、product specs、质量评分等）做成 system of record”作为 agent-first 工程的核心，并展示了一个 in-repo knowledge store 的目录结构（如 design-docs、exec-plans、product-specs、QUALITY_SCORE、PRODUCT_SENSE 等），用来持续把“产品意图、设计原则、质量目标”固定成可引用、可 lint、可 CI 校验的工件。citeturn32view2turn32view3turn32view0  
- 另外，Codex App 2026-02-02 的发布文强调其默认在隔离环境中运行并通过策略控制网络/权限，属于“安全与可控性”的护栏（虽不直接解决愿景漂移，但在长程 agent 里能把错误边界缩小，减少“执行偏了还造成不可逆结果”的成本）。citeturn5view0turn11view0

**Cursor / Windsurf（IDE 长会话类）**  
Cursor 明确提供 project rules（`.cursor/rules` 下的 markdown 文件，可 version-control，可按路径/模式作用域化），把“项目约束”从对话历史迁移为“可重复加载的上下文锚点”。citeturn33search0  
Windsurf 的 Cascade 则把“Memories & Rules”明确做成跨对话持久化机制：Memories 可以由系统自动生成，Rules 是用户手工定义（可全局/工作区/企业级系统层），目标是**跨会话共享与持久化上下文**。这相当于把“愿景/习惯/决定”从易被压缩的聊天记录中外置出来。citeturn33search1turn33search5

**CrewAI / AutoGen / LangGraph（编排框架）**  
如果把“愿景漂移”视为“链式传递时信息逐步走样”，那么编排框架里最直接有效的是两类能力：**可验证的 guardrails** 与 **可持久化的状态/人类门禁**。  
- CrewAI 提供 task guardrails：在任务输出被传递到下一个任务前进行验证/变换，并在不满足标准时给 agent 反馈或触发重试/停止；它还支持层级式流程（manager 负责规划、分派、验证），把“谁负责最终对齐”显式化。citeturn34search0turn34search12 其 memory 系统还宣称用统一 Memory API，把相似度、时序、重要性等合并评分做“可召回的长期记忆”。citeturn34search16  
- AutoGen 的文档给出了多种对话编排模式（group chat、nested chat 等），并提供与 Mem0 的 memory 集成示例，强调将交互持久化并在需要时自动检索注入上下文。citeturn33search3turn33search17  
- LangGraph 则把“长程执行”的关键点做得非常工程化：checkpointer 会在每个 super-step 保存 graph state，形成 thread，可用于 fault-tolerance、人类审批、time travel；interrupt() 可以在节点处暂停并保存状态，等待人类恢复；time travel 可以从历史 checkpoint fork 出新的执行分支。它把“里程碑门禁 + 可回滚”从流程变成框架级能力。citeturn33search2turn34search3turn34search7  
此外，2026-02-13 微软官方文档把 “Microsoft Agent Framework” 定位为 AutoGen 的直接继任者，强调 session-based state management、telemetry、workflow 控制与长程/HITL 场景的稳健状态管理，这反映了 2025H2 之后行业对“可控长程执行”的共识正在向 SDK/平台下沉。citeturn33search7

**补充：OpenHands / SWE-agent / 数据集趋势**  
OpenHands 在 2025-11 的 SDK 论文与官方 SDK 文档中，把“可组合、可生产化的软件 agent 工具包”作为目标，并提到可支持多 agent 的大任务（重构/重写）。citeturn34search5turn34search9 但关于“愿景守护”的具体护栏策略，在本次可引用材料里更多是需求侧的讨论（例如用户提 guardrails 需求）。citeturn34search13  
SWE-agent 的 NeurIPS 2024 论文在讨论开源时强调“约束/许可边界对软件工程 agent 的重要性”，更偏安全与能力边界治理；它本身提供在真实仓库中修 issue 的自动化框架，但“愿景漂移”更多依赖上层流程与任务定义。citeturn34search18turn34search2  
值得注意的是，2026-02 的 AIDev 数据集收集了大量 agent-authored PR（覆盖 Codex、Devin、Copilot、Cursor、Claude Code），说明“agent 写 PR 并进入真实 review 链路”已经规模化，愿景漂移从个体体验变成可研究、可度量的工程现象。citeturn31academia40

## 上下文压缩导致的失忆

业界对“压缩=失忆”的处理，正在从“更大窗口/更聪明 summarize”转向三类更稳健的结构性方案。

第一类是**把愿景外置为持久工件**（Context-as-artifact）。典型做法是把规则与关键需求写成 repo-level context files（AGENTS.md/CLAUDE.md、Cursor rules、Windsurf rules、OpenClaw 的 workspace persona rules 等），并让工具在每次需要时自动注入，而不是依赖对话历史。OpenCode 明确把 AGENTS.md 作为规则载体并建议 commit；Cursor 的 rules 也是 project 内 version-controlled 文件；Windsurf 直接把 rules/memories 定位为“跨会话持久化上下文”。citeturn24view2turn33search0turn33search1  
从研究角度看，这种“agent README/context file”已成为一种可观察到的大规模实践：对 2,303 个 agent context files 的实证研究显示，开发者会大量写入架构、实现细节与构建运行指令，但安全/性能等非功能性约束相对缺失，意味着这些文件常能“让 agent 跑起来”，但未必能“让 agent 不跑偏”。citeturn23academia32 这与“愿景漂移”高度相关：没有把 UX/产品意图/质量边界写进可持久注入的工件时，漂移几率会上升。

第二类是**把长程执行拆成“干净的子会话/子 agent”**（Role separation + clean context）。Codex 的多 agent 概念页明确指出主线程应避免被噪声淹没；CodeDelegator（2026-01）更进一步提出：用一个持久 Delegator 维持战略监督，不执行代码；每个子任务都新建一个 Coder，给它只包含规格说明的干净上下文，并用 EPSS 隔离临时执行状态，避免调试痕迹污染主脑。citeturn14view2turn23academia34  
这类结构直接回答你们的担心：“team lead 上下文有限、压缩失忆会更可能干歪”。解决路线不是让 lead 背更多，而是让 lead 只背**最小必要的愿景与决策**，把高噪声交给隔离的 worker，并强制让 worker 通过“规格/检查点”与 lead 对齐后再继续。

第三类是**把 compaction 做成“可控的状态机”，而不是一次性摘要**。OpenClaw 的 compaction 前 memory flush（软阈值触发、NO_REPLY 静默写 durable note、每周期一次）是一个很具代表性的工程化设计：它把“要写下来的东西”从随机对话里抽离出来，变成可审计文件。citeturn27view3turn27view0 LangGraph 的 checkpointer/interrupt/time-travel 同样是状态机化：你可以在关键节点暂停、让人类确认、从历史 checkpoint 回滚并改参数再跑。citeturn33search2turn34search3turn34search7  
相反，单纯依赖自动 compaction 往往会引入“摘要语义漂移”。Oh My OpenCode 的 issue 显示：摘要中的“Suggested Next Steps”可能被误执行，这类问题如果不对摘要格式做严格约束，就会把“压缩”变成新的漂移源。citeturn19search17

关于量化与评估：  
- “Evaluating Goal Drift in Language Model Agents” 提出一种实验范式：先通过 system prompt 给 agent 显式目标，再通过环境压力引入竞争目标，并分析 agent 目标偏移。citeturn36search0turn36search1 这为“愿景漂移评估”提供了标准化方向，但本次无法展开其全文实验细节。  
- NeurIPS 2025 的 “Detecting Intent Drift in Long-Horizon LLM Dialogues” 报告其 IDS 指标与人工评分相关性高于 0.82，并能比 BLEU/ROUGE 等更早识别漂移，说明“漂移”可以被更早、更结构化地探测。citeturn36search7  
- 从系统可观测性角度，AgentTrace（2026-02）提出把 agent 运行时日志分为 operational/cognitive/contextual 三个面，目标是让 agent 的状态变化与交互可追踪可审计，这类能力在“愿景漂移”治理里通常对应“你怎么证明它没跑偏”。citeturn31academia41

image_group{"layout":"carousel","aspect_ratio":"16:9","query":["multi-agent workflow context pollution diagram","agent memory flush compaction diagram","LangGraph interrupt checkpoint diagram","software agent harness engineering docs directory structure"] ,"num_per_query":1}

## 你们的流程嵌入方案与业界方案对比

你们当前方案属于非常典型且有效的“流程嵌入（Process-embedded）”路线：在 SOP 的关键节点强制回读原始需求、review 附原文、反馈分类、PR body 强制填原始需求、完成时跨 agent 交叉验证。它的强项是**立刻可落地**，且对现有系统侵入小；弱项是它主要依赖“人/agent 按流程执行”，对“上下文污染、自动压缩误差、隐性代理目标（proxy）”缺少技术型硬门禁。

下面表格把你们方案与业界几类代表性模式对齐（评分为相对直观判断；“上下文压缩鲁棒性”指在长会话/多轮压缩后仍能守住愿景的能力）。

| 方案/系统（代表） | 防偏机制类型 | 上下文压缩鲁棒性 | 实施成本 | 更适合的场景 | 关键要点（可借鉴） |
|---|---|---|---|---|---|
| 你们当前 SOP（需求回读+review 附原文+反馈分类+PR 强制原始需求+跨 agent 验证） | 流程 | 中（取决于执行纪律） | 低 | 小团队、多模型协作、立刻止血 | 把“愿景对照”变成强制门禁；但需要配套“工件化”避免只刷流程 |
| Claude Agent Teams | 流程 + 结构 | 中-高（目标靠 task list/消息外显） | 中 | 多 agent 并行、需要清晰责任边界 | lead 不继承 teammate 对话→逼迫产出结构化；要把原始需求做成共享工件citeturn1view0turn3view0 |
| Codex 多 agent + Harness engineering | 技术 + 工件化 | 高（主线程去噪+docs 作为系统记录） | 高 | 长程、多人、多 PR、高吞吐工程 | 把 product/ux/quality 写进 docs 目录并 CI 强制一致性；主线程只承载需求/决策citeturn14view2turn32view2turn32view4 |
| OpenCode（plan/build 分离 + AGENTS.md） | 技术 + 上下文 | 中-高（阶段分离减少“边写边想”漂移） | 中 | 功能较复杂、需要先定方案再执行 | plan 模式禁写/禁 bash；AGENTS.md 可版本化；/compact 支持会话续航citeturn24view1turn24view2turn24view3 |
| Oh My OpenCode（hooks：rules/readme 注入、预压缩、输出截断、todo 续航） | 技术 + 流程自动化 | 中（能减噪，但摘要也会引入新风险） | 中 | 单人/小团队、追求“高自动推进” | 把关键事件变 hooks；但要防摘要语义漂移（如 next steps 误执行）citeturn25view0turn19search17 |
| OpenClaw（workspace/agentDir/session 隔离 + memory flush + session tools 权限分层） | 技术 | 高（状态隔离+落盘记忆+预压缩写记忆） | 高 | 24/7、跨渠道、多身份、多项目并行 | 多 agent 路由隔离状态；memory 以文件为真；compaction 前 flush durable noteciteturn30view0turn27view3turn30view2 |
| LangGraph（checkpointer/interrupt/time travel） | 技术（状态机） | 高（可暂停、可回滚、可续跑） | 中-高 | 需要严控里程碑/审批/回滚的 agent 流程 | interrupt 强制 human checkpoint；time travel 支持“从偏航点回滚重跑”citeturn34search3turn34search7 |
| CrewAI（task guardrails + manager 层级） | 技术 + 流程 | 中 | 中 | 多 agent 任务链、输出需符合格式/约束 | guardrails 阻断坏输出向下游传播；manager 对齐/分派/验证citeturn34search0turn34search12 |
| Cursor/Windsurf（rules/memories 工具化） | 上下文嵌入 | 中 | 低-中 | IDE 长会话、团队风格规范 | 把规则做成可重复注入的“锚点”，降低对聊天历史依赖citeturn33search0turn33search1 |

对你们来说，最“补洞”的组合通常是：**保留 SOP 的流程门禁（止血）+ 追加两类工件化硬门禁（防复发）**：  
- 工件化一：把“原始需求/愿景”变成 repo 内的 version-controlled **single source of truth**（类似 Harness engineering 的 docs/product-specs + OpenCode/Cursor 的规则文件），并在每个 agent/每轮 review 默认注入。citeturn32view2turn24view2turn33search0  
- 工件化二：把“愿景对照”做成**机器可执行的验收**（例如 UI 可用性与关键路径的 E2E/截图回归、关键交互的 playwright 脚本、或 UX checklist 的结构化 grader），让“愿景”进入 CI/门禁层，而不是只停留在提醒。Harness engineering 与 agentic governance 的思路都是把治理点变成可重复执行的 scaffolding。citeturn32view0turn34search1

## 复杂 feat 容易做歪的应对策略

“复杂 feat 丢给 agent 更容易做歪”在机制上并不神秘：复杂任务 = 更长的执行轨迹 + 更多分支决策 + 更高的上下文噪声 + 更晚才暴露“方向错了”。业界现在最有效的应对通常不是“更强模型”，而是**把复杂性重新分配**：让 agent 专注在短周期、可验证、可回滚的增量。

可以直接借鉴的做法有三类：

第一类是**阶段化里程碑 + 强制中途验收（milestone checkpoints）**。LangGraph 的 interrupt 就是把“中途验收”做成框架能力：到关键节点自动暂停并保存状态，必须得到人类确认才能继续；同时还能 time travel 回到某个 checkpoint 重跑。citeturn34search3turn34search7 你们的 SOP 已经在“开发前/PR/完成时”做了检查点，但复杂 feat 往往需要把检查点下沉到“需求还原→交互草图→数据结构→最小可用 UI→扩展边界”这种更细粒度的里程碑上，否则仍可能在最后一刻才发现整体方向错。

第二类是**“主线程保持愿景，子线程做噪声工作”的分工**。Codex 的设计建议直接指出：把探索、测试、triage 等工作交给并行 sub-agents，让主 agent 只承载需求与决策，并让 sub-agent 回传摘要而不是全部中间过程。citeturn14view2turn13view0 CodeDelegator 的研究结论更激进：每个子任务启动全新的 coder，以规格说明作为干净上下文，避免把失败轨迹带进主脑。citeturn23academia34 这对“复杂 feat 容易做歪”往往比“多写 prompt”更有效，因为它直接减少了导致漂移的上下文形态。

第三类是**把“愿景”变成 repo 可读、可查询、可 lint 的知识库**。Harness engineering 给出的 in-repo knowledge store 结构（design-docs / product-specs / QUALITY_SCORE / PRODUCT_SENSE 等）本质上是在做“愿景的工程化固化”，让 agent 每次都能检索到“为什么要这么做”和“什么算做对”。citeturn32view2turn32view3turn32view0 这与传统软件工程里应对 scope creep / gold plating 的方法同构：把范围、不可做项、关键用户旅程写成“可审计的契约”，并把变更管理纳入门禁（而不是让实现者自由发挥）。

一个“反直觉但有效”的方向是：**越复杂越要“变慢”：先把愿景写成更严格的 spec（含反例/不可做项），再让 agent 在更受限的权限里推进**。OpenCode 的 plan 模式、OpenClaw 的工具与 session 权限分层、CrewAI 的 guardrails/manager 分派，本质上都在做同一件事：把“自由度”从复杂任务里拿走一点，用结构换取不跑偏。citeturn24view1turn30view3turn34search0

## 盲区、已确认事实与待验证项

**你们方案的主要盲区（相对业界更强方案）**  
盲区一：你们现在的守护主要发生在“人读文本/agent 按提示回读”层面，而缺少**技术型硬门禁**，例如：  
- “原始需求是否被引用/是否被更新”为真，但“实现是否覆盖关键用户旅程”仍可能缺席。Harness engineering 的方向是把 quality/product sense 工件化并配套 CI/lint；LangGraph 则把门禁做成 interrupt。citeturn32view2turn34search3  
盲区二：缺少对“上下文污染”的系统治理。你们在流程里加了愿景对照，但如果主线程仍被大量工具输出淹没，愿景锚点仍会在压缩时被稀释。Codex 与 CodeDelegator 强调“分离噪声工作”，Oh My OpenCode/ OpenClaw 强调“截断输出/预压缩/记忆落盘”。citeturn14view2turn23academia34turn25view0turn27view3  
盲区三：缺少“压缩本身的可靠性设计”。你们流程能提醒“回读”，但压缩摘要如何写、如何防止摘要变成新指令、如何区分历史与待办，目前看还没有硬规范；社区里已经出现 compaction 后误执行 next steps 的典型事故。citeturn19search17

**已确认事实（有明确来源支持）**  
- 长上下文并不等于稳定可靠：在控制任务复杂度的实验里，多模型性能会随输入长度增加而变得不可靠（context rot）。citeturn15view0  
- Codex 文档明确将 context pollution/context rot 作为多 agent 设计动机，并建议把噪声工作移出主线程。citeturn14view2turn13view0  
- OpenCode 明确提供 plan/build 两类模式（plan 禁写/禁 shell 等），并把 AGENTS.md 作为规则注入的核心载体，建议团队共享与版本控制。citeturn24view1turn24view2  
- Oh My OpenCode 默认启用 hooks（含 rules/readme 注入、预压缩阈值、输出截断、任务续航等）。citeturn25view0turn25view1  
- OpenClaw 的 memory 以 Markdown 文件为真，并提供 compaction 前 memory flush 与 vector memory search 的默认能力；其多 agent routing 以 workspace/agentDir/session 隔离为核心。citeturn27view2turn27view3turn30view0  
- LangGraph 的 checkpointers/interrupt/time-travel 为长程 agent 提供持久化、暂停审批与历史回滚机制。citeturn33search2turn34search3turn34search7  
- CrewAI 的 task guardrails 在任务输出进入下游前做验证/反馈。citeturn34search0turn34search12  

**推测/待验证（本次无法同源确认）**  
- “OpenClaw 145k+ stars、134+ MCP 工具”的精确数字：目前仅能确认官方自述“over 100,000 GitHub stars”，其余需回到 GitHub/官方 registry 进一步核对。citeturn35view0  
- “愿景漂移率 vs 任务长度/交互次数”的系统性曲线：虽然 goal drift / intent drift 评估研究已出现，但本次可引用的公开摘要不足以支持你们要的完整量化曲线，需要后续专项做 meta-analysis（或用你们内部数据做自建基准）。citeturn36search0turn36search7  
- Devin、Cursor、Claude Code 等产品在“愿景守护”的内部机制细节：AIDev 数据集证明 agentic PR 在规模化发生，但并不等于公开了每个产品的具体对齐策略。citeturn31academia40  

## 推荐方向与风险

结合你们已有 SOP（流程嵌入）与业界更强的“技术嵌入/上下文嵌入”，我建议把“愿景守护”升级为一个三层体系：**愿景工件化 + 里程碑门禁化 + 上下文去噪化**。

愿景工件化（建议优先级最高）：把“原始需求/关键用户旅程/不可做项/UX 关键点”做成 repo 内单一真源（例如 `docs/product-specs/feat-F041.md` + `docs/ux/flows.md` + `QUALITY_SCORE.md` 这类结构），并要求所有 agent 工作前自动加载、所有 review 默认展示。Harness engineering 展示了这种 “in-repo knowledge store” 的可行路径：用结构化 docs 让 agent 在高吞吐开发里仍能对齐产品意图。citeturn32view2turn32view0  
风险在于：工件会迅速变多、变长，可能反过来制造 context 污染。缓解策略是借鉴 CodeDelegator/Codex：主线程只持有“索引+当前任务相关段落”，其余通过检索/引用按需加载。citeturn14view2turn23academia34

里程碑门禁化：把你们现有的 5 个检查点进一步“细粒度化”，并引入两种强制门禁手段：  
- “人类审批型”：像 LangGraph 的 interrupt 那样，在“交互草图/接口契约/关键 UX 流程”完成后强制停下来确认再进入实现。citeturn34search3  
- “机器验收型”：把关键用户旅程做成 E2E（比如 playwright）或快照回归（类似 Codex repo 的 UI snapshot 要求），让“UI 不可用/核心路径缺失”在 CI 里直接失败，而不是上线后才发现。citeturn9view0turn34search1  
主要风险是成本（测试维护、门禁变慢）。但从你们这次事故的代价看，门禁的 ROI 往往是正的：减少“做完才发现方向错”的返工。

上下文去噪化：用结构隔离与自动截断把噪声从主线程拿走，避免压缩时丢愿景：  
- 角色/权限隔离：OpenCode 的 plan/build、OpenClaw 的 subagent 工具分层、Codex 的多 agent roles 都是可直接借鉴的模板。citeturn24view1turn30view3turn13view4  
- 输出治理：借鉴 Oh My OpenCode 的 tool-output-truncator 与预压缩策略，同时补上“摘要格式规范”（区分历史/事实/待办、明确不可执行区段）以避免 compaction 引发的新漂移。citeturn25view0turn19search17  
风险在于：截断与压缩可能隐藏关键证据，使 review 更难。缓解策略是像 OpenClaw 那样把 durable 内容写入文件，并让主线程保留“可追溯指针”（文件路径/时间戳/关键引用），而不是只留一段不可审计的摘要。citeturn27view2turn27view3