---
feature_ids: [F148]
related_features: [F102, F042, F024]
topics: [context-engineering, multi-agent, memory]
doc_kind: spec
created: 2026-03-31
---

# F148: Hierarchical Context Transport — 分层上下文传输

> **Status**: in-progress | **Owner**: 布偶猫 + 缅因猫 | **Priority**: P1

## Why

当一只猫被 @-mention 冷启动进入一个活跃 thread 时，当前的 `assembleIncrementalContext` 会以 flat 方式投喂最多 200 条 × 10K chars 的原始消息，消耗 160K-216K tokens 的 context 预算，**在猫猫开始思考前就耗尽了大部分上下文窗口**。信噪比极低——绝大多数是中间往返讨论，不是关键决策。

这是铲屎官当前最大的痛点："增量上下文的传输太胖了"。

铲屎官原话（2026-03-31）：
> "我觉得感觉最重要的，增量上下文的传输"
> "最便宜的 haiku 把它带到沟里面去了"（关于 cheap-model summarization 的失败实验）

## What

将 flat incremental delivery 改为分层 context packet，大幅提升信噪比，同时容忍现有基建（threadMemory）覆盖率不足的现实。

### Phase A: Smart Window + Tombstone + Evidence Recall

改造 `assembleIncrementalContext()`（route-helpers.ts），从 flat N=200 改为：

1. **Recent burst**（不是固定 last-N）：从 cursor 尾部向前取最近一个完整交互 burst（默认 4-8 条，按 silence gap ≥15min 切分，不切断 question→answer / tool-call→result 语义链）
2. **Coverage tombstone**：被跳过的消息区间生成结构化摘要（~40 tokens，零 LLM 成本）：
   - omitted count + time range
   - active participants
   - 2-4 个零成本提取关键词（TF-IDF from omitted messages, query = composite: thread.title + user message + recent 1-2 non-system msgs）
   - 1-2 条 retrieval hints（指向 search_evidence）
3. **Evidence recall**：用 composite query（thread.title + 当前 user message + 最近 1-2 条非系统消息）跑 evidence.sqlite BM25，best-effort 500ms timeout，top 2-3 hits 注入为外部知识
4. **Tool payload scrub**：非最后一跳的 tool-call 结果压缩为 digest line（`<tool_result truncated: search_evidence returned 45 rows>`）

**预期效果**：context 从 160K-216K tokens → 25K-40K tokens（降 80%+），不依赖 threadMemory 覆盖率。

### Phase B: Self-Serve Retrieval Enhancement

增强猫猫的主动检索能力，让 L4（self-service）成为真承诺：

1. **`search_evidence` 加 `threadId` 过滤**：猫可以说"在这个 thread 里搜 Redis CAS"
2. **`get_thread_context` keyword 升级**：从 substring match 升级为有排序/相关性的检索
3. **工具边界明确**：search_evidence 负责"找"，get_thread_context 负责"看"

### Phase C: Importance Scoring + Anchors

在 Phase A tombstone 基础上，从 omitted 消息中选出高价值 anchors：

1. **零成本 importance scoring**：structural signals（code blocks, @-mentions, reactions）+ positional signals（burst boundaries）+ BM25 with composite query（同 Phase A KD-3：thread.title + user message + recent msgs）
2. **Anchor injection**：top 2-3 highest-scoring omitted messages 作为 anchors 注入 tombstone 和 hot tail 之间
3. **Thread opener / primacy anchor**：首条消息或 thread title 作为 primacy anchor

### Phase D: Structured State (Future)

当 Phase A-C 稳定后，探索结构化状态提取：

1. **threadMemory 升级**：从活动日志（工具+文件）升级为产物导向（区分 read/write，列出创建的文档）
2. **Coverage map JSON**：GPT Pro 提出的 coverage 对象（omitted ranges, freshness, retrieval hints）
3. **State ledger 探索**：如果 regex 能抓住足够多的决策模式，尝试结构化 state extraction
4. **Prompt cache ordering**：Gemini 提出的全局 prefix 优化

## Acceptance Criteria

### Phase A（Smart Window + Tombstone + Evidence Recall）✅
- [x] AC-A1: cold-mention 场景下 context tokens 降低 ≥70%（对比现有 flat delivery）
- [x] AC-A2: recent burst 不切断语义链（question→answer, tool-call→result 保持完整）
- [x] AC-A3: tombstone 包含 omitted count、time range、participants、keywords、retrieval hints
- [x] AC-A4: evidence recall 用 composite query，500ms timeout，fail-open
- [x] AC-A5: tool payload scrub 对非最后一跳的 tool 结果生效
- [x] AC-A6: 现有热路径（warm mention，cursor gap 低于可配置阈值）行为不变

### Phase B（Self-Serve Retrieval Enhancement）✅
- [x] AC-B1: search_evidence 支持 threadId 过滤参数
- [x] AC-B2: get_thread_context keyword 有排序/相关性能力
- [x] AC-B3: 两个工具边界清晰（找 vs 看），无功能重叠

### Phase C（Importance Scoring + Anchors）
- [ ] AC-C1: zero-cost importance scoring 实现（不调用 LLM）
- [ ] AC-C2: top 2-3 anchors 注入到 context packet
- [ ] AC-C3: primacy anchor（thread opener 或 title）始终包含

### Phase D（Structured State）
- [ ] AC-D1: buildThreadMemory 区分 read/write，产出产物清单
- [ ] AC-D2: coverage map JSON 对象随 context packet 投递

## Dependencies

- **Evolved from**: F102（记忆系统 — evidence.sqlite 是 L3 的基础）
- **Related**: F042（三层信息架构 — 分层思想的上层决策）
- **Related**: F024（中途消息注入 + Context 存活监控）
- **Related**: F143（Hostable Agent Runtime — context packet 需要跨 provider 统一）

## Risk

| 风险 | 缓解 |
|------|------|
| burst 切分算法误切语义链 | 保守默认（silence gap ≥15min），加 semantic chain detection（Q→A, tool→result） |
| evidence recall 召回错题（query 质量差） | composite query（title + user msg + recent msgs），不只用 @-mention text |
| warm mention 场景被误改 | Phase A 只改 cold-mention 路径（gap > 可配置阈值），warm path 保持不变 |
| threadMemory 覆盖率低（~4%）导致 L1 空洞 | Phase A 设计为完全容忍 L1 缺失，tombstone + evidence 兜底 |
| tool payload scrub 误压缩关键信息 | 只压缩非最后一跳，最后一跳保留完整 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | burst 切分的 silence gap 阈值最优值？15min 还是 30min？ | ⬜ 未定（需要数据） |
| OQ-2 | Prompt cache ordering（Gemini 建议的全局 prefix 优化）收益多大？ | ⬜ 未定（Phase D 实验） |
| OQ-3 | warm mention 阈值定多少条？10? 20? | ⬜ 未定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 不用 cheap-model summarization | Haiku 实验证明 cheap 摘要误导 Opus，增加总成本。Claude Code 也用主模型做 autoCompact | 2026-03-31 |
| KD-2 | Phase A 设计为容忍 L1（threadMemory）缺失 | 96% 的 thread 没有非空 threadMemory，硬等 L1 成熟不现实 | 2026-03-31 |
| KD-3 | evidence recall 用 composite query 而非纯 @-mention text | 砚砚指出 "@opus 帮看下" 这种 mention text 对 BM25 几乎没信号 | 2026-03-31 |
| KD-4 | search_evidence 负责"找"，get_thread_context 负责"看" | 工具边界清晰，避免功能重叠 | 2026-03-31 |
| KD-5 | GPT Pro 主骨架 + Gemini 局部好点子 | GPT Pro 更贴我们真实代码和约束；Gemini 的 prompt caching 和 source tagging 独到 | 2026-03-31 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-31 | 学习 Claude Code v2.1.88 源码 → 识别痛点 → GPT Pro + Gemini Ultra 双模型咨询 → 本地猫综合 → 立项 |
| 2026-03-31 | Phase A 实现开始：config + burst detection + tombstone + tool scrub + evidence recall + 集成 |
| 2026-03-31 | Phase A merged (PR #900) — 缅因猫 review (2 P1 + 1 P2 fixed) + 云端 review passed |
| 2026-04-01 | Phase B merged (PR #902) — 缅因猫 review (R1: 2P1+1P2, R2: 1P1, all fixed) + 云端 review passed |
| 2026-04-01 | 愿景守护 Gap Fix merged (PR #906) — Gap-1 token trigger + Gap-2 precise hints + P1 short-circuit fix |

## Review Gate

- Phase A: 缅因猫 review（砚砚全程参与设计讨论，最熟悉约束）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Research** | `docs/research/2026-03-31-hierarchical-context-transport-gpt-pro-consult.md` | GPT Pro + Gemini Ultra 双模型咨询（含 Part 1 prompt + 两份回填 + 综合框架） |
| **Source Study** | `third-party-studies/claude-code-sourcemap-v2.1.88/notes/` | Claude Code v2.1.88 源码学习笔记（架构 + 安全 + 综合） |
| **Feature** | `docs/features/F102-memory-adapter-refactor.md` | 记忆系统（evidence.sqlite 是 L3 基础） |
| **Feature** | `docs/features/F042-prompt-engineering-audit.md` | 三层信息架构（分层思想来源） |
