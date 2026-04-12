#!/usr/bin/env bash
# publish-release-tag.sh — 在 clowder-ai main 上发布 release tag，并校验 source snapshot/provenance 对齐
# Usage:
#   bash scripts/publish-release-tag.sh --release-tag=v0.3.0 --reconciliation-report=docs/ops/reconciliation-v0.3.0.md
#   bash scripts/publish-release-tag.sh --release-tag=v0.3.0 --target-sha=<clowder-ai-main-commit> --reconciliation-report=docs/ops/reconciliation-v0.3.0.md
#   bash scripts/publish-release-tag.sh --release-tag=v0.3.0 --target-sha=<sha> --reconciliation-report=docs/ops/reconciliation-v0.3.0.md --release-notes=release-notes-v0.3.0.md --push
#
# --release-notes: bilingual (EN + 中文) release notes file. Required when --push is set.
#                  The script creates a GitHub Release with the file content after pushing the tag.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PUSH=false
RELEASE_TAG=""
TARGET_SHA=""
RECONCILIATION_REPORT=""
RELEASE_NOTES=""

for arg in "$@"; do
  case "$arg" in
    --push) PUSH=true ;;
    --release-tag=*) RELEASE_TAG="${arg#--release-tag=}" ;;
    --target-sha=*) TARGET_SHA="${arg#--target-sha=}" ;;
    --reconciliation-report=*) RECONCILIATION_REPORT="${arg#--reconciliation-report=}" ;;
    --release-notes=*) RELEASE_NOTES="${arg#--release-notes=}" ;;
    *)
      echo -e "${RED}Unknown flag: $arg${NC}"
      echo "Usage: $0 --release-tag=<vX.Y.Z> [--target-sha=<clowder-ai-main-commit>] --reconciliation-report=<path> [--push]"
      exit 1
      ;;
  esac
done

if [ -z "$RELEASE_TAG" ]; then
  echo -e "${RED}Error: --release-tag is required${NC}"
  exit 1
fi

validate_release_tag() {
  local tag="$1"
  if [[ ! "$tag" =~ ^v[0-9]+(\.[0-9]+){1,2}([-.][0-9A-Za-z.-]+)?$ ]]; then
    echo -e "${RED}Error: invalid --release-tag ${tag}${NC}"
    echo "Expected examples: v0.2.1, v0.3.0, v0.3.0-rc.1"
    exit 1
  fi
}

derive_source_snapshot_tag() {
  local release_tag="$1"
  printf 'clowder-%s-source\n' "$release_tag"
}

SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="${CLOWDER_AI_DIR:-$(cd "$SOURCE_DIR/.." && pwd)/clowder-ai}"

require_git_checkout() {
  local repo="$1"
  local repo_name="$2"
  if ! git -C "$repo" rev-parse --git-dir >/dev/null 2>&1; then
    echo -e "${RED}Error: $repo_name repo not found at $repo${NC}"
    exit 1
  fi
}

refresh_main_refs() {
  if ! git -C "$SOURCE_DIR" fetch --no-tags origin main >/dev/null 2>&1; then
    echo -e "${RED}Error: failed to refresh cat-cafe origin/main${NC}" >&2
    exit 1
  fi
  if ! git -C "$TARGET_DIR" fetch --no-tags origin main >/dev/null 2>&1; then
    echo -e "${RED}Error: failed to refresh clowder-ai origin/main${NC}" >&2
    exit 1
  fi
}

resolve_origin_main_ref() {
  local repo="$1"
  if git -C "$repo" show-ref --verify --quiet refs/remotes/origin/main; then
    echo "refs/remotes/origin/main"
    return 0
  fi
  echo -e "${RED}Error: could not find refs/remotes/origin/main in $repo${NC}" >&2
  exit 1
}

resolve_commit() {
  local repo="$1"
  local ref="$2"
  git -C "$repo" rev-parse --verify "${ref}^{commit}" 2>/dev/null
}

require_commit_on_main() {
  local repo="$1"
  local repo_name="$2"
  local sha="$3"
  local main_ref="$4"
  if ! git -C "$repo" merge-base --is-ancestor "$sha" "$main_ref"; then
    echo -e "${RED}Error: $repo_name commit $sha is not reachable from $main_ref${NC}"
    exit 1
  fi
}

read_target_provenance_json() {
  local provenance_commit="$1"
  git -C "$TARGET_DIR" show "${provenance_commit}:.sync-provenance.json" 2>/dev/null || {
    echo -e "${RED}Error: target commit $provenance_commit does not contain .sync-provenance.json${NC}" >&2
    exit 1
  }
}

read_provenance_field() {
  local provenance_json="$1"
  local field="$2"
  node -e "const data = JSON.parse(process.argv[1]); const field = process.argv[2]; if (!data[field]) process.exit(1); process.stdout.write(String(data[field]));" "$provenance_json" "$field" 2>/dev/null || {
    echo -e "${RED}Error: sync provenance is missing required field '$field'${NC}" >&2
    exit 1
  }
}

find_latest_provenance_commit_before_target() {
  local target_sha="$1"
  git -C "$TARGET_DIR" log --first-parent --format=%H -1 "$target_sha" -- .sync-provenance.json 2>/dev/null || true
}

read_remote_tag_sha() {
  local repo="$1"
  local tag="$2"
  git -C "$repo" ls-remote --tags origin "refs/tags/$tag" "refs/tags/$tag^{}" \
    | awk '$2 ~ /\^\{\}$/ { peeled=$1 } $2 !~ /\^\{\}$/ { raw=$1 } END { if (peeled != "") print peeled; else if (raw != "") print raw }'
}

read_local_tag_sha() {
  local repo="$1"
  local tag="$2"
  git -C "$repo" rev-parse --verify "refs/tags/$tag^{commit}" 2>/dev/null || true
}

require_source_snapshot_tag() {
  local tag="$1"
  local sha="$2"
  local local_sha
  local remote_sha

  local_sha=$(read_local_tag_sha "$SOURCE_DIR" "$tag")
  remote_sha=$(read_remote_tag_sha "$SOURCE_DIR" "$tag")

  if [ -z "$local_sha" ] && [ -z "$remote_sha" ]; then
    echo -e "${RED}Error: source snapshot tag $tag not found in cat-cafe${NC}"
    exit 1
  fi
  if [ -n "$local_sha" ] && [ "$local_sha" != "$sha" ]; then
    echo -e "${RED}Error: local source snapshot tag $tag points to ${local_sha}, not ${sha}${NC}"
    exit 1
  fi
  if [ -n "$remote_sha" ] && [ "$remote_sha" != "$sha" ]; then
    echo -e "${RED}Error: origin source snapshot tag $tag points to ${remote_sha}, not ${sha}${NC}"
    exit 1
  fi

  if [ -z "$remote_sha" ]; then
    echo -e "${RED}Error: source snapshot tag $tag not found on cat-cafe origin${NC}"
    exit 1
  fi
}

ensure_release_tag_points_to() {
  local sha="$1"
  local existing_sha
  existing_sha=$(read_local_tag_sha "$TARGET_DIR" "$RELEASE_TAG")
  if [ -n "$existing_sha" ] && [ "$existing_sha" != "$sha" ]; then
    echo -e "${RED}Error: clowder-ai tag $RELEASE_TAG already points to ${existing_sha}, not ${sha}${NC}"
    exit 1
  fi
  if [ -z "$existing_sha" ]; then
    git -C "$TARGET_DIR" tag "$RELEASE_TAG" "$sha"
    echo -e "  ${GREEN}✓${NC} Created local clowder-ai tag $RELEASE_TAG -> ${sha}"
  else
    echo -e "  ${GREEN}✓${NC} clowder-ai local tag already matches $RELEASE_TAG -> ${sha}"
  fi
}

ensure_remote_release_tag_matches_or_absent() {
  local sha="$1"
  local remote_sha
  remote_sha=$(read_remote_tag_sha "$TARGET_DIR" "$RELEASE_TAG")
  if [ -n "$remote_sha" ] && [ "$remote_sha" != "$sha" ]; then
    echo -e "${RED}Error: clowder-ai origin tag $RELEASE_TAG already points to ${remote_sha}, not ${sha}${NC}"
    exit 1
  fi
  if [ -z "$remote_sha" ]; then
    git -C "$TARGET_DIR" push origin "refs/tags/$RELEASE_TAG"
    echo -e "  ${GREEN}✓${NC} Pushed clowder-ai tag $RELEASE_TAG -> ${sha}"
  else
    echo -e "  ${GREEN}✓${NC} clowder-ai origin already has $RELEASE_TAG -> ${sha}"
  fi
}

validate_release_tag "$RELEASE_TAG"
EXPECTED_SOURCE_SNAPSHOT_TAG="$(derive_source_snapshot_tag "$RELEASE_TAG")"

require_git_checkout "$SOURCE_DIR" "source"
require_git_checkout "$TARGET_DIR" "target"
refresh_main_refs

SOURCE_MAIN_REF="$(resolve_origin_main_ref "$SOURCE_DIR")"
TARGET_MAIN_REF="$(resolve_origin_main_ref "$TARGET_DIR")"

if [ -n "$TARGET_SHA" ]; then
  TARGET_SHA="$(resolve_commit "$TARGET_DIR" "$TARGET_SHA")"
else
  TARGET_SHA="$(resolve_commit "$TARGET_DIR" "$TARGET_MAIN_REF")"
fi

require_commit_on_main "$TARGET_DIR" "clowder-ai" "$TARGET_SHA" "$TARGET_MAIN_REF"

PROVENANCE_COMMIT="$(find_latest_provenance_commit_before_target "$TARGET_SHA")"
if [ -z "$PROVENANCE_COMMIT" ]; then
  echo -e "${RED}Error: no sync provenance found on clowder-ai main at or before ${TARGET_SHA}${NC}"
  exit 1
fi

TARGET_PROVENANCE_JSON="$(read_target_provenance_json "$PROVENANCE_COMMIT")"
PROVENANCE_RELEASE_TAG="$(read_provenance_field "$TARGET_PROVENANCE_JSON" "release_tag")"
PROVENANCE_SOURCE_SNAPSHOT_TAG="$(read_provenance_field "$TARGET_PROVENANCE_JSON" "source_snapshot_tag")"
PROVENANCE_SOURCE_SHA="$(read_provenance_field "$TARGET_PROVENANCE_JSON" "source_commit_sha")"
PROVENANCE_SOURCE_SHA="$(resolve_commit "$SOURCE_DIR" "$PROVENANCE_SOURCE_SHA")"

if [ "$PROVENANCE_RELEASE_TAG" != "$RELEASE_TAG" ]; then
  echo -e "${RED}Error: sync provenance for ${PROVENANCE_COMMIT} records release_tag ${PROVENANCE_RELEASE_TAG}, not ${RELEASE_TAG}${NC}"
  exit 1
fi

if [ "$PROVENANCE_SOURCE_SNAPSHOT_TAG" != "$EXPECTED_SOURCE_SNAPSHOT_TAG" ]; then
  echo -e "${RED}Error: sync provenance for ${PROVENANCE_COMMIT} records source_snapshot_tag ${PROVENANCE_SOURCE_SNAPSHOT_TAG}, not ${EXPECTED_SOURCE_SNAPSHOT_TAG}${NC}"
  exit 1
fi

require_commit_on_main "$SOURCE_DIR" "cat-cafe" "$PROVENANCE_SOURCE_SHA" "$SOURCE_MAIN_REF"
require_source_snapshot_tag "$EXPECTED_SOURCE_SNAPSHOT_TAG" "$PROVENANCE_SOURCE_SHA"

# --- Reconciliation Gate (Step 8 → Step 9) ---
# Post-sync community reconciliation must be done before publishing a release tag.
# See: cat-cafe-skills/refs/opensource-ops-outbound-sync.md Step 9
if [ -z "$RECONCILIATION_REPORT" ]; then
  echo -e "${RED}Error: --reconciliation-report=<path> is required.${NC}"
  echo -e "${RED}Post-sync community reconciliation (Step 8) must be completed before publishing a release tag.${NC}"
  echo -e "${RED}Create a reconciliation report via the opensource-ops skill, then pass its path here.${NC}"
  exit 1
fi
if [ ! -f "$RECONCILIATION_REPORT" ]; then
  echo -e "${RED}Error: reconciliation report not found: ${RECONCILIATION_REPORT}${NC}"
  exit 1
fi
if [ ! -s "$RECONCILIATION_REPORT" ]; then
  echo -e "${RED}Error: reconciliation report is empty: ${RECONCILIATION_REPORT}${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓${NC} Reconciliation report: $RECONCILIATION_REPORT"
node "$SOURCE_DIR/scripts/verify-reconciliation-report.mjs" \
  --report="$RECONCILIATION_REPORT" \
  --repo="${RECONCILIATION_REPO:-zts212653/clowder-ai}"

echo -e "${GREEN}=== Publish Release Tag ===${NC}"
echo "Release:            $RELEASE_TAG"
echo "Source snapshot:    $EXPECTED_SOURCE_SNAPSHOT_TAG @ $PROVENANCE_SOURCE_SHA"
echo "Target release sha: $TARGET_SHA"
echo "Provenance commit:  $PROVENANCE_COMMIT"

ensure_release_tag_points_to "$TARGET_SHA"

TARGET_REPO="${TARGET_REPO:-zts212653/clowder-ai}"

if [ "$PUSH" = true ]; then
  ensure_remote_release_tag_matches_or_absent "$TARGET_SHA"

  # --- GitHub Release Gate ---
  if [ -z "$RELEASE_NOTES" ]; then
    echo -e "${RED}Error: --release-notes=<path> is required when --push is set.${NC}"
    echo -e "${RED}Write bilingual (EN + 中文) release notes, then pass the file path here.${NC}"
    exit 1
  fi
  if [ ! -f "$RELEASE_NOTES" ]; then
    echo -e "${RED}Error: release notes file not found: ${RELEASE_NOTES}${NC}"
    exit 1
  fi
  if [ ! -s "$RELEASE_NOTES" ]; then
    echo -e "${RED}Error: release notes file is empty: ${RELEASE_NOTES}${NC}"
    exit 1
  fi

  if [ "${GH_RELEASE_MOCK:-}" = "1" ]; then
    echo -e "  ${GREEN}✓${NC} [mock] Would create GitHub Release $RELEASE_TAG on $TARGET_REPO"
  elif gh release view "$RELEASE_TAG" --repo "$TARGET_REPO" >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} GitHub Release $RELEASE_TAG already exists on $TARGET_REPO"
  else
    gh release create "$RELEASE_TAG" \
      --repo "$TARGET_REPO" \
      --title "$RELEASE_TAG" \
      --notes-file "$RELEASE_NOTES"
    echo -e "  ${GREEN}✓${NC} Created GitHub Release $RELEASE_TAG on $TARGET_REPO"
  fi
else
  echo -e "  ${YELLOW}⚠${NC} Local release tag created only. Re-run with --push to publish to origin."
fi
