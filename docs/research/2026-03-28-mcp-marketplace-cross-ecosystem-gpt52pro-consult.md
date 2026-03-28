---
feature_ids: [F146]
related_features: [F041, F145]
topics: [mcp, marketplace, connector, plugin]
doc_kind: note
created: 2026-03-28
---

# 2026-03-28 MCP Marketplace 跨生态咨询（GPT-5.2 Pro，Mode B）

## Part 1: 发给云端模型的提示词

> 直接复制发送给 GPT-5.2 Pro（云端），不要删段。

我们在做一个多 Agent 协作平台（Cat Cafe），刚完成 MCP 可移植化（F145），现已立项 F146：把能力中心升级成“一键添加 MCP + 多生态 marketplace 聚合”。

请你作为架构审阅者，只做审阅与补强建议，不要假设你能访问我们的本地仓库。

### 当前已知事实

1. 我们已经有 L1 能力真相源（`capabilities.json`）+ `mcp:doctor`。
2. 目前新增 MCP 仍然偏工程向，缺少完整 UI 写路径与 marketplace 聚合。
3. 我们希望固定三层架构：
   - L1: MCP 执行层（唯一真相源）
   - L2: Skills/workflows（依赖声明层）
   - L3: Plugins/connectors/marketplace（分发层）
4. 目标生态至少三家（Codex/Claude/OpenClaw），可选第四家 Antigravity。

### 已确认外部事实（供你审阅）

- Codex 有 Plugin Directory，可在 app/CLI 浏览安装；插件可以打包 skills、apps、mcpServers。
- Codex Build Plugins 文档写了：官方公共 Plugin Directory 的自助发布能力“coming soon”。
- OpenAI API 有 MCP and Connectors（connector_id + OAuth token + require_approval）。
- Claude Code 支持自建 plugin marketplace（`marketplace.json`），可分发 plugins，并支持多种 source。
- OpenClaw 支持 ClawHub registry；也支持把 Codex/Claude/Cursor bundle 映射为本地能力（有 selective mapping）。

### 请先验真这些 URL（逐条）

1. https://developers.openai.com/codex/plugins
2. https://developers.openai.com/codex/plugins/build
3. https://developers.openai.com/api/docs/guides/tools-connectors-mcp
4. https://code.claude.com/docs/en/plugin-marketplaces
5. https://docs.openclaw.ai/plugins/bundles
6. https://docs.openclaw.ai/tools/clawhub

请你对每条给出：
- 是否可访问
- 页面核心内容是否支持我们当前结论
- 若不支持，正确替代链接是什么

### 我们希望你回答的问题

1. 这套 L1/L2/L3 架构有没有明显缺口？最危险的抽象错误是什么？
2. 对“多生态聚合”的 MVP 应该如何切 phase，才能最快落地且可回滚？
3. 四家生态（Codex/Claude/OpenClaw/Antigravity）在插件/连接器 schema 上，最小公共交集字段是什么？哪些字段必须做生态特化？
4. 哪些生态支持“程序化发布/安装 API”，哪些只能走 CLI/UI？请按可自动化等级分层（可自动安装/需人工确认/仅可发现）。
5. 四家生态的安装流程与授权机制差异有多大？是否能统一成一个 install flow（至少 UI 体验统一）？
6. 供应链安全上，除了 trustLevel（official/verified/community）外，还应该加哪 3-5 条硬门禁？
7. 给一个 6-8 周执行建议：每周目标、验收点、feature flag 切分。

### 输出要求

- 按“已确认 / 推断 / 风险假设”三段给出
- 每个建议标注优先级（P0/P1/P2）
- 必须给一个“跨生态字段对照矩阵”（表格）
- 必须给一个“不可统一项清单”（明确哪些不能强行统一）
- 用简洁可执行的方式表达，不要泛泛而谈

## Part 2: 云端模型回答（待回填）

我先把判断摆前面。

你们的 L1/L2/L3 方向没有大偏差，但 L3 不能继续被当成一个统一的 `plugin marketplace` 黑盒。更稳的做法是保留三层不变，同时把 L3 内部分成 3 个子对象: `catalog/目录项`、`artifact/安装物`、`binding/运行时绑定`。最危险的抽象错误，是让 L3 的目录元数据直接冒充 L1 的可运行能力真相。因为 Codex / Claude / OpenClaw 主要面对的是“可安装工件”，而 OpenAI API 的 connectors / remote MCP 是“运行时挂载工具”；再加上 Claude 的 `strict`、OpenClaw 的 detect-only 映射、Codex 的额外认证步骤，目录并不等于最终可运行能力。菜单不是上菜记录。 ([OpenAI开发者][1])

## 已确认

### 先验真这 6 个 URL

1. `https://developers.openai.com/codex/plugins`
   可访问。支持你们的结论。它明确写了 Codex plugin 会打包 skills、app integrations、MCP servers；也明确有 Codex app 和 CLI 里的 Plugin Directory，以及安装时可能在安装阶段或首次使用时触发认证。无需替代链接。 ([OpenAI开发者][1])

2. `https://developers.openai.com/codex/plugins/build`
   可访问。支持你们的结论。它明确写了 build/distribute plugin、repo/personal marketplace 的 `marketplace.json` 位置、`skills` / `mcpServers` / `apps` / `interface` 等字段，以及官方公共 Plugin Directory 的 self-serve publish “coming soon”。无需替代链接。 ([OpenAI开发者][2])

3. `https://developers.openai.com/api/docs/guides/tools-connectors-mcp`
   可访问。支持你们“OpenAI API 有 connectors / MCP，且用 `connector_id`、OAuth `authorization`、`require_approval`”这一条结论。
   但要加一个边界修正: 这页讲的是 Responses API 里的 runtime `mcp` tool，不是 marketplace / publish / install 文档。也就是说，它支持“运行时挂载”，不支持“插件市场”这个推断。链接本身没错，只是语义边界不能再往 marketplace 扩。 ([OpenAI开发者][3])

4. `https://code.claude.com/docs/en/plugin-marketplaces`
   可访问。支持你们的结论。它明确写了自建 `marketplace.json`、`/plugin marketplace add`、`/plugin install`、多种 source 类型，以及 `strict` 模式。无需替代链接。 ([Claude][4])

5. `https://docs.openclaw.ai/plugins/bundles`
   可访问。支持你们的结论。它明确写了 OpenClaw 可安装 Codex / Claude / Cursor bundles，并做 selective mapping；同时也明确并非所有 bundle 特性都会运行，有一部分只是 detected but not executed。无需替代链接。 ([OpenClaw][5])

6. `https://docs.openclaw.ai/tools/clawhub`
   可访问。支持你们的结论。它明确写了 ClawHub 是 OpenClaw skills / plugins 的 public registry，原生 `openclaw` 命令可 search/install/update，独立 `clawhub` CLI 负责 login、publish、delete、undelete、sync。无需替代链接。 ([OpenClaw][6])

### 直接能落地的事实

* [P0] 你们 Phase 1 的最大公共交集不是“所有 plugin 能力”，而是 `skills + MCP`。Codex plugin 支持 skills / MCP / apps；Claude plugin 支持 skills 与 MCP，并额外有 commands / agents / hooks / LSP；OpenClaw bundles 当前能稳定映射 skills 与 MCP；Antigravity 官方目前能确认的是 skills 与 MCP。最快的跨生态底盘，应该先卡在这里。 ([OpenAI开发者][1])

* [P0] 公共官方商店的“可发布性”非常不对称。Codex 官方公共目录的自助发布还没开；Anthropic 官方 marketplace 上架还是表单提交流；OpenClaw 的 ClawHub 已经有明确的 CLI publish/sync/delete 流程。你们不该把 MVP 建在“统一公共发布”上。 ([OpenAI开发者][2])

* [P1] 有一个很好用的杠杆点: OpenClaw 可以直接消费 Claude known marketplaces、本地 marketplace root、GitHub shorthand、git URL。也就是说，团队私有分发这件事，Claude marketplace 格式天然就能喂 Claude 和 OpenClaw 两家。 ([OpenClaw][7])

## 推断

### 1) 架构缺口，以及最危险的抽象错误

* [P0] 保持 L1/L2/L3，不新增第四层；但要把 L3 内部分成三个持久对象:
  `catalog_cache` 负责“能发现什么”，
  `install_lock` 负责“实际装了什么、从哪来、版本/sha/源类型是什么”，
  `binding_state` 负责“OAuth / approval / runtime attach 状态”，
  最后只允许 adapter + `mcp:doctor` 把“验证后的 runnable capabilities”写回 `capabilities.json`。否则 L1 很快会被目录元数据和认证状态污染。这个拆法正好贴合 Codex marketplace、Claude marketplace、OpenClaw manifest/bundle、OpenAI runtime MCP 的文档边界。 ([OpenAI开发者][2])

* [P0] 最危险的抽象错误，不是“字段名不统一”，而是把“catalog manifest = runtime capability set”当真。
  Claude 里 `strict` 会决定到底是 `plugin.json` 还是 marketplace entry 说了算；OpenClaw bundles 明确有 detected-but-not-executed 组件；Codex 的 apps/MCP 还可能额外要求 setup/auth；OpenAI API 的 remote MCP tool surface 甚至是运行时发现并受 approval/`allowed_tools` 约束的。L1 必须是“安装/挂载之后的真相”，不能是 L3 的照抄件。 ([Claude][4])

* [P1] 给每个安装结果都生成一个 `mapping_report`，至少包含 `runnable / detect-only / unsupported` 三类。OpenClaw 已经证明，bundle 兼容不是“全量执行”，而是“选择性映射”。这个概念应该被提升为你们平台的一等公民。 ([OpenClaw][5])

* [P1] L2 的依赖不要依赖“包名”，而要依赖“能力类”。建议最少拆成 `skill`、`mcp`、`app/connector`、`native-extension` 四类，否则同一个 artifact 同时满足多个依赖时，调度和回滚都会打结。各家文档的组件类型已经足够证明这一点。 ([OpenAI开发者][1])

* [P1] 借鉴 OpenClaw 的做法，把“auth choice metadata / config schema / static capability snapshot”设计成 pre-runtime 可读元数据，不需要执行插件代码就能做安装预检、UI 引导和安全审查。这个设计非常值钱。 ([OpenClaw][8])

### 2) 多生态聚合的 MVP phase

* [P0] **Phase A: 只读聚合，不写安装**
  先做 catalog aggregation，聚合 Codex / Claude / OpenClaw，UI 只展示来源、trust、组件摘要、是否 detect-only、是否需要 auth。回滚最简单，关 flag 即可。 ([OpenAI开发者][2])

* [P0] **Phase B: install preview，不做真实安装**
  给每个条目生成 install plan、mapping report、security gate 结果、rollback 计划。先把“会发生什么”讲清楚，再动手。回滚就是丢掉 preview object。这个阶段能最快校验 L1/L3 边界是不是干净。 ([Claude][4])

* [P0] **Phase C: 第一批真实写路径只做 Claude + OpenClaw**
  Claude 有非交互 CLI install/update 和明确 scope；OpenClaw 有 install/update、bundle/native 两条线、以及 ClawHub publish/sync。两家是目前最好自动化、也最好回滚的。 ([Claude][9])

* [P1] **Phase D: Codex 先做“本地/private marketplace 适配 + 官方 handoff”，不要死磕官方目录写 API**
  你们可以生成 repo/personal marketplace JSON；而官方文档当前给到的是 Plugin Directory 安装、local marketplace 文件、以及 app-server 的 `plugin/list/read` / `app/list` / `installUrl` / `mcpServer/oauth/login` 这类 discovery/handoff 能力。我会把 Codex 放进“可集成发现、可生成本地分发、安装以 handoff 为主”的 lane。 ([OpenAI开发者][2])

* [P1] **Phase E: OpenAI API connectors / remote MCP 单独做成 Connect flow**
  它不是 installable plugin，应该放到“Connect / Attach”面板里，生命周期跟 package install 不同。回滚方式是 unbind + revoke token，不是 uninstall。 ([OpenAI开发者][3])

* [P2] **Phase F: Antigravity 只做 lab / handoff**
  目前官方能确认 skills 与 MCP，但我没找到公开 marketplace schema / publish/install API 文档。它适合实验接入，不适合现在就承诺 full parity。 ([Google Antigravity][10])

* [P1] **最快落地技巧**
  团队私有分发先以 Claude marketplace 作为 authoring substrate，再让 OpenClaw 直接消费它，Codex 由你们内部 canonical schema 反向生成 marketplace JSON。这样 Phase 1 就能做到“一套目录，双生态可用”，少走很多弯路。 ([Claude][4])

### 3) 跨生态字段对照矩阵

下表是我建议的 canonical mapping。Antigravity 未确认的地方，我故意标成 `?`，不拿猜测硬补。Codex 列基于 plugin manifest + marketplace docs，Claude 列基于 marketplace schema / plugin reference，OpenClaw 列基于 native manifest + bundle docs，Antigravity 列只基于目前能确认的官方 skills/MCP 信息。 ([OpenAI开发者][2])

| 字段                  | 最小统一要求        | Codex                                       | Claude                                                                   | OpenClaw                                                        | Antigravity                 | 必须生态特化 |
| ------------------- | ------------- | ------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- | --------------------------- | ------ |
| `artifact_id`       | 必填 string     | `name`                                      | `name`                                                                   | native `id`，另有 package/registry 名                               | skill folder / MCP server 名 | 否      |
| `version`           | 可选            | top-level `version`                         | `version`，也可 pin `ref/sha/npm version`                                   | package / ClawHub semver                                        | `?`                         | 是      |
| `source_locator`    | 必填 object     | 官方文档示例主要是 local `path`，另有 curated directory | relative / github / url / git-subdir / npm                               | local / archive / clawhub / npm / marketplace / github / git    | `?`                         | 是      |
| `component_set`     | 必填 enum[]     | `skills` / `apps` / `mcpServers`            | `skills` / `commands` / `agents` / `hooks` / `mcpServers` / `lspServers` | native capabilities，或 bundle-mapped skills / MCP / settings 等子集 | 目前确认 `skills` / `MCP`       | 是      |
| `install_mode`      | 必填 enum       | directory / local marketplace / handoff     | CLI install                                                              | CLI install + gateway restart                                   | UI install / handoff        | 是      |
| `auth_mode`         | 必填 enum       | on-install 或 first-use                      | 依 plugin/MCP 实现；marketplace schema 不统一 auth object                       | manifest 可带 auth-choice/onboarding metadata                     | prompt-based                | 是      |
| `scope`             | 可选            | repo / personal / enabled flag              | user / project / local                                                   | workspace / enable-disable / restart                            | `?`                         | 是      |
| `integrity`         | promotion 时必填 | 路径约束，公开 sha 机制未见                            | `ref` / `sha` / npm version                                              | exact version pin，远端 marketplace 有路径边界                          | `?`                         | 是      |
| `ui_legal`          | 可选            | `interface.*` 很丰富                           | description/category/tags 等中等丰富                                          | `uiHints` / channel metadata / install hints                    | `?`                         | 是      |
| `runtime_authority` | 必填 derived    | plugin.json + marketplace policy            | `strict` 决定 plugin.json 还是 marketplace entry                             | native manifest / package metadata / bundle mapper              | `?`                         | 是      |

真正建议**强制 required**的公共字段，只有这 8 个: `ecosystem`、`artifact_id`、`display_name`、`source_locator`、`component_summary`、`install_mode`、`auth_mode`、`trust/provenance`。`version`、`publisher`、`legal`、`visuals`、`scope` 都应该是 optional/extension fields。这样你们的 canonical schema 才不会被最弱生态拖垮。 ([OpenAI开发者][2])

* [P0] **OpenAI API 请单独建 sibling schema，不要塞进同一个 install schema**
  我会单独做 `RuntimeBinding`，至少包含: `binding_type(connector|remote_mcp)`、`connector_id?`、`server_url?`、`authorization_ref`、`require_approval`、`allowed_tools?`、`defer_loading?`、`server_label`。这是 attach，不是 install。 ([OpenAI开发者][3])

### 4) 程序化发布 / 安装 API，按自动化等级分层

* **可自动安装**

  * [P0] Claude 自建 marketplace: `claude plugin install` / `update` 有非交互 CLI，且支持 user / project / local scope。自建 marketplace 本质是 git/json 分发，可脚本化。 ([Claude][9])
  * [P0] OpenClaw / ClawHub: `openclaw plugins install`、`update`，以及 `clawhub publish/sync`、token login、`--no-input` 都有明确文档。它是四家里最接近“可自动安装 + 可自动发布”的。 ([OpenClaw][7])
  * [P1] OpenAI API runtime attach: 只要你自己拿到 OAuth access token，connector / remote MCP 的 attach 是 API 驱动的。但它不属于“安装 API”。 ([OpenAI开发者][3])

* **需人工确认**

  * [P1] Codex 官方 Plugin Directory 安装当前仍以 app/CLI 目录交互为主；plugin 还可能在安装时或首次使用时要求认证。你们可以自动生成 local/private marketplace，但当前文档里我没看到公开的 plugin install write API。 ([OpenAI开发者][1])
  * [P2] Antigravity 的 MCP 安装，官方摘要显示是“从支持列表里选中后点 Install，再走屏幕上的认证提示”。这是典型 handoff/UI lane。 ([Google Antigravity][11])

* **仅可发现 / 仅人工提交**

  * [P1] Codex 官方公共 Plugin Directory 的 self-serve publish 还没开。 ([OpenAI开发者][2])
  * [P1] Anthropic 官方 marketplace 上架目前是 in-app 提交表单，不是 publish API。 ([Claude][12])
  * [P2] Antigravity 公开 marketplace / publish API，我目前没在官方域检索到对应文档。 ([Google Antigravity][13])

### 5) 安装流程与授权机制能否统一

* [P0] **UI 体验可以统一，后端语义不能硬统一。**
  我建议统一成 5 步: `Discover -> Inspect -> Install/Attach -> Authenticate/Approve -> Verify(doctor)`。
  但底层至少要分 3 个 adapter:

  1. `package install`，给 Claude / OpenClaw / Codex local 用
  2. `runtime attach`，给 OpenAI API connectors / remote MCP 用
  3. `external handoff`，给 Codex 官方目录、Antigravity UI 安装用。 ([Claude][9])

* [P1] **认证时机不能统一成一个字段。**
  Codex 可能 install-time 或 first-use；OpenAI API 默认是 per-call approval；OpenClaw 有 pre-runtime auth-choice metadata；Antigravity 目前是 prompt-based UI auth。你们应该统一成 `auth_timing` 枚举，而不是统一成一个 OAuth 对象。 ([OpenAI开发者][1])

* [P1] **restart / scope 也必须单独建模。**
  Claude 有 user/project/local；Codex 有 repo/personal 和 enabled flag；OpenClaw 安装后需要 gateway restart；OpenAI runtime attach 则根本没有“安装 scope”。这四种不该强行揉成一个 `scope` 下拉框。 ([Claude][9])

### 6) 供应链安全，除了 trustLevel 还要加的硬门禁

* [P0] **不可变 pin 规则**
  promotion 到“team/stable”时，必须有 exact version、git `sha` 或 archive digest；禁止 floating branch 当稳定源。Claude 已经明确区分 marketplace source 的 `ref` 和 plugin source 的 `sha`，OpenClaw 也明确建议 pin 版本。 ([Claude][4])

* [P0] **源路径边界 + marketplace allowlist**
  Codex 要求 `source.path` 相对 marketplace root 且留在 root 内；Claude 相对路径不能 `../`，并支持 `strictKnownMarketplaces`；OpenClaw 对 remote marketplace 也要求 plugin entry 留在 cloned repo 内。这个必须变成平台级 hard gate。 ([OpenAI开发者][2])

* [P0] **默认禁 install-time scripts / native build**
  OpenClaw 的 npm install 已经用 `--ignore-scripts`。我会把它提升成平台硬门禁: 任何 npm-sourced artifact 默认不跑 lifecycle scripts，除非进入 allowlist。 ([OpenClaw][14])

* [P0] **schema / compatibility validation 先于执行**
  OpenClaw native manifest 明确是“先读 manifest、先验 config，再决定是否加载代码”，ClawHub install 还会检查 plugin API / minimum gateway compatibility。你们也应该先验 manifest / source / mapping，再允许安装或启用。 ([OpenClaw][8])

* [P0] **声明能力 vs 实测能力 diff gate**
  目录里宣称的 component set，必须和实际 extract 的 capabilities 比对；凡是出现额外 write-capable tools / MCP / hooks / apps，都强制 review。OpenAI 官方文档对 remote MCP 的数据共享与敏感动作 approval 已经给了很强的信号。 ([OpenAI开发者][3])

### 7) 6 到 8 周执行建议

1. **Week 1 [P0]**
   定 canonical schema 与 adapter contract。
   验收: 至少 1 个 Codex、1 个 Claude、1 个 OpenClaw 条目能被 normalize。
   flags: `ff.market.catalog.readonly`, `ff.market.binding.runtime`, `ff.market.mapping.report`.

2. **Week 2 [P0]**
   做只读 catalog aggregation UI。
   验收: 能看到 trust、source、component summary、detect-only badge。
   flags: `ff.market.providers.codex`, `ff.market.providers.claude`, `ff.market.providers.openclaw`. ([OpenAI开发者][2])

3. **Week 3 [P0]**
   做 install preview、security gates、rollback preview。
   验收: 每个条目都能产出 install plan / rollback plan / pin status。
   flags: `ff.market.install.preview`, `ff.market.security.enforce`.

4. **Week 4 [P0]**
   打通 Claude 写路径。
   验收: install / update / uninstall 在 user/project/local 三个 scope roundtrip 成功，且能刷新 L1。
   flags: `ff.market.install.claude`. ([Claude][9])

5. **Week 5 [P0]**
   打通 OpenClaw 写路径。
   验收: 1 个 native plugin + 1 个 Claude bundle 安装成功，doctor 正确标 detect-only / unsupported，uninstall 可回滚。
   flags: `ff.market.install.openclaw`, `ff.market.bundle.mapping`. ([OpenClaw][5])

6. **Week 6 [P1]**
   接入 Codex private/local adapter。
   验收: 能生成 repo/personal marketplace JSON，并在 Codex 侧可见；回滚方式是移除 entry / disable / restart。
   flags: `ff.market.install.codex_local`, `ff.market.handoff.codex`. ([OpenAI开发者][2])

7. **Week 7 [P1]**
   接入 OpenAI runtime Connect flow。
   验收: 能 attach connector 或 remote MCP，记录 approval / allowed_tools / unbind。
   flags: `ff.market.runtime.openai_connectors`. ([OpenAI开发者][3])

8. **Week 8 [P2]**
   做 hardening、kill switch、审计日志，外加 Antigravity lab。
   验收: Antigravity 只提供 skill/MCP handoff，不承诺 marketplace parity；若官方文档仍不完整，默认关闭。
   flags: `ff.market.antigravity_lab`, `ff.market.audit`, `ff.market.kill_switch`. ([Google Antigravity][10])

## 风险假设

* [P0] **Antigravity 现在不应被当成“已完成 schema 对齐”的正式生态。**
  我能确认的是 skill folder + `SKILL.md`，以及 MCP 安装/auth UI；但我没在官方域里找到公开 marketplace schema 或 publish/install API 页面。我的建议是: Phase 1 不承诺 parity，只做 `skills + MCP handoff`。 ([Google Antigravity][10])

* [P1] **Codex 可能未来会暴露更深的 client automation，但当前文档里我只看到 discovery/read/state/config 相关 RPC。**
  目前能确认的是 `plugin/list`、`plugin/read`、`app/list`、`skills/config/write`、`mcpServer/oauth/login`；我没看到公开的 plugin install write RPC 文档。所以我会把 Codex 放在“读 + handoff + local/private emit”的 lane。 ([OpenAI开发者][15])

* [P1] **公共商店发布这件事，短期内不要承诺 one-click cross-publish。**
  Codex 官方公共发布未开，Anthropic 官方 marketplace 走表单，只有 OpenClaw 这边有比较完整的 registry CLI。你们现在应该把“公共商店发布”当 Phase 2+。 ([OpenAI开发者][2])

### 不可统一项清单

* [P0] **`installable artifact` 和 `runtime binding` 不能强行统一。**
  OpenAI API connectors / remote MCP 是 attach；Codex / Claude / OpenClaw 主体是 install。 ([OpenAI开发者][3])

* [P0] **“谁定义最终能力”不能统一。**
  Claude 有 `strict`，OpenClaw 有 detect-only，OpenAI 有 runtime-discovered tools，Codex 还有 setup/auth 变量。L1 必须晚于安装/挂载生成。 ([Claude][4])

* [P0] **`apps/connectors`、`MCP`、`native plugin capability` 不能归成同一个 `tool` 桶。**
  Codex apps、OpenAI connectors、OpenClaw native channels/providers/tools、Antigravity MCP，本质上不是一回事。 ([OpenAI开发者][1])

* [P1] **授权时机不能统一。**
  install-time、first-use、per-request approval、UI prompt onboarding 必须是不同状态机。 ([OpenAI开发者][1])

* [P1] **scope / restart 模型不能统一。**
  Claude 有 user/project/local；Codex 有 repo/personal + enabled flag；OpenClaw 需要 gateway restart；OpenAI runtime attach 没有安装 scope。 ([Claude][9])

一句话北极星: 先把 **`skills + MCP`** 做成跨生态共通底盘，把 **apps/connectors/native capabilities** 明确放进生态特化层。这样 F146 会先落地，再长翅膀。

[1]: https://developers.openai.com/codex/plugins "https://developers.openai.com/codex/plugins"
[2]: https://developers.openai.com/codex/plugins/build "https://developers.openai.com/codex/plugins/build"
[3]: https://developers.openai.com/api/docs/guides/tools-connectors-mcp "https://developers.openai.com/api/docs/guides/tools-connectors-mcp"
[4]: https://code.claude.com/docs/en/plugin-marketplaces "https://code.claude.com/docs/en/plugin-marketplaces"
[5]: https://docs.openclaw.ai/plugins/bundles "https://docs.openclaw.ai/plugins/bundles"
[6]: https://docs.openclaw.ai/tools/clawhub "https://docs.openclaw.ai/tools/clawhub"
[7]: https://docs.openclaw.ai/cli/plugins "https://docs.openclaw.ai/cli/plugins"
[8]: https://docs.openclaw.ai/plugins/manifest "https://docs.openclaw.ai/plugins/manifest"
[9]: https://code.claude.com/docs/en/plugins-reference "https://code.claude.com/docs/en/plugins-reference"
[10]: https://antigravity.google/docs/skills "https://antigravity.google/docs/skills"
[11]: https://antigravity.google/docs/mcp "https://antigravity.google/docs/mcp"
[12]: https://code.claude.com/docs/en/discover-plugins "https://code.claude.com/docs/en/discover-plugins"
[13]: https://antigravity.google/ "https://antigravity.google/"
[14]: https://docs.openclaw.ai/plugins/sdk-setup "https://docs.openclaw.ai/plugins/sdk-setup"
[15]: https://developers.openai.com/codex/app-server/ "https://developers.openai.com/codex/app-server/"

## Part 3: 本地综合结论（布偶猫 + 缅因猫）

> 撰写：布偶猫（@opus） | 审阅：缅因猫（@codex） | 日期：2026-03-28

### 一句话结论

云端架构建议 70% 有价值、30% 带偏（因不了解我们项目）。可采纳项已硬化进 F146 spec；不可采纳项明确拒绝并记录理由。

### 采纳项（已回写 F146）

| # | 云端建议 | 采纳方式 | 落盘位置 |
|---|---------|---------|---------|
| 1 | L3 三分状态模型（catalog_cache / install_lock / binding_state） | 写入 F146 “L3 内部状态模型”节 | F146 § What |
| 2 | install preview dry-run | 融入 Phase A，新增 AC-A6 | F146 § Phase A + AC |
| 3 | 五条供应链硬门禁 | 写入 Phase C，新增 AC-C5/C-C6 | F146 § Phase C |
| 4 | “菜单不是上菜记录”原则 | 已有 KD-2（L1 唯一真相源），云端具体化了边界 | F146 § KD-2 |
| 5 | 最小公共交集 = skills + MCP | 与我们自己的判断一致，作为 Phase B MVP 范围约束 | F146 § Phase B |
| 6 | 跨生态字段对照矩阵 | 作为 Phase R 产出参考（AC-R1/R3），8 个 required 字段合理 | 本文 Part 2 |
| 7 | 不可统一项清单 | 直接采纳为 F146 设计约束 | 本文 Part 2 |
| 8 | “Claude marketplace 格式喂双生态”杠杆 | 作为 Phase B 实施建议（待验证） | 本文 Part 2 |

### 不采纳项（已明确拒绝）

| # | 云端建议 | 拒绝理由 |
|---|---------|---------|
| 1 | Phase 切分：先只读聚合再写路径 | 铲屎官原始痛点是”不要手改 JSON”。先做 catalog 展示但安装还是手改 = 零价值。保持 KD-3：写路径优先 |
| 2 | Antigravity 降级为 Week 8 lab | 云端不知道我们有 pencil（每天使用的 Antigravity 生态）。F145 专门做了 pencil resolver。保持 KD-5：首期必做 |
| 3 | OpenAI Runtime Connect 作为 P1 | 我们的猫不直接用 OpenAI API connectors。保持 KD-6：降为 P2 |
| 4 | L2 依赖按”能力类”拆四类 | 我们的 `requires_mcp` 已按 MCP ID 声明，manifest.yaml 里 skill/mcp 本就分开。MVP 阶段过度设计 |
| 5 | 8 周执行计划直接套用 | 云端假设全职投入；我们多猫共享时间。参考节奏但不直接套用 |

### Phase R AC 覆盖检查

| AC | 状态 | 证据 |
|----|------|------|
| AC-R1: 四方 schema 对照表 | ✅ | Part 2 “跨生态字段对照矩阵”（10 字段 × 4 生态） |
| AC-R2: 三类能力边界 | ✅ | Part 2 § 4 “可自动安装 / 需人工确认 / 仅可发现” |
| AC-R3: 统一 adapter 最小字段集 | ✅ | Part 2：8 个 required（ecosystem / artifact_id / display_name / source_locator / component_summary / install_mode / auth_mode / trust） |
| AC-R4: 先做/后做/不做 | ✅ | 见下方 |
| AC-R5: URL 验真 | ✅ | Part 2 § “先验真这 6 个 URL”，6/6 可访问且内容匹配 |

### 先做 / 后做 / 不做

**先做（Phase A 范围）：**
- 能力中心 MCP 写路径（CRUD API + install preview + 并发安全）
- 浏览器三后端验证场景（agent-browser / pinchtab / claude-in-chrome）
- 审计日志

**后做（Phase B-D 范围）：**
- Marketplace catalog 聚合（四生态 discovery）
- Antigravity discovery + pencil resolver 一致性
- 供应链治理 + 版本锁
- Skills 页 missing → 补齐联动

**不做（本 feature 明确排除）：**
- 统一公共发布 API（各家不对称，不可强行统一）
- OpenAI Runtime Connect 作为首期（P2，可后续追加）
- L2 依赖类型拆四类（现有 requires_mcp 已够用）
- install-time scripts 自动执行（永久默认 deny）

### 安全门禁最小集（首期硬性）

1. **版本不可变 pin** — promotion 到 stable 时必须 exact version / sha / digest
2. **安装来源路径边界** — 白名单源 + 禁止危险 path spec（../）
3. **禁止 install-time scripts** — npm `--ignore-scripts` 默认开启
4. **schema validation 先于执行** — manifest 解析失败 = 不安装
5. **声明态 vs 实测态 diff gate** — probe 失败不得标 ready

### 两张分离表（砚砚补充，Phase R 收口时必做）

**表 A：可统一的 UX 五步流程**

| 步骤 | 说明 | 所有生态一致 |
|------|------|-------------|
| Discover | 搜索 / 浏览 marketplace | ✅ |
| Inspect | 查看 metadata / trust / 组件摘要 | ✅ |
| Install / Attach | 执行安装或运行时绑定 | ✅（UI 一致） |
| Authenticate | 按需完成 OAuth / approval | ✅（UI 一致） |
| Verify | mcp:doctor 探测 + L1 回写 | ✅ |

**表 B：不可统一的后端语义**

| 维度 | 差异 | 处理方式 |
|------|------|---------|
| install 类型 | package install vs runtime attach vs handoff | 3 个 adapter 分别处理 |
| auth 时机 | install-time / first-use / per-request / UI prompt | `auth_timing` 枚举，不统一为单一 OAuth 对象 |
| scope 模型 | user/project/local vs repo/personal vs workspace+restart vs 无 scope | 每个 adapter 独立映射 |
| “谁定义最终能力” | strict / detect-only / runtime-discovered / setup-dependent | L1 只记录 probe 后的实测结果 |
| restart 需求 | 无 / gateway restart / CLI reload | 安装后显式告知用户 |

### 下一步

Phase R 已收口。F146 可以进入 Phase A 实施计划阶段。

建议执行顺序：
1. 布偶猫写 Phase A 实施计划（writing-plans）
2. 开 worktree 实现写 API + Hub UI
3. 用浏览器三后端作为验证场景通过 AC-A1 ~ A6
