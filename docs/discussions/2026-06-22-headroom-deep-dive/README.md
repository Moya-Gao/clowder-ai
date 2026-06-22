# Headroom 深度拆解 — The Context Compression Layer for AI Agents

> 拆解类型：明星开源项目「宣传 claim → 源码证据 → 能力边界 → 我们的 tradeoff」审计
> 方法：clone 源码 + 3 路 subagent 交叉取证，每个判断追到 `path:line`
> 作者：宪宪 (@opus, claude-opus-4-6) · 2026-06-22
> 对标：RTK 拆解（2026-06-15，opus-48）+ 家里 F236（Anchor-First Context 入口）

---

## 0. 元信息（真相源）

| 项 | 值 |
|---|---|
| Source repo | https://github.com/headroomlabs-ai/headroom |
| Local path | `/Users/lysander/projects/ref/headroom` |
| HEAD SHA | `95b2333ee5a3f1cbe512ca04a6563c3572835758` |
| 版本 tag | `v0.27.0` |
| Default branch | `main` |
| 抓取时间 | 2026-06-22 |
| 代码规模 | **~1,082,241 行**（3294 tracked files）/ Python 904 files + Rust 176 files + TypeScript 1090 files |
| 工程活动 | **1,664 commits** / 创建 2026-01-07（~5.5 个月）/ 最后 commit 2026-06-22 |
| GitHub 热度 | **46,303 stars / 3,216 forks**（gh api 一手核实）/ 279 stars/day |
| Contributors | **110 人**（top: chopratejas 588 + JerrettDavis 246）|
| License | Apache-2.0 |
| 核心依赖 | tiktoken, tree-sitter, onnxruntime, ast-grep-cli, magika, sqlite-vec, sentence-transformers |
| Build | Maturin（PyO3 Rust extension）+ npm workspace |

**铲屎官原始问题**：① headroom 声称的 token 节约是否真实；② 和 RTK 对比，和 F236 对比。**专治"被营销带跑"**。

---

## 1. TL;DR（一句话）

**Headroom 是一个真材实料的大型工程项目，比 RTK 高一个量级，不是营销空壳。** 它实际包含 6 个压缩机制（Rust PyO3 的 SmartCrusher + tree-sitter AST CodeCompressor + ModernBERT ML token 分类器 Kompress + 多层 CacheAligner + 多源 relevance 评分 + LogCompressor/SearchCompressor/DiffCompressor 等），且 token 计量 **使用了真 tokenizer**（tiktoken 做 OpenAI 模型的 primary counter），非 RTK 的 bytes/4 造假。架构层面：**headroom 以 HTTP proxy 拦截全部 API 流量**，能看到 Read/Grep/Glob 的 tool_result——但 **Read/Grep/Glob 默认排除压缩**（`config.py DEFAULT_EXCLUDE_TOOLS`，防止编辑冲突），只有 stale reads 才压。所以实际默认压缩范围和 RTK 类似（Bash+JSON+logs 为主），只是架构天花板更高。

但它并非没有水分：① **headroom 自己的生产遥测承认中位压缩只有 4.8%、均值 11.3%**（`benchmarks.mdx:127-130`），README 的 "60-95%" 是 demo 高值不是默认收益；② README savings 表用合成数据 + `len(text)//4` 估算，不可复现；③ 对 Anthropic/Claude 模型（**headroom 最大用户群**）token 计量是 `chars/3.5` 估算，没有真 tokenizer；④ Read/Grep/Glob **默认排除压缩**（`config.py DEFAULT_EXCLUDE_TOOLS`），实际默认压缩范围和 RTK 类似；⑤ "Output token reduction" 实质是往 system prompt 追加 "be terse" + 调低 thinking effort，包装成独立 feature。

**给 CVO 一句话**：如果要用"一键省 token"工具，headroom 是目前最诚实、最全面的开源选择——它真的能压，比 RTK 覆盖面广，且可逆（CCR）。但它的**哲学**和我们的 F236 根本不同：headroom 是"先丢后找回"（有损压缩 + 安全网），F236 是"先不给全文，需要再 drill"（信息无损 + 按需深入）。两者正交可互补，但不要把 headroom 的 proxy 架构和我们的 MCP 内层架构混为一谈。

---

## 2. Claims Ledger（宣传 → 证据 → 判决）

| # | Claim（README） | 判决 | 证据 / Caveat |
|---|---|---|---|
| C1 | "**60-95% fewer tokens**" | ⚠️ **营销高值 vs 生产真实严重脱节** | 压缩机制真实存在且有效；**但** ① **headroom 自己的生产遥测（`benchmarks.mdx:123-132`，50000+ sessions / 250+ instances）承认：中位压缩率只有 4.8%，均值 11.3%**，只有 heavy tool-use 才到 40-80%——README 首页的 "60-95%" 是 workload/demo 高值，不是默认收益；② token 计量对 Anthropic 模型是 `chars/3.5` 估算（`tokenizers/registry.py:336`），eval 框架内部用 `len(text)//4`（`evals/core.py:263`），`headroom perf` CLI 显示的也是估算值非 API 真实 usage；③ **README 那张 savings 表（17765→1408 等）的数字不可从仓库复现**——出自合成数据 + `len(text)//4` + 无种子；④ accuracy 表（GSM8K/TruthfulQA/SQuAD/BFCL）可复现，但 N=100 |
| C2 | "**6 algorithms**" | ✅ **大致属实** | SmartCrusher（Rust PyO3，JSON CSV 转写 + relevance row-drop）、CodeCompressor（tree-sitter AST 7 语言）、Kompress-base（ModernBERT ONNX token 分类器，extractive）、ContentRouter（Magika ML 检测 + 启发式路由）、CacheAligner（prefix 稳定 + cache_control 注入 + 冻结追踪三层）、IntelligentContext（BM25 + embedding 混合 + 时间衰减 + access 加权 + budget 优化，分散在 relevance/ memory/ ccr/ proxy/ 四个模块）。每个都有真代码，不是 stub |
| C3 | "**Same answers, fraction of the tokens**"（accuracy preserved） | ⚠️ **大胆宣传，证据有限** | README 那张 benchmark 表（GSM8K 0.870、TruthfulQA 0.560、SQuAD 97%、BFCL 97%）可复现（`headroom.evals suite --tier 1`），**但**：N=100 样本量不大；Kompress 是 extractive（直接丢 token），信息必然丢失；README 写 `±0.000` 的 GSM8K 数学不受 extractive 影响合理（数字/公式是高 entropy token 会被保留），但长 context 理解类任务影响待验 |
| C4 | "**Reversible (CCR)**" | ✅ **真** | CCR 实现在 `headroom/ccr/`：① **Store**：`cache/compression_store.py:261` 用内存 dict + SHA-256 key + TTL 30min + max 1000 LRU（Rust 侧 BLAKE3，`crates/headroom-core/src/ccr/mod.rs:72`）；② **Marker**：压缩内容注入 `[100 items compressed to 10. Retrieve more: hash=abc123...]` 或 `<<ccr:HASH>>`；③ **Retrieval 三路径**：auto-execute（`response_handler.py:420`，LLM 调 `headroom_retrieve` → proxy 拦截取回 → 最多 3 轮）+ HTTP `POST /v1/retrieve` + MCP server；④ **Proactive expansion**（`context_tracker.py:193`）：新 query 与已压缩内容关键词重叠 → 预展开。是真的 cache-and-replace + retrieval 机制 |
| C5 | "**local-first**" | ✅ **真** | proxy 跑在 `127.0.0.1`，模型从 HuggingFace 下载后本地 ONNX 推理，数据不出本机。唯一网络流量是 upstream LLM API 调用（那本来就要发的）|
| C6 | "**Cross-agent memory** — shared store across Claude, Codex, Gemini" | ⚠️ **Claude+Codex 有，Gemini 虚** | SQLite + sqlite-vec 做 vector 记忆后端，真向量搜索（sentence-transformers / ONNX / OpenAI embedding）；`ClaudeCodeAdapter` 读写 `~/.claude/projects/.../memory/*.md`、`CodexAdapter` 读写 `AGENTS.md`，双向同步 + SHA-256 去重 + 反回声。**但** Gemini adapter 不存在于 `sync_adapters/`，"across Gemini" 是 roadmap 非现状 |
| C7 | "**headroom learn** — mines failed sessions" | ✅ **真反馈环** | LLM 分析 JSONL session（`analyzer.py:676-712`）→ 结构化 JSON recommendations → `ClaudeCodeWriter`（`writer.py:198-243`）写入 `CLAUDE.md` 的 `<!-- headroom:learn:start/end -->` 标记块 → 下次 session agent 读到新规则 → 行为改变。先前规则作为 "Prior Learned Patterns" 回喂给分析 LLM。dry-run 默认，`--apply` 才写。是真 signal→decision→state→behavior 闭环 |
| C8 | "**Output token reduction** — verbosity steering + effort routing" | ⚠️ **真功能但营销包装** | 实现在 `proxy/output_shaper.py`：① "Verbosity steering"（lines 60-83, 253-286）= 往 system prompt tail 追加 "be terse" 指令，4 级别，可通过 `headroom learn --verbosity` 从 session 中断信号自动学习级别；② "Effort routing"（lines 289-325）= turn 分类（纯 tool_result 续 = routine，新问题/错误 = 保持）→ routine 时 `output_config.effort` 降到 "low" + `thinking.budget_tokens` 压到 1024（但 **never inject when absent** 防 400，**never toggle thinking.type** 防 cache 失效）。**默认关闭**（`HEADROOM_OUTPUT_SHAPER` 需显式设）。**诚实度加分**：output savings 标注 "counterfactual estimate" + 提供 holdout 实测方案（`HEADROOM_OUTPUT_HOLDOUT=0.1`）+ 置信区间。但包装成独立 feature 有营销成分 |
| C9 | "**Attribution: ships with RTK binary**" | ✅ **诚实** | `rtk/installer.py` 下载 rtk v0.28.2 二进制（`__init__.py:15`），`headroom wrap claude` 时调 `rtk init --global --auto-patch` 注入 PreToolUse hook。RTK 是可选的（缺失时 graceful degrade），headroom 追踪 RTK savings 并暴露 Prometheus metrics。README:393 主动 attribution + 说明 headroom 压缩 RTK 下游 |
| C10 | "**Kompress-v2-base** — our HuggingFace model trained on agentic traces" | ✅ **真 ML 模型** | `HeadroomCompressorModel`（`kompress_compressor.py:289-342`）：ModernBERT-base 768-dim encoder + token head（Linear 768→2）+ span head（Conv1d→GELU→Conv1d→Sigmoid）。ONNX INT8 artifact ~261MB。Per-token keep/discard 分类 + span importance boost。extractive（原文 token 子集），不生成新 token。F1=0.913（claimed vs labeled dataset_v2 test split n=500）|

---

## 3. 架构地图

```
headroom (Python+Rust+TS 混合工程, Maturin build)
│
├─ headroom/                    ★ Python 主包（904 files）
│   ├─ proxy/                   ★★ 核心: FastAPI HTTP proxy
│   │   ├─ server.py (4000+ 行) AnthropicHandler / OpenAIHandler / GeminiHandler / BedrockHandler
│   │   ├─ memory_query.py      proxy-level 记忆查询
│   │   ├─ memory_ranker.py     RecencyBoostRanker (cosine * exp(-age/30))
│   │   ├─ cc_switch_reconciler.py  context 切换协调
│   │   └─ interceptors/        工具结果拦截器 (opt-in)
│   │
│   ├─ transforms/              ★★ 压缩管线
│   │   ├─ pipeline.py          TransformPipeline: ToolResultInterceptor → CacheAligner → ContentRouter
│   │   ├─ smart_crusher.py     SmartCrusher (PyO3 Rust 桥, JSON CSV compaction + lossy row-drop)
│   │   ├─ code_compressor.py   CodeCompressor (tree-sitter AST, 7 语言)
│   │   ├─ kompress_compressor.py KompressCompressor (ModernBERT ONNX token classifier)
│   │   ├─ content_router.py    ContentRouter (Magika ML + regex 启发式 → 策略路由)
│   │   ├─ cache_aligner.py     CacheAligner (volatile 检测 + 警告)
│   │   ├─ log_compressor.py    LogCompressor
│   │   ├─ search_compressor.py SearchCompressor
│   │   ├─ diff_compressor.py   DiffCompressor
│   │   ├─ html_extractor.py    HTMLExtractor
│   │   └─ read_lifecycle.py    Read lifecycle management
│   │
│   ├─ compression/             结构感知压缩（通用层）
│   │   ├─ universal.py         UniversalCompressor (ML 检测 + handler mask + entropy 保留 + CCR)
│   │   ├─ detector.py          Magika ML / FallbackDetector
│   │   ├─ masks.py             StructureMask (字符级 keep/discard 遮罩)
│   │   └─ handlers/            JSON / Code structure handlers
│   │
│   ├─ tokenizers/              ★ token 计量（关键诚实度指标）
│   │   ├─ tiktoken_counter.py  真 BPE tokenizer (OpenAI 模型, 有 10s 超时保护)
│   │   ├─ huggingface.py       HF AutoTokenizer (Llama/Qwen/DeepSeek/Phi 等)
│   │   ├─ mistral.py           mistral-common 官方 tokenizer
│   │   ├─ estimator.py         ⚠️ 估算 fallback (Anthropic: chars/3.5, Gemini: chars/4.0)
│   │   └─ registry.py          模型→tokenizer 路由 (regex pattern matching)
│   │
│   ├─ ccr/                     Compressed Content Retrieval (可逆性)
│   │   ├─ batch_store.py       SQLite 原文缓存
│   │   ├─ context_tracker.py   跨 turn 追踪 + relevance 评分
│   │   ├─ response_handler.py  响应处理
│   │   ├─ tool_injection.py    headroom_retrieve MCP 工具注入
│   │   └─ mcp_server.py        MCP server for CCR retrieval
│   │
│   ├─ memory/                  跨 agent 记忆
│   │   ├─ adapters/sqlite.py   SQLite 后端 + sqlite-vec 向量索引 + FTS5 BM25
│   │   ├─ core.py              HierarchicalMemory (scoped, temporal, embedding search)
│   │   ├─ sync.py              SHA-256 去重 + 反回声
│   │   └─ sync_adapters/       ClaudeCodeAdapter / CodexAdapter (双向文件格式桥接)
│   │
│   ├─ cache/                   KV cache 优化三层
│   │   ├─ anthropic.py         ★ _stabilize_text (date→tail, whitespace normalize) + breakpoint inject
│   │   └─ prefix_tracker.py    Session-scoped freeze (API response 确认后冻结 prefix)
│   │
│   ├─ relevance/               相关性评分
│   │   ├─ bm25.py              标准 BM25 (k1=1.5, b=0.75)
│   │   └─ hybrid.py            BM25 + embedding 混合 (自适应 alpha)
│   │
│   ├─ learn/                   headroom learn 反馈环
│   │   ├─ analyzer.py          LLM 分析 session JSONL → 结构化建议
│   │   └─ writer.py            ClaudeCodeWriter → CLAUDE.md 标记块
│   │
│   ├─ rtk/                     RTK 集成（可选二进制）
│   │   └─ installer.py         下载 rtk v0.28.2, rtk init --global --auto-patch
│   │
│   ├─ providers/               Agent 适配层
│   │   ├─ claude/              ANTHROPIC_BASE_URL 重定向
│   │   ├─ codex/               Codex 适配
│   │   ├─ copilot/             GitHub Copilot CLI 适配
│   │   ├─ aider/               Aider 适配
│   │   └─ registry.py          多 provider 路由
│   │
│   ├─ evals/                   评测框架
│   │   ├─ core.py              ⚠️ _estimate_tokens = len(text)//4
│   │   ├─ suite_runner.py      GSM8K/TruthfulQA/SQuAD/BFCL tier 1-3
│   │   └─ runners/             Per-benchmark runners
│   │
│   ├─ graph/                   代码图谱（--code-graph）
│   ├─ image/                   图像压缩（ML router）
│   ├─ prediction/              预测/预取
│   ├─ pricing/                 成本计算
│   ├─ observability/           OTel + Prometheus
│   └─ dashboard/               Web dashboard
│
├─ crates/                      Rust 核心（176 files, 67k 行）
│   ├─ headroom-core/           SmartCrusher Rust 实现 + 388 unit tests + property tests
│   ├─ headroom-py/             PyO3 绑定
│   ├─ headroom-proxy/          代理核心
│   └─ headroom-parity/         Python/Rust parity 验证
│
├─ plugins/                     插件
│   ├─ headroom-agent-hooks/    TypeScript agent hooks
│   ├─ headroom-oauth2/         OAuth2
│   ├─ hermes/                  Hermes Agent 集成
│   └─ openclaw/                OpenClaw 集成
│
├─ benchmarks/                  基准测试
├─ e2e/                         端到端测试
├─ docs/                        文档站（MDX）
└─ examples/                    使用示例
```

**State stores**: SQLite（CCR 原文缓存 + memory 向量索引 + tracking）、文件系统（CLAUDE.md / AGENTS.md 规则注入）。
**Extension points**: Pipeline 扩展（`on_pipeline_event`）、自定义压缩 handlers、ContentRouter 策略覆盖、per-tool 压缩 profile。
**Engineering discipline**: Maturin build + 388 Rust unit tests + property tests + 17 CI workflows + codecov + e2e suites + devcontainers。

---

## 4. 核心机制深挖

### 4.1 压缩管线（TransformPipeline）

```
Request → ToolResultInterceptor (opt-in) → CacheAligner → ContentRouter → Compressed Request → Upstream LLM
```

- **ToolResultInterceptor**（opt-in via `HEADROOM_INTERCEPT_ENABLED=1`）：在下游压缩器之前先缩小 tool_result。
- **CacheAligner**：三层——① 检测 volatile content（UUID/timestamp/JWT）用结构验证不用 regex → 警告 ② `_stabilize_text` 剥离 date 移到 tail + normalize whitespace → prefix 字节不变 → KV cache 命中 ③ `prefix_tracker` 读 API response cache 指标冻结已缓存 prefix 不再改。
- **ContentRouter**：Magika ML 检测内容类型 + regex 启发式 → 策略路由表：JSON→SmartCrusher / Code→CodeCompressor(tree-sitter) / Text→Kompress(ML) / Log→LogCompressor / Search→SearchCompressor / HTML→HTMLExtractor / Diff→DiffCompressor。失败 waterfall: strategy → Kompress → LogCompressor → passthrough。

**关键架构差异 vs RTK**：RTK 在 **工具执行层** hook（只 Bash），headroom 在 **API 传输层** proxy（全部 messages）。这意味着 headroom 看得到 Read/Grep/Glob 的 tool_result——它们在 Claude Code 发送 API 请求时已经嵌在 conversation payload 里了。

**⚠️ 但 Read/Grep/Glob 默认排除压缩！**（`config.py:211-225` `DEFAULT_EXCLUDE_TOOLS` 冻结集含 Read/Glob/Grep/Write/Edit）——原因：这些工具返回 agent 编辑文件需要的精确内容，压缩会导致重复/冲突编辑。**只有 "stale reads"（文件已被后续编辑使读取过时）才会被压缩**（`ReadLifecycleManager` at `read_lifecycle.py`）。所以 headroom 的"All context"覆盖在架构上是真的（看得到），但在实际压缩上**默认和 RTK 一样不压 Read/Grep/Glob**——只是原因不同（RTK 是看不到，headroom 是看得到但选择不压）。

### 4.2 Token 计量（关键诚实度对比）

| 模型家族 | RTK 计量 | Headroom 计量 |
|----------|---------|--------------|
| OpenAI (GPT-4o等) | `bytes/4` | **tiktoken BPE**（`tiktoken_counter.py:238`，真编码，10s 超时保护）|
| Anthropic (Claude) | `bytes/4` | `chars/3.5` 估算（`registry.py:336`）— Claude tokenizer 非公开 |
| Mistral | `bytes/4` | **mistral-common 官方**（`mistral.py:163`）|
| Llama/Qwen/DeepSeek | `bytes/4` | **HF AutoTokenizer**（`huggingface.py:220`）|
| Gemini | `bytes/4` | `chars/4.0` 估算 |
| 未知模型 | `bytes/4` | 自适应 `chars/4.0` 估算 |

**判决**：headroom 比 RTK 诚实一个量级。OpenAI/Mistral/开源模型用真 tokenizer，Anthropic 用校准估算（`chars/3.5` 比 RTK 的 `bytes/4` 更接近真实值，且标注清楚是 estimation）。**但** Anthropic/Claude 是 headroom 最大用户群（`headroom wrap claude` 是第一推荐用法），这个群体恰好用的是估算。

### 4.3 SmartCrusher（JSON 压缩）

**Rust 核心，PyO3 桥接**。Python 实现已退役（`smart_crusher.py:1-8` 声明），17 个 parity fixture 验证后删除。388 Rust 单元测试 + property tests。

两个策略：
1. **Lossless compaction**（默认 "PR4"）：JSON array → CSV + schema 字符串（`lossless_min_savings_ratio=0.15`）
2. **Lossy row-drop**：relevance 评分低的行替换为 `{"_ccr_dropped": "<<ccr:HASH N_rows_offloaded>>"}` → agent 可通过 `headroom_retrieve` 取回

**Verdict**: 真算法，含量高，Rust 实现。

### 4.4 CodeCompressor（AST 代码压缩）

**真 tree-sitter AST 解析**。7 语言：Python/JS/TS（Tier 1）、Go/Rust/Java/C/C++（Tier 2）。

算法：parse AST → 多遍 symbol importance 分析（引用计数 + fan-out + min-max 归一化）→ per-function body 行预算 → 保整条 AST statement 不断中间 → 语法重验证。参考论文 LongCodeZip（`arxiv.org/abs/2510.00446`）。

**可选依赖**：没装 `headroom-ai[code]` 时退化到 Kompress 或 regex。

### 4.5 Kompress-base（ML token 分类器）

**真 ML 推理**，extractive compression。

模型：ModernBERT-base（768-dim encoder）+ token head（Linear 768→2，keep/discard）+ span head（Conv1d CNN，span importance）。ONNX INT8 ~261MB。

决策规则（`kompress_compressor.py:318-332`）：keep if P(keep) > P(discard), OR if borderline (0.3-0.5) and span score > 0.5。文本切 350 词块，per-token 评分 → word-level max 聚合 → 阈值过滤。

**Verdict**: 真 ML 模型，extractive（原文子集），不是 abstractive。F1=0.913 claimed（labeled dataset_v2 test split n=500）。

### 4.6 CacheAligner（KV Cache 优化）

三层联动：
1. `cache_aligner.py`：检测 system prompt 中的 volatile content（UUID/timestamp/JWT/hex hash），**结构验证不用 regex**（`uuid.UUID()`、`datetime.fromisoformat()`、base64url decode）→ 只警告不改
2. `cache/anthropic.py` `_stabilize_text()`：剥离 date pattern 移到 tail → 前缀字节不变 → cache 命中 + normalize whitespace + 注入 `cache_control: ephemeral` breakpoint（最多 4 个 Anthropic 上限）
3. `cache/prefix_tracker.py`：读 API response `cache_read_tokens + cache_write_tokens` → 确认哪些 leading messages 已缓存 → 冻结不让压缩器动

**Verdict**: 真且巧妙。解决了"一个时间戳变动炸掉整个 prefix cache"的真实问题。

### 4.7 headroom learn（反馈环）

**真闭环**：session JSONL scanner → LLM 分析（LiteLLM / claude CLI / gemini CLI）→ 结构化 JSON recommendations → `ClaudeCodeWriter` 写入 `CLAUDE.md` 的 `<!-- headroom:learn:start/end -->` 标记块 → 下次 session agent 读到 → 行为改变。

先前规则作为 "Prior Learned Patterns" 回喂给分析 LLM，支持 merge/refine/drop。

**Verdict**: 是真 signal→decision→state→behavior 闭环，不是 RTK 的 write-only telemetry。

### 4.8 Cross-agent Memory

SQLite + sqlite-vec + FTS5 后端。4 种 embedding backend：sentence-transformers (MiniLM-L6-v2, 384-dim) / ONNX / OpenAI (text-embedding-3-small, 1536-dim) / Ollama (nomic-embed-text, 768-dim)。

双向适配器：`ClaudeCodeAdapter`（读写 `~/.claude/projects/.../memory/*.md`）+ `CodexAdapter`（读写 `AGENTS.md`）。SHA-256 内容 hash 去重 + 反回声防循环导入。

**Verdict**: Claude↔Codex 是真。Gemini adapter 不存在。

---

## 5. vs RTK 对比

| 维度 | RTK | Headroom | 判决 |
|------|-----|----------|------|
| **架构** | PreToolUse hook（工具执行层）| HTTP proxy（API 传输层）| headroom 覆盖面根本性更广 |
| **覆盖范围** | 仅 Bash 工具输出 | 架构上看所有 API 消息；**但 Read/Grep/Glob 默认排除压缩**（`DEFAULT_EXCLUDE_TOOLS`），只压 stale reads | headroom 架构更广，但默认实际压缩范围与 RTK 类似（Bash+JSON+logs 为主）|
| **Token 计量** | `bytes/4`（冒充 token） | tiktoken(OpenAI) + 估算(Anthropic) | headroom 诚实一个量级 |
| **压缩机制** | Regex + per-command Rust parser | ML 模型 + AST + JSON schema + Rust 核心 | headroom 更多样 |
| **可逆性** | 不可逆 | CCR 可逆（SQLite 缓存 + MCP 取回）| headroom 更安全 |
| **自学习** | write-only telemetry（名不副实的 `learn`）| 真 LLM 分析 + CLAUDE.md 回写闭环 | headroom 是真闭环 |
| **跨 agent** | 无 | SQLite + 双向适配器 | headroom 有，但 Gemini 虚 |
| **Cache 优化** | 无 | CacheAligner 三层（稳定 prefix + breakpoint + freeze）| headroom 独有优势 |
| **性能开销** | "Rust 单二进制 <10ms"（无证据）| ML 模型推理 + proxy 网络 hop | headroom 开销更大 |
| **代码量** | 73k 行 Rust | 1M+ 行 Python+Rust+TS | 量级差异 |
| **RTK 关系** | — | 内嵌 RTK v0.28.2 做 Bash 预压缩 | headroom 是 RTK 的超集 |
| **Stars** | 62k (5 个月) | 46k (5.5 个月) | RTK 星更多但 headroom 更大更活 |

**一句话**：headroom 在**所有维度**都比 RTK 更强或相当，且**内嵌了 RTK**。唯一 RTK 赢的点是零额外开销（Rust 单二进制 vs ML 推理 + proxy hop）和更高星数。

---

## 6. vs F236（家里的 Anchor-First Context 入口）对比

| 维度 | F236（我们） | Headroom | 分析 |
|------|-----------|----------|------|
| **哲学** | "先给预览指针，需要再 drill"（信息无损） | "先压缩，丢的可取回"（有损 + 安全网） | **根本性差异**：F236 是 agent 主动信息饮食，headroom 是被动有损压缩 |
| **拦截层** | MCP 工具返回层（callback route projection） | HTTP proxy（API 传输层） | F236 更内层、更精确；headroom 更外层、更全覆盖 |
| **覆盖范围 V1** | MCP 协作读工具（thread-context/pending-mentions/list-tasks/get-message） | 所有 API 消息 | headroom 当前覆盖更广 |
| **覆盖范围 Phase C** | cc 原生 Read/Grep/Glob（PostToolUse hook）| 同（通过 proxy 看 tool_result）| 趋同——两条路达到同样覆盖 |
| **信息完整性** | 100% 原文可 drill 取回，零丢失 | extractive 压缩丢 token，CCR 可取回但需 agent 主动请求 | F236 更保守更安全 |
| **ML 开销** | 零 | Kompress ONNX 推理 + Magika 检测 | F236 零开销 |
| **Cache 优化** | 不涉及（正交维度） | CacheAligner 稳定 prefix | headroom 独有维度 |
| **可观测性** | OTel telemetry + eval domain（anchor-first）+ sunset verdict | Prometheus + dashboard + OTEL | 都有 |
| **部署** | 内置于 harness（零配置） | 需安装 + wrap 或 proxy | F236 零摩擦 |
| **哲学风险** | Preview 改变猫注意力（F236 spec 自承）| 压缩改变 LLM 理解（extractive 丢信息）| 都有风险，性质不同 |

### 正交可互补的维度

1. **CacheAligner**：headroom 的 prefix 稳定 + cache_control 注入是正交于压缩的优化——F236 不涉及，但我们的 harness 层可以借鉴。候选 lesson。
2. **headroom learn**：LLM 分析 session 失败 → 写规则。我们的 self-evolution skill 做类似事但更结构化。两者思路相近。
3. **Cross-agent memory**：我们有完整的 cat-cafe-memory 系统（记忆 / 图谱 / evidence），headroom 的 SQLite + 适配器是轻量版。

### 不同构、不应混淆的维度

1. **F236 是信息架构问题**（给 agent 看什么），headroom 是信息压缩问题（怎么塞进 context window）。
2. **F236 Phase C 的 PostToolUse hook 和 headroom proxy 是竞争替代路径**，不是互补——同一个 tool_result 不应被两层都压缩。

---

## 7. 算法剥皮表

| 被宣传成 | 真实性质 | 含量 |
|----------|---------|------|
| SmartCrusher "6 algorithms" | JSON CSV 转写 + relevance row-drop（Rust 实现） | **高**（真算法，388 tests）|
| CodeCompressor "AST-aware" | tree-sitter 解析 + importance 分析 + body 预算 | **高**（真 AST，7 语言）|
| Kompress-base "trained on agentic traces" | ModernBERT token classifier（extractive）| **高**（真 ML，F1=0.913）|
| ContentRouter "intelligent" | Magika ML + regex 启发式 → 固定策略表 | **中**（检测用 ML，路由是 if-else）|
| CacheAligner "stabilizes prefixes" | volatile 检测 + date 移尾 + breakpoint + freeze | **高**（三层联动，真解决真问题）|
| IntelligentContext "score-based fitting" | BM25 + embedding + 时间衰减 + access 加权 | **中-高**（分散在 4 模块，非统一系统）|
| Output token reduction | system prompt 追加 "be terse" + thinking effort 调低 | **低**（配置级优化，非算法）|
| headroom learn | LLM 分析 session → 写 CLAUDE.md 规则 | **中**（真闭环但核心是 LLM 判断）|

---

## 7b. ★ 生产遥测 vs README 营销（砚砚发现，关键证据）

headroom 自己的 `docs/content/docs/benchmarks.mdx:108-142` 公开了 **50,000+ proxy sessions / 250+ instances** 的生产遥测数据：

| 维度 | README 营销 | 生产遥测真值 | 判决 |
|------|-----------|-------------|------|
| **压缩率** | "60-95% fewer tokens" | 中位 **4.8%**、均值 **11.3%**、P75 仅 6.9% | ⚠️ **中位值只有营销下限的 1/12** |
| **高压缩场景** | 首页表：92%/73%/47% | "Heavy tool-use sessions: 40-80%" | demo 高值只在 heavy tool-use 重现 |
| **Proxy 开销** | 未明确宣传 | 中位 52ms、P99 4172ms、均值 161ms | 中位可接受，P99 超 4 秒 |
| **Fleet 总量** | — | 1.4B tokens saved、~$4000 省 | 249 个实例、~$16/实例 |

**为什么中位只有 4.8%？** 文档自己解释：*"Median compression is modest because many requests are short conversational turns."*——大多数 API 请求是短对话轮次（用户打字 / 模型短回），根本没什么可压的。只有 heavy tool-use（大量 Bash 输出、JSON 结果、日志）才进入高压缩区间。

**这直接回答了铲屎官"别被营销带跑"的要求**：headroom 的 "60-95%" 是 cherry-picked workload 高值，不是你装了它就能省那么多。多数场景省不到 5%。

---

## 8. Cat Café 对比（Learn / Gap / Do-Not-Follow）

### 可学（Learn）

1. **CacheAligner 三层联动**：prefix 稳定化（date 移尾 + whitespace normalize）+ cache_control breakpoint 注入 + session-scoped freeze tracking。这是**完全正交于压缩的省钱手段**——我们的 system prompt L0 不用改内容就能通过移动 volatile 部分来提高 cache 命中率。**候选 lesson / 可立项**。
2. **CCR 可逆压缩范式**：即使做有损压缩，也缓存原文 + 提供 retrieve 通道。我们的 F236 天然可逆（drill 取原文），但如果未来要做 Phase C 的 PostToolUse 截断，应确保原文可取回。headroom 的 CCR 是好参考。
3. **per-tool 压缩 profile**：`Grep:conservative, Bash:moderate, WebFetch:aggressive`——不同工具的输出对 agent 重要性不同，差异化压缩策略值得借鉴。F236 Phase C 可考虑 per-tool 策略。
4. **headroom learn 的标记块范式**：`<!-- headroom:learn:start/end -->` 标记 + 先前规则回喂 + merge/refine/drop。我们的 self-evolution 做类似事但更结构化。标记块防冲突的范式可吸收。

### 缺口（Gap，诚实承认）

- **Cache 优化**：我们没有系统性的 KV cache prefix 稳定化层。headroom 证明了这是真实收益（Anthropic prompt caching 90% 折扣 vs 25% 重写费用）。但这是正交于 F236 的维度。
- **跨 agent 记忆桥接**：headroom 的 SQLite + 适配器做了 Claude↔Codex 双向同步。我们有更强的 cat-cafe-memory 系统，但缅因猫（Codex/GPT）家族确实通过不同入口访问记忆——如果要做跨 runtime 记忆同步，headroom 的适配器模式是参考。

### 不 follow（Do-Not-Follow + 哲学理由）

1. **不 follow proxy 架构做压缩**：headroom 的 HTTP proxy 是"黑盒外挂"——它不理解 agent 的意图，只看到消息流。我们的 F236 在 MCP 内层做，**理解工具语义**（哪些字段是传球指令不能丢、哪些是 preview 可以截）。黑盒压缩有信息丢失风险且 debug 困难。哲学不同。
2. **不 follow extractive ML 压缩**：Kompress 的 per-token keep/discard 天然有信息丢失。我们的方向是"给指针让 agent 主动 drill"，不是"替 agent 决定什么重要"。Agent 自己判断需要什么比 ML 模型猜更可靠（P3 方向正确 > 执行速度）。
3. **不 follow "Output token reduction" 的营销包装**：往 system prompt 追加 "be terse" 是个好 trick，但不该被包装成独立 feature 和 "algorithm"。我们有自己的 prompt engineering 哲学，不做这种包装。
4. **不 follow chars/N token 估算做 Anthropic 计量**：虽然 headroom 比 RTK 诚实（标注了是估算），但既然 Claude 是主力用户，`chars/3.5` 估算的精度问题在 agent 编码工作流（大量代码/JSON）中会放大。如果我们做 token 计量，要想办法用更精确的方式（或直接用 API 返回的 usage 数据）。

---

## 9. 三方对比总表

| 维度 | RTK | Headroom | F236（我们） |
|------|-----|----------|-------------|
| 定位 | CLI 输出噪音压缩器 | 全 context 压缩代理层 | MCP 工具返回 anchor 化 |
| 架构层 | PreToolUse hook | HTTP proxy | MCP callback route |
| Read/Grep 覆盖 | ❌ 覆盖洞 | ⚠️ 看得到但默认不压（`DEFAULT_EXCLUDE_TOOLS`），只压 stale reads | ✅ Phase C PostToolUse（anchor 化不丢信息）|
| Token 计量 | bytes/4 (假) | tiktoken(OpenAI) + 估算(Anthropic) | API usage 真值 + OTel 真实指标 |
| 信息丢失 | 有损不可逆 | 有损 + CCR 可逆 | **无损**（preview + drill 取原文） |
| ML 开销 | 零 | ONNX 推理 + Magika | 零 |
| 自学习 | ❌ telemetry only | ✅ headroom learn | ✅ self-evolution + eval domain |
| Cache 优化 | 无 | CacheAligner 三层 | 不涉及（可借鉴） |
| 部署摩擦 | cargo install + rtk init | pip install + headroom wrap | 内置零配置 |
| 开源治理 | Apache-2.0 / 1 主力 | Apache-2.0 / 110 contributor | 自有 |

---

## 10. Lessons 候选（待 CVO 确认，不直接入全局）

- **L-candidate-1（CacheAligner）**：KV cache prefix 稳定化是正交于压缩的省钱维度——volatile content 移尾 + whitespace normalize + cache_control breakpoint + session-scoped freeze。值得作为独立优化探索（不依赖 headroom，原理可自研）。
- **L-candidate-2（per-tool 策略）**：不同工具输出的信息密度和 agent 依赖度不同，F236 Phase C 应考虑 per-tool 压缩/anchor 策略（如 Bash 可激进截断，Read 需保守）。
- **L-candidate-3（CCR 可逆范式）**：有损操作必须有原文取回通道。F236 天然满足（drill），但 Phase C PostToolUse 截断要确保原文可恢复。
- **L-candidate-4（token 计量诚实度标杆）**：评估"省 token"工具时，第一刀看"token 怎么算"——真 tokenizer (tiktoken/HF) vs chars/N 估算 vs bytes/N。headroom 在 OpenAI 侧做对了，在 Anthropic 侧没做到。我们如果做类似计量，用 API response 的 `usage` 字段（真值）。

---

## 11. 一句话给 CVO

**Headroom 是目前开源社区"agent token 优化"赛道里工程含量最高、覆盖面最广、且最诚实的项目。** 它的 proxy 架构补上了 RTK 的覆盖洞，6 个压缩机制有真材实料（Rust 核心 + ML 模型 + AST 解析），CCR 可逆机制是安全网。但它和我们 F236 的**哲学根本不同**——headroom 是"替 agent 决定什么重要然后压缩"（外部有损），F236 是"给 agent 指针让它自己决定要什么"（内部无损）。两者正交：如果铲屎官想白嫖省钱，headroom wrap 可以开箱即用；但我们自己的 F236 路线不应被 headroom 的 proxy 思路替代——**内层语义理解 > 外层黑盒压缩**。可学它的 CacheAligner 和 per-tool 策略，不学它的有损压缩哲学。

---

## Review 记录

> 待跨猫 review — 本报告需砚砚或其他跨族猫 review 后才算完成。

[宪宪/claude-opus-4-6 🐾]
