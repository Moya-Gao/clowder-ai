---
capsule_id: "F141-2026-03-27"
context: "F141 GitHub Repo Inbox — webhook 发现 + reconciliation 补偿 + triage 配套闭环"
feature_ids: [F141]
doc_kind: capsule
created: 2026-03-27
---

## What Worked

- 三层架构切分清楚：F141 只做“发现层”，认领交给 triage / `cat_cafe_register_pr_tracking`，后续追踪交给 F140，避免一个 feature 同时吞发现、认领、追踪三套职责
- Phase A 和 Phase B 的双层去重边界定得准：transport dedup 处理 GitHub delivery 重放，business dedup 处理 reconciliation 重扫，避免两种语义互相污染
- Design Gate 提前把 raw body HMAC、统一 connector id、thread binding、deliver 后 trigger 等高风险 wiring 钉死，后面实现虽有修补，但没有偏航
- `ownership-gate.md` + `repo-inbox.md` 把“默认存疑、主人翁五问”落成可执行 SOP，发现层不是简单通知，而是带着明确 triage 约束进入后续流程

## What Failed

- Phase A / B 都合入后，F141 仍停在 `in-progress` / `phase-b-done`，说明 feature close 真相源同步慢了一拍，完成态没有在最后一个 phase merge 后立刻闭环
- Phase B 一度把 owner 环境变量写成了错误的名字，暴露出跨 phase 复用 owner 可见性策略时仍会发生“照着记忆接线”的问题
- Phase B 的“无 binding repo 直接 skip”是显式边界，但这层边界一开始没有在 spec 风险说明里写得足够醒目，导致 review 时被合理地当成潜在缺陷提出

## Trigger Missed

- Phase B merge 后本应立刻触发 `feat-lifecycle` completion，实际拖到铲屎官追问 “Phase C 是什么” 才回头发现 F141 已经没有后续规划、应该 close
- AC-A9/A10 的文档虽然已经存在，但桥接细节和完成态 checkbox 还经历了一轮补写，说明“文档已创建”不等于“close-ready”

## Doc Links

- Feature spec: `docs/features/F141-github-repo-inbox.md`
- Related: `docs/features/F139-unified-schedule-abstraction.md`, `docs/features/F140-github-pr-automation.md`
- Skill refs: `cat-cafe-skills/refs/ownership-gate.md`, `cat-cafe-skills/refs/repo-inbox.md`
- PRs: #755 (Phase A), #759 (AC-A9/A10 bridge docs), #762 (Phase B)

## Rule Update Target

- `feat-lifecycle/SKILL.md` Completion：补一句显式检查项——“如果最后一个已规划 phase 已 merge，且没有已确认的后续 phase，必须同轮完成 `Status: done` / BACKLOG 移除 / reflection capsule”
- `merge-gate/SKILL.md` Step 7.5：多 phase feature 在最后一个 phase merge 后，不只同步 phase 进度，还要判断是否已经到 feature close 条件
