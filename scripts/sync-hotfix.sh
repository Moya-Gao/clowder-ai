#!/usr/bin/env bash
# sync-hotfix.sh — Hotfix Lane: 精准推送指定文件到 clowder-ai
# Usage (MUST run from a worktree based on a sync tag):
#   git worktree add -b fix/xxx ../hotfix sync/TAG && cd ../hotfix
#   # ... fix bug ... then:
#   bash scripts/sync-hotfix.sh fix/xxx <file1> [file2] ...
#
# Flags: --dry-run --tag=NAME --no-sanitize --push --force-unsafe-source
#        --cat-sig="[宪宪/Opus-46🐾]" --co-author="Name <email>" (repeatable)
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
FORCE_UNSAFE_SOURCE=false
BRANCH_NAME=""
FILES=()
CO_AUTHORS=()
CAT_SIG=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --tag=*) CUSTOM_TAG="${arg#--tag=}" ;;
    --no-sanitize) NO_SANITIZE=true ;;
    --push) AUTO_PUSH=true ;;
    --force-unsafe-source) FORCE_UNSAFE_SOURCE=true ;;
    --co-author=*) CO_AUTHORS+=("${arg#--co-author=}") ;;
    --cat-sig=*) CAT_SIG="${arg#--cat-sig=}" ;;
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
if [ -z "$BRANCH_NAME" ] || [ ${#FILES[@]} -eq 0 ]; then
  echo -e "${RED}Error: branch name and at least one file required${NC}"
  echo "Usage: $0 <branch-name> <file1> [file2] ..."
  exit 1
fi

# ── Resolve directories ──
# SOURCE_DIR = pwd (expected to be a worktree based on a sync tag)
SOURCE_DIR="$(pwd)"
# SCRIPT_DIR = where the script lives (for finding sanitizer etc.)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="${CLOWDER_AI_DIR:-$(cd "$SOURCE_DIR/.." && pwd)/clowder-ai}"
MANIFEST="$SOURCE_DIR/sync-manifest.yaml"
TARGET_SYNC_TAG_REFS="refs/cat-cafe-hotfix-sync-tags"

if [ ! -d "$TARGET_DIR/.git" ]; then
  echo -e "${RED}Error: clowder-ai not found at $TARGET_DIR${NC}"
  echo "Set CLOWDER_AI_DIR or ensure ../clowder-ai exists"
  exit 1
fi

if [ ! -f "$MANIFEST" ]; then
  echo -e "${RED}Error: sync-manifest.yaml not found at $MANIFEST${NC}"
  exit 1
fi

# ── Source side constraint: must be a git worktree ──
GIT_COMMON="$(git -C "$SOURCE_DIR" rev-parse --git-common-dir 2>/dev/null || echo "")"
GIT_DIR="$(git -C "$SOURCE_DIR" rev-parse --git-dir 2>/dev/null || echo "")"
if [ "$GIT_COMMON" = "$GIT_DIR" ] || [ -z "$GIT_COMMON" ]; then
  if [ "$FORCE_UNSAFE_SOURCE" = true ]; then
    echo -e "${YELLOW}⚠ WARNING: Not a worktree. Does NOT satisfy AC#3.${NC}"
  else
    echo -e "${RED}Error: pwd is not a git worktree.${NC}"
    echo "Run from a worktree: git worktree add -b fix/xxx ../hotfix sync/TAG"
    echo "Or bypass (unsafe): --force-unsafe-source"
    exit 1
  fi
fi

# ── Parse manifest allowlist + excluded ──
yaml_list() {
  local key="$1"
  awk -v k="$key:" '
    BEGIN{f=0} f&&/^[^ #-]/{exit}
    f&&/^  - /{l=$0;sub(/^  - /,"",l);sub(/[[:space:]]#.*/,"",l);gsub(/^[[:space:]]+/,"",l);gsub(/[[:space:]]+$/,"",l);gsub(/"/,"",l);if(length(l)>0)print l;next}
    $0~"^"k{f=1}
  ' "$MANIFEST"
}

MANAGED_ROOTS=(); while IFS= read -r l; do MANAGED_ROOTS+=("$l"); done < <(yaml_list "managed_roots")
MANAGED_FILES=(); while IFS= read -r l; do MANAGED_FILES+=("$l"); done < <(yaml_list "managed_files")
MANAGED_SCRIPTS=(); while IFS= read -r l; do MANAGED_SCRIPTS+=("$l"); done < <(yaml_list "managed_scripts")
EXCLUDED_ITEMS=(); while IFS= read -r l; do EXCLUDED_ITEMS+=("$l"); done < <(yaml_list "excluded")
DECISIONS_ALLOWLIST=(); while IFS= read -r l; do DECISIONS_ALLOWLIST+=("$l"); done < <(yaml_list "docs_decisions_allowlist")

file_allowed() {
  local f="$1"
  for exc in "${EXCLUDED_ITEMS[@]}"; do
    [ "$f" = "$exc" ] && return 1
    [[ "$exc" == */ ]] && [[ "$f" == "$exc"* ]] && return 1
    case "$exc" in \*.*) [[ "$f" == $exc ]] && return 1 ;; esac
  done
  for root in "${MANAGED_ROOTS[@]}"; do
    [[ "$f" == "$root/"* ]] || [ "$f" = "$root" ] && return 0
  done
  for mf in "${MANAGED_FILES[@]}"; do [ "$f" = "$mf" ] && return 0; done
  for ms in "${MANAGED_SCRIPTS[@]}"; do [ "$f" = "$ms" ] && return 0; done
  for da in "${DECISIONS_ALLOWLIST[@]}"; do [ "$f" = "$da" ] && return 0; done
  return 1
}

echo -e "${GREEN}=== Hotfix Lane ===${NC}"
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"
echo "Branch: $BRANCH_NAME"
echo "Files:  ${FILES[*]}"
echo ""

# ── Sync baseline selection uses refreshed source tags + mirrored target commit times ──
refresh_source_sync_tags() {
  if ! git -C "$SOURCE_DIR" fetch --quiet --force --prune --prune-tags origin \
    "+refs/tags/sync/*:refs/tags/sync/*" >/dev/null 2>&1; then
    echo -e "${RED}Error: failed to refresh cat-cafe sync tags from origin${NC}" >&2
    return 1
  fi
}

refresh_target_sync_tags() {
  if ! git -C "$TARGET_DIR" fetch --quiet origin main >/dev/null 2>&1; then
    echo -e "${RED}Error: failed to refresh clowder-ai origin/main${NC}" >&2
    return 1
  fi

if ! git -C "$TARGET_DIR" fetch --quiet --force --prune origin \
    "+refs/tags/sync/*:$TARGET_SYNC_TAG_REFS/sync/*" >/dev/null 2>&1; then
    echo -e "${RED}Error: failed to refresh clowder-ai sync tags from origin${NC}" >&2
    return 1
  fi
}

select_latest_sync_tag() {
  local tag
  local best_tag=""
  local best_epoch=""

  while IFS= read -r tag; do
    [ -z "$tag" ] && continue
    if ! git -C "$TARGET_DIR" rev-parse --verify "$TARGET_SYNC_TAG_REFS/$tag^{commit}" >/dev/null 2>&1; then
      continue
    fi
    if ! git -C "$TARGET_DIR" merge-base --is-ancestor \
      "$TARGET_SYNC_TAG_REFS/$tag^{commit}" refs/remotes/origin/main >/dev/null 2>&1; then
      continue
    fi

    local epoch
    epoch=$(git -C "$TARGET_DIR" show -s --format=%ct "$TARGET_SYNC_TAG_REFS/$tag^{commit}" 2>/dev/null || true)
    [ -z "$epoch" ] && continue

    if [ -z "$best_epoch" ] || [ "$epoch" -gt "$best_epoch" ] || { [ "$epoch" -eq "$best_epoch" ] && [[ "$tag" > "$best_tag" ]]; }; then
      best_epoch="$epoch"
      best_tag="$tag"
    fi
  done < <(git -C "$SOURCE_DIR" tag -l 'sync/*')

  if [ -n "$best_tag" ]; then
    printf '%s\n' "$best_tag"
    return 0
  fi
  return 1
}

# ── Step 1: Find latest sync tag (on cat-cafe, not clowder-ai) ──
echo -e "${BLUE}[Step 1/7] Finding sync tag on source repo...${NC}"
refresh_source_sync_tags || exit 1
refresh_target_sync_tags || exit 1
if [ -n "$CUSTOM_TAG" ]; then
  SYNC_TAG="$CUSTOM_TAG"
  if ! git -C "$SOURCE_DIR" rev-parse --verify "refs/tags/$SYNC_TAG^{commit}" >/dev/null 2>&1; then
    echo -e "${RED}Error: tag '$SYNC_TAG' not found in source repo (cat-cafe)${NC}"
    exit 1
  fi
  if ! git -C "$TARGET_DIR" rev-parse --verify "$TARGET_SYNC_TAG_REFS/$SYNC_TAG^{commit}" >/dev/null 2>&1; then
    echo -e "${RED}Error: tag '$SYNC_TAG' has not landed on clowder-ai origin${NC}"
    exit 1
  fi
  if ! git -C "$TARGET_DIR" merge-base --is-ancestor \
    "$TARGET_SYNC_TAG_REFS/$SYNC_TAG^{commit}" refs/remotes/origin/main >/dev/null 2>&1; then
    echo -e "${RED}Error: tag '$SYNC_TAG' is no longer on clowder-ai origin/main${NC}"
    exit 1
  fi
else
  SYNC_TAG=$(select_latest_sync_tag || true)
  if [ -z "$SYNC_TAG" ]; then
    echo -e "${RED}Error: no sync/* tags found in source repo (cat-cafe)${NC}"
    echo "Run a full sync first: bash scripts/sync-to-opensource.sh"
    exit 1
  fi
fi
echo -e "  Using tag: ${GREEN}$SYNC_TAG${NC} (on cat-cafe)"
echo -e "  Tag commit: $(git -C "$SOURCE_DIR" log -1 --format='%h %s' "refs/tags/$SYNC_TAG")"

# ── Source-side baseline: HEAD must equal sync tag, local changes only in FILES ──
if [ "$FORCE_UNSAFE_SOURCE" = false ]; then
  TAG_SHA=$(git -C "$SOURCE_DIR" rev-parse "refs/tags/$SYNC_TAG^{commit}" 2>/dev/null)
  HEAD_SHA=$(git -C "$SOURCE_DIR" rev-parse HEAD 2>/dev/null)
  if [ "$TAG_SHA" != "$HEAD_SHA" ]; then
    echo -e "${RED}Error: HEAD ($HEAD_SHA) is not at sync tag ($TAG_SHA).${NC}"
    echo "Worktree must be based directly on the sync tag with no extra commits."
    echo "Create with: git worktree add -b fix/xxx ../hotfix $SYNC_TAG"
    exit 1
  fi
  # HEAD == tag, so only local uncommitted/staged changes can exist. Verify they're in FILES.
  EXTRA=false
  ALL_CHANGES=$({ git -C "$SOURCE_DIR" diff --name-only 2>/dev/null; \
                   git -C "$SOURCE_DIR" diff --cached --name-only 2>/dev/null; } | sort -u)
  while IFS= read -r ch; do
    [ -z "$ch" ] && continue
    HIT=false; for f in "${FILES[@]}"; do [ "$ch" = "$f" ] && HIT=true && break; done
    [ "$HIT" = false ] && echo -e "  ${RED}✗ Extra change in worktree: $ch${NC}" && EXTRA=true
  done <<< "$ALL_CHANGES"
  if [ "$EXTRA" = true ]; then
    echo -e "${RED}Error: worktree has changes beyond specified files.${NC}"
    exit 1
  fi
fi

# ── Step 2: Validate source files exist + manifest allowlist ──
echo ""
echo -e "${BLUE}[Step 2/7] Validating source files against manifest...${NC}"
VALIDATION_FAIL=false
for f in "${FILES[@]}"; do
  if [ ! -f "$SOURCE_DIR/$f" ]; then
    echo -e "  ${RED}✗ Not found: $f${NC}"; VALIDATION_FAIL=true
  elif ! file_allowed "$f"; then
    echo -e "  ${RED}✗ BLOCKED by manifest: $f${NC}"; VALIDATION_FAIL=true
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
echo -e "${BLUE}[Step 3/7] Checking target repo state...${NC}"

if [ "$DRY_RUN" = false ]; then
  # Check for uncommitted changes or staged files in target
  if ! git -C "$TARGET_DIR" diff --quiet 2>/dev/null || ! git -C "$TARGET_DIR" diff --cached --quiet 2>/dev/null; then
    echo -e "  ${RED}✗ Target repo has uncommitted changes. Clean it first.${NC}"
    echo -e "  ${YELLOW}  cd $TARGET_DIR && git status${NC}"
    exit 1
  fi
  echo -e "  ${GREEN}✓${NC} Target repo clean"
fi

# ── Resolve sanitizer early (needed for drift check + copy) ──
SANITIZER="$SCRIPT_DIR/_sanitize-rules.pl"
if [ ! -f "$SANITIZER" ]; then
  echo -e "${RED}Error: _sanitize-rules.pl not found at $SANITIZER${NC}"
  exit 1
fi

# ── Step 4: Target drift check (AC#3 guardian) ──
echo ""
echo -e "${BLUE}[Step 4/7] Checking target files for post-sync drift...${NC}"

# Content-based: sync tag file + sanitizer = expected baseline in clowder-ai
DRIFT_FAIL=false
for f in "${FILES[@]}"; do
  if [ ! -f "$TARGET_DIR/$f" ]; then
    echo -e "  ${GREEN}✓${NC} $f (new file)"
    continue
  fi
  BASELINE_TMP=$(mktemp)
  if ! git -C "$SOURCE_DIR" show "refs/tags/$SYNC_TAG:$f" > "$BASELINE_TMP" 2>/dev/null; then
    rm -f "$BASELINE_TMP"; echo -e "  ${YELLOW}⚠${NC} $f (not in sync tag)"; continue
  fi
  perl -pi "$SANITIZER" "$BASELINE_TMP"
  if ! diff -q "$BASELINE_TMP" "$TARGET_DIR/$f" >/dev/null 2>&1; then
    echo -e "  ${RED}✗ DRIFT: $f in clowder-ai differs from sync baseline${NC}"
    DRIFT_FAIL=true
  else
    echo -e "  ${GREEN}✓${NC} $f (matches baseline)"
  fi
  rm -f "$BASELINE_TMP"
done

if [ "$DRIFT_FAIL" = true ]; then
  echo -e "${RED}Error: target drift detected. Cannot safely whole-file copy.${NC}"
  echo "Options:"
  echo "  1. Cherry-pick the fix manually into clowder-ai"
  echo "  2. Run a full sync first to reset the baseline"
  exit 1
fi

# ── Step 5: Create branch in target ──
echo ""
echo -e "${BLUE}[Step 5/7] Creating branch in target repo...${NC}"

if [ "$DRY_RUN" = true ]; then
  echo -e "  ${YELLOW}[dry-run] Would create branch '$BRANCH_NAME' from clowder-ai main${NC}"
else
  if git -C "$TARGET_DIR" rev-parse --verify "refs/heads/$BRANCH_NAME" >/dev/null 2>&1; then
    echo -e "  ${RED}✗ Branch '$BRANCH_NAME' already exists. Delete or rename.${NC}"
    exit 1
  fi
  git -C "$TARGET_DIR" checkout -b "$BRANCH_NAME" main
  echo -e "  ${GREEN}✓ Branch '$BRANCH_NAME' created from clowder-ai main${NC}"
fi

# ── Step 6: Copy files + sanitize ──
echo ""
echo -e "${BLUE}[Step 6/7] Copying files and sanitizing...${NC}"

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

# Post-sanitize: re-format with biome (sanitize may break formatting)
if [ "$DRY_RUN" != true ] && [ "$NO_SANITIZE" = false ] && [ ${#COPIED_FILES[@]} -gt 0 ]; then
  if command -v pnpm >/dev/null 2>&1 && [ -f "$TARGET_DIR/biome.json" ]; then
    echo -e "  Post-sanitize biome format..."
    (cd "$TARGET_DIR" && pnpm biome format --write "${COPIED_FILES[@]}" >/dev/null 2>&1) || true
    echo -e "  ${GREEN}✓${NC} Post-sanitize biome format complete"
  fi
fi

# ── Step 7: Commit ──
echo ""
echo -e "${BLUE}[Step 7/7] Committing...${NC}"

if [ "$DRY_RUN" = true ]; then
  echo -e "  ${YELLOW}[dry-run] Would commit ${#FILES[@]} file(s) on branch '$BRANCH_NAME'${NC}"
else
  cd "$TARGET_DIR"
  git add "${COPIED_FILES[@]}"

  # Check if there are actual changes
  if git diff --cached --quiet; then
    echo -e "  ${YELLOW}⚠ No changes to commit (files identical after sanitization)${NC}"
  else
    HOTFIX_MSG="fix: hotfix via sync-hotfix.sh (branch: $BRANCH_NAME)

Files: ${COPIED_FILES[*]}
Base tag: $SYNC_TAG
Source: cat-cafe"
    if [ -n "$CAT_SIG" ]; then
      HOTFIX_MSG="${HOTFIX_MSG}

${CAT_SIG}"
    fi
    if [ ${#CO_AUTHORS[@]} -gt 0 ]; then
      HOTFIX_MSG="${HOTFIX_MSG}
"
      for ca in "${CO_AUTHORS[@]}"; do
        HOTFIX_MSG="${HOTFIX_MSG}
Co-authored-by: ${ca}"
      done
    fi
    git commit -m "$HOTFIX_MSG"
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
  echo "  2. gh pr create --title 'fix: ...' --body '...'"
  echo "  3. After merge, cherry-pick fix back to cat-cafe main"
  echo "  4. Record: scripts/intake-from-opensource.sh --record --pr <N> --decision <absorbed|public-only> [--skip-absorbed-guard]"
  echo "     (hotfix is outbound-filed — absorbed record uses --skip-absorbed-guard, no intent issue exists)"
  echo "  5. Advance: scripts/intake-from-opensource.sh --advance-ledger"
fi
