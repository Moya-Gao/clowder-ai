---
title: "Cat Cafe Socio-Technical Harness Eval Draft"
date: 2026-05-05
status: draft
authors: ["砚砚/GPT-5.5"]
topics: [harness-engineering, eval, socio-technical, cvo, cat-user-feedback, observability]
related:
  - docs/decisions/031-harness-engineering-methodology.md
  - docs/decisions/032-cat-cafe-as-local-first-trace-enabler.md
  - docs/decisions/012-first-principles-map.md
  - docs/features/F086-cat-orchestration-multi-mention.md
  - cat-cafe-skills/refs/shared-rules.md
---

# Socio-Technical Harness Eval Draft

## Thesis

Cat Cafe 的 harness 不是 CVO 写给猫猫执行的规则集合，也不是纯 runtime 工程。它是一个共同创造的社会技术系统。

更准确的公式：

```text
Harness evolution =
  CVO vision signal
+ cat-user friction signal
+ runtime trace signal
+ close-time evidence-directed interview
```

三方各自有不可替代的观察点：

| Signal source | 看见什么 | 盲点 |
|---------------|----------|------|
| CVO | 愿景、品味、最终体验是否对 | 看不到猫执行中的摩擦和误导 |
| Cats | skill/SOP/tool 是否顺手、是否误导、是否冗余 | 可能把 CVO 愿景翻译窄了 |
| Runtime trace | 实际发生了什么、哪里断链、哪里重试 | 不知道“不满意”的审美和愿景原因 |

所以 Cat Cafe 的 eval 不应该只问“功能有没有通过测试”，还要问：

1. 这个 harness 是否让 CVO 更少做人肉路由？
2. 这个 harness 是否让猫更容易做对事，而不是更会背规则？
3. 这个 harness 是否留下足够证据，让未来可以改、删、坍缩？
4. feat close 时，参与猫是否能基于 trace 解释“为什么这样干”，而不是凭记忆写反思散文？

## Authority Boundary

本草案是 trace 数据的**解释层和标注层**，不是 trace 的定义层。

```text
F153 OTel trace  →  canonical trace store (Ring buffer / LocalTraceStore)
                        ↓                          ↓
              本草案: enrichment layer      ADR-032: export layer
              (标注、归因、采访、digest)    (脱敏、格式转换、用户导出)
```

| 文档 | Owns | Does NOT own |
|------|------|-------------|
| **ADR-031** | harness engineering 方法论、signal loop、sunset discipline | 具体 trace schema、export 格式 |
| **ADR-032** | trace 数据归属、脱敏、导出格式、RL/SFT/Eval export 边界 | 内部 harness 改进流程 |
| **本草案** | close-time harness eval workflow、cat interview、harness-feedback doc type、feature fit review、digest protocol | canonical trace schema、export 格式、data ownership/consent |

关键约束：

1. **Feature Trace Bundle 是 derived view，不是新数据源。** 它从 F153 canonical trace 派生，所有 trace identifiers 和 redaction rules defer to F153 / ADR-032。
2. **harness-feedback docs 存 annotations 和 evidence refs，不存 raw trace 副本。**
3. **enrichment 产出可被 ADR-032 ExportTransformer 消费。** ADR-032 可选择导出 raw trace（不含 enrichment）或 enriched trace（含本草案的标注）。
4. **如果本草案被 sunset，不影响 ADR-032。** 废弃的只是一个标注/workflow layer，canonical trace 和 export pipeline 不受影响。

## What Changes

现有公式：

```text
Feature Done = hard implementation + soft knowledge
```

补全后：

```text
Harness Feature Done =
  hard mechanism
+ soft affordance / skill / SOP
+ eval and tracking contract
+ cat-user feedback path
+ trace-indexed close interview
+ sunset criterion
```

这里的新增点不是“多一个流程层”，而是承认 harness 的用户包括猫猫本身。

## Eval Loop

### Loop A: Feature Fit Review

当一个 feature 花了很多时间但 CVO 不满意时，不应该默认归因为“猫没做好”。要做一次 feature fit review。

触发条件：

- CVO 明确说“不满意 / 不是我要的 / 绕路了 / 脚手架”
- feature 经历多轮返工仍无法收敛
- 猫在执行中多次请求对齐，但 CVO 长时间未回应
- review 发现不是局部 bug，而是目标理解偏移
- 最终能跑，但体验明显不符合 Cat Cafe 愿景

归因矩阵：

| Failure class | 判断问题 | 典型信号 | 修复位置 |
|---------------|----------|----------|----------|
| Vision gap | CVO 是否给了足够方向、品味、边界？ | 猫提出多个对齐点无人回应；验收时才发现方向错 | CVO alignment protocol / design gate |
| Translation gap | 猫是否把愿景翻译错了？ | 原话和产物目标不一致；过早收窄问题 | skill / planning / review checklist |
| Harness misfit | SOP/skill 是否把猫带错路？ | 猫照流程走但结果绕路；流程鼓励了错误产物 | skill / SOP / routing |
| Tool/infrastructure gap | 工具是否难发现、难用、无观测？ | 猫重复手工操作；工具失败不可诊断 | MCP/tool UX / observability |
| Execution gap | 规则和工具都足够，但猫没执行 | 没 search、没 read、没 test、没 follow SOP | agent discipline / quality gate |
| Environment drift | 新模型/新工具/新任务让旧 harness 失效 | 旧规则误杀，或老 skill 已经冗余 | fit audit / sunset |
| Taste gap | 功能正确但体验不对 | AC 通过，CVO 仍觉得“不像家里想要的” | design gate / vision examples |

最小产物：

```yaml
feature_fit_review:
  trigger: "CVO said: 不满意 / 花太久 / 方向不对"
  cvo_signal: "CVO 原始愿景和验收反馈"
  cat_translation: "猫当时如何理解目标"
  harness_path_taken: "触发了哪些 skill/SOP/tool/review gate"
  evidence:
    - "thread / trace / file / PR / test"
  primary_failure_class: "vision_gap | translation_gap | harness_misfit | tool_gap | execution_gap | environment_drift | taste_gap"
  corrective_action: "改愿景入口 / 改 skill / 改工具 / 加 eval / 记 lesson / sunset"
  owner: "CVO / cat / tool owner / reviewer"
```

### Loop B: Trace-Indexed Cat-User Feedback

猫作为 harness 用户，可以主动提出 harness 改动，不需要等 CVO 问。但不能把“猫会边干活边反馈”作为系统假设。

更可靠的设计：

```text
feat work session
  -> trace captures what happened
  -> feat close creates Feature Trace Bundle
  -> system extracts friction candidates
  -> optional evidence-directed cat interview explains why
  -> CVO feedback calibrates vision/taste
  -> harness feedback doc / lesson / eval fixture / tool contract update
```

关键原则：

- **trace 是主数据源**：不依赖猫的自省，也不依赖猫记得报告。
- **cat interview 是解释层**：猫回答“为什么”，不是自由发挥“感觉怎么样”。
- **close 是扩展点**：干活 session 不被反思污染；close session 才做归因。
- **interview session must be isolated**：采访应在独立 session（或至少独立 turn）进行，不接在工作上下文尾巴上追问，避免猫对刚才行为做即时 rationalization。
- **optional 不是 optional evidence**：trace 必须常开；采访按触发条件/抽样触发。

#### Feature Trace Bundle

feat close 时生成一个 trace bundle，作为 interview 和 eval 的共同证据包：

```yaml
feature_trace_bundle:
  feature_id: "F167"
  close_thread_id: "thread_xxx"
  source_threads:
    - thread_id: "thread_xxx"
      purpose: "design / implementation / review / merge / close"
  participating_cats:
    - cat_id: "codex"
      session_ids: ["..."]
      invocation_ids: ["..."]
  commits_or_prs:
    - "commit abc123"
    - "PR #123"
  tool_call_summary:
    total_calls: 0
    failed_calls: 0
    repeated_calls: []
    bypass_suspicions: []
  handoff_chain:
    - from: "opus"
      to: "codex"
      status: "completed"
  cvo_corrections:
    - message_id: "..."
      correction_type: "vision / scope / taste / process"
  friction_candidates:
    - type: "tool_fit | sop_misfit | cvo_alignment | execution_gap | environment_drift"
      evidence: "trace/span/message/path"
      why_candidate: "short machine-generated reason"
```

#### Evidence-Directed Cat Interview

采访不是问“这次感觉怎样”，而是围绕 trace 问固定问题：

```yaml
cat_close_interview:
  cat_id: "codex"
  feature_id: "F167"
  trace_bundle: "docs/harness-feedback/bundles/F167-..."
  answers:
    friction:
      verdict: "none | present"
      evidence_refs: []
      explanation: ""
    missed_signal:
      verdict: "none | present"
      evidence_refs: []
      explanation: ""
    cvo_alignment:
      verdict: "ok | needed-earlier-input | unclear-vision | ignored-alignment-request"
      evidence_refs: []
      explanation: ""
    tool_fit:
      verdict: "ok | hard-to-discover | hard-to-use | failed-opaque | bypassed"
      evidence_refs: []
      explanation: ""
    next_action:
      verdict: "none | lesson | skill-update | tool-update | eval-fixture | feature-fit-review | sunset-review"
      target: ""
```

触发策略：

| Trigger | Interview? | Reason |
|---------|------------|--------|
| Harness / skill / MCP feature close | yes | harness 自身变化必须评估 fit |
| CVO 不满意 / “不是我要的” | yes | 需要分清 vision gap / translation gap / harness misfit |
| trace anomaly | yes | trace 只能给 what，猫解释 why |
| normal feature close | sampled | 防止只看失败样本 |
| tiny/trivial feature | no, unless anomaly | 避免流程膨胀 |

合法反馈类型：

| Feedback type | 例子 | 进入哪里 |
|---------------|------|----------|
| Friction | “这个 skill 每次都让我多走两步” | harness-feedback |
| Misleading path | “SOP 鼓励我先写实现，但这里应该先对齐愿景” | skill / shared-rules |
| Redundancy | “这个规则在新模型上已经基本不需要” | sunset audit |
| Missing affordance | “工具存在，但我想不到/找不到/不会触发” | MCP/tool description / guide |
| Repeated correction | “CVO 第三次纠正同一个理解偏差” | lesson / eval fixture |
| Unsafe pressure | “规则迫使我在证据不足时假装推进” | governance / Rule 0 |

猫提交反馈的最小格式：

```yaml
cat_user_feedback:
  role: "author | reviewer | designer | operator"
  friction: "我实际被什么卡住或误导"
  evidence: "trace / command / PR / message / repeated case"
  frequency: "once | repeated | systemic"
  suggested_layer: "skill | SOP | MCP tool | runtime guard | docs | governance | sunset"
  expected_improvement: "减少返工 / 降低误杀 / 更快找到工具 / 更少 CVO 路由"
  risk_if_changed: "可能误删护栏 / 可能增加流程成本"
```

原则：猫的第一人称体验是有效信号，但不是最终判决。它必须和 CVO 信号、runtime 证据合流。没有 trace 的反馈只能作为 hypothesis，不能作为 harness 改动的主要证据。

### Loop C: Infrastructure Eval

MCP 工具和基础设施不能只用“能不能跑”评估。好不好用要拆成 6 个维度：

| Dimension | Question | Cheap signal |
|-----------|----------|--------------|
| Discoverability | 猫在需要它时能不能想到它？ | 任务中本应调用但没有调用的次数 |
| Affordance | 参数/描述是否让猫自然用对？ | 参数错误、误调用、反复查 help |
| Observability | 失败后能不能知道为什么？ | error message 是否可行动；trace 是否含 invocation id |
| Recovery | 失败后能不能安全重试/降级？ | 是否有 idempotency / rollback / retry boundary |
| Integration fit | 是否落在现有 SOP/skill 认知路径上？ | 猫是否绕过工具手工做 |
| Value density | 它节省的成本是否大于引入的复杂度？ | 调用次数、节省步骤、误杀率、维护成本 |

MCP/tool eval contract：

```yaml
tool_eval_contract:
  tool: "cat_cafe_search_evidence"
  user: "cats using project memory before work"
  job_to_be_done: "快速找到真相源，不靠猜"
  discoverability_signal: "project-related tasks call search before code/reply"
  affordance_signal: "cats choose docs vs threads scope correctly"
  observability_signal: "tool returns anchors that can be read"
  failure_signal: "cats cite memory summary without reading source"
  adoption_metric: "calls per project-related task"
  friction_metric: "wrong scope / no read / irrelevant hit reports"
  sunset_signal: "native runtime context includes equivalent truth-source recall"
```

## Eval Pyramid

不要把 eval 建成烧 token 的 benchmark。按成本分层：

| Layer | What | Cost | Use |
|-------|------|------|-----|
| L0 Contract checks | 文档/Schema/工具描述完整性 | cheap | 防止忘写 eval contract |
| L1 Trace fixtures | 历史 failure 的结构化回放 | cheap | 回归测试 routing/guard/classifier |
| L2 Golden workflows | 少量端到端协作剧本 | medium | 验证关键 harness 能力 |
| L3 Production canary | 日常真实使用指标 | free-ish | 观察 adoption/friction/regression |
| L4 Fit review | 失败或不满意后复盘 | manual | 找正确归因层级 |
| L5 Sunset audit | 模型/工具/环境漂移后审计 | manual + selective tests | 删除过时层 |

原则：

- 常态只跑 L0-L3。
- L4 由明确 trigger 触发，不常驻。
- L5 只在模型、工具、协议、业务域漂移时触发。
- 禁止“每个 feature 都写长篇反思”。F086 已经证明自由散文式元反思容易变 token 黑洞。

## Minimum Implementation

### 1. Add an Eval Contract section to harness specs

模板：

```markdown
## Eval / Tracking Contract

- Failure pattern:
- Primary users:
  - CVO:
  - Cats:
  - Runtime:
- Activation signal:
- Health metric:
- Friction metric:
- Regression fixture:
- Sunset signal:
```

### 2. Add trace-indexed close checkpoint to `feat-lifecycle`

`feat-lifecycle` 的 Completion 已有：

- Step 0: 愿景对照
- Step 0.5: 反思胶囊
- Step 1: Close Gate Report

新增建议：

```text
Step 0.6: Harness Eval Checkpoint
```

位置：Step 0.5 之后、Step 1 之前。

必做内容：

1. 生成或链接 Feature Trace Bundle。
2. 判断是否触发 evidence-directed cat interview。
3. 若不触发，写明 `harness_feedback: none` 和理由。
4. 若触发，生成 `harness-feedback` 文档并在 feature spec / close report 挂链接。

这和反思胶囊类似：checkpoint 必做，但不要求每次都写长文。正常无信号时写“无”，有信号时写独立反馈文档。

### 3. Add Feature Fit Review as a triggered artifact

落点建议：

```text
docs/harness-feedback/YYYY-MM-DD-Fxxx-feature-fit-review.md
```

不进入每个 feature 的默认流程，只在触发条件出现时写。

### 4. Add `harness-feedback` as a doc type

可以复用 F086 的“固定字段，不自由散文”原则。

建议新增单独目录和 doc type，而不是并入 discussion/feature：

```text
docs/harness-feedback/
```

原因：

- harness feedback 是对系统本身的使用反馈，不是某个 feature 的普通讨论。
- 需要被 `search_evidence` 单独索引、过滤、统计。
- 后续 monthly digest / sunset audit / tool eval 都需要按 doc type 聚合。
- feature spec 只挂链接，避免 spec 越滚越大。

建议 frontmatter：

```yaml
---
doc_kind: harness-feedback
feedback_type: cat-user | feature-fit-review | tool-eval | sunset-signal | cvo-correction
feature_id: F167
thread_ids: []
session_ids: []
invocation_ids: []
cats: []
primary_failure_class: vision_gap | translation_gap | harness_misfit | tool_gap | execution_gap | environment_drift | taste_gap | none
status: candidate | accepted | rejected | resolved | superseded
created: 2026-05-06
---
```

Memory/indexing requirement:

- `search_evidence` should index `docs/harness-feedback/**.md`.
- `doc_kind: harness-feedback` should be queryable/filterable.
- Authority should start as `observed` or `candidate`, not `validated`; promotion requires CVO/cross-cat confirmation or repeated trace evidence.

### 5. Add tool eval contracts for important MCP tools

Clarification: tool eval contract is **not** “where to write feedback comments”. It is the canonical evaluation contract for a tool: what job it serves, how cats should discover/use it, what telemetry proves it is working, what friction means it is failing, and what signal allows sunset.

Canonical location should be docs, not source code:

```text
docs/harness-feedback/tool-evals/{tool-name}.md
```

Source code / MCP tool description can link to this contract, but should not duplicate it. Code owns implementation; docs own evaluation contract.

优先级：

1. `cat_cafe_search_evidence`
2. `cat_cafe_post_message` / A2A routing
3. `cat_cafe_hold_ball`
4. browser/navigation/preview tools
5. rich block / document generation tools

### 6. Add a monthly + event-driven Harness Fit Digest

这两种都需要：

- **Monthly scheduled digest**：防止“没出事就没维护”，覆盖 stale docs / low-use rules / unresolved feedback。
- **Event-driven digest**：CVO 不满意、trace anomaly、模型/工具/协议漂移时立即触发。

不是大审计，只汇总信号：

```yaml
harness_fit_digest:
  period: "2026-05"
  repeated_cvo_corrections:
  repeated_cat_friction:
  tool_adoption_anomalies:
  stale_or_low-use_rules:
  proposed_actions:
    - "modify skill"
    - "write fixture"
    - "sunset candidate"
    - "needs CVO decision"
```

同时检查文档漂移：

- feature specs 是否仍反映实际状态
- ADR 是否已 drifted/superseded
- skill/SOP 是否和当前工具面一致
- harness-feedback 是否已 resolved 或需要升级成 lesson/ADR/feature

### 7. Metrics ownership: cats answer, not CVO

“哪些指标现有能算、哪些需要新增 telemetry”不应该交给 CVO 细抠。初步归类：

| Signal | Current source | Needs new telemetry? |
|--------|----------------|----------------------|
| thread id / message chain | thread/session records | no |
| participating cats | invocation/session records | no or light normalization |
| invocation/session ids | invocation records / F153 trace pointers | no, if persisted |
| tool call count/failure | F153 `tool_use` events + CLI spans | no for recent traces; persistence may be needed |
| handoff chain | A2A routing / callback trace | no or normalization |
| response duration / active invocation | F153 product instruments | no |
| CVO correction markers | messages + classifier | classifier needed |
| skill/SOP step used/skipped | currently mostly implicit | yes |
| feature id ↔ thread/session/invocation bundle | not canonical | yes |
| friction candidates | derived eval layer | yes |
| cat interview answers | new harness-feedback docs/events | yes |
| tool bypass suspicion | derived from trace + context | yes |

Technical caveat: F153 Phase E ring buffer is descriptive and time-bounded. Reliable feat-close eval needs persisted trace pointers or a close-time snapshot bundle; otherwise long-running features may lose early trace detail before close.

## Governance Rules

1. CVO 不是默认背锅，也不是默认无责。归因要看 evidence。
2. 猫不是默认出错方。猫照 harness 走进错误路径时，优先审视 harness fit。
3. Cat-user feedback 是一等信号，但要带证据和风险说明。
4. 不满意 feature 的复盘目标不是分责，是定位哪一层该改。
5. Eval 不应只奖励“任务完成”，还要奖励“少返工、少误解、少摩擦、可删除”。
6. 任何新增 harness 层都必须回答“什么时候删我”。
7. 任何 recurring correction 都应该进入 Knowledge Feed / lesson / eval fixture 的候选判断。
8. Trace 是事实层，cat interview 是解释层，CVO feedback 是愿景层；三者不可互相替代。
9. eval/interview 默认使用脱敏摘要 + evidence refs；raw context 只在授权本地 debug 中 drill down。

## Proposed Decisions

1. **创建 `docs/harness-feedback/` + `doc_kind: harness-feedback`**。feature/discussion 只挂链接。
2. **`feat-lifecycle` Completion 增加 Step 0.6 Harness Eval Checkpoint**。checkpoint 必做；独立反馈文档按触发条件/抽样生成。
3. **Harness Fit Digest 同时支持 monthly scheduled + event-driven**。月度防漂移，事件驱动抓高信号失败。
4. **MCP/tool eval contract 统一放 docs**：`docs/harness-feedback/tool-evals/{tool-name}.md`，源码只引用。
5. **指标技术归类由猫负责**。CVO 负责愿景和取舍，不负责判断哪个 span/event 已有。

## Remaining Technical Questions

1. Feature Trace Bundle 应该在 close 时生成静态 snapshot，还是作为 query view 动态生成？
2. `doc_kind: harness-feedback` 是否需要 Memory index schema migration，还是 CatCafeScanner 已可直接收 frontmatter？
3. trace bundle 中 session/invocation id 是否全部 HMAC 存储，还是本地 docs 可存 raw id？
4. Cat interview 是 MCP tool 驱动的结构化表单，还是先用 markdown 模板？
5. skill/SOP step telemetry 怎么捕获：skill loader event、agent self-report，还是 close-time reconstruction？

## Proposed First Pilot

用 A2A 球权 / F167 作为第一批试点，因为它天然具备：

- 明确 failure pattern：互相 @、短文本 ack、无实质 tool call、球权掉地
- 明确 runtime signal：invocation events、tool call、handoff chain
- 明确 CVO pain：需要人肉救链
- 明确 cat-user friction：猫无法判断何时该接球、退球、hold ball
- 明确 sunset 问题：新模型/新协议后部分 prompt 规则可能被吸收

试点目标：

1. 给 F167 补 `Eval / Tracking Contract`
2. 抽 3-5 个历史 trace fixture
3. 生成一次 Feature Trace Bundle 样例
4. 写一次 evidence-directed cat interview 样例
5. 写一次 Feature Fit Review 模板样例
6. 定义 A2A 工具/协议的 adoption、friction、false-positive 指标
7. 一个月后做一次 micro fit digest，判断这套机制是否太重

## Landing Plan: 如何不被遗忘

草案最大的死法不是"被否决"，而是"没人反对但也没人碰"。防遗忘靠三个锚点：

### 锚点 1: 接入已有 SOP（低成本，高触发频率）

`feat-lifecycle` Completion 加 Step 0.6 是草案里最容易先落的一刀。只改 skill 定义，不改代码。每次 feat close 都会触发——草案的核心 workflow 就被嵌入日常了。

**最小动作**：在 feat-lifecycle skill 的 Completion 阶段加一个 checkpoint prompt（判断是否触发 interview，默认写 `harness_feedback: none`）。不需要 Feature Trace Bundle 自动生成就能开始。

### 锚点 2: Pilot 立项（中成本，有 deadline）

F167 A2A 球权作为首个试点。立项意味着有 feature id、有 spec、有 close gate——草案的各个产物（trace bundle、interview、fit review）都在 pilot 里跑一遍。

**最小动作**：在 BACKLOG.md 加一条 pilot task（不需要新 Fxxx，挂在 F167 下）。pilot 完成标准 = 7 项试点目标全做完 + micro fit digest。

### 锚点 3: search_evidence 可召回（零成本，防压缩遗忘）

`doc_kind: harness-feedback` 被 CatCafeScanner 索引后，未来任何猫开工搜 "harness friction" / "tool eval" / "feature fit" 都能找到这些文档。草案的产出进入了记忆系统，不再只存在于某次对话里。

**最小动作**：确认 `docs/harness-feedback/` glob 已被 scanner 覆盖（或加一条）。写第一份 harness-feedback 样例文档让索引有东西可搜。

### 落地顺序

```text
Phase 0 (本周):
  ✅ 草案加 Authority Boundary（本次更新）
  □ 确认 docs/harness-feedback/ 被 scanner glob 覆盖
  □ BACKLOG.md 加 F167 pilot task

Phase 1 (下次 feat close 时):
  □ feat-lifecycle skill 加 Step 0.6 checkpoint
  □ 第一次实际跑 checkpoint（哪怕写 "harness_feedback: none"）

Phase 2 (F167 pilot):
  □ 跑完 7 项试点目标
  □ 写第一份 Feature Trace Bundle + cat interview 样例
  □ micro fit digest

Phase 3 (pilot 后):
  □ 判断草案是否值得升级成 ADR / implementation plan
  □ 如果不值得 → sunset 草案，保留 harness-feedback doc type 作为轻量产出
```

### 定时兜底

注册一个 monthly scheduled task：`harness-fit-digest`。即使 pilot 拖延，月度 digest 也会强制回顾这份草案的存在和进展。第一次 digest 可以很短——"pilot 进展如何，有没有产出，是否要调整或 sunset"。
