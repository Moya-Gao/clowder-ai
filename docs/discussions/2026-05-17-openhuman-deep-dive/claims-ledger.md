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
- **Verdict**: ❓ **未验证**（spec 写得清楚，但 hot path 真实代码位置（`memory_tree_ingest` RPC 入口）第一波没追）— 第二波必查 `tree_summarizer/ops.rs` 和 ingest entry
- **Caveat**: claim 本身是好工程模式（hot path 无 LLM），如果验证通过是值得我们 F102 ingest 借鉴的

### A4. "Chunks ≤3k tokens, deterministic content-addressed IDs"

- **Source**: `memory-tree.md` L18-21 + L86
- **Evidence**: 暂仅 spec，未追 chunker 实现
- **Verdict**: ❓ 待 Step 2 追 `chunker` 实现位置
- **Caveat**: claim 本身是合理工程设计

## B. "Agent 在几分钟内认识你"（核心营销 claim）

### B1. "OpenHuman is the first agent harness that gets to know you in minutes"

- **Source**: README L86 ("Context in minutes, not weeks")
- **Evidence**:
  - 路径：connect OAuth → auto-fetch 20-min loop → memory tree 摄入 → LLM summarize → agent prompt 注入
  - `tree_summarizer/engine.rs` 真实做 LLM 摘要
  - **没找到**：reward / RL / eval / fine-tune 类反馈闭环
- **Verdict**: ⚠️ **partial / 重定义** — claim 真实指的是"**摄入快**"（数据 OAuth → 本地摘要），不是"**学习快**"
  - "认识你" 在 OpenHuman 体系里 = "agent prompt 里有你最近邮件/聊天的 LLM 摘要"
  - 跟"agent 真的形成对你偏好的 model"是两个事
- **Caveat**: 我们 F200 关心的"recall 是否被消费、是否准、是否需要新摄入"在 OpenHuman 体系里**没看到对应 eval 层**——这是个 architectural 选择不是缺陷，但要写清"两家在比不同的事"
- **Cat Café 对比 hook**: 不能拿"我们 18 个月 vs 他们几分钟"比——比较的是 ingestion latency 不是 model quality

### B2. "Hermes 学习靠看你工作 / OpenClaw 等插件 / OpenHuman 直接 sync"

- **Source**: README L86-88 比较段
- **Evidence**: hermes / openclaw 的 README/spec 我们 ref/ 都有但第一波没核对
- **Verdict**: ❓ **未验证** — 是否真比 Hermes 快需要单独对比，**不能直接转述他们 README**
- **Caveat**: 这种 "we are first" claim 在开源生态属于 strong promotional，应保留怀疑（参见铲屎官教训 [feedback_external_project_scope_honesty]）

## C. TokenJuice（token 压缩）

### C1. "Smart token compression, reduces cost/latency by up to 80%"

- **Source**: README L70
- **Evidence**:
  - `src/openhuman/tokenjuice/mod.rs` 顶注释："Rust port of `vincentkoc/tokenjuice`"
  - 模块结构：`classify` / `reduce` (928 行) / `rules/{loader,compiler,builtin}` / `text` / `tool_integration` / `types`
  - **三层 rule overlay**：builtin (vendored JSON) / user (`~/.config/tokenjuice/rules/`) / project (`.tokenjuice/rules/`)
  - 示例：`git status` 输出 `"M: src/lib.rs"` —— 纯文本 pattern 重写
- **Verdict**: ✅ **verified** — 是真规则引擎，不是 LLM judge；可解释、可配置、可叠加
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
- **Verdict**: ✅ **verified** — 真插件，不是 trait stub；安全细节做到位
- **Caveat**:
  - 选了 agentmemory 后，**Memory Tree 仍走自己的 `chunks.db`**（两套并存）——README 没明确分离这一点，可能引读者误以为 agentmemory 替换整个 memory 系统
  - field mapping 是 lossy 的：`MemoryCategory::Daily` 和 `MemoryCategory::Conversation` 都映射到 `type: "conversation"`，反向不可逆

## E. 118+ Integrations + 20 分钟 auto-fetch

### E1. "118+ third-party integrations with one-click OAuth"

- **Source**: README L64
- **Evidence**: `src/openhuman/integrations/` 顶级模块存在；`src-tauri/src/*_scanner/` 桌面侧实现 slack/whatsapp/telegram/imessage/gmessages/discord/meet/gmail
- **Verdict**: ❓ **partial verified** — 桌面 scanner 真实存在，集成总数 118+ 没数（Step 2 数 OAuth catalog）
- **Caveat**: 118 是 marketing 数字，真实独立、production-ready 的有多少需要数

### E2. "Auto-fetch every 20 minutes, no prompts/polling loops to write"

- **Source**: README L64 + `gitbooks/features/obsidian-wiki/auto-fetch.md`
- **Evidence**: spec 描述清楚，scheduler 在 memory-tree spec 也提及（"00:00 UTC enqueue digest"）
- **Verdict**: ❓ 待 Step 2 看 `scheduler_gate/` + `cron/` + integrations 模块的真实 auto-fetch 实现
- **Caveat**: 20 分钟硬 cadence 对低频源（如 GitHub repo）是浪费，对高频源（如 Slack）是太慢

## F. Self-improvement / Self-learning（**关键 absence check**）

### F1. "Agent 自我学习" 类 claim

- **Source**: README 比较表格 "Memory: Hermes ✅ Self-learning"（暗示 OpenHuman 的 Memory Tree 比 self-learning 更高级）
- **Evidence (absence)**:
  - `grep -i 'self.?improv|self.?learn|reward|reinforce|fine.?tune|eval.?loop|feedback.?loop'` → 11 个文件
  - 实际 RL/reward 类核心实现：**0 个**
  - `learning/` 模块只有 `stability_detector.rs` + `mod.rs` + `config/schema/learning.rs` — 是配置 hook，不是算法
- **Verdict**: 🚫 **none claimed in OpenHuman, but absence is structurally interesting**
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
