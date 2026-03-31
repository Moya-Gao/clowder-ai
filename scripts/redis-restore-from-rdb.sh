#!/usr/bin/env bash
set -euo pipefail

# Restore Redis data from a dump.rdb snapshot into a target Redis port.
# This script is for local/dev recovery.
#
# Safety:
# - Backs up current target dump.rdb first (if found).
# - Requires explicit confirmation.
#
# Usage:
#   ./scripts/redis-restore-from-rdb.sh --source /path/to/dump.rdb
#   ./scripts/redis-restore-from-rdb.sh --source /path/to/dump.rdb --target-port 6399
#   ./scripts/redis-restore-from-rdb.sh --source /path/to/dump.rdb --yes

SOURCE=""
TARGET_PORT="6399"
YES="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      if [[ $# -lt 2 ]]; then
        echo "[restore] --source needs a file path" >&2
        exit 2
      fi
      SOURCE="$2"
      shift 2
      ;;
    --target-port)
      if [[ $# -lt 2 ]]; then
        echo "[restore] --target-port needs a number" >&2
        exit 2
      fi
      TARGET_PORT="$2"
      shift 2
      ;;
    --yes)
      YES="true"
      shift
      ;;
    -h|--help)
      sed -n '1,16p' "$0"
      exit 0
      ;;
    *)
      echo "[restore] unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$SOURCE" ]]; then
  echo "[restore] missing required --source /path/to/dump.rdb" >&2
  exit 2
fi

if [[ ! -f "$SOURCE" ]]; then
  echo "[restore] source file not found: $SOURCE" >&2
  exit 2
fi

if ! [[ "$TARGET_PORT" =~ ^[0-9]+$ ]]; then
  echo "[restore] invalid --target-port: $TARGET_PORT" >&2
  exit 2
fi

if ! command -v redis-cli >/dev/null 2>&1; then
  echo "[restore] redis-cli not found." >&2
  exit 127
fi

if ! command -v redis-server >/dev/null 2>&1; then
  echo "[restore] redis-server not found." >&2
  exit 127
fi

if ! redis-cli -p "$TARGET_PORT" ping >/dev/null 2>&1; then
  echo "[restore] target redis port $TARGET_PORT is not reachable." >&2
  echo "          Please start redis first, then re-run." >&2
  exit 1
fi

TARGET_DIR="$(redis-cli -p "$TARGET_PORT" config get dir | sed -n '2p')"
TARGET_DBFILE="$(redis-cli -p "$TARGET_PORT" config get dbfilename | sed -n '2p')"

if [[ -z "$TARGET_DIR" || -z "$TARGET_DBFILE" ]]; then
  echo "[restore] failed to read target redis dir/dbfilename from CONFIG GET" >&2
  exit 1
fi

TARGET_DUMP_PATH="$TARGET_DIR/$TARGET_DBFILE"
BACKUP_DIR="$TARGET_DIR/cat-cafe-redis-backups"
STAMP="$(date '+%Y%m%d-%H%M%S')"
BACKUP_PATH="$BACKUP_DIR/${TARGET_DBFILE}.${STAMP}.bak"
TARGET_APPENDONLY="$(redis-cli -p "$TARGET_PORT" config get appendonly | sed -n '2p')"
TARGET_APPEND_FILENAME="$(redis-cli -p "$TARGET_PORT" config get appendfilename | sed -n '2p')"
TARGET_APPEND_DIRNAME="$(redis-cli -p "$TARGET_PORT" config get appenddirname | sed -n '2p')"
TARGET_APPEND_FSYNC="$(redis-cli -p "$TARGET_PORT" config get appendfsync | sed -n '2p')"

# 恢复脚本默认启用 AOF，避免恢复后进入“纯 RDB 模式”导致后续 AOF 长期停更。
if [[ -z "$TARGET_APPENDONLY" || "$TARGET_APPENDONLY" != "yes" ]]; then
  TARGET_APPENDONLY="yes"
fi
if [[ -z "$TARGET_APPEND_FILENAME" ]]; then
  TARGET_APPEND_FILENAME="appendonly.aof"
fi
if [[ -z "$TARGET_APPEND_DIRNAME" ]]; then
  TARGET_APPEND_DIRNAME="appendonlydir"
fi
if [[ -z "$TARGET_APPEND_FSYNC" ]]; then
  TARGET_APPEND_FSYNC="everysec"
fi
TARGET_APPEND_DIR_PATH="$TARGET_DIR/$TARGET_APPEND_DIRNAME"
AOF_BACKUP_PATH="$BACKUP_DIR/${TARGET_APPEND_DIRNAME}.${STAMP}.bak"

echo "== Redis Restore Plan =="
echo "source dump:     $SOURCE"
echo "target port:     $TARGET_PORT"
echo "target dir:      $TARGET_DIR"
echo "target db file:  $TARGET_DBFILE"
echo "target dump:     $TARGET_DUMP_PATH"
echo "backup path:     $BACKUP_PATH"
echo "appendonly:      $TARGET_APPENDONLY"
echo "appendfilename:  $TARGET_APPEND_FILENAME"
echo "appenddirname:   $TARGET_APPEND_DIRNAME"
echo "appendfsync:     $TARGET_APPEND_FSYNC"
echo
echo "WARNING: this replaces target Redis dataset on port $TARGET_PORT."

if [[ "$YES" != "true" ]]; then
  printf "Type EXACTLY 'RESTORE %s' to continue: " "$TARGET_PORT"
  read -r confirm
  if [[ "$confirm" != "RESTORE $TARGET_PORT" ]]; then
    echo "[restore] aborted."
    exit 1
  fi
fi

mkdir -p "$BACKUP_DIR"

if [[ -f "$TARGET_DUMP_PATH" ]]; then
  cp "$TARGET_DUMP_PATH" "$BACKUP_PATH"
  echo "[restore] backup created: $BACKUP_PATH"
else
  echo "[restore] target dump file did not exist; skipping backup copy."
fi

echo "[restore] shutting down target redis with SAVE..."
redis-cli -p "$TARGET_PORT" shutdown save >/dev/null 2>&1 || true
sleep 0.5

cp "$SOURCE" "$TARGET_DUMP_PATH"
echo "[restore] source copied to target dump path."

if [[ "$TARGET_APPENDONLY" == "yes" && -d "$TARGET_APPEND_DIR_PATH" ]]; then
  mv "$TARGET_APPEND_DIR_PATH" "$AOF_BACKUP_PATH"
  echo "[restore] previous appendonly dir moved to: $AOF_BACKUP_PATH"
fi

echo "[restore] starting redis on port $TARGET_PORT..."
redis-server \
  --port "$TARGET_PORT" \
  --dir "$TARGET_DIR" \
  --dbfilename "$TARGET_DBFILE" \
  --appendonly "$TARGET_APPENDONLY" \
  --appendfilename "$TARGET_APPEND_FILENAME" \
  --appenddirname "$TARGET_APPEND_DIRNAME" \
  --appendfsync "$TARGET_APPEND_FSYNC" \
  --daemonize yes >/dev/null 2>&1

for _ in $(seq 1 50); do
  if redis-cli -p "$TARGET_PORT" ping >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

if ! redis-cli -p "$TARGET_PORT" ping >/dev/null 2>&1; then
  echo "[restore] redis failed to start on port $TARGET_PORT" >&2
  echo "          You can restore backup manually from: $BACKUP_PATH" >&2
  exit 1
fi

echo "[restore] redis is up."
echo "[restore] dbsize: $(redis-cli -p "$TARGET_PORT" dbsize)"
echo "[restore] sample keys:"
redis-cli -p "$TARGET_PORT" --scan --pattern 'cat-cafe:*' | head -n 15 | sed 's/^/  /'
echo
echo "[restore] done."
