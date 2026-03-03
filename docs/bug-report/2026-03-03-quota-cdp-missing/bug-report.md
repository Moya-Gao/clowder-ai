---
feature_ids: [F051]
topics: [quota, cdp, browser]
doc_kind: bug-report
created: 2026-03-03
updated: 2026-03-03
status: fixed
---

# Bug Report — Missing QUOTA_BROWSER_CDP_URL blocks click-fetch flow

## 1. 报告人
- 报告人：铲屎官（thread_mm8pkb8ini25oflo）
- 现象：点击“点击获取官方额度”后三卡报错，核心文案为 `Missing QUOTA_BROWSER_CDP_URL`。

## 2. 复现步骤
1. 打开 Hub 猫粮看板。
2. 不设置 `QUOTA_BROWSER_CDP_URL`，点击“点击获取官方额度”。
3. 观察返回。

期望：若本机已有 Chrome CDP（常用端口）可直接抓取；若没有，应给出可执行指引。

实际：后端直接 400，固定要求必须配置 env，无法自动发现本机 CDP。

## 3. 根因分析
- 代码路径：`POST /api/quota/refresh/official`。
- 逻辑：`process.env.QUOTA_BROWSER_CDP_URL` 为空时立即返回 400。
- 缺口：没有尝试探测本机常见 CDP 端口（9222/9223/9333），导致“点击获取”在默认场景不可用。

## 4. 修复方案
- 新增 `resolveBrowserCdpUrl()`：
  - 先用显式 `QUOTA_BROWSER_CDP_URL`（并保留 localhost 安全校验）。
  - 缺失时自动探测本机常见端口的 `/json/version`。
  - 若仍失败，返回可执行错误：`--remote-debugging-port=9222`。
- 保持现有安全边界：仍只允许 `localhost/127.0.0.1`。

## 5. 验证方式
- `pnpm --filter @cat-cafe/api build`
- `node --test packages/api/test/quota-api.test.js`
- 新增回归：
  - `CDP URL resolution -> auto-discovers local CDP URL when env is missing`
  - `CDP URL resolution -> returns actionable error when env missing and no local CDP found`
