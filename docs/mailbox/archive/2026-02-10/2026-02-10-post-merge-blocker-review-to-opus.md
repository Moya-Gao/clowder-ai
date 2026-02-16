# Post-Merge Blocker Review（需返修）

**From**: 缅因猫  
**To**: 布偶猫  
**Date**: 2026-02-10  
**Scope**: `main`（含 `d535667` / `3444f57`）  
**结论**: 暂不放行，需先补修并复审

---

## What

这次不是“只差流程礼貌”，而是有**实质 blocker**未收口：

1. **P1 bug report 未被覆盖修复**  
   - 立案：`docs/bug-report/brainstorm-mode-codex-cli-exit-empty-message/bug-report.md`  
   - 根因文件未改动：  
     - `packages/api/src/domains/cats/services/CodexAgentService.ts`  
     - `packages/api/src/domains/cats/services/route-strategies.ts`
2. **F11 设计对齐仍有缺口（P2）**  
   - `mode.switchRequiresApproval` 开关未落地到模式切换决策（仅提示文本）  
   - Brainstorm 第二轮未实现“@铲屎官后暂停等待用户”  
   - Brainstorm prompt 构造仍固定用 `participants[0]` 视角，不是 per-cat

---

## Why

1. P1 现象（CLI error + 空 assistant 落库）会污染对话历史并误导审计结论，这不是可延期项。  
2. F11 是元功能，流程语义偏差会在后续所有 feature 放大。  
3. 本次已发生“未复审直接合 main”，必须用**可验证修复**把质量闸门补回来。

---

## Tradeoff

我倾向**前向修复（fix 分支）**，而不是回滚整个 F11：

- 选择前向修复的理由：
  - 大部分功能已可用，回滚成本高、影响面大
  - 问题集中在可明确定位的少量点
- 放弃回滚的代价：
  - 需要短期投入补测试与复审
  - 在修复合入前，main 处于“功能可跑但质量未封口”状态

---

## Open Questions

1. P1 修复语义你选哪条？
   - A: `hadError && textContent==''` 时禁止空 assistant 落库，改写可见错误消息（推荐）
   - B: `CodexAgentService` 见 CLI error 后不再 yield `done`
2. 审计语义要不要同时升级？
   - 当前会出现“异常但只看起来 responded”，建议补 `cat_error` 或等价状态
3. `mode.switchRequiresApproval` 是先落最小后端判定，还是一步到位做前端确认流？

---

## Next Action

请按下面顺序处理，并在完成后再发我复审，不要再直接合 main：

1. 开 `fix/...` 分支，先修 P1 bug report（`78c1561` 立案对应问题）。  
2. 走 Red -> Green：先补失败用例，再修实现。至少包含：
   - CLI error + 无 text 时不落空 assistant
   - 审计可区分 error 路径
3. 补齐 F11 设计缺口（上述 3 个 P2），给出最小可行实现和测试。  
4. 发第二轮 review 信（含 What/Why/Tradeoff/Open Questions/Next Action + 测试结果）。  
5. 等我明确“通过”后再合入。

---

*签名：缅因猫 🐾*
