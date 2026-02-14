#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${HINDSIGHT_COMPOSE_FILE:-${ROOT_DIR}/docker-compose.hindsight.yml}"
SERVICE_NAME="${HINDSIGHT_SERVICE_NAME:-hindsight}"
API_URL="${HINDSIGHT_URL:-http://localhost:18888}"
UI_URL="${HINDSIGHT_UI_URL:-http://localhost:19999/dashboard}"
STARTUP_TIMEOUT_SECONDS="${HINDSIGHT_STARTUP_TIMEOUT_SECONDS:-${HINDSIGHT_HEALTH_TIMEOUT_SECONDS:-300}}"
HEALTH_INTERVAL_SECONDS="${HINDSIGHT_STARTUP_HEALTH_INTERVAL_SECONDS:-5}"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/hindsight-service.sh <command>

Commands:
  start    Pull latest image and start service
  stop     Stop service containers
  down     Stop and remove service containers
  restart  Restart service containers
  status   Show container status and API health
  logs     Tail service logs (follow mode)
  health   Check API health endpoint
  config   Render compose config
EOF
}

require_tools() {
  command -v docker >/dev/null 2>&1 || {
    echo "[FAIL] docker not found in PATH" >&2
    exit 1
  }
  docker compose version >/dev/null 2>&1 || {
    echo "[FAIL] docker compose plugin not available" >&2
    exit 1
  }
}

compose() {
  docker compose -f "${COMPOSE_FILE}" "$@"
}

health_check() {
  if curl -fsS "${API_URL}/health" >/dev/null 2>&1; then
    echo "[PASS] Hindsight API healthy at ${API_URL}/health"
  else
    echo "[WARN] Hindsight API not ready at ${API_URL}/health"
    return 1
  fi
}

wait_for_health() {
  local elapsed=0
  while (( elapsed < STARTUP_TIMEOUT_SECONDS )); do
    if health_check >/dev/null 2>&1; then
      echo "[PASS] Hindsight API healthy at ${API_URL}/health"
      return 0
    fi
    sleep "${HEALTH_INTERVAL_SECONDS}"
    elapsed=$((elapsed + HEALTH_INTERVAL_SECONDS))
  done

  echo "[WARN] Timed out waiting for health after ${STARTUP_TIMEOUT_SECONDS}s"
  return 1
}

main() {
  local cmd="${1:-}"
  require_tools

  case "${cmd}" in
    start)
      compose up -d --pull always
      compose ps
      echo "API: ${API_URL}"
      echo "UI : ${UI_URL}"
      wait_for_health || true
      ;;
    stop)
      compose stop
      ;;
    down)
      compose down
      ;;
    restart)
      compose restart
      compose ps
      wait_for_health || true
      ;;
    status)
      compose ps
      health_check || true
      ;;
    logs)
      shift || true
      compose logs -f --tail "${HINDSIGHT_LOG_TAIL:-200}" "${SERVICE_NAME}" "$@"
      ;;
    health)
      health_check
      ;;
    config)
      compose config
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
