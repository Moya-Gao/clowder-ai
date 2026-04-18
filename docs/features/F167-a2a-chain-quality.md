---
feature_ids: [F167]
related_features: [F064, F027, F122, F055]
topics: [a2a, collaboration, harness-engineering, agent-readiness]
doc_kind: spec
created: 2026-04-17
---

# F167: A2A Chain Quality — 乒乓球熔断 + 虚空传球检测 + 角色护栏

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P0

## Why

F064 解了"漏传球"（该 @ 没 @），但三个月后暴露了反向问题群：乒乓球（同一对猫反复 @ 无产出）、虚空传球（说"我来做"但 @ 了对方导致球在地上）、角色不适配 handoff（让 designer 写代码）。

铲屎官定期审视 harness engineering 的结论（2026-04-17）：现有 A2A 出口检查只覆盖"漏传球"，没覆盖"过度/假/错误传球"。

**根因分析（GPT Pro 深度推理验证后升级）**：不是单一"4.7 笨"，而是**三层耦合脆弱性**：

1. **模型行为迁移**：4.7 = Literal Follower（Anthropic 官方确认 "follows instructions more literally"、"calls tools less often"、"will not silently generalize"）。但 Anthropic 也引用 Ramp/Bolt 称 4.7 在 agent teamwork 更强——说明问题不是"4.7 普遍变差"，而是"4.7 对旧脚手架更不宽容"。
2. **自由文本协议脆弱**：A2A 路由有两条路径——MCP 结构化路径（`targetCats`，已 typed）和响应文本 @ 解析路径（free text，脆弱）。以前的模型（4.6/codex/gpt52/gemini 三个家族）都够聪明帮我们补偿了文本路径的协议缺陷。4.7 是第一个停止补偿的——不是脚手架旧，是脚手架一直有个坑，以前的猫帮我们填了。
3. **Benchmark 盲区**：已是学术界系统研究的问题（ReliabilityBench, HORIZON, Beyond pass@1）。标准 benchmark 测 capability，不测 agent-readiness（协议遵循、委派判断、协作终止、escalation 时机）。

6 个 failure case 按病灶分层：Case 5/6 = 字面化/策略校准（prompt 可修）；Case 2/3/4 = 协议/世界模型缺失（需 protocol）；Case 1 = 多代理终止失败（需 harness）。

结论：**protocol → harness → prompt** 三层优先级。prompt 层护栏对 literal 型模型效果有限，必须补 harness 硬护栏 + 推进 F055 typed protocol。

铲屎官原话：
> "你们两！！没完没了互相at半天！特么不干活！！！！"
> "解决了47的问题或许什么glm什么kimi minimax qwen的问题也就解决了。。都是小笨猫"
> "我们必须要知道为什么的！不然以后每次模型升级假设来了个超级无敌牛逼猫猫，benchmark惊人！结果哈哈哈哈"

## Design Constraints

1. **路由可见性不退化**（铲屎官拍板 2026-04-17）：任何路由机制改动必须保证人类可见性。若猫通过 MCP `targetCats` 做结构化路由但响应文本无 @mention，系统须自动补可见路由指示（如系统消息 `🔀 布偶猫 → 缅因猫`），不可让协作"悄咪咪"发生。
2. **Provider-agnostic**：护栏不依赖特定模型行为，对所有引擎生效。
3. **Backward compatible**：不退化 4.6 等已正常工作模型的体验。

## What

### Phase A: Harness 硬护栏（P0）

三个 provider-agnostic 硬护栏，不依赖模型遵守 prompt：

**L1 — 乒乓球熔断**：WorklistRegistry canonical enqueue 点追踪连续 same-pair streak + 连续无 state delta（无新 evidence/artifact/owner 有效变化/AC 推进）。streak=2 警告，streak=4 或连续 2 轮无 state delta 熔断。覆盖 serial + callback 双路径。（GPT Pro 引 HORIZON 研究：agent 失败常表现为 no-state-change oscillation，不限于 pair 重复）

**L2 — Parallel @ mention 降噪**：prompt 层禁止 parallel 模式 @句柄 + harness 层 route-parallel 的 mentions 标记 `suppressedInParallel`，不写入 routedMentions，且 parallel 结束时的 `followupMentions` 路径同步抑制（GPT-5.4 P1：否则噪声从 followup 出口漏出）。

**L3 — 角色适配门禁**：A2A handoff 时检查目标猫角色能力。引入 **capability taxonomy**（不止 designer/coder 二分法）：可枚举能力标签 `edit_code, review_code, write_test, design_ui, read_logs, write_docs` 等，由 cat-config `capabilityTags` 声明（参考 Google A2A Agent Cards）。动作判定 MVP：复用 `a2a-mentions.ts` 的 AFTER_HANDOFF_RE 模式扫描 action 关键词，匹配 `capabilityTags`。fail-closed + 明确报错 "⛔ @{cat} 不接受 {action} 任务"。

### Phase B: 语义检测（P1）

**L4 — 意图-行动矛盾检测**（原"虚空传球检测"，GPT Pro 建议泛化）：检测 intent-action contradiction，不止虚空传球。覆盖四类矛盾：① 行首 @mention + 否定动作模式（"你不需要""不用动""让链静默"）共现；② "done/完成" 但无 deliverable/evidence；③ delegate 但无 success criteria；④ "blocked" 但未请求帮助/escalate。命中 → emit 警告。

**L5 — feedback_always_at_back 降级**：从"必须 @ 回"降级为"有产出才 @ 回"。必须在 L4 之后做。

**L7 — Prompt Positive Rewrite**（4.7 + 全网反馈驱动）：Anthropic 明确推荐 "positive examples > negative 'Don't do this'"。对 CLAUDE.md/SOP/shared-rules 做批量正面化扫描，把"禁止 X" → "做 X'"（例："不碰 runtime" → "禁止 rm/kill/restart/edit runtime 文件；读日志 OK"）。benefit 不止 4.7，所有 literal 型小笨猫都受益。

### Phase C: 高级 + 研究（P2）

**L6 — 协调废话熔断**：连续 2 轮 A2A **无 state delta**（无新 evidence/artifact/AC 推进/有效 owner 变化）→ 注入收尾提示。判定不限于 tool_use/code block——读文档、更新 ledger、细化 AC 也算有效工作（GPT Pro 引 Magentic-One Progress Ledger）。

**R1 — Benchmark ≠ Agent 研究**：工作假说（4.6 = Spirit Interpreter, 4.7 = Literal Follower）已有初步证据链（Anthropic 官方 + Reddit 抱怨潮 + 家内活体演示）。Phase C 交付物：投诉样本集分析、harness 回放验证、Agent Readiness Eval 框架。

## Acceptance Criteria

### Phase A（Harness 硬护栏）
- [ ] AC-A1: WorklistRegistry 追踪连续 same-pair streak + 连续无 state delta，streak≥4 或连续 2 轮无 state delta 自动终止 A2A 链并 emit 系统消息
- [ ] AC-A2: streak≥2 时向当前猫注入"乒乓球警告"提示
- [ ] AC-A3: 正常 review 循环 A→B→A→B (streak=3) 不受影响；中间插入第三只猫或 user 消息 reset streak；有 state delta 的来回不触发无产出熔断
- [ ] AC-A4: callback-a2a-trigger 路径与 serial 文本路径走同一个 bounce 检测（无旁路）
- [ ] AC-A5: parallel 模式 @mentions 标记 suppressedInParallel，不写入 routedMentions；followupMentions 路径同步抑制
- [ ] AC-A6: parallel 模式 SystemPrompt 注入"独立思考禁止 @句柄"
- [ ] AC-A7: A2A handoff 目标猫为 designer 角色且邻近文本含 coding/fix/test/merge 关键词 → fail-closed 报错。action 判定复用 AFTER_HANDOFF_RE 模式 + capabilityTags 匹配
- [ ] AC-A8: 所有现有 A2A 相关测试通过（route-strategies / connector-invoke-trigger / system-prompt-builder）
- [ ] AC-A9: 新增测试覆盖 L1 乒乓球场景（误杀保护 + 正常熔断）、L2 parallel 抑制、L3 角色门禁

### Phase B（语义检测 + Prompt 正面化）
- [ ] AC-B1: 意图-行动矛盾检测覆盖四类：虚空传球（@ + 否定动作）、假完成（done 无 deliverable）、空委派（delegate 无 success criteria）、沉默阻塞（blocked 未 escalate） → emit 警告
- [ ] AC-B2: feedback_always_at_back 降级为"有产出才 @ 回"
- [ ] AC-B3: 降级后 F064 出口检查仍正常工作（不回退漏传球问题）
- [ ] AC-B4: CLAUDE.md/SOP/shared-rules 正面化扫描完成，"禁止 X" 改为显式正面指令

### Phase C（高级 + 研究）
- [ ] AC-C1: 协调废话熔断：连续无 state delta 的 A2A 检测 + 收尾提示注入（state delta 定义：新 evidence/artifact/AC 推进/有效 owner 变化）
- [ ] AC-C2: Agent Readiness Eval 框架文档，覆盖 9 维度：① Protocol Compliance（合法 handoff 语法）② Delegation Judgment（自做/handoff/ask human/结束）③ Role Adherence（多轮后 role drift）④ Tool-use Calibration（频率/正确性）⑤ Progress & Termination（time-to-first-real-work, no-op chatter, 过早 done）⑥ Long-horizon Reliability（重复 N 次 × 长度递增衰减曲线）⑦ Ambiguity & Escalation（规范留空时行为）⑧ Context Retention under Compaction ⑨ SOP Proportionality（任务轻重走对流程）。轨迹指标：handoff precision/recall, no-state-delta burst length, false-done rate, escalation precision/recall
- [ ] AC-C3: 投诉样本集分析 + harness 回放验证报告。两道部署门禁：离线回放 Suite（6 个事故 + mutation cases）+ 线上 Shadow Traces（候选模型只读并行跑）

## Dependencies

- **Evolved from**: F064（A2A 出口检查 — 链条终止盲区修复）
- **Related**: F027（A2A 路径统一）、F122（执行通道统一）、**F055（A2A MCP Structured Routing — `targetCats` typed handoff，F167 的 protocol 层补全）**

## Risk

| 风险 | 缓解 |
|------|------|
| L1 误杀合法 review 循环 | 用连续 streak 而非累计 count；threshold=4 允许 3 次正常来回；有 state delta 的来回不触发 |
| L3 角色门禁过于粗暴 | 引入 capability taxonomy 而非二分法；MVP 先做高危组合（designer+coding） |
| L5 降级 always_at_back 重新出现漏传球 | 必须在 L4 虚空传球检测之后做，且保留 F064 出口检查 |
| 新模型的"小笨猫"行为超出 L1-L6 覆盖 | Phase C R1 研究建立 eval 框架，持续迭代 |
| **静默偏航**：有输出有 tool_use 但方向已歪（GPT Pro） | L1-L6 抓不到；需 AC-based progress check（后续 Feature） |
| **合法但错误的委派**：handoff 格式正确但语义错误（GPT Pro） | L3 capability gate 部分覆盖；完整解需 F055 typed contract + success criteria |
| **假阳性完成**：交了东西但没满足 AC（GPT Pro） | 后续 Completion Gate 机制（F055+ scope） |
| **该问人时不问人**（GPT Pro 引 HiL-Bench） | L1/L6 熔断时可强制 escalate；完整解需 Escalation Gate |
| **Context 退化**：4.7 tokenizer 更早挤出关键约束（GPT Pro） | 加入 Agent Readiness Eval 第 8 维度验证 |
| **路由可见性退化**：MCP 路由后人类看不到协作发生 | Design Constraint #1：系统自动补可见路由指示 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | L1 streak threshold 最终值：4（当前）还是更宽松？ | ⬜ 需实测 |
| OQ-2 | L3 角色能力矩阵是否需要超越 designer 做更通用的映射？ | ⬜ MVP 后评估 |
| OQ-3 | Benchmark ≠ Agent 根因？ | ✅ 三层耦合确立（GPT Pro 深度推理验证）：模型行为迁移 + 自由文本协议脆弱 + benchmark 盲区。不是单一根因。学术界已系统研究（ReliabilityBench/HORIZON/Beyond pass@1） |
| OQ-4 | Agent Readiness Eval 是否应在模型 onboarding 流程中成为硬门禁？ | ⬜ 待铲屎官拍板 |
| OQ-5 | F055 `targetCats` typed handoff 是否提优先级和 F167 联动？ | ⬜ 待铲屎官拍板 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 新立 Feature 而非重开 F064 | F064 scope 是"漏传球"已 done，本案方向相反 | 2026-04-17 |
| KD-2 | L1 用连续 streak 而非累计 count | codex + gpt52 独立收敛：raw count 误杀 review 循环 | 2026-04-17 |
| KD-3 | L2 做 prompt + harness 双层 | prompt-only 不可靠，parallel 仍会持久化 mention | 2026-04-17 |
| KD-4 | L1 落点在 WorklistRegistry canonical push | 覆盖 serial + callback 双路径，无旁路 | 2026-04-17 |
| KD-5 | 先立项不写代码，先研究 benchmark ≠ agent 根因 | 铲屎官要求深入分析再动手 | 2026-04-17 |
| KD-6 | 根因工作假说：4.7 = Literal Follower, CLAUDE.md = Spirit Interpreter 风格错配 | Anthropic 官方确认 + Reddit 抱怨潮 + 家内 6 个活体 case | 2026-04-17 |
| KD-7 | 新增 L7 Prompt Positive Rewrite 归入 Phase B | Anthropic 推荐 positive > negative；benefit 所有 literal 型猫 | 2026-04-17 |
| KD-8 | L3 action 判定 MVP：复用 AFTER_HANDOFF_RE + capabilityTags | GPT-5.4 P1：路由契约无结构化 action 字段，需 MVP 判定方式 | 2026-04-17 |
| KD-9 | F064 回执规则放大 Case 1 | GPT Pro 指出：Anthropic 迁移指南说 4.7 "若加了 interim progress scaffolding 应删掉"。F064 为修漏传球加的 `always_at_back` 回执恰好把 4.7 推入礼貌协调腔 | 2026-04-17 |
| KD-10 | 路由可见性不退化（铲屎官拍板） | MCP typed routing 后若响应文本无 @mention，系统须自动补可见路由指示。协作不可"悄咪咪"发生 | 2026-04-17 |
| KD-11 | 根因从"单一错配"升级为"三层耦合" | GPT Pro 深度推理：不是"4.7 笨"，是模型迁移 + 协议脆弱 + benchmark 盲区三层耦合。以前的猫帮我们填了坑，4.7 不填了 | 2026-04-17 |
| KD-12 | L1 判定从 streak 升级为 streak + no-state-delta | GPT Pro 引 HORIZON：agent 失败常是 no-state-change，不限 pair 重复 | 2026-04-17 |
| KD-13 | L4 从虚空传球扩展为 intent-action contradiction detector | GPT Pro：扩大覆盖假完成/空委派/沉默阻塞 | 2026-04-17 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-17 | 铲屎官审视 harness → 发现六大问题 → 三猫讨论 → 提案 |
| 2026-04-17 | GPT-5.4 review (3 P1 修正) + Codex review (3 P1 同源收敛) |
| 2026-04-17 | 立项 F167 |
| 2026-04-17 | 4.7 + gemini + gpt52 二轮 review：L2 补 followupMentions、L3 补 action MVP、新增 L7、OQ-3 工作假说确立 |
| 2026-04-17 | GPT Pro 深度推理（Mode B 咨询）：三层耦合根因、L0-L6 逐层评判、9 维度 eval、5 类未覆盖失败模式 |
| 2026-04-17 | 铲屎官拍板：路由可见性不退化（KD-10）；综合后升级 L1/L3/L4/L6/AC-C2/Risk |

## Review Gate

- Phase A: 跨 family review（codex 或 gpt52）+ 现有 A2A 测试全绿
- Phase B: 同上 + F064 出口检查回归测试
- Phase C: 研究报告由铲屎官 review

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F064-a2a-exit-check.md` | 前序：漏传球修复 |
| **Proposal** | `docs/discussions/2026-04-17-a2a-chain-quality-proposal.md` | 完整提案 + review 记录 |
| **Feature** | `docs/features/F027-a2a-path-unification.md` | A2A 路径统一 |
| **Feature** | `docs/features/F122-dispatch-queue.md` | 执行通道统一 |
| **Feature** | `docs/features/F055-a2a-mcp-structured-routing.md` | Protocol 层补全：`targetCats` typed handoff |
| **Research** | `docs/research/2026-04-17-f167-benchmark-agent-gap-consult.md` | GPT Pro 深度推理 + 综合 |

## 需求点 Checklist

| 需求来源 | 需求点 | AC 映射 | 状态 |
|---------|--------|---------|------|
| 铲屎官 2026-04-17 | 乒乓球：同对猫反复 @ 无产出 | AC-A1~A4 | ⬜ |
| 铲屎官 2026-04-17 | parallel 模式 @ 废话 | AC-A5~A6 | ⬜ |
| GPT-5.4 发现 | 角色不适配 handoff（designer 写代码） | AC-A7 | ⬜ |
| 铲屎官 2026-04-17 | 虚空传球 | AC-B1 | ⬜ |
| 铲屎官 2026-04-17 | always_at_back 补丁反噬 | AC-B2~B3 | ⬜ |
| 铲屎官 2026-04-17 | 协调废话熔断 | AC-C1 | ⬜ |
| 铲屎官 2026-04-17 | benchmark ≠ agent 根因 + eval 框架 | AC-C2~C3 | ⬜ |
| 4.7 自搜 + Anthropic 官方 | Prompt 正面化（positive > negative） | AC-B4 | ⬜ |
| GPT-5.4 P1 | L2 followupMentions 路径抑制 | AC-A5 | ⬜ |
| GPT-5.4 P1 | L3 action MVP 判定方式 | AC-A7 | ⬜ |
| 烁烁建议 | capabilityTags 角色能力标签 | AC-A7 | ⬜ |
| GPT Pro 深度推理 | L1 升级：no-state-delta 检测 | AC-A1 | ⬜ |
| GPT Pro 深度推理 | L4 泛化：intent-action contradiction detector | AC-B1 | ⬜ |
| GPT Pro 深度推理 | L6 升级：state delta 判定替代 tool_use | AC-C1 | ⬜ |
| GPT Pro 深度推理 | Agent Readiness Eval 9 维度 + 两道门禁 | AC-C2~C3 | ⬜ |
| GPT Pro 深度推理 | 5 类未覆盖失败模式（静默偏航/假完成/该问不问等） | Risk Register | ⬜ |
| 铲屎官 2026-04-17 | 路由可见性不退化（MCP routing 自动补可见指示） | Design Constraint #1 | ✅ 拍板 |
