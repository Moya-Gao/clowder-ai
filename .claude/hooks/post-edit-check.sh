#!/bin/bash
# Post-Edit/Write quality check hook
# 在每次 Edit/Write 后对改动文件跑 Biome lint 检查
# 轻量级（单文件检查 < 500ms），不跑全量 tsc
#
# Exit codes:
#   0 = pass（stdout JSON → verbose mode only）
#   2 = blocking error（stderr → fed to Claude）

# Read JSON input from stdin
INPUT=$(cat)

# Extract file path
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only check .ts/.tsx/.js/.jsx files
if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx) ;;
  *) exit 0 ;;
esac

# Skip if file doesn't exist (deleted)
if [[ ! -f "$FILE_PATH" ]]; then
  exit 0
fi

# Find project root (where biome.json lives)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(echo "$INPUT" | jq -r '.cwd')}"
if [[ -z "$PROJECT_DIR" || ! -f "$PROJECT_DIR/biome.json" ]]; then
  exit 0
fi

# Run Biome check on the single file (fast, lint only, no format noise)
cd "$PROJECT_DIR" || exit 0
BIOME_OUTPUT=$(npx biome lint "$FILE_PATH" 2>&1)
BIOME_EXIT=$?

if [ $BIOME_EXIT -eq 0 ]; then
  exit 0
else
  # Filter to only error lines (skip warnings for hook context)
  ERROR_LINES=$(echo "$BIOME_OUTPUT" | grep -E '(✘|error|Error)' | head -10)
  if [[ -n "$ERROR_LINES" ]]; then
    echo "Biome lint errors in $(basename "$FILE_PATH"):" >&2
    echo "$ERROR_LINES" >&2
    # Don't block (exit 0) — just inform. exit 2 would be too aggressive
    # for an incremental check. Claude sees this via verbose mode.
  fi
  exit 0
fi
