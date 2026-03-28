---
feature_ids: []
debt_ids: []
---

# 2026 年企业级 AI Agent Runtime 与 Harness 架构调研

## 研究范围与核心结论

本调研聚焦 **2025 年下半年至 2026 年一季度**（约 2025-07 至 2026-03）的“企业级 Agent Runtime/Harness”新进展，重点围绕你们提出的“默认有状态、可审计、可审批、可恢复、可回放”的 harness 标准去对标业界变化，并有意识回避对 2024 老框架的基础复述。citeturn7view0turn7view1turn6view0turn16view1turn18view3

在这个时间窗内，行业最显著的变化不是“又多了一个 agent framework”，而是 **agent 进入“生产系统形态”的基础设施层开始成型**：  
一边是云厂商与 AI Labs 把“长运行 + 状态边界 + 身份 + 可观测 + 合规接口”打包成 **runtime 平台能力**；另一边是安全、备份、可观测厂商把“看得见、管得住、能撤销、能追责、能回滚”做成 **operator control plane**；同时协议层开始收敛（MCP、A2A、AGENTS.md 进入 Linux Foundation 治理轨道）。citeturn7view1turn7view2turn1search3turn1search7turn19view0turn6view0turn6view1turn18view3

为便于你们评审 harness layer 提案，先给一个“可落地的结论抽象”（已确认事实 + 推测）：

**已确认事实（2025H2–2026Q1 直接证据）：**
- “长运行代理”的核心痛点被明确指向：跨多次 context window 的一致进展、可恢复/可继续、以及可扩展的人类监督，而不是单次推理质量。citeturn7view0turn16view1turn16view2turn16view0  
- “企业级 runtime”开始呈现清晰产品化形态：以 **隔离执行环境（microVM / session isolation）+ 内嵌身份（workload/agent identity）+ 记忆/状态服务（短期/长期）+ 可观测/调试** 为核心组件。citeturn7view1turn1search5turn1search26turn1search28  
- “控制平面（control plane）”成为企业主叙事：注册表/盘点（registry）、访问控制（access control）、可视化关系图与度量（visualization/analytics）、日志与电子取证（logging/e-discovery）、隔离/隔离处置（quarantine）、互操作（interoperability）。citeturn7view2turn2search11turn17search0turn17search1turn4search21  
- 标准化正在从“事实上的采用”走向“治理与中立托管”：entity["organization","Agentic AI Foundation","linux foundation fund"] 在 entity["organization","The Linux Foundation","open source non-profit"] 下成立，公开承接 MCP、Goose、AGENTS.md 等关键构件；A2A 也在 Linux Foundation 运行 project。citeturn1search3turn1search7turn1search22turn1search15turn19view0  
- 可观测/审计正在标准化到 **OpenTelemetry GenAI semantic conventions**：从提出 agentic 系统的语义约定，到主流厂商（例如 Datadog、Microsoft Azure 侧）加入对齐；这为“可审计、可回放、可归因”提供跨供应商共同语言。citeturn1search4turn1search8turn1search16turn1search30  

**趋势判断（推测，但有多源支撑）：**
- 2026 语境里，agent harness 的“最短路径”越来越像 **事件溯源/工作流引擎 + 审计与策略网关 + 标准化工具/代理协议** 的组合，而不是单一框架一把梭。该趋势同时由云厂商 runtime、工作流/耐久执行（durable execution）实践、以及监管（NIST、金融监管）关注点共同推动。citeturn3search1turn3search5turn5search0turn5search1turn5news44turn18view3  
- “validated plan → deterministic execution”开始从论文概念落到工程实验：例如 AWS Strands Labs 的 AI Functions 直接把 **前置/后置条件验证**作为缩小信任缺口的方向；同时 governance-first 协议（OpenPort）把 draft-first、人审、稳定 reason codes、可验证不变量写成规范语言。citeturn12view1turn22search1turn12view0  

下面按你们的 Q1–Q10 需求，将证据密度最高、且确实属于 2025H2–2026 新进展的内容组织成 6 个主题域（每个主题域都包含：动态、趋势、新玩家、建议与风险）。

## 新兴 Agent Runtime 与 Harness 玩家谱系

这一节主要覆盖 Q1（并顺带回答 Q7 的“谁在做 operator 工具”部分），强调 2025H2–2026 新进展与新玩家，而不是 2024 框架名录。

### 企业级 runtime 平台化：从“框架”到“托管执行层”

**entity["company","Amazon Web Services","cloud provider"]：Bedrock AgentCore 的 runtime 化（2025-08）**  
AWS 明确把 agent 部署的关键抽象从“函数/容器”推到“面向 agent 的持久会话执行环境”：AgentCore Runtime 通过 **可持续数小时的 microVM 会话**支持 stateful、多步、异步 agent；并把 **会话隔离**与 **内嵌身份**作为企业安全基线。citeturn7view1turn1search26turn1search28  
同时，AWS 以 AgentCore Memory 把“短期/长期记忆管理”产品化，强调“对 agent 记住什么仍由开发者控制”，避免把记忆完全黑盒化。citeturn1search5turn23image7  

**AWS 开源侧的“harness 标准化尝试”在 2025-11 之后明显加速：**  
- Strands Agent SOPs（2025-11-20）把“可靠性 vs 灵活性”收敛到一种 **半确定性（文中称 determin-ish-tic）**的 SOP 规范：用 RFC 2119（MUST/SHOULD/MAY）表达约束，并把 **进度记录与可恢复**写入 SOP 能力点，直接对齐你们的“可回放/可恢复/可审批”叙事。citeturn12view0  
- Strands Labs（2026-02-23）将实验性 agent 基建独立成组织，并提出 AI Functions：用自然语言定义 agent，再用 Python 写前置/后置条件去验证行为，明确目标是“缩小生成代码的信任缺口”。这属于 2026 非常关键的“validated intent → constrained execution”方向证据。citeturn12view1  

**entity["company","Microsoft","software company"]：Agent 365 把“控制平面”正式产品化（2025-11-18）**  
Microsoft 用“像管理员工一样管理 agent”的叙事，把 registry、权限、可视化关系图、互操作、安全与合规（含日志与 e-discovery）打包为 Agent 365。它的信号是：企业问题被定义为“agent sprawl + governance”，而不是“选哪个 agent 框架”。citeturn7view2turn2news40turn23image6  
并且 Microsoft 在 2026-02 继续把 agent identity（Entra Agent ID/Registry）作为控制平面的基础设施组件强调出来，说明“agent 身份”正在从应用层上移到平台层。citeturn2search11turn2search26turn24search10  

**entity["company","Anthropic","ai lab"]：从“agent demo”转向“长运行 harness 设计学”（2025-11-26）**  
Anthropic 明确把 long-running agents 的核心问题定义为：agent 必须跨多个离散 session 工作，而每个 session 先天“无记忆”；因此 harness 需要像交接班一样产出可继承的 artifacts，并使用 initializer agent + coding agent 的分工来启动与持续推进。citeturn7view0turn16view2  
这不仅是框架能力，更是“生产级 harness 的方法论化”，非常贴合你们提出的“默认可恢复、可回放”的标准。citeturn7view0  

**entity["company","Google","tech company"]：ADK + A2A 把“多 agent 与互操作”当成平台能力（2025）**  
Google Cloud 的 ADK（Agent Development Kit）定位为开源、模块化的 agent 开发/部署框架，并强调“像软件工程一样开发 agent（含调试与评估）”。citeturn1search2turn1search10  
更关键的是 A2A：Google 在 2025-04 宣布 Agent2Agent 协议，直接覆盖“agent 之间安全协作、长运行任务、任务对象与 artifact 输出”等生产问题，并在 2025-06 进入 Linux Foundation 项目治理。citeturn19view1turn19view0turn19view2  

### 大厂/AI Labs 孵化的“新项目进入中立治理”：AAIF

在 2025-12，一个高度标志性的事件是：entity["company","OpenAI","ai lab"]、Anthropic 与 entity["company","Block","fintech company"] 共同在 Linux Foundation 下成立 AAIF，并捐赠三类关键构件：  
- Anthropic 的 MCP（工具与上下文连接协议）  
- Block 的 Goose（开源 agent 框架）  
- OpenAI 的 AGENTS.md（给 coding agents 的项目级指令文件标准）citeturn1search3turn1search7turn1search22turn1search15turn2search4turn2search16  

这对企业 harness 的意义是：  
协议/约定正在从“某一家 SDK 的 feature”变成“多方可共同演进的基础设施层”，你们做 harness layer 时可以更大胆地把“协议兼容/协议扩展点”当成设计中心，而不是只围绕某个框架的 runtime API。citeturn6view0turn6view1turn19view0  

### YC 与新创：agent infra 开始围绕“生产痛点”切分

你们要求“主动找 2025H2–2026 的新创公司”，在 YC 与近期融资里，比较贴合 harness/runtime 的新玩家主要集中在 4 类：

**工作流/编排层（把人审/审批/上下文路由做进流程）**  
- entity["company","Trace","yc s2025 workflow orchestration"]（YC S2025）把自己定义为“给 agent 的上下文与人机协同流程编排平台”，强调把任务在“AI 与人”之间路由，并给 agent 提供跨系统共享上下文。citeturn14search0turn13search3  

**MCP 生产化基础设施（把 OAuth、Docker、可观测等‘集成苦活’托管掉）**  
- entity["company","Metorial","yc f2025 mcp infra"]（YC F2025）直指 MCP server “本地好用、上生产痛苦”，尤其是 Docker 配置、OAuth 流程、缺乏可观测。这个定位本质上就是你们 harness layer 里“工具面”的生产化。citeturn18view0  

**浏览器/计算机使用（Computer Use）执行底座（隔离 + 回放 + 人接管）**  
- entity["company","Kernel","yc s2025 browser infra"]（YC S2025）把“浏览器基础设施”抽象为 API：强调隔离 VM、live view & replay、会话复用、以及把 agent 变成可调用 endpoint——这类能力天然需要“可回放/可接管”的 harness。citeturn18view1  

**可观测/回放调试（debug/replay 作为卖点，而不仅是 tracing）**  
- entity["company","Laminar","yc s2024 agent observability"] 在 YC 目录里明确把“trace、replay/debug、异常检测”写进 agent observability 定位，这与 Q3/Q4 高度对齐。citeturn14search5turn14search21  
- entity["company","Emdash","yc w2026 agentic dev env"]（YC W2026）把“并行多 coding agents + 隔离工作区”做成桌面 ADE，解决多人/多 agent 并发带来的分支混乱；间接反映“多 agent 并发”已成为真实生产问题，而不仅是概念。citeturn14search3turn14search7turn14search11  
- entity["company","Cascade","yc w2026 agent reliability"]（YC W2026）直接以“autonomous intelligence 的安全与可靠性基础设施”为定位，属于“把可靠性当成模型外部系统工程”的新玩家。citeturn14search2turn14search18  

**建议方向与风险（对应 Q1）：**  
建议你们把“新 framework 名单”降权，把评估重点放在以下“可迁移能力面”：
1) **执行隔离与状态边界**（session/microVM/identity 边界）是否可证明、可配置、可审计。citeturn7view1turn1search28  
2) **长运行与异步**是否是一等公民（task handle、polling、resume、human checkpoint）。citeturn6view0turn6view1turn12view0turn19view1  
3) **控制平面接口**是否存在（registry、policy、quarantine、e-discovery、approval）。citeturn7view2turn2search11turn4search21  

主要风险是：很多“新玩家”的卖点与平台能力高度重叠，容易出现 **治理面碎片化**（每个 agent/每个工具各自做审计与审批），形成你们要避免的“不可统一证明”。citeturn7view2turn22search1  

## 企业级 Agent 架构实践的新范式

本节覆盖 Q2（并部分覆盖 Q9）。核心是：2025H2–2026 的企业实践正在把 agent 重新当成一种“分布式系统工作负载”，因此架构重心从“链式调用”转向“状态、身份、并发、治理、恢复”。

### 从“单次对话应用”到“长运行、多会话、多代理系统”

Anthropic 的 2026 趋势报告明确预测：单 agent 向协同 agent 团队演进，任务跨度从分钟扩大到天/周，并且人类监督将从“审每一步”转向“审关键点”。这与大型企业内部的实践判断高度一致：真正能扩展的是**监督能力与可追责证据链**。citeturn16view1turn16view2turn16view3turn15view0  

AWS 与 Microsoft 的产品化动作则把这一趋势落到了基础设施层：  
- AWS 用“可持续 8 小时的 agent 会话 microVM + Memory 服务”把“跨调用状态”从应用层外置成平台能力，降低了“自建状态存储 + 自建隔离”的门槛。citeturn7view1turn1search5  
- Microsoft 明示“registry 防止 agent sprawl”，并强调可视化 agent-用户-资源关系图、合规日志、e-discovery，体现“企业真正怕的是不可见的 agent 扩散”。citeturn7view2turn2news40  

### regulated 行业的新关注点：从“模型风险”转向“代理行为风险”

在 2026-02，entity["organization","美国国家标准与技术研究院 NIST","us standards agency"]（其 CAISI）发布 AI Agent Standards Initiative，并在 2026-01 发出“如何确保 AI agent 系统安全”的 RFI，问题覆盖 agent 系统独特威胁、测量方法、以及现有网络安全方法的适用性与缺口。这个信号非常强：监管与标准机构正在把 agent 视为独立风险对象，而不是 LLM 的附属。citeturn5search0turn5search1turn5search5  

金融监管侧也出现了“agentic AI 的新风险”报道：英国银行在推进 agentic AI 试点时，英国 entity["organization","Financial Conduct Authority","uk financial regulator"] 指出其速度与自主性会放大金融稳定与治理风险，并倾向通过现有制度框架追责。citeturn5news44turn5news45  
美国自律监管机构 entity["organization","Financial Industry Regulatory Authority","us self-regulator"]（FINRA）发布 2026 监管关注报告，把 GenAI 与网络安全风险并列为 2026 重点议题之一。citeturn5search3turn5search30  
此外，2025–2026 的审计与管理体系标准也在补齐：例如 entity["organization","International Organization for Standardization","standards body"] 发布的 ISO/IEC 42006:2025 明确面向 AI 管理体系审核与认证的一致性要求；英国 entity["organization","British Standards Institution","uk standards body"] 也在推动 AI 审计服务的标准化，意图约束“AI assurance 野蛮生长”。citeturn5search18turn5news47  

**建议方向与风险（对应 Q2/Q9）：**  
你们评估企业级 harness 架构时，可以把 2026 的“新范式”总结为三条硬约束：

- **把 agent 当成“特权 API 客户端 + 长运行工作流”来治理**：必须先有身份、权限最小化、撤销、审计，再谈自治。citeturn7view1turn7view2turn22search1turn5search1  
- **把人类审批当成系统吞吐问题**：不是“加一个 HITL 按钮”，而是要能规模化地让人审只出现在高风险写入/关键决策点。citeturn16view3turn7view2turn12view0turn22search1  
- **把可恢复/可回放当成事故响应能力**：当 agent 触发不良副作用时，需要“精确回滚/撤销”的能力，而不是整库恢复或人工排查。citeturn4search9turn4search21turn3search1  

风险在于：如果 harness layer 只做“应用内日志与中断”，在监管/审计语境里往往不足以形成可验证证据（尤其是跨系统写入与跨云/跨 SaaS 的代理链路）。citeturn5search0turn22search1  

## Audit Trail 与 Event Sourcing 的最新实践

本节覆盖 Q3，并与 Q7（observability/control plane）强相关。这里不再停留在“需要审计”口号，而是强调：2025H2–2026 的变化是 **审计语义开始标准化 + 防篡改/可验证审计开始产品化**。

### 语义标准化：OpenTelemetry 正在成为 agent 可观测的共同语言

2025-08 的 OpenTelemetry 社区提案明确面向“GenAI agentic systems”的语义约定，试图标准化对 task、action、agent、artifact、memory 等对象的 tracing/metrics 表达，以提升可追踪性与可复现。citeturn1search4  
随后的 OTel GenAI semantic conventions 文档，进一步把 GenAI 相关语义纳入规范化轨道。citeturn1search8turn1search23  

更关键的是“生态跟进”：  
- entity["company","Datadog","observability company"] 在 2025-12 宣布其 LLM Observability 原生支持 OTel GenAI semantic conventions（v1.37+），强调一次 instrumentation，多处消费。citeturn1search16  
- Microsoft（Azure AI Foundry 团队）在 2025-10 也公开讨论并推动针对 GenAI agent/framework spans 的语义扩展，体现大厂在把 agent observability 纳入 OTel 体系。citeturn1search30  

对你们的 harness layer 来说，这意味着：**audit trail 的数据模型不必完全自造**，可以对齐 OTel 语义并在内部加密/签名与 retention。citeturn1search4turn1search16  

### 防篡改与可验证：从“合规建议”走向“工程化组件与新产品”

2025-10，entity["company","Confluent","data streaming company"] 公开讨论用 hash chaining 形成可篡改检测的审计链（每条记录包含前一条 hash），以提供更高的合规保证；这类模式在 agent 场景中天然适用，因为 agent 的工具调用/写入行为需要完整链路证据。citeturn4search19  

2026-02 的学术/工程规范方向也出现“把治理写成协议”的新尝试：OpenPort Protocol（arXiv 2026-02-22）将安全治理定义为协议层语义：授权依赖的工具发现、稳定的 reason codes、draft-first 写入、人审、幂等、速率限制语义、以及结构化审计事件，甚至强调这些要求应可通过黑盒测试验证。citeturn22search1turn22search0  
其中对审计也提出了明确工程边界：审计 sink 需要 append-only 与 durable（例如 WORM 或外部 SIEM 管道），并建议事件签名或 hash chaining 来使篡改可检测。citeturn20view0turn22search1  

产品侧，2026-02 出现“把 agent 行为 timeline 化 + 支持撤销”的新类别：  
- entity["company","Veeam","data resilience company"] 与 entity["company","Securiti AI","ai governance company"] 推出 Agent Commander，主卖点是“看见每个 agent 动作时间线 + 精确回滚 Undo AI”。这把审计与恢复直接耦合成一个 operator 产品。citeturn4search2turn4search9turn4search21  

此外，社区也开始出现更“窄但硬”的审计工具：例如提供加密签名回执、可离线验证的审计封装（属于早期新创/开源形态），反映市场对“可验证审计”有真实需求。citeturn4search11turn4search0  

**建议方向与风险（对应 Q3）：**  
对你们的 harness layer，推荐把审计拆成三层来设计：

- **语义层**：尽可能对齐 OpenTelemetry GenAI semantic conventions（span/event/attribute），保证跨 vendor 可迁移、可关联。citeturn1search4turn1search16turn1search30  
- **证据层**：对关键决策与写入行为构建“不可抵赖证据”——至少 hash chain + 外部锚定（WORM/SIEM/ledger），并明确哪些内容应被 redaction（避免把高熵敏感片段写入不可变审计）。citeturn4search19turn20view0turn22search1  
- **取证层**：为审计/法务/安全运营提供可导出、可复查、可重放的“evidence pack”（包含版本、配置、执行历史与批准链）。OpenPort 对“可验证不变量”的强调值得借鉴。citeturn22search1turn7view2  

主要风险：  
- **“日志很多 ≠ 可审计”**：如果缺少稳定语义、缺少完整性保护与 retention 策略，日志在监管场景里可能无法被接受。citeturn5search0turn5news44turn22search1  
- **把敏感数据写进不可变审计** 会引入新的合规负担（尤其跨境、医疗、金融）。OpenPort 明确建议将操作调试日志与不可变审计 sink 分离。citeturn20view0turn22search1  

## Checkpoint、Resume 与 Replay 的最新实践

本节覆盖 Q4，并与 Q3（event sourcing）高度耦合。2025H2–2026 的新特点是：**replay 不再只是开发者调试功能，而是恢复与合规证据链的核心机制**。

### Durable Execution 进入 agent 主流叙事：Temporal 把“确定性 + 回放”当成产品卖点

entity["company","Temporal","durable execution company"] 在 2025-11 的文章里用非常直白的方式解释 agent durable execution：**工作流的确定性执行使得崩溃恢复时可以 replay 事件历史，而不会重新向模型要“已做过的决策”**；非确定性的 LLM/tool 调用作为 Activities 执行一次并记录结果。citeturn3search1turn3search5  
这类分层，几乎就是你们想要的“可恢复、可回放”的工程化实现：把“认知/探索”的不确定性封装在可记录的 side effects 中，把“编排/推进”放到 deterministic 的状态机里。citeturn3search5  

Temporal 在 2026-01 继续强化“为 agent 提供生产级耐久性”的叙事（与 Vercel AI SDK 集成），反映 durable execution 正在成为 agent runtime 的常见底座选项。citeturn3search21turn3search9  

### 协议层的异步与可续：MCP 的 Tasks 与流式恢复

MCP 2025-11-25 版本更新引入实验性的 Tasks primitive，用于“可跟踪的耐久请求”：请求可立即返回 task handle，随后轮询/订阅获取结果；并且在 roadmap 中明确把“异步操作”作为为企业规模部署补齐的能力。citeturn6view0turn6view1turn6view2  
同一版本还增强了 SSE/stream 的 polling 与 resumption 语义，说明 MCP 正在把“长任务不中断/可恢复”写进协议层细节。citeturn6view0turn6view1  

这对你们的 harness layer 有两个直接启示：  
- checkpoint/replay 不必完全框架内实现，协议层也在向“可续任务”靠拢；  
- 如果你们未来要兼容 MCP 生态，“任务句柄 + 可续流”应当是核心抽象之一。citeturn6view0turn6view2  

### Runtime 平台的“会话态”与“可持续状态”：AWS 的 microVM session + Memory

AWS AgentCore Runtime 把“会话态”做成可持续 microVM（最长 8 小时），在 session 内保留本地状态/文件，并通过 AgentCore Memory 把跨 session 的持久记忆外置。citeturn7view1turn1search5  
同时，AWS 文档明确强调 session isolation 的安全意义（隔离计算/内存/文件系统，结束后清理），这本质上是“checkpoint 的边界条件”：哪些状态可以依赖 session 存活，哪些必须进入外部耐久存储。citeturn1search26turn1search28  

### 从“恢复进程”到“撤销副作用”：精确回滚成为新类别卖点

Veeam/Securiti 的 Agent Commander 把“undo AI”做成产品化能力，宣传点是“精确回滚 agent 的不良更改，而不是系统级大回滚”。这等价于：将 agent side effects（尤其写入行为）可定位、可反演、可在 operator plane 一键执行。citeturn4search9turn4search21turn4search2  

**建议方向与风险（对应 Q4）：**  
建议你们把 checkpoint/resume/replay 的设计目标从“调试便利”升级为三类工业能力：

- **崩溃恢复（crash recovery）**：以 workflow/event history 支撑 deterministic replay（Temporal 路线是最明确的工业样板）。citeturn3search1turn3search5  
- **长任务可续（long-running continuation）**：以 task handle + polling/subscription（MCP Tasks/A2A task 对象）承载跨小时/跨天流程。citeturn6view0turn19view1turn19view2  
- **副作用可撤销（side-effect rollback）**：把“写入影响范围”与“可逆操作”纳入执行模型（Agent Commander 给了一个 2026 的产品化方向）。citeturn4search21turn4search9  

主要风险：  
- many-step agent 的“回放”如果没有稳定的 tool contract 与幂等语义，会导致 replay 过程产生二次副作用；OpenPort 把 idempotency、draft-first、preflight binding 写成协议语义，就是对这一风险的直接回应。citeturn22search1turn22search0  

## Deterministic Execution 的新进展与工程路径

本节覆盖 Q5（并关联 Q4/Q3）。你们问的核心是“validated plan → deterministic execution”在 2025H2–2026 有没有新进展：答案是 **开始出现把‘验证’写进系统结构的实践**，但主流仍是“半确定性 + 可审计 + 可回放”路线，而非完全确定。

### 半确定性成为主流工程妥协：SOP、reason codes、以及“稳定失败语义”

AWS Strands Agent SOPs 的设计初衷是解决“提示词复杂、行为不一致、难以迭代”的生产痛点：用标准化 Markdown + RFC 2119 关键词约束步骤，同时强调“进度跟踪与可恢复”，以提高可预测性。citeturn12view0  
OpenPort 协议同样强调“稳定的机器可行动 reason codes”与“可外部验证的不变量”，目标是让客户端恢复与事故分析变得确定（deterministic client recovery）。citeturn22search1turn22search0  

这两条证据共同指向 2026 的一个现实：企业要的往往不是“模型输出完全确定”，而是 **系统行为在治理层面确定**——可验证、可回放、可追责、可撤销。citeturn12view0turn22search1turn5search0  

### “验证驱动的执行”开始进入实验系统：AI Functions 与前后置条件

Strands Labs（2026-02-23）提出 AI Functions：让开发者用自然语言写 agent，再用 Python 写 pre/post conditions 去验证行为，并明确说这是为了缩小信任缺口，把开发者时间聚焦在“如何验证意图”。这是 2026 非常值得你们重点对标的“validated intent → constrained execution”路径。citeturn12view1  

### 结构化生成与约束解码：从“prompting”走向“可验证输出”

在结构化生成工具链上，2025H2 有两个值得注意的事实点：

- PydanticAI 在 2025-09 达到 V1，并公开把 Human-in-the-Loop tool approval 与 Durable Execution 写成一等能力点；这意味着“类型/Schema + 审批 + 耐久执行”正在被封装成 agent framework 的核心卖点，而不是附加模块。citeturn8search11turn8search15turn8search23turn8search35  
- guidance-ai 的 llguidance 明确以“constrained decoding/structured outputs”为目标，通过 grammar 约束输出，降低解析不确定性；同时 Guidance 2025-09 的 release notes 也强调对 JSON/structured output 的支持扩展。citeturn8search2turn8search18turn8search8  

反面信息也同样重要：LMQL 的 GitHub releases 显示其最近版本仍停留在 0.7.x（2023-10），在 2025H2–2026 的“企业 harness 化”浪潮里，LMQL 并没有呈现同步演进的信号——这意味着你们如果要押注工具链，应该更倾向选择仍在活跃迭代、且与耐久/审批/可观测整合更紧的路线。citeturn9view0turn8search11  

**建议方向与风险（对应 Q5）：**  
建议你们把 deterministic execution 的目标拆成两层：

- **治理层确定性（必须做）**：稳定的失败语义、幂等与 draft-first 写入、审批链、审计证据链、回放与恢复。OpenPort 与 SOP 的方向都在证明这条路更贴合企业现实。citeturn22search1turn12view0turn5search1  
- **输出层确定性（可选做）**：对关键结构化输出使用 schema + constrained decoding（或强校验重采样），把不确定性压缩到“可检测并可回退”的范围。citeturn8search2turn8search8turn8search18  

最大的风险是“伪确定性”：如果你们把 deterministic 只理解成“temperature=0 + JSON schema”，在涉及工具写入、长运行、人审延迟的场景里仍会被 TOCTOU（检查与使用时差）、重试、副作用重放击穿；OpenPort 特别把这些列为协议要解决的问题，值得对标。citeturn22search1turn22search0  

## Context 生命周期管理、Operator Control Plane 与标准化收敛

这一节同时覆盖 Q6、Q7、Q8，并补充 Q10 的“你们没问但该知道的”。

### Context Lifecycle：从“压缩/总结”升级为“可追溯的上下文装配流水线”

2025H2–2026 的 context 管理不再只是 summarization，而是出现三类更工程化的落点：

1) **平台级 Memory 服务**：AWS AgentCore Memory 以短期/长期记忆抽象把“跨 session 上下文”产品化，并强调开发者对记忆内容的控制权。citeturn1search5turn7view1  
2) **harness 方法论（artifact 交接）**：Anthropic 把跨 session 的一致进展定义为核心难题，并提出 initializer/coding agent 分工与 artifacts 留存的 harness 设计。citeturn7view0turn16view2  
3) **可追溯语义（provenance）**：OpenTelemetry 的 agentic 语义尝试把 memory/artifact 纳入 tracing 语义；这为“context provenance（上下文来源解释）”提供可标准化的埋点空间。citeturn1search4turn1search8  

此外，MCP roadmap 明确提出“Server Identity、.well-known 元数据与 agent cards”的方向，意图提高能力发现与规模化部署体验，这实际上也在为 context assembly 的“来源与能力声明”提供基础设施。citeturn24search2turn6view1turn19view2  

### Operator Control Plane：2026 的新“必备层”正在形成

你们问“CLI vs Dashboard vs API”的趋势，2025H2–2026 的事实是：**control plane 正在从“开发者工具”迁移为“企业运营中心”**。代表性证据包括：

- Microsoft Agent 365：把 registry、access control、可视化关系图、性能度量、日志与 e-discovery 纳入统一平面，并提出隔离/处置 unsanctioned agents。citeturn7view2turn2news40  
- entity["company","Veza","identity security company"] 在 2026-02 发布“Enterprise Agent Identity Control Plane”叙事，把 AI agent 与非人身份（NHI）治理纳入身份安全平台，并强化对第三方 agent/LLM/AI infra（包含 MCP）的可见性与控制。citeturn17search5turn17search12turn4search6turn4search18  
- entity["company","Fiddler AI","ai observability company"] 在 2026-01 的 Series C 新闻稿里把自己定位为“AI agents 的 control plane（visibility/context/control）”，说明资本市场也在把 control plane 当成独立类别。citeturn17search1turn17search8turn17search22  
- entity["company","New Relic","observability company"] 在 2026-02-24 发布 Agentic Platform，主打“no-code 构建与治理 AI agents（面向 observability/SRE 场景）”，并提到对 MCP 的支持，说明 control plane 正在被更多传统 APM 厂商吸收为产品线。citeturn17search0turn17search3turn17search16  
- Veeam/Securiti Agent Commander 将“detect/protect/undo AI”合在一个 operator 产品里，突出“时间线 + 精确回滚”。citeturn4search21turn4search9  

**趋势判断（Q7）：**  
2026 的 operator 平面形态更像 “Dashboard + Policy API + Evidence Export”，CLI 仍会存在，但更多用于部署与本地调试；而生产治理一定会要求可审计的 UI/审批流与系统集成接口（SIEM、IAM、ITSM）。这一判断由 Agent 365 的 admin center 形态、New Relic 的 no-code builder、以及 OpenPort 对 admin plane 的强调共同支撑。citeturn7view2turn17search0turn22search1  

### 协议与标准化：MCP、A2A 与 AGENTS.md 在 2025H2–2026 的关键跃迁

**MCP 的“企业化拐点”在 2025-11-25**：  
这一版 changelog 里最影响 harness 的更新包括：  
- OIDC discovery、增量 scope consent、OAuth 客户端注册机制调整（CIMD），加强“企业授权可操作性”；  
- Tasks（实验）与 SSE resumption，补齐“长任务可续”；  
- governance 结构与 working groups、SDK 分级，说明 MCP 开始按标准组织方式演进。citeturn6view0turn6view2turn6view1  
WorkOS 对该版本的解读强调“year two starts with fewer hacks and more infrastructure”，可视为业界对 MCP 走向生产化的旁证。citeturn6view2turn6view0  

**A2A 的关键点是“任务对象 + Agent Card + 长运行”**：  
A2A 从 Google 2025-04 宣布，到 2025-06 进入 Linux Foundation，再到 2025-11 出现更完善的 spec（含 agent-card.json、extensions header、long-running task 支持），体现一个完整协议成熟路径。citeturn19view1turn19view0turn19view2  
并且 AWS 文档也把 Agent Cards 作为 A2A 生态自动发现的基础元数据，这意味着云厂商正在把 A2A 当作可部署的生产能力，而不是纯概念。citeturn24search0turn19view2  

**AGENTS.md 的“可预测性”价值**：  
Linux Foundation 的 AAIF 新闻稿明确将 AGENTS.md 描述为使 coding agent 在不同 repo/toolchain 中更可预测的通用标准；agents.md 官方站点也将其类比为 “README for agents”。citeturn2search16turn2search4  

**建议方向与风险（对应 Q6/Q7/Q8）：**  
- 建议你们把 harness layer 的“互操作底座”明确对齐 **MCP（工具/上下文）+ A2A（代理协作）+ OTel（可观测语义）+ AGENTS.md/SOP（指令与流程约束）** 四件套，避免自造封闭生态。citeturn6view0turn19view1turn1search16turn2search16turn12view0  
- 风险是协议仍在快速演进：例如 MCP roadmap 更新频率与社区 issue 已提示 roadmap 可能滞后于规范发布；你们需要为协议升级留“兼容层”和“版本协商”。citeturn24search6turn6view0turn19view2  

## 企业采用的最新障碍与突破，以及你们没问但必须关注的趋势

本节覆盖 Q9 与 Q10，尽量给“2026 新闻感”的增量信息。

### 新障碍：agent-speed 工作负载正在击穿传统企业基础设施假设

entity["company","Andreessen Horowitz","venture capital firm"] 在 Big Ideas 2026（2025-12-09）提出“agent-native infrastructure”叙事：企业后端是为 human-speed、低并发、可预测流量设计的，而 agent 会触发递归 fan-out、burst、海量并发；对传统系统像 DDoS；瓶颈变成 coordination（routing、locking、state management、policy enforcement）。citeturn18view3turn13search0  

这与 Microsoft “agent sprawl”治理、AWS “会话隔离 + 长任务”、以及 NIST 对 agent 系统安全/互操作的标准化动作形成闭环：企业新障碍不是“模型不够强”，而是 **系统规模与风险形态改变**。citeturn7view2turn7view1turn5search0turn5search1  

### 新突破：控制平面 + 可撤销执行，让“上生产”终于像工程而不是玄学

2026-01/02 的一连串发布（Agent Commander、Veza agent identity control plane、New Relic agentic platform、Fiddler control plane 融资）共同指向一个突破：企业开始拥有一套更完整的“生产闭环”（inventory → policy → observe → approve → recover/undo）。citeturn4search21turn17search5turn17search0turn17search1  

同时，NIST 在 2026-02 把 agent 标准化提上日程、并在 2026-01 发出公开 RFI，也提高了企业对“auditability/controllability”的刚性需求：这不再是“最佳实践建议”，而是“未来可预期的合规门槛”。citeturn5search0turn5search1turn5search5  

### 失败教训正在浮现：完全自治不是主流，关键是“把人类注意力做成可扩展资源”

Anthropic 2026 趋势报告指出：开发者虽在约 60% 工作中使用 AI，但“完全委派”比例仍只有 0–20%；并强调有效协作需要 setup、监督、验证与人类判断，尤其是高风险任务。citeturn16view0turn15view0turn16view3  
这与“人审/审批必须可扩展”的系统设计方向一致：如果 harness layer 设计没有把人类监督吞吐当成一等问题，企业会在规模化时被流程瓶颈拖死。citeturn12view0turn7view2turn22search1  

### 你们可能没问但该纳入提案评审的三件事（Q10）

**安全治理协议化（governance-first protocols）正在出现**  
OpenPort 这种“把 draft-first、审批、审计、幂等、稳定失败语义写成协议”的路线，可能会在 2026–2027 成为企业工具接入层的新范式（类似当年 OAuth/OpenID 的地位）。即便你们不采用 OpenPort，本质思想——“可验证不变量 + 黑盒一致性测试”——非常适合用来定义你们 harness layer 的验收标准。citeturn22search1turn5search0  

**Agent Card 与 .well-known 元数据会成为互操作与资产盘点的关键机制**  
A2A spec 已有 agent-card.json 与 well-known URI 的注册内容；MCP roadmap 也提到 server identity 与 agent cards 协同。对企业来说，这意味着 agent/tool 不再只是内部对象，而是“可被发现、可被登记、可被策略绑定”的网络资产。citeturn19view2turn24search2turn19view0turn24search0  

**“Undo AI”正在成为新一代可靠性目标**  
传统可靠性（比如重试、容灾）解决的是“系统不可用”；而 agent 带来的新问题是“系统可用但做错了事并产生副作用”。Agent Commander 把“精确撤销”做成核心卖点，说明行业在把恢复目标从“恢复服务”升级为“恢复业务状态”。你们的 harness layer 如果能原生表达“副作用域 + 可逆操作 + 审批链”，会非常贴合 2026 的真实痛点。citeturn4search21turn4search9turn22search1