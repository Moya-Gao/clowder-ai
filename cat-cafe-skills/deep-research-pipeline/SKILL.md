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

## Chrome MCP Automation (Optional)

If Coder cat has Chrome browser access (mcp__claude-in-chrome), it can:
- Open ChatGPT/Claude/Gemini web tabs
- Paste research prompts directly
- Read results when complete

This removes铲屎官 as manual router. But always get铲屎官 approval before sending messages on their accounts.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Skipping prompt落盘 | No prompt file = no traceability |
| Sending different prompts to each cat | Same base prompt; only GPT's Q&A is additive |
| Treating GPT Pro as researcher | Pro model is reviewer/auditor, not searcher |
| Ignoring disagreements between reports | Disagreements are the most valuable signal |
| Coder cat blindly trusting web research | Always validate against actual codebase |
