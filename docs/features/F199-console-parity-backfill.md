---
feature_ids: [F199]
related_features: [F190, F146, F193, F088, F124]
topics: [console, settings, parity-audit, intake, post-close, secret-write, vapid, github-token, service-lifecycle, skills-write, reopened]
doc_kind: spec
created: 2026-05-13
parent_feature: F190
trigger: cvo-pushback-post-close
---

# F199: Console Parity Backfill — F190 Phase D

> **Status**: in-progress (Phase E reopened) | **Reopened**: 2026-05-14 | **Owner**: 布偶猫 Opus 4.7 + 缅因猫 GPT-5.5 | **Priority**: P1
> **Parent**: [F190 Console Settings/AppShell Skeleton](F190-console-settings-appshell-skeleton.md) (closed 2026-05-13)
> **Trigger**: CVO push-back 2026-05-13 — F190 close 后发现 settings parity gap

> **Reopen correction (2026-05-14)**: D-1..D-5 close evidence remains valid for the first F199 pass, but CVO challenged the "out of F199" treatment for `InstallPreviewModal` and Skills write actions. Corrected rule: **different security boundary decides slice design, not feature ownership**. Service lifecycle install/start/stop and Skills sync/resolve/uninstall are now F199 Phase E, not ownerless follow-up candidates.

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
- D-3 design 复核后曾重算为 **6 个 F199 backfill gap + 1 个 service lifecycle write reclassified-out**：
  - F199 内继续处理：ServiceStatusPanel / SkillsContent read 部分 / `capability-settings-ui` / restricted `useCapabilityState` / PushServiceConfig / GithubConfigPanel
  - F199 外移除：`InstallPreviewModal`（service lifecycle install/start/stop 写面，不属于 capability settings）
- 内部分类：
  - 4 个是 F190 **KD-5 deliberate defer** (secret write-back / capability write) — 但 CVO close-gate 不知道"通知页变成纯诊断面板"，技术语言"deferred"没映射到用户可见性
  - 3 个是 read-mostly/配套项，本该 port 没 port (ServiceStatusPanel / SkillsContent read 部分 / useCapabilityState)，其中 useCapabilityState 只允许 restricted MCP settings 形态进入 F199

**2026-05-14 纠偏**：上面的 `InstallPreviewModal` reclassification 只说明它不能塞进 D-1 read-only slice；不说明它应该离开 F199。CVO 明确指出："难道不是 f199 的下一个 phase？"。因此 `InstallPreviewModal` 和 Skills write actions 进入 Phase E，按高风险写面重新拆刀、review、proof，不降低安全标准。

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

### E-0: Phase E design gate (reopen correction)
- 记录 CVO 对 `InstallPreviewModal` / Skills write actions 的 Phase E ownership 判断
- 对照开源 `ServiceStatusPanel` + `InstallPreviewModal` + `useCapabilityState('skill')`
- 对照本地现状：`/api/services` 只有 read routes；`/api/skills/sync` / `resolve-conflict` 已存在但只有 identity gate；Settings `SkillsContent` 仍 read-mostly
- 产出 threat model + slice plan，先给跨猫 reviewer 看边界

### E-1: Service lifecycle settings parity
- Port source-style `InstallPreviewModal` + service lifecycle controls
- Backend 不直接照搬 spawn surface；先引入 hardened service lifecycle owner gate：
  - session-only identity + explicit owner fail-closed
  - service id allowlist only (`SERVICE_MANIFESTS` / known service registry)
  - per-service lifecycle mutex（并发 install/uninstall/start/stop/toggle 返回 409，不重叠 spawn）
  - script path resolve limited to repo-owned `scripts/services/*`
  - strict process matching（不采用 `mlx` 这类 prefix fallback）
  - model id validation, timeout cap, port-busy refusal, and bounded log output
  - audit metadata-only (service id/action/model key presence, no raw command/env)
- Local prerequisite: home currently lacks source `domains/services/service-registry.ts`, `service-config.ts`, `service-logs.ts`, `process-utils.ts`, `service-autostart.ts`, and `scripts/services/*`; E-1 must port or redesign these as a coherent service lifecycle cell before exposing UI buttons.

### E-2: Skills write actions parity
- Port source-style Skills write actions into Settings Skills surface:
  - sync managed skills
  - resolve conflict (`official` / `mine`)
  - uninstall / disable managed skill only if backend hardening exists
- Backend hardening before UI expansion:
  - explicit owner fail-closed, not just generic identity
  - project path validation remains mandatory
  - skill name validation remains mandatory
  - managed-skill only for destructive operations
  - audit metadata-only (skill name/action/project path class; no file content)
- D-2 read-mostly promise becomes "D-2 stayed read-only; E-2 is the explicit write slice", not "Skills write is outside F199".

## Acceptance Criteria

### Phase D (D-1..D-5 first pass)
- [x] AC-D1: D-1 ServiceStatusPanel merged，对照开源 visual side-by-side 通过 parity gate (per opensource-ops 原则 22)
- [x] AC-D2: D-2 SkillsContent (read-mostly) merged，external uninstall 仍 deferred 但有 CVO signoff
- [x] AC-D3a: D-3a capability write hardening merged；所有 capability write routes owner-gated fail-closed，audit JSONL / `/api/capabilities/audit` 不含 raw env/header secret
- [x] AC-D3b: D-3b MCP settings UI parity merged；restricted MCP-only `useCapabilityState` + capability settings controls 对齐开源，`InstallPreviewModal` / Skills write actions 不进入 F199
- [x] AC-D4: D-4 PushServiceConfig merged，用户能在 UI 配置 VAPID + 一键生成 + 联系信箱
- [x] AC-D5: D-5 GithubConfigPanel merged，用户能在 UI 配置 GitHub token
- [x] AC-D6: 每刀 close 时产出 User Visibility Disclosure table (per feat-lifecycle Step 0.3.5)
- [x] AC-D7: D-1..D-5 close 前，settings/ 开源 vs 本地 `ls` diff 仅剩 `InstallPreviewModal.tsx`，当时按 KD-7 披露为 out-of-scope；**superseded by Phase E reopen**

### 红区保护（继承 F190 KD-3）
- [x] AC-D8: 任一 slice 不触碰 F183/F184/F194 红区文件（denylist grep 命中 = 0）
- [x] AC-D9: F088/F124 transport runtime 未接管（只动 config 写面）

### Phase E (reopened parity writes)
- [x] AC-E0: CVO explicit reopen captured: `InstallPreviewModal` + Skills write actions are F199 Phase E, not ownerless follow-up
- [ ] AC-E1: Phase E design memo reviewed by non-author reviewer before implementation
- [ ] AC-E2: Service lifecycle backend has explicit owner fail-closed, service allowlist, per-service mutex, script path confinement, strict process matching, model validation, install/uninstall timeout cap, port-busy refusal, bounded logs, and metadata-only audit
- [ ] AC-E3: Settings service UI exposes install/start/stop/uninstall only on hardened backend; `InstallPreviewModal` visual proof covers prerequisites/model selection/error/fail-closed states
- [ ] AC-E4: Skills write backend has explicit owner fail-closed, project path validation, skill name validation, managed-skill destructive guard, and metadata-only audit
- [ ] AC-E5: Settings Skills UI exposes sync / conflict resolution / managed uninstall or disable with user-visible errors and proof that D-2 read surfaces still work
- [ ] AC-E6: F199 final close gate reruns source settings diff, User Visibility Disclosure, red-zone grep, transport boundary check, and independent vision guardian after Phase E merge; close report must disclose a guardian handle that is not Phase E author and not Phase E reviewer (cross-family preferred)
- [ ] AC-E7: Phase E does not touch F183/F184/F194 red-zone files and does not take over F088/F124 message routing/runtime ownership

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
| Service lifecycle spawn surface 引入任意命令执行 | E-1 backend 必须 service allowlist + repo-owned script path confinement + owner fail-closed 后再接 UI |
| Service lifecycle 并发 install/uninstall 撕裂 venv / 日志 / port | E-1a 必须 per-service mutex；并发 lifecycle write 返回 409 |
| Stop 操作误杀同前缀进程 | E-1a 只允许 strict basename/path match；不采用开源 `prefix.length >= 3` fallback |
| Install/uninstall 脚本 hang 死 HTTP request | E-1a 必须 server-side timeout cap + bounded tail logs |
| Worktree/runtime 同时运行端口竞用 | E-1a start/auto-start 前 port-busy refusal；proof disclosure 写明当前进程树边界 |
| Skills write 操作误删用户自有 skill | E-2 destructive actions 只允许 managed-skill；冲突 resolve 保留 `official` / `mine` 显式选择 |

## Open Questions (Resolved)

| # | 问题 | 答复 | 来源 |
|---|------|------|------|
| OQ-D1 | reopen F190 vs 开新 F 号？ | ✅ 最终保留 F199；但开新 F 号本身是 Opus-47 未经 CVO 显式 signoff 的误判，CVO 2026-05-14 追认 keep F199 | Correction 2026-05-14 |
| OQ-D2 | 完整 backfill vs 选择性？ | ✅ 完整 backfill | CVO 2026-05-13 |
| OQ-D3 | 先开哪刀？ | ✅ D-1 ServiceStatusPanel（猫自决 — 最低风险作为 process 验证刀） | 猫自决 per CVO 2026-05-13 |
| OQ-D4 | SOP 改进先做？ | ✅ Yes — 已 PR #1661 走 review | CVO 2026-05-13 |
| OQ-D5 | D-3 一刀做完还是拆？ | ✅ 拆成 D-3a backend hardening + D-3b UI parity | D-3 design review 2026-05-13 |
| OQ-D6 | MCP preview 是否 owner-gated？ | ✅ Yes，preview 接收 secret-like payload，按 write surface fail-closed | D-3 design review 2026-05-13 |
| OQ-D7 | capability audit 用 metadata-only 还是 before/after？ | ✅ 保留 sanitized before/after；env/header key name 保留，value redacted | D-3 design review 2026-05-13 |
| OQ-E1 | `InstallPreviewModal` / Skills write actions 是 out-of-F199 还是 F199 下一 phase？ | ✅ F199 Phase E。安全边界不同决定独立 hardening slice，不决定离开 F199 | CVO 2026-05-14 |
| OQ-E2 | ThreadSidebar 集成路径差异是否进入 Phase E？ | ✅ No。家里 `app/(chat)/layout.tsx` 与开源 AppShell opt-out 行为等价，且触碰 F183/F184/F194 红区收益不成立 | Guardian 2026-05-14 |
| OQ-E3 | `--cafe-accent-hover` token drift 是否进入 Phase E？ | ✅ No。视觉 token 数值差属于后续 brand/visual alignment 判断，不是功能 parity gap | Guardian 2026-05-14 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | F199 最终保留为 F190 Phase D 实施容器；未来开新 F 号 / reopen / rename feature anchor 必须 CVO 显式 signoff | 事后确认：Opus-47 原先按 design memo 推荐自决开 F199 是流程错误；CVO 2026-05-14 选择 keep F199，避免已合历史重写 | 2026-05-14 |
| KD-2 | 完整处理维度 A gap：6 个 settings parity backfill + 1 个 service lifecycle reclassified-out disclosure | 永久 defer 长期心累，hardening pattern 已摸清，复用成本低；但 `InstallPreviewModal` 不属于 capability settings，不能为凑数打穿 D-1 read-only 边界。维度 B (2 SVG path) 已独立 hotfix close，不属本 feat | 2026-05-13 |
| KD-3 | D-1 ServiceStatusPanel 先开（猫自决，CVO 不管） | 最低风险，验证新 SOP（parity gate + User Visibility Disclosure）在小 slice 上跑通后再做高风险 secret write | 2026-05-13 |
| KD-4 | D-4/D-5 secret write 复用 IM connector hardening pattern | Pattern 已审过，新增刀降低 review 成本 | 2026-05-13 |
| KD-5 | 不接 callback URL / provider endpoint 写面（OQ-D 同 F190 IM connector） | 避免扩面 SSRF 边界，本 feat 只补现有 secret credential 写 UI | 2026-05-13 |
| KD-6 | D-3 拆成 D-3a backend hardening + D-3b UI parity | capability 写路径首次进入 F199 高风险区，先堵 P0 secret/audit/auth，再扩 UI | 2026-05-13 |
| KD-7 | `InstallPreviewModal` initially reclassified out of D-1/D-3 | Superseded by KD-9. 原判断只适用于"不能塞进 read-only / capability settings slice"，不适用于"离开 F199" | 2026-05-13 / corrected 2026-05-14 |
| KD-8 | `useCapabilityState` 只允许 restricted MCP settings 形态进入 D-3b | 源 hook 混 MCP/Skills read/write；Skills toggle/uninstall 会打穿 D-2 read-mostly promise | 2026-05-13 |
| KD-9 | Reopen F199 Phase E for `InstallPreviewModal` + Skills write actions | CVO 明确指出它们仍是 F190/F199 parity gap；"需要独立 hardening"是 HOW，不是 WHERE | 2026-05-14 |
| KD-10 | ThreadSidebar and token drift stay out of Phase E | ThreadSidebar 行为等价且红区敏感；token drift 是 brand/visual alignment 判断，不是 missing capability | 2026-05-14 |
| KD-11 | E-1a must exceed source service lifecycle safety baseline | Open-source lifecycle routes lack per-service mutex, strict bounded path/process checks, and timeout cap; home inherits D-3a/D-4 stricter write-surface standard | 2026-05-14 |

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
| 2026-05-14 | D-3b MCP settings UI parity merged via PR #1665 (`10dc4e768`); source-style MCP settings UI + visual proof attached; local reviewer + cloud review passed |
| 2026-05-14 | D-4/D-5 PushServiceConfig + GithubConfigPanel merged via PR #1668 (`50cad313`); VAPID/GitHub secret write UI + visual proof attached; local reviewer + cloud review passed |
| 2026-05-14 | Author close evidence added; settings list diff now only `InstallPreviewModal.tsx` (reclassified out), F183/F184/F194 denylist empty, F088/F124 transport runtime not taken over |
| 2026-05-14 | Independent vision guardian PASS (Opus 4.6); CloseGateReport + reflection capsule added; F199 marked done |
| 2026-05-14 | CVO challenged KD-7/Skills write deferral: these are F199 next phase, not out-of-feature; F199 reopened as Phase E |
| 2026-05-14 | Phase E design memo added: service lifecycle + Skills write actions require independent hardening slices before UI parity |
| 2026-05-14 | Opus-47 design review approved Phase E direction and required E-1a mutex / strict process matching / timeout / port hygiene + explicit guardian disclosure |

## Review Gate

- **每个 D-N slice** 走完整 SOP：worktree → tdd → quality-gate → request-review → receive-review → merge-gate
- **D-3a/D-3b 分别独立 review/merge**：D-3b 不得在 D-3a 合入前扩大 UI 写入口
- **每刀 close** 必须产出 User Visibility Disclosure table（per 升级后 feat-lifecycle Step 0.3.5）
- **F199 整体 close** 必须 side-by-side 开源 vs 本地 settings 全对齐（per 升级后 opensource-ops 原则 22）+ 守护猫验 functional parity（per 升级后 shared-rules §9 rule 7）+ `InstallPreviewModal` 以 user-visible disclosure 明确为 F199 外 service lifecycle write
- **Phase E implementation order**: E-1/E-2 both require backend hardening before UI expansion. Service lifecycle spawn/script surface and Skills destructive writes must each get focused API tests, focused web tests, visual proof, cloud review, and independent vision guardian before final close.

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
| **D-3b PR** | `cat-cafe#1665` (`10dc4e768`) | MCP settings UI parity |
| **D-3b Proof** | `docs/discussions/2026-05-13-f199-d3b-mcp-settings-ui-proof/README.md` | MCP settings UI parity + User Visibility Disclosure |
| **D-4/D-5 PR** | `cat-cafe#1668` (`50cad313`) | PushServiceConfig + GithubConfigPanel hardening port |
| **D-4/D-5 Proof** | `docs/discussions/2026-05-14-f199-d4-push-service-config-proof/README.md` | VAPID/GitHub secret write UI + User Visibility Disclosure |
| **Close Gate Evidence** | `docs/discussions/2026-05-14-f199-close-gate/README.md` | Total User Visibility Disclosure + settings list diff + red-zone/transport boundary proof |
| **CloseGateReport** | `docs/discussions/2026-05-14-f199-close-gate/close-gate-report.md` | AC matrix + harness checkpoint + guardian result |
| **Reflection Capsule** | `docs/reflections/2026-05-14-f199-console-parity-backfill-capsule.md` | Completion reflection |
| **Phase E Design** | `docs/discussions/2026-05-14-f199-phase-e-service-skills-write-design/README.md` | Reopen correction + threat model + slice plan |
| **Phase E Design Review** | `docs/discussions/2026-05-14-f199-phase-e-service-skills-write-design/REVIEW-opus47.md` | Opus-47 approve + P0/P1 sharpenings |
| **Source PR** | `clowder-ai#669` | 缺失 5 组件的开源来源 |
