#!/usr/bin/env bash
# scripts/services/qwen3-asr-install.sh
# Install dependencies for Qwen3-ASR service (venv + mlx-audio).
# Drop-in replacement for whisper -- same port, same API, different model.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ASR_PY="$REPO_ROOT/scripts/services/qwen3-asr-api.py"

if [ ! -f "$ASR_PY" ]; then
  echo "ERROR: qwen3-asr-api.py not found at $ASR_PY" >&2
  exit 1
fi

SERVICE_LABEL="Qwen3 ASR"
VENV_NAME="asr-venv"
DISK_REQUIRED_GB=3
MODEL_ENV_VAR="QWEN3_ASR_MODEL"
PIP_DEPS_ARM64="mlx-audio fastapi uvicorn python-multipart"
PIP_DEPS_OTHER="mlx-audio fastapi uvicorn python-multipart"
PRE_CHECK_FFMPEG=1
MODEL_LOADER_ARM64="skip"
MODEL_LOADER_OTHER="skip"

# shellcheck source=./install-template.sh
source "$SCRIPT_DIR/install-template.sh"
install_service_main
