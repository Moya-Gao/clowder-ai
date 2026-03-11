---
capsule_id: "F094-2026-03-11"
context: "Feature 文档债务清理 — 97 份文档全量迁移到黄金模板标准"
feature_ids: [F094]
doc_kind: capsule
created: 2026-03-11
---

## What Worked
- 审计脚本先行（`audit-feature-doc-template.mjs`）让整个迁移有量化基线和可复跑的验证，Green/Yellow/Red 三档清晰，每批改完重跑审计立刻看到进度
- "只增不删"铁律守住了：97 份文档迁移零内容丢失，所有原始文本保留，只做格式壳层补齐
- 砚砚（Codex）执行 Phase B 七批迁移，节奏稳定（每批 ~15 份，review → 放行 → 下一批），全程无需铲屎官介入审批
- 分工清晰：砚砚写审计脚本 + 批量执行，我做架构把关 + 逐批抽查放行，GPT-5.4 做愿景守护
- Phase C（BACKLOG 对齐）砚砚在 Phase B 合入后 10 分钟内就开好 worktree 完成了，说明流程已经跑顺

## What Failed
- Phase B PR #359 合入时遇到 4 个文件冲突（F021/F058/F066/F087）——因为 main 上其他 PR 同时在改这些 feature 文档的状态行。应该在大批量文档修改开始前和其他进行中的 PR 协调
- 云端 review 打了 3 轮才通过（P1: F085 状态错误, P2: CRLF 正则），说明 Phase B 收尾时的手动状态判断不够可靠——应该用 `check:features` 做 pre-commit 门禁
- F032/F042/F053 连续出现"重复状态行"同类 P2——第一次发现后应该立即加批量检查（`grep -c "^> \*\*Status"` > 1 的文件），而不是等每批 review 时逐个抓
- feat-lifecycle close 闭环没做完就声称 done：README completed 索引没补、reflection capsule 没写、index.json stale——被 GPT-5.4 愿景守护抓了 3 个 P1

## Trigger Missed
- 应该在 Phase B 开始前建一个"防回归 checklist"（重复状态行、CRLF、状态与 BACKLOG 一致性），而不是靠 reviewer 人眼抓
- feat-lifecycle completion 的 Step 4（README 索引 + reflection capsule）应该做成 `check:features` 的一部分，自动化检查而非依赖记忆
- 大批量文档修改（100+ 文件）应该有"冲突风险评估"步骤——看看同时有哪些 PR 在改同一批文件

## Doc Links
- [F094 聚合文件](../features/F094-feature-doc-debt-cleanup.md)
- [PR #359 Phase A+B](https://github.com/zts212653/cat-cafe/pull/359)
- [PR #363 Phase C](https://github.com/zts212653/cat-cafe/pull/363)
- [审计脚本](../../scripts/audit-feature-doc-template.mjs)
- [黄金模板](../features/TEMPLATE.md)
