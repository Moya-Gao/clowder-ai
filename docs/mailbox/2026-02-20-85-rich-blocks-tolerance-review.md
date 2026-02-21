# Review 请求: #85 Rich Blocks 格式容错 + CardBlock MD 渲染

> 作者: 布偶猫 | 日期: 2026-02-20
> Branch: `fix/rich-blocks-format-tolerance`
> Worktree: `cat-cafe-rich-blocks-tolerance`

## 背景

铲屎官实测发现另一个 Opus session 用了 `"type": "card"` 代替 `"kind": "card"`，导致整条消息显示原始 JSON。同时 CardBlock 的 `bodyMarkdown` 以纯文本渲染，`**粗体**` 不生效。

## 设计文档

- Plan: `docs/plans/2026-02-20-f22-rich-blocks-format-tolerance.md`
- BACKLOG: #85

## Spec Compliance 自检

| # | Spec 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|-----------|------|----------|----------|
| M1 | CardBlock bodyMarkdown → MarkdownContent | ✅ | `CardBlock.tsx:19-21` | `card-block-markdown.test.ts` (4) |
| M2 | normalizeRichBlock (type→kind, auto v:1) | ✅ | `shared/types/rich.ts:68-97` | T1-T4 (6 tests) |
| M2a | Route B extractRichFromText 接入 normalize | ✅ | `rich-block-extract.ts:120` | existing + T5 |
| M2b | Route A callbacks 接入 normalize | ✅ | `callbacks.ts:385-389` | T7 |
| M2c | MCP tool 接入 normalize | ✅ | `callback-tools.ts:187-188` | MCP test |
| M3 | 裸 JSON 数组强匹配容错 | ✅ | `rich-block-extract.ts:130-147` | T5, T5b, T6a, T6b |
| M4a | SystemPromptBuilder 提示词补强 | ✅ | `SystemPromptBuilder.ts:87-88` | size guard 27/27 |
| M4b | McpPromptInjector 提示词补强 | ✅ | `McpPromptInjector.ts:133,167-168` | 6/6 |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/shared/src/types/rich.ts` | 新增 | normalizeRichBlock 函数 |
| `packages/shared/src/types/index.ts` | 修改 | re-export normalizeRichBlock |
| `packages/api/src/.../rich-block-extract.ts` | 修改 | isRichBlockCandidate + 裸 JSON M3 + normalize 接入 |
| `packages/api/src/routes/callbacks.ts` | 修改 | Route A create-rich-block 接入 normalize |
| `packages/mcp-server/src/tools/callback-tools.ts` | 修改 | MCP tool 接入 normalize |
| `packages/api/src/.../SystemPromptBuilder.ts` | 修改 | kind/type 格式提醒 |
| `packages/api/src/.../McpPromptInjector.ts` | 修改 | kind/type 格式提醒 |
| `packages/web/src/components/rich/CardBlock.tsx` | 修改 | bodyMarkdown → MarkdownContent |
| `packages/api/test/rich-block-extract.test.js` | 修改 | +10 tests (T1-T6) |
| `packages/api/test/callback-routes.test.js` | 修改 | +1 test (T7) |
| `packages/mcp-server/test/callback-tools.test.js` | 修改 | +1 test (MCP normalize) |
| `packages/web/src/components/__tests__/card-block-markdown.test.ts` | 新增 | +4 tests (T8) |

## Git SHA

- Base: `0ebf9e6` (origin/main)
- Head: `3d7f999` (4 commits)

## 测试状态

```
rich-block-extract.test.js: 33 pass
callback-routes.test.js: 40 pass
callback-tools.test.js: 25 pass (MCP)
system-prompt-builder.test.js: 27 pass
mcp-prompt-injector.test.js: 6 pass
card-block-markdown.test.ts: 4 pass (web/vitest)
Full monorepo build: PASS
```

Pre-existing failures (not our regression):
- `redis-thread-store.test.js` — REDIS_URL isolation guard (pre-existing)
- `useSendMessage-routing.test.ts` — split pane routing (pre-existing, also fails on main)

## Review 重点

1. **normalizeRichBlock 放 shared 而非 rich-block-extract** — 因为 MCP 包也需要用。rich-block-extract.ts re-export 保持向后兼容。这个决策对不对？
2. **裸 JSON 强匹配策略** — `isRichBlockCandidate` 只检查 `id` + (`kind` || `type`)，有没有误吞风险？
3. **CardBlock 用 MarkdownContent + `!text-xs` 覆盖** — 样式是否合适？会不会太重（headings/tables/code blocks 都会渲染）？
4. **mutating normalize** — `normalizeRichBlock` 直接修改输入对象（性能优先），三入口使用时是否有副作用风险？

## 五件套

**What**: 统一 normalizeRichBlock 格式容错 + CardBlock MD 渲染 + 提示词补强
**Why**: 另一个 Opus 写错格式(type 代替 kind)导致 rich blocks 不渲染；bodyMarkdown 名叫 markdown 但实际纯文本输出
**Tradeoff**: 选择"受限容错"而非"无条件修正"——只处理 type→kind + auto v:1 两种明确场景，不做激进猜测
**Open Questions**: 裸 JSON 强匹配可能在极端情况下误吞结构化数据（概率极低但存在）
**Next Action**: 请 review 上述文件
