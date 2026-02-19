#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-status}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
RUNNER_SCRIPT="$SCRIPT_DIR/signal-fetcher-launchd.sh"
LABEL="${SIGNAL_FETCHER_LABEL:-com.cat-cafe.signal-fetcher}"
LAUNCH_AGENTS_DIR="${SIGNAL_FETCHER_LAUNCH_AGENTS_DIR:-$HOME/Library/LaunchAgents}"
PLIST_PATH="${LAUNCH_AGENTS_DIR}/${LABEL}.plist"
SIGNAL_ROOT_DIR="${SIGNALS_ROOT_DIR:-$HOME/.cat-cafe/signals}"
LOG_DIR="${SIGNAL_ROOT_DIR}/logs"
OUT_LOG="${LOG_DIR}/fetch.log"
ERR_LOG="${LOG_DIR}/fetch-error.log"
NOTIFICATIONS_FILE="${SIGNAL_ROOT_DIR}/config/notifications.yaml"
UID_NUM="$(id -u)"
DOMAIN="gui/${UID_NUM}"
TARGET="${DOMAIN}/${LABEL}"

need_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[signal-fetcher] missing command: $cmd" >&2
    exit 127
  fi
}

read_schedule_from_notifications() {
  if [[ ! -f "$NOTIFICATIONS_FILE" ]]; then
    return 0
  fi

  sed -nE \
    -e "s/^[[:space:]]*daily_digest:[[:space:]]*\"([0-9]{2}:[0-9]{2})\"[[:space:]]*(#.*)?$/\\1/p" \
    -e "s/^[[:space:]]*daily_digest:[[:space:]]*'([0-9]{2}:[0-9]{2})'[[:space:]]*(#.*)?$/\\1/p" \
    -e "s/^[[:space:]]*daily_digest:[[:space:]]*([0-9]{2}:[0-9]{2})[[:space:]]*(#.*)?$/\\1/p" \
    "$NOTIFICATIONS_FILE" | head -n 1
}

resolve_schedule() {
  local hour="${SIGNAL_FETCH_HOUR:-}"
  local minute="${SIGNAL_FETCH_MINUTE:-}"
  local from_file=""

  from_file="$(read_schedule_from_notifications || true)"
  if [[ -n "$from_file" ]]; then
    if [[ -z "$hour" ]]; then
      hour="${from_file%%:*}"
    fi
    if [[ -z "$minute" ]]; then
      minute="${from_file##*:}"
    fi
  fi

  hour="${hour:-08}"
  minute="${minute:-00}"

  if [[ ! "$hour" =~ ^[0-9]{1,2}$ ]]; then
    echo "[signal-fetcher] invalid hour: $hour" >&2
    exit 2
  fi
  if [[ ! "$minute" =~ ^[0-9]{1,2}$ ]]; then
    echo "[signal-fetcher] invalid minute: $minute" >&2
    exit 2
  fi

  local hour_num minute_num
  hour_num=$((10#$hour))
  minute_num=$((10#$minute))

  if ((hour_num < 0 || hour_num > 23)); then
    echo "[signal-fetcher] hour out of range: $hour_num" >&2
    exit 2
  fi
  if ((minute_num < 0 || minute_num > 59)); then
    echo "[signal-fetcher] minute out of range: $minute_num" >&2
    exit 2
  fi

  printf '%02d:%02d\n' "$hour_num" "$minute_num"
}

print_plist() {
  local schedule hour minute
  schedule="$(resolve_schedule)"
  hour="${schedule%%:*}"
  minute="${schedule##*:}"

  cat <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${RUNNER_SCRIPT}</string>
    <string>run</string>
  </array>

  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${hour#0}</integer>
    <key>Minute</key>
    <integer>${minute#0}</integer>
  </dict>

  <key>RunAtLoad</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${OUT_LOG}</string>

  <key>StandardErrorPath</key>
  <string>${ERR_LOG}</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>SIGNALS_ROOT_DIR</key>
    <string>${SIGNAL_ROOT_DIR}</string>
  </dict>
</dict>
</plist>
PLIST
}

need_tools() {
  need_cmd /bin/bash
  need_cmd launchctl
  need_cmd pnpm
  if [[ ! -x "$RUNNER_SCRIPT" ]]; then
    echo "[signal-fetcher] missing script: $RUNNER_SCRIPT" >&2
    exit 1
  fi
}

ensure_dirs() {
  mkdir -p "$LAUNCH_AGENTS_DIR" "$LOG_DIR"
}

is_loaded() {
  launchctl print "$TARGET" >/dev/null 2>&1
}

install_job() {
  need_tools
  ensure_dirs
  print_plist > "$PLIST_PATH"

  launchctl bootout "$TARGET" >/dev/null 2>&1 || true
  launchctl bootstrap "$DOMAIN" "$PLIST_PATH"
  launchctl enable "$TARGET" >/dev/null 2>&1 || true
  launchctl kickstart -k "$TARGET" >/dev/null 2>&1 || true

  local schedule
  schedule="$(resolve_schedule)"
  echo "[signal-fetcher] installed: $PLIST_PATH"
  echo "[signal-fetcher] schedule:  $schedule"
  echo "[signal-fetcher] logs:      $OUT_LOG"
}

run_job() {
  need_cmd pnpm
  local extra_args=()
  if [[ "${SIGNAL_FETCH_DRY_RUN:-0}" == "1" ]]; then
    extra_args+=(--dry-run)
  fi
  if [[ -n "${SIGNAL_FETCH_SOURCE:-}" ]]; then
    extra_args+=(--source "${SIGNAL_FETCH_SOURCE}")
  fi

  if ((${#extra_args[@]} > 0)); then
    (
      cd "$REPO_ROOT"
      pnpm --filter @cat-cafe/api run fetch-signals -- "${extra_args[@]}"
    )
  else
    (
      cd "$REPO_ROOT"
      pnpm --filter @cat-cafe/api run fetch-signals
    )
  fi
}

status() {
  need_tools
  local schedule
  schedule="$(resolve_schedule)"
  echo "[signal-fetcher] label:    $LABEL"
  echo "[signal-fetcher] plist:    $PLIST_PATH"
  echo "[signal-fetcher] schedule: $schedule"
  echo "[signal-fetcher] logs:     $OUT_LOG"
  if is_loaded; then
    echo "[signal-fetcher] launchd:  loaded"
  else
    echo "[signal-fetcher] launchd:  not loaded"
  fi
}

uninstall_job() {
  need_tools
  launchctl bootout "$TARGET" >/dev/null 2>&1 || true
  rm -f "$PLIST_PATH"
  echo "[signal-fetcher] uninstalled: $LABEL"
}

case "$ACTION" in
  install)
    install_job
    ;;
  run)
    run_job
    ;;
  status)
    status
    ;;
  uninstall)
    uninstall_job
    ;;
  print-plist)
    print_plist
    ;;
  *)
    echo "Usage: ./scripts/signal-fetcher-launchd.sh <install|run|status|uninstall|print-plist>" >&2
    exit 2
    ;;
esac
