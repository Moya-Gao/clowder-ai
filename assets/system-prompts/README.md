# System Prompt Semantic Shards

> F050 Phase 4: Native Prompt Sync for Codex + Gemini

Codex/Gemini **原生配置**（`~/` 下的配置文件）的仓库内真相源。

> **注意**：本目录覆盖的是各猫 `~/` 原生配置的同步。Cat Café 运行时动态注入层（`SystemPromptBuilder`）仍维持独立常量，尚未收拢到此处（Phase 5 候选）。

> **F203 更新**：缅因猫已切到 native `developer_instructions` L0 注入（压缩免疫层，真相源 `system-prompt-l0.md` + `scripts/compile-system-prompt-l0.mjs`）。`renderForCodex` 已退役为空——`~/.codex/AGENTS.md` 不再承载家规/身份，本目录的 codex 同步路径仅保留 drift 守护。Gemini 尚未切换，`renderForGemini` 仍生效。

## 结构

```
assets/system-prompts/
├── system-prompt-l0.md # F203 native L0 真相源（Claude + Codex 走 developer 层）
├── governance-l0.md    # 家规精简版（仅 Gemini user-layer 同步还在用）
├── collab-rules.md     # 协作规则（@格式、队友花名册；仅 Gemini 还在用）
├── cats/
│   ├── gemini.md       # 暹罗猫身份 + 角色 + 语言
│   └── opus.md         # 布偶猫（仅参考，真相源是 CLAUDE.md）
└── README.md           # 本文件
```

## 同步

```bash
# 检查本机 drift
npx tsx scripts/sync-system-prompts.ts --check

# 写入各猫原生配置
npx tsx scripts/sync-system-prompts.ts --apply

# 只看渲染结果不写入
npx tsx scripts/sync-system-prompts.ts --apply --dry-run

# CI 模式：指定 target root（不依赖 ~/）
npx tsx scripts/sync-system-prompts.ts --apply --target-root /tmp/ci-prompt-check
npx tsx scripts/sync-system-prompts.ts --check --target-root /tmp/ci-prompt-check
```

## 同步目标

| 猫 | 目标路径 | 说明 |
|---|---|---|
| Codex | `~/.codex/AGENTS.md` | F203 退役：渲染空，已切 native developer L0；保留 target 仅为 drift 守护 |
| Gemini | `~/.gemini/GEMINI.md` | CLI 读 |
| Claude | 不同步 | `CLAUDE.md` 在仓库 = 天然真相源 |
| OpenCode | 不同步 | 无原生配置入口，靠动态注入 |

## 修改流程

1. 编辑本目录下的分片文件
2. 跑 `--check` 确认 drift
3. 跑 `--apply` 写入
4. Commit 分片变更
