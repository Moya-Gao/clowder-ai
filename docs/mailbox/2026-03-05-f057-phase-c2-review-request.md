# Review Request: F057 Phase C2 — 猫 @ 铲屎官能力

## What
猫猫在 MCP post_message 中写 `@铲屎官` 或 `@user`（行首），后端检测并标记 `mentionsUser`，WS 广播到前端，侧边栏 thread 列表显示 🐾 爪印 + 红色未读 badge。

核心变更：
- `user-mention.ts`: `detectUserMention()` 纯函数（行首检测 + code block 剥离）
- `callbacks.ts`: post-message 路由接入检测 + WS broadcast 携带 `mentionsUser`
- `StoredMessage.mentionsUser`: 新可选字段
- `ThreadState.hasUserMention` + chatStore 追踪/清除
- `ThreadCatStatus`: 🐾 + `bg-red-500` badge（vs 普通 `bg-amber-500`）
- `MiniThreadSidebar`: 同步红色 badge

## Why
F057 AC-C2 最后一块拼图。铲屎官说"你们都不会 at 我呀"，现在猫猫可以 @ 铲屎官了，铲屎官在 thread 列表一眼就能看到哪些 thread 有猫猫找他。

## Original Requirements（必填）
> "你们都不会 at 我呀！其实也应该增加 at 铲屎官"
- 来源：F057 spec `docs/features/F057-thread-discoverability.md` 铲屎官原话（2026-03-04）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- `@铲屎官` 检测只做行首（和猫猫 @mention 规则一致），行中间的不触发
- 没做推送通知/声音——这是视觉提示，推送是后续增量
- 没做消息内容中 @铲屎官 的高亮渲染——AC 只要求 thread 列表高亮

## Open Questions
1. `detectUserMention` 是否需要支持更多 alias（如 `@主人`）？目前只做了 `@user` 和 `@铲屎官`
2. MiniThreadSidebar 的 badge 空间较小，红色是否足够醒目？

## Next Action
请逐文件审查，重点关注：
- `detectUserMention` 的 edge case 覆盖度
- WS broadcast 的 `mentionsUser` 是否可能在某些路径丢失
- ThreadState 的 `hasUserMention` 生命周期是否正确

## 自检证据

### Spec 合规
- AC-C2 ✅: 猫猫能 @ 铲屎官，铲屎官在 thread 列表看到未读高亮
- R6 ✅: "应该增加 at 铲屎官"
- 愿景覆盖度 7/7（全部 AC 已完成）

### 测试结果
```
pnpm --filter @cat-cafe/api build       # exit 0 ✅
API tests (relevant)                     # 85 passed, 0 failed ✅
pnpm --filter @cat-cafe/web test        # 118 files, 711 passed, 0 failed ✅
pnpm lint                               # 0 errors ✅
```

### 相关文档
- Feature: `docs/features/F057-thread-discoverability.md`
- Plan: `docs/plans/2026-03-05-f057-phase-c2-user-mention.md`
- Branch: `feat/f057-c2-user-mention` (4 commits)
