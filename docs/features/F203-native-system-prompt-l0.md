---
feature_ids: [F203]
related_features: [F086, F167, F198]
topics: [system-prompt, governance, prompt-engineering, compression-immunity, l0-injection]
doc_kind: spec
created: 2026-05-15
---

# F203: Native System Prompt L0 — 压缩免疫核心规则注入

> **Status**: spec | **Owner**: 布偶猫 Opus 4.7 | **Priority**: P1

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

## Acceptance Criteria

### Phase A（Baseline + 扩展 spike）

- [x] AC-A0: S0 — `claude --bg --system-prompt` 兼容性 spike（实测 job `f6474047` 暗号 `F198_BG_SYS_OK` 回收 ✅）
- [x] AC-A1: S1 — `scripts/measure-system-prompt.mjs` 量 baseline，每猫每模式（serial/parallel/independent）token 数表格 ✅ 2026-05-15 见 `docs/audits/2026-05-15-system-prompt-baseline-v0.md`
- [x] AC-A2: S2 — 扩展功能性 spike（砚砚 review 修正后定稿 2026-05-15）：safety ✅ / 并行调用 ✅（误判已撤回）/ TaskCreate ✅ / Read schema ✅ / Skill 加载 ✅ / Schedule ✅ / 压缩感知 ✅。**0 项退化**。详见 `docs/audits/2026-05-15-functional-spike-s2-s3.md`
- [x] AC-A3: S3 — F-BLOAT 复现（部分完成 2026-05-15）：S3-a `--append-system-prompt` bg 模式能传内容 ✅（推翻历史"didn't receive content"注释）；S3-b resume 累积推迟到 Phase C 实施前跑
- [x] AC-A4: S4 — Codex `developer_instructions` per-call 注入（砚砚 `62b9255e2` ✅）
- [ ] AC-A5: S5（推迟到 Phase D 之后）— Gemini `GEMINI_SYSTEM_MD` 替换式 spike

### Phase B（L0 真相源）

- [ ] AC-B1: `assets/system-prompts/system-prompt-l0.md` 包含 ADR-030 §10.2 14 项全部内容
- [ ] AC-B2: `scripts/compile-system-prompt-l0.mjs` 输出 per-cat 编译结果，单测覆盖 5 种 catId × 3 种 mode
- [ ] AC-B3: 编译 token 总量 ≤ 3,500（baseline 量测后 finalize 目标值）
- [ ] AC-B4: per-breed cache key 稳定（同猫多次 invocation 输出 byte-identical）

### Phase C（dual-path 落地）

- [ ] AC-C1: `ClaudeBgCarrierService` argv 加 `--system-prompt`，单测 + e2e（bg + system-prompt + mcp-config 三件套）
- [ ] AC-C2: `CodexAgentService` argv 加 `-c developer_instructions=...`，并发安全（@codex / @gpt52 / @spark 各自独立 argv，不污染 `~/.codex/config.toml`）
- [ ] AC-C3: `effectivePrompt` 拼装逻辑删除 `params.systemPrompt` prepend 路径（system prompt 已在 argv，user message 只剩 prompt 本身）
- [ ] AC-C4: F-BLOAT 测试：resume 时 system prompt 不重复累积
- [ ] AC-C5: runtime 重启 + 47/46/砚砚 各跑一轮 invocation + 铲屎官 10 轮压缩对话验收

### Phase D（root md 瘦身）

- [ ] AC-D1: CLAUDE.md ≤ 65 行（当前 188）
- [ ] AC-D2: AGENTS.md ≤ 65 行（当前 207）
- [ ] AC-D3: 删队友静态表（独立 PR，可在 Phase A 期间提前做）
- [ ] AC-D4: SystemPromptBuilder 守护测试全绿（80+ test）

### Phase E（CC 版本升级 SOP）

- [ ] AC-E1: `scripts/audit-claude-code-system-prompt.mjs` 实现
- [ ] AC-E2: `docs/audits/cc-system-prompt-v2.1.142.md` 归档当前 baseline
- [ ] AC-E3: `cat-cafe-skills/refs/cc-system-prompt-audit-sop.md` SOP 写完
- [ ] AC-E4: cron / GitHub Action 注册（检测 CC 版本变更触发 audit）
- [ ] AC-E5: 同款 SOP 对 Codex CLI 适用（`strings $(which codex)` audit + 归档）

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
