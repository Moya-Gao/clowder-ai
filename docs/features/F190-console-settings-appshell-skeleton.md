---
feature_ids: [F190]
related_features: [F056, F063, F116, F183, F184, F195]
topics: [console, settings, app-shell, community, inbound-pr, frontend, service-manifest]
doc_kind: spec
created: 2026-05-07
community_pr: clowder-ai#645, clowder-ai#662, clowder-ai#669
---

# F190: Console Settings/AppShell Skeleton — 社区 Console 重构的可控切片

> **Status**: done (Phase F auditing) | **Completed**: 2026-05-13 | **Owner**: Community + Maintainers | **Priority**: P1

## Why

社区 PR [clowder-ai#645](https://github.com/zts212653/clowder-ai/pull/645) 提供了一个有价值的方向：把旧 Hub/modal 式配置入口升级为 macOS System Settings 风格的 Console/AppShell + Settings rail，并附带 Pencil 设计稿。

但 #645 当前把 Settings shell、Service Manifest、voice refAudio、MCP 管理、IM 配置、Mission Hub 改造、F183/F184 敏感聊天渲染链路、以及 feature 编号迁移混在一个大 PR 中。即使 CI 变绿，仍然不可作为 merge candidate。F190 的目标是把其中**用户可感知且方向正确的 Console/Settings skeleton**提炼成可 review、可回滚、不会覆盖家里 invariants 的第一片。

## What

Architecture cell: action-plane
Map delta: none — F190 只把现有 settings/action surfaces 收口到 Console；Service Manifest 第一刀是 read-only visibility surface，不建立新的 lifecycle owner。
Why: service lifecycle 的 start/stop/install/uninstall 仍 deferred；本 slice 不新增外部动作执行器、资源句柄或并行 registry truth source。

### Phase A: Settings/AppShell Skeleton

从最新 `clowder-ai main` 开新 PR，只提交 Console/Settings 的最小骨架：

- AppShell / Activity Rail 基础布局
- `/settings` route
- Settings 左侧导航与空态/占位内容
- Console 设计 tokens / CSS 基础
- Pencil 设计稿与设计系统文档

明确不迁移旧 Hub 各 tab 的业务逻辑，不接 Service Manifest，不接 voice refAudio，不改聊天渲染链路。

### Phase B: Settings Section Migrations

在 Phase A 合入并稳定后，再按 section 拆分小 PR 迁移实际内容。每个 section PR 必须有独立测试与手工 alpha 走查证据。

### Phase C: Follow-up Systems

Service Manifest、MCP install/manage 写接口、voice refAudio upload、IM connector write endpoints 等属于 F190 后续高风险 slice，不并入 Phase A，也不得夹带进普通 settings section migration。

## Current Intake Snapshot

| Slice | Source | 家里状态 | 口径 |
|-------|--------|----------|------|
| AppShell / ActivityBar / Settings skeleton | clowder-ai#662 | 已合入 main | Phase A |
| Rules/SOP settings | clowder-ai#669 | 已合入 main via cat-cafe#1650 | read-only |
| Ops subtabs | clowder-ai#669 | 已合入 main via cat-cafe#1650 | wrapper + existing panels |
| Marketplace settings | clowder-ai#669 | 已合入 main via cat-cafe#1650 | existing marketplace panel |
| MCP settings entry | clowder-ai#669 | 已合入 main via cat-cafe#1650 | read-only capability board filter；不接写接口 |
| Skill preview modal | clowder-ai#669 | 已合入 main via cat-cafe#1650 | read-only `SKILL.md` preview |
| MCP install/manage write path hardening | clowder-ai#669 + home F146/F193 route | 已合入 main via cat-cafe#1651 | owner-gated secret write hardening；不接 Plugins UI 写回 |
| Service Manifest read-only status | clowder-ai#669 | 已合入 main via cat-cafe#1652 | auth-gated manifest/status/endpoints；不接 lifecycle writes |
| Service lifecycle writes | clowder-ai#669 | deferred | start/stop/install/uninstall 需要独立 runtime source + security review |
| refAudio upload | clowder-ai#669 + home F103/F195 boundary | 已合入 main via cat-cafe#1654 | auth-gated multipart upload + `/uploads` path resolver；不接 F195 meeting audio runtime |
| IM connector write | clowder-ai#669 + home F132/F134/F136/F137 routes | 已合入 main via cat-cafe#1655 | harden existing credential writes；不新增 callback URL / provider endpoint 写面 |
| Chat rendering / bubble behavior | clowder-ai#669 | not in F190 | F183/F184/F194 ownership；F190 不触碰 |

Phase C complete: all four high-risk slices (MCP write / Service Manifest read-only / refAudio upload / IM connector write) merged to main. AC-A7 alpha walkthrough completed via Codex + Sonnet smoke on PR #1658.

## Acceptance Criteria

### Phase A（Settings/AppShell Skeleton）
- [x] AC-A1: `clowder-ai#645` 标记为 prototype/reference，不作为 merge candidate；新的 skeleton PR 从最新 `clowder-ai main` 创建。
- [x] AC-A2: 新 PR 只包含 Settings/AppShell skeleton、设计 token、Pencil/design docs；不得迁移 Service Manifest、voice refAudio、IM write endpoints、Mission Hub parity 等业务逻辑。
- [x] AC-A3: 新 PR diff 不包含 F183/F184 敏感路径：
  - `packages/web/src/components/ChatMessage.tsx`
  - `packages/web/src/components/ChatContainer.tsx`
  - `packages/web/src/components/ChatContainerHeader.tsx`
  - `packages/web/src/stores/chatStore.ts`
  - `packages/web/src/app/(chat)/thread/[threadId]/page.tsx`
- [x] AC-A4: 新 PR 不 rename / overwrite 既有 feature docs，不新增重复 `feature_ids`；尤其不得改动 F179/F185/F186 既有真相源。
- [x] AC-A5: 新 PR 必须通过 `pnpm check:features`，并针对 Settings/AppShell 导航补充 focused web tests。
- [x] AC-A6: F183/F184 路由与 mount 保护测试保持通过；thread route marker 必须继续使用真实 `threadId`。
- [x] AC-A7: alpha 走查 `/settings`、`/settings?s=members`、`/settings?s=mcp`、`/settings?s=ops`，无 blocking console error，且旧 chat 首页可继续进入。Proof: PR #1658 `pnpm gate` + alpha smoke `/`, `/settings?s=members`, `/settings?s=mcp`, `/settings?s=ops`, `/settings?s=plugins`, `/settings?s=im`, `/settings?s=rules`, `/settings?s=voice` all returned 200 after `c1cfa294e`. Follow-up visual compare found missing settings nav SVG paths and PR #1659 restored the `box` / `puzzle` icon registry entries with focused regression coverage.

### Phase B（Settings Section Migrations）
- [x] AC-B1: 每个 settings section 独立 review slice，单 slice 不超过一个业务域。Proof: PR #1650 按 read-only settings wrapper / rules / ops / marketplace / MCP / skill preview 等 slice 分段 review；Phase C high-risk writes 独立 PR #1651/#1652/#1654/#1655。
- [x] AC-B2: 每个 section PR 写清 `Source Behavior`、`Must Preserve Home Behavior`、`Proof`。Proof: #1650 与 Phase C 四刀 review request 均带 manual-port 决策表与 focused proof。
- [x] AC-B3: 涉及 high-risk 文件（route 注册、auth/callback、env registry、allowlist、service lifecycle）时必须走 manual-port review。Proof: MCP write / Service Manifest / refAudio / IM connector write 分别经 #1651/#1652/#1654/#1655 独立 review + 云端 review。

### Phase C（High-risk Follow-up Systems）
- [x] AC-C1: MCP write path hardening 第一刀只扩展既有 `capabilitiesMcpWriteRoutes`，不新增并行写路径。
- [x] AC-C2: Service Manifest 第一刀只提供 auth-gated read-only manifest/status/endpoints；不得暴露 start/stop/install/uninstall 写路由或脚本句柄。
- [x] AC-C3: refAudio upload 独立 slice，必须覆盖 path traversal、文件类型/大小限制与清理证明。
- [x] AC-C4: IM connector write 独立 slice，必须覆盖 connector auth/callback proof、secret redaction 与 public sync 泄漏防护。

## Dependencies

- **Evolved from**: [clowder-ai#645](https://github.com/zts212653/clowder-ai/pull/645)（Console Architecture Restructure prototype）
- **Related**: F056（Cat Café design language）
- **Related**: F063（Hub Workspace Explorer）
- **Related**: F116（Open-Source Ops inbound/intake gate）
- **Must preserve**: F183 / F184（Bubble pipeline + ChatMessage mount/rendering invariants）

## Risk

| 风险 | 缓解 |
|------|------|
| 大 PR 继续修导致 review 面积不可控 | #645 只保留为 prototype/reference；新 PR 从 latest main 开 clean branch |
| Settings shell 顺手改到聊天渲染链路 | Phase A denylist 硬卡 ChatMessage / ChatContainer / chatStore / thread route |
| 社区 PR 误改 feature 编号污染知识图谱 | Feat Anchor Guard：不得 rename F179/F185/F186；新增 F190 真相源作为唯一锚点 |
| 设计稿好看但运行态破坏旧入口 | alpha 走查 Settings 与旧 chat 首页；focused web tests 覆盖 Activity Rail 导航 |
| 后续 service/voice/MCP 能力继续膨胀 scope | Phase B/C 明确拆分，high-risk 文件必须 manual-port + proof |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Phase A skeleton 是否由社区贡献者重提，还是 maintainer 手工 port？ | ✅ 社区重提 #662，家里已 intake |
| OQ-2 | Settings section 迁移顺序如何排？ | ✅ 先 read-only/包装型 section，再高风险写接口 |
| OQ-3 | Service Manifest 是否单独分配 feature 编号，还是作为 F190 Phase C follow-up？ | ✅ 折入 F190 Phase C，但必须独立 slice + review |
| OQ-4 | MCP write hardening 是否要 fail-closed install/delete？ | ✅ 否。install/delete 保持开发环境兼容：配置 `DEFAULT_OWNER_USER_ID` 时强制 owner；secret env patch fail-closed |
| OQ-5 | MCP env secret 如何删除？ | ⚠️ 当前 Phase C 第一刀只支持新增/覆盖，不支持单 key 删除；后续如需要另起安全 slice |
| OQ-6 | Service Manifest 是否可以直接 port #669 的 lifecycle controls？ | ✅ 否。先接 read-only manifest/status；start/stop/install/uninstall 需要独立 runtime truth source 与 security review |
| OQ-7 | Service Manifest read-only endpoint 是否可沿用 trusted Origin `default-user` fallback？ | ✅ 否。服务 inventory / endpoint 属内部状态面，必须要求真实 session identity |
| OQ-8 | IM connector write 是否接 user-editable callback URL / provider endpoint 字段？ | ✅ 否。这刀只 harden 现有 connector credential writes；URL 写面需单独 SSRF review |
| OQ-9 | IM connector credential writes 在 `DEFAULT_OWNER_USER_ID` 未配置时是否 fail-closed？ | ✅ 是。connector 凭据与 MCP env patch 同级敏感，不能走 ownerless dev fallback |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | F190 只接收 Console/Settings skeleton 第一片，不接收 #645 whole diff | 方向有价值，但 #645 混入 500+ files、F183/F184 敏感路径和重复 feature 编号 | 2026-05-07 |
| KD-2 | #645 保留为 prototype/reference，新 PR 从最新 main 开 clean branch | clean diff 才能让 reviewer 验证“不改原本东西”；在大 PR 内删改审计成本更高 | 2026-05-07 |
| KD-3 | Phase A denylist 硬卡 ChatMessage / ChatContainer / chatStore / thread route | 这些路径受 F183/F184 保护，Console shell 不应触碰聊天渲染/mount invariants | 2026-05-07 |
| KD-4 | #662 + #669 是当前社区路径；家里 intake 采用 staging branch manual-port，不直接 overlay #669 | #669 是大 follow-up，source 已验证但与家里 F183/F184/F194/F195 分叉，需要逐 slice replay source intent | 2026-05-12 |
| KD-5 | Service Manifest / refAudio / secret write-back 是 F190 Phase C high-risk deferred surface；chat rendering 归 F183/F184/F194 ownership | 服务生命周期、音频文件、secret 写回必须独立 slice + security review + focused proof；气泡/read model 不是 F190 责任面，F190 不触碰。如未来正式立项独立 feature，可迁出到新 F 号，由 maintainer 评估 | 2026-05-12 |
| KD-6 | MCP write path 第一刀只硬化现有 `capabilitiesMcpWriteRoutes`，不新增并行写路径 | 复用 F146/F193 既有 lock/read/write/audit/topology heal；先锁住 secret 丢失、placeholder 写入、owner gate，再单独做 UI 写回 | 2026-05-12 |
| KD-7 | Service Manifest 第一刀只暴露服务清单、endpoint 与 health status，不 port #669 的 lifecycle scripts / process killing / install flows | 家里还没有单一 service lifecycle truth source；直接搬 spawn/SIGTERM/install script 会把运行态控制伪装成已验证平台能力 | 2026-05-13 |
| KD-8 | Service Manifest 可显示 `audio-capture` health probe，但不接管 F195 meeting audio ownership | F190 只 own service status visibility surface；F195 仍 own meeting audio recording/transcript runtime 与 refAudio/upload 边界，F190 不顺手扩到 audio service 控制面 | 2026-05-13 |
| KD-9 | Service Manifest routes 必须使用 `request.sessionUserId` 严格 session identity，不调用 `resolveUserId`/trusted Origin fallback | 可信 Origin header 可被非浏览器客户端伪造；read-only 服务清单仍暴露内部服务拓扑与 endpoint，不能以 `default-user` 兼容回退放行 | 2026-05-13 |
| KD-10 | refAudio upload 第一刀只接 TTS reference-audio 上传与 cat voiceConfig 写回，不接管 F195 meeting audio runtime | 上传 route 必须使用真实 session identity，生成文件名并写入 `UPLOAD_DIR`，`cat-voices` 只允许 `/uploads/...` 解析回 upload dir；录音、转写、会议音频存储仍属 F195 | 2026-05-13 |
| KD-11 | `voiceConfig.refAudio` 的期望格式是上传 route 返回的 `/uploads/<server-generated>`，或 legacy character voice dir 内的相对/绝对路径 | cats 写路径保留字符串兼容性；读端 resolver 对空值、traversal、越界路径 fail-safe 到 `invalid-ref`，所以手写异常路径可以持久化但不会被 TTS 使用 | 2026-05-13 |
| KD-12 | IM connector write 第一刀只 harden 现有 `/api/config/secrets` 与 guided connector credential routes，不新增 callback URL / provider endpoint 写面 | 写路径必须使用真实 session identity + explicit owner fail-closed，拒写 redacted placeholder，保留 omitted secret / `null` 删除 / F136 hot reload；F190 不接管 F088/F124 connector runtime、transport、message routing | 2026-05-13 |

## Known Limitations

| # | 限制 | 当前处置 | 后续候选 |
|---|------|----------|----------|
| KL-1 | MCP env patch / install update 只新增或覆盖 env/header secret，不删除单个 env key | 保护现有 secret 不被 UI omit 清空；删除需求暂不混入本安全 slice | 独立设计 `DELETE /api/capabilities/mcp/:id/env/:key` 或 PATCH `null` 删除语义 |
| KL-2 | install/delete 是 owner-configured enforcement；未配置 `DEFAULT_OWNER_USER_ID` 的多用户/LAN 部署仍沿用既有身份 gate | 保持 localhost/dev 兼容，secret env patch 已 fail-closed | UI/ops docs 明确多用户部署必须配置 `DEFAULT_OWNER_USER_ID`；可加 telemetry warning |
| KL-3 | Connector secret writes 在 audit append 失败时仍返回成功 | 凭据已经落盘并触发热生效，audit 是 side channel；失败会写 warn 日志但不回滚主写入 | 若引入 audit retry / queue / outbox 机制，可补偿丢失的 audit append |

## Vision Guard Evidence

| 铲屎官原话 / 关切 | 当前实际状态（证据） | 匹配？ |
|-------------------|----------------------|--------|
| "我们不就是 intake 一个前端回家" | F190 只 intake Console/Settings rail 方向：Phase A skeleton + #1650 read-only section wrappers；没有接收 #645/#669 whole diff | ✅ |
| "搞完别出太多 bug，我们家后续的那些功能别改坏了，包括气泡的那些" | Opus-46 愿景守护验证 Phase C 4/4 已合入 main、F183/F184/F194 红区 12 文件零触碰；PR #1658 alpha smoke 旧 chat 首页 + settings 7 路由全 200 | ✅ |
| "pnpm alpha:start 这个你能跑吧？alpha 测试！" | Codex 启动 alpha 隔离环境并定位 dev CSP + ThreadCatPill alpha blocker；Sonnet 复跑 alpha smoke PASS；hotfix PR #1658 merged `c1cfa294e` | ✅ |

## Close Gate Report

```yaml
close_gate_report:
  feature_id: F190
  spec_path: docs/features/F190-console-settings-appshell-skeleton.md
  head_sha: "01f468758 + close sync commit"
  report_date: 2026-05-13
  harness_feedback:
    status: none
    reason: "F190 是 Console/Settings intake 与配置面 hardening；未新增 harness/skill/MCP 行为模式，相关 trace anomalies 已在 Phase C review lessons 中沉淀"
  ac_matrix:
    - ac_id: AC-A1..AC-A7
      status: met
      evidence:
        - kind: pr
          ref: "PR #1645 / #1650 / #1658"
          description: "Phase A skeleton + read-only intake + AC-A7 alpha unblock and smoke"
        - kind: test
          ref: "pnpm gate at PR #1658"
          description: "Full merge gate passed after alpha hotfix"
        - kind: doc
          ref: "Opus-46 vision guardian PASS"
          description: "Source intent preserved and red-zone zero-touch verified"
      resolution: null
    - ac_id: AC-B1..AC-B3
      status: met
      evidence:
        - kind: pr
          ref: "PR #1650"
          description: "Read-only settings migrations reviewed as manual-port slices with Source/Preserve/Proof"
        - kind: pr
          ref: "PR #1651 / #1652 / #1654 / #1655"
          description: "High-risk route/auth/env/service surfaces split into independent Phase C PRs"
      resolution: null
    - ac_id: AC-C1..AC-C4
      status: met
      evidence:
        - kind: pr
          ref: "PR #1651"
          description: "MCP write path hardening"
        - kind: pr
          ref: "PR #1652"
          description: "Service Manifest read-only status"
        - kind: pr
          ref: "PR #1654"
          description: "refAudio upload + voiceConfig persistence/hydration/drain fixes"
        - kind: pr
          ref: "PR #1655"
          description: "IM connector credential write hardening"
      resolution: null
```

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-07 | F190 立项，占位社区 Console/Settings skeleton intake 方向 |
| 2026-05-12 | #662 已回流；#669 开始在 `intake/f190-followup-stage` 按 manual-port 逐 slice 吸收 |
| 2026-05-13 | Phase C Service Manifest read-only merged (PR #1652) |
| 2026-05-13 | Phase C refAudio upload merged (PR #1654) |
| 2026-05-13 | Phase C IM connector write hardening merged (PR #1655) — Phase C 4/4 complete |
| 2026-05-13 | F190 愿景守护 PASS (Opus-46，同族非作者非 reviewer)：红区零触碰 verified、source intent 保留 |
| 2026-05-13 | AC-A7 alpha walkthrough completed after alpha hotfix (PR #1658, `c1cfa294e`): Codex + Sonnet smoke passed home/settings routes |
| 2026-05-13 | F190 close gate truth sync: AC-A/B/C all met, reflection capsule linked, BACKLOG active row removed |
| 2026-05-13 | Post-close visual hotfix restored missing settings nav SVG paths (`box` / `puzzle`) after upstream/home screenshot compare (PR #1659, `d928fb696`) |
| 2026-05-15 | Phase F audit started: CVO 实测发现 ChatContainerHeader / ThreadSidebar 入口重复 + Hub/Settings 内容重复 + 视觉不一致；recording as F190 follow-up, not new feature |

## Phase F: Console IA Convergence — 入口去重 + Shell 一致性（WIP 审计清单）

> **Status**: auditing | **Trigger**: CVO 2026-05-14 post-F199-close 实测发现多处入口重复 + 视觉不一致
> **方向**: F190 follow-up fix PR，不开新 Feature（CVO: "禁止新开feat了 原本你们的f199就不应该存在 就是f190的follow up"）
> **⚠️ 铲屎官还在发现更多问题，此清单持续更新中**

### 设计原则（CVO 确认）

- Settings page 是 canonical home（URL-routable），Hub 只展示摘要 + deep-link，不重复完整配置 UI
- 三层 shell 各司其职：ActivityBar（全局导航，唯一入口）、ChatContainerHeader（当前 thread 操作）、ThreadSidebar（thread 管理 + 过滤）
- 入口唯一性：同一功能只在一个 shell 层有入口按钮，不重复

### 审计发现

#### 1. ChatContainerHeader.tsx（🔴 红区文件 — 修改需 CVO override）

对比 clowder-ai 开源 main，本地多出 7 项：

| # | 组件 | 来源 | 处置建议 |
|---|------|------|----------|
| 1 | CatCafeLogo | 本地品牌 | 待定 — 问 CVO |
| 2 | DaemonActiveIndicator | F198 | 保留（本地独有功能） |
| 3 | ThreadCatPill | F154 | 保留（本地独有功能） |
| 4 | LiveAudioToggle | F195 | 保留（本地独有功能） |
| 5 | Signal Inbox bell | Signals 功能 | 待定 — 保留 topbar 还是移走？问 CVO |
| 6 | **ThemeToggle** | — | ❌ **删除 — ActivityBar 已有，重复入口** |
| 7 | **HubButton** | — | ❌ **删除 — ActivityBar 已有，重复入口** |

#### 2. ThreadSidebar.tsx（非红区）

对比 clowder-ai 开源 main，"新对话"按钮旁本地多出 4 项：

| # | 组件 | 来源 | 处置建议 |
|---|------|------|----------|
| 1 | **Memory Hub 按钮** | — | ❌ **删除 — ActivityBar 已有，重复入口** |
| 2 | **IM Hub 按钮** | — | ❌ **删除 — ActivityBar 已有，重复入口** |
| 3 | Mission Hub section | 本地功能 | 保留（开源只有猫猫训练营） |
| 4 | LabelFilterBar | 本地功能 | 保留（thread 过滤） |

#### 3. Hub 内容与 Settings 页面重复

| Hub 入口 | Settings 入口 | 复用的组件 | 处置建议 |
|----------|---------------|-----------|----------|
| system → im | /settings?s=im | HubConnectorConfigTab | Hub 仅展示摘要 + deep-link |
| system → env | /settings?s=system | HubEnvFilesTab | Hub 仅展示摘要 + deep-link |
| monitor → governance | /settings?s=rules | HubGovernanceTab | Hub 仅展示摘要 + deep-link |

#### 4. ActivityBar

两仓一致：Home / Memory / Mission / Signals / theme toggle / settings。本地仅提取了 helper 函数（代码重构），无 UI 差异。**无需修改。**

#### 5. 待审计（铲屎官仍在发现中）

| 区域 | 铲屎官提到的问题 | 审计状态 |
|------|-----------------|----------|
| 字体 | Settings 里字体不一样 | 🔲 待对比 |
| 状态栏 | 右边的状态栏不一样 | 🔲 待对比 |
| Thread 管理栏 | thread sidebar 视觉差异 | 🔲 待对比 |
| 顶栏视觉 | 顶栏视觉差异（非按钮） | 🔲 待对比 |
| 其他丢失功能 | "很多东西都被你们改没了" | 🔲 待铲屎官继续反馈 |

### 修改约束

- ChatContainerHeader.tsx 是 F183/F184/F194 红区文件，修改前必须获得 CVO override 确认
- 不开新 Feature，以 F190 follow-up PR 形式修复
- 所有入口去重必须确保 ActivityBar 对应入口仍在且可用

## Review Gate

- Phase A PR：必须由 maintainer 以 inbound PR 口径 review；先核 diff allowlist/denylist，再看 UI。
- Phase B/C PR：每个业务域单独 review；high-risk 文件默认 manual-port。

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Community PR** | `clowder-ai#645` | Console Architecture Restructure prototype |
| **Community PR** | `clowder-ai#662` | AppShell / Settings skeleton |
| **Community PR** | `clowder-ai#669` | F190 follow-up source intent |
| **Architecture** | `docs/architecture/feature-placement.md` | Console 入口层级决策树 |
| **Reflection** | `docs/reflections/2026-05-13-f190-console-settings-intake-capsule.md` | F190 completion reflection |
| **Skill ref** | `cat-cafe-skills/refs/f190-frontend-lessons.md` | F190 前端 intake 教训 |
| **Feature** | `docs/features/F056-cat-cafe-design-language.md` | 设计语言约束 |
| **Feature** | `docs/features/F183-bubble-pipeline-architecture-consolidation.md` | 聊天渲染链路保护 |
| **Feature** | `docs/features/F184-chatmessage-rendering-mount-investigation.md` | ChatMessage mount 回归保护 |
