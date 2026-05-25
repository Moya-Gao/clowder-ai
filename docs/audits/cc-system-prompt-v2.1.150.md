---
feature_ids: [F203]
topics: [system-prompt, cli-anatomy, phase-e-audit]
doc_kind: audit
created: 2026-05-25
---
# Claude Code v2.1.150 System Prompt 解剖（Phase E audit 自动产出）

> 提取来源：`strings $(which claude)` → audit-claude-code-system-prompt.mjs
> Claude Code 版本：2.1.150

## 1. 身份行

```
You are Claude Code, Anthropic's official CLI for Claude.
You are Claude Code, Anthropic's official CLI for Claude, running within the Claude Agent SDK.
You are a Claude agent, built on Anthropic's Claude Agent SDK.
```

## 5. section 全清单（anchor / functional）

- doing-tasks — # Doing tasks
- parallel-tools — parallel tool calls · **functional**（必 carry-over L0 §2）
- destructive-safety — destructive op safety · **functional**（必 carry-over L0 §2）
- simple-system-prompt — simple_system_prompt mechanism · **functional**（必 carry-over L0 §2）
- using-tools — # Using your tools · **functional**（必 carry-over L0 §2）

> functional 段 = `--system-prompt-file` 替换式会替换掉的客观性/能力性
> 指令，必须在 `system-prompt-l0.md` §2 carry-over。新增 functional anchor
> → 按 `cat-cafe-skills/refs/cc-system-prompt-audit-sop.md` 提案 L0 更新 PR。
