#!/usr/bin/env bash
# scripts/embed-server.sh
# Start local embedding server for Cat Cafe memory system (F102).
# Uses Apple Silicon GPU via MLX framework.
#
# Usage:
#   ./scripts/embed-server.sh                                                    # default
#   EMBED_MODEL=mlx-community/Qwen3-Embedding-4B-4bit-DWQ ./scripts/embed-server.sh   # larger model
#   EMBED_DIM=512 ./scripts/embed-server.sh                                      # custom dim
#
# Env vars:
#   EMBED_PORT    — server port (default: 9877)
#   EMBED_MODEL   — MLX model ID (default: mlx-community/Qwen3-Embedding-0.6B-4bit-DWQ)
#   EMBED_DIM     — output dimension after MRL truncation (default: 768)
#
# Requires: pip install mlx mlx-embeddings fastapi uvicorn numpy
# Fallback: pip install sentence-transformers torch fastapi uvicorn numpy
# First run downloads the model from HuggingFace (~335MB for 4-bit DWQ).

set -euo pipefail

VENV_DIR="${HOME}/.cat-cafe/embed-venv"
PORT="${EMBED_PORT:-9880}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Create venv if missing, then activate
if [ ! -d "$VENV_DIR" ]; then
  echo "  创建 venv: $VENV_DIR ..."
  python3 -m venv "$VENV_DIR"
fi
source "$VENV_DIR/bin/activate"

# Auto-install dependencies
if ! python3 -c "import mlx_embeddings" 2>/dev/null; then
  echo "  安装依赖: mlx + mlx-embeddings ..."
  pip install --quiet mlx mlx-embeddings fastapi uvicorn numpy
fi

echo "Starting Embedding server: port=$PORT"
python3 "$SCRIPT_DIR/embed-api.py" --port "$PORT"
