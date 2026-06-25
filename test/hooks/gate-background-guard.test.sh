#!/bin/bash
# F167 Phase P-0: Gate Background Guard — Unit Tests
# Verifies that gate-class commands are denied when run_in_background=true.
#
# Usage: bash test/hooks/gate-background-guard.test.sh

set -euo pipefail

HOOK=".claude/hooks/gate-background-guard.sh"
PASS=0
FAIL=0

# --- Helpers ---

make_input() {
  local command="$1"
  local bg="${2:-false}"
  jq -cn \
    --arg cmd "$command" \
    --argjson bg "$bg" \
    '{tool_name:"Bash",tool_input:{command:$cmd,run_in_background:$bg},cwd:"/mock"}'
}

make_non_bash_input() {
  jq -cn '{tool_name:"Edit",tool_input:{file_path:"/some/file.ts",old_string:"a",new_string:"b"}}'
}

run_hook() {
  echo "$1" | bash "$HOOK" 2>/dev/null || true
}

assert_deny() {
  local desc="$1"
  local output="$2"
  if echo "$output" | jq -e '.hookSpecificOutput.permissionDecision == "deny"' >/dev/null 2>&1; then
    echo "  ✅ PASS: $desc"
    ((++PASS))
  else
    echo "  ❌ FAIL: $desc — expected deny, got: $(echo "$output" | head -1)"
    ((++FAIL))
  fi
}

assert_allow() {
  local desc="$1"
  local output="$2"
  if [[ -z "$output" ]] || ! echo "$output" | jq -e '.hookSpecificOutput.permissionDecision == "deny"' >/dev/null 2>&1; then
    echo "  ✅ PASS: $desc"
    ((++PASS))
  else
    echo "  ❌ FAIL: $desc — expected allow (silent exit), got deny"
    ((++FAIL))
  fi
}

# ═══════════════════════════════════════════════════════
# DENY cases: gate commands + run_in_background=true
# ═══════════════════════════════════════════════════════
echo "=== DENY: gate commands with run_in_background=true ==="

OUT=$(run_hook "$(make_input 'pnpm gate' true)")
assert_deny "pnpm gate + bg=true → deny" "$OUT"

OUT=$(run_hook "$(make_input 'pnpm check' true)")
assert_deny "pnpm check + bg=true → deny" "$OUT"

OUT=$(run_hook "$(make_input 'pnpm test' true)")
assert_deny "pnpm test + bg=true → deny" "$OUT"

OUT=$(run_hook "$(make_input 'pnpm build' true)")
assert_deny "pnpm build + bg=true → deny" "$OUT"

OUT=$(run_hook "$(make_input 'pnpm lint' true)")
assert_deny "pnpm lint + bg=true → deny" "$OUT"

OUT=$(run_hook "$(make_input 'pnpm alpha:start' true)")
assert_deny "pnpm alpha:start + bg=true → deny" "$OUT"

OUT=$(run_hook "$(make_input 'pnpm alpha:test' true)")
assert_deny "pnpm alpha:test + bg=true → deny" "$OUT"

# Variants with flags/prefixes
OUT=$(run_hook "$(make_input 'env -u NODE_ENV pnpm build' true)")
assert_deny "env prefix + pnpm build + bg=true → deny" "$OUT"

OUT=$(run_hook "$(make_input 'cd /some/worktree && pnpm gate' true)")
assert_deny "cd + pnpm gate + bg=true → deny" "$OUT"

OUT=$(run_hook "$(make_input 'pnpm --filter @cat-cafe/api test:redis' true)")
assert_deny "pnpm --filter test:redis + bg=true → deny" "$OUT"

OUT=$(run_hook "$(make_input 'pnpm test:api:redis:repeat' true)")
assert_deny "pnpm test:api:redis:repeat + bg=true → deny" "$OUT"

OUT=$(run_hook "$(make_input 'bash scripts/pre-merge-check.sh' true)")
assert_deny "pre-merge-check.sh + bg=true → deny" "$OUT"

OUT=$(run_hook "$(make_input 'pnpm check && pnpm build' true)")
assert_deny "pnpm check && pnpm build + bg=true → deny" "$OUT"

# Shell wrapper variants: quoted args ARE execution
OUT=$(run_hook "$(make_input "bash -lc 'pnpm gate'" true)")
assert_deny "bash -lc 'pnpm gate' + bg=true → deny (wrapper)" "$OUT"

OUT=$(run_hook "$(make_input "sh -c 'pnpm test'" true)")
assert_deny "sh -c 'pnpm test' + bg=true → deny (wrapper)" "$OUT"

OUT=$(run_hook "$(make_input 'zsh -lc "pnpm build"' true)")
assert_deny "zsh -lc \"pnpm build\" + bg=true → deny (wrapper)" "$OUT"

OUT=$(run_hook "$(make_input "bash -lc 'echo setup && pnpm gate'" true)")
assert_deny "bash wrapper + chained gate + bg=true → deny" "$OUT"

# Command/process substitution: non-exec prefix but content IS executed
OUT=$(run_hook "$(make_input 'echo $(pnpm test)' true)")
assert_deny "echo \$(pnpm test) + bg=true → deny (cmd substitution)" "$OUT"

OUT=$(run_hook "$(make_input 'printf "%s" "$(pnpm build)"' true)")
assert_deny "printf \$(pnpm build) + bg=true → deny (cmd substitution)" "$OUT"

OUT=$(run_hook "$(make_input 'cat <(pnpm test)' true)")
assert_deny "cat <(pnpm test) + bg=true → deny (process substitution)" "$OUT"

# Line continuation: pnpm and gate keyword on separate physical lines
LINE_CONT_CMD="$(printf 'pnpm --filter @cat-cafe/api \\\n  test:redis')"
OUT=$(run_hook "$(make_input "$LINE_CONT_CMD" true)")
assert_deny "pnpm + line continuation + test:redis + bg=true → deny" "$OUT"

# Real check:* sub-namespace — these ARE gate variants (intentional coverage)
OUT=$(run_hook "$(make_input 'pnpm check:deps' true)")
assert_deny "pnpm check:deps + bg=true → deny (gate sub-namespace)" "$OUT"

OUT=$(run_hook "$(make_input 'pnpm check:lockfile' true)")
assert_deny "pnpm check:lockfile + bg=true → deny (gate sub-namespace)" "$OUT"

OUT=$(run_hook "$(make_input 'pnpm check:pre-merge-gate' true)")
assert_deny "pnpm check:pre-merge-gate + bg=true → deny (gate sub-namespace)" "$OUT"

# ═══════════════════════════════════════════════════════
# DENY cases: accepted false positives (best-effort, fail-safe)
# R4 decision: regex can't reliably parse shell semantics.
# Deny = hard block (command doesn't run). Cat sees gate warning, retries
# without bg, command runs normally. Cost: one round-trip, no work lost.
# ═══════════════════════════════════════════════════════
echo ""
echo "=== DENY: accepted false positives (fail-safe, harmless) ==="

OUT=$(run_hook "$(make_input "echo 'pnpm test'" true)")
assert_deny "echo 'pnpm test' + bg=true → deny (accepted FP)" "$OUT"

OUT=$(run_hook "$(make_input 'printf "pnpm build"' true)")
assert_deny "printf \"pnpm build\" + bg=true → deny (accepted FP)" "$OUT"

OUT=$(run_hook "$(make_input 'grep -r "pnpm check" docs/' true)")
assert_deny "grep \"pnpm check\" + bg=true → deny (accepted FP)" "$OUT"

OUT=$(run_hook "$(make_input "echo 'setup done' && pnpm test" true)")
assert_deny "echo + && pnpm test + bg=true → deny" "$OUT"

# Real non-gate check:* helpers (FP: fixer/info, not gate — but harmless to block)
OUT=$(run_hook "$(make_input 'pnpm check:fix' true)")
assert_deny "pnpm check:fix + bg=true → deny (accepted FP: fixer not gate)" "$OUT"

OUT=$(run_hook "$(make_input 'pnpm check:biome-version' true)")
assert_deny "pnpm check:biome-version + bg=true → deny (accepted FP: info query)" "$OUT"

# ═══════════════════════════════════════════════════════
# ALLOW: pre-merge-check in filename (not .sh/.bash) → not a gate script
# This is the only precision retained: extension-based discrimination
# ═══════════════════════════════════════════════════════
echo ""
echo "=== ALLOW: filename precision (.md ≠ .sh) ==="

OUT=$(run_hook "$(make_input 'cat docs/pre-merge-check-notes.md' true)")
assert_allow "cat pre-merge-check-notes.md + bg=true → allow" "$OUT"

# ═══════════════════════════════════════════════════════
# ALLOW cases: same commands but run_in_background=false
# ═══════════════════════════════════════════════════════
echo ""
echo "=== ALLOW: gate commands with run_in_background=false ==="

OUT=$(run_hook "$(make_input 'pnpm gate' false)")
assert_allow "pnpm gate + bg=false → allow" "$OUT"

OUT=$(run_hook "$(make_input 'pnpm check' false)")
assert_allow "pnpm check + bg=false → allow" "$OUT"

OUT=$(run_hook "$(make_input 'pnpm test' false)")
assert_allow "pnpm test + bg=false → allow" "$OUT"

# ═══════════════════════════════════════════════════════
# ALLOW cases: non-gate commands with run_in_background=true
# ═══════════════════════════════════════════════════════
echo ""
echo "=== ALLOW: non-gate commands with run_in_background=true ==="

OUT=$(run_hook "$(make_input 'git status' true)")
assert_allow "git status + bg=true → allow" "$OUT"

OUT=$(run_hook "$(make_input 'ls -la' true)")
assert_allow "ls -la + bg=true → allow" "$OUT"

OUT=$(run_hook "$(make_input 'pnpm dev:direct' true)")
assert_allow "pnpm dev:direct + bg=true → allow" "$OUT"

OUT=$(run_hook "$(make_input 'pnpm install' true)")
assert_allow "pnpm install + bg=true → allow" "$OUT"

# ═══════════════════════════════════════════════════════
# ALLOW cases: non-Bash tool
# ═══════════════════════════════════════════════════════
echo ""
echo "=== ALLOW: non-Bash tool ==="

OUT=$(run_hook "$(make_non_bash_input)")
assert_allow "Edit tool → allow" "$OUT"

# ═══════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
