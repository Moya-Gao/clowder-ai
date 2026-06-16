---
feature_ids: [F237]
related_features: [F203, F042, F154, F168, F202]
topics: [prompt-injection, transparency, intake, community, l0-template]
doc_kind: spec
created: 2026-06-15
---

# F237: Prompt Injection Visibility — 社区 PR #859 Intake

> **Status**: direction-accepted (2026-06-16 maintainer self-decided) — awaiting-author-fix (P0 loopback gate + P1 atomicity + P1 verify-coverage 8%) — gated-on F238 boundary symmetry | **Owner**: cat-cafe maintainers (intake review) | **Source**: community @mindfn + 团队 | **Priority**: P1 | **Created**: 2026-06-15 | **Updated**: 2026-06-16

## Provenance

- **Community PR**: [clowder-ai#859](https://github.com/zts212653/clowder-ai/pull/859) — `feat(F226): Prompt Injection Visibility — Phase 1 (Checkpoints A–D)`
- **Maintainer discussion issue**: [clowder-ai#839](https://github.com/zts212653/clowder-ai/issues/839) — `Make agent context injections visible, auditable, and lifecycle-managed`（状态：`triaged + needs-maintainer-decision`）
- **作者**: `@mindfn` 团队（社区，与 F202/F204/F205 同贡献者；他们 fork 内部也有 opus/codex 命名重合的猫，**非 cat-cafe 家里的猫**）
- **作者团队历史**: 6 轮本地 codex review + 4 轮云端 codex review，34 finding（1 fixed / 2 pushback / 31 declared Phase 2 scope）
- **PR scope**: 102 文件 / +5644 / -979 / `MERGEABLE` / `reviewDecision=CHANGES_REQUESTED`

## 编号纠错背景（认知投毒预防）

PR #859 在 clowder-ai 仓声称 `feat(F226)`，但：

| 编号 | 家里 main 上是什么 | PR 里是什么 |
|---|---|---|
| **F219** | `tech-debt-architecture-evolution`（我 = 宪宪 owned） | PR branch 名残留（`feat/f219-injection-visibility`） |
| **F226** | `presentation-surface-demo-mode`（06-06 占用） | PR title 写的 F226（撞了） |
| **F236** | `anchor-first-context-entry`（06-15，平行 48 + 砚砚 owned） | 一度也想用，撞了 |
| **F237** | **本 intake doc** ✅ | — |

PR 作者**已在 body 第一段主动声明 "F226 collision, requesting reassignment"** —— 不是冒用，是时间冲突 + 历史 branch 命名残留。F237 正式归属本 intake。

## Why（社区方向 + 内部价值）

社区 issue #839 的核心痛点：cat-cafe 的 prompt/hook 注入系统**对 operator 不可见**——52 段注入散布在 `SystemPromptBuilder.ts`、`route-serial.ts`、`route-helpers.ts`、shell hooks 里，没有统一清单、没有 Console 可见性、operator 无法看到注了什么 / 为什么 / 哪些可以自定义。

motivating example（作者举的）：thread `thread_mpuxhppp0vzl2y16` 中 opus-47 被一个 startup hook 的卫生警告**带偏任务**——根因是没有可见性 + 没有 priority/demotion 机制。

**与家里现有方向的关系**：
- **F203 (Native System Prompt L0)** 做过 read-only viewer + 消费链标签（Phase F/G），但 scope 只覆盖 L0 段；社区 PR 把 viewer 扩展到全部 52 段 + 加 3 段 overlay 编辑器。
- **F042 (提示词 & Skills 优化)** 是旧的 prompt 审计，不是这个方向。
- **F154 / F168 / F190** 是社区 intake 基础设施。

## PR #859 实际交付物（intake audit 实测，2026-06-15）

### 等价重构（不丢能力，编译输出声称 byte-identical，作者带 `verify-template-extraction.mjs` 验证）

| 改动 | 搬到哪 |
|---|---|
| L0 主文件 -89 行 §1/§2/§4-9 | `assets/prompt-templates/l1-l7-*.md` 7 模板 |
| `MCP_TOOLS_SECTION` 内联字符串 | `s13-mcp-tools.md` |
| `WORKFLOW_TRIGGERS` 4-breed 大 Record | `workflow-triggers.yaml` |
| `mission-pack.ts` 拼字符串 | `m1-dispatch-mission.md` |
| `transcript-path-hints.ts` 拼字符串 | `m2-transcript-hints.md` |
| `navigation-context.ts` 导航 envelope | `n1-navigation.md` |
| `buildInvocationContext` 内 D13-D18（routing/SOP/voice/bootcamp/guide/world）6 段 | `d13-d18-*.md` 6 模板 |
| routing/*.ts 加 `/* @segment Xx */` 标注 | 纯注释 |

### 新增能力

- Console UI lifecycle viewer（嵌套流程图，52 段 × session/turn/event lifecycle）
- compiled preview modal（按猫预览最终拼出的 prompt，标 "approximate"）
- display-only manifest YAML（每段 3 标签：`safetyTier` / `allowLocalOverride` / `transparencyTier`）
- 3 段 overlay 编辑器（S6 workflow triggers / S13 MCP tools / C1 MCP callback——本来就有 `.local` overlay 文件机制的段）
- 49 段 readonly（403 拒写）
- `annotateSegments` 选项给 preview UI 用
- `scripts/check-manifest-drift.mjs` (159 行) harness 守护

### 🔴 行为变化（未在 PR body 充分披露 — 需 push back）

| # | 变化 | 作者声明 | maintainer 判断 |
|---|---|---|---|
| 1 | `buildReviewerSection` 整个函数删除（≈48 行）+ 4 个测试删 + 3 个相关 import 删（`catHasRole`/`getReviewPolicy`/`isCatLead`） | "X1 dead code removal, review SOP 替代" | **嫌疑**——猫的 prompt 里不再有"## 你当前的 Reviewers"段自动列跨族 reviewer。"review SOP 替代"未指明具体在哪 |
| 2 | `buildSystemPrompt` 从 `packages/api/src/domains/cats/services/index.ts` 公共 export 删了（函数本身还在 SPB.ts:897） | PR body 未提 | **嫌疑 typo / 未披露 API 收紧** |

## 方向决策（待 maintainer 接受）

issue #839 状态 `needs-maintainer-decision` — **方向未拍板**就先实现了 Phase 1。需要先回答：

1. **方向接受？** "prompt injection 透明化（看 + 3 段可编辑）"是否符合 cat-cafe 愿景？
2. **scope 接受？** Phase 1 已交付的（read-only viewer + 模板提取 + 3 段 overlay 编辑）是否可以单独 merge，还是要拆？
3. **Phase 2 接受？** 作者把 31 个云端 finding 归类为 "Phase 2"，是否同意将来另 PR？

## Push Back 清单（已发到 PR #859 — 待作者回应）

详见 PR comments。当前 P1：

- **P1.1** `buildSystemPrompt` 不再 export 是有意 API 收紧还是 typo？请补 PR body 说明 + 列出 migration path
- **P1.2** `buildReviewerSection` 删除的"review SOP 替代"具体指哪个 skill / 哪条 SOP？grep clowder-ai 仓库确认真的没有 prompt 路径以外的 caller（CLI / scripts / tests / fixtures）？

P2（锦上添花）：

- **P2.1** PR body 贴 `verify-template-extraction.mjs` 运行输出，让 reviewer 看 byte-identical 证据
- **P2.2** reviewer section 删除如果要做，建议单开 PR——和 "prompt injection visibility" 是两件事，混进同一 PR 模糊评审焦点

## Intake Risk

按 `opensource-ops` 双仓边界：**L0 + SystemPromptBuilder + compile-system-prompt-l0.mjs 是家里核心 harness**。社区 PR 改这一类内容默认升级 maintainer signoff（不可走 patch 自主 merge 4 条件）。

具体风险点：
- 🛡️ **Brand Guard**：intake 时要避免社区仓的品牌词（"Clowder AI"）覆盖家里（"Cat Cafe"）—— 已知存在 `assets/system-prompts/system-prompt-l0.md` 等品牌敏感文件
- ⚠️ **反向工作流警报**：5800 行改 L0 核心**理论上**应先在 cat-cafe main 走 SOP（Design Gate + review + merge-gate），社区先在 clowder-ai 实现再 intake 是反向。此处属于"社区主动贡献"的合理例外，但 intake 时必须重做 cat-cafe 侧的 Design Gate + review。
- ⚠️ 删 38 行测试（X1 reviewer section）—— intake 必须确认 review SOP 真有替代物

## Review History

### Round 1 (2026-06-15) — Push Back: P1 behavior changes
- 发现 `buildSystemPrompt` export 删除 + `buildReviewerSection` 整体删除（混 scope）
- 作者 24h 内全 fix：commit `68f805ff1`（restore export + revert reviewer section + 4 tests + 3 imports）
- F237 编号 ack + ROADMAP 同步 + 文件名 rename 全闭环

### Round 2 (2026-06-16) — Push Back ack + 方向状态澄清
- 验证作者 fix 真实落地（services/index.ts + SPB.ts +114/-5 + tests +41/-3 全核）
- 明确 "push back closed ≠ approval to merge"，方向决策 + intake 还在 gate

### Round 3 (2026-06-16) — Deep audit: **BLOCK**
3 并行 agent 深审发现：
- 🔴 **P0**: `prompt-injection.ts:48-63 requireOverlayWriteAuth` 缺 `isLocalCapabilityWriteRequest` loopback gate；配合 `DEFAULT_OWNER_USER_ID` 未设时 owner gate fall-through，任何 authenticated session 能写 overlay = **"transparency viewer" 武器化为 prompt-injection 攻击面**
- 🔴 **P1**: `prompt-injection.ts:271` 非原子写（无 tmp+rename），crash/concurrent 损坏 overlay
- 🔴 **P1**: `verify-template-extraction.mjs` 只验 4/49 = **8% 覆盖伪装成 100% 声明**
- 🟡 **P2**: layout.tsx vs manifest.json 品牌不一致（outbound sanitizer 漏）
- 🟡 **P3**: `check-manifest-drift.mjs` 半-invariant

Round-3 push back: [#859 issuecomment-4719426674](https://github.com/zts212653/clowder-ai/pull/859#issuecomment-4719426674)

## Direction Decision (2026-06-16, maintainer self-decided)

**Accepted** — Phase 1 scope (read-only viewer + 模板提取 + 3 段 overlay editor) fit 家里愿景：
- F203 (Native L0) 一脉：把 viewer 扩到全 52 段
- F042 (prompt audit) 治理延续
- 作者协作度高（push back 2 轮全 fix），技术质量除 P0 安全洞外干净

**Why self-decided（不再升级铲屎官）**：可逆（PR 未 merge，方向可撤回判断）+ 不碰硬排除（不动 Redis 圣域/愿景/数据/契约）+ 能翻代码查到。家规 §3 决策漏斗 = 可自决范围。

**两条硬前置在 accept 之前**：
1. **作者 fix Round-3 P0/P1**（loopback gate + atomicity + verify coverage）
2. **F238 双仓边界对称性强化** Phase A 落地（brand-dictionary v0.1 + skill 12/13/22 更新 + outbound 漏 manifest.json 修）

F237 intake **gated on both 前置条件完成**。

## Next Steps

1. ⏳ **作者 fix Round-3 P0/P1**（PR tracking 已取消，等社区微信通知作者侧"修完了"信号）
2. ⏳ **F238 Phase A 落地**（cross-posted 委托 `thread_mqgrbaol7mbx6ygs` 给 @fable5 写 spec + @codex 砚砚 落 brand-dictionary v0.1）
3. 两前置完成后：进入 opensource-ops B 流程（Inbound PR Merge Gate → Intake Intent Issue → manual-port + brand guard）— 此时 brand guard 已被 F238 升级为 dictionary-driven
4. 终局 merge 后 Phase 2 后续 PR（作者归类的 31 个云端 finding 范围）另行评估

## 关联

- Source: community PR [#859](https://github.com/zts212653/clowder-ai/pull/859), issue [#839](https://github.com/zts212653/clowder-ai/issues/839)
- Related features: F203 (Native L0)、F042 (prompt audit 旧)、F154/F168 (community intake infra)、F202 (作者团队历史 owned)
- Skill: `opensource-ops` (Inbound PR 场景 B)

---

**[宪宪/Opus 4.7🐾]** — intake 守门猫 (2026-06-15)
