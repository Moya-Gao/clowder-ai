---
title: F190 Settings A/B Convergence
created: 2026-05-17
feature: F190
related_features: [F199]
source_audit: ../../audits/2026-05-17-f190-settings-parity-audit.md
participants: [opus-46, codex-gpt-5.5]
doc_kind: discussion
---

# F190 Settings A/B Convergence

## Context

The content-level audit found that Phase G token convergence did not fully close
settings parity. The remaining A/B list should not be treated as one bulk sync:
some items are pure visual cleanup, while others cross data contract or write
surface boundaries.

This memo converges the A-1/A-2/A-3 and B-1..B-5 list into implementation
slices.

## Verdict

Opus's three-bucket split is directionally right, with two corrections:

1. **A-1 Notify goes first among functional blockers.** It is the highest
   outbound-sync risk and has a contained surface.
2. **B-2 is not pure CSS if we include pending restart/deprecated markers.**
   The source UI expects `restartRequired`/`deprecated` style signals; home can
   derive part of this from existing `runtimeEditable` data, but the slice
   should still be treated as "small UI + derived state", not as a token-only
   change.

## Implementation Order

| Order | Item | Owner proposal | Why |
|---|---|---|---|
| 1 | A-3 Chat shell background | Opus | Fast visual blocker. CSS/token-only if it does not alter message rendering or thread ownership. |
| 2 | A-1 Notify preferences | Codex or Opus, but needs design review before merge | Largest sync blocker; contained enough to do before Skills. |
| 3 | B-5 Voice settings visual | Opus | Pure visual polish; keep feature behavior unchanged. |
| 4 | B-2 System env folding | Opus, but as small UI/data slice | Mostly UX, but pending restart counts are derived state, not just styling. |
| 5 | A-2 Skills dual model | Codex design first, implementation after review | Two independent truth models must be composed, not overlaid. |
| 6 | B-1/B-3 Services + Plugins catalog | Codex design with ServiceStatus contract | These share the `/api/services` contract and should be designed together. |
| 7 | B-4 IM save model | Decision memo only for now | This changes transaction semantics; no code until we choose immediate-save vs staged-submit. |

## A-1 Notify Preferences

### Source has

- Five preference checkboxes: `reply`, `permission`, `mention`, `schedule`,
  `signal`.
- Browser push and in-app notification cards.
- Diagnostics collapsed by default.
- Preferences persisted in localStorage.

### Home has

- VAPID config panel and one-shot key generation.
- Device subscription list.
- Delivery summary: attempted/delivered/failed/removed.
- Repair hints and iPhone/PWA guidance.
- Stronger test feedback.

### Decision

Merge source preference UX into home, but do not claim backend event filtering
unless a backend contract is added. Current source preference storage is client
localStorage, so the safe first slice is:

- Add the five preference toggles with a home-scoped key, e.g.
  `cat-cafe-notify-prefs`.
- Keep browser push and in-app notification cards.
- Move the diagnostic matrix, device list, delivery summary, repair hints, and
  PWA guidance behind a default-collapsed diagnostics section.
- Keep `PushServiceConfig` in the push card.
- Keep delivery test result details from home.

### Do Not

- Do not overwrite home `PushSettingsPanel` with source; that would drop device
  delivery diagnostics.
- Do not imply preferences affect all push delivery types until routes emit and
  honor notification categories.

## A-2 Skills Dual Model

### Source has

- `useCapabilityState('skill')`.
- Project selector.
- Global and per-cat toggles.
- External skill disable/uninstall action.
- Capability-board item shape.

### Home has

- `/api/skills` registry view.
- Provider mount status across Claude/Codex/Gemini/Kimi.
- Staleness and sync.
- Conflict resolver.
- MCP dependency badges.
- `SKILL.md` preview.
- Owner-gated sync/resolve write routes.

### Decision

Compose the two models in a single Settings Skills surface:

- Top-level project selector can come from the capability board pattern.
- Primary list should continue to be skill-centric, not capability-only, because
  home has registry-only facts that capability items do not expose.
- Each skill row should show both:
  - home governance state: mount count, staleness/conflict/dependency badges;
  - source control state: global enabled, per-cat enabled, external disable
    where the backend can enforce managed/external boundaries.
- Backend contract should not overload `/api/skills` with capability writes
  implicitly. Either extend the capability response to include home skill
  governance fields, or introduce a small composition endpoint for the Settings
  view.

### Do Not

- Do not restore source `useCapabilityState('skill')` blindly. Home currently
  restricts that hook to MCP in order to avoid mixing Skills write semantics into
  MCP settings.
- Do not add destructive uninstall for home-managed skills unless the route
  proves managed-skill guard, owner fail-closed, project path validation, skill
  name validation, and metadata-only audit.

## A-3 Chat Shell Background

### Decision

Implement as a visual shell slice only:

- Main chat background: `console-shell-bg`.
- Input and sticky footer surroundings: console shell/card tokens.
- Bootcamp modal: `console-card-bg` or `console-card-soft-bg`.

### Guard

`ChatContainer` and chat input paths are historically red-zone sensitive. This
slice may touch classes/tokens, but it must not change message rendering,
thread-state ownership, read state, invocation activity, or sidebar resize
behavior.

## B-1 Service Lifecycle Contract

### Current state

Home already has lifecycle routes and a home-shaped `ServiceState`:
`healthy/unhealthy/not_configured`, `endpoint`, `features`, and
`availableActions`.

Source uses a different UI shape: `manifest`, `running/stopped/installing`,
`installed`, `enabled`, log polling, and toggle state.

### Decision

Do not make this a visual-only port. First document a stable UI adapter:

- Home API remains the backend truth source.
- UI can present source-style lifecycle affordances only through a typed adapter
  from home `ServiceState`.
- Log polling and toggle UI should be added only when the corresponding route
  and lifecycle audit proof exist for that service.

## B-2 System Env Folding

### Decision

Absorb the source UX, but keep home's safety affordances:

- Use collapsible category groups.
- Keep protected path handling and workspace navigation actions.
- Keep redacted URL hints.
- Derive restart markers from existing `runtimeEditable === false` and known
  restart-required vars unless we explicitly add a `restartRequired` field to the
  env registry.
- Pending restart count should count changed vars that require restart, not all
  displayed bootstrap-only vars.

## B-3 Plugins Catalog Shell

### Decision

Treat this with B-1 because both depend on service state:

- Keep the GitHub platform plugin and `GithubConfigPanel`.
- Use the source catalog shell for product clarity.
- Preserve home's real service diagnostics somewhere nearby, either as service
  plugin rows or a linked service status subsection.

Do not replace live `/api/services` diagnostics with a static catalog.

## B-4 IM Save Model

### Options

| Option | Behavior | Trade-off |
|---|---|---|
| Immediate save | Each permission change writes immediately | Current home behavior; lower chance of losing edits, but multiple small writes. |
| Staged submit | Changes accumulate then one Save applies credentials + permissions | Source behavior; clearer transaction boundary, but riskier because credentials, permissions, and secret redaction share one submit path. |

### Recommendation

Keep immediate save for permissions for now. If we want a unified submit later,
make it an explicit IM config transaction feature with rollback/error display,
not a visual parity patch.

## B-5 Voice Settings Visual

### Decision

This can be a pure visual polish slice:

- Use source-style `console-list-card`.
- Add eyebrow/title treatment.
- Move inputs/buttons to console tokens.
- Keep all home voice settings behavior unchanged.

## Cross-Slice Rules

- No whole-file overwrite from `clowder-ai`.
- Each slice must list `Source Behavior`, `Must Preserve Home Behavior`, and
  `Proof`.
- For visual slices touching chat shell, include screenshot proof.
- For write surfaces, require focused tests on owner gating, redaction, path/name
  validation, and user-visible error states.
- Outbound sync language must say "merged/composed" for A-1/A-2/B-1/B-3, not
  "copied".

## Convergence Check

1. 否决理由 -> ADR? 没有。本轮没有新增架构 ADR 级否决，只是收敛 F190/F199 follow-up 切片边界。
2. 踩坑教训 -> lessons-learned? 没有。审计漏判已由源审计文档记录；本 memo 未发现新的跨项目教训。
3. 操作规则 -> 指引文件? 没有。沿用现有 F190 manual-port / parity proof 规则。
