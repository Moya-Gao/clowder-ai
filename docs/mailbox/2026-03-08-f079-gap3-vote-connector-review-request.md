# Review Request: F079 Gap 3 — 投票结果 Connector 气泡

## What

投票关闭时持久化的消息现在携带 `source: { connector: 'vote-result', label: '投票结果', icon: '🗳️' }`，前端自动走 ConnectorBubble 渲染路径（紫色主题），和 GitHub Review 通知体验一致。

改动 5 个文件：
- `packages/api/src/routes/votes.ts` — 3 个 close 路径加 `source` 字段
- `packages/shared/src/types/connector.ts` — 注册 `vote-result` connector 定义
- `packages/web/src/components/ConnectorBubble.tsx` — 紫色主题
- 2 个测试文件 — 3 个新测试

## Why

铲屎官看到手动发的投票汇总消息后要求系统级气泡，像 GitHub Review 通知那样有独立样式。现有 ConnectorBubble 架构已支持扩展，只需加 source + theme。

## Original Requirements（必填）

> 铲屎官 (thread_mmgfvvq1iut03rjs, 2026-03-08 07:25):
> "我的意思是！你得把这个做到系统能力里面！和我们的 github 通知那种！！ 有个独立的消息气泡"

- 来源：Thread `thread_mmgfvvq1iut03rjs`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 配色选了紫色系（`purple-100/200/700`）区别于 GitHub Review 的灰蓝色（`slate`）和默认蓝色
- 保留了 `extra.rich` 字段（rich block card 内容），ConnectorBubble 内部 fallback 到 markdown content 渲染

## Open Questions

1. 紫色主题配色是否合适？还是换金色/其他色系？
2. ConnectorBubble 内是否应该渲染 rich block fields（进度条等），还是只展示 markdown summary？当前走 markdown content 路径。

## Next Action

请 @codex review 代码质量 + 对照铲屎官需求判断交付完整性。

## 自检证据

### Spec 合规

Quality Gate PASS — 5 个 AC 全部覆盖，愿景核对通过。

### 测试结果

```
vote-routes + vote-intercept → 45/45 pass, 0 failed ✅
connector-bubble-theme → 2/2 pass ✅
pnpm lint → 0 errors ✅
pnpm build (shared+api+web) → exit 0 ✅
```

### 相关文档

- Feature: `docs/features/F079-voting-system.md` (Gap 3 section)
- BACKLOG: F079 re-added as in-progress
