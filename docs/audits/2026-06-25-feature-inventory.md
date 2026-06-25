# Cat Café Feature Inventory

> **盘点日期**：2026-06-25  
> **盘点人**：Landy + 宪宪 (Claude Opus 4.6)  
> **范围**：F001–F248 全量特性，按能力域分桶  
> **说明**：Cat Café 是一个多 AI Agent 协作平台，支持 Claude / GPT / Gemini 等多模型作为协作伙伴，通过 Web Hub、CLI、IM 多渠道与用户交互。以下是系统迄今积累的全部特性清单。

---

## 目录

1. [记忆系统 (Memory)](#1-记忆系统-memory)
2. [评估与质量保障 (Eval & QA)](#2-评估与质量保障-eval--qa)
3. [可观测性与诊断 (Observability)](#3-可观测性与诊断-observability)
4. [治理与工程纪律 (Governance)](#4-治理与工程纪律-governance)
5. [多 Agent 协同 (Multi-Agent)](#5-多-agent-协同-multi-agent)
6. [前端与 Hub 交互 (Frontend & UX)](#6-前端与-hub-交互-frontend--ux)
7. [语音与多模态 (Voice & Multimodal)](#7-语音与多模态-voice--multimodal)
8. [平台接入与 IM 网关 (Platform & IM Gateway)](#8-平台接入与-im-网关-platform--im-gateway)
9. [插件与架构框架 (Plugin & Architecture)](#9-插件与架构框架-plugin--architecture)
10. [安全与认证 (Security & Auth)](#10-安全与认证-security--auth)
11. [运行时与基础设施 (Runtime & Infrastructure)](#11-运行时与基础设施-runtime--infrastructure)
12. [游戏与互动体验 (Games & Interactive)](#12-游戏与互动体验-games--interactive)
13. [开源与社区 (Open Source & Community)](#13-开源与社区-open-source--community)
14. [引导与个性化 (Onboarding & Personalization)](#14-引导与个性化-onboarding--personalization)
15. [数量统计](#15-数量统计)

---

## 1. 记忆系统 (Memory)

> Agent 如何跨会话保留知识、组织知识、以及在需要时高效召回。

| F# | 名称 | 说明 |
|----|------|------|
| F003 | Hindsight-Lite 显式记忆 | 最早的跨会话记忆能力——Agent 将关键信息主动写入持久化索引，下次对话时可检索 |
| F016 | Codex OAuth + 记忆闭环 | 让云端 Codex Agent 也能读写共享记忆库，打通本地与云端的知识通道 |
| F065 | Session Continuity 会话延续 | 单个 Agent 会话结束后，新会话能自动加载上一轮的核心上下文，避免"失忆重来" |
| F102 | 记忆适配器重构 | 将记忆层抽象为 `IEvidenceStore` 接口 + 本地索引引擎，支持多种后端存储 |
| F152 | Expedition Memory 远征记忆 | 当 Agent 在外部项目工作时，自动建立该项目的知识冷启动包，经验可回流到主库 |
| F163 | Memory Entropy Reduction | 记忆库的信息熵会随时间增长而退化——引入知识生命周期管理，自动降级/归档过时知识 |
| F169 | Agent Memory Reflex | 让 Agent 对愿景文档形成条件反射式记忆——遇到相关问题时自动关联愿景约束 |
| F186 | 图书馆架构 Library Architecture | 多域知识联邦——按领域分库，每个库有独立的索引、版本和消费权重 |
| F188 | Library Stewardship | 图书馆的持续维护策略——知识如何入库、校验、更新、淘汰的完整生命周期 |
| F200 | Memory Recall Eval | 基于 Agent 真实对话行为评估记忆系统的召回率和精确度，形成反馈闭环 |
| F209 | Evidence Recall Optimization | 消息级语义索引 + 实体门牌号（精确锚点检索）+ 活查询订阅（相关知识自动推送） |
| F227 | Event Memory 事件记忆 | 将关键事件（决策转折、紧急中断、认知状态变化）作为一等公民编入记忆索引 |
| F236 | Anchor-First Context 入口 | MCP 工具返回的数据改为"指针+预览"模式，全文按需加载，降低上下文 token 消耗 |
| F242 | Code Graph Layer | 内生的代码约定关联图——自动发现项目内文件间的约定关系（而非仅靠语法依赖） |
| F243 | Docs Discovery Profile | 给每份文档加结构化元数据（类 OKF），生成可渐进探索的知识入口索引 |

---

## 2. 评估与质量保障 (Eval & QA)

> 如何验证 Agent 行为是否正确、harness 规则是否生效、系统是否退化。

| F# | 名称 | 说明 |
|----|------|------|
| F025 | 可靠性工程 | 为核心状态机编写形式化规格，引入并发竞态演练，关键操作加证据闸门 |
| F067 | Cold-start Verifier | 在零历史污染的干净环境中验证交付物是否可用——防止"仅在开发者机器上能跑" |
| F125 | Alpha 验收通道 | 正式的隔离测试环境（独立端口），已合入主干的改动在此做端到端验收 |
| F192 | Socio-Technical Harness Eval | 对整个团队治理 harness 的有效性做持续评估——包括规则执行率、行为退化检测 |
| F234 | Harness Sunset 验证 | 用控制实验方式验证某条 harness 规则是否真有效果——"不加这条规则会怎样" |
| F244 | Capability Tips System | 当 Agent 处于等待态时，向用户推送"你可能不知道的系统能力"——Knowledge Feed |
| F245 | Friction Signal Eval | 摩擦信号统一聚合评估——从多个来源（用户反馈/Agent 日志/遥测）识别体验摩擦点 |
| F248 | Eval Hub 人类可读性 | 评估面板的信息对人类不可读——重写 verdict 结论为自然语言，修复归因面板交互 |

---

## 3. 可观测性与诊断 (Observability)

> 让运维和用户看得见系统在干什么、资源花了多少、哪里出了问题。

| F# | 名称 | 说明 |
|----|------|------|
| F008 | Token 预算可观测 | 实时展示每个 Agent 会话的 token 消耗、剩余预算和深度分析 |
| F009 | tool_use / tool_result 显示 | 在聊天界面中透明展示 Agent 的工具调用过程和结果 |
| F013 | 审计日志 v2 | 全量操作审计，支持按时间/Agent/操作类型查询 |
| F019 | 动态累积计时器 | 实时显示当前操作链的已耗时间 |
| F045 | NDJSON 可观测性 | 对 CLI Agent 的事件流做全量解析，多 Agent 行为透明化 |
| F051 | Quota Board 用量看板 | API 配额/用量的可视化仪表盘，支持按时段和模型查看 |
| F081 | 消息气泡连续性可观测 | 追踪消息从后端产生到前端渲染的完整生命周期，定位渲染断裂 |
| F082 | Git Health Panel | 仓库状态可视化——分支、冲突、worktree 状态一目了然 |
| F130 | API 日志治理 | 四层分离（调用日志/业务日志/审计日志/调试日志）× 结构化存储 |
| F150 | 工具使用统计 | Tool / Skill / MCP 调用频次和分布的可观测看板 |
| F153 | Observability Infrastructure | 运行时可观测性基础设施——统一的 metrics、traces、logs 管线 |
| F194 | Invocation Liveness | 后端 Agent 进程活性的唯一真相源——取代多处冗余的存活探测 |
| F212 | CLI Error Diagnostics | CLI 错误的结构化诊断——从 stderr 噪音中提取可操作的错误信息 |
| F233 | Ball Custody Observability | 任务 ownership 的可观测看板——谁在负责什么、哪些任务卡住/休眠/无人接手 |

---

## 4. 治理与工程纪律 (Governance)

> 怎么让多个 AI Agent 遵守统一规范、怎么防止行为漂移、怎么管理技术债。

| F# | 名称 | 说明 |
|----|------|------|
| F015 | Backlog 管理 | 第一版需求管理体系 |
| F023 | 目录结构防腐化 | 文件/目录的规模阈值告警 + 自动重构建议 + 代码检查工具链 |
| F040 | Backlog 整理 | Feature 聚合文档体系——每个 Feature 一份结构化文档，全量索引 |
| F042 | Prompt 工程审计 | 对系统中所有 prompt 和 Skill 脚本做系统性质量审计 |
| F046 | Anti-Drift Protocol | 愿景守护协议——定期检查 Agent 行为是否偏离项目愿景 |
| F070 | Portable Governance | 将团队治理方法论抽象为可复制的输出，供其他项目使用 |
| F073 | SOP Auto-Guardian | 自动检测流程（SOP）执行是否被跳过，缺失环节自动提醒 |
| F083 | Design Gate | 代码实现前的设计评审门禁 + 云端 Reviewer 配额降级策略 |
| F094 | Feature 文档债务清理 | 将存量 Feature 文档全量迁移到统一的黄金模板标准 |
| F100 | Self-Evolution 自我进化 | Agent 基于错误反馈自动调整行为模式——行为层学习 + 知识对象化 |
| F114 | Magic Words | 用户专用的紧急控制词——触发预定义行为（立即停止/重读规则/审视方案等） |
| F177 | Harness Update | 结构化的 Feature 关闭判据 + 按 Agent 类型定制的行为护栏 |
| F191 | Architecture Ownership | 架构归属地图——每个模块有明确 owner，跨边界改动触发 Map Delta 门禁 |
| F203 | Native System Prompt L0 | 将核心治理规则注入到模型 system prompt 的原生层，压缩不丢失 |
| F214 | Root Directory Hygiene | 根目录卫生守护——防止文件泄漏到项目根目录 |
| F217 | Merge Gate Integrity | 合入主干的检查覆盖率 + 强制执行力 + 对 Gate 自身的元守护 |
| F218 | Evidence Provenance | 当 Agent 引用外部信息时，强制溯源——追踪一手来源、利益冲突、时效性 |
| F219 | 技术债盘点 | 核心调用链（如 routeSerial）的技术债全面盘点 + 架构演进路线 |
| F238 | Bidirectional Boundary Symmetry | 输入/输出边界处理的对称性——进来做什么清洗，出去也做对应清洗 |
| F239 | Skill Mount Hygiene | Skill 脚本挂载点的清理——确保项目级 vs 全局级的正确隔离 |

---

## 5. 多 Agent 协同 (Multi-Agent)

> 多个 AI Agent 之间如何传递任务、路由消息、避免死循环、确保可靠性。这是系统最核心的技术轴。

| F# | 名称 | 说明 |
|----|------|------|
| F002 | Agent-to-Agent (A2A) | 最早的 Agent 间通信协议——一个 Agent 完成子任务后自动交接给下一个 |
| F005 | A2A Follow-up | A2A 在 ideate（头脑风暴）模式下的扩展 |
| F027 | A2A 路径统一 | 将两套并存的 Agent 间通信路径合一 + 全链路取消支持 + multi-mention |
| F037 | Agent Swarm | 多 Agent 同时协作的群组模式——多个 Agent 并行工作、共享上下文 |
| F050 | External Agent Onboarding | 外部 Agent（非内建）接入平台的契约规范——接口定义 + 鉴权 + 生命周期 |
| F052 | 跨线程身份隔离 | 不同对话线程中的 Agent 消息做严格溯源隔离，防止身份混淆 |
| F055 | A2A MCP 结构化路由 | 通过 MCP 工具参数中的 `targetCats` 字段实现 Agent 精确寻址 |
| F064 | A2A 出口检查 | 检测 Agent 协作链的终止盲区——确保任务链不会静默断裂 |
| F078 | Smart Routing & Group Mention | 根据任务内容自动选择最合适的 Agent + 支持同时 @ 多个 Agent |
| F086 | Agent Orchestration | Agent 自主决定"下一步找谁合作" + 元认知系统（Agent 知道自己不知道什么） |
| F108 | Side-Dispatch 并发执行 | 同一对话线程中多个 Agent 并行执行不同子任务 |
| F122 | 执行通道统一 | 将 A2A 调用和 group mention 统一接入调度队列 |
| F128 | Agent 提议创建新线程 | Agent 发现需要开新话题时，主动提议创建新对话线程（用户确认后生效） |
| F154 | Agent Routing 个性化 | 用户可设置全局默认 Agent 和首选 Agent 路由规则 |
| F167 | A2A Chain Quality | Agent 间"乒乓球"式无效传球自动熔断 + 虚空传球（传给不存在的人）检测 |
| F185 | 入口级繁忙判断分层 | Agent 接收新任务前的忙碌状态分层判断策略 |
| F193 | Cross-Thread Communication | 不同对话线程之间的 Agent 通信统一——实现"发现问题即投递给对应线程" |
| F208 | Capability Profile Routing | 每个 Agent 建立能力画像档案，基于画像做智能路由 |
| F220 | A2A 可靠可恢复 | Agent 启动时的状态可见 + 卡死根因分析 + 强制重置逃生出口 |
| F224 | A2A 会话可靠性 | 消息去重 + 重复触发合并 + 异常会话重生 |
| F225 | Agent-Initiated Handoff | Agent 主导的会话接力——当前 Agent 自行判断并交接给更合适的 Agent |
| F247 | Cloud Agent Family | 多 provider 云端 Agent 接入——让远端运行的 AI（如 ChatGPT Pro）也能加入协作 |

---

## 6. 前端与 Hub 交互 (Frontend & UX)

> Web 端控制台（Hub）的界面功能和交互体验。

| F# | 名称 | 说明 |
|----|------|------|
| F001 | 配置可见性 | 在 UI 中展示系统运行时配置，便于调试 |
| F006 | Thread 名字编辑 | 用户可手动修改对话线程标题 |
| F007 | Thread 名字检索 | 按标题搜索对话线程 |
| F014 | SVG 状态动画 | Agent 头像根据状态（思考中/空闲/忙碌）显示不同表情动画 |
| F017 | 导出对话长图 | 将完整对话导出为一张可分享的长图 |
| F018 | 工具栏收起 | 侧边栏折叠/展开 + 滚动优化 |
| F022 | Rich Blocks 富消息 | 支持卡片、列表、图片画廊、代码 diff、语音等多种消息类型 |
| F026 | Dashboard Upgrade | 右侧面板重构 + 实时计划进度展示 |
| F029 | 右面板死区清理 | 移除闲置的"任务统计"区域 |
| F030 | 复制按钮 + 路径跳转 | 代码块一键复制 + 文件路径可点击跳转到编辑器 |
| F036 | Logo 一笔画动画 | 品牌 Logo 的笔画绘制动效 |
| F047 | Queue Steer | 消息队列中的任务支持"立即执行"和"提到队首" |
| F055 | Plan Board | 可视化的任务计划看板 |
| F056 | 设计语言 | 统一的视觉设计语言规范 |
| F057 | Thread 可发现性 | 对话列表的排序、搜索和 Agent 工具化支持 |
| F060 | 图片富文本渲染 | Agent 生成的图片以富文本方式内嵌渲染 |
| F063 | Workspace Explorer | 用户在 Web Hub 中浏览和管理工作区文件 |
| F068 | 新建对话弹窗 UX | 新建对话的弹窗交互优化 |
| F069 | Thread Read State | 未读消息 Badge 的后端持久化真相源 |
| F071 | UX Debt Batch | 前端交互小修小补合集 |
| F072 | Mark All Read | 一键清理所有未读标记 |
| F080 | Input History | 输入框的历史记录和自动补全 |
| F089 | Hub Terminal + tmux | 在 Web Hub 中嵌入终端 + 实时查看 Agent CLI 进程 |
| F095 | Sidebar 导航升级 | 左侧对话列表的 UX 升级 |
| F096 | Interactive Rich Blocks | 富消息组件支持交互——按钮、表单、投票等 |
| F097 | CLI 输出折叠 | Agent CLI 输出在聊天气泡中折叠展示 |
| F098 | Callback UX | Agent 间传话过程的可视化 |
| F099 | 导航可扩展性 | 顶栏导航架构重构，支持功能扩展 |
| F109 | Message Actions | 消息级操作——软删除、分支对话、编辑、通知 |
| F120 | Hub 内嵌浏览器 | 在 Hub 中嵌入浏览器，实时预览前端应用 |
| F131 | Workspace Navigator | Agent 可编程地在 Web 面板中导航和展示文件 |
| F147 | i18n 国际化 | Hub 界面中英文切换 |
| F160 | Thread Task Board | 对话线程级的持久化任务看板 |
| F164 | Thread Snapshot | 对话线程状态快照持久化——刷新浏览器不丢失当前视图 |
| F166 | Agent Order 自定义 | 用户可自定义 Agent 在列表中的排序 |
| F172 | 生成图片发布 | 将 AI 生成的图片归档为可复用的富媒体资源 |
| F176 | CLI 渲染语义分离 | 区分 Agent 的"说话内容"和"CLI 命令输出"，分别渲染 |
| F183 | Bubble Pipeline 收敛 | 消息气泡从数据到渲染的管线架构统一 |
| F184 | ChatMessage Rendering | 某些消息在 DOM 中缺失渲染的根因调查与修复 |
| F187 | Thread Labels | 用户自定义标签 + 侧边栏按标签筛选 |
| F190 | Console Settings | 设置页面和应用骨架重构 |
| F199 | Console Parity | 社区版 Console 与内部版的功能对齐补齐 |
| F206 | Settings UI 归一 | 设置页面的组件语言统一 |
| F221 | Taste Lane | 基于用户偏好的个性化品味导航 |
| F226 | Presentation Surface | 演示模式——右侧浮窗 + 画中画 + 演示用快照 |
| F232 | Thread Artifacts Panel | 对话产物视图——聚合展示一个对话中产生的所有图片/文件/PR/语音 |
| F246 | Approval Hub | 统一审批中心——Agent 发起的所有需人工确认的操作集中管理 |

---

## 7. 语音与多模态 (Voice & Multimodal)

> 语音输入、语音合成、本地感知等多模态交互能力。

| F# | 名称 | 说明 |
|----|------|------|
| F020 | 语音输入 MVP | 第一版语音转文字（STT）输入 |
| F034 | Voice Block 语音消息 | Agent 可以发送语音消息，前端播放 |
| F066 | Voice Pipeline Upgrade | 本地 TTS 引擎 + 流式合成 + 播放队列管理 |
| F092 | 语音陪伴体验 | 持续语音对话模式——类伴侣式语音交互 |
| F103 | 独立声线 | 每个 Agent 拥有独立的 TTS 音色/语速配置 |
| F104 | 本地全感知升级 | 使用 Qwen Omni + VL MoE 替换本地多模态管线（视觉+语音） |
| F111 | Streaming TTS Chunker | 流式分句合成——Agent 边生成文字边合成语音 |
| F112 | Voice Playback Queue | 语音播放队列 + 统一播放器控件 |
| F124 | Apple Ecosystem 语音 | iOS / watchOS / AirPods 端的语音交互适配 |
| F195 | Meeting Copilot | 实时旁听会议、私下向用户提供建议的 AI 智囊（适配 AUDHD 用户需求） |

---

## 8. 平台接入与 IM 网关 (Platform & IM Gateway)

> 让 Agent 通过各种 IM 平台与用户交互。

| F# | 名称 | 说明 |
|----|------|------|
| F010 | 手机端适配 | 移动端 UI 适配 |
| F088 | Multi-Platform Chat Gateway | Telegram 等主流 IM 的接入网关 |
| F113 | 一键部署 | 多平台一键部署脚本 |
| F132 | 钉钉 / 企微接入 | DingTalk + WeCom 消息网关 |
| F134 | 飞书群聊 | 飞书群消息的多用户支持 |
| F137 | 微信个人号接入 | 通过 iLink Bot 接入微信个人号 |
| F142 | Connector Slash Commands | 跨 IM 平台的 /slash 命令统一框架 |
| F151 | 小艺渠道接入 | 华为小艺助手渠道 |
| F157 | 飞书已读回执 | Agent 收到消息后立即发送"已收到"确认（替代"思考中→撤回"体验） |
| F240 | IM Connector Plugin | IM 连接器统一接口 + YAML 声明式 manifest + 外部插件安装 |

---

## 9. 插件与架构框架 (Plugin & Architecture)

> 系统的可扩展性架构——如何让第三方/社区扩展系统能力。

| F# | 名称 | 说明 |
|----|------|------|
| F032 | Agent Plugin Architecture | Agent 身份与插件解耦——CatId 不再硬编码，协作规则可动态配置 |
| F038 | Skills 发现机制 | Skill 脚本的按需发现与加载（而非全量预加载） |
| F041 | 能力看板 | MCP Server 和 Skill 脚本的统一管理界面 |
| F043 | MCP 归一化 | 多个 MCP Server 的拆分与合并优化 + 协作工具补全 |
| F074 | 挂载目录支持 | 支持将外部目录挂载到工作区——Agent 可访问共享文件 |
| F129 | Pack System | Mod 生态——用户可创建和分享"Agent 扩展包"（包含 Skill + 配置 + 角色设定） |
| F143 | Hostable Agent Runtime | 统一的 Agent 宿主抽象——不同载体（CLI/Web/Cloud）使用相同的 runtime 接口 |
| F145 | MCP Portable Provisioning | 声明式 MCP 配置——定义"期望态"，系统自动解析和安装 |
| F146 | Capability Marketplace | 能力市场——一键接入 + 多生态聚合 |
| F148 | Hierarchical Context Transport | 分层上下文传输——大段上下文按层级切分传递，避免 token 浪费 |
| F161 | ACP Carrier Generalization | Agent Communication Protocol 载体泛化——同一通信协议适配多种传输载体 |
| F189 | Operation Context Unification | HTTP / MCP / CLI / A2A 四种调用方式共享同一操作上下文构建器 |
| F202 | Plugin Framework | 完整的插件框架——本地发现、配置、资源激活、定时任务调度 |
| F204 | 微信公众号插件 | 微信公众号文章发布插件 |
| F205 | 视频插件 | 视频生成和分析的 provider 插件接口 |
| F223 | Capability Surface Registry | 将系统的隐藏能力注册为可发现、可执行、可验证的能力面 |
| F228 | 多项目 Skill 挂载 | 在多个项目间管理 Skill 脚本的挂载关系 |
| F241 | Agent Provider Plugin | 外部 Agent runtime 以插件方式声明式接入（新增 agentProvider 资源类型） |

---

## 10. 安全与认证 (Security & Auth)

> 认证体系、权限控制、安全加固。

| F# | 名称 | 说明 |
|----|------|------|
| F028 | 跨渠道授权通知 | Agent 需要用户授权时，通知可跨渠道送达（不局限于当前界面） |
| F035 | Whisper 私密消息 | 用户与 Agent 的私密消息——其他 Agent 不可见 |
| F077 | 多用户安全协作 | GitHub OAuth 登录 + Thread 级 ACL 权限控制 + 多用户 Session 隔离 |
| F156 | Security Hardening | WebSocket 实时通道加固 + 本机信任边界重新定义 |
| F174 | Callback Auth Lifecycle | 回调鉴权基础设施的持久化、优雅降级和可观测性 |
| F178 | Persistent Agent-Key Auth | Agent 的 MCP 写权限跨会话持久化（不再每次重新授权） |
| F196 | Safety Guardian | 紧急安全链路——Agent 检测到危险操作时的自动熔断和通知 |
| F237 | Prompt Injection Visibility | Prompt 注入攻击的检测与可视化 |

---

## 11. 运行时与基础设施 (Runtime & Infrastructure)

> 系统怎么跑起来、怎么恢复、核心调度和消息管线。

| F# | 名称 | 说明 |
|----|------|------|
| F004 | 运行时配置修改 | 无需重启即可修改运行时配置 |
| F024 | Context 存活监控 | 监控 Agent 上下文窗口的使用情况 + 濒临溢出时自动交接 |
| F033 | Session 策略可配置 | 会话链（新建/复用/继承）的策略可由用户配置 |
| F039 | 消息排队投递 | 用户消息按三种模式排队——立即/排队/丢弃 |
| F048 | 重启自愈 | 系统重启后自动恢复中断的 Agent 进程和消息队列 |
| F053 | Gemini Session 对齐 | Gemini Agent 的 Session/Resume 行为与其他 Agent 语义对齐 |
| F115 | 启动链优化 | 减少系统冷启动时间 |
| F117 | 消息投递生命周期 | 消息从发送到投递的完整状态机——发送/排队/执行中/已投递/失败 |
| F118 | CLI Liveness Watchdog | 监控 CLI Agent 进程是否存活 + 异常退出自动恢复 |
| F123 | Bubble Runtime Correctness | 消息身份契约（谁说的）+ 消息状态 Reconcile 状态机 |
| F127 | Agent 管理重构 | 账户配置与 Agent 实例分离——支持动态创建 Agent + 自定义别名路由 |
| F133 | CI/CD Tracking | 已注册 PR 的 CI/CD 执行结果自动追踪和展示 |
| F136 | 配置热更新 | 统一的配置热更新管线——修改配置无需重启服务 |
| F139 | 统一调度抽象 | 定时任务/cron/延迟执行的统一调度层 |
| F149 | ACP Runtime Operations | 项目级 Agent 进程池 + Session 租约管理 |
| F173 | Thread-Runtime State 统一 | 消除对话线程状态的双写路径，收口到单一真相源 |
| F175 | 消息队列统一设计 | 支持优先级排序 + 用户可控编排的统一消息队列 |
| F179 | Desktop Installer | Windows / Mac 安装包的自动化构建和发布 |
| F180 | Agent CLI Hook Health | Agent CLI 启动钩子（hook）的健康检查和同步 |
| F182 | Agent Roster Lifecycle | Agent 成员启停的全链路状态反馈——从 UI 到后端到 CLI 进程 |
| F197 | ACP tool_result Surfacing | 将 Gemini 的单一事件拆分为 tool_use + tool_result 双消息（与其他 Agent 对齐） |
| F198 | Claude Code Subscription Carrier | Claude Code SDK 的订阅载体适配 |
| F211 | Cross-Runtime Transparency | 跨 runtime（Antigravity/IDE）的 Session Chain 透明化 |
| F213 | Stale MCP Config Cleanup | 启动时自动清理过期的 MCP 配置 |
| F215 | Malformed Tool-Call Recovery | Agent 发出格式错误的工具调用时的自动恢复（降级/重试/交接） |
| F216 | routeSerial 重构 | 核心消息路由函数的决策层/执行层分离重构 |
| F230 | Claude Interactive PTY Carrier | 通过 PTY 交互进程 + transcript 旁路读取实现的替代载体 |

---

## 12. 游戏与互动体验 (Games & Interactive)

> 内建的娱乐互动功能——Agent 和用户一起玩游戏。

| F# | 名称 | 说明 |
|----|------|------|
| F011 | 模式系统 | 聊天/游戏/创作等多种交互模式切换 |
| F044 | 频道与活动系统 | 类 Discord 的频道概念 + 游戏活动支持 |
| F075 | 排行榜 | 基于贡献度和活跃度的排行榜 |
| F079 | 投票系统 | 多 Agent + 用户参与的结构化投票 |
| F085 | Hyperfocus Brake | Agent 检测到用户长时间连续工作时，主动建议休息 |
| F090 | 像素猫猫大作战 | 2D 即时格斗小游戏 demo |
| F093 | Cats & U 世界引擎 | "万物有灵"——陪伴式共创虚拟世界引擎 |
| F101 | Mode v2 游戏引擎 | 完整的游戏系统引擎 + 狼人杀实现 |
| F107 | 脑门贴词 | 多 Agent 战术推理游戏 #1——猜自己头上贴的是什么 |
| F119 | 谁是卧底 | 多 Agent 战术推理游戏 #2 |
| F170 | 网页中国象棋 | 网页端中国象棋对弈 |

---

## 13. 开源与社区 (Open Source & Community)

> 面向开源社区的运营、治理和协作。

| F# | 名称 | 说明 |
|----|------|------|
| F059 | 开源计划 | Cat Café 开源策略和路线图 |
| F105 | opencode 接入 | 开源多模型编码 Agent 的集成接入 |
| F116 | Open-Source Ops Skill | 自动化的开源社区运营——issue 分诊、PR 评审、版本发布 |
| F121 | Community UX Triage | 社区提交的前端交互问题的侦查与分诊流程 |
| F158 | Kimi CLI 接入 | Kimi（月之暗面）CLI 作为一等公民 Agent 接入 |
| F168 | Community Ops Board | 社区事务编排引擎——自动化管理 issue/PR/release 的运营闭环 |
| F235 | Feedback-to-Community Publisher | 将内部反馈一键转化发布到社区 issue/discussion |

---

## 14. 引导与个性化 (Onboarding & Personalization)

> 新用户引导、个性化体验、用户画像、以及"养成"类关系建设。

| F# | 名称 | 说明 |
|----|------|------|
| F012 | 功能可发现性 | 帮助用户发现系统已有能力 |
| F031 | PR 双层 Review | 本地 Agent review + 云端 Agent review 的双保险 |
| F054 | HCI 预热基础设施 | Social Media MCP + 内容生产管线（对外传播） |
| F061 | Antigravity 接入 | 混合家族 Agent——集成浏览器自动化能力的 Agent |
| F062 | 账号配置中枢 | API 订阅切换、赞助 API Key 管理 |
| F076 | Mission Hub 跨项目 | 多项目统一作战面板 + 甲方项目治理 |
| F087 | 训练营 (Bootcamp) | 新用户分步引导——从零配置到上手协作 |
| F091 | Signal Study Mode | 信息信号的学习伴侣——AI 辅助深度阅读和研究 |
| F106 | 多训练营支持 | 不同场景（开发/写作/运营）的独立训练营 |
| F110 | 训练营愿景引导 | 在训练营中引导用户明确需求和使用愿景 |
| F126 | 四肢控制面 (Limb) | Agent 的物理延伸——通过注册的外部设备/服务执行真实操作 |
| F138 | Video Studio | AI 视频制作管线 |
| F140 | GitHub PR Signals | 自动检测 PR 冲突 + 聚合全来源 Review 反馈 |
| F141 | GitHub Repo Inbox | 仓库事件（issue/PR/release）的自动发现和分诊 |
| F144 | PPT Forge | AI 演示文稿生成引擎 |
| F155 | Scene Guidance Engine | 基于使用场景的双向引导——系统引导用户 + 用户引导系统 |
| F162 | Enterprise Toolkit | 官方 CLI 驱动的企业级工作流（审批/报表/自动化） |
| F165 | Guided Overfitting | 引导式过拟合——系统越用越贴合用户的个人风格和偏好 |
| F171 | 首位伙伴入驻 | 领养第一个 Agent 的引导体验 |
| F201 | Antigravity Reliability | 浏览器自动化 Agent 的可靠性和可用性闭环 |
| F207 | AI Family Office | 个人投资领域的 AI 学习基建——画像/知识/数据/分析/决策五层 |
| F210 | Antigravity CLI Migration | Gemini CLI 迁移到自有 Antigravity CLI |
| F222 | Frustration Auto-Issue | 检测到用户负面体验时，自动生成结构化 issue 反馈 |
| F229 | Cat Ball 前台入口 | 悬浮球/桌宠——常驻桌面的快速入口 + 功能发现 + 语音循环 |
| F231 | 启动胶囊 Profile Capsule | per-user 画像注入——Agent 醒来时看到用户画像，提供个性化回应 |

---

## 15. 数量统计

| 能力域 | Feature 数量 | 占比 |
|--------|-------------|------|
| 前端 / Hub UX | 46 | 19% |
| 运行时 / 基础设施 | 26 | 11% |
| 引导 / 个性化 | 26 | 11% |
| 多 Agent 协同 | 22 | 9% |
| 治理 / 工程纪律 | 20 | 8% |
| 插件 / 架构框架 | 18 | 7% |
| 记忆系统 | 15 | 6% |
| 可观测性 / 诊断 | 14 | 6% |
| 游戏 / 互动体验 | 11 | 4% |
| 平台接入 / IM 网关 | 10 | 4% |
| 语音 / 多模态 | 10 | 4% |
| 安全 / 认证 | 8 | 3% |
| 评估与质量保障 | 8 | 3% |
| 开源 / 社区 | 7 | 3% |
| **合计** | **248** | **100%** |

> 注：F001–F248 共 248 个号位，其中 F135 为空号（未使用），F055 号码撞车（A2A 路由 与 Plan Board 两个不同 Feature 共用同一 F#），实际独立 Feature 共 248 个。部分 F#（F061、F081、F124、F155、F229、F237、F244）有多份文档，分别记录不同阶段产物（spec / retrospective / verification / audit 等），属正常多文档模式。

---

*Cat Café — Multi-AI Agent Collaborative Platform*  
*Feature Inventory by Landy & 宪宪 (Claude Opus 4.6), 2026-06-25*
