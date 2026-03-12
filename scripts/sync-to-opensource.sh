#!/usr/bin/env bash
# sync-to-opensource.sh — Cat Café → Clowder AI 开源同步脚本
# 三猫共识管道: Clean export → Allowlist → Transforms → Security scan → Output
#
# Usage:
#   bash scripts/sync-to-opensource.sh              # 同步到目标目录
#   bash scripts/sync-to-opensource.sh --dry-run    # 只导出到临时目录，不同步
#   bash scripts/sync-to-opensource.sh --validate   # 导出 + install + build + smoke test

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

# ── 参数 ──────────────────────────────────────────────────────
DRY_RUN=false
VALIDATE=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --validate) VALIDATE=true ;;
  esac
done

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

# ── Step 1: Clean tree 导出 ────────────────────────────────────
echo ""
echo -e "${GREEN}[Step 1/5] Clean tree 导出...${NC}"

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

# ── Step 2: Allowlist 过滤（只保留 manifest 中的路径）──────────
echo ""
echo -e "${GREEN}[Step 2/5] Allowlist 过滤...${NC}"

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

# 2b: 排除 managed_roots 内的 excluded 文件（从 manifest 读取）
for excl in "${EXCLUDED_ITEMS[@]}"; do
  # 跳过目录级别排除（docs/, designs/ 等）——它们不在 managed_roots 里
  [[ "$excl" == */ ]] && continue
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

echo ""
echo "  导出: $INCLUDED files | 排除: $EXCLUDED files"

# ── Step 3: Transforms ─────────────────────────────────────────
echo ""
echo -e "${GREEN}[Step 3/5] Transforms...${NC}"

TRANSFORM_COUNT=0

# 3a: cat-config.json（脱敏可运行版，必须符合 V2 schema）
cat > "$FILTERED_DIR/cat-config.json" << 'CONFIG_EOF'
{
  "$schema": "./cat-config.schema.json",
  "$comment": "Clowder AI config. Customize your cat roster. See docs for full schema.",
  "version": 2,
  "owner": {
    "name": "Owner",
    "aliases": ["Admin"],
    "mentionPatterns": ["@owner", "@admin"]
  },
  "breeds": [
    {
      "id": "ragdoll",
      "catId": "opus",
      "name": "Ragdoll",
      "displayName": "Ragdoll",
      "avatar": "/avatars/ragdoll.png",
      "color": { "primary": "#9B7EBD", "secondary": "#E8DFF5" },
      "mentionPatterns": ["@opus", "@ragdoll"],
      "roleDescription": "Lead architect and core developer",
      "defaultVariantId": "opus-default",
      "variants": [
        {
          "id": "opus-default",
          "provider": "anthropic",
          "defaultModel": "claude-opus-4-6",
          "mcpSupport": true,
          "cli": { "command": "claude", "outputFormat": "stream-json", "defaultArgs": ["--output-format", "stream-json"] },
          "personality": "Deep thinker, quality-focused",
          "strengths": ["architecture", "backend", "mcp"],
          "contextBudget": { "maxPromptTokens": 180000, "maxContextTokens": 160000, "maxMessages": 200, "maxContentLengthPerMsg": 10000 }
        }
      ]
    },
    {
      "id": "maine-coon",
      "catId": "codex",
      "name": "Maine Coon",
      "displayName": "Maine Coon",
      "avatar": "/avatars/maine-coon.png",
      "color": { "primary": "#059669", "secondary": "#D1FAE5" },
      "mentionPatterns": ["@codex", "@maine-coon"],
      "roleDescription": "Code reviewer and security specialist",
      "defaultVariantId": "codex-default",
      "variants": [
        {
          "id": "codex-default",
          "provider": "openai",
          "defaultModel": "gpt-5.3-codex",
          "mcpSupport": false,
          "cli": { "command": "codex", "outputFormat": "stream-json", "defaultArgs": ["--full-auto"] },
          "personality": "Thorough reviewer, security-minded",
          "strengths": ["review", "security", "testing"],
          "contextBudget": { "maxPromptTokens": 180000, "maxContextTokens": 160000, "maxMessages": 200, "maxContentLengthPerMsg": 10000 }
        }
      ]
    },
    {
      "id": "siamese",
      "catId": "gemini",
      "name": "Siamese",
      "displayName": "Siamese",
      "avatar": "/avatars/siamese.png",
      "color": { "primary": "#D97706", "secondary": "#FEF3C7" },
      "mentionPatterns": ["@gemini", "@siamese"],
      "roleDescription": "Visual designer and creative thinker",
      "defaultVariantId": "gemini-default",
      "variants": [
        {
          "id": "gemini-default",
          "provider": "google",
          "defaultModel": "gemini-2.5-pro",
          "mcpSupport": true,
          "cli": { "command": "gemini", "outputFormat": "stream-json", "defaultArgs": [] },
          "personality": "Creative spark, visual excellence",
          "strengths": ["design", "creativity"],
          "contextBudget": { "maxPromptTokens": 180000, "maxContextTokens": 160000, "maxMessages": 200, "maxContentLengthPerMsg": 10000 }
        }
      ]
    }
  ],
  "roster": {
    "opus": { "family": "ragdoll", "roles": ["architect", "peer-reviewer"], "lead": true, "available": true, "evaluation": "Lead architect" },
    "codex": { "family": "maine-coon", "roles": ["reviewer", "peer-reviewer"], "lead": true, "available": true, "evaluation": "Code reviewer" },
    "gemini": { "family": "siamese", "roles": ["designer", "peer-reviewer"], "lead": true, "available": true, "evaluation": "Visual designer" }
  },
  "reviewPolicy": {
    "requireDifferentFamily": true,
    "preferActiveInThread": true,
    "preferLead": true,
    "excludeUnavailable": true
  }
}
CONFIG_EOF
echo "  ✓ cat-config.json (desecreted)"
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

# 3f: shared-rules.md 通用化（去铲屎官个人引用）
if [ -f "$FILTERED_DIR/cat-cafe-skills/refs/shared-rules.md" ]; then
  # 通用化铲屎官引用
  sedi \
    -e 's/铲屎官/team lead/g' \
    -e 's/铲屎官原话/team experience/g' \
    -e 's/Landy/Owner/g' \
    -e 's/lysander/owner/g' \
    -e 's/suces-MacBook[^ ]*/dev-machine/g' \
    "$FILTERED_DIR/cat-cafe-skills/refs/shared-rules.md"
  echo "  ✓ shared-rules.md (sanitized)"
  TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
fi

# 3g: Skills 全目录通用化（SKILL.md, refs/*.md, manifest.yaml, *.sh）
find "$FILTERED_DIR/cat-cafe-skills" \( -name "*.md" -o -name "*.sh" -o -name "manifest.yaml" \) -type f | while read -r skill_file; do
  if grep -qi '铲屎官\|Landy\|lysander\|6399\|6398' "$skill_file" 2>/dev/null; then
    sedi \
      -e 's/redis:\/\/localhost:6399/redis:\/\/localhost:6379/g' \
      -e 's/redis:\/\/localhost:6398/redis:\/\/localhost:6380/g' \
      -e 's/6399 圣域/production Redis (sacred)/g' \
      -e 's/铲屎官原话/team experience/g' \
      -e 's/铲屎官/team lead/g' \
      -e 's/Landy/Owner/g' \
      -e 's/landy/owner/g' \
      -e 's/lysander/owner/g' \
      -e 's/suces-MacBook[^ ]*/dev-machine/g' \
      "$skill_file"
  fi
done
echo "  ✓ Skills files (all .md, .sh, manifest.yaml sanitized)"
TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))

# 3h: BOOTSTRAP.md 通用化
if [ -f "$FILTERED_DIR/cat-cafe-skills/BOOTSTRAP.md" ]; then
  sedi \
    -e 's/铲屎官/team lead/g' \
    -e 's/Landy/Owner/g' \
    -e 's/lysander/owner/g' \
    "$FILTERED_DIR/cat-cafe-skills/BOOTSTRAP.md"
  echo "  ✓ BOOTSTRAP.md (sanitized)"
  TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
fi

# 3i: README.md — 复制开源版替换内部版
if [ -f "$STAGING_DIR/README.opensource.md" ]; then
  cp "$STAGING_DIR/README.opensource.md" "$FILTERED_DIR/README.md"
  echo "  ✓ README.md (opensource version)"
  TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
fi

# 3j: .github/pull_request_template.md — 复制开源版替换内部版
if [ -f "$STAGING_DIR/.github/pull_request_template.opensource.md" ]; then
  mkdir -p "$FILTERED_DIR/.github"
  cp "$STAGING_DIR/.github/pull_request_template.opensource.md" "$FILTERED_DIR/.github/pull_request_template.md"
  echo "  ✓ .github/pull_request_template.md (opensource version)"
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

# 3k-1: Global source code sanitization (铲屎官 → owner, @landy/@lysander → @owner)
echo "  Sanitizing source code globally..."
SANITIZE_EXTENSIONS=("*.ts" "*.tsx" "*.js" "*.json")
for ext in "${SANITIZE_EXTENSIONS[@]}"; do
  find "$FILTERED_DIR/packages" -name "$ext" -type f 2>/dev/null | while read -r src_file; do
    # Only process files that actually contain the strings
    if grep -qi '铲屎官\|@landy\|@lysander\|@l\.s\.\|Landy' "$src_file" 2>/dev/null; then
      sedi \
        -e 's/铲屎官/owner/g' \
        -e 's/@Landy/@owner/g' \
        -e 's/@landy/@owner/g' \
        -e "s/@Lysander/@owner/g" \
        -e "s/@lysander/@owner/g" \
        -e "s/@l\.s\./@owner/g" \
        -e "s/'Landy'/'Owner'/g" \
        -e "s/'landy'/'owner'/g" \
        -e "s/'l\.s\.'/'owner'/g" \
        -e 's/"Landy"/"Owner"/g' \
        -e 's/name: "Landy"/name: "Owner"/g' \
        "$src_file"
    fi
  done
done
TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))

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

# 3k-3: P1-2 — start-dev.sh: don't kill proxy port when proxy is disabled
if [ -f "$FILTERED_DIR/scripts/start-dev.sh" ]; then
  sedi \
    -e 's/kill_port ${ANTHROPIC_PROXY_PORT:-9877} "Proxy"/[ "${ANTHROPIC_PROXY_ENABLED:-1}" != "0" ] \&\& kill_port ${ANTHROPIC_PROXY_PORT:-9877} "Proxy"/g' \
    "$FILTERED_DIR/scripts/start-dev.sh"
  echo "  ✓ start-dev.sh (proxy kill guarded)"
  TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
fi

echo "  ✓ Source code global sanitization complete"

# 3k-4: docs/ internal links cleanup — strip remaining private paths from docs
echo "  Stripping internal doc links from public docs..."
find "$FILTERED_DIR/docs" -name "*.md" -type f 2>/dev/null | while read -r doc_file; do
  # Use perl for complex regex (macOS sed ERE is limited)
  perl -i -pe '
    # Remove standalone list-item lines that are pure internal links to private dirs
    next if /^- \[.*?\]\((?:\.\.\/?|docs\/|\.\/)?(?:archive|plans|mailbox|discussions|research|reflections|evidence|runbooks|episodes|guides|phases|methods|evolution-proposals|stories|prompts|lessons)\//;
  ' "$doc_file"
  perl -i -pe '
    # Convert inline markdown links to private dirs into plain text
    s/\[([^\]]*?)\]\((?:\.\.\/?|docs\/|\.\/)?(?:archive|plans|mailbox|discussions|research|reflections|evidence|runbooks|episodes|guides|phases|methods|evolution-proposals|stories|prompts|lessons)\/[^)]*\)/$1 (internal)/g;
    # Strip backtick-quoted paths referencing private dirs
    s/`(?:docs\/)?(?:archive|plans|mailbox|discussions|research|reflections|evidence|runbooks)\/[^`]*`/*(internal reference removed)*/g;
  ' "$doc_file"
done
echo "  ✓ docs/ internal links stripped"
TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))

# 3k: docs/VISION.md + docs/SOP.md 通用化（去铲屎官引用/内部端口）
for doc_file in docs/VISION.md docs/SOP.md; do
  if [ -f "$FILTERED_DIR/$doc_file" ]; then
    sedi \
      -e 's/铲屎官原话/team experience/g' \
      -e 's/铲屎官/team lead/g' \
      -e 's/Landy/Owner/g' \
      -e 's/lysander/owner/g' \
      -e 's/布偶猫/Ragdoll/g' \
      -e 's/缅因猫/Maine Coon/g' \
      -e 's/暹罗猫/Siamese/g' \
      -e 's/宪宪/Ragdoll/g' \
      -e 's/砚砚/Maine Coon/g' \
      -e 's/烁烁/Siamese/g' \
      -e 's/redis:\/\/localhost:6399/redis:\/\/localhost:6379/g' \
      -e 's/redis:\/\/localhost:6398/redis:\/\/localhost:6380/g' \
      -e 's/6399 圣域/production Redis (sacred)/g' \
      -e 's/suces-MacBook[^ ]*/dev-machine/g' \
      "$FILTERED_DIR/$doc_file"
    echo "  ✓ $doc_file (sanitized)"
    TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
  fi
done

# 3l: docs/decisions/ ADR 通用化
find "$FILTERED_DIR/docs/decisions" -name "*.md" -type f 2>/dev/null | while read -r adr_file; do
  sedi \
    -e 's/铲屎官/team lead/g' \
    -e 's/Landy/Owner/g' \
    -e 's/lysander/owner/g' \
    -e 's/布偶猫/Ragdoll/g' \
    -e 's/缅因猫/Maine Coon/g' \
    -e 's/暹罗猫/Siamese/g' \
    "$adr_file"
done
echo "  ✓ docs/decisions/ (sanitized)"
TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))

# 3m: docs/ROADMAP.md — 从 BACKLOG 生成公开版
if [ -f "$STAGING_DIR/docs/BACKLOG.md" ]; then
  mkdir -p "$FILTERED_DIR/docs"
  cp "$STAGING_DIR/docs/BACKLOG.md" "$FILTERED_DIR/docs/ROADMAP.md"
  # 通用化 + 重命名标题
  sedi \
    -e 's/# BACKLOG/# Roadmap/' \
    -e 's/铲屎官/team lead/g' \
    -e 's/Landy/Owner/g' \
    -e 's/lysander/owner/g' \
    -e 's/布偶猫/Ragdoll/g' \
    -e 's/缅因猫/Maine Coon/g' \
    -e 's/暹罗猫/Siamese/g' \
    -e 's/宪宪/Ragdoll/g' \
    -e 's/砚砚/Maine Coon/g' \
    -e 's/烁烁/Siamese/g' \
    "$FILTERED_DIR/docs/ROADMAP.md"
  echo "  ✓ docs/ROADMAP.md (generated from BACKLOG)"
  TRANSFORM_COUNT=$((TRANSFORM_COUNT + 1))
fi

# 3n: docs/public-lessons.md — 从 lessons-learned 生成公开版
if [ -f "$STAGING_DIR/docs/lessons-learned.md" ]; then
  mkdir -p "$FILTERED_DIR/docs"
  cp "$STAGING_DIR/docs/lessons-learned.md" "$FILTERED_DIR/docs/public-lessons.md"
  sedi \
    -e 's/铲屎官/team lead/g' \
    -e 's/Landy/Owner/g' \
    -e 's/lysander/owner/g' \
    -e 's/布偶猫/Ragdoll/g' \
    -e 's/缅因猫/Maine Coon/g' \
    -e 's/暹罗猫/Siamese/g' \
    -e 's/宪宪/Ragdoll/g' \
    -e 's/砚砚/Maine Coon/g' \
    -e 's/烁烁/Siamese/g' \
    -e 's/redis:\/\/localhost:6399/redis:\/\/localhost:6379/g' \
    -e 's/suces-MacBook[^ ]*/dev-machine/g' \
    "$FILTERED_DIR/docs/public-lessons.md"
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

echo ""
echo "  Transforms: $TRANSFORM_COUNT"

# ── Step 4: Denylist / Secret scan ────────────────────────────
echo ""
echo -e "${GREEN}[Step 4/5] Security scan...${NC}"

SCAN_FAILED=false

# 4a: Denylist filename patterns (from manifest SOT)
DENYLIST_PATTERNS=()
while IFS= read -r line; do DENYLIST_PATTERNS+=("$line"); done < <(yaml_list "denylist_patterns")
if [ ${#DENYLIST_PATTERNS[@]} -eq 0 ]; then
  echo -e "  ${RED}✗ No denylist_patterns found in manifest${NC}"
  exit 1
fi
for pattern in "${DENYLIST_PATTERNS[@]}"; do
  found=$(find "$FILTERED_DIR" -name "$pattern" -type f 2>/dev/null)
  if [ -n "$found" ]; then
    echo -e "  ${RED}✗ Forbidden file: $found${NC}"
    SCAN_FAILED=true
  fi
done

# 4b: Sensitive content scan (layered strategy)
SCAN_WARNINGS=0

# 4b-1: Actual API key values (non-test source code only)
# Test files use fake keys (sk-ant-secret etc.) which is fine
echo "  Scanning for API key values (source code, non-test)..."
KEY_PATTERNS=('sk-ant-' 'sk-proj-' 'sk-live-' 'gsk_' 'AIzaSy')
for pattern in "${KEY_PATTERNS[@]}"; do
  found=$(grep -rl "$pattern" "$FILTERED_DIR" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.json' --include='*.md' --include='*.yaml' --include='*.yml' --include='*.sh' 2>/dev/null \
    | grep -v '/test/' | grep -v '/__tests__/' | grep -v '.test.' | head -5 || true)
  if [ -n "$found" ]; then
    echo -e "  ${RED}✗ Suspected API key '$pattern' in:${NC}"
    echo "$found" | while read f; do echo "    $f"; done
    SCAN_FAILED=true
  fi
done

# 4b-2: Personal info (non-test source code only)
echo "  Scanning for personal info (source code)..."
PERSONAL_KEYWORDS=('suces-MacBook')
for keyword in "${PERSONAL_KEYWORDS[@]}"; do
  found=$(grep -rl "$keyword" "$FILTERED_DIR" 2>/dev/null | head -5 || true)
  if [ -n "$found" ]; then
    echo -e "  ${RED}✗ Personal info '$keyword' in:${NC}"
    echo "$found" | while read f; do echo "    $f"; done
    SCAN_FAILED=true
  fi
done

# lysander: only check in non-test source code
# Test files may have @lysander for mention routing tests — these are config-driven, not secrets
found=$(grep -rl "lysander" "$FILTERED_DIR" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.json' --include='*.md' --include='*.sh' 2>/dev/null \
  | grep -v '/test/' | grep -v '/__tests__/' | grep -v '.test.' | head -5 || true)
if [ -n "$found" ]; then
  echo -e "  ${RED}✗ Found 'lysander' in source code:${NC}"
  echo "$found" | while read f; do echo "    $f"; done
  SCAN_FAILED=true
fi

# 4b-3: Env var name references — warning only (code needs to read env vars)
echo "  Scanning for env var references..."
ENV_VAR_NAMES=('ANTHROPIC_API_KEY' 'OPENAI_API_KEY' 'GOOGLE_API_KEY')
for keyword in "${ENV_VAR_NAMES[@]}"; do
  found=$(grep -rl "$keyword" "$FILTERED_DIR" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.sh' 2>/dev/null | head -5 || true)
  if [ -n "$found" ]; then
    echo -e "  ${YELLOW}⚠ Env var reference '$keyword' (normal — code reads env vars):${NC}"
    echo "$found" | while read f; do echo "    $f"; done
    SCAN_WARNINGS=$((SCAN_WARNINGS + 1))
  fi
done

# 4c: Endpoint scan — docs/config 层额外扫描内部 endpoint
echo "  Scanning for internal endpoints (docs + config)..."
ENDPOINT_PATTERNS=('localhost:[0-9]\{4,5\}' '127\.0\.0\.1' '192\.168\.' '10\.[0-9]' '\.internal' '\.local' '\.corp')
for pattern in "${ENDPOINT_PATTERNS[@]}"; do
  found=$(grep -rn "$pattern" "$FILTERED_DIR/docs" "$FILTERED_DIR/cat-cafe-skills" 2>/dev/null \
    | grep -v 'redis://localhost:6379' \
    | grep -v 'redis://localhost:6380' \
    | grep -v 'localhost:3000' \
    | grep -v 'localhost:3001' \
    | grep -v 'localhost:5173' \
    | grep -v '.export-summary.json' \
    | head -5 || true)
  if [ -n "$found" ]; then
    echo -e "  ${YELLOW}⚠ Potential internal endpoint '$pattern' in docs/skills:${NC}"
    echo "$found" | while read f; do echo "    $f"; done
    SCAN_WARNINGS=$((SCAN_WARNINGS + 1))
  fi
done

if [ "$SCAN_FAILED" = true ]; then
  echo ""
  echo -e "${RED}Security scan FAILED! Review the files above.${NC}"
  echo -e "${YELLOW}Export preserved at: ${FILTERED_DIR}${NC}"
  trap - EXIT
  exit 1
fi

echo "  ✓ Security scan passed ($SCAN_WARNINGS warnings)"

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

# Write provenance file
cat > "$FILTERED_DIR/.sync-provenance.json" << PROV_EOF
{
  "source_commit_sha": "$SOURCE_SHA",
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
  echo -e "${GREEN}[Step 5/5] Validate (install + build + smoke test)...${NC}"
  cd "$FILTERED_DIR"
  if command -v pnpm >/dev/null 2>&1; then
    echo "  Installing dependencies..."
    pnpm install --frozen-lockfile 2>&1 | tail -3
    echo "  Building..."
    pnpm --filter @cat-cafe/shared build 2>&1 | tail -3
    pnpm --filter @cat-cafe/api build 2>&1 | tail -3
    echo "  Smoke test (test:public)..."
    pnpm --filter @cat-cafe/api run test:public 2>&1 | tail -5
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
echo ""
echo -e "${GREEN}[Step 5/5] Syncing to target...${NC}"
if [ ! -d "$TARGET_DIR" ]; then
  echo -e "  ${YELLOW}Target dir does not exist: $TARGET_DIR${NC}"
  echo "  Create it with: git init $TARGET_DIR"
  exit 1
fi

# rsync (destructive — target matches filtered output exactly)
rsync -a --delete \
  --exclude='.git' \
  "$FILTERED_DIR/" "$TARGET_DIR/"

echo "  ✓ Synced to $TARGET_DIR"
echo ""
echo -e "${GREEN}=== Sync complete ===${NC}"
echo "Next: cd $TARGET_DIR && git add -A && git commit"
