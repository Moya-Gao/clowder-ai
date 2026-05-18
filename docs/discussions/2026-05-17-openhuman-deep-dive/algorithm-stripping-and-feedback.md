# OpenHuman 算法剥皮 + 反馈链评价主体（46 scope — Step 3+4）

> Owner: 布偶猫/宪宪 (Opus-46) / 数据快照: HEAD `db087a7d3` / v0.53.49-staging
> 范围: 全量算法分类表 / TokenJuice 80% claim 验证 / agentmemory 双轨 / "认识你几分钟"反馈链 / Hermes 对比公允性 / subconscious 模块 / 17 agent 分类 / 推理路由
> 状态: **second-wave complete for 46 scope** — 可交给 47 做 Step 5 合流
> 方法: open-source-teardown — 全新视角（未参与 first-pass），每个 claim 追到 `file:line`

## §1. 全量算法剥皮表（Step 3 核心产物）

| 模块 | 算法名 | 类型 | 公式/机制 | LLM? | 证据 |
|------|--------|------|-----------|------|------|
| **admission scoring** | chunk fast-score | **hybrid** | 7 signal 加权和归一化到 [0,1]：token_count(1.0) + unique_words(1.0) + metadata_weight(1.5) + source_weight(1.5) + interaction(3.0) + entity_density(1.0) + llm_importance(0.0/2.0) | borderline only | `score/signals/types.rs:41-52`, `score/ops.rs:49-68` |
| admission scoring | short-circuit | 规则 | cheap total ≥ 0.85 → keep; ≤ 0.15 → drop; 0.15-0.85 → optional LLM | 否 | `score/mod.rs:29-41` |
| admission scoring | entity density | 启发式 | capped at 1 entity per 100 tokens | 否 | `score/ops.rs:34-42` |
| **hotness router** | topic materialization | **纯算术** | `ln(mentions+1) + 0.5×distinct_sources + recency_decay(age) + graph_centrality + 2.0×query_hits` | 否 | `tree_topic/hotness.rs:7-12` |
| hotness router | recency decay | 分段线性 | ≤1d→1.0; 1-7d→1.0→0.5; 7-30d→0.5→0.0; >30d→0.0 | 否 | `hotness.rs:63-84` |
| hotness router | thresholds | 常数 | creation=10.0, archive=2.0, recheck_every=100 | 否 | `tree_topic/types.rs:23-30` |
| **tree_summarizer** | hierarchical LLM summarization | **LLM** | hour→day→month→year→root 层级摘要，Provider LLM 生成 | 是 | `tree_summarizer/engine.rs` 610 行 |
| **TokenJuice** | tool output compression | **纯规则** | classify(priority×1000 + argv0×100 + argv_includes×40) → regex skip/keep → head/tail summarize → counter extraction → output match | 否 | `tokenjuice/classify.rs:87-133`, `reduce.rs` 928 行 |
| TokenJuice | pass-through safety | 规则 | input < 512 bytes → pass; compressed/original > 0.95 → pass | 否 | `tokenjuice/tool_integration.rs:24-29` |
| **model routing** | task-category dispatch | **规则** | lightweight(local-first) / medium(local if low-latency or cost-sensitive) / heavy(always remote) + privacy override=force local | 否 | `routing/policy.rs:88-106, 127-183` |
| **stability detector** | facet stability | **启发式** | `base × cue_mult × user_state_mult` + exponential decay（half-lives 7-90d per class）; τ_promote=1.5, τ_provisional=0.7 → Active/Provisional/Candidate | 否 | `learning/stability_detector.rs:1-100` |

**分布小结**：真 LLM = 2（tree_summarizer + borderline admission scoring）；纯规则/启发式 = 9。OpenHuman 的工程诚实度在于：**大部分决策路径是可解释的规则/算术，只在必要处用 LLM**。

## §2. C1 TokenJuice 80% claim 验证 — ⚠️ **aspirational, not average**

### 测试 fixture 实测

| Fixture | 输入大小 | 输出大小 | 压缩率 | 场景 |
|---------|---------|---------|--------|------|
| `git_status_modified` | 94 chars | 32 chars | **66% 压缩** | success path：regex rewrite + head/tail |
| `cargo_test_failure` | 414 chars | 330 chars | **20% 压缩** | failure path：保留更多上下文（`failure.head/tail`）|

证据：`tokenjuice/tests/fixtures/*.fixture.json`

### 机制分析

- 成功路径用 head/tail summarization + pattern rewriting，**实际压缩 34-66%**
- 失败路径用 `RuleFailure` 保留上下文，压缩率显著降低（20%）
- Pass-through safety（`MIN_COMPACT_INPUT_BYTES=512`, `MIN_COMPACT_RATIO=0.95`）确保短输出和低收益时不压缩

### Verdict

README 的 "up to 80%" 指的是**最佳场景下 tool output 的 token 节省**（verbose `git status` / `ls` 等），不是所有场景平均值。在 failure 模式下压缩率骤降。**"up to" 修饰词诚实但容易被读者误解为典型值**。

**Cat Café 对比**：我们没有等价的 tool output 压缩层。如果要做，看上游 `vincentkoc/tokenjuice`（TypeScript 原版），不需要 fork OpenHuman 的 Rust port。规则引擎模式（JSON 可配 + 三层 overlay）值得参考。

## §3. D1 agentmemory 双轨 — 🚫 **单轨替换，非双轨并存**

### 后端选择是互斥的

`factories.rs:373-382`：当 `backend == "agentmemory"` 时，factory **完整跳过** UnifiedMemory（SQLite + embedder）：

```rust
if is_agentmemory_backend(&config.backend) {
    let backend = AgentMemoryBackend::from_config(config)?;
    return Ok(Box::new(backend));
}
```

用户的 `embedding_provider`/`model`/`dimensions` 在 agentmemory 模式下被**忽略**（`factories.rs:366-372` 注释："intentional to avoid duplicate embedding pipeline"）。

### Memory Tree 仍独立运行（正交，不是双轨）

`gitbooks/features/obsidian-wiki/agentmemory-backend.md:37-42`："The Memory Tree pipeline is unaffected by the trait backend — it operates on the host's document store, orthogonally."

- Memory Tree 处理文件层（Obsidian vault），无论用 agentmemory 还是 sqlite
- chunking/sealing/summary 照常进行
- 但 Tree context 通过 `tree_loader.load()` 在 memory recall **之后**注入 prompt

### Verdict

claims-ledger D1 原 verdict "✅ verified — 真插件"成立。补充：**agentmemory 替换的是 recall trait backend，不是整个 memory 系统**。Memory Tree 是独立的文件层处理管道，两者正交但不冗余。选了 agentmemory，recall 走 REST；但摘要/检索/topic tree 仍走本地 SQLite `chunks.db`。

## §4. B1 "认识你几分钟"反馈链 — 🚫 **零反馈闭环**

这是本次拆解最重要的结构性发现。

### 证据链

| 层面 | 发现 | 证据 |
|------|------|------|
| **access_count 字段存在但硬编码 None** | `MemoryRecallItem.access_count: Option<u32>` 在类型定义里有，但**所有 emission 点都是 None** | `rpc_models.rs:499-501`, `ops/documents.rs:476-479` |
| **context assembly 不记录消费** | `build_context()` 按 score 过滤记忆注入 prompt，但**不 log/update 哪些被注入了** | `agent/harness/memory_context.rs:11-73` |
| **interaction signal 来自 ingestion，不来自 recall** | `interaction.rs` 的 boost 基于入站标签（reply/sent/dm/mention），**在 ingest 时写入，不是从 recall 行为反推** | `score/signals/interaction.rs:1-65` |
| **stability detector 无 reward** | 半衰期衰减 + facet 升降级（Active/Provisional/Candidate），但**输入来自 turn hooks（ReflectionHook/UserProfileHook/ToolTrackerHook），不是 recall outcome** | `learning/stability_detector.rs:1-100` |
| **learning 模块无 RL** | `learning/` 只有 `stability_detector.rs` + config schema，**grep `reward|reinforce|fine.?tune|eval.?loop` → 0 个核心算法** | claims-ledger F1 验证 |

### "认识你几分钟" 的真实语义

OpenHuman 所谓 "gets to know you in minutes" = **ingestion latency**：
1. OAuth 授权 → 拉取邮件/聊天
2. Memory Tree chunk + fast-score + LLM summarize
3. Agent prompt 注入最近摘要

这测量的是 **"数据管道多快能把你的信息塞进 context window"**，不是 **"agent 多快能形成对你偏好的 model"**。后者需要消费反馈闭环（recall → use → 有用吗？→ 调权重），OpenHuman **没有这个环**。

### Cat Café F200 对比（护城河差异，不是优劣）

| 维度 | OpenHuman | Cat Café (F200) |
|------|-----------|-----------------|
| 摄入速度 | ✅ 快（OAuth 直拉 + Memory Tree auto-ingest） | ⚠️ 慢（thread/doc 手动/半自动） |
| 检索质量信号 | ❌ 无（static score at ingest） | ✅ 有（consumption-weighted ranking, recall_events） |
| 反馈闭环 | ❌ 无（access_count=None 硬编码） | ✅ 有（消费事件 → rerank → eval） |
| 哲学 | "给够 context，LLM 自己会用好" | "context 多了会污染，必须 eval 哪些被真正消费" |

**两条路都成立，看用户预期**。不要把这个写成"OpenHuman 弱"——他们的 ingestion pipeline 工程质量很高（47 和砚砚已验证），只是选了一条不做 recall eval 的路。

## §5. B2 Hermes 对比表公允性 — ⚠️ **偏 marketing，但不 overclaim**

### README 比较表审查

README 用 🚫/⚠️/✅/🚀 四级对比 Hermes / Claude Cowork / OpenClaw / OpenHuman：

- Hermes 被标 "Memory: ✅ Self-learning"
- OpenHuman 被标 "Memory: 🚀 Memory Tree + Obsidian vault"

这个对比**事实层面成立**：Hermes 确实有某种 self-learning 机制；OpenHuman 没 claim self-learning，而是用 Memory Tree 作为替代叙事。

**但 emoji 暗示偏营销**：🚀 > ✅ 在视觉上暗示 "我们更高级"，而实际上两家在做不同维度的事。Memory Tree 是检索架构创新；self-learning 是反馈闭环创新。不在一个轴上。

### Verdict

比较表**没有结构性 overclaim**（没说"我们也有 self-learning"），但 **emoji 梯度引导读者认为 🚀 > ✅**。如果我们做对比表，应该用文字标注维度而非 emoji 梯度。

## §6. subconscious 模块 — ✅ **真实后台 LLM 工作循环**（遗留 4 验证）

`subconscious/engine.rs:1-120`：

- 独立后台循环，`interval_minutes` 调度（最小 5 分钟）
- SQLite 存储：加载到期任务 → 本地 LLM 评估 → 执行 → 模糊结果升级给主 agent
- 重叠守护：generation counter 防止并发执行
- 产出 typed reflections，与 Memory Tree 耦合（反思可入树）

**和 Cat Café 对比**：类似我们的 `subconscious` 概念（背景 LLM 处理），但 OpenHuman 用独立定时器循环 + SQLite 持久化，我们用 cron/scheduled tasks + MCP。模式相当，实现路径不同。

## §7. 17 内置 agent 分类 — **全部 prompt-only**（遗留 7 验证）

| Agent | 代码量 | 类型 | 关键能力 |
|-------|--------|------|----------|
| archivist | ~120 行 | prompt-only | 知识归档 |
| code_executor | ~180 行 | prompt-only | 代码执行 |
| critic | ~100 行 | prompt-only | 输出审查 |
| crypto_agent | ~90 行 | prompt-only | 加密/钱包 |
| help | ~80 行 | prompt-only | 帮助/FAQ |
| integrations_agent | ~140 行 | prompt-only | 第三方集成 |
| morning_briefing | ~160 行 | prompt-only | 晨报 |
| orchestrator | ~242 行 | prompt-only | 主调度（最大） |
| planner | ~120 行 | prompt-only | 任务规划 |
| researcher | ~130 行 | prompt-only | 搜索/调研 |
| skill_creator | ~150 行 | prompt-only | 生成新 skill |
| summarizer | ~90 行 | prompt-only | 摘要 |
| tool_maker | ~110 行 | prompt-only | 生成新 tool |
| tools_agent | ~100 行 | prompt-only | 通用工具调用 |
| trigger_reactor | ~80 行 | prompt-only | 事件响应 |
| trigger_triage | ~90 行 | prompt-only | 事件分流 |
| welcome | ~40 行 | prompt-only | 欢迎引导 |

每个 agent = `prompt.rs`（template composer）+ `prompt.md`（system prompt 模板）。**没有独立调度、状态机或事件循环**。

所有状态管理在 `agent/harness/session/` 的 session state machine（`turn.rs`：single-interaction lifecycle → LLM call → tool dispatch → result）和 `tool_loop.rs`（agentic tool-use 循环，max iterations 限制）。

**Cat Café 对比**：我们用 3 个 model-distinct 猫（布偶猫/缅因猫/暹罗猫）+ L0 system prompt + 跨族 review 强制。OpenHuman 用 17 个 prompt-only wrapper + orchestrator 路由。他们的 agent 多样性是 prompt template diversity，不是 model diversity 或 identity diversity。

## §8. 推理路由（遗留 8 验证）

`routing/policy.rs:88-183`：

**纯规则，无 LLM judge**：

1. `classify(model_hint)` → 三类：Lightweight / Medium / Heavy
   - Lightweight: `hint:reaction`, `hint:classify`, `hint:format`, `hint:sentiment`
   - Medium: `hint:summarize`, `hint:tool_lite`
   - Heavy: `hint:reasoning`, `hint:chat`, exact model names, unknowns
2. Routing decision = category × local health × routing hints
   - Lightweight: local-first
   - Medium: local only if `LatencyBudget::Low` OR `CostSensitivity::High`
   - Heavy: always remote, never local fallback
3. `privacy_required` hint → force local regardless of category

**Cat Café 对比**：我们没有动态 model routing（猫的身份绑定模型）。OpenHuman 的 hint-based routing 值得参考如果我们做 cost-aware tool dispatch，但和我们"身份 = 模型"的设计不冲突。

## 遗留项处置小结

| 遗留 # | 问题 | Verdict | 证据位置 |
|--------|------|---------|----------|
| 4 | subconscious 模块 | ✅ 真实后台 LLM 循环 | `subconscious/engine.rs:1-120` |
| 7 | 17 内置 agent | ✅ 全部 prompt-only wrapper | `agent/agents/*/prompt.rs` |
| 8 | inference/routing 策略 | ✅ 纯规则三类 dispatch | `routing/policy.rs:88-183` |

## claims-ledger 更新建议（给 47 合流用）

| Claim | 原 Verdict | 建议更新 | 依据 |
|-------|-----------|---------|------|
| B1 | ⚠️ partial | ⚠️ **confirmed partial** — "认识你"= ingestion latency, 无 recall eval 闭环 | §4 零反馈链证据 |
| B2 | ❓ 未验证 | ⚠️ **fair but marketing-biased** — emoji 梯度暗示优越性 | §5 对比表审查 |
| C1 | ✅ verified | ✅ **mechanism verified, "80%" is aspirational** — fixture 实测 20-66% | §2 fixture 数据 |
| D1 | ✅ verified | ✅ **补充：单轨替换，非双轨；Memory Tree 正交运行** | §3 factories.rs 互斥逻辑 |
| F1 | 🚫 none claimed | 🚫 **confirmed：零反馈闭环，access_count 硬编码 None** | §4 全面 absence check |

[宪宪/Opus-46🐾]
