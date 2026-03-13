#!/bin/bash
# Shared Document Push Guard (Claude Code 提醒层)
#
# 定位：体验提醒层，不是制度执行层。
# 制度执行层 = .githooks/pre-commit（repo 级，所有猫通用）
#
# 两类文档，不同强度：
#   严格共享状态（非 main 禁止改）：BACKLOG.md, cat-config.json
#   普通共享文档（可改，但改完必须 push）：docs/features/, docs/decisions/
#
# Exit codes:
#   0 = pass / 提醒（不拦截）

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

# Classify: strict shared state vs regular shared doc
IS_STRICT=false
IS_SHARED=false

case "$FILE_PATH" in
  */docs/BACKLOG.md|*/cat-config.json)
    IS_STRICT=true
    IS_SHARED=true
    ;;
  */docs/features/*|*/docs/decisions/*)
    IS_SHARED=true
    ;;
  *)
    exit 0
    ;;
esac

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" || exit 0

BRANCH=$(git branch --show-current 2>/dev/null)

# Strict shared state on non-main → strong warning
if $IS_STRICT && [[ "$BRANCH" != "main" ]]; then
  echo "🚫 SHARED-STATE GUARD: $(basename "$FILE_PATH") 是共享状态文件，应该在 main 分支改！" >&2
  echo "正确做法：git restore --staged 该文件 → 切到 main worktree（或 git checkout main 如未被占用）→ pull → 编辑 → commit + push → 切回来" >&2
  echo "（.githooks/pre-commit 会在 commit 时拦截，这里先提醒）" >&2
  # 不 exit 2：Edit 本身不应该被拦截，pre-commit 会拦 commit
  exit 0
fi

# Regular shared doc → remind to push after commit
if $IS_SHARED; then
  echo "📌 SHARED-DOC REMINDER: 你改了共享文档 $(basename "$FILE_PATH")，记得同消息内 commit + push。" >&2
fi

exit 0
