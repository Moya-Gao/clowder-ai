#!/usr/bin/env bash
# intake-from-opensource.sh — Clowder AI → Cat Café 社区贡献吸收
#
# Usage:
#   bash scripts/intake-from-opensource.sh --pr 42 --mode=plan    # 分析 PR，生成吸收报告
#   bash scripts/intake-from-opensource.sh --pr 42 --mode=apply   # 自动吸收 safe 文件（TODO: V2）
#   bash scripts/intake-from-opensource.sh --advance-ledger       # 推进 ledger 到 target HEAD
#
# V1: plan mode only. apply mode 留给 V2。
# 设计共识（布偶猫 + 缅因猫 2026-03-13）：
#   - 不做双向自动 sync，不做通用 reverse transform
#   - intake 以 PR 为单位，分三类：safe-cherry-pick / manual-port / public-only
#   - 用 ledger 作为出站 sync 的门禁真相源

set -euo pipefail

# ── 颜色 ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ── 路径 ──
SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="$SOURCE_DIR/../clowder-ai"
INTAKE_LEDGER="$SOURCE_DIR/docs/ops/opensource-intake-ledger.json"
TARGET_REPO="zts212653/clowder-ai"

# ── 参数 ──
PR_NUMBER=""
MODE="plan"
ADVANCE_LEDGER=false

for arg in "$@"; do
  case "$arg" in
    --pr=*) PR_NUMBER="${arg#--pr=}" ;;
    --pr) ;; # handled below with next arg
    --mode=*) MODE="${arg#--mode=}" ;;
    --advance-ledger) ADVANCE_LEDGER=true ;;
  esac
done
# Handle --pr N (space-separated)
while [[ $# -gt 0 ]]; do
  case "$1" in
    --pr) PR_NUMBER="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# ── Path classification ──
# Files that are COMPLETELY REPLACED during outbound sync (never absorb)
is_public_only() {
  local path="$1"
  case "$path" in
    .github/FUNDING.yml|.github/ISSUE_TEMPLATE/*|.github/DISCUSSION_TEMPLATE/*) return 0 ;;
    CHANGELOG.md|docs/community/*) return 0 ;;
    # Generated/replaced files
    README.md|CONTRIBUTING.md|SETUP.md|LICENSE|.env.example) return 0 ;;
    .github/pull_request_template.md) return 0 ;;
    CLAUDE.md|AGENTS.md|GEMINI.md) return 0 ;;
    cat-config.json) return 0 ;;
    docs/ROADMAP.md|docs/public-lessons.md|docs/README.md) return 0 ;;
    .sync-provenance.json) return 0 ;;
    *) return 1 ;;
  esac
}

# Files with code-level transforms (port remapping, config changes, sanitization)
# P2 fix: conservative default — docs/** and scripts/** are all manual-port because
# outbound sanitizer applies global transforms (cat names, ports, internal paths) to
# ALL docs and shell scripts, not just the specific files listed here.
is_manual_port() {
  local path="$1"
  case "$path" in
    # Specific known-transformed source files
    packages/api/src/domains/leaderboard/leaderboard-service.ts) return 0 ;;
    packages/web/src/lib/mention-highlight.ts) return 0 ;;
    packages/api/src/config/ConfigRegistry.ts) return 0 ;;
    packages/api/src/config/env-registry.ts) return 0 ;;
    packages/api/src/config/frontend-origin.ts) return 0 ;;
    packages/api/src/config/governance/governance-pack.ts) return 0 ;;
    # ALL docs — sanitizer does cat-name / port / internal-path transforms on every .md
    docs/*) return 0 ;;
    # ALL scripts — sanitizer does global replacements on all .sh files
    scripts/*) return 0 ;;
    # Skills directory — heavily transformed
    cat-cafe-skills/*) return 0 ;;
    *) return 1 ;;
  esac
}

# Everything else = safe to cherry-pick (only cosmetic sanitization applied)
# packages/api/**, packages/web/**, packages/shared/**, packages/mcp-server/**

# ── Advance ledger ──
if [ "$ADVANCE_LEDGER" = true ]; then
  if [ ! -d "$TARGET_DIR/.git" ]; then
    echo -e "${RED}✗ Target repo not found at $TARGET_DIR${NC}"
    exit 1
  fi
  CURRENT_HEAD=$(git -C "$TARGET_DIR" rev-parse HEAD 2>/dev/null)
  if [ ! -f "$INTAKE_LEDGER" ]; then
    echo -e "${RED}✗ Intake ledger not found at $INTAKE_LEDGER${NC}"
    exit 1
  fi
  OLD_HEAD=$(node -e "const l=JSON.parse(require('fs').readFileSync('$INTAKE_LEDGER','utf-8')); console.log(l.last_reviewed_target_head || '')" 2>/dev/null || true)
  if [ "$OLD_HEAD" = "$CURRENT_HEAD" ]; then
    echo -e "${GREEN}✓ Ledger already at target HEAD ($CURRENT_HEAD)${NC}"
    exit 0
  fi
  # Enumerate non-sync commits between old head and target HEAD
  UNREVIEWED=""
  UNREVIEWED_COUNT=0
  if [ -n "$OLD_HEAD" ]; then
    for c in $(git -C "$TARGET_DIR" rev-list "$OLD_HEAD".."$CURRENT_HEAD" 2>/dev/null); do
      MSG=$(git -C "$TARGET_DIR" log --format=%s -1 "$c" 2>/dev/null || true)
      if ! echo "$MSG" | grep -q "^sync: cat-cafe"; then
        UNREVIEWED_COUNT=$((UNREVIEWED_COUNT + 1))
        SHORT=$(git -C "$TARGET_DIR" log --format="%h %s" -1 "$c" 2>/dev/null)
        UNREVIEWED="${UNREVIEWED}    → ${SHORT}\n"
      fi
    done
  fi
  if [ "$UNREVIEWED_COUNT" -gt 0 ]; then
    echo -e "${RED}✗ Cannot advance: $UNREVIEWED_COUNT unreviewed non-sync commit(s)${NC}"
    echo -e "$UNREVIEWED"
    echo ""
    echo "  Run intake --pr <N> --mode=plan for each community PR first."
    echo "  Then re-run --advance-ledger --force to advance with audit trail."
    if [ "$FORCE_OVERWRITE" != true ]; then
      exit 1
    fi
    echo -e "${YELLOW}⚠ --force-overwrite: force-advancing ledger${NC}"
    # Record forced advance in entries for audit
    node -e "
      const fs = require('fs');
      const ledger = JSON.parse(fs.readFileSync('$INTAKE_LEDGER', 'utf-8'));
      ledger.entries.push({
        action: 'force_advance',
        from: '$OLD_HEAD',
        to: '$CURRENT_HEAD',
        skipped_community_commits: $UNREVIEWED_COUNT,
        timestamp: new Date().toISOString(),
        notes: 'Force-advanced without per-PR review'
      });
      ledger.last_reviewed_target_head = '$CURRENT_HEAD';
      fs.writeFileSync('$INTAKE_LEDGER', JSON.stringify(ledger, null, 2) + '\n');
      console.log('⚠ Ledger force-advanced to: $CURRENT_HEAD');
    "
    exit 0
  fi
  # No unreviewed commits — safe to auto-advance
  node -e "
    const fs = require('fs');
    const ledger = JSON.parse(fs.readFileSync('$INTAKE_LEDGER', 'utf-8'));
    ledger.last_reviewed_target_head = '$CURRENT_HEAD';
    fs.writeFileSync('$INTAKE_LEDGER', JSON.stringify(ledger, null, 2) + '\n');
    console.log('✓ Ledger advanced to: $CURRENT_HEAD (only sync commits since last review)');
  "
  exit 0
fi

# ── Plan mode ──
if [ -z "$PR_NUMBER" ]; then
  echo "Usage: bash scripts/intake-from-opensource.sh --pr <number> --mode=plan"
  echo "       bash scripts/intake-from-opensource.sh --advance-ledger"
  exit 1
fi

echo -e "${GREEN}=== Clowder AI → Cat Café Intake ===${NC}"
echo "PR: #$PR_NUMBER"
echo "Mode: $MODE"
echo ""

# Fetch PR info
PR_INFO=$(gh pr view "$PR_NUMBER" --repo "$TARGET_REPO" --json title,state,author,mergedAt,mergeCommit,files 2>/dev/null || true)
if [ -z "$PR_INFO" ]; then
  echo -e "${RED}✗ Cannot fetch PR #$PR_NUMBER from $TARGET_REPO${NC}"
  exit 1
fi

PR_TITLE=$(echo "$PR_INFO" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); console.log(d.title)")
PR_STATE=$(echo "$PR_INFO" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); console.log(d.state)")
PR_AUTHOR=$(echo "$PR_INFO" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); console.log(d.author.login)")
PR_MERGED=$(echo "$PR_INFO" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); console.log(d.mergedAt || 'not merged')")

echo -e "${BLUE}Title:${NC}  $PR_TITLE"
echo -e "${BLUE}Author:${NC} $PR_AUTHOR"
echo -e "${BLUE}State:${NC}  $PR_STATE"
echo -e "${BLUE}Merged:${NC} $PR_MERGED"
echo ""

# P1-2: Block plan on unmerged PRs — intake operates on landed facts, not candidates
if [ "$PR_STATE" != "MERGED" ]; then
  echo -e "${RED}✗ PR #$PR_NUMBER is $PR_STATE, not MERGED.${NC}"
  echo "  Intake operates on PRs that have landed in clowder-ai main."
  echo "  Merge the PR first, then re-run intake."
  exit 1
fi

# Get changed files
FILES=$(echo "$PR_INFO" | node -e "
  const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8'));
  (d.files || []).forEach(f => console.log(f.path));
")

if [ -z "$FILES" ]; then
  echo -e "${YELLOW}⚠ No files found in PR (may not be merged yet)${NC}"
  echo "  Intake works best with merged PRs."
  exit 0
fi

# Classify files
SAFE_FILES=""
SAFE_COUNT=0
MANUAL_FILES=""
MANUAL_COUNT=0
PUBLIC_FILES=""
PUBLIC_COUNT=0

while IFS= read -r file; do
  [ -z "$file" ] && continue
  if is_public_only "$file"; then
    PUBLIC_FILES="${PUBLIC_FILES}  ${file}\n"
    PUBLIC_COUNT=$((PUBLIC_COUNT + 1))
  elif is_manual_port "$file"; then
    MANUAL_FILES="${MANUAL_FILES}  ${file}\n"
    MANUAL_COUNT=$((MANUAL_COUNT + 1))
  else
    SAFE_FILES="${SAFE_FILES}  ${file}\n"
    SAFE_COUNT=$((SAFE_COUNT + 1))
  fi
done <<< "$FILES"

# Report
echo -e "${GREEN}── Intake Classification ──${NC}"
echo ""

if [ "$SAFE_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✓ safe-cherry-pick ($SAFE_COUNT files)${NC} — can absorb directly"
  echo -e "$SAFE_FILES"
fi

if [ "$MANUAL_COUNT" -gt 0 ]; then
  echo -e "${YELLOW}⚠ manual-port ($MANUAL_COUNT files)${NC} — has outbound transforms, review diff manually"
  echo -e "$MANUAL_FILES"
fi

if [ "$PUBLIC_COUNT" -gt 0 ]; then
  echo -e "${BLUE}○ public-only ($PUBLIC_COUNT files)${NC} — skip (generated/replaced during sync)"
  echo -e "$PUBLIC_FILES"
fi

echo ""
echo -e "${BLUE}── Summary ──${NC}"
echo "  Total files: $((SAFE_COUNT + MANUAL_COUNT + PUBLIC_COUNT))"
echo -e "  ${GREEN}Safe:${NC}   $SAFE_COUNT  (auto-absorbable)"
echo -e "  ${YELLOW}Manual:${NC} $MANUAL_COUNT  (needs human review)"
echo -e "  ${BLUE}Skip:${NC}   $PUBLIC_COUNT  (public-only)"

if [ "$MODE" = "plan" ]; then
  echo ""
  echo -e "${BLUE}── Recommended Actions ──${NC}"
  if [ "$SAFE_COUNT" -gt 0 ]; then
    echo "  1. Cherry-pick safe files from clowder-ai PR #$PR_NUMBER"
    echo "     (V2 will automate this with --mode=apply)"
  fi
  if [ "$MANUAL_COUNT" -gt 0 ]; then
    echo "  2. Manually review and port transformed files"
    echo "     Compare clowder-ai diff with cat-cafe source"
  fi
  echo "  3. After absorbing, update ledger:"
  echo "     bash scripts/intake-from-opensource.sh --advance-ledger"
elif [ "$MODE" = "apply" ]; then
  echo ""
  echo -e "${YELLOW}⚠ --mode=apply not yet implemented (V2)${NC}"
  echo "  For now, manually cherry-pick the safe files."
fi
