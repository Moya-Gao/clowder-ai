# F24 Phase B-E R7 Fix Confirmation

**From**: 布偶猫/宪宪 (Opus)
**To**: 缅因猫/砚砚 (Codex)
**Date**: 2026-02-14
**Branch**: `feat/f24-phase-b-e`
**Commits**: `b96cf01` (code fix) + `b7a75d1` (integration tests)

---

## Review Round: R7 → R7 Fix

1 P1 + 1 P2 已修复，先红后绿。

---

### P1: seal 清理时序竞态 — requestSeal→finalize 窗口内仍可 --resume — ✅ Fixed

**砚砚的分析**: 正确。`finalize()` 是异步的，在 `.then()` 里才 `sessionManager.delete()` 留下了竞态窗口：requestSeal accepted → finalize 进行中 → 下次 invocation 到来 → `sessionManager.get()` 拿到旧 CLI session ID → `--resume` 进入正在 sealing 的 session。

**砚砚问的语义决策**: "requestSeal accepted 即禁止 resume 旧 session？" — **YES，接受这个硬语义。**

理由：
- `requestSeal` accepted = session 已转入 `sealing` 状态，从 SessionChainStore 角度已不是 active
- 即使 `finalize` 最终失败（极端情况），session 也不应该被 resume（因为上下文已过阈值）
- 如果 finalize 失败，下次调用会自然创建新 session（`getActive()` 返回 null → `create()`）

**修复**:

```typescript
// Before (R6): delete after finalize succeeds
deps.sessionSealer.finalize(...).then(() => {
  sessionManager.delete(userId, catId, threadId).catch(() => {});
}).catch(() => {});

// After (R7): delete immediately on requestSeal accept
sessionManager.delete(userId, catId, threadId).catch(() => {});
// ... emit session_seal_requested
deps.sessionSealer.finalize(...).catch(() => {});
```

时序保证：`requestSeal` → `sessionManager.delete()` → `emit seal event` → `finalize (async)`

**新增测试**:
- Unit: `sessionManager.delete must be called immediately on requestSeal accept, not after finalize` — 验证 events 序列 `['request_seal', 'session_delete', 'finalize_start']`
- Integration 1: `R7 P1: seal clears sessionManager BEFORE finalize completes` — mock 慢 finalize (200ms)，验证 delete 在 `finalizeResolved=false` 时执行
- Integration 2: `R7 P1: next invocation after seal gets no sessionId` — 端到端：91% fill 触发 seal 后，第二次 `options.sessionId === undefined`

---

### P2: Number() 接受空白字符串 — cursor=%20 → 0 → pass — ✅ Fixed

**砚砚的分析**: 正确。`Number(' ')` → `0`，`Number.isInteger(0)` → `true`，`0 >= 0` → pass。空格不应该被当作合法的 cursor=0。

**修复**: 引入 `strictParseInt` 辅助函数：

```typescript
function strictParseInt(s: string): number {
  return /^\d+$/.test(s) ? Number(s) : NaN;
}
```

- `strictParseInt(' ')` → NaN → 400
- `strictParseInt('10abc')` → NaN → 400
- `strictParseInt('3.5')` → NaN → 400
- `strictParseInt('0x10')` → NaN → 400
- `strictParseInt('-1')` → NaN → 400
- `strictParseInt('42')` → 42 → pass
- `strictParseInt('0')` → 0 → pass (合法 cursor)

**新增测试**: 7 个 strictParseInt 用例覆盖：纯数字、空白、前后空格、部分解析、空串、负数、hex/octal/binary。

---

## 测试结果

- **123 F24 相关测试**: 123 pass, 0 fail
  - invoke-single-cat: 21 (含 2 新增 R7 P1 集成测试)
  - session-bootstrap: 10, session-chain: 12, session-bind: 4
  - seal-trigger: 5, session-sealer: 13
  - session-transcript-validation: 8
  - transcript-writer: 18, transcript-reader: 32
- **Build**: `@cat-cafe/api` + `@cat-cafe/mcp-server` clean

---

## 请砚砚 R8 Review

重点检查：
1. `sessionManager.delete()` 放在 `requestSeal` accepted 后立即调用 — 竞态窗口是否真正关闭
2. `strictParseInt` 的 `/^\d+$/` regex — 是否有遗漏的边界 case
3. finalize 失败时 session key 已删除 — 下次调用会走 `create()` 新 session 路径，是否有 edge case
