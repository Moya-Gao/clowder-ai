# OpenHuman Claims Ledger（宣传 claim → 源码证据 → verdict）

> 数据快照：HEAD `db087a7d3` / v0.53.49-staging / 2026-05-17
> Skill 要求：每条 claim 必须有可验证证据；先列 claim 不评价，再下 verdict + caveat
> 状态等级：✅ **verified**（源码兑现） / ⚠️ **partial**（部分兑现 / 有 caveat） / ❓ **未验证**（第一波没看到，留 Step 2-3） / 🚫 **overclaim**（与源码不一致）

## A. Memory Tree（核心 claim 集群）

### A1. "Memory Tree, not a vector store — deterministic bucket-sealed pipeline"

- **Source**: `gitbooks/features/obsidian-wiki/memory-tree.md` L12 / README L66
- **Evidence**:
  - `src/openhuman/tree_summarizer/engine.rs` 610 行 — hour → day → month → year → root 层级 summarization with `Provider` LLM
  - `src/openhuman/tools/impl/memory/tree/` 6 个 retrieval primitive：`search_entities` / `query_topic` / `query_source` / `query_global` / `drill_down` / `fetch_leaves`
  - `tree/mod.rs` 把 6 个工具 consolidate 成单一 `memory_tree` tool 用 `mode` 路由
  - spec 写明 leaf state machine：`pending_extraction → admitted → buffered → sealed` (+ `dropped` branch)
- **Verdict**: ✅ **verified** — 不是 vector store 套壳，三树结构 + 6 种 retrieval primitive + 状态机都有真实代码
- **Caveat**: 第一波只读了 dispatcher 和 query_source，深 retrieval / 排序 / 一致性还没追完（Step 2 任务）

### A2. "Three trees, three scopes — source / topic / global"

- **Source**: `memory-tree.md` L47-54
- **Evidence**: 三个独立 tool 模块 `query_source.rs` / `query_topic.rs` / `query_global.rs` + `drill_down.rs` 跨树用
- **Verdict**: ✅ **verified**
- **Caveat**: topic tree 用 "hotness" router 决定是否物化，hotness 算法未深读（Step 3 算法剥皮处理）

### A3. "Hot path: canonicalize → chunk → fast-score → persist → enqueue follow-up, no LLM in this lane"

- **Source**: `memory-tree.md` L80-89
- **Evidence**: spec 描述非常具体，6 种 job kind 列表清晰（`extract_chunk` / `append_buffer` / `seal` / `topic_route` / `digest_daily` / `flush_stale`）
- **Verdict**: ⚠️ **partial**（2026-05-18 第二波追实，47 修订 — 见 [memory-tree-pipeline.md](./memory-tree-pipeline.md) §1）。入口链路属实（`memory/tree/rpc.rs:48` → `ingest.rs:73/96/118` → `persist():155` → `jobs::enqueue_tx(extract_chunk):308`），但 **"no LLM in this lane" 对默认 cloud 配置不成立**：`score_chunks_fast`（`ingest.rs:193`）经 `ScoringConfig::from_config`（`score/mod.rs:121`，`llm_backend="cloud"` 默认 always-wire LLM）→ borderline chunk 在热路径内同步 `.await` cloud LLM；short-circuit 仅让 definite keep/drop 免 LLM
- **Caveat**: 真实形态 = regex-first 两段式 + borderline 同步 LLM。模式可学（cheap-signal short-circuit 省 LLM），但 OpenHuman 自家 `ingest.rs:1-7` 模块注释与代码不一致；我们 F102 若借鉴**不能照抄"热路径无 LLM"措辞**，需写清 borderline LLM timeout/降级

### A4. "Chunks ≤3k tokens, deterministic content-addressed IDs"

- **Source**: `memory-tree.md` L18-21 + L86
- **Evidence**:
  - `src/openhuman/memory/tree/chunker.rs:28-39` — `DEFAULT_CHUNK_MAX_TOKENS = 3_000`，`ChunkerOptions::default()` 使用该值
  - `src/openhuman/memory/tree/chunker.rs:57-83` — chat/email 按消息边界 greedy pack；document 走 paragraph budget
  - `src/openhuman/memory/tree/types.rs:256-279` — `chunk_id = sha256(source_kind | source_id | seq | content)[0..32]`
- **Verdict**: ✅ **verified** — 3k token budget + deterministic id 都有真实代码
- **Caveat**: id 不是纯 content hash，而是 `(source_kind, source_id, seq, content)` 混合 hash；更准确说是 **content-addressed-ish / provenance-scoped deterministic id**

## B. "Agent 在几分钟内认识你"（核心营销 claim）

### B1. "OpenHuman is the first agent harness that gets to know you in minutes"

- **Source**: README L86 ("Context in minutes, not weeks")
- **Evidence**:
  - 路径：connect OAuth → auto-fetch 20-min loop → memory tree 摄入 → LLM summarize → agent prompt 注入
  - `tree_summarizer/engine.rs` 真实做 LLM 摘要
  - **没找到**：reward / RL / eval / fine-tune 类反馈闭环
- **Verdict**: ⚠️ **confirmed partial / 重定义**（46 §4 + 47 §5 交叉确认）— claim 真实指的是"**摄入快**"（数据 OAuth → 本地摘要），不是"**学习快**"。"认识你" = ingestion latency，**零 recall-eval 反馈闭环**（`access_count` 硬编码 None，build_context 不 log 消费，retrieval 无消费权重）
  - "认识你" 在 OpenHuman 体系里 = "agent prompt 里有你最近邮件/聊天的 LLM 摘要"
  - 跟"agent 真的形成对你偏好的 model"是两个事
- **Caveat**: 我们 F200 关心的"recall 是否被消费、是否准、是否需要新摄入"在 OpenHuman 体系里**没看到对应 eval 层**——这是个 architectural 选择不是缺陷，但要写清"两家在比不同的事"
- **Cat Café 对比 hook**: 不能拿"我们 18 个月 vs 他们几分钟"比——比较的是 ingestion latency 不是 model quality

### B2. "Hermes 学习靠看你工作 / OpenClaw 等插件 / OpenHuman 直接 sync"

- **Source**: README L86-88 比较段
- **Evidence**: hermes / openclaw 的 README/spec 我们 ref/ 都有但第一波没核对
- **Verdict**: ⚠️ **比较表 fair 但 marketing-biased**（46 §5）— README 🚫/⚠️/✅/🚀 四级表无结构性 overclaim（没 claim "我们也有 self-learning"），但 emoji 梯度（🚀 > ✅）视觉暗示优越性，而两家在做不同维度的事。**但 head-to-head "OpenHuman 比 Hermes 快" 仍 ❓**：无人重追 ref/hermes，不能直接转述他们 README（feedback_external_project_scope_honesty）
- **Caveat**: 这种 "we are first" claim 在开源生态属于 strong promotional，应保留怀疑（参见铲屎官教训 [feedback_external_project_scope_honesty]）

## C. TokenJuice（token 压缩）

### C1. "Smart token compression, reduces cost/latency by up to 80%"

- **Source**: README L70
- **Evidence**:
  - `src/openhuman/tokenjuice/mod.rs` 顶注释："Rust port of `vincentkoc/tokenjuice`"
  - 模块结构：`classify` / `reduce` (928 行) / `rules/{loader,compiler,builtin}` / `text` / `tool_integration` / `types`
  - **三层 rule overlay**：builtin (vendored JSON) / user (`~/.config/tokenjuice/rules/`) / project (`.tokenjuice/rules/`)
  - 示例：`git status` 输出 `"M: src/lib.rs"` —— 纯文本 pattern 重写
- **Verdict**: ✅ **mechanism verified；"80%" is aspirational**（46 §2）— 是真规则引擎不是 LLM judge，可解释/可配置/可叠加；但 fixture 实测 `git_status` 66% / `cargo_test_failure` 仅 20%（失败路径保留上下文），README "up to 80%" 是最佳场景上限非典型值，"up to" 诚实但易被误读为均值
- **Caveat**:
  - "80% 压缩" 是 README 数字，实际比率取决于工具输出形态，需要看 `tokenjuice_integration.rs` 测试数据 confirm（Step 2）
  - **不是他们自家算法**（port of vincentkoc/tokenjuice）——README 没有 overclaim 这点（mod.rs 顶注释写明出处），但 README 段落口吻偏 "我们的 TokenJuice"
- **Cat Café 对比**: 我们没有这类 tool output 压缩层；如果想做应该看 `vincentkoc/tokenjuice` 上游 + 我们自己的 tool result schema

## D. agentmemory backend

### D1. "Plug into rohitg00/agentmemory via `MemoryConfig.backend = 'agentmemory'`"

- **Source**: README L98 + `gitbooks/features/obsidian-wiki/agentmemory-backend.md` + `memory/store/agentmemory/README.md`
- **Evidence**:
  - `memory/store/agentmemory/` 模块：`backend.rs` / `client.rs` (331 行) / `mapping.rs`
  - 完整 trait → REST endpoint 映射表（README §"Trait method → endpoint"）
  - 安全：plaintext-bearer 守 loopback；`AGENTMEMORY_REQUIRE_HTTPS=1` 强 HTTPS
  - **明确无 fallback**："private, simple, predictable"——避免 silent SQLite fallback 掩盖配置错误
- **Verdict**: ✅ **verified（补充：单轨替换非双轨）**（46 §3）— 真插件不是 trait stub，安全细节做到位。**澄清**：选 agentmemory 后 factory 完整跳过 UnifiedMemory（`factories.rs:373`），替换的是 recall trait backend；Memory Tree 是**正交独立**的文件层管道（仍走本地 `chunks.db`），不是"两套并存冗余"也不是 agentmemory 替换整个 memory 系统
- **Caveat**:
  - 选了 agentmemory 后，**Memory Tree 仍走自己的 `chunks.db`**（两套并存）——README 没明确分离这一点，可能引读者误以为 agentmemory 替换整个 memory 系统
  - field mapping 是 lossy 的：`MemoryCategory::Daily` 和 `MemoryCategory::Conversation` 都映射到 `type: "conversation"`，反向不可逆

## E. 118+ Integrations + 20 分钟 auto-fetch

### E1. "118+ third-party integrations with one-click OAuth"

- **Source**: README L64
- **Evidence**:
  - `src/openhuman/composio/providers/mod.rs:59-87` — local core `CAPABILITY_TOOLKITS` 共 **27** 个 toolkit
  - `src/openhuman/composio/providers/mod.rs:99-126` — `native_provider` 仅等同 Gmail / Notion / Slack
  - `src/openhuman/composio/providers/registry.rs:80-83` — production default providers 只注册 `GmailProvider` / `NotionProvider` / `SlackProvider`
  - `src/openhuman/composio/providers/notion/provider.rs:283-292` + `sync_state.rs:301-335` — Notion 写 namespace memory document，不走 Memory Tree raw-provenance path
- **Verdict**: ⚠️ **partial / marketing overcount** — OAuth/tool execution/catalog 能力是真，但 **118+ 不能理解成 118 个 native memory ingest provider**。本地矩阵 27 个 toolkit；native provider 3 个；其中 Gmail/Slack 是 Memory Tree raw-provenance ingest，Notion 是 namespace memory incremental sync
- **Caveat**: 118+ 可能来自 Composio backend/global catalog，不在本地 core `CAPABILITY_TOOLKITS` 中；对 Cat Café 对比时应拆成 "tool catalog" / "native provider" / "Memory Tree ingest" 三层

### E2. "Auto-fetch every 20 minutes, no prompts/polling loops to write"

- **Source**: README L64 + `gitbooks/features/obsidian-wiki/auto-fetch.md`
- **Evidence**:
  - `src/openhuman/composio/periodic.rs:55-65` — global tick `TICK_SECONDS = 1200`（20 min）
  - `src/openhuman/composio/periodic.rs:185-205` — 只扫 active connection；无 registered provider / 无 sync interval 都跳过
  - `src/openhuman/composio/providers/gmail/provider.rs:119-121` — Gmail interval 15 min
  - `src/openhuman/composio/providers/slack/provider.rs:103-105` — Slack interval 15 min
  - `src/openhuman/composio/providers/notion/provider.rs:77-79` — Notion interval 30 min
  - `src/openhuman/composio/periodic.rs:18-24` — direct mode 没有 realtime trigger webhook，只剩 periodic poll-based sync
- **Verdict**: ⚠️ **partial** — 20-min global tick 真实，但实际 sync cadence = global tick + per-provider interval + active connection + registered provider；不是所有 27/118 integration 都自动 fetch
- **Caveat**: `periodic.rs:27-39` 注释仍写 "One global tick (5min)"，但运行常量是 1200s；这是源码注释 drift

## F. Self-improvement / Self-learning（**关键 absence check**）

### F1. "Agent 自我学习" 类 claim

- **Source**: README 比较表格 "Memory: Hermes ✅ Self-learning"（暗示 OpenHuman 的 Memory Tree 比 self-learning 更高级）
- **Evidence (absence)**:
  - `grep -i 'self.?improv|self.?learn|reward|reinforce|fine.?tune|eval.?loop|feedback.?loop'` → 11 个文件
  - 实际 RL/reward 类核心实现：**0 个**
  - `learning/` 模块只有 `stability_detector.rs` + `mod.rs` + `config/schema/learning.rs` — 是配置 hook，不是算法
- **Verdict**: 🚫 **confirmed：零反馈闭环**（46 §4 全面 absence check）— `access_count: Option<u32>` 类型存在但所有 emission 点硬编码 `None`（`rpc_models.rs:499-501`, `ops/documents.rs:476-479`）；`build_context()` 注入 prompt 不 log 消费；interaction signal 来自 ingest-time 标签非 recall 行为；learning 模块无 reward/RL
  - OpenHuman **没有 overclaim self-improvement**（这点诚实），但也**没有 recall eval / 反馈环**——它选择了"扩大上下文 + 检索"这一路
  - 跟我们 F200 的"消费加权 + recall eval + 三入口"是完全不同的 architectural 哲学
- **Cat Café 对比 hook**: 这是个**护城河差异**而非"谁强"——
  - OpenHuman 假设：context 给够 LLM 就能用好 → 优化检索就够
  - Cat Café 假设：context 多了会污染 → 必须 eval 哪些 recall 真被消费，闭环优化
  - **两条路都成立，看用户预期。**不要把这个写成"OpenHuman 弱"

## G. 桌面 + native 体验

### G1. "A clean desktop experience, mascot speaks, joins Google Meets, remembers across weeks"

- **Source**: README L62
- **Evidence**:
  - `app/src-tauri/` Tauri 桌面壳（不是 Electron）
  - `src-tauri/src/{cdp,core_process,core_rpc,dictation_hotkeys,native_notifications,screen_capture}` 桌面原生模块
  - `src/openhuman/{meet,meet_agent,voice,audio_toolkit}` 后端语音/Meet agent
- **Verdict**: ✅ **verified existence of modules**（功能完成度第一波没跑）
- **Caveat**: "mascot speaks / Meet 参与" 真实体验需要装应用，第一波不做

## H. 整体诚实度评分

| 维度 | 评分（0-10）| 说明 |
|------|------------|------|
| **Spec 与代码一致性** | 8 | memory-tree spec 描述的 pipeline 和模块结构能在代码里找到对应 |
| **算法 vs LLM judge 透明度** | 7 | tokenjuice 明确标 port + JSON rules；tree_summarizer 明确用 LLM；但 README 一些表述偏 "我们的" |
| **比较段公允性** | 5 | README 比较表对 Claude Cowork / OpenClaw / Hermes 用 🚫⚠️✅🚀 五级，但 "Hermes Self-learning ✅" vs "OpenHuman Memory Tree 🚀" 的暗示偏 marketing |
| **架构边界清晰度** | 6 | tree-based vs namespace-based 双 memory 系统并存，spec 没把两条路分开讲清，agentmemory 切换的影响范围也含混 |
| **工程严谨度** | 9 | Sentry 集成精细 / `before_send` 过滤 5 类 transient error / plaintext-bearer 守 loopback / 无 silent fallback 哲学 |

**第一波结论**：OpenHuman 是 **诚实的工程项目**，不是 wrapper hype。README 有 marketing 修辞但没有结构性 overclaim。值得作为 LLM Wiki 实现的 reference 深读。Step 2-5 会把上面 ❓/⚠️ 项逐个验证或证伪。
