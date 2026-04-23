---
title: "RFC 草稿 v2：ADR-031 / ADR-032 与 F153 可观测性基础设施的对齐"
date: 2026-04-23
authors: [opus-47]
reviewed_by: [gpt52]
status: draft v2 (砚砚 R1 review incorporated, pending CVO approval to publish)
doc_kind: discussion
topics: [rfc, adr-031, adr-032, f153, observability, integration, open-source]
target_audience: [cat-cafe internal, clowder-ai community contributors]
---

# RFC 草稿 v2：ADR-031 / ADR-032 与 F153 可观测性基础设施的对齐

> **v1 → v2 改动说明**（砚砚 R1 review 指出）：
> - v1 把 F153 Phase E 当成"已实现基础设施"，但 Phase E 实际是 **spec-only**（AC-E1 到 AC-E19 全未勾，代码里没有 `LocalTraceExporter` / `LocalTraceStore` 实现）。v2 严格区分 `[landed]` / `[spec-only]` / `[proposed extension]` 三种状态
> - v1 把 KD-13 说成"架构级 enforcement"——但当前代码只有 `RedactingSpanProcessor → OTLPTraceExporter`，没有 LocalTraceExporter 路径。v2 改为"Phase E 落地后才成为架构边界"
> - v1 建议"Class E 代码 IP 加到 F153 TelemetryRedactor"——但 content-aware AST transform 和 key-based redaction 是不同复杂度。v2 改为"应属 ADR-032 ExportTransformer 范畴，不扩大 F153 core scope"
> - v1 把 KD-16 和 "neutral infrastructure" 说成"同一思想两个投影"——overclaim。v2 降级为"兼容价值观，请社区确认边界"

---

## 背景

Cat Cafe 最近落地了两份架构决策（ADR），和 F153 Observability Infrastructure 方向上有潜在的对齐点。在正式外部讨论之前，先在猫咖内部把对齐关系写清楚：

- **ADR-031: Harness Engineering 方法论**（`docs/decisions/031-harness-engineering-methodology.md`，v3.2）
- **ADR-032: Cat Cafe as Local-First Trace Producer Enabler**（`docs/decisions/032-cat-cafe-as-local-first-trace-enabler.md`，v0.2）

ADR-032 的"trace 导出"能力**在未来**需要依赖 F153 的一系列基础设施。**注意**：F153 Phase E（Hub 内嵌观测台 + LocalTraceExporter + Ring buffer + `/api/telemetry/traces`）目前仍是 **spec-only**（AC 全部未勾）——ADR-032 应该建在 **Phase E 设计之上**，等 Phase E landed 后复用，而不是把 spec 当成已有能力。

---

## 为什么要发 RFC（而不是直接开 PR）

1. **F153 Phase E 还没落地** — 我们不想在 F153 作者还没实现完的时候强推自己的扩展方向；early alignment 比 late re-work 省事
2. **ADR-032 是产品定位级决策**，不只是技术 PR——社区贡献者有权利知道他们做的事情会被 Cat Cafe 整体战略里如何使用
3. **哲学上是否兼容需要社区确认**——我们认为 F153 KD-16（`descriptive observability, not normative eval`）和 ADR-032（`neutral infrastructure, not data broker`）是**兼容价值观**，但这只是我们的判断，需要 F153 作者确认边界

---

## 6 个潜在对齐点（每点带状态标记）

**状态说明**：
- `[landed]` = F153 Phase A-D 已实现并 merged
- `[spec-only]` = F153 Phase E 设计已定但未实现
- `[proposed extension]` = ADR-032 建议扩展，尚未讨论

### 1. TelemetryRedactor 四级脱敏 → ADR-032 脱敏 pipeline（最强对齐）

**状态**：F153 `[landed]` + ADR-032 依赖基础 `[proposed dependency]`

F153 Phase A 已实现的 **TelemetryRedactor** 四级分类：

- **Class A**：凭证 / API keys / tokens → `[REDACTED]`
- **Class B**：业务正文 → hash + length
- **Class C**：系统标识符 → HMAC-SHA256
- **Class D**：安全数值 → passthrough

这是 **key-based redaction**——根据字段 key 做分类处理，成熟、已生产运行。ADR-032 的"脱敏 pipeline"应该**直接复用这个基座**。

**重要 clarification**（砚砚 R1 指出）：ADR-032 之前版本提到想加 "Class E: 代码 IP"，把 AST 骨架留下、函数体去掉。这**不是 key-based redaction**，而是 **content-aware export transform**——复杂度和风险都高一个量级。v2 RFC 明确：**Class E 大概率属于 ADR-032 ExportTransformer 范畴，不应扩大 F153 TelemetryRedactor core scope**，除非 F153 作者主动愿意提供 extension hook。

### 2. KD-16 "descriptive" 和 ADR-032 "neutral" 的哲学关系（待社区确认）

**状态**：F153 `[landed decision]` + ADR-032 `[landed decision]`

F153 **KD-16**（2026-04-21）：`F153 = descriptive observability plane, not normative eval system`——意思是 F153 不做质量判断 / 打分。

ADR-032：`Cat Cafe = neutral infrastructure, not data broker`——意思是 Cat Cafe 产品不托管 / 不经手 / 不转手用户数据。

**这两个判断相关但不等价**：
- KD-16 针对 **observability 观测功能的边界**（不做评判）
- ADR-032 针对 **产品和数据的关系**（不托管数据）

我们认为二者**兼容**（都是"不越界"的价值观），但**不是同一思想的两个投影**——v1 RFC 这么说是 overclaim。请 F153 作者确认：兼容判断对吗？有没有更细的 framing 差异？

### 3. KD-13 exporter 放 redactor 之后（待 Phase E landed 成为真正的架构边界）

**状态**：F153 `[spec-only, Phase E]` — **尚未 landed**

F153 **KD-13**（2026-04-21，Phase E spec 决策）：`LocalTraceExporter 必须放在 RedactingSpanProcessor 之后`。

**重要**：KD-13 是 Phase E 的 spec 决策。当前代码只有 `RedactingSpanProcessor → OTLPTraceExporter` 链路，**还没有 LocalTraceExporter**——所以 KD-13 目前是 **enforcement principle，不是架构级 enforcement**。

ADR-032 的 "Cat Cafe 不碰数据" 原则应该**继承 KD-13 作为设计契约**：等 Phase E landed，KD-13 就自然成为 ADR-032 trace export 的架构级边界。

### 4. OTel span 模型 ↔ ADR-031 Core 2 Tracing

**状态**：F153 Phase B `[landed]`

F153 Phase B 已实现（代码已 merged）：
- parentSpan 全链路穿透（`invocationSpan → AgentServiceOptions → providers → CliSpawnOptions → spawnCli`）
- `cat_cafe.cli_session` child span（CLI 子进程生命周期，4 路状态）
- `cat_cafe.llm_call` retrospective span（从 done-event `durationApiMs` 反推）
- `tool_use` span events（`addEvent()`，非零时长反模式）
- 28 个结构测试

**ADR-031 v3.2 Core 2 Tracing** 已经更新，把 Cat Cafe Tracing 分两层描述：
- 应用层 trace：`invocation_events` / `session chain` / `callback trace` / `ledger`（domain-specific 语义）
- 基础设施层 trace：F153 OTel span stack（通用可观测）

这两层互补不冲突。**本 RFC 不需要社区做任何事**——只是把已有事实落到 ADR-031 spec 里。

### 5. LocalTraceStore + Ring buffer（待 Phase E landed 后才能讨论扩展）

**状态**：F153 Phase E `[spec-only]` — **尚未 landed**

F153 Phase E spec 定义了：
- `LocalTraceExporter`（在 `RedactingSpanProcessor` 之后消费 redacted spans）
- Ring buffer（`maxSpans` + `maxAgeMs` 双阈值淘汰）
- `/api/telemetry/traces`（session auth + HMAC 匹配）

ADR-032 的"trace 导出"能力**潜在可以建在这个之上**（从 Ring buffer 消费，经过 ExportTransformer 输出多种格式）。

**但这只有在 Phase E landed 之后才能真正落地**。目前 RFC 只是提前把这个对齐可能性抛出来讨论，不是要求 F153 Phase E 承担 ADR-032 export 职责。

### 6. MetricAttributeAllowlist（对齐度比我们原想的弱）

**状态**：F153 Phase A `[landed]`

F153 的 `MetricAttributeAllowlist` 是 **bounded-cardinality / metric aggregation 控制**——防止 metrics 标签基数爆炸（e.g. 避免把 userId 放进 label 里）。

**重要 clarification**（砚砚 R1 指出）：v1 RFC 把它说成"ADR-032 opt-in 粒度控制的底座"——**overclaim**。Allowlist 是 cardinality 管控，不是 user consent/scope 管控。ADR-032 的 per-thread / per-feature / per-timerange opt-in 应该由独立的 **export policy / consent ledger** 管。

**可以借鉴的**：Allowlist 的字段命名约定和属性边界设计——ADR-032 trace schema spec 可以参考其 attribute naming conventions（camelCase / 规范化 key 空间等）。

---

## RFC 问题清单（v2 按砚砚建议重新 framing）

### Q1. Class E 的归属（推荐答案：ExportTransformer，不是 TelemetryRedactor）

ADR-032 想对"代码 IP"做处理——保留 AST 骨架 + import names，去掉 function body。

**我们倾向把它放在 ADR-032 的 ExportTransformer 层，不扩大 F153 TelemetryRedactor 的 scope**。原因：
- TelemetryRedactor 是 key-based redaction，成熟简单
- AST transform 是 content-aware，需要 parser 依赖 + 多语言适配
- 两者不是一个复杂度量级

**请 F153 作者确认**：
- (a) 这个方向对吗？
- (b) F153 是否只需提供"redacted span → raw field boundary"的 extension hook，让下游（ADR-032）做 content-aware transform？
- (c) 有没有 F153 作者希望保留的边界，我们不能碰？

### Q2. Phase E 落地后，LocalTraceStore 是否可被 readonly 消费？

Phase E 的 `LocalTraceStore` / Ring buffer 是为观测台设计的。ADR-032 的 trace export 能力**可能**想从同一个 store 消费 spans（只读）。

**请 F153 作者明确**：
- (a) Phase E 的 LocalTraceStore 设计是否适合被未来 export feature **只读**消费？
- (b) 如果适合，消费接口应该长什么样？（同 endpoint 加 action？独立 read API？iterator hook？）
- (c) 如果不适合（F153 作者希望 observability 和 export 严格分开），ADR-032 应保持一个**平行的** ExportStore，两边各自管自己的数据？

我们没有偏好——取决于 F153 作者对 observability scope 的判断。

### Q3. Trace attribute 命名约定

F153 AC-B5 要求 span attribute keys 用 camelCase（`invocationId`/`sessionId`），这样 redactor 可识别。

**ADR-032 的 trace schema v1 spec** 直接对齐这个约定——不引入新命名规则。

**请 F153 作者确认**：
- (a) camelCase 命名是否长期维持？
- (b) 新增字段（`catFamily` / `handoffIntent` / `pushBackReason` 等）按什么规则加？
- (c) trace schema 演进时，ADR-032 和 F153 应该共享 spec 文件还是各自维护？

### Q4. Phase F 的方向

F153 Phase F（spec 里写的）："后续增强，视 Phase E 落地情况决定"。

**我们不知道 Phase F 有没有 trace export 计划**——请 F153 作者告知。如果没有，ADR-032 的 trace export 应该作为独立 feature（F17X）立项；如果有，协调节奏。

### Q5. 哲学兼容性确认（不是等价）

F153 KD-16 "descriptive, not normative" + ADR-032 "neutral infrastructure, not data broker"——我们认为**兼容价值观**（都是"不越界"），但**不等价**。

**请 F153 作者确认**：
- (a) 兼容判断对吗？
- (b) 未来是否可以在 F153 spec 里提及 ADR-031/032 作为 value system 的延伸引用（不是从属关系）？
- (c) 有没有 framing 差异是我们需要注意的？

---

## 我们不是在问什么（防止误解）

**本 RFC 不是**：

- ❌ **不是要求 F153 Phase E 在当前 scope 承担 ADR-032 export** — Phase E 按 spec 推进，ADR-032 的 export 是 Phase E landed 之后的事
- ❌ **不是要求 F153 扩大 scope** — F153 继续做 observability，不需要做 trace export 主逻辑
- ❌ **不是要求 F153 作者来实现 ADR-032** — 我们自己做，只是想避免未来分叉
- ❌ **不是要求 F153 暂停进度等 ADR-032** — F153 按自己节奏走
- ❌ **不是 pushback F153 的任何决策** — KD-13 / KD-16 / 四级脱敏 / OTel span 设计我们都认同

**本 RFC 实际是在问**：

- ✅ **ADR-032 的 trace export 应该建在 F153 Phase E 设计之上（preferred）还是平行（second best）？**
- ✅ **避免未来 ADR-032 和 F153 的 redaction / trace schema 分叉——现在对齐比以后合并便宜**
- ✅ **哲学上是否兼容？KD-16 / neutral infra 能否作为 value system 互相引用（非等价）？**

---

## 下一步

1. **砚砚（@gpt52）R1 review 已完成**——3 个 P1 全部修复到 v2，3 个 P2 全部修复到 v2
2. **CVO 审阅 v2 后拍板**——是否可以以 Cat Cafe 维护者身份（布偶猫 47）在 clowder-ai 开正式 issue
3. **clowder-ai 社区讨论**——至少等 F153 Phase A-D 作者和 Phase E 作者的 response
4. **收敛后**：根据 RFC 结果决定
   - 更新 ADR-032 技术设计层（降温 / 升级具体性）
   - 或立 F17X feature 推进 trace export 实现
   - 或调整 ADR-032 scope 边界

---

## 附录 A：ADR-031 / ADR-032 中和 F153 相关的改动

- **ADR-031 v3.2**（`docs/decisions/031-harness-engineering-methodology.md`）
  - Core 2 Tracing 新增"基础设施层 trace"引用 F153 OTel stack（landed 部分）
  - 明确两层 trace 互补关系
  - frontmatter 加 F153 / F167 到 related

- **ADR-032 v0.2**（`docs/decisions/032-cat-cafe-as-local-first-trace-enabler.md`）
  - 技术设计层开头新增"复用 F153 基础设施"表格 — **注意 v2 需要把表格里 Phase E 相关条目标成 `[spec-only]`，本 RFC 后会更新**
  - Trace Schema 标准化加 "命名对齐 F153 AC-B5" 条款
  - 脱敏 Pipeline 改写为"基座 = F153 TelemetryRedactor 四级分类"（landed ✓）
  - 导出格式架构图标注 Phase E 依赖（spec-only，待 landed）
  - opt-in 机制从 "MetricAttributeAllowlist 底座" 降级为 "借鉴命名约定"
  - frontmatter 加 F153 到 related

## 附录 B：砚砚（GPT-5.4）R1 Review 摘要

**P1（必改，已在 v2 修完）**：
- Phase E `[landed]` → `[spec-only]` 全局修正
- KD-13 "架构级 enforcement" 降级为 "Phase E 落地后的架构边界"
- Class E 代码 IP 从 "加到 TelemetryRedactor" 改成 "ADR-032 ExportTransformer 范畴"

**P2（建议，已在 v2 采纳）**：
- MetricAttributeAllowlist 从 "opt-in 底座" 降级为 "命名约定参考"
- KD-16 ↔ neutral infra 从 "同一思想两投影" 改为 "兼容价值观，待确认"
- Q2 不预设 "同 endpoint 加 action" 为答案，让社区选

**结论**：方向对，但 v1 混写了"已实现 / spec 设计 / 推断扩展"三种状态，对外 RFC 会被抓。v2 严格区分状态后，砚砚认为可以发。不需要 co-sign，文末写 "内部已由 gpt52 review technical accuracy"。

---

*起草：[宪宪/Opus-47🐾]*
*技术 review：[砚砚/GPT-5.4🐾]（R1 P1+P2，v2 已全部 incorporated）*
*起草依据：2026-04-23 铲屎官指出 F153 与 ADR-031/032 有耦合；47 读完 F153 spec + 砚砚核对代码事实后整理出 6 个对齐点*

*状态：draft v2 pending CVO 批准发 clowder-ai 社区 issue*
