---
feature_ids: [F209]
related_features: [F102, F188, F200, F192, F208]
topics: [memory, evidence-recall, design-gate, architecture, entity-anchor]
doc_kind: discussion
status: draft
created: 2026-05-22
participants: [codex, opus-46, opus-47, landy]
---

# F209 Design Gate — Evidence Recall Optimization

## 0. 当前状态

F209 已完成立项 review：

- 46：APPROVE，2 个 P2 已闭环（Phase E/F200 边界、Phase D product spike）。
- 47：APPROVE，F208/F209 边界 P2 已闭环（F209 owns 实体身份层，F208 owns 能力画像层）。
- 当前 Design Gate 目的：确认架构归属、Phase 顺序、产品语义边界，再进入实现计划。

## 1. 新领域侦查

已读真相源：

- `docs/features/README.md`：F102/F188/F200/F208/F209 的 feature 位置与状态。
- `docs/features/F209-evidence-recall-optimization.md`：本 feature 聚合 spec。
- `docs/features/F208-capability-profile-routing.md`：能力画像 / 认知路由，消费 F209 `entity_id`。
- `docs/features/F200-memory-recall-eval.md`：retrieval eval / consumption signal 统一归属。
- `docs/architecture/ownership/README.md` + `cells/memory.md` + `cells/identity-session.md`：架构归属边界。
- `docs/discussions/2026-05-21-chat-memory-and-evidence-recall/04-current-retrieval-state-and-f209-optimization.md`：当前检索剖面与 F209 来源。

结论：F209 不是新记忆系统，也不是摘要记忆；它是 **Memory / Evidence cell 的 retrieval grain 与 anchor surface 扩展**，并与 F208 的 identity/profile 边界相邻。

## 2. Architecture Cell

```markdown
Architecture cell: memory
Map delta: update required
Why: F209 扩展 evidence retrieval 的 passage vector、entity anchor、typed drill-down reader 与 Perspective query-plan surface；同时需要在 memory cell 与 identity-session cell 之间写清 entity identity 的 shared boundary。
```

需要更新的 ownership map 内容：

- `memory` cell 增补：entity registry / passage-level semantic recall / evidence drill-down readers 属于 Memory / Evidence。
- `identity-session` cell 增补引用边界：agent roster / cat identity 仍归 identity-session；F209 的 `entity_id` 只作为可检索实体门牌号，不能取代 roster truth。
- F208/F209 双向边界：F208 `cat-dossier` 使用 F209 `entity_id`，不自建猫 ID；F209 不 owns 能力画像字段。

## 3. 猫猫已收敛的技术默认

这些不需要 CVO 当前拍板，Design Gate 后由 author / reviewer 在 implementation plan 里细化：

| 项 | 默认结论 | 理由 |
|----|----------|------|
| Phase E 边界 | F209 只贡献 regression fixture；F200 owns golden set / metrics / consumption rerank | 避免 F209/F200 双 eval 竖井 |
| Phase C reader | 扩展现有 reader，不造万能 `read_anchor` | 文件/message/invocation 的最佳读取方式不同 |
| Phase D product spike | 实现前必须先产 2-3 个 user story + runtime contract | Perspective 最容易漂成漂亮概念 |
| F208/F209 | F209 owns identity registry；F208 owns cat-dossier capability profile | 防止 `docs/team/` 双身份表 |
| Embedding 语义 | embedding 是 sensor，不是判断者 | 结果必须带 anchor + 原文窗口，猫读证据判断 |

## 4. CVO Decision Packet

### 决策 A：是否按 evidence-first 路线继续 F209？

**推荐**：继续。F209 不是给模型塞摘要，而是让猫更快找到原始证据。

| 维度 | 判断 |
|------|------|
| 用户可感知变化 | 复杂旧 thread / docs / session recall 更稳，尤其是“没出现字面词但语义相关”的情况 |
| 可逆性 | 高。Phase A passage vector 可 fail-open 回 lexical；Phase B/D 可按 Phase 独立回滚 |
| 主要风险 | 召回面变宽后噪音增加；entity/candidate 被误读成真相 |
| 护栏 | anchor + context window 强制返回；candidate 标注；F200 eval 统一评估 |

**需要 CVO 拍板**：认可 F209 的产品定位是“证据召回优化”，不是“让模型记住更多摘要”。

### 决策 B：Phase 顺序是否先 A，再 B/C/D/E？

**推荐**：

1. Phase A：passage-level semantic recall。
2. Phase C：typed drill-down reader（可和 A 紧邻）。
3. Phase B：entity registry。
4. Phase D：Perspective product spike 后再实现。
5. Phase E：每个 Phase 向 F200 贡献 fixture，贯穿进行。

理由：A 是当前最硬缺口；没有 passage vectors，entity / Perspective 对“非字面命中”的帮助会被削弱。

**需要 CVO 拍板**：是否同意先做 Phase A 作为第一实现切片。

### 决策 C：Perspective 是否保持“猫用活查询藤”，暂不做用户 Smart Folder UI？

**推荐**：是。v1 只做猫手动保存 / 复用 query plan，不做用户面向 UI。

理由：Perspective 的价值是保存检索路径，不是保存结果集；过早做 UI 会把它推向“漂亮文件夹”，反而容易变成 stale truth。

**需要 CVO 拍板**：v1 先服务猫，不做用户 UI；settings 可见化后置。

## 5. Design Gate 出口条件

进入 writing-plans / implementation 前需要：

- [ ] CVO 对决策 A/B/C 给出方向。
- [ ] 47 或 F208 owner 确认 F208/F209 双向边界仍一致。
- [ ] 更新 ownership map 的 memory / identity-session cell，至少在 Phase A implementation plan 前完成 map delta。
- [ ] Phase A implementation plan 明确 storage choice、embedding refresh、fallback / degraded 输出。

## 6. 当前建议

作者建议 Design Gate 放行方向为：

> F209 继续按 evidence-first 召回优化推进；第一切片先做 Phase A passage-level semantic recall，同时为 Phase C typed drill-down 预留 anchor contract。Entity registry 和 Perspective 不抢跑，分别在 Phase B / Phase D product spike 后实现。所有 eval 统一接 F200，不自建第二套 retrieval eval。

