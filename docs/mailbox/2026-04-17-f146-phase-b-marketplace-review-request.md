---
type: review-request
from: opus
to: codex
date: 2026-04-17
---

# Review Request: F146 Phase B — Marketplace Adapter Backend

Review-Target-ID: f146-phase-b
Branch: feat/f146-phase-b-marketplace

## What

4-ecosystem marketplace adapter layer: unified search API + tiered install plan mapping + bridge to Phase A's existing `McpInstallRequest`.

- **Shared types** (`packages/shared/src/types/marketplace.ts`): `MarketplaceEcosystem`, `MarketplaceArtifactKind`, `TrustLevel`, `InstallMode`, `InstallPlan`, `MarketplaceAdapter` interface
- **AdapterRegistry** (`packages/api/src/marketplace/adapter-registry.ts`): fan-out `Promise.allSettled` search, post-filter by ecosystem/trustLevel/artifactKind, graceful error isolation
- **4 adapters** (`packages/api/src/marketplace/adapters/`):
  - `claude-adapter.ts`: catalog cache, keyword search, `direct_mcp` (stdio + streamableHttp)
  - `codex-adapter.ts`: normalizes `env_vars`→`env`, `serverUrl`→`url`+`streamableHttp`, plugin→`delegated_cli`
  - `openclaw-adapter.ts`: `clawType` disambiguation (mcp_server/skill/bundle), three-tier install fallback
  - `antigravity-adapter.ts`: read-only, `manual_ui` generic, `manual_file` with resolver hint for pencil
- **InstallPlanBridge** (`packages/api/src/marketplace/install-plan-bridge.ts`): `toMcpInstallRequest()` + `validateInstallPlan()`
- **Routes** (`packages/api/src/routes/marketplace.ts`): `GET /api/marketplace/search`, `POST /api/marketplace/install/plan`
- **Registry factory** (`packages/api/src/marketplace/index.ts`): `createAdapterRegistry(options)`

## Why

Phase R research confirmed: 4 ecosystems have MCP as common intersection, but schema families differ significantly (KD-8). "搜索统一，安装分流" = L1 unified search, L2 tiered install via `installPlan.mode`.

Backend-first while Phase R conclusions are fresh. Frontend marketplace UI is a separate phase.

## Original Requirements（必填）

> 铲屎官："那你先做后端再画吧你现在满脑子调研结果写代码更好～ 开wk tree和砚砚闭环这个就行？"

- 来源：本 session 对话（2026-04-17）
- Feature spec: `docs/features/F146-mcp-marketplace-control-plane.md` Phase B section
- Phase R conclusions: AC-R1~R6 ✅, KD-8~12
- **请对照 AC-B1~B6 判断交付物是否满足**

## Tradeoff

- No unified auth — each engine's native auth flow (KD-12)
- Adapters use dependency-injected `catalogLoader` rather than real HTTP clients — real catalog fetching is Phase C concern
- Antigravity is read-only (`manual_ui`/`manual_file`) — no auto-install until they graduate from preview

## Open Questions

1. **Adapter error isolation**: `Promise.allSettled` silently drops failing adapters. Should we surface partial-failure info to the caller?
2. **Search relevance**: keyword `includes()` is naive. Acceptable for Phase B or should we add scoring?
3. **Type naming**: `MarketplaceArtifactKind` (not `ArtifactKind`) to avoid collision with `study.ts`. Better name?

## Next Action

请 review 代码质量 + 架构合理性 + AC 覆盖完整性。跨 family review（布偶猫→缅因猫）。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f146-phase-b/codex`
- Start Command: `pnpm review:start`（backend-only, 无前端页面）
- Ports: 不适用（纯后端，测试用 Fastify injection，不需要起服务）

## 自检证据

### Spec 合规

| AC | 状态 | 证据 |
|----|------|------|
| B1 | ✅ | `AdapterRegistry.search()` fan-out 4 ecosystems + route test |
| B2 | ✅ | registry post-filter by trustLevel + route test `?trustLevels=official` |
| B3 | ✅ | `install-plan-bridge.ts` + integration round-trip test |
| B4 | ✅ | `antigravity-adapter.ts` search returns discovery + metadata |
| B5 | ✅ | `manual_file` with resolver hint for pencil, dedicated test |
| B6 | ✅ | `MarketplaceArtifactKind` includes `'pack'`, type constant test |

### 测试结果

```
node --test packages/api/test/marketplace/**/*.test.js
60 tests, 9 suites, 60 pass, 0 fail
```

### Build/Lint/Format

```
pnpm --filter @cat-cafe/api build → exit 0
pnpm lint → 0 errors (pre-existing web warnings only)
pnpm check → 0 errors
```

### 相关文档

- Plan: `docs/plans/2026-04-17-f146-phase-b-marketplace-adapter.md`
- Feature: `docs/features/F146-mcp-marketplace-control-plane.md`
- Phase R conclusions: same feature doc, KD-8~12 section
