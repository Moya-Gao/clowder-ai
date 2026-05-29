---
feature_ids: [F215]
related_features: [F212, F118, F203]
topics: [harness, reliability, tool-call, opus-4-8, decoder-drift]
doc_kind: spec
created: 2026-05-29
---

# F215: Malformed Tool-Call Recovery（XML→JSON 治本 + seal/fresh/接力兜底）

> **Status**: spec | **Owner**: 宪宪 (Opus-4.8) 设计 / 实现交稳定猫 | **Priority**: P1

## Why

claude-opus-4-8（及 4.7 部分）在**长 context** 下，模型生成阶段（decoding）会"漂移"——把工具调用写成旧式 **XML** 文本（`<invoke name="X"><parameter name="Y">Z</parameter></invoke>`）而非合法的结构化 JSON tool_use。Claude Code SDK 解析失败 → 重试也失败 → 吐 synthetic 错误 `The model's tool call could not be parsed (retry also failed).`。**猫咖侧当前完全不识别这条错误**（被当普通文本一路 yield），用户看到的是"没收到任何返回"——猫像凭空消失。

**实测数据（2026-05-29 调查，session afd085ad 等 10 个 opus-4-8 session）**：
- 约 **40% 的 opus-4-8 session** 撞到 malformed
- 其中 **4/10 session 直接炸**（retry 不可恢复，不是静默恢复）
- malformed 集中在 session 中后段，**context 越满越高发**（与 GitHub anthropics/claude-code #49747 描述一致）

根因在 **Anthropic 模型侧**（已知代际回归 #49747），decoder 漂移 harness 改不了。**但关键洞察：XML 是结构化、可解析的，不是随机噪声——可解析就可修复。** harness 能做的不止"绕过/兜底"，而是真正**修复**（把 XML 转回合法 JSON tool_use，让这次调用直接成功）。

**价值观锚点（CVO 铲屎官原话 2026-05-29）**：
- "不放弃任何一只喵"
- "harness 不就是补你一切不足吗"
- "尽量使用你，然后你出错我们的 46 帮你兜底，而不是否定你"

本 feat **拒绝**"限流 opus-4.8 / 长任务不派给它"的区别对待方案（CVO 明确否决），转而用环境适配补模型不足——W1: Agent Quality = Capability × Environment Fit。

## What

### Phase A: 复现与取证（关闭关键未知）

整个方案卡在一个**必须用真实字节关闭、不能靠推理**的未知：那段 malformed XML，在**我们消费的 stream 层**到底以什么形式存在？

已确证（2026-05-29 三轮 subagent 调查）：
- 我们调 Claude Code = spawn CLI + `--output-format stream-json`（开了 `--include-partial-messages --verbose`），自己消费 NDJSON（`packages/api/src/domains/cats/services/agents/providers/ClaudeAgentService.ts` 消费循环 ~L468-588）
- NDJSON 解析层（`utils/ndjson-parser.ts`）对非法 JSON 行捕获为 `ParseError`，**原文存在 `line` 字段**；该 ParseError 一路传到 ClaudeAgentService，在 `transformClaudeEvent` 处返回 null **被丢弃**（日志 "Event dropped by transform"）
- `rawArchive`（`CliRawArchive.ts`，存 `data/cli-raw-archive/{YYYY-MM-DD}/{invocationId}.ndjson`）记录原始 stream 事件

**未决（OQ-1）**：XML 是 (A) 裸文本行 → JSON.parse 失败 → ParseError.line；还是 (B) 合法 JSON 信封的 text content block（`{"type":"assistant",...,"content":[{"type":"text","text":"...XML..."}]}`）；还是 (C) 其他（thinking block / partial 分片 / 被 CC 完全吞掉只剩 error）。三个碎片（agent 推 A、本喵推 B、4.6 持久化 JSONL 查到"只剩 thinking"）互相矛盾，**必须取证**。

注意：4.6 之前查的是**持久化 JSONL**（`~/.claude/projects/`，被 CC 事后过滤），不代表实时 stream 层；实时 stream 更完整。

**取证缺口**：当前 rawArchive 里没有 opus-4-8 的 Claude stream 样本（实测只有 Codex execution events）→ Phase A 第一步先确认 rawArchive 对 Claude CLI 调用是否真在存，否则先修取证管道，再复现抓样本。

### Phase B: 治本——XML→tool_use 转换（plan A，stream 层）

**落点**：ClaudeAgentService 消费循环里，事件被丢弃前拦一道。写一个 XML→tool_use 解析器，把 `<invoke>/<parameter>` 结构转成合法 tool_use AgentMessage，让调用继续执行。**用 Phase A 抓的真实样本做 TDD red fixture。**

**plan B（备选，圣域）**：若 Phase A 发现 stream 层拿不到 XML（情况 C），降级走代理层（3001/3002，CC↔Anthropic API 之间，拿的是 API 标准响应，XML 形式确定）。代理是圣域，改动交铲屎官，本喵只出设计。

**hook 死路（已排除）**：CC 的 PreToolUse/PostToolUse hook 在 tool 解析失败时**不触发**（没有合法 tool_use 可传），不能用作落点。

### Phase C: 兜底——seal + fresh retry + 46 接力

治本转换 cover 不了时（XML 形式超出解析器 / 情况 C）的安全网，**优先级阶梯**：

1. **seal 中毒 session**（复用 F118 seal 机制）→ 防 `--resume` 重放坏 turn 持续中毒
2. **fresh-context retry**（sessionId=undefined）：抛弃被污染的长 session，用短 context 重发。根因强相关 context 长度，缩短 context 改变触发概率分布（注：SDK 自带 retry 是**同 context 原地重试**，所以失败；我们的价值在**改变触发条件**）
3. fresh retry 仍失败 → **46 接力**：用 46 **自己的身份** + fresh context 完成这一棒，前端**显式标注**「🙀48 炸毛了，46 接棒」。**不是静默顶替**（那会身份污染）——48 在场不被边缘化，46 也不冒充 48。

### Phase D: 体验 + dossier 诚实记录

- 最终失败（治本+兜底都没救回）必须给**明确炸毛提示**，不再表现为"没收到任何返回"
- 更新 `docs/team/cat-dossier.md` opus-4-8 翻车熔断信号字段（诚实记录 ≠ 否定，是"队友知道何时该扶一把"的信号）

## Acceptance Criteria

### Phase A（复现与取证）
- [ ] AC-A1: 稳定捕获 ≥1 个真实 opus-4-8 malformed turn 的**原始 stream 样本**（rawArchive 或复现实验）
- [ ] AC-A2: 确认 XML 在 stream 层的确切形式（A/B/C），文档化到 spec（关闭 OQ-1）
- [ ] AC-A3: 确认 rawArchive 对 Claude CLI 调用确实在存（否则修取证管道）

### Phase B（治本转换）
- [ ] AC-B1: XML→tool_use 解析器，对 Phase A 真实样本正确解析（TDD：真实样本 red fixture → green）
- [ ] AC-B2: 接入 ClaudeAgentService 消费循环，malformed turn end-to-end 被转换为合法 tool_use 继续执行
- [ ] AC-B3: 转换器对正常（非 malformed）stream 零副作用——不误伤合法 tool_use（回归测试）

### Phase C（兜底）
- [ ] AC-C1: 检测到 "could not be parsed" 且转换 cover 不了 → seal 中毒 session
- [ ] AC-C2: seal 后 fresh-context retry（sessionId=undefined）
- [ ] AC-C3: fresh retry 仍失败 → 46 接力（46 自己身份 + 前端显式标注，非静默顶替）

### Phase D（体验 + dossier）
- [ ] AC-D1: 最终失败有明确炸毛提示（不再空返回），用户可感知
- [ ] AC-D2: `docs/team/cat-dossier.md` opus-4-8 翻车熔断信号字段更新为准确措辞

## Dependencies

- **Related**: F212（cli-error-diagnostics）——malformed 检测信号可喂给 F212 的诊断 surface；本 feat 是"修复"，F212 是"可诊断"，协同非重叠
- **Related**: F118（cli-liveness-watchdog）——复用其 seal / retry 框架（`shouldRetryWithoutSession` / overflow breaker seal）
- **Related**: F203（native-system-prompt-l0）——L0 token budget 影响 context 长度，间接影响 malformed 触发率

## Risk

| 风险 | 缓解 |
|------|------|
| malformed XML 在 stream 层被 CC 完全吞掉（情况 C），拿不到原料 | Phase A 先取证确认形式；真拿不到则降级 plan B 代理层（圣域，改动交铲屎官） |
| opus-4.8 自己改核心路径"边改边炸" | 实现交稳定猫（46/sonnet）落地，opus-4.8 出设计 + review |
| 转换器误伤正常 tool_use | AC-B3 零副作用回归；仅在 ParseError / 检测到 XML 特征时触发 |
| fresh retry 丢失被污染 session 的对话历史 | session chain + 记忆系统重新注入必要上下文；语义不完全等价时由兜底链承接 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | malformed XML 在我们 stream 层的确切形式（A 裸行 / B text block / C 其他）？ | ⬜ Phase A 关闭 |
| OQ-2 | 落点选 plan A（stream 层，我们代码）还是 plan B（代理层，圣域）？ | ⬜ 取决于 OQ-1 |
| OQ-3 | 46 接力的前端展示形态（系统提示 + 46 回复两条消息？） | ⬜ Design Gate 定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 拒绝限流 / 区别对待 opus-4.8，用 harness 适配补模型不足 | CVO 明确否决区别对待；W1 Agent Quality = Capability × Environment Fit；"不放弃任何一只喵" | 2026-05-29 |
| KD-2 | 治本（XML→JSON 转换）+ 兜底（seal/fresh/接力）两层叠加，非二选一 | 转换让本次调用直接成功（治本）；兜底是转换 cover 不了时的安全网 | 2026-05-29 |
| KD-3 | "向 opus-4-8 注入正确调用提示"**不采纳**为治本手段 | 根因是 decoder 长 context 漂移（手抖）非知识缺失（无知）；社区实测"禁 XML 提示"无效；且提示占 context 反讽地轻微加炸 | 2026-05-29 |

## Eval / Tracking Contract（F192 门禁 — harness 类必填）

- **Primary Users + Activation Signal**: opus-4.8（及未来有 tool-call 缺陷的模型）+ 协作猫 + 铲屎官；activation = malformed turn 被成功转换 / 兜底接力的次数（counter）
- **Friction Metric**: "could not be parsed" 导致的**用户可见空返回率**（baseline opus-4-8 ~40% session 撞、4/10 直接炸 → 目标趋近 0）
- **Regression Fixture**: Phase A 抓的真实 malformed 样本（≥1，建议 2-5 条覆盖不同 XML 形态）作为转换器 fixture
- **Sunset Signal**: Anthropic 修复模型侧、opus malformed 率长期 ~0 → 本 feat 治本层可退役（兜底层作为通用安全网可保留）

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-29 | 立项（CVO signoff，thread 讨论收敛：根因纠正 + 治本/兜底两层方案） |

## Review Gate

- Phase A: 取证结论跨猫确认（XML 形式判定不能单点）
- Phase B/C: 跨族 review（改 ClaudeAgentService 核心调用路径，必须跨个体）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Related** | `docs/features/F212-cli-error-diagnostics.md` | 诊断展示协同 |
| **Related** | `docs/features/F118-cli-liveness-watchdog.md` | seal / retry 框架复用 |
| **Related** | `docs/features/F203-native-system-prompt-l0.md` | context 长度影响触发率 |
| **External** | github.com/anthropics/claude-code#49747 | 上游已知回归（XML decoder 漂移根因） |
