#!/usr/bin/env bash
# check-skills-mount.sh — Cat Café Skills 挂载看板
# 检查 cat-cafe-skills/ 下所有 skill 是否正确 symlink 到三猫的 skills 目录
# 用法: pnpm check:skills

set -euo pipefail

SKILLS_SRC="$(cd "$(dirname "$0")/../cat-cafe-skills" && pwd)"
CLAUDE_SKILLS="$HOME/.claude/skills"
CODEX_SKILLS="$HOME/.codex/skills"
GEMINI_SKILLS="$HOME/.gemini/skills"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

total=0
missing=0

printf "\n${BOLD}Cat Café Skills 挂载看板${NC}\n"
printf "源目录: %s\n\n" "$SKILLS_SRC"
printf "%-35s  %-8s  %-8s  %-8s\n" "Skill" "Claude" "Codex" "Gemini"
printf "%-35s  %-8s  %-8s  %-8s\n" "-----------------------------------" "--------" "--------" "--------"

for skill_dir in "$SKILLS_SRC"/*/; do
  [ -d "$skill_dir" ] || continue
  skill_name="$(basename "$skill_dir")"

  # Skip non-skill directories (no SKILL.md)
  [ -f "$skill_dir/SKILL.md" ] || continue

  total=$((total + 1))
  row=""

  for cat_dir in "$CLAUDE_SKILLS" "$CODEX_SKILLS" "$GEMINI_SKILLS"; do
    target="$cat_dir/$skill_name"
    if [ -L "$target" ]; then
      link_dest="$(readlink "$target")"
      # Normalize: strip trailing slash for comparison
      link_norm="${link_dest%/}"
      expected="$SKILLS_SRC/$skill_name"
      if [ "$link_norm" = "$expected" ]; then
        row="$row  ${GREEN}✓${NC}       "
      else
        row="$row  ${YELLOW}→ other${NC} "
        missing=$((missing + 1))
      fi
    elif [ -d "$target" ]; then
      row="$row  ${YELLOW}dir${NC}     "
      missing=$((missing + 1))
    else
      row="$row  ${RED}✗${NC}       "
      missing=$((missing + 1))
    fi
  done

  printf "%-35s %b\n" "$skill_name" "$row"
done

printf "\n${BOLD}合计${NC}: %d skills, " "$total"
if [ "$missing" -eq 0 ]; then
  printf "${GREEN}全部正确挂载${NC}\n\n"
  exit 0
else
  printf "${RED}%d 处缺失/异常${NC}\n\n" "$missing"
  printf "修复命令示例:\n"
  printf "  ln -s %s/{skill-name} ~/.claude/skills/{skill-name}\n" "$SKILLS_SRC"
  printf "  ln -s %s/{skill-name} ~/.codex/skills/{skill-name}\n" "$SKILLS_SRC"
  printf "  ln -s %s/{skill-name} ~/.gemini/skills/{skill-name}\n\n" "$SKILLS_SRC"
  exit 1
fi
