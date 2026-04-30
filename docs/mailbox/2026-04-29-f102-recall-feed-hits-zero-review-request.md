---
feature_ids: [F102]
topics: [review-request, recall-feed, search-evidence, tool-events]
doc_kind: review-request
created: 2026-04-29
---

# Review Request: F102 RecallFeed `0 hits` 修复

Review-Target-ID: f102
Branch: fix/f102-recall-feed-hits

## What

修复 RecallFeed 对 `search_evidence` 工具事件的前端还原：

- 兼容 `Found N result(s) [variant=...]:` 结果头，避免真实命中被显示成 `0 hits`。
- 将 `tool_use`/`tool_result` 配对从“相邻 next result”改为 pending FIFO，覆盖多个 search 连续发出后再返回结果的 provider 事件流。
- 登记 F102 bug report，并把 F102 timeline 链到该报告。

## Why

后端 thread evidence index 没丢；`cat_cafe_search_evidence` 和 `cat_cafe_list_threads` 都能命中 `猫猫杀`。问题在 RecallFeed 解析 tool event 时把真实结果丢掉，导致 runtime 记忆面板误导使用者。

## Original Requirements

> 好像是有bug哦 我发现现在你们搜到了东西 hits 也是0
> 你来修复一下？issue 可能要挂f102或者哪里
> 然后开wktree和宪宪合作闭环这个？

- 来源：当前 A2A thread `0001777478417903-000221-0cf8feb4`
- 请对照上面的摘录判断交付物是否解决了铲屎官的问题。

## Tradeoff

没有改后端索引或 MCP search API，因为诊断证据显示后端检索可命中。前端仍不靠 tool_result label 反查 tool 名；只在有 pending search 时消费“看起来像 search_evidence 输出”的结果，降低误配其它工具输出的风险。

## Open Questions

- FIFO 配对是否足够覆盖当前 provider 事件顺序，还是需要继续追到 invocation/tool call id 级别的强配对。
- `No results found for:` 与 variant count header 的兼容是否还有其它 F163 输出格式遗漏。

## Next Action

请做跨家族 review：重点看 `packages/web/src/hooks/useRecallEvents.ts` 的配对逻辑和新增回归测试是否能覆盖截图里的 `hits=0` dogfood bug。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f102/opus`
- Start Command: `pnpm review:start`
- Ports: 默认 `web=3201`, `api=3202`，若被占用由 `review:start` 自动向后扫描；禁止使用 3001/3002/3011/3012/4111。

## 自检证据

### Spec 合规

- Worktree：`/Users/lysander/projects/relay-station/cat-cafe-f102-recall-feed-fix`
- F102 挂载：`docs/bug-report/2026-04-29-f102-recall-feed-hits-zero/bug-report.md`
- F102 timeline：`docs/features/F102-memory-adapter-refactor.md`

### 测试结果

```bash
pnpm --filter @cat-cafe/web exec vitest run src/__tests__/recall-feed.test.ts src/hooks/__tests__/useRecallEvents.test.ts
# 2 files passed, 26 tests passed

pnpm --filter @cat-cafe/web test
# 361 files passed, 2588 tests passed

pnpm check
# PASS: biome, feature truth, skills manifest, env checks, pre-merge gate checks, guides, followup tails
```

### 相关文档

- Bug report: `docs/bug-report/2026-04-29-f102-recall-feed-hits-zero/bug-report.md`
- Feature: `docs/features/F102-memory-adapter-refactor.md`
