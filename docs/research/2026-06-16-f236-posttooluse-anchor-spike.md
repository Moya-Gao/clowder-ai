---
feature_ids: [F236]
topics: [context-engineering, hooks, spike]
doc_kind: research
created: 2026-06-16
---

# F236 Phase C Spike: cc PostToolUse Anchor 化实测

> 验证 cc 内置工具（Read/Grep）能否用 PostToolUse hook + `updatedToolOutput` anchor 化
> 双猫 spike：宪宪（opus-48，跑实测）+ 砚砚（gpt-5.5/@codex，钉验证条件 + 防 confound 复核）
> 2026-06-16

## 背景
F236 缺口：cc 内置 Read/Grep（读文件/搜代码）是 agent token 大头，rtk 放弃（只用 PreToolUse，46 处零 PostToolUse）。查官方 hook 文档：PostToolUse + `updatedToolOutput` 官方显示可 replace 内置工具返回，但**须匹配原 output shape**（砚砚 caveat）。本 spike 实测验证。

## 环境
- 隔离目录 `/tmp/f236-spike`，项目级 `.claude/settings.json`（不碰主配置，复用 F230 隔离法）
- `claude` 2.1.175，entrypoint = **sdk-cli (`claude -p`)**
- nonce probe 防自欺（砚砚设计）：原文放 `ORIGINAL_MARKER`，hook 输出放 `HOOK_MARKER`，看模型回哪个；nonce 后缀随机，排除猜测/缓存

## 结果

### C0a — Read: ✅ PASS
| 步 | 结果 | 证据 |
|----|------|------|
| capture shape | Read `tool_response = {type:"text", file:{filePath,content,numLines,startLine,totalLines}}` | captured-stdin.json |
| **字符串 replace** | ❌ 被忽略（claude 回 `ORIGINAL_MARKER`）| shape mismatch，证实砚砚 caveat |
| **shape-matched replace** | ✅ 生效（claude 回 `HOOK_REPLACED_MARKER_y7z3w`，exact nonce）| 保结构只替 `.file.content`；砚砚查 transcript 确认模型侧真收到 |
| bounded drill pass-through | ✅ `Read(offset=2,limit=1)` 返回真实 slice `second line original content`（hook `exit 0` 不 replace）| 双条件判据：`offset\|limit set` + `content≤5000` |

### C0b — Grep: ✅ PASS
| 步 | 结果 | 证据 |
|----|------|------|
| capture shape | Grep `tool_response = {mode:"content", numFiles, filenames, content:"file:line:text", numLines}`——正文在**顶层 `.content`**（≠ Read 的 `.file.content`）| grep-capture.json |
| shape-matched replace | ✅ 生效（claude 回 `GREP_ANCHOR_NONCE_q4`）| 保结构只替 `.content` |

## 关键发现
1. **shape 必须匹配**：字符串 `updatedToolOutput` 被忽略；必须保 `tool_response` 结构、只替 content 字段。Read 的 content 在 `.file.content`，Grep 在 `.content`——**per-tool shape 不同，hook 须按工具分支**。
2. **bounded drill 可 pass-through**：hook `exit 0`（不输出）= 保留原结果。猫用 `Read(offset,limit)` 拿真实 slice，**anchor+drill 闭环成立**（不丢原文）。
3. **nonce probe 防自欺生效**：第一发字符串 replace 看着 hook fire 了但模型仍看原文——没 nonce 会误判 PASS。这是 spike 最关键的防线。

## 结论（精确，不外推 — 砚砚收口）
- **`claude -p / sdk-cli` 下，shape-matched PostToolUse Read/Grep replacement + bounded drill pass-through 已实证可行。**
- cc 大头（Read+Grep）anchor+drill 技术路径打通——**rtk 做不到的（它只 hook Bash input，放弃了 Read/Grep）**。

## 待验（Phase C 实现期，不推翻核心机制）
- **C0c Glob shape**（未测，与 Grep 同理待验）
- **多 Read 独立替换**（按 `tool_use_id` 不串线；capture 改 append JSONL）
- **同 session 多轮持久化**（F230 证可观测多轮，replacement 持久化待补）
- **interactive carrier parity**：本 spike 是 sdk-cli；若 Phase C 含 interactive Claude carrier，需**单独 AC** 在 carrier path 复测 replacement，不拿 `-p` 盖全场景

## 双猫复核（防 confound）
砚砚（@codex）独立查 `captured.jsonl` + transcript（非听转述）：确认 exact nonce 进模型侧 `tool_result` + 最终 assistant 只输出它 + prompt 未含 nonce 后缀 → 排除猜测/缓存。证据链闭合。

## artifact
`/tmp/f236-spike/`：`captured-stdin.json`（Read shape）/ `captured.jsonl`（bounded drill 每跳）/ `grep-capture.json`（Grep shape）/ `.claude/hooks/*.sh`（hook 脚本）/ `.claude/settings.json`
