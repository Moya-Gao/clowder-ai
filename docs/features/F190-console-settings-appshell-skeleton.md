---
feature_ids: [F190]
related_features: [F056, F063, F116, F183, F184]
topics: [console, settings, app-shell, community, inbound-pr, frontend]
doc_kind: spec
created: 2026-05-07
community_pr: clowder-ai#645, clowder-ai#662, clowder-ai#669
---

# F190: Console Settings/AppShell Skeleton — 社区 Console 重构的可控切片

> **Status**: in-progress | **Owner**: Community + Maintainers | **Priority**: P1

## Why

社区 PR [clowder-ai#645](https://github.com/zts212653/clowder-ai/pull/645) 提供了一个有价值的方向：把旧 Hub/modal 式配置入口升级为 macOS System Settings 风格的 Console/AppShell + Settings rail，并附带 Pencil 设计稿。

但 #645 当前把 Settings shell、Service Manifest、voice refAudio、MCP 管理、IM 配置、Mission Hub 改造、F183/F184 敏感聊天渲染链路、以及 feature 编号迁移混在一个大 PR 中。即使 CI 变绿，仍然不可作为 merge candidate。F190 的目标是把其中**用户可感知且方向正确的 Console/Settings skeleton**提炼成可 review、可回滚、不会覆盖家里 invariants 的第一片。

## What

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
| AppShell / ActivityBar / Settings skeleton | clowder-ai#662 | 已合入 main；当前 staging 基于该 commit 继续 | Phase A |
| Rules/SOP settings | clowder-ai#669 | staging manual-port | read-only |
| Ops subtabs | clowder-ai#669 | staging manual-port | wrapper + existing panels |
| Marketplace settings | clowder-ai#669 | staging manual-port | existing marketplace panel |
| MCP settings entry | clowder-ai#669 | staging manual-port | read-only capability board filter；不接写接口 |
| Skill preview modal | clowder-ai#669 | staging manual-port | read-only `SKILL.md` preview |
| MCP install/manage write path hardening | clowder-ai#669 + home F146/F193 route | Phase C review branch `feat/f190-mcp-write-hardening` | owner-gated secret write hardening；不接 Plugins UI 写回 |
| Plugins / Service Manifest / refAudio / secret write-back | clowder-ai#669 | deferred | F190 Phase C high-risk slices，需单独 security review + proof |
| Chat rendering / bubble behavior | clowder-ai#669 | not in F190 | F183/F184/F194 ownership；F190 不触碰 |

Current staging branch: `intake/f190-followup-stage`.

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
- [ ] AC-A7: alpha 走查 `/settings`、`/settings?s=members`、`/settings?s=mcp`、`/settings?s=ops`，无 blocking console error，且旧 chat 首页可继续进入。

### Phase B（Settings Section Migrations）
- [ ] AC-B1: 每个 settings section 独立 PR，单 PR 不超过一个业务域。
- [ ] AC-B2: 每个 section PR 写清 `Source Behavior`、`Must Preserve Home Behavior`、`Proof`。
- [ ] AC-B3: 涉及 high-risk 文件（route 注册、auth/callback、env registry、allowlist、service lifecycle）时必须走 manual-port review。

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

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | F190 只接收 Console/Settings skeleton 第一片，不接收 #645 whole diff | 方向有价值，但 #645 混入 500+ files、F183/F184 敏感路径和重复 feature 编号 | 2026-05-07 |
| KD-2 | #645 保留为 prototype/reference，新 PR 从最新 main 开 clean branch | clean diff 才能让 reviewer 验证“不改原本东西”；在大 PR 内删改审计成本更高 | 2026-05-07 |
| KD-3 | Phase A denylist 硬卡 ChatMessage / ChatContainer / chatStore / thread route | 这些路径受 F183/F184 保护，Console shell 不应触碰聊天渲染/mount invariants | 2026-05-07 |
| KD-4 | #662 + #669 是当前社区路径；家里 intake 采用 staging branch manual-port，不直接 overlay #669 | #669 是大 follow-up，source 已验证但与家里 F183/F184/F194/F195 分叉，需要逐 slice replay source intent | 2026-05-12 |
| KD-5 | Service Manifest / refAudio / secret write-back 是 F190 Phase C high-risk deferred surface；chat rendering 归 F183/F184/F194 ownership | 服务生命周期、音频文件、secret 写回必须独立 slice + security review + focused proof；气泡/read model 不是 F190 责任面，F190 不触碰。如未来正式立项独立 feature，可迁出到新 F 号，由 maintainer 评估 | 2026-05-12 |
| KD-6 | MCP write path 第一刀只硬化现有 `capabilitiesMcpWriteRoutes`，不新增并行写路径 | 复用 F146/F193 既有 lock/read/write/audit/topology heal；先锁住 secret 丢失、placeholder 写入、owner gate，再单独做 UI 写回 | 2026-05-12 |

## Known Limitations

| # | 限制 | 当前处置 | 后续候选 |
|---|------|----------|----------|
| KL-1 | MCP env patch / install update 只新增或覆盖 env/header secret，不删除单个 env key | 保护现有 secret 不被 UI omit 清空；删除需求暂不混入本安全 slice | 独立设计 `DELETE /api/capabilities/mcp/:id/env/:key` 或 PATCH `null` 删除语义 |
| KL-2 | install/delete 是 owner-configured enforcement；未配置 `DEFAULT_OWNER_USER_ID` 的多用户/LAN 部署仍沿用既有身份 gate | 保持 localhost/dev 兼容，secret env patch 已 fail-closed | UI/ops docs 明确多用户部署必须配置 `DEFAULT_OWNER_USER_ID`；可加 telemetry warning |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-07 | F190 立项，占位社区 Console/Settings skeleton intake 方向 |
| 2026-05-12 | #662 已回流；#669 开始在 `intake/f190-followup-stage` 按 manual-port 逐 slice 吸收 |

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
| **Skill ref** | `cat-cafe-skills/refs/f190-frontend-lessons.md` | F190 前端 intake 教训 |
| **Feature** | `docs/features/F056-cat-cafe-design-language.md` | 设计语言约束 |
| **Feature** | `docs/features/F183-bubble-pipeline-architecture-consolidation.md` | 聊天渲染链路保护 |
| **Feature** | `docs/features/F184-chatmessage-rendering-mount-investigation.md` | ChatMessage mount 回归保护 |
