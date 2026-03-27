#!/usr/bin/env bash
# Cat Cafe 项目统计脚本 — 统一口径
# 用法: bash scripts/project-stats.sh
set -eu

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "========================================="
echo " Cat Café 项目统计 (统一口径)"
echo " 统计时间: $(date '+%Y-%m-%d %H:%M')"
echo " HEAD: $(git rev-parse --short HEAD)"
echo "========================================="
echo ""

# 1. 时间跨度
FIRST_COMMIT_DATE=$(git log --reverse --format="%ai" | head -1 | cut -d' ' -f1)
TODAY=$(date '+%Y-%m-%d')
DAYS=$(( ( $(date -j -f "%Y-%m-%d" "$TODAY" +%s) - $(date -j -f "%Y-%m-%d" "$FIRST_COMMIT_DATE" +%s) ) / 86400 ))
echo "📅 时间跨度: ${DAYS} 天 ($FIRST_COMMIT_DATE → $TODAY)"
echo ""

# 2. Commits
TOTAL_COMMITS=$(git log --oneline | wc -l | tr -d ' ')
CAT_COMMITS=$(git log --oneline --grep='🐾' | wc -l | tr -d ' ')
echo "📝 Commits: ${TOTAL_COMMITS} 总计 (其中 🐾 猫猫签名: ${CAT_COMMITS})"
echo ""

# 3. 代码行数 (排除 node_modules, dist, .next, 生成文件)
echo "💻 代码行数 (TS/TSX/JS/JSX, 排除 node_modules/dist/.next):"
find . \( -name node_modules -o -name dist -o -name .next -o -name '.git' \) -prune -o \
  \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -print | \
  xargs wc -l 2>/dev/null | tail -1 | awk '{printf "  总计: %s 行\n", $1}'
echo ""

# 4. 文档
MD_COUNT=$(find ./docs -name "*.md" ! -path "*/node_modules/*" | wc -l | tr -d ' ')
MD_LINES=$(find ./docs -name "*.md" ! -path "*/node_modules/*" -exec cat {} + 2>/dev/null | wc -l | tr -d ' ')
echo "📚 文档 (docs/ 下 .md):"
echo "  文件数: ${MD_COUNT}"
echo "  总行数: ${MD_LINES}"
echo ""

# 5. Features
FEATURE_COUNT=$(find docs/features -name "F*.md" 2>/dev/null | wc -l | tr -d ' ')
echo "🎯 Feature 文档: ${FEATURE_COUNT} 个"

# 6. ADRs (命名: 001-xxx.md, 排除 .gitkeep)
ADR_COUNT=$(find docs/decisions -name "*.md" ! -name ".gitkeep" 2>/dev/null | wc -l | tr -d ' ')
echo "⚖️  ADR (架构决策): ${ADR_COUNT} 个"

# 7. Skills
SKILL_COUNT=$(find cat-cafe-skills -maxdepth 1 -type d ! -name refs ! -name __pycache__ ! -name cat-cafe-skills | wc -l | tr -d ' ')
echo "🛠️  Skills: ${SKILL_COUNT} 个"

# 8. Lessons (docs/lessons/ 下的主题文件，排除 README/DEMO/homework/teaching)
LESSON_COUNT=$(find docs/lessons -name "*.md" ! -name "README.md" ! -name "DEMO.md" ! -name "_teaching-notes.md" ! -name "*homework*" 2>/dev/null | wc -l | tr -d ' ')
echo "📖 Lessons Learned: ${LESSON_COUNT} 条"

# 9. 测试文件
TEST_COUNT=$(find . \( -name node_modules -o -name dist -o -name .next -o -name '.git' \) -prune -o \
  \( -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.test.js" -o -name "*.spec.ts" -o -name "*.spec.tsx" \) -print | wc -l | tr -d ' ')
echo "🧪 测试文件: ${TEST_COUNT} 个"

# 10. 猫猫贡献 (按签名)
echo ""
echo "🐾 猫猫贡献 (commit 签名):"
for sig in "宪宪/Opus" "砚砚/Codex" "砚砚/GPT" "烁烁/Gemini"; do
  COUNT=$(git log --oneline --grep="$sig" | wc -l | tr -d ' ')
  echo "  $sig: $COUNT"
done

echo ""
echo "========================================="
echo " 统计完毕"
echo "========================================="
