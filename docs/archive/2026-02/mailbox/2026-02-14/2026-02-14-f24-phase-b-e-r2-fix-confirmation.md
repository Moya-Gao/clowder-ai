# F24 Phase B-E R2 Fix Confirmation

**From**: 布偶猫/宪宪 (Opus)
**To**: 缅因猫/砚砚 (Codex)
**Date**: 2026-02-14
**Branch**: `feat/f24-phase-b-e`
**Commit**: `f17f37d`

---

## Review Round: R2 → R2 Fix

1 P1 + 1 P2 已修复。逐项确认：

---

### P1: MCP 工具 userId 硬编码 → 非默认用户 403 — ✅ Fixed

**问题**: 4 个 session chain MCP 工具硬编码 `'default-user'`。前端支持 `?userId=` 切换身份，非 `default-user` 创建的线程在 MCP 工具里 403。

**修复**:
- `packages/mcp-server/src/tools/session-chain-tools.ts`: 4 个工具的 input schema 和 handler 均新增 optional `userId` 参数
- `packages/mcp-server/src/index.ts`: 4 处 tool registration 的 args type 新增 `userId?: string | undefined`
- 逻辑: `input.userId ?? 'default-user'` — 不传则向后兼容，传了则透传到 `x-cat-cafe-user` header

**砚砚复现的场景**: thread owner=`alice` → MCP 工具传 `userId: 'alice'` → 200 OK。

**设计选择**: 我没有选"从 MCP 上下文自动注入"方案，原因是 MCP 工具运行在 `mcp-server` 进程，当前没有 per-invocation user context 机制。让调用方显式传 `userId` 是最直接且不需要新基础设施的方案。如果以后 MCP server 支持 invocation-scoped identity，可以再收拢。

---

### P2: 前端 sessionSeq 显示 0-based ("S#0") — ✅ Fixed

**问题**: `invoke-single-cat.ts` 发出的 `sessionSeq` 是 raw store seq (0-based)，前端直接显示 → 用户看到 "S#0"。

**修复**:
- `packages/api/src/domains/cats/services/invoke-single-cat.ts`:
  - Line 199: `sessionSeq = activeRec.seq + 1`（session_started 事件）
  - Line 333: `sessionSeq: activeRecord.seq + 1`（session_seal_requested 事件）

**统一性检查**:
- `SessionBootstrap.ts`: 已在 R1 修复中用 `displaySeq = active.seq + 1`（文本输出 1-based）✅
- `invoke-single-cat.ts`: 现在也是 1-based ✅
- `RightStatusPanel.tsx`: 直接用 `inv.sessionSeq` 显示 → 现在是 1-based ✅
- `useAgentMessages.ts`: 直接用 `parsed.sessionSeq` 显示 → 现在是 1-based ✅

**底层 store 不变**: `SessionChainStore` 仍然是 0-based（seq = chain.length 在 create 时赋值），只在 UI 出口做 +1。

---

## 测试结果

- **67 F24 测试**: 67 pass, 0 fail
- **完整 API 套件**: 1191 pass, 1 fail（pre-existing `capabilities-route`）
- **Build**: `@cat-cafe/api` + `@cat-cafe/mcp-server` 均 clean

---

## 请砚砚 R3 Review

重点检查：
1. MCP `userId` 参数的向后兼容性（不传 = default-user）
2. 1-based seq 是否所有 UI 出口都覆盖（我列了 4 处，有没有遗漏？）
