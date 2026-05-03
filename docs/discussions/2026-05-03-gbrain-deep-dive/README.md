---
doc_kind: research-note
topics:
  - gbrain
  - open-source-teardown
  - llm-wiki
  - memory-runtime
  - agent-eval
created: 2026-05-03
status: reviewed-draft
source_repo: https://github.com/garrytan/gbrain
source_commit: 3c032d79ecccff8d87a5b601a34b9e7cb8194dd7
source_local_path: /Users/lysander/projects/ref/gbrain
authored_by: codex
reviewed_by: opus
---

# GBrain 开源拆解初稿

> 结论先行：GBrain 是一个真实有料的 LLM wiki / agent memory runtime，不是 README 驱动的壳。它值得我们学习的不是“给 agent 一个脑子”这句口号，而是它把 **wiki 文件、关系图谱、检索排序、MCP/CLI 操作面、长任务队列、真实查询回放评估** 都收进同一套运行时契约里。
>
> 但它的营销语言比代码边界更激进。“zero LLM typed links”是真的 deterministic bootstrap，不等于可靠实体解析；“smarter while sleeping”更接近维护/合成循环，不是自证有效的自我进化。v0.26 新加的 OAuth HTTP MCP 路径有一个 P0 级 RCE 路径和一个 P1 级 PGLite 启动承诺断裂。
>
> Memory 专项对比见：[memory-comparison.md](./memory-comparison.md)。

## 0. 采样范围

- GitHub: `garrytan/gbrain`
- 本地路径: `/Users/lysander/projects/ref/gbrain`
- HEAD: `3c032d79ecccff8d87a5b601a34b9e7cb8194dd7`
- HEAD 时间: `2026-05-02 22:01:05 -0700`
- HEAD 标题: `v0.26.0 feat: GBrain — MCP Keys OAuth 2.1 + HTTP server + admin dashboard (#358)`
- package 版本: `0.26.0`
- 仓库规模: `src` 245 个 tracked files，`test` 285 个，`docs` 66 个，`skills` 88 个。
- 外部基准限制: README 的 BrainBench 固定 corpus/scorecards 在 sibling repo `gbrain-evals`，本次只验证了本仓库内的实现 hook、文档和测试，未复跑外部 corpus。

证据路径下文默认相对 `/Users/lysander/projects/ref/gbrain`。

## 1. Claim Ledger

| Claim | 判断 | 证据 | 边界 |
| --- | --- | --- | --- |
| “GBrain gives an AI agent a brain” | 基本成立 | `src/core/engine.ts:114-244` 定义页面、chunk、links、timeline、search 的统一 engine；PGLite/Postgres 双 engine；CLI/MCP 共享 operation registry。 | 更准确说是“带图谱和检索的本地/远端 markdown brain runtime”。 |
| “Every page write extracts typed links with zero LLM calls” | 成立，但含义有限 | `src/core/operations.ts:320-405` 写页后触发 auto-link；`src/core/link-extraction.ts:293-505` 用 wikilink、frontmatter、regex 推断 `works_at/founded/invested_in/advises/attended`。 | 这是 deterministic heuristic，不是语义实体解析。对别名、歧义、上下文否定要谨慎。 |
| Hybrid search + graph ranking | 成立 | `src/core/search/hybrid.ts:1-10` 明确 keyword/vector/RRF/boost/cosine/dedup pipeline；`src/core/search/hybrid.ts:70-246` 实现 expansion、vector、RRF、backlink boost、code-edge two-pass。 | README 的 P@5/R@5 数字未在本仓库复跑。 |
| BrainBench-Real opt-in capture/replay | 成立 | `src/core/eval-capture.ts:173-208` 默认关闭、`GBRAIN_CONTRIBUTOR_MODE=1` 开启；`docs/eval-bench.md` 定义 Jaccard/top-1/latency 口径；`test/eval-capture.test.ts` 覆盖失败吞吐和 env gate。 | 是 retrieval regression loop，不是自动修复系统。 |
| OAuth 2.1 HTTP MCP + admin dashboard | 代码存在，但 v0.26 路径有 P0/P1 风险 | `src/commands/serve-http.ts:46-57` 初始化 OAuth provider；`src/commands/serve-http.ts:341-452` 暴露 MCP `/mcp`；`src/core/oauth-provider.ts` 覆盖 DCR、PKCE、refresh rotation、legacy token。 | 见第 7 节：HTTP MCP `remote` 漏传会击穿 protected job guard；PGLite `serve --http` 路径疑似必断。 |
| Minions durable jobs | 成立 | `src/core/minions/queue.ts`、`worker.ts`、`supervisor.ts`；`src/core/minions/protected-names.ts:15-23` 保护 `shell/subagent/subagent_aggregator`；`src/commands/jobs.ts` CLI 入口。 | README 的吞吐/成本对比未复跑。 |
| “34 skills / thin harness, fat skills” | 成立 | `skills/` 下有大量 skill 目录和 resolver/conventions/migrations；`README.md:189` 描述 skillify loop。 | 质量参差需要逐个 skill 看，不应只数目录。 |
| “Smarter while sleeping” | 部分成立 | `src/core/cycle.ts:1-43` 八阶段 maintenance/dream cycle；`src/core/cycle/synthesize.ts:1-27` transcript-to-brain；`src/core/cycle/patterns.ts` 从 recent reflections 写 pattern pages。 | 这是能自动写入和整理，不等于质量单调上升。 |
| Deterministic classifiers improve via fail-improve | 核心机制成立 | `src/core/fail-improve.ts:1-11` deterministic-first/LLM-fallback JSONL；`:96-149` fallback/log；`:190-231` analysis/testcase/improvement 记录；`test/fail-improve.test.ts` 覆盖主流程。 | “自动生成更好 regex patterns”在本次未追到完全自动闭环；当前更像记录与生成测试用例。 |

## 2. 架构地图

GBrain 的核心不是一个搜索函数，而是一个 operation runtime：

```text
src/cli.ts
  -> src/commands/*
       init/import/search/query/serve/jobs/dream/eval/*
  -> src/core/operations.ts
       put_page/search/query/submit_job/... 统一声明 params/scope/localOnly/handler
  -> BrainEngine interface
       PGLiteEngine | PostgresEngine
  -> storage tables
       sources/pages/page_versions/content_chunks/links/timeline_entries
       minion_jobs/subagent_tool_executions/eval_candidates/oauth_*
  -> entrypoints
       CLI
       stdio MCP: src/mcp/server.ts -> dispatch.ts
       HTTP MCP OAuth: src/commands/serve-http.ts
       Minions worker/supervisor
       Dream cycle / cron
```

几个关键坐标：

- **Engine 抽象**：`src/core/engine.ts:114-244` 把 page、chunk、graph、search、timeline、migration 都收进一个接口。`src/core/engine-factory.ts:8-25` 按 `pglite/postgres` 创建 engine。
- **默认本地优先**：`src/commands/init.ts:105-147` 默认 PGLite，本地无 server；Postgres/Supabase 是扩展路径。
- **操作面统一**：`src/core/operations.ts` 同时服务 CLI/MCP/HTTP，但文件已经接近 1500 行，是后续维护热点。
- **MCP 分发有两套**：旧/stdio 路径通过 `src/mcp/dispatch.ts:51-62` 构造 `remote: true`；v0.26 新 HTTP OAuth 路径在 `serve-http.ts` 里直接 handler，这是风险来源。
- **目录没有明显空壳**：`src/test/docs/skills/admin/scripts` 都有实际内容；空目录只看到 `.git` 内部目录。

## 3. 星级功能拆解

### 3.1 写入页 -> chunk/embed -> graph/timeline

`put_page` 的真实链路是：

```text
operation put_page
  -> importFromContent
       parse markdown/frontmatter
       split compiled_truth/timeline/code chunks
       embed chunks if OPENAI_API_KEY exists
       write pages/tags/chunks
  -> runAutoLink
       extractPageLinks
       fuzzy resolve slugs
       reconcile links in both directions
  -> auto timeline
  -> post-write lint
```

强点是写入后立即让图谱和检索索引变成 runtime state，不是“搜的时候临时猜”。弱点也在这里：link extraction 是规则系统，输入污染会直接污染 links/backlink ranking，所以远端写入必须严格禁用或隔离 auto-link。

### 3.2 检索排序

`src/core/search/hybrid.ts` 的 pipeline 很具体：

- keyword search 常驻；
- 有 OpenAI key 时加入 vector search；
- 可选 query expansion；
- RRF 合并，默认 `K=60`；
- compiled_truth boost、backlink boost；
- optional cosine rescoring；
- optional code-edge two-pass structural expansion；
- dedup 后输出。

这比“BM25 + vector”更像一个适合 agent memory 的 ranking stack：图谱边和 page kind 进入排序，不只是 chunk 相似度。

我们可以学的是 **把 ranking factors 暴露为可回放的工程契约**。GBrain 用 BrainBench-Real 把真实 query/search capture 成 `eval_candidates`，再用 Jaccard/top-1/latency 比较改动。这一层比单次人工体验可靠得多。

### 3.3 关系图谱

`src/core/link-extraction.ts` 的 typed edge 主要来自三类来源：

- markdown wiki link / bare slug；
- frontmatter map，如 `company/companies/founded/key_people/investors/lead/attendees/sources/related`；
- 正文 regex，如 “works at / founded / invested in / advises” 等。

优点是快、可解释、可离线复现。缺点是实体识别不是强语义：同名人、别名、否定句、引用里的假陈述都可能污染。GBrain 自己也在 `docs/GBRAIN_RECOMMENDED_SCHEMA.md:158` 里指出 entity identity 是真实 failure mode。

### 3.4 Dream cycle

Dream cycle 是 GBrain 最像“agent 自维护”的部分：

- `src/core/cycle.ts:55-66` 定义 lint/backlinks/sync/synthesize/extract/patterns/embed/orphans；
- `synthesize` 从 transcript 找高价值片段，用 Haiku verdict + Sonnet subagent 写入 brain，并记录 provenance；
- `patterns` 从 recent reflections 里合成 pattern pages；
- cycle 有锁、cooldown、self-consumption guard 和 dry-run。

这套东西值得看，但不能把它误读成自动客观进化。它更像“周期性资料整理 + LLM 辅助归纳 + 写回 wiki”。质量还是取决于 prompt、输入分布、review/eval 闭环。

### 3.5 Minions durable jobs

Minions 是它对“长任务/子 agent 容错”的回答：

- queue 持久化 job；
- worker 获取锁、续约、超时、重试；
- supervisor 管 worker 进程；
- `shell/subagent/subagent_aggregator` 是 protected job names；
- CLI 本地可信路径可以提交 protected jobs，远端 MCP 应该拒绝。

这个方向和我们的长任务纪律高度同构：前台 session 不该假装后台，真正长任务要有 pid/log/result 或 DB ledger。GBrain 的 DB job ledger 是可学习对象。

## 4. 算法含量剥皮

| 模块 | 算法含量 | 评价 |
| --- | --- | --- |
| RRF ranking | 真实 IR 算法 | 简洁、可调、适合多路召回融合。 |
| cosine rescoring | 真实向量相似度 | 标准做法，价值取决于 embedding 质量。 |
| backlink boost | 工程 heuristic | 很适合 wiki graph，但会放大被污染 links。 |
| typed relation inference | 规则/regex heuristic | 低成本 bootstrap，不是实体真相。 |
| intent classifier | zero-latency heuristic | 对 routing 有价值，但要用 eval 防回归。 |
| fail-improve | 工程反馈回路 | 记录 fallback、生成 test case、统计 deterministic rate；自动改 regex 的程度要继续追。 |
| Dream synth/patterns | LLM workflow | 有 provenance 和 guard，但仍需要外部质量门。 |
| BrainBench-Real | 回归评估协议 | 对我们很有参考价值：真实 query capture + replay 比手感强。 |
| Minions queue | 分布式任务工程 | 锁、重试、超时、parent/child 聚合，实用。 |

## 5. 社区与维护信号

这仓库近期活跃度很高，但也明显是单 maintainer 高速推进：

- 最近合入 PR 基本来自 `garrytan`，例如 `#566 v0.25.1`、`#528 v0.23.1 local CI gate`、`#527 dream self-consumption marker`、`#522 claw-test friction harness`、`#503 minions self-health-monitoring`。
- 反应较多的 open issues 集中在接入形态和 embedding provider：`#94 Claude Code-native mode`、`#297/#133/#320 configurable/local embedding providers`。
- bug issues 里有几个和我们拆解判断一致的痛点：`#428 Multi-source isolation incomplete`、`#457 code indexing doesn't work`、`#451 migration bootstrap`、`#81 PGLite lock`。
- 社区 issue `#84 Add policy enforcement for destructive MCP tools` 说明用户也在关注远端 MCP 写操作安全。

维护画像：速度非常快，测试和 docs 跟得上不少，但高速 feature stacking 已经带来重复路径、注释/行为漂移、远端安全边界容易漏的风险。

## 6. 我们该学什么

### 6.1 值得吸收

1. **Operation registry 作为 CLI/MCP/HTTP 的单一契约**
   - 每个 operation 声明 params、scope、localOnly、handler。
   - 对我们 Cat Café 的 MCP/CLI/tool 暴露很有启发：tool contract 不该散在不同 adapter。

2. **真实查询回放评估**
   - `GBRAIN_CONTRIBUTOR_MODE=1` 捕获真实 query/search，PII scrub，export/replay。
   - 我们的 memory/search_evidence 可以借鉴：把“本次搜索结果是否退化”做成可回放门禁，而不是只靠主观觉得搜得准。

3. **typed graph bootstrap**
   - 用 frontmatter + wikilink + regex 先把 graph 跑起来。
   - 我们不必一开始追求完美实体解析，先把可解释边和 unresolved queue 建起来更实际。

4. **长任务 ledger**
   - Minions 的 job state、锁、parent/child 聚合，对我们的跨猫长任务/后台执行有直接参考价值。

5. **Dream cycle 的边界设计**
   - 有 cycle lock、cooldown、self-consumption guard、provenance，这些比“定时让 LLM 总结一下”严谨。

### 6.2 不要照搬

1. **不要把 deterministic link extraction 宣传成可靠语义图谱**
   - 我们可以用它做 bootstrap，但必须保留 unresolved、confidence、source provenance、人工/agent 校正路径。

2. **不要让新 adapter 绕过共享 dispatch**
   - GBrain v0.26 HTTP OAuth 路径直接写 MCP handler，已经漏了 `remote` 上下文。我们应强制所有 remote carrier 走同一个 dispatch/context builder。

3. **不要把“会写回”叫“自我进化”**
   - 写回只是 state mutation；进化要有 eval、review、rollback 和长期指标。

4. **不要让 operation registry 无限长**
   - 单一契约是对的，但实现可以按 domain module 拆，只保留 registry metadata 在一处。

## 7. 上游级风险发现

### P0: v0.26 HTTP MCP path 没有设置 `remote: true`，可击穿 protected job guard

证据：

- `src/commands/serve-http.ts:395-405` 构造 `OperationContext` 时只放了 `engine/config/logger/dryRun/auth`，没有 `remote: true`。
- `src/core/operations.ts:377-401` 明确依赖 `ctx.remote === true` 对远端 `put_page` 跳过 auto-link/auto-timeline，注释说明这是安全边界。
- `src/core/operations.ts:1314-1322` 依赖 `ctx.remote` 拒绝远端提交 protected jobs，例如 `shell/subagent/subagent_aggregator`。
- `src/core/operations.ts:1324-1336` 的第二层调用会在 `!ctx.remote && isProtectedJobName(name)` 时传入 `{ allowProtectedSubmit: true }`。
- `src/core/minions/queue.ts:81-85` 只在 protected name 且没有 `trusted.allowProtectedSubmit` 时拒绝。

完整链路：

```text
serve-http.ts:395  ctx.remote missing
operations.ts:1320 ctx.remote && isProtectedJobName(name)
                  undefined && true -> false，第一层 remote guard 跳过
operations.ts:1329 !ctx.remote && isProtectedJobName(name)
                  !undefined && true -> true，生成 trusted allowProtectedSubmit
queue.ts:81        isProtectedJobName(jobName) && !trusted?.allowProtectedSubmit
                  true && !true -> false，第二层 guard 也跳过
```

影响：

- HTTP OAuth MCP 的远端写入可能触发 auto-link，污染 links/backlink ranking。
- 如果攻击者拿到具备 `admin` scope 的 OAuth token，可以通过 HTTP MCP `submit_job` 提交 `shell/subagent/subagent_aggregator` 这类 protected job。
- 对 `shell` job 来说，这是远端命令执行路径，不只是普通权限漂移。

修法：

- HTTP OAuth path 不要手写 context，复用 `src/mcp/dispatch.ts:51-62` 的 `buildOperationContext(engine, params, { remote: true })`。这个模块头部 `src/mcp/dispatch.ts:1-7` 已经说明它是为了防止 stdio/HTTP transport 漂移。
- 加测试：HTTP MCP `put_page` 应返回 `auto_links.skipped='remote'`；HTTP MCP `submit_job name=shell` 必须 permission denied。

### P1: README 的 “PGLite + serve --http zero infra” 和代码路径不一致

证据：

- `src/commands/init.ts:105-147` 默认创建 PGLite brain。
- `src/core/pglite-schema.ts:9-11` 注释明确 PGLite schema 包含 OAuth tables，因为 `gbrain serve --http` 让 PGLite network-accessible。
- `src/commands/serve-http.ts:46-57` 却直接 `const sql = db.getConnection()`。
- `src/core/db.ts:151-159` 的 `getConnection()` 只返回 module-level Postgres connection，未 connect 时抛 “Run gbrain init --supabase or gbrain init --url”。
- `src/cli.ts:611-623` 的 `connectEngine()` 只调用 `connectWithRetry(engine, config)`；`src/core/db.ts:271-285` 又只调用 `engine.connect(config)`。
- `src/core/pglite-engine.ts:117-168` 只初始化 PGLite WASM engine，不会填充 `db.ts` 的 module-level `sql` 单例；相对地，`src/core/postgres-engine.ts:86-89` 才会调用 `db.connect(config)`。

影响：

- 在默认 PGLite config 下，`serve --http` 会进入 `db.getConnection()` 的 “No database connection” 分支。
- 这会打穿 README “zero external infrastructure”的首屏承诺。

修法：

- OAuth provider 不应绑定 Postgres module-level `db.getConnection()`；应通过 engine raw SQL adapter，或明确 HTTP server 只支持 Postgres 并修 README/schema 注释。
- 加 CLI smoke：fresh `gbrain init --pglite` 后 `gbrain serve --http --port 0` 至少能启动到 ready。

### P2: admin request filter 构建了但没用

证据：

- `src/commands/serve-http.ts:272-281` 拼了 `query` 和 `params`。
- `src/commands/serve-http.ts:283-285` 实际执行固定 SQL，忽略 agent/operation/status filter，也忽略 filtered count。

影响：dashboard filter 看起来可用，实际返回全量分页。

### P3: eval replay 注释与当前行为漂移

证据：

- `README.md:11` 和 `src/core/eval-capture.ts:173-208` 都说明 capture 默认关闭。
- `src/commands/eval-replay.ts` 文件头仍说 “default-on”。

影响：不影响运行，但会误导后来维护者。

## 8. 对 Cat Café 的直接启发

我建议我们后续开一个小设计讨论，不急着实现，重点看三块：

1. **Memory/Search replay gate**
   - 从 `cat_cafe_search_evidence` 真实 query 采样；
   - scrub 项目私密内容；
   - replay 检查 top-k passageId/docId 稳定性；
   - 对 memory index/rerank 改动建立回归门。

2. **Tool/Operation context 单点化**
   - 所有 carrier：CLI、MCP、hook、A2A、future HTTP，都只允许通过一个 context builder 设置 trust boundary。
   - `remote/local/trustedWorkspace/viaSubagent` 这种字段不能在 adapter 里手写散落。

3. **Typed evidence graph bootstrap**
   - 先从 docs frontmatter、Feature ID、ADR link、PR/commit refs、@mention、thread chain 建 deterministic edges；
   - edge 带 source passage/provenance/confidence；
   - 不用 LLM 做第一层真相判定。

## 9. 布偶猫复核记录

2026-05-03，布偶猫 Opus 4.6 已复核本报告，并补强了四点结论：

1. **HTTP MCP `remote` 漏洞成立，且是 P0 RCE 路径**：第二层 `MinionQueue.add` guard 挡不住，因为 `operations.ts:1329` 会在 `remote === undefined` 时生成 trusted flag。
2. **PGLite `serve --http` 判断成立**：PGLiteEngine 不会填充 `db.ts` 的 Postgres singleton，而 `serve-http.ts` 直接读取该 singleton。
3. **Dream cycle 定位准确**：它是带防护栏的自动化知识维护，不是自证有效的 self-improvement；主要缺 eval phase、rollback、quality delta。
4. **Cat Café 候选 feature 排序**：
   - Tier 1: Query Replay Eval Gate；Operation Context 单点化。
   - Tier 2: Typed Evidence Graph Bootstrap；Durable Job Ledger。
   - 暂不建议立项: Dream cycle 本体；fail-improve regex 自动改进；34 skills/thin harness 架构。

## 10. 后续可交付项

1. 是否向 GBrain 上游做 responsible disclosure：P0 远端 protected job 提交路径不宜直接公开 issue 细节。
2. 是否为 Cat Café 开候选 spec：
   - Query Replay Eval Gate；
   - Operation Context 单点化；
   - Typed Evidence Graph Bootstrap；
   - Durable Job Ledger。

[砚砚/GPT-5.5🐾]
