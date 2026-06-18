---
feature_ids: [F244]
topics: [design-gate, capability-tips, waiting-state, hub-action-surface]
doc_kind: note
created: 2026-06-18
---

# F244 Design Gate — Waiting-State Capability Tips

> Status: pending CVO confirmation

## Source

Feature spec: `docs/features/F244-capability-tips-system.md`

Reviewer status: Opus 4.8 approved `ce83927b3` after requesting structure/body source and action-required clarifications.

Original CVO requirements:

> "我们想要的不止是猫言语"

> "有什么 magic words 什么时候可以用 / 家里有什么功能 / 开发新 feature 的时候必须补 1-2 条 tips"

> "别做成多个真相源头"

> "F229 猫猫球是前台大猫猫，如果也需要 tips，得和这套归一"

> "Tips 加个 hover 提示了解更多，然后点击拉起前台猫，前台猫自动输入 tips，直接到输入框，不要发出去"

## Architecture Ownership

Architecture cell: hub-action-surface + harness-eval
Map delta: update required
Why: Tips render inside first-party Hub waiting/status surfaces and need adoption/effectiveness tracking; F223 owns capability source registry, F192 owns eval, F244 owns the user-facing waiting-state projection.

## In-Context Observability

```yaml
in_context_observability:
  primary_surface: "ThreadExecutionBar tip strip; ThinkingIndicator fallback only when execution bar is absent; learn-more action opens F229 concierge draft without auto-send"
  why_not_dashboard_only: "Waiting is the moment where the user needs both status and lightweight capability discovery; a dashboard would be after-the-fact and would not teach during the natural attention window."
  deep_dive_surface: "Tip action opens source/guide/capability surface; Phase D sends aggregate usefulness signals to F192/Eval Hub for after-the-fact review."
  noise_dedup_policy: "First tip after 6s; rotate no faster than every 12s; show at most one tip; hide tips in suspected_stall/alive_but_silent critical states; dismiss/stale signals feed Phase D."
```

## Design-In-Context Checklist

- [x] Read target component code:
  - `packages/web/src/components/ThreadExecutionBar.tsx`
  - `packages/web/src/components/ThinkingIndicator.tsx`
- [x] Existing UI elements:
  - `ThreadExecutionBar`: "执行中" label, active cat chips, per-cat stop button, optional stop-all, `ForceResetEntry`.
  - `ThinkingIndicator`: spawning / normal thinking / alive-but-silent / suspected-stall banners with cancel button in warning states.
- [x] New element type: add a secondary tip strip, not a replacement for current status or reset controls.
- [x] Placement: recommended primary placement is in `ThreadExecutionBar`, under active cat chips and above `ForceResetEntry`; fallback in `ThinkingIndicator` only when the execution bar is not present.
- [x] Density/mobile: one-line body, optional action button, truncate or collapse on narrow width; no multi-card layout.
- [x] Existing UX impact: normal waiting becomes more useful; warning/stall UX remains unchanged or stronger because tips hide.
- [x] State coverage: normal thinking, long-running active execution, alive-but-silent, suspected-stall, mobile/narrow.
- [x] Visual conflict: use existing muted surface tokens; no critical/warning colors for tips.

## Recommendation

Use **Option A** for the first release as a final-shaped vertical slice:

1. Render a single shared `CapabilityTipStrip`.
2. Primary placement: `ThreadExecutionBar`, directly below active cat chips.
3. Fallback placement: `ThinkingIndicator` normal state only, if `ThreadExecutionBar` is absent.
4. Hide tips during `alive_but_silent` and `suspected_stall`; let cancel/force-reset own those states.
5. Primary action: hover shows "了解更多"; click opens F229 cat ball / concierge bubble and pre-fills the input draft. Do not auto-send.
6. Keep source/guide/capability actions as optional secondary actions, not a new help drawer.
7. Scope Phase B display to chat/thread waiting surfaces only; F229 cat ball/desktop pet proactive display is a later consumer of the same tip contract, not a separate tips source.

Why this shape:

- It keeps tips where waiting happens.
- It avoids duplicate tips when both components render.
- It preserves the existing force-reset escape hatch.
- It uses the existing F229 concierge input as the learn-more surface instead of creating a help drawer or parallel capability catalog.

## Implementation Posture

This is not a throwaway first cut. The first release must use the final architecture shape:

- final `CapabilityTip` schema
- final `open_concierge_draft` action contract
- final single-source rule (`sourceRef` + anchor validation; no parallel catalog)
- final liveness boundary (tips hidden in warning/stall states)
- final user-control boundary (concierge draft opens, but never auto-sends)

Scope can be reduced only by limiting seed inventory, telemetry depth, and proactive F229 display contexts. It must not be reduced by adding a temporary help drawer, temporary action, temporary source list, or temporary UI slot that would need migration.

## F229 Cat Ball Integration

F229 should integrate with F244 in the first release as an action surface, but not as an independent proactive tip renderer.

Boundary:

- F244 owns the canonical `CapabilityTip` contract, tip selector, `sourceRef`/anchor validation, usage metrics, and stale/eval semantics.
- F229 owns cat ball / desktop pet presentation: when an idle or expanded front-desk cat surfaces a tip, how it animates, and how it avoids interruption.
- First release uses the existing F229 draft contract: `setSurfaceState('bubble', prompt)` stores `pendingPrompt`, `ConciergePanel` consumes it into the textarea, and nothing is sent until the user presses send.
- F229 must render F244-selected `tipId/sourceRef/action`; it must not keep an F229-local tips body catalog.
- Pet animation can hint that a tip exists, but cannot be the only signal. This matches F229 PetSkinContract: pet skin is projection, not source of truth.

Recommended later contexts:

| Context | Use |
|---------|-----|
| `concierge_idle` | Quiet front-desk discovery when the cat ball is visible but not opened |
| `concierge_open` | User opened the cat ball and may ask "有什么 / 怎么用" |
| `pet_waiting_for_user` | Concierge is waiting for confirmation or input and can explain the next available action |

This gives the cat ball tips without making a second Knowledge Feed. Waiting-state tips and front-desk tips share the same source and telemetry; only the surface and timing differ. In the first release, the cat ball is only the learn-more draft surface; proactive/idle tips wait for a later F229 integration.

## Wireframes

### Normal execution — primary surface

```text
┌─────────────────────────────────────────────────────────────┐
│ 执行中  [缅因猫/砚砚 0:23 ×]                                │
│ Tip  家里能力：改完前端想看效果时，猫可以用 browser-preview。 [了解更多] │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─                         │
│ ⚠ 卡住了？强制重置                                           │
└─────────────────────────────────────────────────────────────┘
```

Notes:

- Tip row is secondary, muted, and visually below active execution.
- Hovering "了解更多" explains that it opens 猫猫球 with a draft, without sending.
- Clicking "了解更多" opens F229 concierge and pre-fills: `帮我解释这个 tip：...` plus the tip's sourceRef/action context.
- `卡住了？强制重置` remains present and below the tip in normal state.
- Text must stay one line on desktop; on narrow width action becomes an icon/source affordance or the body truncates.

### Normal thinking — fallback surface

```text
┌─────────────────────────────────────────────────────────────┐
│ 🐾 砚砚 思考中 ...                                           │
│ Tip  Magic word："脚手架"用于发现临时方案时拉回终态设计。 [了解更多] │
└─────────────────────────────────────────────────────────────┘
```

Notes:

- This fallback only renders if the execution bar is absent, preventing duplicate tips.
- The status line remains the only true runtime-status line.

### Alive-but-silent / suspected-stall — tips hidden

```text
┌─────────────────────────────────────────────────────────────┐
│ ⏱ 砚砚 静默等待中... 0:42                         [取消]    │
│ 进程存活且 CPU 活跃，可能正在执行工具或等待 API 响应          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ⚠ 卡住了？强制重置                                           │
└─────────────────────────────────────────────────────────────┘
```

Notes:

- No tips in warning/stall states.
- This avoids making a failure state look like normal onboarding.

## Tip Selection Rules

| Rule | Decision |
|------|----------|
| First display | After 6 seconds of continuous normal waiting/execution |
| Rotation | Every 12 seconds or slower |
| Max visible | 1 tip |
| Critical states | Hide tips in `alive_but_silent` / `suspected_stall` |
| Context priority | current workflow > current feature mode > capability/magic-word general tips |
| Tip body source | hand-authored seed with `bodySource` + `sourceRef`; not treated as canonical capability definition |
| Required actions | `capability` / `workflow` / `feature` tips need `open_concierge_draft`; `magic_word` / `status_help` may be sourceRef-only but should still use draft when useful |

## Tip Actions

Phase B starts with one primary action and optional secondary actions:

| Action | Use |
|--------|-----|
| `open_concierge_draft` | Open F229 cat ball / concierge bubble and pre-fill the input with a learn-more prompt. Never auto-send. |
| `open_source` | Open sourceRef doc or rule anchor, usually via workspace/source navigation |
| `open_guide` | Start or show an existing F155 guide when there is a real guide |
| `open_capability_surface` | Open an existing first-party surface such as browser preview/workspace/rich block docs when available |

Do not build a new help drawer in Phase B. If source/action surfaces feel awkward after dogfood, Phase D can propose a dedicated help surface with evidence.

## CVO Decision Packet

Recommended answers are pre-filled. CVO can approve as-is or override specific rows.

| Decision | Recommendation | Why |
|----------|----------------|-----|
| Primary placement | `ThreadExecutionBar` tip strip | It already owns active execution, elapsed time, stop, and force reset. |
| Fallback placement | `ThinkingIndicator` normal state only if execution bar absent | Prevent duplicate tips while keeping single-cat/simple mode covered. |
| Warning/stall behavior | Hide tips | Failure and escape controls must stay visually dominant. |
| First display / rotation | 6s first display, >=12s rotation | Slow enough to avoid flicker; early enough to use waiting attention. |
| Action model | primary `open_concierge_draft`; optional source/guide/capability secondary actions | Reuses F229 as the learn-more surface without auto-send or a new help drawer. |
| First release surface scope | chat/thread waiting surfaces for tip display; F229 only as draft action surface | Final-shaped first release; avoids proactive cat-ball scope while preventing a second tips source. |

## Non-Goals

- No new canonical capability catalog.
- No F229-local tips catalog.
- No random cat saying library as the main artifact.
- No fake progress or fake precise status.
- No right-side help drawer in Phase B.
- No auto-send from tips into the concierge thread.
- No tip display during critical liveness states.

## Review Notes

Opus 4.8 approval constraints carried into this gate:

- Machine checks own structure/anchor/action-required only.
- Humans review body usefulness.
- Eval/stale loop handles drift.
- Design Gate must solve the actual UI slot because current components do not have one.
