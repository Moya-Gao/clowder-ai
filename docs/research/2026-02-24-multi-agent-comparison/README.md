# Multi-Agent 架构对比调研 (2026-02-24)

> 委托人：铲屎官 + 布偶猫
> Pipeline：`deep-research-pipeline` skill 首次实战验证

## 调研目标

对比四个 multi-agent 方案：
1. **Claude Code Agent Teams** — Anthropic 官方 Team Lead + Teammates
2. **oh-my-opencode (OMO)** — 社区项目，Sisyphus 编排器
3. **Kimi Agent Swarm** — Moonshot AI，k1/k2.5 MoE swarm
4. **Cat Cafe A2A** — 我们的方案，去中心化 worklist + 强人在环

## 文件清单

| 文件 | 来源 | 大小 | 备注 |
|------|------|------|------|
| `chatgpt-deep-research.md` | ChatGPT Deep Research (GPT) | 37KB | 11 分钟, 26 引用, 127 次搜索 |
| `claude-ai-deep-research.md` | Claude.ai Opus 4.6 Extended | 17KB | Web Search + 文档交叉验证 |
| `gemini-deep-research.md` | Gemini Deep Research (Pro) | 32KB | 学术风格深度分析 |
| `opus-websearch-synthesis.md` | 布偶猫 WebSearch 初步综合 | - | Pipeline 前置调研 |
| `gpt-pro-review.md` | GPT-5.2 Pro 交叉审阅 | - | Step 3: 事实分歧 + 弱证据 + 盲区 + 偏见 + 合并建议 |
| `agent-swarm-comparison.md` | 布偶猫综合 | - | 四大系统 Agent Swarm 协同方式对比 |
| `2026-02-26-li-di-interview-notes.md` | 外部文章研究摘录 | - | 微信访谈关键信号 + 待核验断言 + 我们方案映射 |
| `source-2026-02-26-wechat-article.snapshot.md` | 浏览器抓取快照 | - | 从网页可访问树导出的原始快照（供内部复核） |

## 外部参考归档

- 文章链接：<https://mp.weixin.qq.com/s/2vYcLyuMmVfnkRgSEXk0Wg>
- 标题：`对话李笛：异构多智能体，让 AI 学会真正的「群体思考」`
- 归档方式：保留源链接 + 浏览器抓取快照 + 内部研究摘录（避免直接转载全文）

## 研究 Prompt

见 `docs/prompts/2026-02-24-multi-agent-comparison-research-prompt.md`

## Pipeline 执行记录

- **Step 1** (写 Prompt): 布偶猫基于已有调研 + Cat Cafe 架构写自包含 prompt
- **Step 2** (三路 Deep Research): ChatGPT / Claude.ai / Gemini 并行调研
  - 通过 Chrome MCP (`mcp__claude-in-chrome__*`) 自动发送
  - 下载由铲屎官协助（见 skill 卡点记录）
- **Step 3** (GPT Pro Review): ✅ 完成 — 铲屎官上传三份报告 + 布偶猫写审阅 prompt → GPT-5.2 Pro 输出交叉审阅
- **Step 4** (布偶猫综合): ✅ Agent Swarm 协同方式对比报告已输出
