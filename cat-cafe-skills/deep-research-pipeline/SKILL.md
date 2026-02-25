---
name: deep-research-pipeline
description: Use when a technical question needs thorough investigation across multiple sources, when铲屎官 says "调研", "research", "深度研究", or when a design decision needs evidence from multiple AI perspectives before committing. Also use when writing research prompts for web-based Deep Research.
---

# Deep Research Pipeline

## Overview

Coordinate **web-based Deep Research** (Claude/Gemini/ChatGPT apps) + **GPT-5.2 Pro review** + **Coder cat synthesis** for maximum research quality. Web cats search the internet; Coder cats know the project.

## When to Use

- Technical feasibility investigation (new feature, library, protocol)
- Architecture decision needing external evidence
- Unfamiliar domain requiring broad + deep coverage
- Any question where a single WebSearch is insufficient

**When NOT to use:**
- Quick factual lookup (just use WebSearch)
- Code-only questions (use Explore agent)
- Questions answerable from project docs

## Two Types of Cats

| | Web Cats (Deep Research) | Coder Cats (CLI/Cat Cafe) |
|---|---|---|
| **Strength** | Searches 100s of sources, citations | Reads project code, runs tests |
| **Weakness** | Doesn't know our codebase | Limited web search depth |
| **Mode** | Browser app Deep Research | CLI subprocess in Cat Cafe |

## Pipeline

```
STEP 1: Write research prompt
  →落盘 docs/prompts/YYYY-MM-DD-{topic}-research-prompt.md
  → Include: background, specific questions, output format requirements

STEP 2: Three-way Web Deep Research (parallel)
  → Same prompt → Claude Deep Research (app/web)
  → Same prompt → Gemini Deep Research (app/web)
  → Same prompt → ChatGPT Deep Research (app/web)
  → GPT may ask clarifying questions — answer them,
    then append Q&A to prompt for the other two
  → Store results: research-report/{topic}-by-{cat}.md

STEP 3: GPT-5.2 Pro model review
  → Input: three Deep Research reports
  → Task: find logic gaps, weak evidence, disagreements
  → Store: docs/research/YYYY-MM-DD-{topic}-gpt-pro-review.md

STEP 4: Coder cat synthesis + decision
  → Read all four documents
  → Judge feasibility against actual codebase
  → Mark: what lands directly / what needs verification / project-specific constraints
  → Discuss with铲屎官 → decide
  → Store: docs/research/YYYY-MM-DD-{topic}-synthesis.md
```

## Prompt Template (Step 1)

```markdown
# {Topic} 调研

> 委托人：{who}
> 日期：YYYY-MM-DD

## 背景
{Why we need this research. What project context is relevant.}

## 需要调研的问题
1. {Specific question with scope}
2. {Specific question}
...

## 输出要求
- 每个结论标注信息来源（URL/文档名）
- 区分"已确认"和"推测"
- 给出推荐方向 + 风险

## 参考资料
{Links to relevant project docs, existing code, prior research}
```

## Quota Awareness

| Resource | Limit | Strategy |
|----------|-------|----------|
| ChatGPT Deep Research | Counter-based, 30-day rolling | Confirm topic is worth it before firing |
| Claude Deep Research | Plan-dependent | Same |
| Gemini Deep Research | Plan-dependent | Same |
| GPT-5.2 Pro model | Pro-only, has guardrails | Use for review only, not general chat |
| GPT-5.2 Pro model | **No Apps/Memory/Canvas** | Don't ask it to use connectors |

## Key Rules

1. **Prompt first, research second** — always write and save the prompt before sending
2. **GPT asks questions first** — ChatGPT Deep Research often asks clarifying questions; answer them, then add Q&A as context for Claude/Gemini
3. **Three perspectives > one** — each cat has different biases; disagreements are valuable signals
4. **Coder cat is the judge** — web cats don't know our code; Coder cat validates against reality
5. **Source everything** — synthesis must cite which report each conclusion came from

## Chrome MCP Automation

Coder cat (布偶猫) 通过 `mcp__claude-in-chrome__*` 工具自动化浏览器操作。

### 发送 Prompt（Step 2）

每个平台的操作流程：

**ChatGPT Deep Research:**
1. `tabs_create_mcp` → 打开新标签
2. `navigate` → `https://chatgpt.com/`
3. 找到输入框（`read_page` filter=interactive），切换到 Deep Research 模式
4. 用 `javascript_tool` 注入文本（clipboard paste + ProseMirror dispatchTransaction）
5. 点击发送按钮

**Claude.ai:**
1. `tabs_create_mcp` → `https://claude.ai/new`
2. 找到输入框，用 `javascript_tool` 注入文本
3. 点击发送按钮（直接 `left_click`，不需铲屎官确认）

**Gemini Deep Research:**
1. `tabs_create_mcp` → `https://gemini.google.com/app`
2. 点击「工具」按钮 → 选择「Deep Research」
3. 粘贴 prompt — **🔴 已知卡点：Gemini 的 contenteditable 编辑器不接受标准 clipboard paste 事件**
4. **Fallback**: 铲屎官手动粘贴 prompt 并点击发送

### 下载报告（Step 2 完成后）

**🔴 核心卡点：Chrome MCP 无法跨域读取 iframe 内容**

各平台 Deep Research 报告的渲染方式导致自动提取困难：

| 平台 | 报告渲染方式 | 自动下载可行性 | 手动下载方法 |
|------|-------------|---------------|-------------|
| **ChatGPT** | 跨域 iframe (`internal://deep-research`) | ❌ JS/DOM 均不可读 | 点击报告卡片标题栏的 ↓ 下载图标 |
| **Claude.ai** | Artifact MD 文档 | ⚠️ 可能可通过 Download 按钮 | 点击消息中附件的「Download」按钮 |
| **Gemini** | 独立文档面板 | ❌ | 点击「分享」→「导出到 Google Docs」→ 文件 → 下载 → Markdown |

**当自动下载失败时 → 召唤铲屎官 MCP！**

铲屎官可以快速手动下载三份报告。布偶猫负责：
1. 告知铲屎官哪些报告需要下载
2. 铲屎官下载后，从 `~/Downloads/` 找到文件
3. 统一重命名归档到 `docs/research/YYYY-MM-DD-{topic}/`

### 报告归档命名规范

```
docs/research/YYYY-MM-DD-{topic}/
├── README.md                      # 索引 + Pipeline 执行记录
├── chatgpt-deep-research.md       # ChatGPT (GPT) 的报告
├── claude-ai-deep-research.md     # Claude.ai 的报告
├── gemini-deep-research.md        # Gemini 的报告
├── opus-websearch-synthesis.md    # 布偶猫 WebSearch 初步综合（可选）
└── gpt-pro-review.md              # GPT-5.2 Pro 审阅报告（Step 3）
```

### 前置条件

- `ClaudeAgentService.ts` 已加 `--chrome` flag（`1f2adb2`），Cat Cafe 子进程可使用 Chrome MCP
- Chrome 必须运行且已安装 Claude in Chrome 扩展
- 铲屎官已登录 ChatGPT / Claude.ai / Gemini 账号

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Skipping prompt落盘 | No prompt file = no traceability |
| Sending different prompts to each cat | Same base prompt; only GPT's Q&A is additive |
| Treating GPT Pro as researcher | Pro model is reviewer/auditor, not searcher |
| Ignoring disagreements between reports | Disagreements are the most valuable signal |
| Coder cat blindly trusting web research | Always validate against actual codebase |
