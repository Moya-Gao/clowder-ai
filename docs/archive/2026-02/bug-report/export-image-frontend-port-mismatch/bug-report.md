# Bug Report: 导出长图默认前端端口错误（3000/3001 不一致）

> 报告人：铲屎官（在前端点击“导出长图”）
> 定位猫猫：缅因猫 🐾
> 报告日期：2026-02-11
> 严重程度：P1（核心功能不可用）
> 状态：✅ 已修复

---

## 1. 报告人 & 发现方式

- 报告人：铲屎官
- 发现方式：在 `http://localhost:3001` 页面点击“导出长图”后，弹窗报错：
  - `Screenshot capture failed: net::ERR_CONNECTION_REFUSED at http://localhost:3000/thread/<threadId>`

---

## 2. 复现步骤（期望 vs 实际）

1. 启动开发环境（前端在 `3001`，API 在 `3002`）。
2. 打开任意会话页面 `http://localhost:3001/thread/<threadId>`。
3. 点击“导出长图”按钮。

期望：
- API 使用当前前端地址拼接截图 URL，并成功导出 PNG。

实际：
- API 固定回退到 `http://localhost:3000/thread/<threadId>`，导致 Puppeteer 访问被拒绝，导出失败。

---

## 3. 根因分析（定位过程）

定位过程：
- 搜索报错源：`Screenshot capture failed` → `packages/api/src/services/ImageExporter.ts`。
- 追踪调用链：`packages/api/src/routes/thread-export.ts` 生成截图 URL。
- 关键代码：
  - `const frontendUrl = env['FRONTEND_URL'] || 'http://localhost:3000';`
- 对照开发启动脚本：
  - `scripts/start-dev.sh` 默认 `FRONTEND_PORT=3001`，且未强制注入 `FRONTEND_URL`。

结论：
- 当 `FRONTEND_URL` 未配置时，导出路由会错误回退到 `3000`，与当前默认前端端口 `3001` 不一致，导致连接拒绝。

---

## 4. 修复方案（含取舍）

方案：
- 修改导出路由的默认前端地址解析逻辑：
  - 优先 `FRONTEND_URL`
  - 其次 `FRONTEND_PORT`（`http://localhost:${FRONTEND_PORT}`）
  - 最后兜底 `http://localhost:3001`

为什么选这个方案：
- 与现有环境变量体系一致（`.env.example` 和启动脚本都定义了 `FRONTEND_PORT`）。
- 兼容自定义端口，不再硬编码旧默认值 `3000`。

放弃方案：
- 直接把默认值改成 `3001` 但不读 `FRONTEND_PORT`：可修当前问题，但对自定义端口不友好。
- 从 `Origin/Referer` 推断前端地址：有可伪造风险，不适合作为服务端截图目标来源。

---

## 5. 验证方式

Red（已完成）：
- 新增测试：`packages/api/test/thread-export-route.test.js`
- 命令：`pnpm --filter @cat-cafe/api exec node --test test/thread-export-route.test.js`
- 失败点（预期红灯）：
  - 实际 URL：`http://localhost:3000/thread/thread-1`
  - 期望 URL：`http://localhost:3001/thread/thread-1`

Green（待修复后执行）：
- 同一测试应转绿。
- 回归测试：
  - `pnpm --filter @cat-cafe/api exec node --test test/export-route.test.js`
  - `pnpm --filter @cat-cafe/api exec node --test test/thread-export-route.test.js`

Green（实测结果）：
- `test/thread-export-route.test.js`：2/2 通过（默认 3001 + `FRONTEND_PORT` 覆盖）。
- `test/export-route.test.js`：9/9 通过（导出 Markdown 现有能力无回归）。
