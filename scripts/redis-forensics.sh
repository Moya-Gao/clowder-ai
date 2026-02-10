#!/usr/bin/env bash
set -euo pipefail

# Read-only Redis forensics helper.
# - Shows key stats from running Redis ports.
# - Loads given dump.rdb files in temporary Redis instances and prints stats.
#
# Usage:
#   ./scripts/redis-forensics.sh
#   ./scripts/redis-forensics.sh --ports "6379,6399" --dump /path/to/dump.rdb --dump ./dump.rdb

PORTS="6379,6399"
declare -a DUMPS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ports)
      if [[ $# -lt 2 ]]; then
        echo "[forensics] --ports needs a comma-separated value" >&2
        exit 2
      fi
      PORTS="$2"
      shift 2
      ;;
    --dump)
      if [[ $# -lt 2 ]]; then
        echo "[forensics] --dump needs a file path" >&2
        exit 2
      fi
      DUMPS+=("$2")
      shift 2
      ;;
    -h|--help)
      sed -n '1,15p' "$0"
      exit 0
      ;;
    *)
      echo "[forensics] unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

if ! command -v redis-cli >/dev/null 2>&1; then
  echo "[forensics] redis-cli not found." >&2
  exit 127
fi

if ! command -v redis-server >/dev/null 2>&1; then
  echo "[forensics] redis-server not found." >&2
  exit 127
fi

split_csv() {
  local csv="$1"
  local oldifs="$IFS"
  IFS=','
  read -r -a out <<< "$csv"
  IFS="$oldifs"
  echo "${out[@]}"
}

count_pattern() {
  local port="$1"
  local pattern="$2"
  redis-cli -p "$port" --scan --pattern "$pattern" 2>/dev/null | wc -l | tr -d ' '
}

print_stats_for_port() {
  local port="$1"
  if ! redis-cli -p "$port" ping >/dev/null 2>&1; then
    echo "[port $port] unreachable"
    return
  fi

  local dbsize
  dbsize="$(redis-cli -p "$port" dbsize 2>/dev/null || echo "ERR")"
  echo "[port $port] dbsize=${dbsize}"
  echo "  cat-cafe:msg:*             $(count_pattern "$port" 'cat-cafe:msg:*')"
  echo "  cat-cafe:thread:*          $(count_pattern "$port" 'cat-cafe:thread:*')"
  echo "  cat-cafe:threads:*         $(count_pattern "$port" 'cat-cafe:threads:*')"
  echo "  cat-cafe:task:*            $(count_pattern "$port" 'cat-cafe:task:*')"
  echo "  cat-cafe:summary:*         $(count_pattern "$port" 'cat-cafe:summary:*')"
  echo "  cat-cafe:sessions:*        $(count_pattern "$port" 'cat-cafe:sessions:*')"
  echo "  cat-cafe:delivery-cursor:* $(count_pattern "$port" 'cat-cafe:delivery-cursor:*')"
  echo "  cat-cafe:invoc:*           $(count_pattern "$port" 'cat-cafe:invoc:*')"
}

find_free_port() {
  local p
  for p in $(seq 6500 6999); do
    if ! redis-cli -p "$p" ping >/dev/null 2>&1; then
      echo "$p"
      return 0
    fi
  done
  return 1
}

inspect_dump() {
  local dump="$1"
  if [[ ! -f "$dump" ]]; then
    echo "[dump] skip missing file: $dump"
    return
  fi

  local tmpdir port pidfile logfile
  tmpdir="$(mktemp -d -t cat-cafe-rdb-forensics.XXXXXX)"
  pidfile="$tmpdir/redis.pid"
  logfile="$tmpdir/redis.log"
  port="$(find_free_port || true)"
  if [[ -z "$port" ]]; then
    echo "[dump] no free temp port for $dump" >&2
    rm -rf "$tmpdir"
    return
  fi

  cp "$dump" "$tmpdir/dump.rdb"
  if ! redis-server \
    --port "$port" \
    --dir "$tmpdir" \
    --dbfilename dump.rdb \
    --save "" \
    --appendonly no \
    --daemonize yes \
    --pidfile "$pidfile" \
    --logfile "$logfile" >/dev/null 2>&1; then
    echo "[dump] failed to start temp redis for $dump"
    if [[ -f "$logfile" ]]; then
      echo "  log: $logfile"
    fi
    rm -rf "$tmpdir"
    return
  fi

  local i
  for i in $(seq 1 50); do
    if redis-cli -p "$port" ping >/dev/null 2>&1; then
      break
    fi
    sleep 0.1
  done

  echo "[dump] $dump"
  print_stats_for_port "$port"
  echo "  sample keys:"
  redis-cli -p "$port" --scan --pattern 'cat-cafe:*' 2>/dev/null | head -n 10 | sed 's/^/    /'

  redis-cli -p "$port" shutdown nosave >/dev/null 2>&1 || true
  rm -rf "$tmpdir"
}

echo "== Running Redis Ports =="
for port in $(split_csv "$PORTS"); do
  print_stats_for_port "$port"
done

if [[ "${#DUMPS[@]}" -eq 0 ]]; then
  # Common candidate locations.
  [[ -f "./dump.rdb" ]] && DUMPS+=("./dump.rdb")
  [[ -f "/opt/homebrew/var/db/redis/dump.rdb" ]] && DUMPS+=("/opt/homebrew/var/db/redis/dump.rdb")
fi

if [[ "${#DUMPS[@]}" -gt 0 ]]; then
  echo
  echo "== dump.rdb Forensics =="
  for dump in "${DUMPS[@]}"; do
    inspect_dump "$dump"
  done
else
  echo
  echo "== dump.rdb Forensics =="
  echo "[dump] no dump files provided/found"
fi

