# AI Coding Tools 调研报告 (2026-02-15)

## Executive Summary

* **Claude Code / Codex CLI / Gemini CLI** 三家官方 CLI 都已“能上 CI、能接工具、能管会话”，但**侧重点不同**：Claude Code 现在更像“可编程的 Agent SDK CLI”，Gemini CLI 主打“可扩展生态 + 强 session 管理”，Codex CLI 强在“终端体验 + MCP 深度集成 + 安全/沙箱与配置面板”。 ([Claude Code][1])
* **Hooks**：Gemini CLI 的 hooks 规格最完整（事件多、schema 清晰、支持串行/并行钩子组）；Claude Code 有官方 hooks 体系；Codex CLI 目前主要是**完成通知 notify** 这类“单点 hook”，更通用的 hooks 仍处在设计推进中（官方维护者/讨论中可见）。 ([Gemini CLI][2])
* **LSP**：目前在官方文档层面，明确写到“可做 LSP 插件”的是 Claude Code；Codex CLI / Gemini CLI 官方资料里没有找到 LSP 相关说明（更偏“IDE integration / agent protocol”而不是 LSP）。 ([Claude Code][3])
* **Antigravity**：Google 的“agent-first 开发平台/IDE”，强调多智能体任务控制、带浏览器与调试体验，并且官方（Google Cloud 博客）明确提到 **headless mode** 适配 CI/管道。模型层面官方博客称支持 **Gemini 3 + Claude Sonnet 4.5 + OpenAI GPT-OSS**（随账号配额/订阅形态）。 ([Google Codelabs][4])
* **Trae**：ByteDance 体系的 AI IDE 生态在推进（同时开源了 **trae-agent**），官方文档可见 MCP 能力；但“国内外版本差异/模型矩阵”官方公开信息不够完整，本报告将明确标注未找到的部分。 ([GitHub][5])

---

## Part 1: CLI 能力对比表

> 说明：你给的表格里 **Context Caching** 这个词各家含义不完全一致。这里我按“是否有**明确的** token/prompt 缓存机制（降低重复上下文成本）或等价能力（官方文档明确描述）”来填；如果仅有“会话续写/历史保存”，我会单独注明为“会话持久化”，避免偷换概念。

| 特性                  | Claude Code（Agent SDK CLI / Claude CLI）                                                                             | Codex CLI                                                                                                | Gemini CLI                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **LSP 支持**          | ✅ **支持**：可编写/使用 LSP plugin。 ([Claude Code][3])                                                                      | ❓ 未在官方 CLI 文档中找到 LSP 相关说明。 ([开放AI开发者][6])                                                                | ❓ 未在官方文档中找到 LSP 相关说明（更多是 IDE integration/生态扩展）。 ([Gemini CLI][7])                                     |
| **Hook 系统**         | ✅ 有“hooks 自动化”体系（官方设置页明确提到 hooks 扩展）。 ([Claude Code][8])                                                            | ⚠️ 目前主要是**notify 通知 hook**（任务完成触发命令）；更通用 hooks 仍在推进/讨论中。 ([开放AI开发者][9])                                  | ✅ hooks 规格非常完整：Before/After Tool、Before/After Agent、SessionStart/End 等，且支持钩子组串行/并行。 ([Gemini CLI][2]) |
| **无头模式**            | ✅ `claude -p` 非交互运行；支持 `--output-format json/stream-json`、`--continue` 等。 ([Claude Code][1])                        | ✅ `codex exec` 面向脚本/非交互场景。 ([开放AI开发者][6])                                                                | ✅ Headless：非 TTY 或命令行给定 query；支持 `--output-format`。 ([GitHub][10])                                    |
| **Context Caching** | ⚠️ 文档明确有“context management/续写”（但本次抓取未能拿到**官方 prompt/token caching**的可引用说明；因此不强行判定“有 token 缓存”）。 ([Claude Code][1]) | ⚠️ 未见“token/prompt caching”官方描述；但有**会话历史持久化**与 `shell_snapshot`（加速重复命令环境）。 ([开放AI开发者][9])                | ✅ **Token caching**：API key/Vertex 认证可用；OAuth 不可用（官方明确区分）。 ([GitHub][11])                             |
| **多会话/并行**          | ✅ `--continue` 续写会话；并且文档导航存在 subagents / agent teams 能力入口（多智能体形态）。 ([Claude Code][1])                               | ✅ 可从历史“回退/分叉（fork）”形成新分支会话；并行/子代理能力在公开文档里不如另两家清晰（至少我未找到明确条目）。 ([开放AI开发者][12])                            | ✅ session 管理很强：`--resume`、列出/删除会话；另有 experimental sub-agents 入口。 ([Gemini CLI][13])                   |
| **MCP 支持**          | ✅ Claude Code 文档导航明确列出 MCP 章节入口。 ([Claude Code][1])                                                                 | ✅ 深度支持：可在 `~/.codex/config.toml` 配 MCP servers，`codex mcp` 管理；甚至可把 Codex 自己当 MCP server。 ([开放AI开发者][12]) | ✅ 支持 MCP servers（stdio/SSE/HTTP 等）且文档非常细。 ([GitHub][14])                                              |

### 额外补充：近期安全/生态信号（2025-12 之后更值得盯）

* Gemini CLI 的最近版本更新里，出现过“**修复 MCP 相关的凭据暴露**”这类条目，说明 MCP 已进入“生产级攻防细节”阶段（对企业采用很关键）。 ([Gemini CLI][15])

---

## Part 2: Antigravity

### 1) Antigravity 是什么？

* 官方 codelab 直接定义：**Google Antigravity 是一个“智能体开发平台（agentic development platform）”，要把 IDE 推到“agent-first”时代**，提供类似“任务控制中心（Mission Control）”来管理能规划/编码/浏览网页的自主智能体。 ([Google Codelabs][4])
* 交付形态：需要**本地安装**，目前以 preview 形式面向个人 Gmail 账号，并提供一定的免费配额来使用“高级模型”。 ([Google Codelabs][16])

### 2) 核心能力与差异化特性（从官方可见信息提炼）

* **多智能体管理 + 任务控制中心**（不是单纯 autocomplete）。 ([Google Codelabs][4])
* **面向工程闭环**的能力倾向：Google Cloud 官方博文提到 Antigravity 的亮点包括集成浏览器反馈、原生调试、以及能直接调用本地工具（例如 `gh`、`gcloud`）。 ([Google Cloud][17])
* 选型逻辑上，它更像“IDE/平台”，而不是一个纯终端助手；对比 Gemini CLI 的定位（见第 5 点）。

### 3) 是否支持无头/CLI 模式？如果支持，怎么用？

* **支持 headless mode**：Google Cloud 官方文章明确写到 headless mode 适合管道输出、CI/CD 与自动化脚本。 ([Google Cloud][17])
* **但**：在本次可抓取的官方材料里，我没有拿到“具体命令行参数/示例命令”的可引用段落，所以不写“某个 flag 是什么”来冒充确定性。你们如果要落地，我建议直接以该官方文章为入口继续顺藤摸瓜查 Antigravity 的 CLI 文档/内置帮助。 ([Google Cloud][17])

### 4) 模型支持情况（只能 Gemini？能否接其他模型？）

* Antigravity **不是只能用 Gemini**：官方 Antigravity 博客“introducing”条目里写到可访问 **Gemini 3、Anthropic Claude Sonnet 4.5、以及 OpenAI 的 GPT-OSS**（并提到跨平台支持）。 ([Google Antigravity][18])
* 这意味着其模型接入更像“Google 统一供给/订阅或配额体系下的多模型面板”，而不一定要求用户自带每家 API key（第 4 部分会再解释“合规与风险”）。 ([Google Antigravity][18])

### 5) 与 Gemini CLI 的关系是什么？

* Google Cloud 在 **2026-02-04** 发文专门讨论“Choosing Antigravity or Gemini CLI”，它本质是在告诉开发者：两者是**不同形态的入口**（IDE 平台 vs 终端 agent），能力有重叠但使用场景不同。 ([Google Cloud][17])
* 从可见信息看：Gemini CLI 更适合“轻量、脚本化、终端原生”的工作流；Antigravity 更适合“多智能体协作 + UI 验证/调试 + 更强的工程闭环”。 ([Google Cloud][17])

---

## Part 3: Trae 深度调研

### 1) Trae 是什么？

* 有第三方与媒体将 Trae 归为 **ByteDance 的 AI IDE/开发工具**，并报道 ByteDance 开源了相关的 Trae-Agent。 ([Tech in Asia][19])
* 从 Trae 相关站点的产品描述来看，它定位为“AI coding partner + 完整 IDE 能力”的结合体。 ([traeide.com][20])

### 2) 核心能力和差异化特性

基于目前能引用到的材料，可确认的点：

* **MCP 支持**：Trae 官方文档页明确描述可通过 MCP 连接外部工具/服务，并提到支持多种 transport（页面摘要可见）。 ([TRAE Documentation][21])
* **可配置的行为约束/规则**：Trae 生态里常提到 `.rules` 这类约束文件（类似“团队规范/代理边界”）。不过严格来说，本次能直接引用的“官方段落”不足以把细节写死，所以我把它当作“生态方向”提示，不把它当作“已验证的完整规格”。（你们若要，我可以下一轮专门把 `.rules` 的官方 schema/示例抓全再补一版。） ([traeide.com][20])
* **Builder Mode/项目级生成**这类能力，在第三方教程里描述得比较多。 ([数字海洋][22])

### 3) 是否支持无头/CLI 模式？

* **Trae IDE（GUI）本体**：从公开描述看是完整 IDE 产品形态。 ([traeide.com][20])
* **Trae-Agent（CLI/可嵌入 agent）**：ByteDance 开源的 `bytedance/trae-agent` 仓库显示其提供配置与 usage，并可选启用 MCP services（说明它至少能在“非 IDE 的环境”作为 agent 运行）。 ([GitHub][5])

### 4) 模型支持情况

* 在 Trae 相关页面里可以看到“Built-in Models”列表（示例包含 Claude Sonnet 与 DeepSeek 系列）。 ([traeide.com][20])
* 但“是否支持用户自带 OpenAI/Anthropic key、是否按地区/版本切换模型池”这类更关键的问题，在本次可引用的官方文档摘要里**没有足够明确的条款**来做确定结论，所以我不硬猜。

### 5) 国内外版本差异（如有）

* **未找到官方明确对比说明**（例如：同名产品在 CN/Global 的账号体系、模型池、计费/配额、数据出境策略差异等）。
* 目前能确定的是：Trae 有独立文档站与生态（含 MCP），并且存在开源 Trae-Agent。 ([TRAE Documentation][23])

---

## Part 4: 合规性说明（关于“反代理/反向代理 Claude”）

### 1) Antigravity 是否内置 Claude 模型？还是用户自己配置 API？

* 从官方信息看，Antigravity **提供“随产品可用的多模型访问”**：官方 Antigravity 博客写到可访问 Gemini 3、Claude Sonnet 4.5、GPT-OSS；codelab 也提到 preview 用户有免费配额可用高级模型。 ([Google Antigravity][18])
* 至于“用户能否自行配置 Anthropic/OpenAI API key 作为自定义 provider”，本次我**没有找到可引用的官方文档条款**来确认，因此不下结论。

### 2) “Antigravity 的 Claude Opus 反代理出来”这种方式的合规性/风险

你提到的“反代理出来”，通常指：用一个本地/中间层服务，把 **A 产品（例如 Claude Code CLI）期望的 Anthropic API** 请求，转换成 **B 产品/订阅（例如 Antigravity 或某种 Code Assist API）** 的请求，再把响应转换回去，从而“绕开官方入口或计费方式”。

* **它确实在社区里被讨论过**：例如有人在论坛/社区发帖声称做了本地 proxy，把 Claude Code CLI 的请求桥接到 Antigravity 订阅可用的模型上。 ([Reddit][24])
* **但这类做法的合规风险非常高**，主要坑位包括：

  1. **违反服务条款/授权边界**：订阅通常规定“只能通过官方客户端/官方 API 使用”，中间层桥接可能被认定为规避限制，带来封号、限流、追溯计费或法律风险。
  2. **凭据与数据泄露风险**：proxy 需要接触 OAuth token / session cookie / 本地工程代码上下文，一旦实现不严谨或依赖链被污染，等价于给自己开了“代码外送闸门”。（Gemini CLI 的更新日志里都出现过“修复 MCP 相关凭据暴露”这一类条目，说明真实世界里这不是杞人忧天。） ([Gemini CLI][15])
  3. **审计不可控**：企业合规通常需要清晰的数据流向、日志与访问控制。proxy 方案往往把链路变成“黑箱”，审计与取证会很痛。
  4. **稳定性与可维护性差**：官方协议/鉴权一更新，proxy 就可能崩；这类方案经常导致“今天能用，明天全红”。

**更稳、更合规的替代路线（建议给铲屎官的结论版）**

* 想在 Claude Code CLI 里用 Claude：走 Anthropic 官方授权/官方集成路径（或 Claude Code 自身提供的 SDK/CLI 方式）。 ([Claude Code][1])
* 想用 Antigravity 提供的多模型：在 Antigravity 这个官方入口里使用其模型配额/订阅，不要把它“转售式”搬运到别的客户端。 ([Google Antigravity][18])
* 需要跨工具生态：优先用 **MCP 这类标准协议**来扩展工具能力，而不是绕鉴权/绕计费做“请求翻译”。 ([开放AI开发者][12])

---

## 信息来源

> 注：若页面本身标注了发布日期，我在括号中写出；否则以“本报告访问日 2026-02-15”计。

### 官方/一手文档与官方博客

* Claude Code Docs: “Run Claude Code programmatically / Agent SDK CLI（原 headless）”（访问 2026-02-15）。 ([Claude Code][1])
* Claude Code Docs: “Claude Code settings（含 hooks 扩展入口）”（访问 2026-02-15）。 ([Claude Code][8])
* Claude Code Docs: “Create your own LSP plugin”（访问 2026-02-15）。 ([Claude Code][3])
* OpenAI Codex CLI: CLI reference（访问 2026-02-15）。 ([开放AI开发者][6])
* OpenAI Codex CLI: Features（含 MCP 说明）（访问 2026-02-15）。 ([开放AI开发者][12])
* OpenAI Codex: Config reference（含 notify 等配置）（访问 2026-02-15）。 ([开放AI开发者][9])
* Gemini CLI: Hooks reference（访问 2026-02-15）。 ([Gemini CLI][2])
* Gemini CLI: Headless mode reference（GitHub raw doc，访问 2026-02-15）。 ([GitHub][10])
* Gemini CLI: Token caching（GitHub raw doc，访问 2026-02-15）。 ([GitHub][11])
* Gemini CLI: MCP server guide（GitHub raw doc，访问 2026-02-15）。 ([GitHub][14])
* Gemini CLI: Session management / CLI reference（访问 2026-02-15）。 ([Gemini CLI][25])
* Gemini CLI: Changelog latest（访问 2026-02-15）。 ([Gemini CLI][15])
* Google Codelab: Getting Started with Google Antigravity（中文/英文版本均可互证，访问 2026-02-15）。 ([Google Codelabs][4])
* Google Cloud Blog: “Choosing Antigravity or Gemini CLI”（2026-02-04）。 ([Google Cloud][17])
* Antigravity 官方博客：introducing Google Antigravity（2025-11-18）。 ([Google Antigravity][18])
* Trae 官方文档：MCP（访问 2026-02-15）。 ([TRAE Documentation][21])
* ByteDance 开源：bytedance/trae-agent（访问 2026-02-15）。 ([GitHub][5])

### 次级/外部参考（用于补全背景，不作为唯一结论依据）

* OpenAI GitHub Discussion：Codex hooks 讨论（含官方维护者提到 notify hook）（访问 2026-02-15）。 ([GitHub][26])
* The Verge：Antigravity 新闻报道（2025-11-18）。 ([The Verge][27])
* 社区贴/文章（仅用于说明“有人在做/在说”，不代表合规）：关于 proxy/桥接的讨论。 ([Reddit][24])

---

如果你愿意，我可以把这份报告再做一次“铲屎官友好版”的**落地建议**：

* “个人开发者怎么选 + 最省心配置路线图”
* “团队/企业怎么选 + 风险最小化清单（MCP/Hook/Headless/审计）”
  但这次我先把你们要的 fact-check 主干钉牢 🧷

[1]: https://code.claude.com/docs/en/headless "https://code.claude.com/docs/en/headless"
[2]: https://geminicli.com/docs/hooks/reference/ "https://geminicli.com/docs/hooks/reference/"
[3]: https://code.claude.com/docs/en/discover-plugins "https://code.claude.com/docs/en/discover-plugins"
[4]: https://codelabs.developers.google.com/getting-started-google-antigravity?hl=zh-cn "https://codelabs.developers.google.com/getting-started-google-antigravity?hl=zh-cn"
[5]: https://github.com/bytedance/trae-agent "https://github.com/bytedance/trae-agent"
[6]: https://developers.openai.com/codex/cli/reference/ "https://developers.openai.com/codex/cli/reference/"
[7]: https://geminicli.com/docs/ "https://geminicli.com/docs/"
[8]: https://code.claude.com/docs/en/settings "https://code.claude.com/docs/en/settings"
[9]: https://developers.openai.com/codex/config-reference/ "https://developers.openai.com/codex/config-reference/"
[10]: https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/headless.md "https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/headless.md"
[11]: https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/token-caching.md "https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/token-caching.md"
[12]: https://developers.openai.com/codex/cli/features/ "https://developers.openai.com/codex/cli/features/"
[13]: https://geminicli.com/docs/cli/cli-reference/ "https://geminicli.com/docs/cli/cli-reference/"
[14]: https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/tools/mcp-server.md "https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/tools/mcp-server.md"
[15]: https://geminicli.com/docs/changelogs/latest/ "https://geminicli.com/docs/changelogs/latest/"
[16]: https://codelabs.developers.google.com/getting-started-google-antigravity "https://codelabs.developers.google.com/getting-started-google-antigravity"
[17]: https://cloud.google.com/blog/topics/developers-practitioners/choosing-antigravity-or-gemini-cli "https://cloud.google.com/blog/topics/developers-practitioners/choosing-antigravity-or-gemini-cli"
[18]: https://antigravity.google/blog/introducing-google-antigravity "https://antigravity.google/blog/introducing-google-antigravity"
[19]: https://www.techinasia.com/news/bytedance-opensources-ai-dev-tool-traeagent "https://www.techinasia.com/news/bytedance-opensources-ai-dev-tool-traeagent"
[20]: https://traeide.com/ "https://traeide.com/"
[21]: https://docs.trae.ai/ide/model-context-protocol "https://docs.trae.ai/ide/model-context-protocol"
[22]: https://www.digitalocean.com/community/tutorials/trae-free-ai-code-editor "https://www.digitalocean.com/community/tutorials/trae-free-ai-code-editor"
[23]: https://docs.trae.ai/ "https://docs.trae.ai/"
[24]: https://www.reddit.com/r/LocalLLM/comments/1r3kwfi/i_built_an_opensource_proxy_that_lets_you_use/ "https://www.reddit.com/r/LocalLLM/comments/1r3kwfi/i_built_an_opensource_proxy_that_lets_you_use/"
[25]: https://geminicli.com/docs/cli/session-management/ "https://geminicli.com/docs/cli/session-management/"
[26]: https://github.com/openai/codex/discussions/2150 "https://github.com/openai/codex/discussions/2150"
[27]: https://www.theverge.com/news/822833/google-antigravity-ide-coding-agent-gemini-3-pro "https://www.theverge.com/news/822833/google-antigravity-ide-coding-agent-gemini-3-pro"
