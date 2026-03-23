---
feature_ids: [F088]
topics: [review-request]
doc_kind: review
created: 2026-03-23
---

# Review Request: F088 Phase 8 — IM Hub 配置向导 Tab + 平台配置 UI

Review-Target-ID: f088-phase8
Branch: feat/f088-phase8-im-hub-config-wizard
PR: #680

## What

给 IM Hub 模态框（左侧栏 📡 蓝色按钮）添加双 Tab 结构：

1. **系统对话中心** — 现有 Hub Thread 列表（零改动）
2. **平台配置** — 引导式向导：飞书/Telegram/钉钉三平台可展开卡片，含三步引导 + 配置表单

变更清单（5 文件）：
- `packages/api/src/routes/connector-hub.ts` — 新增 `GET /api/connector/status` + `buildConnectorStatus()` 纯函数
- `packages/web/src/components/HubListModal.tsx` — 改造为 Tab 模态框
- `packages/web/src/components/HubConnectorConfigTab.tsx` — 新组件：平台配置向导
- `packages/api/test/connector-status.test.js` — 7 个单元测试
- `designs/f088-im-hub-config-wizard-ux.pen` — UX 设计稿

## Why

铲屎官希望在 IM Hub 入口（不是 CatCafeHub ⚙️）添加连接器平台的配置向导，降低首次接入飞书/Telegram/钉钉的门槛。

## Original Requirements（必填）

> 平台配置归平台配置，然后点进去有飞书的，有钉钉的，有 Telegram 的，然后对话的...是我们的系统对话中心
> 我挺喜欢这个 Screen C 的这个东西
> IM Hub 左上角那个，配置也是用在那个入口

- 来源：thread `thread_mmj4lhqgcy0najsb`，铲屎官语音确认 Screen C 设计方向
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 放弃了「测试连接」端点（`POST /api/connector/test-connection`），因为 connector gateway 无法热重载，配置保存后需重启才生效。当前用黄色提示条告知用户。
- 配置保存复用现有 `PATCH /api/config/env`，未新建独立端点。

## Open Questions

1. `buildConnectorStatus()` 作为纯函数导出（接受 `env` 参数，默认 `process.env`），这个 DI 模式是否合适？
2. placeholder 检测用 `startsWith('(未设置')` — 是否需要更健壮的检测逻辑？
3. 敏感值遮罩显示最后 4 位（`••••xxxx`），长度是否合适？

## Next Action

请审查代码质量 + 对照铲屎官原始需求判断交付物是否达成愿景。

## 自检证据

### Spec 合规

| AC | 描述 | 状态 |
|----|------|------|
| AC-8-1 | HubListModal 双 Tab 导航 | ✅ |
| AC-8-2 | 平台卡片展开/折叠 | ✅ |
| AC-8-3 | 三步引导 + 外部文档链接 | ✅ |
| AC-8-4 | 配置表单字段 + 保存 | ✅ |
| AC-8-5 | 测试连接端点 | ⏭️ 推迟（无热重载） |
| AC-8-6 | 平台状态指示器 | ✅ |
| AC-8-7 | 重启提示 UX | ✅ |
| AC-8-8 | 敏感字段遮罩 | ✅ |

### 测试结果

```
pnpm test                               # 5528 passed, 0 failed ✅
pnpm check (biome)                      # 0 errors on changed files ✅
pnpm -r build                           # exit 0 ✅ (API + Web + Shared)
```

### 浏览器实测证据

在 feature worktree 启动 dev server（3011/3012 端口），Playwright 截图验证：
- Tab 1 系统对话中心：正常展示空态消息
- Tab 2 平台配置：三平台卡片，飞书显示「已配置」
- 飞书卡片展开：三步引导 + 配置表单 + 敏感值遮罩 + 外部文档链接

### 相关文档

- Feature: `docs/features/F088-multi-platform-chat-gateway.md`（Phase 8 AC 详见）
- Design: `designs/f088-im-hub-config-wizard-ux.pen`（Screen C）
