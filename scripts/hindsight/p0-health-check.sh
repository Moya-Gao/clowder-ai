#!/usr/bin/env bash

set -u

BASE_URL="${HINDSIGHT_URL:-http://localhost:8888}"
BANK_ID="${HINDSIGHT_SHARED_BANK:-cat-cafe-shared}"
TIMEOUT_SECONDS="${HINDSIGHT_HEALTH_TIMEOUT_SECONDS:-5}"
SELF_TEST=0

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

usage() {
  cat <<'EOF'
Usage:
  bash scripts/hindsight/p0-health-check.sh [--base-url URL] [--bank BANK] [--timeout SECONDS]
  bash scripts/hindsight/p0-health-check.sh --self-test
EOF
}

log_result() {
  local level="$1"
  local message="$2"

  case "$level" in
    PASS) PASS_COUNT=$((PASS_COUNT + 1)) ;;
    WARN) WARN_COUNT=$((WARN_COUNT + 1)) ;;
    FAIL) FAIL_COUNT=$((FAIL_COUNT + 1)) ;;
  esac

  printf '[%s] %s\n' "$level" "$message"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    printf '[FAIL] missing required command: %s\n' "$cmd" >&2
    return 1
  fi
  return 0
}

normalize_number() {
  local value="$1"
  if [[ "$value" =~ ^[0-9]+$ ]]; then
    printf '%s' "$value"
    return 0
  fi
  return 1
}

parse_json_number() {
  local payload="$1"
  local expr="$2"
  local raw
  raw="$(jq -r "$expr" <<<"$payload" 2>/dev/null)" || return 1
  normalize_number "$raw"
}

check_stats_payload() {
  local payload="$1"
  local total_nodes total_documents

  total_nodes="$(parse_json_number "$payload" '.total_nodes // .totalNodes // 0')" || {
    log_result "FAIL" "stats payload missing numeric total_nodes"
    return 1
  }

  total_documents="$(parse_json_number "$payload" '.total_documents // .totalDocuments // 0')" || {
    log_result "WARN" "stats payload missing numeric total_documents (treated as 0)"
    total_documents="0"
  }

  if (( total_nodes == 0 )); then
    log_result "FAIL" "stats.total_nodes == 0 (bank appears empty)"
    return 1
  fi

  log_result "PASS" "stats total_nodes=${total_nodes} total_documents=${total_documents}"
  return 0
}

check_tags_payload() {
  local payload="$1"
  local total

  total="$(parse_json_number "$payload" '.total // (.tags | length) // (.items | length) // 0')" || {
    log_result "FAIL" "tags payload missing numeric total"
    return 1
  }

  if (( total == 0 )); then
    log_result "FAIL" "tags.total == 0 (governance tags missing)"
    return 1
  fi

  log_result "PASS" "tags total=${total}"
  return 0
}

check_version_payload() {
  local payload="$1"
  local api_version features_count

  api_version="$(jq -r '.api_version // .version // empty' <<<"$payload" 2>/dev/null)" || api_version=""
  if [[ -z "$api_version" ]]; then
    log_result "WARN" "version payload missing api_version/version"
    return 0
  fi

  features_count="$(jq -r '(.features | length) // 0' <<<"$payload" 2>/dev/null)" || features_count="0"
  if ! normalize_number "$features_count" >/dev/null; then
    features_count="0"
  fi

  log_result "PASS" "version api_version=${api_version} features=${features_count}"
  return 0
}

fetch_json() {
  local endpoint="$1"
  local url="${BASE_URL%/}${endpoint}"

  curl -fsS --max-time "$TIMEOUT_SECONDS" "$url"
}

run_self_test() {
  local local_failures=0

  PASS_COUNT=0
  WARN_COUNT=0
  FAIL_COUNT=0

  check_stats_payload '{"total_nodes":12,"total_documents":4}' || local_failures=$((local_failures + 1))
  if check_stats_payload '{"total_nodes":0,"total_documents":0}'; then
    printf '[FAIL] self-test expected stats.total_nodes==0 to fail\n' >&2
    local_failures=$((local_failures + 1))
  fi

  check_tags_payload '{"total":6}' || local_failures=$((local_failures + 1))
  if check_tags_payload '{"total":0}'; then
    printf '[FAIL] self-test expected tags.total==0 to fail\n' >&2
    local_failures=$((local_failures + 1))
  fi

  check_version_payload '{"api_version":"2026-01-01","features":["banks","recall"]}' || local_failures=$((local_failures + 1))
  check_version_payload '{"version":"0.9.0"}' || local_failures=$((local_failures + 1))

  if (( local_failures > 0 )); then
    printf '[FAIL] self-test failed (%d)\n' "$local_failures" >&2
    return 1
  fi

  printf '[PASS] self-test passed\n'
  return 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    --bank)
      BANK_ID="${2:-}"
      shift 2
      ;;
    --timeout)
      TIMEOUT_SECONDS="${2:-}"
      shift 2
      ;;
    --self-test)
      SELF_TEST=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      usage
      exit 1
      ;;
  esac
done

require_cmd "curl" || exit 1
require_cmd "jq" || exit 1

if (( SELF_TEST == 1 )); then
  run_self_test
  exit $?
fi

stats_payload="$(fetch_json "/v1/default/banks/${BANK_ID}/stats" 2>/dev/null)"
if [[ -z "${stats_payload:-}" ]]; then
  log_result "FAIL" "stats request failed (${BASE_URL%/}/v1/default/banks/${BANK_ID}/stats)"
else
  check_stats_payload "$stats_payload" || true
fi

tags_payload="$(fetch_json "/v1/default/banks/${BANK_ID}/tags" 2>/dev/null)"
if [[ -z "${tags_payload:-}" ]]; then
  log_result "FAIL" "tags request failed (${BASE_URL%/}/v1/default/banks/${BANK_ID}/tags)"
else
  check_tags_payload "$tags_payload" || true
fi

version_payload="$(fetch_json "/version" 2>/dev/null)"
if [[ -z "${version_payload:-}" ]]; then
  log_result "WARN" "version request failed (${BASE_URL%/}/version)"
else
  check_version_payload "$version_payload" || true
fi

if (( FAIL_COUNT > 0 )); then
  printf '[FAIL] p0-health-check failed: pass=%d warn=%d fail=%d\n' "$PASS_COUNT" "$WARN_COUNT" "$FAIL_COUNT"
  exit 1
fi

printf '[PASS] p0-health-check passed: pass=%d warn=%d fail=%d\n' "$PASS_COUNT" "$WARN_COUNT" "$FAIL_COUNT"
exit 0
