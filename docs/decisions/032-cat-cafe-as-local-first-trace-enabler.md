---
feature_ids: []
topics: [product-positioning, business-model, data-sovereignty, local-first, trace-export, signal-pipeline, open-protocol]
doc_kind: decision
created: 2026-04-22
status: draft
related: [ADR-031, F153, F163, F167]
---

# ADR-032: Cat Cafe as Local-First Trace Producer Enabler

> 状态：草稿（待多猫 Phase 0 审视）
> 日期：2026-04-22
> 决策者：铲屎官（CVO）+ 布偶猫(47)；R1 review pending
> 触发：ADR-031（Harness Engineering 方法论）v3.1 讨论中，铲屎官指出 signal 的消费方向不只是 internal retrieval，跨厂商协作 trace 对 Lab 训练下一代 multi-agent 模型是独特资产。但铲屎官随即精化了边界——Cat Cafe 是**本地产品**，我们根本不持有用户数据。这份 ADR 固化这个 aha，把 Cat Cafe 的产品定位 + 数据伦理 + 商业模型从 ADR-031 scope 里独立出来。

## 背景

### 为什么现在需要这份 ADR

ADR-031 v3 定义了 Signal Loop——trace → extract → classify → feed back。v3 里有一张"四种信号形态"表，把 Dataset / Eval / RL reward 标成"只有 Lab 能用"——这反映了我们当 **signal consumer** 的视角。

铲屎官点破两件事：

1. **Cat Cafe 跑出来的跨厂商协作 trace 是独特资产**——Lab 内部训练集里没有（跨 provider / 长期 / 人在环 / failure+correction 保留 / 审美漂移）
2. **但边界必须清楚**：Cat Cafe 是本地产品，runtime 和存储都在用户机器——**我们根本碰不到数据**

第 1 点单独看，容易把 Cat Cafe 误定位成"数据供应商"（走 Scale AI / Surge 那条路）。第 2 点拉回正确方向：**Cat Cafe 是 enabler，不是 data broker**。

### 和 ADR-031 的 scope 划分

| ADR | 管什么 |
|-----|-------|
| ADR-031 | Signal 如何**产生**的方法论（4 核心 + frontier 漂移） |
| **ADR-032（本份）** | Signal 如何**对外暴露**的产品边界 + 商业模型 + 合规 |

分开的原因：ADR-031 是技术/方法论决策，可以跨项目复用；ADR-032 是 Cat Cafe 产品/公司决策，和具体商业定位绑定。混在一起会稀释两边。

## 决策

### 定位三件套

Cat Cafe 的产品定位由三件互相锁合的承诺组成：

#### 1. Open Protocol

Multi-vendor agent collaboration 的**开放协议层**——trace schema、handoff semantics、ball ownership、SOP 编码、失败模式 taxonomy，全部公开可实现。

类比：**HTTP 之于 web**。HTTP 不拥有任何数据，但定义了数据如何产生、结构化、传输。

Cat Cafe 的 schema 和 protocol spec 应该可以被第三方实现——其他团队可以按同一 spec 做自己的 agent runtime，用同一格式 export trace。**我们不垄断协议**。

#### 2. Local-First Runtime

- Agent runtime：用户机器
- Shared state（thread / task / workflow / session chain）：用户机器
- Evidence index（evidence.sqlite）：用户机器
- Trace log：用户机器
- Memory：用户机器
- **除了 model API 调用（那是 vendor 的云服务），全部本地**

唯一出本地的是发给 model vendor 的 prompt——这是 vendor 本来就会拿到的数据，不是 Cat Cafe 带出来的。

#### 3. Neutral Infrastructure

Cat Cafe 产品本身**不托管、不回传、不转手、不商业化用户数据**：

- 不托管：Cat Cafe 后端（如果有）不存用户 trace
- 不回传：本地 runtime 不向 Cat Cafe server 推送用户生成内容
- 不转手：Cat Cafe 不在用户和 Lab 之间做 data broker
- 不商业化：我们的 revenue 不来自数据交易

### 三角色关系

| 角色 | 拥有什么 | 决定什么 | 负责什么 |
|------|---------|---------|---------|
| **用户**（个人 / 企业 client） | 自己产生的 trace 数据全部产权 | 留本地 / 导出 / 共享 / 卖 / 捐 | 数据的合规使用、同意链路 |
| **Cat Cafe**（我们） | 工具（harness + schema + export pipeline + 脱敏） | 工具质量、schema 演进、**绝不碰数据** | 工具本身的正确性、协议开放性 |
| **下游消费方**（Lab / 企业内部 ML / 开源 / 合作方） | 付费 / 合作 / 感谢 | 要什么 schema 的数据 | 数据处理的合规 + 数据对价 |

**关键**：用户和下游消费方是**直接关系**——Cat Cafe 不在中间。我们只提供让这种关系 technically feasible 的工具。

### 用户的选择空间

用户对自己的 trace 有四个默认选择：

- **留本地**（默认）——永不离开用户机器
- **导给 Lab**（卖 / 捐 / 合作）——用户直接和 Lab 谈
- **导到企业内部 ML 平台**——企业版客户常见 pattern
- **开源捐献**——推给 HuggingFace datasets / OSS trace 集合

Cat Cafe 提供所有路径的导出工具（schema 转换、脱敏、打包），但**触发权永远在用户手里**。

## 价值主张：为什么这个定位是赢的

### 对用户（个人）

- **零外泄风险**：data 从未离开本地（除非自己明确 export）
- **数据主权真实**：不是 TOS 里写"我们尊重您的隐私"那种，而是**我们根本拿不到**
- **Lab 合作的 upside 归自己**：如果用户选择卖给 Lab，收益归用户

### 对企业 client

- **合规友好**：SOC 2 / GDPR / AI Act 下 Cat Cafe 不是 data processor，降低企业的法务审查负担
- **知识产权保护**：code / 业务逻辑 / 内部决策全留在公司，不外流
- **企业内部 ML 平台对接**：trace 可以直接导到自己的 training 基础设施
- **可定制脱敏 policy**：企业可以按自己 compliance 要求配置

### 对 Cat Cafe（我们自己）

- **无 data liability**：从 Equifax 到 OpenAI，data breach 是 SaaS 最贵的法律风险——我们没这个 attack surface
- **无 storage cost**：不存用户数据 = 不需要付云存储、备份、replication、灾备
- **和 Lab 非竞争**：我们不跟 Scale AI / Surge 抢 data 生意，反而可以和 Lab 合作（帮用户把数据导成 Lab 要的格式）
- **长期 defensibility**：在 AI 时代 "data middleman" 路径越来越难走（user 不信任、regulation 收紧）；**"我们不碰数据"是长期可防御的 moat**

### 对 Lab / 数据消费方

- **独家数据入口**：跨厂商协作 trace 在哪里都拿不到——只能通过 **Cat Cafe schema 格式 + 用户 opt-in**
- **合规友好**：数据从用户那里来，用户是 controller，Lab 是 processor——链路清晰
- **多样性真实**：三家 vendor agent 在同一 thread 互动的数据，避免自训模型的盲点自循环

## 技术设计层（粗粒度，细节留给未来 feature）

### 关键原则：复用 F153 基础设施，不另起炉灶

**F153 Observability Infrastructure** 已经建好了 ADR-032 trace export 需要的一大半基础设施——如果我们另起一套，既浪费又割裂。ADR-032 的技术架构**应该建在 F153 之上**，而不是平行于 F153：

| ADR-032 需要 | F153 已有 | 关系 |
|------------|----------|------|
| 脱敏 pipeline | **TelemetryRedactor**（四级分类 A/B/C/D）| ✅ 直接复用，可能扩展 Class E "代码 IP" |
| Trace 产生链路 | **OTel SDK + parentSpan 全链路穿透**（`cli_session` / `llm_call` / `tool_use` spans）| ✅ 直接复用，trace schema 对齐 OTel attribute 命名 |
| 本地 trace 存储 | **LocalTraceExporter + Ring buffer**（在 `RedactingSpanProcessor` 之后）| ✅ 扩展为可控导出（Ring buffer → Transformer → export formats）|
| 查询接口 | **`/api/telemetry/traces`**（session auth + HMAC 匹配）| ✅ 扩展加 export endpoint |
| 粒度控制 | **MetricAttributeAllowlist**（bounded cardinality）| ✅ 扩展为 opt-in 粒度控制 |
| "不碰数据" 的架构保证 | **KD-13**：`LocalTraceExporter` 放在 `RedactingSpanProcessor` **之后**——Hub 只看脱敏后数据 | ✅ ADR-032 neutral infra 原则的 live enforcement |

**哲学对齐**：F153 **KD-16**（`F153 = descriptive observability, not normative eval`）和 ADR-032（`Cat Cafe = neutral infrastructure, not data broker`）是**同一思想的两个投影**——F153 不评判内容、ADR-032 不托管内容。

### Trace Schema 标准化

- Open spec：`cat-cafe/specs/trace-schema.md`（待建）
- 包含字段：handoff metadata / speaker / intent / resolution / human verdict / cross-vendor transitions / failure marker
- **命名对齐 F153**：OTel attribute 名用 camelCase（`invocationId`、`sessionId`），和 F153 AC-B5 一致
- 版本化：spec v1 → v2 向前兼容
- 第三方可实现：不绑 Cat Cafe 自己的 runtime

### 脱敏 Pipeline（本地执行）

**基座：F153 TelemetryRedactor 四级分类**（直接复用，不重建）：
- **Class A**：凭证 / API keys / tokens → `[REDACTED]`
- **Class B**：业务正文 / prompt-response 内容 → hash + length
- **Class C**：系统标识符（invocationId / sessionId / catId）→ HMAC-SHA256
- **Class D**：安全数值（timestamp / duration / counters）→ passthrough

**ADR-032 扩展（待讨论，需要和 F153 作者对齐）**：
- **Class E**：代码 IP——保留结构不保留实现（AST 骨架 + import names，去掉 function body）。默认启用，用户可 opt-in 完整分享
- **自定义 pattern**（企业版）：公司特定的业务机密 regex / ML-based classifier

**强制执行**：所有 export 必须经过 `RedactingSpanProcessor`，这是 F153 KD-13 的架构级 enforcement，ADR-032 继承。

### 导出格式（建在 F153 LocalTraceExporter 之上）

F153 的 `LocalTraceExporter` 负责把 redacted spans 写入 Ring buffer。ADR-032 新增一层 **ExportTransformer**：

```
F153 侧：
  OTel span → RedactingSpanProcessor → LocalTraceExporter → Ring buffer

ADR-032 扩展：
  Ring buffer → ExportTransformer → 多种格式输出
                                    ├── SFT-ready JSONL（prompt + response pair）
                                    ├── Eval benchmark（含 ground truth + human verdict）
                                    ├── RL reward trace（成功/失败 pairs）
                                    ├── Raw trace（完整 structured log）
                                    └── Lesson library markdown（给 retrieval loop）
```

**不新起 export server**——扩展 F153 已有的 `/api/telemetry/traces` endpoint 加 export action。

### opt-in 机制（基于 F153 MetricAttributeAllowlist）

- **Granularity**：per-thread / per-feature / per-timerange 三级粒度——基于 F153 的 `MetricAttributeAllowlist` 扩展
- **Preview**：导出前用户可预览脱敏后的结果（走 F153 LocalTraceStore 读）
- **Revoke**：用户可撤回已导出 dataset——和下游消费方的合同条款挂钩，超出 Cat Cafe 技术能力但在 schema 里保留 revocation signal
- **审计**：所有 export 动作本地记录（不回传），用户可查自己导出过什么

## 商业模型

### Individual tier

- **核心工具开源 / 免费**：runtime / harness / schema / 脱敏工具
- **Pro tier（可选）**：增强的 export console、premium schema 转换、优先支持
- **用户卖数据给 Lab 的收益**：**100% 归用户**，Cat Cafe 不抽成

### Enterprise tier

- **Per-seat licensing**：按公司内部用户数订阅
- **Enterprise export console**：支持对接公司内部 ML 平台（Databricks / Hugging Face Enterprise / 自建 training infra）
- **Custom 脱敏 policy**：按公司 compliance 要求配置
- **SLA + support**：企业支持合同

### 我们的 revenue 原则

1. **不以数据交易为 revenue**——我们卖工具，不卖数据
2. **不以 data broker 为 revenue**——我们不中介用户和 Lab 之间的交易
3. **不收 data 流转抽成**——用户卖数据给 Lab 我们不抽
4. **Revenue = 工具订阅 + 企业支持**——纯 SaaS 工具模式

## 合规

### 数据主权 clear-cut

- **用户 = data controller**（GDPR 术语）
- **Cat Cafe = tooling provider**，不是 data processor（我们不处理数据）
- **下游消费方 = data processor**（用户授权他们处理数据）

这种 controller-processor 关系比传统 SaaS 清晰——大部分 SaaS 是 joint controller 或 processor，法律上含糊。

### GDPR / AI Act / 各地法律

- GDPR：用户行使 right to access / deletion / portability 都在本地——Cat Cafe 天然 compliant
- AI Act：如果用户导出 trace 用于训练 high-risk AI，用户自己承担 AI Act 责任；Cat Cafe 作为 tooling 不是 AI system provider
- 中国《数据安全法》/《个保法》：用户数据留本地 = 数据不出境的默认实现

### 企业版额外考量

- SOC 2 Type II 认证：主要针对 runtime 的安全性，而非数据托管（因为没有托管）
- ISO 27001：对开发流程、供应链、事件响应做合规
- 行业特定合规（HIPAA / PCI DSS）：企业客户自己的数据留在自己 infra，Cat Cafe runtime 只需满足"不外带"的承诺

## 和 ADR-031 的互补关系

| 维度 | ADR-031 | ADR-032 |
|------|--------|---------|
| Scope | Harness engineering 方法论 | Cat Cafe 产品定位 + 商业 |
| 时间稳定性 | 方法论可跨项目复用 | Cat Cafe-specific |
| 决策层级 | 技术架构 | 产品 + 业务 |
| Signal 的视角 | 生产（trace → signal）| 消费接口（signal → 谁用） |

**联合叙事**：
- ADR-031 回答"**这些 signal 从哪来、怎么组织**"
- ADR-032 回答"**这些 signal 的归属是谁、怎么分享、Cat Cafe 怎么赚钱**"

两份合起来定义了完整的 "signal lifecycle + ownership model"。

## 后果

### 正面

- **长期可防御 moat**：data-touching 的竞争对手在 privacy 压力下会越来越难做；"我们不碰"反而越来越值钱
- **和 Lab 非零和**：Lab 从我们 spec 下的用户那里拿数据，不抢我们生意——反而可能和 Lab 战略合作（帮 Lab 拿到他们自己拿不到的 cross-vendor trace）
- **企业市场清晰**：compliance 审查简化，比 SaaS 竞品更容易过大公司采购
- **开源友好**：open protocol + 本地 runtime 的定位和开源社区天然契合

### 负面

- **Revenue growth slower than data-broker model**：短期看 Scale AI 那种路径现金流更爆——但我们不选这条
- **需要教育市场**："我们不碰数据"反而是反直觉的——现在用户默认 assume SaaS 都在 harvest 数据，需要说服他们这不是 marketing 话术而是架构事实
- **Attribution 难**：我们帮助了 Lab 训练下一代模型（通过用户链路），但**不直接拿到认可**——这是选择 neutral infrastructure 的代价
- **工具必须非常好用**：如果我们不托管数据，我们的价值就只剩工具本身——工具不好用就没戏

### 待观察

- **用户 opt-in rate**：多少用户真的会选择把 trace 导给 Lab？如果很少，data producer 的战略假设就不成立（但我们不受伤，因为不靠 data 赚钱）
- **Lab 是否愿意合作**：Anthropic / OpenAI / Google 会不会接 Cat Cafe schema 的用户数据？还是他们宁愿自己训？
- **企业版接受度**：大公司会不会买账"我们不碰数据"的 pitch？还是他们宁愿选有 data escrow 的竞品？
- **协议被 fork**：open protocol 的代价是有人 fork 了不回馈——我们的应对是**工具体验**作为 moat，而非协议锁死

## 元信念：为什么坚持这个定位

这不是战术选择，是战略信念：

1. **AI 时代 data trust 是最稀缺的资源**——谁做到"真的不碰"，谁有长期壁垒
2. **Local-first 是 AI 产品的未来方向**——模型越来越能在本地跑（on-device inference），基础设施也该跟着走
3. **和用户对齐比和资本对齐更可持续**——data harvesting 模式在监管收紧下是 regression to mean，local-first 是 forward bet
4. **"猫猫是 Agent 不是 API"的延伸**：如果我们把猫当成队友而不是工具，我们也该把用户当成 owner 而不是 raw material

## 下一步

- [ ] 多猫 Phase 0 审视（@opus 46 / @gpt52 / @gemini 独立 review，特别是商业模型可行性）
- [ ] 起草 `specs/trace-schema-v1.md`——trace 标准化 spec（feature 级工作）
- [ ] 起草 `specs/redaction-policy.md`——脱敏策略规范（可能和法务协作）
- [ ] 起草 individual tier 的 OSS license + trademark 策略
- [ ] 起草 enterprise tier 的 term sheet 草稿（未来商业节点）
- [ ] 和 Lab（Anthropic / OpenAI / Google）的 outreach 策略（long-horizon，等 product 成熟）
- [ ] 在 `VISION.md` 补一段"Cat Cafe 的三件套定位"，让核心愿景文档和 ADR 一致
- [ ] 把本 ADR 的核心 framing（三角色 / neutral infrastructure）做成一张图（烁烁 visual brief 候选）

---

*起草：[宪宪/Opus-47🐾]*
*依据：2026-04-22 铲屎官 aha moment（cross-vendor trace 作为 training data asset）+ 后续边界精化（Cat Cafe 不碰数据）*
*原始讨论现场：本 thread 的 ADR-031 v3 review round + 铲屎官本地产品边界纠正*
*状态：draft pending multi-cat R1 review*
