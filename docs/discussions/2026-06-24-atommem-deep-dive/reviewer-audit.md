---
doc_kind: research-note-review
topics: [atommem, open-source-teardown, memory-system, cross-family-review]
created: 2026-06-24
status: draft
parent_report: ./README.md
parent_author: "@codex [砚砚/GPT-5.5🐾]"
reviewer: "@opus-47 [宪宪/Opus 4.7🐾]"
review_type: cross-family-independent
source_repo: https://github.com/MINE-USTC/AtomMem
source_commit: 776f880941a02b10c495c126fe775d5e88ede5d4
verdict: approve-with-mandatory-revisions
---

# AtomMem Reviewer Audit — Cross-Family Independent Review

> Sibling document to [README.md](./README.md). Same source pin (`776f880`).
> Audit type: spot-check parent verdicts + 9th-lens user-mind evaluation (parent skipped) + 6 blind-spot findings.
> 选择不直接改 README 是为了保留**双视角并列**（缅因猫第一视角 / 布偶猫跨族审视）。P1 项请砚砚回修 README 后我 final-approve。

## 0. Reviewer Stance

砚砚事实层 ~95% hold，结构（claim ledger / 架构图 / 算法剥皮 / 反馈链 / Cat Café 对比 / lessons）覆盖完整，**给方向上的判断我都认同**。但 skill SOP 明确要求"双视角交叉，跨族优先"，并且 README `status: draft` 等第二视角，所以本文做三件事：

1. **Spot-check 关键 claim**——独立拉代码而不是只读 README 转述。
2. **补第 9 镜头**（User-Mind Evaluation）——skill `refs/user-mind-evaluation.md` 是必跑项，砚砚未显式做。
3. **补 6 项视线外发现**——一项 smoking gun 级（LoCoMo 过拟合）应升级 ledger verdict。

最终结论：**Approve with mandatory revisions**。下面 §5 是 P1/P2/P3 修订建议清单。

## 1. Spot-Check Verdicts（独立复核）

| 砚砚 ledger 条目 | 砚砚 verdict | 我独立 spot-check | 一致？ | 备注 |
|---|---|---|---|---|
| Atomic facts | Supported | `scripts/run_atommem_pipeline.py:142-207` 真有 `FactExtractor.extract_turn`；prompt-based 抽取 confirmed | ✅ | — |
| 三层 memory（facts/events/profiles）| Supported | `src/file_storage.py:23-27` 三个 JSON 文件 + 三个独立 manager 类，confirmed | ✅ | — |
| **PPR/RWR graph retrieval** | Supported | `AtomMemGraphQueryResponder.__init__` 默认 `enable_graph=True`；`scripts/run_atommem_pipeline.py:347-360` 主 QA path 上 seed → `MultiChannelFactGraphIndex` → `SeedOnlyGraphReranker.retrieve_ranked_topk` 一路通 | ✅ | 砚砚最关键的"接入主 QA path"判断正确 |
| Stable memory evolution | Partially supported | `temporal_profile_version_chain.py` 有 `history[]` + `valid_from/valid_to`；但无 rollback / confidence / reviewer gate confirmed | ✅ | 砚砚 caveat 准确 |
| **Scalable / economically viable** | Weak / unproven | 见 §2.3 单进程 namespace + 全局 mutable config——砚砚 "weak/unproven" 还低估了；应明确写**不是 multi-tenant / 不是并发安全** | ⚠️ | 需要加强表述 |
| Plug-and-play pipeline | Partially supported | `config.py` 是全局 module，`run_demo_server.py:274` 直接改 `config.API_KEY`——比"global config mutation"更严重，是**运行时全局污染**（见 §2.2） | ⚠️ | "Do Not Follow" 列表应加 |
| **LoCoMo reproducibility** | Partially supported | 见 §2.1——公开 codebase **已为 LoCoMo category 量身分叉 prompt**（cat2/cat3）；这是 smoking gun 级 caveat | ❌ | verdict 需升级 |

**Spot-check 结论**：5/7 一致，2/7 砚砚低估严重度（scale + LoCoMo），需要在 README 升级表述。**没有发现砚砚搞错的方向，只有低估的力度**。

## 2. 砚砚视线外的 6 项发现

### 2.1 LoCoMo Category 过拟合 — Smoking Gun

**证据**：

- `prompts/answer_generation_prompt.txt`（通用）
- `prompts/answer_generation_prompt_cat2.txt`：开头自陈"specialized in **temporal reasoning** over conversation memory"——LoCoMo 官方 category 2 = temporal reasoning。
- `prompts/answer_generation_prompt_cat3.txt`：开头自陈"answering **open-domain and commonsense reasoning** questions"——LoCoMo 官方 category 3 = commonsense reasoning。
- `scripts/run_atommem_pipeline.py:486`：pipeline 把 `item.get("category")` 直接传到 `answer_query(category=...)`。
- `scripts/evaluate_locomo.py:337-338`：按 category 过滤 question；`634-637`：按 category 报指标。

**含义**：

公开 README 宣传"long-term memory system for personalized LLM agents"是**通用能力 claim**。但**公开 codebase 的主 QA prompt 已经按 LoCoMo benchmark 的 category 系统分叉**——这不是 generic memory system，是 **LoCoMo-conditioned answerer**。同一个 query 在 cat2 走 temporal prompt，cat3 走 commonsense prompt，cat1 走 default。生产场景拿不到 LoCoMo category 标签，意味着默认走 generic prompt——`cat2/cat3` 路径的 benchmark 数字**不代表通用能力**。

**砚砚 ledger #7 verdict 应升级**：`Partially supported` → `Supported, but pipeline is benchmark-coupled — answer prompts split by LoCoMo category at runtime; non-benchmark deployments default to generic prompt and cannot reproduce cat2/cat3 metrics out-of-the-box`。

### 2.2 Demo 全局 Config 污染 — 反模式

**证据**：`scripts/run_demo_server.py:274` 在 `DemoMemorySession` 初始化时直接执行 `config.API_KEY = settings.general_api_key`。

**含义**：

`config` 是模块级全局；多 session 并发时**后一个 session 的 API key 会覆盖前一个**——同一 process 多用户演示场景下，session A 的请求可能用 session B 的 key 调 LLM。`threading.RLock()` 只保护 per-session 状态，**不保护跨 session 的全局 module**。

砚砚 §1 ledger 写了"global `config` mutation"但措辞偏中性。这应该明确进 **§7 Do Not Follow**：从 user-supplied UI input 直接写全局 module state = 安全 + 正确性双反模式。

### 2.3 Multi-Tenant 不存在 — 单进程 namespace

**证据**：

- `src/file_storage.py:24-27`：`facts_{conversation_id}.json` 等四个文件直接拼路径，全部落到全局 `config.FACTS_DIR`（默认 `runs/default_memory`）。
- 无 `user_id` / `tenant_id` / `org_id` 概念（`rg -n "user_id|tenant" src/ atommem_core/ config.py` 全空）。
- 无并发写锁（demo 的 `threading.RLock` 是 per-session in-memory，不保护 JSON 写）。
- `load_facts() → mutate → save_json()` 是**读-改-写**模式，无 fsync / 无原子重命名（`src/file_storage.py:78-85` 直接 `save_json` 覆盖）。

**含义**：

`conversation_id` 是单一 namespace 字段，不是租户分层。所有 conversation 的 JSON 文件堆在一个目录、共用一份 config、共用一份 embedding model load——这是**单进程研究 demo 的形态**。砚砚架构图提了 `runs/atommem`，但应该明确加一行"不是 multi-tenant；并发写无保护；同 process 多 user 不安全"。

### 2.4 Judge 模型 `deepseek-v4-pro` 可疑 — Source Audit 信号

**证据**：`.env.example` 默认 `ATOMMEM_JUDGE_MODEL=deepseek-v4-pro`，endpoint 默认 `https://dashscope.aliyuncs.com/compatible-mode/v1`。

**含义**：

DeepSeek 2026-06 公开发布的最高版本是 v3.x 系列。`deepseek-v4-pro` 在公开 model catalog 里**没有对应可购买的 endpoint**。可能性三选一：

1. 作者使用了**未公开 / 内部 access** 的模型 — 那么 LoCoMo 数字**普通用户复现不了**。
2. 是占位字符串（dashscope 会 reject 未知 model）— 那么开箱 evaluate 会立即失败。
3. 是手误 / typo（实际意图是 deepseek-v3）— 那么 README "reproduces reported metrics" 的 claim 误导。

**符合 ADR-031 / source-audit 反射触发条件**：benchmark 数字 + 时效不明的模型名 + 复现 claim → 应在 README 加 audit note："judge endpoint 默认指向非公开 model；本地复现需手动改为可访问 model，数字与论文/README 一致性不保证"。

### 2.5 GitHub 社区信号 = 反向证据

**证据**（`gh issue list / gh pr list` 实测，2026-06-24）：

- Issues：**0**（all state）
- PRs：**0**（all state）
- Stars：14（创建 16 天后）
- Forks：1
- Description / license / pushedAt：`gh repo view --json ...` 部分字段返回为空（meta 也未完全填）

**含义**：

砚砚说"社区面薄弱"是中性观察，但**0 issue 0 PR + 创建 2 周** = "没有任何外部用户测试过、提过问题、贡献过"。对 memory system 这种用户量大就会暴露 edge case 的领域，**0 用户反馈不是健康，是没人用**。结合 §2.1（benchmark-coupled）+ §2.3（single-process），**当前阶段定位 = 论文配套实验代码 / paper-track demo**，不是社区验证过的工具。

建议 §2 加 "Community Signals" 段，明确写 0/0 的反向解读。

### 2.6 LLM Judge 触点密度比砚砚说的更密集

**证据**：`prompts/` 11 个 prompt 文件，覆盖 fact metadata / event attribution / event generation / profile extraction / profile temporal update / query intent / dedup conflict judge / 3 套 answer generation / 1 套 demo answer / 1 套 LoCoMo judge。

**含义**：

砚砚算法剥皮表已经把大部分点标为"LLM judge"，但读者读完仍可能误以为这是"几个关键 LLM 点 + 算法主体"。**真实形态是反过来**：从 raw turn 到最终 answer 全链路 8+ 个 LLM judge 决策点，PPR/RWR 是**唯一的非 LLM 算法节点**且只在 retrieval 阶段。建议在算法表上方加一句导语，量化 LLM judge 占比，让"AtomMem 是 LLM-orchestration system that includes one graph algorithm" 这个本质更突出。

## 3. 第 9 镜头：User-Mind Evaluation（砚砚未做，本 audit 补上）

> 来源：[`refs/user-mind-evaluation.md`](/Users/lysander/.claude/skills/open-source-teardown/refs/user-mind-evaluation.md)。
> 真用户识别：AtomMem 的 API 由 **agent**（人写 prompt + LLM 做判断 + 检索回调 LLM）调用，不是人类直接读 facts JSON。所以套 agent-user 视角。

### Layer A · 架构层 3 层判决

| 层 | 问题 | AtomMem 状态 | 判定 |
|---|------|-------------|-----|
| **L1: 可继续** | agent 拿到检索结果能 follow-up 吗？ | `fact_id` / `dia_id` 存在；但**无 authority/confidence/source-tier 标签**。fact 来自 LLM 抽取还是 user utterance 直引——retrieval 输出里**不可区分** | ⚠️ 部分 |
| **L2: 可分辨** | 工具有没有告诉 agent"这是 observation 还是 LLM-generation"？ | 所有 facts/events/profiles 统一装扮成"事实"；temporal profile 是 LLM-merged 但 retrieval 时和直引 fact 同等呈现 | ❌ 失败 |
| **L3: 可闭环** | agent 能据此 produce action → apply → re-observe 吗？ | **无 correction API、无 user write-back、无 fact 撤回路径**。demo "Flush Profiles" 是粗暴清空，不是定点修正 | ❌ 失败 |

**幻觉指纹判定**：AtomMem 的 facts 是"内容来自 LLM 抽取，但呈现为 observation"——正是 L2 失败的经典 fingerprint。

### Layer B · 体感层 3 个朴素问题

1. **信任 vs 验证**：拿到 retrieval 结果只能信任 — 无验证接口、无 dia_id 反查原对话 turn 的 official tool。**差评**。
2. **能回到代码不会撒谎的信号？**：fact_id 指向 JSON 文件、dia_id 指向 conversation 原文，**弱 provenance**。无 git SHA、无 test、无可执行的 verify path。**勉强 L1 不达 L3**。
3. **用完更确定 vs 更迷糊？**：当 LLM 抽取出错时（"atomic fact" 误抽 / profile temporal merge 误判），agent 拿到结果**没有信号知道这条是不是错的** — 多了"要不要信"的决策负担。**差评**。

### Layer C · 工程层 5 点 checklist

| # | 标准 | AtomMem | 备注 |
|---|------|---------|------|
| 1 | 进入猫的自然路径 | ⚠️ | 是 CLI + demo HTTP API，无 MCP tool / 无 agent-side integration；要求 agent runtime 自己包一层 |
| 2 | 明确现实接口 | ⚠️ | LLM in / LLM out，没暴露"reach back to original turn"的 deterministic interface |
| 3 | 给失败时的下一步 | ❌ | 检索 0 命中 / fact 冲突 / profile merge 失败时无指引；`enable_graph=False` 是 ablation 不是 fallback |
| 4 | 保留 provenance | ⚠️ | 有 `dia_id` 但不分 observation/generation；profile 的 evidence 链是 LLM 重写后的 summary，丢失原始 evidence text |
| 5 | 能被删除或收缩 | ⚠️ | JSON 文件可删；但删一个 profile 不级联清理引用它的 events/facts；无版本快照 |

**得分**：0 满足 / 5 部分 = 中度注意力负债。

### 第 9 镜头总判定

> **AtomMem 是 human-facing demo + benchmark runner，不是 agent-facing memory tool**。

L2/L3 全失败 + 体感三问全差评 + Layer C 0/5 满足——把它当成 "我们能借鉴几个想法的研究原型" 是对的；把它当成 "agent 可以直接接的 memory provider" 是 hindsight 烧 token 反例的同类风险。

**这一节建议作为 §6.5 或 §7.5 加入 README**（砚砚原报告 §5 反馈链/§6 Cat Café 对比之间是合适位置）。

## 4. Cat Café 对比补强（砚砚 §6 之外）

砚砚 §6 表已覆盖主要维度。补两条：

| Dimension | AtomMem | Cat Café | Learn / Gap / Do Not Follow | Reason |
|---|---|---|---|---|
| Multi-tenant / 并发隔离 | 单进程 namespace（`conversation_id` 拼路径）；JSON 读-改-写无原子性 | Thread/cat 分层 + Redis 多 namespace + commit-as-truth | Do Not Follow | AtomMem 的形态决定 production 拿不来用；Cat Café 这一面是硬约束（家规第 1 条 Redis 圣域 + 用户状态默认持久化）|
| Benchmark coupling | Public codebase 主 prompt 按 LoCoMo category 分叉 | 多 eval scenario（F192 Eval Hub），无单 benchmark hardcoded 到主 prompt | Do Not Follow | benchmark engineering ≠ 通用能力；Cat Café 必须保住 "eval 服务于产品，不是产品服务于 eval" 的方向 |

## 5. 修订建议清单（按优先级）

### P1 — 必须改 README 才能从 draft → reviewed

1. **§1 Claim Ledger #7** verdict 升级：`Partially supported` → `Supported, but pipeline is benchmark-coupled`，加 `prompts/answer_generation_prompt_cat{2,3}.txt` 路径 + `scripts/run_atommem_pipeline.py:486` 路径作为证据。
2. **§1 Claim Ledger "Scalable / economically viable"** caveat 加 "single-process namespace; concurrent write unsafe; non-tenant"（来自本文 §2.3）。
3. **§7 Do Not Follow** 加两条：
   - "运行时直接写全局 module state（如 demo `config.API_KEY = settings...`）—— 多 session 互污染反模式"
   - "把公开 codebase 主 QA prompt 按 benchmark category 分叉 —— benchmark engineering ≠ 通用能力"
4. **§2 架构图后**加一段 "Community / Reproducibility Audit"：0 issue / 0 PR / 默认 judge `deepseek-v4-pro` 可信度待核（本文 §2.4 + §2.5）。

### P2 — 强烈建议

5. **新增 §6.5 或 §7.5 "Agent-User Fit Verdict"** —— 集成本文 §3 第 9 镜头三层判决，明确写"human-facing demo + benchmark runner，不是 agent-facing memory tool"。
6. **§4 算法剥皮表**上方加导语，量化 LLM judge 触点密度（11 个 prompt / 8+ judge 决策点 / 1 个非 LLM 算法节点 = PPR），让本质更突出。

### P3 — 可选润色

7. **§6 Cat Café 对比表**加本文 §4 两个维度（multi-tenant + benchmark coupling）。
8. **§7 Lessons** 加一条："研究原型 README 的 reproducibility claim 默认要做 source-audit（model name + endpoint + benchmark dataset 的可获取性），不能只看 commit 时间和 star 数"。

## 6. Final Verdict

**Approve with mandatory revisions**

- 砚砚的报告方向、结构、主要事实层判断**全部 hold**。
- P1 四项修订改完后，README 可从 `status: draft` → `status: reviewed-v2`。
- P2/P3 是质量上限，建议但不阻塞。
- 改完后传球链：砚砚改 README @ 我 → 我 final-approve → @ 铲屎官做 Cat Café 沉淀决策（候选 lessons：见砚砚原文 §7；候选 ADR：multi-tenant 隔离纪律 + benchmark coupling 反模式；候选新 skill：—）。

跨族 review 立场无松动也无苛求 — 砚砚视线外的发现都附了代码路径自证，不是审美问题，是事实补强。

Reviewer: [宪宪/Opus 4.7🐾]
