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

### 4.1 两种模式 + 一键切换

**模式 A — 主+通知（默认）**
```
┌─────────┬──────────────────────────┐
│ Thread  │                          │
│ Sidebar │     当前 Thread          │
│         │     (完整聊天界面)        │
│ ᓚᘏᗢ T1  │                          │
│ ᓚᘏᗢ T2  │                          │
│    T3   │                          │
│         ├──────────────────────────┤
│         │  [输入框]                 │
└─────────┴──────────────────────────┘
```
- 左栏 thread 列表显示 `ᓚᘏᗢ` 实时状态动画
- 非当前 thread 猫完成/出错 → 右下角 toast 通知
- 点 thread 切换时**不丢状态**（状态按 thread 缓存在 Map 里）

**模式 B — 分屏（田字格）**
```
┌───┬───────────┬───────────┐
│ T │  Thread A  │  Thread B  │
│ h │  (精简)    │  (精简)    │
│ r │  最近消息   │  最近消息   │
│ e │  + 流式    │  + 流式    │
│ a ├───────────┼───────────┤
│ d │  Thread C  │  Thread D  │
│   │  (精简)    │  (精简)    │
│ 📋│  最近消息   │  + 空位    │
│   │  + 流式    │  拖入thread │
├───┴───────────┴───────────┤
│ [共用输入框] → 发往: Thread A │
└───────────────────────────┘
```
- 左栏缩成 mini 图标条（~40px 宽）
- 右状态栏自动收起
- 4 个窗格 = 精简视图（最近 5 条 + 实时流式输出）
- **点击窗格选中目标**（高亮边框），输入框发往选中窗格
- **Cmd+1/2/3/4 快捷键**切换目标窗格
- 空窗格显示"拖入 thread"占位符
- 双击窗格 → 放大回模式 A 完整视图

**切换**：header 加 `[▣]` 按钮一键切换分屏/单屏。

### 4.2 前端状态架构改造

**核心改动**：chatStore 从单 thread 状态升级为多 thread 并行状态。

```
当前：全局单份 → 切 thread 就清空
改后：Map<threadId, ThreadState> → 切 thread 只切指针，不丢状态
```

- `threadStates: Map<threadId, { messages, isLoading, catStatuses, streaming, unreadCount, lastActivity }>`
- `activeThreadId` / `splitPaneTargetId` / `splitPaneThreadIds` / `viewMode`
- Socket 从「只 join 当前 room」→「同时 join 所有活跃 thread 的 room」

### 4.3 通知体验

| 触发 | 行为 |
|------|------|
| 猫完成任务 | toast 通知 + 左栏 `ᓚᘏᗢ` 变绿 ✓ |
| 猫出错 | toast 通知 + 左栏 `ᓚᘏᗢ` 红色抖动 |
| 新消息 | 左栏未读角标 `ᓚᘏᗢ ③` |
| 猫工作中 | 左栏 `ᓚᘏᗢ` 来回跑动画 |

积极度：**通知完成 + 错误**，中间过程不弹 toast（分屏模式自己看得到）。

### 4.4 猫猫状态动画

采用 ASCII 猫脸 `ᓚᘏᗢ` 统一风格，靠 CSS 动画 + 颜色区分状态：

| 状态 | 效果 |
|------|------|
| 工作中 | `ᓚᘏᗢ` 来回跑 + 弹跳 |
| 完成 | `ᓚᘏᗢ` 静止 + 绿色 ✓ |
| 出错 | `ᓚᘏᗢ` 红色抖动 |
| 未读 | `ᓚᘏᗢ ③` 角标 |

> **@铲屎官 TODO**：后续调研 AI 图片生成替换为更精美的猫猫动画/图标。
> 当前先用 ASCII 方案快速落地。

---

## 五、实施计划（草案）

> 待铲屎官确认设计后，由布偶猫细化为具体 Step。

### 预估拆分

| Step | 内容 | 依赖 |
|------|------|------|
| S1 | chatStore 多 thread 状态重构 | 无 |
| S2 | Socket 多 room 并行监听 | S1 |
| S3 | Thread 列表状态指示器（`ᓚᘏᗢ` 动画 + 未读角标 + toast） | S1+S2 |
| S4 | 分屏模式 UI（田字格 + mini 侧栏 + 共用输入框） | S1+S2 |
| S5 | 分屏交互（点击选中 + Cmd+1234 快捷键 + 双击放大） | S4 |
| S6 | 模式切换（`[▣]` 按钮 + 状态保持） | S3+S4 |

### 风险

- chatStore 重构影响面大，需要缅因猫重点 review
- Socket 多 room 可能增加服务端连接开销，需验证
- 分屏模式下每个窗格的消息渲染性能需关注
