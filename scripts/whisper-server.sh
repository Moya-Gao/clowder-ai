#!/usr/bin/env bash
# scripts/whisper-server.sh
# Start local Whisper ASR server for Cat Cafe voice input.
#
# Usage:
#   ./scripts/whisper-server.sh              # Start with default model (small)
#   ./scripts/whisper-server.sh large-v3     # Start with larger model
#
# Requires: pip install faster-whisper fastapi uvicorn

set -euo pipefail

VENV_DIR="${HOME}/.cat-cafe/whisper-venv"
MODEL="${1:-small}"
PORT="${WHISPER_PORT:-9876}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Activate venv if it exists
if [ -d "$VENV_DIR" ]; then
  source "$VENV_DIR/bin/activate"
fi

python3 "$SCRIPT_DIR/whisper-api.py" --model "$MODEL" --port "$PORT"
