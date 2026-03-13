---
feature_ids: [F059]
topics: [sync, opensource, security]
doc_kind: plan
created: 2026-03-13
---

# F059 Sync Hardening Implementation Plan

**Feature:** F059 — `docs/features/F059-open-source-plan.md`
**Goal:** 落地 D1~D5 决策，让 sync-to-opensource.sh 从"文件拷贝器"升级为"发布门禁系统"
**Acceptance Criteria:**
- AC-1: pre-sync gate 阻止 dirty tree / 目标仓有未合入变更时同步
- AC-2: target_owned_files 在 rsync --delete 后仍然存在
- AC-3: diff 预览展示新增/更新/删除文件数，非 --force 需确认
- AC-4: 安全扫描拦截 /Users/ 路径、内部端口 6399、内部文档路径
- AC-5: post-sync 验收（install + build）在 --validate 模式下自动执行
- AC-6: sync-manifest.yaml 新增 target_owned_files 和扩展的 denylist
**Architecture:** 在现有 5-step 管道中插入 Step 0 (pre-sync gate) 和 Step 4.5 (diff preview)，增强 Step 4 (security scan)，改造 Step 5 (rsync + target-owned protection)，扩展 --validate 为 post-sync 验收
**Tech Stack:** Bash, jq (optional for provenance), rsync
**前端验证:** No

---

## Not Building

- 自动反向同步（intake 是人工流程，不自动化）
- 社区区分区机制（当前阶段 target_owned_files 列表够用）
- 高熵字符串检测（P2，后续再做）
- GitHub label 流程自动化（P3）

---

## Task 1: sync-manifest.yaml 扩展

**Files:**
- Modify: `sync-manifest.yaml`

**Step 1: 新增 target_owned_files section**

在 `provenance:` 前插入：

```yaml
# ── Target-owned（目标仓独有，sync 不删除）──────────────────
target_owned_files:
  - .github/FUNDING.yml
  - .github/ISSUE_TEMPLATE/
  - .github/DISCUSSION_TEMPLATE/
  - CHANGELOG.md
  - docs/community/
```

**Step 2: 扩展 denylist_patterns**

在现有 denylist_patterns 列表末尾追加：

```yaml
  - "proxy-upstreams.json"
  - ".mcp.json"
```

**Step 3: 新增 internal_path_patterns（内部路径扫描用）**

在 `endpoint_scan_patterns:` 后新增：

```yaml
# ── Internal path patterns（导出内容不应包含的内部路径）────
internal_path_patterns:
  - "docs/mailbox"
  - "docs/plans"
  - "docs/discussions"
  - "\\.cat-cafe/"
  - "cat-cafe-runtime"
  - "6399"
```

**Step 4: Commit**

```bash
git add sync-manifest.yaml
git commit -m "feat(sync): extend manifest with target_owned_files + enhanced denylist"
```

---

## Task 2: Pre-sync gate (Step 0)

**Files:**
- Modify: `scripts/sync-to-opensource.sh` (insert after line ~38, before Step 1)

**Step 1: 插入 Step 0 pre-sync gate**

在 `cd "$SOURCE_DIR"` 行之前，插入：

```bash
# ── Step 0: Pre-sync gate ─────────────────────────────────────
echo ""
echo -e "${GREEN}[Step 0] Pre-sync gate...${NC}"

GATE_FAILED=false

# 0a: 源仓 main 无 dirty
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  echo -e "  ${RED}✗ Source repo has uncommitted changes${NC}"
  git status --short | head -10
  GATE_FAILED=true
fi

# 0b: 目标仓存在且无未提交改动（real sync only）
if [ "$DRY_RUN" = false ] && [ "$VALIDATE" = false ]; then
  if [ -d "$TARGET_DIR" ]; then
    TARGET_DIRTY=$(git -C "$TARGET_DIR" status --porcelain 2>/dev/null | head -1)
    if [ -n "$TARGET_DIRTY" ]; then
      echo -e "  ${RED}✗ Target repo has uncommitted changes${NC}"
      git -C "$TARGET_DIR" status --short 2>/dev/null | head -10
      GATE_FAILED=true
    fi
  fi

  # 0c: 入站变更检测（provenance-based）
  if [ -f "$TARGET_DIR/.sync-provenance.json" ] && command -v jq >/dev/null 2>&1; then
    LAST_SYNC_SHA=$(jq -r '.source_commit_sha' "$TARGET_DIR/.sync-provenance.json" 2>/dev/null | cut -c1-12)
    if [ -n "$LAST_SYNC_SHA" ] && [ "$LAST_SYNC_SHA" != "null" ]; then
      UPSTREAM_CHANGES=$(git -C "$TARGET_DIR" log --oneline "$LAST_SYNC_SHA..HEAD" 2>/dev/null | wc -l | tr -d ' ')
      if [ "$UPSTREAM_CHANGES" -gt 0 ]; then
        echo -e "  ${YELLOW}⚠ clowder-ai has $UPSTREAM_CHANGES independent commit(s) since last sync${NC}"
        git -C "$TARGET_DIR" log --oneline "$LAST_SYNC_SHA..HEAD" 2>/dev/null | head -5
        echo -e "  ${YELLOW}  Review these before syncing. Use --force to override.${NC}"
        # Don't fail gate — just warn (intake is manual)
      fi
    fi
  fi
fi

if [ "$GATE_FAILED" = true ]; then
  echo ""
  echo -e "${RED}Pre-sync gate FAILED. Fix issues above before syncing.${NC}"
  exit 1
fi

echo "  ✓ Pre-sync gate passed"
```

**Step 2: 添加 --force 参数支持**

在参数解析 block 中加：

```bash
FORCE=false
# ...
--force) FORCE=true ;;
```

**Step 3: Commit**

```bash
git add scripts/sync-to-opensource.sh
git commit -m "feat(sync): add pre-sync gate check (Step 0)"
```

---

## Task 3: Target-owned protection (改造 Step 5)

**Files:**
- Modify: `scripts/sync-to-opensource.sh` (Step 5 rsync section)

**Step 1: 读取 target_owned_files 列表**

在 Step 5 rsync 前，读取 manifest 中的 target_owned_files：

```bash
TARGET_OWNED=()
while IFS= read -r line; do TARGET_OWNED+=("$line"); done < <(yaml_list "target_owned_files")
```

**Step 2: 备份 target-owned → rsync → 恢复**

```bash
# 备份 target-owned 文件
TARGET_BACKUP=$(mktemp -d)
for owned in "${TARGET_OWNED[@]}"; do
  if [ -e "$TARGET_DIR/$owned" ]; then
    mkdir -p "$TARGET_BACKUP/$(dirname "$owned")"
    cp -R "$TARGET_DIR/$owned" "$TARGET_BACKUP/$owned"
  fi
done

# rsync (destructive)
rsync -a --delete --exclude='.git' "$FILTERED_DIR/" "$TARGET_DIR/"

# 恢复 target-owned 文件
for owned in "${TARGET_OWNED[@]}"; do
  if [ -e "$TARGET_BACKUP/$owned" ]; then
    mkdir -p "$TARGET_DIR/$(dirname "$owned")"
    cp -R "$TARGET_BACKUP/$owned" "$TARGET_DIR/$owned"
  fi
done
rm -rf "$TARGET_BACKUP"
```

**Step 3: Commit**

```bash
git add scripts/sync-to-opensource.sh
git commit -m "feat(sync): protect target_owned_files across rsync --delete"
```

---

## Task 4: Diff preview (Step 4.5)

**Files:**
- Modify: `scripts/sync-to-opensource.sh` (between security scan and rsync)

**Step 1: 插入 diff 预览**

在 real sync 的 Step 5 开头，rsync 执行前：

```bash
# ── Step 4.5: Diff preview ──────────────────────────────────
echo ""
echo -e "${GREEN}[Sync Preview]${NC}"
ADDED=0; UPDATED=0; DELETED=0

# 统计新增和更新
while IFS= read -r f; do
  rel="${f#$FILTERED_DIR/}"
  if [ ! -e "$TARGET_DIR/$rel" ]; then
    ADDED=$((ADDED + 1))
  else
    if ! diff -q "$f" "$TARGET_DIR/$rel" >/dev/null 2>&1; then
      UPDATED=$((UPDATED + 1))
    fi
  fi
done < <(find "$FILTERED_DIR" -type f)

# 统计删除（在 target 但不在 source，排除 .git 和 target-owned）
while IFS= read -r f; do
  rel="${f#$TARGET_DIR/}"
  [[ "$rel" == .git* ]] && continue
  is_owned=false
  for owned in "${TARGET_OWNED[@]}"; do
    [[ "$rel" == "$owned"* ]] && is_owned=true && break
  done
  $is_owned && continue
  if [ ! -e "$FILTERED_DIR/$rel" ]; then
    DELETED=$((DELETED + 1))
  fi
done < <(find "$TARGET_DIR" -type f)

echo "  新增:  $ADDED files"
echo "  更新:  $UPDATED files"
if [ "$DELETED" -gt 0 ]; then
  echo -e "  ${YELLOW}删除:  $DELETED files ⚠️${NC}"
fi
echo "  Target-owned (保护): ${#TARGET_OWNED[@]} entries"

# 非 --force 模式下确认
if [ "$FORCE" = false ] && [ "$DRY_RUN" = false ] && [ "$VALIDATE" = false ]; then
  echo ""
  read -p "继续同步? [y/N] " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 0
  fi
fi
```

**Step 2: Commit**

```bash
git add scripts/sync-to-opensource.sh
git commit -m "feat(sync): add diff preview with confirmation before rsync"
```

---

## Task 5: Security scan 加强 (增强 Step 4)

**Files:**
- Modify: `scripts/sync-to-opensource.sh` (Step 4 section)

**Step 1: 新增 /Users/ 绝对路径扫描**

在 4b-2 personal info 扫描后追加：

```bash
# 4b-3: /Users/ absolute paths (zero tolerance)
echo "  Scanning for /Users/ absolute paths..."
found=$(grep -rl '/Users/' "$FILTERED_DIR" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.json' --include='*.md' --include='*.sh' 2>/dev/null | head -5 || true)
if [ -n "$found" ]; then
  echo -e "  ${RED}✗ Found /Users/ absolute path in:${NC}"
  echo "$found" | while read f; do echo "    $f"; done
  SCAN_FAILED=true
fi
```

**Step 2: 新增内部路径/运行态坐标扫描**

从 manifest 读取 `internal_path_patterns` 并扫描：

```bash
# 4b-4: Internal path patterns (docs/skills only)
echo "  Scanning for internal path patterns (docs + skills)..."
INTERNAL_PATTERNS=()
while IFS= read -r line; do INTERNAL_PATTERNS+=("$line"); done < <(yaml_list "internal_path_patterns")
for pattern in "${INTERNAL_PATTERNS[@]}"; do
  found=$(grep -rn "$pattern" "$FILTERED_DIR/docs" "$FILTERED_DIR/cat-cafe-skills" 2>/dev/null \
    | grep -v '.export-summary.json' \
    | grep -v 'redis://localhost:6379' \
    | grep -v '# .*6399' \
    | head -5 || true)
  if [ -n "$found" ]; then
    echo -e "  ${YELLOW}⚠ Internal path pattern '$pattern' in docs/skills:${NC}"
    echo "$found" | while read f; do echo "    $f"; done
    SCAN_WARNINGS=$((SCAN_WARNINGS + 1))
  fi
done
```

**Step 3: 新增 denylist 文件（proxy-upstreams.json, .mcp.json 已在 Task 1 加入 manifest）**

已通过 manifest denylist_patterns 自动覆盖，无需额外代码。

**Step 4: Commit**

```bash
git add scripts/sync-to-opensource.sh
git commit -m "feat(sync): enhance security scan with /Users/ paths + internal patterns"
```

---

## Task 6: Post-sync 标准启动验收 (增强 --validate)

**Files:**
- Modify: `scripts/sync-to-opensource.sh` (--validate section)

**Step 1: 升级 --validate 为标准启动验收**

替换现有的 validate block：

```bash
if [ "$VALIDATE" = true ]; then
  echo ""
  echo -e "${GREEN}[Step 6] Post-sync 标准启动验收...${NC}"
  cd "$FILTERED_DIR"

  # 模拟公开用户首次启动
  cp .env.example .env 2>/dev/null || echo -e "  ${YELLOW}⚠ No .env.example found${NC}"

  if command -v pnpm >/dev/null 2>&1; then
    echo "  Installing dependencies..."
    pnpm install --frozen-lockfile 2>&1 | tail -3
    echo "  Building shared..."
    pnpm --filter @cat-cafe/shared build 2>&1 | tail -3
    echo "  Building API..."
    pnpm --filter @cat-cafe/api build 2>&1 | tail -3

    # 端口验收：确认 .env 中的端口是公开仓值
    if [ -f .env ]; then
      BAD_PORTS=$(grep -E '(3001|3002|6399)' .env | grep -v '^#' | head -3 || true)
      if [ -n "$BAD_PORTS" ]; then
        echo -e "  ${RED}✗ .env contains internal ports (3001/3002/6399):${NC}"
        echo "$BAD_PORTS" | while read l; do echo "    $l"; done
        echo -e "  ${RED}Public repo must use 3003/3004/6379${NC}"
        exit 1
      fi
    fi

    echo "  Running public tests..."
    pnpm --filter @cat-cafe/api run test:public 2>&1 | tail -5
    echo -e "  ${GREEN}✓ Post-sync 验收 passed${NC}"
  else
    echo -e "  ${YELLOW}⚠ pnpm not found, skipping validate${NC}"
  fi
  echo ""
  echo -e "${GREEN}[VALIDATE] Export at:${NC}"
  echo "  $FILTERED_DIR"
  trap - EXIT
  exit 0
fi
```

**Step 2: Commit**

```bash
git add scripts/sync-to-opensource.sh
git commit -m "feat(sync): upgrade --validate to mandatory startup acceptance"
```

---

## Task 7: 更新 step 编号 + Usage 注释

**Files:**
- Modify: `scripts/sync-to-opensource.sh` (header + step labels)

**Step 1: 更新 Usage 和 step 编号**

- Header comment: 加 `--force` 说明
- Step labels: 现在是 Step 0~6（原来 1~5），更新所有 echo 的 step 编号

**Step 2: Commit**

```bash
git add scripts/sync-to-opensource.sh
git commit -m "chore(sync): update step numbers and usage docs"
```

---

## Task 8: Dry-run 验证

**Step 1: 语法检查**

```bash
bash -n scripts/sync-to-opensource.sh
```

**Step 2: dry-run 测试**

```bash
bash scripts/sync-to-opensource.sh --dry-run
```

预期：Step 0 gate pass → Step 1~4 正常 → 新的安全扫描项出现 → DRY RUN 完成

**Step 3: --validate 测试**

```bash
bash scripts/sync-to-opensource.sh --validate
```

预期：gate + export + transform + scan + install + build + 端口验收 → 全部 pass

---

## 验证矩阵

| AC | 验证方式 |
|----|---------|
| AC-1 | 在 dirty repo 下跑 sync → 应报错退出 |
| AC-2 | 在 target 创建 `docs/community/test.md` → sync → 文件仍在 |
| AC-3 | real sync 时显示 preview + 确认提示 |
| AC-4 | 在 filtered 中人为注入 `/Users/foo` → scan 应报错 |
| AC-5 | --validate 跑完 install + build + 端口验收 |
| AC-6 | manifest 中包含 target_owned_files + 扩展 denylist |
