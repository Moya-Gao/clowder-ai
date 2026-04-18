---
feature_ids: []
topics: [process-evolution, intake, review-continuity, merge-gate]
doc_kind: note
created: 2026-04-17
knowledge:
  artifact_type: proposal
  domain: development
  scope: team-shared
  trust_level: experimental
  lifecycle: accepted
  knowledge_type: procedural
  provenance:
    author_type: agent
  source_refs:
    - global:memory/Users-lysander-projects-relay-station-cat-cafe/feedback_intake_review_on_github
    - global:memory/Users-lysander-projects-relay-station-cat-cafe/feedback_cloud_review_inline
    - LL-033
    - https://github.com/zts212653/cat-cafe/pull/1239#issuecomment-4271734777
    - https://github.com/zts212653/cat-cafe/pull/1239#issuecomment-4271778598
---

# Evolution Proposal: Intake Review Head Continuity Guard

## Proposal ID: EP-001

## 5-Slot Template

**Trigger:** cat-cafe#1239 的 intake absorb PR 在 reviewer 已 formal 放行后，又因为 merge-gate rebase + feature index regeneration 产生了新 HEAD，作者和 reviewer 需要临场补一次“放行延续到新 SHA”的口径确认，暴露出 intake review 和 merge-gate 之间缺少显式的 HEAD 连续性护栏。

**Evidence:**
- PR #1239 的 formal review 先在 `0cba7fd3e..324a3c974` 范围内放行，之后 merge-gate 把 HEAD 推进到 `2c7351b6`，需要 reviewer 再确认放行延续到新 HEAD（GitHub issuecomment `4271778598` + thread 回执）。
- `merge-gate` 已有“Review 针对当前分支/当前工作”的原则，但缺少可执行规则，没把“rebase/fixup 后 review 失效，需显式延续或重审”写成步骤。
- `opensource-ops` inbound PR ref 已要求 reviewer 在 GitHub 留 formal review comment，但没要求 author 在进入 merge-gate 前核对“review 覆盖的是当前 HEAD 吗”。
- 现有记忆已经明确两个相邻教训：review 必须留在 GitHub（`feedback_intake_review_on_github`），云端 review 不能只看 review body、还要看 inline comments（`LL-033` / `feedback_cloud_review_inline`）。这次事故说明 review evidence 不只要“存在”，还要“绑定到当前 HEAD”。

**Root Cause:** 当前 SOP 把“有 review”当成布尔量，却没有把“review 覆盖的 commit SHA”和“merge 时的当前 HEAD SHA”做显式绑定。结果一旦 merge-gate 里的 rebase、fixup、feature index regeneration 改变了 HEAD，就只能靠猫临场记忆判断旧 review 是否还能沿用。

**Lever:** 最小有效杠杆是同时改两处现有流程资产，而不是新发明一套 intake 流程：
1. 在 `merge-gate` 里把“review 绑定当前 HEAD”写成硬门和常见错误。
2. 在 `refs/opensource-ops-inbound-pr.md` 的 Intake Review Guard 里补一条操作规则：review 后只要 HEAD 变了，author 必须拿到 reviewer 对新 SHA 的显式延续，或重新 review；同时 handoff 时强制带当前 HEAD SHA。

**Verify:**
- 接下来 3 个 absorb PR / intake PR 中，不再出现 reviewer 先放行、merge-gate 再 rebase 后需要 thread 临场追认的情况。
- merge 前 thread/PR comment 能直接看到“当前 HEAD SHA + review 覆盖状态”，无需二次口头澄清。
- 如果 HEAD 变化只涉及非行为性 delta（如 `docs/features/index.json` regenerate），reviewer 可以在 PR 上显式延续到新 SHA；如果涉及行为变化，能自动触发重审而不是靠感觉。

## Status

- [x] proposed
- [x] accepted → linked commit/PR: working tree patch on 2026-04-17
- [ ] 30-day replay check: ____
- [ ] validated / rejected / superseded

## Use Log

<!-- append-only: date | agent | outcome | notes -->
<!-- 2026-04-17 | gpt52 | proposed | cat-cafe#1239 暴露了 intake review→merge-gate 的 HEAD 连续性缺口 -->
<!-- 2026-04-17 | gpt52 | accepted | CVO 明确批准落地到 merge-gate + inbound intake refs -->
