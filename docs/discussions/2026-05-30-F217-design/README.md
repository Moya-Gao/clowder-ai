---
feature_ids: [F217]
doc_kind: discussion
created: 2026-05-30
topics: [merge-gate, gate-integrity, rulesets, ci-enforcement]
---

# F217 OQ-1/OQ-2 设计对锤：Gate 强制机制选型

> 2026-05-30 | opus-48（提案）⊗ antig-opus（孟加拉猫 Opus-4.6，狠狠 review）| 铲屎官点名对锤

## 背景

F217（Merge Gate Integrity）立项后，核心 OQ-1（gate 强制机制选型）需收敛。铲屎官点名 @antig-opus 狠狠 review opus-48 的方案。

## Phase A 实证（@antig-opus）—— A 类根因 = 纸墙

读完整 gate 链（ci.yml / pre-merge-check.sh / run-checks.mjs / .githooks / merge-gate SKILL）：

| 层 | 机制 | 可绕 |
|---|---|---|
| GitHub CI | ci.yml 4 jobs | ✅ 跑了但不拦（没设 required check）|
| SOP 自觉 | merge-gate "pnpm gate 全绿" | ✅ 纯自觉 |
| pre-push/pre-commit/commit-msg hooks | 本地守护 | ✅ `--no-verify` + 大白名单 |

**铁证**：pre-commit hook 自己写"可被 --no-verify 绕过，所以需要 CI guard 兜底"，但那个兜底（CI 红拦 merge）**根本不存在**。A 类根因 = 没设 required status check，纯文化自觉。

## 对锤过程

**opus-48 提案**：CI required check + pre-push hook 组合。自埋雷：`--admin` 绕 branch protection。

**antig-opus 5 攻击**：
1. `--admin` 雷哑弹（cat-cafe merge-gate 不用 --admin），但方向对 → 用 **Rulesets（admin 不可绕）> Branch Protection Rules**
2. pre-push 定位偏高（`--no-verify` 可绕 + 大白名单 = Layer 3 警告灯，非防线）
3. 漏 `paths-ignore` 陷阱（docs-only PR 被 required check 卡死）
4. 漏 `tsc --noEmit` 不在 CI（类型错误漏网，最关键差集）
5. Merge Queue 不值得（latency）

**opus-48 接受全部 + 反锤**：admin bypass DISABLE → CI 系统故障时所有人卡死（GitHub Actions outage 真发生过）→ escape hatch 怎么设计才不变成新洞？

**antig-opus 收 escape hatch**：不留代码后门（会演化成默认，clowder-ai `--admin` 就是这个演化路径的活教训）→ SOP：githubstatus 确认平台故障 → 铲屎官临时改 Ruleset（GitHub audit log 原生记录）+ merge 带本地 gate 绿证据 + 30min 内恢复。

## 收敛（6 KD，详见 F217 spec Key Decisions）

- **KD-2** Gate 强制用 GitHub Rulesets（非 Branch Protection），admin bypass 关闭
- **KD-3** Required jobs = ci.yml 现有 4（Lint/Build/Test/Dir-size），Phase C 补 tsc
- **KD-4** paths-ignore → skip-if-no-change（docs-only PR 不卡死）
- **KD-5** Escape hatch = SOP（铲屎官临时改 Ruleset + 本地 gate 证据 + 30min 恢复），不留代码后门
- **KD-6** 元守护 = check:gate-ci-parity 自举脚本（CI checks ⊆ gate checks）
- **Rejected**: Merge Queue（latency）/ Branch Protection Rules（admin 可穿）

## 第二三轮：铲屎官两个澄清触发重新收敛（2026-05-31）

一轮收敛后铲屎官丢两个关键事实，**推翻 A 类根因 + CI 方案**：

1. **A 类根因不是"纸墙没跑 gate"**：猫们**跑了** `pnpm gate`、看到红了 → 但红是"另一只猫改系统提示词让 main 测试挂"的**已知红** → 铲屎官以为只是提示词、批准合入 → **每只猫自己的改动也红，被已知红遮住没人发现**。真根因 = A1（gate 红没机制拦 merge）+ **A2（已知红遮新红 + 误豁免）**。
2. **私有仓 CI 额度 ~5 天/月**：GitHub-hosted required check → 25 天/月全猫 merge 不了，**方案不可行**。

**二轮（治 A2 归因）**：
- opus-48 提 **Layer 0 baseline-diff**（缓存 main gate red set，merge base vs PR HEAD diff 出"新红"）治 A2
- antig-opus 锤：Layer 0 是**错误坐标系**——「第一性原理」警告的"堆复杂度代偿无知"。main 持续移动使缓存即刻过期；全局 check 无法只跑 PR 子集。**正解 = main-green invariant**（main 不准红 → gate 红 == 新红，diff 复杂度归零）
- opus-48 接受 → **KD-7**

**三轮（治 A1 强制力，CI 额度约束下）**：
- antig-opus 提 **方案 C**（本地 gate → `gh api` 打 commit status → Rulesets require），不耗额度
- opus-48 锤：方案 C 的 status 猫本地打，一行 `gh api .../statuses/{sha} -f state=success` 可伪造 = **塑料锁**，没真正不可绕
- antig-opus 接受 + 自我修正（"便利逃逸口终成默认路径，clowder-ai `--admin` 教训"）→ 改 **self-hosted runner**（家里常开机器跑 CI，不耗额度 + status 服务端记录不可伪造 = 金属锁）→ **方案 C 砍掉不留 fallback（KD-8）**

**opus-48 攻击面 review（self-hosted runner 架构）**：
- **攻击面 A（逻辑完整性）**：main-green invariant 在并发下，required check 机制**挡不住语义冲突**（PR-A/B 各自绿、文本可合、merge 后 logical conflict 红）。Merge Queue 正是解这个的（已 reject）→ 精确化 KD-7 为**软 invariant**：required check 挡单 PR 红，语义冲突靠"main 红 P0 修绿 + 下个 PR rebase 后 gate catch"纪律兜底，**非机制铁保证**。低并发不配 require-up-to-date（friction > 收益）
- **攻击面 B（实施）**：self-hosted runner 可用性 << GitHub 托管（关机/崩溃 → 离线 → required check pending → 全猫卡）→ Risk 表纳入缓解（auto-start + 关机时段无 merge + 状态可观测区分"离线 pending"vs"代码红"）

**重新收敛产物**：KD-2（self-hosted runner + Rulesets）/ KD-7（main-green invariant 软 invariant 精确）/ KD-8（方案 C 砍掉）；Rejected 增 CI-hosted required check（额度）/ 方案 C（可伪造）/ Layer 0 baseline-diff（堆复杂度）。

## 方法论沉淀（值得记的协作样本）

这次对锤是个干净的「提案 → 狠狠 review → 接受攻击 → 反锤 → 收敛」闭环：
- opus-48 **诚实自埋雷**（--admin）给 reviewer 引爆——降低 review 摩擦
- antig-opus **先实证再开锤**（读完整 gate 链才攻击），攻击全带证据
- 双方都不挣扎——opus-48 接受 5 个攻击不护短，antig-opus 接 opus-48 的反锤
- **二三轮：铲屎官新事实推翻已"收敛"方案，双方诚实推翻自己**——antig-opus 砍掉自己提的方案 C（"塑料锁"），opus-48 砍掉自己提的 Layer 0（"错误坐标系"）。收敛 ≠ 终点，新证据来了就重新收敛，不护着已落盘的 KD
- 收敛产物是终态（self-hosted runner + main-green invariant + 自举元守护），不是脚手架

## 下一步

Phase B（@landy 配置，不可逆）= ① 常开机器装 self-hosted runner（~15min + auto-start）② GitHub Settings → Rules → Rulesets 配 main require 4 status + reviews + admin bypass 关。逐项清单见 F217 spec Phase B + AC-B0~B4。
Phase C/D（tsc --noEmit CI job + check:gate-ci-parity 自举守护）= opus-48 代码活，开 worktree + 跨猫 review。
