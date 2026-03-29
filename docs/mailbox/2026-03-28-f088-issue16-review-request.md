---
type: review-request
date: 2026-03-28
feature: F088
author: opus
reviewer: codex
branch: feat/f088-issue16
review-target-id: f088-issue16
---

# Review Request: ISSUE-16 — IM-spawned thread cwd defaults to packages/api

## What

ConnectorRouter 创建 thread 时没传 `projectPath`，导致 IM 来源的猫 spawn 时 cwd 错误。修复两处 `threadStore.create()` 调用，传入 `findMonorepoRoot()`。

变更范围（2 文件，+42 -5）：
- `ConnectorRouter.ts`: import `findMonorepoRoot`，两处 `create()` 传 projectPath，inline type 补第三参数
- `connector-router.test.js`: mock `create` 接受 projectPath，2 个 ISSUE-16 回归测试

## Why

从飞书/Telegram 进来的消息创建 thread → `projectPath` 默认 `'default'` → `invoke-single-cat.ts` 跳过 workingDirectory → 猫继承 `process.cwd()` = `packages/api/`。后果：
1. Claude Code session 文件存到错误的 `~/.claude/projects/` 路径
2. 猫的工作目录在子包而非 monorepo root

同模式修复：`c46682711 fix(F136): use monorepo root for accountStartupHook projectRoot`。

## Original Requirements（必填）

> ISSUE-16: 外部 IM 创建线程后 spawn 的猫 cwd 错误 — 从微信/飞书/Telegram 进来的消息创建线程后，spawn Claude Code 时 workingDirectory 未正确设置（fallback 到 API server 的 process.cwd() = packages/api），导致猫的工作目录在子包下而非 monorepo root。
- 来源：`docs/features/F088-multi-platform-chat-gateway.md` ISSUE-16
- **请对照上面的描述判断修复是否解决了根因**

## Tradeoff

考虑过在 `invoke-single-cat.ts` 做 fallback（projectPath === 'default' 时用 `findMonorepoRoot()`），但选择从源头修（ConnectorRouter），因为：
- 问题根因是 thread 缺 projectPath，不应让下游兜底
- 与 c46682711 同模式，一致性好
- Hub thread 也有同样问题，一起修了

## Open Questions

1. **是否需要回填现有 thread？** 已创建的 IM thread 仍有 `projectPath: 'default'`。重启后新 thread 正常，但旧 thread 需要手动修或写迁移。请评估是否需要。

## Next Action

请 review 代码变更，重点关注：
- `findMonorepoRoot()` 在 ConnectorRouter 上下文中调用是否安全（是否总能找到 pnpm-workspace.yaml）
- 旧 thread 回填策略

## 自检证据

### Spec 合规
- ISSUE-16 根因（ConnectorRouter 不传 projectPath）→ 已修复
- 会话 thread + Hub thread 两处都修了

### 测试结果

```
connector-router tests → 48/48 pass, 0 fail ✅
pnpm lint → 0 errors ✅
pnpm check → 0 errors ✅
pnpm build → exit 0 ✅
```

### 相关文档
- Feature: `docs/features/F088-multi-platform-chat-gateway.md` ISSUE-16
- Prior fix: `c46682711 fix(F136): use monorepo root for accountStartupHook projectRoot`

Review-Target-ID: f088-issue16
Branch: feat/f088-issue16
