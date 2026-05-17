---
feature_ids: [F203]
related_features: [F086, F167, F198]
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
- **Claude 猫**：`claude --bg --system-prompt "<compiled L0>"`（S0 实测兼容 bg 模式 ✅）
- **Codex 猫**：`codex exec -c 'developer_instructions="<compiled L0>"'`（S4 实测 per-call 注入 ✅）
- **Gemini 猫**：推迟（铲屎官 directive 2026-05-15 — 用量低，先 Codex + Claude 跑通）

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

- `ClaudeBgCarrierService.spawn` argv 加 `--system-prompt <compiled L0>`（直接替换，不留 feature flag）
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

## Acceptance Criteria

### Phase A（Baseline + 扩展 spike）

- [x] AC-A0: S0 — `claude --bg --system-prompt` 兼容性 spike（实测 job `f6474047` 暗号 `F198_BG_SYS_OK` 回收 ✅）
- [x] AC-A1: S1 — `scripts/measure-system-prompt.mjs` 量 baseline，每猫每模式（serial/parallel/independent）token 数表格 ✅ 2026-05-15 见 `docs/audits/2026-05-15-system-prompt-baseline-v0.md`
- [x] AC-A2: S2 — 扩展功能性 spike（砚砚 review 修正后定稿 2026-05-15）：safety ✅ / 并行调用 ✅（误判已撤回）/ TaskCreate ✅ / Read schema ✅ / Skill 加载 ✅ / Schedule ✅ / 压缩感知 ✅。**0 项退化**。详见 `docs/audits/2026-05-15-functional-spike-s2-s3.md`
- [x] AC-A3: S3 — F-BLOAT 复现（部分完成 2026-05-15）：S3-a `--append-system-prompt` bg 模式能传内容 ✅（推翻历史"didn't receive content"注释）；S3-b resume 累积推迟到 Phase C 实施前跑
- [x] AC-A4: S4 — Codex `developer_instructions` per-call 注入（砚砚 `62b9255e2` ✅）
- [ ] AC-A5: S5（推迟到 Phase D 之后）— Gemini `GEMINI_SYSTEM_MD` 替换式 spike

### Phase B（L0 真相源）

- [x] AC-B1: `assets/system-prompts/system-prompt-l0.md` 包含 14 项全部内容 ✅（branch `9105d184f`，测试 `14 L0 governance items coverage` 全覆盖）
- [x] AC-B2: `scripts/compile-system-prompt-l0.mjs` 输出 per-cat 编译结果 ✅（6 catId 测试覆盖 + per-cat overlay 替换 + 36 测试全绿）
- [x] AC-B3: 编译 token 总量 ≤ **5,000** ✅（**上限 4,500→5,000 调整**：S1 baseline 实测 static 2,684-3,060t，14 项完整内容 + 47 review 补 6 项 + 五条铁律 + 协作哲学 + 三硬条件物理下限 ~4,600t；per-family 治理协议已下沉 WORKFLOW overlay 去重；5,000 仍在 Claude 4.x prompt cache 单 breakpoint 内 + 占 200k context 2.5%）
- [x] AC-B4: per-breed cache key 稳定 ✅（same catId byte-identical 测试通过）

### Phase C（dual-path 落地）

- [x] AC-C1: `ClaudeBgCarrierService` argv 加 `--system-prompt-file <compileL0>` ✅（Task 3，commit `bfeaab76f`；l0CompilerFn seam + fail-closed CarrierError；claude-bg-carrier-l0.test.js 2 tests + 真子进程 e2e。KD-10：走文件不硬编码）
- [x] AC-C2: `CodexAgentService` argv 加 `-c developer_instructions=<compileL0>` ✅（Task 4，commit `ebe904529`；per-call argv 不污染 `~/.codex/config.toml`，@codex/@gpt52/@spark cat-scoped；codex-agent-service-l0.test.js 3 tests，S4 砚砚 `62b9255e2` 对齐）
- [x] AC-C3: 剥离 `params.systemPrompt` 非 pack prepend ✅（Task 2，commit `5305d08c4`；新增 `buildStaticIdentityPackOnly`，route-serial:413/route-parallel:173 切 pack-only，非 pack 走 native system role；system-prompt-builder 113/113 守护零回归）
- [x] AC-C4: F-BLOAT resume 不累积 ✅（native `--system-prompt-file` replace-mode 天然免疫；pack-only 走未改的先验 new-session gate invoke-single-cat:1079-1088，invoke-single-cat-resume-health 覆盖）
- [x] AC-C5（merge-gate 部分）✅：PR #1709 squash-merged 2026-05-16T08:26Z（commit `d55cb688e`）；`pnpm gate` ✅（3070 tests），砚砚本地×2 round APPROVE（P1 cliConfigArgs + P1-cloud 修复），云端 round-1 抓 2 P1 全修，round-2 push back 1 P1（无现实复现，按 merge-gate 表降 P3-comment-pass）。**待**：runtime 重启验收（alpha pull 后 47/46/砚砚 各一轮 + 铲屎官 10 轮压缩对话客观性终验）

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
- [x] AC-E5: 同款 SOP 对 Codex CLI 适用 ✅（`--cli codex` 参数化——`which codex`=node launcher，复刻 launcher 解析 native 二进制——首份归档 `docs/audits/codex-system-prompt-v0.130.0.md`）

### Phase F（系统提示词可见化）

- [x] AC-F1: Design Gate ✅ — read-only（defer AC-F5）+ template/compiled+per-cat UX 走同 RulesPromptsContent Section/Card/Modal pattern（铲屎官"和其他那样"）
- [x] AC-F2: 「规则与 SOP」配置栏加 L0 查看区 ✅ — `RulesPromptsContent` 加第 3 个 `<Section>`，对接 `assets/system-prompts/system-prompt-l0.md` template
- [x] AC-F3: per-cat compiled L0 渲染查看 ✅ — `loadAvailableCatsForL0()`（no-arg loader，template+catalog merge）+ `compileL0ViaSubprocess` Promise.all（13 cats，实测 ~243-438ms 端到端）
- [x] AC-F4: 修改路径明示 ✅ — `l0Prompts.customization` API 字段（templatePath + compileScript + verifyCommand `pnpm gate + restart`）+ 前端 info row 渲染
- [⊘] AC-F5（可选）：可编辑（dirty/save/reload + 影响范围警告 + 写回）—— **Design Gate 决定 DEFER（不做）**：铲屎官诉求是可见性非编辑器，web-editable 治理 prompt = P0 风险面，KD-5 file+git+gate+restart 已是回滚通道。additive，日后需要可低成本重启

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

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | L0 token 目标值——baseline 量测后 finalize（含客观性段当前估算 3,500-4,500） | ⬜ 待 S1 |
| OQ-2 | Gemini 怎么办——`GEMINI_SYSTEM_MD` 替换式会丢 CLI 自身指令，是否值得做 | ⬜ 待 Phase D 之后评估 |
| OQ-3 | CC 版本 audit 频率——每个 minor 还是 major（v2.1.x → v2.2.0 vs v2.1.142 → v2.1.143） | ⬜ 待 Phase E 时定 |
| OQ-4 | Root md 完整瘦身策略——L0 移走后 SOP 表/记忆系统是否保留为 fallback | ⬜ 待 Phase C 实施后跑 invocation 验证 |

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

## Spike Log

> 铲屎官 directive 2026-05-15：每次 spike 结果记录到本 feat md。

| # | Spike | Owner | 状态 | 证据 | 结论 |
|---|-------|-------|------|------|------|
| S0 | `claude --bg --system-prompt` 兼容性 | 47 | ✅ 2026-05-15 | thread `mp6b68w9w0wt1boc` job `f6474047`，暗号 `F198_BG_SYS_OK` 原样回收 | bg 模式接受 `--system-prompt` argv，替换式生效，daemon lifecycle 正常 |
| S1 | measure-system-prompt baseline | 47 | ✅ 2026-05-15 | `docs/audits/2026-05-15-system-prompt-baseline-v0.md` + 脚本 `scripts/measure-system-prompt.mjs`（feat/f203-spike-s1-baseline `046bfec17`） | 平均 3,302 tokens（18 sample，range 2,873-3,778）；GOVERNANCE_L0_DIGEST 47% 静态预算（~1,427t）；MCP_TOOLS_SECTION 467t（比 ADR 估算少 33%）；L0 ≤ 4,500 目标有 700-1,600t buffer |
| S2 | 扩展功能性 spike（砚砚 review 修正后 7 项均测） | 47 | ✅ 2026-05-15（砚砚 REQUEST_CHANGES → 修正） | `docs/audits/2026-05-15-functional-spike-s2-s3.md` (branch `4fdcfff98`) | **0 项退化**：safety/并行调用/TaskCreate/Read schema/Skill 加载/Schedule/压缩感知 全部 ✅。partial L0 已覆盖。Phase B carry-over 降级为 ≤100t placeholder |
| S3 | F-BLOAT 两失败模式复现 | 47 | 🟡 S3-a ✅ S3-b 推迟 | 同上 audit | S3-a `--append-system-prompt` bg 模式可传内容（推翻 invoke-single-cat:1086 注释）；S3-b resume 累积推迟到 Phase C 实施前跑 |
| S4 | Codex `developer_instructions` per-call | 砚砚 | ✅ 2026-05-15 | commit `62b9255e2` + ADR-030 §10.4:429-434 | `codex exec -c 'developer_instructions=...'` 高于 user prompt，不污染 config.toml |
| S5 | Gemini `GEMINI_SYSTEM_MD` 替换式 | 待定 | ⏸ 推迟 | — | KD-3 推迟到 Codex + Claude 跑通 |

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
| **Discussion** | thread `mp6b68w9w0wt1boc` | 三猫 ADR review + 铲屎官 directive |
| **Source** | `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts` | 当前 GOVERNANCE_L0_DIGEST + WORKFLOW_TRIGGERS 注入逻辑 |
| **Source** | `packages/api/src/domains/cats/services/agents/providers/ClaudeBgCarrierService.ts` | bg carrier spawn argv 待加 `--system-prompt` |
| **Source** | `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts` | `effectivePrompt` 拼装逻辑（待加 dual-path） |
| **Skill** | `cat-cafe-skills/refs/shared-rules.md` | L0 内容真相源（14 项从这里摘抄） |

## 需求点 Checklist

- [x] 关联检测完成（BACKLOG grep + features/ 扫描，无重复）
- [x] CVO 立项 signoff（铲屎官 2026-05-15 directive "我感觉好像需要立项"）
- [x] Architecture cell 归属（harness/system-prompt-injection，map delta: update required）
- [x] Eval Contract 4 项（Primary Users + Activation: 全猫每次 invocation；Friction: token 总量 + 压缩后规则保留率 + 客观性能力覆盖；Regression Fixture: SystemPromptBuilder 80+ test + S2 6 项功能性 spike；Sunset Signal: Phase E cleanup + cron audit ≥ 3 个 CC 版本无新增遗漏）
- [x] Design Gate 元审美自检（这是坐标变换——把 L0 从可压缩通道切到压缩免疫通道是结构改变，不是多项式堆补丁）
- [x] In-context Observability 字段（primary_surface: runtime 重启后猫猫 invocation 实际行为；why_not_dashboard_only: 行为退化在猫的回答里现场可见，dashboard 只是后置 metric；deep_dive_surface: docs/audits/cc-system-prompt-vN.N.N.md；noise_dedup_policy: `git revert` + runtime 重启快速回滚）
