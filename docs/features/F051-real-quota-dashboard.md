---
feature_ids: [F051]
topics: [quota, dashboard, usage, chrome, browser-automation]
doc_kind: spec
created: 2026-03-02
updated: 2026-03-02
---

# F051 — 真实猫粮看板（官方额度同值展示）

> **Status**: done
> **Owner**: 布偶猫 (Opus)
> **Reviewer**: 缅因猫 (Codex / GPT-5.2) — 愿景守护重点
> **Created**: 2026-03-02
> **Completed**: 2026-03-02

## Why

铲屎官需要知道三只猫的**真实账号级额度**，才能做节能路由决策。之前两次实现（PR #161 会话遥测、PR #168 本地文件解析）都偏离了核心需求——**看板展示的值 = 官方页面值**。

### 教训（为什么需要重新立项）

| 尝试 | 方向 | 失败原因 |
|------|------|----------|
| PR #161 (砚砚) | 会话内 telemetry 聚合 | 不是账号级真实额度，是推测值 |
| PR #168 (宪宪) | 本地 CLI/rollout 文件解析 | 虽然数据同源但二次计算，铲屎官要的是"官方页面看到什么就展示什么" |

**铲屎官原话**："你就算用 chrome 去各个公司额度页面查看都比你算半天靠谱啊？"

## What

在 Cat Café Hub 的猫粮看板中，展示三只猫的**官方账号级额度**，数据直接来自各家官方 usage 页面。

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
- Antigravity 本轮占位，下一迭代接入

## Acceptance Criteria

- [x] AC-1: Codex 卡片显示的用量% 与 `chatgpt.com/codex/settings/usage` 页面一致（通过浏览器抓取推送）
- [x] AC-2: Claude 卡片显示官方额度数据（本轮使用 `ccusage` 官方工具原值展示）
- [x] AC-3: Codex 和 GPT-5.2 只显示一张共享卡片，不分开
- [x] AC-4: 抓取失败时显示"抓取失败"而非推导值
- [x] AC-5: Antigravity 显示"待接入"占位（不是推导值）
- [x] AC-6: 支持手动刷新（本轮范围为 Claude 刷新；Codex 由运行时推送）

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "三只猫的额度现在到底有多少" | AC-1,2 | API + UI 对照 | [x] |
| R2 | "codex 和 gpt 52 他们是一个额度" | AC-3 | UI 单卡展示 | [x] |
| R3 | "用chrome去各个公司额度页面查看都比你算半天靠谱" | AC-1,2 | Codex 浏览器推送链路 | [x] |
| R4 | "官方有什么我们看什么" | AC-4 | 云端 review + 回归测试 | [x] |
| R5 | "antigravity 下次一定" | AC-5 | 占位文案 + 范围拍板 | [x] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [x] 前端需求已准备需求→证据映射表

## Links

- 铲屎官截图: `uploads/1772470157427-435ac123.png`（三张官方 usage 页面截图）
- 讨论原文: Thread `thread_mm8pkb8ini25oflo` (2026-03-02)
- 关闭的 PR: #168 (本地文件解析, 方向错误), #161 (telemetry 聚合, 方向错误)
- 合入 PR: #169 (`3f20fcde`)
- Evolved from: F042 (提示词优化审计 → 猫粮看板需求浮现)
- Related: Hub 猫粮看板 tab（PR #161 已合入的 UI 骨架可复用）

## Key Decisions

| 决策 | 选择 | 否决 | 原因 |
|------|------|------|------|
| 数据源 | 官方 usage 页面抓取 | 本地文件解析 / telemetry | 铲屎官明确要求"官方页面同值" |
| Codex+GPT 展示 | 单卡共享额度 | 按模型分卡 | 铲屎官："他们是一个额度" |
| Antigravity | 本轮占位 | 本轮实现 | 铲屎官："下次一定" |

## Dependencies

- `claude-in-chrome` MCP 工具可用
- 各家 usage 页面已登录（浏览器 session 有效）

## Risk

| 风险 | 影响 | 缓解 |
|------|------|------|
| 官方页面结构变更 | 抓取失败 | 显示"抓取失败"，不用推导值冒充 |
| 浏览器 session 过期 | 无法访问 usage 页面 | 提示"需要重新登录" |
| 页面加载慢/超时 | 数据延迟 | 缓存上次成功结果 + 时间戳 |

## Open Questions

1. Antigravity 官方额度抓取（F052+）
2. Codex 推送入口是否需要身份签名（安全增强）

## Review Gate

- **愿景守护重点**: 展示值是否与官方页面一致？有没有偷偷用推导值？
- **Reviewer**: 缅因猫负责验证"看板值 = 官方页面值"

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
