---
feature_ids: [F163]
topics: [memory, search, confidence, ranking, consistency]
doc_kind: discussion
created: 2026-04-19
---

# F163 Phase E 方案草案：Confidence 语义修正 + 排序一致性

> 作者：布偶猫/宪宪 | 状态：草案，待 gpt52 讨论

## 问题

Phase D 让 authority boost 在排序层面生效了（LL-015 铁律搜索稳定第一），但暴露了两个新问题：

### 问题 1：Confidence 标签反直觉

搜"数学之美 圆桌讨论"时，最精准命中的 thread 标 `[low]`，半相关的 LL-051 标 `[high]`。

**根因**：`confidence = f(authority)` 独立于排序计算。排序已经把 relevance + authority 融合了，但 confidence 标签只看 authority，忽略了排序的最终判决。

等于：考试已经按综合成绩排了名，但成绩单上的"优良中差"只看家庭出身。

### 问题 2：排序一致性

同一个 query，两只猫搜出不同排序——一只搜到第 1，另一只差点掉出前 5。

**猫猫分析的可能根因**：
- evidence.sqlite 启动时重建，不同猫的 index 可能有时间差
- RRF `1/(60+rank)` 是 rank-based，分数接近时微小波动翻转排序
- 向量检索浮点精度差异

## 数学之美检验

在写方案前，先问三个问题：

1. **最小干预是什么？** — 不加新公式、新 flag、新权重。
2. **坐标系对吗？** — confidence 应该反映"这条结果对你有多有用"，不是"这篇文档有多权威"。
3. **会不会过拟合某个场景？** — 不针对"数学之美"这个特定 case 调参数。

## 方案

### Phase E-1：Confidence = f(rank)（核心，~5 行）

**insight**：排序本身就是最终判决。RRF + authority boost 已经把 relevance 和 authority 融合在排序里了。confidence 标签只需要翻译排序位置。

```typescript
// 之前（Phase D）：
confidence: authorityToConfidence(item.authority)  // 只看权威性

// 之后（Phase E）：
confidence: rankToConfidence(index, totalResults)   // 看排序位置
```

映射规则（简单分档，不用新公式）：

| 排序位置 | confidence | 理由 |
|---------|-----------|------|
| 前 30% 或 top 2 | high | 系统最有信心的结果 |
| 中间 40% | mid | 相关但不是最佳匹配 |
| 后 30% | low | 兜底，可能有噪音 |

**效果**：搜"数学之美 圆桌"时，排第 1 的 thread → `[high]`（因为它排第一）。LL-051 排第 3 → 可能是 `[high]` 或 `[mid]`，取决于总数。

**保留 authority 信息**：authority 不丢——作为 `sourceType` 或独立字段暴露给前端。用户能看到"这是教训文档"vs"这是聊天记录"，但不影响 confidence 标签。

### Phase E-2：排序一致性（调研项，优先级低于 E-1）

**假设**：不一致的根因是 index 重建时机差异，不是 RRF 本身。

需要先验证：
- 所有猫是否共享同一个 evidence.sqlite？
- 向量 embedding 是预存还是每次搜索时计算？
- 同一个 index 上两次相同 query 是否返回相同排序？

如果验证结果是"同 index 同排序"→ 问题在 index 同步，不在算法。
如果验证结果是"同 index 不同排序"→ 需要查 RRF 的非确定性来源。

**不做**：不加 tie-breaking 权重、不换 score-based 融合——先定位根因再决定改不改。

## 不做清单

- 不增加新的 F163 flag
- 不修改 applyAuthorityBoost 的权重参数
- 不为特定 query pattern（如"圆桌"）加特殊规则
- 不引入 A/B 测试框架（Phase A-C 教训）

## 约束

Phase E 总核心逻辑 ≤ 10 行。Phase D 是 21 行，E 应该更少——因为只是换了 confidence 的计算源头。

## 开放问题

1. `rankToConfidence` 的分档阈值怎么定？固定 top 2 = high？还是按百分比？
2. 前端是否需要同时展示 authority 标签（"宪法级"/"观测级"）和 confidence（"高匹配"/"低匹配"）？
3. Phase E-2 排序一致性需要先定位根因，可能是独立 issue 而非 Phase E 的一部分。
