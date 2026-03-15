#!/usr/bin/env bash
# check-skills-mount.sh — Cat Café Skills 挂载看板
# 检查 cat-cafe-skills/ 下所有 skill 是否正确 symlink 到三猫的 skills 目录
# 注：OpenCode（金渐层）读取 ~/.claude/ 配置，Claude 挂了 = OpenCode 也挂了
# 并校验 BOOTSTRAP.md 注册一致性
# 用法: pnpm check:skills

set -euo pipefail

# Resolve canonical SKILLS_SRC via git main worktree (not script location).
# This ensures correct symlink comparison even when run from a worktree.
MAIN_REPO="$(git worktree list --porcelain | head -1 | sed 's/^worktree //')"
WORKTREE_REPO="$(git rev-parse --show-toplevel)"
SKILLS_SRC="$MAIN_REPO/cat-cafe-skills"
BOOTSTRAP="$SKILLS_SRC/BOOTSTRAP.md"
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
reg_warnings=0
manifest_failures=0

# ─── Part 1: Symlink Mount Check ───

printf "\n${BOLD}Cat Café Skills 挂载看板${NC}\n"
printf "源目录: %s\n\n" "$SKILLS_SRC"
printf "%-35s  %-8s  %-8s  %-8s\n" "Skill" "Claude*" "Codex" "Gemini"
printf "%-35s  %-8s  %-8s  %-8s\n" "-----------------------------------" "--------" "--------" "--------"

# Collect all source skill names
source_skills=()
for skill_dir in "$SKILLS_SRC"/*/; do
  [ -d "$skill_dir" ] || continue
  skill_name="$(basename "$skill_dir")"
  [ -f "$skill_dir/SKILL.md" ] || continue

  source_skills+=("$skill_name")
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

printf "\n${BOLD}挂载合计${NC}: %d skills, " "$total"
if [ "$missing" -eq 0 ]; then
  printf "${GREEN}全部正确挂载${NC}\n"
else
  printf "${RED}%d 处缺失/异常${NC}\n" "$missing"
fi

# ─── Part 2: BOOTSTRAP.md Registration Check (advisory, not blocking) ───

printf "\n${BOLD}注册检查（BOOTSTRAP.md ↔ 源目录）${NC}\n\n"

# Extract skill names from BOOTSTRAP.md backtick-quoted entries in table rows
# Pattern: | `skill-name` | ... |
# grep may match nothing — use || true to prevent set -e exit
bootstrap_skills=()
if [ -f "$BOOTSTRAP" ]; then
  while IFS= read -r line; do
    bootstrap_skills+=("$line")
  done < <(grep -oE '\| `[a-z][-a-z0-9]*` \|' "$BOOTSTRAP" | sed 's/| `//;s/` |//' || true)
fi

# Check A: source dir → BOOTSTRAP.md
for skill in "${source_skills[@]}"; do
  found=false
  for bs in "${bootstrap_skills[@]}"; do
    if [ "$skill" = "$bs" ]; then
      found=true
      break
    fi
  done
  if ! $found; then
    printf "  %-35s ${YELLOW}⚠ not registered in BOOTSTRAP.md${NC}\n" "$skill"
    reg_warnings=$((reg_warnings + 1))
  fi
done

# Check B: BOOTSTRAP.md → source dir
for bs in "${bootstrap_skills[@]}"; do
  if [ ! -f "$SKILLS_SRC/$bs/SKILL.md" ]; then
    printf "  %-35s ${YELLOW}⚠ phantom entry (in BOOTSTRAP.md but no source)${NC}\n" "$bs"
    reg_warnings=$((reg_warnings + 1))
  fi
done

if [ "$reg_warnings" -eq 0 ]; then
  printf "  ${GREEN}全部一致${NC}\n"
fi

# ─── Part 3: Manifest Consistency Check (blocking) ───

printf "\n${BOLD}Manifest 一致性校验（阻塞）${NC}\n\n"
if node "$WORKTREE_REPO/scripts/check-skills-manifest.mjs" "$WORKTREE_REPO"; then
  :
else
  manifest_failures=$((manifest_failures + 1))
fi

# ─── Summary ───
# Exit code: mount failures + manifest failures are blocking; registration warnings are advisory.

printf "\n${BOLD}总结${NC}: %d skills, " "$total"
if [ "$missing" -eq 0 ] && [ "$reg_warnings" -eq 0 ] && [ "$manifest_failures" -eq 0 ]; then
  printf "${GREEN}全部正确（挂载 + 注册 + manifest）${NC}\n\n"
  exit 0
else
  [ "$missing" -gt 0 ] && printf "${RED}%d 挂载异常${NC} " "$missing"
  [ "$reg_warnings" -gt 0 ] && printf "${YELLOW}%d 注册警告${NC} " "$reg_warnings"
  [ "$manifest_failures" -gt 0 ] && printf "${RED}%d manifest 失败${NC} " "$manifest_failures"
  printf "\n\n"
  if [ "$missing" -gt 0 ]; then
    printf "修复挂载:\n"
    printf "  ln -s %s/{skill-name} ~/.claude/skills/{skill-name}\n" "$SKILLS_SRC"
    printf "  ln -s %s/{skill-name} ~/.codex/skills/{skill-name}\n" "$SKILLS_SRC"
    printf "  ln -s %s/{skill-name} ~/.gemini/skills/{skill-name}\n\n" "$SKILLS_SRC"
    printf "  * Claude 列同时覆盖 OpenCode（金渐层读取 ~/.claude/ 配置）\n\n"
  fi
  if [ "$reg_warnings" -gt 0 ]; then
    printf "修复注册: 编辑 cat-cafe-skills/BOOTSTRAP.md 添加/移除对应条目\n\n"
  fi
  # Mount failures and manifest failures are blocking.
  if [ "$missing" -gt 0 ] || [ "$manifest_failures" -gt 0 ]; then
    exit 1
  fi
  exit 0
fi
