---
feature_ids: [F134]
topics: [review-request, bug-fix, permissions, hub-ui]
doc_kind: note
created: 2026-04-15
---

# Review Request: Bug-9 — HubPermissionsTab multi-connector

Review-Target-ID: f134-bug-9
Branch: feat/F134-bug-9-permissions-tab-multi-connector

## What

`HubPermissionsTab` 的 API 路径和面包屑标题硬编码了 `feishu`，导致 WeCom Bot 和 DingTalk 的群权限无法在 Hub UI 管理。后端 `PermissionStore` 已经是 connector-agnostic 的（以 `connectorId` 为 key），只需前端参数化。

改动：
1. `HubPermissionsTab.tsx` — 接收 `connectorId` + `connectorLabel` props，API 路径和面包屑参数化，切换 connector 时重置状态
2. `HubListModal.tsx` — 新增 `GROUP_CONNECTORS` 列表（飞书/企业微信/钉钉）+ pill 选择器，传 props 给权限面板；补充 `dingtalk` 到 `CONNECTOR_LABELS`
3. `connector-permission-store.test.js` — 5 个新测试验证多 connector 数据隔离

## Why

铲屎官发现飞书有群权限控制面板，问企业微信呢。调查发现后端完全支持（F134 Phase D 架构 connector-agnostic），但前端 UI 写死了 `feishu`。

## Original Requirements（必填）
> 铲屎官 [23:40]："飞书还支持群权限控制，我们的企业微信呢？"
> 铲屎官 [23:46]："是的 不过哈哈哈这得挂在哪个feat的issue比较好，这就是架构不优雅 都写死的问题"
> 铲屎官 [00:17]："挂上然后commit push 之后 直接开worktree修吧"
- 来源：对话历史 2026-04-15
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 用静态 `GROUP_CONNECTORS` 数组而非从 API 动态获取可用 connector 列表。理由：YAGNI，目前群聊 connector 只有这三个，新增时改一行即可。
- 没有从 `@cat-cafe/shared` 的 `getConnectorDefinition` 取 displayName（改用 props 传入）。理由：parent 已有 label 映射，多引一个 import 无收益。

## Open Questions

1. **pill 选择器交互**：当前默认选中飞书，切换时重新 fetch。是否需要记住上次选择（localStorage）？我倾向不需要。
2. **Telegram 是否需要进 GROUP_CONNECTORS**？目前 Telegram 的群聊 permission 未确认实现，暂不加。

## Next Action

请 review 代码变更，重点关注：
- connector 切换时的状态重置是否完整（`useEffect` 里 reset config + loading）
- `GROUP_CONNECTORS` 是否应该和后端某个数据源保持同步

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f134-bug-9/codex`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`（禁止 3001/3002/3011/3012/4111）

## 自检证据

### Spec 合规
- 零 hardcoded `feishu` 残留（grep 验证）
- 面包屑、GET、PUT 三处全部参数化
- Connector 选择器支持飞书/企业微信/钉钉

### 测试结果
```
pnpm --filter @cat-cafe/web test            # 4 passed, 0 failed
connector tests (125 total)                  # 125 passed, 0 failed (含 5 new Bug-9)
pnpm lint                                    # 0 errors
pnpm biome check (changed files)             # 0 errors, 17 warnings (pre-existing)
pnpm -r --if-present run build               # exit 0
```

### 相关文档
- Feature: F134 (Phase D — 权限控制)
- Timeline entry: 2026-04-15 Bug-9 立项
