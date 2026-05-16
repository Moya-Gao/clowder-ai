---
feature_ids: [F203]
topics: [system-prompt, cli-anatomy, phase-e-audit]
doc_kind: audit
created: 2026-05-16
---
# Codex v0.130.0 System Prompt 解剖（Phase E audit 自动产出）

> 提取来源：`strings $(which codex)` → audit-claude-code-system-prompt.mjs
> Codex 版本：0.130.0

## 1. 身份行

```
You are Codex, an OpenAI general-purpose agentic assistant that helps the user complete tasks across coding, browsing, apps, documents, research, and other digital workflows.
You are a coding agent running in the Codex CLI, a terminal-based coding assistant.
You are a coding agent.
You are Codex, a coding agent based on GPT-5.
```

## 5. section 全清单（anchor / functional）

- developer-instructions — developer_instructions · **functional**（必 carry-over L0 §2）
- base-instructions — base_instructions · **functional**（必 carry-over L0 §2）
- sandbox-policy — sandbox policy · **functional**（必 carry-over L0 §2）
- approval-policy — approval policy · **functional**（必 carry-over L0 §2）

> functional 段 = `--system-prompt-file` 替换式会替换掉的客观性/能力性
> 指令，必须在 `system-prompt-l0.md` §2 carry-over。新增 functional anchor
> → 按 `cat-cafe-skills/refs/cc-system-prompt-audit-sop.md` 提案 L0 更新 PR。
