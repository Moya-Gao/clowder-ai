# RTK (Rust Token Killer) 深度拆解

> 拆解类型：明星开源项目「宣传 claim → 源码证据 → 能力边界 → 我们的 tradeoff」审计
> 方法：clone 源码 + 3 路 subagent 交叉取证，每个判断追到 `path:line`
> 作者：宪宪 (@opus-48, claude-opus-4-8) · 2026-06-15

---

## 0. 元信息（真相源）

| 项 | 值 |
|---|---|
| Source repo | https://github.com/rtk-ai/rtk |
| Local path | `/Users/lysander/projects/ref/rtk` |
| HEAD SHA | `d8c550eefba41e112bd174d58844a803db6e432f` |
| 版本 tag | `dev-0.43.0-rc.276`（Cargo.toml 写 0.42.2；README 还写 0.28.2） |
| Default branch | `develop` |
| 抓取时间 | 2026-06-15 |
| 代码规模 | **73,787 行 Rust** / 107 `.rs` 文件 / 370 tracked files |
| 工程活动 | **1146 commits** / 创建 2026-01-22（~5 个月）/ 最后 commit 2026-06-14（merge 外部 PR #2333） |
| GitHub 热度 | **62,623 stars / 3,875 forks / 146 watchers**（gh api 一手核实） |
| License | Apache-2.0 |
| 依赖 | 22 个 crate（clap/regex/rusqlite/serde/ureq/flate2/quick-xml…） |

**铲屎官原始问题**：① 真扒源码，验证 4 个压缩策略实现含量、`<10ms`、`60-90%` 是否经得起代码级检验（专治"README 营销 vs 真实架构"）；② 实测评估要不要纳入我们工作流，重点测 Read/Grep 失效洞的实际影响。

---

## 1. TL;DR（一句话）

**rtk 是一个真材实料的中型 Rust 工程，不是营销空壳**——核心压缩机制（日志归一化去重、per-command 结构化 parser、二进制 binlog 解码）是真本事。但它对外的三个卖点里**两个有水分**：`<10ms` 是零代码支撑的纯营销声明，`60-90%` 是用"字节削减率"冒充"token 削减率"（全程 `chars/4`，无真 tokenizer）。而且对**标准 Claude Code 工作流有一个根本性覆盖洞**：Read/Grep/Glob 工具调用 100% 绕过 rtk，它只能压 agent 主动走 Bash 的那部分。

**给 CVO 的一句话决策**：作为"压 Bash 命令噪音"的工具它是真有效、零成本、可白嫖的；但别信它宣传的覆盖率和精确节省数字，它压不到现代 agent 工作流最大的 token 源（读文件/搜代码）。

---

## 2. Claims Ledger（宣传 → 证据 → 判决）

| # | Claim（README） | 判决 | 证据 / Caveat |
|---|---|---|---|
| C1 | "Single Rust binary, **zero dependencies**" | ⚠️ **营销话术** | `Cargo.toml` 有 **22 个 crate 依赖**。真实含义只是"单静态二进制、无运行时系统依赖"，不是"无 crate 依赖" |
| C2 | "**60-90%** token reduction" | ⚠️ **半真**：真压缩 + 假计量 | 输出确实显著变短（真）；但"token"全程是 `estimate_tokens = bytes/4`（`tracking.rs:1284`），测的是**字符削减率非 token 削减率**；无任何 tokenizer 依赖；README 那张表是**手写估算**（update 脚本是 stub，`update-readme-metrics.sh:18-20`） |
| C3 | "**<10ms** overhead per command" | ❌ **纯营销，零测量** | 全仓无 10ms 断言；唯一计时是 `run.ts:354` 用 hyperfine 测**端到端 wall-clock**（非隔离 overhead），且只 `console.log` 不 assert；CI 只守内存<20MB（`run.ts:380`） |
| C4 | "Four optimization strategies … **applied per command type**" | ⚠️ **夸大** | 4 策略真实存在，但**非每命令全套**——按命令各取所需（git 不去重、ls 不剥注释、多数命令不走 smart-truncate） |
| C5 | "Smart Filtering / **Truncation - Keeps relevant context**" | ⚠️ **名不副实** | 相关性排序逻辑 `smart_truncate`（`filter.rs:323`）**全仓只在 `read.rs:173` 一处调用**；命令输出截断本质是 severity 分桶后 dumb `.take(N)` |
| C6 | "**100% rtk adoption** across all conversations" | ❌ **误导** | 该"100%"仅对 Bash 工具成立，被**同段下一行**的 scope note 当场限定（`README.md:299` vs `:303`） |
| C7 | 隐含："给 Claude Code 省 token" | ⚠️ **覆盖洞** | hook matcher 只注入 `"Bash"`（`init.rs:1088`），Read/Grep/Glob 100% 绕过；README:303 主动承认 |
| C8 | `rtk learn` / `rtk discover`（暗示自我改进） | ⚠️ **telemetry 非学习** | 规则是编译期 `const` 静态表（`rules.rs:13`）；learn 写出的 markdown 从不被读回（`report.rs:68`，write-only）；无 signal→决策→状态→未来行为闭环 |
| C9 | 单二进制 / 100+ 命令 / 14 AI 工具集成 | ✅ **属实** | 60+ Rust 专属 parser + 58 TOML filter；hooks/ 下确有 claude/cursor/gemini/codex/windsurf/cline 等 host 适配 |

---

## 3. 架构地图

```
rtk (单二进制 CLI, clap dispatch @ main.rs 3272行)
│
├─ src/core/            核心引擎
│   ├─ filter.rs        语言感知注释剥离 + smart_truncate（550行）
│   ├─ toml_filter.rs   通用 8 段 regex 管线 + RUST_HANDLED 列表(264-314)（1696行）
│   ├─ truncate.rs      CAP_* 分级常量 + reduced()
│   ├─ tracking.rs      SQLite token 统计 + estimate_tokens=chars/4（1689行）
│   ├─ stream.rs        BlockHandler/LineHandler 流式 trait（1120行）
│   └─ telemetry.rs     ureq 上报（opt-in）
│
├─ src/cmds/            ★ 双轨之「Rust 专属轨」60+ 命令，每命令独立 parser+struct
│   ├─ git/  git.rs(2847) gh_cmd glab gt    （每子命令独立 parse/format）
│   ├─ dotnet/ binlog.rs(1656) ← flate2 解压 MSBuild 二进制日志，真协议解码
│   ├─ python/ ruff mypy pytest …           （注入 --output-format=json 再解析）
│   ├─ js/ jvm/ go/ ruby/ rust/ cloud/ system/  （47 处 #[derive(Deserialize)]）
│   └─ system/ log_cmd.rs(★去重核心) grep ls find
│
├─ src/filters/         ★ 双轨之「通用 TOML 轨」58 个 .toml 声明式 regex
│                       （brew/df/ps/helm/terraform/xcodebuild… build.rs 编译期 include_str!）
│
├─ src/hooks/           ★ host 注入：init.rs(6892) hook_cmd permissions
│                       matcher 只注入 "Bash"/"Shell"/"run_shell_command"
├─ src/discover/        registry.rs(4104,const 规则表) lexer rules — 静态扫描统计
├─ src/learn/           detector.rs — 正则配对"错命令→对命令"，写 markdown（write-only）
├─ src/analytics/       gain cc_economics — SQLite 派生统计展示
├─ src/parser/          ParseResult::{Full,Degraded,Passthrough} 三层降级
│
├─ hooks/{claude,cursor,gemini,codex,windsurf,cline,…}/  host 适配脚本
├─ scripts/benchmark*/  hyperfine(端到端) + chars/4 token 估算；benchmark-sessions 是残骸
└─ .claude/             ★ dogfooding：自带 skills/agents/commands/hooks 全套
```

**state stores**：SQLite（`~/.config/rtk` 下，token 统计/tracking）+ TOML config（用户可覆盖 limits）。
**extension points**：用户 `.rtk/filters.toml` 自定义 regex 规则（trust-gated）；host hook 适配。
**空目录**：无。**工程纪律**：`unsafe_code = "deny"` + `warnings = "deny"`。

---

## 4. 四压缩策略深挖（实现含量）

> 关键前提：**双轨架构**。60+ 高频命令走 Rust 专属 parser（结构化、含量高）；58 个长尾命令走 `src/filters/*.toml` 纯 regex 管线（含量低）。评价必须分轨。

| 策略 | 实现位置 | 手法 | 含量 | 可配置 |
|---|---|---|---|---|
| **1. Smart Filtering** | `core/filter.rs:163` MinimalFilter | 语言感知启发式**状态机**（11 种语言注释符表，跟踪块注释/docstring 开闭，保留 doc）；含 issue #464 数据格式豁免（踩坑修正） | **中**（真启发式，非 AST；字符串 `contains` 判注释会误判字面量） | 部分（level 标志 + 用户 TOML） |
| **2. Grouping** | 散落各 cmd（`ruff_cmd.rs:122` 三层嵌套 / `ls.rs:241` / `grep_cmd.rs:412`…） | HashMap 分桶计数 + 排序 Top-N，每命令按工具语义键定制 | **中-高**（领域定制，但每命令各抄一遍、**无公共抽象**=技术债） | 否 |
| **3. Truncation** | `core/truncate.rs:5` CAP_* + `filter.rs:323` smart_truncate | 多数命令 dumb `.take(N)`+"+N more"；**唯一的相关性排序 `smart_truncate` 只在 `read.rs:173` 一处调用** | **中**（CAP 分级设计合理；smart 逻辑严重 underused；CAP 硬编码，注释自承"config 化 planned, not yet implemented"） | CAP 不可配；LimitsConfig 可配 |
| **4. Deduplication** | `cmds/system/log_cmd.rs:68` | **真算法**：5 个 regex 把时间戳/UUID/HEX/大数字/路径归一化成占位符，再对归一化串 hash 分桶折叠成 `[×N]`；docker/kubectl/compose logs **共享同一引擎** | **高**（标准日志去重算法的轻量版，正确处理"同类不同实例"） | 否（全硬编码） |

**per-command 是真 parser 还是泛化 regex？→ 真 parser**。强证据：
- 47 处 `#[derive(Deserialize)]`，各工具解析成专属 struct（`RuffDiagnostic`/`TsError`/`GoTestEvent`…）
- 主动注入结构化标志：`ruff --output-format=json`、`go test -json`、`gh --json …`（理解工具协议，非抠文本）
- `dotnet/binlog.rs` 用 `GzDecoder` + `read_i32_le` 解 MSBuild **二进制**日志（泛化 regex 绝无可能）
- `parser/mod.rs:18` 三层降级 `Full→Degraded→Passthrough`

**无 ML/AST/tree-sitter**——全仓零命中，且项目对"这是 regex+启发式"**诚实**（没吹 AI）。

---

## 5. 量化 claim 审计（`<10ms` / `60-90%`）

### 5.1 `<10ms` —— 纯营销，无任何测量 ❌
- 唯一真实计时：`scripts/benchmark/run.ts:354` 用 `hyperfine` 测 `rtk git status` vs `git status` 的**端到端 wall-clock**（含 git 自身执行），不是 rtk 隔离开销；`rtk_mean - raw_mean` 这个减法**代码里根本没做**。
- 结果只 `console.log`，**无 assert/阈值/退出码**。
- 全仓搜 overhead/10ms/threshold：唯一硬性能门是**内存 <20MB**（`run.ts:380`），不是时延。CI 的 `benchmark.sh` 完全不计时。
- **判决**：单 Rust 二进制启动在这量级是合理猜测，但**项目自己从未测过、从未断言、CI 不守护**。"听起来对但无证据"。

### 5.2 `60-90%` —— 字节削减冒充 token 削减 ⚠️
- `rtk gain` 展示的节省全链路：`estimate_tokens(text) = ceil(text.len()/4)`（`tracking.rs:1284`，**字节数/4**，UTF-8 多字节还会虚高）→ 存 SQLite → 派生百分比。系数 1/4 在百分比里被约掉，**等价于直接比字符数**。
- README 那张 `-90%/-92%` 表是**手写估算**，自带免责"Estimates… actual savings vary"（`README.md:57`）；号称的自动更新脚本是 **stub**（`update-readme-metrics.sh:18-20` 注释自承"placeholder"），且表外根本没有它要找的标记。
- `cc_economics.rs` 接真 ccusage 数据，但真 token 只用来算**单价**，被省 token 数仍是 chars/4（`:129`），工具自己 print"Saved tokens estimated via chars/4 heuristic, not exact tokenizer"（`:535`）。
- `Cargo.toml` **无 tiktoken-rs/tokenizers/criterion/benches**。`benchmark-sessions/` 是缺 5 个模块的**不可运行残骸**，且即使能跑也只测 terminal-bench 通过率（正确性）不测 token。
- **判决**：核心压缩机制真实（输出确实大幅变短，byte-savings 测量链路真实且 CI 守 ≥60%）；水分在 (a) "字符削减"≠"token 削减"，对非英文/密集符号/JSON 偏差大；(b) 那张漂亮的高值表是手写的。**诚实度加分**：代码注释主动披露了 chars/4 局限。

---

## 6. ★ Read/Grep 失效洞 + 对纳入工作流的实测影响（铲屎官②）

### 6.1 洞的机制（代码铁证）
- `rtk init` 往 Claude Code `settings.json` 的 `hooks.PreToolUse` 注入：`{"matcher": "Bash", "hooks":[{"command":"rtk hook claude"}]}`（`init.rs:1087-1093`）。
- 全仓生产代码注入的 matcher **只有** `"Bash"`/`"Shell"`/`"run_shell_command"`（同一个 shell 入口的 host 别名），**没有任何一处是 Read/Grep/Glob**。
- 即便 hook 被喂非 Bash 输入，`hook_cmd.rs:71-83` 工具名守卫会 `return PassThrough` 原样放行。
- shell hook `rtk-rewrite.sh:48` 只读 `.tool_input.command`（Bash 工具独有字段）。
- 权限模型也 Bash 专属：`permissions.rs:156` 只保留 `Bash(...)` 规则，`Read(...)`/`Write(...)` 显式丢弃。
- **官方自首**：`README.md:303` "Claude Code built-in tools such as Read, Grep, and Glob **bypass the hook**"。

### 6.2 能强制吗？→ 不能，只能软建议
- `rtk read`/`rtk grep`/`rtk find` 子命令确实存在（`main.rs:94/257/1794`），但**没有任何机制把内置工具调用改写成它们**（grep `rewrite.*file_path` 全仓零命中）。
- 唯一手段：`rtk init` 往 `~/.claude/RTK.md` 塞一段文本建议 agent"请改用 `rtk read`"（`init.rs:191`）。依赖模型依从性，**无强制力**；且 `rtk read` 还要绕一层 shell，在能直接用内置 Read 时是负优化。

### 6.3 ★ 实测：用本次 teardown session 当真实样本
> 为什么不装 rtk 实测：(1) 沙箱无 rust 工具链，cargo 不可达；(2) 更本质——`rtk init` 会修改我自己的 `~/.claude/settings.json`（注入 hook），为一次调研擅改 agent runtime 配置不该做；(3) **洞的影响是"覆盖率"问题，装 rtk 恰恰测不出它测不到的东西**。真实工作流的工具分布才是答案。

本次审计 73k 行代码的真实 Claude Code session，token 消耗来源拆解：

| Context 来源 | 本 session 实例 | rtk 能压吗 |
|---|---|---|
| **Read 工具** | 读 Cargo.toml、3 个 build output 文件 | ❌ 绕过 |
| **Agent 子代理返回** | 3 个 subagent（内部大量 Grep/Read 读源码）共 ~29 万 token | ❌ 绕过（subagent 内部也是 Read/Grep 为主） |
| **WebFetch / WebSearch** | GitHub 主页、外部口碑搜索 | ❌ rtk 完全不管 |
| **Bash 命令输出** | `git clone`/`find`/`wc`/`ls`/`gh api` | ✅ **能压**（但本 session 占比很小） |

**结论**：在这个真实的代码审计工作流里，rtk 的有效覆盖面是**少数派**——它压不到 Read（文件内容）、Grep（搜代码）、Agent 返回、WebFetch 这些大头，只能压我手敲的几条 Bash。这直接印证：**现代 Claude Code agent 工作流的 token 大头恰好在 rtk 的盲区里**。Bash-heavy 的旧式脚本流 rtk 仍有真实价值；以内置工具为主的 agent 流，宣传的"省 60-90%"与你实际能拿到的相去甚远。

---

## 7. Cat Café 对比（Learn / Gap / Do-Not-Follow）

### 可学（Learn）
1. **日志归一化去重**（`log_cmd.rs`）：regex 把时间戳/UUID/路径替换成占位符再 hash 折叠——我们处理 CLI 日志噪音、压缩重复错误时直接可借鉴的算法。
2. **二进制日志解析 + JSON 标志注入 + 三层降级**（`binlog.rs` / `parser/mod.rs`）：与其正则抠文本，不如主动让工具吐结构化格式再解析，失败优雅降级。这是"理解协议优于猜文本"的工程范式。
3. **双轨架构的成本意识**：高频命令值得写专属 Rust parser，长尾命令用声明式 TOML regex 兜底——避免对所有命令一视同仁过度工程化。

### 缺口（Gap，诚实承认）
- 我们目前没有系统性的"工具输出 token 压缩层"。rtk 证明了在 Bash 输出侧做压缩有真实收益。**但**它的洞恰恰是我们已经在做对的地方——我们的 L0 是从**指令注入侧**（system prompt 压缩免疫）下手，rtk 是从**工具输出侧**。两者正交，可并存。

### 不 follow（Do-Not-Follow + 哲学理由）
1. **不学它的宣传话术**：把 chars/4 叫"token reduction"、未测量却写"<10ms"、"100% adoption"被自己脚注打脸——这是我们 `source-audit` / F218 明确反对的"营销冒充测量"。我们的数字必须接真测量或明确标注估算。
2. **不学 CAP 全硬编码**：注释自己写着"config 化 planned"却一直没做——我们的"用户状态默认持久化/可配置"价值观不接受这种。
3. **不学 learn/discover 的命名**：把 telemetry 包装成"learn/自我改进"。我们的 W7 Knowledge Feed 要求真闭环（signal→决策→状态→未来行为），命名必须诚实。

---

## 8. Lessons 候选（待 CVO 确认，不直接入全局）

- **L-candidate-1**：评估"省 token / 压上下文"类工具时，第一刀必须问"它的 token 是真 tokenizer 还是 chars/N 估算"——chars/4 对非英文/JSON/密集符号偏差大，"字节削减率"≠"token 削减率"。
- **L-candidate-2**：评估 Claude Code 生态 hook 类工具，必查"matcher 覆盖哪些工具"——只 hook Bash 的工具，对 Read/Grep/Glob 为主的现代 agent 流覆盖面有限。这是结构性判据，不是个案。
- **L-candidate-3**：star 数 ≠ 质量。rtk 5 个月 62k stars 但 watcher/star≈0.23%（异常低），核心数字含水分——但代码本体确实扎实。两件事要分开判，别被任一极端带跑。

---

## 9. 一句话给 CVO

要不要用：**想压 `git`/`cargo`/`pytest`/`docker` 这类 Bash 命令的噪音输出——可以白嫖，它真有效、零成本、Apache-2.0。但别信它的覆盖率和精确节省宣传，它碰不到你 agent 工作流里最大的 token 源（读文件/搜代码），那部分还得靠 Claude Code 自己的工具设计和我们 L0 的注入侧压缩。**
