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

| Row | State | Frames | Strip size | Layout guide | Meaning |
|---:|---|---:|---|---|---|
| 0 | `idle` | 6 | 1152 x 208 | `layout-guides/idle.png` | calm resting, breathing, blinking |
| 1 | `running-right` | 8 | 1536 x 208 | `layout-guides/running-right.png` | drag movement to the right |
| 2 | `running-left` | 8 | 1536 x 208 | `layout-guides/running-left.png` | drag movement to the left |
| 3 | `waving` | 4 | 768 x 208 | `layout-guides/waving.png` | greeting / attention gesture |
| 4 | `jumping` | 5 | 960 x 208 | `layout-guides/jumping.png` | hover or playful jump |
| 5 | `failed` | 8 | 1536 x 208 | `layout-guides/failed.png` | blocked / failed / cancelled |
| 6 | `waiting` | 6 | 1152 x 208 | `layout-guides/waiting.png` | waiting for approval/help/user input |
| 7 | `running` | 6 | 1152 x 208 | `layout-guides/running.png` | active task work / processing |
| 8 | `review` | 6 | 1152 x 208 | `layout-guides/review.png` | ready / reviewing completed output |

Always attach both:

1. canonical identity image: `raw/yanyan-codex-character-base-v1.png`
2. row layout guide: `layout-guides/<state>.png`

The layout guide is for spacing only. The output must not contain visible guide lines, boxes, crosshairs, labels, or guide background.

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

Use the canonical reference image and the row layout guide. Create Codex pet row `<state>` for `yanyan-codex`: exactly `<frames>` full-body frames in one horizontal strip on a flat removable chroma-key background. Output size should match the row contract: `<strip-width>` x 208 px. Treat the row as `<frames>` invisible 192 x 208 slots: one centered complete pose per slot, evenly spaced, with no overlap, clipping, empty slots, labels, or borders.

Same pet in every frame: silver-gray Maine Coon, central forehead tuft, white chest and muzzle, dense gray tabby markings, fluffy striped tail, calm serious Codex expression. Preserve silhouette, face, proportions, markings, palette, material, and tail design.

State action: `<state-specific action>`.

Animation continuity: keep apparent pet scale and baseline stable within the row unless the state intentionally changes vertical position, such as `jumping`. The first and last frame should loop cleanly. The body bounding box must remain within roughly the same width and height across frames; do not zoom the cat larger or smaller between slots.

Spacing and scale lock:

- each frame lives inside its own 192 x 208 slot
- keep at least 16 px clear padding between the pet silhouette and slot edges
- keep feet/body anchor on the same baseline for all non-jumping rows
- keep head top, body height, and tail size consistent across frames
- move only the intended body parts for the frame plan
- never let a pose cross into a neighboring slot

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

## Frame-By-Frame Director Notes

Use these notes inside the row prompt for the specific state being generated. They are intentionally explicit so the generator cannot satisfy the prompt with near-duplicate frames.

### `idle` - 6 frames

Low-distraction loop. Body anchor stays planted; first and last frame should be very close but not pixel-identical.

| Frame | Eyes | Body / head | Tail | Notes |
|---:|---|---|---|---|
| 1 | open, calm | neutral seated pose | tail rests curled at baseline | canonical rest pose |
| 2 | open | same seated posture, whole body/head 1-2 px higher only | tail **tip only** lifts a little | inhale start; no proud chest-out pose |
| 3 | half blink | same silhouette, body at highest point | tail **tip only** curls inward | visible but tiny change |
| 4 | closed blink | same silhouette, tiny head dip within the same pose | tail tip holds curl | blink peak |
| 5 | open | body lowers back toward neutral | tail tip relaxes downward | exhale |
| 6 | open | almost same as frame 1, head just slightly different | tail back near baseline | loop back to frame 1 |

Hard reject if 4 or more frames are visually identical.
Hard reject if any frame changes into a proud chest-out pose, changes the full tail pose, or redraws the cat at a different scale.

### `running-right` - 8 frames

Directional drag movement to the right. The cat faces right or leans right through pose only; no speed lines, dust, or shadows.

| Frame | Pose |
|---:|---|
| 1 | compact ready stance, body centered, right-facing lean begins |
| 2 | front right paw forward, rear body compresses slightly |
| 3 | body shifts slightly right within slot, tail counter-swings left |
| 4 | front left paw forward, head dips slightly |
| 5 | body reaches the most rightward lean, ears stable, eyes focused |
| 6 | paws switch back, torso rises slightly |
| 7 | tail counter-swings right, body returns toward center |
| 8 | near frame 1 but with opposite paw subtly forward for loop continuity |

### `running-left` - 8 frames

Mirror `running-right` only if identity stays correct. Otherwise generate separately using the same cadence facing left.

| Frame | Pose |
|---:|---|
| 1 | compact ready stance, body centered, left-facing lean begins |
| 2 | front left paw forward, rear body compresses slightly |
| 3 | body shifts slightly left within slot, tail counter-swings right |
| 4 | front right paw forward, head dips slightly |
| 5 | body reaches the most leftward lean, ears stable, eyes focused |
| 6 | paws switch back, torso rises slightly |
| 7 | tail counter-swings left, body returns toward center |
| 8 | near frame 1 but with opposite paw subtly forward for loop continuity |

### `waving` - 4 frames

Greeting through paw pose only. No wave marks, sparkles, or motion arcs.

| Frame | Pose |
|---:|---|
| 1 | seated neutral, one front paw beginning to lift |
| 2 | paw raised to shoulder height, pads barely visible |
| 3 | paw tilted outward in clear wave peak, friendly eyes |
| 4 | paw lowering, close enough to frame 1 to loop |

### `jumping` - 5 frames

Vertical motion through body position only. No ground shadow, dust, bounce pad, or impact mark.

| Frame | Pose |
|---:|---|
| 1 | anticipation crouch, body slightly lower, tail tucked closer |
| 2 | takeoff, paws leaving baseline, body rising |
| 3 | airborne peak, body highest, paws tucked, tail lifted |
| 4 | descent, body lower than frame 3, paws preparing to land |
| 5 | settled near frame 1 but less crouched, ready to loop |

### `failed` - 8 frames

Blocked or failed reaction. Effects only if attached to the pet silhouette; no detached symbols.

| Frame | Pose |
|---:|---|
| 1 | neutral-to-worried transition, ears begin to droop |
| 2 | head lowers, eyes half-lidded |
| 3 | shoulders slump, tail drops closer to body |
| 4 | failed peak: eyes closed or sad, body smallest |
| 5 | tiny attached tear or cheek puff allowed if touching face |
| 6 | slight recovery breath, head rises a little |
| 7 | ears lift slightly but expression still frustrated |
| 8 | returns near frame 1, ready to loop |

### `waiting` - 6 frames

Needs approval or user input. Must differ from idle: expectant, asking, patient.

| Frame | Pose |
|---:|---|
| 1 | seated, eyes looking toward user, one paw near chest |
| 2 | paw lifts slightly as if asking |
| 3 | head tilts a little, ears attentive |
| 4 | blink or softer eyes while holding the asking pose |
| 5 | paw lowers slightly, tail tip curls |
| 6 | returns near frame 1 with the same expectant posture |

### `running` - 6 frames

Active work or processing, not literal locomotion. Think "focused task effort".

| Frame | Pose |
|---:|---|
| 1 | focused seated pose, paws in front, eyes narrowed |
| 2 | left paw moves forward as if typing or sorting |
| 3 | right paw moves forward, head dips |
| 4 | both paws close together at work peak, body leans in |
| 5 | head lifts slightly, eyes scan side-to-side |
| 6 | returns near frame 1, still focused |

### `review` - 6 frames

Ready or reviewing completed output. No magnifier, paper, code, or UI props.

| Frame | Pose |
|---:|---|
| 1 | upright focused pose, eyes open |
| 2 | head leans slightly forward, eyes narrow |
| 3 | head tilts left, one paw touches chin/chest |
| 4 | blink or half blink, still leaning |
| 5 | head tilts right, eyes open as if comparing |
| 6 | returns near frame 1 with focused expression |

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

## Copy-Paste Prompt: `idle` Row v3

Attach both images:

1. `docs/features/assets/F229/desktop-pet-sprite/raw/yanyan-codex-character-base-v1.png` as the character identity reference.
2. `docs/features/assets/F229/desktop-pet-sprite/layout-guides/idle.png` as the spacing/layout guide.

Then send:

```text
Use the attached cat reference image as the exact character identity. Use the attached layout guide only for spacing and slot geometry.

Create one Codex pet animation row for state `idle`.

Output exactly 6 full-body frames in one horizontal strip, left to right, on a flat solid removable chroma-key background, preferably pure green #00FF00. Target output size is 1152 x 208 px: 6 slots, each 192 x 208 px. Do not use a checkerboard transparency preview background.

Treat the strip as 6 invisible equal-width slots: one centered complete cat per slot, evenly spaced, no overlap, no cropping, no empty slots, no labels, no borders, no visible guide marks. Do not copy the blue boxes, crosshairs, or guide background into the output.

Same cat in every frame: silver-gray Maine Coon, central forehead tuft, large pointed ears with dark rim and pink inner ear, white chest and muzzle, dense gray tabby markings, fluffy striped tail, calm serious Codex expression. Do not change face shape, species, markings, palette, body proportions, tail shape, or ear shape between frames.

This is a calm low-distraction idle loop. Do not make the cat wave, walk, run, jump, work, talk, react dramatically, or use props.

Scale and baseline lock:
- Keep the cat the same apparent size in all 6 frames.
- Keep the seated body and feet on the same baseline in all 6 frames.
- Keep head top, ear height, body width, and tail size consistent.
- Keep at least 16 px padding between the cat silhouette and every slot edge.
- Do not zoom, shrink, stretch, slide, or re-center the cat differently per frame.
- Do not make any frame a proud chest-out pose, heroic pose, or different posture.
- Do not redraw the tail in a different full pose; only the tail tip may move.
- Do not change the mouth shape or expression; this should remain the same calm serious Codex cat.
- Only the whole-body 1-2 px breathing offset, eyelids, tiny head dip, and tail-tip position should change.

Frame plan:
1. Eyes open, neutral seated pose, tail rests curled at baseline. This is the canonical rest pose.
2. Eyes open, same seated silhouette as frame 1, whole head/body 1-2 px higher only, tail tip lifts a little. Inhale start. Do not puff the chest or raise the chin.
3. Half blink, same silhouette, body at the highest point, tail tip curls inward. Small but visible change.
4. Closed blink, same silhouette, tiny head dip within the same pose, tail tip holds the curl. Blink peak.
5. Eyes open, body lowers back toward neutral, tail tip relaxes downward. Exhale.
6. Eyes open, almost the same as frame 1 but not pixel-identical, head slightly different, tail back near baseline. Loop back to frame 1.

Every frame must be visibly different from adjacent frames. Hard reject if 4 or more frames look identical. The first and last frames should be close enough to loop smoothly, but not exact duplicates.

Forbidden: text, UI, scenery, speech bubbles, labels, code, shadows, floor marks, guide lines, boxes, borders, detached stars, detached droplets, speed lines, dust clouds, motion trails, glow, halo, floating symbols, or action marks. The idle meaning must come only from the cat's body, blink, breathing, and tail-tip motion.

Reject examples:
- frame 2 turns into an upright proud / chest-out pose
- any frame is noticeably larger or smaller than the others
- the cat's feet baseline moves up or down
- the tail root or full tail pose changes instead of only the tip
- the expression changes into happy, smug, angry, or sleepy except for the intended blink
- background is checkerboard instead of a flat solid chroma key

Return only one clean horizontal row strip image.
```

If the result has too-small spacing, visible drift, frame-to-frame scale changes, or expression drift, reject it instead of repairing locally. Regenerate the row with the same two attached images and the same prompt.
