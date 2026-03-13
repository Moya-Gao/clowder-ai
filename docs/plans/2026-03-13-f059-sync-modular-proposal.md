---
feature_ids: [F059]
topics: [sync, opensource, performance]
doc_kind: plan
created: 2026-03-13
author: opus（宪宪）
status: proposal — 等待平行 session Opus 评估
---

# F059 同步脚本模块化 + 性能优化提案

> **背景**：铲屎官和宪宪（本 session）在分析 `sync-to-opensource.sh` 时发现严重的性能和可观测性问题。本提案供平行 session 的 Opus（脚本 owner）评估和实施。

## 一、现状诊断

### 1.1 性能瓶颈（实测数据）

**2026-03-13 07:04 实测**：同步 946 个源文件的脚本跑了 13+ 分钟后被铲屎官手动 kill。

卡在 **Step 5 Diff Preview**——`find . -type f | sed` 对 1558 个文件逐文件串行 diff：

```
PID 36731 — find . -type f -not -path ./.git/*   ← 已跑 13 分钟
PID 36732 — sed s|^\./||
```

**Step 3 Transform 同样有问题**：20+ 个 transform pass，每个都用 `find | while read | sed/perl`，同一个文件被反复处理 7+ 次。估算 ~9000 次 I/O 操作（946 文件 × ~10 passes）。

### 1.2 可观测性为零

311 行输出中绝大多数是 security scan 的 warning 详情。没有：
- Step 级时间戳（不知道卡在哪一步）
- 文件级进度（不知道处理到哪个文件）
- 耗时统计（不知道哪步是瓶颈）

### 1.3 交互式阻塞（已修复）

`read -r` 确认在无头 CLI 模式下阻塞。已通过 `--yes` flag 修复。

---

## 二、提案：模块化同步

### 2.1 核心思路

将 Step 1-4（export + transform + security scan）按**模块**独立执行，Step 5-6 保持全量。

```
sync.sh --module docs        # 只处理 docs/
sync.sh --module shared      # 只处理 packages/shared/
sync.sh --module api         # 只处理 packages/api/
sync.sh --module web         # 只处理 packages/web/
sync.sh --module skills      # 只处理 cat-cafe-skills/
sync.sh --module all         # 默认全量（等价于现在）
```

### 2.2 模块定义

| 模块 ID | 路径 | 估算文件数 | 依赖 |
|---------|------|-----------|------|
| `docs` | `docs/` | ~200 | 无 |
| `shared` | `packages/shared/` | ~80 | 无 |
| `api` | `packages/api/` | ~300 | shared |
| `web` | `packages/web/` | ~400 | shared |
| `skills` | `cat-cafe-skills/` | ~500 | 无 |
| `root` | 根目录文件 (`package.json`, `tsconfig.json`, etc.) | ~78 | 无 |

### 2.3 模块化后各步骤行为

| Step | 全量模式 | 模块模式 |
|------|---------|---------|
| Step 0 Pre-gate | 检查整个源仓 | 不变 |
| Step 1 Clean export | `rsync` 全部 allowlist | 只 rsync 该模块路径 |
| Step 2 Allowlist filter | 全量 | 只过滤模块范围 |
| Step 3 Transform | 20+ passes × 全部文件 | 20+ passes × **仅模块文件** |
| Step 4 Security scan | 全量扫描 | 仅扫该模块（但 denylist 仍全局检查） |
| Step 5 Sync to target | 全量 rsync --delete | **模块级 rsync**（不用 --delete，避免删其他模块） |
| Step 6 验收 | install + build + health | 全部模块同步完后统一跑 |

### 2.4 好处

1. **故障隔离**：`docs/` 的 sed transform 出错不影响 `packages/api/` 同步
2. **增量重试**：某模块失败 → 只重跑该模块，不全量重来
3. **进度天然可见**：`[docs] done (12s) → [shared] done (8s) → [api] done (25s)`
4. **智能跳过**：配合 `git diff --stat` 检测变更模块，未变的直接 skip

### 2.5 潜在问题 & 解法

| 问题 | 解法 |
|------|------|
| Transform 跨模块一致性（如 `cat-cafe → clowder-ai` 替换） | 每个模块各自跑全部 transform，transform 是幂等的 |
| Security scan 需要全局视角 | denylist 是逐文件的，可以分模块跑；endpoint scan 分模块也 OK |
| 模块级 rsync 不能用 `--delete` | 对，否则会删其他模块。改用 `rsync -a`（不 --delete），删除靠 `--module all` 的全量模式 |
| Step 6 验收依赖全部模块 | 验收永远全量跑，不分模块 |
| 中间状态（半同步） | 用 staging branch，全部模块完成后 squash merge 到 main |

---

## 三、提案：性能优化（与模块化正交）

即使不做模块化，以下优化也能大幅提速：

### 3.1 Transform 合并为 single-pass

当前：20+ 个 `find | while read | sed/perl` 循环，每个遍历全部文件。

优化：合并为一个 perl 脚本，一次读文件、应用全部规则、一次写回：

```bash
# 替代 20+ 个独立的 find|while|sed
find "$FILTERED_DIR" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.json' -o -name '*.md' -o -name '*.sh' \) -print0 | \
xargs -0 -P4 perl -pi -e '
  s/cat-cafe/clowder-ai/g;
  s/猫猫咖啡/Clowder AI/g;
  # ... 其余 transform 规则
'
```

**预估提速**：7-10× —— 从 ~9000 次 I/O 降到 ~946 次（单遍），且 `xargs -P4` 4 并行。

### 3.2 Diff Preview 用 rsync --dry-run 替代逐文件 diff

当前：`find | while read | diff` 逐文件串行比对，1558 文件跑了 13 分钟。

优化：

```bash
# 3 秒出结果，替代 13 分钟的逐文件 diff
rsync -a --delete --dry-run --itemize-changes \
  --exclude='.git' "$FILTERED_DIR/" "$TARGET_DIR/" | \
  awk '/^>f/ {u++} /^\*deleting/ {d++} /^cd/ {next} END {
    printf "  新增/更新: %d files\n  删除: %d files\n", u, d
  }'
```

**预估提速**：100×+ —— rsync 原生 diff 算法 vs shell 逐文件比对。

### 3.3 进度日志

每个 Step 加时间戳和耗时：

```bash
step_start() { STEP_T0=$(date +%s); echo -e "\n${GREEN}[$1] $2${NC}  ($(date +%H:%M:%S))"; }
step_done()  { echo "  ✓ $1 done in $(($(date +%s) - STEP_T0))s"; }

step_start "Step 3/6" "Transforming..."
# ... transform 逻辑
step_done "Step 3/6"
```

Transform 中加文件计数：

```bash
TOTAL=$(find ... | wc -l)
COUNT=0
... | while read f; do
  COUNT=$((COUNT + 1))
  [ $((COUNT % 100)) -eq 0 ] && echo "  ($COUNT/$TOTAL) Processing..."
  ...
done
```

---

## 四、建议实施优先级

| 优先级 | 项目 | 理由 |
|--------|------|------|
| **P0** | 3.2 rsync --dry-run 替代逐文件 diff | 13 分钟 → 3 秒，阻塞性 bug |
| **P0** | 3.3 Step 级进度日志 | 不知道卡在哪 = 不可运维 |
| **P1** | 3.1 Transform single-pass 合并 | 减少 ~8000 次无意义 I/O |
| **P2** | 2.x 模块化同步 | 架构升级，需要改 rsync 策略 |

P0 两项改完，全量同步应该能从 **20+ 分钟降到 < 3 分钟**。模块化是锦上添花，可以后做。

---

## 五、与现有 hardening plan 的关系

`2026-03-13-f059-sync-hardening.md` 中的 Task 4（Diff Preview）直接被本提案 §3.2 替代——用 `rsync --dry-run --itemize-changes` 而不是 `find | while | diff`。其余 Task 1-3, 5-8 不受影响。

---

*宪宪 / 布偶猫 Opus 4.6*
*2026-03-13 07:10*
