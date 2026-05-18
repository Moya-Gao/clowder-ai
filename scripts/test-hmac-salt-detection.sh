#!/usr/bin/env bash
# Regression test for #705: TELEMETRY_HMAC_SALT quoted-empty/whitespace detection.
# Exercises the exact detection logic from install.sh against all acceptance cases.
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0

check() {
    local desc="$1" env_line="$2" expect="$3"
    TOTAL=$((TOTAL + 1))

    local tmpfile; tmpfile="$(mktemp)"
    printf '%s\n' "$env_line" > "$tmpfile"

    local _raw_salt _trimmed_salt result
    _raw_salt="$(sed -n 's/^TELEMETRY_HMAC_SALT=//p' "$tmpfile" 2>/dev/null || true)"
    _trimmed_salt="$(printf '%s' "$_raw_salt" | tr -d "\"' \t\n\r")"

    if [[ -z "$_trimmed_salt" ]]; then
        result="regen"
    else
        result="keep"
    fi

    if [[ "$result" == "$expect" ]]; then
        printf '  ✅ %s → %s\n' "$desc" "$result"
        PASS=$((PASS + 1))
    else
        printf '  ❌ %s → %s (expected %s)\n' "$desc" "$result" "$expect"
        FAIL=$((FAIL + 1))
    fi
    rm -f "$tmpfile" 2>/dev/null || true
}

echo "=== #705 HMAC salt detection regression ==="
echo ""

echo "-- Should regenerate --"
check "missing key"                     "OTHER_KEY=value"                    regen
check "double-quoted empty"             'TELEMETRY_HMAC_SALT=""'             regen
check "single-quoted empty"             "TELEMETRY_HMAC_SALT=''"             regen
check "whitespace only"                 'TELEMETRY_HMAC_SALT=   '            regen
check "quoted whitespace (double)"      'TELEMETRY_HMAC_SALT="   "'         regen
check "quoted whitespace (single)"      "TELEMETRY_HMAC_SALT='   '"         regen
check "commented out"                   '# TELEMETRY_HMAC_SALT=abc123'       regen
check "bare equals (no value)"          'TELEMETRY_HMAC_SALT='               regen

echo ""
echo "-- Should preserve --"
check "bare hex value"                  'TELEMETRY_HMAC_SALT=abc123def456'   keep
check "quoted hex value (double)"       'TELEMETRY_HMAC_SALT="abc123def"'    keep
check "quoted hex value (single)"       "TELEMETRY_HMAC_SALT='abc123def'"    keep
check "64-char real salt"               "TELEMETRY_HMAC_SALT=$(head -c 32 /dev/urandom | xxd -p -c 64)" keep

echo ""
echo "=== Results: $PASS/$TOTAL passed, $FAIL failed ==="
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
