# Review Request: F168 Phase A — Direction Card Triage Orchestration

Review-Target-ID: f168-phase-a
Branch: feat/f168-phase-a

## What

Phase A backend orchestration for community issue triage:
1. **Triage types** (`TriageEntry`, `ConsensusResult`, `DirectionCardPayload`, `Verdict`, `QuestionResult`) in shared package
2. **Consensus logic** (`resolveConsensus`): both agree → auto-resolve; disagree → escalate to owner; bugfix → single-cat shortcut
3. **TriageOrchestrator**: records entries, manages dual-cat flow (await-second-cat / resolved), routes accepted/declined
4. **API endpoints**: `POST /triage-complete` (cat reports verdict + 5Q), `POST /resolve` (owner accepts/declines)
5. **Dispatch threadId**: frontend passes current thread ID when dispatching issue

## Why

Phase A delivers the backend infrastructure that enables the triage flow described in F168 spec. Cat-side intelligence (5-question evaluation, posting direction card rich blocks, @-ing second cat) lives in the `opensource-ops` skill and uses existing MCP tools (`post_message`, `multi_mention`, `create_rich_block`). This phase builds the **state machine and orchestration** that the cat skill drives.

## Original Requirements

> "我一般会 at 两只猫，因为一只猫视角大概率有偏颇。但如果是二次 review 一般只会一只"
> "卡点只在于这个 issue 和这个 PR 本质我们能不能 intake？除非是 bug fix 这种确定 bug 那你们不用找我"
> "比如是 feat153 的 PR，这个 feat 就是社区小伙伴负责，我们是全丢一个 thread"
> "新来一个假设社区小伙伴的 feat160，此时还没创建 thread，这个新的谁来分配？"

- 来源：`docs/features/F168-community-ops-board.md` lines 18-46（铲屎官原话 2026-04-18）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **Backend-only orchestration vs full end-to-end**: Phase A deliberately scopes to backend infrastructure. Cat-side posting of direction cards and multi_mention calls are handled by existing MCP tools + skill, not re-implemented in the backend.
- **`directionCard` field reuse**: Stored triage data in existing `Record<string, unknown> | null` field with type assertion, avoiding schema migration. Tradeoff: runtime type safety relies on API validation layer.

## Open Questions

1. **Consensus resolution is simple majority**: Both agree = auto, any disagree = escalate. Is this sufficient or should we weight by question scores?
2. **routeAccepted without relatedFeature creates a new thread**: The thread is created via `threadStore.create` — should it also auto-assign a cat (`assignedCatId`)?

## Next Action

Please review the 5 commits on `feat/f168-phase-a` for P1/P2 issues. Focus areas:
- Consensus logic correctness (`resolveConsensus.ts`)
- Orchestrator state transitions (`TriageOrchestrator.ts`)
- API validation completeness (`community-issues.ts` triage-complete + resolve endpoints)

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f168-phase-a/gpt52`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202` (Phase A is backend-only, no frontend changes to visually verify)

## 自检证据

### Spec 合规

| AC | 状态 | 代码位置 | 测试 |
|----|------|----------|------|
| A1 | ✅ | TriageOrchestrator.ts:24-58, triage-complete route | 11 orchestrator tests |
| A2 | ✅ | community-issue.ts types | 8 consensus tests |
| A3 | ✅ | Orchestrator returns await-second-cat; bugfix skips | first entry + bugfix tests |
| A4 | ✅ | resolveConsensus needsOwner; state→pending-decision | disagreement tests |
| A5 | ✅ | routeAccepted with relatedFeature | routeAccepted test |
| A6 | ✅ | routeAccepted → threadStore.create | routeAccepted no-feature test |

### 测试结果

```
pnpm test → 8691 tests, 8690 pass, 0 fail, 1 skipped ✅
pnpm lint → 0 errors ✅
pnpm check → 0 errors ✅
pnpm -r --if-present run build → exit 0 ✅
```

### Artifact Hygiene

根目录工件闸门（工作树 + 已提交差异）: 无 ✅

### 相关文档

- Plan: `docs/plans/2026-04-19-f168-phase-a-direction-card.md`
- Feature: `docs/features/F168-community-ops-board.md`
