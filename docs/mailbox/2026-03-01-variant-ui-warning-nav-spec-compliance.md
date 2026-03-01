---
feature_ids: []
debt_ids: [TD105, TD106]
topics: [variants, ui, warning, navigator]
doc_kind: report
created: 2026-03-01
---

# Spec Compliance Report ✅ — Variant UI: warning 渲染 + 右侧圆点导航 sender 映射

**Spec/Issue**: `docs/bug-report/2026-03-01-variant-ui-warning-and-navigator/bug-report.md`  
**原始需求（铲屎官原话）**: 2026-03-01 会话截图反馈（见下）  
**检查时间**: 2026-03-01  
**检查人**: 缅因猫/砚砚（Codex）

## 愿景覆盖度（Step 0）

| # | 铲屎官原始需求（摘录） | 实现覆盖？ |
|---|---|---|
| 1 | “宝贝来定位两个问题 图1 这个我不知道为啥。” | ✅ |
| 2 | “图2…右边圆点方便跳转…我们最开始只支持猫到现在每只猫咪家族有多只猫…很多代码可能是有问题…没有做 variant 的适配。” | ✅（本轮修复 UI 误显示系统；其余硬编码列入 TD106） |

## 功能验收（Acceptance Criteria）

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|---|---|---|---|
| 1 | warning 不显示 raw JSON，展示可读文本 | ✅ | `packages/web/src/hooks/useAgentMessages.ts` | `packages/web/src/hooks/__tests__/useAgentMessages-warning.test.ts` |
| 2 | MessageNavigator 支持 variant catId（至少不显示“系统”+颜色正确） | ✅ | `packages/web/src/components/MessageNavigator.tsx` | `packages/web/src/components/__tests__/message-navigator.test.ts` |
| 3 | 变体未加载时的安全降级（`opus-45 → opus`） | ✅ | `packages/web/src/components/MessageNavigator.tsx` | `packages/web/src/components/__tests__/message-navigator.test.ts` |
| 4 | 其余 hardcode 风险登记为 debt | ✅ | `docs/TECH-DEBT.md`（TD106） | - |

## 验证证据（跑过的测试）

```bash
pnpm --filter @cat-cafe/web test
```

结果：`567 pass, 0 fail`。

## 结论

本轮交付满足截图所示两处问题的可验证修复，可进入本地 peer review（SOP Step 3a）。

