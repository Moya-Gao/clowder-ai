---
title: "Review Request: F246 Phase B"
feature: F246
type: review-request
date: 2026-06-20
author: opus
---

# Review Request: F246 Phase B — F193 E3 Cross-Thread Dispatch Adapter

Review-Target-ID: f246-phase-b
Branch: feat/f246-phase-b

## What

F193 E3 cross-thread dispatch `assign_work` approval integration into the Approval Hub. 9 commits, 21 files changed (+1304/-32), 45 new tests.

Core changes:
1. **DispatchProposal store** — New `IDispatchProposalStore` port + `InMemoryDispatchProposalStore` impl. State machine: pending → approved/rejected with CAS guards.
2. **cross_post_message effectClass interception** — MCP schema gains optional `effectClass` enum. `assign_work` creates a DispatchProposal (held for CVO approval) instead of auto-delivering. fyi/coordinate/investigate auto-deliver unchanged.
3. **Approve/Reject endpoints** — `POST /api/dispatch-proposals/:proposalId/{approve,reject}` with CVO auth (ownerUserId) + CAS guards.
4. **F193ApprovalAdapter** — Maps DispatchProposals to ApprovalItems (3-day stale threshold).
5. **Hub integration** — F193 card in ApprovalItemCard.tsx with green "Dispatch" badge + inline approve/reject buttons. approvalHubStore gains approveProposal/rejectProposal actions.
6. **Receiving-side invariant** — effectClass carried through Redis round-trip → SystemPromptBuilder injects behavior constraints (fyi=read-only, coordinate=discuss-only, investigate=analyze-only). assign_work = full authority.
7. **Effect-class boundary tests** — 11 fixture tests proving the AC-B2/AC-B4 matrix.

## Why

Phase B of F246 (Approval Hub). Phase A merged as PR #2449 (F128 + F225 adapters). Phase B adds F193 E3 — the cross-thread dispatch effect-class matrix that determines whether a cross-post requires CVO approval (assign_work) or auto-delivers (fyi/coordinate/investigate).

## Original Requirements（必填）

> 铲屎官原话（2026-06-20）：
> "要是我没看thread呢？ 或者是我在thread a 但是b的猫找我审批呢？"
> "现在f128 和 f225 都有富文本需要我审批的东西笑死但是很多猫可能反馈铲屎官忘记点了！"
> "我感觉这种thread内的点击审批似乎需要有个event中心。。能让我看到 点击跳转到对应thread等等等"

- 来源：`docs/features/F246-approval-hub.md` Why section
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题** — Phase B 让 assign_work 类跨线程派遣进入 Hub 审批，同时不阻塞 fyi/coordinate/investigate 类自动投递

## Tradeoff

- **InMemory store (not Redis)** — Phase A 的 F128/F225 adapter 也用 InMemory store。Redis impl 是 Phase C 候选，v1 足够（重启后数据丢失可接受——pending proposals 有 3 天 stale 阈值）
- **effectClass 可选参数** — 向后兼容：省略 effectClass = 现有行为（自动投递）。不强制所有 cross_post_message 声明 effectClass

## Architecture Ownership（必填）

Architecture cell: `platform-infra` (subcell: `approval-index`)
Map delta: none
Why: 扩展 Phase A 已建立的 Hub 基础设施（新增 1 adapter + 1 store + 1 route group），不改变 cell 边界

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- 新增的 `IDispatchProposalStore` / `F193ApprovalAdapter` / `dispatchProposalRoutes` 是否在 Phase A 已有的 `approval-hub/` 目录结构内
- 无并行架构元素（无新 Queue/Router/Dispatcher/Binding）

## Open Questions

### 技术 OQ（给 reviewer）

1. **effectClass Redis round-trip 安全性** — `redis-message-parsers.ts` 用 `Set` 校验 + `as` cast 保持 literal union。是否足够安全，还是需要 Zod runtime validation？
2. **approve endpoint 消息投递** — 当前 approve 成功后 store 记录 `deliveredMessageId = 'placeholder-...'`，实际消息投递逻辑需要在 Phase C 补全（connect to actual cross_post delivery path）。这个 placeholder 是否应该在 Phase B 就完成？
3. **SystemPromptBuilder constraint 文案** — 三种 non-assign effect-class 的行为约束文案是否足够清晰？是否需要铲屎官审核用词？

### 价值 OQ（给 CVO）

无 — Phase B 所有设计决策由 Phase A KDs + Phase B ACs 确定，无需 CVO 判断

## Next Action

请 review 代码质量、AC 覆盖、effectClass 边界正确性。特别关注：
- AC-B4 receiving-side invariant 的 SystemPromptBuilder 注入逻辑
- callbacks.ts 中 assign_work 拦截路径的正确性
- 前端 F193 卡片渲染 + approve/reject 按钮交互

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f246-phase-b/gpt52`
- Start Command: `pnpm review:start`
- Ports: reviewer 按标准沙盒流程启动

## 自检证据

### Spec 合规

Quality Gate Report 通过（本轮）：
- AC-B1 ✅ assign_work → Hub 可见
- AC-B2 ✅ fyi/coord/invest → no ApprovalItem (11 fixture tests)
- AC-B3 ✅ effectClass by sender (MCP schema Zod enum)
- AC-B4 ✅ Receiving-side invariant (SystemPromptBuilder constraint injection)

### 测试结果

```
pnpm test → 4411 pass, 0 fail ✅
pnpm lint → 0 errors ✅
pnpm check → 0 errors ✅ (biome)
pnpm -r --if-present run build → exit 0 ✅
pnpm --filter @cat-cafe/shared test → 51/51 pass ✅
```

### 新增测试清单（45 tests）

| Test File | Tests |
|-----------|-------|
| dispatch-proposal-types.test.ts | 7 |
| dispatch-proposal-store.test.js | 14 |
| f193-approval-adapter.test.js | 5 |
| dispatch-proposal-routes.test.js | 8 |
| effect-class-boundary.test.js | 11 |

### 相关文档

- Plan: `docs/plans/2026-06-20-f246-phase-b-f193-dispatch-adapter.md`
- Feature: `docs/features/F246-approval-hub.md` (Phase B section)
- Discussion: `docs/discussions/2026-06-20-unified-approval-hub-pain-points.md`
