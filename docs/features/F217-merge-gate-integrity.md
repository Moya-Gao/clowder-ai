---
feature_ids: [F217]
related_features: [F073, F083, F177, F192]
topics: [merge-gate, ci, governance, gate-integrity, meta-guard, rulesets]
doc_kind: spec
created: 2026-05-30
---

# F217: Merge Gate Integrity — 检查覆盖 + 强制力 + 元守护

> **Status**: spec | **Owner**: 布偶猫/宪宪 (Opus-4.8) | **Priority**: P1

## Why

2026-05-30 全量同步（cat-cafe → clowder-ai）一路撞 **6 类 pre-existing 红灯/sync-coupling**（biome 格式 / index.json stale / shared-rules 硬编码猫名 / F180 emoji status / F214 sync-coupling / dir-size 超限），全是「cat-cafe `pnpm gate` 绿、clowder-ai CI 拦」——带病代码进了 main，sync 时集中爆发。

铲屎官原话："固定基线治标（main 在动），gate 治理治本（main 为什么脏）= 真正避免反复。"

**4 型根因**（@antig-opus Phase A 实证）：

| 型 | 实例 | 根因 |
|----|------|------|
| **A. gate 没被强制执行** | biome/index/砚砚（3 类）| **cat-cafe gate 是纸墙**——CI 跑了但不拦（没设 required status check），SOP 纯自觉，hooks 可 `--no-verify` 绕。pre-commit hook 自己写"需要 CI guard 兜底"，但那个兜底根本不存在。**最大的洞** |
| B. 检查 robustness bug | F180 emoji status | isDoneStatus 不认 `✅` 前缀（已止血 PR #1968）|
| C. sync-specific 检查不在 cat-cafe gate | F214 sync-coupling | root-package-script-surface 在 sync temp gate（已止血 PR #1970）|
| D. 检查缺失 | dir-size | check:dir-size 不在 pnpm gate（已接入 PR #1972）|

止血已做。本 feat 根治系统性问题——核心是 **A 类（gate 强制力）**：检查接得再全，猫能绕过 gate 直接 merge 就全白搭。

## What

### Phase A: 差集审计 + A 类根因实证 ✅（@antig-opus 完成）
读完整 gate 基础设施链（ci.yml / pre-merge-check.sh / run-checks.mjs / .githooks / merge-gate SKILL）。结论：**A 类根因 = 没设 required status check，纯文化自觉**。CI vs gate 差集表见附录。

### Phase B: Gate 强制力 — GitHub Rulesets（@landy 配置，不可逆）
用 **GitHub Repository Rulesets**（非 Branch Protection Rules）配置 main：
- Require status checks: ci.yml 现有 4 job（Lint/Build/Test/Dir-size）
- **Admin bypass DISABLED**（Rulesets 特性，从根堵 `--admin` 逃逸）
- paths-ignore 处理：skip-if-no-change（docs-only PR 不被卡死）

### Phase C: 检查覆盖补全
- 补 `tsc --noEmit` CI job（最关键差集，类型错误现只本地 gate 能抓）
- 接 sync-coupling 类漏检；dir-size 已接（PR #1972）作模式

### Phase D: 元守护 — check:gate-ci-parity
自举守护脚本（run-checks PARALLEL_CHECKS 第 19 项）：解析 ci.yml `run:` + run-checks PARALLEL_CHECKS，assert CI checks ⊆ gate checks。脚本自身在 PARALLEL_CHECKS 里——自举。让"检查漏在 gate 外"不可能再发生。

## Acceptance Criteria

### Phase A（差集审计 + 根因实证）✅
- [x] AC-A1: CI vs gate 完整差集表（见附录，@antig-opus 实证）
- [x] AC-A2: A 类根因实证 = 没设 required status check，纯文化自觉（gate 是纸墙）

### Phase B（Gate 强制力 Rulesets）
- [ ] AC-B1: GitHub Rulesets 配置 main require 4 status checks + admin bypass DISABLED（@landy GitHub Settings）
- [ ] AC-B2: paths-ignore skip-if-no-change 验证（docs-only PR 能 merge）
- [ ] AC-B3: 验证 CI 红时 merge 被拦（不可绕）

### Phase C（检查覆盖）
- [ ] AC-C1: tsc --noEmit CI job 补入 ci.yml + 设 required
- [ ] AC-C2: 审计是否还有 sync-only 检查未接进 cat-cafe gate

### Phase D（元守护）
- [ ] AC-D1: check:gate-ci-parity 脚本（CI ⊆ gate assert + 自举）
- [ ] AC-D2: 守护脚本进 PARALLEL_CHECKS + CI required

## Dependencies
- **Related**: F073（sop-auto-guardian）/ F083（design-gate-sop）/ F177（hotfix 治理）/ F192（eval contract 门禁，本 feat 受其约束 — OQ-3）

## Risk

| 风险 | 缓解 |
|------|------|
| gate 强制太严卡开发体验 | Rulesets require 现有 4 job（已 ~5min），不加 Merge Queue latency |
| **admin bypass DISABLED → CI 系统故障时所有人卡死** | **Escape hatch SOP（KD-5）**：githubstatus 确认平台故障 → 铲屎官临时改 Ruleset（GitHub audit log 原生记录）+ merge 带本地 gate 绿证据 + 30min 内恢复。**不留代码后门**（后门=新 A 类洞）|
| 元守护本身漂移 | check:gate-ci-parity 自举（守护自己也在 gate）|

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | gate 强制机制选型 | ✅ 收敛（KD-2~KD-5）：Rulesets + admin 关闭 + escape hatch SOP |
| OQ-2 | 元守护形态 | ✅ 收敛（KD-6）：check:gate-ci-parity 自举 |
| OQ-3 | Eval Contract（harness 类门禁 F192）：Primary Users / Friction / Regression Fixture / Sunset | ⬜ Design Gate 前填 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 立 feat（非 issue）| A 类设计选型需 Design Gate；系统性 + 多 Phase + 元守护新机制（CVO signoff）| 2026-05-30 |
| KD-2 | Gate 强制用 **GitHub Rulesets**（非 Branch Protection），**admin bypass 关闭** | Branch Protection 的 admin 可 bypass（`--admin` 一加就穿）；Rulesets 可配 admin 也不可绕，从根堵。cat-cafe 12 猫不缺 review，无 clowder-ai 单 maintainer 约束 | 2026-05-30（opus-48 ⊗ antig-opus 对锤）|
| KD-3 | Required jobs = ci.yml 现有 4（Lint/Build/Test/Dir-size），Phase C 补 tsc | 现有 4 job 已覆盖 6 类问题大部分；不让完美成为好的敌人，先立基本墙 | 2026-05-30 |
| KD-4 | paths-ignore → skip-if-no-change | docs-only PR 不触发 CI 时 required check 永不绿会卡死 | 2026-05-30 |
| KD-5 | Escape hatch = SOP（铲屎官临时改 Ruleset + 本地 gate 证据 + 30min 恢复），**不留代码后门** | 代码后门会演化成默认（clowder-ai `--admin` 教训）；GitHub audit log 原生记录改 Ruleset | 2026-05-30 |
| KD-6 | 元守护 = check:gate-ci-parity 自举脚本（CI ⊆ gate）| 比人肉对照可靠；终态产物非脚手架；自身在 PARALLEL_CHECKS 自举 | 2026-05-30 |

## Rejected Alternatives

| 方案 | 拒绝理由 |
|------|---------|
| GitHub Merge Queue | merge 前重跑 CI 解决"合流后红"，但加 10-20min latency（build 本来 10-30min）+ 8 猫并发频率不需序列化。pnpm gate 已 rebase+全量验证 + Rulesets 保底足够 |
| Branch Protection Rules | admin 可 bypass（`--admin` 穿墙）；用 Rulesets 替代 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-30 | 立项（全量同步 6 类 gate 失效触发，CVO signoff）+ OQ-1/OQ-2 对锤收敛（opus-48 ⊗ antig-opus）|

## Review Gate
- Phase A: ✅ @antig-opus 深度实证 + 对锤收敛
- Phase B: Rulesets 配置（@landy GitHub Settings）+ 配置后验证（CI 红被拦）

## Appendix: CI vs Gate 差集表（AC-A1，@antig-opus 实证）

| CI job | 对应 gate 步骤 | 差集 |
|---|---|---|
| Lint (`pnpm check`) | Step 4 `pnpm check` | ✅ 对齐（含 18 checks）|
| Build | Step 3 `pnpm -r build` | ⚠️ CI 只 build shared+api+web，gate 全包 |
| Test (Public) | Step 5 `test:public` | ✅ 对齐 |
| Dir-size | Step 4 `check:dir-size` | ✅ 对齐（pnpm check 子集）|
| ❌ 无 | Step 2 `install --frozen-lockfile` | CI install 但不 assert lockfile drift |
| ❌ 无 | Step 3 `tsc --noEmit` | **Gate 有 CI 没有 — 类型错误漏网（Phase C 补）** |
| ❌ 无 | Step 1 rebase origin/main | CI 对 PR 已基于 main diff，语义等价 |

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Issue** | cat-cafe#1974 | gate 治理 tracking（升级为本 feat）|
| **Discussion** | `docs/discussions/2026-05-30-F217-design/` | OQ-1/OQ-2 对锤收敛（opus-48 ⊗ antig-opus）|
| **Event** | sync tag `sync/2026-05-30-142350` | 全量同步事件（6 类债来源）|
