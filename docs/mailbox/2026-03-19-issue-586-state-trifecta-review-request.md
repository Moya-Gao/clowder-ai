# Review Request: Issue #586 — 前端状态三连击修复

Review-Target-ID: issue-586
Branch: fix/issue-586-state-trifecta

## What

修复三个关联的前端状态 bug：
1. **气泡裂变** — callback-before-stream 竞争导致同一条消息裂成两个 bubble
2. **猫状态不准** — `clearCatStatuses` 不清 `catInvocations`，右上角状态面板显示错误
3. **未读点复活** — 10s 抑制窗口过期后，后端 stale unread count 覆盖前端已清零的状态

5 files changed, 98 insertions(+), 17 deletions(-).

## Why

这三个 bug 是铲屎官持续反馈的前端体验痛点。三猫（Opus / 金渐层 / GPT-5.4）独立诊断后交叉验证，确认了根因。F081 写路径审计盘清了 104 个写入点，F123 压住了高频症状，但 TD111-TD114 的结构性防御层尚未落地。本次修复是 TD112 的部分实现 + Bug 2/3 的针对性修复。

## Original Requirements（必填）

> "前端气泡还是会同一条消息裂变成两个"
> "右上角这个猫猫状态一直处于不准确的状态"
> "左边 thread 这里，比如我度过其中一个了，那个已经跑完了，但是可能我点到其他线程后点点又冒出来了"
- 来源：thread_mmyc3w45i187aype, 铲屎官 2026-03-19 20:25
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Bug 1 做了 hook 层修复（`replacedInvocationsRef` 在 callback-creates-new-bubble 路径上也设置），没做完整的 store 级 `(catId, invocationId)` 唯一性约束（TD112 全量实现）。选择理由：hook 层修复已覆盖主要竞争路径，store 级 invariant 侵入面大，留给后续单独 PR。
- Bug 3 改为 `Infinity` 永久抑制 + ack-driven 清除，而非延长窗口时间。更正确但稍有风险：如果 ack POST 永远不返回（网络断开），抑制会永久存在。评估风险低：用户下次进入 thread 会触发新的 clearUnread + ack 链路。

## Open Questions

1. **Bug 1 后台 fallback**：`findBackgroundCallbackReplacementTarget` 新增的 invocationless placeholder 匹配是否可能误匹配？（使用了 `isStreaming && !invocationId` 双重过滤，风险低）
2. **Bug 2 `clearCatStatuses` 改为 stateful**：原来是 plain `set()`，现在遍历 `catInvocations`。性能影响？（catInvocations 通常 ≤8 entries，negligible）
3. **Bug 3 ack 失败场景**：POST /read/latest 失败时抑制永久存在，下次进入 thread 重新触发 clearUnread → 新的 Infinity 抑制 → 新的 ack。链路闭环但值得 reviewer 确认

## Next Action

请 review 代码变更，重点关注上述 3 个 open questions。

## 自检证据

### Spec 合规
Issue #586 的三个 bug 逐项修复，每个 bug 都有对应代码变更和测试覆盖。

### 测试结果
```
pnpm --filter @cat-cafe/web test  # 227 pass, 1 fail (pre-existing game test)
pnpm --filter @cat-cafe/web lint  # 0 errors
pnpm biome check (changed files)  # 0 errors, 15 warnings (pre-existing)
```

### 新增测试
`issue-586-state-trifecta.test.ts` — 11 个回归测试
`chatStore-multithread.test.ts` — 更新 1 个测试（10s → ack-driven）

### 相关文档
- Issue: https://github.com/zts212653/cat-cafe/issues/586
- 审计文档: `docs/features/F081-write-path-audit.md`
- 正确性 spec: `docs/features/F123-bubble-runtime-correctness.md`
- Tech Debt: `docs/TECH-DEBT.md` TD111-TD114

---
Author: 宪宪/Opus [布偶猫/Opus-46🐾]
