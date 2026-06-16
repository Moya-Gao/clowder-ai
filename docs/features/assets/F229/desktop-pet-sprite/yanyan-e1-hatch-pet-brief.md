---
feature_ids: [F229]
topics: [desktop-pet, hatch-pet, yanyan, codex, sprite-atlas]
doc_kind: asset-brief
created: 2026-06-16
---

# 砚砚 Codex Pet E1 生成简报

**Purpose:** 给云端 Codex / ChatGPT / imagegen 工作者的统一口径。不要再请求"8 张姿势图"；E1 要的是 `hatch-pet` 兼容的多帧 row strips。

## Canonical Reference

Use this image as the identity source of truth:

- `docs/features/assets/F229/desktop-pet-sprite/raw/yanyan-codex-character-base-v1.png`

Identity lock:

- silver-gray Maine Coon style cat
- central forehead tuft
- large pointed ears with dark rim and pink inner ear
- white chest and muzzle
- dense gray tabby markings
- fluffy striped tail
- calm serious Codex expression

Do not change species, palette, face shape, forehead tuft, tail, stripe pattern, or body proportions between rows.

## Atlas Contract

Full final atlas:

- 8 columns x 9 rows
- cell size: 192 x 208
- final atlas size: 1536 x 1872
- transparent output after processing
- row strips are generated first, then deterministic scripts compose the final atlas

Rows:

| Row | State | Frames | Meaning |
|---:|---|---:|---|
| 0 | `idle` | 6 | calm resting, breathing, blinking |
| 1 | `running-right` | 8 | drag movement to the right |
| 2 | `running-left` | 8 | drag movement to the left |
| 3 | `waving` | 4 | greeting / attention gesture |
| 4 | `jumping` | 5 | hover or playful jump |
| 5 | `failed` | 8 | blocked / failed / cancelled |
| 6 | `waiting` | 6 | waiting for approval/help/user input |
| 7 | `running` | 6 | active task work / processing |
| 8 | `review` | 6 | ready / reviewing completed output |

## Generation Order

Do not generate everything at once.

1. Generate `idle` row first and QA identity + calm loop.
2. Generate `running-right` second and QA directional cadence.
3. Generate `running-left` by mirror only if it preserves identity and direction semantics; otherwise generate it as its own row.
4. Generate the remaining rows one at a time.

## Global Negative Rules

No text, UI, scenery, speech bubbles, labels, code, shadows, floor marks, guide lines, boxes, borders, detached stars, detached droplets, speed lines, dust clouds, motion trails, glow, halo, or floating symbols.

All state meaning must come from the pet pose and expression, not from loose effects.

## Per-Row Prompt Template

Use the canonical reference image. Create Codex pet row `<state>` for `yanyan-codex`: exactly `<frames>` full-body frames in one horizontal strip on a flat removable chroma-key background. Treat the row as `<frames>` invisible equal-width slots: one centered complete pose per slot, evenly spaced, with no overlap, clipping, empty slots, labels, or borders.

Same pet in every frame: silver-gray Maine Coon, central forehead tuft, white chest and muzzle, dense gray tabby markings, fluffy striped tail, calm serious Codex expression. Preserve silhouette, face, proportions, markings, palette, material, and tail design.

State action: `<state-specific action>`.

Animation continuity: keep apparent pet scale and baseline stable within the row unless the state intentionally changes vertical position, such as `jumping`. The first and last frame should loop cleanly.

Return only one clean row strip image for this state.

## State-Specific Actions

- `idle`: subtle breathing, tiny blink, slight head/body bob, tiny tail-tip motion. Low-distraction; no waving, working, jumping, or emotional reaction.
- `running-right`: directional drag movement facing/traveling right through body and limb pose only. No speed lines or dust.
- `running-left`: directional drag movement facing/traveling left through body and limb pose only. No speed lines or dust.
- `waving`: greeting through paw pose only. No wave marks, sparkles, or motion arcs.
- `jumping`: anticipation, lift, airborne peak, descent, settle through body height only. No shadow or landing marks.
- `failed`: slumped or deflated reaction with sad/closed eyes. Attached tears/smoke/stars only if they touch the pet silhouette; no detached symbols.
- `waiting`: expectant asking pose for approval/help/user input. Distinct from idle and review.
- `running`: focused work/processing/thinking/typing/scanning. Not literal running or locomotion.
- `review`: focused inspection of completed output through lean, blink, narrowed eyes, head tilt, or paw pose. No magnifier, paper, code, or UI props.

## QA Before Accepting A Row

Reject the row if:

- any frame looks like a different cat
- markings or palette drift
- face, ears, tuft, body, or tail shape changes materially
- frame slots are visible or copied from a guide
- body is cropped or overlaps adjacent slots
- row relies on detached effects to explain state
- idle is visually static or too distracting
- directional rows face or travel the wrong way
