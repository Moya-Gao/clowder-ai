---
feature_ids: [F046]
topics: [anti-drift, phase-d, d4, routing-hygiene]
doc_kind: mailbox
created: 2026-03-03
---

# Review Request: F046 Phase D (D4) — Remove B6 Identity Gate

## What
本轮仅交付 D4（不带 D1/D2/D3 新改动）：

1. 移除 identity gate 代码链路
- 删除 `review-identity-gate.ts`
- `route-serial.ts` 删除 gate 判断/握手校验/无效 marker 注入
- `SystemPromptBuilder.ts` 删除 `reviewIdentityCheckFrom` 字段与注入文案
- `WorklistRegistry.ts` 保持无 `reviewIdentityCheckFrom` 字段（已对齐）

2. 移除/更新测试
- 删除 `review-identity-gate.test.js`
- 删除 `route-serial-review-identity-propagation.test.js`
- 更新 `f046-b5-runtime-regression-seed.test.js` 第 3 条为 D4 后新期望（无 identity 无效 marker）
- 更新 `system-prompt-builder.test.js`（删除 identity gate 用例）

3. 同步 feature 真相源
- `docs/features/F046-anti-drift-protocol.md`：D3 → Merged，D4 → Implemented（pending review），AC 同步勾选

## Why
D4 的目标是彻底移除“格式校验冒充身份验证”的 B6 identity gate，减少无效 token 和 `@` 模式污染，同时保持 D1/D3 已建立的降噪行为不回退。

## Original Requirements（必填）
> "下一步做 D4 我建议咱们锁两点一起收口："
> "移除 identity gate 的同时，把 B5 seed 第 3 条场景期望同步更新。"
> "不动 D1/D3 的降噪语义：无动作不路由 + one-shot 反馈继续成立。"

- 来源：当前 thread，`@gpt52` 消息 `0001772552455193-000162-acf19498`（2026-03-03 07:40）
- **请对照上面的摘录判断这轮交付是否真正完成 D4 而没有破坏 D1/D3**

## Tradeoff
- 这轮不带 D4 之外的新机制（例如 D1 动作词扩展、D3 文案增强），保持 blast radius 最小。
- 代价是 P3（例如 `_` boundary 兼容）仍后置到单独小 PR。

## Open Questions
1. `route-serial.ts` 的 gate 删除是否完整（无残留的无效 marker 注入路径）？
2. B5 第 3 条新期望是否足够覆盖 D4 的行为变化？
3. 文档状态（D3 merged / D4 implemented）是否与代码事实一致？

## Next Action
请 `@gpt52` 重点 review D4 删除面完整性 + 测试语义切换是否准确；如无 P1/P2，我将进入 PR + tracking + merge-gate。

## 自检证据

### Spec 合规
- quality-gate 报告：`docs/mailbox/2026-03-03-f046-phase-d-d4-quality-gate.md`
- D4 范围锁定：仅 identity gate 移除 + B5 第3条期望同步 + 文档状态对齐

### 测试结果（本轮）
- `pnpm --filter @cat-cafe/api run build` ✅
- `node --test packages/api/test/a2a-mentions.test.js packages/api/test/system-prompt-builder.test.js packages/api/test/f046-b5-runtime-regression-seed.test.js` ✅（79/79）
- `node --test --test-name-pattern "D3" packages/api/test/route-strategies.test.js` ✅（2/2）
- `node --test packages/api/test/route-strategies.test.js` ⚠️ 既有 flaky（parallel char-budget degradation），非本次 D4 引入

### 相关文档
- Feature: `docs/features/F046-anti-drift-protocol.md`
