# Review Request: F194 Phase Z8 Spike — projection contract design alignment

Review-Target-ID: f194-phase-z8-spike
Branch: feat/f194-phase-z8
Commit: 4b89182c2

## What

Z8 是给 Z1-Z7 7 轮 patch 画句号的 contract 层修法。Spec 已 push 到 main (`cdc96d43e`)，KD-27 拍板 top-down 统一 canonical bubble projection。

Spike 第 1 阶段已落:
- `bubble-projection.ts` 纯函数 `projectCanonicalBubbles({ records })`
- `__fixtures__/z8-alpha-3-records.json` 直接来自 runtime API alpha 真实 thread `thread_moyfjyjc0662weit` opus invocation `2fe279aa` (2 stream + 1 callback)
- 5 RED→GREEN tests，含 R12 root case

**遇到 contract 边界问题，需要砚砚审定后才能继续 AC-Z21 integration。**

## Why need review now

我先尝试在 `applyBubbleEventWithRecovery` (useAgentMessages.ts:78) wrap projection — RED test 跑过了，但 broader regression 撞到 1 个既有 test：

`useAgentMessages-background.test.ts > B1.8: bg final stream chunk finalizes assistant_text NOT thinking when both coexist`

测试场景：
- 预置 2 raw records 同 invocationId `inv-coexist`：
  - `msg-inv-coexist-opus-thinking` (thinking only, isStreaming=true)
  - `msg-inv-coexist-opus` (text only, isStreaming=true)
- 发 final text stream chunk → reducer finalize text bubble
- 断言：thinking bubble 仍 streaming，text bubble finalized

Z8 projection 把这 2 records collapse 成 1 bubble (canonical id = text id by lex order tie-break)，导致 `find(thinkingBubble)` 返回 undefined → assertion fail。

## 设计 OQ — 请砚砚拍板

**OQ-1: thinking + assistant_text 同 invocation 是 1 bubble 还是 2？**

ADR-033 OQ-A 之前没明确收敛。Z5 R5 我加了 `event.bubbleKind !== 'system_status'` gate 让 thinking 能 absorb empty placeholder，暗示 1 bubble 含 thinking + text 子字段。但 B1.8 测试坚持 2 bubble (thinking 独立)。

铲屎官 18:12 截图显示"opus46 变成两个" + "F5 后正常"，意味着用户期望 1 bubble。

**我的判断**：collapse 1 bubble + bubble.thinking 字段 + bubble.content 字段共存 = 跟 ADR-033 sub-event 共存语义一致 + 跟铲屎官期望一致。B1.8 测试断言需要更新成"1 bubble has thinking AND content fields"。

**OQ-2: isStreaming projection 规则**

当前 contract: `isStreaming = ANY raw record.isStreaming === true`。

B1.8 finalize-text-only 后：text record finalized, thinking record 仍 streaming → projection = streaming (any true)。但用户语义可能是"text 部分完成了 = bubble 完成了"。

**我的判断**：bubble streaming = 是否有 callback final OR all stream records finalized。需要 callback 或 done event 触发 finalized 状态。这个比 ANY/ALL 都更准。

**OQ-3: AC-Z21 integration point**

我现在尝试在 `applyBubbleEventWithRecovery` 包了一层 projection。但 reducer 内部已经做了大量 stable-key match + placeholder absorption 逻辑（Z5/Z6/Z7 累积），projection 在外层再 collapse 可能有 race。

更好的方案可能是：
- (A) **wrapper-only**: 现有方案，每 event 后做 projection（简单但可能 thrash bubble id）
- (B) **rewrite reducer**: maintain raw records buffer，每 event 进 buffer 后 re-project（彻底但破坏 reducer 7 轮 patch 投资）
- (C) **post-store transform**: store layer 做 derived selector，messages 暴露给 UI 时投影；store 内部仍是 raw（最优但需改 selector pattern）

请砚砚就 OQ-1 / OQ-2 / OQ-3 三个边界判定。审完我继续 AC-Z21 + AC-Z22 + AC-Z23。

## Architecture Ownership

Architecture cell: `bubble-pipeline`
Map delta: none
Why: spike 阶段只新加 `bubble-projection.ts` (pure 函数，无 store 耦合)，未碰 reducer / store / hydrate。

## Open Questions（OQ-1 / OQ-2 / OQ-3 见上）

## Next Action

请砚砚审 OQ-1 / OQ-2 / OQ-3 + projection 函数实现 (`bubble-projection.ts`) + alpha fixture 测试 (`bubble-projection.test.ts`)。审完我按你的 verdict 推进 integration。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f194-phase-z8/codex`
- Files: 3 new (projection + fixture + tests)，未改 reducer / store / hydrate

## 自检证据

- 5/5 projection tests pass (含 R12 alpha replay)
- 67/67 bubble-reducer tests still pass (未碰 reducer)
- 73/73 useAgentMessages-background tests pass (revert wrapper integration 后)

## 相关文档

- Spec: `docs/features/F194-invocation-liveness-canonical-read-model.md` Phase Z8 section
- Decision: KD-27 (top-down projection contract)
- Code: `packages/web/src/stores/bubble-projection.ts`
