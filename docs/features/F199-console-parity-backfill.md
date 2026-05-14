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

> **Status**: in-progress (D-1/D-2/D-3a merged; D-3b MCP settings UI parity review-ready) | **Owner**: 布偶猫 Opus 4.7 + 缅因猫 GPT-5.5 | **Priority**: P1
> **Parent**: [F190 Console Settings/AppShell Skeleton](F190-console-settings-appshell-skeleton.md) (closed 2026-05-13)
> **Trigger**: CVO push-back 2026-05-13 — F190 close 后发现 settings parity gap

Architecture cell: action-plane
Map delta: none — F199 backfills existing Console settings surfaces; D-2 is read-mostly and does not introduce a new action owner or capability writer.

## Why

F190 close (`1039d68a4`) 后 CVO 重启 runtime 用 `/settings` 实测，对比 clowder-ai 开源最新 main，发现 settings/ 目录组件 diff：

```
开源 settings/: 20 components
本地 settings/: 13 components → 缺失 7 个
```

**铲屎官原话（2026-05-13）**：
> "图1是开源的 图2是我们的 这里能证明 你们只是调整了样式 其实很多东西都丢了？"
> "走 Phase D 用 -> 完整 backfill 7 个组件"

**事故事实模型 — 两个独立维度，不同分母**（详见 [design memo](../discussions/2026-05-13-f190-phase-d-parity-audit/README.md)）：

**维度 A: 组件级 surface gap（`ls settings/` diff）**
- 初始开源 20 vs 本地 13 = **7 个组件级 gap**
- D-3 design 复核后重算为 **6 个 F199 backfill gap + 1 个 service lifecycle write reclassified-out**：
  - F199 内继续处理：ServiceStatusPanel / SkillsContent read 部分 / `capability-settings-ui` / restricted `useCapabilityState` / PushServiceConfig / GithubConfigPanel
  - F199 外移除：`InstallPreviewModal`（service lifecycle install/start/stop 写面，不属于 capability settings）
- 内部分类：
  - 4 个是 F190 **KD-5 deliberate defer** (secret write-back / capability write) — 但 CVO close-gate 不知道"通知页变成纯诊断面板"，技术语言"deferred"没映射到用户可见性
  - 3 个是 read-mostly/配套项，本该 port 没 port (ServiceStatusPanel / SkillsContent read 部分 / useCapabilityState)，其中 useCapabilityState 只允许 restricted MCP settings 形态进入 F199

**维度 B: 路径级 path 漏挂（`hub-icons.tsx` 内）**
- **2 个 SVG icon path 缺失**（`box` / `puzzle`） — 真 review miss，已 hotfix via PR #1659 (`d928fb696`)
- **这跟维度 A 不在同一组成**：SVG paths 是 `hub-icons.tsx` 内部常量，不是独立组件文件

F190 Phase C 已经把 hardening pattern (`requireExplicitOwner` + `containsRedactedPlaceholder` + `mergeSecretRecord` + audit) 摸清，复用成本低。Permanent defer = 永远比开源功能差一截，每次 outbound sync 还要反向 manual-port，长期心累。Phase D 把维度 A 中仍属于 settings parity 的 **6 个组件级 surface backfill 回家**，并把不属于本 feat 的 `InstallPreviewModal` 显式披露为 service lifecycle write reclassification（维度 B 的 2 SVG 不在本 feat 范围，已独立 hotfix close）。

## What

5 个 Phase D product slice，按风险从低到高排序（自决 OQ-D3）；其中 D-3 拆成 D-3a/D-3b 两个独立 review slice：

### D-1: ServiceStatusPanel port (read-only)
- Port 开源 `ServiceStatusPanel.tsx`（独立的服务状态面板，比 PluginsContent 更详细）
- 复用 F190 Phase C #2 (Service Manifest read-only) 的 API（`GET /api/services`）
- 不接 lifecycle write（保持 F190 KD-7 边界）

### D-2: SkillsContent 拆分 port (read-mostly)
- Port 开源 `SkillsContent.tsx` 的 read 部分：Skill list + preview + filter
- **不接 external skill uninstall**（这个仍 defer——需要 DELETE skill route auth 独立 review）
- 与 F190 Phase C #3 (refAudio upload) Hub 编辑器集成

### D-3a: Capability write hardening (backend-first)
- 不做 visual parity claim；先收紧现有 capability 写 API，避免 UI 接到不安全 backend
- 复用 F190 Phase C #1/#4 hardening pattern：
  - session-only identity（不接受 trusted header / fallback 作为写身份）
  - `requireExplicitOwner` fail-closed (`DEFAULT_OWNER_USER_ID` 未配置 → 403)
  - `containsRedactedPlaceholder` 拒写
  - `mergeSecretRecord` 保留 omitted env/header secret
  - audit 写入前统一 sanitize，保留 env/header key name，value 替换为 stable redacted marker
- 覆盖现有写路由：
  - `PATCH /api/capabilities`
  - `POST /api/capabilities/mcp/preview`
  - `POST /api/capabilities/mcp/install`
  - `DELETE /api/capabilities/mcp/:id`
  - `PATCH /api/capabilities/mcp/:id/env`
- 保留 `GET /api/capabilities` / `GET /api/capabilities/audit` 为 read route
- 保留 F193 heal-before-write behavior

### D-3b: MCP settings UI parity
- 在 D-3a secure backend 上 port MCP settings UI parity
- Port `capability-settings-ui.tsx` UI primitives
- Port restricted `useCapabilityState`：只覆盖 MCP settings，不接 Skills 写面
- 视 parity 需要 port `McpConfigModal.tsx` / `mcp-form-helpers.tsx`
- 替换或收敛 `McpManageContent` 当前 wrapper
- 不 port `InstallPreviewModal`
- 不 wire Skills toggle/uninstall，D-2 `SkillsContent` 保持 read-mostly

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
- [x] AC-D1: D-1 ServiceStatusPanel merged，对照开源 visual side-by-side 通过 parity gate (per opensource-ops 原则 22)
- [x] AC-D2: D-2 SkillsContent (read-mostly) merged，external uninstall 仍 deferred 但有 CVO signoff
- [x] AC-D3a: D-3a capability write hardening merged；所有 capability write routes owner-gated fail-closed，audit JSONL / `/api/capabilities/audit` 不含 raw env/header secret
- [ ] AC-D3b: D-3b MCP settings UI parity merged；restricted MCP-only `useCapabilityState` + capability settings controls 对齐开源，`InstallPreviewModal` / Skills write actions 不进入 F199
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
- **F146** (capability orchestration): D-3a/D-3b 涉及
- **F193** (MCP topology heal): D-3a 必须保留 heal-before-write
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
| OQ-D5 | D-3 一刀做完还是拆？ | ✅ 拆成 D-3a backend hardening + D-3b UI parity | D-3 design review 2026-05-13 |
| OQ-D6 | MCP preview 是否 owner-gated？ | ✅ Yes，preview 接收 secret-like payload，按 write surface fail-closed | D-3 design review 2026-05-13 |
| OQ-D7 | capability audit 用 metadata-only 还是 before/after？ | ✅ 保留 sanitized before/after；env/header key name 保留，value redacted | D-3 design review 2026-05-13 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | F190 Phase D 开新 F 号 F199，不 reopen F190 | F190 已正式 close，reopen 让真相源不稳；Phase D 是 follow-up 性质 | 2026-05-13 |
| KD-2 | 完整处理维度 A gap：6 个 settings parity backfill + 1 个 service lifecycle reclassified-out disclosure | 永久 defer 长期心累，hardening pattern 已摸清，复用成本低；但 `InstallPreviewModal` 不属于 capability settings，不能为凑数打穿 D-1 read-only 边界。维度 B (2 SVG path) 已独立 hotfix close，不属本 feat | 2026-05-13 |
| KD-3 | D-1 ServiceStatusPanel 先开（猫自决，CVO 不管） | 最低风险，验证新 SOP（parity gate + User Visibility Disclosure）在小 slice 上跑通后再做高风险 secret write | 2026-05-13 |
| KD-4 | D-4/D-5 secret write 复用 IM connector hardening pattern | Pattern 已审过，新增刀降低 review 成本 | 2026-05-13 |
| KD-5 | 不接 callback URL / provider endpoint 写面（OQ-D 同 F190 IM connector） | 避免扩面 SSRF 边界，本 feat 只补现有 secret credential 写 UI | 2026-05-13 |
| KD-6 | D-3 拆成 D-3a backend hardening + D-3b UI parity | capability 写路径首次进入 F199 高风险区，先堵 P0 secret/audit/auth，再扩 UI | 2026-05-13 |
| KD-7 | `InstallPreviewModal` reclassify out of F199 | 它属于 ServiceStatusPanel lifecycle install/start/stop 写面；D-1 已锁 read-only，不能用 D-3 打穿边界 | 2026-05-13 |
| KD-8 | `useCapabilityState` 只允许 restricted MCP settings 形态进入 D-3b | 源 hook 混 MCP/Skills read/write；Skills toggle/uninstall 会打穿 D-2 read-mostly promise | 2026-05-13 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-13 | CVO push-back 暴露 F190 settings parity gap；砚砚 SVG hotfix merged via PR #1659 |
| 2026-05-13 | F190 reflection capsule 扩充（视觉 parity 教训）pushed `e84a9c241` |
| 2026-05-13 | Phase D design memo pushed `c9a7cfcf3` |
| 2026-05-13 | SOP 改进 PR #1661 opened (3 skill files, 4 lessons encoded) |
| 2026-05-13 | F199 spec 立项 |
| 2026-05-13 | D-1 ServiceStatusPanel merged via PR #1662 (`0df783473`); visual parity proof + User Visibility Disclosure attached; local reviewer + cloud review passed |
| 2026-05-13 | D-2 SkillsContent read-mostly merged via PR #1663 (`1e4a96951`); visual parity proof + User Visibility Disclosure attached; local reviewer + cloud review passed |
| 2026-05-13 | D-3 design memo pushed (`04fdc3e00`); found `InstallPreviewModal` misclassification + capability audit raw secret P0 |
| 2026-05-13 | F199 spec synced to D-3a/D-3b split + `InstallPreviewModal` reclassification |
| 2026-05-13 | D-3a capability write hardening merged via PR #1664 (`be2c406cc`); audit secret leak + owner-gate P0 fixed; local reviewer + cloud review passed |
| 2026-05-14 | D-3b MCP settings UI parity review-ready; source-style MCP settings UI + visual proof attached |

## Review Gate

- **每个 D-N slice** 走完整 SOP：worktree → tdd → quality-gate → request-review → receive-review → merge-gate
- **D-3a/D-3b 分别独立 review/merge**：D-3b 不得在 D-3a 合入前扩大 UI 写入口
- **每刀 close** 必须产出 User Visibility Disclosure table（per 升级后 feat-lifecycle Step 0.3.5）
- **F199 整体 close** 必须 side-by-side 开源 vs 本地 settings 全对齐（per 升级后 opensource-ops 原则 22）+ 守护猫验 functional parity（per 升级后 shared-rules §9 rule 7）+ `InstallPreviewModal` 以 user-visible disclosure 明确为 F199 外 service lifecycle write

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Parent Feature** | `docs/features/F190-console-settings-appshell-skeleton.md` | F190 closed |
| **Design Memo** | `docs/discussions/2026-05-13-f190-phase-d-parity-audit/README.md` | 7 缺失组件分类 + 路径选择 |
| **Reflection (extended)** | `docs/reflections/2026-05-13-f190-console-settings-intake-capsule.md` | 视觉 parity 教训沉淀 |
| **SOP Update PR** | `cat-cafe#1661` | opensource-ops + feat-lifecycle + shared-rules 改进 |
| **SVG Hotfix PR** | `cat-cafe#1659` (`d928fb696`) | 已合，box/puzzle 图标补回 |
| **D-1 PR** | `cat-cafe#1662` (`0df783473`) | ServiceStatusPanel read-only backfill |
| **D-1 Proof** | `docs/discussions/2026-05-13-f199-d1-service-status-panel-proof/README.md` | visual parity + User Visibility Disclosure |
| **D-2 PR** | `cat-cafe#1663` (`1e4a96951`) | SkillsContent read-mostly backfill |
| **D-2 Proof** | `docs/discussions/2026-05-13-f199-d2-skills-content-proof/README.md` | visual parity + User Visibility Disclosure |
| **D-3 Design** | `docs/discussions/2026-05-13-f199-d3-capability-settings-design/README.md` | D-3a/D-3b split + boundary corrections |
| **D-3a PR** | `cat-cafe#1664` (`be2c406cc`) | capability write hardening |
| **D-3a Proof** | `docs/discussions/2026-05-13-f199-d3a-capability-write-hardening-proof/README.md` | backend hardening + User Visibility Disclosure |
| **D-3b Proof** | `docs/discussions/2026-05-13-f199-d3b-mcp-settings-ui-proof/README.md` | MCP settings UI parity + User Visibility Disclosure |
| **Source PR** | `clowder-ai#669` | 缺失 5 组件的开源来源 |
