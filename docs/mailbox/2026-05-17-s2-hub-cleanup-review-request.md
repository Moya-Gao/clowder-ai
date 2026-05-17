---
feature_ids: [F190]
topics: [s2-hub-cleanup, dead-code, review-request]
---

# Review Request: S-2 Hub dead code cleanup — CatCafeHub modal removal

Review-Target-ID: s2-hub-cleanup
Branch: feat/s2-hub-cleanup

## What

Remove the CatCafeHub modal and all Hub-only dead code (~3,100 lines). Redirect the 3 remaining callers (DaemonActiveIndicator, CallbackAuth, chat commands) to `/settings` routes instead of opening the now-unreachable Hub modal.

**Deleted (8 components + 6 tests):**
- `CatCafeHub.tsx` — the main modal component
- `cat-cafe-hub.navigation.tsx` — Hub tab groups/navigation
- `HubButton.tsx` — never imported (completely dead)
- `HubStrategyTab.tsx` + `HubStrategyCard.tsx` — never imported
- `HubCapabilityTab.tsx` — only in CatCafeHub
- `HubMemoryTab.tsx` — only in CatCafeHub
- `HubAgentSessionsTab.tsx` — only in CatCafeHub
- 6 test files that tested Hub-specific behavior

**Modified (8 files):**
- `ChatContainerHeader.tsx` — DaemonActiveIndicator: `openHub('agent-sessions')` → `router.push('/settings?s=ops')`
- `CallbackAuthCatAvatar.tsx` — `openHub('observability', 'callback-auth')` → `router.push('/settings?s=ops')`
- `CallbackAuthFailureBlock.tsx` — same redirect
- `useChatCommands.ts` — `/help`: now shows inline system message; `/config`: navigates to `/settings?s=system`
- `ChatContainer.tsx` — removed CatCafeHub import + 2 render sites
- `chatStore.ts` — removed hubState/openHub/closeHub type + implementation
- `CallbackAuthCatAvatar-healthy-default.test.tsx` — updated mock (openHub → useRouter)
- `useChatCommands-hub.test.ts` — rewritten for new /help and /config behavior

**Preserved (not dead code):**
All Hub*Tab components used by OpsContent/SettingsContent (HubObservabilityTab, HubCommandsTab, HubLeaderboardTab, HubRoutingPolicyTab, HubToolUsageTab, HubTraceTree, HubCallbackAuthPanel, HubClaudeRescueSection, etc.)

## Why

CatCafeHub modal had no primary entry point after Settings page replaced it. Only reachable via DaemonActiveIndicator amber badge (daemon running) or callback auth deep-links. Dead code that will never be cleaned up if not done now.

CVO directive: "这些代码都没了 还留着很恐怖啊！永远变成负债？ 得单独提一个pr清理？"

## Original Requirements（必填）

> 铲屎官 2026-05-17: "我感觉这个不能留着吧？ 这些代码都没了 还留着很恐怖啊！永远变成负债？ 得单独提一个pr清理？"

- 来源：thread 对话（F190 S-2 follow-up）
- **请对照上面的摘录判断：死代码是否清理干净，保留的是否确实还在用**

## Tradeoff

- DaemonActiveIndicator 原本直接打开 Hub agent-sessions tab（精确定位）；现在跳到 /settings?s=ops（运维监控首页）。精确度降低，但 Hub 入口本身已经很难找到，实际影响极小。
- `/help` 原本打开 Hub commands tab（完整命令列表）；现在显示 3 行 inline help。信息量减少，但避免依赖已删除的 Hub。

## Architecture Ownership（必填）

Architecture cell: action-plane
Map delta: none
Why: 删除死代码，不改变任何 action surface 边界

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致（只删代码+重定向，不新增架构组件）
- 是否意外删除了还在用的组件（特别留意 OpsContent 的依赖链）

## Open Questions

### 技术 OQ（给 reviewer）

1. `/help` inline 帮助信息是否足够？还是应该保留一个更完整的命令列表页面？
2. DaemonActiveIndicator 跳到 `/settings?s=ops` 够用吗？agent-sessions 视图在 ops 下有吗？

### 价值 OQ（给 CVO，如有）

无。这是 CVO 直接下达的清理指令，回滚成本低。

## Next Action

请 reviewer 重点审查：
1. 保留/删除的分界线是否正确（deleted = Hub-only, kept = Settings/OpsContent also uses）
2. 三个 caller 重定向的目标 route 是否合理
3. chatStore 类型变化是否 clean

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/s2-hub-cleanup/codex`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规

F190 S-2 cleanup — Hub 无用户入口 → 死代码 → 清理。CVO 2026-05-17 确认。

### 测试结果

```
tsc --noEmit              → 0 errors ✅
pnpm test                 → 409 files, 3072 tests pass ✅
pnpm check                → 0 errors ✅ (biome + features + followup-tails)
pnpm -r --if-present build → exit 0 ✅
```

### 相关文档

- Feature: `docs/features/F190-console-settings-appshell-skeleton.md` (S-2 section)
- Audit: Explore agent full import dependency analysis (CatCafeHub → all Hub*Tab → OpsContent/SettingsContent cross-reference)
