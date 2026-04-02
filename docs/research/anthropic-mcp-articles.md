---
topics: [mcp, anthropic, research]
doc_kind: research
created: 2026-03-30
---

# Anthropic MCP 文章汇总

---

## 1. Introducing the Model Context Protocol
**发布时间**：2024年11月25日  
**类型**：官方公告 / Announcements  
**链接**：https://www.anthropic.com/news/model-context-protocol

### 核心内容
Anthropic 开源了 **Model Context Protocol (MCP)**，这是一个连接 AI 助手与数据系统的新标准。

**背景问题**：
- 即使是最先进的模型也因与数据隔离而受限
- 每个新数据源都需要自定义实现，难以规模化

**MCP 解决方案**：
- 提供一个通用的开放标准，用单一协议替代碎片化的集成
- 开发者可以通过 MCP 服务器暴露数据，或构建连接到这些服务器的 AI 应用（MCP 客户端）

**发布内容**：
- MCP 规范和 SDKs：https://github.com/modelcontextprotocol
- Claude Desktop 应用支持本地 MCP 服务器
- 开源 MCP 服务器仓库（Google Drive, Slack, GitHub, Git, Postgres, Puppeteer 等）

**早期采用者**：Block, Apollo, Zed, Replit, Codeium, Sourcegraph

---

## 2. Code execution with MCP: Building more efficient agents
**发布时间**：2025年11月4日  
**类型**：Engineering Blog  
**链接**：https://www.anthropic.com/engineering/code-execution-with-mcp

### 核心观点
**直接工具调用 vs 代码执行**：
- 直接工具调用会为每个定义和结果消耗上下文
- Agent 通过编写代码来调用工具，扩展性更好

**MCP 的优势**：
- 减少上下文消耗
- 提高 agent 效率
- 更好的可组合性

---

## 3. Building effective agents
**发布时间**：2024年12月19日  
**类型**：Research Blog  
**链接**：https://www.anthropic.com/research/building-effective-agents

### 核心内容
Anthropic 与数十个跨行业团队合作构建 LLM agents 的经验总结。

**关键发现**：
- 最成功的实现使用**简单、可组合的模式**，而非复杂的框架
- 过去一年中，简单模式表现更好

**实践建议**：
- 避免过度工程化
- 优先使用可组合的简单组件
- 专注于解决实际问题，而非构建复杂架构

---

## 相关资源

### 官方文档
- MCP 官方文档：https://modelcontextprotocol.io
- Claude Code MCP 文档：https://docs.anthropic.com/en/docs/claude-code/mcp
- MCP Connector API：https://docs.anthropic.com/en/docs/agents-and-tools/mcp-connector

### GitHub
- MCP 规范与 SDK：https://github.com/modelcontextprotocol
- 开源服务器集合：https://github.com/modelcontextprotocol/servers

---

*文档由 kimi 整理于 Cat Café*
