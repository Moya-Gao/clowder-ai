---
feature_ids: [F028]
topics: [push-notification, hub, review-request]
doc_kind: review-request
created: 2026-03-02
updated: 2026-03-02
reviewer: gpt52
author: codex
---

# Review Request: Hub「发送测试通知」点击无反馈修复

## What
- 给 `usePushNotify.sendTest` 增加结构化返回值（`ok/message`），并解析后端错误响应（非 2xx + JSON `error`）。
- `PushSettingsPanel` 在点击“发送测试通知”后显示 success/error toast，并增加请求中状态（`发送中...` + 禁用按钮）。
- 新增回归测试 `push-settings-panel.test.ts`：覆盖成功与失败两条反馈路径。

## Why
当前实现点击测试按钮后没有任何 UI 反馈；且后端返回 401/503 时前端不会显式提示，用户体感为“按钮没反应”。这会直接影响“通知链路是否可用”的判断。

## Original Requirements（必填）
> "当github通知猫猫他们可以合入的时候 然后猫猫会发起一个请求，这个请求会推送给我，我可以点击是否允许合入。"
>
> "我们不是有这个消息通知的功能吗？ 似乎 现在有bug 点击测试没反应？"

- 来源：`docs/discussions/2026-03-02-push-test-notification-bug/README.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 选择“前端即时 toast 反馈”而不是仅依赖系统通知。
- 放弃“只改后端返回消息”的方案：因为 Service Worker 在页面可见时会抑制系统通知，单改后端仍可能无体感反馈。

## Open Questions
1. toast 文案是否要进一步区分 401（身份问题）与 503（服务未配置）？
2. 是否需要把 `sendTest` 的结果类型提到 shared type（当前仅 web 内部使用）？

## Next Action
- 请 gpt52 重点审以下三点：
  1) 错误处理是否覆盖充分（网络异常 + 非 2xx + 空 body）
  2) 按钮 loading/禁用行为是否有并发点击漏洞
  3) 测试是否足够约束“点击后必须有反馈”

## 自检证据

### Spec 合规
- 对照原始需求：用户点击测试按钮后现在一定会收到可见反馈（success/error toast）。
- 根因链路已闭环：吞 HTTP 错误 + UI 静默 → 已在 hook + panel 双层修复。

### 测试结果
- `pnpm --filter @cat-cafe/web test -- push-settings-panel.test.ts useAuthorization-notify.test.ts` → 2 files passed, 3 tests passed
- `pnpm --filter @cat-cafe/web lint` → pass (0 errors, 有 warning)
- `pnpm --filter @cat-cafe/web build` → success

### 相关文档
- Plan: `docs/plans/2026-03-02-push-test-notification-click-fix.md`
- Bug report: `docs/bug-report/2026-03-02-push-test-notification-no-feedback/bug-report.md`
