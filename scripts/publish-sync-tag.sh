#!/usr/bin/env bash
# publish-sync-tag.sh — 在 sync PR merge 后发布同名 sync tag 到 cat-cafe / clowder-ai
# Usage:
#   bash scripts/publish-sync-tag.sh --source-sha=<cat-cafe-commit>
#   bash scripts/publish-sync-tag.sh --source-sha=<cat-cafe-commit> --target-sha=<clowder-ai-sync-commit>
#   bash scripts/publish-sync-tag.sh --tag=sync/2026-03-19-063437 --source-sha=<sha> [--target-sha=<sha>] --push

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PUSH=false
SYNC_TAG=""
SOURCE_SHA=""
TARGET_SHA=""

for arg in "$@"; do
  case "$arg" in
    --push) PUSH=true ;;
    --tag=*) SYNC_TAG="${arg#--tag=}" ;;
    --source-sha=*) SOURCE_SHA="${arg#--source-sha=}" ;;
    --target-sha=*) TARGET_SHA="${arg#--target-sha=}" ;;
    *)
      echo -e "${RED}Unknown flag: $arg${NC}"
      echo "Usage: $0 --source-sha=<cat-cafe-commit> [--target-sha=<clowder-ai-sync-commit>] [--tag=sync/...] [--push]"
      exit 1
      ;;
  esac
done

if [ -z "$SOURCE_SHA" ]; then
  echo -e "${RED}Error: --source-sha is required${NC}"
  exit 1
fi

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

require_git_checkout "$SOURCE_DIR" "source"
require_git_checkout "$TARGET_DIR" "target"

refresh_main_refs() {
  local source_fetch_args=(fetch --no-tags origin main)
  local target_fetch_args=(fetch --no-tags origin main)

  if [ "$(git -C "$SOURCE_DIR" rev-parse --is-shallow-repository 2>/dev/null || echo false)" = "true" ]; then
    source_fetch_args=(fetch --no-tags --unshallow origin main)
  fi
  if [ "$(git -C "$TARGET_DIR" rev-parse --is-shallow-repository 2>/dev/null || echo false)" = "true" ]; then
    target_fetch_args=(fetch --no-tags --unshallow origin main)
  fi

  if ! git -C "$SOURCE_DIR" "${source_fetch_args[@]}" >/dev/null 2>&1; then
    echo -e "${RED}Error: failed to refresh cat-cafe origin/main${NC}" >&2
    exit 1
  fi
  if ! git -C "$TARGET_DIR" "${target_fetch_args[@]}" >/dev/null 2>&1; then
    echo -e "${RED}Error: failed to refresh clowder-ai origin/main${NC}" >&2
    exit 1
  fi
}

resolve_commit() {
  local repo="$1"
  local ref="$2"
  git -C "$repo" rev-parse --verify "${ref}^{commit}" 2>/dev/null
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

resolve_latest_landed_sync_commit() {
  local main_ref="$1"
  local sha
  sha=$(git -C "$TARGET_DIR" log --first-parent --format=%H -1 "$main_ref" -- .sync-provenance.json 2>/dev/null || true)
  if [ -z "$sha" ]; then
    echo -e "${RED}Error: could not find a landed sync commit on $main_ref${NC}" >&2
    exit 1
  fi
  printf '%s\n' "$sha"
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
  local target_sha="$1"
  git -C "$TARGET_DIR" show "${target_sha}:.sync-provenance.json" 2>/dev/null || {
    echo -e "${RED}Error: target commit $target_sha does not contain .sync-provenance.json${NC}" >&2
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

read_provenance_source_sha() {
  local provenance_json="$1"
  read_provenance_field "$provenance_json" "source_commit_sha"
}

derive_sync_tag_from_target_commit_time() {
  local target_sha="$1"
  local committed_at
  committed_at=$(git -C "$TARGET_DIR" show -s --format=%cI "$target_sha" 2>/dev/null || true)
  if [ -z "$committed_at" ]; then
    echo -e "${RED}Error: could not read target commit time for $target_sha${NC}" >&2
    exit 1
  fi
  node -e '
    const input = process.argv[1];
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) process.exit(1);
    const pad = (value) => String(value).padStart(2, "0");
    process.stdout.write(
      `sync/${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`,
    );
  ' "$committed_at" 2>/dev/null || {
    echo -e "${RED}Error: invalid target commit time for $target_sha: $committed_at${NC}" >&2
    exit 1
  }
}

require_landed_sync_commit() {
  local repo="$1"
  local sha="$2"
  local main_ref="$3"
  local provenance_commit
  provenance_commit=$(git -C "$repo" log --first-parent --format=%H -1 "$main_ref" -- .sync-provenance.json)
  if [ -z "$provenance_commit" ] || [ "$provenance_commit" != "$sha" ]; then
    echo -e "${RED}Error: target commit $sha is not the latest provenance-bearing landed sync commit on $main_ref${NC}"
    exit 1
  fi
}

validate_sync_tag_name() {
  local tag="$1"
  if ! printf '%s\n' "$tag" | grep -Eq '^sync/[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{6}$'; then
    echo -e "${RED}Error: sync tag must match sync/YYYY-MM-DD-HHMMSS${NC}"
    exit 1
  fi
}

ensure_tag_points_to() {
  local repo="$1"
  local repo_name="$2"
  local sha="$3"

  if git -C "$repo" rev-parse --verify "refs/tags/$SYNC_TAG^{commit}" >/dev/null 2>&1; then
    local existing_sha
    existing_sha=$(git -C "$repo" rev-parse "refs/tags/$SYNC_TAG^{commit}")
    if [ "$existing_sha" != "$sha" ]; then
      echo -e "${RED}Error: $repo_name tag $SYNC_TAG already points to ${existing_sha}, not ${sha}${NC}"
      return 1
    fi
    echo -e "  ${GREEN}✓${NC} $repo_name tag already matches $SYNC_TAG -> ${sha}"
    return 0
  fi

  git -C "$repo" tag "$SYNC_TAG" "$sha"
  echo -e "  ${GREEN}✓${NC} Created $repo_name tag $SYNC_TAG -> ${sha}"
}

read_local_tag_sha() {
  local repo="$1"
  local local_tag_ref
  local_tag_ref=$(git -C "$repo" rev-parse --verify "refs/tags/$SYNC_TAG^{commit}" 2>/dev/null || true)
  if [ -n "$local_tag_ref" ]; then
    printf '%s\n' "$local_tag_ref"
  fi
}

read_remote_tag_sha() {
  local repo="$1"
  local remote_tag_ref
  remote_tag_ref=$(
    git -C "$repo" ls-remote --tags origin "refs/tags/$SYNC_TAG" "refs/tags/$SYNC_TAG^{}" \
      | awk '$2 ~ /\^\{\}$/ { peeled=$1 } $2 !~ /\^\{\}$/ { raw=$1 } END { if (peeled != "") print peeled; else if (raw != "") print raw }'
  )
  if [ -n "$remote_tag_ref" ]; then
    printf '%s\n' "$remote_tag_ref"
  fi
}

ensure_remote_tag_matches_or_absent() {
  local repo="$1"
  local repo_name="$2"
  local sha="$3"
  local remote_sha
  remote_sha=$(read_remote_tag_sha "$repo")
  if [ -n "$remote_sha" ] && [ "$remote_sha" != "$sha" ]; then
    echo -e "${RED}Error: origin $repo_name tag $SYNC_TAG already points to ${remote_sha}, not ${sha}${NC}"
    exit 1
  fi
}

push_tag_to_origin() {
  local repo="$1"
  git -C "$repo" push origin "refs/tags/$SYNC_TAG"
}

delete_local_tag_if_matches() {
  local repo="$1"
  local expected_sha="$2"
  local current_sha
  current_sha=$(read_local_tag_sha "$repo")
  if [ -n "$current_sha" ] && [ "$current_sha" = "$expected_sha" ]; then
    git -C "$repo" tag -d "$SYNC_TAG" >/dev/null 2>&1 || true
  fi
}

delete_remote_tag_if_matches() {
  local repo="$1"
  local expected_sha="$2"
  local current_sha
  current_sha=$(read_remote_tag_sha "$repo")
  if [ -n "$current_sha" ] && [ "$current_sha" = "$expected_sha" ]; then
    git -C "$repo" push origin ":refs/tags/$SYNC_TAG" >/dev/null 2>&1 || true
  fi
}

refresh_main_refs
SOURCE_MAIN_REF=$(resolve_origin_main_ref "$SOURCE_DIR")
TARGET_MAIN_REF=$(resolve_origin_main_ref "$TARGET_DIR")
SOURCE_SHA=$(resolve_commit "$SOURCE_DIR" "$SOURCE_SHA")
if [ -n "$TARGET_SHA" ]; then
  TARGET_SHA=$(resolve_commit "$TARGET_DIR" "$TARGET_SHA")
else
  TARGET_SHA=$(resolve_latest_landed_sync_commit "$TARGET_MAIN_REF")
fi

require_commit_on_main "$SOURCE_DIR" "cat-cafe" "$SOURCE_SHA" "$SOURCE_MAIN_REF"
require_commit_on_main "$TARGET_DIR" "clowder-ai" "$TARGET_SHA" "$TARGET_MAIN_REF"
require_landed_sync_commit "$TARGET_DIR" "$TARGET_SHA" "$TARGET_MAIN_REF"

TARGET_PROVENANCE_JSON=$(read_target_provenance_json "$TARGET_SHA")
PROVENANCE_SOURCE_SHA=$(read_provenance_source_sha "$TARGET_PROVENANCE_JSON")
PROVENANCE_SOURCE_SHA=$(resolve_commit "$SOURCE_DIR" "$PROVENANCE_SOURCE_SHA")

if [ "$SOURCE_SHA" != "$PROVENANCE_SOURCE_SHA" ]; then
  echo -e "${RED}Error: sync provenance for $TARGET_SHA records source_commit_sha ${PROVENANCE_SOURCE_SHA}, not ${SOURCE_SHA}${NC}"
  exit 1
fi

if [ -z "$SYNC_TAG" ]; then
  SYNC_TAG=$(derive_sync_tag_from_target_commit_time "$TARGET_SHA")
fi
validate_sync_tag_name "$SYNC_TAG"

echo -e "${GREEN}=== Publish Sync Tag ===${NC}"
echo "Tag:    $SYNC_TAG"
echo "Source: $SOURCE_DIR @ $SOURCE_SHA"
echo "Target: $TARGET_DIR @ $TARGET_SHA ($TARGET_MAIN_REF)"

if [ "$PUSH" = true ]; then
  SOURCE_LOCAL_SHA=$(read_local_tag_sha "$SOURCE_DIR")
  TARGET_LOCAL_SHA=$(read_local_tag_sha "$TARGET_DIR")
  ensure_remote_tag_matches_or_absent "$SOURCE_DIR" "cat-cafe" "$SOURCE_SHA"
  ensure_remote_tag_matches_or_absent "$TARGET_DIR" "clowder-ai" "$TARGET_SHA"

  SOURCE_REMOTE_SHA=$(read_remote_tag_sha "$SOURCE_DIR")
  TARGET_REMOTE_SHA=$(read_remote_tag_sha "$TARGET_DIR")
  ensure_tag_points_to "$SOURCE_DIR" "cat-cafe" "$SOURCE_SHA"
  if ! ensure_tag_points_to "$TARGET_DIR" "clowder-ai" "$TARGET_SHA"; then
    if [ -z "$SOURCE_LOCAL_SHA" ]; then
      delete_local_tag_if_matches "$SOURCE_DIR" "$SOURCE_SHA"
    fi
    exit 1
  fi

  if [ -z "$SOURCE_REMOTE_SHA" ]; then
    if ! push_tag_to_origin "$SOURCE_DIR"; then
      if [ -z "$SOURCE_REMOTE_SHA" ]; then
        delete_remote_tag_if_matches "$SOURCE_DIR" "$SOURCE_SHA"
      fi
      if [ -z "$SOURCE_LOCAL_SHA" ]; then
        delete_local_tag_if_matches "$SOURCE_DIR" "$SOURCE_SHA"
      fi
      if [ -z "$TARGET_LOCAL_SHA" ]; then
        delete_local_tag_if_matches "$TARGET_DIR" "$TARGET_SHA"
      fi
      exit 1
    fi
  else
    echo -e "  ${GREEN}✓${NC} cat-cafe origin already has $SYNC_TAG -> ${SOURCE_SHA}"
  fi
  if [ -z "$TARGET_REMOTE_SHA" ]; then
    if ! push_tag_to_origin "$TARGET_DIR"; then
      if [ -z "$SOURCE_REMOTE_SHA" ]; then
        delete_remote_tag_if_matches "$SOURCE_DIR" "$SOURCE_SHA"
      fi
      if [ -z "$TARGET_REMOTE_SHA" ]; then
        delete_remote_tag_if_matches "$TARGET_DIR" "$TARGET_SHA"
      fi
      if [ -z "$SOURCE_LOCAL_SHA" ]; then
        delete_local_tag_if_matches "$SOURCE_DIR" "$SOURCE_SHA"
      fi
      if [ -z "$TARGET_LOCAL_SHA" ]; then
        delete_local_tag_if_matches "$TARGET_DIR" "$TARGET_SHA"
      fi
      exit 1
    fi
  else
    echo -e "  ${GREEN}✓${NC} clowder-ai origin already has $SYNC_TAG -> ${TARGET_SHA}"
  fi

  echo -e "  ${GREEN}✓${NC} Pushed $SYNC_TAG to both origins"
else
  SOURCE_LOCAL_SHA=$(read_local_tag_sha "$SOURCE_DIR")
  ensure_tag_points_to "$SOURCE_DIR" "cat-cafe" "$SOURCE_SHA"
  if ! ensure_tag_points_to "$TARGET_DIR" "clowder-ai" "$TARGET_SHA"; then
    if [ -z "$SOURCE_LOCAL_SHA" ]; then
      delete_local_tag_if_matches "$SOURCE_DIR" "$SOURCE_SHA"
    fi
    exit 1
  fi
  echo -e "  ${YELLOW}⚠${NC} Local tags created only. Re-run with --push to publish to remotes."
fi
