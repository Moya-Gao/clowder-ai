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
| Service install pipeline + async lifecycle | clowder-ai#674 | **BLOCKED** — REQUEST_CHANGES | P1: F198 编号撞车（家里 F198 = Subscription Carrier）；需改号或折入 F190 sub-scope。111 files / 9k 行需 manual-port，不可 cherry-pick |

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
| 2026-05-15 | Codex 二轮审计补充：AppShell desktop ThreadSidebar ownership、BootcampListModal 入口语义、RightStatusPanel Hub gear、Signal enrich backend、HubPermissionsTab contract drift、`/mission` alias |
| 2026-05-15 | Color Harmony token 整治：CSS 变量收口 thread sidebar / right status panel / signals（PRs #1684 #1686 #1687 #1688 #1691 merged） |
| 2026-05-15 | CVO 对比开源截图：确认 7 项视觉设计模式差距需跟进（card gap / CTA depth / trash styling / 全部已读 / tag labels / icon containers / line dividers） |
| 2026-05-16 | Header toolbar buttons migrated to console tokens (PR #1701): Export/Voice/LiveAudio/RightPanel all get `console-rail-item` container + unified hover/active states |

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
| 1 | CatCafeLogo | 本地品牌 | ✅ **保留**（CVO 确认） |
| 2 | DaemonActiveIndicator | F198 | ✅ **保留**（CVO 确认，本地独有） |
| 3 | ThreadCatPill | F154 | ✅ **保留**（CVO 确认，本地独有） |
| 4 | LiveAudioToggle（🎤 麦克风） | F195 会议副驾驶 | ✅ **保留**（本地独有功能） |
| 5 | **Signal Inbox bell（🔔 铃铛）** | Signals | ❌ **删除 — 开源已移到 ActivityBar（旗帜图标），顶栏是重复入口** |
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

#### 4b. AppShell / ChatContainer ownership（Codex 二轮审计补充）

clowder-ai source 已把桌面 ThreadSidebar 归到 `AppShell`：非 `/settings` / `/signals` / `/memory` / `/mission` 路由时，由 shell 固定渲染 260px desktop rail；`ChatContainer` 只保留 mobile overlay。家里当前仍由 `ChatContainer` 控制 desktop sidebar，导致：

| 差异 | 开源 | 本地 | 影响 |
|------|------|------|------|
| Desktop ThreadSidebar owner | AppShell | ChatContainer | 三层 shell 责任不一致，顶栏 hamburger 在 desktop 仍可见 |
| Hidden routes | AppShell `SIDEBAR_HIDDEN_ROUTES` | 分散在 chat 容器状态 | settings/signals/memory/mission 的 sidebar 展示规则不够集中 |
| ChatContainer desktop layout | 只负责 chat content | 同时负责 sidebar + chat | 后续顶栏/状态栏视觉对齐会继续互相牵扯 |

**处置建议**：Phase F intake 时恢复 source 的 AppShell ownership，但必须保留家里 F154/F194/F195/F198 顶栏能力；不能整文件覆盖 `ChatContainer` / `ChatContainerHeader`。

#### 5. Settings 页面功能丢失（代码级全量对比 clowder-ai vs local）

##### 5a. /settings?s=im（IM 配置）— ❌ 严重丢失

HubConnectorConfigTab.tsx 文件存在但缺失大量功能：

| 丢失项 | 说明 |
|--------|------|
| Connection State 监控 | `connectionState`/`lastHeartbeat`/`category` 字段缺失，无连接状态 pill（"已连接"/"重连中"等） |
| HubPermissionsTab 集成 | 文件存在但**未接入** — 飞书/企微/钉钉权限管理 UI 断线（lazy/Suspense 加载缺失） |
| 连接测试 | `handleTestConnection()` 未实现，`/api/connector/{id}/test` 未接 |
| Heartbeat 显示 | 平台名称下方的心跳时间（"5m ago"）缺失 |
| API 降级 | 开源用 `/api/connector/{id}/config` (PUT) 原子更新，本地降级为 `/api/config/secrets` (POST) |
| 群管理入口 | feishu/wecom-bot/dingtalk 的 `PERMISSION_CONNECTORS` 映射 + 权限配置面缺失 |

Codex 二轮审计补充：

- `HubPermissionsTab` API contract 也发生分叉：开源是 `forwardRef` + `getConfig()/applyConfig()`，用于跟 connector config 同一保存事务；本地组件变成直接保存到 `/api/connector/permissions/{id}`，所以不能只把 import 补回来。
- 修复时应恢复 source 的权限管理/连接状态/连接测试 UX intent，同时保留家里 Phase C 已 harden 的 owner-gated secret write 边界；禁止为了“对齐开源”把 `/api/config/secrets` 的安全语义回退掉。

##### 5b. /settings?s=members（成员管理）— ❌ 降级为只读

SettingsContent.tsx 缺失以下导入和功能：

| 丢失项 | 说明 |
|--------|------|
| HubCatEditor | 成员编辑 UI 未接入（文件存在但 import 缺失） |
| HubCoCreatorEditor | 共创者编辑 UI 未接入 |
| useConfirm hook | 破坏性操作确认弹窗缺失 |
| handleToggleAvailability | 成员可用性切换缺失 |
| handleDeleteMember | 成员删除缺失 |
| handleEditorSaved | 编辑保存回调缺失 |
| **结果** | MembersPanel 只渲染只读 CatOverviewTab，无法编辑/删除/切换可用性 |

##### 5c. /settings?s=system（系统配置）— ⚠️ 参数差异

| 差异项 | 开源 | 本地 |
|--------|------|------|
| HubEnvFilesTab | `excludeCategories={['connector']}` | 无 exclusion（可能暴露 connector env 在 system 页面） |

##### 5d. 其他 Settings 页面

| 页面 | 状态 | 说明 |
|------|------|------|
| accounts（账户与密钥） | ✅ 一致 | — |
| skills（Skill 管理） | ✅ 本地多 SkillConflictBanner | F199 Phase E 新增 |
| mcp（MCP 管理） | ✅ 一致 | — |
| plugins（插件/集成） | ✅ 一致 | — |
| marketplace（能力市场） | ✅ 一致 | — |
| voice（语音管理） | ✅ 一致 | — |
| rules（规则与 SOP） | ✅ 本地多 HubGovernanceTab + BrakeSettingsPanel | 本地更丰富 |
| notify（通知） | ✅ 一致 | — |
| ops（运维监控） | ✅ 一致 | — |

##### 5e. /mission route alias（Codex 二轮审计补充）

clowder-ai 有 `packages/web/src/app/mission/page.tsx`，用于把 `/mission` redirect 到 `/mission-hub`。家里只有 Mission Hub 实际页，缺少 `/mission` alias。这个不是 P0 功能丢失，但会破坏开源/历史链接兼容。

#### 6. 状态栏样式差异

| 组件 | 差异类型 | 说明 |
|------|---------|------|
| ConnectionStatusBar | CSS 变量 vs Tailwind | 开源用 `--console-border-soft` / `--console-hover-bg`，本地用 `cocreator-light` / `cocreator-bg` |
| ParallelStatusBar | 主题 class vs 硬编码色 | 开源用 `conn-emerald-bg` / `conn-red-text` 主题类，本地用 `bg-green-400` / `text-red-500` 硬编码 |
| ParallelStatusBar | pill 样式 | 开源 `rounded-xl px-3 py-1.5`，本地 `rounded-full px-2.5 py-1`（更紧凑） |
| RightStatusPanel | extra Hub gear + token drift | 本地猫猫状态卡右上角还有 Hub 齿轮入口；开源无此入口。若 ActivityBar 是全局唯一 Settings 入口，这也是重复入口 |
| 字号 | text-xs vs text-[11px] | 本地略小 |
| 待决策 | CVO: "他们那个有点丑" | 🔲 样式方向待 CVO 拍板 |

注意：`ParallelStatusBar` / `RightStatusPanel` 含家里 F194/F154 行为补丁（例如 active cat intent mode），Phase F 只能做入口/视觉收敛，不能整文件 source-replace。

#### 7. Hub 导航 vs Settings 导航孤立组件

Hub（CatCafeHub.tsx）使用 accordion 分 3 组 19 tab，Settings 使用 flat 12 section。以下组件**文件存在但未接入任何导航**：

| 孤立组件 | 说明 |
|---------|------|
| HubPermissionsTab.tsx | 权限管理 UI，feishu/wecom-bot/dingtalk 配置 |
| HubCatEditor.tsx | 成员编辑器，import 存在但 SettingsContent 未引用 |
| HubCoCreatorEditor.tsx | 共创者编辑器，同上 |

#### 7b. ThreadSidebar 训练营入口行为（Codex 二轮审计补充）

开源 ThreadSidebar 的训练营按钮会打开 `BootcampListModal`，展示已有训练营并允许继续；家里当前按钮直接 `createBootcampThread()`，行为从“入口/列表”降级成“新建”。这不是简单的按钮数量差异，属于入口语义丢失。

**处置建议**：删除 Memory/IM 重复按钮的同时，恢复 ThreadSidebar 内 `BootcampListModal` 行为；保留家里 Mission Hub section、LabelFilterBar、pin/read-state 等本地 thread 管理能力。

#### 8. Signal 页面差异（SignalInboxView / SignalArticleDetail）

Signal 页面两仓**双向分叉**：本地功能更多，但开源有 2 项我们缺的。

##### 本地有、开源没有（保留，无需改）

| 功能 | 组件/位置 |
|------|----------|
| Stats Cards（今日/未读/7 日） | SignalStatsCards.tsx |
| Batch Actions（多选/批量已读/归档/标签/删） | BatchActionBar.tsx |
| Study Timeline | StudyTimeline.tsx |
| Tier Filter（T1-T4 筛选） | SignalInboxView toSignalTier() |
| 返回线程按钮 | SignalNav.tsx 返回链接 |

##### 开源有、本地缺（❌ 需补）

| 丢失项 | 说明 |
|--------|------|
| Content Enrichment | `/api/signals/articles/{id}/enrich` 全文抓取，`enrichedContent`/`enriching`/`enrichError` 状态全缺；后端 `domains/signals/services/enrich-article.ts` 与 route 也缺 |
| Thread 讨论导航 | `useRouter` + `getThreadHref` 从 Signal 文章跳转关联 thread（cat-cafe 无此导航） |

##### 布局风格分叉

| 维度 | 本地 | 开源 |
|------|------|------|
| 整体风格 | Dashboard 卡片式（stats 突出） | Console panel 式（sidebar + content 紧凑） |
| 主面板 | `lg:grid-cols-[1.25fr_1fr]` 非对称 | 左 `[420px]` 固定 + 右 `flex-1` |
| 色彩 | Tailwind token（cocreator-primary 等） | CSS 变量（--console-panel-bg 等） |
| 圆角 | `rounded-2xl` / `rounded-xl` | `rounded-[18px]` / `rounded-[14px]` |
| Nav 标签 | `'Signals'` / `'Sources'` | `'收件箱'` / `'信号源'` |

**布局待决策**：两种风格哪个保留？需 CVO 拍板。

#### 9. 其他待审计

| 区域 | 铲屎官提到的问题 | 审计状态 |
|------|-----------------|----------|
| 字体 | Settings 里字体不一样 | 🔲 待视觉对比 |
| Thread 管理栏 | thread sidebar 视觉差异 | 🔲 待对比 |
| 顶栏视觉 | 顶栏视觉差异（非按钮） | 🔲 待对比 |

#### 10. Codex 二轮审计结论（2026-05-15）

46 的首轮审计覆盖了大部分功能缺口；二轮补充集中在“入口归属”和“文件存在但 contract 不可直接接回”的问题：

| # | 补充发现 | 结论 |
|---|----------|------|
| C-1 | AppShell 未接管 desktop ThreadSidebar | 需要修。否则顶栏/侧栏责任继续混在 ChatContainer，视觉修不干净 |
| C-2 | ThreadSidebar 训练营按钮从列表入口变成直接创建 | 需要修。恢复 BootcampListModal 入口语义 |
| C-3 | RightStatusPanel 仍有 Hub 齿轮 | 需要修。也是设置入口重复 |
| C-4 | Signal enrichment 缺后端 service + route | 需要修。F-5 不是纯前端补状态 |
| C-5 | HubPermissionsTab contract 与开源分叉 | 需要设计性接回，不能只补 import |
| C-6 | `/mission` alias 缺失 | 可顺手补，兼容 source/历史链接 |
| C-7 | theme token packaging / font-size token drift | 先记录，视觉刀再统一；不要盲目全局 import xterm CSS |

#### 11. Visual Design Pattern Gaps — Thread Sidebar + 全局 Line Divider（CVO 2026-05-15）

CVO 对比开源截图后确认以下设计模式需要跟进：

##### 11a. Thread List: Line Divider → Card Gap

| 维度 | 本地 | 开源 |
|------|------|------|
| 分隔方式 | `border-b border-gray-50`（线分隔） | `mx-2 rounded-[14px]` + padding（卡片间距） |
| Active 状态 | `bg-cocreator-light` | `bg-[var(--console-active-bg)]` |
| Hover 状态 | `hover:bg-cafe-surface-elevated` | `hover:bg-[var(--console-hover-bg)]` |

##### 11b. "新对话" Button Depth

本地：`bg-cocreator-primary text-white hover:bg-cocreator-dark text-xs`，视觉扁平。
开源：`console-button-primary` CSS class — `color-mix` accent/card-bg 深色混合 + `font-weight: 600`。

##### 11c. Trash Area Styling

本地：`border-t border-[var(--console-border-soft)]` 纯文本行 + `text-cafe-muted`。
开源：`bg-[var(--console-code-bg)] rounded-xl h-9` 样式化工具行 + `hover:opacity-80`。

##### 11d. "全部已读" Affordance

本地：`text-[10px] text-cafe-muted`（纯文字链接，无容器）。
CVO 要求：改为 button 或 card 样式，提供可点击视觉暗示。

##### 11e. Tag Label Visual Distinction

ThreadItem 内 `LabelDots` 渲染 `w-1.5 h-1.5` 色点堆叠，视觉区分度低。CVO 要求优化为可辨识标签。

##### 11f. Line Divider Audit — 全局高优先级项

| 文件 | 组件 | 当前模式 | 建议 |
|------|------|----------|------|
| ThreadItem.tsx | Thread 列表项 | `border-b border-gray-50` | 改 card gap |
| QueueEntryRow.tsx | 队列行 | `border-b last:border-b-0` | 改 card gap |
| IndexStatus.tsx | 状态行（×3） | `border-b border-cafe/50 last:border-b-0` | 改 card gap |
| CommunityPanel.tsx | 统计/分区 | `border-b border-cocreator-light/20` | 改 card gap |
| SchedulePanel.tsx | 任务行（×3） | `border-b border-[#E8DFD4]` | 改 card gap |
| TranslationMatrix.tsx | 表格行 | `divide-y divide-[#F0E8DB]` | 保持（表格合理） |
| HubGovernanceTab.tsx | 表格行 | `divide-y divide-gray-100` | 保持（表格合理） |

---

### 修改清单汇总（按优先级排序）

> **方向**：F190 follow-up PR，不开新 Feature。

#### P0 — 功能丢失（必须修）

| # | 区域 | 问题 | 修改内容 |
|---|------|------|----------|
| F-1 | IM 配置页 | 权限管理断线 | 重新接入 HubPermissionsTab（lazy/Suspense），恢复 PERMISSION_CONNECTORS 映射 |
| F-2 | IM 配置页 | 连接状态监控丢失 | 补 connectionState/lastHeartbeat/category + connStatePill + formatHeartbeat |
| F-3 | IM 配置页 | 连接测试丢失 | 补 handleTestConnection() + `/api/connector/{id}/test` |
| F-4 | 成员管理页 | 降级为只读 | 重新 import HubCatEditor/HubCoCreatorEditor/useConfirm，恢复编辑/删除/切换 |
| F-5 | Signal 详情 | Content Enrichment 丢失 | 补后端 `enrich-article.ts` service + route `/api/signals/articles/{id}/enrich` + 前端 enrichedContent 状态 |
| F-6 | Signal 详情 | Thread 导航丢失 | 补 useRouter + getThreadHref 跳转关联 thread |

#### P1 — 入口重复（应修）

| # | 区域 | 问题 | 修改内容 |
|---|------|------|----------|
| D-1 | ChatContainerHeader（🔴 红区） | ThemeToggle 重复 | 删除（ActivityBar 已有） |
| D-2 | ChatContainerHeader（🔴 红区） | HubButton 重复 | 删除（ActivityBar 已有） |
| D-3 | ChatContainerHeader（🔴 红区） | Signal Inbox bell 重复 | 删除（ActivityBar 已有旗帜图标） |
| D-4 | ThreadSidebar | Memory Hub 按钮重复 | 删除（ActivityBar 已有） |
| D-5 | ThreadSidebar | IM Hub 按钮重复 | 删除（ActivityBar 已有） |
| D-6 | RightStatusPanel | Hub 齿轮重复 | 删除或改为非入口状态展示（ActivityBar 保留唯一 Settings 入口） |
| D-7 | AppShell / ChatContainer（🔴 红区） | desktop sidebar owner 错位 | AppShell 接管 desktop ThreadSidebar，ChatContainer 仅保留 mobile overlay |
| D-8 | ThreadSidebar | 训练营入口语义丢失 | 恢复 BootcampListModal 列表入口，不直接新建训练营 thread |

#### P2 — 参数/样式修正

| # | 区域 | 问题 | 修改内容 |
|---|------|------|----------|
| S-1 | 系统配置页 | connector env 暴露 | 补回 `excludeCategories={['connector']}` |
| S-2 | Hub/Settings 重复 | IM/Env/Governance 三处 | Hub 改为摘要 + deep-link（scope 较大，可后置） |
| S-3 | Mission route | `/mission` alias 缺失 | 补 `/mission` redirect 到 `/mission-hub` |
| S-4 | Console tokens | font / color token drift | 对齐 font-size/token 命名；不盲目搬 `theme-tokens.css` 或 xterm CSS |
| S-5 | Thread/Top/Status visual | 视觉不一致 | 在功能修复后统一 spacing、border、radius；保留家里新增功能 |

#### P1 — Visual Design Pattern 跟进（CVO 2026-05-15 确认）

| # | 区域 | 问题 | 修改内容 |
|---|------|------|----------|
| V-1 | ThreadItem | Line divider → card gap | 删 `border-b border-gray-50`，加 `mx-2 rounded-[14px]`；active/hover 用 console CSS 变量 |
| V-2 | ThreadSidebar 新对话 | 按钮视觉扁平 | 切 `console-button-primary` class |
| V-3 | ThreadSidebar 回收站 | 纯文字行 | 改 `bg-[var(--console-code-bg)] rounded-xl` 样式化行 |
| V-4 | ThreadSidebar 全部已读 | 纯文字链接 | 改为 button/card 样式 |
| V-5 | ThreadItem LabelDots | 色点堆叠无区分 | 展示标签名 pill 或加大色点 |
| V-6 | 全局 line divider | 高优 border-b 列表项 | QueueEntryRow / IndexStatus / CommunityPanel / SchedulePanel card gap 化 |

#### 待 CVO 拍板

| # | 区域 | 问题 | 等什么 |
|---|------|------|--------|
| W-1 | 状态栏 | CSS 变量 vs Tailwind 硬编码色 | CVO 觉得开源"有点丑"，样式方向待定 |
| W-2 | Signal 页面布局 | Dashboard 卡片式 vs Console panel 式 | 两种风格二选一 |
| W-3 | 字体/Thread 管理栏/顶栏视觉 | 未完成对比 | 铲屎官继续反馈 |

### 修改约束

- ChatContainerHeader.tsx 是 F183/F184/F194 红区文件，D-1/D-2/D-3 修改前必须获得 CVO override 确认
- ChatContainer/AppShell ownership 涉及 F183/F184/F194 红区，D-7 必须小刀修改 + focused smoke，不得整文件覆盖
- 不开新 Feature，以 F190 follow-up PR 形式修复
- 所有入口去重必须确保 ActivityBar 对应入口仍在且可用
- IM connector 修复必须保留家里 owner-gated secret write / redaction / hot reload 语义；恢复 source UX，不回退安全边界
- Signal 修复必须保留家里 stats/batch/timeline/tier filter，只补开源缺口

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
