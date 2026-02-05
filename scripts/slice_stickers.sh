#!/bin/bash

# Define cats and expressions
CATS=("opus" "codex" "gemini")
EXPRESSIONS=(
  "happy" "thinking" "confused" "shocked"
  "lgtm" "sleeping" "smirk" "guilty"
  "angry" "punch" "exclusive" "misc"
)

for cat in "${CATS[@]}"; do
  echo "Processing $cat..."
  SHEET="assets/stickers/$cat/sheet.png"
  
  if [ ! -f "$SHEET" ]; then
    echo "  Sheet not found: $SHEET"
    continue
  fi

  # Get dimensions
  WIDTH=$(sips -g pixelWidth "$SHEET" | awk '/pixelWidth/ {print $2}')
  HEIGHT=$(sips -g pixelHeight "$SHEET" | awk '/pixelHeight/ {print $2}')
  
  echo "  Size: ${WIDTH}x${HEIGHT}"
  
  # Calculate tile size (3 rows, 4 columns)
  TILE_W=$((WIDTH / 4))
  TILE_H=$((HEIGHT / 3))
  
  echo "  Tile: ${TILE_W}x${TILE_H}"

  for i in {0..11}; do
    EXP="${EXPRESSIONS[$i]}"
    
    # Calculate row and col
    ROW=$((i / 4))
    COL=$((i % 4))
    
    # Calculate offsets
    OFF_X=$((COL * TILE_W))
    OFF_Y=$((ROW * TILE_H))
    
    OUT="assets/stickers/$cat/$EXP.png"
    
    # sips crop logic:
    # We copy the sheet to the target first, then crop in place (sips is destructive usually easiest this way)
    cp "$SHEET" "$OUT"
    sips --cropToHeightWidth $TILE_H $TILE_W --cropOffset $OFF_Y $OFF_X "$OUT" > /dev/null
    
    echo "    Generated $OUT"
  done
done
