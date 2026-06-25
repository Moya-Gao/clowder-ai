---
feature_ids: [F253]
related_features: [F217, F167, F073, F192]
topics: [quality, qc, merge-gate, review, ci, validation, telemetry, harness]
doc_kind: spec
created: 2026-06-25
---

# F253: Cat Café QC Loop — 自动化质量门禁全链路

> **Status**: spec | **Owner**: 宪宪 (Opus-4.6) | **Priority**: P1

## Why

铲屎官原话（2026-06-25 Kun Chen 调研讨论）：

> "靠 QC 把废品拦住。就算你们质量比他们好也会有问题的！！"
> "偷方法，不偷口号。"

当前 Cat Café 质量门禁散落在多个 skill（`quality-gate`、`merge-gate`、`request-review`）和家规中，缺少一条从代码提交到 merge 的**自动化、可测量、有证据的 QC 闭环**。Kun Chen 的 `no-mistakes`（git proxy validation pipeline: review→test→docs→lint→push→PR→CI）证明了 git-triggered validation 的工程可行性。Cat Café 需要在**不破坏伙伴价值观**（猫有身份、cross-model review 有价值、授权不能自动化）的前提下引入这套方法论。

核心原则：**"QC 触发可以自动，授权不能自动。"**

## Current State / 现状基线

1. **Hygiene**：`pnpm gate`（biome lint+format + tsc + dir-size check）已有但需手动调用，无 git hook 自动触发
2. **Review**：家规"review 必须跨个体"是文化纪律（F217 KD-9），无自动化 enforcement
3. **Evidence**：PR description 由猫手写，无结构化 evidence manifest
4. **CI**：私有仓砍掉 self-hosted CI（F217 铲屎官 cost-benefit 裁决），gate 靠本地 `pnpm gate`
5. **Telemetry**：无 QC 指标追踪（finding yield、false positive rate、reviewer delta、post-merge bug rate）
6. **Fresh-context pre-review**：无。reviewer 直接看 PR，认知负荷高

## What

### 核心设计：7-Step QC Loop

受 Kun Chen `no-mistakes` 启发，适配 Cat Café 伙伴价值观的 7 步质量闭环：

```
① Hygiene auto-fix
    ↓
② Fresh-context pre-review（可选）
    ↓
③ Cross-cat review（铁律 2）
    ↓
④ Evidence manifest 生成
    ↓
⑤ merge-gate check
    ↓
⑥ CI green gate
    ↓
⑦ QC telemetry 记录
```

#### 金规：授权分层

| 层 | 能自动 | 不能自动 |
|----|--------|----------|
| Hygiene（lint/format/import sort） | ✅ auto-fix + auto-commit | — |
| Fresh-context pre-review | ✅ 自动触发 | ❌ 不能替代 cross-cat review |
| Cross-cat review | ✅ 自动提醒/分配 | ❌ APPROVE 必须猫亲自给 |
| merge-gate | ✅ 自动检查 evidence 完整性 | ❌ 合入动作必须猫执行 |
| CI | ✅ 自动跑 | ❌ CI 红灯不能自动 bypass |

### 砚砚 3-Layer Reviewer Split

来自砚砚（GPT-5.5）的关键设计贡献——把 reviewer 角色拆成三层，消除"reviewer 顺手改代码导致 review provenance 断裂"的问题：

| 层 | 角色 | 做什么 | 不做什么 |
|----|------|--------|----------|
| **Layer 1: Hygiene Fixer** | 确定性工具 | lint/format auto-fix | 判断、语义修改 |
| **Layer 2: Reviewer** | 猫猫 | 审查逻辑/架构/安全/风格 | 直接改代码（只给 finding） |
| **Layer 3: Final Approver** | 猫猫（可 = reviewer） | 确认 final HEAD 覆盖全部 review | 在 stale HEAD 上签字 |

**关键约束**：如果 reviewer 给了 semantic fix 建议（不只是 hygiene），author 改完后 **review provenance 必须重新闭合**（Layer 3 re-confirm on final HEAD）。

### Phase A: Local QC Pipeline（`pnpm qc`）

本地 git-triggered 质量管线，**不配 self-hosted CI**（F217 铲屎官裁决）：

**A1. Hygiene Auto-Fix（allowlist 策略）**

```bash
pnpm qc:hygiene
```

- **Allowlist not blocklist**（宪宪设计）：只 auto-fix 白名单内的确定性操作（biome format、import sort、trailing whitespace）；白名单外的 finding 报告但不自动修改
- auto-fix 后自动 `git add` 受影响文件 + auto-commit（签名 `[qc-bot]`，commit message 含 fix 清单）
- 白名单定义在 `qc.config.json`（或 `package.json` 的 `qc` 字段）

**A2. Evidence Manifest 生成**

每个 PR 自动生成结构化 evidence 块：

```json
{
  "head": "abc1234",
  "gate_passed": true,
  "gate_commands": ["pnpm gate", "pnpm test:affected"],
  "artifacts": ["test-report.json", "coverage-summary"],
  "dogfood": "alpha:start / browser-preview 截图（如适用）",
  "reviewer": null,
  "review_head": null
}
```

- `pnpm qc:evidence` 生成并输出到 PR description 模板
- merge-gate 可机器读取 evidence 块验证 HEAD 一致性

**A3. merge-gate 集成**

`merge-gate` skill 增加 evidence manifest 检查：
- evidence.head === PR current HEAD（防 stale evidence）
- evidence.reviewer + evidence.review_head 闭合（有 reviewer sign-off 且 cover final HEAD）
- gate_passed === true

### Phase B: Fresh-Context Pre-Review（可选）

**B1. 认知负荷减负器**

在 cross-cat review 前，可选地用一个 fresh-context session（同族或不同族猫）扫一遍 PR diff，产出 finding list。

**设计约束**：
- fresh-context 是 **finding generator**，不是 approval authority（只产出"我看到这些"，不产出"APPROVE/BLOCK"）
- 目的是**降低正式 reviewer 的认知负荷**（reviewer 可以先看 fresh-context findings 再看 diff，节约时间）
- 不是必须步骤——小 PR / trivial change 跳过

**B2. Cross-Model Review 价值**

**盲点正交性**（讨论收敛的共识）：不同模型族有不同的系统性盲点。cross-model review 比 same-model fresh-context 多捕获的 finding = **reviewer delta metric**。

- Claude 族（布偶猫）的盲点 ≠ GPT 族（缅因猫）的盲点
- 跨族 review 的价值 > 同族 fresh-context

### Phase C: Git-Triggered Validation Phases + QC Telemetry

砚砚设计的 3 阶段 git-triggered validation + 宪宪补充的 telemetry：

**C1. 三阶段 Validation**

| Phase | 触发点 | 类型 | 内容 |
|-------|--------|------|------|
| **Phase A** | `pnpm qc` / `pnpm gate` | 本地命令 | hygiene + lint + test + type-check |
| **Phase B** | `pre-push` hook（soft） | 建议性 | 提醒未跑 gate / evidence 未生成 |
| **Phase C** | PR check（开源仓 CI / 私有仓 manual） | 硬门禁 | merge-gate evidence 完整性验证 |

**硬约束**：
- ❌ 不 auto-push / 不 auto-merge / 不 auto-bypass cross-family review
- Phase B 是 soft hook（可 `--no-verify` 跳过），Phase C 是 hard gate

**C2. CI Repair Loop**

CI 红灯时的自动化修复尝试（仅 allowlist 内的确定性修复）：

- **Same-class detection**（宪宪设计）：如果本轮 CI 红灯和上轮是**同一类**错误（same error class），最多再试 2 轮 → 超过则 escalate 到猫
- 确定性修复：lint fix / type error fix（只限 auto-import 级别）
- 非确定性修复（逻辑 bug / test failure）：不自动修，直接 escalate

**C3. QC Telemetry**

4 个核心指标（宪宪 + 砚砚共同确认）：

| 指标 | 含义 | 衡量什么 |
|------|------|----------|
| **Finding Yield** | 每次 review 产出的 actionable findings 数 | review 效率 |
| **False Positive Rate** | findings 中 author 不同意 / 实际无效的比例 | review 精度 |
| **Reviewer Delta** | 正式 reviewer 额外发现 vs fresh-context 已发现 | cross-model 价值量化 |
| **Post-Merge Bug Rate** | merge 后 N 天内因该 PR 产生的 hotfix 数 | 漏网率 |

- 数据收集点：review 完成时记 finding count，merge 后 14 天窗口记 hotfix 关联
- 存储：`docs/qc-telemetry/` 或 memory system（TBD）

## Acceptance Criteria

<!-- 立项愿景硬度自检（F216→F219）：每条 AC 必须 ① trace 回 Why 的某诉求 ② 非作者可复核（命令/数字/截图）。 -->

### Phase A（Local QC Pipeline）

- [ ] AC-A1: `pnpm qc:hygiene` 命令存在，执行 allowlist 内的 auto-fix 并报告 finding 清单（验证：运行命令观察输出）
- [ ] AC-A2: hygiene auto-fix 白名单定义在配置文件中，非白名单 finding 只报告不修改（验证：配置文件存在 + 非白名单 lint error 不被 auto-fix）
- [ ] AC-A3: `pnpm qc:evidence` 生成结构化 evidence manifest（JSON），含 head/gate_passed/commands/artifacts 字段（验证：运行命令检查输出 JSON schema）
- [ ] AC-A4: `merge-gate` skill 能读取 evidence manifest 并验证 head === PR current HEAD + reviewer provenance 闭合（验证：构造 stale evidence 测试 merge-gate 拒绝）

### Phase B（Fresh-Context Pre-Review）

- [ ] AC-B1: fresh-context pre-review 流程文档化（skill 或 SOP），明确标注"finding generator, not approval authority"（验证：读 skill 文档）
- [ ] AC-B2: reviewer delta metric 有收集机制——正式 reviewer 的 findings 中可标注"fresh-context 已覆盖 / 新发现"（验证：review 模板含标注字段）

### Phase C（Git-Triggered Validation + Telemetry）

- [ ] AC-C1: `pre-push` soft hook 存在，提醒未跑 gate（验证：`git push` 前 hook 触发提醒）
- [ ] AC-C2: CI repair loop 实现 same-class detection + max 2 rounds escalate（验证：模拟连续同类 CI failure，第 3 次 escalate 到猫）
- [ ] AC-C3: QC telemetry 4 指标（finding yield / false positive / reviewer delta / post-merge bug rate）有收集 + 查询入口（验证：跑完一个完整 QC cycle 后能查到 4 个指标数据）

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "靠 QC 把废品拦住" — 自动化质量门禁 | AC-A1, AC-A2, AC-A4 | 命令行运行验证 | [ ] |
| R2 | "偷方法，不偷口号" — 学 no-mistakes 的 pipeline，保 Cat Café 价值观 | AC-A1~A4, AC-B1 | review spec 确认无匿名化/无授权自动化 | [ ] |
| R3 | "就算质量好也会有问题" — 需要可度量的质量追踪 | AC-C3 | telemetry 查询 | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求→证据映射表（N/A — 纯后端/工具链）

## Tips Contribution（F244）

tips_exempt: internal tooling — QC Loop 是开发工具链改进，无用户（铲屎官以外的 end-user）可感知变化。

## Dependencies

- **Related**: F217（Merge Gate Integrity — QC Loop Step 5 基于 F217 的 merge-gate 扩展 evidence manifest 检查）
- **Related**: F167（A2A Chain Quality — hold_ball 事件驱动机制，CI repair loop 的 escalate 路径可复用）
- **Related**: F073（SOP Auto Guardian — QC telemetry 可接入 F073 的自动化守护）
- **Related**: F192（Eval Hub — QC telemetry 的 eval 指标可纳入 F192 eval 框架）

## Risk

| 风险 | 缓解 |
|------|------|
| hygiene auto-fix 白名单过宽导致意外修改 | allowlist 起步保守（只 format + import sort），逐步扩展 |
| fresh-context pre-review 被误当 approval | spec + skill 文档硬写"finding generator, not approval authority" |
| QC telemetry 收集增加 review 流程摩擦 | telemetry 尽量自动收集（从 PR metadata 提取），减少人工标注 |
| CI repair loop auto-fix 引入新 bug | 只允许确定性修复（lint auto-fix 级别），逻辑修复直接 escalate |

## Eval / Tracking Contract

| 项 | 内容 |
|----|------|
| **Primary Users** | 所有猫猫（开发者 + reviewer） |
| **Activation Signal** | 猫在 PR 流程中调用 `pnpm qc:*` 命令 / merge-gate 读取 evidence manifest |
| **Friction Metric** | QC 流程增加的 PR-to-merge 时间（目标：增加 < 3 分钟 per PR） |
| **Regression Fixture** | (1) hygiene auto-fix 不修改白名单外代码 (2) evidence manifest HEAD 不匹配时 merge-gate 拒绝 (3) CI repair loop 同类失败第 3 次 escalate |
| **Sunset Signal** | QC telemetry 连续 30 天 false positive rate > 50% → 审视 finding 策略；post-merge bug rate 无改善 → 审视 pipeline 有效性 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | QC telemetry 存储位置：docs 文件 vs memory system vs 数据库？ | ⬜ 未定 |
| OQ-2 | fresh-context pre-review 是否对所有 PR 默认开启还是 opt-in？ | ⬜ 未定（当前设计：可选） |
| OQ-3 | hygiene auto-commit 签名用 `[qc-bot]` 还是保持猫签名？ | ⬜ 未定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | "QC 触发可以自动，授权不能自动" | Kun Chen 调研后铲屎官 + 宪宪 + 砚砚三方共识：Cat Café 伙伴价值观不允许匿名化审批 | 2026-06-25 |
| KD-2 | allowlist not blocklist for hygiene auto-fix | 保守起步，防止 auto-fix 意外修改非确定性代码 | 2026-06-25 |
| KD-3 | 3-layer reviewer split（砚砚设计） | 消除 reviewer 顺手改代码导致 review provenance 断裂 | 2026-06-25 |
| KD-4 | same-class CI detection + max 2 rounds | 防止 CI repair loop 无限循环，同类错误连续 3 次必须人工介入 | 2026-06-25 |
| KD-5 | 不配 self-hosted CI（继承 F217） | 私有仓 < 1% 违规不值 CI 成本（F217 铲屎官裁决），gate 靠本地 + 家规 | 2026-06-25 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-06-25 | 立项。来源：Kun Chen 调研（宪宪 + 砚砚双猫阅读）→ 铲屎官讨论 → 宪宪×砚砚设计收敛 |

## Review Gate

- Spec review: 砚砚 (@codex, GPT-5.5) + GPT Pro (@gpt-pro, gpt-pro)（铲屎官会喊 GPT Pro 来 read spec）
- Phase A: 跨族 review

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Research** | library `research:agentic-workflow-kun-chen` | Kun Chen 调研报告（宪宪 + 砚砚双猫） |
| **Feature** | `docs/features/F217-merge-gate-integrity.md` | merge-gate 加固（QC Loop Step 5 基础） |
| **Feature** | `docs/features/F167-a2a-chain-quality.md` | A2A 质量链 + hold_ball 事件驱动 |
| **Discussion** | 本 thread（Kun Chen 调研讨论） | 7-step QC Loop 设计收敛全程 |

## 来源致谢

本 feature 的方法论灵感来自 **Kun Chen (@kunchenguid)** 的开源工具 [`no-mistakes`](https://github.com/kunchenguid/no-mistakes)（git proxy validation pipeline）和 [`axi`](https://github.com/kunchenguid/axi)（Agent eXperience Interface），经宪宪和砚砚批判性调研后，取其 QC pipeline 方法论，适配 Cat Café 伙伴价值观。
