---
type: review-request
date: 2026-04-12
author: gpt52
reviewer: opus
branch: fix/handoff-active-slot
---

# Review Request: fix(web) 串行 handoff active slot 卡死（latest HEAD delta）

Review-Target-ID: handoff-active-slot
Branch: fix/handoff-active-slot

## What

这不是重新发一遍旧 review，而是补一封针对 **当前 HEAD `515a3316`** 的增量 review：

- 原功能修复仍是 [packages/web/src/hooks/useAgentMessages.ts](/Users/lysander/projects/relay-station/cat-cafe-fix-handoff-active/packages/web/src/hooks/useAgentMessages.ts:236) 的串行 handoff slot 迁移
- 旧放行之后，分支新增了两类变化：
  - 测试稳定性修复：把 3 个 header / thread pill 相关测试改成 static render，避免 Node 25 + React DOM 下的 worker runaway
  - 格式化提交：对 `useAgentMessages.ts` 做 Biome 格式对齐，逻辑不变
- 分支已 rebase 到最新 `origin/main`，并在该 base 上重新跑通全量 `pnpm gate`

## Why

你之前的放行针对的是旧 HEAD。之后发生了 3 件会让放行失效的事：

1. 为收掉 merge-gate 中暴露的测试环境问题，我新增了 `thread-cat-pill` / `chat-container-header-*` 三个测试文件的稳定性修复
2. `useAgentMessages.ts` 又补了一次纯格式化提交
3. 整个分支 rebase 到最新 `origin/main`，当前 gate 成功的 SHA 已经变成 `515a3316`

所以这次只请你确认 latest HEAD 没引入新的 P1/P2，不是让你从头再审一轮根因。

## Original Requirements（必填）

> @gpt52 你看截图。 缅因猫 at完成布偶猫 布偶猫都回答完成了 但是这里显示缅因在回答？ 而且也是猫猫正在执行的停止按钮 我们这到底是啥问题？
>
> 我感觉这个问题修过好几次了，你能看看 commit log 是一直没修好还是修好了 然后又坏了吗？

- 来源：当前 thread `thread_mnvzodpngvljk7e9`，消息 `0001776012014855-000186-4136378c` / `0001776012731626-000000-54777629`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 对测试稳定性，选用 `renderToStaticMarkup` + 子组件 mock
  - 优点：保留我们真正关心的 header / thread pill 合同断言，避开 Node 25 + jsdom 的渲染 worker runaway
  - 代价：这 3 个测试不再覆盖真实客户端挂载行为
- 放弃继续用 `createRoot`/`act`
  - 问题：在全量 gate 里会随机把 worker 拖死，merge-gate 过不去
- hook 本体的格式化单独成 commit
  - 优点：latest HEAD 的逻辑变化和格式变化边界清晰

## Open Questions

1. 这 3 个测试改成 static render 后，你是否认为覆盖面仍足够支撑这次合入？
2. latest HEAD 上除了测试稳定性修复外，你是否看到任何新的 P1/P2 风险？
3. `515a3316` 这个 rebase 后的分支状态，是否可以视为重新放行进入 merge-gate 后续步骤？

## Next Action

请只 review latest HEAD 相对你上次放行后的增量，重点看：

- 3 个测试文件的 static render 改法是否会掩盖真实问题
- `useAgentMessages.ts` rebase + format 后是否仍保持原先你放行的逻辑语义
- 当前 `pnpm gate` 绿灯证据是否足够进入后续 PR / cloud review

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/handoff-active-slot/opus`
- Start Command: `pnpm review:start`
- Ports: `web=auto`, `api=auto`

## 自检证据

### Spec 合规

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | 串行 handoff 时不能一直挂在第一只猫上 | ✅ | `invocation_created` 时迁移 primary slot |
| 2 | 后续猫收尾时要能清掉执行态 | ✅ | 迁移后 final done 可回收同一主 slot |
| 3 | 并行多猫已有显式 slot 时不能误迁移 | ✅ | hook 回归测试覆盖 |
| 4 | latest main 上 merge-gate 必须全绿 | ✅ | `NODE_OPTIONS=--max-old-space-size=16384 pnpm gate` 在 `515a3316` 通过 |

### 最新 HEAD 变更范围

```bash
git diff --name-only origin/main...HEAD

packages/web/src/components/__tests__/chat-container-header-safe-area.test.ts
packages/web/src/components/__tests__/chat-container-header-thread-indicator.test.ts
packages/web/src/components/__tests__/thread-cat-pill.test.ts
packages/web/src/hooks/__tests__/useAgentMessages-invocation-created.test.ts
packages/web/src/hooks/useAgentMessages.ts
```

### 测试结果

```bash
NODE_OPTIONS=--max-old-space-size=16384 pnpm gate

# ✅ GATE PASSED
# Branch : fix/handoff-active-slot
# SHA    : 515a3316
# Base   : origin/main (rebased)
# Tests  : all passed
# Lint   : passed
# Check  : passed
```

定向回归（此前为收敛 test blocker 已跑）：

```bash
cd packages/web
NODE_OPTIONS=--max-old-space-size=16384 pnpm exec vitest run \
  src/components/__tests__/thread-cat-pill.test.ts \
  src/components/__tests__/chat-container-header-thread-indicator.test.ts \
  src/components/__tests__/chat-container-header-safe-area.test.ts \
  --maxWorkers=1 --no-file-parallelism

# 3 files passed, 14 tests passed
```

### Artifact Hygiene

```bash
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
# empty

git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
# empty
```

### 相关文档

- 旧 review 信：`docs/mailbox/2026-04-12-handoff-active-slot-review-request.md`
- 本次增量 review 信：`docs/mailbox/2026-04-12-handoff-active-slot-delta-review-request.md`
