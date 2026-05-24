---
feature_ids: [F203, F198]
topics: [system-prompt, claude-carrier, l0-injection, runtime-validation]
doc_kind: plan
created: 2026-05-24
---

# F203 Claude Carrier L0 Parity Implementation Plan

**Feature:** F203 — `docs/features/F203-native-system-prompt-l0.md`
**Goal:** Make native L0 injection carrier-agnostic for Claude cats so the default `claude -p` carrier and opt-in `claude --bg` carrier both use the compiled L0 system prompt.
**Acceptance Criteria:** `ClaudeAgentService(-p)` compiles per-cat L0 and passes it via `--system-prompt-file`; `ClaudeBgCarrierService(--bg)` remains unchanged in behavior; carrier selection stays controlled by F198 `CAT_CAFE_CLAUDE_CARRIER`; F203 docs record the carrier-parity invariant and AC-C5 requires both Claude carriers to inject compiled L0; tests prove `-p` no longer depends on `options.systemPrompt` for native L0.
**Architecture cell:** harness/system-prompt-injection
**Map delta:** none
**Map delta why:** This fixes an existing provider implementation gap inside the F203 L0 injection path; F198 already models `ClaudeAgentService` and `ClaudeBgCarrierService` as sibling carriers, so no ownership cell boundary changes.
**Architecture:** Reuse the existing `compileL0ViaSubprocess` boundary in `ClaudeAgentService`, mirroring the bg carrier's temp-file injection. Keep carrier mode orthogonal: `-p` vs `--bg` controls execution and billing behavior, not whether F203 L0 is present. Fail closed if L0 compile fails, matching the bg carrier's identity/safety stance.
**Tech Stack:** TypeScript provider services, Claude CLI argv construction, node:test, F203 feature doc sync.
**前端验证:** No — provider argv behavior only. Runtime behavioral probe happens after merge via fresh alpha/runtime invocation.

---

## Finish Line

Default runtime Claude cats can stay on `ClaudeAgentService(-p)` and still receive the compiled native L0. `CAT_CAFE_CLAUDE_CARRIER=bg_daemon` remains an F198 execution-mode canary, not an F203 feature flag.

## Not Building

- No factory default flip from `-p` to `bg_daemon`.
- No F198 billing/canary schedule change.
- No runtime restart in this PR.
- No behavioral alpha probe before merge; local verification stops at argv and tests.

## Spike Result

`claude -p` accepts the hidden `--system-prompt-file <path>` flag on the installed CLI. A non-bare behavior probe was blocked by budget after default prompt cache creation; `--bare` proved unsuitable for subscription OAuth on this machine. Implementation therefore uses the same flag as `ClaudeBgCarrierService`, with unit tests pinning argv construction and fail-closed compile behavior.

## Task 1: Red — Reproduce The Default Carrier L0 Gap

**Files:**
- Modify: `packages/api/test/claude-agent-service.test.js`

**Step 1: Write failing test**

Add a fake L0 compiler and assert `ClaudeAgentService`:
- invokes it with `{ catId, outPath }`
- spawns `claude -p ... --system-prompt-file <compiled-path>`
- does not require `options.systemPrompt` for this native L0 path

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @cat-cafe/api run build
node --test packages/api/test/claude-agent-service.test.js
```

Expected: fail because `ClaudeAgentService` has no `l0CompilerFn` seam and no `--system-prompt-file` argv.

## Task 2: Green — Add L0 Injection To ClaudeAgentService

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/ClaudeAgentService.ts`

**Step 1: Implement minimal parity**

- Import `compileL0ViaSubprocess`.
- Add constructor seam `l0CompilerFn?: typeof compileL0ViaSubprocess`.
- Add private `compileL0ToTempFile()` using `mkdtempSync(join(tmpdir(), 'cat-cafe-l0-'))`.
- In `invoke()`, compile before spawn argv finalization and push `--system-prompt-file <path>`.
- Replace the old unconditional `--append-system-prompt options.systemPrompt` behavior for Claude native L0. If `options.systemPrompt` remains needed for pack-only defense-in-depth, do not let it replace compiled L0.

**Step 2: Run focused test**

```bash
pnpm --filter @cat-cafe/api run build
node --test packages/api/test/claude-agent-service.test.js
```

Expected: new test passes, existing ClaudeAgentService tests remain green.

## Task 3: Red/Green — Fail Closed On L0 Compile Error

**Files:**
- Modify: `packages/api/test/claude-agent-service.test.js`
- Modify: `packages/api/src/domains/cats/services/agents/providers/ClaudeAgentService.ts`

**Step 1: Write failing test**

Assert a compiler error yields one `error` AgentMessage and one `done` AgentMessage, and `spawnFn` is not called.

**Step 2: Implement**

Catch the compile error before spawning and emit provider error + done, mirroring the service's existing CLI-not-found error style while preserving bg carrier's fail-closed invariant.

**Step 3: Run focused test**

```bash
pnpm --filter @cat-cafe/api run build
node --test packages/api/test/claude-agent-service.test.js
```

## Task 4: Routing Contract Update

**Files:**
- Modify: `packages/api/test/agent-router.test.js`

**Step 1: Update test expectation**

The router's native-L0 provider contract must include default Claude `-p` once `ClaudeAgentService.injectsL0Natively()` exists. Keep Gemini/Kimi/etc. on the legacy user-message path.

**Step 2: Run routing tests**

```bash
pnpm --filter @cat-cafe/api run build
node --test packages/api/test/agent-router.test.js
```

## Task 5: Spec Sync

**Files:**
- Modify: `docs/features/F203-native-system-prompt-l0.md`

**Step 1: Add KD-18**

Carrier mode is orthogonal to L0 injection. Both Claude carriers must inject compiled L0; F198 canary controls execution mode only.

**Step 2: Update AC-C1 / AC-C5**

Record `ClaudeAgentService(-p)` parity and make AC-C5 require runtime/alpha probes against the default Claude carrier.

**Step 3: Run docs checks**

```bash
pnpm check:features
git diff --check
```

## Task 6: Quality Gate And Review

**Commands:**

```bash
pnpm --filter @cat-cafe/api run build
node --test packages/api/test/claude-agent-service.test.js packages/api/test/claude-bg-carrier-l0.test.js packages/api/test/agent-router.test.js
pnpm check:features
git diff --check
```

Then request Opus-47 review with the original production-gap report and spike result. Full `pnpm gate` runs before PR merge-gate.
