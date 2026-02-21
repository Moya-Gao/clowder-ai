#!/usr/bin/env bash
# scripts/tts-server.sh
# Start local TTS server for Cat Cafe voice output (MLX-Audio backend).
#
# Usage:
#   ./scripts/tts-server.sh                                                # default: Kokoro-82M
#   ./scripts/tts-server.sh mlx-community/Kokoro-82M-bf16                  # explicit model
#
# Requires: pip install mlx-audio "misaki[zh]"
# First run will download the model from HuggingFace (~200MB for Kokoro-82M).

set -euo pipefail

VENV_DIR="${HOME}/.cat-cafe/tts-venv"
MODEL="${1:-mlx-community/Kokoro-82M-bf16}"
PORT="${TTS_PORT:-9877}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Activate venv if it exists
if [ -d "$VENV_DIR" ]; then
  source "$VENV_DIR/bin/activate"
fi

# Check mlx-audio is installed
if ! python3 -c "import mlx_audio" 2>/dev/null; then
  echo "ERROR: mlx-audio not installed. Run:"
  echo "  python3 -m venv $VENV_DIR"
  echo "  source $VENV_DIR/bin/activate"
  echo "  pip install mlx-audio 'misaki[zh]' fastapi uvicorn 'httpx[socks]' num2words spacy phonemizer"
  exit 1
fi

# Check misaki[zh] is installed (required for Chinese phonemization)
if ! python3 -c "import misaki" 2>/dev/null; then
  echo "WARNING: misaki not installed. Chinese TTS may not work."
  echo "  pip install 'misaki[zh]'"
fi

python3 "$SCRIPT_DIR/tts-api.py" --model "$MODEL" --port "$PORT"
