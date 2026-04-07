#!/usr/bin/env bash
# F138 Video Forge Pipeline — End-to-End
#
# Usage:
#   ./scripts/video-forge/pipeline.sh docs/videos/showcase-60s
#
# Prerequisites:
#   1. TTS server running: source ~/.cat-cafe/tts-venv/bin/activate && python scripts/tts-api.py
#   2. FA venv ready: .venv/video-forge/ (pip install qwen-asr)
#   3. voice-script.md exists in project dir
#
# Pipeline:
#   voice-script.md → editorial spec → TTS audio → FA timestamps → render-ready spec

set -euo pipefail

PROJECT_DIR="${1:?Usage: pipeline.sh <project-dir>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FA_PYTHON="${SCRIPT_DIR}/../../.venv/video-forge/bin/python3"
SYSTEM_PYTHON="python3"

# Paths
VOICE_SCRIPT="${PROJECT_DIR}/voice-script.md"
SPEC_FILE="${PROJECT_DIR}/video-spec.json"
AUDIO_FILE="${PROJECT_DIR}/assets/global-narration.wav"
TIMESTAMPS_FILE="${PROJECT_DIR}/assets/word-timestamps.json"

echo "=== F138 Video Forge Pipeline ==="
echo "Project: ${PROJECT_DIR}"
echo ""

# Step 1: Generate editorial spec from voice-script
echo "[1/4] Generating editorial video-spec.json..."
$SYSTEM_PYTHON "${SCRIPT_DIR}/generate-spec.py" \
  --script "${VOICE_SCRIPT}" \
  --project "$(basename "${PROJECT_DIR}")" \
  --output "${SPEC_FILE}"
echo ""

# Step 2: TTS — generate global narration audio
echo "[2/4] Generating TTS narration audio..."
mkdir -p "${PROJECT_DIR}/assets"
$SYSTEM_PYTHON "${SCRIPT_DIR}/tts.py" \
  --script "${VOICE_SCRIPT}" \
  --voice opus \
  --output "${AUDIO_FILE}"
echo ""

# Step 3: Forced Alignment — audio + text → word timestamps
echo "[3/4] Running forced alignment..."
# Extract full text from voice-script for alignment
FULL_TEXT=$($SYSTEM_PYTHON -c "
import re; from pathlib import Path
c = Path('${VOICE_SCRIPT}').read_text()
m = re.search(r'## 完整剧本[^\n]*\n\n(.*?)(?=\n---|\n## )', c, re.DOTALL)
print(m.group(1).strip().replace('\n', '') if m else '')
")
$FA_PYTHON "${SCRIPT_DIR}/align.py" \
  --audio "${AUDIO_FILE}" \
  --text "${FULL_TEXT}" \
  --lang Chinese \
  --output "${TIMESTAMPS_FILE}" \
  --pretty
echo ""

# Step 4: Upgrade spec to render-ready
echo "[4/4] Upgrading spec to render-ready..."
$SYSTEM_PYTHON "${SCRIPT_DIR}/generate-spec.py" \
  --script "${VOICE_SCRIPT}" \
  --output "${SPEC_FILE}" \
  --upgrade-render-ready \
  --audio "assets/global-narration.wav" \
  --timestamps "${TIMESTAMPS_FILE}"
echo ""

echo "=== Pipeline Complete ==="
echo "  Spec: ${SPEC_FILE} (render-ready)"
echo "  Audio: ${AUDIO_FILE}"
echo "  Timestamps: ${TIMESTAMPS_FILE}"
echo ""
echo "Next: cd remotion-studio && npx remotion studio"
echo "  → Select 'ShowcaseVideo' composition"
echo "  → Copy spec to remotion-studio/public/video-spec.json"
