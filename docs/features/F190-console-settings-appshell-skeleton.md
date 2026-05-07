---
feature_ids: [F190]
related_features: [F056, F063, F116, F183, F184]
topics: [console, settings, app-shell, community, inbound-pr, frontend]
doc_kind: spec
created: 2026-05-07
community_pr: clowder-ai#645
---

# F190: Console Settings/AppShell Skeleton — 社区 Console 重构的可控切片

> **Status**: spec | **Owner**: Community + Maintainers | **Priority**: P1

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

Service Manifest、MCP install/manage、voice refAudio upload、IM connector write endpoints 等属于后续独立 feature/PR，不并入 Phase A。

## Acceptance Criteria

### Phase A（Settings/AppShell Skeleton）
- [ ] AC-A1: `clowder-ai#645` 标记为 prototype/reference，不作为 merge candidate；新的 skeleton PR 从最新 `clowder-ai main` 创建。
- [ ] AC-A2: 新 PR 只包含 Settings/AppShell skeleton、设计 token、Pencil/design docs；不得迁移 Service Manifest、voice refAudio、IM write endpoints、Mission Hub parity 等业务逻辑。
- [ ] AC-A3: 新 PR diff 不包含 F183/F184 敏感路径：
  - `packages/web/src/components/ChatMessage.tsx`
  - `packages/web/src/components/ChatContainer.tsx`
  - `packages/web/src/components/ChatContainerHeader.tsx`
  - `packages/web/src/stores/chatStore.ts`
  - `packages/web/src/app/(chat)/thread/[threadId]/page.tsx`
- [ ] AC-A4: 新 PR 不 rename / overwrite 既有 feature docs，不新增重复 `feature_ids`；尤其不得改动 F179/F185/F186 既有真相源。
- [ ] AC-A5: 新 PR 必须通过 `pnpm check:features`，并针对 Settings/AppShell 导航补充 focused web tests。
- [ ] AC-A6: F183/F184 路由与 mount 保护测试保持通过；thread route marker 必须继续使用真实 `threadId`。
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
| OQ-1 | Phase A skeleton 是否由社区贡献者重提，还是 maintainer 手工 port？ | ⬜ 等社区响应 |
| OQ-2 | Settings section 迁移顺序如何排？ | ⬜ Phase A 后决定 |
| OQ-3 | Service Manifest 是否单独分配 feature 编号，还是作为 F190 Phase C follow-up？ | ⬜ 等架构决策 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | F190 只接收 Console/Settings skeleton 第一片，不接收 #645 whole diff | 方向有价值，但 #645 混入 500+ files、F183/F184 敏感路径和重复 feature 编号 | 2026-05-07 |
| KD-2 | #645 保留为 prototype/reference，新 PR 从最新 main 开 clean branch | clean diff 才能让 reviewer 验证“不改原本东西”；在大 PR 内删改审计成本更高 | 2026-05-07 |
| KD-3 | Phase A denylist 硬卡 ChatMessage / ChatContainer / chatStore / thread route | 这些路径受 F183/F184 保护，Console shell 不应触碰聊天渲染/mount invariants | 2026-05-07 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-07 | F190 立项，占位社区 Console/Settings skeleton intake 方向 |

## Review Gate

- Phase A PR：必须由 maintainer 以 inbound PR 口径 review；先核 diff allowlist/denylist，再看 UI。
- Phase B/C PR：每个业务域单独 review；high-risk 文件默认 manual-port。

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Community PR** | `clowder-ai#645` | Console Architecture Restructure prototype |
| **Feature** | `docs/features/F056-cat-cafe-design-language.md` | 设计语言约束 |
| **Feature** | `docs/features/F183-bubble-pipeline-architecture-consolidation.md` | 聊天渲染链路保护 |
| **Feature** | `docs/features/F184-chatmessage-rendering-mount-investigation.md` | ChatMessage mount 回归保护 |
