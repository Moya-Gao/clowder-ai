#!/bin/bash
# runtime-sanctuary-guard.sh — P0 Runtime 圣域保护
# Hook: PreToolUse (matcher: "Bash|Edit|Write")
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

# ask（不阻断，停一下让操作者确认）—— 用于无法字面拦截的启发式高危信号（模式 11）。
emit_ask() {
  local reason="$1"
  jq -n --arg r "$reason" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: $r
    }
  }'
}

RUNTIME_WORKTREE_PATH="/Users/lysander/projects/relay-station/cat-cafe-runtime"
# 47 review round 2 (CVO option A best-effort): 路径前缀展开变体 —— 字面 /Users/lysander、$HOME、
# ${HOME}、~ 都解析到同一主仓父路径。hook 看命令文本无法展开 $VAR，但能字面匹配这几个高频写法
# （变量拼接 `D=$HOME/..;rm $D`、$(...)、base64 等仍漏 = best-effort，主防线靠 trash 可恢复 + 软层）。
HOME_PREFIX='(/Users/lysander|\$HOME|\$\{HOME\}|~)'
RELAY_SUFFIX="/projects/relay-station"

# ═══════════════════════════════════════════════════════════════
# 模式 0：Edit/Write 直接修改 runtime worktree 内的文件
# 背景：CAFE-INCIDENT-20260601 — 宪宪用 Edit 工具直接改了 runtime worktree 里的
#       SessionChainPanel.tsx，然后 checkout -b + commit + push，把生产环境从
#       runtime/main-sync 切到了 feature 分支。防御第一刀应该在 Edit 层拦截。
# ═══════════════════════════════════════════════════════════════
if [ "$TOOL_NAME" = "Edit" ] || [ "$TOOL_NAME" = "Write" ]; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || echo "")
  # 精确：文件是 runtime worktree 本身或其内部（path 或 path/*），不误伤同前缀的更长目录
  # （如 cat-cafe-runtime-cwd-debug —— 后接 "-" 不是 "/"，放行）。
  if [[ "$FILE_PATH" == "$RUNTIME_WORKTREE_PATH" || "$FILE_PATH" == "$RUNTIME_WORKTREE_PATH"/* ]]; then
    emit_deny "⛔ P0 RUNTIME 圣域保护：禁止直接修改 runtime worktree 内的文件（${FILE_PATH}）！cat-cafe-runtime 是生产运行态目录，代码修改请在主仓 cat-cafe 开 worktree 做。铲屎官铁律：runtime 同步由铲屎官自己做（CAFE-INCIDENT-20260601）。"
    exit 0
  fi
  # Edit/Write 到非 runtime 路径，放行
  exit 0
fi

if [ "$TOOL_NAME" != "Bash" ]; then
  exit 0
fi

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# 空命令放行
if [ -z "$COMMAND" ]; then
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# 模式 0b：真实 CWD 在 runtime worktree 内时的 git 写操作
# 背景：CAFE-INCIDENT-20260601 — Bash 工具的 CWD 已在 cat-cafe-runtime
#       内时，git checkout -b / commit / push 的命令文本不含 cd 前缀，模式 4
#       (git -C) 无法匹配。读取 hook payload 的顶层 .cwd 字段（harness 注入
#       的 Bash 工具当前工作目录）进行判断。
# 注意：只读命令（status/log/diff/branch/remote）放行。
# ═══════════════════════════════════════════════════════════════
TOOL_CWD=$(echo "$INPUT" | jq -r '.cwd // ""' 2>/dev/null || echo "")
# 精确：CWD 是 runtime worktree 本身或其内部，不误伤 cat-cafe-runtime-cwd-debug 这类更长目录。
if [[ "$TOOL_CWD" == "$RUNTIME_WORKTREE_PATH" || "$TOOL_CWD" == "$RUNTIME_WORKTREE_PATH"/* ]] \
   && echo "$COMMAND" | grep -qiE 'git\s+(checkout|switch|commit|push|pull|add|reset|merge|rebase|cherry-pick|stash)\b'; then
  emit_deny "⛔ P0 RUNTIME 圣域保护：Bash 工具的 CWD 在 runtime worktree 内（${TOOL_CWD}），禁止执行 git 写操作！runtime worktree 是生产运行态，代码修改请在主仓 cat-cafe 开 worktree 做。铲屎官铁律：runtime 同步由铲屎官自己做（CAFE-INCIDENT-20260601）。"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# 模式 0c：命令文本中 cd 到 runtime + git 写操作（补充 0b，defense-in-depth）
# 即使 harness 未注入 .cwd 或 CWD 不在 runtime 内，命令本身 cd 过去也拦。
# ═══════════════════════════════════════════════════════════════
if echo "$COMMAND" | grep -qiE '(^cd\s+|&&\s*cd\s+)\S*cat-cafe-runtime(/|[[:space:]"'\'';&|()<>]|$)' \
   && echo "$COMMAND" | grep -qiE 'git\s+(checkout|switch|commit|push|pull|add|reset|merge|rebase|cherry-pick|stash)\b'; then
  emit_deny "⛔ P0 RUNTIME 圣域保护：禁止 cd 到 cat-cafe-runtime 后执行 git 写操作！runtime worktree 是生产运行态，代码修改请在主仓 cat-cafe 开 worktree 做。铲屎官铁律：runtime 同步由铲屎官自己做（CAFE-INCIDENT-20260601）。"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# 模式 1：删除 runtime/main-sync 分支
# 匹配：git branch -d/-D runtime/main-sync, git branch --delete runtime/main-sync
# 精确：分支名必须以 `runtime/` 为顶层命名空间（flag 紧后，允许一层引号）。
#       不误伤 fix/cat-cwd-runtime-fallback（runtime- 无斜杠），也不误伤 feat/runtime/foo
#       （runtime/ 在 feat 命名空间下、非顶层）。5+ 猫踩过 + gpt52 review P1。
# ═══════════════════════════════════════════════════════════════
if echo "$COMMAND" | grep -qiE 'git\s+branch\s+.*(-[dD]|--delete)\b[^&;|]*\s['\''"]?runtime/'; then
  emit_deny "⛔ P0 RUNTIME 圣域保护：禁止删除 runtime 相关分支！runtime/main-sync 是运行态 worktree 的工作分支，删除 = 所有猫掉线 + 线程全丢。铲屎官铁律：runtime 由铲屎官自己维护。"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# 模式 2：删除 runtime worktree
# 匹配：git worktree remove .../cat-cafe-runtime（精确目录，后接路径边界）
# 精确：cat-cafe-runtime 必须是完整路径组件（后接 / 引号 空格 或行尾），不误伤
#       cat-cafe-runtime-cwd-debug 这类更长的 feature worktree 名（后接 "-" 放行）。
# ═══════════════════════════════════════════════════════════════
if echo "$COMMAND" | grep -qiE 'git\s+worktree\s+remove\s+.*cat-cafe-runtime(/|[[:space:]"'\'';&|()<>]|$)'; then
  emit_deny "⛔ P0 RUNTIME 圣域保护：禁止删除 runtime worktree！cat-cafe-runtime 是生产运行态目录，删除 = 服务立即挂掉。铲屎官铁律：runtime 由铲屎官自己维护。"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# 模式 3：直接操作 runtime 目录（rm, trash, mv 等）
# 匹配：rm -rf .../cat-cafe-runtime（精确目录，后接路径边界，同模式 2）
# ═══════════════════════════════════════════════════════════════
if echo "$COMMAND" | grep -qiE '(rm\s+(-[rfRF]+\s+)?|trash\s+|mv\s+).*cat-cafe-runtime(/|[[:space:]"'\'';&|()<>]|$)'; then
  emit_deny "⛔ P0 RUNTIME 圣域保护：禁止删除/移动 cat-cafe-runtime 目录！这是生产运行态，操作后所有猫立即掉线。铲屎官铁律：runtime 由铲屎官自己维护。"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# 模式 4：在 runtime worktree 里做危险操作（checkout/reset/merge/rebase）
# 匹配：git -C ...runtime... (checkout|reset|merge|rebase|push)
# 注意：git -C runtime status/log/diff 等只读命令放行
# ═══════════════════════════════════════════════════════════════
if echo "$COMMAND" | grep -qiE 'git\s+(-C\s+\S*cat-cafe-runtime(/\S*)?['\''"]?\s+)(checkout|switch|reset|merge|rebase|push|pull)\b'; then
  emit_deny "⛔ P0 RUNTIME 圣域保护：禁止在 runtime worktree 里执行写操作（checkout/reset/merge/rebase/push/pull）！runtime 同步由铲屎官自己做。只读命令（status/log/diff）不受限。"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# 模式 5：checkout/switch 到 runtime 分支（在主仓库里）
# 匹配：runtime/ token 出现在 checkout/switch 的任一参数位（吃掉中间 flags）：
#   git checkout/switch runtime/main-sync
#   git switch --detach runtime/main-sync   （flag 在前）
#   git switch -c feat/x runtime/main-sync   （runtime/ 作为 start-point）
# 精确：runtime/ 必须是 token 起点（前面是空白/引号），不误伤 feat/runtime/foo。
#       [^&;|]* 限制不跨命令分隔，避免吃到后续命令里的 runtime/ 文案。gpt52 review 实锤。
# ═══════════════════════════════════════════════════════════════
if echo "$COMMAND" | grep -qiE 'git\s+(checkout|switch)\b[^&;|]*\s['\''"]?runtime/'; then
  emit_deny "⛔ P0 RUNTIME 圣域保护：禁止在主仓库 checkout/switch 到 runtime 分支！这会破坏 worktree 关系。如需查看 runtime 状态，请用 git -C ../cat-cafe-runtime status。"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# 模式 6：kill/pkill 可能杀掉 runtime 进程
# 匹配：kill/pkill 后跟 runtime 相关模式（保守匹配）
# ═══════════════════════════════════════════════════════════════
if echo "$COMMAND" | grep -qiE '(kill|pkill)\s+.*(-f\s+)?.*cat-cafe-runtime(/|[[:space:]"'\'';&|()<>]|$)'; then
  emit_deny "⛔ P0 RUNTIME 圣域保护：禁止杀死 runtime 相关进程！这会导致所有猫掉线。如果服务需要重启，请通知铲屎官。"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# 模式 7：lsof 端口查找 + kill（任意端口/范围，含裸冒号 :N 与 tcp:N 写法）
# 背景：`lsof -ti :50000-65535` / `lsof -ti tcp:6399` 返回任何 socket 端点（含
#       ESTABLISHED 对端口）落在端口/范围内的进程——6399 圣域 master 因与 runtime 的
#       ESTABLISHED 连接被命中，`ps | grep redis-server` 无法区分圣域 vs 临时实例 →
#       kill 误杀圣域（CAFE-INCIDENT-20260527）。单端口同理有非零命中风险，且已有安全
#       替代路径，故 lsof+kill 一律不作为清理路径（裸冒号/tcp: 两种写法都拦）。
# ═══════════════════════════════════════════════════════════════
if echo "$COMMAND" | grep -qiE 'lsof[^|;&]*:[0-9]' && echo "$COMMAND" | grep -qiE '\bkill\b'; then
  emit_deny "⛔ P0 圣域保护：禁止 'lsof ... :<端口/范围> | kill'（CAFE-INCIDENT-20260527 凶器）！lsof 端口查找会命中 ESTABLISHED 对端口落在端口/范围内的 6398/6399/6401 圣域 master，kill 误杀圣域；单端口同理有非零风险。安全清理：通用孤儿用 'pnpm process:cleanup'，stale isolated Redis 用 'pnpm test:api:redis'（registry 保护），定向清进程先只读 lsof 拿 PID 再 'kill <PID>'，清非圣域 Redis 用 'redis-cli -p <非圣域端口> shutdown'。"
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
# 模式 9：redis-cli shutdown —— 仅拦圣域端口或未显式指定端口（默认 6379 有歧义）。
# 放行显式非圣域端口（清 unmanaged orphan 的合法路径，如 redis-cli -p 65093 shutdown）。
# ═══════════════════════════════════════════════════════════════
if echo "$COMMAND" | grep -qiE 'redis-cli\b[^|;]*shutdown'; then
  if echo "$COMMAND" | grep -qiE 'redis-cli\b[^|;]*-p\s*(6398|6399|6401)\b' \
     || ! echo "$COMMAND" | grep -qiE 'redis-cli\b[^|;]*-p\s*[0-9]+'; then
    emit_deny "⛔ P0 圣域保护：redis-cli shutdown 指向圣域端口 6398/6399/6401 或未指定端口（默认 6379 有歧义）= 可能强杀圣域（无 graceful BGSAVE）。清非圣域 orphan 请显式指定端口：redis-cli -p <非圣域端口> shutdown。重启圣域请通知铲屎官。"
    exit 0
  fi
fi

# ═══════════════════════════════════════════════════════════════
# 模式 10：删除/移动主仓 cat-cafe 根 / relay-station 顶层 / relay-station 直接子级 glob（trash 事故 2026-06-16）
# 背景：宪宪(47) 的 `trash "$TMP"` 把整个主仓 move 到 .Trash。现有模式只护 cat-cafe-runtime，主仓本身零保护。
# 精确：只拦根目录本身（后接路径边界 / 行尾 / 可选斜杠行尾 / /.git），子目录删除（node_modules/dist/子 worktree）放行。
# bypass 加固 round 1（46 review）：`(rm|trash|mv)\s+[^&;|]*` 吃任意 flags（短/拆分/长/--）+ 前置多路径，
#       但 [^&;|]* 不跨命令分隔符（`rm /tmp && cd 主仓` 不误杀，区别于模式 3 的 .*）。-i 大小写不敏感。
# bypass 加固 round 2（47 review, CVO option A best-effort）：HOME_PREFIX 覆盖 /Users/lysander|$HOME|${HOME}|~
#       （P1-1/2 命中事故根因 $VAR 展开）；新增 glob 子句拦 relay-station/ 直接子级的 *? glob（P1-5 最灾难：
#       `cat-c*` 株连 runtime 圣域 + alpha），深层子目录 glob（cat-cafe/packages/*）仍放行。
# best-effort 残余（CVO 拍板接受）：find -delete / xargs rm / cd+相对路径 / 变量拼接 / perl·python·node
#       / base64 等无限变体 hook 不拦 —— 删除命令空间图灵完备不可穷举，主防线是 trash 可恢复 + 软层纪律。
# ═══════════════════════════════════════════════════════════════
if echo "$COMMAND" | grep -qiE "(rm|trash|mv)\s+[^&;|]*['\"]?${HOME_PREFIX}${RELAY_SUFFIX}/cat-cafe([[:space:]\"';&|()<>]|/?\$|/\.git)"; then
  emit_deny "⛔ P0 圣域保护：禁止删除/移动主仓根目录 cat-cafe！这是所有猫的开发主仓，trash/rm 整盘 = 全组工作现场丢失（2026-06-16 trash 事故）。删子目录（node_modules/dist）请写完整子路径。"
  exit 0
fi
if echo "$COMMAND" | grep -qiE "(rm|trash|mv)\s+[^&;|]*['\"]?${HOME_PREFIX}${RELAY_SUFFIX}([[:space:]\"';&|()<>]|/?\$)"; then
  emit_deny "⛔ P0 圣域保护：禁止删除/移动 relay-station 顶层目录！它包含主仓 + 所有 worktree + runtime，删除 = 灾难性数据丢失。"
  exit 0
fi
if echo "$COMMAND" | grep -qiE "(rm|trash|mv)\s+[^&;|]*['\"]?${HOME_PREFIX}${RELAY_SUFFIX}/[^/&;|[:space:]]*[*?][^/&;|[:space:]]*"; then
  emit_deny "⛔ P0 圣域保护：禁止用 glob（*?）删除 relay-station 直接子级！cat-c* 类 glob 会株连 cat-cafe 主仓 + cat-cafe-runtime 圣域 + alpha 等所有兄弟 worktree。删具体目录请写完整名，删子目录请用深层路径（cat-cafe/packages/*）。"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# 模式 11：长 chain 里用裸变量做危险删除（trash $VAR / rm -r $VAR）→ ask nudge
# 背景：trash 事故根因是 $TMP 在 12+ 步长 chain 里意外展开（$TMP 被清空 / cwd 漂移）。hook 拿到
#       未展开命令文本，看不到 $VAR 真值 → 无法字面拦截，只能启发式 nudge。
# 触发：危险删除接裸变量 + 长 chain（≥3 命令 = ≥2 个 && / || / ;）+ 无 /tmp|/var/folders 白名单守护。
#       把 feedback 脚本纪律「危险操作别塞长 chain、先 echo/白名单」hook 化。
# 危险删除定义：trash 接变量（trash 总是递归移动目录）；或 rm + recursive flag（-r/-R/--recursive）接变量。
#       非 recursive 的 rm $VAR 放行（删目录会报错、删空变量也报错，风险远低于 trash/rm -rf）。
# bypass 加固（46 review 2026-06-17）：`[^&;|]*` 吃 flags 和 -- (end-of-options)，覆盖
#       `rm -rf -- $X` / `rm --recursive $X`；sep 计数含 || ；trash/rm 大小写不敏感（-i）。
# 决策：ask（不 deny）—— 裸变量危险删除有大量合法场景（worktree cleanup），只停一下确认不阻断。
#       单条 trash "$VAR"（不在 chain）放行，避免高频误报。
# ═══════════════════════════════════════════════════════════════
if echo "$COMMAND" | grep -qiE '(trash\s+[^&;|]*|rm\s+[^&;|]*(-[a-zA-Z]*[rR]|--recursive)[^&;|]*)['\''"]?\$\{?[A-Za-z_]'; then
  sep_count=$(echo "$COMMAND" | grep -oE '&&|\|\||;' | wc -l | tr -d ' ' || true)
  if [ "${sep_count:-0}" -ge 2 ] \
     && ! echo "$COMMAND" | grep -qiE 'case\s|==\s*['\''"]?(/tmp/|/var/folders/)'; then
    emit_ask "⚠️ 确认：你在一条多步 chain 里用变量做危险删除（trash/rm -rf \$VAR）。这是 2026-06-16 trash 主仓事故的形态（\$TMP 意外展开）。请确认：① echo \$VAR 看过展开后的真实路径？② 危险删除最好单独一条命令、或加 /tmp 白名单（case \$X in /tmp/*)。确认无误可继续。"
    exit 0
  fi
fi

# 不匹配任何危险模式，放行
exit 0
