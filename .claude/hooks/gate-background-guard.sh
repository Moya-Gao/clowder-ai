#!/bin/bash
# gate-background-guard.sh — F167 Phase P-0
# Hook: PreToolUse (matcher: "Bash")
#
# Gate 类命令（pnpm gate/check/test/build/lint/alpha:*、pre-merge-check.sh）
# 禁止 run_in_background=true。这些命令的结果是后续决策的前提（merge/不 merge），
# 后台跑完后结果丢失 = 白跑。尤其在 -p/headless 模式下，background bash 的
# re-invoke 承诺可能不兑现（LL-053/075），gate 结果直接消失。
#
# 决策：deny（不是 ask）——gate 后台跑 = 已知 bug，没有合法场景。
# 替代：前台同步跑（去掉 run_in_background），跑完拿到结果接着干。
#
# 触发：F167 Phase P spec（2026-06-25），铲屎官拍板。
# 证据：四只猫（gpt54/opus46/47/48）独立踩过同一个 bug。
#
# 已知 scope 边界（gpt52 review 2026-06-25）：
#   1. 仅覆盖 Claude CLI（PreToolUse hook chain）。Codex（codex exec --json）走不同
#      执行链，不经过此 hook。当前 4 个报告者全是 Claude 系；Codex 覆盖需在
#      Codex 执行侧另做 guard。
#   2. 仅拦 run_in_background=true（执行前）。LL-075 记录的"前台命令超 timeout
#      自动后台化"是运行时行为，PreToolUse 层结构上无法拦截。需 PostToolUse 层
#      或 timeout cap 策略补充。
#
# 创建者：[宪宪/claude-opus-4-6🐾]

set -euo pipefail

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")

# 只拦 Bash
if [ "$TOOL_NAME" != "Bash" ]; then
  exit 0
fi

# 只拦 run_in_background=true
RUN_BG=$(echo "$INPUT" | jq -r '.tool_input.run_in_background // false' 2>/dev/null || echo "false")
if [ "$RUN_BG" != "true" ]; then
  exit 0
fi

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Classification precision: best-effort, fail-safe (≥3 rounds rule, R4 decision).
#
# R1→R4 history: attempting regex-based shell semantic analysis (distinguishing
# "gate keyword as text" vs "as execution target") produced 4 rounds of
# alternating false-positive/false-negative fixes. Root cause: shell syntax is
# context-sensitive (single quotes suppress substitution, double quotes don't,
# wrappers execute quoted args); regex cannot reliably parse it.
#
# Deny semantics: PreToolUse deny = hard block. The entire Bash tool call is
# rejected; the command does NOT run (not even foreground). The cat sees the
# deny reason and must retry without run_in_background.
#
# False-positive surface (honest accounting):
#   1. Sub-namespace: `pnpm check:fix`, `check:biome-version`, `check:guides`
#      are non-gate helpers matched by `\bcheck\b` before `:`. But ~90% of
#      check:* scripts (check:deps, check:lockfile, check:env-*, check:features,
#      check:pre-merge-gate, etc.) ARE gate variants — blocking them is correct.
#   2. Literal text: `echo 'pnpm test'` + bg=true triggers deny (R4 accepted).
#   Cost in all cases: one retry round-trip, no work lost. The non-gate check:*
#   exceptions are commands nobody would run_in_background=true anyway.
#
# Tradeoff: rare one-retry FP < 4 rounds of regex shell-analysis bugs.
# Security-side bias (fail-safe) is the correct posture for a guard hook.
#
# The only precision retained: pre-merge-check requires .sh/.bash extension
# (avoids matching filenames like pre-merge-check-notes.md).
#
# Gate 命令 pattern：
#   pnpm gate / check / test / build / lint / alpha:start / alpha:test
#   含 --filter 变体、test:子命令、env 前缀、cd 前缀
#   pre-merge-check.sh / pre-merge-check.bash 直接调用
#
# 匹配策略：
#   \bpnpm\b 后面可能有 flags（--filter @xxx），gate 关键词在后方某处
#   pre-merge-check 要求 .sh/.bash 扩展名（避免匹配 pre-merge-check-notes.md 等文件名）
GATE_PATTERN='(\bpnpm\b\s+(\S+\s+)*\b(gate|check|test|build|lint|alpha:(start|test))\b|pre-merge-check\.(sh|bash)\b)'

# Collapse newlines so line-continued commands (pnpm --filter @xxx \\\n  test:redis)
# are matched as a single string. Without this, grep sees each physical line separately
# and misses commands split across lines (cloud review P2, 2026-06-25).
MATCH_CMD=$(printf '%s' "$COMMAND" | tr '\n' ' ')

if printf '%s' "$MATCH_CMD" | grep -qiE "$GATE_PATTERN"; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "⛔ 检测到 gate 关键词（gate/check/test/build/lint）+ run_in_background=true，已阻止（F167 Phase P-0）。如果这是真正的 gate 命令：去掉 run_in_background，前台同步跑——结果是后续决策的前提，后台跑会丢失。如果是误匹配（如 echo/grep 里含 gate 关键词）：去掉 run_in_background 重试即可。"
    }
  }'
  exit 0
fi

# 不匹配 gate pattern，放行
exit 0
