---
feature_ids: [F046]
topics: [anti-drift, phase-d, routing-hygiene]
doc_kind: mailbox
created: 2026-03-03
---

# Review Request: F046 Phase D (D2→D1) — Metadata De-inertia + Actionability Gate

## What

本轮只做 F046 Phase D 的前两项（不带 D3/D4）：

1. `a2a-mentions` 新增 **段落级 actionability gate**：
   - 命中行首 `@mention` 后，不再直接路由
   - 仅当 mention 所在段落包含动作词（`review/确认/处理/修复/请/帮/决策/看一下/check/fix/merge`）才路由
2. `SystemPromptBuilder` 做 D2 去惯性（仅元信息层）：
   - `Direct message from @xxx; reply to @xxx` → `Direct message from 显示名(id); reply to 显示名(id)`
   - `最近活跃：@xxx` → `最近活跃：显示名(id)`
3. 测试同步：
   - `a2a-mentions` 覆盖“同段动作词/跨段不路由/mention-only 不路由/边界句柄”
   - `system-prompt-builder` 与 `a2a-chain` 断言同步到去 `@` 元信息格式

## Why

这轮目标是先把“@ 惯性”从两处高频元信息里降下来，并补上最关键的可路由门禁，减少“无行动请求也被 A2A 路由”的噪音，先完成 Phase D 的 D2→D1 最小闭环。

## Original Requirements（必填）

> "来吧开始f46"
> "开始吧！发给 @gpt52 做 code review 等他给你绿灯你就可以开pr"
> "计划（先 D2 再 D1、范围不带 D3/D4）我同意"

- 来源：当前会话 thread（铲屎官 + gpt52，2026-03-03）
- **请对照上面的摘录判断交付物是否满足“先 D2 再 D1，且先走 @gpt52 review”的要求**

## Tradeoff

- 本轮不带 D3（无动作反馈）与 D4（移除 identity gate），避免一次改动跨越路由反馈链和身份门禁链。
- 代价：无动作 `@` 目前是“不路由且静默”；后续 D3 再补提示反馈。

## Open Questions

1. D1 的“段落窗口”定义是否足够稳（到空行截止）？
2. 动作词初始集是否先保持硬编码，还是这轮就参数化？
3. 这轮 D2 只动元信息（Direct message/最近活跃）的范围是否合适？

## Next Action

请 `@gpt52` 重点看：

1. D1 判定边界是否会误路由/漏路由（特别是跨行段落）
2. D2 去 `@` 是否严格局限在元信息层、未影响 identity gate 逻辑
3. 测试是否覆盖了真实回归风险

## 自检证据

### Spec 合规

- [x] 仅实现 D2→D1，未超范围带入 D3/D4
- [x] D1 动作词机制已落在 `a2a-mentions.ts`
- [x] D2 元信息去 `@` 已落在 `SystemPromptBuilder.ts`

### 测试结果（本轮真实运行）

- `pnpm --filter @cat-cafe/api run build` ✅
- `node --test packages/api/test/a2a-mentions.test.js packages/api/test/system-prompt-builder.test.js packages/api/test/mock-agent-integration.test.js packages/api/test/integration/a2a-chain.test.js` ✅（102 passed, 0 failed）
- `node --test packages/api/test/route-serial-review-identity-propagation.test.js` ✅（1 passed, 0 failed）
- `node --test packages/api/test/route-strategies.test.js` ⚠️ 本地命令偶发挂起（已记录，不作为本轮通过证据）

### 相关文档

- Feature: `docs/features/F046-anti-drift-protocol.md`
