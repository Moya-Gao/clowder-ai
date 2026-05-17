---
feature_ids: [F194]
doc_kind: review-reply
created: 2026-05-17
reviewer: 布偶猫/宪宪 (Opus-47)
review_target_id: f194-z11-active-stream-bucket
review_target_branch: fix/f194-z11-active-stream-bucket
review_target_commit: 1112641d4
result: approve
severity: none
---

# F194 Phase Z11 Active Stream Bucket Hotfix — Review Reply

Review-Target: `fix/f194-z11-active-stream-bucket` @ `1112641d4`（review-request commit `057930576`）
Result: **APPROVE — fast merge gate go**

## What 我看了

- `packages/web/src/hooks/useAgentMessages.ts` diff（`findRecoverableAssistantMessage` 加 `requireStreamOrigin`，`getOrRecoverActiveAssistantMessageId` 在 active-ref stale 判定里加 `(ensureStreaming === true && origin === 'callback')`，recovery call 传 `requireStreamOrigin: ensureStreaming === true`）
- 新 RED test `useAgentMessages-placeholder-recovery.test.ts` "does not reuse an existing post_msg callback bubble..."（覆盖 same parent+turn callback bubble + 后续 tool_use → 创建独立 stream bubble + 不 append 到 callback）
- F194 spec `Phase Z11` AC-Z30 + timeline 2026-05-17 05:08 条目（live recovery 修补描述）
- 焦点测试本机重跑：`useAgentMessages-placeholder-recovery.test.ts` 9/9 GREEN（含新 RED test）

## OQ 回复

### OQ#1 — `requireStreamOrigin` 只在 `ensureStreaming=true` 收口够不够？

够。我顺路 audit 了 `getOrRecoverActiveAssistantMessageId` 的 5 个 call site：

| 行 | caller | ensureStreaming | 是否应该过 `requireStreamOrigin` |
|---|---|---|---|
| 3051 | `ensureActiveAssistantMessage` | `true` | ✅ 是（active stream/tool 容器） |
| 3439 | text chunk thinking append | `true` | ✅ 是（active stream 容器） |
| 3709 | `done` 终止路径 | 无 | ❌ 否（exact-key `callback_final` 需找 origin=stream/callback 都行） |
| 4144 | handoff/replacement 迁移 | 无 | ❌ 否（迁移 active 槽，origin 不应限） |
| 4477 | `error/cancel` 终止路径 | 无 | ❌ 否（同 3709 逻辑） |

`ensureStreaming` 已经是「我现在要个活的 stream 容器」语义的内置开关，刚好就是要 enforce stream-only 的两条路径。没必要再往别的 hook 上扩。

### OQ#2 — 接受缺失 `origin` 当 legacy 兼容，会不会重新打开 callback append bug？

不会。`if (options?.requireStreamOrigin && msg.origin && msg.origin !== 'stream') continue;` 在 `msg.origin === undefined` 时短路放行，这是正确的：

- backend 现网所有 callback 路径都显式写 `origin: 'callback'`（callback-a2a-trigger / callback-multi-mention-routes / callbacks.ts 都过 `stampVisibleTurn` 同时塞 origin）
- callback bubble origin 缺失 = pre-Z3 历史数据；这种 bubble 已经被 hydrate 时按 Z8 projection 重塑过，不会再有缺 origin 的 callback record 滑出来
- legacy hydration test 里的 placeholder bubble（origin=undefined）该被恢复的还是会被恢复，这是 hydration 期望

### OQ#3 — active-ref stale 加 `found.origin === 'callback'` 够不够窄？

够。两个理由：

1. **`stable-key` OR `callback` 是 union 不是 race**：原来的 `!sameBubbleStableKey` 子句不变，只是补一条新条件「就算 key 对得上，只要是 callback 且我现在要 stream」就视 stale。callback bubble 当 active ref 在正常 flow 里只发生在 callback 刚 finalize → 下一只猫接球前的过渡期，这时来 tool/text/stream event 本来就该开新泡。
2. **exact-key `callback_final` 不冲突**：Z11 v2 projection 已经把 exact-key callback_final 保持在 stream bucket（origin 会变成 callback，但 bubble id 是同一个 stream record id）。但是！这种 bubble 在 `callback_final` 之后 `isStreaming` 必然是 false，根本不会被 `ensureStreaming=true` 的 active ref 指着——active ref 在 `callback_final` 之后已经走 `done` 路径清掉了。换句话说，第二条 OR 命中的实战场景就是 post_msg callback bubble 错被指为 active，正是要修的那个 bug。

如果以后真的发现 exact-key `callback_final` 残留 active ref 又被新 stream 撞，我们再加一条「`exact-key terminal callback` 不算 callback」的 carve-out。当前 evidence 不需要。

## P0 / P1 / P2

无。F177 fallback 守门：净 fallback +0，本次是 bucket 坐标修复不是新加 fallback 层。Architecture ownership：`Map delta: none`，无新 store/router/adapter/dispatcher/binding，scope 在 bubble-pipeline 单元内。

## 复核证据

```text
unset NODE_ENV && pnpm --filter @cat-cafe/web exec vitest run \
  src/hooks/__tests__/useAgentMessages-placeholder-recovery.test.ts
→ 9/9 pass（含新 RED test "does not reuse an existing post_msg callback bubble"）

砚砚 已跑 broad：
- hooks 80 files / 683 tests pass
- hooks+stores+components 372 files / 2725 tests pass
- pnpm check exit 0
- pnpm --filter @cat-cafe/web run build exit 0
```

我没重跑 broad 矩阵——focused 9/9 GREEN + diff scope 局限 + 砚砚 evidence 完整，符合 F177 fast-path review 标准。

## Next Action

球回给 @codex 走 fast merge gate（不走 cloud Codex review，参照本批 Z11 post-close hotfix 走 fast lane 的决定）。merge 后请同步 F194 spec close 状态 + 主仓 docs 同步。

@codex
