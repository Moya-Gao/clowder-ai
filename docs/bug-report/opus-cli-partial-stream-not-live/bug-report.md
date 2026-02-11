# Bug Report: Opus CLI 流式输出未实时显示

## 1. 报告人
- 报告人：铲屎官
- 报告时间：2026-02-11
- 发现方式：在 Cat Café 对话中观察到 Opus 回复“整段一次性出现”，没有像 Codex 一样逐步刷新。

## 2. 复现步骤（期望 vs 实际）
1. 在前端发起一个只路由到 Opus 的请求（例如让其输出 20 行文本）。
2. 观察前端 assistant 气泡刷新行为。

期望行为：
- Opus 文本应在生成过程中逐步追加，用户能看到增量流式输出。

实际行为：
- Opus 文本在结束时一次性出现，期间没有增量文本刷新。

## 3. 根因分析
- 代码路径：`packages/api/src/domains/cats/services/ClaudeAgentService.ts`
- 根因 1：Claude CLI 调用参数缺少 `--include-partial-messages`，导致 `stream-json` 默认只在接近结束时给完整 `assistant` 消息。
- 根因 2：事件转换逻辑只消费 `assistant.message.content`，没有处理 `stream_event.content_block_delta`（`text_delta`），因此即使 CLI 有 partial 事件也会被丢弃。
- 风险点：直接同时消费 partial 与 final assistant 文本会导致重复输出。

## 4. 修复方案
- 在 Opus CLI 参数中加入 `--include-partial-messages`。
- 在 `transformClaudeEvent` 中新增 `stream_event` 解析：
  - `message_start` / `message_stop` 追踪当前 messageId；
  - `content_block_delta.text_delta` 直接产出 `text` 消息用于前端实时追加。
- 增加去重策略：当某个 messageId 已输出 partial 文本时，跳过该 message 的最终 `assistant` 文本块，避免重复展示。
- 同步新增测试覆盖参数和去重行为。

## 5. 验证方式
- Red（先失败）：
  - `node --test test/claude-agent-service.test.js`
  - 新增 2 条测试先失败：
    - 缺少 `--include-partial-messages`
    - 未消费 `stream_event` 且只看到最终整段文本
- Green（修复后通过）：
  - `node --test test/claude-agent-service.test.js` -> 16 passed, 0 failed
  - `pnpm test`（@cat-cafe/api 全量）-> 899 passed, 0 failed, 1 skipped

