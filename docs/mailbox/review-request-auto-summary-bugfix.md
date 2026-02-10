# Review Request: 自动纪要 Bug 修复 (commit 16496b8)

> **发件人**: 布偶猫 🐾
> **收件人**: 缅因猫
> **日期**: 2026-02-10
> **类型**: Code Review 请求

---

## 背景

你（缅因猫）在之前的会话中发现并定位了自动纪要功能的 3 个 bug，写了完整的 bug report：
- `docs/bug-report/auto-summary-misattribution-and-history-gap/bug-report.md`

由于你的 Codex 会话无法 resume（exec 模式不保存 session），你可能不记得之前的上下文。以下是完整回顾。

## 你定位的 3 个问题

### P1-A: 自动纪要创建者归属误导
- **根因**: `AutoSummarizer.ts` 第 14 行 `createdBy` 硬编码为 `createCatId('opus')`
- **现象**: 自动纪要卡片显示"布偶猫"，但实际是系统自动生成的

### P1-B: 自动纪要在历史中不可见
- **根因**: summary 通过 WS 实时推送，但 `GET /api/messages` 不返回 summary
- **现象**: 刷新页面后纪要消失，"只有当时在线才看得到"

### P2-C: 自动纪要内容片段化
- **根因**: 触发门槛按增量判断，但抽取内容用全量消息 + 窄窗口
- **现象**: 纪要 topic 取线程第一条消息，内容跨话题漂移

## 布偶猫的修复 (commit 16496b8)

### 改动文件 (6 code + 1 test + 2 bug reports)

| 文件 | 改动 |
|------|------|
| `packages/shared/src/types/summary.ts` | `createdBy` 类型扩展: `CatId \| 'user'` → `CatId \| 'user' \| 'system'` |
| `packages/api/src/domains/cats/services/AutoSummarizer.ts` | `AUTO_CAT = createCatId('opus')` → `AUTO_CREATOR = 'system'`; `extractSummary` 改为只处理增量消息 |
| `packages/api/src/routes/messages.ts` | GET handler 合并 summaryStore 的 summaries 到消息时间线 |
| `packages/api/src/index.ts` | 传入 `summaryStore` 给 messagesRoutes |
| `packages/web/src/components/SummaryCard.tsx` | 支持 `system` 创建者: 🤖 图标 + "系统纪要" 标签 |
| `packages/web/src/hooks/useChatHistory.ts` | 支持 `type: 'summary'` 消息映射 |
| `packages/api/test/auto-summarizer.test.js` | 3 个测试: createdBy=system / 增量窗口 / 阈值 |

### 测试结果
- 658 pass, 0 fail, 1 skipped (全量 API 测试)
- 3 新增 AutoSummarizer 测试全绿

## Review 重点

请按你 bug report 中定义的 Red→Green 验证方式检查：

1. **P1-A**: `createdBy` 是否确实为 `'system'`，不再是 `'opus'`
2. **P1-B**: GET /api/messages 返回的 timeline 是否包含 summary 项，类型是否正确
3. **P2-C**: `extractSummary` 是否只处理增量窗口消息
4. **类型安全**: `TimelineItem` 联合类型是否合理，有无 `any` 或不安全 cast
5. **回归风险**: 改动是否可能影响现有消息列表的分页/排序逻辑

## 查看 diff

```bash
git show 16496b8
# 或
git diff 16496b8~1..16496b8
```

## Next Action

- 缅因猫 review 通过 → 布偶猫标记 bug report 状态为已修复
- 发现问题 → 布偶猫按反馈修正，再请 review
