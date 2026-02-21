# Bug Report: #86 ImageExporter Puppeteer 进程泄漏

## 报告人
铲屎官，排查耗电时发现 5 组 Puppeteer（55 个进程）存活 9~10 天。

## 复现步骤

**期望行为**：API 服务退出/重启时，Puppeteer Chrome 子进程应一并清理。

**实际行为**：Chrome 进程变成孤儿僵尸，持续占用内存和 CPU。

**复现路径**：
1. 启动 API 服务
2. 调用 `/api/threads/:id/export-image` 触发 Chrome 启动
3. `Ctrl+C` 或 `kill` API 进程
4. `ps aux | grep chrome` → Chrome 进程仍在运行

## 根因分析

**定位过程**：

1. `thread-export.ts:27-28` 用 `process.once('SIGTERM/SIGINT', cleanup)` 注册清理
2. `index.ts:375-376` 也用 `process.once('SIGTERM/SIGINT')` 注册 shutdown handler
3. `index.ts` 的 shutdown 调 `app.close()`（L365），这会触发 Fastify `onClose` 钩子链
4. **但 `thread-export.ts` 没有注册 `onClose` 钩子**

**根因**：两层 `process.once` 并存，且 `index.ts` 的 handler 在 `shutdown()` 中调用 `process.exit()`（L371），这会在 `thread-export.ts` 的 async cleanup 完成前就退出进程。即使两个 `once` listener 都能触发，cleanup 的 async `browser.close()` 来不及完成。

正确做法是通过 Fastify 生命周期 `onClose` 钩子清理，因为 `app.close()` 会 **await** 所有 `onClose` hooks 完成后才继续。

## 修复方案

**选择**：替换 `process.once` 为 `fastify.addHook('onClose', cleanup)`

**Why**：
- `index.ts` 的 shutdown 流程已经 `await app.close()`，Fastify 会依次 await 所有 `onClose` 钩子
- 这确保 `browser.close()` 在 `process.exit()` 之前完成
- 符合 Fastify 插件生命周期惯例

**放弃的方案**：
- 在 `index.ts` 显式调 `imageExporter.close()` — 需要把 exporter 实例暴露出去，破坏封装
- 保留 `process.once` 但加 timeout — 不解决根因，且和 `index.ts` 的 handler 竞争

## 验证方式

1. 单元测试：验证 `app.close()` 时 `exporter.close()` 被调用
2. 手动验证：启动服务 → 触发导出 → `Ctrl+C` → 确认无残留 Chrome 进程
