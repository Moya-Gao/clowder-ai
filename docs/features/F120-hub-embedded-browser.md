---
feature_ids: [F120]
related_features: [F063, F089]
topics: [hub, ux, browser, preview, dev-server, frontend]
doc_kind: spec
created: 2026-03-14
---

# F120: Hub Embedded Browser — 在 Hub 内嵌浏览器预览运行中的前端应用

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

## Why

铲屎官截图展示了 Claude Code 的 embedded browser panel：猫猫跑 `pnpm dev` 后，旁边直接嵌一个浏览器看 `localhost:3847` 的完整应用，改代码 → HMR 热更新 → 浏览器实时刷新。

Cat Café 目前的差距：

1. **F063 AC-5 只做了静态渲染**：单文件 HTML/JSX 通过 esbuild-wasm + iframe sandbox 渲染，不是运行中的应用
2. **看前端效果要切浏览器**：猫猫在 worktree 写前端代码，铲屎官想看效果必须切到 Chrome 打开 localhost——这和 F063 愿景（"不用打开 IDE 也能协作"）同源，但 scope 是全新的
3. **F089 Terminal 已有**：猫猫可以在 Hub 里跑 `pnpm dev`，但跑起来后看不到效果，体验断裂

铲屎官原话（2026-03-14）：
> "我想要的其实是这个能力"（指 Claude Code 截图中的 embedded browser）
> "让你们把前端启动起来，你们能在这里直接看到"
> "a + b，按照咱的家规，我们要面向最终的状态开发"

## What

### Phase A: Embedded Browser Panel（P0 — 核心能力）

在 Hub 右侧（复用 F063 workspace 面板区域或新增 tab）嵌入一个浏览器 panel，能访问 `localhost:xxxx` 的运行中应用：

1. **浏览器 Panel**
   - iframe 或 WebView 嵌入，显示指定 `localhost:port` 的页面
   - 支持基础浏览器交互：点击、滚动、表单输入、导航
   - URL 栏可手动输入/修改地址
   - 刷新按钮、前进/后退导航
   - 响应式：panel 宽度变化时页面自适应（或可切换 viewport 尺寸模拟移动端）

2. **端口自动发现**
   - 猫猫在 F089 Terminal 里跑 `pnpm dev` / `npm start` / `vite` 等 → 检测到新的 listening port
   - Hub 弹出提示："检测到 localhost:3847 启动，是否预览？"
   - 点击确认 → 自动打开 browser panel 并加载该地址
   - 多端口场景：前端 3001 + 后端 3000 → 列表选择

3. **HMR/Live Reload 支持**
   - WebSocket 穿透：dev server 的 HMR WebSocket 连接必须正常工作
   - 猫猫改代码 → dev server 热更新 → browser panel 内页面实时刷新
   - 不需要手动刷新（但也提供手动刷新按钮兜底）

4. **与 Workspace 联动**
   - browser panel 和 file explorer 可同时打开（三栏：聊天 | 文件 | 浏览器，或 tab 切换）
   - 猫猫说"看看首页效果"→ 自动切到 browser panel

### Phase B: 安全与隔离（P0 — 与 Phase A 并行）

1. **端口白名单**
   - 只允许访问 `localhost` / `127.0.0.1`，不允许访问外部 URL
   - 可配置允许的端口范围（默认 3000-9999）
   - 禁止访问 Cat Café 自身的 API 端口（防止 CSRF/token 泄漏）

2. **iframe sandbox 策略**
   - `sandbox="allow-scripts allow-forms allow-same-origin"` 基础策略
   - CSP header 限制：只允许 localhost 资源
   - 阻止 iframe 内页面访问 parent window（Hub）的 DOM/Cookie/Storage

3. **审计**
   - `browser_preview_open / close / navigate` 事件记录（threadId、port、url）

### Phase C: 增强体验（P1 — Phase A 稳定后）

1. **DevTools 精简版**
   - Console 输出面板：显示 iframe 内页面的 console.log/warn/error
   - Network 概览：请求列表（URL、状态码、耗时）
   - 不做完整 DevTools，够定位问题即可

2. **截图与分享**
   - 一键截图当前 browser panel 内容
   - 截图自动附到对话中（复用 F060 图片能力）
   - 铲屎官可以在截图上标注"这里有问题"

3. **多 Tab 浏览**
   - 同时打开多个 localhost 页面（前端 + 后端 Swagger 等）
   - Tab 切换，每个 tab 独立 URL 和状态

## Acceptance Criteria

### Phase A（Embedded Browser Panel）
- [ ] AC-A1: Hub 内可打开一个 browser panel，输入 `localhost:xxxx` 后显示运行中的页面
- [ ] AC-A2: 猫猫在 Terminal（F089）启动 dev server 后，Hub 自动检测端口并提示预览
- [ ] AC-A3: dev server HMR 热更新在 browser panel 内正常工作（改代码 → 页面自动刷新）
- [ ] AC-A4: browser panel 有 URL 栏、刷新、前进/后退基础导航控件
- [ ] AC-A5: browser panel 和 workspace file explorer 可同时可见或 tab 切换

### Phase B（安全与隔离）
- [ ] AC-B1: browser panel 只能访问 localhost，尝试访问外部 URL 被拦截
- [ ] AC-B2: iframe 内页面无法访问 Hub 的 Cookie/Storage/DOM
- [ ] AC-B3: 禁止访问 Cat Café 自身 API 端口（可配置排除列表）

### Phase C（增强体验）
- [ ] AC-C1: browser panel 下方可查看页面的 console 输出
- [ ] AC-C2: 一键截图 browser panel 并附到聊天消息
- [ ] AC-C3: 支持同时打开多个 localhost tab

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "让你们把前端启动起来，你们能在这里直接看到" | AC-A1, AC-A3 | manual: Hub 内看到运行中的前端页面 | [ ] |
| R2 | "跟 Claude Code 这样能够有一个浏览器能够直接预览前端的能力" | AC-A1, AC-A4 | manual: embedded browser 有基础导航控件 | [ ] |
| R3 | "a + b，面向最终的状态开发" — 自动检测 + 手动输入都要 | AC-A2, AC-A4 | manual: 自动检测弹提示 + 手动输入 URL 都能打开 | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求→证据映射表（若适用）

## Dependencies

- **Related**: F063（Workspace Explorer — 文件浏览/静态预览基础设施，browser panel 复用面板区域）
- **Related**: F089（Hub Terminal & tmux — dev server 在 terminal 里启动，端口发现依赖 terminal 进程感知）

## Risk

| 风险 | 缓解 |
|------|------|
| iframe 同源策略阻止 localhost 页面加载 | Hub 本身也跑在 localhost，同源；如端口不同需后端反向代理 |
| HMR WebSocket 被 iframe sandbox 阻断 | 测试 `allow-same-origin` 策略是否足够；不够则走后端 WebSocket 代理 |
| dev server 的 CORS 策略拒绝 iframe 嵌入 | 需要 dev server 配置 `X-Frame-Options` / CSP 允许被嵌入，或后端代理绕过 |
| 端口自动发现误报（非 dev server 的进程） | 端口检测 + 进程名匹配（node/vite/next）双重过滤 |
| iframe 内页面访问 Hub token 导致安全问题 | sandbox 策略 + Cookie SameSite + 排除 Cat Café API 端口 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | iframe 跨端口 localhost 是否需要反向代理？还是浏览器同源策略允许 `localhost:3001` 嵌入 `localhost:3000` 的 iframe？ | ⬜ 未定（需调研） |
| OQ-2 | 端口自动发现的技术方案：监听 terminal stdout 解析 "listening on port xxx"？还是定期扫描 `lsof -i -P`？ | ⬜ 未定 |
| OQ-3 | 布局方案：browser panel 是 workspace 的一个 tab？还是独立的第三栏？ | ⬜ 未定（需 Design Gate 讨论） |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 独立立项（不挂 F063） | F063 已关闭（23 PR），技术栈完全不同（live server vs 静态渲染），独立 scope | 2026-03-14 |
| KD-2 | 自动检测 + 手动输入都要（不拆 A/B） | 铲屎官："面向最终的状态开发"，只有其一是残缺体验 | 2026-03-14 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-14 | 铲屎官看到 Claude Code embedded browser 截图，提出需求 |
| 2026-03-14 | 确认独立立项 F120，不挂 F063 |
| 2026-03-14 | 铲屎官拍板：自动检测 + 手动输入都要，面向最终状态开发 |

## Review Gate

- Phase A: 砚砚 review 安全模型（iframe sandbox + 端口白名单）+ 烁烁 review UX
- Phase B: 砚砚 review 安全隔离策略

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F063-hub-workspace-explorer.md` | Workspace 基础设施，browser panel 复用面板区域 |
| **Feature** | `docs/features/F089-hub-terminal-tmux.md` | Terminal 能力，dev server 从这里启动 |
