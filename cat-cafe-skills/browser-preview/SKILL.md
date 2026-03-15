---
name: browser-preview
description: >
  Hub 内嵌浏览器预览 localhost 应用。
  Use when: 写前端代码、跑 dev server、需要看页面效果、调 UI、铲屎官说"看看效果"。
  Not for: 后端纯 API 开发、不涉及页面的工作。
  Output: 前端页面在 Hub browser panel 中实时预览。
triggers:
  - "看效果"
  - "看看页面"
  - "preview"
  - "浏览器预览"
  - "打开浏览器"
  - "pnpm dev"
  - "dev server"
  - "localhost"
  - "前端效果"
  - "看看 UI"
  - "HMR"
  - "热更新"
---

# Browser Preview

Hub 内置了嵌入式浏览器面板（F120），可以直接预览运行中的 localhost 应用。猫猫写完前端代码不用让铲屎官切浏览器看效果。

## 工作流

1. **在 Terminal 启动 dev server**（`pnpm dev` / `npm start` / `vite` 等）
2. **Hub 自动检测端口** → 弹出 toast 提示"检测到 localhost:xxxx 启动"
3. **点击 Open Preview** → 自动打开 browser panel 并加载页面
4. **也可以手动**：切到 workspace 的 Browser tab，输入 `localhost:port` 按 Go

改代码 → HMR 热更新 → browser panel 内页面自动刷新，无需手动操作。

## 技术要点（猫猫需要知道的）

| 项目 | 说明 |
|------|------|
| **Preview Gateway** | 独立端口（默认 4100），反向代理 localhost 应用 |
| **为什么不直连** | iframe 跨端口需要代理剥离 X-Frame-Options/CSP |
| **iframe sandbox** | `allow-scripts allow-forms allow-popups allow-downloads allow-same-origin`（安全：独立 origin） |
| **WebSocket/HMR** | 代理层支持 WebSocket 升级，Vite/Next/Webpack HMR 正常工作 |
| **端口排除** | Cat Cafe 自身端口（3001/3002/6398/6399/18888 等）自动排除 |
| **审计** | 每次 open/close/navigate 都有审计日志 |

## 什么时候主动用

- 写完前端组件/页面 → "让我在 browser panel 里看看效果"
- 调样式/布局 → 改代码后在 browser panel 里实时查看
- 铲屎官说"看看效果"/"给我看看" → 切到 browser panel 展示
- dev server 已在 Terminal 跑着 → 提示铲屎官可以在 Hub 里直接预览

## 不要做的事

- 不要手动去构造 gateway URL（让 Hub 前端处理）
- 不要尝试预览外部 URL（只支持 localhost）
- 不要预览 Cat Cafe 自身服务端口（会被端口验证拦截）

## 和其他 skill 的区别

| Skill | 关注点 |
|-------|--------|
| **browser-preview（本 skill）** | Hub 内预览 localhost 前端页面 |
| `tdd` | 写代码的测试驱动纪律 |
| `quality-gate` | 开发完成后的自检（含对照设计稿） |
