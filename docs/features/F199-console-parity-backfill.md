---
feature_ids: [F199]
related_features: [F190, F146, F193, F088, F124]
topics: [console, settings, parity-audit, intake, post-close, secret-write, vapid, github-token]
doc_kind: spec
created: 2026-05-13
parent_feature: F190
trigger: cvo-pushback-post-close
---

# F199: Console Parity Backfill — F190 Phase D

> **Status**: spec | **Owner**: 布偶猫 Opus 4.7 + 缅因猫 GPT-5.5 | **Priority**: P1
> **Parent**: [F190 Console Settings/AppShell Skeleton](F190-console-settings-appshell-skeleton.md) (closed 2026-05-13)
> **Trigger**: CVO push-back 2026-05-13 — F190 close 后发现 settings parity gap

## Why

F190 close (`1039d68a4`) 后 CVO 重启 runtime 用 `/settings` 实测，对比 clowder-ai 开源最新 main，发现 settings/ 目录组件 diff：

```
开源 settings/: 20 components
本地 settings/: 13 components → 缺失 7 个
```

**铲屎官原话（2026-05-13）**：
> "图1是开源的 图2是我们的 这里能证明 你们只是调整了样式 其实很多东西都丢了？"
> "走 Phase D 用 -> 完整 backfill 7 个组件"

7 个缺失分类（详见 [design memo](../discussions/2026-05-13-f190-phase-d-parity-audit/README.md)）：
- 4 个是 F190 **KD-5 deliberate defer** (secret write-back) — 但 CVO close-gate 不知道"通知页变成纯诊断面板"，技术语言"deferred"没映射到用户可见性
- 2 个 SVG 图标 (`box`/`puzzle`) — 真 review miss，已 hotfix via PR #1659 (`d928fb696`)
- 1 个 read-mostly 漏 port — 不该 defer

F190 Phase C 已经把 hardening pattern (`requireExplicitOwner` + `containsRedactedPlaceholder` + `mergeSecretRecord` + audit) 摸清，复用成本低。Permanent defer = 永远比开源功能差一截，每次 outbound sync 还要反向 manual-port，长期心累。Phase D 把剩余 5 个组件 backfill 回家（2 个 SVG 已通过 hotfix close）。

## What

5 个 Phase D slice，按风险从低到高排序（自决 OQ-D3）：

### D-1: ServiceStatusPanel port (read-only)
- Port 开源 `ServiceStatusPanel.tsx`（独立的服务状态面板，比 PluginsContent 更详细）
- 复用 F190 Phase C #2 (Service Manifest read-only) 的 API（`GET /api/services`）
- 不接 lifecycle write（保持 F190 KD-7 边界）

### D-2: SkillsContent 拆分 port (read-mostly)
- Port 开源 `SkillsContent.tsx` 的 read 部分：Skill list + preview + filter
- **不接 external skill uninstall**（这个仍 defer——需要 DELETE skill route auth 独立 review）
- 与 F190 Phase C #3 (refAudio upload) Hub 编辑器集成

### D-3: capability-settings-ui + useCapabilityState + InstallPreviewModal port
- 三个文件配套，调研后决定是否拆刀
- 复用 F190 Phase C #1 (MCP write hardening) 的 owner gate + redacted reject pattern
- 涉及 capability 写路径，必须按 hardening pattern 走

### D-4: PushServiceConfig hardening port
- VAPID 公私钥写入面板 + 一键生成 + contact email
- **复用 IM connector hardening pattern** (F190 Phase C #4)：
  - `requireExplicitOwner` (DEFAULT_OWNER_USER_ID 未配置 → 403)
  - `containsRedactedPlaceholder` 拒写
  - `mergeSecretRecord` 保留 omitted secret
  - audit metadata-only（不入 secret value）
  - F136 hot reload 保留
- 这是 CVO 截图里指出的"通知页变成诊断矩阵"的直接修复

### D-5: GithubConfigPanel hardening port
- GitHub token 写入面板
- 同 D-4 hardening pattern
- 涉及外部 IM provider，注意 SSRF 边界（callback URL 不在本刀范围）

## Acceptance Criteria

### Phase D (All five slices)
- [ ] AC-D1: D-1 ServiceStatusPanel merged，对照开源 visual side-by-side 通过 parity gate (per opensource-ops 原则 22)
- [ ] AC-D2: D-2 SkillsContent (read-mostly) merged，external uninstall 仍 deferred 但有 CVO signoff
- [ ] AC-D3: D-3 capability 三件套 merged，capability 写路径走 hardening pattern
- [ ] AC-D4: D-4 PushServiceConfig merged，用户能在 UI 配置 VAPID + 一键生成 + 联系信箱
- [ ] AC-D5: D-5 GithubConfigPanel merged，用户能在 UI 配置 GitHub token
- [ ] AC-D6: 每刀 close 时产出 User Visibility Disclosure table (per feat-lifecycle Step 0.3.5)
- [ ] AC-D7: F199 整体 close 前，settings/ 开源 vs 本地 `ls` 全对齐 OR 剩余缺失有 CVO 显式 signoff（用 user-visibility 语言披露）

### 红区保护（继承 F190 KD-3）
- [ ] AC-D8: 任一 slice 不触碰 F183/F184/F194 红区文件（denylist grep 命中 = 0）
- [ ] AC-D9: F088/F124 transport runtime 未接管（只动 config 写面）

## Dependencies

- **Parent**: F190 (closed) — 本 feat 是 Phase D backfill
- **Pattern reuse**: F190 Phase C #1 (MCP write) / Phase C #4 (IM connector hardening) — 复用 `requireExplicitOwner` + `containsRedactedPlaceholder` + `mergeSecretRecord` + audit helpers
- **Service Manifest API**: F190 Phase C #2 `GET /api/services` — D-1 直接复用
- **F146** (capability orchestration): D-3 涉及
- **F193** (MCP topology heal): D-3 涉及
- **F136** (config hot reload): D-4/D-5 必须保留

## Risk & Guard

| 风险 | 缓解 |
|------|------|
| Secret 写面引入 SSRF / 凭据泄露 | 严格按 Phase C IM connector hardening pattern 复用——已审过的安全边界 |
| Backfill 漂移到红区 | 每刀 close 前 red-zone grep + denylist check |
| Phase D scope 失控扩大到非 settings/ 文件 | Scope 锁死 `packages/web/src/components/settings/` + 配套 API route |
| 跟 F088/F124 transport runtime 边界混淆 | KD-2 重申：只动 config 写面，不接管 message routing |

## Open Questions (Resolved)

| # | 问题 | 答复 | 来源 |
|---|------|------|------|
| OQ-D1 | reopen F190 vs 开新 F 号？ | ✅ 开新 F 号 F199 | CVO 2026-05-13 |
| OQ-D2 | 完整 backfill vs 选择性？ | ✅ 完整 backfill | CVO 2026-05-13 |
| OQ-D3 | 先开哪刀？ | ✅ D-1 ServiceStatusPanel（猫自决 — 最低风险作为 process 验证刀） | 猫自决 per CVO 2026-05-13 |
| OQ-D4 | SOP 改进先做？ | ✅ Yes — 已 PR #1661 走 review | CVO 2026-05-13 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | F190 Phase D 开新 F 号 F199，不 reopen F190 | F190 已正式 close，reopen 让真相源不稳；Phase D 是 follow-up 性质 | 2026-05-13 |
| KD-2 | 完整 backfill 5 个剩余组件（2 SVG 已 hotfix） | 永久 defer 长期心累，hardening pattern 已摸清，复用成本低 | 2026-05-13 |
| KD-3 | D-1 ServiceStatusPanel 先开（猫自决，CVO 不管） | 最低风险，验证新 SOP（parity gate + User Visibility Disclosure）在小 slice 上跑通后再做高风险 secret write | 2026-05-13 |
| KD-4 | D-4/D-5 secret write 复用 IM connector hardening pattern | Pattern 已审过，新增刀降低 review 成本 | 2026-05-13 |
| KD-5 | 不接 callback URL / provider endpoint 写面（OQ-D 同 F190 IM connector） | 避免扩面 SSRF 边界，本 feat 只补现有 secret credential 写 UI | 2026-05-13 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-13 | CVO push-back 暴露 F190 settings parity gap；砚砚 SVG hotfix merged via PR #1659 |
| 2026-05-13 | F190 reflection capsule 扩充（视觉 parity 教训）pushed `e84a9c241` |
| 2026-05-13 | Phase D design memo pushed `c9a7cfcf3` |
| 2026-05-13 | SOP 改进 PR #1661 opened (3 skill files, 4 lessons encoded) |
| 2026-05-13 | F199 spec 立项 |

## Review Gate

- **每个 D-N slice** 走完整 SOP：worktree → tdd → quality-gate → request-review → receive-review → merge-gate
- **每刀 close** 必须产出 User Visibility Disclosure table（per 升级后 feat-lifecycle Step 0.3.5）
- **F199 整体 close** 必须 side-by-side 开源 vs 本地 settings 全对齐（per 升级后 opensource-ops 原则 22）+ 守护猫验 functional parity（per 升级后 shared-rules §9 rule 7）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Parent Feature** | `docs/features/F190-console-settings-appshell-skeleton.md` | F190 closed |
| **Design Memo** | `docs/discussions/2026-05-13-f190-phase-d-parity-audit/README.md` | 7 缺失组件分类 + 路径选择 |
| **Reflection (extended)** | `docs/reflections/2026-05-13-f190-console-settings-intake-capsule.md` | 视觉 parity 教训沉淀 |
| **SOP Update PR** | `cat-cafe#1661` | opensource-ops + feat-lifecycle + shared-rules 改进 |
| **SVG Hotfix PR** | `cat-cafe#1659` (`d928fb696`) | 已合，box/puzzle 图标补回 |
| **Source PR** | `clowder-ai#669` | 缺失 5 组件的开源来源 |
