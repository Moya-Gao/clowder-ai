#!/usr/bin/env bash
# scripts/tts-server.sh
# Start local TTS server for Cat Cafe voice output.
#
# Usage:
#   ./scripts/tts-server.sh                                  # default: mlx-audio + Kokoro-82M
#   ./scripts/tts-server.sh mlx-community/Kokoro-82M-bf16    # explicit model
#   TTS_PROVIDER=qwen3-clone ./scripts/tts-server.sh         # Qwen3-TTS Base clone (E-type)
#   TTS_PROVIDER=edge-tts ./scripts/tts-server.sh            # edge-tts fallback
#
# Env vars:
#   TTS_PROVIDER  — "mlx-audio" (default), "qwen3-clone", or "edge-tts"
#   TTS_PORT      — server port (default: 9879)
#
# Requires (mlx-audio): pip install mlx-audio "misaki[zh]" fastapi uvicorn
# Requires (edge-tts):  pip install edge-tts fastapi uvicorn
# First run (mlx-audio) downloads the model from HuggingFace (~200MB for Kokoro-82M).

set -euo pipefail

VENV_DIR="${HOME}/.cat-cafe/tts-venv"
MODEL="${1:-mlx-community/Kokoro-82M-bf16}"
PORT="${TTS_PORT:-9879}"
PROVIDER="${TTS_PROVIDER:-mlx-audio}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Activate venv if it exists
if [ -d "$VENV_DIR" ]; then
  source "$VENV_DIR/bin/activate"
fi

# Provider-specific dependency checks
if [ "$PROVIDER" = "mlx-audio" ] || [ "$PROVIDER" = "qwen3-clone" ]; then
  if ! python3 -c "import mlx_audio" 2>/dev/null; then
    echo "ERROR: mlx-audio not installed. Run:"
    echo "  python3 -m venv $VENV_DIR"
    echo "  source $VENV_DIR/bin/activate"
    echo "  pip install mlx-audio 'misaki[zh]' fastapi uvicorn 'httpx[socks]' num2words spacy phonemizer"
    exit 1
  fi

  if ! python3 -c "import misaki" 2>/dev/null; then
    echo "WARNING: misaki not installed. Chinese TTS may not work."
    echo "  pip install 'misaki[zh]'"
  fi
elif [ "$PROVIDER" = "edge-tts" ]; then
  if ! python3 -c "import edge_tts" 2>/dev/null; then
    echo "ERROR: edge-tts not installed. Run:"
    echo "  pip install edge-tts"
    exit 1
  fi
fi

echo "Starting TTS server: provider=$PROVIDER, model=$MODEL, port=$PORT"
TTS_PROVIDER="$PROVIDER" python3 "$SCRIPT_DIR/tts-api.py" --model "$MODEL" --port "$PORT"
