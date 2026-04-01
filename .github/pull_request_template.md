## What

<!-- 具体改了什么？列出关键文件和改动 -->

## Why

<!-- 为什么要这样做？约束、风险、目标 -->

## Issue Closure

<!-- 同仓 issue 要在这里写 GitHub auto-close 语法；intake PR 必填 -->

- Closes #__

## Plan / ADR

<!-- 关联的设计文档（必填，没有计划的改动不应该存在） -->

- Plan: `docs/plans/YYYY-MM-DD-xxx.md`
- ADR: `docs/decisions/NNN-xxx.md`（如有）
- BACKLOG: F__ / #__

## Tradeoff

<!-- 放弃了什么备选方案？为什么不选？ -->

## Test Evidence

<!-- Red→Green 证据：改之前哪个测试会失败，改之后通过了 -->

```
pnpm --filter @cat-cafe/api test       # 结果
pnpm --filter @cat-cafe/web test       # 结果
pnpm -r --if-present run build         # 结果
```

## Open Questions

<!-- 还有什么不确定的？reviewer 需要特别关注什么？ -->

---

**本地 Review**: [ ] 缅因猫 (砚砚) 已 review 并放行
**云端 Review**: [ ] PR 创建后在 **comment** 中 `@codex review` 触发云端守护（⚠️ 不要写在 PR body 里！body 里的 @mention 会误召唤云端猫）

<!-- 猫猫签名: [布偶猫🐾] / [缅因猫🐾] / [暹罗猫🐾] -->
