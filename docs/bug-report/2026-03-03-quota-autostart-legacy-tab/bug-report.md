---
feature_ids: [F051]
topics: [quota, browser, hub-tab, usability]
doc_kind: bug-report
created: 2026-03-03
updated: 2026-03-03
status: fixed
---

# Bug Report — Quota browser auto-start is too permissive and legacy tab hides board

## 1. 报告人
- 报告人：铲屎官（thread_mm8pkb8ini25oflo）
- 现象：间歇性拉起浏览器像在抓猫粮；Hub 里看板又看不见。

## 2. 复现步骤
1. 某些调用方触发 `POST /api/quota/refresh/official`（非手动按钮语义）。
2. 在 `QUOTA_BROWSER_CDP_URL` 未配置或端口不可用时，后端尝试自动拉起隔离浏览器。
3. 同时若前端仍用旧入口 `tab=quota` 打开 Hub，会回退到 `cats`，用户看不到猫粮看板。

期望：
- 默认禁止官方额度抓取，避免任何定时/误触触发风控。
- 只有明确恢复开关并由手动点击触发时才允许抓取。
- 旧 `tab=quota` 入口应兼容映射到猫粮看板。

实际：
- refresh 接口在未设置总开关时仍可走抓取链路，存在被误触发风险。
- auto-start 默认允许，导致非交互调用也可能拉起浏览器。
- `tab=quota` 不是有效 tab，Hub 回退到 `cats`，看板不可见。

## 3. 根因分析
- `packages/api/src/routes/quota.ts`：缺少“官方抓取总开关”，接口默认可执行。
- `packages/api/src/routes/quota.ts`：`autoStartOnMissing` 仅由环境变量控制（默认开启），未区分请求是否来自用户交互。
- `packages/web/src/components/CatCafeHub.tsx`：缺少 legacy tab 映射，`quota` 作为旧值会被判定为 invalid 并回退。

## 4. 修复方案
- API：新增总开关 `QUOTA_OFFICIAL_REFRESH_ENABLED`，默认关闭；未开启时 `POST /api/quota/refresh/official` 直接返回 503，不进入抓取流程。
- API：新增显式交互标志（`interactive`），仅在 `interactive=true` 时允许 auto-start。
- Web：点击“获取官方额度”时携带 `interactive: true`。
- Hub：添加 `quota -> routing` 兼容映射，确保旧入口仍可看到猫粮看板。

## 5. 验证方式
- `pnpm --filter @cat-cafe/api build`
- `node --test packages/api/test/quota-api.test.js`
- `pnpm --filter @cat-cafe/web test -- cat-cafe-hub-quota-tab hub-quota-board-v2`
