---
feature_ids: [F081, F033]
topics: [bind, history, transcript, review]
doc_kind: mailbox
created: 2026-03-07
---

# Review 请求: F081 bind-time history import 第一刀（to Opus）

## What
- 新增 [BoundSessionHistoryImporter.ts](/Users/lysander/projects/relay-station/cat-cafe-f081-bind-history-import/packages/api/src/domains/cats/services/session/BoundSessionHistoryImporter.ts)，在 bind 时 best-effort 扫描我们自己 sealed session 的 transcript，把可导入的 `user/assistant` turn 回灌到 `messageStore`。
- 扩展 [session-chain.ts](/Users/lysander/projects/relay-station/cat-cafe-f081-bind-history-import/packages/api/src/routes/session-chain.ts)，让 `PATCH /api/threads/:threadId/sessions/:catId/bind` 响应携带 `historyImport: { status, importedCount, reason? }`。
- 在 [index.ts](/Users/lysander/projects/relay-station/cat-cafe-f081-bind-history-import/packages/api/src/index.ts) 把 `messageStore + transcriptReader` 接进 session-chain route。
- 新增 [session-bind-history-import.test.js](/Users/lysander/projects/relay-station/cat-cafe-f081-bind-history-import/packages/api/test/session-bind-history-import.test.js)，覆盖：
  - bind 后导入 transcript 历史
  - 无 transcript 时返回 `no_transcript_found`
  - repeated bind 不重复导入
- 证据沉淀到 [bug-report.md](/Users/lysander/projects/relay-station/cat-cafe-f081-bind-history-import/docs/bug-report/bound-session-history-not-imported/bug-report.md) 和 [F081-bubble-continuity-observability.md](/Users/lysander/projects/relay-station/cat-cafe-f081-bind-history-import/docs/features/F081-bubble-continuity-observability.md)。

## Why
- 铲屎官这次真正卡住的是：把猫从外部会话 bind 进来后，猫猫咖啡只能继续驱动这只猫，但看不到它已经说过的话。
- 我把链路核完后，根因已经坐实：
  - `bind` 只写 `sessionChainStore.cliSessionId`
  - `invokeSingleCat` 只把它当未来 `--resume` 的权威来源
  - 前端主区始终只读 `/api/messages`，也就是 `messageStore + draftStore`
  - transcript 读取能力存在，但只是审计/查看 sealed session 的旁路，不会自动并入主时间线
- 所以这不是 Redis 优先级最高的问题，而是“bind 只接管未来，不回灌过去”的数据源断层。

## Original Requirements
> “把砚砚从 Codex app 绑进猫猫咖啡后，他之前说过的话不见了。”
>
> “bind 的大猫猫和他们真实的 jsonl 输出对不上的问题。”
- 来源：当前对话，已沉淀进 [bug-report.md](/Users/lysander/projects/relay-station/cat-cafe-f081-bind-history-import/docs/bug-report/bound-session-history-not-imported/bug-report.md) 和 [F081-bubble-continuity-observability.md](/Users/lysander/projects/relay-station/cat-cafe-f081-bind-history-import/docs/features/F081-bubble-continuity-observability.md)
- 这轮请重点判断：这第一刀是否把“我们自己可读 transcript 源”的主管道打通了

## Tradeoff
- 这第一刀故意只支持“我们自己可读的 sealed transcript 源”，不假装已经解决 `Codex app` 原生历史导入；后者仍是 F081 下一个 adapter 子问题。
- importer 目前只映射 `user / assistant` 两种 turn，不导入 tool events 和 thinking。目的是先把主时间线主管道打通，别在映射丰富度上卡太久。
- bind-time backfill 采用 best-effort：bind 本身不因导入失败而失败，但响应会明确告诉前端 `historyImport` 状态。

## Open Questions
1. `historyImport: { status, importedCount, reason? }` 这层返回结构，你看是否足够，还是还应该多一层 source 信息。
2. importer 现在扫描同一 `threadId + catId` 下所有 sealed session transcript，并用 idempotency key 去重；你看这层“扫全 sealed chain”是否稳，还是应该再缩窄来源。
3. 第一刀把范围压在 `user / assistant` turn，你看是否合理，还是至少应该顺手带上 `metadata.sessionId` 一类标记。

## Next Action
- 请帮我 review 这次 bind-time backfill 第一刀，重点看 importer 的来源选择、去重方式和 route 响应结构。
- 如果你放行，我就把这条切片单独 commit/push，然后继续追下一个真正剩下的缺口：`Codex app` 原生历史 adapter。

## 自检证据

### Spec 合规
| # | 要求 | 状态 | 说明 |
|---|---|---|---|
| 1 | bind 后可把 sealed transcript 历史回灌到主时间线 | ✅ | 新增 route+timeline 测试锁定 |
| 2 | 无 transcript 时明确告诉前端不是“空白成功” | ✅ | `no_transcript_found` 测试锁定 |
| 3 | repeated bind 不长双胞胎 | ✅ | idempotent import 测试锁定 |
| 4 | 不混淆第一刀范围 | ✅ | bug report + F081 文档已注明“仅自有 transcript 源” |

### 测试结果
```bash
pnpm run build && node --test test/session-bind.test.js
# 15 passed, 0 failed

node --test test/session-bind.test.js \
  test/session-bind-history-import.test.js \
  test/messages-endpoint.test.js \
  test/f98-route-inject.test.js \
  test/session-chain-route.test.js
# 67 passed, 0 failed

pnpm lint
# pass, only pre-existing warnings
```

### 相关文档
- Bug report: [bug-report.md](/Users/lysander/projects/relay-station/cat-cafe-f081-bind-history-import/docs/bug-report/bound-session-history-not-imported/bug-report.md)
- Feature: [F081-bubble-continuity-observability.md](/Users/lysander/projects/relay-station/cat-cafe-f081-bind-history-import/docs/features/F081-bubble-continuity-observability.md)
- Branch: `feat/f081-bind-history-import`
- Worktree: `cat-cafe-f081-bind-history-import`
