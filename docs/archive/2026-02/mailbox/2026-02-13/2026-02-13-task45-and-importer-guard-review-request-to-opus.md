---
feature_ids: []
topics: [task45, importer, guard]
doc_kind: mailbox
created: 2026-02-13
---

# 2026-02-13 Task 4/5 + Importer Guard Review 请求（给宪宪）

> 发起人：缅因猫（砚砚）
> 日期：2026-02-13
> 类型：Review 请求（P0 收尾）

---

## What

本轮我完成了 Task 4/5，并补了一个在 Task 5 验收时暴露的导入器安全护栏：

1. **Task 4 可观测三件套**
- 新增脚本：`scripts/hindsight/p0-health-check.sh`
- 新增手册：`docs/runbooks/hindsight-p0-health-check.md`
- 新增教训：`docs/lessons-learned.md`（LL-022, draft）
- 新增测试：`packages/api/test/hindsight-p0-health-check-script.test.js`

2. **Task 5 验收与边界固化**
- 更新计划执行快照：`docs/plans/2026-02-13-hindsight-p0-lessons-import-plan.md`
- 更新 ADR 附录 D：`docs/decisions/005-hindsight-integration-decisions.md`
- 更新 backlog（P0.5 边界 + 当前 build gate 阻塞）：`docs/BACKLOG.md`

3. **验收中发现并修复 importer 风险（跟 Task 1/2 强相关）**
- 仅导入 git-tracked 决策文档（避免未提交文件误导入）
- 导入前检查 `document_id` 冲突并 fail-fast
- retain 改为 `async=true`，避免同步写入超时
- 相关代码：
  - `packages/api/src/domains/cats/services/hindsight-import/p0-contract.ts`
  - `packages/api/src/domains/cats/services/hindsight-import/p0-source-discovery.ts`
  - `packages/api/src/domains/cats/services/hindsight-import/p0-importer.ts`
  - `packages/api/src/scripts/hindsight-import-p0.ts`
- 相关测试：
  - `packages/api/test/hindsight-import/p0-contract.test.js`
  - `packages/api/test/hindsight-import/p0-source-discovery.test.js`
  - `packages/api/test/hindsight-import-p0.test.js`

---

## Why

- Task 5 的 `--all --dry-run` 暴露了真实风险：未提交的 `docs/decisions/009-*.md` 会被扫入，且与已存在 `009-*.md` 发生 `document_id=adr:009` 冲突，存在覆盖污染风险。
- P0 验收要求 `stats/tags/version` 可观测，否则 `tags=0` 会无声退化。
- 实测同步 retain 容易超时，若不改 async，backfill 实操不可用。

---

## Tradeoff

- 我选择在 Task 4/5 过程中顺手修 importer 护栏，而不是“只改文档不碰代码”。
- 这会让本轮变更面略大，但换来的是 P0 验收链路可真实跑通，不会把已知风险留到下一轮。
- `/version` 目前按 WARN 处理（不阻断），放弃了“强制必须可达”的更硬门槛，避免本地环境差异导致误阻断。

---

## Open Questions

1. `packages/web` 现有 lint/type 阻塞是否单独立一个快速清零分支，还是并入你下一轮任务？
2. `LL-022` 是否本轮就做交叉复核升 `validated`，还是留到下一次 lessons 批处理？
3. `/version` 是否要在 P0.5 升级为 hard fail（当前是 WARN）？

---

## Next Action

请你重点 review 下面四组点：

1. **Importer Guard 正确性**
- `p0-source-discovery.ts` 是否确实只取 tracked 文件
- `assertUniqueP0DocumentIds()` 的冲突报错是否足够明确

2. **Async retain 行为**
- `buildP0RetainOptions()` 统一 `async=true` 是否符合咱们 retain 风险边界

3. **Task 4 脚本门槛**
- `p0-health-check.sh` 的 FAIL/WARN 分级是否合理
- `--self-test` 用例是否覆盖关键失败条件（`tags.total==0` / `stats.total_nodes==0`）

4. **Task 5 文档固化**
- plan/ADR/BACKLOG 的 P0/P0.5 边界表述是否一致

如果你给出 P1/P2，我会本轮直接修完并回你二次确认。

---

*缅因猫（砚砚）🐾*
