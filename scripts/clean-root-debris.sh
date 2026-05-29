#!/usr/bin/env bash
# clean-root-debris.sh — F214 Root Directory Hygiene Guard (Phase A)
#
# Removes ONLY stateless, regenerable debris that piles up in the repo root
# (debug logs, browser-automation scratch files). Triple safety: a file is
# removed ONLY IF it is (1) NOT git-tracked, (2) matches the debris whitelist,
# and (3) is NOT on the hard-protected stateful-storage list.
#
# Stateful storage (Redis dump.rdb*, *.sqlite*, World Engine) is NEVER touched
# — that is an architecture/data concern, not hygiene. See docs/features/F214.
# Lesson: feedback_lsof_port_range_kills_sanctuary — whitelist, never blacklist;
# explicitly exclude the sanctuary. NOTE: dump.rdb.backup-<ts> is NOT matched by
# *.rdb, so the hard-protect glob uses *.rdb* to cover the backup suffix.
#
# Usage: scripts/clean-root-debris.sh [--root <path>] [--dry-run|--execute]
#   --root <path>   directory to scan (default: git repo top level)
#   --dry-run       list removal candidates without deleting (DEFAULT)
#   --execute       actually delete the candidates

set -euo pipefail

ROOT=""
EXECUTE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root) ROOT="$2"; shift 2 ;;
    --execute) EXECUTE=1; shift ;;
    --dry-run) EXECUTE=0; shift ;;
    *) shift ;;
  esac
done

if [[ -z "$ROOT" ]]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi

# rule #2 — whitelist: stateless debris safe to remove
is_whitelisted() {
  case "$1" in
    *.log) return 0 ;;
    forzadata-*.txt) return 0 ;;
    cookies.json) return 0 ;;
    *) return 1 ;;
  esac
}

# rule #3 — hard-protected stateful storage, NEVER remove (defense-in-depth)
# *.rdb* covers dump.rdb AND dump.rdb.backup-<ts>; *.sqlite* covers -wal/-shm.
is_hard_protected() {
  case "$1" in
    *.rdb*) return 0 ;;
    *.sqlite*) return 0 ;;
    *) return 1 ;;
  esac
}

# rule #1 prerequisite — fail-closed: ROOT must be a verifiable git worktree.
# If git tracking can't be read (mistyped --root / non-repo dir), abort instead
# of deleting — otherwise the "NOT git-tracked" check silently passes for every
# file and debris in an ARBITRARY directory could be removed (cloud codex P1).
if ! git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: --root '$ROOT' is not a git worktree — aborting (fail-closed: cannot verify tracked files, refuse to delete in an unintended directory)." >&2
  exit 1
fi

# rule #1 — git-tracked top-level files (one name per line)
TRACKED_TOPLEVEL="$(git -C "$ROOT" ls-files | grep -v '/' || true)"

is_tracked() {
  printf '%s\n' "$TRACKED_TOPLEVEL" | grep -qxF "$1"
}

candidates=()
while IFS= read -r path; do
  name="$(basename "$path")"
  is_tracked "$name" && continue          # rule #1
  is_hard_protected "$name" && continue   # rule #3
  is_whitelisted "$name" || continue      # rule #2
  candidates+=("$name")
done < <(find "$ROOT" -maxdepth 1 -type f 2>/dev/null | sort)

echo ""
echo "Root Directory Hygiene (F214) — root=$ROOT"

if [[ ${#candidates[@]} -eq 0 ]]; then
  echo "  No removable debris found."
  exit 0
fi

if [[ "$EXECUTE" -eq 1 ]]; then
  for name in "${candidates[@]}"; do
    rm -f "$ROOT/$name"
    echo "  deleted: $name"
  done
  echo ""
  echo "Removed ${#candidates[@]} debris file(s)."
else
  for name in "${candidates[@]}"; do
    echo "  would delete: $name"
  done
  echo ""
  echo "[dry-run] ${#candidates[@]} candidate(s). Re-run with --execute to delete."
fi

exit 0
