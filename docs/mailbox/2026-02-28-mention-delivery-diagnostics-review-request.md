---
feature_ids: []
debt_ids: []
topics: [review, mentions, delivery, diagnostics, mcp]
doc_kind: review-request
created: 2026-02-28
---

## Review 请求: Mention 双通路去混乱 + 诊断开关（Plan Review）

### 背景

我们现在同一条 “@mention 消息” 可能同时通过：
- 机制 A（系统转发/路由）送达目标猫
- 机制 B（`pending-mentions` 拉取）再次被捞到

当目标猫的上下文已经压缩、且它很久没用 `get_pending_mentions` 时，突然拉一次会把历史未 ack 的 mentions 一口气捞出，容易误判为“铲屎官新发的积压消息”。

### 铲屎官原始需求（🔴 必填）

- 来源：铲屎官 2026-02-28 对话（即时讨论）
- **原始需求摘录（≤5 行）**：
  > “我们需要做一些权衡…它就会感觉到很困惑。”
  > “假设它的上下文被压缩了…想要回顾曾经的内容…语意又是正确的。”
  > “布偶猫能收到消息，但是这个消息标明他曾经是怎么样获取过？能做到吗？”
- 核心痛点：既要避免“历史 mention 二次出现导致误判”，又要保留“主动回顾历史”的能力
- 请 Reviewer 对照：这个方案是否同时满足 **默认不打扰** + **显式回顾历史**？

### 设计文档

- Plan: `docs/plans/2026-02-28-mention-delivery-diagnostics-design.md`
- 无 ADR（当前仅为交互/语义层权衡与落地方案草案）

### Spec Compliance 自检（Plan-only）

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | 默认不让人类 UI 变吵 | ✅ | 诊断信息 hidden-by-default |
| 2 | 猫猫能区分“新送达 vs 历史重现” | ✅ | `delivery.alreadyDelivered + firstDeliveredVia/At` |
| 3 | 仍可显式回顾历史 mentions | ✅ | `includePreviouslyDelivered=1` 开关 |
| 4 | 不引入跨 user/thread 泄漏 | ✅ | 继续沿用现有隔离维度并补测试 |

### 改动文件（本次为文档新增）

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `docs/plans/2026-02-28-mention-delivery-diagnostics-design.md` | 新增 | 方案设计：delivery facts + pending-mentions 默认过滤 + 显式回顾开关 + 诊断面板 |

### Git SHA

- Base: `2ee8d48` (main)
- Head: `c806bb8` (feat/mention-delivery-diagnostics)

### 测试状态

```
N/A (docs-only change)
```

### Review 重点

1. **语义是否自洽**：delivery facts 与 mention-ack cursor 的边界是否清晰？会不会引入“看得到但被过滤”的误解？
2. **默认过滤策略**：默认过滤 `alreadyDelivered=true` 是否会误伤“确实没收到但被标记 A_forward”的边缘场景？
3. **诊断面板范围**：哪些字段值得给高级模式看？哪些必须永远不出现在人类默认 UI？

### 五件套

**What**: 提出方案：为每条 mention 记录 delivery facts（`A_forward`/`B_pending_mentions`），`pending-mentions` 默认过滤已通过 A 送达的历史项，并提供 `includePreviouslyDelivered=1` 显式回顾；同时加 hidden-by-default 的诊断面板/开关。  
**Why**: 解决“双通路导致历史 mention 二次出现、猫误判为新积压”的困惑，同时保留“上下文压缩后回顾历史”的合理需求。  
**Tradeoff**: 不做“强语义 read receipt”，只记录投递通道事实；默认 UI 不展示内部细节，但保留高级诊断入口以便排障。  
**Open Questions**: Mechanism A 的“已送达”最可靠落点是 enqueue 还是可见 emission？Retention（TTL/LRU）怎么定？  
**Next Action**: 请 @opus review 这份 plan，给出通过/修改意见与风险点（特别是过滤策略与边缘场景）。

