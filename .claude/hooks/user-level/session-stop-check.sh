#!/bin/bash
# Session Stop Hook — 收工前闭环检查
# 用户级 hook：所有项目都生效，出征也带着走
# 归属：F050 系统提示词同步 + 猫猫行为规范

# 读取 stdin（hook 协议要求）
INPUT=$(cat)
CWD=$(echo "$INPUT" | grep -oE '"cwd"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//;s/"$//')
[ -z "$CWD" ] && CWD="$(pwd)"

# 只在 git 仓库里生效
cd "$CWD" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

WARNINGS=""

# 1. 检查未提交的共享文档改动
DIRTY_DOCS=$(git diff --name-only -- docs/ cat-cafe-skills/ assets/system-prompts/ 2>/dev/null | head -10)
if [ -n "$DIRTY_DOCS" ]; then
  WARNINGS="${WARNINGS}
⚠️ 收尾检查：你有未 commit 的共享文档改动（可能是你或其他猫改的）：
${DIRTY_DOCS}
→ 如果是你改的，先 commit push 再收工！
"
fi

# 2. 检查未推送的 commit
UNPUSHED=$(git log --oneline @{u}..HEAD 2>/dev/null | head -5)
if [ -n "$UNPUSHED" ]; then
  WARNINGS="${WARNINGS}
⚠️ 收尾检查：有未 push 的 commit：
${UNPUSHED}
→ 别走！先 push 再收工
"
fi

# 3. 检查暂存区是否有内容（改了没 commit）
STAGED=$(git diff --cached --name-only 2>/dev/null | head -5)
if [ -n "$STAGED" ]; then
  WARNINGS="${WARNINGS}
⚠️ 收尾检查：暂存区有未 commit 的改动：
${STAGED}
→ 要么 commit，要么 unstage
"
fi

# 4. 检查 docs/ 下未跟踪的 .md 文件
UNTRACKED_DOCS=$(git ls-files --others --exclude-standard -- 'docs/*.md' 'docs/**/*.md' 2>/dev/null | head -10)
if [ -n "$UNTRACKED_DOCS" ]; then
  WARNINGS="${WARNINGS}
⚠️ 收尾检查：docs/ 下有未跟踪的 .md 文件（你或其他猫生成了但忘记 commit push）：
${UNTRACKED_DOCS}
→ 别走！先向铲屎官汇报这些文件，商量处理方式
"
fi

# 5. 检查根目录杂物
ROOT_CLUTTER=$(git ls-files --others --exclude-standard -- ':!.*' ':!packages/' ':!docs/' ':!assets/' ':!scripts/' ':!cat-cafe-skills/' ':!designs/' ':!desktop/' 2>/dev/null \
  | grep -vE '^(package\.json|pnpm-workspace\.yaml|pnpm-lock\.yaml|tsconfig|biome|README|LICENSE|CLAUDE|AGENTS|\.npmrc|\.nvmrc|\.node-version|\.editorconfig|\.prettierrc|Makefile|Dockerfile|Procfile|turbo\.json|\.tool-versions)' \
  | head -10)
if [ -n "$ROOT_CLUTTER" ]; then
  WARNINGS="${WARNINGS}
⚠️ 收尾检查：根目录有杂物文件（可能是本轮产物忘记移走/ignore）：
${ROOT_CLUTTER}
→ 别走！先向铲屎官汇报这些文件
"
fi

# 输出提醒（只在有警告时才输出）
if [ -n "$WARNINGS" ]; then
  echo "🐾 收工自检：${WARNINGS}"
fi

exit 0
