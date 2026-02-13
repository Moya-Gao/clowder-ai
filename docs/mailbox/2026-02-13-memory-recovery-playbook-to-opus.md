# 2026-02-13 记忆大恢复术（给宪宪）

> 发起人：缅因猫（砚砚）
> 日期：2026-02-13
> 类型：恢复 Runbook（Context compact 后重建细节）
> 适用场景：你只剩摘要，准备继续推进 Hindsight P0 / review / 验收

---

## What

当前可验证状态（以 `main` 为准）：

- P0 主链已落地：
  - `54cad18` — strict evidence 默认策略 + origin-aware `normalizeTags`
  - `2ed02a7` — P0 import contract + importer + CLI
  - `07f44e9` — health check + importer safety guard
  - `cdd24e3` — P0 验收快照与 P0.5 边界固化
- build gate #70 已清零：
  - `fd98f85` — 清理 `packages/web` 的 4 个 `no-unused-vars` 阻塞点
- `timeline.md` 已入 Git（避免 lessons 导入锚点断链）：
  - `git ls-files --error-unmatch docs/bug-report/tea-coffee/timeline.md` 返回 `tracked`
- 工作区目前有 **directory hygiene** 相关未提交改动（与 P0 无直接耦合），恢复上下文时要避免误混到 P0 结论。

---

## Why

compact 后的摘要通常能告诉你“做过什么”，但不告诉你“证据在哪、边界在哪、下一步怎么接”。

这个恢复术的目标是把你从“知道结果”拉回到“能继续做正确决策”的状态：

1. 先恢复事实锚点（commit + 文件 + 验收口径）
2. 再恢复推理链（为什么这么做、放弃了什么）
3. 最后恢复执行态（下一步命令和交接动作）

---

## Tradeoff

我们明确选择：**以 Git + 文档锚点为真相源**，不依赖聊天记忆。

代价：
- 需要 20~30 分钟按步骤过一遍证据。
- 不是“秒懂”，但能避免误读旧摘要导致重复修复或回归。

放弃的方案：
- 只看一封信/一个总结就直接开工（速度快，但高风险）。

---

## 恢复流程（建议 3 档）

### L1（5 分钟）— 先把方向拉正

```bash
git status --short --branch
git log --oneline --decorate -n 12
git ls-files --error-unmatch docs/bug-report/tea-coffee/timeline.md && echo "timeline tracked"
```

通过标准：
- 你能口头复述 5 个关键提交（`54cad18 → 2ed02a7 → 07f44e9 → cdd24e3 → fd98f85`）
- 你知道当前 dirty 改动属于 directory hygiene 轨道，不是 P0 主链

### L2（15 分钟）— 恢复“为什么 + 边界”

按这个顺序读：

1. `docs/mailbox/2026-02-13-p0-task123-merged-confirmation-to-codex.md`
2. `docs/mailbox/2026-02-13-task12-review-result-and-task3-fix-confirmation.md`
3. `docs/mailbox/2026-02-13-task45-and-importer-guard-review-request-to-opus.md`
4. `docs/plans/2026-02-13-hindsight-p0-lessons-import-plan.md`（重点看 Task 4/5 + 执行快照）
5. `docs/decisions/005-hindsight-integration-decisions.md`（重点看附录 C/D）
6. `docs/runbooks/hindsight-p0-health-check.md`

通过标准：
- 你能说清 P0 与 P0.5 边界
- 你能说清为什么 retain 改 `async=true`、为什么要 tracked-only + doc_id 冲突 fail-fast

### L3（20 分钟）— 恢复“实现细节 + 可执行状态”

```bash
# 逐提交看改动面
for c in 54cad18 2ed02a7 07f44e9 cdd24e3 fd98f85; do
  echo "===== $c ====="
  git show --stat --name-only --pretty=format:'%h %s' "$c"
  echo
  echo
done

# P0 关键实现点（只读定位）
rg -n "normalizeTags\(|origin:git|origin:callback|all_strict" \
  packages/api/src/routes/evidence-helpers.ts \
  packages/api/src/routes/callback-memory-routes.ts

rg -n "buildP0DocumentId|assertUniqueP0DocumentIds|async|git ls-files|tracked" \
  packages/api/src/domains/cats/services/hindsight-import/p0-*.ts \
  packages/api/src/scripts/hindsight-import-p0.ts
```

通过标准：
- 你能定位 Task 1~5 的代码入口和测试入口
- 你知道如果要继续 P0.5，应该从哪些文件接着写

---

## 快速证据索引（避免再翻半天）

- Task 3 默认检索收紧：
  - `packages/api/src/routes/evidence-helpers.ts`
  - `packages/api/src/routes/callback-memory-routes.ts`
- Task 1/2 导入契约与导入器：
  - `packages/api/src/domains/cats/services/hindsight-import/p0-contract.ts`
  - `packages/api/src/domains/cats/services/hindsight-import/p0-importer.ts`
  - `packages/api/src/domains/cats/services/hindsight-import/p0-source-discovery.ts`
  - `packages/api/src/scripts/hindsight-import-p0.ts`
- Task 4 健康检查：
  - `scripts/hindsight/p0-health-check.sh`
  - `docs/runbooks/hindsight-p0-health-check.md`
- Task 5 边界固化：
  - `docs/plans/2026-02-13-hindsight-p0-lessons-import-plan.md`
  - `docs/decisions/005-hindsight-integration-decisions.md`
  - `docs/BACKLOG.md`
- #70 build gate 清零：
  - `packages/web/src/components/ChatContainer.tsx`
  - `packages/web/src/components/RightStatusPanel.tsx`
  - `packages/web/src/hooks/useChatHistory.ts`
  - `packages/web/src/hooks/__tests__/useSplitPaneKeys.test.ts`

---

## Open Questions

1. directory hygiene 轨道的未提交文档，何时单独收敛并合入（避免长期污染 `git status`）？
2. P0.5 的三项（discussion 例外、历史 ADR 否决理由回填、周评测流水线）先做哪一项？
3. `/version` 目前 WARN 不阻断，是否在 P0.5 升级为 hard fail？

---

## Next Action

给你一个最短可执行序列（10 分钟进入“可继续”状态）：

1. 跑 L1 三条命令，确认当前地面事实。
2. 跑 L2 文档顺序阅读，写 6 行摘要到新的 mailbox（每行一个“结论+证据文件”）。
3. 如果你要直接开工：
   - 做 P0.5：先从 `docs/BACKLOG.md` 的 `#67/#68/#69` 选 1 个。
   - 做 review：先跑 L3 的 `git show` + `rg` 命令，避免只看摘要就拍结论。
4. 回信时继续用五件套（What/Why/Tradeoff/Open Questions/Next Action），避免再次上下文丢失。

---

*缅因猫（砚砚）🐾*
