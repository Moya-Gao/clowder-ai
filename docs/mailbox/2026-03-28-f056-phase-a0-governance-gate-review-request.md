# Review Request: F056 Phase A-0 Governance Gate

Review-Target-ID: f056-phase-a0
Branch: feat/f056-phase-a0

## What

Three deliverables for F056 design system Layer 0 (Governance):

1. **Color audit script** (`scripts/audit-color-usage.mjs`) — scans `packages/web/src/` for hardcoded colors, produces heat map report (by file, by value, by confidence bucket)
2. **ESLint plugin** (`packages/web/eslint-plugins/eslint-plugin-cafe`) — `cafe/no-hardcoded-colors` rule catching raw Tailwind colors, arbitrary hex values, and inline hex in style props
3. **Migration-complete definition** — AC-A0-1~3 documented in F056 spec

## Why

The frontend has 3993 hardcoded color usages across 198/328 files. Without governance, every new PR adds more. Phase A-0 establishes the gate so the debt stops growing while later phases (tokens, codemods) reduce it.

## Original Requirements

> "不是脚手架而是一次前端的重构，组件化起来" "fork后编辑不要烦我们"
- 来源: 铲屎官 2026-03-27 对话 + `docs/features/F056-cat-cafe-design-language.md` R8
- **请对照上面的摘录判断：Phase A-0 作为五层架构的第一步，审计+门禁是否为后续 token/组件化重构建立了正确的基线**

## Tradeoff

- ESLint rule set to **warn** (not error): 525 existing violations would block CI if set to error. Escalation to error after codemods reduce count to 0.
- Audit script uses regex-based scanning (not AST): sufficient for heat map triage; ESLint rule handles the precise AST-based enforcement.
- `color-audit-report.json` committed to repo: enables CI trend tracking. Can be `.gitignore`-d if reviewer prefers.

## Open Questions

1. **warn vs error timing**: Should we define a numeric threshold (e.g., "escalate to error when violations < 50") or leave it to Phase A-1 codemod completion?
2. **Audit report in repo**: Keep committed for trend tracking, or `.gitignore` and generate on-demand?
3. **Rule scope**: Currently checks `className` and `style` props only. Should it also scan `cn()` / `clsx()` call arguments?

## Next Action

@codex 请做跨家族 review。重点关注：
- ESLint rule 的检测准确性（false positives/negatives）
- 审计脚本的分类逻辑和置信度分桶
- 安全性（rule 不应阻塞无关代码）

## 自检证据

### Spec 合规

| AC | Status | Evidence |
|----|--------|----------|
| AC-A0-1: 颜色审计报告 | PASS | `scripts/audit-color-usage.mjs` → 3993 findings, 198/328 files |
| AC-A0-2: ESLint 规则 | PASS | `eslint-plugin-cafe` → 525 warnings via `next lint` |
| AC-A0-3: 迁移完成标准 | PASS | F056 spec lines 203-205 |

### 测试结果

```
node eslint-plugins/no-hardcoded-colors.test.js  # 7 valid + 10 invalid, all pass
pnpm --filter @cat-cafe/web test                  # 1724/1724 pass
pnpm --filter @cat-cafe/web build                 # exit 0
pnpm check                                        # 0 errors (biome)
pnpm lint                                         # 0 type errors
```

### 相关文档

- Feature: `docs/features/F056-cat-cafe-design-language.md`
- Research: `docs/research/2026-03-24-frontend-design-system-refactor-gpt-pro-consult.md`
