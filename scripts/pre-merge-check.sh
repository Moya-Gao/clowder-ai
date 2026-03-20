#!/bin/bash
# scripts/pre-merge-check.sh — Latest-main 全量门禁
#
# merge-gate 的硬门禁脚本。在 squash merge 前，基于最新 origin/main
# 跑全量 build + test + lint/check，确保合流后仍然全绿。
#
# Usage:
#   pnpm gate          # 在 feature worktree 里执行
#
# 前置条件：
#   - 当前在 feature branch（不是 main）
#   - 所有改动已 commit
#
# 输出：
#   - 全绿：打印 SHA + 通过标记
#   - 任一步骤失败：exit 1，打印失败原因

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║       🛡️  Pre-Merge Gate — Latest Main Check        ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Step 0: 前置检查 ──

BRANCH="$(git branch --show-current 2>/dev/null)"
if [ "$BRANCH" = "main" ]; then
  echo -e "${RED}❌ 不能在 main 分支上执行 gate 检查${NC}"
  echo "   请在 feature worktree 里执行 pnpm gate"
  exit 1
fi

UNCOMMITTED="$(git status --porcelain)"
if [ -n "$UNCOMMITTED" ]; then
  echo -e "${YELLOW}⚠️  有未提交的改动：${NC}"
  echo "$UNCOMMITTED" | head -10
  echo ""
  echo -e "${RED}❌ 请先 commit 所有改动再执行 gate 检查${NC}"
  exit 1
fi

echo -e "${GREEN}✓ 分支: $BRANCH${NC}"
echo -e "${GREEN}✓ 工作区干净${NC}"
echo ""

# ── Step 1: Fetch + Rebase origin/main ──

echo "── Step 1/4: 同步 origin/main 并 rebase ──"
git fetch origin main --quiet
echo -e "${GREEN}✓ fetch origin/main${NC}"

REBASE_RESULT=0
git rebase origin/main --quiet 2>&1 || REBASE_RESULT=$?
if [ $REBASE_RESULT -ne 0 ]; then
  echo ""
  echo -e "${RED}❌ Rebase 有冲突！${NC}"
  echo ""
  echo "请手动解决冲突后重新执行 pnpm gate。"
  echo "提示："
  echo "  - git status 查看冲突文件"
  echo "  - 冲突区域会显示 base/ours/theirs 三段（zdiff3 格式）"
  echo "  - 解决后 git rebase --continue"
  echo ""
  echo "三屏对比命令（针对单个冲突文件）："
  echo "  git show :1:<path>   # BASE（共同祖先）"
  echo "  git show :2:<path>   # OURS（当前分支）"
  echo "  git show :3:<path>   # THEIRS（main 上的改动）"
  exit 1
fi
echo -e "${GREEN}✓ rebase origin/main 成功${NC}"
echo ""

# ── Step 2: Build ──

echo "── Step 2/4: 全量 build ──"
if ! pnpm -r --if-present run build; then
  echo ""
  echo -e "${RED}❌ Build 失败${NC}"
  exit 1
fi
echo -e "${GREEN}✓ build 通过${NC}"
echo ""

# ── Step 3: Test（全量，不是 --filter） ──

echo "── Step 3/4: 全量测试 ──"
# 清除 REDIS_URL 以避免触发 Redis 隔离守卫。
# Worktree 的 .env.local 设置了 REDIS_URL=6398（用于开发），
# 但全量测试不应依赖 Redis——Redis 集成测试有专门的 test:redis 命令。
# 这与 CI 行为一致：CI 环境也不设 REDIS_URL。
if ! env -u REDIS_URL pnpm test; then
  echo ""
  echo -e "${RED}❌ 全量测试未通过${NC}"
  echo "   请修复失败的测试后重新执行 pnpm gate"
  exit 1
fi
echo -e "${GREEN}✓ 全量测试通过${NC}"
echo ""

# ── Step 4: Lint + Check ──

echo "── Step 4/4: lint + check ──"
if ! pnpm lint; then
  echo ""
  echo -e "${RED}❌ lint 失败${NC}"
  exit 1
fi
echo -e "${GREEN}✓ lint 通过${NC}"

if ! pnpm check; then
  echo ""
  echo -e "${RED}❌ check 失败${NC}"
  exit 1
fi
echo -e "${GREEN}✓ check 通过${NC}"
echo ""

# ── 报告 ──

FINAL_SHA="$(git rev-parse HEAD)"
SHORT_SHA="${FINAL_SHA:0:8}"

echo "╔══════════════════════════════════════════════════════╗"
echo "║                  ✅ GATE PASSED                     ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Branch : $BRANCH"
echo "║  SHA    : $SHORT_SHA"
echo "║  Base   : origin/main (rebased)"
echo "║  Tests  : all passed"
echo "║  Lint   : passed"
echo "║  Check  : passed"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "可以安全执行 merge-gate 的后续步骤了。"
