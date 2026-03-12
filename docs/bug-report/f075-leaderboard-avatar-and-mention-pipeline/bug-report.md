---
feature_ids: [F075]
topics: [leaderboard, avatar, mentions, pipeline]
doc_kind: bug-report
created: 2026-03-11
---

# Bug Report: F075 排行榜头像管线分叉，mention 榜把猫猫互相 `@` 也算进去了

## 1. 报告人
- 报告人：铲屎官（23:42 会话反馈）
- 定位：缅因猫（砚砚）
- 发现方式：截图比对排行榜卡片与 mention 菜单，发现头像不一致、计数口径不对

## 2. 复现步骤（期望 vs 实际）
1. 打开 F075 排行榜卡片，观察本周之星与榜单小头像。
2. 对照聊天输入框的 mention 菜单/队友 roster 头像。
3. 检查排行榜 mention 计数是否只统计铲屎官发起的 `@`。

期望：
- 排行榜头像与 mention 菜单使用同一条头像管线。
- `favoriteCat / nightOwl / streak` 只统计铲屎官消息里的 `@`，不统计猫猫互相 `@`。

实际：
- 排行榜写死了 `*-kawaii.png`，与现有 `CatAvatar/useCatData` 管线分叉。
- `computeMentionStats` 遍历了所有消息的 `mentions`，导致猫猫消息里的 `@` 也污染排行榜。

## 3. 根因分析
- 前端根因：
  - `packages/web/src/components/leaderboard-cards.tsx` 维护了单独的 `AVATAR_MAP`，绕开了 `CatAvatar` 和 `/api/cats -> useCatData` 的统一来源。
  - `packages/web/src/components/leaderboard-phase-bc.tsx` 继续复用了这张错误映射表。
- 后端根因：
  - `packages/api/src/domains/leaderboard/mention-stats.ts` 对所有消息都累计 `msg.mentions`，没有区分 owner 消息和 cat 消息。

## 4. 修复方案（含取舍）
选定方案：
- 前端统一改为使用 `CatAvatar`，让排行榜和 mention 菜单走同一条头像管线。
- 后端只在 `msg.catId == null` 时累计 mention 榜相关指标，保留 `chatty` 继续统计猫猫发言量。

放弃方案：
- 继续维护 leaderboard 专属头像映射：
  - 会重复定义资产来源，后续新变体（如 `gpt52`）继续错位。
- 只在 API 层做 post-filter 而不改 `computeMentionStats`：
  - 会把错误口径留在核心纯函数里，回归风险更高。

## 5. 验证方式（Red → Green）
Red（已执行）：
- `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/leaderboard/mention-stats.test.js`
  - 新增用例失败，证明 cat-authored mentions 被错误计入 `favoriteCat/nightOwl/streak`
- `pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/leaderboard-avatar-pipeline.test.tsx`
  - 新增用例失败，证明 leaderboard 没有走 `CatAvatar`

Green（已执行）：
- `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/leaderboard/mention-stats.test.js`
  - `7/7 pass`
- `pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/leaderboard-avatar-pipeline.test.tsx`
  - `2/2 pass`
