#!/usr/bin/env bash
# sync-hotfix.sh — Hotfix Lane: 精准推送指定文件到 clowder-ai
#
# 基于最新 sync tag 在 clowder-ai 创建分支，从 cat-cafe 复制指定文件，
# 经过 sanitizer 处理后提交。用于社区 bug 修复的小而精 PR。
#
# Usage:
#   bash scripts/sync-hotfix.sh <branch-name> <file1> [file2] ...
#
# Example:
#   bash scripts/sync-hotfix.sh fix/proxy-fallback \
#     packages/api/src/routes/invoke-single-cat.ts \
#     packages/api/src/utils/proxy-client.ts
#
# Flags:
#   --dry-run     预览操作，不实际修改 clowder-ai
#   --tag=NAME    指定 sync tag（默认: 最新 sync/* tag）
#   --no-sanitize 跳过 sanitizer（调试用，不推荐）
#   --push        自动推送分支到 origin
#
# Prerequisites:
#   - clowder-ai repo 在 ../clowder-ai（或 $CLOWDER_AI_DIR）
#   - 至少有一个 sync/* tag（由 sync-to-opensource.sh 自动创建）
#
# See: docs/discussions/2026-03-14-sync-hotfix-lane-design.md

set -euo pipefail

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ── Portable sed -i ──
if sed --version 2>/dev/null | grep -q GNU; then
  sedi() { sed -i "$@"; }
else
  sedi() { sed -i '' "$@"; }
fi

# ── Parse args ──
DRY_RUN=false
CUSTOM_TAG=""
NO_SANITIZE=false
AUTO_PUSH=false
BRANCH_NAME=""
FILES=()

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --tag=*) CUSTOM_TAG="${arg#--tag=}" ;;
    --no-sanitize) NO_SANITIZE=true ;;
    --push) AUTO_PUSH=true ;;
    -*)
      echo -e "${RED}Unknown flag: $arg${NC}"
      echo "Usage: $0 <branch-name> <file1> [file2] ..."
      exit 1
      ;;
    *)
      if [ -z "$BRANCH_NAME" ]; then
        BRANCH_NAME="$arg"
      else
        FILES+=("$arg")
      fi
      ;;
  esac
done

# ── Validate args ──
if [ -z "$BRANCH_NAME" ]; then
  echo -e "${RED}Error: branch name required${NC}"
  echo "Usage: $0 <branch-name> <file1> [file2] ..."
  echo ""
  echo "Example:"
  echo "  $0 fix/proxy-fallback packages/api/src/routes/invoke-single-cat.ts"
  exit 1
fi

if [ ${#FILES[@]} -eq 0 ]; then
  echo -e "${RED}Error: at least one file path required${NC}"
  echo "Usage: $0 <branch-name> <file1> [file2] ..."
  exit 1
fi

# ── Resolve directories ──
SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="${CLOWDER_AI_DIR:-$(cd "$SOURCE_DIR/.." && pwd)/clowder-ai}"
MANIFEST="$SOURCE_DIR/sync-manifest.yaml"

if [ ! -d "$TARGET_DIR/.git" ]; then
  echo -e "${RED}Error: clowder-ai not found at $TARGET_DIR${NC}"
  echo "Set CLOWDER_AI_DIR or ensure ../clowder-ai exists"
  exit 1
fi

echo -e "${GREEN}=== Hotfix Lane ===${NC}"
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"
echo "Branch: $BRANCH_NAME"
echo "Files:  ${FILES[*]}"
echo ""

# ── Step 1: Find latest sync tag ──
echo -e "${BLUE}[Step 1/5] Finding sync tag...${NC}"
if [ -n "$CUSTOM_TAG" ]; then
  SYNC_TAG="$CUSTOM_TAG"
  if ! git -C "$TARGET_DIR" rev-parse "$SYNC_TAG" >/dev/null 2>&1; then
    echo -e "${RED}Error: tag '$SYNC_TAG' not found in target repo${NC}"
    exit 1
  fi
else
  SYNC_TAG=$(git -C "$TARGET_DIR" tag -l 'sync/*' --sort=-version:refname | head -1)
  if [ -z "$SYNC_TAG" ]; then
    echo -e "${RED}Error: no sync/* tags found in target repo${NC}"
    echo "Run a full sync first: bash scripts/sync-to-opensource.sh"
    exit 1
  fi
fi
echo -e "  Using tag: ${GREEN}$SYNC_TAG${NC}"
echo -e "  Tag commit: $(git -C "$TARGET_DIR" log -1 --format='%h %s' "$SYNC_TAG")"

# ── Step 2: Validate source files exist ──
echo ""
echo -e "${BLUE}[Step 2/5] Validating source files...${NC}"
MISSING=false
for f in "${FILES[@]}"; do
  if [ ! -f "$SOURCE_DIR/$f" ]; then
    echo -e "  ${RED}✗ Not found: $f${NC}"
    MISSING=true
  else
    echo -e "  ${GREEN}✓${NC} $f"
  fi
done

if [ "$MISSING" = true ]; then
  echo -e "${RED}Error: some files not found in source repo${NC}"
  exit 1
fi

# ── Step 3: Create branch in target ──
echo ""
echo -e "${BLUE}[Step 3/5] Creating branch in target repo...${NC}"

if [ "$DRY_RUN" = true ]; then
  echo -e "  ${YELLOW}[dry-run] Would create branch '$BRANCH_NAME' from $SYNC_TAG${NC}"
else
  # Check if branch already exists
  if git -C "$TARGET_DIR" rev-parse --verify "$BRANCH_NAME" >/dev/null 2>&1; then
    echo -e "  ${YELLOW}⚠ Branch '$BRANCH_NAME' already exists. Checking out...${NC}"
    git -C "$TARGET_DIR" checkout "$BRANCH_NAME"
  else
    git -C "$TARGET_DIR" checkout -b "$BRANCH_NAME" "$SYNC_TAG"
    echo -e "  ${GREEN}✓ Branch '$BRANCH_NAME' created from $SYNC_TAG${NC}"
  fi
fi

# ── Step 4: Copy files + sanitize ──
echo ""
echo -e "${BLUE}[Step 4/5] Copying files and sanitizing...${NC}"

# Sanitizer rules: shared with sync-to-opensource.sh (single source of truth)
SANITIZER="$SOURCE_DIR/scripts/_sanitize-rules.pl"
if [ ! -f "$SANITIZER" ]; then
  echo -e "${RED}Error: _sanitize-rules.pl not found at $SANITIZER${NC}"
  exit 1
fi

COPIED_FILES=()
for f in "${FILES[@]}"; do
  TARGET_FILE="$TARGET_DIR/$f"

  if [ "$DRY_RUN" = true ]; then
    echo -e "  ${YELLOW}[dry-run] Would copy: $f${NC}"
    continue
  fi

  # Ensure target directory exists
  TARGET_SUBDIR=$(dirname "$TARGET_FILE")
  mkdir -p "$TARGET_SUBDIR"

  # Copy from source
  cp "$SOURCE_DIR/$f" "$TARGET_FILE"

  # Run sanitizer on copied file
  if [ "$NO_SANITIZE" = false ]; then
    perl -pi "$SANITIZER" "$TARGET_FILE"
    echo -e "  ${GREEN}✓${NC} $f (copied + sanitized)"
  else
    echo -e "  ${GREEN}✓${NC} $f (copied, ${YELLOW}NOT sanitized${NC})"
  fi

  COPIED_FILES+=("$f")
done

# ── Step 5: Commit ──
echo ""
echo -e "${BLUE}[Step 5/5] Committing...${NC}"

if [ "$DRY_RUN" = true ]; then
  echo -e "  ${YELLOW}[dry-run] Would commit ${#FILES[@]} file(s) on branch '$BRANCH_NAME'${NC}"
else
  cd "$TARGET_DIR"
  git add "${COPIED_FILES[@]}"

  # Check if there are actual changes
  if git diff --cached --quiet; then
    echo -e "  ${YELLOW}⚠ No changes to commit (files identical after sanitization)${NC}"
  else
    git commit -m "fix: hotfix via sync-hotfix.sh (branch: $BRANCH_NAME)

Files: ${COPIED_FILES[*]}
Base tag: $SYNC_TAG
Source: cat-cafe"
    echo -e "  ${GREEN}✓ Committed${NC}"

    if [ "$AUTO_PUSH" = true ]; then
      git push -u origin "$BRANCH_NAME"
      echo -e "  ${GREEN}✓ Pushed to origin/$BRANCH_NAME${NC}"
    fi
  fi

  cd "$SOURCE_DIR"
fi

# ── Summary ──
echo ""
echo -e "${GREEN}=== Hotfix Lane Complete ===${NC}"
echo "Branch: $BRANCH_NAME"
echo "Base:   $SYNC_TAG"
echo "Files:  ${#FILES[@]}"
echo ""

if [ "$DRY_RUN" = false ] && [ "$AUTO_PUSH" = false ]; then
  echo -e "${YELLOW}Next steps:${NC}"
  echo "  1. cd $TARGET_DIR && git push -u origin $BRANCH_NAME"
  echo "  2. Open PR on clowder-ai: gh pr create --title 'fix: ...' --body '...'"
  echo "  3. Apply same fix to cat-cafe main (if not already done)"
  echo ""
  echo -e "${YELLOW}Intake ledger:${NC}"
  echo "  After hotfix merges to clowder-ai, update intake ledger before next full sync:"
  echo "  bash scripts/intake-from-opensource.sh --record"
fi
