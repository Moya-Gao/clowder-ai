#!/usr/bin/env bash
# <xbar.title>Cat Cafe Quota</xbar.title>
# <xbar.version>v1.0</xbar.version>
# <xbar.author>Cat Cafe</xbar.author>
# <xbar.desc>F051 Phase 4 menu bar quota companion (official summary + refresh action)</xbar.desc>
# <xbar.refresh>1m</xbar.refresh>

set -euo pipefail

API_URL="${CAT_CAFE_API_URL:-http://127.0.0.1:3002}"
WEB_URL="${CAT_CAFE_WEB_URL:-http://127.0.0.1:3000/widget/quota}"
TIMEOUT_SECONDS="${CAT_CAFE_TIMEOUT_SECONDS:-4}"

if ! command -v jq >/dev/null 2>&1; then
  echo "🐾 cat | color=#DC2626"
  echo "---"
  echo "缺少 jq（brew install jq）"
  echo "打开 Quota Widget | href=${WEB_URL}"
  exit 0
fi

if ! JSON="$(curl -fsS --max-time "${TIMEOUT_SECONDS}" "${API_URL}/api/quota/summary" 2>/dev/null)"; then
  echo "🐾 离线 | color=#DC2626"
  echo "---"
  echo "API 不可达: ${API_URL}"
  echo "打开 Quota Widget | href=${WEB_URL}"
  exit 0
fi

RISK_LEVEL="$(jq -r '.risk.level // "warn"' <<<"${JSON}")"
RISK_LABEL="$(jq -r '.risk.level // "warn"' <<<"${JSON}")"
MAX_UTIL="$(jq -r '.risk.maxUtilization // empty' <<<"${JSON}")"
FETCHED_AT="$(jq -r '.fetchedAt // ""' <<<"${JSON}")"

case "${RISK_LEVEL}" in
  high)
    COLOR="#DC2626"
    RISK_LABEL="高风险"
    ;;
  warn)
    COLOR="#D97706"
    RISK_LABEL="需关注"
    ;;
  *)
    COLOR="#059669"
    RISK_LABEL="正常"
    ;;
esac

if [[ -n "${MAX_UTIL}" ]]; then
  echo "🐾 ${RISK_LABEL} ${MAX_UTIL}% | color=${COLOR}"
else
  echo "🐾 ${RISK_LABEL} | color=${COLOR}"
fi

echo "---"
echo "猫粮看板（F051 Phase 4）"
echo "打开 Quota Widget | href=${WEB_URL}"
echo "打开 Hub 猫粮看板 | href=${CAT_CAFE_HUB_URL:-http://127.0.0.1:3000}"
echo "---"

printf '%s\n' "Codex: $(jq -r '.platforms.codex.displayPercent // "—"' <<<"${JSON}")$(jq -r 'if .platforms.codex.displayPercent != null then "%" else "" end' <<<"${JSON}") $(jq -r 'if .platforms.codex.displayKind=="remaining" then "剩余" elif .platforms.codex.displayKind=="used" then "已用" else "" end' <<<"${JSON}")"
printf '%s\n' "Claude: $(jq -r '.platforms.claude.displayPercent // "—"' <<<"${JSON}")$(jq -r 'if .platforms.claude.displayPercent != null then "%" else "" end' <<<"${JSON}") $(jq -r 'if .platforms.claude.displayKind=="remaining" then "剩余" elif .platforms.claude.displayKind=="used" then "已用" else "" end' <<<"${JSON}")"
printf '%s\n' "Antigravity: $(jq -r '.platforms.antigravity.note // "待接入"' <<<"${JSON}")"

echo "---"
echo "风险原因"
jq -r '.risk.reasons[]? // "无"' <<<"${JSON}" | while IFS= read -r line; do
  echo "${line}"
done

echo "---"
echo "探针状态"
echo "official-browser: $(jq -r '.probes.official.status // "unknown"' <<<"${JSON}")"
echo "claude-cli: $(jq -r '.probes.claudeCli.status // "unknown"' <<<"${JSON}")"

echo "---"
echo "动作"
echo "刷新官方额度（交互） | bash=/bin/zsh param1=-lc param2=\"curl -fsS -X POST '${API_URL}/api/quota/refresh/official' -H 'content-type: application/json' -d '{\\\"interactive\\\":true}' >/dev/null\" terminal=false refresh=true"
echo "刷新 Claude CLI | bash=/bin/zsh param1=-lc param2=\"curl -fsS -X POST '${API_URL}/api/quota/refresh/claude' >/dev/null\" terminal=false refresh=true"

if [[ -n "${FETCHED_AT}" ]]; then
  echo "---"
  echo "最后检查: ${FETCHED_AT}"
fi
