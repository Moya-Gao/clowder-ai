---
feature_ids: [F168]
topics: [role-registry, narrator, review-request]
doc_kind: mailbox
created: 2026-06-13
---

# Review Request: F168 Phase C C1 — Role Registry + RoleResolver

Review-Target-ID: f168-c1
Branch: feat/f168-c1-role-registry

## What
PR-1 of Phase C (3-PR plan). The Role Registry contract + 家里 implementation + a hard-layer guard.
4 commits:
- **C1.1** `c2627e51d` — `packages/shared/src/types/community-role.ts`: `CommunityRole` closed union {narrator, case-owner, reconciler} + `RoleCapability` (excludes code/merge/worktree by construction) + `RoleExecutor`/`RoleResolver` interfaces + `isCommunityRole`/`isRoleCapability` fail-closed guards. Barrel-exported.
- **C1.2** `dccf9acb8` — `packages/api/src/domains/community/RoleResolver.ts`: `createRoleResolver(getRoster, bindings, deps?)` injectable factory (ActorResolver-style). Fail-closed `resolve()` → null + observable reason (unknown-role / unbound / cat-not-in-roster / cat-unavailable). `DEFAULT_COMMUNITY_ROLE_BINDINGS`: narrator → gemini25, model gemini-3.5-flash.
- **C1.3** `2c036aaeb` — `packages/api/test/community/engine-no-catname.guard.test.js`: source-level guard over `domains/community/*.ts` — rule A (no getRoster import) + rule B (no hardcoded cat id), with documented allowlists.
- `4ecaba77a` — registers RoleResolver in the community-ops ownership cell.

## Why
> "烁烁35 做 triage 好，但别人家可能用 glm5.1——不能硬编码" → Role Registry：引擎只认识 `narrator`/`case-owner`/`reconciler`；role→(cat,model,prompt) 绑定在 deployment 配置.

The community engine must route by ROLE, never cat name (INV-6) — so 别人家 can run their own catalog (多租户解耦是硬约束). C1 is the contract + binding layer + the guard that locks the invariant. C2 (narrator spawn) consumes RoleResolver; C3 (F128 routing) + eval follow.

## Original Requirements（必填）
> 来源：`docs/discussions/2026-06-09-f168-community-ops-final-design.md` §4（line 31-32）
> - "烁烁35 做 triage 好，但别人家可能用 glm5.1——不能硬编码" → 引擎只认角色，role→cat 绑定在配置
> - "和 clowder-ai 解耦点——别人用这个能力管他们的开源社区" → 引擎 repo/cat/brand-agnostic
- **请对照判断：C1 是否真正让引擎"零猫名"，且 binding 真的可换（满足"可选+解耦"硬约束）。**

## Tradeoff
- **model lives in the binding** (not derived from cat-config). Chosen as *intentional role-level pinning* — narrator wants a cheap/fast model regardless of the cat's general default. Mirrors `gemini25.defaultModel`; the comment says update together. Alternative (derive model from cat-config at resolve-time) rejected: roster has no model field, and pulling full cat-config into the resolver couples it more (plan 撤回条件 #2: keep config thin).
- **DEFAULT_COMMUNITY_ROLE_BINDINGS as in-module const** (mirrors ActorResolver's `ACTOR_ROLE_TO_ROSTER_ROLES`), injected at the wiring site. The engine never imports it; it's the binding-layer seam.

## Architecture Ownership（必填）
Architecture cell: community-ops
Map delta: update required → done (registered RoleResolver.ts + community-role.ts in `docs/architecture/ownership/cells/community-ops.md` code_anchors + cited_by Phase C)
Why: RoleResolver is a new sub-component of the existing community-ops cell (no new cell — plan §0).

请 reviewer 检查：
- diff 与 Map delta 一致（cell doc updated, no new cell）
- RoleBinding/CommunityRoleBindings 是 binding-layer config, 不是并行 Store/Queue/Router/Dispatcher

## Open Questions

### 技术 OQ（给 reviewer）
1. **Fail-closed coverage**: are the 4 resolve() failure reasons (unknown-role/unbound/cat-not-in-roster/cat-unavailable) the complete set? The plan's INV-5 也提 F182 soft-degradation (cat unavailable → 降级 alternatives)。我选了 null+warn（最简 fail-closed），alternatives 留给消费方/后续。够吗？
2. **Defensive `isCommunityRole(role)` inside resolve()** — the signature types role as CommunityRole, so the unknown-role branch is "unreachable" per TS, but I keep it for untrusted runtime callers (deserialized/cast strings). Reasonable defense-in-depth, or dead code?
3. **Guard scope**: the C1.3 guard scans `domains/community/` only. routes/community-issues.ts:492/592 getRoster are roster *membership* checks at the HTTP auth boundary (`roster[authorId]`), not role→executor routing — I argue they're correctly outside INV-6's engine scope (push-back on plan's literal "converge community-issues.ts" framing). Agree?

### 价值 OQ（给 CVO）
无 — 全是回滚成本低的技术选择，自决。Phase C 方向/scope 已 CVO signoff（plan line 228）。

## Next Action
Local cross-family review of the diff + the 3 invariants (INV-2 capability ceiling / INV-4 closed set fail-closed / INV-6 engine-zero-catname). After APPROVE → merge-gate (PR + cloud review + squash).

## 预注册撤回条件（我最可能错在哪）
1. **model-in-binding** is the most contestable design choice (P4 drift vs intentional pinning). If you think model must derive from cat-config, attack here.
2. **C1.1 test placement**: I put it in `packages/api/test/community/` (gated suite) instead of `packages/shared/test/` (per plan literal) because shared/test/ is NOT wired into `pnpm test` (orphaned). Wiring all of shared/test risked pulling pre-existing failures into this PR. Defensible?
3. **resolve('bogus') defensive check** — see 技术 OQ #2.

## Review Sandbox
- Path: `/tmp/cat-cafe-review/f168-c1/gpt52`
- Start Command: **N/A — no runtime/frontend.** Verification = build + run the 3 community tests (no server):
  - `pnpm --filter @cat-cafe/shared build && pnpm --filter @cat-cafe/api build`
  - `cd packages/api && node --test test/community/community-role.test.js test/community/role-resolver.test.js test/community/engine-no-catname.guard.test.js`
- Ports: N/A (no server started)

## 自检证据

### Spec 合规
quality-gate passed: AC-C1 (engine 零猫名 — grep guard) + AC-C2 (RoleResolver injected, no getRoster import) delivered. Follow-up tail scan clean. 布偶猫 search→Read: exempt (zero search_evidence; all precise values from direct Read of cat-config.json/source). Dogfood: exempt (pure internal infra, not wired to user/cat path until C2).

### 测试结果
- C1 tests: `node --test test/community/{community-role,role-resolver,engine-no-catname.guard}.test.js` → **19 pass / 0 fail**
- + community regression slice (community-repo-comment-poll) → **27 pass / 0 fail**
- `pnpm lint` (all packages tsc) → exit 0
- `pnpm -r --if-present run build` → exit 0
- `pnpm biome check` (6 files) → 0 issues
- guards: `check:followup-tails` exit 0, `check:fallback-layers` +2 (under threshold), `check:architecture-ownership` exit 0

### 相关文档
- Plan: `docs/plans/2026-06-12-f168-phase-c-narrator-routing.md`（C1.1/1.2/1.3 = line 282-313, SO-2 = line 106-127）
- Final design: `docs/discussions/2026-06-09-f168-community-ops-final-design.md` §4
- Feature: F168
