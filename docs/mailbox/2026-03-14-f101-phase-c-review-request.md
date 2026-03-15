# Review Request: F101 Phase C — 狼人杀可用性修复

## What

Phase C 修复铲屎官 2026-03-14 实测发现的三个致命问题：

1. **AC-C1**: TopBar 加关闭/返回按钮 — 用户可退出游戏回到聊天界面
2. **AC-C2**: GameLobby 大厅组件 — 选板子（6/7/8/9/10/12人局）+ 配置参赛猫 + 确认开始
3. **AC-C3**: GameAutoPlayer 循环 — 驱动猫猫夜间技能 + 白天投票，游戏可推进

5 commits on `feat/f101-phase-c`:
- `d56ebea6` fix(F101): add close/back button to game TopBar (AC-C1)
- `e8badc56` feat(F101): add game lobby for board preset + cat selection (AC-C2)
- `ed6e260c` feat(F101): add GameAutoPlayer loop for AI cat auto-actions (AC-C3)
- `29530e2b` docs(F101): mark AC-C1/C2/C3 as done
- `ab4df477` style(F101): fix biome formatting

## Why

F101 在 2026-03-12 声称 done 并通过愿景守护，但铲屎官实际启动 dev 点开狼人杀后发现完全不可用：(1) 无关闭按钮，线程被劫持；(2) 无大厅配置，7猫自动塞入；(3) 猫猫不行动，游戏卡死。92 单元测试绿但零 E2E。教训 LL-032。

## Original Requirements（必填）

> "点击了你这狼人杀，现在这个thread被你劫持了我永远访问不了他们了！"
> "等了一分钟他直接跳成这个，连返回线程的入口都没有！"
> "你得给我进去能选板子，配置参赛猫吧！"
> "禁止出现我点击狼人杀一分钟后才跳转过去的事情"

- 来源：对话历史 2026-03-14 17:20-17:31 铲屎官原话
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Lobby 是纯前端组件，不走后端创建 lobby 实体。选好配置后一次性发 `/game` 命令给后端开局。简单直接，无 lobby 状态持久化。
- GameAutoPlayer 用定时循环轮询而非事件驱动。简单可靠，v2 可优化为事件驱动。

## Open Questions

1. **AC-C4 E2E 验证**：请 reviewer 启动 dev 环境，实际点开狼人杀，走完一局。这是本次最重要的验收——上次就是因为没人真正跑过才翻车。
2. GameAutoPlayer 的轮询间隔（当前 2s）是否合理？
3. GameLobby 的板子描述（角色分配）是否准确反映 WEREWOLF_PRESETS？

## Next Action

1. Review 代码质量
2. **启动 dev 环境做 E2E 验证**（AC-C4）— 点击狼人杀 → Lobby 弹出 → 选板子+猫 → 确认开始 → 游戏推进 → 关闭返回
3. 放行或提 P1/P2

## 自检证据

### Spec 合规

Quality Gate 2026-03-14 18:07 通过。AC-C1/C2/C3 代码完成，测试绿灯，biome 干净。
AC-C4 需 reviewer 做 E2E 验证。

### 测试结果

```
vitest run (game, 14 files)              → 111/111 passed, 0 failed ✅
node --test (backend game, 5 files)      → 39/39 passed, 0 failed ✅
pnpm lint                                → 0 errors ✅
pnpm biome check --diagnostic-level=error → 0 errors ✅
pnpm --filter @cat-cafe/shared build     → exit 0 ✅
```

### 相关文档

- Feature: `docs/features/F101-mode-v2-game-engine.md`
- Lesson: LL-032 in `docs/lessons-learned.md`
- Design: `designs/f101-werewolf-game-ui.pen`（Phase B 设计稿，Phase C 无新增设计）
