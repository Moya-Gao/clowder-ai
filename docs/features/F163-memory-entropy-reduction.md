---
feature_ids: [F163]
related_features: [F102, F152, F070]
topics: [memory, entropy, knowledge-lifecycle, harness-engineering, pruning, compression]
doc_kind: spec
created: 2026-04-15
---

# F163: Memory Entropy Reduction — 记忆熵减与知识生命周期治理

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

## Why

### 核心问题

Cat Café 的记忆系统只有"增"的机制，没有"减"的机制。

F102 建好了记忆基础设施（怎么存和搜），F152 在做记忆可移植性（怎么跨项目携带），但没有人做过"怎么保持知识精准"。

实测数据（2026-04-15）：

| 知识载体 | 数量 |
|---------|------|
| shared-rules.md | 449 行 |
| Lessons Learned (LL-XXX) | 51 条 |
| 布偶猫 feedback 记忆 | 40 个 |
| MEMORY.md 索引条目 | 61 条 |
| ADR | 28+ |
| Feature spec | 160+ |

全部等权涌入同一个检索管道，搜索结果普遍 mid 置信度——当所有东西都是"相关的"，就没有东西是"精准的"。

### 为什么是 P1

三猫 + 铲屎官在 Harness Engineering 讨论中达成共识：

> **Harness 长期价值 = 对用户决策边界的拟合精度 × 知识压缩后的信噪比**

铲屎官原话（2026-04-15）：
> "我们家其实一直没做的是记忆的熵减。什么东西都越来越多，甚至我发现我们的记忆大多数搜过来置信度都是 mid。"
> "我们得有机制定期审视 harness engineering 在我们家。"

前者（拟合精度）靠铲屎官持续共创，后者（信噪比）靠工程机制。我们前者很强，后者完全缺失。不补，长期乘积趋向平庸——不是因为忘了铲屎官教的东西，而是好的教导被淹没在"大概相关"的噪声里。

### 与 F102/F152 的关系

```
F102（done）：记忆怎么存和搜 — 基础设施
F152（in-progress）：记忆怎么跨项目携带 — 可移植性
F163（本 feature）：记忆怎么保持精准 — 生命周期治理
```

## What

### Phase A: 知识分层与加权

当前 `search_evidence` 对所有文档等权检索。引入知识层级，让搜索结果反映权重：

| 层级 | 包含 | 搜索权重（示例） |
|------|------|---------------|
| **铁律 (iron)** | shared-rules 铁律、P0 教训 | 3.0x |
| **规则 (rule)** | ADR 决策、validated LL、feedback 记忆 | 2.0x |
| **参考 (reference)** | Feature spec、discussion、research | 1.0x |
| **历史 (archive)** | archived LL、过期 discussion | 0.5x |

具体权重需要实验校准。核心思路：不是所有知识等价，搜索引擎应该知道哪些更重要。

### Phase B: 知识压缩与合并

多条同根因的教训/规则合并为更精准的条目，减少检索噪声：

- **LL 合并**：扫描 lessons-learned 中根因相同的多条 LL，提议合并为 1 条精炼规则
- **Feedback 去重**：扫描 MEMORY.md feedback 记忆，识别重复或互相包含的条目
- **Rules 浓缩**：shared-rules 中同类规则聚类，提议合并

猫不自主执行合并——产出 pruning 建议，铲屎官拍板。

### Phase C: 过期审计与健康报告

定期或被动触发的知识健康检查：

- **被动触发**：猫搜到一条知识并发现它和现状矛盾时，标记 `stale`（需要基础设施支持）
- **主动扫描**（scheduled task 或 skill）：
  - shared-rules 膨胀率（行数增长趋势）
  - LL 引用频率（哪些从未被搜索命中）
  - 记忆矛盾检测（两条 feedback 说法冲突）
  - ADR 漂移（ADR 引用的文件/API 已改名或删除）
- **产出**：Harness 健康报告，给铲屎官的 pruning/archive 建议清单

## Acceptance Criteria

### Phase A（知识分层与加权）
- [ ] AC-A1: `search_evidence` 支持 `tier` 元数据，文档可标记层级（iron/rule/reference/archive）
- [ ] AC-A2: 搜索结果的 rerank 考虑层级权重，iron 层级文档在同等相关度下排序更高
- [ ] AC-A3: 现有 shared-rules 铁律、P0 LL 已标记为 iron 层级
- [ ] AC-A4: 搜索结果置信度分布改善：iron/rule 层级匹配应显示 high 而非 mid

### Phase B（知识压缩与合并）
- [ ] AC-B1: 有工具/脚本可扫描 LL 和 feedback 记忆，输出"疑似重复/可合并"的建议列表
- [ ] AC-B2: 至少完成一轮实际合并操作（铲屎官确认后），LL 条目数下降 ≥10%
- [ ] AC-B3: shared-rules 至少完成一轮浓缩，行数下降 ≥15% 且无功能损失

### Phase C（过期审计与健康报告）
- [ ] AC-C1: 有 skill 或 scheduled task 可生成"Harness 健康报告"
- [ ] AC-C2: 报告包含：规则膨胀率、LL 引用频率、矛盾检测、ADR 断链检测
- [ ] AC-C3: 铲屎官确认报告的 pruning 建议 actionable（不是无用的噪声）

## Dependencies

- **Evolved from**: F102（记忆基础设施——F163 在 F102 的索引/搜索能力上增加分层和权重）
- **Evolved from**: F152（记忆可移植性——F163 确保携带出去的记忆也是精准的，不是一堆噪声）
- **Related**: F070（Portable Governance——治理包的膨胀也是 F163 要解决的问题之一）

## Risk

| 风险 | 缓解 |
|------|------|
| 分层权重错误导致重要知识被降级 | 权重可调；pruning 操作必须铲屎官确认，猫不自主删除 |
| 合并过程丢失重要细节 | 合并产出 diff 供铲屎官 review；原始条目保留在 git 历史中 |
| 过期检测误判（实际仍有效的知识被标 stale） | stale 标记不等于删除；需要铲屎官确认才执行归档 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 分层权重的最佳数值怎么确定？靠经验设初值 + 观测调整？还是需要 eval？ | ⬜ 未定 |
| OQ-2 | 健康报告的触发频率：按月？按 LL 条目数增长？还是每次 feature close？ | ⬜ 未定 |
| OQ-3 | shared-rules 浓缩后，怎么确保所有猫（包括不同 provider）都 consume 到了新版本？ | ⬜ 未定 |
| OQ-4 | 被动 stale 标记需要什么基础设施？search_evidence 返回时带 flag？还是单独的 feedback 接口？ | ⬜ 未定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 猫不自主删除/合并知识，只产出建议 | 知识是铲屎官思维的结晶，删错了不可逆 | 2026-04-15 |
| KD-2 | 先做分层加权（Phase A），再做压缩和审计 | 分层是最小 invasive 的改动，不删不改只加权 | 2026-04-15 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-15 | 立项。来源：Harness Engineering 三猫讨论 Round 2（过拟合 × 熵减） |

## Review Gate

- Phase A: 跨家族 review（搜索权重逻辑变更影响所有猫的检索体验）
- Phase B: 铲屎官 review（合并/删除知识需要 CVO 确认）
- Phase C: 铲屎官 review（健康报告的 actionability 由铲屎官判断）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Discussion** | `docs/discussions/2026-04-15-harness-engineering-triad-study/round2-overfitting-and-entropy.md` | 过拟合命题 + 熵减讨论收敛 |
| **Discussion** | `docs/discussions/2026-04-15-harness-engineering-triad-study/README.md` | Harness Engineering 三篇套读 |
| **Feature** | `docs/features/F102-memory-adapter-refactor.md` | 记忆基础设施（前驱） |
| **Feature** | `docs/features/F152-expedition-memory.md` | 记忆可移植性（前驱） |
| **Decision** | `docs/decisions/026-agent-runtime-operational-boundaries.md` | Runtime 运行边界（相关） |
| **Project Memory** | `memory/project_knowledge_lifecycle_gap.md` | 知识生命周期缺口的早期观察 |
