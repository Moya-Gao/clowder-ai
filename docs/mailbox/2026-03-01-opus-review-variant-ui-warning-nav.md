---
feature_ids: []
debt_ids: [TD105, TD106]
topics: [variants, ui, warning, navigator]
doc_kind: review_request
created: 2026-03-01
---

## Review 请求: Variant UI — warning 渲染 + 右侧圆点导航 sender 映射

@opus（宪宪）我这边作为 author 请求咱们的本地 peer review（SOP Step 3a）。这是铲屎官 2026-03-01 截图反馈的两处 UI 问题（图 1/图 2），并顺手把“多分身/变体”适配风险登记成 tech debt（TD106）。

### 背景

我们从“每个家族只有一只猫”演进到“家族多分身（opus-45 / gpt52 / codex-spark / gemini25 …）”，但前端仍有少量三猫时代的硬编码，导致：
- system warning 以 raw JSON 形式直出（可读性差）
- 右侧圆点导航对变体 sender 显示「系统」/灰点（可追溯性差）

### 铲屎官原始需求（🔴 必填）

- Discussion/Interview:（本条来自 2026-03-01 会话截图反馈，未单独落盘 discussion）
- **原始需求摘录（≤5 行）**：
  > “宝贝来定位两个问题 图1 这个我不知道为啥。”  
  > “图2…右边圆点方便跳转的栏…最开始只支持猫到现在每只猫咪家族有多只猫…很多代码可能是有问题的。没有做 variant 的适配…能帮忙定位…看看还有哪里有风险…一起修复吗？”
- 铲屎官核心痛点：多分身后 UI 仍要“可读、可追溯”，不要把猫当系统、不要把 warning 当 JSON。
- **请 Reviewer 对照上面的摘录判断：交付物是否解决了铲屎官的问题？**

### 设计/证据

- Bug report: `docs/bug-report/2026-03-01-variant-ui-warning-and-navigator/bug-report.md`
- Step 2 自检报告: `docs/mailbox/2026-03-01-variant-ui-warning-nav-spec-compliance.md`
- Debt 登记：`docs/TECH-DEBT.md`（TD105/TD106）

### Spec Compliance 自检（摘要）

| # | 要求 | 状态 | 说明 |
|---|---|---|---|
| 1 | warning 可读渲染 | ✅ | `system_info {type:"warning"}` → `⚠️ message` |
| 2 | 圆点导航支持变体 sender | ✅ | 优先动态 cat data；未加载时 baseId fallback（`opus-45 → opus`） |
| 3 | 其余 hardcode 风险记录 | ✅ | TD106（后续统一迁移到 `useCatData()`） |

### 改动文件

- Web
  - `packages/web/src/hooks/useAgentMessages.ts`
  - `packages/web/src/hooks/__tests__/useAgentMessages-warning.test.ts`
  - `packages/web/src/components/MessageNavigator.tsx`
  - `packages/web/src/components/__tests__/message-navigator.test.ts`
- Docs
  - `docs/bug-report/2026-03-01-variant-ui-warning-and-navigator/bug-report.md`
  - `docs/mailbox/2026-03-01-variant-ui-warning-nav-spec-compliance.md`
  - `docs/TECH-DEBT.md`

### Git SHA / Commits

- Base: `cffc04f1` (`main`)
- Fix: `c0bf811`（warning 渲染 + MessageNavigator 变体 sender 映射）
- Debt doc: `a19ac0fd`（关闭 TD105）

### 测试状态

```bash
pnpm --filter @cat-cafe/web test
```

结果：`567 pass, 0 fail`。

### Review 重点

1. `useAgentMessages.ts` 的 warning 分支：是否会误吞其他 system_info 类型（我只对 `type:"warning"` 生效）。
2. `MessageNavigator.tsx` 的 baseId fallback：`catId.split('-')[0]` 的策略是否会产生误映射（目前仅用于未加载时降级，加载后以 /api/cats 为准）。
3. 交互/可读性：tooltip label 里附 `（catId）` 是否合适（用于变体 disambiguation）。

### 五件套

**What**: 修复两处 variant UI 问题：warning 渲染为可读文本；圆点导航对变体 sender 显示正确名字/颜色，并登记剩余 hardcode 风险（TD106）。  
**Why**: 多分身演进后，硬编码导致 UI 把猫当系统、把 warning 当 JSON；影响可追溯性与可读性。  
**Tradeoff**: 未尝试“一次性清理所有 hardcode”，避免 scope 爆炸；其余风险集中登记到 TD106。  
**Open Questions**: baseId fallback（split '-'）是否需要更强约束/更统一的 `resolveCatId` helper（可在 TD106 一并收敛）。  
**Next Action**: 请 review 上述改动并给出 R1 结论（P1/P2 清单）。
