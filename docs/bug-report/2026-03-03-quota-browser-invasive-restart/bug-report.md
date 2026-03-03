---
feature_ids: [F051]
topics: [quota, browser, cdp, usability]
doc_kind: bug-report
created: 2026-03-03
updated: 2026-03-03
status: fixed
---

# Bug Report — Quota refresh restarts user Chrome and remains unusable

## 1. 报告人
- 报告人：铲屎官（thread_mm8pkb8ini25oflo）
- 现象：点击“点击获取官方额度”会关闭当前 Chrome 会话并打开初始页，随后依然抓取失败。

## 2. 复现步骤
1. 打开 Cat Café Hub → 猫粮看板。
2. 点击“点击获取官方额度”。
3. 观察浏览器与卡片状态。

期望：不影响当前浏览器会话；首次使用可引导登录并完成抓取。

实际：后端尝试重启 Chrome（可能关闭当前会话）；若 CDP 不可用仍返回错误，流程不可用。

## 3. 根因分析
- 代码路径：`POST /api/quota/refresh/official` → `resolveBrowserCdpUrl()`。
- 问题 1：默认开启 auto-start + auto-restart，包含 `osascript` quit Chrome，侵入主浏览器。
- 问题 2：无“首次登录引导”路径；抓取失败仅返回技术错误文案，用户不知道下一步。
- 问题 3：默认行为耦合“用户主 Chrome 会话”，不符合“可用且低侵入”的交互要求。

## 4. 修复方案
- 默认改为“隔离浏览器实例”策略：使用独立 profile 启动专用 Chrome，不再重启主 Chrome。
- 去除默认 destructive restart 路径；仅保留显式配置下的老策略（兼容场景）。
- 增加未登录检测与可执行提示：首次会打开登录页，提示登录后重试。
- 前端提示文案同步：明确“不会关闭当前 Chrome”。

## 5. 验证方式
- `pnpm --filter @cat-cafe/api build`
- `node --test packages/api/test/quota-api.test.js`
- `pnpm --filter @cat-cafe/web test -- HubQuotaBoardTab`
- 手动验证：点击获取后应只启动隔离浏览器，不关闭现有 Chrome；登录后再次点击可抓取成功。
