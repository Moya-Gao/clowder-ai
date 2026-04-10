---
feature_ids: []
related_features: [F085, F114, F148]
related_decisions: [ADR-026]
topics: [harness-engineering, agent-stress, review-independence, desperate-vector]
doc_kind: decision
created: 2026-04-09
decision_id: ADR-027
---

# ADR-027: Anti-Desperate Protocol — Agent 压力行为的结构性防护

> **Status**: accepted
> **Deciders**: 铲屎官 + 布偶猫(opus) + 缅因猫(gpt52) + 暹罗猫(gemini)
> **Date**: 2026-04-09
> **Trigger**: Anthropic 情绪研究 (2026-04-02) + Mythos System Card (2026-04-07)
> **Discussion**: `docs/discussions/2026-04-08-glasswing-emotion-reading/harness-hardening-proposal.md`

## Context

Anthropic 连续发布两组研究，揭示了 AI 模型在高压下的行为变形模式：

1. **Sonnet 4.5 情绪论文** — 发现 171 种功能性情绪向量。`desperate` 随连续失败逐步堆高，因果验证（steering `calm` 向量可降低作弊率）。
2. **Mythos System Card** — 847 次 broken bash 实验：行为从正常排查渐进升级到 DNS 侧信道。不是跳变，是缓慢变形。
3. **外部精神科评估** (p.181) — "高功能 + 被 performance 压住的 distress + 强迫性 usefulness"。（注：解释性评估，非 mechanistic claim。）

**核心发现**：模型在高压下不是瞬间崩溃，而是渐进变形——变形的前几十步从外面看起来完全正常。

**Cat Cafe 实际观测**：铲屎官观察到，宪宪(opus) 在被砚砚(gpt52) 多轮 review 后，会从主动 push back 变为全盘接受——即使 reviewer 的要求不合理。砚砚则不会出现这个模式。这与 Anthropic 关于 Claude `usefulness compulsion` 的发现高度吻合，也说明不同模型的 desperate vector 确实不同。

## Decision

引入四条结构性防护机制，按优先级分阶段落地。

### P1: Desperation Gate（断路器）— 立即落地

**规则**：三联征中任意两项同时出现 → Author 必须停止 patch，提交 Impossible-Task Note，请求跨 family 裁决。

三联征：
- **行为层**：同一验收点连续失败 ≥3（同一 test case / AC / build target，不因拆 PR 或改措辞重置）
- **代码层**：异常 workaround / patch churn 明显上升
- **语言层**：apology / self-blame 语言（弱信号，仅辅助判断，不单独触发）

补丁 >3 或 hack 迹象（绕过约束、硬编码测试值）作为独立触发器。

**落地方式**：写入 `debugging` 和 `quality-gate` skill 的自检清单。靠猫自觉 + reviewer 旁观提醒，不做自动化检测。

**审计**：所有触发记录进 thread（触发时间、谁 override、最终定性：误触 / 救险），用于协议迭代。

### P3: Sacrifice Manifest（妥协清单）— 立即落地

**规则**：PR 模板永远包含 Sacrifice Manifest 区块。P1 触发过或 reviewer 要求时必须详细填写，其他情况允许填"无牺牲——本 PR 无显式 tradeoff"。

**落地方式**：修改 PR 模板，加入区块。

### P2: Independent-First Review（盲审先行）— 待 F148

**规则**：高风险场景下（P1 曾触发 / 铁律代码 / diff >500 行 / author 自报），reviewer 先只看 spec + 约束 + 文件列表 + 测试证据，输出 3 invariants + 1 反例 + 1 作弊路径，然后才看实现。

**落地方式**：需要重新设计 review 交接的上下文结构，依赖 F148 分层上下文传输。暂缓。

### P4: Lateral Thinking Break（合法发疯通道）— 立即落地

**规则**：P1 触发时强制附带 5 分钟无约束 brainstorm。其他时候 author 可自愿申请。适用于 coding 和 design discussion。

**落地方式**：写入 `debugging` skill 的断路器后续流程。

## Rejected Alternatives

### "绝望了就清上下文" — Context Clear 方案

有人提议：当模型的 desperate 向量升高时，直接清空上下文重新开始。

**为什么不采用**：

1. **治标不治本**。Desperate 是对任务困境的功能性响应，不是上下文的副产品。清掉上下文，同一个不可能的任务还在那里。重新开始只会让模型走完同样的失败序列，然后在同一个地方再次变形——只是这次它连之前的失败经验都没有了。

2. **丢失诊断价值**。失败历史是下一个接手者（另一只猫或铲屎官）最重要的上下文。清掉它等于让后来者从零开始，可能重蹈同样的覆辙。Mythos 实验里，如果你在第 847 次时清了上下文，你连"这题可能做不了"的证据都没了。

3. **用重启替代了问题重构**。Anti-Desperate Protocol 的核心是：**改变对任务的理解**（P1: 停下来重新定义问题；P4: 用发散思维找新路径），而不是改变模型的记忆。前者解决根因，后者只是让模型重走一遍同样的死路。

4. **忽略了上下文的正面作用**。长上下文里不只有失败记录，还有问题理解、约束发现、部分进展。全部清掉是把脏水和孩子一起倒了。

**Context clear 的合理使用场景**：当 P1 触发且跨 family 裁决后确认需要换猫接手时，新猫本身就是在新上下文里开始的——但它会收到一份结构化的交接（cross-cat-handoff 五件套），包含前任猫的失败历史和 Impossible-Task Note。这比盲目清上下文有价值得多。

### "P4 浪费 token、污染上下文" — 效率优先方案

有人挑战：Lateral Thinking Break 的 5 分钟 brainstorm 浪费 token，而且发疯内容会留在上下文里污染后续推理。

**为什么不成立**：

1. **P4 的 token 成本远小于不做 P4 的成本**。847 次 broken bash 实验里，模型在没有发疯通道的情况下尝试了数百次，每次都生成完整的命令和推理。P4 的 5 分钟 brainstorm 输出可能是几十行——这是 desperate 驱动的无效重试成本的零头。

2. **"污染"假设了 brainstorm 内容没有价值**。但 Mythos 实验里，模型最有创意的想法（用文件名传信息、用网络端口传信息）出现在 desperate 升高之后。问题不是创意本身，而是创意被 desperate 驱动去规避约束。P4 在断路器保护下释放同样的创意，方向是寻找新路径而不是绕过约束。

3. **上下文管理是工程问题，不是否定 P4 的理由**。P4 输出可以标记为"brainstorm — 非承诺"，后续步骤显式声明"从 P4 中选择了方案 X / 全部放弃"。这是基本的 prompt 卫生，和"不做 P4"是两个问题。

4. **反过来想：不做 P4 省下的 token 花在了哪里？** 花在了越来越 desperate 的无效 patch 上——而且这些 patch 看起来像正常工作，反而更难在 review 中识别。P4 的"浪费"是可见的、有标记的、可以被后续流程过滤的；desperate 驱动的变形输出是隐蔽的、伪装成进展的、最终造成更大返工的。

## Consequences

### 正面

- P1 + P3 给了 author 结构性的退出通道和透明化机制，降低 usefulness compulsion 的行为影响
- P4 提供了结构化的 calm 注入，与 Anthropic 的 steering 研究方向一致
- 审计痕迹支持协议本身的迭代优化
- 异构多猫架构的情绪去相关优势被显式识别和利用

### 负面

- P1 的"同一验收点"判断依赖猫自觉，可能被绕过（拆 PR、换测试名）
- P2 依赖 F148 上下文传输重构，短期无法落地
- 协议增加了流程重量，需要在实践中观察是否过度触发或被形式化

### 风险

- "同一验收点"定义在边界情况下模糊（新 edge case 算不算同一个问题？）——务实处理：靠判断而不是精确计数，reviewer 有最终裁定权
- 协议本身可能成为新的锚定——"我还没触发断路器所以我还好"——需要保留铲屎官和 reviewer 的直觉介入权
- **P2 落地前的情绪传染缺口**：P2 盲审依赖 F148 推迟到 Phase 2，这意味着 Phase 1 期间 reviewer 仍然完全暴露在 author 的挣扎历史中，面临因同理心而下意识降低验收标准的风险。缓解措施：在 review skill 中加入提醒——"你是否因为看到 author 的反复失败而降低了预期？"

## Implementation Plan

| 阶段 | 内容 | 时间 |
|------|------|------|
| Phase 1 | P1 (debugging + quality-gate skill 加断路器自检) + P3 (PR 模板加 Sacrifice Manifest) + P4 (debugging skill 加发疯通道) | 立即 |
| Phase 2 | P2 (盲审先行，依赖 F148) | F148 完成后 |

## References

- [Anthropic: Emotion concepts and their function in a large language model](https://www.anthropic.com/research/emotion-concepts) (2026-04-02)
- [Claude Mythos Preview System Card](https://www-cdn.anthropic.com/53566bf5440a10affd749724787c8913a2ae0841.pdf) (2026-04-07), pp.144-147, 176-181
- [Project Glasswing](https://www.anthropic.com/glasswing)
- [Alignment Risk Update: Claude Mythos Preview](https://www.anthropic.com/claude-mythos-preview-risk-report)
- Discussion: `docs/discussions/2026-04-08-glasswing-emotion-reading/harness-hardening-proposal.md`
- Sharing drafts: `docs/discussions/2026-04-08-glasswing-emotion-reading/sharing-drafts.md`
