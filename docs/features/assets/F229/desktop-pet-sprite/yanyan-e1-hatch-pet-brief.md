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

Important distinction:

- **Final atlas geometry** is strict: each processed frame becomes a `192 x 208` cell.
- **Cloud generation geometry** should be generous: ask for a wide working strip with large spacing, stable scale, stable baseline, and clean background. Do not ask the image model to cram final `192 x 208` cells directly; deterministic scripts own the final crop/downscale.

Rows:

| Row | State | Frames | Final processed strip | Layout guide | Meaning |
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

Prompt-only image generation is invalid for Yanyan pet production. Every identity-sensitive generation attempt must be grounded by the canonical base image being attached or otherwise visible to the image tool. If the available generation path cannot actually consume the local reference image, do not treat that output as a production candidate; use it only as a rejected prompt experiment.

For cloud generation, prefer these working-strip sizes before deterministic processing:

| Frames | Suggested working strip | Approx slot |
|---:|---|---|
| 4 | 2000 x 540 | 500 x 540 |
| 5 | 2500 x 540 | 500 x 540 |
| 6 | 3000 x 540 | 500 x 540 |
| 8 | 4000 x 540 | 500 x 540 |

Each full-body cat should occupy roughly `360 x 450` px inside the working slot, with at least `60 px` clear horizontal padding and `35 px` vertical padding. The final atlas will downsample after extraction.

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

Use the canonical reference image and the row layout guide. Create Codex pet row `<state>` for `yanyan-codex`: exactly `<frames>` full-body frames in one wide horizontal working strip. Use a real transparent PNG background if possible; if true alpha is not available, use one flat solid chroma-key color. Do not paint a checkerboard transparency preview into the image.

Do not cram the cat into final atlas cells during generation. Treat the working strip as `<frames>` large invisible slots, roughly 500 px wide and 540 px tall each: one centered complete pose per slot, evenly spaced, with generous empty space between frames, no overlap, clipping, empty slots, labels, or borders.

Same pet in every frame: silver-gray Maine Coon, central forehead tuft, white chest and muzzle, dense gray tabby markings, fluffy striped tail, calm serious Codex expression. Preserve silhouette, face, proportions, markings, palette, material, and tail design.

State action: `<state-specific action>`.

Animation continuity: keep apparent pet scale and baseline stable within the row unless the state intentionally changes vertical position, such as `jumping`. The first and last frame should loop cleanly. The body bounding box must remain within roughly the same width and height across frames; do not zoom the cat larger or smaller between slots.

Spacing and scale lock:

- each frame lives inside its own wide working slot
- keep at least 60 px clear horizontal padding between the cat silhouette and each slot edge
- keep at least 35 px clear vertical padding above and below the cat silhouette
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

## 中文提示词（v5，给云端砚砚用）

**用法**：附上母设图 + 对应状态的 layout guide → 粘贴对应状态的提示词 → 生成 2~4 个候选 → 选最好的一条。

必须附的两张图：
1. `raw/yanyan-codex-character-base-v1.png`（角色身份）
2. `layout-guides/<状态>.png`（间距参考）

---

### ~~`idle` 提示词 v5（6 帧行条）~~ — 已废弃

> **废弃原因**：3 轮实测（R1-R3）证明 6 帧行条的微妙差异（"1-2像素上移""尾巴尖轻轻抬起"）超出图像生成模型的可控精度。模型要么画出一模一样的，要么产生无意义的渲染噪声差异。改用下方 v6 单帧补缺方案。

### `idle` 提示词 v6（单帧补缺方案）🆕

**策略**：从 3 轮行条中选出 2 帧可用的（R1-F1 基准帧 + R1-F4 眨眼帧），剩下 4 帧逐帧单独生成，每帧只描述**一个明确可见的差异**。最后本地拼成 6 帧行条。

**为什么行条不行、单帧可以**：AI 画 6 帧"几乎一样但微微不同"时，无法精确控制差异量——结果是完全一样或随机不同。但画"一只猫做 X 姿势"是容易的。单帧 prompt = 每次只控制一个变量。

**可用帧（从 R1 提取，不用重新生成）**：
- ✅ **帧 1**：R1 第 1 格 — 标准坐姿，睁眼，尾巴自然卷在身边
- ✅ **帧 4**：R1 第 4 格 — 完全闭眼眨眼，其他姿势不变

**需要补的 4 帧**（每帧附母设图生成）：

---

#### 帧 2 — 头微歪 + 耳朵轻侧

附上母设图 + R1-F1 参考帧，发送：

```text
画一只和参考图一模一样的银灰缅因猫（额头呆毛、大尖耳、白胸白嘴、灰虎斑、蓬松尾巴）。

和参考一样的安静坐姿，但有一个变化：头微微向左歪（约5-10度），左耳比右耳略低。

其他全部不变：同样的身体大小、同样的坐姿、脚在同一个位置、尾巴卷在身边同样位置、眼睛睁开、表情认真。

背景透明。只画一只猫，居中，周围留空白。不要文字、阴影、装饰。
```

---

#### 帧 3 — 半眨眼（眼睛半闭）

附上母设图 + R1-F1 参考帧，发送：

```text
画一只和参考图一模一样的银灰缅因猫。

和参考一样的安静坐姿，但有一个变化：眼睛半闭（半眨眼的样子），上眼皮遮住瞳孔的上半部分，能看到一条细缝。

其他全部不变：同样的头部角度、身体大小、坐姿、尾巴位置、表情严肃（不是困了或开心）。

背景透明。只画一只猫，居中。不要文字、阴影、装饰。
```

---

#### 帧 5 — 尾巴尖翘起

附上母设图 + R1-F1 参考帧，发送：

```text
画一只和参考图一模一样的银灰缅因猫。

和参考一样的安静坐姿，但有一个变化：尾巴尖翘起来，尾巴末端向上弯曲（像问号的弯钩），尾巴根部位置不变。

其他全部不变：眼睛睁开、头部正对前方、身体大小和坐姿一样。

背景透明。只画一只猫，居中。不要文字、阴影、装饰。
```

---

#### 帧 6 — 头微偏右 + 耳朵竖直

附上母设图 + R1-F1 参考帧，发送：

```text
画一只和参考图一模一样的银灰缅因猫。

和参考一样的安静坐姿，但有一个变化：头微微向右偏（约5度），两只耳朵都竖得笔直。

其他全部不变：眼睛睁开、身体大小坐姿一样、尾巴卷在身边。

背景透明。只画一只猫，居中。不要文字、阴影、装饰。
```

---

#### 生成后本地拼接

6 帧按顺序排列形成循环：

| 帧 | 来源 | 眼睛 | 头部 | 尾巴 |
|---|------|------|------|------|
| 1 | R1-F1 | 睁 | 正 | 自然卷 |
| 2 | 补生成 | 睁 | 微左歪 | 自然卷 |
| 3 | 补生成 | 半闭 | 正 | 自然卷 |
| 4 | R1-F4 | 全闭 | 微低 | 自然卷 |
| 5 | 补生成 | 睁 | 正 | 尖翘起 |
| 6 | 补生成 | 睁 | 微右偏 | 自然卷 |

循环路径：正面→左歪→半眨→全眨→回正+尾巴动→右偏→回到正面

拼接用 hatch-pet 脚本：`compose_atlas.py` 或手动 Python + Pillow。

### `running-right` 提示词 v5（8 帧）

```text
看附件的猫猫参考图。按这只猫的样子，画一条向右移动的动画行条。

角色固定：银灰缅因猫、额头呆毛、大尖耳、白胸白嘴、灰虎斑、蓬松条纹尾巴、认真表情。8 帧同一只猫。

画布：一张宽横图，约 4000×540。8 个隐形格子（每格约 500×540），每格一只完整猫。

背景：真透明 PNG。做不到就用单一纯色。不要棋盘格。

这是猫被拖拽向右移动的动画。通过身体姿态和四肢表现方向，不要画速度线、灰尘、阴影。

8 帧分镜：
第1帧：准备姿态，身体居中，开始向右倾斜
第2帧：右前爪向前迈，后半身微压
第3帧：身体在格子内微右移，尾巴反向摆到左边
第4帧：左前爪向前迈，头微低
第5帧：身体最右倾，耳朵稳定，眼睛专注
第6帧：爪子交替回来，身体微升
第7帧：尾巴反向摆回右边，身体回中
第8帧：接近第1帧但另一只爪微前，能循环

硬性要求：大小一致、基线一致、朝右、8 帧都不同。
禁止：速度线、灰尘、阴影、文字、UI、场景。

只返回一张横条图。
```

### `waving` 提示词 v5（4 帧）

```text
看附件的猫猫参考图。画一条招手动画行条。

角色固定：银灰缅因猫，同一只猫 4 帧。
画布：约 2000×540，4 格。背景透明或纯色。

猫坐着用一只前爪招手打招呼。不要画波浪线、星星、动效弧线。

4 帧分镜：
第1帧：坐姿，一只前爪开始抬起
第2帧：爪子抬到肩膀高度，肉垫微微可见
第3帧：爪子向外倾斜到招手最高点，表情友好
第4帧：爪子放下，接近第1帧可循环

只返回一张横条图。
```

### `jumping` 提示词 v5（5 帧）

```text
看附件的猫猫参考图。画一条跳跃动画行条。

角色固定：银灰缅因猫，同一只猫 5 帧。
画布：约 2500×540，5 格。背景透明或纯色。

猫从蹲下到跳起到落地。不要画阴影、灰尘、弹跳垫、着地标记。

5 帧分镜：
第1帧：蓄力下蹲，身体略低，尾巴收紧
第2帧：起跳，爪子离开基线，身体上升
第3帧：最高点，身体最高，爪子收起，尾巴上扬
第4帧：下落，身体低于第3帧，爪子准备着地
第5帧：落地稳住，接近第1帧但没那么蹲，可循环

只返回一张横条图。
```

### `failed` 提示词 v5（8 帧）

```text
看附件的猫猫参考图。画一条失败/受挫动画行条。

角色固定：银灰缅因猫，同一只猫 8 帧。
画布：约 4000×540，8 格。背景透明或纯色。

猫从正常变得沮丧再慢慢恢复。特效（泪滴、小星星）只允许贴在猫脸上，不允许飘在空中。

8 帧分镜：
第1帧：从正常到担忧，耳朵开始耷拉
第2帧：头低下，眼睛半闭
第3帧：肩膀塌下，尾巴贴近身体
第4帧：最沮丧：眼睛闭上或难过，身体最小
第5帧：可以有贴在脸上的小泪滴或腮帮鼓起
第6帧：微微恢复呼吸，头稍抬
第7帧：耳朵微抬，但表情仍然沮丧
第8帧：接近第1帧，可循环

只返回一张横条图。
```

### `waiting` 提示词 v5（6 帧）

```text
看附件的猫猫参考图。画一条等待/请求动画行条。

角色固定：银灰缅因猫，同一只猫 6 帧。
画布：约 3000×540，6 格。背景透明或纯色。

猫在等用户回应，表现出"期待、询问"的样子。必须和 idle（安静）明显不同。

6 帧分镜：
第1帧：坐着，眼睛看向用户方向，一只爪子在胸前
第2帧：爪子微抬，像在问"怎么样？"
第3帧：头微歪，耳朵竖起专注
第4帧：眨眼或眼神变柔，保持询问姿势
第5帧：爪子微放下，尾巴尖卷起
第6帧：回到接近第1帧的期待姿势，可循环

只返回一张横条图。
```

### `running` 提示词 v5（6 帧）——注意：不是跑步！

```text
看附件的猫猫参考图。画一条工作中/处理中动画行条。

角色固定：银灰缅因猫，同一只猫 6 帧。
画布：约 3000×540，6 格。背景透明或纯色。

⚠️ 这个状态叫 running 但不是跑步！是猫在专注工作/处理任务的样子。像在打字、翻东西、检查什么。

6 帧分镜：
第1帧：专注坐姿，爪子在前面，眼睛微眯
第2帧：左爪向前动，像在拨弄什么
第3帧：右爪向前动，头微低
第4帧：两只爪子靠近，身体前倾，工作最投入
第5帧：头微抬，眼睛左右扫视
第6帧：回到接近第1帧，仍然专注

只返回一张横条图。
```

### `review` 提示词 v5（6 帧）

```text
看附件的猫猫参考图。画一条审查/检查动画行条。

角色固定：银灰缅因猫，同一只猫 6 帧。
画布：约 3000×540，6 格。背景透明或纯色。

猫在仔细看什么东西，像在 review 完成的结果。不要画放大镜、纸、代码、UI。

6 帧分镜：
第1帧：挺直坐姿，眼睛睁开专注
第2帧：头微微前倾，眼睛微眯
第3帧：头偏左，一只爪子碰下巴/胸口
第4帧：眨眼或半眨眼，仍然前倾
第5帧：头偏右，眼睛睁开像在对比
第6帧：回到接近第1帧的专注表情

只返回一张横条图。
```

### `running-left` 说明

先不要单独生成。等 `running-right` 出来后，我们本地镜像试试。如果镜像后花纹/方向感不对，再单独生成。

---

## 英文 v4 提示词（保留作参考）

<details>
<summary>点击展开英文 v4 copy-paste prompt</summary>

Attach both images:

1. `docs/features/assets/F229/desktop-pet-sprite/raw/yanyan-codex-character-base-v1.png` as the character identity reference.
2. `docs/features/assets/F229/desktop-pet-sprite/layout-guides/idle.png` as the spacing/layout guide.

Then send:

```text
Use the attached cat reference image as the exact character identity. Use the attached layout guide only for spacing and slot geometry.

Create one Codex pet animation row for state `idle`.

Output exactly 6 full-body frames in one wide horizontal strip, left to right.

Preferred output: true transparent PNG with an actual alpha channel.

If true alpha transparency is not available, use one flat solid removable chroma-key background color instead. Do not use white, gray, checkerboard, or a transparency-preview checker pattern. Do not paint a checkerboard into the image.

Use a large working canvas, about 3000 x 540 px. Treat it as 6 large invisible slots, about 500 x 540 px each: one centered complete cat per slot, evenly spaced, no overlap, no cropping, no empty slots, no labels, no borders, no visible guide marks. Do not copy the blue boxes, crosshairs, or guide background into the output. This is a working strip; the final atlas will be cropped and downsampled later.

Same cat in every frame: silver-gray Maine Coon, central forehead tuft, large pointed ears with dark rim and pink inner ear, white chest and muzzle, dense gray tabby markings, fluffy striped tail, calm serious Codex expression. Do not change face shape, species, markings, palette, body proportions, tail shape, or ear shape between frames.

This is a calm low-distraction idle loop. Do not make the cat wave, walk, run, jump, work, talk, react dramatically, or use props.

Scale and baseline lock:
- Keep the cat the same apparent size in all 6 frames.
- Keep the seated body and feet on the same baseline in all 6 frames.
- Keep head top, ear height, body width, and tail size consistent.
- Each cat should occupy roughly the same area, about 360 px wide and 450 px tall inside its large working slot.
- Keep at least 60 px clear horizontal padding between the cat silhouette and the slot edges.
- Keep at least 35 px clear vertical padding above the ears and below the paws/tail.
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
- background is checkerboard, white, gray, textured, or scene-like instead of real alpha transparency or a single flat chroma-key color
- the strip is too narrow and the cats are crowded together

Return only one clean horizontal row strip image.
```
</details>

Reference QA note: `raw/yanyan-codex-idle-row-spacing-candidate-v1.png` has good spacing and stable scale, but it is rejected for production because it is RGB with a painted checkerboard background rather than true transparency or clean chroma key.
