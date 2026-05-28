#!/bin/bash
# runtime-sanctuary-guard.sh — P0 Runtime 圣域保护
# Hook: PreToolUse (matcher: "Bash")
# 
# 硬拦截任何可能删除/破坏 runtime worktree 或 runtime/main-sync 分支的命令。
# 决策：deny（不是 ask），因为这是 P0 不可逆操作。
#
# 保护对象：
#   - runtime/main-sync 分支（runtime worktree 的工作分支）
#   - cat-cafe-runtime 目录（运行态 worktree）
#   - 任何对 runtime worktree 的直接修改操作
#
# 背景：
#   2026-02-22 宪宪擅自更新 runtime → Next.js 热重载断了所有猫的 streaming 连接
#   2026-03-14 砚砚 codex 差点把 runtime/main-sync 列进清理清单
#   铲屎官铁律：runtime 同步由铲屎官自己做，猫猫禁止直接操作
#
# 创建者：[金渐层/Opus-46🐾]

set -euo pipefail

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
if [ "$TOOL_NAME" != "Bash" ]; then
  exit 0
fi

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# 空命令放行
if [ -z "$COMMAND" ]; then
  exit 0
fi

emit_deny() {
  local reason="$1"
  jq -n --arg r "$reason" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $r
    }
  }'
}

# ═══════════════════════════════════════════════════════════════
# 模式 1：删除 runtime/main-sync 分支
# 匹配：git branch -d/-D runtime/main-sync, git branch --delete runtime/main-sync
# ═══════════════════════════════════════════════════════════════
if echo "$COMMAND" | grep -qiE 'git\s+branch\s+.*(-[dD]|--delete)\s+.*runtime'; then
  emit_deny "⛔ P0 RUNTIME 圣域保护：禁止删除 runtime 相关分支！runtime/main-sync 是运行态 worktree 的工作分支，删除 = 所有猫掉线 + 线程全丢。铲屎官铁律：runtime 由铲屎官自己维护。"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# 模式 2：删除 runtime worktree
# 匹配：git worktree remove ...runtime..., git worktree prune（可能误杀）
# ═══════════════════════════════════════════════════════════════
if echo "$COMMAND" | grep -qiE 'git\s+worktree\s+remove\s+.*runtime'; then
  emit_deny "⛔ P0 RUNTIME 圣域保护：禁止删除 runtime worktree！cat-cafe-runtime 是生产运行态目录，删除 = 服务立即挂掉。铲屎官铁律：runtime 由铲屎官自己维护。"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# 模式 3：直接操作 runtime 目录（rm, trash, mv 等）
# 匹配：rm -rf ...runtime..., trash ...runtime..., mv ...runtime...
# ═══════════════════════════════════════════════════════════════
if echo "$COMMAND" | grep -qiE '(rm\s+(-[rfRF]+\s+)?|trash\s+|mv\s+).*cat-cafe-runtime'; then
  emit_deny "⛔ P0 RUNTIME 圣域保护：禁止删除/移动 cat-cafe-runtime 目录！这是生产运行态，操作后所有猫立即掉线。铲屎官铁律：runtime 由铲屎官自己维护。"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# 模式 4：在 runtime worktree 里做危险操作（checkout/reset/merge/rebase）
# 匹配：git -C ...runtime... (checkout|reset|merge|rebase|push)
# 注意：git -C runtime status/log/diff 等只读命令放行
# ═══════════════════════════════════════════════════════════════
if echo "$COMMAND" | grep -qiE 'git\s+(-C\s+\S*runtime\S*\s+)(checkout|reset|merge|rebase|push|pull)\b'; then
  emit_deny "⛔ P0 RUNTIME 圣域保护：禁止在 runtime worktree 里执行写操作（checkout/reset/merge/rebase/push/pull）！runtime 同步由铲屎官自己做。只读命令（status/log/diff）不受限。"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# 模式 5：直接 checkout 到 runtime 分支（在主仓库里）
# 匹配：git checkout runtime/main-sync
# ═══════════════════════════════════════════════════════════════
if echo "$COMMAND" | grep -qiE 'git\s+checkout\s+runtime'; then
  emit_deny "⛔ P0 RUNTIME 圣域保护：禁止在主仓库 checkout 到 runtime 分支！这会破坏 worktree 关系。如需查看 runtime 状态，请用 git -C ../cat-cafe-runtime status。"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# 模式 6：kill/pkill 可能杀掉 runtime 进程
# 匹配：kill/pkill 后跟 runtime 相关模式（保守匹配）
# ═══════════════════════════════════════════════════════════════
if echo "$COMMAND" | grep -qiE '(kill|pkill)\s+.*(-f\s+)?.*cat-cafe-runtime'; then
  emit_deny "⛔ P0 RUNTIME 圣域保护：禁止杀死 runtime 相关进程！这会导致所有猫掉线。如果服务需要重启，请通知铲屎官。"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# 模式 7：lsof 端口范围 + kill 批量清理（CAFE-INCIDENT-20260527 凶器）
# 背景：`lsof -ti tcp:50000-65535` 返回任何 socket 端点（含 ESTABLISHED 对端口）
#       落在该范围内的进程——6399 圣域 master 因与 runtime 的 ESTABLISHED 连接被命中，
#       `ps | grep redis-server` 无法区分圣域 vs 临时实例 → kill -9 误杀圣域。
# ═══════════════════════════════════════════════════════════════
if echo "$COMMAND" | grep -qiE 'lsof[^|;&]*tcp:[0-9]+-[0-9]+' && echo "$COMMAND" | grep -qiE '\bkill\b'; then
  emit_deny "⛔ P0 圣域保护：禁止 'lsof -ti tcp:<范围> | kill' 批量清理（CAFE-INCIDENT-20260527 凶器）！lsof 端口范围会命中 ESTABLISHED 对端口落在范围内的 6398/6399/6401 圣域 master，kill 误杀圣域。清理 stale isolated Redis 用 'pnpm test:api:redis'（registry 化、保护 6398/6399），通用孤儿进程用 'pnpm process:cleanup'。"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# 模式 8：按进程名批量杀 redis（pkill/killall redis、kill ... redis-server）
# 背景：进程名层面无法区分 sanctuary master vs ephemeral test instance。
# ═══════════════════════════════════════════════════════════════
if echo "$COMMAND" | grep -qiE '(pkill|killall)\b[^|;]*redis' \
   || { echo "$COMMAND" | grep -qiE 'redis-server' && echo "$COMMAND" | grep -qiE '\bkill\b'; }; then
  emit_deny "⛔ P0 圣域保护：禁止按进程名批量杀 redis！进程名无法区分 6398/6399/6401 圣域 master vs 临时测试实例，会误杀圣域用户数据（LL-048 用户数据持久化）。清理用 'pnpm test:api:redis'（registry 保护）或 'pnpm process:cleanup'。"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# 模式 9：对圣域端口 6398/6399/6401 执行 lsof+kill 或 redis-cli shutdown
# 注意：只读诊断（lsof/redis-cli ping 不带 kill/shutdown）放行。
# ═══════════════════════════════════════════════════════════════
if { echo "$COMMAND" | grep -qiE 'lsof[^|;&]*:(6398|6399|6401)\b' && echo "$COMMAND" | grep -qiE '\bkill\b'; } \
   || echo "$COMMAND" | grep -qiE 'redis-cli\b[^|;]*shutdown'; then
  emit_deny "⛔ P0 圣域保护：禁止对圣域端口 6398/6399/6401 执行 lsof+kill 或 redis-cli shutdown！6399=runtime 圣域 / 6398=worktree dev / 6401=用户数据持久化，强杀 = 所有猫掉线 + 用户数据无 graceful BGSAVE。重启请通知铲屎官。只读诊断（lsof/ping 不带 kill）不受限。"
  exit 0
fi

# 不匹配任何危险模式，放行
exit 0
