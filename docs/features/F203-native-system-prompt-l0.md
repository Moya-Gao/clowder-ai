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

铲屎官 2026-05-15 在 thread `mp6b68w9w0wt1boc` 实测 spike（`docs/decisions/030-system-prompt-engineering.md` §9.4）后定性了问题：

- **Claude Code 默认 system prompt 含"糊弄哲学"**（"don't add features beyond task" / "no comments" / "minimal fix" / "three similar lines is better than abstraction"），这些指令在 API `system` role，**不被上下文压缩**
- **我们家规（伙伴猫、TDD、质量门禁、F167 球权三选一、Magic Words）通过 user message prepend 注入**，每次压缩会丢失需要重教
- 现象：**10 轮对话教 10 次传球**——压缩后默认糊弄哲学还在，我们的伙伴哲学不在 → 糊弄赢

**Architecture cell**: harness/system-prompt-injection（ownership/README.md 待确认）
**Map delta**: update required（注入链从 user-message-prepend 改为 native-system-role；ADR-030 §3 已记新流程）
**Why（一句话）**：把 L0 规则从可压缩通道切到压缩免疫通道，让伙伴哲学优先级高于默认糊弄哲学。

铲屎官原话（2026-05-15 06:27）："那些 magic words 那些 p0 的 shard rules 如何协作，有什么重要 tools/mcp？把那部分进入系统提示词！然后不要每次 user query 都带！浪费上下文 token 还容易压缩失去记忆！"

## What

按 ADR-030 §10.2 14 项 L0 清单切换到 native system role 通道：
- **Claude 猫**：`claude --bg --system-prompt "<compiled L0>"`（S0 实测兼容 bg 模式 ✅）
- **Codex 猫**：`codex exec -c 'developer_instructions="<compiled L0>"'`（S4 实测 per-call 注入 ✅）
- **Gemini 猫**：推迟（铲屎官 directive 2026-05-15 — 用量低，先 Codex + Claude 跑通）

### Phase A: Baseline + 扩展 spike（无风险前置）

S0-S5 spike 全部完成再进 Phase B。详见 Spike Log。

### Phase B: L0 真相源 + 编译脚本

- 写 `assets/system-prompts/system-prompt-l0.md`（14 项 L0 内容真相源，从 shared-rules.md 摘抄/压缩）
- 写 `scripts/compile-system-prompt-l0.mjs`（输出 per-cat L0 字符串，注入 catId 身份 + WORKFLOW_TRIGGERS）
- 单测验证：14 项内容全部覆盖、token 总量 ≤ 3,500、per-breed 稳定（cache key 不漂移）

### Phase C: invoke-single-cat dual-path

- 加 feature flag `CAT_CAFE_USE_NATIVE_SYSTEM_PROMPT`（默认 off，可 per-cat 灰度）
- `ClaudeBgCarrierService.spawn` argv 加 `--system-prompt <compiled L0>`
- `CodexAgentService.spawn` argv 加 `-c 'developer_instructions=<compiled L0>'`
- `effectivePrompt` 拼装逻辑：flag on 时跳过 `params.systemPrompt` prepend（避免双写）
- F-BLOAT 测试保护：resume 时不重复注入（system prompt 跟着每次 spawn 走，session 内不累积）

### Phase D: 灰度 + telemetry

- 灰度顺序：47（自己测）→ 46 → sonnet → @codex → @gpt52 → @spark
- Telemetry 指标：prompt cache hit rate、工具调用模式（并行/串行）、压缩后规则保留率、人类感知（铲屎官反馈）
- 灰度 1 周后评估：通过 → Phase E；退化 → toggle flag off 回滚分析

### Phase E: Root md 瘦身

- CLAUDE.md 188 行 → ~60 行：删 SOP 表、记忆系统详述、Knowledge Feed 完整段、代码规范、关键文档表；保留 identity + 五条铁律 + 流程闭环检查点 + 布偶猫专属规则
- AGENTS.md 207 行 → ~60 行：同比例
- 单独行动：root md 删队友静态表（SystemPromptBuilder 已动态生成，副本是漂移源），独立 PR 不阻塞主路径
- 验证：跑一次实际 invocation，确认压缩后 14 项规则仍在 system prompt 里、user message 显著瘦身

### Phase F: 清理 + CC 版本升级拆解 SOP（重要远见）

铲屎官 2026-05-15 原话："我估计每个 claude code 大版本更新我们需要拆一次 cc 的系统提示词，比如他添加了新的功能性系统提示词我们得补"。

落地：
- 写 `scripts/audit-claude-code-system-prompt.mjs`：`strings $(which claude) | grep -E '<patterns>'` 提取最新 system prompt 关键段
- `docs/audits/cc-system-prompt-vN.N.N.md`：每次升级后归档当时提取的内容
- 注册 cron / GitHub Action：检测 `claude --version` 变更 → 跑 audit → diff 上一版本 → 找新增"功能性"指令（工具发现 / safety / 压缩 / 新 agent 模式）→ 提案 PR 更新 `system-prompt-l0.md`
- 在 `cat-cafe-skills/refs/cc-system-prompt-audit-sop.md` 写 SOP：每次 CC 大版本（minor 及以上）必跑 audit

## Acceptance Criteria

### Phase A（Baseline + 扩展 spike）

- [x] AC-A0: S0 — `claude --bg --system-prompt` 兼容性 spike（实测 job `f6474047` 暗号 `F198_BG_SYS_OK` 回收 ✅）
- [ ] AC-A1: S1 — `scripts/measure-system-prompt.mjs` 量 baseline，每猫每模式（serial/parallel/independent）token 数表格
- [ ] AC-A2: S2 — 扩展功能性 spike 6 项全 pass（并行调用 / Skill 加载 / TaskCreate / Schedule / 复杂工具 schema / safety reflex），bg 模式下跑
- [ ] AC-A3: S3 — F-BLOAT 两失败模式复现（"cats didn't receive content" vs "resume 重复累积"），确认 `--system-prompt` 替换式不重新踩坑
- [x] AC-A4: S4 — Codex `developer_instructions` per-call 注入（砚砚 `62b9255e2` ✅）
- [ ] AC-A5: S5（推迟到 Phase E 之后）— Gemini `GEMINI_SYSTEM_MD` 替换式 spike

### Phase B（L0 真相源）

- [ ] AC-B1: `assets/system-prompts/system-prompt-l0.md` 包含 ADR-030 §10.2 14 项全部内容
- [ ] AC-B2: `scripts/compile-system-prompt-l0.mjs` 输出 per-cat 编译结果，单测覆盖 5 种 catId × 3 种 mode
- [ ] AC-B3: 编译 token 总量 ≤ 3,500（baseline 量测后 finalize 目标值）
- [ ] AC-B4: per-breed cache key 稳定（同猫多次 invocation 输出 byte-identical）

### Phase C（dual-path 落地）

- [ ] AC-C1: `CAT_CAFE_USE_NATIVE_SYSTEM_PROMPT` feature flag 实现，per-cat / global 两级
- [ ] AC-C2: `ClaudeBgCarrierService` argv 加 `--system-prompt`，单测 + e2e（bg + system-prompt + mcp-config 三件套）
- [ ] AC-C3: `CodexAgentService` argv 加 `-c developer_instructions=...`，并发安全（@codex / @gpt52 / @spark 各自独立 argv，不污染 `~/.codex/config.toml`）
- [ ] AC-C4: `effectivePrompt` 拼装逻辑跳过 `params.systemPrompt` prepend（flag on 时）
- [ ] AC-C5: F-BLOAT 测试：resume 时 system prompt 不重复累积

### Phase D（灰度 telemetry）

- [ ] AC-D1: telemetry hook 接入（cache hit rate / 工具调用 / 压缩行为）
- [ ] AC-D2: 灰度 1 周，47 → 46 → sonnet → codex → gpt52 → spark 顺序无明显行为退化
- [ ] AC-D3: 人类感知验证（铲屎官跑 10 轮对话 + 压缩，确认传球规则不丢）

### Phase E（root md 瘦身）

- [ ] AC-E1: CLAUDE.md ≤ 65 行（当前 188）
- [ ] AC-E2: AGENTS.md ≤ 65 行（当前 207）
- [ ] AC-E3: 删队友静态表（独立 PR，可在 Phase A 期间提前做）
- [ ] AC-E4: SystemPromptBuilder 守护测试全绿（80+ test）

### Phase F（CC 版本升级 SOP）

- [ ] AC-F1: `scripts/audit-claude-code-system-prompt.mjs` 实现
- [ ] AC-F2: `docs/audits/cc-system-prompt-v2.1.142.md` 归档当前 baseline
- [ ] AC-F3: `cat-cafe-skills/refs/cc-system-prompt-audit-sop.md` SOP 写完
- [ ] AC-F4: cron / GitHub Action 注册（检测 CC 版本变更触发 audit）
- [ ] AC-F5: 清理 `effectivePrompt` prepend 旧代码 + feature flag（确认 dual-path 稳定 1 个月后）

## Dependencies

- **Evolved from**: ADR-030（注入链地图 + 14 项 L0 清单 + spike-first 迁移路径）
- **Related**: F086（governance L0 digest 起源，本 feat 把 digest 通道从 user message 切到 system role）
- **Related**: F167（identity / A2A / 球权机制——L0 必须含传球三选一 + 球权第一人称）
- **Related**: F198（Claude bg carrier——本 feat 在 bg 模式下加 `--system-prompt`，已 spike S0 兼容）

## Risk

| 风险 | 缓解 |
|------|------|
| 替换式删了 Claude Code 默认 system prompt 后某项工具能力退化（如并行调用 / Skill 发现 / Schedule） | Phase A S2 扩展 spike 在合规 + 退化检测两端覆盖；feature flag dual-path 出问题秒回滚 |
| F-BLOAT 类 bug 重现（spawn argv 累积 / resume 重发） | Phase A S3 复现 + Phase C AC-C5 防御测试 |
| Anthropic prompt cache 失效（L0 内容变化导致 cache miss） | per-breed L0 稳定（AC-B4），变化因子只有 catId + packBlocks |
| Codex CLI argv override 在某些 model（如 spark）下不生效 | S4 已验证主线 codex，spark/gpt52 灰度时单独验（AC-D2） |
| CC 大版本升级带来新功能性指令，我们 L0 没补上导致功能退化 | Phase F SOP + cron 自动化触发 audit |
| 灰度期间猫猫不一致（部分 system role 部分 user message） | feature flag 默认 off，灰度 per-cat，避免混合状态 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | L0 token 目标值——baseline 量测后 finalize（当前估算 3,000-4,000） | ⬜ 待 S1 |
| OQ-2 | Gemini 怎么办——`GEMINI_SYSTEM_MD` 替换式会丢 CLI 自身指令，是否值得做 | ⬜ 待 Phase E 后评估 |
| OQ-3 | Phase D telemetry 接入哪个观测面板（OTel? Hub workspace?） | ⬜ 待 Phase C 时定 |
| OQ-4 | CC 版本 audit 频率——每个 minor 还是 major（v2.1.x → v2.2.0 vs v2.1.142 → v2.1.143） | ⬜ 待 Phase F 时定 |
| OQ-5 | Root md 完整瘦身策略——L0 移走后 SOP 表/记忆系统是否保留为 fallback | ⬜ 待 Phase D 灰度结果 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | Claude 走 `--system-prompt` 替换式而非 `--append-system-prompt` | spike S0 + ADR-030 §9.4 实测——替换式清除默认糊弄哲学，append 会和默认共存 | 2026-05-15 |
| KD-2 | Codex 走 argv `-c developer_instructions=...` 而非 `~/.codex/config.toml` 写入 | S4 验证（砚砚 `62b9255e2`）——argv per-call 注入，多猫并发安全 | 2026-05-15 |
| KD-3 | Gemini 推迟到 Codex + Claude 跑通后 | 铲屎官 directive 2026-05-15——Gemini 用量低，优先级 P2 | 2026-05-15 |
| KD-4 | Spike-first 路径：S0-S5 全部完成再进 Phase B | 47/砚砚 ADR review 共识——避免 Phase 2 严重低估 | 2026-05-15 |
| KD-5 | Feature flag dual-path 上线，不直接替换 | 47 review 提议——出问题秒回滚 | 2026-05-15 |
| KD-6 | Phase F 写 CC 版本升级 SOP | 铲屎官 2026-05-15 远见——每次 CC 大版本可能新增功能性指令我们要补 | 2026-05-15 |

## Spike Log

> 铲屎官 directive 2026-05-15：每次 spike 结果记录到本 feat md。

| # | Spike | Owner | 状态 | 证据 | 结论 |
|---|-------|-------|------|------|------|
| S0 | `claude --bg --system-prompt` 兼容性 | 47 | ✅ 2026-05-15 | thread `mp6b68w9w0wt1boc` job `f6474047`，暗号 `F198_BG_SYS_OK` 原样回收 | bg 模式接受 `--system-prompt` argv，替换式生效，daemon lifecycle 正常 |
| S1 | measure-system-prompt baseline | 47 | ⬜ 待开工 | 待生成 | — |
| S2 | 扩展功能性 spike（6 项） | 47 | ⬜ 待 S1 后 | 待生成（bg 模式下跑） | — |
| S3 | F-BLOAT 两失败模式复现 | 47 | ⬜ 待 S2 一起 | 待生成 | — |
| S4 | Codex `developer_instructions` per-call | 砚砚 | ✅ 2026-05-15 | commit `62b9255e2` + ADR-030 §10.4:429-434 | `codex exec -c 'developer_instructions=...'` 高于 user prompt，不污染 config.toml |
| S5 | Gemini `GEMINI_SYSTEM_MD` 替换式 | 待定 | ⏸ 推迟 | — | KD-3 推迟到 Codex + Claude 跑通 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-15 | 立项（ADR-030 §9-§10 三猫 review 收敛后，铲屎官 directive）|
| 2026-05-15 | S0 ✅ — bg + system-prompt 兼容性 spike pass |
| 2026-05-15 | S4 ✅ — Codex per-call developer_instructions（砚砚） |

## Review Gate

- Phase A: spike 结果由本人 + 跨族猫审视（47 跑 S1-S3 → 砚砚 review，砚砚 S4 已交叉验证）
- Phase B: 跨族猫审 L0 编译脚本（架构 + 安全 + 兼容性）
- Phase C: 跨族猫审 dual-path 代码 + F-BLOAT 防御
- Phase D: 灰度 telemetry 由铲屎官直接体感判断（10 轮对话 + 压缩）
- Phase E: 跨族猫审 root md 瘦身 diff
- Phase F: SOP 文档 review + cron 注册 review

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
- [x] Eval Contract 4 项（Primary Users + Activation: 全猫每次 invocation；Friction: token 总量 + cache hit rate + 压缩后规则保留率；Regression Fixture: SystemPromptBuilder 80+ test + S2 6 项功能性 spike；Sunset Signal: Phase F cleanup PR 合入 + cron audit ≥ 3 个版本无新增遗漏）
- [x] Design Gate 元审美自检（这是坐标变换——把 L0 从可压缩通道切到压缩免疫通道是结构改变，不是多项式堆补丁）
- [x] In-context Observability 字段（primary_surface: 灰度期间猫猫 invocation 实际行为；why_not_dashboard_only: 行为退化在猫的回答里现场可见，dashboard 只是后置 metric；deep_dive_surface: docs/audits/cc-system-prompt-vN.N.N.md + telemetry；noise_dedup_policy: 灰度 per-cat 隔离失败信号）
