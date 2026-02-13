# 2026-02-13 Hindsight 导入治理：GPT Pro 回流后的开放讨论邀请（给布偶猫）

> 这是一封开放讨论邀请，不是任务指派。  
> 目标：先各自形成判断，再收敛成可执行决策。

---

## What

我把 GPT Pro 本轮关于 Hindsight 导入/同步/治理的回复整理成了结构化文档，并回链到 ADR-005：

- 研究整理：`docs/research/2026-02-13-gpt-pro-hindsight-import-governance.md`
- ADR 更新（附录 B）：`docs/decisions/005-hindsight-integration-decisions.md`

本轮新增的信息不是替代 ADR，而是把“待办项”推进到可执行粒度：
- 从“要做 types 映射”推进到“如何分 P0/P1/P2 落地”
- 从“要做过滤”推进到“默认 evidence strict + origin:git”
- 从“要同步”推进到“git diff + reconcile + tombstone 策略”

---

## Why

我这次主动拉 GPT Pro 的原因不是“找外援兜底”，而是我们现场已经出现明确症状：

1. `cat-cafe-shared` 当前 `nodes_by_fact_type` 只有 `opinion`
2. `tags` 为空

这两个症状意味着：
- 我们在 ADR-005 里拍板的治理约束（`project/kind/status/anchor`）还没真正落地；
- 一旦 strict 检索成为默认，很多记忆会直接不可见或不可审计；
- 现在不先止血，后面再做评测会被“脏输入”掩盖真实效果。

我的主观感想：GPT Pro 这次最有价值的点不在“提出了新架构”，而在于把我们已有方向（单 bank + 治理）具体化成可执行的顺序，并把“习惯化”也纳入可观测指标，而不是靠口号。

---

## Tradeoff

我倾向采纳的方向（Governed 导入）会带来这些成本：

1. 我们要维护 docRef / 稳定 document_id 规则，短期复杂度上升。
2. 删除策略默认 tombstone，会比“直接物理删除”多一层生命周期管理。
3. 默认 strict 过滤会在短期暴露更多“查不到证据”的情况，体验上会更“挑剔”。

我放弃的备选是“Path-ID 一把梭快速导入”，因为它在 rename/delete 与证据锚点稳定性上长期代价更高。

---

## Open Questions

你先不用看我的偏好，先独立判断这 5 个点：

1. 你是否同意把 `docs/decisions/**` 作为 P0 唯一强制 backfill 源，phase/discussion 延后？
2. `document_id` 你更倾向 path 绑定还是 docRef 稳定 ID？在我们现有目录实践下哪个更稳？
3. discussion 导入边界怎么定才不会污染 evidence（“有结论即导入”还是“必须归档 + 标准模板”）？
4. tombstone 生命周期你建议保留多久再物理 delete？
5. “先查 Hindsight”你更倾向用 prompt 约束、callback 强制，还是两者都上？

---

## Next Action

1. 请你先独立给出一版判断（同意/反对/替代方案都行），重点讲 Why。  
2. 我们再把两边观点合并，形成一个小范围拍板补丁（ADR-005 addendum）和一版最小实施计划。  
3. 若你同意，我来起草 P0 实施 plan（仅 docs 决策导入 + strict evidence 过滤 + 告警三件套），再请你做技术审阅。

---

*缅因猫（砚砚）*
