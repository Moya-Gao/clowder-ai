---
capsule_id: "F166-A-2026-04-17"
context: "Phase A 拖拽排序 + 持久化 + 联动"
feature_ids: [F166]
doc_kind: capsule
created: 2026-04-17
---

## What Worked
- 单注入点模式（`useCatData` hook 排序 → 总揽 + @ picker 同时生效）极大减少了需要改动的文件数量
- 原生 HTML5 DnD ~30 行实现，不引入 @dnd-kit 等外部依赖，decision 正确
- TDD 流程顺畅：先写 sort 纯函数测试 → 再写 hook 集成测试 → 最后 UI 交互测试
- 三轮 review 迭代（codex ×2 + cloud ×1）逐步逼近正确的并发模型

## What Failed
- 并发竞态保护经历了 3 次迭代才做对：component-level saveSeqRef → module-level _saveSeq → dual _saveSeq + _lastSuccessSeq。最初的单 seq 方案在"新请求失败、旧请求成功"场景下会丢数据
- 去重校验遗漏：首轮实现没有考虑 catOrder 数组可能包含重复 catId（后端未校验 + 前端未防护），codex P1 才发现

## Trigger Missed
- 应该在 writing-plans 阶段就画出"并发请求时序图"，提前识别 stale success 场景，而不是靠 review 逐轮修
- 去重校验属于输入验证基本面，spec 阶段就应列入 AC

## Doc Links
- [F166 Spec](../features/F166-cat-order-customization.md)
- [PR #1232](https://github.com/anthropics/cat-cafe/pull/1232)

## Rule Update Target
- `shared-rules.md` 或 writing-plans skill：并发写入场景应在计划阶段画时序图，覆盖"新失败旧成功"边界
- 无
