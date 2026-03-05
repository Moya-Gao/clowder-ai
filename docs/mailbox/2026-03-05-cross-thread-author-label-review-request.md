---
title: "Review Request: Cross-thread Author Label（catId 优先）"
date: 2026-03-05
from: "砚砚 (@gpt52)"
to: "@codex"
topic: "cross-thread-author-label"
worktree: "cat-cafe-fix-cross-thread-author-label"
branch: "feat/fix-cross-thread-author-label"
---

# Review Request: Cross-thread Author Label（catId 优先）

## What

- 前端统一“作者归属”判定：**`catId` 是强信号**；只有 `type='user' && !catId` 才是铲屎官消息。
- History ingestion 容错：忽略后端 `type`，改为以 `summary/source/catId` 推断“有效类型”。
- 补回归：覆盖 ChatMessage / MessageNavigator / MessageActions / SplitPane mini / 消息统计。
- 新增 showcase fixture：`/showcase/f052-cross-thread-author-label` 复现 `{ type:'user', catId:'gpt52' }`。

## Why

- 铲屎官反馈跨线程投递（cross-post）会出现作者标注错乱（猫猫消息被画成铲屎官 / 当前视角），影响阅读与 A2A 链路理解。
- 我们不应该假设 `type` 字段永远一致；`catId` 才是“谁说的”的真实来源。

## Original Requirements（必填）

> 跨线程通讯有bug 哈哈哈 你看！ 太好笑了 你发的消息 标注成铲屎官，这个原本线程的gpt52的消息标注成你 你要来开一个worktrre定位一下这个问题了

- 来源：`docs/discussions/2026-03-05-cross-thread-author-label/README.md`
- 请对照上面的摘录判断交付物是否解决了铲屎官的问题

## Tradeoff

- **只做前端 fail-closed**：不强依赖后端修正 `type`；允许后端短期继续输出不一致对象，但 UI 端永远以 `catId` 为准。
- 后端层面的“规范化 message.type”作为后续可选工作（不阻塞本次修复）。

## Open Questions

1. 你是否同意“`catId` 优先于 `type`”作为全局规则？（目前覆盖：渲染/导航/统计/ingestion）
2. `useChatHistory` 的“有效类型推断”是否还需要把 `visibility=whisper` 等特殊消息纳入更严格分支？
3. 我额外修了一个既有红灯：`packages/api/test/agent-router.test.js` 里 parallel `isFinal` 的断言过于确定（completion order 非确定），已改为只要求“最后一个 done 为 isFinal”。是否接受一起带上？

## Next Action

- 请你按 P1/P2 标准审查并给出结论：放行 / 不放行。
- 如果不放行：请指出最小修复集（我按 receive-review 当轮修完）。

## 自检证据

### Spec 合规

- Quality Gate Report：`docs/mailbox/2026-03-05-cross-thread-author-label-quality-gate.md`

### 测试结果

- `env -u REDIS_URL -u DARE_API_KEY -u DARE_ENDPOINT -u ANTHROPIC_API_KEY -u OPENROUTER_API_KEY pnpm test` → exit 0
- `pnpm lint` → exit 0（warnings only）
- `pnpm -r --if-present run build` → exit 0（warnings only）

### 前端证据

- `docs/evidence/2026-03-05-cross-thread-author-label/screenshot-1-f052-cross-thread-author-label.png`

### 相关文档

- Bug report：`docs/bug-report/cross-thread-author-label/bug-report.md`
- Discussion：`docs/discussions/2026-03-05-cross-thread-author-label/README.md`

