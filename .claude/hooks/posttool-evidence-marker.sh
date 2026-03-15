#!/usr/bin/env bash
# Evidence Marker — PostToolUse hook on Read|Grep|Glob
# Records that the cat has performed investigative work recently.
# Used by pretool-evidence-guard.sh to enforce "read before write".
#
# Why (2026-03-14): 布偶猫系统性退化——不看代码就 Edit，不看设计就说"完美"。
# 砚砚们会诊处方：加 evidence guard，ask 模式。

set -euo pipefail

MARKER_FILE="${TMPDIR:-/tmp}/cat-cafe-evidence-${USER:-default}.marker"

# Safety: refuse symlinks
if [[ -L "$MARKER_FILE" ]]; then
  rm -f "$MARKER_FILE"
fi

# Drain stdin (hook protocol requires reading input)
cat > /dev/null

# Touch marker with current timestamp
date +%s > "$MARKER_FILE"

exit 0
