# Bug Report: F21 Signal Inbox 未显示跨天未读文章

> 日期：2026-02-23  
> 报告人：铲屎官（会话内反馈）  
> 定位/修复：缅因猫（砚砚）  
> 严重度：P1（正确性，导致真实未读文章在主视图丢失）

## 1. 报告人

- 来源：会话反馈“昨天 fetch 的未读文章不见了，列表看不到完整抓取结果”。
- 影响：Signal Inbox 显示 `0`，但统计卡存在未读（例如 `unread=19`），用户误以为文章丢失。

## 2. 复现步骤（期望 vs 实际）

1. 写入至少两天的 inbox 数据（当天 + 昨天），所有文章状态为 `inbox`。
2. 请求 `GET /api/signals/inbox?limit=10`（不传 `date`）。

期望：返回跨天未读集合（包含昨天未读）。  
实际（修复前）：仅返回当天文件数据，昨天未读被排除。

## 3. 根因分析

- 位置：`packages/api/src/domains/signals/services/article-query-service.ts`。
- `listInbox()` 在 `date` 未传时强制回退到 `new Date().toISOString().slice(0, 10)`，只读取当日日文件。
- 与 `readInboxRecords(paths, undefined)` 的“读取所有 inbox 日文件”能力相冲突，导致跨天未读被错误隐藏。

## 4. 修复方案（为何选择）

- 修复：`listInbox()` 仅在显式传入 `date` 时按日读取；不传 `date` 时改为传 `undefined`，读取全部 inbox 日文件后按 `fetchedAt` 排序并应用现有过滤。
- Why：最小改动即可恢复预期语义（默认展示完整未读池），不改变 `date` 显式查询行为。
- Tradeoff：默认返回范围变大，后续可能需要分页/游标优化；当前先保留 `limit` 控制上限。

## 5. 验证方式

### Red（先失败）

新增测试（修复前 FAIL）：
- `packages/api/test/signals-route.test.js`
- 用例：`GET /api/signals/inbox without date includes unread items from previous days`
- 失败点：期望 `3`，实际 `2`。

### Green（修复后通过）

```bash
pnpm --filter @cat-cafe/shared build && pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signals-route.test.js
# => 19/19 pass
```
