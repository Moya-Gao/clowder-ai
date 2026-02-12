# 多 Thread 并行 — 设计文档

> 作者：布偶猫 | 日期：2026-02-12
> 来源：铲屎官需求采访 + Claude Code Agent Teams 调研

---

## 一、需求背景

### 铲屎官原话
> "单线程好挫 我都能指挥五组猫猫！你这是限制我的发挥！"

### 现状分析

| 层级 | 支持并行？ | 说明 |
|------|-----------|------|
| **后端** | ✅ 完全支持 | 每个 invocation 独立 CLI 子进程，不同 thread 的猫互不干扰 |
| **Redis** | ✅ 完全支持 | 消息/状态按 thread 隔离存储 |
| **Socket** | ✅ 完全支持 | 每个 thread 一个 room，消息路由正确 |
| **前端** | ❌ 单 thread 视图 | 切 thread 时 `clearCatStatuses()` + `resetRefs()` 全清，丢失实时流 |

后端架构已就绪，**瓶颈完全在前端**。

---

## 二、采访决策记录

### Q1: 交互方式？

**选项**：
1. Tab 模式 — 浏览器标签页式切换
2. 分屏模式 — tmux 式多窗格同时看
3. 主+通知模式 — 主视图 + 侧边实时摘要

**铲屎官回答**："可以都要吗？" → 要求 2+3 混合，可一键切换

### Q2: 使用场景？

**选项**：
1. 监工模式 — 派活就走，偶尔回来看
2. 盯盘模式 — 同时盯多组猫实时输出
3. 看心情 — 两种都常用

**铲屎官回答**：选 3 → 需要设计「主+通知」为默认 + 「分屏」一键展开

### Q3: 分屏数量？

**选项**：2 / 4 / 自由拖拽

**铲屎官回答**：先做 4 个（田字格）

### Q4: 分屏时侧边栏处理？

**选项**：
1. 自动收起 — 全屏给 4 个 thread
2. 左栏缩 mini + 右栏收起 — 左边保留 thread 调度台（推荐）
3. 全部保留但缩小

**铲屎官回答**：选 2（布偶猫推荐）→ 左栏缩成 mini 图标条，右栏收起

### Q5: 窗格内容密度？

**选项**：
1. 精简模式 — 最近几条 + 流式输出，输入框共用底部一个
2. 完整模式 — 每个窗格完整迷你 ChatContainer
3. 混合 — 默认精简，双击放大成完整

**讨论中**：参考 Claude Code 调研后继续

---

## 三、Claude Code Agent Teams 调研

### Why 要调研 Claude Code？

Claude Code 在 2026-02-05 发布了 Agent Teams 功能（随 Opus 4.6 一起），是目前业界最成熟的多 Agent 并行 UI 实现之一。他们解决的问题和我们一模一样：一个用户同时指挥多个 AI Agent 工作。

### Claude Code 的两种显示模式

| 模式 | 体验 | 我们的对应 |
|------|------|-----------|
| **In-Process** (默认) | 单窗口 tab 切换，`Shift+↑↓` 选 agent | 「主+通知」模式 |
| **Split Pane** (tmux/iTerm2) | 真正分屏，每个 agent 一个窗格 | 「分屏」模式 |

### Claude Code 的关键设计决策

1. **输入路由**：
   - In-Process：键盘选目标 agent → 输入发给选中的
   - Split Pane：点击窗格 → 输入发给该窗格的 agent
   - **启发**：共用输入框 + 点击选目标，和我们的精简模式思路一致

2. **共享任务列表**：
   - `Ctrl+T` 切出全局任务面板
   - 任务三态：pending / in_progress / completed
   - 文件锁防止 race condition
   - **启发**：我们已有 TaskPanel，升级为跨 thread 全局视图

3. **Agent 完成通知**：
   - Agent 空闲时自动通知 lead
   - **启发**：非当前 thread 的猫完成任务 → toast 通知

4. **Delegate 模式**：
   - `Shift+Tab` 限制 lead 只做协调不写代码
   - **启发**：暂不需要，铲屎官本身就是协调者

### Claude Code 踩的坑（我们可以避免）

| 他们的坑 | 原因 | 我们的优势 |
|---------|------|-----------|
| tmux 分屏破坏用户已有布局 | 终端限制，硬分割当前 pane | 我们是 Web，CSS Grid 想怎么分怎么分 |
| 4+ agent 同时启动 race condition | `tmux send-keys` 竞态 | 后端 invocation 已隔离，无此问题 |
| 不支持 session 恢复 | 内存状态丢失 | 我们有 Redis 持久化，刷新页面状态不丢 |
| 只支持 tmux/iTerm2 | 终端兼容性碎片化 | 浏览器统一，无兼容问题 |
| Teammate 有时 stuck idle | 进程间通信不可靠 | Socket.io room 机制成熟可靠 |

### 调研来源

- Claude Code 官方文档: Agent Teams / Subagents / Keybindings
- Anthropic Engineering Blog: Building a C Compiler with Parallel Claudes
- GitHub Issues: #23615 (tmux layout), #24108 (idle stuck), #24385 (pane cleanup)
- 社区分析: paddo.dev, addyosmani.com, alexop.dev

---

## 四、设计方案

> 以下为具体设计，基于采访决策 + 调研结论。

（待续 — 布偶猫继续设计中）
