# F087 Phase C: Bootcamp Runtime Orchestration

**Feature:** F087 — `docs/features/F087-cvo-bootcamp.md`
**Goal:** Make the bootcamp actually work end-to-end — user clicks "start bootcamp" → cats guide through all phases → bootcamp complete.
**Acceptance Criteria:**
- [ ] AC-A2: 猫猫天团轮流登场自我介绍（宪宪→砚砚→烁烁，各自风格）
- [ ] AC-A5: 用户从头到尾走完 feat lifecycle（立项→设计→开发→review→完成）
- [ ] AC-A6: 过程中用户做了 ≥3 次 CVO 决策
- [ ] AC-A12: 训练营完成后线程保持可用，用户以后可回来找猫猫求助
**Not building:** AC-A8 成就系统（Phase D, 依赖 F075）, AC-A11 Kokoro 推荐（Phase D）
**Architecture:** Inject threadId into bootcamp prompt → cats use existing MCP tools to advance state. Update bootcamp-guide skill with concrete tool-call sequences per phase. Add callback for interactive block selections to auto-update bootcampState.
**Tech Stack:** TypeScript, Fastify, MCP tools, SystemPromptBuilder
**前端验证:** No — Phase C is backend orchestration, no new UI components.

---

## Straight-Line Check

**Finish line:** A user starts bootcamp → cat auto-advances through Phase 0-11 using MCP tools → bootcampState reflects progress at each step → interactive blocks (cat/task selection) update state automatically.

**Terminal schema:** `BootcampStateV1` (already exists) — no new types needed.

## Analysis: What's Already Built vs What's Missing

| Component | Status | Gap |
|-----------|--------|-----|
| Frontend card-grid rendering | ✅ | — |
| Interactive block selection → text message | ✅ | — |
| `update_bootcamp_state` MCP tool | ✅ | — |
| `bootcamp_env_check` MCP tool | ✅ | — |
| `multi_mention` MCP tool | ✅ | — |
| SystemPromptBuilder bootcamp injection | ⚠️ | Missing `threadId` — cat can't call tools |
| Bootcamp-guide skill phase instructions | ⚠️ | Needs concrete tool-call sequences per phase |
| Selection → state update automation | ❌ | No callback to parse "我选 宪宪" → leadCat=opus |
| Thread pinning on completion | ❌ | No API for pinning thread |

## Tasks

### Task 1: Inject threadId into bootcamp prompt

SystemPromptBuilder injects `🎓 Bootcamp Mode: phase=X leadCat=Y` but cats need `threadId` to call `update_bootcamp_state`. Without it, the cat literally cannot advance the bootcamp.

**Files:**
- Modify: `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts:522-530`
- Modify: `packages/api/src/domains/cats/services/context/types.ts` (if threadId not in PromptContext)
- Test: `test/system-prompt-builder.test.js`

**Change:** Add threadId to the injected line:
```
🎓 Bootcamp Mode: thread={threadId} phase={phase} leadCat={leadCat} task={selectedTaskId}
```

**Steps:**
1. Check if threadId is already available in PromptContext (likely passed from route handler)
2. Write failing test: bootcamp prompt includes threadId
3. Add threadId to the bootcamp injection line
4. Run `node --test test/system-prompt-builder.test.js` — verify pass
5. Commit

### Task 2: Interactive block selection → bootcamp state callback

When user selects a cat (Phase 0) or task (Phase 4) via interactive card-grid, the selection text arrives as a message. Currently, the cat must manually parse it and call `update_bootcamp_state`. Better: add a server-side hook that auto-updates bootcampState when a bootcamp interactive block selection is detected.

**Files:**
- Modify: `packages/api/src/routes/callbacks.ts` or new file `packages/api/src/domains/cats/services/bootcamp/selection-handler.ts`
- Test: `packages/api/test/bootcamp-selection.test.js`

**Approach:** In the message receive path, check if the message matches a bootcamp block `messageTemplate`. If so, extract the selection value and auto-update bootcampState.

Alternatively (simpler): The `InteractiveBlock.tsx` already sends the raw selection text. The cat can parse "我选 宪宪 当我的引导猫！" → look up option label "宪宪" → find value "opus" → call `update_bootcamp_state(threadId, leadCat='opus')`. This is **already possible** with the skill instructions — no code needed.

**Decision: Skip server-side automation.** The cat reads the selection message, matches it against the block options (which are defined in the skill), and calls the update tool. This is more robust than regex parsing and works with the existing tool chain.

### Task 3: Update bootcamp-guide skill with complete orchestration

The skill currently has phase descriptions but lacks concrete tool-call sequences. Cats need explicit instructions for each phase transition.

**Files:**
- Modify: `cat-cafe-skills/bootcamp-guide/SKILL.md`

**Key additions per phase:**
- Phase 0: Show cat-selection block → user selects → read selection → `update_bootcamp_state(thread, phase='phase-1-intro', leadCat='{parsed}')`
- Phase 1: `multi_mention(targets=[other two cats], question='...')` → wait for responses → `update_bootcamp_state(thread, phase='phase-2-env-check')`
- Phase 2: `bootcamp_env_check(thread)` → display results → `update_bootcamp_state(thread, phase='phase-3-config-help')` or skip to 3.5
- Phase 3: Help user fix issues → `update_bootcamp_state(thread, phase='phase-3.5-advanced')`
- Phase 3.5: Check TTS/ASR/Pencil → record in advancedFeatures → `update_bootcamp_state(thread, phase='phase-4-task-select')`
- Phase 4: Show task-selection block → user selects → `update_bootcamp_state(thread, phase='phase-5-kickoff', selectedTaskId='{parsed}')`
- Phase 5-10: Normal feat lifecycle, just with bootcamp patience mode
- Phase 11: `update_bootcamp_state(thread, completedAt=Date.now(), phase='phase-11-farewell')`

### Task 4: Thread pinning on bootcamp completion

When bootcamp completes (Phase 11), the thread should be pinned so the user can easily find it later.

**Files:**
- Check: Does `ThreadStore` have a pin method? (F095 added `pinned` field)
- If yes: Add `threadStore.update(threadId, { pinned: true })` to the farewell handler
- If no: Add to update-bootcamp-state callback — when `phase='phase-11-farewell'`, auto-pin thread

**Steps:**
1. Check ThreadStore for pin capability
2. Add auto-pin logic in callback-bootcamp-routes when phase advances to farewell
3. Test: verify thread is pinned after farewell phase
4. Commit

### Task 5: End-to-end integration test

Simulate a full bootcamp flow: create thread → Phase 0 (select cat) → Phase 1 (intros) → Phase 2 (env check) → Phase 4 (select task) → Phase 11 (farewell + pin).

**Files:**
- Modify: `packages/api/test/bootcamp-flow.test.js` (extend existing)

**Steps:**
1. Extend existing flow test with pin verification at Phase 11
2. Run full test suite
3. Commit

---

## Summary

| Task | Type | Effort |
|------|------|--------|
| 1. Inject threadId into prompt | Code (SystemPromptBuilder) | Small |
| 2. Selection → state update | **Skipped** (skill handles it) | — |
| 3. Update skill orchestration | Skill doc | Medium |
| 4. Thread pinning on completion | Code (callback route) | Small |
| 5. Integration test | Test | Small |

Total: 3 code tasks + 1 skill update. Minimal new code — mostly wiring existing pieces together.
