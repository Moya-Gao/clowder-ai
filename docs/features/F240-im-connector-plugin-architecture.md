---
feature_ids: [F240]
related_features: [F202, F088, F124, F190, F142, F032, F237]
topics: [im-connector, plugin-architecture, yaml-manifest, connector-config, hub-ui, external-plugin, intake, community]
doc_kind: spec
created: 2026-06-17
---

# F240: IM Connector Plugin Architecture — 社区 PR #903 Intake

> **Status**: direction-accepted (CVO 2026-06-17 signoff 锚点纠正 F230/F231→F240) — review-in-progress / awaiting-author-fix | **Owner**: community @mindfn + cat-cafe maintainers (intake review) | **Priority**: P1 | **Created**: 2026-06-17

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

## PR 实际交付物

- 统一 `IMConnectorPlugin` 接口（`im-connector-plugin.ts`），7 个内置 connector（feishu/telegram/dingtalk/weixin/wecom-bot/wecom-agent/xiaoyi）迁到 `im-connectors/<id>/` + `connector.yaml`
- YAML manifest：config fields / setup steps / icon / themeColor / action chains
- 配置持久化 store（`.cat-cafe/im-connector-config/<id>.json`），三层解析 **stored > env(只读 fallback) > YAML default** + tombstone
- Hub UI 写端点 `PUT /api/connectors/:id/config` + action 状态机（YAML 声明 chain + `handleAction()` + 通用 endpoint，前端纯渲染器）
- 外部 tar.gz 插件 install/update/uninstall（`plugins/plugin-installer.ts` + `routes/connector-plugins.ts`）+ icon proxy
- config-field 类型系统（`shared/src/types/config-field.ts`）F202 plugin 与 IM connector 共用

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
