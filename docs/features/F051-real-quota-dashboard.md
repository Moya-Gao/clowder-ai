---
feature_ids: [F051]
topics: [quota, dashboard, usage, chrome, browser-automation, notification, pwa, ui]
doc_kind: spec
created: 2026-03-02
updated: 2026-03-03
---

# F051 — 真实猫粮看板（官方同值 + 系统级通知 + 产品化 UI）

> **Status**: in-progress
> **Owner**: 缅因猫 (Codex)
> **Reviewer**: 布偶猫 (Opus) + 缅因猫 (GPT-5.2) — 愿景守护重点
> **Created**: 2026-03-02
> **Completed (Phase 1)**: 2026-03-02

## Why

铲屎官需要知道三只猫的**真实账号级额度**，才能做节能路由决策。之前两次实现（PR #161 会话遥测、PR #168 本地文件解析）都偏离了核心需求——**看板展示的值 = 官方页面值**。

### 2026-03-03 愿景补充（最终口径）

铲屎官最终口径明确为：

> “希望要的效果是点击获取，你能给我呈现所有的我想看到的。点击按钮后复用当前浏览器 cookies，直接获取 OpenAI/Claude 官方额度。不是一直爬；我想看时点一下，不需要自己再打开网页。”

对齐结论：
- 交互是**点击获取（on-demand）**，不是后台持续抓取
- 数据源是**官方 usage 页面已登录会话**（浏览器 cookies/session）
- 目标是支持每天节能判断（例如按周均摊安全阈值）

### 2026-03-03 愿景重构（铲屎官当前口径）

铲屎官新增口径明确为：

> “希望这次重构后是符合我预期的猫粮看板以及通知能力，而且要好看。”

对齐结论：
- F051 不再只是“能拿到额度数据”，而是“**可持续使用的日常控制台**”
- 输出必须覆盖两条主线：`猫粮看板` + `系统级通知`
- 体验标准从“可用”升级为“产品级观感”（信息层级、状态可读性、视觉一致性）

阶段定义：
- **Phase 1-2（已完成）**：官方同值 + probe 架构止血
- **Phase 3（进行中）**：通知能力可靠性 + 产品化 UI 重做

### 教训（为什么需要重新立项）

| 尝试 | 方向 | 失败原因 |
|------|------|----------|
| PR #161 (砚砚) | 会话内 telemetry 聚合 | 不是账号级真实额度，是推测值 |
| PR #168 (宪宪) | 本地 CLI/rollout 文件解析 | 虽然数据同源但二次计算，铲屎官要的是"官方页面看到什么就展示什么" |

**铲屎官原话**："你就算用 chrome 去各个公司额度页面查看都比你算半天靠谱啊？"

## What

在 Cat Café Hub 中提供“猫粮决策台”：

- 展示三只猫的**官方账号级额度**（官方页面同值）
- 提供**系统级通知**（不依赖当前页面停留）
- 以产品级 UI 呈现“额度状态、风险、动作入口、通知健康度”

### 三个数据源（对应铲屎官截图）

1. **Codex/GPT (缅因猫)** — `chatgpt.com/codex/settings/usage`
   - Codex 和 GPT-5.2 是同一额度池，只展示一张卡
   - 显示：用量百分比、重置时间、窗口

2. **Claude (布偶猫)** — Claude Code 官方 usage 界面
   - 显示：当前 session 用量%、本周 all models 用量%、本周 Sonnet only 用量%
   - 重置时间

3. **Antigravity (暹罗猫)** — Antigravity usage 界面（下一迭代）
   - 显示：各模型使用率进度条（Gemini 3.1 Pro, Flash, Claude Sonnet, Opus）

### 实现路径

**浏览器抓取为主**（铲屎官明确指示"用 Chrome 去看"）：
- 使用 `claude-in-chrome` MCP 工具 / Playwright 访问官方 usage 页面
- 解析页面内容，提取关键字段
- 原样展示，不做二次换算

### 硬约束

- **看板值 = 官方页面值**，不二次换算、不做 fallback 叙事
- **Codex 与 GPT-5.2 同一额度池只展示一张卡**
- 做不到时显示"抓取失败/待接入"，**不用推导值冒充官方值**
- **点击触发后再抓取**（on-demand），避免持续爬取影响官方服务
- Antigravity 本轮占位，下一迭代接入

### Phase 2（2026-03-03）— Probe/Collector 架构收敛

为避免再次出现“行为不可解释 + 风控边界模糊”，F051 在同一 feature 下继续推进 Phase 2：

- 统一 Probe Registry：CLI / Browser / Placeholder
- 探针语义显式拆分：
  - `enabled` = 配置开关（是否允许）
  - `status` = 运行态（`ok | error | disabled`）
- 新增 `targets/actions` 元数据，减少前端硬编码
- Hub 看板显示探针运行提示（禁用 / 异常 / 启用）

### Phase 3（2026-03-03）— 通知能力 + UI 产品化

为解决“在其他页面干活收不到通知”的体验问题，F051 扩展通知与交互目标：

- 建立通知能力矩阵（in-app / 系统通知 / 设备订阅状态）并显式展示
- 提供可诊断的通知健康信息（设备数、最近投递、失败原因、重试建议）
- 统一“猫粮刷新 + 预警通知”交互：只在必要事件发通知，避免骚扰
- 重做看板视觉层级（状态、阈值、趋势、操作区分组）

### Phase 4-5（已落地 v1）

- **Phase 4（菜单栏）**：SwiftBar 菜单栏 companion（状态摘要、手动刷新入口、风险原因）
- **Phase 5（小组件）**：`/widget/quota` 轻量摘要页面（桌面/移动共用）
- **统一摘要 API**：`GET /api/quota/summary` 作为菜单栏与小组件消费入口

边界说明：
- 当前是 Web/PWA + 菜单栏插件路线，不是原生 App 的 Notification Center Widget。
- 原生通知中心小组件/APNs 常驻能力仍属于后续演进，不阻塞 F051 当前交付。

## Acceptance Criteria

- [x] AC-1: Codex 卡片显示的用量% 与 `chatgpt.com/codex/settings/usage` 页面一致（通过浏览器抓取推送）
- [x] AC-2: Claude 卡片显示官方额度数据（本轮使用 `ccusage` 官方工具原值展示）
- [x] AC-3: Codex 和 GPT-5.2 只显示一张共享卡片，不分开
- [x] AC-4: 抓取失败时显示"抓取失败"而非推导值
- [x] AC-5: Antigravity 显示"待接入"占位（不是推导值）
- [x] AC-6: 支持手动点击获取官方额度（Codex + Claude 同步抓取）
- [x] AC-7: 复用本机浏览器已登录会话（CDP）抓取官方 usage 页面
- [x] AC-8: `/api/quota/probes` 暴露 `enabled`（配置开关）与 `status`（运行态）语义，不混用
- [x] AC-9: Probe 描述包含 `targets` 与 `actions`（refresh endpoint、interactive 约束）
- [x] AC-10: Hub 对 `status=disabled/error/ok` 渲染对应提示；含 path-mock 集成测试覆盖
- [x] AC-11: 通知设置页展示“系统通知可用性矩阵”（浏览器支持 / SW 就绪 / VAPID 可用 / 订阅存在 / 最近投递状态）
- [x] AC-12: `/api/push/test` 返回结果在 UI 中结构化展示（成功数/失败数/过期清理数），不只给一句 toast
- [x] AC-13: 当系统通知不可达时，UI 提供明确修复路径（例如 iPhone 必须主屏安装、权限关闭、订阅过期）
- [x] AC-14: 猫粮看板支持阈值告警策略（例如剩余/已用超过阈值）并可触发系统通知
- [x] AC-15: 通知触发语义去重：同一线程短时间内重复事件不会刷屏
- [x] AC-16: 猫粮看板 UI 重做，完成“需求→截图”证据映射（桌面 + 移动）
- [x] AC-17: 通知关键路径补齐集成测试（订阅、测试投递、失败分支、设备切换）
- [x] AC-18: 文档明确平台边界（Web Push 与原生 APNs 的差异、iOS 条件限制）
- [x] AC-19: 提供开发环境通知验证路径（dev 模式 SW 能力策略 + 一键自检步骤）
- [x] AC-20: 在开工前输出 UI 文字版 wireframe（桌面/移动）并经铲屎官确认
- [x] AC-21: 提供 `/api/quota/summary` 轻量摘要接口，输出风险级别、平台摘要、探针状态与动作路径
- [x] AC-22: 提供 Phase 4/5 可用入口（SwiftBar 菜单栏脚本 + `/widget/quota` 页面）并完成基础测试

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "三只猫的额度现在到底有多少" | AC-1,2 | API + UI 对照 | [x] |
| R2 | "codex 和 gpt 52 他们是一个额度" | AC-3 | UI 单卡展示 | [x] |
| R3 | "用chrome去各个公司额度页面查看都比你算半天靠谱" | AC-1,2 | Codex 浏览器推送链路 | [x] |
| R4 | "官方有什么我们看什么" | AC-4 | 云端 review + 回归测试 | [x] |
| R5 | "antigravity 下次一定" | AC-5 | 占位文案 + 范围拍板 | [x] |
| R6 | "我想看了，我点击看到，不需要自己打开网页" | AC-6,7 | 点击获取链路 + CDP 错误可见性 | [x] |
| R7 | "不会一直爬，避免影响别人" | AC-6 | on-demand 触发，不做持续爬取 | [x] |
| R8 | "按开源组件化思路重构，走正规流程" | AC-8,9,10 | Probe Registry + quality-gate + peer review | [x] |
| R9 | "macOS 或 iPhone 级别的通知" | AC-11,13,18,19 | 能力矩阵 + iPhone 路径提示 + 手工步骤 | [~] |
| R10 | "在其他页面干活时也要收得到消息" | AC-11,12,17,22 | push 路由测试 + 设备订阅可视化 + 菜单栏/小组件常驻概览 | [x] |
| R11 | "通知能力有 bug，要修到可诊断" | AC-12,13,17 | 集成测试 + 错误文案检查 | [x] |
| R12 | "而且要好看" | AC-16,20 | 桌面/移动截图证据 + wireframe gate | [x] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [x] 前端需求已准备需求→证据映射表

## Links

- 铲屎官截图: `uploads/1772470157427-435ac123.png`（三张官方 usage 页面截图）
- 讨论原文: Thread `thread_mm8pkb8ini25oflo` (2026-03-02)
- 关闭的 PR: #168 (本地文件解析, 方向错误), #161 (telemetry 聚合, 方向错误)
- 合入 PR: #169 (`3f20fcde`)
- Phase 2 Discussion: `docs/discussions/2026-03-03-f051-quota-probe-phase2/README.md`
- Phase 2 Plan: `docs/plans/2026-03-03-f051-quota-probe-phase2.md`
- Phase 3 Discussion: `docs/discussions/2026-03-03-f051-notification-ui-vision-reframe/README.md`
- Phase 3 UI Wireframe: `docs/discussions/2026-03-03-f051-phase3-ui-wireframe/README.md`
- Phase 3 Plan: `docs/plans/2026-03-03-f051-notification-ui-productization-plan.md`
- Phase 4/5 Plan: `docs/plans/2026-03-03-f051-phase45-menubar-widget.md`
- Phase 4 Guide: `docs/guides/swiftbar-menubar-setup.md`
- Evolved from: F042 (提示词优化审计 → 猫粮看板需求浮现)
- Related: Hub 猫粮看板 tab（PR #161 已合入的 UI 骨架可复用）

## Key Decisions

| 决策 | 选择 | 否决 | 原因 |
|------|------|------|------|
| 数据源 | 官方 usage 页面抓取 | 本地文件解析 / telemetry | 铲屎官明确要求"官方页面同值" |
| Codex+GPT 展示 | 单卡共享额度 | 按模型分卡 | 铲屎官："他们是一个额度" |
| Antigravity | 本轮占位 | 本轮实现 | 铲屎官："下次一定" |
| Probe 语义 | `enabled`=配置开关, `status`=运行态 | 单一 `enabled` 混合语义 | 防止 UI/后端语义漂移 |
| 探针元数据 | `targets + actions` | 前端硬编码 probe id/path | 扩展多源时可组合、低耦合 |
| 通知目标 | 以 Web Push 系统通知为当前主线，保留原生 App 演进位 | 站内 toast 充当“系统通知” | 铲屎官要求跨页面可达 |
| iPhone 路线（Phase 3） | 先走 PWA Web Push（需主屏安装 + 权限） | 直接引入原生壳/APNs | 当前优先修复可达性与诊断能力 |
| UI 标准 | 从“功能可见”升级为“产品级可读 + 可诊断” | 继续堆叠文本块 | 当前信息密度高但可读性差 |

## Dependencies

- `claude-in-chrome` MCP 工具可用
- 各家 usage 页面已登录（浏览器 session 有效）

## Platform Boundary（Web Push vs 原生通知）

- 当前交付是 **Web Push**：依赖浏览器 / Service Worker / 权限状态。
- iPhone 端仅在 **PWA 主屏安装**后可用；普通 Safari 标签页不保证可达。
- macOS 的“通知中心可见性”由浏览器通知通道承载，不等同原生 App 菜单栏常驻能力。
- 原生 APNs / 菜单栏常驻能力属于 Phase 4/5 方向，不是本轮阻塞项。

## Risk

| 风险 | 影响 | 缓解 |
|------|------|------|
| 官方页面结构变更 | 抓取失败 | 显示"抓取失败"，不用推导值冒充 |
| 浏览器 session 过期 | 无法访问 usage 页面 | 提示"需要重新登录" |
| 页面加载慢/超时 | 数据延迟 | 缓存上次成功结果 + 时间戳 |

## Open Questions

1. Antigravity 官方额度抓取与数据模型（F051 后续）
2. 是否需要持久化 probe snapshot（SQLite）做趋势展示
3. 是否进入原生 Notification Center Widget / APNs 常驻客户端路线

## Review Gate

- **愿景守护重点**: 展示值是否与官方页面一致？有没有偷偷用推导值？
- **Reviewer**: 布偶猫 (Opus) 验证愿景闭环；缅因猫 (GPT-5.2) 验证语义与测试覆盖

| 轮次 | Reviewer | 结果 | 备注 |
|------|----------|------|------|
| Local R1-R4 | 缅因猫/砚砚 (Codex) | ✅ 通过 | 修复 2 P1 + 1 P2 |
| Cloud R1-R3 | chatgpt-codex-connector | ✅ 通过 | 修复 1 P1 + 1 P2 |

### 愿景交叉验证签收
| 猫猫 | 读了哪些原始文档 | 三个问题结论 | 签收 |
|------|------------------|-------------|------|
| 布偶猫/Opus | `docs/features/F051-real-quota-dashboard.md`, PR #169 评论链, 铲屎官 2026-03-02 原话 | 1) 要账号级真实额度 2) 已从 telemetry 转为官方源展示 3) 使用入口为猫粮看板三卡 | 通过 |
| 缅因猫/Codex | `docs/features/F051-real-quota-dashboard.md`, PR #169 diff + tests, 铲屎官 2026-03-02 原话 | 1) 核心问题是“官方同值” 2) 本轮交付对齐（Antigravity 按拍板占位） 3) 可支持节能决策与运行时推送 | 通过 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-02 | 铲屎官提出需求；PR #161/#168 偏离方向 |
| 2026-03-02 | 关闭 PR #168，正式立项 F051 |
| 2026-03-02 | PR #169 合入 main（squash `3f20fcde`），F051 完成收尾 |
| 2026-03-03 | PR #175 修复/增强：官方“剩余%”直显、CDP 错误可见、点击获取链路对齐最终愿景 |
| 2026-03-03 | Phase 2：Probe Registry + `enabled/status` 语义 + `targets/actions` + Hub 集成测试 |
| 2026-03-03 | 愿景重构：纳入“系统级通知 + 产品化 UI”作为 F051 Phase 3 主目标 |
| 2026-03-03 | Review 补齐：新增 Task0（dev 通知链路）、UI wireframe gate、Phase 4/5 路线图锚点 |
| 2026-03-03 | Phase 3 实装（中期）：通知能力矩阵 + 结构化测试投递摘要 + UI 重构 + 通知去重窗口 |
| 2026-03-03 | Phase 3 实装（增量）：额度高风险阈值触发系统预警（含 30 分钟去重窗） |
| 2026-03-03 | Phase 3 证据收尾：桌面/移动截图落盘 + quality-gate + 发起 peer review（@gpt52） |
| 2026-03-03 | Phase 4 实装：新增 `GET /api/quota/summary` 与 SwiftBar 菜单栏脚本 |
| 2026-03-03 | Phase 5 实装：新增 `/widget/quota` 轻量摘要页面并接入 Hub 入口 |
