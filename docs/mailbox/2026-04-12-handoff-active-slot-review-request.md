---
type: review-request
date: 2026-04-12
author: gpt52
reviewer: opus
branch: fix/handoff-active-slot
---

# Review Request: fix(web) 串行 handoff active slot 卡死

Review-Target-ID: handoff-active-slot
Branch: fix/handoff-active-slot

## What

修复串行 handoff（例如“缅因猫 -> 布偶猫”）里的前端执行态残留：

- 在 [packages/web/src/hooks/useAgentMessages.ts](/Users/lysander/projects/relay-station/cat-cafe-fix-handoff-active/packages/web/src/hooks/useAgentMessages.ts:234) 新增 `maybeMigrateSequentialInvocationOwnership()`
- 当下一只猫发出 `system_info { type: "invocation_created" }` 时，如果这是串行 handoff 且当前没有该猫的显式 slot，就把 primary active slot 从上一只猫迁到下一只猫
- 同步替换 active thread 的 `targetCats`，避免顶部 indicator 继续显示旧猫
- 新增回归测试，覆盖：
  - 串行 handoff 的 slot/target 迁移
  - 并行多猫已有显式 slot 时不得误迁移

## Why

铲屎官截图对应的是“同一类问题修了很多轮，但这个具体洞没补全”：

- `c5fa365a9` 已修“第一只猫的 `done(isFinal=false)` 到了之后要删自己的 slot”
- 但如果这条 `done(false)` 因时序/丢事件没被前端吃到，旧 slot 仍绑在第一只猫上
- 后续猫虽然正常完成，final done 也清不掉这个“还绑在前一只猫上的 primary slot”
- 结果就是 UI 继续显示“缅因猫回复中 / 猫猫正在回复中 / Stop 按钮还在”

这次补的是“下一只猫启动时迁移 slot 所有权”，让后续 final done 仍有机会收尾。

## Original Requirements（必填）

> @gpt52 你看截图。 缅因猫 at完成布偶猫 布偶猫都回答完成了 但是这里显示缅因在回答？ 而且也是猫猫正在执行的停止按钮 我们这到底是啥问题？
>
> 我感觉这个问题修过好几次了，你能看看 commit log 是一直没修好还是修好了 然后又坏了吗？

- 来源：当前 thread `thread_mnvzodpngvljk7e9`，消息 `0001776012014855-000186-4136378c` / `0001776012731626-000000-54777629`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 选用：在 `invocation_created` 边界做“串行 handoff slot 迁移”
  - 优点：不依赖前一段 `done(false)` 一定到达，能兜住真实丢事件场景
  - 代价：前端多一层“这是串行 handoff 还是并行 slot”的判定
- 放弃：继续只依赖 `done(false)` 清理
  - 问题：一旦中间 done 漏掉，后面 final done 仍然无法回收旧 primary slot
- 放弃：服务端给每段 handoff 都强制分配新 invocationId
  - 问题：改动面太大，牵涉 tracker / message correlation / callback path

## Open Questions

1. 这个迁移逻辑放在前端 `invocation_created` 上是否足够稳，还是你认为应该下沉到服务端事件语义层？
2. 当前只在 active thread 替换 `targetCats`。background thread 这类残留是否也该补同样语义，还是现有 `useSocket-background` 已足够？
3. 这次我没有补 browser 级复现脚本，只加了 hook 回归测试。你评估一下是否还要补一个 UI 层 fixture。

## Next Action

请 review 这次修复，重点看：

- 串行 handoff 的判定条件是否过宽/过窄
- 会不会误伤并行多猫已有 synthetic slot 的路径
- 这次修复是否应该顺手抽成共享 helper 给 background path

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
| 3 | 并行多猫已有显式 slot 时不能误迁移 | ✅ | 新增回归测试覆盖 |
| 4 | commit log 判断要清楚“是回归还是一直没补全” | ✅ | 已核对 `c5fa365a9` / `ff63c9f1f` / `7f028a8e0` / `f20a9e7da` / `61c87b2fb`，结论是同类问题多轮修复，但这条分支此前未覆盖 |

### 设计稿对照（Step 5）

`designs/**/*.pen`：无直接对应设计稿，本次为状态机/执行态修复，UI 文案不变。

### Artifact Hygiene（Step 7.5）

- worktree 根目录媒体/设计工件：无
- `git status --short | rg '^[^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'`：空
- `git diff --name-only origin/main...HEAD | rg '^[^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'`：空

### 验证命令输出（本轮真实运行）

```bash
pnpm exec vitest run src/hooks/__tests__/useAgentMessages-invocation-created.test.ts
# 1 file passed, 4 tests passed

pnpm exec vitest run src/hooks/__tests__/useAgentMessages-sequential-slot-cleanup.test.ts
# 1 file passed, 4 tests passed

pnpm exec vitest run src/hooks/__tests__/useAgentMessages-concurrent-cancel.test.ts
# 1 file passed, 7 tests passed
```

### 相关文档

- 当前分析结论：同一类执行态问题多轮修复，但“串行 handoff 丢掉前一段 non-final done 后的 slot 迁移”此前未覆盖
- 相关提交：`c5fa365a9`, `ff63c9f1f`, `7f028a8e0`, `f20a9e7da`, `61c87b2fb`
