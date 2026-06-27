# F253 Phase A: Local QC Pipeline Implementation Plan

**Feature:** F253 — `docs/features/F253-qc-loop.md`
**Goal:** 在已有 `pnpm gate` + merge-gate skill 上扩展 auto-fix 和 evidence validation，建立本地自动化 QC 管线
**Acceptance Criteria:**
- AC-A1: `pnpm gate --auto-fix` 模式存在，向后兼容
- AC-A2: hygiene auto-fix 白名单定义在 `package.json` 的 `gate.autoFixAllowlist`
- AC-A3: merge-gate skill 组装 evidence manifest（扩展 Review Provenance Matrix）
- AC-A4: merge-gate evidence validation checker 验证完整性
**Architecture cell:** merge-gate (extend) + harness-eval (register new domain)
**Map delta:** none
**Map delta why:** 扩展已有 cell（merge-gate skill + pre-merge-check.sh），不创建新 cell
**Architecture:** 扩展 `scripts/pre-merge-check.sh` 加 `--auto-fix` flag；扩展 `cat-cafe-skills/merge-gate/SKILL.md` 加 evidence manifest 定义 + validation checker 段。Phase A 全部是 skill/script 层改动，无 runtime 代码。
**Tech Stack:** Bash (gate script), Node.js (test), SKILL.md (SOP/skill)
**前端验证:** No — 纯工具链/SOP，无 UI

---

## Finish Line

铲屎官（或猫）在 feature worktree 上：
1. 跑 `pnpm gate --auto-fix` → biome 自动修格式/import → 自动 commit `[qc-bot]` → 正常 gate 全过程（build/tsc/test/lint/check）
2. 不带 `--auto-fix` 时，行为和改动前完全一致
3. merge-gate skill 有一段 evidence manifest 定义 + validation checklist，猫执行 merge-gate 时按 checklist 验证

**What we're NOT building:**
- 不造 `pnpm qc:hygiene` / `pnpm qc:evidence` 新命令（KD-9）
- 不写 runtime 代码（无 API / 无 Redis / 无 daemon）
- 不做 C3 telemetry（Phase C）
- 不做 pre-push hook（Phase C）

## Terminal Schema

### `--auto-fix` flag behavior (A1)

```bash
# 新增 flag
AUTO_FIX=false

# 在 flag parsing case 中新增：
--auto-fix)
  AUTO_FIX=true
  shift
  ;;

# Step 0.5（新 step，在 Step 0 之后、Step 1 之前）：
# 仅 AUTO_FIX=true 时执行
# 1. 读 package.json 的 gate.autoFixAllowlist（默认 ["biome"]）
# 2. 对 allowlist 中每项执行 auto-fix 命令
# 3. 若有文件变化：git add + git commit [qc-bot]
```

### Evidence Manifest JSON shape (A2/A3)

```json
{
  "head": "<SHA>",
  "localPeerReviewSha": "<SHA|null>",
  "cloudReviewSha": "<SHA|null>",
  "headChangeCause": "<local-gate|rebase|amend|...>",
  "nextGateOwner": "<cloud|author|reviewer>",
  "gate_passed": true,
  "gate_commands": ["pnpm gate"],
  "trigger_reason": "<shared/ changed — full QC|doc polish|...>",
  "stale": false,
  "verdict": "<pending|passed|blocked>"
}
```

这是 merge-gate SKILL.md 中猫执行时**脑中组装**的结构化 checklist，不是存文件。猫按 checklist 验证，验证结果写入 PR comment / thread 消息。

## Stateful Object Gate

**Census**: Phase A 涉及 **0 个有生命周期的状态对象**。

- `--auto-fix` flag 是 stateless（跑完退出）
- Evidence manifest 是 merge-gate 执行时**从 PR metadata 实时组装**的只读快照（stateless reconstruction）
- Validation checker 是纯函数（读 PR metadata → pass/fail verdict）

Gate 通过。无三件套需求。

## Sub-split

| PR | 范围 | AC | 可独立 |
|----|------|----|--------|
| **PR-A1** | `pnpm gate --auto-fix` | AC-A1, AC-A2 | ✅ 独立于 A2/A3 |
| **PR-A2** | evidence manifest + merge-gate checker | AC-A3, AC-A4 | ✅ 独立于 A1 |

两个 PR 无依赖关系，可并行开发。

---

## Task 1: PR-A1 — `pnpm gate --auto-fix`

### Files

- Modify: `scripts/pre-merge-check.sh` (flag parsing + Step 0.5)
- Modify: `package.json` (add `gate.autoFixAllowlist` config)
- Modify: `scripts/pre-merge-check.test.mjs` (add auto-fix test cases)

### Step 1: Write the failing test — auto-fix flag runs biome check --write

在 `scripts/pre-merge-check.test.mjs` 的 `createPnpmStub` 的 `knownCommands` 集合中加入 `'check:fix'`，然后添加新测试：

```javascript
it('runs pnpm check:fix before normal gate steps when --auto-fix is passed', (t) => {
  const bash = requireBash(t);
  const result = runGate(bash, ['--auto-fix']);

  assert.equal(result.status, 0, result.stderr);
  const checkFixIndex = result.logLines.indexOf('pnpm check:fix');
  const installIndex = result.logLines.indexOf('pnpm install --frozen-lockfile');

  assert.notEqual(checkFixIndex, -1, `expected pnpm check:fix to run, got:\n${result.logLines.join('\n')}`);
  assert.ok(checkFixIndex < installIndex, `expected check:fix before install, got:\n${result.logLines.join('\n')}`);
});
```

### Step 2: Run test to verify it fails

```bash
cd /path/to/worktree && pnpm node --test scripts/pre-merge-check.test.mjs
```

Expected: FAIL — unknown option `--auto-fix` causes exit 1.

### Step 3: Add `--auto-fix` flag parsing to gate script

In `scripts/pre-merge-check.sh`, add:

1. Variable declaration at line 28 (after `SKIP_INSTALL=false`):
```bash
AUTO_FIX=false
```

2. Case branch in the flag parsing (after `--skip-install` block, before `--help`):
```bash
    --auto-fix)
      AUTO_FIX=true
      shift
      ;;
```

3. Update usage text to include `--auto-fix`:
```bash
Usage: scripts/pre-merge-check.sh [--no-rebase] [--skip-install] [--auto-fix]
```
And add flag description:
```
  --auto-fix     Run allowlisted auto-fix (biome format) before gate, auto-commit changes as [qc-bot]
```

4. New Step 0.5 — after the worktree guard (line ~155, before Step 1) but after gate guard acquisition:
```bash
# ── Step 0.5: Auto-fix (--auto-fix only) ──

if [ "$AUTO_FIX" = "true" ]; then
  STEP_START=$SECONDS
  echo "── Step 0.5: Hygiene auto-fix ──"
  pnpm check:fix || true  # best-effort: some unfixable issues are expected
  echo -e "${GREEN}✓ auto-fix 完成${NC}"

  AUTOFIX_CHANGED="$(git status --porcelain)"
  if [ -n "$AUTOFIX_CHANGED" ]; then
    echo -e "${YELLOW}  auto-fix 修改了以下文件：${NC}"
    echo "$AUTOFIX_CHANGED" | head -20
    git add -A
    git commit -m "style: auto-fix hygiene [qc-bot]"
    echo -e "${GREEN}✓ auto-fix 已提交 [qc-bot]${NC}"
  else
    echo -e "${GREEN}✓ 无需 auto-fix${NC}"
  fi
  record_step "auto-fix" "$STEP_START"
  echo ""
fi
```

### Step 4: Run test to verify it passes

```bash
cd /path/to/worktree && pnpm node --test scripts/pre-merge-check.test.mjs
```

Expected: ALL PASS — the new test sees `pnpm check:fix` in the log.

### Step 5: Write the backward-compatibility test

```javascript
it('does not run pnpm check:fix when --auto-fix is not passed', (t) => {
  const bash = requireBash(t);
  const result = runGate(bash);

  assert.equal(result.status, 0, result.stderr);
  assert.ok(
    !result.logLines.includes('pnpm check:fix'),
    `check:fix must not run without --auto-fix, got:\n${result.logLines.join('\n')}`,
  );
});
```

### Step 6: Run test to verify backward compatibility passes

```bash
cd /path/to/worktree && pnpm node --test scripts/pre-merge-check.test.mjs
```

Expected: ALL PASS — existing tests unchanged, new backward-compat test passes.

### Step 7: Add `gate.autoFixAllowlist` to `package.json`

In `package.json`, add top-level config field:

```json
{
  "gate": {
    "autoFixAllowlist": ["biome"]
  }
}
```

Note: MVP 只支持 `biome` 一项。gate script 的 Step 0.5 当前硬编码 `pnpm check:fix`（= biome check --write）。当 allowlist 需要扩展时，Step 0.5 可读取 `package.json` 的此字段来决定跑哪些 auto-fix 命令。MVP 阶段此字段是**声明性的**——标注 auto-fix 的 scope，即使 script 暂不解析它。

### Step 8: Run full gate test suite

```bash
cd /path/to/worktree && pnpm node --test scripts/pre-merge-check.test.mjs scripts/pre-merge-gate-guard.test.mjs scripts/test-bash-runtime.test.mjs scripts/check-worktree-dirty-ledger.test.mjs
```

Expected: ALL PASS.

### Step 9: Commit

```bash
git add scripts/pre-merge-check.sh scripts/pre-merge-check.test.mjs package.json
git commit -m "feat(F253): add --auto-fix mode to pnpm gate [宪宪/claude-opus-4-6 🐾]

AC-A1: pnpm gate --auto-fix runs biome auto-fix before normal gate flow
AC-A2: gate.autoFixAllowlist config in package.json declares fix scope

Auto-fix runs pnpm check:fix (= biome check --write), auto-commits
changes with [qc-bot] signature. Without --auto-fix, behavior is
identical to before (backward compatible)."
```

---

## Task 2: PR-A2 — Evidence Manifest + merge-gate Validation Checker

### Files

- Modify: `cat-cafe-skills/merge-gate/SKILL.md` (add evidence manifest section + validation checker)

### Step 1: Add Evidence Manifest definition section to SKILL.md

After the existing "Review Provenance Matrix" section, add a new section:

```markdown
### Evidence Manifest（F253 Phase A — Review Provenance Matrix 超集）

merge-gate 执行时，在 Step 7（squash merge）**之前**，猫必须**组装并验证** evidence manifest。evidence manifest 是 Review Provenance Matrix 的超集，从 PR metadata + gate 输出实时组装——**不是独立存储的文件**。

**字段定义**：

| 字段 | 来源 | 说明 |
|------|------|------|
| `head` | `git rev-parse HEAD`（当前 worktree） | 当前 HEAD SHA |
| `localPeerReviewSha` | Review Provenance Matrix 已有 | 本地跨猫 review 覆盖的 SHA |
| `cloudReviewSha` | Review Provenance Matrix 已有 | 云端 review 覆盖的 SHA |
| `headChangeCause` | Review Provenance Matrix 已有 | HEAD 变化原因 |
| `nextGateOwner` | Review Provenance Matrix 已有 | 下一步门禁所有者 |
| `gate_passed` | `pnpm gate` 的退出码 | gate 是否通过（Step 0 已跑） |
| `gate_commands` | 固定值 | `["pnpm gate"]` |
| `trigger_reason` | 猫判断 | PR 涉及共享代码则"shared/ changed — full QC"，否则按触发策略表 |
| `stale` | `head` vs `localPeerReviewSha` / `cloudReviewSha` 比较 | 任一 review SHA ≠ head 则 stale=true |
| `verdict` | 猫判断 | `passed`（review APPROVE on final HEAD）/ `blocked`（未 APPROVE）/ `pending` |
```

### Step 2: Add Evidence Validation Checker section to SKILL.md

After the evidence manifest definition, add the validation checker:

```markdown
### Evidence Validation Checker（F253 Phase A — Step 6.9）🔴

**位置**：在 Step 6.8（Hotfix Cross-Cat Review Gate）之后、Step 7（squash merge）之前执行。

**5 项硬条件**——任一不满足 → **BLOCKED，不执行 merge**：

| # | 检查项 | 验证方式 | 失败动作 |
|---|--------|----------|----------|
| E1 | `head` === PR current HEAD | `git rev-parse HEAD` vs `gh pr view {PR_NUMBER} --json headRefOid --jq '.headRefOid'` | BLOCKED — HEAD 不一致，可能有 unpushed commit |
| E2 | `stale` === false | `localPeerReviewSha` 或 `cloudReviewSha` 覆盖当前 `head` | BLOCKED — review 覆盖的 SHA 过期，需要 re-review |
| E3 | reviewer provenance 闭合 | Review Provenance Matrix 的 localPeerReviewSha 或 cloudReviewSha 非空，且覆盖 `head` | BLOCKED — 缺 review provenance |
| E4 | `verdict` !== "blocked" | review 结果为 APPROVE（非 BLOCK / CHANGES_REQUESTED） | BLOCKED — reviewer 未放行 |
| E5 | `gate_passed` === true | Step 0 的 `pnpm gate` 通过 | BLOCKED — gate 未通过或未跑 |

**通过时输出**：
```
✅ Evidence validation passed
  head: abc1234
  review coverage: local=abc1234 cloud=abc1234
  gate: passed
  stale: false
  verdict: passed
```

**失败时输出示例**：
```
❌ Evidence validation BLOCKED
  E2 FAIL: review stale — localPeerReviewSha=def5678 ≠ head=abc1234
  → 需要 reviewer 在 final HEAD 上重新 APPROVE
```

**不是脚本——是猫执行的 checklist**。Phase A 的 evidence validation 是猫在 merge-gate 流程中人工检查 + 报告的步骤。如果 Phase C 需要自动化，可以写 `scripts/check-qc-evidence.mjs`，但 Phase A 不做。
```

### Step 3: 更新 merge-gate 流程概览

在 SKILL.md 的 Step 6.8 之后（Step 7 之前的注释行），插入 Step 6.9 的引用，让流程可见：

```bash
# 6.9 Evidence Validation Checker（F253 Phase A）🔴
#   组装 evidence manifest → 验证 5 项硬条件 → 通过才执行 Step 7
#   → 详见下方「Evidence Validation Checker（Step 6.9）」
```

### Step 4: Commit

```bash
git add cat-cafe-skills/merge-gate/SKILL.md
git commit -m "feat(F253): add evidence manifest + validation checker to merge-gate [宪宪/claude-opus-4-6 🐾]

AC-A3: evidence manifest defined as Review Provenance Matrix superset
AC-A4: 5-point validation checker (E1-E5) gates merge on evidence completeness

Evidence is assembled from PR metadata at check time (stateless),
not stored separately. Validation is a manual checklist at Step 6.9,
before squash merge."
```

---

## Implementation OQ Resolutions

| OQ | Resolution | Rationale |
|----|-----------|-----------|
| **OQ-A** (evidence storage carrier) | **No separate storage** — assembled from PR metadata at merge-gate check time | Stateless reconstruction. Review Provenance Matrix fields already tracked in thread context. New fields (`gate_passed`, `trigger_reason`) derived from gate output + cat judgment. No file to go stale. |
| **OQ-B** (eval:qc cron data source) | **Deferred to Phase C** | Phase A doesn't implement `eval:qc` domain. When Phase C arrives, weekly cron aggregates from PR metadata + memory evidence (natural accumulation). |

## Cross-thread Sync

`check-feature-truth.mjs` 在 merge-gate Step 7.5a 调用，F253 不改它。新的 Step 6.9 在它之前执行。无文件级冲突。

## PR Order

1. PR-A1（gate --auto-fix）→ 跨族 review
2. PR-A2（evidence manifest + validation checker）→ 跨族 review

两 PR 独立，可并行。
