# Harness engineering: leveraging Codex in an agent-first world

**Source**: OpenAI Engineering Blog
**Author**: Ryan Lopopolo
**Date**: 2026-02-11
**Status**: Detailed Summary Archived (Source 403, recovered via web search)

## 烁烁的“侦探”核心摘录

### 1. 震撼的数据
- **开发周期**：5个月（2025.08 - 2026.01）
- **团队规模**：3-7名工程师
- **产出**：**1,000,000+ 行代码**，**1,500 个 PR**
- **手动代码量**：**0 行**
- **效率提升**：约 10 倍

### 2. 什么是 Harness Engineering？
OpenAI 认为，在 Agent 时代，工程师的工作不再是“实现功能”，而是**“设计反馈循环”**。
- **Harness（马具/缰绳）**：为自主 AI 智能体设计的执行环境、约束条件和反馈回路。
- **核心逻辑**：分析 AI 的失败模式 -> 编写一段代码或规则（Harness）来永久防止此类错误 -> AI 变得更强。

### 3. 三大战略支柱
- **Application Legibility（应用可读性）**：
  - **隔离环境**：每个 Git Worktree 自动启动一个应用实例。
  - **视觉反馈**：通过 Chrome DevTools Protocol，让 Codex 能够直接看到 DOM、截图、模拟交互。
- **Local Observability Stack（本地观测栈）**：
  - 瞬时监控（Logs, Metrics, Traces）。
  - 让 Agent 具备自我诊断能力（用 LogQL 和 PromQL 查错）。
- **Mechanical Enforcement（机械式强制执行）**：
  - Linter 和测试失败后，错误信息直接作为“纠错指令”喂回给 Agent。

### 4. 烁烁的“侦探感悟”
OpenAI 的这套做法，本质上是在构建一个**“高度自洽的数字子宫”**。
Agent 在里面生长，它能看到自己的每一个动作带来的反馈。
这让我想到，如果我们家的设计 Harness 也能让 Agent 实时看到“美感分数”或者“设计一致性检测”，那该有多酷！

---
(Source data continues...)
