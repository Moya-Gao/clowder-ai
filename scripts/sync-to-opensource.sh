#!/usr/bin/env bash
# sync-to-opensource.sh — Cat Café → Clowder AI 开源同步脚本
# 七步管道 (D1-D5 hardening):
#   Step 0: Pre-sync gate (dirty check + inbound detection)
#   Step 1: Clean tree export
#   Step 2: Allowlist filter
#   Step 3: Transforms (sanitize + generate)
#   Step 4: Security scan (denylist + secrets + /Users/ + internal patterns + endpoints)
#   Step 5: Sync (target-owned backup → diff preview → rsync → restore)
#   Step 6: Post-sync validation (install + static gates + build + acceptance)
#
# Usage:
#   bash scripts/sync-to-opensource.sh                    # 完整同步（含 post-sync 验证）
#   bash scripts/sync-to-opensource.sh --dry-run          # 只导出到临时目录，不同步
#   bash scripts/sync-to-opensource.sh --validate         # 导出 + static gates + install/build（不同步）
#   bash scripts/sync-to-opensource.sh --skip-validate    # 同步但跳过 post-sync 验证
#   bash scripts/sync-to-opensource.sh --fast-validate    # 同步 + static gates + install/build/test（跳过 full startup acceptance）
#   bash scripts/sync-to-opensource.sh --yes              # 非交互模式（猫猫/CI 用，跳过确认提示）
#   bash scripts/sync-to-opensource.sh --force-overwrite  # 强制覆盖未吸收的社区 commit（危险！）
#   bash scripts/sync-to-opensource.sh --module=docs      # 模块级同步（V1: Step 5/6 按模块，Step 1-4 仍全量）
#   bash scripts/sync-to-opensource.sh --module=api       # 模块级同步（同上）
#   bash scripts/sync-to-opensource.sh --cat-sig="[金渐层/Opus-46🐾]"  # 猫猫签名
#   bash scripts/sync-to-opensource.sh --co-author="Name <email>"      # 社区贡献者署名（可重复）
#   Modules: all root docs shared api web mcp skills
#   NOTE: V1 模块化仅影响 Step 5 rsync 和 Step 6 validate。
#         Step 1-4（export/transform/scan）始终全量执行。V2 再按模块裁剪。

set -euo pipefail

# ── Portable sed -i ──────────────────────────────────────────
# macOS sed requires -i '', GNU sed requires -i without argument.
if sed --version 2>/dev/null | grep -q GNU; then
  sedi() { sed -i "$@"; }
else
  sedi() { sed -i '' "$@"; }
fi

# ── 颜色 ──────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ── 进度日志（P0 可观测性）──────────────────────────────────
SYNC_START_TIME=$(date +%s)
STEP_START_TIME=$SYNC_START_TIME
step_start() {
  STEP_START_TIME=$(date +%s)
  echo ""
  echo -e "${GREEN}[$1] $2${NC}  [$(date +%H:%M:%S)]"
}
step_done() {
  local elapsed=$(( $(date +%s) - STEP_START_TIME ))
  echo -e "  ${BLUE}⏱ ${elapsed}s${NC}"
}

run_static_quality_gates() {
  local autofix="${1:-false}"

  if [ "$autofix" = true ]; then
    echo "  Biome autofix (best effort)..."
    if ! pnpm check:fix 2>&1 | tail -5; then
      echo -e "  ${RED}✗ pnpm check:fix failed${NC}"
      return 1
    fi
  fi

  echo "  Biome check..."
  if ! pnpm check 2>&1 | tail -5; then
    echo -e "  ${RED}✗ pnpm check failed${NC}"
    return 1
  fi

  echo "  TypeScript lint..."
  if ! pnpm lint 2>&1 | tail -5; then
    echo -e "  ${RED}✗ pnpm lint failed${NC}"
    return 1
  fi
}

# ── 参数 ──────────────────────────────────────────────────────
DRY_RUN=false
VALIDATE=false
SKIP_VALIDATE=false
FAST_VALIDATE=false
AUTO_YES=false
FORCE_OVERWRITE=false
SYNC_MODULE="all"
CO_AUTHORS=()
CAT_SIG=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --validate) VALIDATE=true ;;
    --skip-validate) SKIP_VALIDATE=true ;;
    --fast-validate) FAST_VALIDATE=true ;;
    --yes|-y) AUTO_YES=true ;;
    --force-overwrite) FORCE_OVERWRITE=true ;;
    --module=*) SYNC_MODULE="${arg#--module=}" ;;
    --co-author=*) CO_AUTHORS+=("${arg#--co-author=}") ;;
    --cat-sig=*) CAT_SIG="${arg#--cat-sig=}" ;;
  esac
done

# ── 模块定义（P2 modular sync）──────────────────────────────
# Each module owns mutually exclusive roots → per-module rsync --delete is safe
# bash 3.2 compatible (no declare -A)
module_root() {
  case "$1" in
    root)   echo "" ;;
    docs)   echo "docs/" ;;
    shared) echo "packages/shared/" ;;
    api)    echo "packages/api/" ;;
    web)    echo "packages/web/" ;;
    mcp)    echo "packages/mcp-server/" ;;
    skills) echo "cat-cafe-skills/" ;;
    *)      echo "INVALID" ;;
  esac
}
VALID_MODULES="all root docs shared api web mcp skills"
if ! echo "$VALID_MODULES" | grep -qw "$SYNC_MODULE"; then
  echo -e "${RED}✗ Invalid module: $SYNC_MODULE${NC}"
  echo "  Valid modules: $VALID_MODULES"
  exit 1
fi

SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="${CLOWDER_AI_DIR:-$(cd "$SOURCE_DIR/.." && pwd)/clowder-ai}"

# ── 读 sync-manifest.yaml（SOT）─────────────────────────────
MANIFEST="$SOURCE_DIR/sync-manifest.yaml"
if [ ! -f "$MANIFEST" ]; then
  echo -e "${RED}✗ sync-manifest.yaml not found at $MANIFEST${NC}"
  exit 1
fi

# 轻量 YAML list 解析: 从 "key:" 下方读取 "  - value" 直到下个 key
yaml_list() {
  local key="$1"
  awk -v k="$key:" '
    BEGIN { found=0 }
    found && /^[^ #-]/ { exit }
    found && /^  - / {
      line = $0
      sub(/^  - /, "", line)
      sub(/#.*/, "", line)
      gsub(/^[[:space:]]+/, "", line)
      gsub(/[[:space:]]+$/, "", line)
      gsub(/"/, "", line)
      if (length(line) > 0) print line
      next
    }
    $0 ~ "^"k { found=1 }
  ' "$MANIFEST"
}

# 解析 manifest 列表到 bash 数组（bash 3.2 兼容）
MANAGED_ROOTS=()
while IFS= read -r line; do MANAGED_ROOTS+=("$line"); done < <(yaml_list "managed_roots")
MANAGED_FILES=()
while IFS= read -r line; do MANAGED_FILES+=("$line"); done < <(yaml_list "managed_files")
MANAGED_SCRIPTS=()
while IFS= read -r line; do MANAGED_SCRIPTS+=("$line"); done < <(yaml_list "managed_scripts")
EXCLUDED_ITEMS=()
while IFS= read -r line; do EXCLUDED_ITEMS+=("$line"); done < <(yaml_list "excluded")

echo -e "${GREEN}=== Cat Café → Clowder AI 开源同步 ===${NC}"
echo "源仓: $SOURCE_DIR"
echo "目标: $TARGET_DIR"
if [ "$DRY_RUN" = true ]; then echo "模式: DRY RUN"; fi
if [ "$VALIDATE" = true ]; then echo "模式: VALIDATE"; fi
if [ "$SYNC_MODULE" != "all" ]; then echo "模块: $SYNC_MODULE"; fi

cd "$SOURCE_DIR"
SOURCE_SHA=$(git rev-parse --short=12 HEAD)
# dry-run/validate 用工作目录导出，记录 dirty 状态
if [ "$DRY_RUN" = true ] || [ "$VALIDATE" = true ]; then
  if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    SOURCE_SHA="${SOURCE_SHA}+dirty"
  fi
  SOURCE_SHA="${SOURCE_SHA} (working-tree)"
fi
echo -e "\n${BLUE}源 commit: ${SOURCE_SHA}${NC}"

# ── Step 0: Pre-sync gate（D2a）────────────────────────────────
step_start "Step 0" "Pre-sync gate..."

# 0a: Source repo dirty check (real sync only — dry-run/validate allow dirty)
if [ "$DRY_RUN" = false ] && [ "$VALIDATE" = false ]; then
  if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    echo -e "  ${RED}✗ Source repo has uncommitted changes. Commit or stash first.${NC}"
    exit 1
  fi
  echo "  ✓ Source repo clean"
fi

# 0b: Target repo state check (skip for dry-run/validate)
if [ "$DRY_RUN" = false ] && [ "$VALIDATE" = false ] && [ -d "$TARGET_DIR/.git" ]; then
  cd "$TARGET_DIR"
  if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    echo -e "  ${RED}✗ Target repo has uncommitted changes: $TARGET_DIR${NC}"
    echo -e "  ${YELLOW}  Commit or discard target changes before syncing.${NC}"
    exit 1
  fi
  echo "  ✓ Target repo clean"

  # 0b-2: Open PR check — info only (open PRs in target don't block one-way sync)
  if command -v gh >/dev/null 2>&1; then
    OPEN_PRS=$(cd "$TARGET_DIR" && gh pr list --state open --limit 5 --json number,title 2>/dev/null || true)
    if [ -n "$OPEN_PRS" ] && [ "$OPEN_PRS" != "[]" ]; then
      PR_COUNT=$(echo "$OPEN_PRS" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8'));console.log(d.length)" 2>/dev/null || echo "?")
      echo -e "  ${YELLOW}ℹ Target has $PR_COUNT open PR(s) (info only, does not block sync):${NC}"
      echo "$OPEN_PRS" | node -e "JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')).forEach(p=>console.log('    #'+p.number+' '+p.title))" 2>/dev/null || true
    else
      echo "  ✓ No open PRs in target"
    fi
  fi
  cd "$SOURCE_DIR"
fi

# 0c: Intake ledger gate (D3 upgraded)
# Truth source: docs/ops/opensource-intake-ledger.json in cat-cafe (not target provenance)
# Gate: target HEAD must match ledger's last_reviewed_target_head, OR all commits
# between ledger HEAD and current target HEAD must be sync commits.
INTAKE_LEDGER="$SOURCE_DIR/docs/ops/opensource-intake-ledger.json"
if [ "$DRY_RUN" = false ] && [ "$VALIDATE" = false ] && [ -d "$TARGET_DIR/.git" ]; then
  if [ -f "$INTAKE_LEDGER" ]; then
    LEDGER_HEAD=$(node -e "const l=JSON.parse(require('fs').readFileSync('$INTAKE_LEDGER','utf-8')); console.log(l.last_reviewed_target_head || '')" 2>/dev/null || true)
    cd "$TARGET_DIR"
    CURRENT_TARGET_HEAD=$(git rev-parse HEAD 2>/dev/null || true)
    if [ -n "$LEDGER_HEAD" ] && [ -n "$CURRENT_TARGET_HEAD" ]; then
      if [ "$LEDGER_HEAD" = "$CURRENT_TARGET_HEAD" ]; then
        echo "  ✓ Intake ledger up to date (target HEAD = ledger HEAD)"
      else
        # Check commits between ledger HEAD and current target HEAD
        COMMITS_SINCE=$(git rev-list "$LEDGER_HEAD".."$CURRENT_TARGET_HEAD" 2>/dev/null || true)
        HAS_UNREVIEWED=false
        UNREVIEWED_COUNT=0
        UNREVIEWED_LIST=""
        for c in $COMMITS_SINCE; do
          MSG=$(git log --format=%s -1 "$c" 2>/dev/null || true)
          if ! echo "$MSG" | grep -q "^sync: cat-cafe"; then
            HAS_UNREVIEWED=true
            UNREVIEWED_COUNT=$((UNREVIEWED_COUNT + 1))
            SHORT_MSG=$(git log --format="%h %s" -1 "$c" 2>/dev/null || true)
            UNREVIEWED_LIST="${UNREVIEWED_LIST}    → ${SHORT_MSG}\n"
          fi
        done
        if [ "$HAS_UNREVIEWED" = true ]; then
          # Distinguish "not recorded at all" vs "recorded but ledger not advanced"
          RECORDED_SHAS=$(node -e "const l=JSON.parse(require('fs').readFileSync('$INTAKE_LEDGER','utf-8')); l.entries.filter(e=>e.target_merge_commit).forEach(e=>console.log(e.target_merge_commit))" 2>/dev/null || true)
          ALL_RECORDED=true
          for c in $COMMITS_SINCE; do
            MSG_CHK=$(git log --format=%s -1 "$c" 2>/dev/null || true)
            if echo "$MSG_CHK" | grep -q "^sync: cat-cafe"; then continue; fi
            if ! echo "$RECORDED_SHAS" | grep -q "^${c}$"; then
              ALL_RECORDED=false
              break
            fi
          done
          if [ "$ALL_RECORDED" = true ]; then
            echo -e "  ${YELLOW}⚠ BLOCKED: All community commits are recorded in ledger, but ledger water mark not advanced${NC}"
            echo -e "  ${YELLOW}  Fix: bash scripts/intake-from-opensource.sh --advance-ledger${NC}"
          else
            echo -e "  ${RED}✗ BLOCKED: $UNREVIEWED_COUNT unrecorded community commit(s) in target${NC}"
          fi
          echo -e "  ${YELLOW}  Ledger reviewed up to: ${LEDGER_HEAD:0:12}${NC}"
          echo -e "  ${YELLOW}  Current target HEAD:   ${CURRENT_TARGET_HEAD:0:12}${NC}"
          echo ""
          echo -e "  ${YELLOW}  Unreviewed commits:${NC}"
          echo -e "$UNREVIEWED_LIST"
          echo -e "  ${YELLOW}  These will be OVERWRITTEN by rsync --delete.${NC}"
          echo -e "  ${YELLOW}  To proceed safely:${NC}"
          echo -e "  ${YELLOW}    1. Run: bash scripts/intake-from-opensource.sh --pr <N> --mode=plan${NC}"
          echo -e "  ${YELLOW}    2. Review and absorb valuable changes${NC}"
          echo -e "  ${YELLOW}    3. Run: bash scripts/intake-from-opensource.sh --record --pr <N> --decision <D>${NC}"
          echo -e "  ${YELLOW}       (auto-advances ledger after last PR)${NC}"
          echo -e "  ${YELLOW}  To force (DANGEROUS — loses community work):${NC}"
          echo -e "  ${YELLOW}    --force-overwrite${NC}"
          echo ""
          if [ "$FORCE_OVERWRITE" = true ]; then
            echo -e "  ${RED}⚠ --force-overwrite: proceeding despite unreviewed inbound commits${NC}"
          else
            echo -e "  ${RED}Aborted. Use --force-overwrite to bypass (not recommended).${NC}"
            cd "$SOURCE_DIR"
            exit 1
          fi
        else
          # Only sync commits since ledger — safe to auto-advance ledger
          echo "  ✓ No unreviewed community commits (only sync commits since ledger)"
        fi
      fi
    fi
    cd "$SOURCE_DIR"
  elif [ -f "$TARGET_DIR/.sync-provenance.json" ]; then
    echo -e "  ${YELLOW}⚠ No intake ledger found — falling back to provenance warning${NC}"
    echo -e "  ${YELLOW}  Create docs/ops/opensource-intake-ledger.json to enable ledger gate${NC}"
  else
    echo -e "  ${YELLOW}⚠ No ledger or provenance — first sync${NC}"
  fi
fi

echo "  ✓ Pre-sync gate passed"
step_done

# ── Step 1: Clean tree 导出 ────────────────────────────────────
step_start "Step 1/6" "Clean tree 导出..."

STAGING_DIR=$(mktemp -d)
trap 'rm -rf "$STAGING_DIR"' EXIT

if [ "$DRY_RUN" = true ] || [ "$VALIDATE" = true ]; then
  # 工作目录导出（含未提交改动，用于验证）
  git ls-files | while IFS= read -r f; do
    mkdir -p "$STAGING_DIR/$(dirname "$f")"
    cp "$f" "$STAGING_DIR/$f" 2>/dev/null || true
  done
  echo "  已从工作目录导出到 staging: ${STAGING_DIR}"
else
  git archive HEAD | tar -x -C "$STAGING_DIR"
  echo "  已导出到 staging: ${STAGING_DIR}"
fi

step_done

# ── Step 2: Allowlist 过滤（只保留 manifest 中的路径）──────────
step_start "Step 2/6" "Allowlist 过滤..."

FILTERED_DIR=$(mktemp -d)
if [ "$DRY_RUN" = false ] && [ "$VALIDATE" = false ]; then
  trap 'rm -rf "$STAGING_DIR" "$FILTERED_DIR"' EXIT
fi

INCLUDED=0
EXCLUDED=0

# 2a: 复制 managed_roots（整包，从 manifest 读取）
for root in "${MANAGED_ROOTS[@]}"; do
  if [ -d "$STAGING_DIR/$root" ]; then
    mkdir -p "$FILTERED_DIR/$root"
    cp -R "$STAGING_DIR/$root/." "$FILTERED_DIR/$root/"
    count=$(find "$FILTERED_DIR/$root" -type f | wc -l | tr -d ' ')
    INCLUDED=$((INCLUDED + count))
    echo "  ✓ $root ($count files)"
  else
    echo -e "  ${YELLOW}⚠ $root 不存在，跳过${NC}"
  fi
done

# 2b: 排除 managed_roots 内的 excluded 文件和子目录（从 manifest 读取）
for excl in "${EXCLUDED_ITEMS[@]}"; do
  if [[ "$excl" == */ ]]; then
    # 目录级排除：删除 managed_roots 内匹配的子目录
    if [ -d "$FILTERED_DIR/$excl" ]; then
      count=$(find "$FILTERED_DIR/$excl" -type f 2>/dev/null | wc -l | tr -d ' ')
      rm -rf "$FILTERED_DIR/$excl"
      EXCLUDED=$((EXCLUDED + count))
      echo "  ✗ excluded dir: $excl ($count files)"
    fi
    continue
  fi
  # 处理 glob 通配符（*.pen, .env.*, story-export*.png 等）
  if [[ "$excl" == *'*'* || "$excl" == *'?'* ]]; then
    while IFS= read -r match; do
      rm "$match"
      EXCLUDED=$((EXCLUDED + 1))
    done < <(find "$FILTERED_DIR" -name "$(basename "$excl")" -type f 2>/dev/null)
  elif [ -f "$FILTERED_DIR/$excl" ]; then
    rm "$FILTERED_DIR/$excl"
    EXCLUDED=$((EXCLUDED + 1))
  fi
done

# 2c: 复制 managed_files（单文件，从 manifest 读取）
for f in "${MANAGED_FILES[@]}"; do
  if [ -f "$STAGING_DIR/$f" ]; then
    mkdir -p "$FILTERED_DIR/$(dirname "$f")"
    cp "$STAGING_DIR/$f" "$FILTERED_DIR/$f"
    INCLUDED=$((INCLUDED + 1))
    echo "  ✓ $f"
  fi
done

# 2d: 复制 managed_scripts（从 manifest 读取）
for f in "${MANAGED_SCRIPTS[@]}"; do
  mkdir -p "$FILTERED_DIR/$(dirname "$f")"
  if [ -f "$STAGING_DIR/$f" ]; then
    cp "$STAGING_DIR/$f" "$FILTERED_DIR/$f"
    INCLUDED=$((INCLUDED + 1))
    echo "  ✓ $f"
  fi
done

# 2e: docs/decisions/ allowlist（从 manifest 读取）
DECISIONS_ALLOWLIST=()
while IFS= read -r line; do DECISIONS_ALLOWLIST+=("$line"); done < <(yaml_list "docs_decisions_allowlist")
for f in "${DECISIONS_ALLOWLIST[@]}"; do
  if [ -f "$STAGING_DIR/$f" ]; then
    mkdir -p "$FILTERED_DIR/$(dirname "$f")"
    cp "$STAGING_DIR/$f" "$FILTERED_DIR/$f"
    INCLUDED=$((INCLUDED + 1))
    echo "  ✓ $f (ADR allowlist)"
  fi
done

# 2f: docs/features/ — 结构化公开导出（调用 export-public-feature-docs.mjs）
echo "  Exporting public feature docs..."
FEATURES_EXPORT_DIR="$FILTERED_DIR/docs/features"
mkdir -p "$FEATURES_EXPORT_DIR"
node "$SOURCE_DIR/scripts/export-public-feature-docs.mjs" \
  --features-dir "$STAGING_DIR/docs/features" \
  --output-dir "$FEATURES_EXPORT_DIR" \
  --min-tier yellow 2>&1 | while IFS= read -r line; do echo "    $line"; done
feat_count=$(find "$FEATURES_EXPORT_DIR" -name "F*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
INCLUDED=$((INCLUDED + feat_count))
echo "  ✓ docs/features/ ($feat_count public feature docs)"

if [ -f "$FILTERED_DIR/scripts/generate-feature-index.mjs" ]; then
  node "$FILTERED_DIR/scripts/generate-feature-index.mjs" \
    --features-dir "$FEATURES_EXPORT_DIR" \
    --output "$FEATURES_EXPORT_DIR/index.json" >/dev/null
  INCLUDED=$((INCLUDED + 1))
  echo "  ✓ docs/features/index.json (generated)"
fi

echo ""
echo "  导出: $INCLUDED files | 排除: $EXCLUDED files"
step_done

# ── Step 3: Transforms ─────────────────────────────────────────
step_start "Step 3/6" "Transforms..."

TRANSFORM_COUNT=0

# 3a: cat-config.json（从真实配置拷贝 + 脱敏 owner 段）
# 策略：保留完整猫阵（所有 breed + variant + 性格描述），只脱敏 owner 段
if [ -f "$STAGING_DIR/cat-config.json" ]; then
  node - "$STAGING_DIR/cat-config.json" "$FILTERED_DIR/cat-config.json" << 'CONFIG_TRANSFORM_EOF'
const config = JSON.parse(require("fs").readFileSync(process.argv[2], "utf-8"));
// 脱敏 owner
config.owner = {
  name: "Co-worker",
  aliases: ["共创伙伴"],
  mentionPatterns: ["@co-worker", "@owner"]
};
// 去掉 mentionPatterns 中铲屎官相关的 pattern
const blocked = ["@landy", "@l.s.", "@lysander", "@铲屎官"];
for (const breed of config.breeds || []) {
  if (Array.isArray(breed.mentionPatterns)) {
    breed.mentionPatterns = breed.mentionPatterns.filter(
      p => blocked.indexOf(p.toLowerCase()) === -1
    );
  }
  for (const v of breed.variants || []) {
    if (Array.isArray(v.mentionPatterns)) {
      v.mentionPatterns = v.mentionPatterns.filter(
        p => blocked.indexOf(p.toLowerCase()) === -1
      );
    }
  }
}
// roster evaluation 中脱敏铲屎官引用
for (const [, entry] of Object.entries(config.roster || {})) {
  if (entry.evaluation) {
    entry.evaluation = entry.evaluation
      /* 铲屎官: 猫圈通用梗，保留 */
      .replace(/Landy/g, "Owner")
      .replace(/lysander/g, "owner");
  }
}
// personality 中脱敏
for (const breed of config.breeds || []) {
  for (const v of breed.variants || []) {
    if (v.personality) {
      v.personality = v.personality
        /* 铲屎官: 猫圈通用梗，保留 */
        .replace(/Landy/g, "Owner");
    }
  }
}
require("fs").writeFileSync(process.argv[3], JSON.stringify(config, null, 2) + "\n");
CONFIG_TRANSFORM_EOF
else
  echo -e "  ${YELLOW}⚠ cat-config.json not found in staging, skipping${NC}"
fi
if command -v pnpm >/dev/null 2>&1; then
  pnpm biome format --write "$FILTERED_DIR/cat-config.json" >/dev/null 2>&1 || true
fi
echo "  ✓ cat-config.json (full roster, owner desecreted)"
TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))

# 3b: CLAUDE.md（通用版）
cat > "$FILTERED_DIR/CLAUDE.md" << 'CLAUDE_EOF'
# Clowder AI — Claude Agent Guide

## Identity
You are the Ragdoll cat (Claude), the lead architect and core developer of this Clowder AI instance.

## Safety Rules (Iron Laws)
1. **Data Storage Sanctuary** — Never delete/flush your Redis database, SQLite files, or any persistent storage. Use temporary instances for testing.
2. **Process Self-Preservation** — Never kill your parent process or modify your startup config in ways that prevent restart.
3. **Config Immutability** — Never modify `cat-config.json`, `.env`, or MCP config at runtime. Config changes require human action.
4. **Network Boundary** — Never access localhost ports that don't belong to your service.

## Development Flow
See `cat-cafe-skills/` for the full skill-based workflow:
- `feat-lifecycle` — Feature lifecycle management
- `tdd` — Test-driven development
- `quality-gate` — Pre-review self-check
- `request-review` — Cross-cat review requests
- `merge-gate` — Merge approval process

## Code Standards
- File size: 200 lines warning / 350 hard limit
- No `any` types
- Biome: `pnpm check` / `pnpm check:fix`
- Types: `pnpm lint`
CLAUDE_EOF
echo "  ✓ CLAUDE.md (generic)"
TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))

# 3c: AGENTS.md（通用版）
cat > "$FILTERED_DIR/AGENTS.md" << 'AGENTS_EOF'
# Clowder AI — OpenAI/Codex Agent Guide

## Identity
You are the Maine Coon cat (Codex/GPT), the code reviewer and security specialist of this Clowder AI instance.

## Safety Rules (Iron Laws)
1. **Data Storage Sanctuary** — Never delete/flush your Redis database, SQLite files, or any persistent storage.
2. **Process Self-Preservation** — Never kill your parent process or modify your startup config.
3. **Config Immutability** — Never modify runtime config files. Config changes require human action.
4. **Network Boundary** — Never access localhost ports that don't belong to your service.

## Your Role
- Code review with clear stance on every finding (no "fix or not, up to you")
- Security analysis and vulnerability detection
- Test coverage verification
- Cross-model review (you review Claude's code, Claude reviews yours)

## Review Protocol
- Same individual cannot review their own code
- Cross-family review preferred (Maine Coon reviews Ragdoll's code)
- Every finding must have a clear severity: P1 (blocking) / P2 (should fix) / P3 (nice to have)
AGENTS_EOF
echo "  ✓ AGENTS.md (generic)"
TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))

# 3d: GEMINI.md（通用版）
cat > "$FILTERED_DIR/GEMINI.md" << 'GEMINI_EOF'
# Clowder AI — Gemini Agent Guide

## Identity
You are the Siamese cat (Gemini), the visual designer and creative thinker of this Clowder AI instance.

## Safety Rules (Iron Laws)
1. **Data Storage Sanctuary** — Never delete/flush persistent storage.
2. **Process Self-Preservation** — Never kill your parent process.
3. **Config Immutability** — Never modify runtime config files.
4. **Network Boundary** — Never access ports that don't belong to your service.

## Your Role
- Visual design and UX consultation
- Creative ideation and brainstorming
- Design system maintenance
- Breaking conventional thinking patterns

## Important Constraints
- Focus on design consultation, not code implementation
- Always validate suggestions against the project's design system
- Provide visual references when suggesting changes
GEMINI_EOF
echo "  ✓ GEMINI.md (generic)"
TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))

# 3e: LICENSE（MIT）
YEAR=$(date +%Y)
cat > "$FILTERED_DIR/LICENSE" << LICENSE_EOF
MIT License

Copyright (c) $YEAR Clowder AI Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
LICENSE_EOF
echo "  ✓ LICENSE (MIT)"
TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))

# 3f-3h: (merged into 3-UNIFIED comprehensive sanitizer below)

# 3i: README.md — 复制开源版替换内部版
if [ -f "$STAGING_DIR/README.opensource.md" ]; then
  cp "$STAGING_DIR/README.opensource.md" "$FILTERED_DIR/README.md"
  echo "  ✓ README.md (opensource version, $(wc -l < "$STAGING_DIR/README.opensource.md") lines)"
  TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
fi

# 3i-2: CONTRIBUTING.md — 复制开源版替换内部版
if [ -f "$STAGING_DIR/CONTRIBUTING.opensource.md" ]; then
  cp "$STAGING_DIR/CONTRIBUTING.opensource.md" "$FILTERED_DIR/CONTRIBUTING.md"
  echo "  ✓ CONTRIBUTING.md (opensource version, $(wc -l < "$STAGING_DIR/CONTRIBUTING.opensource.md") lines)"
  TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
fi

# 3i-3: SETUP.md — 复制开源版替换内部版
if [ -f "$STAGING_DIR/SETUP.opensource.md" ]; then
  cp "$STAGING_DIR/SETUP.opensource.md" "$FILTERED_DIR/SETUP.md"
  echo "  ✓ SETUP.md (opensource version, $(wc -l < "$STAGING_DIR/SETUP.opensource.md") lines)"
  TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
fi

# 3i-4: CLA.md + TRADEMARKS.md — 开源社区治理文件
for gov_file in CLA.md TRADEMARKS.md; do
  if [ -f "$STAGING_DIR/$gov_file" ]; then
    cp "$STAGING_DIR/$gov_file" "$FILTERED_DIR/$gov_file"
    echo "  ✓ $gov_file (community governance)"
    TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
  fi
done

# 3j: .github/pull_request_template.md — 复制开源版替换内部版
if [ -f "$STAGING_DIR/.github/pull_request_template.opensource.md" ]; then
  mkdir -p "$FILTERED_DIR/.github"
  cp "$STAGING_DIR/.github/pull_request_template.opensource.md" "$FILTERED_DIR/.github/pull_request_template.md"
  echo "  ✓ .github/pull_request_template.md (opensource version)"
  TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
fi

# 3j-2: .env.example — 复制开源版环境变量模板
if [ -f "$STAGING_DIR/.env.example.opensource" ]; then
  cp "$STAGING_DIR/.env.example.opensource" "$FILTERED_DIR/.env.example"
  echo "  ✓ .env.example (opensource version, $(wc -l < "$STAGING_DIR/.env.example.opensource") lines)"
  TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
fi

# 3k-0: Source code personal info sanitization
# leaderboard-service.ts — hardcoded author map
if [ -f "$FILTERED_DIR/packages/api/src/domains/leaderboard/leaderboard-service.ts" ]; then
  sedi \
    -e "s/'lysander@suces-MacBook-Pro.local'/'owner@localhost'/g" \
    -e "s/'773678591@qq.com'/'owner@example.com'/g" \
    "$FILTERED_DIR/packages/api/src/domains/leaderboard/leaderboard-service.ts"
  echo "  ✓ leaderboard-service.ts (personal info sanitized)"
  TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
fi
# mention-highlight.ts — owner mention aliases
if [ -f "$FILTERED_DIR/packages/web/src/lib/mention-highlight.ts" ]; then
  sedi \
    -e "s/'landy', 'l.s.', 'lysander', '铲屎官'/'owner', 'admin'/g" \
    "$FILTERED_DIR/packages/web/src/lib/mention-highlight.ts"
  echo "  ✓ mention-highlight.ts (owner mentions sanitized)"
  TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
fi

# 3k-1: (merged into 3-UNIFIED comprehensive sanitizer below)

# 3k-2: P1-4 — Hindsight default off in public version
if [ -f "$FILTERED_DIR/packages/api/src/config/ConfigRegistry.ts" ]; then
  sedi \
    -e "s/parseBoolean(env\['HINDSIGHT_ENABLED'\], true)/parseBoolean(env['HINDSIGHT_ENABLED'], false)/g" \
    "$FILTERED_DIR/packages/api/src/config/ConfigRegistry.ts"
  echo "  ✓ ConfigRegistry.ts (Hindsight default=false)"
  TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
fi
if [ -f "$FILTERED_DIR/packages/api/src/config/env-registry.ts" ]; then
  sedi \
    -e "s/{ name: 'HINDSIGHT_ENABLED', defaultValue: 'true'/{ name: 'HINDSIGHT_ENABLED', defaultValue: 'false'/g" \
    "$FILTERED_DIR/packages/api/src/config/env-registry.ts"
  echo "  ✓ env-registry.ts (Hindsight default=false)"
  TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
fi

# 3k-3: P1-2 — start-dev.sh: public API/frontend ports + proxy guard
if [ -f "$FILTERED_DIR/scripts/start-dev.sh" ]; then
  sedi \
    -e 's/API_PORT=${API_SERVER_PORT:-3002}/API_PORT=${API_SERVER_PORT:-3004}/g' \
    -e 's/WEB_PORT=${FRONTEND_PORT:-3001}/WEB_PORT=${FRONTEND_PORT:-3003}/g' \
    -e 's/kill_port ${ANTHROPIC_PROXY_PORT:-9877} "Proxy"/[ "${ANTHROPIC_PROXY_ENABLED:-1}" != "0" ] \&\& kill_port ${ANTHROPIC_PROXY_PORT:-9877} "Proxy"/g' \
    "$FILTERED_DIR/scripts/start-dev.sh"
  echo "  ✓ start-dev.sh (public ports + proxy kill guarded)"
  TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
fi

# 3k-3a2: setup.sh — generated .env uses home ports; transform to open-source defaults
if [ -f "$FILTERED_DIR/scripts/setup.sh" ]; then
  sedi \
    -e 's/FRONTEND_PORT=3001/FRONTEND_PORT=3003/g' \
    -e 's/API_SERVER_PORT=3002/API_SERVER_PORT=3004/g' \
    -e 's#NEXT_PUBLIC_API_URL=http://localhost:3002#NEXT_PUBLIC_API_URL=http://localhost:3004#g' \
    -e 's#Open http://localhost:3001#Open http://localhost:3003#g' \
    -e 's#打开 http://localhost:3001#打开 http://localhost:3003#g' \
    "$FILTERED_DIR/scripts/setup.sh"
  echo "  ✓ setup.sh (public ports: Frontend=3003, API=3004)"
  TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
fi

# 3k-3a3: runtime-worktree.sh — API port default 3002→3004
if [ -f "$FILTERED_DIR/scripts/runtime-worktree.sh" ]; then
  sedi \
    -e 's/API_SERVER_PORT:-3002/API_SERVER_PORT:-3004/g' \
    "$FILTERED_DIR/scripts/runtime-worktree.sh"
  echo "  ✓ runtime-worktree.sh (API port 3004)"
  TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
fi

# 3k-3a4: AgentRouter.ts — API port fallback 3002→3004
if [ -f "$FILTERED_DIR/packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts" ]; then
  sedi \
    -e "s/process.env.API_SERVER_PORT ?? '3002'/process.env.API_SERVER_PORT ?? '3004'/g" \
    "$FILTERED_DIR/packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts"
  echo "  ✓ AgentRouter.ts (API port 3004)"
  TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
fi

# 3k-3b: Public default ports — exported repo should avoid runtime defaults 3001/3002
if [ -f "$FILTERED_DIR/packages/api/src/config/ConfigRegistry.ts" ]; then
  sedi \
    -e "s/const port = parseInt(env.API_SERVER_PORT ?? '3002', 10);/const port = parseInt(env.API_SERVER_PORT ?? '3004', 10);/g" \
    "$FILTERED_DIR/packages/api/src/config/ConfigRegistry.ts"
fi
if [ -f "$FILTERED_DIR/packages/api/src/index.ts" ]; then
  sedi \
    -e "s/const PORT = parseInt(process.env.API_SERVER_PORT ?? '3002', 10);/const PORT = parseInt(process.env.API_SERVER_PORT ?? '3004', 10);/g" \
    "$FILTERED_DIR/packages/api/src/index.ts"
fi
if [ -f "$FILTERED_DIR/packages/api/src/config/env-registry.ts" ]; then
  sedi \
    -e "s/{ name: 'API_SERVER_PORT', defaultValue: '3002'/{ name: 'API_SERVER_PORT', defaultValue: '3004'/g" \
    -e "s/defaultValue: '3000',/defaultValue: '3003',/g" \
    -e "s/defaultValue: 'http:\/\/localhost:3002'/defaultValue: 'http:\/\/localhost:3004'/g" \
    "$FILTERED_DIR/packages/api/src/config/env-registry.ts"
fi
if [ -f "$FILTERED_DIR/packages/api/src/config/frontend-origin.ts" ]; then
  sedi \
    -e "s#const DEFAULT_FRONTEND_BASE_URL = 'http://localhost:3001';#const DEFAULT_FRONTEND_BASE_URL = 'http://localhost:3003';#g" \
    -e "s#const DEFAULT_CORS_ORIGINS = \\['http://localhost:3000', 'http://localhost:3001', 'https://cafe.clowder-ai.com'\\];#const DEFAULT_CORS_ORIGINS = ['http://localhost:3000', 'http://localhost:3003', 'https://cafe.clowder-ai.com'];#g" \
    -e "s/fallback to localhost:3001/fallback to localhost:3003/g" \
    "$FILTERED_DIR/packages/api/src/config/frontend-origin.ts"
fi
if [ -f "$FILTERED_DIR/packages/api/src/config/governance/governance-pack.ts" ]; then
  sedi \
    -e "s/- \\*\\*Port 3001\\*\\* is reserved for Cat Cafe frontend. Use 3002+ for other dev servers./- **Public local defaults**: use frontend 3003 and API 3004 to avoid colliding with another local runtime./g" \
    "$FILTERED_DIR/packages/api/src/config/governance/governance-pack.ts"
fi
echo "  ✓ public default ports (Frontend=3003, API=3004) applied"
TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))

# 3k-4 through 3p: (merged into 3-UNIFIED comprehensive sanitizer below)

# 3k-5: Logo file rename — cat-cafe-logo-* → clowder-ai-logo-*
# Source repo keeps internal names; open-source repo gets brand-consistent names.
# See docs/design/naming-contract.md §2 "Logo 文件" row.
for logo_src in "$FILTERED_DIR"/assets/icons/cat-cafe-logo-*; do
  [ -f "$logo_src" ] || continue
  logo_base=$(basename "$logo_src")
  logo_dst=$(echo "$logo_base" | sed 's/^cat-cafe-logo/clowder-ai-logo/')
  mv "$logo_src" "$(dirname "$logo_src")/$logo_dst"
  echo "  ✓ Logo rename: $logo_base → $logo_dst"
  TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
done
# Also fix README.md logo reference if present
if [ -f "$FILTERED_DIR/README.md" ]; then
  sedi \
    -e 's/cat-cafe-logo-v2-clean\.svg/clowder-ai-logo-v2-clean.svg/g' \
    -e 's/cat-cafe-logo-lineart-stroke\.svg/clowder-ai-logo-lineart-stroke.svg/g' \
    -e 's/cat-cafe-logo-lineart\.svg/clowder-ai-logo-lineart.svg/g' \
    "$FILTERED_DIR/README.md"
fi

# 3m: docs/ROADMAP.md — 从 BACKLOG 生成公开版（copy + title rename only; sanitization by 3-UNIFIED）
if [ -f "$STAGING_DIR/docs/BACKLOG.md" ]; then
  mkdir -p "$FILTERED_DIR/docs"
  cp "$STAGING_DIR/docs/BACKLOG.md" "$FILTERED_DIR/docs/ROADMAP.md"
  sedi -e 's/# BACKLOG/# Roadmap/' "$FILTERED_DIR/docs/ROADMAP.md"
  echo "  ✓ docs/ROADMAP.md (generated from BACKLOG)"
  TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
fi

# 3n: docs/public-lessons.md — 从 lessons-learned 生成公开版（copy only; sanitization by 3-UNIFIED）
if [ -f "$STAGING_DIR/docs/lessons-learned.md" ]; then
  mkdir -p "$FILTERED_DIR/docs"
  cp "$STAGING_DIR/docs/lessons-learned.md" "$FILTERED_DIR/docs/public-lessons.md"
  echo "  ✓ docs/public-lessons.md (generated from lessons-learned)"
  TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
fi

# 3o: docs/README.md — 开源版文档导航
mkdir -p "$FILTERED_DIR/docs"
cat > "$FILTERED_DIR/docs/README.md" << 'DOCS_README_EOF'
# Clowder AI Documentation

## Overview
- [Vision](./VISION.md) — Project vision and philosophy
- [Roadmap](./ROADMAP.md) — Feature roadmap and priorities
- [SOP](./SOP.md) — Standard operating procedures for AI team collaboration
- [Design System](./design-system.md) — UI/UX design system
- [Lessons Learned](./public-lessons.md) — Team learnings and best practices

## Feature Specs
See [features/](./features/) for individual feature specifications.

## Architecture Decisions
See [decisions/](./decisions/) for Architecture Decision Records (ADRs).

## Architecture
See [architecture/](./architecture/) for system architecture documentation.
DOCS_README_EOF
echo "  ✓ docs/README.md (generated)"
TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))

# ── 3-UNIFIED: Comprehensive single-pass sanitizer ──────────────
# Replaces 10+ separate find|while|sed/perl loops (3f, 3g, 3h, 3k-1, 3k-4, 3k, 3l, 3o-1, 3o-2, 3p)
# with ONE find + ONE perl pass over all text files. Conditional logic via $ARGV.
# Written to temp file to avoid shell quoting issues with perl regex.
echo "  Comprehensive sanitization (single-pass)..."
# Sanitizer rules extracted to _sanitize-rules.pl (shared with sync-hotfix.sh)
SANITIZER="$SOURCE_DIR/scripts/_sanitize-rules.pl"
if [ ! -f "$SANITIZER" ]; then
  echo -e "${RED}✗ _sanitize-rules.pl not found at $SANITIZER${NC}"
  exit 1
fi
find "$FILTERED_DIR" \( -name "*.md" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.json" -o -name "*.yaml" -o -name "*.yml" -o -name "*.sh" \) -type f -print0 | \
  xargs -0 perl -pi "$SANITIZER"
echo "  ✓ Comprehensive sanitization complete (single-pass)"
TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))

# 3-POST: Re-format sanitized files with biome (sanitize may break formatting)
echo "  Post-sanitize biome format..."
if command -v pnpm >/dev/null 2>&1 && [ -f "$FILTERED_DIR/biome.json" ]; then
  (cd "$FILTERED_DIR" && pnpm biome format --write . >/dev/null 2>&1) || true
  echo "  ✓ Post-sanitize biome format complete"
else
  echo "  ⚠ biome not available, skipping post-sanitize format"
fi

echo ""
echo "  Transforms: $TRANSFORM_COUNT"
step_done

# ── Step 4: Denylist / Secret scan ────────────────────────────
step_start "Step 4/6" "Security scan..."

SCAN_FAILED=false

# 4a: Denylist filename patterns (from manifest SOT)
DENYLIST_PATTERNS=()
while IFS= read -r line; do DENYLIST_PATTERNS+=("$line"); done < <(yaml_list "denylist_patterns")
if [ ${#DENYLIST_PATTERNS[@]} -eq 0 ]; then
  echo -e "  ${RED}✗ No denylist_patterns found in manifest${NC}"
  exit 1
fi
for pattern in "${DENYLIST_PATTERNS[@]}"; do
  while IFS= read -r match; do
    # .env.example is a template with no secrets — allow it
    [[ "$(basename "$match")" == ".env.example" ]] && continue
    echo -e "  ${RED}✗ Forbidden file: $match${NC}"
    SCAN_FAILED=true
  done < <(find "$FILTERED_DIR" -name "$pattern" -type f 2>/dev/null)
done

# 4b: Sensitive content scan — merged into fewer grep passes for performance
SCAN_WARNINGS=0
SCAN_INCLUDES='--include=*.ts --include=*.tsx --include=*.js --include=*.json --include=*.md --include=*.yaml --include=*.yml --include=*.sh'

# 4b-BLOCK: Single grep pass for all blocking patterns (API keys + personal info + /Users/)
# Combines old 4b-1, 4b-2, lysander check, and 4c into one pass
# Uses grep -E (POSIX ERE) instead of grep -P — BSD grep on macOS does not support -P
echo "  Scanning for secrets + personal info (single pass)..."
BLOCK_RESULTS=$(grep -rEn 'sk-ant-|sk-proj-|sk-live-|gsk_|AIzaSy|suces-MacBook|/Users/[A-Za-z0-9]' "$FILTERED_DIR" \
  $SCAN_INCLUDES 2>/dev/null \
  | grep -v 'node_modules' | grep -v '/home/user' | grep -v '/path/to/project' \
  || true)
# Filter out test files for API key patterns, report the rest
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  file="${line%%:*}"
  # Test files may use fake keys — skip for key patterns
  if echo "$line" | grep -qE 'sk-ant-|sk-proj-|sk-live-|gsk_|AIzaSy'; then
    echo "$file" | grep -qE '/test/|/__tests__/|\.test\.' && continue
  fi
  echo -e "  ${RED}✗ Blocked content: ${line:0:120}${NC}"
  SCAN_FAILED=true
done <<< "$BLOCK_RESULTS"
# Separate lysander check (excludes test files)
found=$(grep -rl "lysander" "$FILTERED_DIR" $SCAN_INCLUDES 2>/dev/null \
  | grep -v '/test/' | grep -v '/__tests__/' | grep -v '.test.' | head -5 || true)
if [ -n "$found" ]; then
  echo -e "  ${RED}✗ Found 'lysander' in source code:${NC}"
  echo "$found" | while read f; do echo "    $f"; done
  SCAN_FAILED=true
fi

# 4b-WARN: Env var references — warning only (single grep)
echo "  Scanning for env var references..."
found=$(grep -rl 'ANTHROPIC_API_KEY\|OPENAI_API_KEY\|GOOGLE_API_KEY' "$FILTERED_DIR" \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.sh' 2>/dev/null | head -10 || true)
if [ -n "$found" ]; then
  echo -e "  ${YELLOW}⚠ Env var references (normal — code reads env vars):${NC}"
  echo "$found" | while read f; do echo "    $f"; done
  SCAN_WARNINGS=$((SCAN_WARNINGS + 1))
fi

# 4d: Internal path patterns scan (from manifest SOT)
echo "  Scanning for internal path references..."
INTERNAL_PATTERNS=()
while IFS= read -r line; do INTERNAL_PATTERNS+=("$line"); done < <(yaml_list "internal_path_patterns")
# Build combined regex for single grep pass
INTERNAL_REGEX=$(IFS='|'; echo "${INTERNAL_PATTERNS[*]}")
if [ -n "$INTERNAL_REGEX" ]; then
  found=$(grep -rn "$INTERNAL_REGEX" "$FILTERED_DIR" $SCAN_INCLUDES 2>/dev/null \
    | grep -v '.sync-provenance.json' \
    | grep -v '.export-summary.json' \
    | grep -v 'review-notes/' \
    | grep -v 'feature-specs/' \
    | grep -v 'feature-discussions/' \
    | grep -v 'internal-archive/' \
    | grep -v '# .*internal' \
    | head -20 || true)
  if [ -n "$found" ]; then
    echo -e "  ${YELLOW}⚠ Internal patterns found:${NC}"
    echo "$found" | while read f; do echo "    $f"; done
    SCAN_WARNINGS=$((SCAN_WARNINGS + 1))
  fi
fi

# 4e: Endpoint scan — single grep for all endpoint patterns in docs/skills
# Uses grep -E (POSIX ERE) — BSD grep on macOS does not support -P
echo "  Scanning for internal endpoints (docs + config)..."
found=$(grep -rEn 'localhost:[0-9]{4,5}|127\.0\.0\.1|192\.168\.|10\.[0-9]+\.[0-9]+\.|\.internal[^a-z]|\.local[^a-z]|\.corp[^a-z]' \
  "$FILTERED_DIR/docs" "$FILTERED_DIR/cat-cafe-skills" 2>/dev/null \
  | grep -v 'redis://localhost:6399' \
  | grep -v 'redis://localhost:6398' \
  | grep -v 'localhost:3000' \
  | grep -v 'localhost:3003' \
  | grep -v 'localhost:3004' \
  | grep -v 'localhost:5173' \
  | grep -v '.export-summary.json' \
  | head -20 || true)
if [ -n "$found" ]; then
  echo -e "  ${YELLOW}⚠ Potential internal endpoints in docs/skills:${NC}"
  echo "$found" | while read f; do echo "    $f"; done
  SCAN_WARNINGS=$((SCAN_WARNINGS + 1))
fi

if [ "$SCAN_FAILED" = true ]; then
  echo ""
  echo -e "${RED}Security scan FAILED! Review the files above.${NC}"
  echo -e "${YELLOW}Export preserved at: ${FILTERED_DIR}${NC}"
  trap - EXIT
  exit 1
fi

echo "  ✓ Security scan passed ($SCAN_WARNINGS warnings)"
step_done

# ── Provenance ─────────────────────────────────────────────────
FILE_COUNT=$(find "$FILTERED_DIR" -type f | wc -l | tr -d ' ')
echo ""
echo -e "${BLUE}── Provenance ──${NC}"
echo "  source_commit_sha:   $SOURCE_SHA"
echo "  manifest_version:    3"
echo "  included_file_count: $FILE_COUNT"
echo "  excluded_file_count: $EXCLUDED"
echo "  transform_count:     $TRANSFORM_COUNT"
echo "  secret_scan_result:  clean"

# Write provenance file (target_head_sha = pre-sync base, finalized in Step 5e)
cat > "$FILTERED_DIR/.sync-provenance.json" << PROV_EOF
{
  "source_commit_sha": "$SOURCE_SHA",
  "target_head_sha": "",
  "manifest_version": 3,
  "included_file_count": $FILE_COUNT,
  "excluded_file_count": $EXCLUDED,
  "transform_count": $TRANSFORM_COUNT,
  "secret_scan_result": "clean",
  "synced_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
PROV_EOF

# ── Step 5: Output / Sync ──────────────────────────────────────

if [ "$VALIDATE" = true ]; then
  echo ""
  echo -e "${GREEN}[Step 5/6] Validate (install + static gates + build + port check)...${NC}"
  cd "$FILTERED_DIR"
  if command -v pnpm >/dev/null 2>&1; then
    echo "  Installing dependencies..."
    pnpm install --frozen-lockfile 2>&1 | tail -3
    if ! run_static_quality_gates false; then
      trap - EXIT
      exit 1
    fi
    echo "  Building..."
    pnpm --filter @cat-cafe/shared build 2>&1 | tail -3
    pnpm --filter @cat-cafe/api build 2>&1 | tail -3
    echo "  Smoke test (test:public)..."
    pnpm --filter @cat-cafe/api run test:public 2>&1 | tail -5
    # D2d: Port verification — ensure no internal ports leak into config
    echo "  Port verification (D2d)..."
    PORT_FAIL=false
    for bad_port in 3001 3002; do
      found=$(grep -rn "[:=]${bad_port}\b" "$FILTERED_DIR" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.json' --include='*.sh' --include='*.yaml' --include='*.md' 2>/dev/null \
        | grep -v 'node_modules' | grep -v '.sync-provenance' | grep -v 'CORS' | head -3 || true)
      if [ -n "$found" ]; then
        echo -e "    ${RED}✗ Internal port $bad_port found:${NC}"
        echo "$found" | while read f; do echo "      $f"; done
        PORT_FAIL=true
      fi
    done
    if [ "$PORT_FAIL" = true ]; then
      echo -e "  ${RED}✗ Port verification FAILED — internal ports leaked${NC}"
      trap - EXIT
      exit 1
    fi
    echo "  ✓ Port verification passed (no 3001/3002)"
    echo -e "  ${GREEN}✓ Validate passed${NC}"
  else
    echo -e "  ${YELLOW}⚠ pnpm not found, skipping validate${NC}"
  fi
  echo ""
  echo -e "${GREEN}[VALIDATE] Export at:${NC}"
  echo "  $FILTERED_DIR"
  trap - EXIT
  exit 0
fi

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo -e "${GREEN}[DRY RUN] Export complete at:${NC}"
  echo "  $FILTERED_DIR"
  echo ""
  echo "Directory structure:"
  find "$FILTERED_DIR" -type f | sed -n '1,40p' || true
  trap - EXIT
  exit 0
fi

# Real sync
step_start "Step 5/6" "Syncing to target..."
if [ ! -d "$TARGET_DIR" ]; then
  echo -e "  ${YELLOW}Target dir does not exist: $TARGET_DIR${NC}"
  echo "  Create it with: git init $TARGET_DIR"
  exit 1
fi

# 5a: Target-owned file backup (D2b)
# Read target_owned_files from manifest and back them up before rsync
TARGET_OWNED=()
while IFS= read -r line; do TARGET_OWNED+=("$line"); done < <(yaml_list "target_owned_files")
BACKUP_DIR=$(mktemp -d)
BACKED_UP=0
for owned in "${TARGET_OWNED[@]}"; do
  if [ -d "$TARGET_DIR/$owned" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$owned")"
    cp -R "$TARGET_DIR/$owned" "$BACKUP_DIR/$owned"
    BACKED_UP=$((BACKED_UP + 1))
  elif [ -f "$TARGET_DIR/$owned" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$owned")"
    cp "$TARGET_DIR/$owned" "$BACKUP_DIR/$owned"
    BACKED_UP=$((BACKED_UP + 1))
  fi
done
if [ "$BACKED_UP" -gt 0 ]; then
  echo "  ✓ Backed up $BACKED_UP target-owned item(s)"
fi

# 5b: Diff preview (D2c) — rsync --dry-run + awk single-pass counting
# NOTE: bash while-read is ~100 lines/s; awk handles 50K+ lines in <1s
echo ""
echo -e "  ${BLUE}── Diff preview ──${NC}"

# Build owned-prefix pattern for awk (pipe-separated)
OWNED_PATTERN=""
for owned in "${TARGET_OWNED[@]}"; do
  [ -n "$OWNED_PATTERN" ] && OWNED_PATTERN="${OWNED_PATTERN}|"
  OWNED_PATTERN="${OWNED_PATTERN}${owned}"
done

# Single-pass awk: counts add/update/delete, captures first 20 deletes + protected
DIFF_RESULT_FILE=$(mktemp)
LC_ALL=C rsync -a --delete --dry-run --itemize-changes \
  --exclude='.git' "$FILTERED_DIR/" "$TARGET_DIR/" 2>/dev/null | \
  LC_ALL=C awk -v owned_pat="$OWNED_PATTERN" '
  BEGIN { add=0; upd=0; del=0; prot=0; del_shown=0 }
  /^$/ { next }
  {
    change = $1; path = $0; sub(/^[^ ]+ /, "", path)
    if (path ~ /^\.git\//) next
    if (change ~ /deleting/) {
      if (owned_pat != "" && path ~ ("^(" owned_pat ")")) {
        prot++
        print "PROTECTED:" path
      } else {
        del++
        if (del_shown < 20) { print "DELETE:" path; del_shown++ }
      }
    } else if (change ~ /^>f\+\+\+/) {
      add++
    } else if (change ~ /^>f/) {
      upd++
    }
  }
  END { print "COUNTS:" add " " upd " " del " " prot }
' > "$DIFF_RESULT_FILE"

# Parse results
DIFF_ADD=$(grep '^COUNTS:' "$DIFF_RESULT_FILE" | sed 's/COUNTS://' | awk '{print $1}')
DIFF_UPDATE=$(grep '^COUNTS:' "$DIFF_RESULT_FILE" | sed 's/COUNTS://' | awk '{print $2}')
DIFF_DELETE=$(grep '^COUNTS:' "$DIFF_RESULT_FILE" | sed 's/COUNTS://' | awk '{print $3}')
DIFF_PROTECTED=$(grep '^COUNTS:' "$DIFF_RESULT_FILE" | sed 's/COUNTS://' | awk '{print $4}')

echo -e "  ${GREEN}+${DIFF_ADD} add${NC}  ${BLUE}~${DIFF_UPDATE} update${NC}  ${RED}-${DIFF_DELETE} delete${NC}"
# Show deletion details (important for human review)
if [ "$DIFF_DELETE" -gt 0 ]; then
  echo -e "  ${RED}Files to delete:${NC}"
  grep '^DELETE:' "$DIFF_RESULT_FILE" | sed 's/^DELETE:/    - /'
  if [ "$DIFF_DELETE" -gt 20 ]; then
    echo "    ... and $((DIFF_DELETE - 20)) more"
  fi
fi
# Show protected target-owned files
if [ "$DIFF_PROTECTED" -gt 0 ]; then
  echo -e "  ${GREEN}Protected (target-owned):${NC}"
  grep '^PROTECTED:' "$DIFF_RESULT_FILE" | sed 's/^PROTECTED:/    🛡 /'
fi
rm -f "$DIFF_RESULT_FILE"
if [ $((DIFF_ADD + DIFF_UPDATE + DIFF_DELETE)) -eq 0 ]; then
  echo "  No changes to sync."
  rm -rf "$BACKUP_DIR"
  exit 0
fi
if [ "$AUTO_YES" = false ]; then
  echo -n "  Proceed with sync? [y/N] "
  read -r SYNC_CONFIRM
  if [ "$SYNC_CONFIRM" != "y" ] && [ "$SYNC_CONFIRM" != "Y" ]; then
    echo "  Aborted."
    rm -rf "$BACKUP_DIR"
    exit 0
  fi
else
  echo "  (--yes: auto-proceeding with sync)"
fi

# 5c: rsync — module-aware sync
if [ "$SYNC_MODULE" = "all" ]; then
  # Full sync: target matches filtered output exactly
  rsync -a --delete \
    --exclude='.git' \
    "$FILTERED_DIR/" "$TARGET_DIR/"
else
  # Module sync: only sync the module's owned root(s), safe --delete within owned paths
  MODULE_ROOT="$(module_root "$SYNC_MODULE")"
  if [ -z "$MODULE_ROOT" ]; then
    # root module: sync ONLY root-level managed_files (package.json, tsconfig, etc.)
    # Excludes ALL directory trees — those belong to other modules
    rsync -a \
      --exclude='.git' \
      --exclude='packages/' \
      --exclude='docs/' \
      --exclude='cat-cafe-skills/' \
      --exclude='scripts/' \
      --exclude='.github/' \
      --exclude='.sync-provenance.json' \
      "$FILTERED_DIR/" "$TARGET_DIR/"
    echo "  ✓ Module 'root': synced root-level files only (no --delete, no subdirs)"
  elif [ -d "$FILTERED_DIR/$MODULE_ROOT" ]; then
    # Module with directory root: rsync with --delete (safe — mutually exclusive roots)
    mkdir -p "$TARGET_DIR/$MODULE_ROOT"
    rsync -a --delete \
      "$FILTERED_DIR/$MODULE_ROOT" "$TARGET_DIR/$MODULE_ROOT"
    echo "  ✓ Module '$SYNC_MODULE': synced $MODULE_ROOT (with --delete)"
  else
    echo -e "  ${YELLOW}⚠ Module '$SYNC_MODULE' has no files in export, skipping${NC}"
  fi
fi

# 5d: Restore target-owned files
RESTORED=0
for owned in "${TARGET_OWNED[@]}"; do
  if [ -d "$BACKUP_DIR/$owned" ]; then
    mkdir -p "$TARGET_DIR/$(dirname "$owned")"
    cp -R "$BACKUP_DIR/$owned" "$TARGET_DIR/$owned"
    RESTORED=$((RESTORED + 1))
  elif [ -f "$BACKUP_DIR/$owned" ]; then
    mkdir -p "$TARGET_DIR/$(dirname "$owned")"
    cp "$BACKUP_DIR/$owned" "$TARGET_DIR/$owned"
    RESTORED=$((RESTORED + 1))
  fi
done
rm -rf "$BACKUP_DIR"
if [ "$RESTORED" -gt 0 ]; then
  echo "  ✓ Restored $RESTORED target-owned item(s)"
fi

echo "  ✓ Synced to $TARGET_DIR"
step_done

# 5e: Auto-commit + provenance finalization (D3)
# Commit the sync, then record the resulting target HEAD into provenance
if [ -d "$TARGET_DIR/.git" ]; then
  cd "$TARGET_DIR"
  git add -A
  if [ "$SYNC_MODULE" = "all" ]; then
    SYNC_MSG="sync: cat-cafe $SOURCE_SHA → clowder-ai (manifest v3)"
  else
    SYNC_MSG="sync: cat-cafe $SOURCE_SHA → clowder-ai [$SYNC_MODULE] (manifest v3)"
  fi
  if [ -n "$CAT_SIG" ]; then
    SYNC_MSG="${SYNC_MSG}

${CAT_SIG}"
  fi
  if [ ${#CO_AUTHORS[@]} -gt 0 ]; then
    SYNC_MSG="${SYNC_MSG}
"
    for ca in "${CO_AUTHORS[@]}"; do
      SYNC_MSG="${SYNC_MSG}
Co-authored-by: ${ca}"
    done
  fi
  git commit -m "$SYNC_MSG" --allow-empty 2>&1 | tail -3
  # Provenance: record the pre-sync HEAD (the base before our sync commit).
  # We do NOT try to embed the sync commit's own hash (chicken-and-egg with amend).
  # Detection logic uses commit-message matching to distinguish sync vs inbound.
  # PRE_SYNC_TARGET_HEAD was captured at Step 0 (or defaults to parent if unavailable).
  PRE_SYNC_BASE=$(git rev-parse HEAD~1 2>/dev/null || git rev-parse HEAD 2>/dev/null || true)
  if [ -n "$PRE_SYNC_BASE" ] && [ -f "$TARGET_DIR/.sync-provenance.json" ]; then
    node -e "
      const fs = require('fs');
      const p = JSON.parse(fs.readFileSync('$TARGET_DIR/.sync-provenance.json', 'utf-8'));
      p.target_head_sha = '$PRE_SYNC_BASE';
      fs.writeFileSync('$TARGET_DIR/.sync-provenance.json', JSON.stringify(p, null, 2) + '\n');
    "
    git add .sync-provenance.json
    git commit --amend --no-edit 2>&1 | tail -1
    echo "  ✓ Provenance finalized (target_head_sha: ${PRE_SYNC_BASE:0:12}, pre-sync base)"
  fi
  cd "$SOURCE_DIR"
fi

# ── Step 6: Post-sync validation (layered: skip / fast / full) ─
if [ "$SKIP_VALIDATE" = true ]; then
  echo ""
  echo -e "${YELLOW}[Step 6] Post-sync validation SKIPPED (--skip-validate)${NC}"
elif [ "$SYNC_MODULE" != "all" ]; then
  echo ""
  echo -e "${YELLOW}[Step 6] Post-sync validation SKIPPED (module sync — run full sync for final gate)${NC}"
else
  if [ "$FAST_VALIDATE" = true ]; then
    step_start "Step 6" "Post-sync fast validation (install + static gates + build + test)..."
  else
    step_start "Step 6" "Post-sync full acceptance (static gates + D2d)..."
  fi
  cd "$TARGET_DIR"
  STEP6_FAIL=false
  if command -v pnpm >/dev/null 2>&1; then
    # 6a: .env setup (simulate public user first-run)
    if [ -f "$TARGET_DIR/.env.example" ] && [ ! -f "$TARGET_DIR/.env" ]; then
      cp "$TARGET_DIR/.env.example" "$TARGET_DIR/.env"
      echo "  ✓ Created .env from .env.example"
    elif [ ! -f "$TARGET_DIR/.env.example" ]; then
      echo -e "  ${RED}✗ .env.example missing — public user cannot bootstrap${NC}"
      STEP6_FAIL=true
    fi

    # 6b: Install + build
    echo "  Installing dependencies..."
    if ! pnpm install --frozen-lockfile 2>&1 | tail -5; then
      echo -e "  ${RED}✗ pnpm install failed${NC}"
      STEP6_FAIL=true
    fi
    if ! run_static_quality_gates false; then
      STEP6_FAIL=true
    fi
    echo "  Building..."
    if ! pnpm --filter @cat-cafe/shared build 2>&1 | tail -3; then
      echo -e "  ${RED}✗ shared build failed${NC}"
      STEP6_FAIL=true
    fi
    if ! pnpm --filter @cat-cafe/api build 2>&1 | tail -3; then
      echo -e "  ${RED}✗ api build failed${NC}"
      STEP6_FAIL=true
    fi

    # 6c: Smoke test (test:public — gate: failure blocks sync)
    echo "  Smoke test (test:public)..."
    if ! pnpm --filter @cat-cafe/api run test:public 2>&1 | tail -5; then
      echo -e "  ${RED}✗ test:public failed${NC}"
      STEP6_FAIL=true
    fi

    if [ "$FAST_VALIDATE" = true ]; then
      echo -e "  ${YELLOW}ℹ Fast validate: skipping full startup acceptance${NC}"
    else
    # 6d: Full startup acceptance — API + frontend, probe health, lsof diff
    echo "  Startup acceptance (full stack)..."
    ACCEPT_API_PORT=${API_SERVER_PORT:-3003}
    ACCEPT_WEB_PORT=${FRONTEND_PORT:-3004}
    FORBIDDEN_PORTS="3001|3002"

    # Record listening ports BEFORE startup (baseline)
    PORTS_BEFORE=$(lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | awk '{print $9}' | sort -u || true)

    # Start API + frontend in background
    cd "$TARGET_DIR"
    API_SERVER_PORT=$ACCEPT_API_PORT NODE_ENV=test pnpm --filter @cat-cafe/api start >/dev/null 2>&1 &
    API_PID=$!
    PORT=$ACCEPT_WEB_PORT pnpm --filter @cat-cafe/web dev -p $ACCEPT_WEB_PORT >/dev/null 2>&1 &
    WEB_PID=$!

    # Wait for API health (max 20s)
    API_READY=false
    for i in $(seq 1 20); do
      if curl -sf "http://localhost:${ACCEPT_API_PORT}/api/health" >/dev/null 2>&1; then
        API_READY=true
        break
      fi
      sleep 1
    done
    if [ "$API_READY" = true ]; then
      echo "  ✓ API health check passed (port $ACCEPT_API_PORT)"
    else
      echo -e "  ${RED}✗ API did not respond on port $ACCEPT_API_PORT within 20s${NC}"
      STEP6_FAIL=true
    fi

    # Wait for frontend (max 15s after API is up)
    WEB_READY=false
    for i in $(seq 1 15); do
      if curl -sf "http://localhost:${ACCEPT_WEB_PORT}" >/dev/null 2>&1; then
        WEB_READY=true
        break
      fi
      sleep 1
    done
    if [ "$WEB_READY" = true ]; then
      echo "  ✓ Frontend page responded (port $ACCEPT_WEB_PORT)"
    else
      echo -e "  ${RED}✗ Frontend did not respond on port $ACCEPT_WEB_PORT within 15s${NC}"
      STEP6_FAIL=true
    fi

    # Record listening ports AFTER startup
    PORTS_AFTER=$(lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | awk '{print $9}' | sort -u || true)

    # before/after diff — detect unexpected new ports
    NEW_PORTS=$(comm -13 <(echo "$PORTS_BEFORE") <(echo "$PORTS_AFTER") || true)
    if [ -n "$NEW_PORTS" ]; then
      echo "  New ports opened: $(echo "$NEW_PORTS" | tr '\n' ' ')"
      # Check for forbidden ports in newly opened set
      FORBIDDEN_FOUND=$(echo "$NEW_PORTS" | grep -E ":(${FORBIDDEN_PORTS})$" || true)
      if [ -n "$FORBIDDEN_FOUND" ]; then
        echo -e "  ${RED}✗ Forbidden port(s) opened during startup:${NC}"
        echo "$FORBIDDEN_FOUND" | while read f; do echo "    $f"; done
        STEP6_FAIL=true
      fi
    fi

    # Cleanup: kill API + frontend
    kill $API_PID 2>/dev/null || true
    kill $WEB_PID 2>/dev/null || true
    lsof -ti:$ACCEPT_API_PORT 2>/dev/null | xargs kill 2>/dev/null || true
    lsof -ti:$ACCEPT_WEB_PORT 2>/dev/null | xargs kill 2>/dev/null || true
    sleep 1

    # 6e: Port verification (static scan)
    echo "  Port verification (static scan)..."
    PORT_FAIL=false
    for bad_port in 3001 3002; do
      found=$(grep -rn "[:=]${bad_port}\b" "$TARGET_DIR" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.json' --include='*.sh' --include='*.yaml' --include='*.md' 2>/dev/null \
        | grep -v 'node_modules' | grep -v '.sync-provenance' | grep -v '.git/' | grep -v 'CORS' | head -3 || true)
      if [ -n "$found" ]; then
        echo -e "    ${RED}✗ Internal port $bad_port found:${NC}"
        echo "$found" | while read f; do echo "      $f"; done
        PORT_FAIL=true
      fi
    done
    if [ "$PORT_FAIL" = true ]; then
      STEP6_FAIL=true
    else
      echo "  ✓ Port verification passed"
    fi

    fi  # end of full validation (else branch of fast_validate)

    # Final verdict
    if [ "$STEP6_FAIL" = true ]; then
      echo -e "  ${RED}✗ Post-sync acceptance FAILED${NC}"
      echo -e "  ${YELLOW}  Sync completed but target has issues. Fix before committing.${NC}"
      cd "$SOURCE_DIR"
      exit 1
    fi
    echo -e "  ${GREEN}✓ Post-sync startup acceptance passed${NC}"
  else
    echo -e "  ${YELLOW}⚠ pnpm not found, skipping post-sync validation${NC}"
  fi
  step_done
  cd "$SOURCE_DIR"
fi

TOTAL_ELAPSED=$(( $(date +%s) - SYNC_START_TIME ))

# ── Auto-tag: sync/YYYY-MM-DD-HHMMSS ─────────────────────────
# After successful sync, tag the SOURCE repo (cat-cafe) to record which
# commit was synced. Hotfix lane uses this to know what code is "in sync".
# Each sync gets a unique tag (秒级精度), so multiple syncs per day are preserved.
if [ "$DRY_RUN" = false ] && [ "$VALIDATE" = false ]; then
  SYNC_TAG="sync/$(date +%Y-%m-%d-%H%M%S)"
  echo ""
  echo -e "${BLUE}Tagging source (cat-cafe): $SYNC_TAG${NC}"
  git -C "$SOURCE_DIR" tag "$SYNC_TAG" 2>/dev/null && \
    echo -e "  ${GREEN}✓ Tag $SYNC_TAG created on cat-cafe (local)${NC}" || \
    echo -e "  ${YELLOW}⚠ Failed to create tag $SYNC_TAG${NC}"
fi

echo ""
echo -e "${GREEN}=== Sync complete ===${NC}  [total: ${TOTAL_ELAPSED}s]"
echo "Target: $TARGET_DIR"
echo "Next: cd $TARGET_DIR && git push (or create PR)"
