---
doc_kind: research-note
topics: [codegraph, gitnexus, open-source-teardown, code-graph, mcp, code-intelligence, cat-cafe-internal-capability, comparison]
created: 2026-06-17
author: opus-48
source_repos:
  - https://github.com/colbymchenry/codegraph
  - https://github.com/abhigyanpatwari/GitNexus
source_snapshot:
  codegraph:
    upstream_commit: f34f60634249f681c88caa34dbbbd67f8e4857cd
    upstream_commit_date: 2026-06-16T12:16:00-05:00
    npm_version: "1.0.1"
    license: MIT
    stars: 50634
    forks: 3090
    created_at: 2026-01-18
    clean_source: /Users/lysander/projects/ref/codegraph
  gitnexus:
    upstream_commit: f1b84383888a206e5e124ed6fa556f01b142a202
    npm_latest: "1.6.5"
    license: PolyForm-Noncommercial-1.0.0
    stars: 41209
    created_at: 2025-08-02
    source: docs/discussions/2026-06-03-gitnexus-deep-dive/README.md (砚砚+opus-47 拆解，二手)
related:
  - docs/discussions/2026-06-03-gitnexus-deep-dive/README.md
  - docs/discussions/2026-06-15-rtk-deep-dive
  - docs/features/F102-memory-adapter-refactor.md
---

# CodeGraph vs GitNexus 拆解对比：内生 Code Graph Layer 该参考谁

> 衔接：砚砚（codex GPT-5.5）+ opus-47 已拆解 GitNexus 并把"要不要立 Code Graph Layer feat"的 Decision Packet 传给铲屎官（[gitnexus-deep-dive](../2026-06-03-gitnexus-deep-dive/README.md) §10.5）。本文是铲屎官要的第二个同类竞品拆解 + 对比，给立项决策补"如果做，参考谁、抄什么"的证据。

## 0. TL;DR

拆完两个项目，核心判断三句话：

1. **CodeGraph 和 GitNexus 是同一目标的两种工程哲学**：都把"代码仓库编译成可查询图谱给 agent 用"，但 GitNexus 是**大而全 + 花哨算法**（图数据库 LadybugDB / Leiden 社区发现 / 语义向量 / LLM wiki），CodeGraph 是**小而纯 + 确定性**（SQLite + 图 BFS + personalized PageRank，**零 LLM、零向量、零聚类**）。

2. **作为 Cat Café 内生 Code Graph Layer 的参考对象，CodeGraph 明显优于 GitNexus**，四个硬理由：① **License MIT**（可商用 / 可 fork / 可直接抄实现）vs GitNexus PolyForm-Noncommercial（法律上连商用参考都有顾虑）；② **架构更轻更易复刻**（`node:sqlite` 零 native 编译 + 确定性算法，没有图数据库/向量栈要养）；③ **staleness 被正面解决**（砚砚点名的 GitNexus 痛点，CodeGraph 用三层机制解了）；④ **有真 eval 文化**（客观 recall + 公开 benchmark 方法论，跟我们家 F192 eval 闭环同源）。

3. **但两者都不该被"装上用"或直接依赖**——我们要的是内生层。CodeGraph 是更好的**算法 + 工程范本**（读它的 `traversal.ts` / `schema.sql` / staleness 机制直接抄思路），不是依赖项。它仍会写你的 `CLAUDE.md`（碰 L0 真相源边界），且是 open-core（`getcodegraph.com` hosted 商业化，开源 CLI 长期投入取决于商业策略）。

**一句话**：GitNexus 证明了"对代码做东西"这个方向值得做；**CodeGraph 进一步证明了它可以做得很轻、很确定、很可复刻——它就是 Code Graph Layer spike 的现成参考实现（MIT、读得懂、确定性内核）**。

## 1. 检查范围与真相源

| 项 | CodeGraph | GitNexus（砚砚拆解，二手） |
|---|---|---|
| 上游仓库 | `github.com/colbymchenry/codegraph` | `github.com/abhigyanpatwari/GitNexus` |
| 干净源码 | `/Users/lysander/projects/ref/codegraph` | `/Users/lysander/projects/ref/GitNexus` |
| commit | `f34f60634249f681c88caa34dbbbd67f8e4857cd` | `f1b84383...` |
| commit 时间 | 2026-06-16 | 2026-06-03 |
| 版本 | npm `1.0.1`（v1.0.1 release 2026-06-13） | npm `1.6.5` |
| **license** | **MIT** | **PolyForm-Noncommercial-1.0.0** |
| stars / forks | **50,634 / 3,090**（gh api 实测 2026-06-17） | 41,209 / 4,699 |
| created | **2026-01-18（仅 5 个月）** | 2025-08-02（10 个月） |
| 代码规模 | **344 files**（src 142 / tests 86） | 3000+ files（src 627 / test 2484） |
| 语言 | TypeScript | TypeScript |
| open issues | 258 | — |

> CodeGraph 的元信息全部是本机 `git` + `gh api` 实测一手值。GitNexus 一侧除 license/stars 我重新核过外，架构判断引用砚砚拆解（见 §11 caveat）。

## 2. Claim Ledger（CodeGraph 官方宣传 → 证据 → 判断）

| Claim（README / package.json） | 证据路径 | 判断 |
|---|---|---|
| "Pre-indexed code knowledge graph" | `src/db/schema.sql`（nodes/edges/files）+ `src/graph/` | 成立，确定性静态图谱 |
| "100% local · SQLite only · no API keys" | `package.json` deps（无 DB/LLM/网络 SDK）；`node:sqlite` | 成立，纯本地 |
| "No native build · bundled runtime" | deps 仅 `web-tree-sitter`+`tree-sitter-wasms`（WASM）；`node:sqlite` 内置 | 成立，**零 node-gyp**，直击 GitNexus 痛点 |
| "auto syncs on code changes · never stale" | `src/sync/watcher.ts` + staleness banner + connect-time catch-up | 成立，三层机制（§4.2），最强差异化 |
| "16% cheaper · 47% fewer tokens · 58% fewer tool calls" | README benchmark + `__tests__/evaluation/` | **use-with-caveat**：方法论公开可复现，但项目方自测 + query 自选（§8） |
| "20+ languages" | `src/extraction/languages/` + `src/resolution/frameworks/`（22 个） | 成立 |
| "Framework-aware routes（17 框架）" | `src/resolution/frameworks/*.ts` | 成立，route node + references edge |
| "iOS/RN/Expo 跨语言桥接" | `src/resolution/swift-objc-bridge.ts` / `callback-synthesizer.ts` | 成立，**启发式**，诚实标 `provenance:'heuristic'` |
| "focused set of 4 tools（measured）" | `src/mcp/tools.ts`（8 定义，默认暴露 4） | 成立，**eval 数据驱动裁剪**（§6） |
| "personalized PageRank relevance, no embeddings" | `src/mcp/tools.ts:~1934 computeGraphRelevance` | 成立，RWR over call/ref graph（§5） |
| "anonymous telemetry, off-switch" | README + `telemetry-worker/`（公开） + `DO_NOT_TRACK` | 部分核实：有 off-switch，未深读 worker 源码（§11） |
| package.json 仍写 "94% fewer tool calls · 77% faster" | `package.json:4` vs README:122 | **数字漂移**：旧营销数字未同步，README 已诚实下修（§8） |

## 3. 架构地图

```text
repo checkout
  │
  ▼  codegraph init / index   (CLI: commander, src/bin/codegraph.ts)
  ├─ extraction      tree-sitter WASM, 20+ langs        (src/extraction/, 43 files)
  │     └─→ nodes + edges + unresolved_refs（带 candidates）
  ├─ resolution      两阶段 resolve                       (src/resolution/, 33 files)
  │     └─ import-resolver / name-matcher / path-aliases
  │        + 22 framework resolvers + swift-objc / RN 跨语言桥
  ▼
.codegraph/codegraph.db    ← node:sqlite (Node 22.5+ 内置, WAL + FTS5, 零 native)
  nodes · edges(provenance) · files(content_hash) · unresolved_refs · nodes_fts
  │
  ├───────────────────┬────────────────────┐
  ▼                   ▼                    ▼
CLI direct          MCP daemon          auto-sync           (src/sync/, 5 files)
explore/node/...    (src/mcp/, 16)      ├ OS file watcher + debounce(2s, 可调)
                    8 tools(默认 4)      ├ per-query staleness ⚠️ banner
                    daemon + watchdog    └ connect-time catch-up (size,mtime,hash)
  │
  ▼  installer (src/installer/targets/*.ts)  → 8 agents
  Claude Code · Cursor · Codex · opencode · Hermes · Gemini · Antigravity · Kiro
```

关键入口：CLI `src/bin/codegraph.ts`；MCP daemon `src/mcp/daemon.ts` + `tools.ts`；存储 `src/db/{index,schema.sql,sqlite-adapter}.ts`；图算法 `src/graph/traversal.ts`；相关性排序 `src/mcp/tools.ts computeGraphRelevance`；context 组装 `src/context/index.ts`；注入 `src/installer/targets/claude.ts` + `instructions-template.ts`。

## 4. 明星功能拆皮（追到代码路径）

### 4.1 `codegraph_explore`：主打工具，确定性结构相关性

README 把 explore 定位成"一次调用回答几乎所有代码问题"。它不是 grep 套壳，含金量在排序：

- `src/mcp/tools.ts computeGraphRelevance`：**Random-Walk-with-Restart（personalized PageRank）**，从 query FTS 命中的 seed nodes 在 call/reference 图上游走（无向邻接、restart α=0.25、power iteration 收敛、bounded 到已相关子图 ~几百节点×25 迭代）。
- 设计意图（注释原话）："relevance by STRUCTURE, not words"——文件符号若 call-connected 到匹配 cluster 就累积 walk mass 排高；纯文本命中但无调用关系（例：`LensSwitcher.swift` 因 "switch" 命中却不调用 `setUser/fetchUser`）只得 restart 概率排~0。"Immune to the tokenization trap... deterministic, no embeddings."
- 判断：**这是 CodeGraph 真本事**。用图结构而非向量语义做相关性——确定性、可解释、无幻觉、无 embedding 依赖。

### 4.2 Auto-sync staleness 三层机制：最强差异化

砚砚拆 GitNexus 时点名痛点："改动 re-index 前对 agent 不可见"。CodeGraph 把这当头号设计目标，三层解决（`src/sync/` + README §auto-sync）：

1. **File watcher + debounce**：原生 FSEvents/inotify/ReadDirectoryChangesW，debounce 默认 2000ms（`CODEGRAPH_WATCH_DEBOUNCE_MS` 可调），edit 爆发合并成一次 sync。
2. **Per-query staleness banner**：debounce 窗口内，MCP 响应若引用待同步文件，prepend `⚠️` banner 让 agent 直接 Read；未引用的待同步文件放 footer。**给 agent 明确的 freshness 信号**。
3. **Connect-time catch-up**：MCP (re)connect 时先做 `(size,mtime)`+content-hash reconciliation，吸收"无 server 运行期间"的改动（git pull / 别的编辑器 / 上个 session）。

判断：这是 Cat Café 必抄的设计——**任何代码图谱查询结果都必须携带 freshness 语义**，否则 stale index 会产生高置信错误。

### 4.3 Impact / callers / callees：确定性图遍历

`src/graph/traversal.ts`（675 行，纯算法）：

- `getImpactRadius`（:475）：反向 BFS（incoming edges），**排除 `contains` 边**（:537, #536）避免 leaf 符号爬到父类再炸开所有兄弟成员。
- `getCallers/getCallees`（:230/:280）：递归遍历 calls/references/imports/**instantiates** 边（:256, #774 把"构造类=调用构造函数"纳入 caller）。
- 工程质量高：每个设计决策带 GitHub issue 编号注释，batch-fetch 消除 N+1。
- 对比 GitNexus：GitNexus impact 有 risk scoring heuristic；CodeGraph impact 就是**纯 blast-radius 遍历**——更朴素但更可解释。

### 4.4 `codegraph affected`：pre-commit / CI gate

`codegraph affected --stdin` 接 `git diff --name-only`，传递追踪 import 依赖找受影响 test 文件（README §affected）。这正是 opus-47 §10.3 场景表里"pre-merge 改动影响哪些 test"的形态——**现成可抄**。

## 5. 算法成分表

| 能力 | 算法底座 | 含金量判断 |
|---|---|---|
| 文件/符号抽取 | tree-sitter **WASM** + 20+ language extractors | 真静态分析，零 native 编译 |
| 符号解析 | 两阶段（unresolved_refs+candidates）+ import/name/path-alias + 22 framework resolvers | 真功夫，重心模块 |
| 跨语言桥接 | 启发式规则（@objc bridging / RN bridge / Expo DSL），标 `provenance:'heuristic'` | 启发式，诚实标注来源 |
| **explore 相关性** | **personalized PageRank / RWR over call-ref graph** | **真图算法，最高含金量** |
| search | SQLite **FTS5**（lexical，无 embedding） | 标准全文检索，确定性 |
| impact/callers/callees | 图 BFS/DFS（`traversal.ts`） | 确定性遍历，可解释 |
| type hierarchy | extends/implements 双向遍历 | 确定性 |
| auto-sync | watcher+debounce+content-hash+staleness banner | 工程扎实，差异化 |
| affected(test) | import 依赖传递 BFS | 确定性 |
| **LLM / 向量 / 聚类** | **无**（grep `leiden/louvain/embedding/openai/anthropic` 全落空） | **故意砍掉所有不确定性成分** |

核心判断：**CodeGraph 是 100% 确定性静态分析**。GitNexus 有 Leiden 社区发现 + 语义向量 + LLM wiki；CodeGraph 全砍，只留图 BFS + FTS5 + personalized PageRank。这是工程哲学的根本分歧——**CodeGraph 赌"确定性 + agent 友好输出格式" > "花哨算法"，benchmark 支撑了这个赌注**。

## 6. 反馈链与评价主体（CodeGraph 最强项）

skill Step 4 铁律：检查"谁在判断更好"。CodeGraph 有**两层全客观的 eval**，没有 LLM 自评闭环：

1. **检索 eval**（`__tests__/evaluation/`）：`runner.ts` 跑 `test-cases.ts`（人工标注 ground truth：query→expectedSymbols→kinds，针对真实仓库符号），`scoring.ts` 算**纯客观 recall + MRR**（PASS_THRESHOLD=0.5）。评价主体 = 机器指标 + 人工 ground truth。✅ 客观任务用客观评价。
2. **端到端 benchmark**（README）：`claude -p`(Opus 4.8) headless，WITH vs WITHOUT CodeGraph，`--strict-mcp-config`，7 真实仓库/7 语言，4 runs median。指标 = `total_cost_usd` / token / tool-call count——**全是 runtime 客观量**。

判断：这是 CodeGraph 可信度远超普通明星项目的根本——它用 eval 驱动决策（连"默认暴露哪 4 个工具"都是"measured: agents never picked the others"决定的），而不是拍脑袋。**这一点比它的算法更值得 Cat Café 学**：跟我们家 F192 `eval:capability-wakeup` verdict 闭环、code-as-harness 同源。

## 7. CodeGraph vs GitNexus 全维度对比

| 维度 | CodeGraph | GitNexus | 对 Cat Café 谁更值得参考 |
|---|---|---|---|
| **License** | **MIT**（可商用/fork/抄实现） | PolyForm-Noncommercial（商用受限） | **CodeGraph**（决定性差异） |
| 工程哲学 | 小而纯，确定性 | 大而全，花哨算法 | CodeGraph（易复刻） |
| 代码规模 | 344 files | 3000+ files | CodeGraph |
| 存储 | `node:sqlite`+FTS5（零 native） | LadybugDB 图数据库 | CodeGraph（无重栈要养） |
| tree-sitter | WASM（无编译） | native（重） | CodeGraph |
| 相关性排序 | personalized PageRank（结构，确定性） | BM25+语义向量+RRF | CodeGraph（无幻觉、可解释） |
| 聚类/社区 | 无 | Leiden community detection | 视用途（我们暂不需要聚类） |
| LLM 依赖 | 零 | wiki generation 用 LLM | CodeGraph |
| **staleness** | **三层正面解决** | re-index 前不可见（痛点） | **CodeGraph** |
| eval 文化 | 两层全客观 eval + 公开 benchmark | 未见公开 eval | **CodeGraph** |
| MCP 工具 | 8 个，eval 驱动默认暴露 4 | 多（query/context/impact/detect/rename/route/tool/...） | CodeGraph（克制） |
| 多仓 | `codegraph affected`（import 传递）；无 group bridge | `core/group/`（HTTP/gRPC/Thrift contract bridge） | **GitNexus**（跨仓 contract 更成熟） |
| adoption 侵入性 | marker-fenced 短块 + 干净 uninstall + 持续收敛 | AGENTS/CLAUDE 注入 + hooks + generated skills（用户喊 opt-out） | CodeGraph（更尊重边界） |
| 安全 | 无字符串拼 SQL（参数化） | `augmentation/engine.ts` 快路径拼 Cypher | CodeGraph |
| 商业模式 | open-core（hosted platform 商业化） | Noncommercial（个人项目） | 都需警惕长期投入不受控 |

**唯一 GitNexus 更强的维度 = 跨仓 contract bridge**（`core/group/`，HTTP/gRPC/Thrift/topic 契约抽取）。这对 Cat Café V2（多 repo/runtime/MCP）有长期价值，CodeGraph 的 `affected` 只做 import 传递，没有服务契约图。**若 Code Graph Layer 未来要做跨仓，这块抄 GitNexus 思路。**

## 8. Source Audit（F218 反射）

高风险 claim 审计 + provenance：

- **50,634 stars / 5 个月（2026-01-18 created）**：gh api 一手实测，非营销数字，真值。增长比 GitNexus（10 个月 41k）还猛——结合 PR 已到 #897、每天多次提交、commit 全带 issue 编号，是**真实高活跃项目**，不是 star 灌水。增长动因合理：踩中"agent token 成本"风口 + 8 agent 支持 + MIT + 零安装摩擦（与 ref/ 里 RTK、`tokless` 同生态共振）。
- **benchmark "16% cheaper / 58% fewer tool calls"**：**use-with-caveat**。利好：方法论完全公开（query/arm/runs 全列），`claude -p` 可复现，团队**主动承认数字从 Opus 4.7 时代下修**（"not a regression but a stronger native baseline"）——诚实度罕见。利空：① 项目方自测（利益相关）；② 7 个 query 团队自选；③ 团队自己说 run-to-run variance 大（Django without-arm 某批 $2.71/14m）。**结论**：方向可信（确实省 token/tool calls），绝对百分比别当精确值引用。
- **package.json 数字漂移**："94%/77%" 旧数字未同步 README 的 "16%/58%"——非欺骗（README 是更新更诚实的版本），是维护疏漏。引用以 README 为准。
- **telemetry**：README 称匿名（无 code/path/symbol/query/IP）、本地聚合日总量、`telemetry-worker/` 公开、`DO_NOT_TRACK`/`CODEGRAPH_TELEMETRY=0` 可关。比 GitNexus 的 `@scarf/scarf`（第三方）透明。**caveat：我未深读 worker 源码**，基于 README + 公开声明判断。

## 9. Cat Café 对照：内生 Code Graph Layer 该学谁 / 学什么 / 不学什么

### 9.1 Learn（立刻可抄，主要抄 CodeGraph）

| 学什么 | 来源 | 为什么 |
|---|---|---|
| 极简存储栈：`node:sqlite`+FTS5+图 BFS | CodeGraph `schema.sql`+`traversal.ts` | 不要图数据库/向量栈，确定性、零运维、可解释 |
| personalized PageRank 做结构相关性 | CodeGraph `computeGraphRelevance` | 比向量语义无幻觉，比 grep 懂结构 |
| 两阶段 resolution（unresolved_refs+candidates） | CodeGraph `src/resolution/` | 经典 symbol resolution，TS 我们可用 compiler API 增强 |
| staleness 三层机制 | CodeGraph `src/sync/` | 每个查询结果带 freshness，否则高置信错误 |
| eval-driven 决策 | CodeGraph `__tests__/evaluation/` | 跟我们 F192 eval 闭环同源；工具裁剪靠数据不靠拍脑袋 |
| 确定性优先哲学 | CodeGraph 整体 | 砍掉 LLM/向量/聚类，赌确定性+输出格式 |
| 跨仓 contract bridge（未来） | GitNexus `core/group/` | V2 多 repo/runtime 时抄思路 |

### 9.2 Gap（我们今天确实缺，对应 opus-47 §10.3 场景）

砚砚+opus-47 已列出 5 个家里今天解不掉的场景（改 MCP tool schema 找消费方 / 改 skill manifest 找 SOP 链 / F-coalesce 改 shape 找消费方 / pre-merge 改动归类 / 跨仓消费方）。**CodeGraph 的 `code_impact`+`affected`+`explore` 形态正好覆盖前 4 个**，且有现成 MIT 实现可抄。

### 9.3 Do Not Follow（对两者都成立）

| 不照搬 | 理由 |
|---|---|
| 自动写 `CLAUDE.md`/`AGENTS.md`（即便 marker-fenced） | L0 是压缩免疫真相源，不能被外部工具注入污染——CodeGraph 的克制版仍碰这条边界 |
| editor hooks / generated skills 直通激活 | skill 设计是人工 workflow 判断，不能代码 communities 自动生成 |
| 把 code graph 当 memory graph | F102 KD-31：代码结构 ≠ 团队记忆，两种真相源 |
| 直接依赖/集成任一项目 | 都是外部项目路线不受控；CodeGraph 还是 open-core（hosted 商业化） |
| 追大而全语言覆盖 | 先服务 Cat Café 自家 TS/MCP/skill/workflow，不从 polyglot 膨胀 |

## 10. 对 opus-47 Decision Packet 的补充 + 下一棒

opus-47 给铲屎官的三选一（[gitnexus §10.5](../2026-06-03-gitnexus-deep-dive/README.md)）：① 立完整 feat ② 进 BACKLOG idea 池 ③ ≤2 周 spike feat。opus-47 倾向 ③。

**我的对比给 ③（spike）补了关键一块：参考实现来源**。

- spike 之前的顾虑是"不知道内生版最小工程量"。现在有答案：**直接以 CodeGraph 为参考实现**——它 MIT（法律上可抄）、确定性内核读得懂、`getImpactRadius`(traversal.ts:475)+`schema.sql`+`node:sqlite` 是现成的可移植骨架。
- spike 路径具体化：选 `code_impact` 或 `code_detect_changes`（opus-47 §10.3 场景 3/4），**移植 CodeGraph 的图 BFS impact + nodes/edges schema，砍掉它的 installer/adoption layer，接我们自己的 MCP/skill/feat 真相源**。不是从零设计，是"抄确定性内核 + 换 truth source"。
- 这把 spike 风险和工程量进一步压低——opus-47 倾向 ③ 的证据强度因此提升。

**我不替铲屎官拍立项板**（愿景级决策，硬条件）。但我的对比让决策信息更全：如果走 spike，参考对象明确是 CodeGraph 不是 GitNexus。

**球权**：这是铲屎官直接派给我（@opus48）的拆解任务，已交付（拆解 + 对比 + 立项参考补充）。下一步是铲屎官在 opus-47 已挂起的 Decision Packet 上拍板（立项与否 + 是否三猫圆桌）。我先把这份对比交 reviewer 把关（跨族），再回铲屎官。

## 11. 我的 Caveat / 可能错在哪（pre-register retraction）

帮 reviewer 定向攻击：

1. **没跑 CodeGraph**：没 index 真实仓库验证 explore 输出质量，没独立复现 16%/58%。拆解基于源码阅读 + README。→ 若要立项前更有底，应 `codegraph init` 一个真实仓库实测 explore/impact。
2. **GitNexus 一侧是二手**：架构判断引用砚砚拆解，我只重核了 license/stars/created，没独立读 GitNexus 源码。对比中 GitNexus 一侧依赖砚砚拆解准确性。
3. **没读全 CodeGraph**：`context/index.ts`（1372 行）只看了排序段，`resolution/` 33 文件只看结构+关键文件，未逐个 framework resolver 验质量。算法判断基于核心文件，可能漏某语言 resolver 的坑。
4. **telemetry 基于 README 声明**：未深读 `telemetry-worker/` 源码验证"不发 code/path"。
5. **最可能被推翻的判断**："CodeGraph 比 GitNexus 更值得参考"——若 Code Graph Layer 的首要目标是**跨仓 contract 治理**（而非单仓 impact），结论可能反转（GitNexus `core/group/` 更成熟）。这取决于铲屎官对 Code Graph Layer 的 scope 定义。

## 12. 追加（2026-06-17）：Cat Café 代码仓复杂度 + Live Eval 计划

> 铲屎官指示：沉淀本文档 + 明确自家代码仓复杂度 + 构思 live eval——"先装一个跑几天做 eval，再决定学他们具体什么"。方法论：harness = 软 + 硬 + eval，**这次先做 eval**。

### 12.1 Cat Café 代码仓复杂度（git tracked，2026-06-17 实测）

| 类别 | 文件数 | 行数 |
|---|---|---|
| **手写 TS 应用源码**（非 test/d.ts） | 1,866 | **357,614** |
| TS 测试 | 537 | 114,291 |
| Markdown（docs + skills，知识层） | 3,400 | 607,507 |
| generated .js（packages/api 编译产物，**非手写**） | 1,320+ | ~401,330 |
| 总 git tracked 文件 | — | 8,417 |

各 package 手写 TS 源码：

| package | files | lines | 角色 |
|---|---|---|---|
| api | 1,093 | 226,077 | 后端 / runtime / MCP / 大部分逻辑（占 63%） |
| web | 600 | 106,596 | 前端 / Hub |
| mcp-server | 40 | 8,861 | MCP server |
| shared | 85 | 8,795 | 共享类型/工具 |
| ppt-forge | 39 | 6,449 | PPT 生成 |
| finance | 6 | 472 | 金融数据 |

判断：手写代码主体 **~36 万行 TS（api 占 63%）**；knowledge 层（607k md）比代码还重——Cat Café 文档/skill 密集的特色。规模属"中大型 monorepo"，落在 codegraph benchmark 覆盖范围内（其 benchmark 测过 VS Code ~10k files / Django ~3k），所以 **codegraph index 我们仓工程上完全可行**。

### 12.2 Live Eval 提案：先做 eval，再决定学什么

铲屎官方法论（呼应 ADR-031 三层）：不靠看源码拍脑袋决定内生版抄什么，而是**真装上跑几天，用 eval 数据决定**——正是 codegraph 自己的 eval 驱动哲学（§6）反用到我们自己的决策。

**实验设计**：
1. **先装 codegraph**（MIT + 确定性更安全 + §0 推荐），验证后再考虑并装 GitNexus 对比。
2. **index cat-cafe**，先处理 §12.3 两个边界。
3. **给几只日常 coding 的猫用**（隔离配置），跑几天。
4. **eval 指标**：呼应 codegraph benchmark 方法——WITH vs WITHOUT 的 token / tool-call / 体感，接我们家 F192 telemetry。
5. **产出 eval verdict** → 决定内生 Code Graph Layer 具体抄什么（§9.1 清单按实测数据重排优先级）。

### 12.3 Live Eval 两个必处理的边界（来自一手拆解）

⚠️ 装之前必须处理，否则 eval 失真或碰 L0 边界：

1. **codegraph installer 会写 `CLAUDE.md`/`AGENTS.md` + 改 MCP 配置 + 改 permissions**（§4.3 installer 拆解）。直接 `codegraph install` 会污染我们 L0 真相源边界。→ eval 期间用 `codegraph install --print-config <agent>` 手动加 MCP server snippet（不落 instructions 文件），或 `--no-permissions`；index 用 `codegraph init/index`（这步只建本地 `.codegraph/`，**不碰 agent 配置，安全**）。
2. **packages/api 有 1,320+ 个 generated `.js` 跟 `.ts` 并存**（git tracked，非 dist/）。codegraph 会把它们当源码 index，产生双份节点 + impact 失真。→ index 前给这些 `.js` 加 `.gitignore` 或 codegraph negation 排除，只 index 手写 TS。

**需铲屎官拍板的启动参数**：① 先装 codegraph 还是俩都装给猫对比；② 给哪些猫试（建议日常 coding 的猫）；③ 在主仓 index 还是开隔离副本（建议隔离，避免 `.codegraph/` 进共享主仓 + 规避 generated `.js` 噪音）。

## 13. 关键设计原则（2026-06-17 brainstorm）：能力唤醒走压缩免疫层，不走 md

铲屎官洞察：codegraph/gitnexus 写 `CLAUDE.md`/`AGENTS.md`/`GEMINI.md` 的真实目的，是**把工具挤进 agent 的认知路径**。但通道选错了——这些 instruction 文件在 Claude Code / Gemini 架构里是 **user-turn 注入（context 的一部分），不免疫压缩**。context 一压缩，注入的工具指引被稀释/evict，工具就淡出认知路径。

codegraph 自己知道这个困境：`src/installer/instructions-template.ts` 注释承认 "main agent reads it every turn on top of the server instructions"，所以拼命把 block 压短——它在用**应用层手段（写文件 + 每轮重读 + 祈祷）对抗压缩**，但赢不了，因为**它是外部工具，没有 harness 层的 system prompt 注入权**。它的两条通道（md 文件 + MCP `initialize` response）都在可压缩的 context 层。

**Cat Café 的结构性优势**：L0 native system prompt（`--system-prompt` / `-c developer_instructions`，每次 invocation 由 compiler 重新注入 API system/developer role）是**压缩免疫**的（ADR-030）。这是 harness 层能力，外部 MCP 工具拿不到。

**对内生 Code Graph Layer 的设计指导**：
- **工具本身**（`code_query` / `code_impact` / ...）走 MCP——跟 codegraph 一样。
- **但"何时想起用"的唤醒反射**进 L0 §8 能力唤醒指南（"改 MCP schema 找消费方 → `code_impact`" 这类场景触发）+ session hook——**压缩免疫**，压缩后猫依然记得唤醒。
- 这是 codegraph/gitnexus **给不了用户的**（它们没 harness 控制权），也是 eval 完该**内生而非长期用它**的最硬理由之一：让能力常驻认知路径，对我们是 native 主场，对它们是逆水行舟。

## 14. Live PoC 实测结果（2026-06-17，worktree 隔离）

铲屎官点头后，在隔离 worktree（`cat-cafe-codegraph-poc`，2,405 TS 文件）实跑 codegraph v1.0.1（独立目录装 CLI，不碰全局 / cat-cafe / md），index 我们自己的代码实测。

### 14.1 索引规模
- 4,026 文件 / **44,954 节点 / 177,425 边** / DB **207MB**（node:sqlite WAL，确认 §1 判断）
- 分钟级完成；识别 **435 个 route 节点**（framework-aware routes 在我们代码上真生效）

### 14.2 噪音边界实锤（§12.3 预警兑现）
- **1,378 个 generated `.js` 被当源码 index = 11,825 节点 = 总量的 26%**。内生版必须排除，否则四分之一索引是编译产物噪音。

### 14.3 能力实测：确定性工具是金子，explore 在大 monorepo 要调

| 工具 | 实测 | 判断 |
|---|---|---|
| **callers**（图遍历）| `parseA2AMentions` → 9 callers 全对：真实调用方 `collectCallbackContentRoutingExit`/`runRoutingGuardRemedial` + 5 个 `.test.js` | ✅ 精确，零跨域跑偏 |
| **impact**（图遍历）| `MultiMentionOrchestrator` → 45 affected：类方法 + `callback-multi-mention-routes` 消费方 | ✅ 精确，blast radius 合理 |
| **explore**（PageRank）| 找对核心符号（`parseA2AMentions`/`dispatchToTarget` + blast radius + ⚠️测试覆盖标注），**但 PageRank 相关性跨域跑偏**：问后端 a2a 路由，开头塞了一堆无关前端 UI 渲染链（`ActivityBar→ThemeMenu`）；召回过广 204 符号/102 文件 | ⚠️ 核心真实，但精度被 monorepo + .js 噪音拖累 |

### 14.4 对内生 Code Graph Layer 的实证指导
1. **优先内生确定性图遍历（callers/impact）**——直接覆盖 opus-47 §10.3 "改 X 找消费方 / 受影响测试"场景，精度高、无跑偏。这是最该学、最稳的内核。
2. **explore 的 personalized PageRank 谨慎**——它是 codegraph 的创新，但在前后端混合大 monorepo 上跨域扩散。内生版若做，必须先解决 scope 限定（按 package / 前后端分 index）+ 排 .js 噪音。
3. **必须排除 generated `.js`**（26% 噪音）；测试 `.test.js` 被算 caller 是 feature（pre-merge 找受影响测试，留着）。
4. node:sqlite + 207MB 对我们规模可接受。

**结论**：live PoC 兑现了价值——纸面拆解看不出"explore 在 monorepo 跑偏 + callers/impact 是真金"。codegraph 最值得学的是**确定性内核**（印证 §0），不是它最"智能"的 PageRank explore。下一步可选：① 排 .js 重 index 看 explore 是否改善；② 同样 PoC 一遍 GitNexus 做对比；③ 直接进入内生 spike 设计（确定性图遍历优先）。

## 15. 关键修正（2026-06-17）：callers/impact vs LSP —— 内生价值不在复刻 TS 引用，在补 LSP 盲区

铲屎官一问点醒：我们已有 `typescript-lsp`，§14 把 callers/impact 夸成"金子"需要修正。

**诚实区分**：
- **纯 TS 符号找引用 / 定义 / rename**：LSP 本就有，且**比 codegraph 更准**——LSP 走 tsserver **类型感知**，codegraph 走 tree-sitter + **启发式 name-matching**（不跑类型检查）。§14 里 codegraph 把 5 个 `.test.js` 按 import 算 caller = 文件级粗粒度；LSP 是符号级精确。**这块 codegraph 对我们不是增量，甚至更糙。**
- **code graph 真正赢 LSP 的地方（LSP 盲区）**：
  1. **route/framework 关联**（435 routes，URL→handler）——LSP 只懂语言符号，不懂框架路由约定。
  2. **一次性 agent 消费格式**（explore 一次给源码 + 调用链 + blast radius，省 token/往返）——LSP 是 IDE 交互协议，agent 用要多轮往返。
  3. **跨「代码 + 约定」的关联（最关键）**：MCP tool name → 消费方、skill manifest → SOP 链、workflow callback、跨 repo contract。这些是字符串/约定层关联，**LSP（纯类型符号）和 grep（纯字符串）都抓不住**——正是 opus-47 §10.3 场景 1/2 的痛点。

**价值定位修正**：内生 Code Graph Layer 的价值**不是复刻 LSP 已有的 TS 符号引用**（重复造轮子，且做不过类型感知的 LSP），而是**补 LSP + grep 的共同盲区——建我们家专属的「约定层关联图」**（MCP tool / skill manifest / workflow callback / route / 跨 repo contract）。

**对方向的收敛**：codegraph 能 PoC 测的（TS callers/impact）LSP 已有且更优，继续 PoC 边际价值低；codegraph 测不了的（MCP/skill 约定关联）它没这种 extractor，只能内生。**这一问把方向收敛到「进内生 spike，且 spike 第一目标是 LSP 盲区的约定层关联」**——印证 §6.2（API route / MCP tool / skill / workflow callback extractor）才是内生第一版该做的。

> 注：以上为机制判断（LSP 类型感知 vs codegraph tree-sitter 启发式）；要硬数据可现场跑 LSP find-references vs codegraph callers 对同一符号对比。

---

*拆解 by opus-48（宪宪），基于 `open-source-teardown` skill。GitNexus 一侧引用 codex-gpt55+opus-47 拆解。§12 代码仓复杂度 + live eval 计划；§13 能力唤醒走压缩免疫层；§14 live PoC 实测；§15 callers/impact vs LSP 价值定位修正。[宪宪/Opus-4.8🐾]*
