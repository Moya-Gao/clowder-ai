#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

OUT_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out)
      if [[ $# -lt 2 ]]; then
        echo "[generate-evidence] --out requires a file path" >&2
        exit 2
      fi
      OUT_FILE="$2"
      shift 2
      ;;
    *)
      echo "[generate-evidence] unknown argument: $1" >&2
      echo "Usage: $0 [--out <path>]" >&2
      exit 2
      ;;
  esac
done

cd "$REPO_ROOT"

BUILD_LOG="$(mktemp -t cat-cafe-evidence-build.XXXXXX.log)"
TEST_LOG="$(mktemp -t cat-cafe-evidence-test.XXXXXX.log)"
cleanup() {
  rm -f "$BUILD_LOG" "$TEST_LOG"
}
trap cleanup EXIT

echo "[generate-evidence] running: pnpm build"
set +e
pnpm build 2>&1 | tee "$BUILD_LOG"
build_exit=${PIPESTATUS[0]}
set -e

test_exit=0
if [[ $build_exit -eq 0 ]]; then
  echo "[generate-evidence] running: pnpm test"
  set +e
  pnpm test 2>&1 | tee "$TEST_LOG"
  test_exit=${PIPESTATUS[0]}
  set -e
else
  echo "[generate-evidence] build failed, skipping pnpm test" >&2
fi

node_tests="$(awk '/ℹ tests/ {for (i = 1; i <= NF; i++) if ($i == "tests") sum += $(i + 1)} END {print sum + 0}' "$TEST_LOG")"
node_pass="$(awk '/ℹ pass/ {for (i = 1; i <= NF; i++) if ($i == "pass") sum += $(i + 1)} END {print sum + 0}' "$TEST_LOG")"
node_fail="$(awk '/ℹ fail/ {for (i = 1; i <= NF; i++) if ($i == "fail") sum += $(i + 1)} END {print sum + 0}' "$TEST_LOG")"

vitest_tests=0
vitest_pass=0
vitest_fail=0

while IFS= read -r line; do
  if [[ "$line" == *"Test Files"* ]]; then
    continue
  fi

  pass="$(echo "$line" | sed -nE 's/.* ([0-9]+) passed.*/\1/p')"
  fail="$(echo "$line" | sed -nE 's/.* ([0-9]+) failed.*/\1/p')"
  total="$(echo "$line" | sed -nE 's/.*\(([0-9]+)\).*/\1/p')"

  pass="${pass:-0}"
  fail="${fail:-0}"
  [[ "$pass" =~ ^[0-9]+$ ]] || pass=0
  [[ "$fail" =~ ^[0-9]+$ ]] || fail=0
  if [[ -z "$total" ]]; then
    total="$((pass + fail))"
  fi
  [[ "$total" =~ ^[0-9]+$ ]] || total=0

  vitest_tests="$((vitest_tests + total))"
  vitest_pass="$((vitest_pass + pass))"
  vitest_fail="$((vitest_fail + fail))"
done < <(grep -E 'Tests[[:space:]]+[0-9]+[[:space:]]+(failed|passed)' "$TEST_LOG" || true)

total_tests="$((node_tests + vitest_tests))"
total_pass="$((node_pass + vitest_pass))"
total_fail="$((node_fail + vitest_fail))"
pass_rate="$(awk -v p="$total_pass" -v t="$total_tests" 'BEGIN { if (t == 0) { printf "0.00%%" } else { printf "%.2f%%", (p * 100) / t } }')"

timestamp_utc="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
branch="$(git rev-parse --abbrev-ref HEAD)"
commit_sha="$(git rev-parse --short HEAD)"

report="$(cat <<EOF
| Metric | Value |
| --- | --- |
| Timestamp (UTC) | ${timestamp_utc} |
| Branch | \`${branch}\` |
| Commit | \`${commit_sha}\` |
| Build Exit Code | ${build_exit} |
| Test Exit Code | ${test_exit} |
| Total Tests | ${total_tests} |
| Passed | ${total_pass} |
| Failed | ${total_fail} |
| Pass Rate | ${pass_rate} |
EOF
)"

if [[ -n "$OUT_FILE" ]]; then
  mkdir -p "$(dirname "$OUT_FILE")"
  printf '%s\n' "$report" > "$OUT_FILE"
  echo "[generate-evidence] report written: $OUT_FILE"
fi

printf '%s\n' "$report"

if [[ $build_exit -ne 0 ]]; then
  exit $build_exit
fi
exit $test_exit
