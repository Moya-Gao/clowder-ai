#!/bin/bash
# Shared Document Push Guard
# 检查是否有改了共享文档但未 push 的 commit
# 挂在 PostToolUse (Edit|Write) — 编辑共享文档后立即提醒
#
# 共享文档 = docs/features/ | docs/BACKLOG.md | docs/decisions/ | cat-config.json
#
# Exit codes:
#   0 = no issue
#   2 = blocking — 必须先 push

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only trigger for shared doc paths
if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

case "$FILE_PATH" in
  */docs/features/*|*/docs/BACKLOG.md|*/docs/decisions/*|*/cat-config.json) ;;
  *) exit 0 ;;
esac

# Find project root
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" || exit 0

# Check: is this file modified but not committed?
if git diff --name-only 2>/dev/null | grep -qE '(docs/features/|docs/BACKLOG\.md|docs/decisions/|cat-config\.json)'; then
  echo "⚠️ SHARED-DOC GUARD: 你刚改了共享文档 $(basename "$FILE_PATH")，必须在这条消息内 commit + push！不 push 其他猫的修改会被覆盖。" >&2
  # Don't block (exit 0) — 提醒，不拦截 Edit 本身
  exit 0
fi

# Check: are there unpushed commits touching shared docs?
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null)
if [[ -z "$CURRENT_BRANCH" ]]; then
  exit 0
fi

UPSTREAM=$(git rev-parse --abbrev-ref "@{upstream}" 2>/dev/null)
if [[ -z "$UPSTREAM" ]]; then
  # No upstream — can't check, but warn
  exit 0
fi

UNPUSHED_SHARED=$(git diff --name-only "$UPSTREAM"..HEAD 2>/dev/null | grep -E '(docs/features/|docs/BACKLOG\.md|docs/decisions/|cat-config\.json)')
if [[ -n "$UNPUSHED_SHARED" ]]; then
  echo "🚨 SHARED-DOC GUARD: 有共享文档 commit 了但没 push！立刻 git push！" >&2
  echo "未 push 的共享文档: $UNPUSHED_SHARED" >&2
  # Block! 不 push 就不让继续
  exit 2
fi

exit 0
