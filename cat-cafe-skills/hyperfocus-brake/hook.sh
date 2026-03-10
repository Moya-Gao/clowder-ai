#!/usr/bin/env bash
# F085 Hyperfocus Brake - PostToolUse Hook
# 每次工具调用后记录活跃时间，到阈值触发 skill

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 从 stdin 读取 JSON 输入
INPUT=$(cat)

# 引入状态管理函数（用户级状态文件，跨 session 共享）
source "$SCRIPT_DIR/state.sh"

# 记录这次活动
ACTIVE_MS=$(record_activity)

# 检查是否应该触发（默认 90min = 5,400,000ms）
THRESHOLD_MS="${HYPERFOCUS_THRESHOLD_MS:-5400000}"
LEVEL=$(should_trigger "$THRESHOLD_MS")

if [[ "$LEVEL" != "0" ]]; then
  # 获取上下文信息
  CWD=$(echo "$INPUT" | jq -r '.cwd // "unknown"')
  TOOL=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')

  # 获取当前分支（安全地）
  BRANCH="unknown"
  if [[ -d "$CWD/.git" ]] || git -C "$CWD" rev-parse --git-dir >/dev/null 2>&1; then
    BRANCH=$(git -C "$CWD" branch --show-current 2>/dev/null || echo "unknown")
  fi

  # 计算已工作时间（分钟）
  WORK_MINS=$((ACTIVE_MS / 60000))

  # 输出 JSON 告诉 Claude Code 触发 skill
  # 使用 systemMessage 来显示提醒
  cat <<EOF
{
  "systemMessage": "⏰ [Hyperfocus Brake L${LEVEL}] 铲屎官已连续工作 ${WORK_MINS} 分钟。请运行 /hyperfocus-brake 进行健康检查。",
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "hyperfocusTrigger": {
      "level": ${LEVEL},
      "activeMinutes": ${WORK_MINS},
      "branch": $(echo "$BRANCH" | jq -R .),
      "tool": $(echo "$TOOL" | jq -R .)
    }
  }
}
EOF
fi

# 正常退出（不阻塞工具调用）
exit 0
