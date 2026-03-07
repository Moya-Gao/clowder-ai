---
feature_ids: [F081]
topics: [antigravity, smoke-test, review]
doc_kind: mailbox
created: 2026-03-07
---

# Review 请求: F081 Antigravity Smoke 热修（to Opus）

## What
- 把 `antigravity-smoke` 从默认 `packages/api` 测试路径里隔离成显式 opt-in，避免所有猫一跑默认测试就被 `:9000` 上的 Antigravity 绊倒。
- 修正 `AntigravityCdpClient.pollResponse()` 的完成判定与 DOM 读取逻辑，解决“Antigravity 实际已经回了，但 smoke 读不到”的误判。
- 补齐 smoke harness cleanup，确保失败路径也会 `disconnect()`，不再留下沉默活口。
- 顺手把 `Input.enable` 缺失兼容成非致命协议漂移。

## Why
- 铲屎官明确指出：`Antigravity` 这条线一天不修，跑测试时不止布偶猫，所有猫都会被绊倒。
- 现场证据已经确认：模型其实回了 `pong`，真正挂住的是我们自己的 `pollResponse()` 逻辑和默认 smoke 参战策略。
- 这波是止血热修，目标是先恢复默认测试链路稳定性，再继续追 `F081` 的主嫌 `rehydrate/replace`。

## Original Requirements
> “保证其他大猫猫不要跌倒了！”
>
> “一天不修复 他们一跑测试 不止是布偶猫 是所有猫猫都绊倒”
- 来源：当前对话，已沉淀进 [F081-bubble-continuity-observability.md](../features/F081-bubble-continuity-observability.md)
- 请对照上面的摘录判断：这波热修是否已经把“默认测试不会再被 Antigravity 烟雾测试绊倒”这个目标真正落地

## Tradeoff
- 采用“默认 skip + 显式 smoke 脚本”的隔离策略，而不是让默认套件继续隐式探测 `:9000`。
- `pollResponse()` 现在基于真实 DOM 线程读取 assistant turn，并要求连续两轮稳定文本后返回；这会多等一轮轮询，但能避免拿到流式半截文本。
- 这次没有顺手修掉 `@cat-cafe/api test` 里另外 3 个无关现有红测，避免把热修 scope 扩大。

## Open Questions
1. `pollResponse()` 现在对齐了当前 Antigravity DOM；你帮我看看这层选择器是否还需要再加一道更稳的 fallback。
2. 你是否同意把 `test:antigravity-smoke` 作为唯一显式入口，默认 `pnpm test` 永久不再隐式探测 `:9000`。
3. `F081` 新增的 `Codex app bind` 证据，我先记在 spec 里了；你看要不要把它单独拆成一个更明确的 bind/hydration 子问题。

## Next Action
- 请帮我 review 这波 Antigravity 热修。
- 如果你放行，我就走 merge-gate，把这条止血补丁尽快合进 `main`，然后开新 worktree 继续抓 `rehydrate/replace` 的主嫌。

## 自检证据

### Spec 合规
| # | 要求 | 状态 | 说明 |
|---|---|---|---|
| 1 | 默认测试不再被 `antigravity-smoke` 误伤 | ✅ | `test/antigravity-smoke.test.js` 默认立即 skip |
| 2 | 显式 smoke 仍可单独验收 | ✅ | `pnpm run test:antigravity-smoke` 2 case 绿 |
| 3 | 失败路径不留 CDP 活句柄 | ✅ | harness 改成 `try/finally disconnect()`，并有单测锁定 |
| 4 | `pollResponse()` 能读到真实 assistant 回复 | ✅ | live DOM 已证实 `pong` 存在；新增单测锁定完成判定与 inline loading 行为 |

### 测试结果
```bash
node --test test/antigravity-smoke-harness.test.js
# 6 passed

node --test test/antigravity-cdp-client.test.js test/antigravity-agent-service.test.js
# 22 passed

node --test test/antigravity-smoke.test.js
# skip by default (RUN_ANTIGRAVITY_SMOKE=true not set)

pnpm run test:antigravity-smoke
# 2 passed
```

### 全包状态说明
```bash
pnpm --filter @cat-cafe/api test
# 2857 passed, 3 failed
```
- 这 3 个失败落在：
  - `test/agent-router.test.js`
  - `test/invoke-single-cat.test.js`（2 个 case）
- 它们与本轮 Antigravity 热修改动文件无直接交集，是当前 branch 上的既有红测；本次 review 请聚焦 Antigravity 相关改动。

### 相关文档
- Feature: [F081-bubble-continuity-observability.md](../features/F081-bubble-continuity-observability.md)
- Bug report: [bug-report.md](../bug-report/antigravity-smoke-stall/bug-report.md)
- Plan: [2026-03-07-antigravity-smoke-remediation.md](../plans/2026-03-07-antigravity-smoke-remediation.md)
- Branch: `codex/f081-bubble-continuity-observability`
- Head: `c7594baa`（后续若有新提交，以最新 head 为准）
