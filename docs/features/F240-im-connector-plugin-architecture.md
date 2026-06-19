---
feature_ids: [F240]
related_features: [F202, F088, F124, F190, F142, F032, F237]
topics: [im-connector, plugin-architecture, yaml-manifest, connector-config, hub-ui, external-plugin, intake, community]
doc_kind: spec
created: 2026-06-17
---

# F240: IM Connector Plugin Architecture — 社区 PR #903 Intake

> **Status**: merged-to-clowder (2026-06-19 squash `40d38c18e628`) → **absorbed-to-cat-cafe** (PR cat-cafe#2420 squash `8f05de13`; follow-up cat-cafe#2423) | **Owner**: community @mindfn + cat-cafe maintainers (intake) | **Priority**: P1 | **Created**: 2026-06-17

## Provenance

- **Community PR**: [clowder-ai#903](https://github.com/zts212653/clowder-ai/pull/903) — `feat(F231): IM connector plugins — YAML config, Hub UI, install lifecycle`
- **Feature issue**: [clowder-ai#907](https://github.com/zts212653/clowder-ai/issues/907) — `IM Connector Plugin Architecture`（作者自提，OPEN，无 triage label）
- **关联 bug**: [clowder-ai#925](https://github.com/zts212653/clowder-ai/issues/925) — weixin 每条入站处理两遍（独立可先合，见下）
- **作者**: `@mindfn`（lang，`authorAssociation=COLLABORATOR`，与 F202/F204/F205/F237 同贡献者）。他们 fork 内部也有 opus/codex/宪宪 命名重合的猫，**非 cat-cafe 家里的猫**（#925 body 的 "调查 by 宪宪" 是他们 fork 的平行猫）。
- **PR scope**: 120 文件 / +13499 / -3580 / `MERGEABLE` / `reviewDecision=CHANGES_REQUESTED`（not draft）。CI 全绿。

## 编号纠错背景（认知投毒预防 — F路徑 rule 19 / Feat Anchor Guard）

| 编号 | 家里 main 上是什么 | PR 里是什么 |
|---|---|---|
| **F230** | `claude-interactive-pty-carrier`（救宪宪 Plan B，宪宪 Fable-5 owned，in-progress） | PR branch 名 `feat/f230-im-connector-plugin` + diff 残留 |
| **F231** | `user-profile-capsule`（启动胶囊，宪宪 owned，in-progress，CVO 2026-06-11 签字） | PR title/body/docs 写的 F231（撞了） |
| **F240** | **本 intake doc** ✅ | — |

时间线：维护者账号 `zts212653` 早先 `CHANGES_REQUESTED` 卡在 provenance 层、点名 F230 撞号；作者把 F230→F231，**只是换了个新撞号没真修**（F231 在家里已是启动胶囊）。`docs/features/F231-im-connector-plugin-architecture.md`（PR 引用的 spec 路径）**在 cat-cafe main 不存在**。F240 正式归属本 intake，CVO 2026-06-17 signoff。

> **systemic 信号**：lang fork 的 feat 编号已与我们 fork（F202 对、F231 错）。是否给社区 feature 独立命名空间（`CF-xxx`）或共享 registry，待 CVO 单独拍板（与 F237 同类风险）。

## Why（社区方向 + 内部价值）

社区 issue #907 痛点：内网/社区团队无法在不改核心代码的情况下加 IM connector；配置散落 `.env`，无法 Hub UI 管理；前端卡片硬编码，外部 connector 无法复用 QR/权限/心跳。**终态**：connector 交互由 YAML 声明驱动，前端纯状态机渲染器；外部团队打包 tar.gz → Hub 上传 → 自动注册/配置/渲染，零核心代码修改。

方向**有价值且对齐** F088/F124（connector runtime）+ F202（plugin framework）+ F190（connector 配置写安全）。我们家里目前**没有** IM connector 插件化（`packages/api/src/infrastructure/connectors` 是硬编码 adapter + `connector-gateway-bootstrap`），所以这是 net-new 能力填空，不是重复。

## 架构（真实设计 — intake 自 #903 实现 + 作者 @mindfn spec,品牌/归因已校正）

> 来源:clowder-ai#903 实现 + 作者 spec（社区 fork）。spec 里的"铲屎官原话"出自**社区 fork 的 CVO（lang）**,非 Cat Café CVO（Landy）——此处只取技术设计,不转述为家里铲屎官原话（防 provenance 投毒）。

**Architecture cell**: `connector` + `plugin`（KD-15:统一 ConfigField 类型跨两 cell）。把 F088 的 hardcoded adapter switch-case 改为 **YAML 驱动注册表**:接口契约 / 配置持久化 / 前端渲染 / 交互动作全由 YAML 清单声明,前端退化为纯状态机渲染器。

**解决 F088 四个痛点**:
1. **硬编码耦合**:`connector-gateway-bootstrap` switch-case 管 connector,新增必改核心 → YAML 注册表
2. **无法外部扩展**:内网用户想对接只能 fork 改代码 → tar.gz 插件包安装(安装包用户无 node 环境也能装)
3. **配置散落 .env**:IM connector 凭证无法 Hub UI 配置/持久化 → config store 三层解析
4. **前端硬编码**:卡片 / icon / QR 扫码 / 权限 / 心跳 per-connector 硬编码 → YAML 声明 + 共享渲染器

### Phase A（#903 已实现）:YAML 驱动闭环 — 接口 + 配置 + 前端 + Action 状态机

**A-1 后端基础**:每 connector 一份 `connector.yaml`(id/name/config/docsUrl/steps/icon/themeColor);config store `.cat-cafe/im-connector-config/{id}.json`;三层解析 **stored(Hub 写入) > env(.env 兼容 fallback) > YAML default**;Hub `PUT /api/connectors/:id/config`;bootstrap 扫 YAML + 加载 config 驱动 `pluginEnv`;`CONNECTOR_PLATFORMS` 从 YAML 动态派生(消除重复定义)。

**A-2 统一 ConfigField 类型系统**(KD-15/17/18) — **F202 plugin 与 F240 IM connector 共用**同一套类型 + 解析器:

| type | 用途 | env-backed |
|---|---|---|
| `input` | 文本/密码(sensitive→password) | ✅ envName |
| `toggle` | 布尔开关 | ✅ |
| `select` | 下拉(options) | ✅ |
| `list` | 列表值(JSON 序列化数组) | ✅ |
| `operation` | action 驱动的操作字段 | ❌(有 `name`,走独立 operation state) |

- **KD-17 类型分离铁律**:所有 env-backed 路径(config store 读/写/加载、resolve、bootstrap isConfigured)只操作 `ValueConfigField[]`(`filter(isValueField)`);`operation` 永不进 env 持久化/解析链。
- **KD-18 Value Codec**:store 层是 `Record<string,string|null>`,typed 值经 string codec 序列化(toggle `"true"`/`"false"`、list JSON `'["a","b"]'`、select option value);容错不 throw(非法值 fallback default)。codec 前后端共用。
- 共享解析器 `config-field-parser.ts`(无 `type` fallback 到 `input`);`plugin-manifest.ts` + `im-connector-manifest.ts` 都 import。

**A-3 YAML Action 状态机 + 通用端点**(KD-13/14):
- **action 状态(持久化,用户能做什么)≠ 连接状态(运行时 health check)**,两者独立(KD-13)。
- **operation 是独立字段**(有 `name` 无 `envName`,KD-14);action 成功后经 `target` 回填到指定 input 字段。
- YAML 声明 **action chain(状态机)**:如 QR `qr-generate → qr-status → disconnect → (回)qr-generate`,每个 action 带 `render`(button/polling)、`resultRender`(img)、`timeout`、`rollback`(超时回滚边)、`next`(转移边)。插件实现 `handleAction()`,通用路由 `{pluginId}/actions` 委托;前端读 YAML 知节点+转移边、读 API 知当前状态,按 render 类型渲染控件。**零硬编码。**

### Phase B（#903 已实现）:外部插件动态安装
- 自包含 **tar.gz 包**(`connector.yaml` + `index.js`,default export `IMConnectorPlugin`);`plugin-installer.ts` install/update/uninstall;Hub UI 上传;`im-connector-loader` 动态 `import()` 进 API 进程。
- **安全闸**(intake 已逐条核实,见决策记录 2026-06-18 第四轮):owner-gate(`requireConfiguredOwner` fail-closed)+ CSRF(`isOriginAllowed` same-origin,排除 `PRIVATE_NETWORK_ORIGIN`)+ symlink manifest 拒绝 + `realpathSync` 路径边界 + unloaded plugin fail-closed + 文件大小限。
- **信任边界结论**:认证 operator 上传插件 ≈ 自己跑 risky skill/MCP/CLI(同一信任类,非新攻击面);签名校验 defer 到"运营插件市场"阶段(防不可信分发)。

### 核心接口（真实代码,intake 落地 `im-connectors/`）
- `im-connector-plugin.ts` — 统一 `IMConnectorPlugin` 接口(setup/startInbound/handleAction/createMediaDownloader 等)
- 7 个内置 connector 迁到 `im-connectors/{feishu,telegram,dingtalk,weixin,wecom-bot,wecom-agent,xiaoyi}/`(`*Adapter.ts` + `index.ts` + `connector.yaml`)
- `im-connector-loader.ts` / `im-connector-config-store.ts` / `connector-action-handler.ts` / `external-connector-registry.ts` / `plugins/{im-connector-manifest,plugin-installer}.ts`

### 与家里 feature 关系
- **F088/F124**:connector runtime/transport(被本架构复用;adapter 从 `connectors/adapters/` 迁 `im-connectors/`)
- **F202**:plugin framework(共用 ConfigField 类型 + config store 模式;KD-15 跨 cell)
- **F190**:connector 配置写安全 boundary(本架构写端点须继承 sessionUserId/owner/redaction/audit)
- **F142**:connector slash commands(并存)

## Blocking / Open Questions（intake 前必须解决）

1. **🟢 RCE 外部插件信任边界（resolving — operator-trust 模型接受，2 条件待补）**
   - 机制：上传 tar.gz → 解出 `index.js`（`IMConnectorPlugin` default export）→ `im-connector-loader` 动态 `import()` 进 API 进程**同权运行**。
   - 已有 guard（competent）：`isValidConnectorId` 防遍历、`realpathSync`、`requireSessionIdentity`（session cookie）、文件大小限、tar 解 temp 再 rename。
   - **作者 吴浪（@mindfn）2026-06-17 反驳（成立）**：认证 operator 上传风险 connector package ≈ 他自己装风险 skill / 配置风险 MCP / 跑风险 CLI —— **同一信任类，不是新攻击面**；sandbox 当前阶段非必须；签名校验留到运营**插件市场**阶段（防不可信分发）才需要。这与家规 `empirical_capability_over_first_principles`（demonstrated operator-trust 模型 > first-principles caution）一致。**我方收回"defer 整个外部安装器"。**
   - **但他的论证有两个载重假设，是接受它的前提条件（merge AC）**：
     - **① owner-gate**：install 端点当前 `requireSessionIdentity` 只要 *一个* session，**未见 owner 匹配**（对比 `capabilities.ts` 的 `requireConfiguredOwner: true`）。单用户部署无碍；任何共享/多用户部署下，任意登录 session 都能装同权执行插件 → 须 owner-gate + fail-closed。
     - **② CSRF**：cookie-authed POST 触发代码安装，是 CSRF 可达向量；而"本地改 skill 文件"不是 —— 这是 operator-trust 等价论证**唯一的缺口**（投递向量 ≠ 内容信任）。须确认 session 层是否强制 same-origin；否则补 origin check / CSRF token。
   - **作者自指方向对**：现在该 harden 的是 interface I/O + manifest schema 校验（action 输入 / config field 值 / manifest 结构防崩溃-提权），不是 sandbox 代码。
   - **签名 → marketplace 阶段**：同意 defer，但**显式记录为分阶段决策**（别静默跳过，marketplace 启动时必做）。
   - **处置**：决策 converging（CVO 待 final concur）。接受 operator-trust，外部安装器可当前阶段落地，gated on 条件 ①② + 数据校验。

2. **🔴 夹带 5 个 out-of-scope P1 回归（必须剥离）**
   - 云端 Codex 在非 IM connector 文件标 P1：`opencode-event-transform.ts:101`（drop opencode step-finish usage）、`invoke-single-cat.ts:2341/1983/2072`（usage/agent_loop seal/unknown-model context fallback）、`context-window-sizes.ts:33`（provider-prefixed model 归一化）。
   - 疑似 revert clowder#915 的 OpenCode handoff/context-window 修复。**与 IM connector 无关，lang 的连接器 happy-path 验证测不到**（教训 `alpha_smoke_happy_path_blindspot`）。
   - **处置**：从 PR 剥离这坨 OpenCode 改动，让连接器 PR 干净。

3. **🟡 架构不够优雅：平行插件栈 vs F202 统一**
   - PR 新建 `im-connector-config-store`/`im-connector-manifest`/`plugins/plugin-installer`/`im-connector-loader`，**同时**又改 F202 `PluginRegistry`/`plugin-manifest` —— 两个注册表都要维护的 hybrid。
   - **更优雅**：IM connector 作为 **F202 的一种 resource kind**，install/trust/lifecycle/audit 全归 F202 一套，connector 域只消费注册出的 connector resource。
   - 配置写要继承 **F190 已建的 auth boundary**（sessionUserId/fail-closed 403/redaction/audit），确认 `requireSessionIdentity` 是同一套不是另起炉灶。

4. **🟡 accepted issue gate**：#907 作者自提、无 triage/类型 label；#925 仅 `bug` label。intake 前需补 triage。

## 可独立先合：#925 weixin 去重 bugfix

- 根因（issue 已诊断）：长轮询重投 + `WeixinAdapter` 兜底 messageId 用 `weixin-${Date.now()}-${Math.random()}` 随机生成 → `InboundMessageDedup` key 不一致 → 漏判 → 二次处理。
- PR 的修复**已确认干净正确**：随机兜底 → `sha256(senderId\0create_time_ms\0contentPrefix)` 确定性派生，重投得相同 id → 去重生效。
- **注意**：PR 把 `WeixinAdapter` 从 `adapters/` 移到 `im-connectors/weixin/`，独立 intake #925 需 **re-path 到当前 main 的 `adapters/WeixinAdapter.ts`**（不跟随连接器重构）。

## Intake 预判

`absorbed + manual-port / high-risk`（非 public-only）。涉及 routes 注册、gateway bootstrap、config store、shared types、web settings、**动态代码加载**。整体合入需建 Intake Intent Issue 逐文件决策 + security/design review。**当前合理动作**：不 intake 整个 PR；先 intake #925（独立 bugfix），架构部分按 F240 正确锚点 + F202 统一思路、剥离污染后分小步做。

## 决策记录

- 2026-06-17 CVO signoff F240 锚点（纠正 F230/F231 撞号），confirm「ok」。
- 2026-06-17 CVO 将 RCE 边界决策委托 maintainer 猫提给对方铲屎官权衡（"他们的铲屎官更懂这些"）。
- 2026-06-17 作者 rebase 后 re-review（PR head 缩到 109 文件 / +12596，CI 全绿）。**4 个主要点全部响应**：✅ F240 re-anchor（title/body/doc）✅ strip OpenCode .ts ✅ split weixin #925 ✅ reject redacted action credentials。
  - **🔴 残留 P1（实锤 "revert #915" 怀疑）**：strip 不彻底 —— `cat-template.json:735` 仍把 OpenCode `features.sessionChain` 关成 false + 本 PR **删除了 clowder#915 守护测试**（`it('opencode breed has sessionChain enabled ...')`，diff ~L7804）。后果：新 OpenCode 猫 context-fill handoff 不触发。要求恢复 sessionChain + 保留测试。
  - **🟡 2 个 auth 条件仍未做**：install 端点只有 `requireSessionIdentity`，无 owner-gate（对比 `capabilities.ts` requireConfiguredOwner）、无 CSRF/origin 校验。已作为外部安装器 merge 前置提给作者。
  - re-review 已发 PR comment（issuecomment-4732076189）；verdict = 结构性 blocker 已清、剩 🔴P1 必修 + 🟡 两条件，修完再过一遍。
- 2026-06-17/18 作者第二轮修复 → **第三轮 re-review：三个 blocking 全部解除（均带测试，CI 绿）**：
  - ✅ 🔴 P1：`cat-template.json` 不再关 sessionChain + clowder#915 守护测试恢复（`test('opencode breed has sessionChain enabled')`）→ #915 回归清除。
  - ✅ 🟡 CSRF：`trustedPluginWriteOrigins()` 强制 same-origin（排除 `PRIVATE_NETWORK_ORIGIN`）+ 403 + 测试。
  - ✅ 🟡 owner-gate：`requireConfiguredOwner: true` + fail-closed `DEFAULT_OWNER_USER_ID` + 测试。
  - 额外：symlink manifest 拒绝 / `realpathSync` 路径边界 / unloaded plugin fail-closed。
  - **零 P1 剩余**，只剩一组 cloud Codex P2（unauth list / ActionRenderer / gateway 注册），非 merge blocker。
  - **上游 maintainer review 立场：blocking 项全部解除**（PR issuecomment-4738920086）。stale provenance `CHANGES_REQUESTED`（F230 撞号）可 dismiss。
  - **待 CVO**：merge 进 clowder-ai = feature 级决策；merge 后 F240 intake（manual-port + Intake Intent Issue）是独立下游步骤。
- 2026-06-18 **第四轮 = P2 cluster 代码级核实（clone PR head 7b1f225 逐条读代码,非转述 Codex comment）**：
  - 7 个 live P2(WeCom stop handle/streaming hook、activation 失败返回、/test 读 config store、QR timeout rollback 持久化、Node20 ESM plugin、operations 渲染位置)**逐条核实代码已全修**;Codex comment threads 只是没标 resolved。另抽查 2 个旧轮 finding(default-cat 动态解析、activation 后全量清缓存)也已修。
  - **教训**:reviewer 不能只看别的 reviewer 的 comment 状态,要自己核代码 —— "comment 没 resolved" ≠ "没修"(铲屎官当轮纠正)。
  - **零开放 P2、零 P1、CI 全绿**。提交 formal APPROVE(上游 maintainer review)→ `reviewDecision: APPROVED`、`MERGEABLE`。
  - **Status → merge-ready**:merge 触发权归 CVO(feature 级);merge 后 F240 intake 独立步骤。
- 2026-06-19 **CVO 授权 merge + 走 intake**。Review continuity guard 拦下 head 偷移(7b1f225→37366ef9 = 纯 main-catch-up 带入 #962/F228,PR 净 diff 抵消为零、connector 代码逐字节未变)→ continuity re-approve → **squash --admin merged**(clowder-ai main `40d38c18e628`,title 干净)。
- 2026-06-19 **B3 Intake 启动**(铲屎官重度警告 intake 易错,严格按 SOP):
  - Step 1 plan:111 文件(脚本标 101 safe / 5 high-risk / 3 manual / 2 skip)。
  - **Overlap reality-check 推翻脚本乐观**:① `im-connectors/` 净新增(安全)② 旧 `adapters/` 仍在 → 是**移位**,须删旧+改引用(非单纯 cherry-pick)③ `ConnectorRouter`/`connector-gateway-bootstrap` cat-cafe 6-12(bd03244a6)独立演化 → **overlap 强制 manual-port** ④ F240 doc 冲突(skip 他的、保本 intake doc)。
  - **Intake Intent Issue: cat-cafe#2412**(含逐文件决策表 + 三真相 + 上述风险)。
  - 下一阶段(多轮):worktree replay(保 home invariant)→ `pnpm gate` → 跨族 reviewer 按 #2412 验收 → record+advance ledger → merge absorb PR + close #2412。
- 2026-06-19 **cat-cafe absorb PR merged**:PR cat-cafe#2420 `intake(F240): absorb IM connector plugin architecture` squash merged to main as `8f05de13` after Opus 4.6 independent cutoff APPROVE. `pnpm gate` PASS at `f304c52fd`, GitHub Brand Boundary Guard PASS, mergeState CLEAN/MERGEABLE. Cloud rounds 1-5 real P1/P2 findings fixed; round 6 sole live P2(Weixin media fallback `localhost:3004`) accepted as non-blocking follow-up issue cat-cafe#2423.
- 2026-06-19 **🛡 愿景守护 ACCEPT（宪宪 opus-48,非作者非 reviewer,亲核 merged main 不转述)**：
  - ✅ merge `8f05de13` + doc sync `ed4d2770` 在 main;im-connectors/ 28 文件在、旧 `adapters/` 0 残留(移位完成)、无 live import 残留;插件核心在。
  - ✅ **架构真接入 runtime(非死文件)**:`connector-gateway-bootstrap.ts` L496/503-504 真 call `loadBuiltinConnectors`+`loadInstalledPlugins`、L1084 `pluginRegistry: plugins`。
  - ✅ Brand Guard 干净(merged 连接器代码无 clowder 污染);✅ **API 包(shared+api tsc)在 merged main 编译通过**(功能性确认)。
  - ✅ #2412 Intake Intent CLOSED;✅ #2423 follow-up 足够承接 non-blocking P2(Weixin 动态端口 + connector-hub 拆分,含 AC),已补 `enhancement` label。
  - **终态判定:符合"社区 IM connector plugin architecture 回家"。F240 intake = ACCEPTED / 闭环完成。** 余项仅 #2423(独立 enhancement,不阻塞)。
