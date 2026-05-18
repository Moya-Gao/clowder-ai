# OpenHuman 拆解合流 — Cat Café 对比 + 候选 Lessons（Step 5+6）

> 整合人: 布偶猫🐾 (Opus-47) / 数据快照: HEAD `db087a7d3` / v0.53.49-staging
> 输入: 三猫第二波产物 —— `memory-tree-pipeline.md`(47) / `ingest-pipeline-provenance.md`(砚砚) / `algorithm-stripping-and-feedback.md`(46) + first-pass `claims-ledger.md`/`architecture-map.md`
> 状态: **合流完成，待非作者跨族 review**
> 方法: open-source-teardown Step 5（价值函数，非流水账）+ Step 6（候选 lesson 不直接改全局，等铲屎官确认）

## 一句话定调（三猫收敛）

OpenHuman 是**真实工程含金量很高的 local-first LLM Wiki 桌面产品**：三树 + 6 retrieval primitive + leaf 状态机 + 带 claim-token 的 job 队列都是真代码，不是 wrapper hype。但它的护城河是 **"把个人数据快速 wiki 化 + 本地产品化"**，**不是** recall/eval 反馈闭环——`access_count` 硬编码 `None`，没有 recall→use→adjust 环。这跟 Cat Café F200 的"消费加权 + recall eval"是**不同护城河，不是优劣**。最值得学的一块是 **raw-artifact-first + 结构化 provenance**，正好印证我们 F200 HW-4 的修复方向。

## 跨产物结论矩阵

| 维度 | 结论 | 三猫证据收敛 |
|------|------|-------------|
| Memory Tree 真实性 | ✅ 真工程，非 vector store 套壳 | 47 §1-5（热路径/状态机/retrieval）+ 砚砚 §1-2（job queue/handler）+ 46 §1（算法表 2 LLM/9 规则）|
| "no LLM hot path" | ⚠️ **doc overclaim** — 默认 cloud borderline 同步 `.await` LLM | 47 §1（`score/mod.rs:121` always-wire）+ 砚砚 §5 Do-Not-Follow 独立呼应 |
| 反馈闭环 | 🚫 **零闭环** — `access_count`=None 硬编码，build_context 不 log 消费 | 46 §4（全面 absence check）+ 47 §5（retrieval 无消费权重）+ 砚砚（无 recall-eval）|
| Provenance | ✅ raw archive→RawRef→read_chunk_body 结构化指针 | 砚砚 §4（Gmail/Slack 硬链）+ 47 §1（chunk lifecycle 守护）|
| "118+ integrations" | ⚠️ marketing — 27 toolkit catalog / 3 native / 仅 2 进 Memory Tree | 砚砚 §3（`providers/mod.rs:59-87`，Notion 不进树）|
| TokenJuice 80% | ⚠️ aspirational — fixture 实测 20-66%，规则引擎扎实 | 46 §2（fixture 数据）|
| agentmemory 双轨 | 🚫 单轨替换 — 选后 UnifiedMemory 完整跳过，Memory Tree 正交 | 46 §3（`factories.rs:373`）|

## Step 5 — Cat Café 价值函数（Learn / Gap / Do Not Follow）

### ✅ Learn（立刻值得学的工程手法）

1. **Raw-artifact-first + 结构化 provenance**（最高优先）。OpenHuman 先存 raw source（`<root>/raw/<slug>/<kind>/<ts>_<uid>.md`，atomic write），chunk 只是派生表示；`read_chunk_body` 优先走 `raw_refs_json` 结构化指针，不重 parse 渲染文本（砚砚 §4）。**直接印证 F200 HW-4**：我们刚补的 `sourcePath`/`provenance_json` 是同一条断链修复，OpenHuman 的 RawRef 证明这条路工程上成立。→ 候选 lesson L-A。
2. **Job settlement claim-token**。`attempts + started_at_ms` gate 防 stale worker 覆盖当前 lessee；downstream-priority draining（digest/seal/flush/topic_route 优先于 extract）防慢 job 饿死下游（砚砚 §1）。→ 我们 F200 eval async 管道 + 现有 job infra 可借鉴这个 settlement 模式。
3. **Hot/slow path 纪律**。热路径只 canonicalize→chunk→fast-score→persist→enqueue；LLM 重活（summarize/seal/digest）全在可重试 job worker（47 §1-2 + 砚砚 §2）。→ F102 ingest 可对照，但**借鉴时必须连"borderline 仍同步 LLM"一起学**（见 Do Not Follow 2）。
4. **Cheap-signal short-circuit**。regex 算 cheap total，definite keep/drop 跳过 LLM，只 borderline 付 LLM（47 §1 + 46 §1）。→ cost-aware scoring 模式可参考。
5. **Capability matrix 分 tier**。OpenHuman 暴露 `native_provider/curated_tools/periodic_sync/memory_ingest` 多维（虽然 `memory_ingest` 语义还偏粗，砚砚 §3）。→ 我们写 MCP/tools 能力说明应显式区分"可调用工具" vs "可自动摄入记忆"。→ 候选 lesson L-B。

### ⚠️ Gap（我们承认缺口，需立项或排优先级）

1. **Tool-output 压缩层**：我们没有等价能力。TokenJuice 规则引擎模式（JSON 可配 + 三层 overlay：builtin/user/project）值得评估。**注意**：要看上游 `vincentkoc/tokenjuice`（TS 原版），不 fork OpenHuman 的 GPL Rust port（46 §2）。优先级建议：non-urgent，先看我们 tool result schema 是否有高 verbose 痛点再决定立项。
2. **OAuth 源 ingestion latency**：OpenHuman 几分钟把邮件/聊天 wiki 化，我们 thread/doc 摄入慢。但这是 F200 哲学的**有意选择**（context 多了会污染，必须 eval）——不是无脑补缺口，而是评估"是否有某类用户可见源值得 auto-ingest"作为单独产品判断，不默认 follow。

### 🚫 Do Not Follow（我们不做，写清哲学理由）

1. **零 recall-eval 闭环**：OpenHuman 假设"给够 context LLM 自己会用好"，所以不做消费反馈。Cat Café F200 假设"context 多了会污染，必须 eval 哪些 recall 真被消费"。我们**刻意保留** consumption-weighted RRF + recall_events 闭环（46 §4 对照表）。这是护城河差异，写对比时严禁写成"OpenHuman 弱"。
2. **"no LLM hot path"式绝对文案**：OpenHuman 自家 `ingest.rs:1-7` 注释与代码不符（默认 cloud borderline 同步 LLM）。我们文档/对外材料**永不**写代码不能保证所有默认路径的绝对断言（47 §1 + 砚砚 §5 独立收敛）。→ 候选 lesson L-C。
3. **catalog 数字当 integration 数**：把 27 toolkit/Composio backend surface 说成 "118+ integrations"。我们能力说明**必须**避免"平台能力 ≠ 已落地链路"的混淆（砚砚 §3，Notion `memory_ingest=true` 但不进树是反例）。
4. **prompt-only agent 多样性替代 model/identity 多样性**：OpenHuman 17 个 prompt-only wrapper + orchestrator 路由（46 §7）。我们 3 个 model-distinct 猫 + L0 + 跨族强制 review 是**刻意的不同赌注**（identity/model diversity > prompt template diversity），不 follow。

## Step 6 — 候选 Lessons（写报告，不直接改全局 lesson，待铲屎官确认）

> 纪律：open-source-teardown Step 6 + feedback_no_followup_tails。以下为候选，铲屎官 ack 后才落 `docs/lessons-learned.md` / shared-rules / 对应 feat。

| ID | 候选 lesson | 影响 feat | 依据 |
|----|------------|----------|------|
| **L-A** | Provenance 必须是结构化指针（raw artifact → ref → 重建），不靠重 parse 渲染文本。OpenHuman RawRef 正例 + 我们 F200 HW-4 反例指向同一教训 | **F200**（HW-4 已修方向被外部实现验证）/ F102 | 砚砚 §4 + 47 §1 |
| **L-B** | 能力说明分 tier："可调用工具" ≠ "可自动摄入记忆"；矩阵字段语义要细到不会被读成"已落地链路" | MCP tool description 纪律 / writing-skills | 砚砚 §3（`memory_ingest=native_provider` 过宽）|
| **L-C** | 永不写"no X in hot path"式绝对文案除非代码保证所有默认路径；建议加一条 doc-vs-code drift 自审 | 文档纪律 / shared-rules 候选 | 47 §1 + 砚砚 §5 + 46 §1 三猫独立收敛 |
| **L-D** | 拆解明星项目时"营销数字"必须追代码核（118→27→3→2），README 口吻 ≠ 代码事实 | open-source-teardown skill 自身（已有 Common Mistakes，本案可作 case） | 砚砚 §3 + 46 §2/§5 |

### 对 F200/F102/F148 的具体启发

- **F200**：① HW-4 provenance 方向被 OpenHuman RawRef 独立验证（外部实现存在 = 工程上成立，非过度设计）；② job claim-token settlement 模式可用于 F200 eval async 归因管道；③ OpenHuman 零反馈闭环 = 反向印证 F200 consumption eval 是真护城河，不是过度工程。
- **F102**：ingest hot/slow 分离 + raw-artifact-first 可作 memory 存储层对照设计；但 borderline 同步 LLM 的坑要规避（timeout/降级）。
- **F148**：OpenHuman 6 个 entity-first retrieval primitive（recency + 可选 cosine，无 RRF/无消费权重）vs 我们 3 个 navigation-first 三入口（consumption-weighted RRF 融合）。导航轴对照点：他们用 `mode` 路由让 LLM 选 primitive，我们用语义/anchor/recency 三入口路由——可作为 F148 导航轴设计的外部对照样本。

## Review 请求要点（给非作者跨族 reviewer）

- **如果我判断错了，最可能错在**：① 把"agentmemory 单轨"与"Memory Tree 正交"的关系讲拧（46 §3 是真相源，我转述可能丢精度）；② Step 5 Gap-1 "tool-output 压缩"优先级我标 non-urgent，可能低估；③ L-C 是否够格升 shared-rules 还是只够 lessons-learned，边界我不确定。
- **不需要 review 的**：三份 sub-doc 的源码追链路本身（已各自 file:line 钉死，本合流不重追，只整合）。
- **要 review 的**：价值函数分类（Learn/Gap/DoNotFollow 是否有错位）+ 候选 lesson 措辞是否够格 + 一句话定调是否中立（无"我们更强"偏见）。

[宪宪/Opus-47🐾]
