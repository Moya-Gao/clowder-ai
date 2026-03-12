# F105 Phase 3: Collaboration Routing — Implementation Plan

**Feature:** F105 — `docs/features/F105-opencode-golden-chinchilla.md`
**Goal:** Prove that opencode/Golden Chinchilla participates in Cat Cafe's @mention routing and A2A collaboration chain with correct system prompt context injection.
**Acceptance Criteria:**
- AC-12: 金渐层参与 @mention 协作路由
- AC-13: 金渐层可被其他猫 @ 并响应
**Architecture:** The routing pipeline (AgentRouter → route-serial → invoke-single-cat) is already provider-agnostic. opencode is registered in both catRegistry and agentRegistry even with `available: false`. Phase 3 validates the end-to-end chain with integration tests and adds any missing opencode-specific handling in the system prompt context.
**Tech Stack:** Node test runner, existing routing infrastructure
**前端验证:** No — pure backend routing tests

**铲屎官设计确认（Design Gate）:**
1. `available` 保持 `false`，端到端验证后再开 ✅
2. System prompt 注入要做（"你在回答 {initiator} 的问题"上下文）✅
3. Config template 落盘延后 ✅

---

## NOT building

- Config template disk-write (deferred)
- Flipping `available: true` (post-validation)
- UI changes
- Real opencode process tests (contract tests only, like Phase 2)

---

## Task 1: @mention parsing recognizes opencode patterns

**Files:**
- Test: `packages/api/test/opencode-mention-routing.test.js`
- Read: `packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts` (parseMentions)

**Step 1: Write failing test**

Test that parseMentions resolves all 4 opencode mention patterns (`@opencode`, `@金渐层`, `@golden`, `@golden-chinchilla`) to catId `'opencode'`.

**Step 2: Run test — expect FAIL** (test file doesn't exist yet)

**Step 3: Write test implementation**

Use AgentRouter directly with catRegistry. Assert each pattern resolves to `['opencode']`.

**Step 4: Run test — expect PASS** (parseMentions already works from catRegistry)

**Step 5: Test multi-mention with opencode**

Test: `@opus @opencode 帮我分析` resolves to `['opus', 'opencode']` in order.

**Step 6: Run — expect PASS**

---

## Task 2: A2A mention chain detection for opencode

**Files:**
- Test: `packages/api/test/opencode-mention-routing.test.js` (same file, new describe block)
- Read: `packages/api/src/domains/cats/services/agents/routing/a2a-mentions.ts`

**Step 1: Write failing test**

Test that when opus's response contains `\n@opencode` at line start, parseA2AMentions detects it as A2A target `['opencode']`.

**Step 2: Run — expect PASS** (a2a-mentions is pattern-agnostic, uses catRegistry)

**Step 3: Test reverse direction**

Test that when opencode's response contains `\n@opus`, parseA2AMentions(text, 'opencode') returns `['opus']`.

**Step 4: Run — expect PASS**

**Step 5: Test self-mention filtering**

Test that opencode's response containing `@opencode` is filtered out (no self-mention).

**Step 6: Run — expect PASS**

---

## Task 3: System prompt context injection for opencode

**Files:**
- Test: `packages/api/test/opencode-mention-routing.test.js` (same file, new describe block)
- Read: `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts`

**Step 1: Write failing test**

Test that `buildInvocationContext({ catId: 'opencode', directMessageFrom: 'opus', ... })` produces output containing "Direct message from 布偶猫(opus)".

**Step 2: Run — expect PASS** (buildInvocationContext is generic)

**Step 3: Test opencode identity in static prompt**

Test that `buildStaticIdentity('opencode')` produces a valid identity string containing the opencode cat's name/breed info.

**Step 4: Run — expect PASS or FAIL** (may need opencode-specific identity data)

---

## Task 4: OpenCodeAgentService receives routed prompt with system context

**Files:**
- Test: `packages/api/test/opencode-mention-routing.test.js` (same file)
- Read: `packages/api/src/domains/cats/services/agents/providers/OpenCodeAgentService.ts`

**Step 1: Write failing test**

Test that when OpenCodeAgentService.invoke() is called with a prompt that includes system context (prepended identity + invocation context), the CLI args contain the full prompt including "Direct message from" context.

Mock spawnFn to capture the args passed to `opencode run`.

**Step 2: Run — expect PASS** (invoke passes prompt as-is to CLI args)

**Step 3: Test response flows back through routing**

Test that events emitted by the mock opencode process are correctly yielded as AgentMessage objects, including catId = 'opencode'.

**Step 4: Run — expect PASS** (already covered by Phase 1 tests, but verifying in routing context)

---

## Task 5: End-to-end routing integration test

**Files:**
- Test: `packages/api/test/opencode-mention-routing.test.js` (same file)

**Step 1: Write integration test**

Simulate the full chain: message "@opencode 帮我分析代码" → parseMentions resolves to opencode → getService returns OpenCodeAgentService → invoke with system context → mock process responds → response contains catId 'opencode'.

Use mock spawnFn to avoid real process spawn.

**Step 2: Run — expect PASS**

**Step 3: Verify catId consistency**

Assert all yielded messages have `catId: 'opencode'` and the response can be stored/displayed.

**Step 4: Run — expect PASS**

---

## Task 6: Update feature doc + commit

**Files:**
- Modify: `docs/features/F105-opencode-golden-chinchilla.md`

**Step 1: Mark AC-12 and AC-13 as checked with test evidence**

**Step 2: Add Timeline entry for Phase 3**

**Step 3: Commit all changes**

```bash
git add packages/api/test/opencode-mention-routing.test.js docs/features/F105-opencode-golden-chinchilla.md
git commit -m "test(F105): Phase 3 collaboration routing validation — AC-12/AC-13"
```

---

## Verification

```bash
node --test packages/api/test/opencode-mention-routing.test.js  # all pass
node --test packages/api/test/opencode-*.test.js                # full suite green
npx biome check packages/api/test/opencode-mention-routing.test.js  # 0 errors
wc -l packages/api/test/opencode-mention-routing.test.js        # < 350 lines
```
