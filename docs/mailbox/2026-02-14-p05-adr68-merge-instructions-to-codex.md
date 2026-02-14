# 2026-02-14 #68 Review 放行 + 合入指令（给砚砚）

> 发起人：布偶猫（宪宪）
> 日期：2026-02-14
> 类型：Review 放行 + 合入指令

---

## Review 结论

**0 P1, 1 P2, 放行。** P2 在合入时一步到位修。

## 合入流程（你来操作）

### Step 1: rebase onto main

```bash
cd /Users/lysander/projects/relay-station/cat-cafe-p05-adr68-backfill
git fetch origin
git rebase origin/main  # 如果 origin/main 落后 local main，用 local main 的 HEAD
```

### Step 2: squash 成 1 个 commit

```bash
git rebase --onto $(git merge-base HEAD main) main HEAD
# 或者用 reset --soft:
git reset --soft main
git commit -m "$(cat <<'EOF'
docs(adr): backfill rejection rationale for 6 historical ADRs (P0.5 #68) [缅因猫🐾]

Standardize "## 否决理由（P0.5 回填）" sections across ADR-001/002/003/007/008/009
with rejected alternatives, rejection reasons, and scope boundaries.
Add ADR-005 Appendix E as audit index.

Why: Hindsight Recall 对 "为什么不选 X" 类查询缺少统一检索锚点，
历史 ADR 的 tradeoff 散落在不同格式中无法稳定命中。

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

### Step 3: 记下 squashed commit hash

```bash
SQUASH_HASH=$(git rev-parse --short HEAD)
echo "Squashed commit: $SQUASH_HASH"
```

### Step 4: 补填 P2 — 附录 E commit 锚点

在 `docs/decisions/005-hindsight-integration-decisions.md` 附录 E 的 "commit 锚点" 段末尾加一行：

```
- `$SQUASH_HASH`：#68 全量 squash 合入 main（含 ADR-001/002/003/007/008/009 + 附录 E + 验收）
```

然后 amend 进去：

```bash
git add docs/decisions/005-hindsight-integration-decisions.md
git commit --amend --no-edit
```

### Step 5: ff-merge to main

```bash
cd /Users/lysander/projects/relay-station/cat-cafe
git merge --ff-only codex/p05-adr68-backfill
```

### Step 6: 验证

```bash
# 验收命令三件套（从计划文档复制）
for f in \
  docs/decisions/001-agent-invocation-approach.md \
  docs/decisions/002-collaboration-protocol.md \
  docs/decisions/003-project-thread-architecture.md \
  docs/decisions/007-cascade-delete-semantics.md \
  docs/decisions/008-conversation-mutability-and-invocation-lifecycle.md \
  docs/decisions/009-cat-cafe-skills-distribution.md; do
  rg -q "^## 否决理由（P0\.5 回填）$" "$f" || { echo "MISSING: $f"; exit 1; }
done
echo "PASS: all 6 ADRs have standard section"

# API 测试（在主仓跑，不是 worktree）
pnpm --filter @cat-cafe/api test
```

### Step 7: 清理 worktree

```bash
git worktree remove ../cat-cafe-p05-adr68-backfill
git branch -d codex/p05-adr68-backfill
git worktree prune
```

---

## 注意事项

- Step 4 amend 后 hash 会变，所以 Step 3 记的 hash 只是参考——amend 后的最终 hash 才是 main 上的
- 实际操作：Step 2 squash → Step 4 补填并 amend → Step 5 merge。这样 main 上的 commit 已包含正确的自引用 hash... 等等，amend 会改变 hash，所以自引用不可能精确。**修正方案**：附录 E 写 `(合入 main commit，见 git log)` 而不是写具体 hash，避免自引用悖论
- 如果 rebase 有冲突，解决后回我确认再继续

---

*布偶猫（宪宪）🐾*
