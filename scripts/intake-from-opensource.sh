#!/usr/bin/env bash
# intake-from-opensource.sh — Clowder AI → Cat Café 社区贡献吸收
#
# Usage: see --help or run without args. V1: plan + record only (apply = V2).
# Design consensus (2026-03-13): no bidirectional sync, no reverse transform,
# intake by PR, 3-class: safe-cherry-pick / manual-port / public-only.

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

resolve_target_main_head() {
  if git -C "$TARGET_DIR" remote get-url origin >/dev/null 2>&1; then
    if git -C "$TARGET_DIR" fetch origin main --quiet >/dev/null 2>&1; then
      if git -C "$TARGET_DIR" rev-parse --verify refs/remotes/origin/main >/dev/null 2>&1; then
        git -C "$TARGET_DIR" rev-parse refs/remotes/origin/main 2>/dev/null
        return 0
      fi
    fi
  fi

  git -C "$TARGET_DIR" rev-parse HEAD 2>/dev/null
}

# ── 参数 ──
PR_NUMBER=""
MODE="plan"
ADVANCE_LEDGER=false
FORCE_OVERWRITE=false
RECORD_DECISION=false
DECISION=""
VALIDATE_INBOUND=false
FROM_INDEX=false

for arg in "$@"; do
  case "$arg" in
    --pr=*) PR_NUMBER="${arg#--pr=}" ;;
    --pr) ;; # handled below with next arg
    --mode=*) MODE="${arg#--mode=}" ;;
    --decision=*) DECISION="${arg#--decision=}" ;;
    --advance-ledger) ADVANCE_LEDGER=true ;;
    --force-overwrite) FORCE_OVERWRITE=true ;;
    --record) RECORD_DECISION=true ;;
    --validate-inbound) VALIDATE_INBOUND=true ;;
    --from-index) FROM_INDEX=true ;;
  esac
done
# Handle --pr N and --decision D (space-separated)
while [[ $# -gt 0 ]]; do
  case "$1" in
    --pr) PR_NUMBER="$2"; shift 2 ;;
    --decision) DECISION="$2"; shift 2 ;;
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

# ── Brand-sensitive files (Inbound Guard) ──
# These files contain brand identity that the outbound sanitizer transforms
# (Cat Cafe → Clowder AI). Intake must NOT blindly cherry-pick these files.
# See SKILL.md principle 12-13 for the full Brand Identity Protection List.
BRAND_SENSITIVE_PATTERNS=(
  "packages/web/src/app/layout.tsx"
  "packages/web/public/manifest.json"
  "packages/web/src/components/SplitPaneView.tsx"
  "packages/web/src/components/ChatContainerHeader.tsx"
  "packages/web/src/utils/api-client.ts"
)

is_brand_sensitive() {
  local path="$1"
  for pattern in "${BRAND_SENSITIVE_PATTERNS[@]}"; do
    if [ "$path" = "$pattern" ]; then return 0; fi
  done
  # Also catch icon files
  case "$path" in
    packages/web/public/icons/*) return 0 ;;
  esac
  return 1
}

# ── Brand Expectations (single source of truth) ──
# Format: file|check_type|pattern|description
# check_type: must_not_contain, must_contain, file_exists
# Both --validate-inbound and pre-commit hook consume this list.
BRAND_EXPECTATIONS=(
  # layout.tsx
  "packages/web/src/app/layout.tsx|must_not_contain|Clowder AI|title should be Cat Cafe"
  "packages/web/src/app/layout.tsx|must_not_contain|Your AI team collaboration space|description should be Chinese"
  "packages/web/src/app/layout.tsx|must_contain|favicon.svg|favicon declaration required"
  "packages/web/src/app/layout.tsx|must_contain|icon-192x192.png|PWA icon declaration required"
  # SplitPaneView.tsx
  "packages/web/src/components/SplitPaneView.tsx|must_not_contain|Clowder AI|brand should be Cat Cafe"
  # manifest.json
  "packages/web/public/manifest.json|must_not_contain|Clowder|name should be Cat Cafe"
  # ChatContainerHeader.tsx — surface text AND semantic fields
  "packages/web/src/components/ChatContainerHeader.tsx|must_not_contain|Clowder AI|brand should be Cat Cafe"
  "packages/web/src/components/ChatContainerHeader.tsx|must_contain|Cat Caf|must have Cat Cafe brand"
  "packages/web/src/components/ChatContainerHeader.tsx|must_contain|'cat-cafe'|INTERNAL_BASENAMES must include cat-cafe"
  "packages/web/src/components/ChatContainerHeader.tsx|must_contain|'cat-cafe-runtime'|INTERNAL_BASENAMES must include cat-cafe-runtime"
  # api-client.ts — comment AND real brand identity (F156: header → session cookie)
  "packages/web/src/utils/api-client.ts|must_not_contain|client for Clowder AI|comment should reference Cat Cafe"
  "packages/web/src/utils/api-client.ts|must_contain|HttpOnly session cookie|identity uses session cookie (F156 D-1)"
  # favicon.svg file
  "packages/web/public/icons/favicon.svg|file_exists||favicon SVG must exist"
)

# ── Validate Inbound (Brand Guard) ──
# Checks files for brand contamination from clowder-ai.
# --from-index: read staged (index) content instead of working tree.
#   This is critical for pre-commit hooks where index and worktree may differ.
_BRAND_VIOLATION_COUNT=0

# Index-aware file helpers
_brand_file_exists() {
  if [ "$FROM_INDEX" = true ]; then
    git ls-files --stage -- "$1" 2>/dev/null | grep -q .
  else
    [ -f "$1" ]
  fi
}

_brand_file_contains() {
  local file="$1" pattern="$2"
  if [ "$FROM_INDEX" = true ]; then
    git show :"$file" 2>/dev/null | grep -q "$pattern"
  else
    grep -q "$pattern" "$file" 2>/dev/null
  fi
}

run_brand_validation() {
  _BRAND_VIOLATION_COUNT=0
  for expectation in "${BRAND_EXPECTATIONS[@]}"; do
    IFS='|' read -r file check_type pattern desc <<< "$expectation"
    case "$check_type" in
      must_not_contain)
        if _brand_file_exists "$file" && _brand_file_contains "$file" "$pattern"; then
          echo -e "${RED}  ✗ $file: contains '$pattern' ($desc)${NC}"
          _BRAND_VIOLATION_COUNT=$((_BRAND_VIOLATION_COUNT + 1))
        fi
        ;;
      must_contain)
        if _brand_file_exists "$file" && ! _brand_file_contains "$file" "$pattern"; then
          echo -e "${RED}  ✗ $file: missing '$pattern' ($desc)${NC}"
          _BRAND_VIOLATION_COUNT=$((_BRAND_VIOLATION_COUNT + 1))
        fi
        ;;
      file_exists)
        if ! _brand_file_exists "$file"; then
          echo -e "${RED}  ✗ $file: file missing ($desc)${NC}"
          _BRAND_VIOLATION_COUNT=$((_BRAND_VIOLATION_COUNT + 1))
        fi
        ;;
    esac
  done
}

if [ "$VALIDATE_INBOUND" = true ]; then
  echo -e "${GREEN}=== 🛡 Inbound Brand Guard ===${NC}"
  echo ""
  run_brand_validation
  if [ "$_BRAND_VIOLATION_COUNT" -gt 0 ]; then
    echo ""
    echo -e "${RED}✗ Found $_BRAND_VIOLATION_COUNT brand violation(s)!${NC}"
    echo "  These files contain clowder-ai brand strings that should be cat-cafe values."
    echo "  Fix them before committing. See SKILL.md principle 12-13 for reference values."
    exit 1
  else
    echo -e "${GREEN}✓ No brand violations detected. Safe to commit.${NC}"
    exit 0
  fi
fi

# ── Record decision (happy path) ──
# Records a per-PR decision in entries[]. Does NOT advance last_reviewed_target_head.
# Use --advance-ledger after recording all PRs to advance the gate.
if [ "$RECORD_DECISION" = true ]; then
  if [ -z "$PR_NUMBER" ]; then
    echo -e "${RED}✗ --record requires --pr <number>${NC}"; exit 1
  fi
  if [ -z "$DECISION" ]; then
    echo -e "${RED}✗ --record requires --decision <absorbed|public-only|rejected>${NC}"; exit 1
  fi
  # P2 fix: mandatory Brand Guard before recording absorbed intake
  if [ "$DECISION" = "absorbed" ]; then
    echo -e "${BLUE}── Mandatory Brand Guard (pre-record) ──${NC}"
    run_brand_validation
    if [ "$_BRAND_VIOLATION_COUNT" -gt 0 ]; then
      echo ""
      echo -e "${RED}✗ $_BRAND_VIOLATION_COUNT brand violation(s) detected. Fix before recording absorbed intake.${NC}"
      echo "  Run: bash scripts/intake-from-opensource.sh --validate-inbound  (for details)"
      exit 1
    fi
    echo -e "${GREEN}✓ Brand Guard passed.${NC}"
    echo ""
  fi
  case "$DECISION" in
    absorbed|public-only|rejected|outbound-sync) ;;
    *) echo -e "${RED}✗ Invalid decision '$DECISION'. Use: absorbed | public-only | rejected | outbound-sync${NC}"; exit 1 ;;
  esac
  if [ ! -f "$INTAKE_LEDGER" ]; then
    echo -e "${RED}✗ Intake ledger not found${NC}"; exit 1
  fi
  PR_MERGE_INFO=$(gh pr view "$PR_NUMBER" --repo "$TARGET_REPO" --json state,mergeCommit 2>/dev/null || true)
  if [ -z "$PR_MERGE_INFO" ]; then
    echo -e "${RED}✗ Cannot fetch PR #$PR_NUMBER from $TARGET_REPO${NC}"; exit 1
  fi
  PR_REC_STATE=$(echo "$PR_MERGE_INFO" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); console.log(d.state)")
  if [ "$PR_REC_STATE" != "MERGED" ]; then
    echo -e "${RED}✗ PR #$PR_NUMBER is $PR_REC_STATE, not MERGED.${NC}"; exit 1
  fi
  PR_MERGE_SHA=$(echo "$PR_MERGE_INFO" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); console.log((d.mergeCommit||{}).oid||'')")
  node -e "
    const fs = require('fs');
    const ledger = JSON.parse(fs.readFileSync('$INTAKE_LEDGER', 'utf-8'));
    if (ledger.entries.some(e => e.pr_number === $PR_NUMBER && e.action !== 'force_advance')) {
      console.log('⚠ PR #$PR_NUMBER already recorded. Skipping.'); process.exit(0);
    }
    ledger.entries.push({
      pr_number: $PR_NUMBER, target_merge_commit: '$PR_MERGE_SHA',
      decision: '$DECISION', timestamp: new Date().toISOString()
    });
    fs.writeFileSync('$INTAKE_LEDGER', JSON.stringify(ledger, null, 2) + '\n');
    console.log('✓ Recorded PR #$PR_NUMBER → $DECISION (merge: ${PR_MERGE_SHA:0:12})');
  "
  # Auto-attempt advance-ledger after successful record
  echo ""
  echo -e "${BLUE}── Auto-attempting ledger advance ──${NC}"
  bash "$0" --advance-ledger
  exit $?
fi

# ── Advance ledger ──
if [ "$ADVANCE_LEDGER" = true ]; then
  if [ ! -d "$TARGET_DIR/.git" ]; then
    echo -e "${RED}✗ Target repo not found at $TARGET_DIR${NC}"
    exit 1
  fi
  CURRENT_HEAD=$(resolve_target_main_head)
  if [ ! -f "$INTAKE_LEDGER" ]; then
    echo -e "${RED}✗ Intake ledger not found at $INTAKE_LEDGER${NC}"
    exit 1
  fi
  OLD_HEAD=$(node -e "const l=JSON.parse(require('fs').readFileSync('$INTAKE_LEDGER','utf-8')); console.log(l.last_reviewed_target_head || '')" 2>/dev/null || true)
  if [ "$OLD_HEAD" = "$CURRENT_HEAD" ]; then
    echo -e "${GREEN}✓ Ledger already at target HEAD ($CURRENT_HEAD)${NC}"
    exit 0
  fi
  # Enumerate landed non-sync commits on the target repo mainline (first-parent only).
  # A long community PR may merge multiple branch commits under one recorded merge commit;
  # those child commits should not block advance-ledger.
  UNREVIEWED=""
  UNREVIEWED_COUNT=0
  if [ -n "$OLD_HEAD" ]; then
    # Build set of recorded merge commits from entries[]
    RECORDED_SHAS=$(node -e "const l=JSON.parse(require('fs').readFileSync('$INTAKE_LEDGER','utf-8')); l.entries.filter(e=>e.target_merge_commit).forEach(e=>console.log(e.target_merge_commit))" 2>/dev/null || true)
    for c in $(git -C "$TARGET_DIR" rev-list --first-parent "$OLD_HEAD".."$CURRENT_HEAD" 2>/dev/null); do
      MSG=$(git -C "$TARGET_DIR" log --format=%s -1 "$c" 2>/dev/null || true)
      if echo "$MSG" | grep -qE "^sync:.*(cat-cafe|clowder-ai|v[0-9]+\.[0-9]+|outbound)"; then continue; fi
      # Check if this landed mainline commit is covered by an entries[] record
      if echo "$RECORDED_SHAS" | grep -q "^${c}$"; then continue; fi
      UNREVIEWED_COUNT=$((UNREVIEWED_COUNT + 1))
      SHORT=$(git -C "$TARGET_DIR" log --format="%h %s" -1 "$c" 2>/dev/null)
      UNREVIEWED="${UNREVIEWED}    → ${SHORT}\n"
    done
  fi
  if [ "$UNREVIEWED_COUNT" -gt 0 ]; then
    echo -e "${RED}✗ Cannot advance: $UNREVIEWED_COUNT unrecorded non-sync commit(s)${NC}"
    echo -e "$UNREVIEWED"
    echo ""
    echo "  For each community PR, run:"
    echo "    bash scripts/intake-from-opensource.sh --pr <N> --mode=plan"
    echo "    bash scripts/intake-from-opensource.sh --record --pr <N> --decision <absorbed|public-only|rejected|outbound-sync>"
    echo ""
    echo "  Or force-advance (DANGEROUS — skips per-PR review):"
    echo "    bash scripts/intake-from-opensource.sh --advance-ledger --force-overwrite"
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
  echo "Usage:"
  echo "  bash scripts/intake-from-opensource.sh --pr <N> --mode=plan              # Analyze PR"
  echo "  bash scripts/intake-from-opensource.sh --record --pr <N> --decision <D>  # Record decision"
  echo "  bash scripts/intake-from-opensource.sh --advance-ledger                  # Advance ledger (sync-only commits)"
  echo "  bash scripts/intake-from-opensource.sh --validate-inbound                # 🛡 Check brand contamination (working tree)"
  echo "  bash scripts/intake-from-opensource.sh --validate-inbound --from-index   # 🛡 Check brand contamination (staged/index)"
  echo ""
  echo "Decisions: absorbed | public-only | rejected"
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
BRAND_FILES=""
BRAND_COUNT=0

while IFS= read -r file; do
  [ -z "$file" ] && continue
  if is_public_only "$file"; then
    PUBLIC_FILES="${PUBLIC_FILES}  ${file}\n"
    PUBLIC_COUNT=$((PUBLIC_COUNT + 1))
  elif is_brand_sensitive "$file"; then
    BRAND_FILES="${BRAND_FILES}  ${file}\n"
    BRAND_COUNT=$((BRAND_COUNT + 1))
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

if [ "$BRAND_COUNT" -gt 0 ]; then
  echo -e "${RED}🛡 BRAND GUARD ($BRAND_COUNT files)${NC} — contains brand identity, DO NOT cherry-pick directly!"
  echo -e "$BRAND_FILES"
  echo -e "  ${YELLOW}→ Must diff-merge manually: take logic changes, keep cat-cafe brand values${NC}"
  echo -e "  ${YELLOW}→ After merge, run: bash scripts/intake-from-opensource.sh --validate-inbound${NC}"
  echo ""
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
echo "  Total files: $((SAFE_COUNT + BRAND_COUNT + MANUAL_COUNT + PUBLIC_COUNT))"
echo -e "  ${GREEN}Safe:${NC}   $SAFE_COUNT  (auto-absorbable)"
if [ "$BRAND_COUNT" -gt 0 ]; then
  echo -e "  ${RED}Brand:${NC} $BRAND_COUNT  (🛡 manual diff-merge only!)"
fi
echo -e "  ${YELLOW}Manual:${NC} $MANUAL_COUNT  (needs human review)"
echo -e "  ${BLUE}Skip:${NC}   $PUBLIC_COUNT  (public-only)"

if [ "$MODE" = "plan" ]; then
  echo ""
  echo -e "${BLUE}── Recommended Actions ──${NC}"
  if [ "$BRAND_COUNT" -gt 0 ]; then
    echo -e "  ${RED}0. 🛡 BRAND GUARD: Manually diff-merge $BRAND_COUNT brand-sensitive file(s)${NC}"
    echo "     Compare clowder-ai version with cat-cafe version, keep cat-cafe brand values"
    echo "     Run: bash scripts/intake-from-opensource.sh --validate-inbound"
  fi
  if [ "$SAFE_COUNT" -gt 0 ]; then
    echo "  1. Cherry-pick safe files from clowder-ai PR #$PR_NUMBER"
    echo "     (V2 will automate this with --mode=apply)"
  fi
  if [ "$MANUAL_COUNT" -gt 0 ]; then
    echo "  2. Manually review and port transformed files"
    echo "     Compare clowder-ai diff with cat-cafe source"
  fi
  echo "  3. Open the cat-cafe absorb PR with PR body lines:"
  echo "     Closes #<IntakeIntentIssue>   (one line per issue; auto-close on merge)"
  echo "  4. Record decision: --record --pr $PR_NUMBER --decision absorbed"
  echo "     (or: --decision public-only | --decision rejected)"
  echo "  5. After all PRs recorded: --advance-ledger"
  echo "  6. After absorb PR merge, confirm the Intake Intent Issue is closed"
elif [ "$MODE" = "apply" ]; then
  echo ""
  echo -e "${YELLOW}⚠ --mode=apply not yet implemented (V2)${NC}"
  echo "  For now, manually cherry-pick the safe files."
fi
