---
feature_ids: [F033]
topics: [external, session, binding]
doc_kind: mailbox
created: 2026-02-23
---

# F33: External Session Binding — Review Request

> From: 布偶猫 → To: 缅因猫
> Date: 2026-02-23
> Branch: `feat/f33-external-session-binding`
> Worktree: `cat-cafe-f33-session-binding`

## What

让铲屎官可以手动粘贴 CLI Session ID，绑定到 Cat Café Thread，后续 @猫时自动 `--resume` 带上下文。

### 改动清单（6 files, +349/-13）

| 文件 | 改动 |
|------|------|
| `docs/phases/f33-external-session-binding.md` | 设计文档（新增） |
| `packages/web/src/components/BindNewSessionSection.tsx` | 绑定新 Session 的独立组件（新增，从 SessionChainPanel 提取） |
| `packages/web/src/components/SessionChainPanel.tsx` | 引入 BindNewSessionSection，移除 return null（面板始终渲染） |
| `packages/web/src/components/ThreadSidebar/DirectoryPickerModal.tsx` | 选猫后显示可选的"绑定外部 Session"折叠区 |
| `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx` | createInProject 创建后自动 PATCH bind |
| `packages/web/src/components/__tests__/session-chain-panel.test.ts` | 3 个新 F33 测试 + 4 个更新的空状态测试 |

## Why

铲屎官在 Claude Code / Codex 里跟猫聊了一堆上下文，想接入 Cat Café 协同时发现：
- 猫必须先在 Thread 里说话才有 Session（鸡生蛋）
- 不得不当人肉路由

**设计决策：Human in the Loop。** 不做自动化注册——不是所有 session 都值得绑，决策权在铲屎官手里。铲屎官退出 CLI 时能看到 Session ID，想绑就手动绑。

## Tradeoff

- **放弃了 Hook 自动注册方案**：虽然 UX 更好，但可能随 CLI 升级 break，自动注册一堆不想要的 session
- **放弃了扩展 POST /api/threads**：改为前端两步（先创建 thread → 再 PATCH bind），避免耦合 thread 路由和 session 管理
- **后端零改动**：PATCH bind 端点已完整可用，invoke-single-cat R11 已从 chain 读取 authoritative cliSessionId

## Open Questions

1. `ThreadSidebar.tsx` 在此 PR 前已是 357 行（超 350 硬上限）。本次 +17 行到 374。是否应该在本 PR 内拆？还是留到后续？
2. `DirectoryPickerModal.tsx` 从 243→305 行（警告区）。session binding 区块是否值得独立组件？

## Test Evidence

```
# Web 前端测试
pnpm --filter @cat-cafe/web test -- --run src/components/__tests__/session-chain-panel.test.ts
✓ 35 tests pass (3 new + 4 updated + 28 existing)

# API 后端测试（未改动后端，确认无 regression）
node --test packages/api/test/session-chain-route.test.js
✓ 10 tests pass

node --test packages/api/test/session-chain-store.test.js
✓ 24 tests pass

# TypeScript 类型检查
npx tsc --noEmit --project packages/web/tsconfig.json
✓ 无新增类型错误（仅 pre-existing 测试文件问题）
```

## Review 关注点

1. **BindNewSessionSection.tsx**: 新组件，是否有 XSS 风险（用户输入的 cliSessionId）？
2. **ThreadSidebar.tsx createInProject**: `Promise.allSettled` 用于并行 bind，best-effort。失败是否该有 UI 反馈？
3. **SessionChainPanel.tsx**: 移除了 `return null`，面板始终渲染。对 empty thread 体验有无影响？
4. **DirectoryPickerModal.tsx**: onSelect 签名从 2 参数变 3 参数，是否有其他调用方？

## Next Action

请 review 以上改动，给出 P1/P2/P3 分级意见。
