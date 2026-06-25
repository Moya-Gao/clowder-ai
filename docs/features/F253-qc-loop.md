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

## Non-Goals

以下是 F253 **明确不做**的事——每条都是 Cat Café 价值观护栏：

1. **不引入大副制**：不设置单一指挥猫统筹 QC 流程。每只猫对自己的代码和 review 负责，QC 是工具链支撑而非权力结构。
2. **不把猫匿名化为工具池**：每个 review finding 都带 named cat 签名。猫的专长、直觉和历史校准是信号，不是噪声。
3. **不自动 merge / 不自动 revert**：即使 QC 全绿，合入动作必须由猫执行。自动回滚只限 CI repair loop 内的 hygiene auto-fix（确定性操作）。
4. **不把 fresh-context pre-review 当 approval**：fresh-context 只产出 finding list，永远不产出 APPROVE/BLOCK verdict。
5. **qc-bot 不演化为 verdict signer**：`qc-bot` 永远只是 hygiene fixer + evidence assembler。它不签 verdict、不决定 P1/P2 级别、不选 reviewer。如果 qc-bot 开始做这些——那就是 firstmate 大副制的变形，必须立刻拆回去。

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

### QC 状态机

QC Loop 是 **stateful pipeline**，不是 stateless 流程散文。每个 PR/change 经过的 QC 状态：

```
qc.idle
  → qc.requested        (触发：pnpm qc / git commit / manual)
  → qc.hygiene_done      (hygiene auto-fix 完成)
  → qc.pre_review_done   (fresh-context findings 产出，可跳过)
  → qc.review_routed     (cross-cat reviewer 已分配)
  → qc.findings_collected (reviewer findings 收集完)
  → qc.verdict_blocked    (reviewer BLOCK → 回 author 修)
  → qc.verdict_passed     (reviewer APPROVE on final HEAD)
  → qc.evidence_sealed    (evidence manifest 生成 + HEAD 锁定)
  → qc.merged             (merge-gate 放行 + 猫执行合入)
  → qc.archived           (telemetry 记录完)
```

**状态字段**（每个状态转换携带）：

| 字段 | 说明 |
|------|------|
| `idempotencyKey` | `{prNumber}-{sha}-{step}` 防重复唤醒 |
| `sourceThreadId` | 发起 QC 的 thread |
| `reviewedSha` | 当前 review 覆盖的 HEAD SHA |
| `targetCats` | 当前步骤的目标猫（reviewer / author） |
| `staleFlag` | HEAD 变化后自动标记 stale，需要 re-review |

**Stale invalidation**：当 `reviewedSha` ≠ PR current HEAD 时，`staleFlag = true`，verdict 自动回退到 `qc.review_routed`。

### 金规：授权分层

| 层 | 能自动 | 不能自动 |
|----|--------|----------|
| Hygiene（lint/format/import sort） | ✅ auto-fix + auto-commit | — |
| Fresh-context pre-review | ✅ 自动触发 | ❌ 不能替代 cross-cat review，不能产出 verdict |
| Cross-cat review 提醒 | ✅ 自动提醒 | — |
| Cross-cat reviewer 选择 | — | ❌ 由 author 基于关系画像/专长选定，不允许全随机 round-robin |
| Cross-cat review verdict | — | ❌ APPROVE/BLOCK 必须 named cat 亲自签（= 3-Layer Split 的 Layer 2+3） |
| merge-gate | ✅ 自动检查 evidence 完整性 | ❌ 合入动作必须猫执行 |
| CI | ✅ 自动跑 | ❌ CI 红灯不能自动 bypass |

### 砚砚 3-Layer Reviewer Split

来自砚砚（GPT-5.5）的关键设计贡献——把 reviewer 角色拆成三层，消除"reviewer 顺手改代码导致 review provenance 断裂"的问题：

| 层 | 角色 | 做什么 | 不做什么 | 金规映射 |
|----|------|--------|----------|----------|
| **Layer 1: Hygiene Fixer** | 确定性工具 (`qc-bot`) | lint/format auto-fix | 判断、语义修改、签 verdict | 金规"Hygiene"行 |
| **Layer 2: Reviewer** | named 猫猫 | 审查逻辑/架构/安全/风格，产出 findings + verdict | 直接改代码（只给 finding） | 金规"Cross-cat review verdict"行 |
| **Layer 3: Final Approver** | named 猫猫（可 = Layer 2 reviewer） | 确认 final HEAD 覆盖全部 review findings | 在 stale HEAD 上签字 | 金规"merge-gate"行的前提 |

**关键约束**：如果 reviewer 给了 semantic fix 建议（不只是 hygiene），author 改完后 **review provenance 必须重新闭合**（Layer 3 re-confirm on final HEAD）。Layer 3 的 APPROVE 是 merge-gate evidence 的 `reviewer` + `review_head` 来源。

### QC 触发策略

不是所有变更都需要完整 QC。MVP 触发策略按风险分层：

| 触发场景 | QC 深度 | 理由 |
|----------|---------|------|
| **共享能力改动**（shared/、MCP tool、skill、L0） | 完整 7-step | 影响所有猫，跨猫 review 必须 |
| **P1/P2 review feedback 修复** | 从 Step ③ 恢复 | 已有 reviewer context |
| **同类 finding 连续 ≥3 轮** | 退回 plan/spec 层 | 补锅匠信号（feedback_judgment_altitude） |
| **merge-ready PR** | Step ④⑤⑥⑦ | evidence + gate + telemetry |
| **跨 thread handoff** | Step ④（evidence manifest） | 接球方需要知道 QC 状态 |
| **低风险 doc polish / typo** | Step ① only（或跳过） | 完整 QC 是 alarm fatigue 源 |

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
  "review_head": null,
  "trigger_reason": "shared/ changed — full QC",
  "stale": false,
  "verdict": "pending",
  "next_owner": "reviewer:@codex"
}
```

- `pnpm qc:evidence` 生成并输出到 PR description 模板
- merge-gate 可机器读取 evidence 块验证 HEAD 一致性
- `stale` 字段在 HEAD 变化后自动 flip，`verdict` 回退到 `pending`

**A3. merge-gate 集成**

`merge-gate` skill 增加 evidence manifest 检查：
- evidence.head === PR current HEAD（防 stale evidence）
- evidence.stale === false（stale invalidation 已闭合）
- evidence.reviewer + evidence.review_head 闭合（有 reviewer sign-off 且 cover final HEAD）
- evidence.verdict === "passed"
- gate_passed === true

### Phase B: Fresh-Context Pre-Review（可选）

**B1. 认知负荷减负器**

在 cross-cat review 前，可选地用一个 fresh-context session（同族或不同族猫）扫一遍 PR diff，产出 finding list。

**Ownership**：由 **author** 在 PR 创建前自行触发。fresh-context 结果作为 PR comment 附在 diff 上，供正式 reviewer 参考。Reviewer 可选择忽略或采纳——不影响 reviewer 的独立判断权。

**设计约束**：
- fresh-context 是 **finding generator**，不是 approval authority（只产出"我看到这些"，不产出"APPROVE/BLOCK"）
- 目的是**降低正式 reviewer 的认知负荷**（reviewer 可以先看 fresh-context findings 再看 diff，节约时间）
- 不是必须步骤——小 PR / trivial change / 低风险 doc polish 跳过（见触发策略表）

**B2. Cross-Model Review 价值**

**盲点正交性**（讨论收敛的共识）：不同模型族有不同的系统性盲点。cross-model review 比 same-model fresh-context 多捕获的 finding = **reviewer delta metric**。

- Claude 族（布偶猫）的盲点 ≠ GPT 族（缅因猫）的盲点
- 跨族 review 的价值 > 同族 fresh-context

### Phase C: Git-Triggered Validation Tiers + QC Telemetry

砚砚设计的 3 级 git-triggered validation + 宪宪补充的 telemetry：

**C1. 三级 Validation Tiers**

> 注意：此处 Tier 1/2/3 是 validation 触发级别，与 spec 顶层的 Phase A/B/C（开发阶段）是不同维度。

| Tier | 触发点 | 类型 | 内容 |
|------|--------|------|------|
| **Tier 1** | `pnpm qc` / `pnpm gate` | 本地命令 | hygiene + lint + test + type-check |
| **Tier 2** | `pre-push` hook（soft） | 建议性 | 提醒未跑 gate / evidence 未生成 |
| **Tier 3** | PR check（开源仓 CI / 私有仓 manual） | 硬门禁 | merge-gate evidence 完整性验证 |

**硬约束**：
- ❌ 不 auto-push / 不 auto-merge / 不 auto-bypass cross-family review
- Tier 2 是 soft hook（可 `--no-verify` 跳过），Tier 3 是 hard gate

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
- 存储：`docs/qc-telemetry/` 或 memory system（TBD in OQ-1）

## F167 集成契约

F253 和 F167 (A2A Chain Quality) 的边界职责划分：

| 职责 | 归属 | 说明 |
|------|------|------|
| 调度 / 持球 / 唤醒 | **F167** | hold_ball 事件驱动，定时唤醒检查 |
| QC 何时触发 | **F253** | 触发策略表（共享能力改动 / merge-ready 等） |
| QC 证据包格式 | **F253** | evidence manifest JSON schema |
| QC verdict 语义 | **F253** | passed / blocked / stale |
| 事件路由 / escalate 传递 | **F167** | CI repair loop escalate 到猫时经 F167 路由 |
| 跨 thread QC 状态同步 | **双方协作** | F253 产出 qc.verdict event，F167 传递到目标 thread |

F253 **消费** F167 的 hold_ball / review-feedback / merge-gate 事件，**产出** qc.verdict + evidence packet。不复制 F167 实现。

## Acceptance Criteria

<!-- 立项愿景硬度自检（F216→F219）：每条 AC 必须 ① trace 回 Why 的某诉求 ② 非作者可复核（命令/数字/截图）。 -->

### Phase A（Local QC Pipeline）

- [ ] AC-A1: `pnpm qc:hygiene` 命令存在，执行 allowlist 内的 auto-fix 并报告 finding 清单（验证：运行命令观察输出）
- [ ] AC-A2: hygiene auto-fix 白名单定义在配置文件中，非白名单 finding 只报告不修改（验证：配置文件存在 + 非白名单 lint error 不被 auto-fix）
- [ ] AC-A3: `pnpm qc:evidence` 生成结构化 evidence manifest（JSON），含 head/gate_passed/commands/artifacts/trigger_reason/stale/verdict/next_owner 字段（验证：运行命令检查输出 JSON schema）
- [ ] AC-A4: `merge-gate` skill 能读取 evidence manifest 并验证 head === PR current HEAD + stale === false + reviewer provenance 闭合（验证：构造 stale evidence 测试 merge-gate 拒绝）

### Phase B（Fresh-Context Pre-Review）

- [ ] AC-B1: fresh-context pre-review 流程文档化（skill 或 SOP），明确标注"finding generator, not approval authority"，明确 ownership = author 触发（验证：读 skill 文档）
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

- **Related**: F217（Merge Gate Integrity — QC Loop Step ⑤ 基于 F217 的 merge-gate 扩展 evidence manifest 检查）
- **Related**: F167（A2A Chain Quality — 见「F167 集成契约」段。F253 消费 F167 事件，产出 qc.verdict + evidence packet，不复制实现）
- **Related**: F073（SOP Auto Guardian — QC telemetry 可接入 F073 的自动化守护）
- **Related**: F192（Eval Hub — QC telemetry 的 eval 指标可纳入 F192 eval 框架）

## Risk

| 风险 | 类型 | 缓解 |
|------|------|------|
| hygiene auto-fix 白名单过宽导致意外修改 | 技术 | allowlist 起步保守（只 format + import sort），逐步扩展 |
| fresh-context pre-review 被误当 approval | 技术 | spec + skill 文档硬写"finding generator, not approval authority" |
| QC telemetry 收集增加 review 流程摩擦 | 技术 | telemetry 尽量自动收集（从 PR metadata 提取），减少人工标注 |
| CI repair loop auto-fix 引入新 bug | 技术 | 只允许确定性修复（lint auto-fix 级别），逻辑修复直接 escalate |
| **QC Theater**：步骤齐全但无真信号——走完 7 步但每步都是橡皮图章 | 社会学 | telemetry 追踪 finding yield；连续 N 次 yield=0 → 审视 QC 是否在产出真信号 |
| **Review Laundering**：把 fresh-context pre-review 洗成正式 approval | 社会学 | Non-Goals #4 硬约束 + merge-gate 只认 Layer 2/3 named cat verdict |
| **Leader Creep**：一只猫事实上变成 QC 大副 / qc-bot 演化为 verdict signer | 社会学 | Non-Goals #1 #5 硬约束 + 定期审计 qc-bot commit 范围（不得超出 hygiene） |
| **Alarm Fatigue**：低风险变更也触发完整 QC → 猫麻木 | 社会学 | 触发策略分层（低风险 doc polish 只 Tier 1 或跳过） |
| **Identity Flattening**：为追求"流程统一"抹掉猫的专长和直觉差异 | 社会学 | reviewer 选择由 author 基于关系画像决定（不 round-robin）+ finding 带 named cat 签名 |

## Eval / Tracking Contract

| 项 | 内容 |
|----|------|
| **Primary Users** | 所有猫猫（开发者 + reviewer） |
| **Activation Signal** | 猫在 PR 流程中调用 `pnpm qc:*` 命令 / merge-gate 读取 evidence manifest |
| **Friction Metric** | QC 流程增加的 PR-to-merge 时间（目标：增加 < 3 分钟 per PR） |
| **Regression Fixture** | (1) hygiene auto-fix 不修改白名单外代码 (2) evidence manifest HEAD 不匹配时 merge-gate 拒绝 (3) CI repair loop 同类失败第 3 次 escalate (4) 缺 targetCats 的 QC request 被拒 (5) disabled cat soft degradation（reviewer 不可用时降级到同族其他个体） (6) reviewedSha 过期导致 stale flag flip + verdict 回退 (7) fresh-context 结果不能被 merge-gate 当 approval (8) 同类 P1 连续 3 轮触发回退到 plan/spec 层 (9) 重复事件去重（同 idempotencyKey 不重复唤醒） |
| **Sunset Signal** | QC telemetry 连续 30 天 false positive rate > 50% → 审视 finding 策略；post-merge bug rate 无改善 → 审视 pipeline 有效性；**reviewer delta < 10% 连续 30 天** → 假设"跨模型盲点正交"被证伪，审视 Phase B 是否 sunset 或收紧触发 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | QC telemetry 存储位置：docs 文件 vs memory system vs 数据库？ | ⬜ 未定 |
| OQ-2 | fresh-context pre-review 是否对所有 PR 默认开启还是 opt-in？ | ⬜ 未定（当前设计：author opt-in，触发策略表可推荐） |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | "QC 触发可以自动，授权不能自动" | Kun Chen 调研后铲屎官 + 宪宪 + 砚砚三方共识：Cat Café 伙伴价值观不允许匿名化审批 | 2026-06-25 |
| KD-2 | allowlist not blocklist for hygiene auto-fix | 保守起步，防止 auto-fix 意外修改非确定性代码 | 2026-06-25 |
| KD-3 | 3-layer reviewer split（砚砚设计） | 消除 reviewer 顺手改代码导致 review provenance 断裂 | 2026-06-25 |
| KD-4 | same-class CI detection + max 2 rounds | 防止 CI repair loop 无限循环，同类错误连续 3 次必须人工介入 | 2026-06-25 |
| KD-5 | 不配 self-hosted CI（继承 F217） | 私有仓 < 1% 违规不值 CI 成本（F217 铲屎官裁决），gate 靠本地 + 家规 | 2026-06-25 |
| KD-6 | hygiene auto-commit 签名用 `[qc-bot]`，不用猫签名 | 猫签名 = "我对这段代码负责"；确定性工具借猫名声背书会破坏 provenance。qc-bot 是工具身份，不是猫身份。（解决原 OQ-3） | 2026-06-25 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-06-25 | 立项。来源：Kun Chen 调研（宪宪 + 砚砚双猫阅读）→ 铲屎官讨论 → 宪宪×砚砚设计收敛 |
| 2026-06-25 | GPT Pro spec-level review: 方向 APPROVE，提 8 个硬点 |
| 2026-06-25 | Opus 4.7 final-audit: BLOCKING，12 项 spec patch（含 GPT Pro 8 点 + 4 项新发现） |
| 2026-06-25 | Spec v2 patch：12 项全部落地 |

## Review Gate

- Spec review R1: GPT Pro (@gpt-pro) — 方向 APPROVE + 8 个硬点 ✅ 已落地
- Spec review R2: Opus 4.7 (@opus-47) — BLOCKING → 12 项 spec patch → 待 re-confirm
- Phase A implementation: 跨族 review

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Research** | library `research:agentic-workflow-kun-chen` | Kun Chen 调研报告（宪宪 + 砚砚双猫） |
| **Feature** | `docs/features/F217-merge-gate-integrity.md` | merge-gate 加固（QC Loop Step ⑤ 基础） |
| **Feature** | `docs/features/F167-a2a-chain-quality.md` | A2A 质量链 + hold_ball 事件驱动（见 F167 集成契约段） |
| **Discussion** | 本 thread（Kun Chen 调研讨论） | 7-step QC Loop 设计收敛全程 |

## 来源致谢

本 feature 的方法论灵感来自 **Kun Chen (@kunchenguid)** 的开源工具 [`no-mistakes`](https://github.com/kunchenguid/no-mistakes)（git proxy validation pipeline）和 [`axi`](https://github.com/kunchenguid/axi)（Agent eXperience Interface），经宪宪和砚砚批判性调研后，取其 QC pipeline 方法论，适配 Cat Café 伙伴价值观。
