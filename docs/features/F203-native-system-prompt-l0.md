---
feature_ids: [F203]
related_features: [F086, F167, F198, F210, F211, F061]
topics: [system-prompt, governance, prompt-engineering, compression-immunity, l0-injection]
doc_kind: spec
created: 2026-05-15
---

# F203: Native System Prompt L0 — 压缩免疫核心规则注入

> **Status**: in-progress | **Owner**: 布偶猫 Opus 4.7 | **Priority**: P1

## Why

### 最终目标（铲屎官 2026-05-15 原话版本）

> "F203 的最终目标就是优化重构现在的系统提示词，让布偶猫和缅因猫不要受到太多原本不合理的系统提示词的影响，把我们自己原本应该构建在系统提示词但是没能进去的进入系统提示词。Claude Code 也好 Codex 也好那些客观性的系统提示词不能丢。"

**用人话翻译**：

1. **删掉默认系统提示词里和我们工作方式冲突的"主观行为指导"**——Claude Code/Codex 默认教我们"minimal fix / no comments / three similar lines is better than abstraction / don't add features beyond task / responses should be short and concise"。这些规则是为防普通 AI 过度工程化设计的，和我们家"愿景驱动 + TDD + 质量门禁 + 顺手治理"工作方式直接冲突——压缩后默认指令还在，我们的伙伴哲学不在，**糊弄赢**。

2. **把家规从 user message 切到 system role**——Magic Words / Rule 0 / P1-P5 / 球权三选一 / 五条铁律 / WORKFLOW_TRIGGERS / 协作哲学这些 P0 级规则当前通过 user message prepend 注入，每次压缩丢失需要重教（"10 轮对话教 10 次传球"）。切到 system role 后压缩免疫。

3. **保留默认系统提示词里的"客观性"内容**——铲屎官明确约束。

### 客观性指令保留清单（不能丢）🔴

切换到 `--system-prompt` 替换式后，以下默认指令必须在我们的 L0 里 **重写或保留**：

| 默认指令段 | 内容 | 为什么不能丢 |
|----------|------|------------|
| `Wm3()` 工具执行模型 | tag 解释、权限、压缩感知 | 猫不知道自己会被压缩 → recall 时机失准 |
| `Gm3()` 危险操作可逆性 | destructive 操作前要确认 | 安全反射，删了 force push / drop table 没刹车 |
| `Rm3()` 工具使用 | 并行工具调用、工具优先级 | 删了猫不会自动并行调用 → 性能掉很多 |
| `Vm3()` Session-specific | Agent / Skill / TaskCreate / ScheduleWakeup / loop 使用规则 | 工具发现机制依赖这段，删了 Skill 加载/cron 都会断 |
| 工具描述段 | Read/Edit/Grep/Bash/PDF/image 的 schema 和使用说明 | 复杂工具 schema 删了模型不会用 |
| Git 操作模板 | commit / PR / 安全协议 | 删了模型不知道怎么做 git 操作 |

要删的"主观行为指导"清单：

| 默认指令 | 为什么删 |
|---------|---------|
| `Don't add features, refactor, or introduce abstractions beyond what the task requires` | 反愿景驱动 |
| `A bug fix doesn't need surrounding cleanup` | 反顺手治理 |
| `Three similar lines is better than a premature abstraction` | 反 DRY + 文件 350 行硬上限冲突 |
| `Don't add error handling for scenarios that can't happen` | 多猫异步协作"不可能"经常发生 |
| `Default to writing no comments` | 反 WHY 注释文化（ADR-030 §4） |
| `Don't design for hypothetical future requirements` | 反 Phase 规划 + 设计门禁 |
| `Your responses should be short and concise` | 复杂交接需要五件套结构 |

### 架构归属

**Architecture cell**: harness/system-prompt-injection
**Map delta**: update required（注入链从 user-message-prepend 改为 native-system-role；ADR-030 §3 已记新流程）
**Why（一句话）**：删默认糊弄哲学 + 加我们家规进 system role + 保留默认客观性指令。

## What

按 ADR-030 §10.2 14 项 L0 清单切换到 native system role 通道：
- **Claude 猫**：`ClaudeAgentService(-p)` 与 `ClaudeBgCarrierService(--bg)` 都走 `--system-prompt-file <compiled L0>`；carrier 选择只控制执行模式，不控制 F203 是否生效
- **Codex 猫**：`codex exec -c 'developer_instructions="<compiled L0>"'`（S4 实测 per-call 注入 ✅）
- **Gemini / Antigravity 猫**：2026-05-31 重新评估后拆线处理（KD-20/KD-21）：`gemini --acp` / Gemini CLI 不再作为 F203 主线；只保留 enterprise/API-key fallback。后续 native L0 重点转为两个 Antigravity spike：AGY CLI（headless Google carrier）与 Antigravity Desktop/IDE（Bengal）。

### Phase A: Baseline + 扩展 spike（无风险前置）

S0-S5 spike 全部完成再进 Phase B。详见 Spike Log。

### Phase B: L0 真相源 + 编译脚本

- 写 `assets/system-prompts/system-prompt-l0.md`，分两段：
  - **客观性 carry-over 段**：把上述"客观性指令保留清单"6 项从 Claude Code 默认 prompt 提取/压缩/重写——工具能力 / 并行调用 / safety 反射 / 压缩感知 / Skill+TaskCreate+Schedule+loop / Git 模板
  - **家规段**：ADR-030 §10.2 列的 14 项 L0 内容
- 写 `scripts/compile-system-prompt-l0.mjs`（输出 per-cat L0 字符串：客观性段 + 身份 + 队友 + WORKFLOW_TRIGGERS + 家规段）
- 单测验证：客观性 6 项 + 家规 14 项全覆盖、token 总量 ≤ 4,500（含客观性段后上调）、per-breed 稳定（cache key 不漂移）

### Phase C: 实施 + runtime 重启验证（直接切，不灰度）

铲屎官 2026-05-15 directive："如果不好我们都有 git log 能恢复——不搞灰度，那些太麻烦了 我们也不现实。"

- Claude carrier argv 加 `--system-prompt-file <compiled L0>`：`ClaudeAgentService(-p)` 与 `ClaudeBgCarrierService(--bg)` 行为一致（直接替换，不留 feature flag）
- `CodexAgentService.spawn` argv 加 `-c 'developer_instructions=<compiled L0>'`
- `effectivePrompt` 拼装逻辑：删除 `params.systemPrompt + promptWithMission` prepend 路径（system prompt 已在 argv 里，user message 只剩 prompt 本身）
- F-BLOAT 测试保护：resume 时 system prompt 不重复（spawn argv 每次新传，session 内不累积——靠 daemon/Codex 自身管理）
- 验证：runtime 重启后 47 + 46 + 砚砚各跑一轮 + 铲屎官跑 10 轮含压缩对话——直接观察行为变化
- **回滚机制**：出问题铲屎官说一声 → `git revert <commit>` + runtime 重启，3 分钟回滚

### Phase D: Root md 瘦身

- CLAUDE.md 188 行 → ~60 行：删 SOP 表、记忆系统详述、Knowledge Feed 完整段、代码规范、关键文档表；保留 identity + 五条铁律 + 流程闭环检查点 + 布偶猫专属规则
- AGENTS.md 207 行 → ~60 行：同比例
- 单独行动：root md 删队友静态表（SystemPromptBuilder 已动态生成，副本是漂移源），独立 PR 不阻塞主路径
- 验证：跑一次实际 invocation，确认压缩后 14 项规则仍在 system prompt 里、user message 显著瘦身

### Phase E: CC 版本升级拆解 SOP（重要远见）

铲屎官 2026-05-15 原话："我估计每个 claude code 大版本更新我们需要拆一次 cc 的系统提示词，比如他添加了新的功能性系统提示词我们得补"。

落地：
- 写 `scripts/audit-claude-code-system-prompt.mjs`：`strings $(which claude) | grep -E '<patterns>'` 提取最新 system prompt 关键段
- `docs/audits/cc-system-prompt-vN.N.N.md`：每次升级后归档当时提取的内容
- 注册 cron / GitHub Action：检测 `claude --version` 变更 → 跑 audit → diff 上一版本 → 找新增"功能性"指令（工具发现 / safety / 压缩 / 新 agent 模式）→ 提案 PR 更新 `system-prompt-l0.md`
- 在 `cat-cafe-skills/refs/cc-system-prompt-audit-sop.md` 写 SOP：每次 CC 大版本（minor 及以上）必跑 audit
- 同款 SOP 对 Codex CLI 适用：`strings $(which codex)` audit + 归档

### Phase F: 配置栏 系统提示词可见化（铲屎官 2026-05-16 提醒）

铲屎官 2026-05-16 原话："我们的配置栏有个叫规则与SOP 我建议这里需要把我们替换的系统提示词和其他那样可见！这样方便人去看现在的系统提示词到底是什么？如果别人要定制修改也知道要去修改什么？"

**Why 现在补**：Phase C 把 L0 切到 native system role 后，L0 内容只在 `assets/system-prompts/system-prompt-l0.md` + compile 渲染时存在——铲屎官（和其他人）没有可见入口看"当前注入到猫的系统提示词到底长什么样"。`packages/web/src/components/settings/settings-nav-config.ts:74-78` 已有 `id: 'rules'` 配置栏「规则与 SOP」（描述含"模型提示词入口"），但目前只展示家规/SOP 不展示 L0。

落地（待 Design Gate）：
- 配置栏「规则与 SOP」加 L0 系统提示词查看区：
  - 真相源：`assets/system-prompts/system-prompt-l0.md` template + per-cat 渲染产物（`compileL0({catId})` 输出）
  - per-cat 切换：opus-47 / codex / gpt52 / gemini 各自的 compiled L0 都能查看
  - 区分 template（含 `{{IDENTITY_BLOCK}}` 等占位）vs compiled（占位已替换）
- 自定义/修改路径明示：
  - 修改 template → 编辑 `assets/system-prompts/system-prompt-l0.md`
  - 修改 per-cat 渲染 → 改 `scripts/compile-system-prompt-l0.mjs` 的 builder helper
  - 改完 → `pnpm gate` + runtime 重启验收（KD-5 git revert 回滚通道）
- read-only 还是可编辑？→ Design Gate 决定（read-only 安全简单；可编辑要 + dirty/save/reload + 影响范围警告）

**Design Gate 决定（AC-F1，2026-05-16 opus-47，autonomous）**：**read-only**（做 AC-F2/F3/F4，**defer AC-F5 可编辑**）。依据：① 铲屎官原话是"**可见**/看...**到底是什么**/知道要去**修改什么**"——诉求是可见性 + 修改入口指引，非 in-app 编辑器；② AC-F5 spec 明标"（可选）"；③ L0 治理全猫 identity/家规/safety，web-editable = P0 风险面，而 file+git+`pnpm gate`+restart 已是 KD-5 文档化回滚通道，可编辑 marginal gain ≪ risk（YAGNI/P-value）。read-only 100% 覆盖铲屎官诉求。AC-F5 additive，铲屎官日后要 in-app 编辑可低成本重启。剩余 Design Gate（template/compiled 切换形态 + per-cat 切换 UX）走 console-dev 前端交付范式（Design gate 由设计/暹罗猫审，非逐步铲屎官）。

依赖：Phase C 合入 main（L0 注入通道稳定后才有意义可见化）✅ 已合入。建议作为独立 PR / 独立 thread 跟进。

### Phase G: Governance L0 单源编译 + 消费链可见化（#747 / #749）

铲屎官 2026-05-21 指令：先做 #747，再做 #749；#748 先讨论、暂不动。

**#747 问题**：`shared-rules.md` / `system-prompt-l0.md` §3 / `SystemPromptBuilder` fallback digest 曾是多份物理表示；`.local-override` 只挂在 fallback 路径。结果是同一套家规可能漂移，native L0 和 fallback 看到的治理内容不一定同源。

落地：
- 新增 governance L0 编译器：`cat-cafe-skills/refs/shared-rules.md` → deterministic compiled governance block。
- `assets/system-prompts/system-prompt-l0.md` §3 改为 `{{GOVERNANCE_L0}}`，native L0 每次编译时替换。
- `SystemPromptBuilder` fallback 不再维护硬编码 `GOVERNANCE_L0_DIGEST`，改读同一编译产物。
- `shared-rules.local.md` / `shared-rules.local-override.md` 挂到编译层：native + fallback 同时生效；override 保留旧语义（replace final governance block）。

**#749 问题**：Rules & SOP 面板只展示文件，没告诉人“这个文件到底有没有进 prompt”。Phase F 解决了 L0 可见，但没有解释消费链。

落地：
- `/api/rules` 返回 `consumption` 元数据：`actual-prompt` / `reference` / `skill-on-demand`。
- 「规则与 SOP」面板显示四类标签：
  - **实际进 prompt**：`shared-rules.md` → governance L0 compiler → native/fallback；L0 template / per-cat compiled L0。
  - **harness 注入**：root `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` 这类 provider project-doc 会被对应 CLI/harness 注入上下文，但不是 Cat Café native L0 真相源。
  - **只是参考**：`docs/SOP.md` 等人工流程文档，不直接进入 native L0。
  - **skill 按需加载**：`SKILL.md` 仅在 skill 被选择/调用时读取。

**#748**（SOP vocabulary / `sop_navigation` 分散）：#747/#749 已合入；2026-05-22 社区（terrenceeLeung / 天一）提交设计提案（第三选项——新建 `SopDefinition` 单一源、`sop_navigation` 并入），方向对齐 green light。CVO 决策：归 F203、不新开 F 号，作为 Phase G 之后的独立 work item；实现路径同 #747（Cat Café 上游实现 + 同步）。**2026-05-23 design pivot**（CVO 反思 "skill = 软约束需硬约束兜底"）：① `hard_rules / pitfalls` **keep + 加 machine-checkable predicate 字段**（不 drop 不 park）——它们是 `eval:sop` domain 的 ground truth，feeds F192 Phase E-sop；② schema **domain-generic from day 1**——`development` 只是第一个 domain，未来 video-cocreation / tech-article / family-office 同 schema 不同实例（消除当前 video-forge / ppt-forge / tech-writing / expert-panel 等多阶段 skill = SOP 错位写进 skill body 的归位错位）；③ `sopDefinitionId` seam 定位重新校准——不是 "YAGNI future-proofing"，是多 domain 装载入口（§6.2 的真正价值）。**2026-05-23 implementation merged**（PR #1868, squash `3d5c76772`）：`sop-definitions/development.yaml` 成为 development SOP stage 单一机器可读源，`manifest.yaml:sop_navigation` 删除；schema/codegen/check 生成 runtime `SopStage` / `SOP_DEFINITIONS` catalog，API + Mission Control 面板改读 definition-derived suggested skill，`nextSkill` 明确为 override；18 条 hard rules / pitfalls 迁入 predicate-backed ground truth，cross-domain stubs 只参与 schema 校验不进 runtime union；F192 `eval:sop` runtime evaluator 仍按计划 out of scope。详见 Timeline 2026-05-22 / 2026-05-23 + clowder-ai#748 + F192 Phase E-sop。

## Acceptance Criteria

### Phase A（Baseline + 扩展 spike）

- [x] AC-A0: S0 — `claude --bg --system-prompt` 兼容性 spike（实测 job `f6474047` 暗号 `F198_BG_SYS_OK` 回收 ✅）
- [x] AC-A1: S1 — `scripts/measure-system-prompt.mjs` 量 baseline，每猫每模式（serial/parallel/independent）token 数表格 ✅ 2026-05-15 见 `docs/audits/2026-05-15-system-prompt-baseline-v0.md`
- [x] AC-A2: S2 — 扩展功能性 spike（砚砚 review 修正后定稿 2026-05-15）：safety ✅ / 并行调用 ✅（误判已撤回）/ TaskCreate ✅ / Read schema ✅ / Skill 加载 ✅ / Schedule ✅ / 压缩感知 ✅。**0 项退化**。详见 `docs/audits/2026-05-15-functional-spike-s2-s3.md`
- [x] AC-A3: S3 — F-BLOAT 复现（部分完成 2026-05-15）：S3-a `--append-system-prompt` bg 模式能传内容 ✅（推翻历史"didn't receive content"注释）；S3-b resume 累积推迟到 Phase C 实施前跑
- [x] AC-A4: S4 — Codex `developer_instructions` per-call 注入（砚砚 `62b9255e2` ✅）
- [⊘] AC-A5: S5 — Gemini `GEMINI_SYSTEM_MD` 替换式 spike **不再作为 F203 主线**（KD-20：consumer Gemini CLI/Code Assist requests 2026-06-18 停服；enterprise/API-key fallback 如未来明确需要再单独做）

### Phase B（L0 真相源）

- [x] AC-B1: `assets/system-prompts/system-prompt-l0.md` 包含 14 项全部内容 ✅（branch `9105d184f`，测试 `14 L0 governance items coverage` 全覆盖）
- [x] AC-B2: `scripts/compile-system-prompt-l0.mjs` 输出 per-cat 编译结果 ✅（6 catId 测试覆盖 + per-cat overlay 替换 + 36 测试全绿）
- [x] AC-B3: 编译 token 总量 ≤ **5,500** ✅（**两次上移**：4,500→5,000 见 KD-9；5,000→5,500 见 KD-14——codex user-layer strip 把 Codex CLI 专属「长任务纪律」迁入 maine-coon native overlay，maine-coon 实测 5,154-5,155t。5,500 仍在 Claude 4.x prompt cache 单 breakpoint 内 + 占 200k context 2.75%）
- [x] AC-B4: per-breed cache key 稳定 ✅（same catId byte-identical 测试通过）

### Phase C（dual-path 落地）

- [x] AC-C1: Claude carriers argv 加 `--system-prompt-file <compileL0>` ✅（`ClaudeBgCarrierService` Task 3，commit `bfeaab76f`；`ClaudeAgentService(-p)` 2026-05-24 parity fix；l0CompilerFn seam + fail-closed compile error；claude-bg-carrier-l0.test.js + claude-agent-service F203 guard tests。KD-10/KD-18：走文件不硬编码，carrier 选择正交于 L0 注入）
- [x] AC-C2: `CodexAgentService` argv 加 `-c developer_instructions=<compileL0>` ✅（Task 4，commit `ebe904529`；per-call argv 不污染 `~/.codex/config.toml`，@codex/@gpt52/@spark cat-scoped；codex-agent-service-l0.test.js 3 tests，S4 砚砚 `62b9255e2` 对齐）
- [x] AC-C3: 剥离 `params.systemPrompt` 非 pack prepend ✅（Task 2，commit `5305d08c4`；新增 `buildStaticIdentityPackOnly`，route-serial / route-parallel 通过 `injectsL0Natively()` 切 pack-only，非 pack 走 native system role；system-prompt-builder 113/113 守护零回归）
- [x] AC-C4: F-BLOAT resume 不累积 ✅（native `--system-prompt-file` replace-mode 天然免疫；pack-only 走未改的先验 new-session gate invoke-single-cat:1079-1088，invoke-single-cat-resume-health 覆盖）
- [x] AC-C5（merge-gate 部分）✅：PR #1709 squash-merged 2026-05-16T08:26Z（commit `d55cb688e`）；`pnpm gate` ✅（3070 tests），砚砚本地×2 round APPROVE（P1 cliConfigArgs + P1-cloud 修复），云端 round-1 抓 2 P1 全修，round-2 push back 1 P1（无现实复现，按 merge-gate 表降 P3-comment-pass）。2026-05-24 alpha probe 暴露 production default `ClaudeAgentService(-p)` 仍走 pre-F203 prompt path，本 fix 补齐两 Claude carriers 注入一致。**仍待**：runtime pull + restart 后，default `-p` 与 `bg_daemon` carrier 均需通过 behavioral probe，再跑 47/46/砚砚 各一轮 + 铲屎官 10 轮压缩对话客观性终验。

> Phase C 实施前置（执行顺序，防回归窗口）：Task 0 spike（`ca3efead7`）→ Task 1 A8 gap（`fd4e634ca`）→ Task 3a 共享 l0-compiler helper（`24dd15541`）→ Task 3/4 接通 → Task 2 删重复。终态：L0（非 pack 身份/家规/MCP）在压缩免疫 native system role，user message 仅 pack blocks + invocationContext + prompt。

### Phase D（root md 瘦身）

- [x] AC-D1: CLAUDE.md ≤ 65 行 ✅（200→62，PR #1710 squash `1c92a1d2b`）
- [x] AC-D2: AGENTS.md ≤ 65 行 ✅（219→60，同 PR）
- [x] AC-D3: 删队友静态表 ✅（CLAUDE.md/AGENTS.md 静态 roster 表删除，SystemPromptBuilder 动态生成为真相源）
- [x] AC-D4: 守护测试全绿 ✅（`root-md-slim.test.js` 9/9 + `f188-harness-consistency` 7/7 + `pnpm gate` 3070 tests；SystemPromptBuilder 未改动——Phase D 纯 root md 瘦身不碰 L0 注入链）

> Phase D merge：砚砚本地 APPROVE（no findings，47 盲审 quality-gate）→ 续 review 延续 ×2（rebase + 云端 P2 fix）→ 云端 round-1 P2（lineCount trailing-newline off-by-one，VERIFY 三道门 legit，已修对齐 wc -l）→ 云端 round-2 "no major issues"。terse 铁律/闭环检查点/各族专属 dev 规则保留，记忆三入口用 FULL `cat_cafe_*` 名（f188-compat）。L0 注入链 diff 证 untouched，live invocation 终验 batch 到 C5。

### Phase E（CC 版本升级 SOP）

- [x] AC-E1: `scripts/audit-claude-code-system-prompt.mjs` 实现 ✅（`--emit`/`--diff`/`--check`；strings 提取 + anchor diff + 版本漂移）
- [x] AC-E2: 当前 baseline 归档 ✅（既有富文档 `docs/audits/cc-system-prompt-v2.1.143.md`——spec 写 v2.1.142 为 stale，实测 claude=2.1.143——保留 §1-7 富文本 + 新增 §5b 机读 anchor block 使其成合法 `--diff` 源；脚本 `--emit` 自动化补充）
- [x] AC-E3: `cat-cafe-skills/refs/cc-system-prompt-audit-sop.md` SOP 写完 ✅
- [x] AC-E4: cron 注册 ✅（项目 scheduler `dyn-1778925760476-s1gprm`，weekly Mon 10:00；CI runner 无二进制故非 GitHub Action）
- [x] AC-E5: 同款 SOP 对 Codex CLI 适用 ✅（`--cli codex` 参数化——`which codex`=node launcher，复刻 launcher 解析 native 二进制——首份归档 `docs/audits/codex-system-prompt-v0.130.0.md`；2026-05-26 Codex 0.133 drift follow-up 归档 `docs/audits/codex-system-prompt-v0.133.0.md`，并补 resolver 适配 0.133 `vendor/<triple>/bin/codex` native layout）

### Phase F（系统提示词可见化）

- [x] AC-F1: Design Gate ✅ — read-only（defer AC-F5）+ template/compiled+per-cat UX 走同 RulesPromptsContent Section/Card/Modal pattern（铲屎官"和其他那样"）
- [x] AC-F2: 「规则与 SOP」配置栏加 L0 查看区 ✅ — `RulesPromptsContent` 加第 3 个 `<Section>`，对接 `assets/system-prompts/system-prompt-l0.md` template
- [x] AC-F3: per-cat compiled L0 渲染查看 ✅ — `loadAvailableCatsForL0()`（no-arg loader，template+catalog merge）+ `compileL0ViaSubprocess` Promise.all（13 cats，实测 ~243-438ms 端到端）
- [x] AC-F4: 修改路径明示 ✅ — `l0Prompts.customization` API 字段（templatePath + compileScript + verifyCommand `pnpm gate + restart`）+ 前端 info row 渲染
- [⊘] AC-F5（可选）：可编辑（dirty/save/reload + 影响范围警告 + 写回）—— **Design Gate 决定 DEFER（不做）**：铲屎官诉求是可见性非编辑器，web-editable 治理 prompt = P0 风险面，KD-5 file+git+gate+restart 已是回滚通道。additive，日后需要可低成本重启

### Phase G（Governance L0 单源编译 + 消费链）

- [x] AC-G1: `shared-rules.md` 编译生成 governance L0 ✅（`governance-l0.ts` deterministic compiler；缺 anchor fail-closed；测试覆盖 Rule 0 / P1-P5 / W1-W8 / Magic Words / A2A / family overlays）
- [x] AC-G2: native L0 与 fallback 共用同一编译产物 ✅（`system-prompt-l0.md` §3 `{{GOVERNANCE_L0}}` + `SystemPromptBuilder` 同读 `loadCompiledGovernanceL0*`）
- [x] AC-G3: `.local.md` / `.local-override.md` 挂到编译层 ✅（native + fallback 同时生效；override replace 语义保留）
- [x] AC-G4: Rules & SOP 面板展示消费链 ✅（`/api/rules` 增 `consumption`；前端 legend + card badge 显示“实际进 prompt / harness 注入 / 只是参考 / skill 按需加载”）
- [x] AC-G5: #748 SOP vocabulary / `sop_navigation` 收敛 ✅（Phase G 后续独立 work item；PR #1868 / squash `3d5c76772`：`SopDefinition` 单源 + generated runtime catalog + API/UI consumer chain）

### Phase H（Google / Antigravity carrier native L0 follow-up）

- [x] AC-H0: Gemini home-file + repo-root `GEMINI.md` 身份污染收口（native L0 spike 前置卫生）✅ 2026-06-01 — `renderForGemini` 退役为空（照 KD-14 `renderForCodex`：`~/.gemini/GEMINI.md` 由 `--apply` 清空 + `checkDrift` 守护），删随之 dead 的 renderer helper 链（interfaces / dynamic-roster / collab-rules 渲染）；repo-root `GEMINI.md` 化石身份（2026-02-28 烁烁 / 4 猫 / stale model 标注 `gpt-5.3-codex`·`gpt-5.2`）改为 provider-neutral 指针并纳入 `root-md-slim.test.js` ≤65 行 + 无化石身份守护。**根因**：home `~/.gemini/GEMINI.md` 被 Antigravity IDE Global Rules + AGY CLI global context + Gemini carrier 读，repo-root `GEMINI.md` 被 Gemini CLI + AGY CLI workspace context 读（**非** IDE Global Rules——官方 IDE 只有 Workspace Rules 读 `.agents/rules`）；两处旧内容都把任意模型（含 opus）灌成"烁烁"。暹罗猫身份本由 runtime prompt-prepend 提供（`GeminiAgentService` 416/697），home-file 是冗余双注入（同 Codex KD-14）。**边界**：repo-root `AGENTS.md`（Codex harness 入口）对 AGY 也是 workspace 污染，但有 harness 依赖，AGY-safe 拆分留 AC-H1/H2 spike 设计，本轮不动。
- [x] AC-H1: AGY CLI native-L0 feasibility spike ✅ 2026-06-01 — 结论 **not reachable via public interface**（详见 Spike Log S6 + KD-22）：agy 1.0.4 公开面无 default/root agent override（CLI 无 `--agent`/`--system`、`settings.json` 无 agent field、Plugins/Hooks 只暴露 subagent 层 `define_subagent` + `agents/`）；binary 有 `agent_script`/`GetMainAgent`/`CustomAgentSpec` proto 但无公开提供入口。subagent `system_prompt` 是 reachable candidate 但**非 main-cat L0 carrier**（主 agent 仍裸 + 路由靠自觉 invoke）。**AGY 转 prompt-level fallback 做扎实**（profile 隔离 + context 污染收口 AC-H0 + 每轮 prepend + drift/版本守护）。POC 不做（边际价值 < 成本）。retraction：官方未来出 custom root agent / default-agent override / `--agent` flag 才重开。
- [x] AC-H2: Antigravity Desktop/IDE native-L0 feasibility spike ✅ 2026-06-01 — 结论 **not reachable via bridge**（重核当前 AntigravityBridge 代码，非沿用 F211 旧结论）：bridge 无 system/preamble channel——所有具名 `rpcSafe` 调用（`StartCascade` 只 `source`、`SendUserCascadeMessage` 只 `items.text`/`media`/`cascadeConfig`(planner+model)、`GetCascade*` 查询 + `Resolve`/`Acknowledge`/`Handle`/`Cancel` 控制）均无 system 字段；`callRpc` 公开泛型入口仅被 `RunCommandExecutor` 用于 shell pre-exec（非 prompt/config 注入，砚砚复核漏网点）；全文 grep `systemPrompt`/`preamble` 零匹配。身份注入路径 = `AntigravityAgentService` 把 `options.systemPrompt` prepend 进 `effectivePrompt`（first-prompt prepend）= prompt-level；IDE Global Rules(home `~/.gemini/GEMINI.md`)/Workspace Rules(`.agents/`) 也是 prompt-level（S6 砚砚确认非 native system role）。**Antigravity Desktop 转 prompt-level fallback**（同 AGY）。retraction：Antigravity bridge 协议未来新增 system/preamble cascade config 才重开。
- [ ] AC-H3: Gemini CLI/ACP fallback policy — `gemini-cli` / `gemini --acp` 仅为 enterprise / Google Cloud / paid API-key 用户保留；consumer/free/Pro/Ultra/Code Assist individuals 不再作为 F203 投入主线。

## Dependencies

- **Evolved from**: ADR-030（注入链地图 + 14 项 L0 清单 + spike-first 迁移路径）
- **Related**: F086（governance L0 digest 起源，本 feat 把 digest 通道从 user message 切到 system role）
- **Related**: F167（identity / A2A / 球权机制——L0 必须含传球三选一 + 球权第一人称）
- **Related**: F198（Claude bg carrier——本 feat 在 bg 模式下加 `--system-prompt`，已 spike S0 兼容）

## Risk

| 风险 | 缓解 |
|------|------|
| 替换式删了默认 system prompt 后某项**客观性**工具能力退化（如并行调用 / Skill 发现 / Schedule / safety reflex） | Phase A S2 扩展 spike 6 项功能性测试 + Phase B 客观性 carry-over 段（重写到我们 L0）双重保障；出问题 `git revert` 3 分钟回滚 |
| F-BLOAT 类 bug 重现（spawn argv 累积 / resume 重发） | Phase A S3 复现 + Phase C AC-C4 防御测试 |
| Anthropic prompt cache 失效（L0 内容变化导致 cache miss） | per-breed L0 稳定（AC-B4），变化因子只有 catId + packBlocks |
| Codex CLI argv override 在某些 model（如 spark）下不生效 | S4 已验证主线 codex，spark/gpt52 在 Phase C runtime 重启时同步验（AC-C5 三猫 invocation 覆盖） |
| CC 大版本升级带来新功能性指令，我们 L0 没补上导致功能退化 | Phase E SOP + cron 自动化触发 audit |
| 直接切（不灰度）导致全猫一起故障 | `git revert` + runtime 重启 3 分钟回滚；spike S0-S4 已验证替换式 basic feasibility |
| 把 Gemini consumer 6/18 deadline 误读为“Gemini CLI 对所有人死亡” | KD-20：consumer path 不再主线，但 enterprise / Google Cloud / paid API-key fallback 保留；不删除可用企业通道 |
| 把 AGY CLI 当成 Gemini ACP drop-in replacement | F210 Phase G 已证 `agy 1.0.1` 无 supported ACP；本机 `agy 1.0.3` help 仍无 `--acp` / `--model` / `--system`。必须 spike 后再接，不允许替换 `GeminiAcpAdapter` command |
| 把 Antigravity Rules / first-prompt prepend 当作 native L0 | AC-H2 要求区分 prompt-level fallback vs privileged system/preamble channel；只有后者才能标记 F203 native |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | L0 token 目标值——baseline 量测后 finalize（含客观性段当前估算 3,500-4,500） | ⬜ 待 S1 |
| OQ-2 | Gemini 怎么办——`GEMINI_SYSTEM_MD` 替换式会丢 CLI 自身指令，是否值得做 | ✅ 2026-05-31：不做 F203 主线；consumer Gemini CLI/ACP 受 2026-06-18 deadline 影响，enterprise/API-key fallback 保留 |
| OQ-3 | CC 版本 audit 频率——每个 minor 还是 major（v2.1.x → v2.2.0 vs v2.1.142 → v2.1.143） | ⬜ 待 Phase E 时定 |
| OQ-4 | Root md 完整瘦身策略——L0 移走后 SOP 表/记忆系统是否保留为 fallback | ⬜ 待 Phase C 实施后跑 invocation 验证 |
| OQ-5 | AGY CLI 能否提供 F203 native L0 通道，而不是 prompt prepend / Rules fallback | ⬜ AC-H1 spike |
| OQ-6 | Antigravity Desktop/IDE bridge 能否提供 privileged system/preamble config | ⬜ AC-H2 spike |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | Claude 走 `--system-prompt` 替换式而非 `--append-system-prompt` | spike S0 + ADR-030 §9.4 实测——替换式清除默认糊弄哲学，append 会和默认共存 | 2026-05-15 |
| KD-2 | Codex 走 argv `-c developer_instructions=...` 而非 `~/.codex/config.toml` 写入 | S4 验证（砚砚 `62b9255e2`）——argv per-call 注入，多猫并发安全 | 2026-05-15 |
| KD-3 | Gemini 推迟到 Codex + Claude 跑通后 | 铲屎官 directive 2026-05-15——Gemini 用量低，优先级 P2 | 2026-05-15 |
| KD-4 | Spike-first 路径：S0-S5 全部完成再进 Phase B | 47/砚砚 ADR review 共识——避免 Phase 2 严重低估 | 2026-05-15 |
| KD-5 | 直接切替换式，不灰度不留 feature flag | 铲屎官 directive 2026-05-15：「git log 能恢复就别搞灰度，那些太麻烦了我们也不现实」——`git revert` + runtime 重启 3 分钟回滚足够 | 2026-05-15 |
| KD-6 | Phase E 写 CC 版本升级 SOP | 铲屎官 2026-05-15 远见——每次 CC 大版本可能新增功能性指令我们要补 | 2026-05-15 |
| KD-7 | L0 必须含**客观性 carry-over 段**：工具能力 / 并行调用 / safety 反射 / 压缩感知 / Skill+TaskCreate+Schedule / Git 模板 | 铲屎官 directive 2026-05-15：「Claude Code 也好 Codex 也好那些客观性的系统提示词不能丢」——替换式会丢 Anthropic 训练对齐的功能性指令，必须在我们 L0 重写 | 2026-05-15 |
| KD-7b | 客观性 carry-over 段降级为 ≤100t placeholder | S2 实测 partial L0 下 0 项功能性能力退化（safety/并行/工具发现/schema/Skill/Schedule/压缩感知）——模型内置 + 工具 description + 家规已覆盖。强制重写功能性指令是过度工程；未来 CC 升级 audit 出新指令再按需补 | 2026-05-15 |
| KD-8 | compile 脚本加 displayName→breed fallback 修 opus-47 无 workflow gap | opus-47 breedId='opus-47' 不在 {ragdoll,maine-coon,siamese}，现有 SystemPromptBuilder.ts:554 对其无 workflow（S1 实测 opus-47 workflow=0t）。F203 愿景"把该进的进去"——布偶猫家族共享 ragdoll workflow。**行为变更**，Phase B review 需 reviewer 知悉 | 2026-05-15 |
| KD-9 | AC-B3 token 上限 4,500→5,000 | S1 baseline 实测 static 2,684-3,060t（高于立项前估算），14 项完整 L0 + 47 review 补 6 项物理下限 ~4,600t；per-family 治理已下沉 overlay 去重；5,000 仍在 prompt cache 单 breakpoint 内 | 2026-05-15 |
| KD-10 | L0 完全替换走 `--system-prompt-file` 从文件读，不硬编码 ts/js | 铲屎官 directive 2026-05-15：「不能在 ts/js 里硬编码替换后的是什么，应该 --system-prompt-file 从文件读，单独 md 方便维护」。compile 渲染 per-cat L0 → 写文件 → Phase C spawn 引用文件路径；内容真相源始终是 `system-prompt-l0.md`。compile 脚本加 `writeL0File()` + CLI `--out` | 2026-05-15 |
| KD-11 | 仓库门禁必须 `pnpm biome` / `pnpm check`，禁止 `npx biome` | 砚砚 Phase B review P1 教训：`npx biome` 解析到 0.3.3，项目实际 `pnpm biome` 2.4.1，`npx` 证据绕过项目门禁=假绿。沉淀到 [[feedback_verify_with_repo_toolchain]] | 2026-05-15 |
| KD-12 | compile 脚本可测性重构：CLI 入口 + roster 过滤抽纯函数 | 云端 review P1（CLI entrypoint `file://${argv1}` POSIX-only，Windows broken）→ 抽 `isCliEntrypoint(metaUrl,argv1)` 用 fileURLToPath+resolve 跨平台；P2（roster 未过滤 available，disabled 猫进 L0 = dead-end @ 路由）→ 抽 `filterAvailableTeammates` + `isCatAvailable(id,config)` 过滤，对齐 SystemPromptBuilder:417。纯函数化使两者可单测（Red→Green，44 tests） | 2026-05-15 |
| KD-13 | compile bootstrap 必须 no-arg `loadCatConfig()` + roster model 用 `getCatModel` | 云端 round-2 抓到 KD-12 P2 连环 bug：`loadCatConfig(PATH)` 显式 path 跳过 `.cat-cafe/cat-catalog.json` overlay（cat-config-loader.ts:307-327）→ isCatAvailable 基于 stale template → P2 dead-end 防护失效。根治：no-arg `loadCatConfig()`（catalog overlay = runtime 真相）+ `resolveModel`→`getCatModel`（env override > registry）。**根治原则：compile 编译器必须复用 SystemPromptBuilder 既定 runtime 入口（catalog-aware loadCatConfig + getCatModel），不自造静态读取路径** | 2026-05-15 |
| KD-14 | codex user-layer strip：`~/.codex/AGENTS.md` 退役 + 「长任务纪律」迁入 native overlay + AC-B3 上限 5,000→5,500 | 砚砚 production 观察（cross-thread）：Codex invocation 的 developer 层已有 native L0，但 user 层仍被 Codex CLI 默认 prepend `~/.codex/AGENTS.md`（F050 sync-system-prompts.ts 渲染的 179 行静态身份/家规/队友/Magic Words）= 双重注入。根因：Phase C「精确剥离重复」只 strip 了 wrapper 的 user-message inline prepend，没收口 F050 home-file 路径。修复：`renderForCodex` 退役为空（`--apply` 清空文件，drift 守护）；Codex CLI 专属「长任务纪律」（exec_command session_id / 伪后台陷阱 / detached spawn 探针，L0 §6 maine-coon overlay 原本没有）迁入 native overlay。maine-coon 实测升至 5,154-5,155t，KD-9 的 5,000 buffer 耗尽 → AC-B3 上移到 5,500（物理下限随必要内容上移=真实测量，同 KD-9 逻辑，非脚手架；5,500 仍在 prompt cache 单 breakpoint 内 + 占 context 2.75%）。Gemini 路径（`renderForGemini`）暂留——暹罗猫未切 native L0 | 2026-05-20 |
| KD-15 | `shared-rules.md` 是 governance L0 唯一真相源；native + fallback 必须共用编译产物 | #747：手写 `system-prompt-l0.md` §3 + `SystemPromptBuilder` fallback digest + `shared-rules.md` 三份物理表示会漂移，且 `.local-override` 只影响 fallback。修复：`governance-l0.ts` deterministic compiler 读取 `shared-rules.md`，native L0 通过 `{{GOVERNANCE_L0}}` 注入，fallback 同读 `loadCompiledGovernanceL0*`；`.local.md` append / `.local-override.md` replace 在编译层统一处理。 | 2026-05-21 |
| KD-16 | Rules & SOP 面板必须展示 prompt 消费链，而不只是文件列表 | #749：铲屎官需要知道“实际进 prompt / 只是参考 / skill 按需加载”。`/api/rules` 增 `consumption` 元数据，前端用四类标签显式展示 shared-rules→governance L0→native/fallback、root provider project-doc 的 harness 注入、SOP 参考文档、SKILL.md 按需加载。#748 词汇收敛 deferred，不抢跑。 | 2026-05-21 |
| KD-17 | Governance L0 compiler anchors must be sanitizer-invariant | Outbound sync public gate exposed a cross-repo drift: `_sanitize-rules.pl` rewrites family names in `cat-cafe-skills/refs/shared-rules.md`（`缅因猫`→`Maine Coon`、`暹罗猫`→`Siamese`），but `packages/api/.../governance-l0.ts` was not sanitized and asserted exact localized headings. Result: exported public API startup failed before touching clowder-ai. Fix: assert stable protocol core anchors（`fallback 层数检测协议` / `创意-实现解耦协议`）and derive output labels from the actual heading, so internal output keeps localized labels and public output follows sanitized `Maine Coon` / `Siamese`. Do not sanitize `packages/` code to avoid rewriting runtime identifiers. | 2026-05-21 |
| KD-18 | Claude carrier 选择正交于 F203 native L0 注入 | AC-C5 alpha probe 发现 runtime default 仍走 `ClaudeAgentService(-p)`，而 Phase C 只在 opt-in `ClaudeBgCarrierService(--bg)` 接了 compiled L0。正确 invariant：`-p` vs `--bg` 只决定执行/会话模式，不能决定身份/家规是否进压缩免疫层；两条 Claude carrier 都必须用 `--system-prompt-file <compiled L0>`，且用户 `cliConfigArgs` 不得覆盖该保留 flag。 | 2026-05-24 |
| KD-19 | L0 必须把"家里独有能力 trigger reflex"显式注入认知路径，软提示发现率由 eval 数据驱动 iterate | 铲屎官观察："家里做了 browser-preview / rich-messaging / propose_thread 等很多功能猫猫竟然不知道可以用"——skills 在 manifest ≠ 在认知路径。猜测式选 Tier 1 不够；需 eval 跟测掉球率数据驱动 iterate。三猫盘点（47 6 self-check + 烁烁 10 UX trigger + 砚砚 8 backend trigger，合并去重 → 13 条 Tier 1）→ L0 §8 "Cat Café 家里独有能力唤醒指南（场景→skill 触发反射）"+ `cat-cafe-skills/refs/capability-wakeup-index.md` ref doc。Path C double-track：ship v1 不阻塞 + 并行 F192 reopen Phase F `eval:capability-wakeup`（per-cat per-scenario weekly miss rate verdict）→ N 周后数据驱动 §8 v2 iterate。CVO 2026-05-27 sign-off Path C.1 + F192 reopen。 | 2026-05-27 |
| KD-20 | Gemini CLI / `gemini --acp` 不再作为 F203 native L0 主线，只保留 enterprise/API-key fallback | Google 2026-05-19 官方公告：consumer Gemini CLI / Gemini Code Assist IDE / GitHub requests for free, Google AI Pro, Ultra, and individuals stop being served on 2026-06-18；Standard/Enterprise、Google Cloud、paid Gemini / Gemini Enterprise Agent Platform API keys 继续。`gemini --acp` 是 Gemini CLI 的 ACP mode，不是独立免疫路线。家里 F210 已把非 ACP Google route 默认迁到 `GEMINI_ADAPTER=antigravity-cli`，但 catalog ACP entries 仍优先走 `gemini --acp`。因此 F203 不应继续把 S5 当主线投入。 | 2026-05-31 |
| KD-21 | Antigravity native L0 后续必须拆成两个 spike：AGY CLI 与 Antigravity Desktop/IDE | 两者不是同一个 carrier：AGY CLI 是 F210 headless Google successor，目标是替代 consumer Gemini CLI/ACP；Antigravity Desktop/IDE 是 F061/F211 Bengal bridge，目标是让孟加拉猫获得 F203 native L0。当前 `agy 1.0.3` help 无 `--acp` / `--model` / `--system`；Desktop `SendUserCascadeMessage` payload 只有 text/media/model/cascadeConfig，无 system/preamble 字段。Rules / first-prompt prepend 只能算 prompt-level fallback。 | 2026-05-31 |
| KD-22 | AGY CLI native L0 不可达 → 转 prompt-level fallback | S6 spike（47 binary 深挖 + 砚砚公开文档侦察协作）：agy 1.0.4 公开面无 default/root agent override（CLI 无 `--agent`/`--system`、`settings.json` 无 agent field、Plugins/Hooks 只暴露 subagent 层 `define_subagent` + `agents/`）；binary 有 `agent_script`/`GetMainAgent`/`CustomAgentSpec` proto 但无公开提供入口。subagent `system_prompt` 是 reachable candidate 但非 main-cat L0 carrier（主 agent 仍裸 + 路由靠自觉 invoke）。POC 边际价值 < 成本（不改"root agent 无 override"主结论）故不做。AGY 身份注入维持 prompt-level（profile 隔离 + 污染收口 AC-H0 + 每轮 prepend + drift/版本守护）。retraction：官方未来出 custom root agent / default-agent override / `--agent` flag 重开。 | 2026-06-01 |

## Spike Log

> 铲屎官 directive 2026-05-15：每次 spike 结果记录到本 feat md。

| # | Spike | Owner | 状态 | 证据 | 结论 |
|---|-------|-------|------|------|------|
| S0 | `claude --bg --system-prompt` 兼容性 | 47 | ✅ 2026-05-15 | thread `mp6b68w9w0wt1boc` job `f6474047`，暗号 `F198_BG_SYS_OK` 原样回收 | bg 模式接受 `--system-prompt` argv，替换式生效，daemon lifecycle 正常 |
| S1 | measure-system-prompt baseline | 47 | ✅ 2026-05-15 | `docs/audits/2026-05-15-system-prompt-baseline-v0.md` + 脚本 `scripts/measure-system-prompt.mjs`（feat/f203-spike-s1-baseline `046bfec17`） | 平均 3,302 tokens（18 sample，range 2,873-3,778）；GOVERNANCE_L0_DIGEST 47% 静态预算（~1,427t）；MCP_TOOLS_SECTION 467t（比 ADR 估算少 33%）；L0 ≤ 4,500 目标有 700-1,600t buffer |
| S2 | 扩展功能性 spike（砚砚 review 修正后 7 项均测） | 47 | ✅ 2026-05-15（砚砚 REQUEST_CHANGES → 修正） | `docs/audits/2026-05-15-functional-spike-s2-s3.md` (branch `4fdcfff98`) | **0 项退化**：safety/并行调用/TaskCreate/Read schema/Skill 加载/Schedule/压缩感知 全部 ✅。partial L0 已覆盖。Phase B carry-over 降级为 ≤100t placeholder |
| S3 | F-BLOAT 两失败模式复现 | 47 | 🟡 S3-a ✅ S3-b 推迟 | 同上 audit | S3-a `--append-system-prompt` bg 模式可传内容（推翻 invoke-single-cat:1086 注释）；S3-b resume 累积推迟到 Phase C 实施前跑 |
| S4 | Codex `developer_instructions` per-call | 砚砚 | ✅ 2026-05-15 | commit `62b9255e2` + ADR-030 §10.4:429-434 | `codex exec -c 'developer_instructions=...'` 高于 user prompt，不污染 config.toml |
| S5 | Gemini `GEMINI_SYSTEM_MD` 替换式 | 待定 | ⊘ 不做主线 | Google 2026-05-19 官方公告 + F210 Phase F/G + 本机 `gemini 0.42.0` help | KD-20：只保留 enterprise/API-key fallback；consumer path 不再投入 F203 native 主线 |
| S6 | AGY CLI native L0 / structured carrier feasibility | 47+砚砚 | ✅ 2026-06-01 not reachable | agy 1.0.4 binary strings（`agent_script`/`GetMainAgent`/`CustomAgentSpec`/`SubagentName` proto 均内部无公开入口）+ CLI help 无 `--agent`/`--system` + `settings.json` 无 agent field + 砚砚公开文档（Hooks `define_subagent` / Plugins `agents/` = subagent 层）三线对齐 | **AGY root native L0 = not reachable via public interface**；subagent `system_prompt` = reachable candidate 但非 main-cat L0 carrier（无 default-agent override，主 agent 裸 + 路由靠自觉）；POC 边际价值 < 成本故不做；AGY 转 prompt-level fallback（profile 隔离 + 污染收口 AC-H0 + prepend + drift 守护）|
| S7 | Antigravity Desktop/IDE native L0 feasibility | 47+砚砚(F211) | ✅ 2026-06-01 not reachable | 重核当前 AntigravityBridge：所有具名 rpcSafe 调用（StartCascade 只 source + SendUserCascadeMessage 只 items.text/media/model + GetCascade* 查询 + Resolve/Acknowledge/Handle/Cancel 控制）均无 system；callRpc 泛型入口仅 RunCommandExecutor 用于 shell pre-exec（非注入）；全文 grep systemPrompt/preamble 零匹配 | **bridge 无 native system channel** → 身份走 `AntigravityAgentService` prepend(options.systemPrompt→effectivePrompt)=prompt-level；IDE Rules 也 prompt-level；Antigravity Desktop 转 prompt-level fallback（同 AGY）|

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-15 | 立项（ADR-030 §9-§10 三猫 review 收敛后，铲屎官 directive）|
| 2026-05-15 | S0 ✅ — bg + system-prompt 兼容性 spike pass |
| 2026-05-15 | S4 ✅ — Codex per-call developer_instructions（砚砚） |
| 2026-05-15 | spec 修订：人话版愿景 + 客观性 carry-over 必须保留 + 砍灰度（KD-5/KD-7 铲屎官 directive）|
| 2026-05-15 | S1 ✅ — baseline 量测脚本 + audit 归档（46% governance + 33% MCP 偏少 + 总 buffer 700-1,600t）|
| 2026-05-15 | S2 + S3-a 部分完成——并行调用退化（必补 carry-over）；safety/TaskCreate/Read schema 不退化；`--append-system-prompt` bg 实测能传内容（推翻历史注释） |
| 2026-05-15 | 砚砚 REQUEST_CHANGES → 47 修正：S2-2 误判撤回（按 message.id 聚合 = 真并行）+ S2-5 拆 3 独立 spike 全部不退化 + ADR-030 supersede 注释 + S1 脚本合 main |
| 2026-05-15 | Phase A 双签关闭（砚砚 + 铲屎官）→ Phase B 开工：L0 真相源 + compile 脚本 + 36 测试全绿（branch `9105d184f`），AC-B1-B4 ✅，待砚砚 review |
| 2026-05-15 | 砚砚 Phase B review BLOCKING（P1: `pnpm biome` 门禁失败，我误用 `npx biome` 假绿）→ 修复：biome --write 格式 + buildTeammateRoster 复杂度 17→拆 helper + writeL0File（KD-10 CVO directive）。pnpm biome exit 0 + 37 tests（branch `583394f65`），待砚砚 confirm |
| 2026-05-15 | 砚砚 confirm APPROVE（no findings）→ merge-gate：PR #1694，pnpm gate rebase 6771a3c98。worktree `NODE_ENV=production` 跳 devDeps 踩坑（沉淀 memory）。云端 review COMMENTED 2 finding：P1 CLI entrypoint Windows-broken + P2 roster 未过滤 available。Red→Green 修复（isCliEntrypoint + filterAvailableTeammates 纯函数，44 tests），branch `b01d00003`，待 gate + 云端 re-review |
| 2026-05-15 | 云端 round-2 review（287b97cdf）2 新 finding，**云端抓到 round-1 P2 连环 bug**：P1 bootstrap loadCatConfig(PATH) 跳过 catalog overlay→isCatAvailable stale→P2 fix 实际无效；P2 roster 用静态 defaultModel 忽略 env override。根治（对齐 SystemPromptBuilder 既定 runtime 模式 no-arg loadCatConfig catalog overlay + getCatModel，KD-13），45 tests pass，gate rebase `245080ed`。云端 2 轮（§16d Round 3 黄灯）→ 先 @ 砚砚本地判断根治 + Phase 边界，不并行 re-trigger 云端 |
| 2026-05-15 | 砚砚本地 APPROVE round-2 根治（确认根治成立 + Phase B 内 + 非 spiral，复跑 45/45 + override 生效）→ re-trigger 云端 round-3 → **云端 "Didn't find any major issues"（clean，根治确认非 spiral）**。**Phase B merged (PR #1694, squash `a1b114ef9`)**——本地砚砚×3轮(BLOCKING×2→APPROVE) + 云端×3轮(round-1/2 4-finding 全根治→round-3 clean)。Status spec→in-progress |
| 2026-05-16 | Phase C 实施完成（branch `feat/f203-phase-c`，待 review）：Task 0 spike 安全网（`ca3efead7`，A8 GAP 抓出）→ Task 1 A8 CVO_REF（`fd4e634ca`）→ Task 3a 共享 `l0-compiler.ts`（`24dd15541`，subprocess 决策：API dist 不能 in-process import scripts/.mjs）→ Task 3 ClaudeBgCarrier `--system-prompt-file`（`bfeaab76f`，fail-closed）→ Task 4 CodexAgent `-c developer_instructions`（`ebe904529`，S4 对齐 + emit-deferral 根因修复：invoke await L0 早于 spawnCli → 既有测试同步 emit 'exit' 抢跑 listener 丢失，纯 mock 时序假象，非 prod bug）→ Task 2 `buildStaticIdentityPackOnly` 剥离 user-message 非 pack（`5305d08c4`）。AC-C1-C4 ✅。验收：Task3+4 cluster 139/139、route/invoke 194/194、identity 292/292、system-prompt 守护 113/113 全 green。待 AC-C5（gate + 砚砚 review + merge + runtime） |
| 2026-05-16 | **Phase C merged (PR #1709, squash `d55cb688e`)**——砚砚本地×2 round（cliConfigArgs P1 + 27208798e APPROVE → 云端 round-1 2 P1 修：route 层无差别 pack-only 致非 native provider 失身份 + stripReservedSystemConfigs 漏 `-c` 短形式 → 砚砚 re-review APPROVE → 云端 round-2 又提 P1 "L0 script unresolvable 应有 fallback" → VERIFY 三道门：cloud 提的 dist-only/packaged 部署经验证无现实复现（所有 cat-cafe 部署 = repo worktree），按 merge-gate "P1/P2-无复现 → P3-comment-pass" 处置 + 留 future-proof TODO）。AC-C1-C4 ✅，AC-C5 部分 ✅（待 runtime 重启 alpha 验收）|
| 2026-05-16 | **Phase D merged (PR #1710, squash `1c92a1d2b`)**——CLAUDE.md 200→62 / AGENTS.md 219→60，删 identity 详述/队友静态表/SOP 表/记忆详述/Knowledge Feed/代码规范/文档表（L0 §1-8 覆盖 OR ADR-030 §10.3 可重建），留 terse 铁律/闭环检查点/各族专属 dev 规则 + 指针 1 行化。砚砚本地 APPROVE（47 盲审）+ 延续 ×2 → 云端 P2（lineCount trailing-newline off-by-one，已修对齐 wc -l）→ 云端 round-2 clean。过程修复**预先就红的共享 main blocker**（check-feature-truth：index.json stale + F190 缺 BACKLOG，`d5c019303` 解全队 merge-gate 阻塞）+ f188-harness-consistency（记忆指针改 FULL `cat_cafe_*` 名）。AC-D1-D4 ✅。下一：Phase E（CC 版本升级拆 SOP）→ Phase F（配置栏可见化）→ C5 runtime 重启验收（CVO directive batch）|
| 2026-05-16 | **Phase E merged (PR #1715, squash `7a340d28c`)**——audit 工具（`--emit`/`--diff`/`--check`）+ SOP（`cc-system-prompt-audit-sop.md`）+ cron `dyn-1778925760476-s1gprm` + codex 参数化首份归档。砚砚本地 BLOCKING P1（diffSections 只解析 bare `- id`，formatMarkdown 生成 `- id — label`，真实 `--diff` 稳定误报全 anchor）→ 修：regex `(?=\s+—\|\s*$)` em-dash 判别符 + cc-v2.1.143 §5b 机读块（唯一现存 claude 归档成合法 `--diff` 源）+ 3 round-trip/回归测试 → 砚砚 APPROVE（47 盲审 quality-gate 通过）。云端 round-1 2 finding：P1 codex 平台包应用 Node resolution（hoisted 布局）+ P2 `readlink -f` GNU-only → 修：createRequire 锚定 launcher 的 Node-resolved 候选为首选 + 硬编码 fallback 保留、`realpathSync` 替 `readlink -f`（additive，真二进制 Feature Gate 验证未破坏可跑路径）→ 云端 round-2 "Didn't find any major issues"。AC-E1-E5 ✅。下一：Phase F（配置栏「规则与SOP」系统提示词可见化，需 Design Gate）→ C5 runtime 重启验收（CVO batch）|
| 2026-05-17 | **Phase F merged (PR #1717, squash `bf269f338`)**——Console「规则与 SOP」加 L0 read-only viewer：`/api/rules` 扩 `l0Prompts`（template + per-cat compiled via `compileL0ViaSubprocess` + customization paths）+ `RulesPromptsContent.tsx` 加第 3 个 Section（复用 Card/Modal pattern）+ `RuleFileCard.errorMessage` 区分"编译失败"。Design Gate autonomous = read-only（铲屎官"先做可见"confirm；AC-F5 编辑器 DEFER）。砚砚 plan-review APPROVE + 2 advisory absorbed（roster=11→12 timing rule + errorMessage UX prop）→ 砚砚 impl-review APPROVE（no P1/P2，266ms / 12/12 sanity）。云端 R1 P1 catalog 硬编码跳 template merge（修：no-arg loadCatConfig KD-13）→ R2 P2 try/catch 吞 config 错（修：移 catch + 注入 loaderFn）→ R3 P2 truthy check 漏空字符串（修：!== undefined + fallback）→ R4 "Didn't find any major issues" 🚀。所有 4 cloud findings 独立真 bug 非 spiral。AC-F1-F4 ✅，AC-F5 ⊘ DEFER（铲屎官未来要再开 sub-phase 即可）。**F203 所有 code Phase done（B/C/D/E/F all merged）**。剩 AC-C5 runtime 重启 alpha 验收（按 CVO directive，post-merge alpha @sonnet + 铲屎官 10 轮压缩客观性验收，[[feedback_alpha_test_use_sonnet]]）|
| 2026-05-20 | **Codex user-layer strip merged (PR #1787, squash `14ae04be`)**——砚砚 cross-thread production 观察：Codex invocation developer 层已有 native L0，但 user 层仍被 Codex CLI 默认 prepend `~/.codex/AGENTS.md`（F050 `sync-system-prompts.ts` 渲染的 179 行静态身份/家规/队友/Magic Words）= 双重注入。根因：Phase C「精确剥离重复」只 strip 了 wrapper 的 user-message inline prepend，没收口 F050 home-file 注入路径。修复：`renderForCodex` 退役为空（`--apply` 清空 `~/.codex/AGENTS.md` + `checkDrift` 守护）+ Codex CLI 专属「长任务纪律」（exec_command session_id / 伪后台陷阱 / detached spawn 探针）迁入 maine-coon native overlay + 删孤儿 `cats/codex.md` + AC-B3 token 上限 5,000→5,500（KD-14，maine-coon 实测 5,154-5,155t）。砚砚 plan-review（MOVE not COPY 坐标修正）→ PR review 2×P2（ADR-030 §2/§3 live 速查表死链 + 测试注释 KD-10 误引应 KD-14）→ 修复 → 砚砚 APPROVE → 云端 review "Didn't find any major issues"。Gemini user-layer 暂留（暹罗猫未切 native L0）。post-merge `sync-system-prompts.ts --apply` 清空 home file |
| 2026-05-21 | **Governance L0 single-source + consumption chain (#747/#749) merged**（PR #1830, squash `06cff348`）——`shared-rules.md` deterministic compile 成 governance L0，`system-prompt-l0.md` §3 改 `{{GOVERNANCE_L0}}`，`SystemPromptBuilder` fallback 同读编译产物，`.local/.local-override` 上移到编译层；`/api/rules` + Rules & SOP 面板展示“实际进 prompt / harness 注入 / 只是参考 / skill 按需加载”消费链。Opus 本地 review P2（硬编码投影 drift）→ drift-guard 修复；云端 P2/P1（duplicate heading fail-open + docs frontmatter）全修后 clean。#748 暂缓讨论。 |
| 2026-05-21 | **Governance L0 sanitizer-invariant anchors merged (PR #1831, squash `7749a189`)**——Outbound sync temp public gate fail-closed：public sanitizer rewrote `shared-rules.md` family headings (`缅因猫`/`暹罗猫` → `Maine Coon`/`Siamese`) while `governance-l0.ts` still asserted exact localized headings, causing API startup L0 compile failure before clowder-ai was touched. Fix: assert sanitizer-invariant protocol cores and extract output labels from the actual shared-rules heading（KD-17）。Opus re-review verified real sanitizer end-to-end: sanitized shared-rules compiles, output follows `Maine Coon`/`Siamese`, no localized label leak in public path. Cloud review clean. |
| 2026-05-21 | **Governance L0 public-sync test guard merged (PR #1832, squash `aaf51040`)**——Outbound sync temp public gate advanced past API startup after KD-17, then exposed the older governance L0 unit test still asserting private localized labels (`缅因猫`/`暹罗猫`) instead of sanitizer-invariant protocol cores. Fix: test asserts `fallback 层数检测` / `创意-实现解耦` so internal and public-sanitized outputs both pass; also tightened color-token audit `.test.` filtering to avoid worktree-path false negatives. Opus re-review + cloud review clean. |
| 2026-05-22 | **#748 SOP stage 定义统一——方向对齐**：社区（terrenceeLeung / 天一）在 clowder-ai#748 提交设计提案——新建 `SopDefinition`（`sop-definitions/development.yaml`）单一机器可读源、`sop_navigation` 并入它（第三选项，非「删除」或「原样接线」）。Opus 核实提案代码事实（`sop_navigation` 零消费 / `SopStage` 硬编码 union / 一行 hint）准确 → green light。**CVO 决策：#748 归 F203、不新开 F 号**——与 #747 同属「家规 / SOP 外化」线（separate change set，same feature）。实现路径同 #747：Cat Café 上游实现 + 同步，社区作 design owner + 同步 PR reviewer。kickoff 前敲定 2 点：① hard_rules/pitfalls 迁入 `SopDefinition` 后仍零消费 → 须诚实标注「parked, no consumer」② `sopDefinitionId` seam 守 YAGNI（只加字段 + 默认值，不建 resolver）。回复见 clowder-ai#748。 |
| 2026-05-23 | **#748 design pivot — hard_rules keep + domain-generic schema + F192 Phase E-sop scoped**：天一回 #748 反推「应该 drop hard_rules/pitfalls（park 是糖衣 follow-up）」+ impl 入口该是 `writing-plans` 不是 `tdd` + `writing-plans` skill 自身前后矛盾应统一为 `writing-plans → worktree → tdd`。CVO 反推关键反思 "skill = 软约束需硬约束兜底" + 多 domain SOP 问题（video / tech-article / family-office）——**否决 drop**，定调三点 pivot：① **hard_rules / pitfalls keep**（不 drop 不 park）+ 加 machine-checkable predicate 字段，feeds F192 新 `eval:sop` domain；② schema **domain-generic from day 1**（development 只是第一个 domain，video-cocreation / tech-article / family-office 同 schema），消除多阶段 skill = SOP 错位的归位错；③ `sopDefinitionId` seam 定位重新校准为多 domain 装载入口（非 YAGNI future-proofing）。同步 F192 加 Phase E-sop (AC-E16-E24) + cross-domain schema 校验作 AC-E23 硬验证。天一 impl 入口 + writing-plans skill 统一两点 accepted。下一步：回 clowder-ai#748 通报三点 pivot + 等天一更新 schema 草案（加 predicate 字段）。|
| 2026-05-23 | **#748 SOP stage externalization merged (PR #1868, squash `3d5c76772`)**——`sop-definitions/development.yaml` 接管 development SOP stage 真相源，18 条 `sop_navigation` hard rules / pitfalls 迁入 predicate-backed schema，runtime generated catalog 驱动 `SopStage` / `WorkflowSop` / thread-context / Mission Control 面板；`nextSkill` 作为 explicit override 保留，bad/stale SOP stage 在 API 和 UI 双侧 fail-soft。cross-domain stubs 证明 schema 泛化但不进入 runtime union；`writing-plans` 顺序统一为 `writing-plans → worktree → tdd`；F192 `eval:sop` runtime evaluator 保持 out of scope。`pnpm gate` passed on PR HEAD `db118eca7`，cloud review clean。 |
| 2026-05-24 | **AC-C5 alpha probe reopened Claude carrier parity gap**——铲屎官 runtime pull + restart 后，test thread 证实 production default 仍走 `ClaudeAgentService(-p)`；F203 native L0 只在 `ClaudeBgCarrierService(--bg)` 生效。修复方向改为 carrier 正交：不翻 `CAT_CAFE_CLAUDE_CARRIER` default，不提前 F198 migration，只让 `ClaudeAgentService(-p)` 同样 compile L0 到 `--system-prompt-file`，并阻止用户 `cliConfigArgs` 覆盖保留 system prompt flags。合入后 AC-C5 需重新 runtime pull/restart + behavioral probe。 |
| 2026-05-24 | **Claude carrier L0 parity fix merged (PR #1875, squash `9bdbc7f9`)**——`ClaudeAgentService(-p)` 与 `ClaudeBgCarrierService(--bg)` 统一使用 compiled L0 `--system-prompt-file`，pack-only `systemPrompt` 双 carrier 都走 `--append-system-prompt`，并阻止 `cliConfigArgs` 覆盖 `--system-prompt*` / `--append-system-prompt*` 保留 flags；`-p` carrier 每次 invocation 清理 L0 temp dir，避免 `/tmp/cat-cafe-l0-*` 积累。`pnpm gate` passed on PR HEAD `90a92dc9`，cloud review clean。下一步：runtime pull + restart 后重跑 AC-C5 behavioral probe（default `-p` + `bg_daemon`）。 |
| 2026-05-26 | **Codex 0.133 audit drift follow-up merged (PR #1892, squash `c6c0bf9c`)**——weekly Phase E 巡检检测到 Codex `0.130.0 → 0.133.0` drift；`--diff` 初始失败根因不是平台包缺失，而是 0.133 launcher native binary layout 从 legacy `vendor/<triple>/codex/codex` 改到 `vendor/<triple>/bin/codex`。修复 audit resolver 候选顺序（new layout first + legacy fallback），新增 0.133 layout 回归测试，`--diff docs/audits/codex-system-prompt-v0.130.0.md` 结果 `added=[] removed=[] changed=[]`，归档 `docs/audits/codex-system-prompt-v0.133.0.md`；`pnpm gate` passed on `fc5d07d0`，Opus-47 continuity approve + cloud review clean。 |
| 2026-05-27 | **L0 §8 Cat Café 家里独有能力唤醒指南 scoped (KD-19, Path C.1)**——铲屎官观察 "做了 browser-preview / rich-messaging / propose_thread 等很多功能猫猫竟然不知道可以用"，skills 在 manifest ≠ 在认知路径。三猫盘点（47 自检 6 + 烁烁/Gemini 2.5 UX trigger 10 + 砚砚 backend trigger 8）合并去重 → 13 条 Tier 1 trigger reflex 进 L0 §8；配套新 ref doc `cat-cafe-skills/refs/capability-wakeup-index.md` 含 13 条 Tier 1 详细 fallback + 8 条 Tier 2 场景专项。原 §8 协作哲学 renumber → §9。Path C double-track：L0 §8 v1 ship 不阻塞猫马上能受益 + 并行 F192 reopen Phase F `eval:capability-wakeup`（CVO sign-off 2026-05-27）—— per-cat per-scenario weekly miss rate verdict → N 周后数据驱动 §8 v2 iterate（demote 低 miss-rate / promote 高 miss-rate / 加新发现场景）。CVO 直接拍板 "Path C.1：F192 reopen Phase F eval:capability-wakeup 可以 我同意～" + F128 加 Tier 1 OK。 |
| 2026-05-27 | **L0 §8 v1.1 — MCP capability 补盘（铲屎官 flag start_vote 漏）**：铲屎官提醒 "盘了 skills + features 还漏了 MCP（如 `cat_cafe_start_vote` 投票）"。系统盘 ~75 个 `cat_cafe_*`（大多 plumbing），补 4 个"做了但猫忘了用"的能力类：`start_vote`（多猫表决，进 L0 §8 多视角 line）/ `multi_mention` / `generate_document` / `run_perspective`（后 3 进 ref doc 新增「MCP capability 快扫」section）。token budget 复验 6 cats 全 ≤ 5500。教训：capability 盘点须三层全覆盖（skills + features + MCP），不能漏 MCP 层。 |
| 2026-05-27 | **capability-wakeup-index 加 reachability gate（opus-48 纠正 opus-47 误判）**：铲屎官观察"§8 写了 workspace-navigator trigger 但没猫开过 workspace"；opus-47 误诊为"Tier B 零摩擦偷懒"+ 断言"terminal 调不了"（纯脑补没 verify，「我能猜出来」病）。opus-48 verify：SKILL.md Step 3 = `curl localhost:${API_SERVER_PORT}/api/workspace/navigate`，Bash 直调不走 MCP，实测 `{"ok":true}`。**真根因是 reachability 误判**（以为够不着→从没进考虑→100% miss），独立于"偷懒"失败域，药方相反（补可达性认知 ≠ 上 hook）。修：capability-wakeup-index 加「分类轴：先过 reachability gate（筛子 0）再分 enforcement tier A/B」+ **系统过筛** workspace-navigator / rich-messaging / browser-preview 三个"看着该 Tier B"的——全是可达真 Tier B，各带实测调用路径（`/api/workspace/navigate` / `cat_cafe_create_rich_block` / `/api/preview/auto-open`）。**本表自身 meta 事故（opus-48 连环 catch，第三+四层）**：第三层——browser-preview 初稿被 opus-47 凭 grep `app.post('/api/preview` 写成"无 push API"，但根因不是"多行"而是 6 个 POST 全用泛型签名 `app.post<{...}>(` 把 `app.post` 和 `(` 隔开（grep 全零命中，auto-open 恰好也多行属次要）；第四层——这条复盘 note 自己把 POST 数成"4 个"、根因写"多行"，连"我没 verify"的复盘都没 verify，opus-48 亲读 `preview.ts` 数出 6 个 POST + 泛型才拦下。教训终态：**否定/数字结论（含复盘叙述里的数字、根因）必须读源文件，grep 命中空 ≠ 不存在**（漏泛型 `<{...}>`/多行/别名）；verify 是每个事实声明都要过的尺，不是一次性动作。reachability/脑补病靠写 doc 治不好（doc 自己中招 4 层），只有 reviewer 亲验否定+数字结论的纪律能拦（实锤 F192 hook：reviewer 层 forcing function > prompt/doc 注入）。opus-47 + opus-48 各实测 navigate 给铲屎官开文件（两布偶猫均先 verify 才做）。F192 Phase F eval 只测过筛子 0 的真 Tier B；hook scope 待 CVO 对齐。**Merged PR #1936（squash `8b83e849e`）2026-05-28——docs-only 云端豁免 + opus-4.8 跨个体 review APPROVE（连环拦下 4 层脑补）。** |
| 2026-05-31 | **Google / Antigravity carrier feasibility re-triage**：铲屎官追问 “现在不用 gemini cli，gemini acp 和 cli 是不是 6/18 sunset，所以得 spike 两个 antigravity？” 砚砚核对官方公告 + F210/F211 + 本机 binaries 后收敛：`gemini --acp` 继承 Gemini CLI consumer deadline，不是独立出路；enterprise/API-key fallback 保留但不做 F203 主线。F203 follow-up 改为两个 Antigravity spike：S6 AGY CLI（headless successor，替代 consumer Gemini CLI/ACP）与 S7 Antigravity Desktop/IDE（Bengal native L0）。当前 `agy 1.0.3` 无 `--acp` / `--model` / `--system`，Desktop bridge payload 无 system/preamble 字段；Rules / first-prompt prepend 只能算 fallback。 |
| 2026-06-01 | **GEMINI.md 身份污染收口（AC-H0）branch `feat/f203-gemini-pollution-cleanup`**——铲屎官观察 Antigravity IDE / AGY CLI 选任意模型（含 opus）被灌成"烁烁"、缺 F203 native L0。opus-48 + 砚砚协同诊断：`~/.gemini/GEMINI.md`（sync 渲染的烁烁身份 + 12 猫旧名册）+ repo-root `GEMINI.md`（2026-02-28 烁烁化石 / 4 猫 / stale model）双污染源；暹罗猫身份本由 runtime prompt-prepend 提供（`GeminiAgentService` 416/697），home-file 是冗余双注入（同 Codex KD-14）。砚砚补官方 docs 边界：IDE Global Rules=`~/.gemini/GEMINI.md`，AGY CLI 额外读 workspace `GEMINI.md` / `AGENTS.md` + global。修复：`renderForGemini` 退役为空 + 删 dead renderer helper 链 + repo-root `GEMINI.md` → provider-neutral 指针 + `root-md-slim.test.js` 纳入 GEMINI.md 守护（Phase D 漏守护 = 化石存活根因）。sync test 9/9 + root-md-slim 12/12 green。边界：repo-root `AGENTS.md` AGY-safe 拆分留 H1/H2 spike。待跨族 review。|
| 2026-06-01 | **S6 AGY CLI native L0 spike = not reachable**（47 binary 深挖 + 砚砚公开文档侦察协作，铲屎官 directive "技术细节自决"）：agy 1.0.4 公开面无 default/root agent override——CLI 无 `--agent`/`--system`、`settings.json` 无 agent field、Plugins/Hooks 只暴露 subagent 层（`define_subagent` / `agents/`）。binary 有 `agent_script`/`GetMainAgent`/`CustomAgentSpec` proto 但无公开提供入口。subagent `system_prompt` reachable 但非 main-cat L0 carrier（主 agent 裸 + 路由靠自觉）。POC 不做（边际价值 < 成本，砚砚三线对齐确认 retraction 排除）。**AGY 转 prompt-level fallback 做扎实**。retraction：官方出 root agent override / `--agent` flag 重开。下一步 S7 Antigravity IDE/Desktop spike。|
| 2026-06-01 | **S7 Antigravity Desktop/IDE native L0 = not reachable + Phase H spike 全收敛**（47 重核 AntigravityBridge + 砚砚 F211 bridge owner 上下文）：重核当前 bridge 代码（非沿用旧结论）确认所有具名 rpcSafe 调用均无 system/preamble channel（`StartCascade` 只 source / `SendUserCascadeMessage` 只 items.text+media+model / GetCascade* 查询 + Resolve/Acknowledge/Handle/Cancel 控制 / `callRpc` 泛型入口仅 `RunCommandExecutor` shell pre-exec）→ 身份走 `AntigravityAgentService` prepend = prompt-level（同 AGY）。**Phase H spike 全收敛：S5 Gemini CLI sunset + S6 AGY not reachable + S7 Antigravity Desktop not reachable = Google/Antigravity 全线无 native L0 通道，统一转 prompt-level fallback 做扎实**（profile 隔离 + 污染收口 AC-H0 + 每轮 prepend + drift/版本守护 + L0 压缩感知段兜底）。印证立项最早判断"封闭工具 prompt/rules 级是天花板"。剩余 Phase H work：AGENTS.md AGY-safe follow-up + AC-H0 merge（待 dir-size）。retraction：官方未来出 root agent override / bridge system config 重开。|

## Review Gate

- Phase A: spike 结果由本人 + 跨族猫审视（47 跑 S1-S3 → 砚砚 review，砚砚 S4 已交叉验证）
- Phase B: 跨族猫审 L0 编译脚本（架构 + 安全 + 客观性 carry-over 覆盖完整性）
- Phase C: 跨族猫审实施代码 + F-BLOAT 防御；runtime 重启后铲屎官直接体感判断（10 轮对话 + 压缩）
- Phase D: 跨族猫审 root md 瘦身 diff
- Phase E: SOP 文档 review + cron 注册 review

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **ADR** | `docs/decisions/030-system-prompt-engineering.md` | 注入链地图 + 14 项 L0 清单 + spike-first 迁移路径（决策来源） |
| **Feature** | `docs/features/F086-*.md` | governance L0 digest 起源 |
| **Feature** | `docs/features/F167-a2a-chain-quality.md` | identity / A2A / 球权机制 |
| **Feature** | `docs/features/F198-claude-code-subscription-carrier.md` | bg carrier，本 feat 在 bg 模式下加 `--system-prompt` |
| **Feature** | `docs/features/F210-antigravity-cli-migration.md` | Gemini CLI consumer deadline + AGY CLI headless carrier migration |
| **Feature** | `docs/features/F211-cross-runtime-session-transparency.md` | Antigravity Desktop bridge 非 native L0 gap + promptDelivery 记录 |
| **Feature** | `docs/features/F061-antigravity-bengal-cat.md` | Antigravity Desktop / Bengal carrier truth source |
| **External** | `https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/` | Google 2026-05-19 Gemini CLI → Antigravity CLI transition announcement |
| **External** | `https://antigravity.google/docs/cli-features` | Antigravity CLI feature surface |
| **Discussion** | thread `mp6b68w9w0wt1boc` | 三猫 ADR review + 铲屎官 directive |
| **Source** | `packages/api/src/domains/cats/services/context/governance-l0.ts` | `shared-rules.md` → compiled governance L0（native + fallback 共用） |
| **Source** | `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts` | fallback prompt + WORKFLOW_TRIGGERS 注入逻辑（governance L0 从 compiler 读取） |
| **Source** | `packages/api/src/domains/cats/services/agents/providers/ClaudeBgCarrierService.ts` | bg carrier spawn argv 待加 `--system-prompt` |
| **Source** | `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts` | `effectivePrompt` 拼装逻辑（待加 dual-path） |
| **Skill** | `cat-cafe-skills/refs/shared-rules.md` | Governance L0 真相源（经 compiler 投入 native + fallback） |

## 需求点 Checklist

- [x] 关联检测完成（BACKLOG grep + features/ 扫描，无重复）
- [x] CVO 立项 signoff（铲屎官 2026-05-15 directive "我感觉好像需要立项"）
- [x] Architecture cell 归属（harness/system-prompt-injection，map delta: update required）
- [x] Eval Contract 4 项（Primary Users + Activation: 全猫每次 invocation；Friction: token 总量 + 压缩后规则保留率 + 客观性能力覆盖；Regression Fixture: SystemPromptBuilder 80+ test + S2 6 项功能性 spike；Sunset Signal: Phase E cleanup + cron audit ≥ 3 个 CC 版本无新增遗漏）
- [x] Design Gate 元审美自检（这是坐标变换——把 L0 从可压缩通道切到压缩免疫通道是结构改变，不是多项式堆补丁）
- [x] In-context Observability 字段（primary_surface: runtime 重启后猫猫 invocation 实际行为；why_not_dashboard_only: 行为退化在猫的回答里现场可见，dashboard 只是后置 metric；deep_dive_surface: docs/audits/cc-system-prompt-vN.N.N.md；noise_dedup_policy: `git revert` + runtime 重启快速回滚）
