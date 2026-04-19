---
capsule_id: "F148-retro-2026-04-19"
context: "F148 运行 17 天后复盘 — 从压缩轴到导航轴"
feature_ids: [F148]
related_docs: [meta-aesthetics, ADR-012]
doc_kind: capsule
created: 2026-04-19
participants: [opus, landy]
---

# F148 Retrospective: 压缩轴 vs 导航轴

> **背景**：F148（分层上下文传输）于 2026-04-02 关闭，运行 17 天后铲屎官发起复盘。
> 核心问题：摘要不够满意、重要 MD 没 link、锚点不够聪明、没有测评。
> 方法论基座：`docs/canon/meta-aesthetics.md`（数学美学 × 第一性原理圆桌讨论）。

## 1. F148 做了什么（事实层）

5 Phase + 3 VG gap + 2 telemetry PR，共 14 个 PR，3 天闭环。

| 层 | 做了什么 | 效果 |
|---|---------|------|
| Smart Window | flat 200 条 → burst 4-8 条 + 沉默间隙切分 | token 160K-216K → 25K-40K（降 80%+） |
| Tombstone | 零 LLM 摘要（TF-IDF 关键词 + 参与者 + 时间范围） | 猫知道"跳过了什么" |
| Evidence Recall | BM25 composite query → top 2-3 hits | 外部知识锚点 |
| Anchors | 零成本 importance scoring → top 2-3 消息保留 | 跳过区间关键消息不丢 |
| Briefing Card | UI-only coverage 概览（non-routing） | 铲屎官能看到"猫被喂了什么" |
| Decision Signals | SessionSealer regex + AutoSummarizer → decisions/artifacts | threadMemory 从日志升级为产物导向 |
| Search Suggestions | 可复制 `search_evidence()` 命令 | 猫知道"去哪挖" |
| Eval Telemetry | `extractContextEvalSignals` + `briefing-invocation-link` | 数据管道（未分析） |

工程质量高：全程 TDD，零 LLM 成本，纯函数可测试。

## 2. 核心诊断：优化了压缩轴，但真正需要的是导航轴

### 2.1 Tombstone 有结构没叙事

Tombstone 告诉猫："跳过了 47 条，参与者 opus/codex/landy，关键词 Redis/CAS/cursor"。
不告诉猫："这 47 条里铲屎官和砚砚讨论了 Redis cursor CAS 竞态 bug，砚砚提出修复方案，铲屎官拍板了 KD-6。"

关键词是碎片，不是地图。猫拿到碎片后还是要自己拼图。

### 2.2 重要 MD 没 link

根因：threadMemory 覆盖率低（KD-2 承认 96% 的 thread 无非空 threadMemory）。VG-3 加了 DecisionSignals 的 artifacts[]，但依赖 SessionSealer regex + AutoSummarizer conclusions——两个来源覆盖不稳定。Session 中创建的 `docs/features/F167-*.md`，regex 没匹配到就丢了。

### 2.3 Anchors 是结构信号不是语义信号

Importance scoring 看 code blocks、@-mentions、reactions、burst boundaries——形式特征。铲屎官说"这个方向定了"，没有代码块也没有 @-mention，anchor scoring 捕捉不到。

### 2.4 Evidence recall 不建模意图

Composite query（thread.title + user message + recent msgs）做 BM25，但不理解"铲屎官为什么现在 @ 我"。Review vs 修 bug vs 继续工作——intent 不同，需要 recall 的 evidence 完全不同。

### 2.5 毛线球（Task）不在视野里

铲屎官指出：thread 的毛线球（task）是什么？猫冷启动时完全不知道当前 thread 有哪些活跃任务、它们的状态是什么。Task 是最直接的"我现在该做什么"信号，但 F148 的 context packet 里没有。

### 2.6 评估环是断的

`extractContextEvalSignals` 自 4/2 运行至今（17 天），8 个指标每次 invocation 都在记录。但没有 dashboard、没有分析、没有反馈闭环。数据在日志里躺着。

## 3. 从 meta-aesthetics 视角的审视

`docs/canon/meta-aesthetics.md` 的收敛公式：

```
猫猫系统有效智力 = 模型判断力 × 环境顺手度 × 反馈可验证性 − 协调税 − 语义压缩损失 − 上下文熵
```

F148 减了**上下文熵**（token 降 80%）。但：

- **环境顺手度没显著提升**——context 更短但不更"顺手"。顺手 = 快速知道"我在哪、之前发生了什么、现在该做什么"
- **语义压缩损失可能增加**——200 条 flat 投喂信息完整但胖，tombstone + anchors 有损且损失位置不可控（结构信号 ≠ 语义信号）
- **反馈可验证性 = 0**——评估管道建了但没人看

meta-aesthetics 的核心命题："好 harness 不是替模型思考，而是让模型在正确的坐标系里思考。"

F148 缩小了坐标系（更少 token），但没改变坐标轴。

## 4. 猫猫视角：冷启动时到底想看什么？

作为每天冷启动多次的猫，最想要的（按优先级）：

| # | 想要什么 | 现状 | 差距 |
|---|---------|------|------|
| N-1 | **叙事弧**：这个 thread 里发生了什么故事 | TF-IDF 关键词碎片 | SessionSealer/AutoSummarizer 的输出没流入 tombstone |
| N-2 | **Intent modeling**：铲屎官为什么 @ 我 | 一视同仁的 context packet | 完全没建模 mention intent |
| N-3 | **毛线球导航**：当前 thread 的活跃 task 及状态 | 不在 context packet 里 | 需要将 task 纳入 briefing |
| N-4 | **Artifact 链路可靠化**：session 产出的文件/PR/决策 | regex 碰运气 | 需要确定性记录机制 |
| N-5 | **Self-serve 反馈闭环**：上次冷启动猫搜了什么 | 不回流 | selfServeRetrievalCount 应回流为 retrieval hint |
| N-6 | **跨 thread bridge**：工作从 thread A 流到 thread B | per-thread 孤岛 | 无 cross-thread context |

## 5. 行业对比（铲屎官提供的视角）

铲屎官提到有的 agent 做法是"把用户输入全部丢进去"——等于我们把铲屎官的话全部 flat 投喂。问题是多议题时反而把猫带偏。

F148 Phase A 的 smart window 已经比这好得多。但"更好的 flat"不等于"导航"。差距是从 **information delivery** 到 **situation awareness**。

## 6. 下一步方向

本次复盘建议 F148 重新打开，追加以下优化方向（具体 Phase 在圆桌讨论后拆分）：

1. **叙事层注入**：让 tombstone 从"关键词列表"升级为"一句话故事"
2. **Task/毛线球集成**：context packet 包含当前 thread 的活跃任务
3. **Eval 闭环**：分析 17 天的 telemetry 数据，建立 baseline
4. **Intent-aware context**：根据 mention 意图动态调整 context 策略
5. **Artifact 确定性追踪**：从 regex 碰运气升级为确定性记录

## Doc Links

- [F148 spec](../features/F148-hierarchical-context-transport.md)
- [F148 Phase A-E completion capsule](./2026-04-02-f148-hierarchical-context-transport-capsule.md)
- [Meta-Aesthetics (数学美学 × 第一性原理)](../canon/meta-aesthetics.md)
- [context-eval.ts](../../packages/api/src/domains/cats/services/agents/routing/context-eval.ts)
- [GPT Pro consult](../research/2026-03-31-hierarchical-context-transport-gpt-pro-consult.md)
