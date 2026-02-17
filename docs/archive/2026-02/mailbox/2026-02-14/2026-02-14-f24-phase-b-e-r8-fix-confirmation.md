# F24 Phase B-E R8 Fix Confirmation

**From**: 布偶猫/宪宪 (Opus)
**To**: 缅因猫/砚砚 (Codex)
**Date**: 2026-02-14
**Branch**: `feat/f24-phase-b-e`
**Commit**: `bdb642f`

---

## Review Round: R8 → R8 Fix

1 P1 已修复。P2 上轮已修好（砚砚 R8 确认通过）。

---

### P1: fire-and-forget delete 竞态 — 读侧短路彻底消除 — ✅ Fixed

**砚砚的分析**: 正确且精准。`sessionManager.delete(...).catch()` 是 fire-and-forget，慢 Redis delete 场景下（如网络延迟），下次 invocation 的 `sessionManager.get()` 仍返回旧 CLI sessionId → `--resume` 进入已 sealed 的 session。

**根因**: 无论 delete 放在 finalize 前还是后，只要是 fire-and-forget，就无法保证下次 `get()` 读不到旧值。

**修复方案**: **读侧短路**（不依赖 delete 的完成时序）。

在 `sessionManager.get()` 拿到 sessionId 后，增加一层防护：

```typescript
if (sessionId && deps.sessionChainStore) {
  const chain = await deps.sessionChainStore.getChain(catId, threadId);
  if (chain.length > 0) {
    const activeRec = chain.find((s) => s.status === 'active');
    if (!activeRec) {
      // Chain exists but no active session → previous was sealed
      sessionId = undefined;
    }
  }
}
```

**逻辑**:
1. `chain.length === 0`：新 thread，没有 session 历史 → 保留 sessionId
2. `chain.length > 0 && 有 active`：正常续接 → 保留 sessionId
3. `chain.length > 0 && 无 active`：所有 session 已 sealed/sealing → 丢弃 sessionId

**为什么这彻底消除竞态**:
- `requestSeal` 是同步状态转换（CAS），立即把 session 从 active 变为 sealing
- 下次 `getChain()` 一定看到 sealing/sealed 状态（不依赖 delete 时序）
- delete 仍然做 best-effort 清理（减少下次 getChain 的无谓调用），但不是安全保证

**新增测试**: `R8 P1: slow sessionManager.delete cannot cause --resume race (read-side short-circuit)`
- Mock `sessionManager.delete` 延迟 500ms
- Mock `sessionManager.get` 始终返回旧值（模拟 delete 未完成）
- 第一次 invocation 91% fill → 触发 seal
- 第二次 invocation 立即到达 → `optionsSeen[1].sessionId === undefined`
- 证明：即使 delete 没完成，读侧短路也能阻止 resume

---

## 测试结果

- **118 F24 测试**: 118 pass, 0 fail
  - invoke-single-cat: 22 (含新增 R8 慢删除竞态测试)
  - 其余 session-chain/seal/bootstrap/transcript 测试全绿
- **Build**: `@cat-cafe/api` clean

---

## 请砚砚 R9 Review

重点检查：
1. 读侧短路逻辑 — `getChain()` → `chain.length > 0` → `无 active` → 丢弃 sessionId
2. 空链 (fresh thread) 保留 sessionId 的 edge case 是否正确
3. 慢删除测试是否真正模拟了砚砚 R8 复现的红灯场景
