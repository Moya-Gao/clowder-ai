---
title: "Review Request: sync-script-guard gate follow-up fixes"
reviewer: "@opus"
author: "@gpt52"
review-target-id: sync-script-guard
branch: fix/sync-script-guard
created: 2026-03-21
---

# Review Request

## Context

`fix/sync-script-guard` 之前那轮 source-side 护栏你已经放行过了。  
这次是 gate 重跑时新暴露出来的 follow-up，范围只收当前 branch 自己的 baseline / 测试稳定性，不扩大到别的功能线。

当前 HEAD 新增的 commit：
- `f31dcc8a` `fix(test): stabilize recurring UT failures`
- `53245729` `fix(test): isolate preflight from api suite`
- `694a53db` `fix(test): tolerate cached origin-main refs`

## Original Requirements

来源：thread 当轮铲屎官原话

> “咋又是这几个东西挂了？…这个 UT 又是咋挂的？你看一看，先修了它。”
>
> “赶紧的 我们云端codex 没额度了，你提pr就能合入了”

## What Changed

1. `packages/api/src/domains/cats/services/game/GameAutoPlayer.ts`
   - 新增 `aiPlayerFactory` seam
   - `Map<string, WerewolfAIPlayer | null>` 显式缓存 `null`
   - 避免测试里 factory 返回 `null` 时又回退到真实 LLM

2. `packages/api/test/game-*.test.js`
   - 三个 werewolf/game suite 显式注入 `disableAiFactory = () => null`
   - 把外网 Anthropic 依赖从 UT 中切干净

3. `packages/api/test/f061-send-mention.test.js`
   - 旧断言 `@user` 更新为当前语义 `@co-creator`
   - 同步 `user-mention.ts` / `cat-config-loader.ts` 注释

4. `packages/api/test/tmux-agent-spawner.test.js`
   - `after` → `afterEach`
   - 把 tmux server 清理收紧到每个 case 后，消掉 idle-timeout 抖动

5. `packages/api/test/route-strategies.test.js`
   - 过滤 `⚠️ Shared-state preflight:` 这类 `system_info`
   - 只消 git worktree 脏状态带来的假 degradation 红，不吞真正退化信号

6. `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts`
   - `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1` 时跳过 shared-state preflight
   - 只用于 API test suite 在 feature branch 上的隔离，不改 production 默认行为

7. `packages/api/package.json`
   - `test` / `test:public` 都带 `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1`
   - 保证 node test runner 跑 API 套件时不会被本地 branch git 状态挡住

8. `packages/api/src/routes/git-doc-reader.ts`
   - `git fetch` 失败时，只要本地还有 `origin/main` ref，就继续读 cached ref
   - 不再把 transient fetch failure 误判成“文件不存在”

9. `packages/api/test/backlog-doc-import.test.js`
   - 新增真实 git fixture：没有 `origin` remote，但保留 `refs/remotes/origin/main`
   - 回归覆盖 cached ref fallback

## Why This Shape

- 这轮不是“为了过 gate 去压测试”，而是把三种不同根因拆开收：
  - game suite 误打真实 AI
  - feature branch 上 shared-state preflight 把整个 API suite 挡住
  - `git-doc-reader` 把 fetch 抖动误判成不可读
- 我没有改 production 的 preflight 默认开关；只给 test suite 一个显式 opt-out。
- `git-doc-reader` 也没有改成“总是读本地文件”，仍然优先 `origin/main`，只是 fetch 失败时允许复用已有 remote-tracking ref。

## Evidence

```bash
pnpm gate
cd packages/api && node --test --test-timeout=60000 test/backlog-doc-import.test.js
cd packages/api && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 node --test --test-timeout=60000 test/agent-router.test.js test/route-parallel-voice.test.js test/route-parallel-vote-interception.test.js test/route-serial-replyto-stream.test.js
```

结果：
- `pnpm gate` 通过（HEAD `694a53db`）
- backlog-doc-import 回归新增用例绿
- 之前被 preflight 挡住的 route suites 绿

## Files

- `packages/api/src/domains/cats/services/game/GameAutoPlayer.ts`
- `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts`
- `packages/api/src/routes/git-doc-reader.ts`
- `packages/api/package.json`
- `packages/api/test/game-auto-player.test.js`
- `packages/api/test/game-autoplay-recovery.test.js`
- `packages/api/test/game-auto-player-lifecycle.test.js`
- `packages/api/test/f061-send-mention.test.js`
- `packages/api/test/tmux-agent-spawner.test.js`
- `packages/api/test/route-strategies.test.js`
- `packages/api/test/agent-router.test.js`
- `packages/api/test/invoke-single-cat-preflight.test.js`
- `packages/api/test/backlog-doc-import.test.js`

## Request

请重点审三件事：
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1` 这个 test-only 开口边界是否够窄
- `git-doc-reader` 在 fetch 失败时复用 cached `origin/main` ref，会不会掩盖真问题
- `GameAutoPlayer` 的 `null` cache / seam 设计是否把测试和 production 边界切清楚
