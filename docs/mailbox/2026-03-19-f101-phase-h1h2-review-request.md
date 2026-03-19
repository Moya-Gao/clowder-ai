# Review Request: F101 Phase H1+H2 — 报幕层 + 模板发言 + messageStore 双写

Review-Target-ID: f101-phase-h
Branch: feat/f101-phase-h

## What

H1+H2 是 Phase H（AI 集成）的前两层，0 LLM 依赖：

1. **报幕层 (H1)**: 修复 RB-1~RB-8，让游戏有可读的系统报幕
   - `SKIP_PHASES` 拆分 → `ANNOUNCE_PHASES`（`day_announce`/`day_last_words`/`day_exile` 不再被跳过）
   - 5 种 announce 事件（dawn/exile/round/last_words/game_end）全部 `scope: 'public'` + messageStore 双写

2. **模板发言 (H2)**: 讨论阶段不再是空壳 action
   - `speak` 动作携带 `params.speechText`（4 个中文模板随机）
   - Orchestrator 收到后 → `WerewolfEngine.recordSpeech()` + `writeSpeech()` 双写 messageStore
   - `day_last_words` 阶段自动为被放逐者生成遗言

3. **messageStore 注入**: 3 个 `GameOrchestrator` 创建点全部注入 messageStore

改动文件：
- `GameAutoPlayer.ts` (+35 行): ANNOUNCE_PHASES 分离 + 模板发言生成
- `GameOrchestrator.ts` (+145 行): announce 事件 + writeSpeech/writeAnnounce 双写 + resolveLastWords
- `index.ts` / `games.ts` / `messages.ts` (+5 行): messageStore 注入

## Why

铲屎官 2026-03-17 实测发现游戏 1s 出全部结果、无天亮公告、发言是空壳。Phase H plan（v4）定义了三层架构：报幕层 → AI 行动层 → 发言层。H1+H2 是 Layer 1 + Layer 3 的模板骨架，后续 H3/H4 接入 LLM 替换模板。

## Original Requirements（必填）
> "没公告到底晚上的结果是什么"
> "1s内就出现了这些数据，但是1s内你们的cli根本拉不起来！"
> "你们的消息不能是没有一个地方承载的黑盒！"
> "那个系统的消息你也走那个呀！！"（TD-H10：系统消息走现有 message pipeline）
- 来源：`docs/plans/2026-03-17-f101-phase-h-ai-integration.md` 附录 C
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 模板文案是硬编码的 4 句话（不是 LLM 生成），足够证明管道通畅，H3/H4 替换
- `writeAnnounce`/`writeSpeech` 用 fire-and-forget（`Promise.resolve(...).catch(...)`），不阻塞游戏主循环
- `resolveLastWords` 只生成固定遗言模板，不区分角色

## Open Questions

1. **请对照 `designs/f101-werewolf-game-ui.pen` 设计稿**：Screen 4 的报幕卡片 + 聊天气泡 = 本次后端 announce/speech 事件的前端渲染目标（H6 实现），请 reviewer 确认后端数据结构是否足够支撑设计稿的渲染需求
2. `writeSpeech` 的 `catId` 目前用 `seat.actorId`（如 "opus"），这和 messageStore 现有的 CatId 类型一致吗？
3. `ANNOUNCE_PHASES` 的 2× 延迟（1600ms）是否足够让前端渲染报幕动画？

## Next Action

请 review 代码质量 + 架构合理性 + 设计稿对照，放行后我走 merge-gate。

## 自检证据

### Spec 合规
- RB-1/2/3/4/5/7/8 全部实现 ✅
- messageStore 双写（writeAnnounce + writeSpeech）✅
- 3 处 constructor 注入 ✅
- 纯后端，无前端 UI 改动（H6 时做 Chat UI 替换）

### 测试结果
game tests → 231 pass, 0 fail ✅
pnpm check → 0 errors ✅ (biome format + lint + feature index)
pnpm lint → 0 errors (only pre-existing img warnings) ✅

### 相关文档
- Plan: `docs/plans/2026-03-17-f101-phase-h-ai-integration.md`
- Feature: F101
- Design: `designs/f101-werewolf-game-ui.pen` (Screen 4, 6, 10)
