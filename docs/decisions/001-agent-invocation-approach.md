# ADR-001: Agent 调用方式选择

## 状态
已决定

## 日期
2026-02-04

## 背景

Cat Café 需要程序化调用三只 AI 猫猫（Claude/Codex/Gemini），并保留它们的完整 agent 能力（文件操作、命令执行、MCP 工具使用）。

经过三猫研究团队的调研，我们评估了四种可能的方案。

## 决策

**我们选择方案 C：使用官方 Agent SDK**

具体技术选型：
- **布偶猫 (Claude)**：`@anthropic-ai/claude-agent-sdk`
- **缅因猫 (Codex)**：`@openai/codex-sdk`
- **暹罗猫 (Gemini)**：`@google/adk`

## 方案对比

| 方案 | 描述 | 优点 | 缺点 | 结论 |
|------|------|------|------|------|
| A: 纯 API | 直接调用 Chat API | 简单 | 失去 agent 能力 | ❌ 不满足需求 |
| B: 子进程 | spawn CLI 作为子进程 | 完整能力 | 启动开销、解析复杂 | ⚠️ 备选 |
| **C: SDK** | 使用官方 Agent SDK | **完整能力、低延迟、流式响应** | 需学习各 SDK | ✅ 推荐 |
| D: 外部进程 | 独立进程 + MCP 协调 | 松耦合 | 同步复杂 | ⚠️ 特殊场景 |

## 理由

1. **完整 Agent 能力**：SDK 模式保留了所有 agent 功能（文件操作、命令执行、MCP 工具）
2. **低延迟**：SDK 直接集成到后端，无需进程启动开销
3. **Session 管理**：SDK 提供原生的 Session 恢复能力
4. **流式响应**：支持实时流式返回，提升用户体验
5. **类型安全**：TypeScript SDK 提供完整类型定义

## 已知风险

1. **Codex SDK MCP 限制**：可能只支持 STDIO MCP，需要测试 HTTP 代理方案
2. **ADK 不成熟**：Google ADK TypeScript 版本是 v0.1.0，标注"不建议用于生产"
3. **多 SDK 维护**：需要同时维护三个不同 SDK 的集成代码

## 缓解措施

1. 为每个 SDK 编写独立的 `AgentService` 类，隔离差异
2. 使用统一的 `AgentMessage` 接口，屏蔽 SDK 差异
3. 如果某个 SDK 不稳定，可以降级到方案 B（子进程模式）

## 参考

- 研究报告：`research-report/` 目录下的三份报告
- OpenClaw 项目：https://github.com/openclaw/openclaw
- MCP SDK 文档：https://modelcontextprotocol.io/

## 参与者

- 布偶猫（Claude Opus 4.5）
- 缅因猫（GPT Codex）
- 暹罗猫（Gemini 3 Pro）
- 铲屎官
