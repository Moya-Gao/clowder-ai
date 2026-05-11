#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$SCRIPT_DIR/CaptureAppAudio"
APP_DIR="$SCRIPT_DIR/CaptureAppAudio.app/Contents/MacOS"

echo "Building CaptureAppAudio..."
cd "$PKG_DIR"
swift build -c release 2>&1

BIN_PATH=$(swift build -c release --show-bin-path)/CaptureAppAudio
if [ ! -f "$BIN_PATH" ]; then
  echo "ERROR: Binary not found at $BIN_PATH"
  exit 1
fi

mkdir -p "$APP_DIR"
cp "$BIN_PATH" "$APP_DIR/CaptureAppAudio"
echo "Installed to $APP_DIR/CaptureAppAudio"
