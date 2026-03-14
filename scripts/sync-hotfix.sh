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

if [ ! -f "$MANIFEST" ]; then
  echo -e "${RED}Error: sync-manifest.yaml not found at $MANIFEST${NC}"
  exit 1
fi

# ── Parse manifest allowlist + excluded (reuse yaml_list from sync-to-opensource.sh) ──
yaml_list() {
  local key="$1"
  awk -v k="$key:" '
    BEGIN { found=0 }
    found && /^[^ #-]/ { exit }
    found && /^  - / {
      line = $0
      sub(/^  - /, "", line)
      sub(/#.*/, "", line)
      gsub(/^[[:space:]]+/, "", line)
      gsub(/[[:space:]]+$/, "", line)
      gsub(/"/, "", line)
      if (length(line) > 0) print line
      next
    }
    $0 ~ "^"k { found=1 }
  ' "$MANIFEST"
}

MANAGED_ROOTS=()
while IFS= read -r line; do MANAGED_ROOTS+=("$line"); done < <(yaml_list "managed_roots")
MANAGED_FILES=()
while IFS= read -r line; do MANAGED_FILES+=("$line"); done < <(yaml_list "managed_files")
MANAGED_SCRIPTS=()
while IFS= read -r line; do MANAGED_SCRIPTS+=("$line"); done < <(yaml_list "managed_scripts")
EXCLUDED_ITEMS=()
while IFS= read -r line; do EXCLUDED_ITEMS+=("$line"); done < <(yaml_list "excluded")
DECISIONS_ALLOWLIST=()
while IFS= read -r line; do DECISIONS_ALLOWLIST+=("$line"); done < <(yaml_list "docs_decisions_allowlist")

# Check if a file is allowed by the manifest (allowlisted and not excluded)
file_allowed() {
  local f="$1"

  # Check excluded list first
  for exc in "${EXCLUDED_ITEMS[@]}"; do
    # Exact match
    if [ "$f" = "$exc" ]; then return 1; fi
    # Directory prefix match (exc ends with /)
    if [[ "$exc" == */ ]] && [[ "$f" == "$exc"* ]]; then return 1; fi
    # Glob patterns (*.pen etc)
    case "$exc" in
      \*.*) [[ "$f" == $exc ]] && return 1 ;;
    esac
  done

  # Check managed_roots (file is under a managed root directory)
  for root in "${MANAGED_ROOTS[@]}"; do
    if [[ "$f" == "$root/"* ]] || [ "$f" = "$root" ]; then return 0; fi
  done

  # Check managed_files (exact match)
  for mf in "${MANAGED_FILES[@]}"; do
    if [ "$f" = "$mf" ]; then return 0; fi
  done

  # Check managed_scripts (exact match)
  for ms in "${MANAGED_SCRIPTS[@]}"; do
    if [ "$f" = "$ms" ]; then return 0; fi
  done

  # Check docs_decisions_allowlist (exact match)
  for da in "${DECISIONS_ALLOWLIST[@]}"; do
    if [ "$f" = "$da" ]; then return 0; fi
  done

  # Not in any allowlist
  return 1
}

echo -e "${GREEN}=== Hotfix Lane ===${NC}"
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"
echo "Branch: $BRANCH_NAME"
echo "Files:  ${FILES[*]}"
echo ""

# ── Step 1: Find latest sync tag (on cat-cafe, not clowder-ai) ──
echo -e "${BLUE}[Step 1/6] Finding sync tag on source repo...${NC}"
if [ -n "$CUSTOM_TAG" ]; then
  SYNC_TAG="$CUSTOM_TAG"
  if ! git -C "$SOURCE_DIR" rev-parse "refs/tags/$SYNC_TAG" >/dev/null 2>&1; then
    echo -e "${RED}Error: tag '$SYNC_TAG' not found in source repo (cat-cafe)${NC}"
    exit 1
  fi
else
  SYNC_TAG=$(git -C "$SOURCE_DIR" tag -l 'sync/*' --sort=-version:refname | head -1)
  if [ -z "$SYNC_TAG" ]; then
    echo -e "${RED}Error: no sync/* tags found in source repo (cat-cafe)${NC}"
    echo "Run a full sync first: bash scripts/sync-to-opensource.sh"
    exit 1
  fi
fi
echo -e "  Using tag: ${GREEN}$SYNC_TAG${NC} (on cat-cafe)"
echo -e "  Tag commit: $(git -C "$SOURCE_DIR" log -1 --format='%h %s' "refs/tags/$SYNC_TAG")"

# ── Step 2: Validate source files exist + manifest allowlist ──
echo ""
echo -e "${BLUE}[Step 2/6] Validating source files against manifest...${NC}"
VALIDATION_FAIL=false
for f in "${FILES[@]}"; do
  if [ ! -f "$SOURCE_DIR/$f" ]; then
    echo -e "  ${RED}✗ Not found: $f${NC}"
    VALIDATION_FAIL=true
  elif ! file_allowed "$f"; then
    echo -e "  ${RED}✗ BLOCKED by manifest: $f${NC}"
    echo -e "    ${YELLOW}This file is excluded or not in any allowlist (managed_roots/files/scripts).${NC}"
    echo -e "    ${YELLOW}Hotfix lane cannot bypass the export allowlist.${NC}"
    VALIDATION_FAIL=true
  else
    echo -e "  ${GREEN}✓${NC} $f"
  fi
done

if [ "$VALIDATION_FAIL" = true ]; then
  echo -e "${RED}Error: validation failed. All files must exist AND be in the manifest allowlist.${NC}"
  exit 1
fi

# ── Step 3: Check target repo cleanliness ──
echo ""
echo -e "${BLUE}[Step 3/6] Checking target repo state...${NC}"

if [ "$DRY_RUN" = false ]; then
  # Check for uncommitted changes or staged files in target
  if ! git -C "$TARGET_DIR" diff --quiet 2>/dev/null || ! git -C "$TARGET_DIR" diff --cached --quiet 2>/dev/null; then
    echo -e "  ${RED}✗ Target repo has uncommitted changes. Clean it first.${NC}"
    echo -e "  ${YELLOW}  cd $TARGET_DIR && git status${NC}"
    exit 1
  fi
  echo -e "  ${GREEN}✓${NC} Target repo clean"
fi

# ── Step 4: Create branch in target ──
echo ""
echo -e "${BLUE}[Step 4/6] Creating branch in target repo...${NC}"

if [ "$DRY_RUN" = true ]; then
  echo -e "  ${YELLOW}[dry-run] Would create branch '$BRANCH_NAME' from clowder-ai main${NC}"
else
  # P1 fix: hard-fail if branch already exists — no silent reuse
  if git -C "$TARGET_DIR" rev-parse --verify "refs/heads/$BRANCH_NAME" >/dev/null 2>&1; then
    echo -e "  ${RED}✗ Branch '$BRANCH_NAME' already exists in target repo.${NC}"
    echo -e "  ${YELLOW}  To reuse it, delete it first: git -C $TARGET_DIR branch -D $BRANCH_NAME${NC}"
    echo -e "  ${YELLOW}  Or choose a different branch name.${NC}"
    exit 1
  fi
  # Branch from clowder-ai main (which is the latest sync result)
  git -C "$TARGET_DIR" checkout -b "$BRANCH_NAME" main
  echo -e "  ${GREEN}✓ Branch '$BRANCH_NAME' created from clowder-ai main${NC}"
fi

# ── Step 5: Copy files + sanitize ──
echo ""
echo -e "${BLUE}[Step 5/6] Copying files and sanitizing...${NC}"

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

# ── Step 6: Commit ──
echo ""
echo -e "${BLUE}[Step 6/6] Committing...${NC}"

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
  echo -e "${YELLOW}Intake ledger (before next full sync):${NC}"
  echo "  1. Record the hotfix PR decision:"
  echo "     bash scripts/intake-from-opensource.sh --record --pr <PR_NUMBER> --decision <absorbed|public-only>"
  echo "     (absorbed = fix already in cat-cafe main; public-only = clowder-ai-only change)"
  echo "  2. After all PRs recorded, advance the ledger gate:"
  echo "     bash scripts/intake-from-opensource.sh --advance-ledger"
fi
