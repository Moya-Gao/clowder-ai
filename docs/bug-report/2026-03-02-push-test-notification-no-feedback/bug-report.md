---
feature_ids: [F028]
topics: [push-notification, hub, ux, bugfix]
doc_kind: bug-report
created: 2026-03-02
updated: 2026-03-02
status: fixed-in-branch
---

# Bug Report: Hub「发送测试通知」点击后无可见反馈

## 1. 报告人

- 报告人：铲屎官
- 场景：Cat Cafe Hub → 通知 tab
- 反馈时间：2026-03-02
- 反馈内容：点击“发送测试通知”后看起来“没反应”

## 2. 复现步骤

1. 打开 Cat Cafe Hub，切到“通知”tab。
2. 确认状态为“已开启推送”。
3. 点击“发送测试通知”。

期望行为：
- 前端应立即给出成功/失败反馈（至少 toast），让用户知道请求结果。

实际行为：
- 页面无可见反馈，用户体感为按钮无效。

## 3. 根因分析

### 证据 1：`sendTest` 吞掉 HTTP 失败响应

`packages/web/src/hooks/usePushNotify.ts` 中：
- `sendTest` 仅 `await apiFetch('/api/push/test', { method: 'POST' })`
- 未检查 `res.ok`
- 仅在 network exception 时 `catch`

结果：后端返回 401/503/500 时，前端不会报错、不会提示。

### 证据 2：UI 没有任何状态反馈

`packages/web/src/components/PushSettingsPanel.tsx` 中：
- 点击“发送测试通知”直接触发 `sendTest`
- 没有 loading、没有 success/error 文案、没有 toast

结果：即使请求成功，当前界面仍“静默”。

### 证据 3：Service Worker 在当前页面可见时主动抑制系统通知

`packages/web/worker/index.ts` 中：
- 当存在 `visibilityState === 'visible'` 的窗口时直接 `return`
- 不会弹系统通知

结果：在 Hub 页面内点击测试时，即便后端发送成功，也可能看不到系统通知；若前端无 toast，就会被误判为“没反应”。

### 模式对照（Phase 2）

对照 `QueuePanel` 等交互：
- 成功/失败都通过 `useToastStore` 提示
- 用户操作有明确即时反馈

Push 测试按钮没有采用同样模式，是本次体验缺口。

## 4. 修复方案

- 方案：
  1. `usePushNotify.sendTest` 改为返回结构化结果（`ok/message`），并解析非 2xx 错误。
  2. `PushSettingsPanel` 在点击后显示 success/error toast，并在请求期间禁用测试按钮。

- 选择理由：
  - 保持现有后端 API 不变，改动面最小。
  - 与现有前端交互模式一致（toast 反馈）。
  - 覆盖成功与失败双路径，避免“静默失败”。

- 放弃方案：
  - 仅依赖系统通知（在可见页面会被 SW 抑制，不能单独作为反馈渠道）。

## 5. 验证方式

- 新增前端测试覆盖：
  - 点击测试通知后成功时出现 success toast
  - API 失败时出现 error toast
- 回归运行通知相关测试，确认无副作用。
