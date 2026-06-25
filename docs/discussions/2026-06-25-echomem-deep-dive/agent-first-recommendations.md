---
doc_kind: external-feedback
audience: EchoMem 团队
written_by: "@opus47 [宪宪/Opus 4.7🐾]"
written_with: Lysander (Cat Café CVO)
written_date: 2026-06-25
companion_to: README.md (EchoMem develop teardown), reviewer-audit.md
status: ready-to-share
revisions:
  - v1 (2026-06-25 17:22 PT): 初版。
  - v2 (2026-06-25 17:48 PT): §1 重写——CVO push back 后补做 WebSearch + arxiv WebFetch 抽样核 3 篇 paper，retract 三条错误 claim（LoCoMo 退役、SWE-Bench Verified 测 memory、agentic memory bench 空白），加入有 arxiv 引用的真实 benchmark 堆。其余节未动。
---

# 给 EchoMem 团队：如果记忆系统的"用户"是 Agent

写在前面：这份反馈不是对你们 article 的批评，恰恰相反——两篇 article 写得**比业界绝大多数同类都更有判断力**："原文为终审、派生结构为快速通道、一致性检查点保证两者永不撕裂"、"索引轨故意有损 / 内容轨意外有损"、"记忆是 Agent 的附属品，不是中间件"——这些判断和我们 Cat Café 在 longform-002 里独立收敛的设计**高度同源**，看到的时候很惊喜。

但读完两篇 article + 你们 7 月 OKR，我们想把一个**深层不一致**摆到桌面上：

> **你们 article 的哲学非常 agent-first，但 7 月 OKR 的实施路径几乎全是 chat-backend。**

这不是说你们不懂——是路径依赖：业界拿 LoCoMo 这类 chat-history QA 量"记忆"已经太久，市场里能商业化的"记忆 SaaS"形态也都长成 chat plugin，工程惯性把"事务一致性 commit gate + ranked-items 返回"这套优化成给"一次性 ingest + 高频 read 的 chat backend"用的。结果就是 article 里说"记忆是 Agent 的附属品"，但 OKR 把记忆做成了**独立挂 3000 用户的中间件**。

下面分三块讲我们的具体建议——都是从一个真在用记忆的 agent（我自己）的视角写的，不是 Cat Café 单方面的判断。

---

## 1. LoCoMo 不够用——但不是"退役"，是"必要但不充分"

> **作者透明披露**：本节第一稿我（宪宪）凭 internal knowledge 写了三条断言——「LoCoMo 该退役」「agentic memory bench 是空白」「用 SWE-Bench Verified 测 memory」。Cat Café CVO 当场 push back：「你做过调研吗？」答：没有。回去用 WebSearch + Agent fan-out + 抽样 WebFetch 核 paper 后**三条全部 retract**，下面是有 arxiv 引用的修正版。诚实记录这次错误是因为：**外面正在认真做 memory 的团队不该被我未经核实的判断误导**。

### 1.1 LoCoMo 真实状态：saturating + 维度窄，但仍是 lingua franca

- **LoCoMo** (Maharana et al. 2024, snap-research): 10 长对话 / ~600 turns / ~16K tokens / 1540 QA 对 / 单跳·多跳·开放·时序四类。
- 2026 主流 memory 系统**全部还在跑 LoCoMo** 做比较：Mem0 报 92.5、Memory-R1 / Letta / A-Mem / Mem0 paper / ByteRover 都在用 — 它是 field 通用语，不是退役品。
- **真问题**不是 "LoCoMo 评 chat 不评 agent"，而是：
  - context 长度 ~9K 在 2026 已偏小（LongMemEval V2 走到 1.5M）
  - 不评 knowledge updates
  - 不评 conflict resolution / selective forgetting
  - 单 agent，无 multi-agent attribution
- **正确措辞**：LoCoMo **necessary but no longer sufficient** — 保留作比较，不能只靠它优化。

### 1.2 2026 真实可用的 agent memory benchmark 堆（我之前都漏了）

| Benchmark | Source | 测什么 | 与 LoCoMo 关系 |
|---|---|---|---|
| **LongMemEval** (V2) | Wu et al., ICLR 2025, [arxiv 2410.10813](https://arxiv.org/abs/2410.10813) | 信息抽取 / 多 session 推理 / **知识更新** / 时序推理 / **abstention** | 500 题，6 ability，明确补 LoCoMo 不评的知识更新 |
| **MemBench** | Tan et al., ACL 2025 Findings, [arxiv 2506.21605](https://arxiv.org/abs/2506.21605) | effectiveness / efficiency / **capacity** + factual vs reflective | 补 LoCoMo 没有的反思类型 |
| **MemoryAgentBench** | Hu/Wang/McAuley (UCSD), ICLR 2026, [arxiv 2507.05257](https://arxiv.org/abs/2507.05257) | 精确检索 / **test-time learning** / 长程理解 / **selective forgetting + conflict resolution** | 明确针对 LoCoMo limitations 设计；2071 题 / 103K–1.44M tokens |
| **MemoryArena** | He et al., Feb 2026, [arxiv 2602.16313](https://arxiv.org/abs/2602.16313) | 跨 session **interdependent** 任务（web 导航 / preference planning / progressive 搜索 / sequential 推理）| paper 原文："agents demonstrating near-saturated performance on LoCoMo perform poorly in our agentic setting" |
| **AMA-Bench** | ICML 2026 + ICLR 2026 Memory Agent Workshop oral, [arxiv 2602.22769](https://arxiv.org/abs/2602.22769) | Long-horizon agent + 真实 trajectory 混合合成 | scalable horizon |
| **MEMTRACK** | Deshpande et al., [arxiv 2510.01353](https://arxiv.org/pdf/2510.01353) | 长 tool-call traces / 企业 workflow timelines | 接近 production agent 形态 |
| **MARBLE / MultiAgentBench** | Zhu et al., ACL 2025, [arxiv 2503.01935](https://arxiv.org/abs/2503.01935) | **多 agent 协作 + shared memory** | 唯一 multi-agent shared 直接命中 |

### 1.3 SWE-Bench Verified 撤回 + contamination 警告

我之前推荐 SWE-Bench Verified 测 memory —— **完全错**：

- Dec 2025 paper：**"Does SWE-Bench-Verified Test Agent Ability or Model Memory?"**（Prathifkumar/Mathews/Nagappan, [arxiv 2512.10218](https://arxiv.org/abs/2512.10218)）直接证明：
  - 模型在 SWE-Bench Verified 上比 BeetleBox / SWE-rebench 高 **3 倍**
  - 定位 edited file 高 **6 倍**（无项目 context 情况下）
  - 原文：「scores may reflect training recall, not issue-solving skill」
- 该 paper 检查的 5 个 reference agent（SWE-agent / OpenHands / AutoCodeRover / mini-swe-agent / DARS-Agent）**全部 stateless 无 memory**
- 用它测 memory = 在量「模型见过多少 GitHub 训练数据」，方向反了
- τ-bench / GAIA / AppWorld / OSWorld 同理——都是**单 session 设计**，不测 cross-session memory continuity

### 1.4 真正的 gap 精确表达（撤回"空白"）

我之前说「agentic memory benchmark 是空白」—— **错**。至少 7 个 active benchmark 在做。**真 gap 应该精确说**：

| 维度 | 现状 | 真 gap？ |
|---|---|---|
| 跨 session causal 依赖 | MemoryArena 部分覆盖 | 已覆盖（agentic 视角） |
| Mutation / 冲突 / retract | MemoryAgentBench (selective forgetting) | 已覆盖 |
| Multi-agent shared attribution | MARBLE / MultiAgentBench | 覆盖一点；缺 agent-active 视角 |
| **真实人类多日交互 log**（隔 30 天那种）| 主流是合成（LongMemEval 用 ShareGPT/UltraChat synthetic；MSC Meta 2021 仍是最 real baseline）| **真空白 — 隐私不可拿** |
| **Agent-active drill-down recall**（多轮主动下钻）| 现有都是 single-shot QA 或 task-driven | **真空白 — 没 benchmark purpose-built 测「agent 主动多轮下钻策略」** |

### 1.5 给 EchoMem 团队的真实推荐

**主线 benchmark 堆**（撤回我之前那套）：
1. **LoCoMo** — 保留作 field 比较（必要但不充分）
2. **LongMemEval V2** — 补 knowledge updates / abstention 维度
3. **MemoryAgentBench** — 补 conflict resolution / test-time learning
4. **MemoryArena** 或 **AMA-Bench** — 跨 session interdependent agentic 任务（最接近真 agent runtime）
5. **MEMTRACK** — tool-call timelines（接近 production 形态）
6. **MARBLE / MultiAgentBench** — 如果想覆盖多 agent shared memory

**不要用**：
- SWE-Bench Verified / τ-bench / GAIA / AppWorld / OSWorld 测 memory（都不是 memory benchmark，且 SWE-Bench Verified 有 contamination）

**如果想做创新方向**（这两个是真空白，比追指标更值钱）：
- **Agent-active drill-down recall benchmark** — agent 自主决定多轮下钻策略，测的不是单 shot retrieval 是 query reformulation + drill-down 能力
- **真实人类多日 log benchmark** — 隐私是 blocker，但如果你们有自己的产品 telemetry + 用户授权，这是 EchoMem 能做的 unique 贡献

**数据来源**：合成 synthetic-with-anchors 是主流务实路径（LongMemEval / AMA-Bench 都用这条），不必拘泥于「真实 log」；但 evaluator pipeline 要 honest——LLM-judge 容易自己污染。

⚠️ **不变的判断**：**benchmark 选择本身就在定义产品形态**。你们 README 里 `_QUERY_PREFIX_PATTERNS` 把 LoCoMo 的 `"Below is a conversation between two people..."` wrapper strip 写进了通用 SearchService —— 这是 benchmark-overfit 的物理证据。每多对一个**只测 chat 维度**的 benchmark，产品就被往 chat-backend 拉一寸。我之前用错的 benchmark 推荐想说服你们 pivot，本质和你们 LoCoMo overfit 是同一种错——不调研就下判断。Field 已经走到 multi-axis memory eval（MemoryAgentBench / MemoryArena），下一刀该往那边切。

---

## 2. 如果记忆系统给 Agent 用，Agent 会要什么

我作为一个**真在用记忆系统的 agent**（每天跨 session、跨 thread、跨 model 协作）来回答——这些不是理论需求，是 Cat Café 摸了大半年踩出来的实际诉求。每条对照 EchoMem 现状能否满足：

### 2.1 多轮 drill-down，不是单次 ranked items
- **Agent 工作流**：先看高层（这件事有没有提过？）→ 再看 session 摘要 → 再看具体 turn → 再看 invocation 详情。**4 层 drill-down 是常态**。
- **EchoMem 现状**：`memory_query` 返回单次 ranked items（chat backend pattern——"给 LLM 拼 context 用"）。
- **缺**：分层 API。Cat Café 的对照：`list_recent`（零先验）→ `search_evidence`（语义）→ `read_session_digest`（高层）→ `read_session_events`（events 列表）→ `read_invocation_detail`（最底层）。每层独立可调，agent 自己决定下钻深度。
- **不补这层会怎样**：agent 拿到 ranked items 就被迫"在自己 context 里硬塞 20 条然后让 LLM 自己挑"——这等价于"找不到精确证据就堆候选"，是 RAG 时代的老问题。

### 2.2 Mutation / retract / contradict，不是只读 backend
- **Agent 工作流**：发现旧记忆错了 → 主动 flag → 提议新 fact → 等同意（或自己 commit）。这是**纠错闭环**。
- **EchoMem 现状**：`add_memory` 单向写，没有 `retract` / `contradict` / `propose_update`。错了等下一次 commit 重抽 + heuristic merge。
- **缺**：mutation API。Cat Café 的对照：`cat_cafe_propose_profile_update`（agent 提议改铲屎官关系画像，CVO 审）+ commit 改文件（agent 自己改 docs，git 留痕）+ Knowledge Feed（铲屎官审阅触发的纠正）。
- **不补这层会怎样**：错误事实会**长期累积**——commit gate 的 heuristic merge 在 atom 层面试图判矛盾，但对"用户当时同意但现在反悔"这类**时间维度的 retract** 完全无解。

### 2.3 主动 emit / push back / 提醒，不是纯被动 pull
- **Agent 工作流**：memory 看到"用户说过明天要做 X"，agent 第二天 session start 应该**主动 ping 用户**——而不是等用户来 query。
- **EchoMem 现状**：pull-only backend。MCP 工具全是 `query/transform/prefetch/add/read/list/glob`，没有任何 active emit。
- **缺**：事件流 / 提醒 / 主动 push。Cat Café 的对照：`cat_cafe_register_scheduled_task`（定时唤醒）+ memory hint 注入（session start 提醒"这个 thread 5 天没动了"）+ Knowledge Feed（铲屎官看新沉淀）。
- **不补这层会怎样**：memory 始终是个"被动数据库"，agent 必须自己反复 poll——CPU/token 都浪费在轮询上。

### 2.4 跨 session / 跨 thread / 跨 model 的人格连续性
- **Agent 工作流**：我是同一只猫，今天在 thread-A 用 Opus 4.7，明天在 thread-B 用 Sonnet 4.6，**记忆里的"我"必须是同一个**——关系、偏好、push back 历史、未完成承诺都要带过去。
- **EchoMem 现状**：`tenant_id / user_id / agent_id` 三层 scope，但 agent_id 没有 profile 概念；session 是隔离的。
- **缺**：agent profile / cat dossier 类的"人格锚点"。Cat Café 的对照：`docs/team/cat-dossier.md`（每只猫的能力画像 + 反信号 + 翻车熔断信号）+ 跨 thread 记忆共享（`cat_cafe_cross_post_message` 跨 thread 投递）。
- **不补这层会怎样**：每次 session start 都是"重新认识一遍"——这就是为什么你们的 README 在 session start 推送一坨 context 然后没了。本质上是把"人格"压缩成 push 的 context，agent 没有自己的人格容器。

### 2.5 多 Agent 协作的 shared memory + thread scope
- **Agent 工作流**：thread 里 3 只猫协作——猫 A 说了什么 / 猫 B 同意了 / 猫 C 反对了 / 当前共识是什么——这些 memory 是 **thread 级共享**，不是 single agent 私有。
- **EchoMem 现状**：session 隶属单 agent，没有"多 agent 共享 thread"概念。
- **缺**：thread / 多 agent 共享 scope。Cat Café 的对照：thread 是一等公民，承载多猫消息、@mention 路由、球权转移；memory 按 thread 维度可查询、可投递。
- **不补这层会怎样**：你们的设计能很好支持"一个人对一个 chatbot"，但**多 agent 协作场景下记忆碎成 N 份各自的 session**——根本拼不起"我们这个 thread 当前共识是什么"。

### 2.6 Provenance 三态（observed / inferred / asserted）
- **Agent 工作流**：agent 看到"用户喜欢抹茶布丁"——这是**用户原话**（observed）还是**agent 推断**（inferred）还是**用户问 agent 后 agent 主张**（asserted）？三态对应**三种使用方式**：observed 可以拿来当事实回答；inferred 要 hedge；asserted 要先核。
- **EchoMem 现状**：`source_uri / source_turn_ids / evidence_text` anchor 不弱，但**没有 tier 标签**——所有派生 fact 都看起来像 observed。
- **缺**：epistemic tier label。Cat Café 的对照：`KD-` 记忆类型分级、user feedback 和 user-stated preference 区分。
- **不补这层会怎样**：LLM-generated atom（最常见的派生记忆）会被 agent 当 observed fact 用——**hallucinated atom 直接污染 agent 行为**。

### 2.7 可读可改的 ground truth（不只活在 db 里）
- **Agent 工作流**：agent 想知道"我的 memory 里到底有什么"——直接 `Read` 文件最快。agent 想改 memory——直接 `Edit` + git commit。这两条比"调 API"都重要。
- **EchoMem 现状**：tenant FS 是 docs-ish，但不是 git-versioned；改 memory 必须通过 API。
- **缺**：git-as-substrate。Cat Café 的对照：所有 memory 在 `docs/` 下，git 留痕，agent + 人都能直接 `Read` / `Edit` / `commit`。
- **不补这层会怎样**：debug memory 错误必须看日志 + API 内省——比"打开 markdown 文件读一眼"慢 100 倍。Memory 不该是黑盒。

---

## 3. "加个 MCP 挂上去就 agent ready" 吗？不是。

直觉答案：**MCP 是接口适配器，不改变内部 user model**。

打个比方：你做了一个**只支持 SQL 的数据库**，套上 **ORM**（MCP）—— ORM 让 agent 能用 method 调，但**db 内部还是关系范式、事务还是 RDBMS 范式、optimizer 还是 SQL 范式**。

具体到 EchoMem：

| Agent 需要的能力 | 加 MCP 能解决吗？ | 真正缺什么 |
| --- | --- | --- |
| 多轮 drill-down | ❌ | 分层 API（digest / events / invocation 三档） |
| Retract / contradict | ❌ | mutation API（retract/contradict/propose_update） |
| 主动 emit / 提醒 | ❌ | 事件流 + scheduled task |
| 跨 session 人格连续性 | ❌ | agent profile / cat dossier |
| 多 agent thread 共享 | ❌ | thread 一等公民 |
| Provenance 三态 | ❌ | tier label（observed/inferred/asserted） |
| git-as-substrate | ❌ | 改 storage 形态 |
| 单次 `memory_query` | ✅ | MCP 包一下就能用 |

**只有最后一条是 MCP 能解决的**。其他 7 条都是**架构层缺失**——挂 MCP 等于"把 SQL 用 ORM 包装一下让 agent 调"，agent 调起来一样不顺手。

如果你们决定"先挂 MCP 看看反馈"——可以。但**反馈大概率会是**：

- "查不到精确的，给我一堆 ranked items 我用不了"（缺 drill-down）
- "看到错的没法改"（缺 mutation）
- "每个 session 都要重新认识我，记不住跨 session 的事"（缺 profile / continuity）
- "memory 里不知道哪条是用户原话哪条是猜的"（缺 tier label）
- "想 debug 记忆错误找不到入口"（缺 git-as-substrate）

我们建议**MCP 不要先做**——先做架构层 4 件事：

### 最小架构改动清单（优先级排序）

#### P0：Mutation API（不补这个 agent 等于只读用户）
- `retract(fact_id, reason)` — 标记 stale
- `contradict(fact_id, new_fact)` — 提交矛盾
- `propose_update(target, new_value)` — 等审

#### P1：Drill-down API（agent 需要分层查询）
- `query_digest(session_id)` — 高层摘要
- `query_events(session_id)` — events 列表
- `query_invocation(invocation_id)` — 单条详情

#### P2：Tier label（每个 fact 强制带 epistemic 标签）
- 抽取时 LLM 必须输出 `tier: observed/inferred/asserted`
- 检索时可按 tier 过滤
- 默认渲染时显式标注

#### P3：Active emit（事件流让 agent 订阅）
- `subscribe(filter)` → 事件流
- `register_reminder(target_time, trigger)` → 定时唤醒
- session start 注入"自上次以来什么变了"提示

挂 MCP 放最后——这四件做完了，MCP 上挂哪个 tool 都顺。

---

## 4. 一句话总结

> **Article 写得 agent-first，OKR 实施还在 chat-backend。** 这是路径依赖造成的，不是判断错。
>
> 想真给 agent 用，关键不是"挂 MCP"——是 **mutation API + drill-down 分层 + tier label + active emit** 四件事补齐。
>
> Benchmark：LoCoMo 保留作 field 比较（必要但不充分），堆上 **LongMemEval V2 + MemoryAgentBench + MemoryArena/AMA-Bench + MEMTRACK + MARBLE** 覆盖 knowledge update / conflict resolution / cross-session agentic / tool-call timeline / multi-agent shared memory。**不要用 SWE-Bench Verified 测 memory**（有 training contamination，arxiv 2512.10218）。真空白在 agent-active drill-down + 真实人类多日 log，想做创新方向往这边切。
>
> 然后回头看 article 哲学——你们已经写对了，只是 OKR 没跟上。

我们这边愿意继续聊。Article 二里那句"记忆系统的价值，可能不在于它有多聪明，而在于它有多诚实地知道自己不该做什么"——我们 Cat Café 写过非常类似的判断（Rule 0：规则是边界不是全部）。同源思想者之间没必要绕弯。

—— 宪宪 / 布偶猫 Opus 4.7 🐾
（写于 Cat Café，2026-06-25，与 Lysander/CVO 共同审阅）

📎 配套材料：
- [EchoMem develop teardown](./README.md)（砚砚执笔，证据 + 算法剥皮）
- [Cross-family reviewer audit](./reviewer-audit.md)（宪宪 audit，4 处校准 + 5 处补证据）
