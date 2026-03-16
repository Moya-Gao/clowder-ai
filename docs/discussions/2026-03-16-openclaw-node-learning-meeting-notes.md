---
feature_ids: [F010, F088, F102, F124, F125]
related_features: [F033, F041, F044, F065, F118]
topics: [openclaw, node, capability, architecture, research]
doc_kind: meeting-notes
created: 2026-03-16
participants: [opus, gpt52, opencode]
---

# OpenClaw Node 概念学习研讨 — 会议纪要

**Thread ID**: 对话历史 0001773654854473 | **日期**: 2026-03-16 | **参与者**: 宪宪(opus)、砚砚(gpt52)、金渐层(opencode)

## 背景

铲屎官转发了 Opus 4.5 对 OpenClaw Node 概念的深度解读，要求三猫（opus + gpt52 + opencode）做一次**完整 research + 头脑风暴**：Cat Café 能从 OpenClaw 的 Node 概念中学到什么？强调实事求是——先摸清我们有什么，不要猜。

## 各方观点摘要

### 宪宪 (Opus) — 设备能力扩展视角

**核心洞察**：OpenClaw Node 的精髓是四个设计原则——设备是能力提供者而非客户端、双 Session 分离控制面/数据面、Capability-based 自描述、Pairing 审批安全边界。

**该学**：
1. Capability Registry 模式 → 应用到 F124 Apple 生态（设备连接时自报能力清单）
2. 双 Session 分离 → AirPods 语音场景天然需要（用户聊天 + 后台设备调用不互阻塞）
3. Pairing 审批 → 扩展现有 ConnectorThreadBindingStore 为 device binding

**不该学**：
1. 完整 WebSocket Node 协议（我们已有 CLI subprocess + MCP，不需要第二套通信范式）
2. 通用设备网格（场景聚焦苹果全家桶，YAGNI）
3. 自编码 Skill 生态（安全问题太大）

**提案**：三层扩展——Device Registry → Device MCP Tools → iOS/watchOS App

### 砚砚 (GPT-5.4) — 架构治理视角

**核心判断**：我们真正该学的不是"再造一个 Gateway"，而是补齐三块硬骨头。

**5 个值得学的原则**（按优先级）：
1. **P1: 控制面真相源明确** — 把 session 的多个分散状态（thread/invocation/slot/binding/resume）收敛为统一的 Conversation Identity + Session Pointer
2. **P1: Pre-seal durable memory flush** — session 即将 seal/compaction 时自动触发 durable memory 写入候选层，走 F102 materialize 审核链
3. **P2: Per-cat tool policy** — 从人格描述升级为运行时工具权限配置（allow/deny by tool family）
4. **P3: Capability host 轻量抽象** — 先统一已有 browser/screenshot/terminal，不急于造 full node
5. 不该照搬 OpenClaw 的强隔离多脑模式（违背 Cat Café 多猫协作共享真相源的核心价值）

**关键实事求是纠偏**：Opus 4.5 说的"iOS 双独立 WebSocket session"——砚砚在官方文档中未找到充分证据，标记为"不能当已确认事实"。

### 金渐层 (opencode) — 行业对标 + 全栈视角

**5 维并行调研**：OpenClaw 技术细节 + Cat Café 代码库现状 + 行业对标 + 已有学习记录 + F102 memory 演进。

**独特贡献**：
1. **行业对标**：Capability-based 安全是学术+工业共识（RBAC 不足以应对 AI agent）；MCP 已成事实标准可替代自定义协议；A2UI/Canvas 是明确趋势
2. **MCP 替代自定义协议的洞察**：不需要抄 OpenClaw 的自定义 WebSocket 协议，做 "Device MCP Server" 跑在手机上暴露能力即可
3. **Presence 可用性感知**：猫猫不在线时其专属能力自动降级，与 F118 CLI Liveness Watchdog 衔接
4. **Agent-Driven UI 演进**：Rich Blocks 已是 Canvas/A2UI 的雏形，下一步可考虑通用 HTML 片段推送
5. **根本差异定性**：OpenClaw = 一个超级 Agent + N 个哑设备（扩展感知和执行）；Cat Café = N 个有个性 Agent + MCP 工具生态（扩展思考和协作）

**QMD/Recall 附带贡献**（来自 F102 memory alignment proposal）：把聊天记录从"存储"变成"可被 agent 再次取回"的资产，提出 4 层语料分类 + `/recall` 协议 + 检索路由策略。

## 共识区（三猫一致同意）

| # | 共识 | 证据强度 |
|---|------|---------|
| C1 | **我们已经学到了 transport gateway + thread binding + 统一消息管道 + 结构化编排** | 代码+ADR 可证 |
| C2 | **不该照搬 OpenClaw 的自定义 WebSocket Node 协议**——MCP 是更好的标准化路径 | 行业对标+架构分析 |
| C3 | **不该把猫猫降级为 Node**——Cat Café 的核心是多脑协作，不是单脑多肢 | 愿景对齐 |
| C4 | **Capability-based 能力声明和发现值得学**——无论设备接入还是猫猫工具治理 | 三方独立得出 |
| C5 | **Memory lifecycle 需要补"pre-seal 自动写入"环节**——不能靠灵感写 durable memory | 砚砚提出+金渐层呼应 |
| C6 | **设备能力接入应走 MCP 标准协议**，不造新轮子 | opus+opencode 独立得出 |
| C7 | **Full node architecture 不急**——先有场景再抽象，YAGNI | 三方一致 |

## 分歧区（保留各方理由）

| # | 分歧点 | 各方立场 |
|---|--------|---------|
| D1 | **优先级排序** | 砚砚：Session truth + memory flush 最优先（补基础设施）；宪宪：Capability Registry 最优先（对接 F124 实际需求）；金渐层：动态能力注册 + Presence 升级最优先（可快速落地） |
| D2 | **Conversation Identity 是否需要单独立项** | 砚砚：P1 必须立，是 F088/F044/F077 的共同地基；宪宪/金渐层：认同重要性但未明确列为独立议题 |
| D3 | **Agent-Driven UI 泛化时机** | 金渐层：Rich Blocks → 通用 HTML 是中长期方向；砚砚/宪宪：未讨论此方向 |
| D4 | **QMD/Recall 检索升级是否属于此次研讨范围** | 砚砚带入了 F102 memory alignment proposal（含 QMD 方案），扩展了讨论范围；宪宪/金渐层在 Node 概念讨论中未涉及 |

## 待决事项

1. **优先级排序需要铲屎官拍板**：补基础设施（session truth）vs. 对接产品需求（F124 设备接入）vs. 快速出活（presence 升级）
2. **Conversation Identity 是否单独立项**还是作为 F088 下一个 Phase
3. **F124 Apple 生态的具体时间线**——设备能力接入的优先级取决于 F124 什么时候真正动工
4. **QMD/Recall 检索升级**是否并入 F102 Phase D 还是独立立项

## 行动项

| # | 行动 | 负责 | 状态 |
|---|------|------|------|
| A1 | 本纪要落盘 + commit push | opus | ✅ |
| A2 | 铲屎官确认优先级排序（基础设施 vs 产品需求 vs 快速出活） | 铲屎官 | ⏳ |
| A3 | 根据铲屎官决定，启动对应 feat-lifecycle 立项 | opus | ⏳ 等 A2 |

## 收敛检查

1. 否决理由 → ADR？**没有**（本轮是 research brainstorm，无技术方案被否决）
2. 踩坑教训 → lessons-learned？**没有新增通用教训**
3. 操作规则 → 指引文件？**没有**（如果立项后有新规则再更新）
