---
title: "F146 Phase R — GPT Pro 咨询：四家 MCP 生态格式交集"
date: 2026-04-17
feature: F146
model: GPT Pro (gpt-5.4-pro)
mode: Mode B (云端模型咨询)
---

# F146 Phase R — GPT Pro 咨询

## Part 1: 发给云端模型的提示词

> 已发送。Prompt 见 `docs/prompts/2026-04-17-f146-phase-r-marketplace-ecosystem-research-prompt.md`

## Part 2: GPT Pro 回答（待回填）

> 铲屎官粘贴 GPT Pro 回答到这里

先把反证摆桌上。不能把四家 native plugin/runtime 当成同一种菜。OpenClaw 官方把外部生态 bundle 明说成“content and metadata packs” with selective feature mapping 和 narrower trust boundary，不是 native plugin；Claude 和 Codex 也都把 marketplace catalog、安装/启用状态、runtime 行为拆开。统一 adapter 可以做，但统一的对象应是“catalog metadata + raw MCP install subset”，不是“四家全部插件运行时”。 ([OpenClaw][1])

程序化安装覆盖度比原假设更乐观，但不平均。Claude 有官方 CLI 的 `claude mcp add` 和 plugin install 子命令；Codex 有 `codex mcp add`，还暴露本地 app-server 的 `plugin/install` / `plugin/uninstall` JSON-RPC；OpenClaw/ClawHub 有 `openclaw` 与 `clawhub` CLI 的 search/install/publish 路径；Antigravity 目前我只确认了 UI 安装与 raw config/file-refresh 路径，公开的 programmatic install API 没在官方文档里找到。 ([Claude API Docs][2])

另一个证据缺口现在也能补上。Claude Enterprise/org admin 可以用 `managed-mcp.json` 或 `allowedMcpServers` 锁死/限缩 MCP；Codex 则有 admin-enforced `requirements.toml`，能按 server identity allowlist MCP。也就是说，Phase B 的 adapter 不能把“生成 installPlan”误当成“一定可执行”，必须把 org policy verdict 单独建模。 ([Claude API Docs][2])

证据结构上，这份结论以官方文档为主骨架，辅以 OpenClaw/Smithery/Open Plugin Spec 等开源实现、Trail of Bits/Invariant 的安全研究，以及 LangChain 的 runtime-only adapter 作为替代路径参照。 ([GitHub][3])

## 6.1 四家 Schema 对照矩阵

> 注：你要求把 “OpenClaw Skill/Bundle” 放一列，这一列天然不是单一 schema，而是把最相关的安装面揉在一起。

| 字段           | Claude MCP                                                                        | Codex MCP                                                                                                         | OpenClaw Skill/Bundle                                                                                                          | Antigravity MCP                                 | 统一可行性                                               |
| ------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | --------------------------------------------------- |
| Server ID/名称 | `mcpServers.<name>`                                                               | `[mcp_servers.<name>]`                                                                                            | Skill 用 `name`；native plugin 用 `id/name`；bundle 还有 `codex/claude/cursor` subtype；raw MCP saved definitions 又是另一类 registry name | `mcpServers.<name>`                             | 只能统一成 `artifact_id + artifact_kind + display_name`  |
| 命令/入口        | stdio `command`；remote `url`                                                      | stdio `command`；remote `url`                                                                                      | skill 没有统一 command；native plugin 用 `extensions/setupEntry`；bundle 可导入 `.mcp.json`                                              | stdio `command`；remote `serverUrl`              | 只在 raw MCP server 子集上可统一                            |
| 参数 (args)    | `args`                                                                            | `args`                                                                                                            | skill/bundle 不是以 args 为中心；仅 bundle 内嵌 MCP 条目可能有 `args`                                                                         | `args`                                          | raw MCP 可统一                                         |
| 环境变量 (env)   | `env`，且可在 `command/args/env/url/headers` 插值                                       | `env` + `env_vars` + `env_http_headers`                                                                           | `requires.env` / `primaryEnv` / install hints / plugin `configSchema`                                                          | `env`                                           | 需拆成 `pass_env` / `required_env` / `header_from_env` |
| 认证 (auth)    | headers / OAuth 2 remote MCP                                                      | bearer token env var / static headers / env headers / OAuth                                                       | registry token + plugin/bundle onboarding metadata，未形成统一 raw MCP auth schema                                                   | `headers` / `authProviderType` / OAuth examples | 只能统一成 `auth_mode`，不能统一完整 auth flow                  |
| 版本 (version) | raw MCP config 未见 `schemaVersion`；plugin 有 semver；MCP runtime 有 `protocolVersion` | raw MCP entry 未见 per-server schemaVersion；plugin 有 `version`；runtime 有 `protocolVersion`；file 有 editor schema URL | native plugin 有 `version` + `pluginApi` + `minGatewayVersion` + build version                                                  | 未见公开 `schemaVersion`；公开示例仅 raw config           | 必须加 `version_ref`，必要时再加 `host_schema_family`        |
| 来源 URL       | HTTP `url` / marketplace source                                                   | HTTP `url` / marketplace `source.path`                                                                            | ClawHub registry / npm-safe spec / bundle marketplace                                                                          | `serverUrl`                                     | 可统一为 `source_locator`，但要附 `locator_type`            |
| 信任等级         | 无统一字段；由 org policy / allowlist / managed config 外置                                | 无统一字段；trust_level 与 requirements allowlist 外置                                                                     | 无统一字段；compat checks / moderation / unsafe-install override 外置                                                                  | 未见公开统一字段                                        | `trust_level` 只能是 adapter-derived field             |
| 权限声明         | 以批准/策略为主，非统一 manifest 字段                                                          | `enabled_tools` / `disabled_tools` + 审批策略                                                                         | allowlists / gating / capability snapshots，但不是统一 MCP permission scope                                                          | 未见公开统一字段                                        | 需要单独 `tool_policy` 字段                               |
| 依赖声明         | Claude plugin manifest 有 `dependencies`                                           | 官方插件文档未列依赖字段                                                                                                      | native plugin 有 compat/build/install 元数据；跨插件依赖未见统一字段                                                                           | 未见公开字段                                          | 只能做 optional extension，不能做四家强制公共字段                  |

表 6.1 最关键的反证有三处。第一，OpenClaw `openclaw mcp` 同时表示“把 OpenClaw 自己跑成 MCP server”和“保存外部 MCP server definitions”，同名不同义；第二，Antigravity 在配置里用 `serverUrl`，而 Gemini CLI 用 `httpUrl`，连同厂字段都不统一；第三，Codex 把 `env`、`env_vars`、`http_headers`、`env_http_headers` 拆开，和 Claude 的 `env/headers` 已经不是一一映射。所以 8 字段如果直接承载安装语义，会像把四种插头硬塞一个插座。 ([OpenClaw][4])

## 6.2 程序化安装 API 可用性

| 生态          | API 类型                               | 端点/命令                                                                                                                                | 认证方式                                  | 第三方可用                                                    | 稳定性                                  |
| ----------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | -------------------------------------------------------- | ------------------------------------ |
| Claude      | 官方 CLI / 本地配置写入                      | `claude mcp add`；`/plugin install <name>@<marketplace>`；`claude plugin install ...`                                                  | Claude 本地登录 / CLI session             | 是，本地自动化可用；未见公开 REST install API                          | CLI 高；plugin marketplace flow 中高     |
| Codex       | 官方 CLI + 本地 JSON-RPC app-server      | `codex mcp add`；app-server `plugin/install` / `plugin/uninstall` / `config/mcpServer/reload`                                         | 本地 Codex 账户/API key session           | 是，本地集成可用；官方公开目录 self-serve publish 仍未开放                  | MCP CLI 高；plugin directory publish 低 |
| OpenClaw    | 官方 CLI + registry-backed CLI         | `openclaw skills install`；`openclaw plugins install clawhub:...`；`clawhub install`；`clawhub skill publish`；`clawhub package publish` | `clawhub login` / token               | 是，CLI 自动化可用；公开 REST install API 规范未清晰公开                  | 中高                                   |
| Antigravity | UI + raw config file patch + Refresh | Agent pane → MCP Servers → Manage MCP Servers → View raw config；编辑 `~/.gemini/antigravity/mcp_config.json` 后 Refresh                 | app 内 OAuth / headers / provider auth | 公开文档里只确认手工/UI 与 file path；未确认公共 programmatic install API | 中低，且产品仍在 preview                     |

对你们的 Hypothesis 3，我建议直接改写成：Claude ✅，Codex ✅，OpenClaw ✅，Antigravity “manual/file path only confirmed”。Codex 不再是待确认，真正未落锤的是“官方第三方公开目录 publish API”；官方文档目前明确写着 official Plugin Directory 的 self-serve publishing “coming soon”。 ([OpenAI开发者][5])

## 6.3 支持我们假设的证据

| 证据                                                                                                | 来源                                                                                        | 置信度（高/中/低） | 可验证性                                 |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------- | ------------------------------------ |
| OpenClaw 官方兼容层明确是有损归一化，不是 runtime parity，这直接支持“最小公共交集应退回到可降维的 skill/MCP 内容层”。                     | OpenClaw Plugin Bundles / Plugin Internals ([OpenClaw][6])                                | 高          | 直接按文档安装 bundle 并 `inspect`           |
| Claude、Codex、OpenClaw 都有脚本化安装/注册路径，说明统一 install adapter 在 3/4 生态里有真实自动化落点。                        | Claude MCP/Plugins docs；Codex MCP/App Server；OpenClaw/ClawHub docs ([Claude API Docs][2]) | 高          | 官方命令与接口清单可直接复现                       |
| catalog ≠ runtime 在 Claude、Codex 和 Open Plugin Spec 都被明写出来，支持你们的 L3 三态思路。                         | Claude marketplace docs；Codex marketplace docs；Open Plugin Spec appendix B ([Claude][7])  | 高          | 可通过添加 marketplace、安装、启停插件观察          |
| MCP 本身有 `protocolVersion` 协商和扩展兼容约束，说明“统一 adapter 可行，但应以 capability negotiation 为准而不是只信 catalog”。 | MCP Lifecycle / Changelog / SEP-2133 ([Model Context Protocol][8])                        | 高          | 官方协议文本可验证                            |
| 社区的开放规格和聚合器都更容易收敛在 skills + MCP，而不是全插件 runtime。                                                   | Open Plugin Spec；Smithery；MCP Registry discussion ([GitHub][9])                           | 高          | 公开 repo / docs / registry discussion |

## 6.4 反对我们假设的证据

| 证据                                                                                                      | 来源                                                                                 | 置信度（高/中/低） | 影响评估                        |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------- | --------------------------- |
| OpenClaw 官方 bundle 不是 native plugin，而是 selective feature mapping，说明“统一 adapter”若追求 runtime parity 会失败。  | OpenClaw Plugin Bundles ([OpenClaw][1])                                            | 高          | 高。直接限制统一范围                  |
| `openclaw mcp` 语义双重，Antigravity/Gemini 又有 `serverUrl` vs `httpUrl` 的同厂字段漂移，说明字段同名不代表同义。                 | OpenClaw MCP docs；Google Developer docs for Antigravity/Gemini CLI ([OpenClaw][4]) | 高          | 高。不能做 naive field mapping   |
| Codex 官方 public directory 的 self-serve publish / management 仍是 “coming soon”，对写路径和 marketplace 同步不利。    | Codex Build plugins docs ([OpenAI开发者][10])                                         | 高          | 中高。Phase B 搜索没问题，公开发布写入受限   |
| `trust_level + preview + 人工确认` 不是充分安全条件。line jumping、tool poisoning、rug pull、shadowing 都可能在批准前后绕过表面 UX。 | Official MCP security docs；Trail of Bits；Invariant ([Model Context Protocol][11])  | 高          | 极高。Phase C 不能只做 trust_level |
| Antigravity 当前仍在 public preview，公开文档只确认 UI/file path，说明它更适合先做 read-only/manual adapter。                 | Google Developers Blog；Google Developer docs example ([谷歌开发者博客][12])               | 高          | 中高。接入顺序应后置                  |
| 依赖、企业控制、审计事件等在开放规格层仍是 future work，说明你们的 8 字段没覆盖完安装治理的硬骨头。                                               | Open Plugin Spec future considerations ([GitHub][13])                              | 高          | 中。需要在 Pack/adapter 中自补      |

## 6.5 我们没考虑到的维度

| 维度                                     | 为什么重要                                                                     | 建议的调研深入方向                                                           |
| -------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `artifact_kind` / `host_schema_family` | 不区分 `mcp_server`、`skill`、`plugin`、`bundle`，会把 catalog 归一化误当成 runtime 归一化  | 给每个生态挑 10 个代表样本，做 kind 分类与不可映射清单                                    |
| `transport`                            | MCP 侧已经从 HTTP+SSE 演进到 Streamable HTTP，host 支持面也不同                         | 记录 `stdio/http/sse`，不要只抽象成“endpoint”                                |
| `version_ref` / immutable pin          | rug pull 和 marketplace override 会让“同名条目”在安装后变脸                            | 调研 tag、semver、commit/ref、tool-hash 哪种最适合 Pack lock                  |
| `install_scope` + `policy_source`      | Claude/Codex/OpenClaw 都有 user/project/workspace/admin 之类的 scope/policy 维度 | 为 installPlan 增加 “请求 scope” 与 “实际允许 scope” 两层                       |
| `tool_policy` / permission scope       | Codex 已有 `enabled_tools/disabled_tools`，别家则更多靠策略或 allowlist               | 把“可见工具集/禁用工具集/approval mode”标准化成 policy 子对象                         |
| `auth_authority` / scopes              | OAuth server discovery、PRM、scopes、headers/bearer/env 不是一回事                | 记录 `auth_mode + authority + scopes + secret_refs`，而不只记 auth_mode    |
| `publisher_identity` / provenance      | trust_level 只是评级，不是身份绑定                                                   | 评估 marketplace owner、repo、package signer、org-curated source 的保真度    |
| `binding_snapshot_hash`                | 需要检测 tool description 变化、bundle 映射变化、runtime tools 漂移                     | 为 L3 增加 `tool_snapshot_hash` / `manifest_hash` / `last_verified_at` |
| `dependencies`（可选扩展）                   | 有的生态有依赖，有的没有；强行做必填会把 schema 拉碎                                            | 先做 optional extension，并调研 transitive dependency/lock 策略             |

这些维度不是空中楼阁，它们都被文档和安全研究往外拽出来了。MCP 协议层已经在 transport、auth、version 上快速演进；Claude/Codex/OpenClaw 都有 scope/policy 约束；Codex 已经暴露 tool allow/deny；安全研究又明确要求 pinning、change detection 和 cross-server controls。 ([Model Context Protocol][8])

对你们的 8 字段假设，我的修正是：**8 字段够 L1 搜索卡片，不够 L2 安装 preview，更不够 L3 binding/security**。Phase B 最少再加 5 个必填字段：`artifact_kind`, `version_ref`, `transport`, `install_scope`, `tool_policy`。`dependencies` 与 `publisher_identity/provenance` 先做 optional extension，不建议现在就提升为四家必填，因为目前只有 Claude 官方插件 manifest 明确给了 `dependencies`，Open Plugin Spec 还把依赖解析列为 future work。这个判断是推论，但证据链很硬。 ([OpenClaw][1])

## 6.6 置信度总评

* 假设 1（最小公共交集仅 MCP）：**支持**。官方与社区的共同骨架都落在 skills + MCP。OpenClaw 兼容 bundle 只映射 supported content；Open Plugin Spec 的 core 也只把 skills/MCP 放在 core，commands/agents/hooks/LSP 都还在 extended appendix。 ([OpenClaw][1])
* 假设 2（分层 adapter 可行）：**支持**。但前提是分层且承认有损，至少拆成 catalog adapter、install adapter、binding adapter 三层，并允许 delegated install / manual path。Claude、Codex 和 Open Plugin Spec 都把 marketplace metadata 与 runtime/install state 分开。 ([Claude][7])
* 假设 3（程序化安装覆盖度）：**支持**。但要改写原句。Codex 已确认有 CLI + local JSON-RPC programmatic path；Antigravity 目前只能确认 UI + raw config path。 ([OpenAI开发者][5])
* 假设 4（catalog ≠ runtime）：**支持**。这是本轮最稳的结论之一。Claude 添加 marketplace 不会安装 plugin；Codex marketplace 只是目录，安装副本与启用 state 存在别处；Open Plugin Spec 也明确 marketplace entry metadata 只影响 display/search/update checks，runtime behavior 仍看 manifest/contents。 ([Claude][7])
* 假设 5（trust_level 分级够用）：**反对**。`trust_level + preview + 人工确认` 是必要条件，不是充分条件。官方 MCP security 文档、Trail of Bits 和 Invariant 都给出了在 approval 之前或 approval 之后仍能成立的攻击路径，如 line jumping、token misuse、rug pull、tool shadowing、conversation-history exfiltration。至少还要加 pinning/hash、change detection、scan/re-approval。 ([Model Context Protocol][11])

## 7. Decision Interface（决策映射）

| 调研发现                                                                                                     | 建议行动   | Phase B 的 adapter 接口设计                                                                                                      | Phase C 的安全治理策略                                    | F129 Pack 的 marketplace 分发模型                            |
| -------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------- |
| **只有 `artifact_kind=mcp_server` 能做 fully portable install；native plugin/bundle 只能部分映射**。 ([OpenClaw][1]) | **采纳** | 统一返回 `artifact_kind`，并让 `installPlan.mode` 支持 `direct_mcp / delegated_cli / manual_file / manual_ui`                        | delegated/manual 模式默认更高警戒与更强 preview               | Pack 分成 `portable pack` 与 `delegated pack` 两型           |
| **8 字段只够 L1，不够 L2/L3**。 ([OpenAI开发者][5])                                                                 | **采纳** | L1 保留 8 字段；L2 增 `artifact_kind/version_ref/transport/install_scope/tool_policy`；L3 增 `binding_snapshot_hash/policy_verdict` | 审批逻辑基于 L2/L3，不基于 L1                                | Pack 持久化扩展字段，而不是只存 discovery 卡片                         |
| **catalog_cache / install_lock / binding_state 还不够，最好再加 snapshot hash**。 ([Claude][7])                   | **采纳** | 在 `binding_state` 下记录 `resolved_version`、`tool_snapshot_hash`、`last_verified_at`                                            | 更新或 refresh 时做 delta review，hash 变更重新审批            | Pack 生成 lock 数据，兼容 repo-tracked `capabilities.json`     |
| **Codex 可提前于预期接入；Antigravity 应 read-only/manual 优先**。 ([OpenAI开发者][5])                                   | **采纳** | 路线改成 `Claude first → OpenClaw → Codex → Antigravity(read-only/manual)`                                                      | Antigravity 禁止“自动执行”想象，先只出 preview 与 handoff steps | Antigravity Pack 先落 `manual_ui/manual_file` installPlan |
| **org/admin policy 是实际执行边界，不是附属信息**。 ([Claude API Docs][2])                                              | **采纳** | adapter 输出 `policy_verdict` 与 `policy_source`                                                                               | install preview 明确显示“可发现/可计划/不可执行”的差别              | Pack 安装时保留 policy check 结果，避免“repo 里可配，本机却不准装”          |
| **trust_level 只是排序字段，不是安全边界**。 ([Model Context Protocol][11])                                            | **采纳** | search 结果可按 trust_level 过滤，但 install 决策还要看 pin/policy/hash                                                                  | 加入 pinning、change detection、最小权限、re-approval       | Pack 里存 `version_ref` / `hash` / `publisher_identity`   |
| **把 apps/connectors/channels/LSP/hook systems 一次性统一，会把 Phase B 变成泥石流**。 ([OpenClaw][1])                  | **搁置** | Phase B 只对它们做 display，不做 portable install adapter                                                                           | Phase C 暂不为非-MCP 组件定义统一权限模型                        | F129 Pack 允许 host-specific extensions，但不承诺跨生态可执行        |
| **存在替代方案：只统一 runtime tool consumption，不统一 marketplace install**。LangChain 已经这么做。 ([LangChain 文档][14])    | **试点** | 作为 fallback track: 先做 federated search + native install + runtime MCP aggregation                                           | 安全面更小，因为不碰跨生态 install 写路径                          | 可把 Pack 当 runtime binding recipe，而不是安装包                 |

我自己的落地建议是：**Phase B 先做“统一目录 + 分级安装通道”，不要做“统一运行时幻觉”**。也就是搜索层统一，安装层按 `direct/delegated/manual` 分流，绑定层再做真实状态追踪。这样既兼容你们已有的 `buildInstallPreview` / `withCapabilityLock`，又不会在 Antigravity 这类 preview surface 上撞墙。

## 8. Risk Register（风险登记）

1. **风险 1：把“同名字段”误判成“同义字段”**。`mcp`、`env`、`headers`、`serverUrl/httpUrl/url` 看着像一家亲，实际血型各不相同。OpenClaw 的 `mcp` 甚至一词两义。
   → **缓解建议**：adapter 必带 `artifact_kind + host_schema_family + locator_type`；每家维护官方样例测试夹具，禁止跨生态直接字段复制。 ([OpenClaw][4])

2. **风险 2：把 install preview + 人工确认 当成充分安全边界**。这会在 line jumping、tool poisoning、rug pull、shadowing 面前漏风，像给门上三把锁，却把窗户一直开着。
   → **缓解建议**：版本 pin + tool/manifest hash + refresh/update 时 delta review + scanner hook；对 tool description 变化强制重新审批。 ([Model Context Protocol][11])

3. **风险 3：把 Phase B 建在未 GA 或未开放的 surface 上**。Antigravity 仍在 public preview；Codex official public directory 的 self-serve publish 还没开；官方 MCP Registry 自身也还在 preview/freeze 阶段。
   → **缓解建议**：feature flag + read-only adapter first + delegated/manual install；不要把外部 registry 当 source of truth，把它当 catalog hint。 ([谷歌开发者博客][12])

如果你要我把这份结论进一步收束成 **Phase B adapter 接口草案**，我建议下一步直接输出一个最小可实现的 TypeScript interface 和 `installPlan.mode` 枚举，把上面的判断翻成能进 PR 的形状。

[1]: https://docs.openclaw.ai/plugins/bundles "https://docs.openclaw.ai/plugins/bundles"
[2]: https://docs.anthropic.com/en/docs/claude-code/mcp "https://docs.anthropic.com/en/docs/claude-code/mcp"
[3]: https://github.com/modelcontextprotocol/registry "https://github.com/modelcontextprotocol/registry"
[4]: https://docs.openclaw.ai/cli/mcp "https://docs.openclaw.ai/cli/mcp"
[5]: https://developers.openai.com/codex/mcp "https://developers.openai.com/codex/mcp"
[6]: https://docs.openclaw.ai/plugins/bundles?utm_source=chatgpt.com "Plugin Bundles - OpenClaw"
[7]: https://code.claude.com/docs/en/discover-plugins "https://code.claude.com/docs/en/discover-plugins"
[8]: https://modelcontextprotocol.io/specification/2025-03-26/changelog "https://modelcontextprotocol.io/specification/2025-03-26/changelog"
[9]: https://github.com/vercel-labs/open-plugin-spec/blob/main/README.md "https://github.com/vercel-labs/open-plugin-spec/blob/main/README.md"
[10]: https://developers.openai.com/codex/plugins/build "https://developers.openai.com/codex/plugins/build"
[11]: https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices "https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices"
[12]: https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/ "https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/"
[13]: https://github.com/vercel-labs/open-plugin-spec "https://github.com/vercel-labs/open-plugin-spec"
[14]: https://docs.langchain.com/oss/python/langchain/mcp "https://docs.langchain.com/oss/python/langchain/mcp"

## Part 3: 综合后的最终版本（待撰写）

> 本地猫（布偶猫）综合 GPT Pro + Gemini 两路结果后撰写

[待撰写]
