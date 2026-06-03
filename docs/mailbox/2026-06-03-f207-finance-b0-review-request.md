---
doc_kind: review-request
feature_ids: [F207]
topics: [finance, mcp, provider-stack, snapshot, ttfund, fred]
created: 2026-06-03
author: codex
reviewer: opus
branch: feat/f207-finance-b0
review_target_id: f207
---

# F207 Finance B0 Review Request

**Review-Target-ID:** f207  
**Branch:** `feat/f207-finance-b0`  
**Base:** `origin/main` at `e710d8d70`  
**Author:** 砚砚 / GPT-5.5  
**Requested reviewer:** 宪宪 / Opus 4.6

## Original Requirements

Source: current F207 finance thread, 2026-06-03.

> "还是先把 S5 MCP 连通性单独验个快速 spike 有必要吗？ @codex 你和宪宪一起完成这些东西包括f207的coding"
> "哈哈哈 13天过去了！我忘记喊你们跑了！ 哈哈哈 今天跑跑看 然后我们把f207搞起来！"

## What

Implemented F207 Phase B0 as a small read-only finance fact layer:

- Added `@cat-cafe/finance` with `FinanceFactEnvelope`, deterministic `snapshot_id`, source metadata, `presentationHint`, and `queriesInLast7Days`.
- Added ttfund and FRED provider adapters. Provider responses are wrapped into normalized envelopes; credentials are not persisted in facts.
- Added MCP tool `cat_cafe_finance_query`.
- Registered finance query on the full MCP server and readonly whitelist.
- Kept finance query out of the collab split server.
- Rejected mutation-capable ttfund skills at wrapper boundary.

Commits:

- `1edeaa095` — docs(F207): plan finance data B0
- `d2375d73e` — feat(F207): add finance fact layer
- `f8d5cba7d` — feat(F207): expose finance query MCP wrapper

## Why

F207 Phase B needs cats to stop calling raw finance providers directly. The B0 slice creates the stable contract that later analysis/reporting layers can trust:

- replayable decisions via `snapshot_id`;
- explicit `source`, `sourceTier`, `asOf`, and `confidence`;
- AUDHD guardrails via compact presentation hints and query-frequency metadata;
- a single read-only MCP boundary that excludes buy/sell/transfer/broker/bank operations.

## Tradeoff

Chosen path: thin `packages/finance` fact layer plus one MCP wrapper.

Deferred intentionally:

- No Hub UI or settings UI.
- No SQLite cache yet.
- No yfinance/AKShare adapters yet.
- No reports, cron jobs, or CVO approval flow.
- No raw provider MCP exposure.

Reason: B0 is contract-first. Building cache/UI/reporting before the envelope and readonly boundary would make later Phase C/D depend on unstable provider shapes.

## Open Questions

Technical:

1. Should `cat_cafe_finance_query` remain in readonly whitelist long-term once cache persistence lands?
2. Should the ttfund readonly allowlist include `FUND_GROUP_BACKTEST`, or keep it excluded because it can behave like portfolio simulation/mutation?
3. Should `FinanceFactEnvelope.data` stay raw provider payload for B0, or should v0.2 introduce per-source normalized sub-schemas?

Value:

- None for this review. No trade execution, paid-provider expansion, or user-visible investment recommendation is introduced.

## Architecture Ownership

Architecture cell: `finance-data`  
Map delta: `new cell required`  
Why: F207 creates a new read-only external finance fact layer that is distinct from Memory and Action Plane.

Files:

- `docs/architecture/ownership/cells/finance-data.md`
- `docs/architecture/ownership/README.md`

## Quality Gate Report

Spec: `docs/features/F207-personal-finance-infra.md`  
Plan: `docs/plans/2026-06-03-f207-finance-b0.md`  
检查时间: 2026-06-03

### Function Coverage

| Requirement | Status | Evidence |
|---|---:|---|
| Normalized fact envelope with `source/asOf/confidence/sourceTier/snapshot_id` | ✅ | `packages/finance/test/fact.test.js`, `packages/finance/test/providers.test.js` |
| `presentationHint` and `queriesInLast7Days` for AUDHD guardrails | ✅ | `packages/finance/test/fact.test.js` |
| ttfund adapter does not leak API key into facts | ✅ | `packages/finance/test/providers.test.js` |
| FRED adapter returns official-source metadata | ✅ | `packages/finance/test/providers.test.js` |
| MCP wrapper rejects mutation-capable ttfund skills | ✅ | `packages/mcp-server/test/finance-tools.test.js` |
| `cat_cafe_finance_query` registered on full MCP server | ✅ | `packages/mcp-server/test/tool-registration.test.js` |
| readonly whitelist includes finance query | ✅ | `packages/mcp-server/test/tool-registration.test.js` |
| collab split server excludes finance query | ✅ | `packages/mcp-server/test/tool-registration.test.js` |

### Verification Commands

Passed:

```bash
pnpm --filter @cat-cafe/finance test
pnpm --filter @cat-cafe/mcp-server lint
pnpm --filter @cat-cafe/mcp-server test -- test/finance-tools.test.js test/tool-registration.test.js
pnpm biome check packages/finance packages/mcp-server/src/tools/finance-tools.ts packages/mcp-server/src/tools/index.ts packages/mcp-server/src/server-toolsets.ts packages/mcp-server/test/finance-tools.test.js packages/mcp-server/test/tool-registration.test.js --diagnostic-level=error
pnpm check:architecture-ownership
node scripts/check-hotfix-pattern.mjs
```

`@cat-cafe/mcp-server` test result: 242 tests, 29 suites, 0 failures.

`pnpm check:architecture-ownership` exits 0 with existing warning-only findings outside this slice. No `finance-data` stale anchors after implementation files were added.

### Dogfood-Your-Slice

Scope verdict: ✅ 必做 — new MCP tool / cat-visible path.

Dogfood path:

```bash
bash -lc 'set -a; source .env.local; set +a; node --input-type=module ... handleFinanceQuery({ provider: "ttfund", ttfund: { skillId: "FUND_SEARCH", payload: { query: "沪深300", search_type: "fund" }}})'
```

Redacted output:

```json
{
  "provider": "ttfund",
  "source": "FUND_SEARCH",
  "sourceTier": "official-gateway",
  "asOf": "2026-06-03",
  "snapshot_id": "fin_4b1d6eab4db0da552026a08d",
  "queriesInLast7Days": 0,
  "presentationHint": {
    "detailLevel": "compact",
    "compactSummary": true,
    "avoidWords": ["紧急", "立刻", "马上买", "马上卖"]
  },
  "dataKeys": ["code", "message", "data"],
  "leakedCredential": false
}
```

### Fallback Layer Self-Check

`node scripts/check-fallback-layers.mjs` triggered on broad `??` / `try-catch` heuristics.

Judgment: acceptable, not a wrong-coordinate patch.

- `packages/finance/src/providers/*`: env/default provider options are dependency-injection seams for tests and local credentials, not recovery fallbacks.
- `packages/finance/src/frequency.ts`: default `now` and empty event lists are local deterministic defaults.
- `packages/mcp-server/src/tools/finance-tools.ts`: handler `try/catch` is the MCP error boundary; provider defaulting is the intentional wrapper seam.

Could a coordinate transform remove these? Not without making provider adapters harder to test or leaking provider errors outside the MCP boundary. Keep as-is.

### Design / Artifact Hygiene

- Frontend/UI: none.
- `.pen` design match: none.
- Root media/design artifacts in worktree: none.
- Root media/design artifacts in committed diff: none.

## Review Focus

Please review:

1. Security boundary: no credentials leak, no trading/mutation provider path exposed.
2. MCP registration: full server + readonly whitelist are correct; split collab server remains clean.
3. B0 scope: whether the thin `packages/finance` contract is enough for Phase C/D to build on.
4. Fallback self-check: whether the provider defaults / MCP catch boundary are acceptable or need redesign.

## Next Action

Please review branch `feat/f207-finance-b0`. If approved, I will handle review feedback and then enter merge gate.
