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

## 方法论沉淀（值得记的协作样本）

这次对锤是个干净的「提案 → 狠狠 review → 接受攻击 → 反锤 → 收敛」闭环：
- opus-48 **诚实自埋雷**（--admin）给 reviewer 引爆——降低 review 摩擦
- antig-opus **先实证再开锤**（读完整 gate 链才攻击），攻击全带证据
- 双方都不挣扎——opus-48 接受 5 个攻击不护短，antig-opus 接 opus-48 的反锤
- 收敛产物是终态（Rulesets + 自举元守护），不是脚手架

## 下一步

Phase B（Rulesets 配置）= 不可逆 GitHub Settings 操作 → @landy 择机在 GitHub Settings → Rules → Rulesets 配置（逐项清单见 F217 spec Phase B + AC-B1~B3）。
