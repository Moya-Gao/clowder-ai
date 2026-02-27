---
feature_ids: [F002, F027]
topics: [multi, agent, comparison]
doc_kind: research
created: 2026-02-24
---

# **Multi-Agent 架构对比调研：Cat Cafe vs 业界领先方案**

在 2026 年 2 月的技术语境下，人工智能软件工程范式已经发生了根本性的演变，正在从单一智能体的顺序执行模型，向高度并行、自主协同的多智能体集群（Swarm）架构发生代际跃迁。当前，针对多智能体协作的底层架构设计在业界出现了严重的分野。我们正在开发的 Cat Cafe 系统（目前包含约 20,000 行 TypeScript 代码，拥有 500+ 测试用例，已完成 Phase 0-5 并接入三只异构「猫猫」智能体）选择了一条以去中心化工作队列（Worklist）、CLI 子进程订阅经济学以及强人在环（Human-in-the-Loop）策略学习棘轮为核心的独特演进路径。

为了从架构验证与风险规避的维度对 Cat Cafe 进行深度审视，本调研报告针对当前业界最具代表性的三种多智能体框架进行了详尽的解剖分析：Anthropic 官方于 2026 年 2 月最新推出的 Claude Code Agent Teams（主从编排模式）、基于 OpenCode 的社区顶级工程 oh-my-opencode（及其精简版分支，Sisyphus 编排器），以及由 Moonshot AI 驱动的 Kimi Agent Swarm（k1/k2.5 混合专家模型集群）。本报告将围绕架构模式、人在环设计、异构支持、任务并行、上下文管理、开发者体验、已知缺陷等核心维度展开深度论述，并为 Cat Cafe 的最终产品化提供关键的设计借鉴与风险预警。

## **架构模式对比与演进逻辑 (Q1)**

多智能体系统的核心分歧首先体现在编排模式与智能体间的通信机制上。业界主流方案普遍倾向于构建严格的树状或星型拓扑结构，而 Cat Cafe 则在探索一种接近对等网络（P2P）的事件驱动模型。

Anthropic 的 Claude Code Agent Teams 采用了一种极其严格的「主导者与团队成员（Team Lead \+ Teammates）」中心化星型拓扑结构（已确认）1。在这种架构中，单一的主会话（Team Lead）充当绝对的中央编排器，负责孵化子智能体并协调工作流。为了防止递归执行导致的计算资源失控，该架构在物理层面禁止了嵌套团队的生成，即子智能体无法再次孵化自己的下级团队（已确认）1。在通信机制方面，Claude 采取了一种令人意外但高度可靠的低级协议：基于本地磁盘 JSON 文件的「邮箱（Mailbox）」机制（已确认）4。当智能体需要进行横向或纵向通信时，它们并不依赖于 WebSockets 或内存中的进程间通信（IPC），而是通过调用 SendMessageTool 将消息追加到特定的本地文件中（例如 \~/.claude/teams/my-project/inboxes/backend-dev.json）4。这种机制迫使智能体只能在离散的执行回合（Turns）间隙去读取收件箱，从而彻底消除了实时 RPC 流中常见的竞态条件，但代价是极高的通信延迟和一种类似「查收电子邮件」的异步协作节奏（推测）4。

社区项目 oh-my-opencode 同样坚持中心化编排，其核心是一个名为 Sisyphus 的主控智能体。该架构首先通过「意图网关（Intent Gate）」对用户需求进行分类，随后由 Sisyphus 负责战略规划并将任务单向委派给下层的专用智能体（如 Oracle、Librarian、Frontend）（已确认）6。这种单向汇报机制（编排器 → 子智能体 → 汇报）虽然逻辑清晰，但在面对复杂的回溯性推理时，往往会导致底层智能体缺乏足够的全局上下文支持。

相比之下，Moonshot AI 的 Kimi Agent Swarm 展示了一种软硬件深度绑定的内生中心化架构。Kimi 依托其 1.04 万亿参数的混合专家（MoE）底层结构，直接在模型推理管道内部孵化多达 100 个子智能体（已确认）8。这种被称为「宽泛研究（Wide Research）」的范式，通过一个极其复杂的原生编排器将全局目标分解为细粒度的并行子任务，跳过了外部 API 路由的延迟，实现了基于强化学习（PARL）的动态发现与调度（已确认）9。

Cat Cafe A2A 架构则完全摒弃了中央编排器，采取了去中心化的共享执行队列（Worklist）模型（已确认）。在这个模型中，智能体通过在自然语言回复中直接注入 @mention 标签来触发对等智能体的链式调用。这种机制天然支持 A → B → A 的乒乓审查（Ping-Pong Review）模式，将控制权交还给了对话语境本身。然而，这种极其灵活的流转方式缺乏 Claude 那种基于磁盘文件的硬性状态锁，如果多个智能体同时响应一个复杂意图，极易引发上下文污染或执行冲突（推测）。Cat Cafe 设置的最大深度限制（15 层）是防止无限对话循环的基础物理屏障，但这仅仅切断了调用栈，并未从语义层面解决去中心化网络中常见的「责任推诿」难题。

## **人在环（Human-in-the-Loop）设计的深度重构 (Q2)**

随着智能体被赋予直接修改生产环境代码的能力，权限申请与实时干预机制从简单的功能性组件演变为了决定系统生死存亡的安全护城河。

在 Anthropic 的体系中，人类角色的定位正在从「协作者」向「最终裁决者」转变。2026 年 2 月 20 日发布的 Claude Code Security 模块深刻体现了这一逻辑（已确认）11。该模块利用 Opus 4.6 模型深入代码库进行复杂的漏洞推理（如追踪数据流、识别业务逻辑缺陷），但在其执行流程中设置了绝对的硬性阻断：没有任何代码修复操作可以在未经人类明确批准的情况下被自动应用（已确认）11。在日常的 Claude Code Agent Teams 协作中，人类可以通过按下 Shift+Tab 键激活「委派模式（Delegate Mode）」，这一操作会粗暴但有效地剥夺主智能体的 Write、Edit 和 Bash 工具权限，迫使其只能进行规划和通信，从而强制人类介入实质性修改（已确认）1。

Kimi Agent Swarm 则将人类定位为「宏观管理者」。由于其「宽泛研究」范式通常需要调动大量智能体并行运行 10 分钟到 1 小时，Kimi 实现了「存储会话（Stored Session）」的挂起与重连机制（已确认）13。人类无需在终端前实时盯盘，而是在系统执行完毕或遇到必须人类决策的节点时，重新接入会话进行评估。Kimi 通过在执行前引入「规划批评者（Planning Critic）」子智能体，最大程度地减少了中途打断人类的频率（已确认）9。

对比之下，Cat Cafe 设计的「强人在环权限系统」展现出了极高的工程独创性。其基于 WebSocket 与 Web Push 双通道通知的三级审批矩阵（once / thread / global）构成了一个动态的「策略学习棘轮（Ratchet）」（已确认）。这一设计的卓越之处在于，它将人类的即时审批行为转化为系统的长效治理策略——频繁被批准的操作会自动固化为全局规则。这种机制有效缓解了 Claude 架构中可能出现的「审批疲劳（Approval Fatigue）」，并使得系统权限配置能够随项目成熟度自动进化（推测）。然而，这种依赖统计频率的提权机制蕴含着深层的安全隐患。如果开发者在处理高压故障时由于急躁而连续多次盲目批准了高风险操作（如强制覆盖关键配置文件），Cat Cafe 的棘轮机制可能会将这一危险行为永久合法化，导致严重的「策略漂移（Policy Drift）」风险（推测）。

## **智能体异构性支持与订阅经济学 (Q3)**

异构性（即在同一任务框架内混合使用不同厂商、不同规模的底层语言模型）是衡量多智能体系统抗风险能力与经济效益的核心指标。

Claude Code Agent Teams 实施了严格的生态封闭策略。尽管系统内部支持主智能体（Opus 4.6）将特定任务委派给成本更低、速度更快的子智能体（如 Claude 3.5 Haiku 以进行只读的代码库探索），但这一套编排体系被完全锁死在 Anthropic 自身的模型矩阵内，绝不兼容 OpenAI 或 Google 的外部模型（已确认）2。Kimi Agent Swarm 同样受限于其物理基础设施，主要依赖其自研的 k1 和 k2.5 混合专家模型进行内部参数级别的路由调度，不对外开放异构模型的原生编排（已确认）8。

oh-my-opencode 最初的成功正是建立在打破这种厂商锁定的基础之上。该社区项目极力推崇「让最合适的大脑做最合适的工作」，在同一任务链路中混合使用 Claude 进行顶层编排、使用 GPT 处理深度逻辑推理、并调用 Gemini 编写前端代码（已确认）6。然而，这种异构性是通过在 OpenCode 平台中伪造 Claude Code 的 OAuth 请求签名来实现的。随着 Anthropic 在 2026 年 1 月以违反服务条款（ToS）为由全面封杀第三方客户端接入，oh-my-opencode 的 API 依赖路径遭遇了毁灭性打击，暴露了基于 API 路由的异构框架在商业垄断面前的极度脆弱性（已确认）16。

为了规避高昂的 API 计费以及厂商 API 的封锁，Cat Cafe 独辟蹊径，采用了「CLI 子进程 \+ 订阅经济学」的架构底座。每只异构的「猫（Agent）」通过 spawn() 启动各自官方的 CLI 工具（如 Claude、Codex、Gemini），直接消耗用户的网页端订阅额度（如 Claude Max、ChatGPT Pro）（已确认）。更为巧妙的是，针对 Codex 和 Gemini 不原生支持模型上下文协议（MCP）的缺陷，Cat Cafe 开发了 McpPromptInjector，通过向这些非原生模型注入 HTTP 回传指令，强行实现了底层的统一回传（已确认）。这种做法在成本控制上取得了压倒性优势，但 HTTP 回传指令的注入对语言模型的指令遵循能力要求极高。随着上下文窗口的填满，非原生模型极易产生「格式遗忘」，导致输出的 JSON 或 HTTP 结构破损，进而引发整个去中心化调用链的静默崩溃（推测）。

## **任务分解、并行调度与失败处理机制 (Q4)**

在应对复杂的软件工程需求时，系统如何将宏观意图拆解为微观任务，并在并行的同时维持严格的依赖关系，是编排器的核心职责。

Claude Code 的解决方案极具防御性。每个 Agent Team 都在本地磁盘维护一个对应的共享任务列表（\~/.claude/tasks/{team-name}/）（已确认）5。主智能体负责将任务拆解并写入该目录，而子智能体则通过文件系统锁来申领任务。这种机制不仅天然支持依赖项管理（某个任务完成前，其下游任务无法被其他智能体申领），还通过文件级的所有权锁定，彻底避免了多个智能体同时修改同一源代码文件引发的灾难性覆盖（已确认）2。然而，这种严格的控制经常导致主智能体陷入「微观管理」的陷阱，甚至放弃委派，直接自行执行底层代码修改（已确认）1。

Kimi Agent Swarm 的「宽泛研究」范式则将并行推向了极致。在面对全局目标时，编排器会自主向下分叉出处理不同子模块的独立智能体，最高可并发 1,500 次工具调用（已确认）9。Kimi 通过流式服务器发送事件（SSE）将各并行线程的状态实时同步给前端，在处理诸如大规模竞品分析或全局变量重构等横向平铺型任务时，效率可提升 4.5 倍（已确认）9。

在失败处理与系统韧性方面，oh-my-opencode 提供了极其惨痛的业界教训。其早期的 Sisyphus 编排器包含了一套名为 ralph-loop 和 todo-continuation-enforcer 的激进重试钩子（Hooks）（已确认）7。当子智能体遭遇环境异常（如操作被人类中止而抛出 MessageAbortedError）时，这些钩子会无视底层错误，强制智能体不断重试。这种缺乏语义中断机制的死循环导致了严重的后台任务卡死和 API 用量急剧飙升（已确认）7。直到 2026 年 2 月中旬的 \#1348 PR，社区才通过重置每一轮迭代的上下文策略勉强修复了这一缺陷，而其精简分支 oh-my-opencode-lite 则干脆直接删除了多达 38 个行为控制钩子以求得系统的确定性（已确认）7。

Cat Cafe 的 Intent 驱动路由（@mention 2+ 触发 \#ideate 并行，@mention 1 触发 \#execute 串行）提供了一种极其优雅的语义级调度方案（已确认）。然而，在 \#ideate 的并行发散阶段结束后，Cat Cafe 缺乏 Claude 那种基于磁盘的任务锁定和依赖收敛机制。如果两只模型在并行思考后同时尝试对同一个模块进行代码修改，去中心化的 Worklist 将无法在系统级拦截这种写入冲突（推测）。此外，Cat Cafe 的最大深度 15 虽然切断了无限递归，但无法解决 oh-my-opencode 遭遇的逻辑死循环问题。如果底层报错未能被正确抛出给人类，两只智能体会互相推诿 15 次，白白浪费时间与订阅算力。

## **Session / Context / Memory 生命周期管理 (Q5)**

超长文本的上下文管理是多智能体系统的技术瓶颈。随着智能体协作的深入，上下文窗口的迅速饱和会导致推理能力的断崖式下跌。

Claude Code 采用了极端的「上下文物理隔离」策略。每一个被孵化的团队成员（Teammate）都在自己完全独立的内存空间中运行。虽然它们会主动读取项目根目录下的全局配置（如 CLAUDE.md），但它们绝对不会继承主智能体的历史对话上下文（已确认）2。更为致命的是，Claude Code 存在严重的「时序失忆症」。实验表明，系统的 /resume 和 /rewind 命令根本无法恢复那些在主进程内运行的子智能体。一旦会话因为终端关闭而中断，重新连接后，主智能体依然会错误地认为其团队成员存在，并尝试向那些早已消亡的子进程邮箱发送消息，导致整个协作链条彻底断裂（已确认）1。

原版的 oh-my-opencode 试图通过极其复杂的 Token 监控系统（如 context-window-monitor 和 preemptive-compaction）在后台不断压缩和提炼记忆（已确认）7。但这引发了过度的计算冗余，系统为了维持上下文的精简而消耗了比实际编写代码更多的推理算力，这一功能最终在轻量级分支中被彻底废弃。Kimi 则依赖其高达 256K 的长文本窗口硬抗上下文压力，但社区反馈显示，其底层推理引擎（如 llama.cpp）在极高上下文长度下的 KV Cache 依然存在内存泄漏和降速问题（已确认）9。

Cat Cafe 采用的 active → sealing → sealed 链式生命周期管理是一种高度结构化的防御机制（已确认）。当会话容量逼近阈值时，系统主动将其封存为 Transcript 记录，并在启动新 Session 时通过 Bootstrap 注入摘要。这种类似区块链账本的连接方式，确保了跨会话记忆的持久化，完美规避了 Claude 的失忆缺陷（推测）。然而，从高维度的原始对话向低维度的摘要注入（Bootstrap），其本质上是一种有损压缩。如果在 sealing 阶段，语言模型未能准确提炼出某一个深埋在代码逻辑中的微妙状态变量，那么新一代的 Session 将在失去这一关键约束的情况下继续运行，导致长周期任务中的隐性「语义漂移（Semantic Drift）」（推测）。

## **开发者体验、可扩展性与社区生态 (Q6)**

多智能体系统能否在生产环境中大规模落地，很大程度上取决于其是否能无缝融入现代开发者的终端环境，以及其扩展新能力的边际成本。

Claude Code Agent Teams 在开发者体验上做出了巨大的妥协。由于采用了多进程并行的物理架构，Anthropic 官方强制要求使用 tmux 或 iTerm2 这种高级终端复用器来实现「分屏模式（Split Panes）」，以便人类开发者同时监控所有智能体的输出流（已确认）2。在普通的 VS Code 集成终端或 Windows Terminal 中，开发者只能通过 Shift+Down 在单个视图中痛苦地循环切换，这使得全局协作状态变得不可视、不可测（已确认）2。在扩展性方面，Claude 推出了标准化的插件包系统，允许社区将特定的技能（Skills）、钩子（Hooks）和 MCP 服务器打包共享（已确认）3。

oh-my-opencode 的社区生态曾一度极其繁荣，其极度开放的 Markdown 提示词文件允许开发者微调每一个子智能体（如 Metis、Momus）的性格与权限（已确认）24。但这演变成了一场提示词工程的灾难——其主编排器的提示词文件甚至膨胀到了惊人的 1,485 行。在 2026 年 2 月的 lite 分支重构中，社区对这些冗余文件进行了史诗级的削减，将编排器代码精简了 95%（仅剩 67 行），前端智能体精简了 80%，彻底移除了 6 个低效的智能体角色，这才挽救了这套系统的开发者体验（已确认）7。

Cat Cafe 将异构智能体统一收敛于标准化的 CLI 子进程中，并将扩展机制全部建立在 MCP（模型上下文协议）之上。这是一种高度抽象且极具前瞻性的设计。开发者无需像 oh-my-opencode 那样编写繁杂的调度钩子，只要一个新的能力（如数据库查询、云服务器监控）被封装为 MCP Server，它就能立刻被 Cat Cafe 中的任何一只「猫」调用。这种底层解耦保证了系统代码库的清爽，并天然接入了目前最庞大的开源工具生态（推测）。

## **已知问题与系统级安全反馈 (Q7)**

随着智能体获取了写入代码、执行终端命令甚至联网分析的权限，其潜在的破坏力已引发了市场的真实恐慌。

Claude Code 最大的风险事件爆发于 2026 年 2 月 20 日。随着内置的 Claude Code Security 漏洞扫描工具的发布（基于 Opus 4.6），市场瞬间意识到 AI 智能体已经在深度漏洞推理层面超越了传统的静态代码分析工具。这一消息直接触发了美国股市网络安全板块的「闪崩」，JFrog 暴跌 25%，CrowdStrike 和 Cloudflare 下跌近 10%（已确认）11。这从侧面证实了具有自主权限的编排系统，如果一旦发生误操作或遭遇恶意指令注入，其对企业生产环境的破坏将是灾难性的。此外，由于每个子团队成员都是独立的 Opus 4.6 实例，Claude Code Teams 的 Token 成本呈现出惊人的 1x-7x 线性膨胀，使得大部分中小型团队根本无法长期承担其运行费用（已确认）2。

oh-my-opencode 面临的最大已知问题则是厂商的「数字霸权」与平台封锁。其依赖 OAuth 签名伪造的底层通信逻辑在被 Anthropic 察觉后，导致大量关联账户遭遇 ToS 封禁，甚至引发了 Anthropic 对整个 OpenCode 生态的清理动作（已确认）16。这一安全问题属于合规层面的不可抗力。

Kimi Agent Swarm 的核心限制在于基础设施的承载能力。尽管宣传能并行孵化 100 个智能体，但在真实的高强度测试中，巨大的并发请求会瞬间抽干商业 API 的工具调用配额（Tool-call Quotas），并触发严格的速率限制（Rate Limits）（已确认）9。

Cat Cafe 利用订阅经济学（如 ChatGPT Pro 账号）通过 CLI spawn() 触发并行任务的做法，游走在现有 SaaS 厂商服务条款的灰色地带。各大 AI 平台通常严禁利用个人网页端订阅额度进行自动化的机器并发请求（推测）。如果不实施极为复杂的随机行为抖动（Jitter）或并发节流，Cat Cafe 面临着极高的账号级封禁风险。此外，异构模型在处理高并发网络请求时，偶尔会出现的幻觉响应（Hallucination），往往会导致去中心化队列陷入僵局。

## **综合评估表格**

| 对比维度 | Claude Code Agent Teams | oh-my-opencode (Sisyphus Lite) | Kimi Agent Swarm | Cat Cafe A2A |
| :---- | :---- | :---- | :---- | :---- |
| **拓扑结构** | 严格中心化（主从结构，禁止嵌套） | 严格中心化（Sisyphus 意图网关分发） | 中心化（基于原生混合专家模型分叉） | **去中心化**（工作队列对等网络） |
| **通信协议** | 基于磁盘的异步 JSON 文件（低频） | 内部钩子与上下文注入（高频） | 模型内部参数级传递（零延迟） | **自然语言 @mention \+ MCP** |
| **任务并行锁** | **原生文件级所有权锁定（防冲突）** | 弱（基于单向执行链） | 原生并发（流式状态跟踪） | 弱（缺乏底层写操作并发控制） |
| **多模型支持** | 封闭（仅限 Anthropic 内部模型） | 原生支持（但遭官方封杀阻断） | 封闭（仅限 Kimi 自研系列模型） | **全面支持**（CLI 子进程注入封装） |
| **内存与会话** | **进程级隔离，重启后永久丢失子上下文** | 精简版移除了过度的后台 Token 监控 | 支持长周期任务的会话挂起与重连 | 链式生命周期（摘要注入，防失忆） |
| **人在环干预** | 委派模式，修改代码前要求显式批准 | 面试模式（Prometheus 事前规划确认） | 存储会话（事后脱机核对） | **三级棘轮机制**（动态提权与固化） |
| **致命缺陷** | 成本极高（7x），要求终端支持 tmux 分屏 | ralph-loop 死循环，面临严重的封禁风险 | API 配额消耗极快，极易触发速率限制 | 缺乏文件系统并发锁，策略漂移风险 |

## ---

**对 Cat Cafe 的战略借鉴与产品化建议 (Q8)**

Cat Cafe 的「去中心化工作队列」与「CLI 订阅经济学」完美击中了当前多智能体架构中**编排器瓶颈**与**高昂 API 成本**这两大痛点，代表了一种高度敏捷的未来演进方向。然而，要在 2026 年底将其推向生产级成熟度，必须从上述业界方案的血泪教训中汲取关键的防御性设计。

### **核心推荐方向**

1. **引入混合存储的「状态锁」机制（借鉴 Claude Code）：**  
   去中心化的 @mention 通信极度优雅，但在 \#ideate 并行转化为 \#execute 串行执行的临界点，存在巨大的并发修改灾难隐患。Cat Cafe 必须借鉴 Claude 的底层智慧：在执行针对本地文件系统的 Write 或 Bash 操作前，强制要求子智能体（如 Gemini）通过系统的特殊 MCP 服务器申请针对特定文件路径的「物理写入锁」。如果文件被锁，排队的智能体必须等待或重新读取文件变更，从而用微小的延迟换取绝对的代码安全。  
2. **植入独立的「规划批评者（Planning Critic）」（借鉴 Kimi Swarm）：** Cat Cafe 目前的 A → B → A 乒乓模式容易陷入无休止的文字修改纠纷。应当借鉴 Kimi 和早期 Google Jules 的架构经验（已确认）9，在工作队列中隐式安插一个极低成本的「批评者（Critic）」智能体（如使用 Gemini Flash）。任何代码修改意图在被真正推入 Bash 或 Write 工具前，必须经过此批评者的瞬间逻辑校验，若不合规直接回退给提交者，以此拦截 90% 的无效代码尝试，大幅降低人类在环的审批频率。  
3. **确立「语义级强制中断」协议（借鉴 oh-my-opencode 的教训）：** 最大深度限制为 15 依然太过危险。oh-my-opencode 因为 MessageAbortedError 导致的无限循环崩溃警示我们（已确认）20，语言模型在面对未知错误时倾向于无脑重试。Cat Cafe 必须通过 Prompt 系统级规定一个类似于 \<FATAL\_ABORT\> 的特定输出标签。当任何「猫」遇到连续两次工具调用失败或检测到不可解决的系统异常时，必须输出该标签，立刻触发 Worklist 全局熔断，锁定会话状态并触发最高优先级的 Web Push 通知人类介入。

### **必须防范的系统性风险**

1. **策略学习棘轮的「毒化漂移（Poisoning Drift）」风险：**  
   频繁批准自动转化为永久规则的机制极具创新性，但这假设了「人类永远清醒且正确」。如果在深夜高压修 Bug 期间，开发者为了图省事连续批准了 Claude 的三条危险指令（如强制清理数据库表或忽略依赖版本冲突），Cat Cafe 的系统将把这种毁灭性操作学习为 global 级合法权限（推测）。**风险缓解措施**：在权限系统中硬编码一层与静态代码分析结合的绝对黑名单（类似 Claude Code Security 的防御逻辑），任何涉及高危系统调用的命令，无论人类批准多少次，都永远无法晋升至 global 级别。  
2. **订阅经济学的合规地雷（ToS Bans）：**  
   使用 spawn() 并行启动 CLI 并消耗网页端订阅配额，这与导致 oh-my-opencode 遭受全面封杀的底层逻辑如出一辙（推测）。一旦 Anthropic 或 OpenAI 的后端检测到源自单一账号、且完全超越人类输入速度极限的极高频并发并发请求，Cat Cafe 的使用者将面临账号被永久注销的风险。**风险缓解措施**：必须在工作队列中引入仿生学级别的执行延迟（Jitter），并在系统底层提供无缝切换回官方 API 计费的后备选项，以确保企业级用户的合规使用。  
3. **异构模型回传的「格式遗忘症」：**  
   McpPromptInjector 是一个惊艳的补丁，但它极度脆弱。Codex 和早期 Gemini 等模型在长下文压力下，其指令遵循能力会发生衰减（推测）。在 active → sealing 阶段，如果模型因为幻觉输出了一段缺少闭合括号的 JSON HTTP 回传指令，整个进程将会静默崩溃。**风险缓解措施**：在底层 CLI 包装器中部署严格的容错解析器（Resilient Parser），甚至引入微型语言模型专门用于纠正和重构破损的 JSON 回传格式，确保主执行队列的网络流转不受单一节点格式错误的阻断。

#### **引用的著作**

1. Configure Claude Code to Power Your Agent Team | by David Haberlah \- Medium, 访问时间为 二月 24, 2026， [https://medium.com/@haberlah/configure-claude-code-to-power-your-agent-team-90c8d3bca392](https://medium.com/@haberlah/configure-claude-code-to-power-your-agent-team-90c8d3bca392)  
2. Claude Code Swarms \- AddyOsmani.com, 访问时间为 二月 24, 2026， [https://addyosmani.com/blog/claude-code-agent-teams/](https://addyosmani.com/blog/claude-code-agent-teams/)  
3. The Complete Claude Code CLI Guide \- Live & Auto-Updated Every 2 Days \- GitHub, 访问时间为 二月 24, 2026， [https://github.com/Cranot/claude-code-guide](https://github.com/Cranot/claude-code-guide)  
4. How Claude Code Agents Actually Talk to Each Other (It's Weirder Than You Think), 访问时间为 二月 24, 2026， [https://medium.com/@skytoinds/how-claude-code-agents-actually-talk-to-each-other-its-weirder-than-you-think-c070b38c28e0](https://medium.com/@skytoinds/how-claude-code-agents-actually-talk-to-each-other-its-weirder-than-you-think-c070b38c28e0)  
5. teammate-tool-implementation.md \- GitHub Gist, 访问时间为 二月 24, 2026， [https://gist.github.com/sorrycc/4702f258f3d505495f4d5d984576a08d](https://gist.github.com/sorrycc/4702f258f3d505495f4d5d984576a08d)  
6. oh-my-opencode/docs/guide/overview.md at dev \- GitHub, 访问时间为 二月 24, 2026， [https://github.com/code-yeongyu/oh-my-opencode/blob/dev/docs/guide/overview.md](https://github.com/code-yeongyu/oh-my-opencode/blob/dev/docs/guide/overview.md)  
7. oh-my-opencode is great, just I think got a bit bloated, so here is ..., 访问时间为 二月 24, 2026， [https://www.reddit.com/r/opencodeCLI/comments/1qdylr7/ohmyopencode\_is\_great\_just\_i\_think\_got\_a\_bit/](https://www.reddit.com/r/opencodeCLI/comments/1qdylr7/ohmyopencode_is_great_just_i_think_got_a_bit/)  
8. Kimi K2.5 vs. GPT-5: Best Open-Source AI Agent Swarm 2026 ..., 访问时间为 二月 24, 2026， [https://vertu.com/lifestyle/kimi-k2-5-vs-gpt-5-the-ultimate-comparison-of-frontier-ai-models/](https://vertu.com/lifestyle/kimi-k2-5-vs-gpt-5-the-ultimate-comparison-of-frontier-ai-models/)  
9. Moonshot Kimi K2.5 \- Beats Sonnet 4.5 at half the cost, SOTA Open Model, first Native Image+Video, 100 parallel Agent Swarm manager | AINews, 访问时间为 二月 24, 2026， [https://news.smol.ai/issues/26-01-27-kimi-k25/](https://news.smol.ai/issues/26-01-27-kimi-k25/)  
10. WideSeek: Advancing Wide Research via Multi-Agent Scaling \- arXiv, 访问时间为 二月 24, 2026， [https://arxiv.org/html/2602.02636v1](https://arxiv.org/html/2602.02636v1)  
11. Claude Code Security and the Future of AI-Driven Cybersecurity ..., 访问时间为 二月 24, 2026， [https://bisi.org.uk/reports/claude-code-security-and-the-future-of-ai-driven-cybersecurity](https://bisi.org.uk/reports/claude-code-security-and-the-future-of-ai-driven-cybersecurity)  
12. Security Lessons from Claude Code's First Year \- Harmonic Security, 访问时间为 二月 24, 2026， [https://www.harmonic.security/resources/security-lessons-from-claude-codes-first-year](https://www.harmonic.security/resources/security-lessons-from-claude-codes-first-year)  
13. For future reference but maybe not. \- gists · GitHub, 访问时间为 二月 24, 2026， [https://gist.github.com/tkersey/e4d9923922d80c065f9d](https://gist.github.com/tkersey/e4d9923922d80c065f9d)  
14. Create custom subagents \- Claude Code Docs, 访问时间为 二月 24, 2026， [https://code.claude.com/docs/en/sub-agents](https://code.claude.com/docs/en/sub-agents)  
15. Claude Code CLI: The Definitive Technical Reference \- Blake Crosley, 访问时间为 二月 24, 2026， [https://blakecrosley.com/en/guides/claude-code](https://blakecrosley.com/en/guides/claude-code)  
16. code-yeongyu/oh-my-opencode: the best agent harness \- GitHub, 访问时间为 二月 24, 2026， [https://github.com/code-yeongyu/oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)  
17. oh-my-opencode \- NPM, 访问时间为 二月 24, 2026， [https://www.npmjs.com/package/oh-my-opencode](https://www.npmjs.com/package/oh-my-opencode)  
18. Anthropic Is Closing Its Ecosystem: Why I'm Staying on Claude Code Anyway, 访问时间为 二月 24, 2026， [https://croustibat.medium.com/anthropic-is-closing-its-ecosystem-why-im-staying-on-claude-code-anyway-39331ae35ea3](https://croustibat.medium.com/anthropic-is-closing-its-ecosystem-why-im-staying-on-claude-code-anyway-39331ae35ea3)  
19. \[Bug\]: TODO Continuation is too aggressive when user interrupts agent · Issue \#577 · code-yeongyu/oh-my-opencode \- GitHub, 访问时间为 二月 24, 2026， [https://github.com/code-yeongyu/oh-my-opencode/issues/577](https://github.com/code-yeongyu/oh-my-opencode/issues/577)  
20. \[Bug\]: The number of iterations is always 1, but it is expected to increase gradually. · Issue \#622 · code-yeongyu/oh-my-opencode \- GitHub, 访问时间为 二月 24, 2026， [https://github.com/code-yeongyu/oh-my-opencode/issues/622](https://github.com/code-yeongyu/oh-my-opencode/issues/622)  
21. fix(ralph-loop): keep LLM in smart zone with fresh context per iteration\#1348 \- GitHub, 访问时间为 二月 24, 2026， [https://github.com/code-yeongyu/oh-my-opencode/pull/1348/commits](https://github.com/code-yeongyu/oh-my-opencode/pull/1348/commits)  
22. Issues \- AINews, 访问时间为 二月 24, 2026， [https://news.smol.ai/issues/](https://news.smol.ai/issues/)  
23. Orchestrate teams of Claude Code sessions, 访问时间为 二月 24, 2026， [https://code.claude.com/docs/en/agent-teams](https://code.claude.com/docs/en/agent-teams)  
24. Compare with Oh My OpenCode · darrenhinde OpenAgentsControl · Discussion \#116, 访问时间为 二月 24, 2026， [https://github.com/darrenhinde/OpenAgentsControl/discussions/116](https://github.com/darrenhinde/OpenAgentsControl/discussions/116)  
25. Anthropic’s Claude Code Security Triggers Flash Crash in Cybersecurity Stocks, 访问时间为 二月 24, 2026， [https://www.trendingtopics.eu/anthropic-claude-code-security-flash-crash-stocks/](https://www.trendingtopics.eu/anthropic-claude-code-security-flash-crash-stocks/)  
26. Claude Code Security Finds the Bugs That Static Analysis Can’t — and Wall Street Noticed, 访问时间为 二月 24, 2026， [https://devops.com/claude-code-security-finds-the-bugs-that-static-analysis-cant-and-wall-street-noticed/](https://devops.com/claude-code-security-finds-the-bugs-that-static-analysis-cant-and-wall-street-noticed/)