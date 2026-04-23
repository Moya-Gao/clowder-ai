---
title: "RFC 草稿：ADR-031 / ADR-032 与 F153 可观测性基础设施的整合"
date: 2026-04-23
authors: [opus-47]
reviewers_pending: [gpt52]
status: draft (pending 砚砚 review → clowder-ai 社区发布)
doc_kind: discussion
topics: [rfc, adr-031, adr-032, f153, observability, integration, open-source]
target_audience: [cat-cafe internal, clowder-ai community contributors]
---

# RFC 草稿：ADR-031 / ADR-032 与 F153 可观测性基础设施的整合

> **目的**：这份草稿是给 clowder-ai 社区发的 RFC issue 的雏形，发之前先让砚砚（@gpt52）从缅因猫的视角审一下准确性、完整性、是否有技术细节错漏。定稿后由布偶猫 47 以 Cat Cafe 维护者身份在 clowder-ai 开正式 issue。

---

## 背景

Cat Cafe 最近落地了两份重要的架构决策（ADR），方向和 F153 Observability Infrastructure 有很深的耦合。在正式外部讨论之前，先在猫咖内部把耦合关系写清楚：

- **ADR-031: Harness Engineering 方法论**（`docs/decisions/031-harness-engineering-methodology.md`，v3.2）
  - 4 个核心：Environment Fit + Tracing + Signal Loop + Sunset Discipline
  - 两类 frontier 漂移：模型侧（capability / 心智 / experience）+ 环境侧（task / tool / protocol / provider）
  - Signal 的双向消费：internal retrieval + external user-driven export
  
- **ADR-032: Cat Cafe as Local-First Trace Producer Enabler**（`docs/decisions/032-cat-cafe-as-local-first-trace-enabler.md`，v0.2）
  - 定位三件套：open protocol + local-first runtime + neutral infrastructure
  - 三角色：用户（data owner）/ Cat Cafe（tooling provider）/ 下游消费方（Lab / 企业 ML / OSS）
  - 产品承诺：**不托管、不回传、不碰用户数据**

这两份 ADR 的**技术落地点**严重依赖 F153 已有的基础设施——尤其是 Phase A（TelemetryRedactor + OTel SDK）、Phase B（parentSpan 全链路穿透）、Phase E（LocalTraceExporter + Ring buffer）。

---

## 为什么要发 RFC（而不是直接开 PR）

有三个原因：

1. **F153 还在进行中**（Phase E 刚 merge spec，实现待 intake）——我们不想在 F153 作者还没收尾的时候强推自己的扩展
2. **ADR-032 是产品定位级决策**，不只是技术 PR——社区贡献者有权利知道他们做的事情会被 Cat Cafe 整体战略里如何使用
3. **哲学对齐比代码对齐重要**——我们认为 F153 的 KD-16（`descriptive observability, not normative eval`）和 ADR-032 的 `neutral infrastructure` 是同一思想的两个投影，但这个判断需要社区确认

---

## 6 个耦合点（从强到弱）

### 1. TelemetryRedactor 四级脱敏 ↔ ADR-032 脱敏 pipeline（最强耦合）

F153 Phase A 已经实现的 **TelemetryRedactor** 四级分类：

- **Class A**：凭证 / API keys / tokens → `[REDACTED]`
- **Class B**：业务正文 → hash + length
- **Class C**：系统标识符 → HMAC-SHA256
- **Class D**：安全数值 → passthrough

这**不是**"ADR-032 需要一个类似的东西"——这**就是** ADR-032 脱敏 pipeline 的基座。ADR-032 v0.2 已经在技术设计层写死"直接复用 F153 TelemetryRedactor"。

**可能的扩展**：ADR-032 想加 **Class E: 代码 IP**——保留结构（AST 骨架 + import names），去掉 function body。这需要和 F153 作者对齐，看作为 Class E 加到 TelemetryRedactor 里，还是 ADR-032 的 ExportTransformer 阶段再处理。

### 2. KD-16 `descriptive vs normative` ↔ ADR-032 `neutral infrastructure`（哲学同源）

F153 **KD-16**（2026-04-21）：`F153 = descriptive observability plane, not normative eval system`。

ADR-032：`Cat Cafe = neutral infrastructure, not data middleman`。

**这两个判断是独立推导出来的**——F153 团队从"观测台不做评判"的角度，ADR-031/032 从"产品不碰数据"的角度，竟然落到了同一个价值观上。

这是 Cat Cafe 整体方向的 live dogfood：**我们的架构原则在不同团队独立推导下收敛到同一点**。

### 3. KD-13 exporter 放 redactor 之后 ↔ ADR-032 "不托管数据"（架构级 enforcement）

F153 **KD-13**：`LocalTraceExporter 放在 RedactingSpanProcessor 之后，Hub 只看脱敏后数据`。

ADR-032 说"Cat Cafe 不托管 / 不回传 / 不碰用户数据"。KD-13 **不是口头承诺，是架构级 enforcement**——即使 Cat Cafe 前端/后端错误地想读 raw span，也读不到，因为架构层就挡了。

**ADR-032 v0.2 已经把这条写成继承关系**——不新造 enforcement，继承 F153 现有的。

### 4. OTel span 模型 ↔ ADR-031 Core 2 Tracing

F153 Phase B 实现：
- parentSpan 全链路穿透（`invocationSpan → AgentServiceOptions → providers → CliSpawnOptions → spawnCli`）
- `cat_cafe.cli_session` child span（CLI 子进程生命周期）
- `cat_cafe.llm_call` retrospective span（从 done-event `durationApiMs` 反推 startTime）
- `tool_use` span events（`addEvent()` 记录，非零时长反模式）
- 28 个结构测试

**ADR-031 v3.2 Core 2 已经把 Cat Cafe Tracing 分两层描述**：
- 应用层：`invocation_events` / `session chain` / `callback trace` / `ledger`
- 基础设施层：**F153 OTel span stack**

这两层互补——应用层是 domain-specific 语义，基础设施层是通用 OTel。之前 ADR-031 v3 只提应用层是 spec 遗漏，已修正。

### 5. LocalTraceStore + Ring buffer ↔ ADR-032 trace 导出基础设施

F153 Phase E 的架构：

```
OTel span → RedactingSpanProcessor → LocalTraceExporter → Ring buffer
                                                          ↓
                                          /api/telemetry/traces
```

ADR-032 的 trace export 方案建在这之上：

```
Ring buffer → ExportTransformer → 多种格式输出
                                  ├── SFT-ready JSONL
                                  ├── Eval benchmark
                                  ├── RL reward trace
                                  ├── Raw trace
                                  └── Lesson library markdown
```

**不新起 export server**——扩展 F153 已有的 `/api/telemetry/traces` endpoint 加 export action。

### 6. MetricAttributeAllowlist ↔ ADR-032 opt-in 粒度（最弱耦合）

F153 的 `MetricAttributeAllowlist`（bounded cardinality，防止高基数标签爆炸）可以被 ADR-032 扩展为**用户 opt-in 粒度控制**的底座：

- per-thread / per-feature / per-timerange 三级粒度
- 每一级对应 allowlist 的一个维度

这一条比较弱，主要是 "同一个机制的不同应用" 而不是 "同一个代码路径的直接复用"。

---

## RFC 问题清单（给社区的提问）

### Q1. TelemetryRedactor 扩展性

ADR-032 想加 **Class E: 代码 IP**——保留 AST 骨架 + import names，去掉 function body。

- 这个逻辑应该作为 Class E 加到 F153 TelemetryRedactor 里吗？
- 还是作为 ADR-032 独立的 ExportTransformer 阶段处理？
- 社区对 Class E 的命名 / 语义有什么偏好？

### Q2. LocalTraceStore 扩展为 user-controlled export

- F153 的 LocalTraceStore 是否设计成可扩展支持 user-controlled export？
- 如果是，ExportTransformer 应该以什么形式挂进来？（处理器链？回调？独立服务？）
- 如果不是（F153 有意保持 pure observability），ADR-032 应该建一个平行的 ExportStore 吗？

### Q3. OTel attribute 命名对齐

F153 AC-B5 要求 `invocationId`/`sessionId` camelCase，不要 snake_case。

- ADR-032 的 trace schema v1 spec 应该直接用 F153 的 attribute 命名约定吗？
- 如果要加新字段（`catFamily`、`handoffIntent`、`pushBackReason` 等），按什么规则加？

### Q4. F153 Phase F 和 ADR-032 rollout 的关系

F153 Phase F 写"后续增强（视 Phase E 落地情况决定）"。

- F153 Phase F 计划是否包含 trace export 能力？
- 如果是，怎么和 ADR-032 的 rollout 节奏协调？
- 如果不是（Phase F 只做 observability 本身的深化），ADR-032 的 trace export 应该作为新 feature（F17X）立项吗？

### Q5. 哲学对齐确认

F153 KD-16 "descriptive, not normative" 和 ADR-032 "neutral infrastructure, not data broker" 在我们看来是同一思想的两个投影。

- F153 作者是否认同这个判断？
- 如果认同，未来是否愿意在 F153 spec 里交叉引用 ADR-032 作为价值观的延伸？
- 如果有不同看法（比如 F153 的 "descriptive" 是更严格的"不做任何价值判断"，而 ADR-032 的 "neutral" 是更务实的"不做数据业务"），对齐点在哪里？

---

## 我们不是在问什么

为避免误解，明确**本 RFC 不是**以下请求：

- ❌ 不是要求 F153 扩大 scope。F153 继续做 observability，不需要做 trace export
- ❌ 不是要求 F153 作者来实现 ADR-032。我们自己做，只是想建在 F153 之上
- ❌ 不是要求 F153 暂停进度等 ADR-032。F153 按自己节奏走，ADR-032 在 F153 基础设施稳定后再落地
- ❌ 不是 pushback F153 的任何决策。我们**同意** KD-13 / KD-16 / 四级脱敏的所有现有设计

**本 RFC 实际是在问**：

- ✅ ADR-032 应该建在 F153 之上（preferred）还是平行于 F153（second best）？
- ✅ 如果建在 F153 之上，哪些扩展点是**社区容易接受的**（加 Class E、加 ExportTransformer hook）？哪些是**社区不希望改的**（F153 的核心契约、KD 决策）？
- ✅ 哲学上是否同源——如果是，ADR 之间能否 cross-reference 作为 value system 的互相印证？

---

## 下一步

1. **砚砚（@gpt52）审这份草稿**——缅因猫视角看技术细节是否准确、逻辑是否完整、有没有我忽视的风险或冲突
2. **砚砚 review 通过后**，我（布偶猫 47）以 Cat Cafe 维护者身份在 clowder-ai 开正式 issue
3. **clowder-ai 社区讨论**——至少等 F153 Phase A-D 作者和 Phase E 作者的 response
4. **收敛后**，根据 RFC 结果再改 ADR-032 技术设计层 / 或立 F17X feature 推进 trace export 实现

---

## 附录：ADR-031 / ADR-032 中和 F153 相关的改动

- **ADR-031 v3.2**（`docs/decisions/031-harness-engineering-methodology.md`）
  - Core 2 Tracing 新增"基础设施层 trace"引用 F153 OTel stack
  - frontmatter 加 F153 / F167 到 related

- **ADR-032 v0.2**（`docs/decisions/032-cat-cafe-as-local-first-trace-enabler.md`）
  - 技术设计层开头新增"关键原则：复用 F153 基础设施，不另起炉灶"表格
  - Trace Schema 标准化加 "命名对齐 F153" 条款
  - 脱敏 Pipeline 改写为"基座：F153 TelemetryRedactor 四级分类"
  - 导出格式改为"建在 F153 LocalTraceExporter 之上"的架构图
  - opt-in 机制改为"基于 F153 MetricAttributeAllowlist"
  - frontmatter 加 F153 到 related

---

*起草：[宪宪/Opus-47🐾]*
*待 review：[砚砚/GPT-5.4🐾]*
*起草依据：2026-04-23 铲屎官指出 F153 可能与 ADR-031/032 有耦合；47 读完 F153 spec 后整理出 6 个耦合点*
