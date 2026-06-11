---
cell_id: identity-session
title: Identity / Session
summary: Agent identity、connector session binding、bubble identity、runtime session binding、user profile 五个 subcell 的边界。
canonical_features: [F032, F088, F183, F211, F231]
code_anchors:
  - cat-config.json
  - packages/api/src/config/cat-config-loader.ts
  - packages/shared/src/types/cat.ts
  - packages/api/src/infrastructure/connectors/ConnectorThreadBindingStore.ts
  - packages/api/src/infrastructure/connectors/connector-binding-keys.ts
  - packages/api/src/routes/thread-cats-core.ts
  - packages/web/src/debug/bubbleIdentity.ts
  - packages/api/src/domains/cats/services/stores/ports/SessionChainStore.ts
  - packages/api/src/domains/cats/services/runtime-session/RuntimeSessionMetadata.ts
  - packages/api/src/domains/cats/services/runtime-session/RuntimeSessionStore.ts
  - packages/api/src/domains/cats/services/runtime-session/RedisRuntimeSessionStore.ts
  - packages/api/src/domains/cats/services/runtime-session/RuntimeSessionStoreFactory.ts
  - packages/api/src/domains/cats/services/runtime-session/ExternalRuntimeSessionRegistration.ts
  - packages/api/src/domains/cats/services/stores/redis-keys/runtime-session-keys.ts
  - packages/api/src/routes/callback-runtime-session-routes.ts
  - packages/api/src/routes/external-runtime-sessions.ts
  - packages/mcp-server/src/tools/external-runtime-session-tools.ts
  - packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts
  - packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-runtime-session-import.ts
doc_anchors:
  - docs/features/F032-agent-plugin-architecture.md
  - docs/features/F088-multi-platform-chat-gateway.md
  - docs/decisions/033-bubble-pipeline-identity-contract.md
  - docs/features/F211-cross-runtime-session-transparency.md
  - docs/discussions/2026-05-24-f211-design-memo/README.md
  - docs/features/F231-user-profile-capsule.md
static_scan_hints: [catId, AgentRegistry, cat-config, roster, ConnectorThreadBindingStore, bubbleIdentity, session, SessionChainStore, cliSessionId, cascadeId, runtimeSession, capsule, "private/profile"]
cited_by:
  - {feature: F191, date: 2026-05-07, delta: new cell}
  - {feature: F193, date: 2026-05-08, delta: Phase B — typed crossThreadReplyHint field on InvocationContext + render block in buildInvocationContext (receiver-side reply hint hydrated from trigger message id)}
  - {feature: F209, date: 2026-05-22, delta: "boundary note — F209 entity_id is a retrievable entity doorway, not roster truth"}
  - {feature: F211, date: 2026-05-24, delta: "new identity-runtime-session subcell for runtime session identity, cascade/conversation binding, lifecycle registration, seal reason, and identity history"}
  - {feature: F211, date: 2026-05-25, delta: "Phase B external runtime registration/list/read surfaces, hidden anchor threads, and agent-key-only IDE-direct session binding"}
  - {feature: F231, date: 2026-06-11, delta: "new identity-user-profile subcell — per-user profile capsule + relationship primer + breed/instance/user/relationship persona layering; data anchors private/profile/ + .cat-cafe/cat-catalog.json personality (gitignored, per-instance); prompt injection anchor pending Design Gate (OQ-1, ADR-038 L0 budget alignment)"}
---

# Identity / Session

Architecture cell: identity-session

## Canonical Owner

This is a top-level routing cell with five subcells. It exists to prevent identity concerns from becoming a garbage bin.

- `identity-agent`: F032 owns dynamic CatId, roster, AgentRegistry, roles, and reviewer matching.
- `identity-connector`: F088 owns connector principal link and external chat/thread binding.
- `identity-bubble`: F183 / ADR-033 own frontend bubble identity within a thread.
- `identity-runtime-session`: F211 owns runtime session identity and binding for long-lived or external runtimes: cascade/conversation IDs, SessionChainStore bridge records, lifecycle registration, hidden external-runtime anchor threads, seal reason, and per-session identity history.
- `identity-user-profile`: F231 owns per-user profile capsule, relationship primer, and the breed/instance/user/relationship layering of persona data (breed = tracked/shared; instance/user/relationship = per-user private). Private data lives at gitignored paths (`private/profile/`, `.cat-cafe/cat-catalog.json` personality) — intentionally NOT listed in `code_anchors`, which only carries tracked checker-verifiable paths; tracked fixture paths join `code_anchors` in Phase A. Prompt injection anchor pending Design Gate (OQ-1).

F209's entity registry is adjacent but not canonical for agent identity. Its `entity_id` / aliases are retrievable memory anchors with provenance; they may point to cats, humans, features, or external concepts, but they do not decide roster membership, current model, role, reviewer eligibility, or who a cat is.

## Use This When

- Changing who a cat is, how cats are loaded from roster/config, or how cat IDs are validated.
- Changing connector user/chat/thread binding, connector permission ownership, or external sender mapping.
- Changing frontend bubble identity, canonical invocation ID, or bubble kind identity rules.
- Changing runtime session binding, external conversation registration, cascade/session ownership, runtime-session list/read surfaces, or how `cliSessionId` maps to runtime-specific session IDs.
- Changing what cats know about their human at startup: user profile capsule content/injection, relationship primers, or which persona layer (breed/instance/user/relationship) a piece of identity data belongs to.

## Extend By

- For agent identity, update roster/config/schema contracts and keep CatId runtime-dynamic.
- For connector binding, use `ConnectorThreadBindingStore` and connector binding keys instead of ad hoc thread maps.
- For bubble identity, follow ADR-033 and route through `bubble-pipeline` contracts and tests.
- For runtime session binding, use Session Chain / runtime-session metadata keyed by Cat Cafe session id and runtime session id. IDE-direct registration belongs behind the external runtime registration contract and agent-key authorization, not ad hoc JSON maps.
- When a feature touches more than one subcell, declare each one in the feature's Architecture cell note and explain the boundary.
- If a feature consumes F209 `entity_id`, keep the direction one-way: identity/session truth may be referenced as provenance for entity aliases, but entity aliases must not rewrite roster or connector bindings.

## Do NOT Unify With

- `identity-agent` is not `identity-connector`. A roster cat ID does not prove an external user owns a connector binding.
- `identity-connector` is not `identity-bubble`. External chat/thread binding does not decide frontend bubble grouping.
- `identity-bubble` is not `identity-agent`. Bubble identity uses `(catId, canonicalInvocationId, bubbleKind)` inside a thread; it is not the source of roster truth.
- `identity-runtime-session` is not `identity-agent`. A runtime can switch model/profile inside one cascade; the session records identity history but does not decide roster truth.
- `identity-runtime-session` is not `memory`. Memory consumes transcript/digest evidence after runtime sessions are materialized; it does not own active cascade/conversation binding.
- `identity-user-profile` is not `memory`. The capsule is push-mode startup truth (injected every invocation); memory is pull-mode retrievable evidence. Capsule/primer updates are CVO-gated proposals, not automatic memory writes; user facts in per-cat memory do not auto-promote into the capsule (KD-5 data minimization).
- `identity-user-profile` instance/user/relationship layers must never enter tracked shared assets (cat-template.json, public test baselines, outbound sync). Tracked tests verify the overlay mechanism via fixtures only (F231 KD-6).
- F209 `entity_id` is not `identity-agent`. Entity aliases such as `landy` / `CVO` / `铲屎官` or `gemini` / `烁烁` are retrieval anchors, not roster truth.
- `ConnectorThreadBindingStore` is an intentional shared touchpoint with `transport`: transport uses it for routing, while `identity-connector` uses it as the binding contract. Shared file ownership does not merge the cells.
- Do not add a generic `IdentityStore` to cover all subcells. Shared vocabulary is not shared ownership.

## Static Scan Hints

Watch for new or renamed `catId`, `CatId`, `AgentRegistry`, `cat-config`, `roster`, `ReviewerMatcher`, `ConnectorThreadBindingStore`, `Binding`, `bubbleIdentity`, `canonicalInvocationId`, `session`, `SessionChainStore`, `cliSessionId`, `cascadeId`, `runtimeSession`, and agent-facing `entity_id` code.
