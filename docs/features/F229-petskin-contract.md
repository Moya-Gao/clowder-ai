---
feature_ids: [F229]
related_features: [F229]
topics: [concierge, desktop-pet, pet-skin, spritesheet, accessibility, provenance]
doc_kind: spec
created: 2026-06-13
source_skill: hatch-pet
---

# F229 PetSkinContract

> **Status**: draft | **Owner**: 宪宪 (Fable-5) / 砚砚 (Codex review) | **Feature**: F229
>
> **Purpose**: Learn the useful engineering contract from `hatch-pet` without reducing the Cat Ball Concierge to a decorative desktop pet.

## Positioning

`hatch-pet` is the visual and asset-production teacher for F229, not the product architecture. F229 remains a concierge system: memory navigation, duty-cat routing, liveness, guide handoff, relay, and user-controlled quietness. Pet skins are a projection of that system state.

**Hard boundary**:

- Concierge state machine is the single source of truth.
- PetSkin defines only `conciergeState -> petState` projection plus assets and QA.
- Missing skin states fall back to `idle`; incomplete atlases never block concierge acceptance.
- Pet animation is an enhancement signal, never the only signal.

## Upstream Contract We Learn From

`hatch-pet` defines a Codex-compatible animated pet package:

- `spritesheet.webp` or PNG atlas.
- Full atlas geometry: `1536x1872`, `8 columns x 9 rows`, `192x208` cells.
- Transparent background; unused cells fully transparent.
- Local package shape: `pet.json + spritesheet.webp`.
- Canonical states: `idle`, `running-right`, `running-left`, `waving`, `jumping`, `failed`, `waiting`, `running`, `review`.
- Production workflow: canonical base -> row strips -> deterministic atlas composition -> contact sheet + motion preview QA.

F229 adopts the contract shape and QA discipline, not the assumption that a full 8x9 atlas must exist before a skin can ship.

## Projection Schema

Pet states are not a parallel state machine. They are render targets derived from concierge state.

```ts
type ConciergeSkinState =
  | 'idle'
  | 'muted'
  | 'expanded'
  | 'dragging-left'
  | 'dragging-right'
  | 'processing'
  | 'waiting-for-user'
  | 'review-ready'
  | 'error';

type CodexPetState =
  | 'idle'
  | 'running-right'
  | 'running-left'
  | 'waving'
  | 'jumping'
  | 'failed'
  | 'waiting'
  | 'running'
  | 'review';

type PetStateProjection = {
  version: 1;
  fallback: 'idle';
  map: Partial<Record<ConciergeSkinState, CodexPetState>>;
};
```

Default projection:

| Concierge state | Pet state | Why |
|---|---|---|
| `idle` | `idle` | Low-distraction baseline |
| `muted` | `idle` | Muted is also expressed by non-pet UI; animation stays quiet |
| `expanded` | `waving` | Greeting / attention after user intent |
| `dragging-right` | `running-right` | Directional drag affordance |
| `dragging-left` | `running-left` | Directional drag affordance |
| `processing` | `running` | Duty cat / clerk is working |
| `waiting-for-user` | `waiting` | Needs confirmation, approval, or input |
| `review-ready` | `review` | Results ready / found |
| `error` | `failed` | Blocked, failed, or stuck |

If `skin.manifest.states[petState]` is absent, the renderer must fall back to `idle` and keep the non-pet status channel visible.

## Manifest Shape

F229 skin assets live in repo-managed provenance space, not only in `${CODEX_HOME}/pets`.

```json
{
  "id": "ragdoll-v1",
  "displayName": "布偶猫 v1",
  "description": "A quiet Cat Cafe concierge skin.",
  "version": 1,
  "format": "codex-pet-atlas",
  "atlas": {
    "path": "spritesheet.webp",
    "columns": 8,
    "rows": 9,
    "cellWidth": 192,
    "cellHeight": 208,
    "transparentBackground": true
  },
  "states": {
    "idle": { "row": 0, "frames": 6 },
    "running": { "row": 7, "frames": 6 },
    "review": { "row": 8, "frames": 6 },
    "failed": { "row": 5, "frames": 8 }
  },
  "projection": {
    "version": 1,
    "fallback": "idle",
    "map": {
      "idle": "idle",
      "processing": "running",
      "review-ready": "review",
      "error": "failed"
    }
  },
  "identity": {
    "baseHash": "sha256:<base-image-or-spec-hash>",
    "species": "cat",
    "breedOrForm": "ragdoll",
    "palette": ["#..."],
    "markings": ["blue lynx point"],
    "silhouetteNotes": "compact full-body, readable at 192x208",
    "allowedProps": []
  },
  "provenance": {
    "source": "hatch-pet",
    "sourceSkillVersion": "local install 2026-06-13",
    "promptFiles": [],
    "referenceImages": [],
    "selectedOutputs": [],
    "generator": "imagegen",
    "notes": "No logos, text, UI, scenery, detached effects, or shadow-only state cues."
  },
  "qa": {
    "contactSheet": "qa/contact-sheet.png",
    "motionPreviewDir": "qa/previews",
    "readabilityCheck": "pass",
    "identityDiffCheck": "pass",
    "provenanceCheck": "pass",
    "reviewer": "catId-or-human",
    "reviewedAt": "2026-06-13T00:00:00Z"
  }
}
```

## Three Gates

### 1. Readability Gate

The pet must remain readable at `192x208` and at the actual in-app rendered size. Reject:

- labels, text, UI, code snippets, speech bubbles, checkerboards, scenery
- shadows or detached effects that carry state by themselves
- frame borders, row guides, visible layout marks
- tiny details that only work in a full-size preview

### 2. Identity-Diff Gate

Canonical base alone is not enough. Every accepted skin must define identity invariants, then QA the contact sheet against them:

- palette and material consistency
- markings and face consistency
- body proportions and silhouette consistency
- prop consistency and prop side when mirrored
- no species/body-type drift across states

Readability and identity are separate gates: a row can be readable and still fail because it is no longer the same cat.

### 3. Provenance Gate

Each skin must be traceable:

- content hash for canonical base or base identity spec
- source prompts or prompt file paths
- reference image paths and hashes when available
- selected generation outputs
- QA contact sheet and motion previews
- reviewer and timestamp

This follows the same family rule as persistent product state: user-visible, recoverable assets must be auditable by default.

## Accessibility And Non-Pet Signal

Pet animation must never be the only way to understand state.

Required companion signals:

- accessible label / ARIA state text
- visible text or icon status for processing, waiting, muted, error, and review-ready
- reduced-motion mode uses a static `idle` frame plus non-pet state indicator
- small-size mode keeps badges/status readable even if animation detail is lost

Low-distraction idle is both a visual taste requirement and an attention-budget requirement.

## V0 Vertical Slice

Contract first, full atlas later.

V0 required states:

| State | Required? | Notes |
|---|---:|---|
| `idle` | yes | Static fallback and reduced-motion source |
| `running` | yes | Processing / duty cat working |
| `review` | yes | Result ready / found |
| `failed` | yes | Error or stuck |
| `waiting` | defer | Add when confirmation UX needs richer animation |
| `waving` | defer | Greeting polish |
| `running-left/right` | defer | Drag polish; existing drag remains functional without it |
| `jumping` | defer | Optional hover/playfulness |

V0 acceptance:

- manifest validates against this contract
- four required states render through `conciergeState -> petState`
- missing states fall back to `idle`
- all three QA gates pass
- non-pet status channel remains visible

## Non-Goals

- Do not replace F229 concierge logic with a desktop-pet workflow.
- Do not block Phase A acceptance on a full 8x9 atlas.
- Do not require every deployment to use Codex app's `${CODEX_HOME}/pets` folder.
- Do not accept "cute" as a substitute for state readability, identity consistency, or provenance.
- Do not let pet animation become the only status signal.

## Links

- Upstream local skill: `${CODEX_HOME:-$HOME/.codex}/skills/hatch-pet/SKILL.md`
- Upstream contract: `${CODEX_HOME:-$HOME/.codex}/skills/hatch-pet/references/codex-pet-contract.md`
- F229 main spec: `docs/features/F229-cat-ball-concierge.md`
- Existing raw asset pool: `docs/features/assets/F229/desktop-pet-sprite/`
