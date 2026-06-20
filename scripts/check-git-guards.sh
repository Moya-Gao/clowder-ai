#!/bin/bash
# scripts/check-git-guards.sh — Git Guards Health Check (C-light)
#
# Fail-closed verification that git guards are properly installed.
# Integration: pnpm guards:check
#
# Checks:
#   1. core.hooksPath points to .githooks
#   2. .githooks/ directory exists
#   3. Required hooks present and executable
#   4. merge.conflictStyle = zdiff3
#
# Exit code: 0 = healthy, 1 = issues found
# Fix:       pnpm guards:install

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
  echo -e "${RED}Not in a git repository${NC}" >&2
  exit 1
fi

HOOKS_DIR="$REPO_ROOT/.githooks"
ERRORS=0

echo "Git Guards Health Check"
echo "======================="

# Check 1: core.hooksPath
HOOKS_PATH="$(git config --local core.hooksPath 2>/dev/null || echo "")"
if [ "$HOOKS_PATH" = ".githooks" ]; then
  echo -e "${GREEN}  core.hooksPath = .githooks${NC}"
else
  echo -e "${RED}  core.hooksPath = '${HOOKS_PATH:-not set}' (expected: .githooks)${NC}"
  ERRORS=$((ERRORS + 1))
fi

# Check 2: .githooks/ directory exists
if [ -d "$HOOKS_DIR" ]; then
  echo -e "${GREEN}  .githooks/ directory exists${NC}"
else
  echo -e "${RED}  .githooks/ directory NOT found${NC}"
  ERRORS=$((ERRORS + 1))
fi

# Check 3: Required hooks present and executable
REQUIRED_HOOKS="pre-push post-checkout pre-rebase pre-commit commit-msg"
for hook in $REQUIRED_HOOKS; do
  HOOK_FILE="$HOOKS_DIR/$hook"
  if [ -f "$HOOK_FILE" ]; then
    if [ -x "$HOOK_FILE" ]; then
      echo -e "${GREEN}  $hook: OK${NC}"
    else
      echo -e "${RED}  $hook: present but NOT executable${NC}"
      ERRORS=$((ERRORS + 1))
    fi
  else
    echo -e "${RED}  $hook: NOT found${NC}"
    ERRORS=$((ERRORS + 1))
  fi
done

# Check 4: merge.conflictStyle = zdiff3
CONFLICT_STYLE="$(git config merge.conflictStyle 2>/dev/null || echo "")"
if [ "$CONFLICT_STYLE" = "zdiff3" ]; then
  echo -e "${GREEN}  merge.conflictStyle = zdiff3${NC}"
else
  echo -e "${RED}  merge.conflictStyle = '${CONFLICT_STYLE:-not set}' (expected: zdiff3)${NC}"
  ERRORS=$((ERRORS + 1))
fi

# Result
echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}$ERRORS issue(s) found. Run 'pnpm guards:install' to fix.${NC}"
  exit 1
else
  echo -e "${GREEN}All git guards healthy.${NC}"
  exit 0
fi
