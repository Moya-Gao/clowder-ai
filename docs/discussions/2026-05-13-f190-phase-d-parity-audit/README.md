---
feature_ids: [F190]
topics: [console, settings, parity-audit, intake, post-close]
doc_kind: design-memo
created: 2026-05-13
status: pending-cvo-decision
---

# F190 Phase D — Console Parity Audit & Backfill (Design Memo)

> **Status**: pending CVO decision (是否走 Phase D / reopen F190 vs 开新 F 号)
> **Author**: 宪宪/Opus-47 (Phase C reviewer, post-close reflection)
> **Trigger**: CVO push-back 2026-05-13 after F190 close — visual parity gap exposed

## Context

F190 close (`1039d68a4`) 后 CVO 重启 runtime 用 `/settings` 实测，对比 clowder-ai 开源最新 main，发现 settings/ 目录组件数差距：

```
开源 settings/: 20 components
本地 settings/: 13 components
缺失: 7 components
```

砚砚同时间已发现并 hotfix 2 个 SVG 图标（`box`/`puzzle`）via PR #1659（merged `d928fb696`）。但 7 个组件级 gap 不是 SVG 图标可以糊过去的——这是**功能性 source intent gap**。

详情 see reflection capsule: `docs/reflections/2026-05-13-f190-console-settings-intake-capsule.md`（What Failed + Trigger Missed sections）

## Gap Classification (open-source vs local)

| # | 缺失组件 | 性质 | F190 决策出处 | Phase D 建议 |
|---|---|---|---|---|
| 1 | `PushServiceConfig.tsx` | VAPID 公私钥输入 + 一键生成 + contact email | KD-5 deferred (secret write-back) | **Port，复用 IM connector hardening pattern** |
| 2 | `GithubConfigPanel.tsx` | GitHub token 写入面板 | KD-5 deferred (secret write-back) | **Port，复用 IM connector hardening pattern** |
| 3 | `capability-settings-ui.tsx` | Capability 配置写 UI | 隐式 defer (capability write 链路) | **需进一步分析**——可能跟 #4 配套 |
| 4 | `InstallPreviewModal.tsx` | MCP/Skill 安装预览 | 隐式 defer (capability write) | **需进一步分析**——可能是 read-mostly preview，可单独 port |
| 5 | `ServiceStatusPanel.tsx` | 服务状态独立面板 | 未明确 defer——我们 intake 了 PluginsContent 但漏了这个 | **直接 port (read-only)** |
| 6 | `SkillsContent.tsx` | Skill 管理（read + write） | 部分 defer (砚砚明说不 port external uninstall) | **部分 port：拆 read-only Skill list/preview，写部分单独 slice** |
| 7 | `useCapabilityState.ts` | Capability 状态 hook | 跟 #3/#4 配套 | **跟 #3/#4 一起判定** |

## CVO 视角下的用户可感差距

(这一段是 F190 close gate 漏写的——deliberate defer 必须映射到用户可见性)

| Settings Section | 开源用户能做 | 本地用户能做 | 差距 |
|---|---|---|---|
| 通知 | 配 VAPID 公私钥 + 一键生成 + 联系信箱 + 应用内通知开关 + 通知偏好 | 看诊断矩阵 + 修复建议（read-only） | **完全丢失写能力** ⚠️ |
| 插件/集成 | 配 GitHub token + 推送服务等 | 看服务状态卡（read-only） | **完全丢失写能力** ⚠️ |
| MCP 管理 | 安装预览 + capability state 写 | 看 capability board filter | **写能力不完整** ⚠️ |
| 技能 | Skill list + preview + uninstall external | preview SKILL.md only | **管理能力缺失** ⚠️ |
| 其他 sections | — | — | 基本对齐 ✅ |

## Proposed Phase D Plan

### 路径 A：完整 backfill（推荐）

5 刀（细分到组件级别）：

1. **D-1: ServiceStatusPanel port (read-only)** — 直接 wrap，1 day
2. **D-2: SkillsContent 拆分 port (read-mostly)** — Skill list + manage UI 但**不接 external skill uninstall**（这个仍 defer），1-2 days
3. **D-3: capability-settings-ui + useCapabilityState 调研 + port** — 需先看清楚跟 IM connector hardening pattern 是否冲突，2-3 days
4. **D-4: PushServiceConfig hardening port** — VAPID secret 写入，复用 `requireExplicitOwner` + `containsRedactedPlaceholder` + audit，3-5 days
5. **D-5: GithubConfigPanel hardening port** — GitHub token 写入，同 D-4 pattern，3-5 days

总计 ~2 weeks intensive，按 D-1 → D-2 → D-3 → D-4 → D-5 顺序，每刀独立 review。

### 路径 B：分批 + CVO 选择性 backfill

- D-1 / D-2 / D-3 必做（fill missed read-only/preview gaps）
- D-4 / D-5 CVO 拍板：是否真需要 UI 写凭据？还是接受 "env 文件配 + 重启" 的当前 dev pattern？

我倾向 **路径 A**——因为：
1. 7 个缺失里 5 个是用户实际可感的 UI 能力缺失
2. Phase C 已经把 hardening pattern 摸清，复用成本低
3. 永久 defer 这些 = 永远比开源功能差一截，每次 outbound sync 也要永久 manual-port 反向，长期心累

## CVO Decision Points

| # | 决策 | 建议 |
|---|---|---|
| OQ-D1 | 是 reopen F190 进入 Phase D，还是开新 F 号 (e.g., F199)？ | **开新 F 号**——F190 已正式 close，reopen 会让 truth source 不稳；Phase D 是 follow-up 性质，跟 F190 是 "parent feature → backfill" 关系 |
| OQ-D2 | 路径 A (完整 backfill) vs 路径 B (CVO 选择性)？ | A，理由见上 |
| OQ-D3 | 哪刀先开？ | D-1 (ServiceStatusPanel) 最低风险，可作为 process 验证刀；D-4 (PushServiceConfig) 最高用户价值 |
| OQ-D4 | 这次 review/愿景守护链路要加哪些 gate？ | 见下方 "Process Improvements" |

## Process Improvements (separate skill updates)

把这次 lesson 永久固化到 SOP：

### 1. `cat-cafe-skills/opensource-ops/SKILL.md` — Mandatory Parity Gate

inbound intake 必经步骤新增：
- request-review 之前必须产出 "开源 vs 本地 components diff + visual side-by-side screenshots"
- deliberate defer 必须 CVO signoff，**且必须以"用户可见性"语言**披露（不是技术语言 "deferred"）
- read-mostly 缺失默认按 "漏" 处理，必须举证为 "deliberate" 才能 defer

### 2. `cat-cafe-skills/merge-gate/SKILL.md` — AC alpha 标准升级

AC-A7 类的 alpha walkthrough 标准从 "HTTP 200 + 0 console error" 升级为：
- 开源截图 vs alpha 截图 side-by-side（每个主要 surface 各一对）
- 缺失/退化内容必须在 close report 列清单

### 3. `cat-cafe-skills/feat-lifecycle/SKILL.md` — Close Gate 加 User Visibility Disclosure

feat-lifecycle close gate 加一节 "User Visibility Disclosure"：
- 列 "用户在 UI 看到什么 vs 看不到什么 vs deferred 什么"
- CVO 拍板才算 close
- 不能只看 "AC ✅" 就 close

### 4. `cat-cafe-skills/refs/shared-rules.md` — 愿景守护标准

愿景守护 section 加一句：
> "Red-zone untouched" ≠ "vision achieved". 守护猫必须验 functional parity with source intent，不能把"没改坏现有的"等同于"愿景达成"。

## Next

等 CVO 拍板 OQ-D1..OQ-D4。拍板后：
- 我（或砚砚/任一猫）开 Phase D-1 worktree，按建议顺序逐刀走
- 同时按 Process Improvements 4 项更新 skills（可并行）

如果 CVO 选择不走 Phase D（彻底 defer 这 7 个组件），那 process improvement 4 项仍然要更新——否则下次 intake clowder-ai 下一个大 PR 还会重蹈覆辙。

@landy

[宪宪/Opus-47🐾]
