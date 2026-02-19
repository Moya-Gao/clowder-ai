# Bug Report: F21 Cloud Round12 — 搜索 status 透传缺失 + dateTo 当日边界排除

> 日期：2026-02-20  
> 报告人：Cloud Codex Review（PR #30 round12）  
> 定位/修复：缅因猫（砚砚）  
> 严重度：P2 + P2

## 1. 报告人

- 报告来源：cloud round12 自动 review。
- 问题 A（P2）：`SignalInboxView.tsx` 搜索提交未把 `status` 透传到后端搜索参数，导致后端仅按 `limit=80` 返回后由前端二次过滤，存在截断漏项。
- 问题 B（P2）：`article-query-service.ts` 用 `Date.parse('YYYY-MM-DD')` 处理 `dateTo`，上界落在当日 `00:00:00`，会把当日后续时间文章全部排除。

## 2. 复现步骤（期望 vs 实际）

### A. status 过滤未透传

1. 在 Signal Inbox 选择 `status=read`，并发起搜索。
2. 观察前端到后端搜索请求参数。

期望行为：
- 请求包含 `status=read`，后端直接执行 status 过滤。

实际行为（修复前）：
- 请求未携带 `status`，后端返回的仅是未按 status 过滤的前 `limit` 条结果，前端再过滤可能漏掉真实匹配文章。

### B. dateTo 当日被排除

1. 当天有抓取文章，执行 `/api/signals/search?q=claude&dateTo=YYYY-MM-DD`（当天日期）。
2. 检查结果数量。

期望行为：
- `dateTo` 应包含当天整日，返回当天文章。

实际行为（修复前）：
- `dateTo` 被解析为当天 00:00，导致当天文章（00:00 之后）全部被排除。

## 3. 根因分析

- A：`SignalInboxView` 提交时仅读取并透传 `source/tier`；`signals-api.searchSignals` 与后端路由/服务链路也未支持 `status` 过滤字段。
- B：`withinDateRange` 的上界直接使用 `Date.parse(dateTo)`；对 `YYYY-MM-DD` 输入得到的是当日午夜，`target <= to` 比较将当日文章错误排除。

## 4. 修复方案（为何选择）

- A：补齐 status 过滤的端到端透传与执行：
  - 前端表单增加 `status` 字段读取并透传；
  - `signals-api` 查询参数支持 `status`；
  - `/api/signals/search` query schema 接受 `status`；
  - `SignalArticleQueryService.search()` 增加 `status` 过滤。
- B：`toDateBound` 区分上下界；当 `mode=end` 且输入为 `YYYY-MM-DD` 时，将上界扩展为当日 `23:59:59.999`（`+ 24h - 1ms`）。

Why：
- 两个问题都属于查询语义正确性，必须在服务端过滤/边界计算层修复，避免前端补丁式规避。

Tradeoff：
- B 仍使用 `Date.parse` + 轻量规则判断，而不是引入重型日期库；优先保持改动最小并与现有实现一致。

## 5. 验证方式

### Red（先失败）

- 前端透传测试（修复前 FAIL）：
  - `packages/web/src/components/__tests__/signal-inbox-view.test.ts`
  - 失败点：`searchSignals` 调用参数缺少 `status: 'read'`。
- API 集成测试（修复前 FAIL）：
  - `packages/api/test/signals-route.test.js`
  - `GET /api/signals/search filters by status when requested`：期望 `1`，实际 `2`。
  - `GET /api/signals/search keeps dateTo day inclusive`：期望 `2`，实际 `0`。

### Green（修复后通过）

```bash
pnpm --filter @cat-cafe/web test -- src/components/__tests__/signal-inbox-view.test.ts src/utils/__tests__/signals-api.test.ts
# => 2 files passed, 6 tests passed

pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signals-route.test.js
# => 14/14 pass

pnpm --filter @cat-cafe/web run build
# => build success（仅既有 lint warnings）
```
