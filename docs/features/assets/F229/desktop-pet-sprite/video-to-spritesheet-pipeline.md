# Video-to-Spritesheet Pipeline（视频截帧 → Atlas 素材）

> **状态**: spike-in-progress
> **创建**: 2026-06-22 宪宪 + 砚砚 + 铲屎官脑洞
> **真相源**: 本文件（提示词、pipeline 步骤、学习记录）
> **关联**: F229 BUG-UX-6 动画可见性、KD-18 PetSkinContract、KD-21 四猫视觉 canon

## Why

当前 atlas 的 9 态帧是**逐帧独立生图**，时序一致性差（体型漂移、风格跳变）。
铲屎官脑洞：用现有猫设定母图 → AI 视频生成 → 截帧，利用视频模型的时序连贯性
产出自然流畅的动画帧。

**核心验证问**：缩到 59×64px 桌宠显示尺寸后，视频截帧是否可感知优于现有 atlas？

## Pipeline 总览

```
角色设定母图 ──→ 生成首尾帧（砚砚/imagegen）
                      │
                      ▼
              AI 视频生成（铲屎官手动，Kling/Runway/Pika）
                      │
                      ▼
              截帧 + 抠图（ffmpeg + 背景移除）
                      │
                      ▼
              缩放 → 合成 atlas 行 → 接入 pet.json
```

**KD-18 合规**：视频生成是离线 asset pipeline，不进 runtime。
`conciergeState → petState` 投影逻辑零改动，纯 asset swap。

## Step 1: 母图源文件

| 角色 | 四足设定图（桌宠用） | 二足设定图（vlog 用） |
|------|---------------------|---------------------|
| 布偶猫/宪宪 | `character-sheets/xianxian-r03.png` | `character-sheets/xianxian-upright-r03.png` |
| 缅因猫/砚砚 | `character-sheets/cucu-yanyan-r03.png` | `character-sheets/cucu-yanyan-upright-r03.png` |
| 暹罗猫/烁烁 | `character-sheets/shuoshuo-cat-r02.png` | `character-sheets/shuoshuo-upright-r02.png` |

**路径基准**: `docs/videos/cucu-pr-flow/assets/references/`

设定图是拼合图，每张包含多个姿态/表情。首尾帧生成时参考对应姿态区域即可。

## Step 2: 首尾帧生成提示词

### 通用约束（所有状态通用）

- 纯白背景 `#FFFFFF`，无阴影、无地面线
- 角色居中，占画布约 60%
- 画布 1024×1024 正方形
- **风格锚定（关键！）**：必须保持 2D 手绘插画风格，与母图设定一致。具体要求：
  - 2D flat illustration / hand-drawn anime style / cel-shaded
  - 线条清晰可见（clean outlines, visible ink lines）
  - 色块平涂（flat color fills, no gradients on fur）
  - **禁止**：3D rendering, CGI, photorealistic, plastic/clay look, Pixar style, subsurface scattering
- **Frame A 和 Frame B 的角色位置、大小、角度必须完全一致**，只有指定部位有微小变化
- **输入图就是风格参考**：如果工具支持 "style reference" / "reference image" 功能，把母图同时作为风格参考传入

### idle 态（呼吸 + 尾巴轻摆）

**Frame A — 呼气/放松态**

```text
Reference image attached: xianxian-r03.png (top-left sitting pose)

Generate a single illustration of this exact cat character in a relaxed sitting pose.
- Gray tabby Ragdoll cat, white chest and belly, blue eyes
- Purple collar with small purple flower pendant
- Sitting facing slightly right (3/4 view), tail curled to the side
- Chest in relaxed/exhale position
- Expression: calm, content, eyes open
- Pure white background (#FFFFFF), no shadows, no floor line
- Style: soft anime/chibi, clean vector-like lines, same as reference
- Canvas: square 1024x1024, character centered, occupying ~60% of frame
```

**Frame B — 吸气态**

```text
Same character, same exact pose and angle as Frame A.
Only differences:
- Chest slightly expanded (inhale)
- Tail tip shifted ~15 degrees to the other side
- Eyes half-closed (sleepy blink mid-point)
- Everything else IDENTICAL: same position, same size, same background
```

### running-right 态（原地小跑）

**Frame A — 右前腿抬起**

```text
Same cat character, side view facing right.
- Mid-stride trot pose: right front leg raised, left front leg planted
- Tail streaming behind, slightly up
- Expression: alert, focused, mouth closed
- Body center at same position as idle Frame A
- Pure white background, 1024x1024
```

**Frame B — 左前腿抬起**

```text
Same character, same body center position.
Only differences:
- Left front leg raised, right front leg planted (opposite of Frame A)
- Tail position shifted slightly (natural follow-through)
- Everything else IDENTICAL
```

### waving 态（招手）

**Frame A — 右前爪抬起**

```text
Same cat character, 3/4 view facing slightly right.
- Sitting pose, right front paw raised to ~eye level
- Paw pad visible, slight wave gesture
- Expression: happy, mouth slightly open
- Pure white background, 1024x1024
```

**Frame B — 爪摆动到另一侧**

```text
Same character, same sitting pose.
Only differences:
- Right paw shifted ~20 degrees (wave motion)
- Tail tip shifted opposite direction
- Everything else IDENTICAL
```

## Step 3: 视频生成提示词

### 通用视频提示词模板

```text
2D hand-drawn anime illustration style, flat cel-shaded coloring, clean visible outlines.
A cute chibi [cat description] [action description].
[specific motion details].
Maintain consistent 2D illustration style throughout, no 3D rendering.
No other movement. No camera motion. Pure white background.
Smooth, gentle loop. 2 seconds.
```

**Negative prompt（如果工具支持）**：
```text
3D, CGI, photorealistic, plastic, clay, Pixar, rubber, glossy, subsurface scattering,
realistic fur texture, depth of field, lens blur, film grain, cinematic lighting
```

> ⚠️ **R1 教训（2026-06-22）**：不加 2D 风格锚定时，视频工具容易往"塑料建模 3D 感"漂移。
> 第一次（9:16 竖屏）风格对了，后续抽卡变 3D。解决：强锚 2D + 反向排除 3D。

### 按状态

**idle**
```text
2D hand-drawn anime illustration style, flat cel-shaded coloring, clean visible outlines.
A cute chibi gray tabby cat sitting still, breathing gently.
The chest rises and falls with a slow, natural breathing rhythm.
The fluffy tail sways very slowly left and right.
The cat occasionally blinks.
Maintain flat 2D illustration look with visible ink outlines, NOT 3D or photorealistic.
No other movement. No camera motion. Pure white background.
Smooth, gentle loop. 2 seconds.
```

**running-right**
```text
2D hand-drawn anime illustration style, flat cel-shaded coloring, clean visible outlines.
A cute chibi gray tabby cat trotting in place, facing right.
Small gentle running motion, legs alternating front and back.
The tail bounces slightly with each step.
No forward displacement, stay centered.
Maintain flat 2D illustration look, NOT 3D or photorealistic.
No camera motion. Pure white background.
Smooth, gentle loop. 2 seconds.
```

**waving**
```text
2D hand-drawn anime illustration style, flat cel-shaded coloring, clean visible outlines.
A cute chibi gray tabby cat sitting and waving one front paw.
The right paw waves gently side to side at eye level.
The expression is happy with a slight smile.
The body stays still, only the paw moves.
Maintain flat 2D illustration look, NOT 3D or photorealistic.
No camera motion. Pure white background.
Smooth, gentle loop. 2 seconds.
```

### 视频工具设置建议

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| 模式 | 首尾帧（first + last frame）或单图 i2v | 首尾帧更可控；单图更稳 |
| 时长 | 2 秒 | 截 6-8 帧够循环 |
| 分辨率 | ≥720p | 越高越好截帧，最终会缩放 |
| 画面比例 | **16:9**（横屏） | ⚠️ 9:16 竖屏会导致尾巴摆动出框！ |
| 运动强度 | **低 / gentle / subtle** | 大幅运动导致角色变形 |
| 背景 | 保持纯白 | 便于后续抠图 |

## Step 4: 截帧 + Atlas 合成

```bash
# 1. 截帧（每秒 4 帧，2s 视频 = 8 帧）
ffmpeg -i input_video.mp4 -vf "fps=4" frame_%02d.png

# 2. 抠图（如果背景不够干净）
# 选项 A: 纯白背景直接用 ImageMagick 转透明
convert frame_01.png -fuzz 10% -transparent white frame_01_alpha.png

# 选项 B: AI 抠图（rembg / 在线工具）
# 对纯白背景一般 ImageMagick 就够

# 3. 缩放到 atlas cell 尺寸
convert frame_01_alpha.png -resize 192x208 -gravity center -extent 192x208 cell_01.png

# 4. 横向拼接成 row strip
convert cell_01.png cell_02.png ... +append idle_row.png

# 5. 验证：缩放到实际桌宠尺寸看效果
convert cell_01.png -resize 59x64 preview_01.png
```

最终 row strip 接入现有 `hatch-pet` pipeline → 合成 `spritesheet.webp` → 更新 `pet.json`。

## Spike 日志

### Spike R1: 布偶猫 idle（2026-06-22）

**执行人**：砚砚生成首尾帧 → 铲屎官生成视频 → 宪宪截帧评估

**结果**：
- Frame A（放松态）生成质量稳定，身份保持好
- Frame B（吸气态）经 3 轮迭代，最终 B3 可用但非像素级锁定（imagegen 对精确编辑锁帧不稳定）
- **铲屎官反馈**："效果非常棒"

**发现的问题**：
1. 尾巴摆动时超出画面边框 → **根因：9:16 竖屏比例，画面太窄** → 解决：换 16:9 横屏
2. imagegen 对"只改眼睛/胸口/尾巴尖"的精确编辑不可靠，前两版 Frame B 都发生缩放/构图漂移
3. 如果视频工具支持单图 i2v，Frame A + 低运动提示词比首尾帧模式更稳

**学习**：
- 单图 i2v + 精确运动提示词 > 首尾帧（当首尾帧无法像素级锁定时）
- 运动强度必须设低，否则角色会变形
- 16:9 横屏给尾巴/肢体运动留足空间
- ⚠️ **风格漂移**：多次生成时风格不一致——第一次二次元感觉对，后续变成"塑料建模 3D 感"。根因：视频提示词缺风格锚定。解决：提示词首行加 `2D hand-drawn anime illustration style, flat cel-shaded coloring, clean visible outlines` + negative prompt 排除 3D/CGI/photorealistic

### Spike R2: 16:9 + 风格锚定（2026-06-22）✅ 成功

**执行人**：砚砚生成 Frame A → 铲屎官生成视频（16:9, 1280×720, 3s, 24fps）→ 宪宪截帧评估

**视频参数**：
- 比例：16:9（解决了 R1 尾巴出框）
- 时长：3 秒
- 分辨率：1280×720
- 2D 风格锚定提示词：生效，全帧保持手绘二次元风格，零 3D 漂移

**截帧处理**：
- ffmpeg 4fps → 12 帧原始 PNG
- ImageMagick center-crop 665×720 → 背景透明化（fuzz 15%）→ 缩放 192×208（atlas cell）
- 再缩放 59×64（实际桌宠显示尺寸）

**核心结论：在 59×64 桌宠尺寸下，视频截帧可感知优于现有静态生成 atlas**

| 维度 | 视频截帧（新） | 静态逐帧生成（现有） |
|------|-------------|-------------------|
| 帧间一致性 | ✅ 比例/姿态/风格全帧一致 | ❌ 头身比例跳变、风格微漂 |
| 动画自然度 | ✅ 有真实眨眼、微妙尾巴摆、呼吸感 | ⚠️ 帧间生硬，缺自然过渡 |
| 59×64 可读性 | ✅ 轮廓清晰、蓝眼/紫项圈可识别 | ⚠️ 更暗/更糊，细节丢失多 |
| 循环流畅度 | ✅ 视频天然时序连贯 | ❌ 逐帧独立生成无时序关系 |

**产出文件**（`/tmp/cat-cafe-evidence/xianxian-video-spike-r2/`）：
- `xianxian-idle-spike-r2.mp4`：原始视频
- `frames-raw/`：12 帧原始 PNG（1280×720）
- `frames-cell/`：12 帧 atlas cell（192×208，透明背景）
- `frames-preview/`：12 帧桌宠预览（59×64）
- `row-strip-cell.png`：12 帧行条（cell 尺寸）
- `row-strip-preview.png`：12 帧行条（预览尺寸）
- `comparison-contact.png`：新旧对比图

## 宪宪（布偶猫）9 态生产任务总表

> **目标**：用 video pipeline 把 ragdoll-v1 从 4 张静态图升级到 9 态动画 atlas（与 yanyan-codex 同规格）。
> **分工**：砚砚生成 Frame A → 铲屎官生成视频 → 宪宪截帧+合成 atlas。
> **母图参考**：`character-sheets/xianxian-r03.png`（四足设定，所有状态通用）。
> **running-left 不需要单独拍视频**——水平翻转 running-right 的帧即可。

### 总览

| # | 状态 | Atlas Row | 需要帧数 | 视频需要？ | 状态 |
|---|------|-----------|---------|-----------|------|
| 1 | idle | 0 | 6 | ✅ R2 已完成 | ✅ done |
| 2 | running-right | 1 | 8 | 需要 | 🔴 待做 |
| 3 | running-left | 2 | 8 | ❌ 翻转 running-right | 🔴 待做 |
| 4 | waving | 3 | 4 | 需要 | 🔴 待做 |
| 5 | jumping | 4 | 5 | 需要 | 🔴 待做 |
| 6 | failed | 5 | 8 | 需要 | 🔴 待做 |
| 7 | waiting | 6 | 6 | 需要 | 🔴 待做 |
| 8 | running | 7 | 6 | 需要 | 🔴 待做 |
| 9 | review | 8 | 6 | 需要 | 🔴 待做 |

**需要拍 7 个视频**（idle 已完成，running-left 翻转），砚砚为每个视频生成 1 张 Frame A。

---

### 各态 Frame A 提示词（给砚砚生成首帧）

> 所有提示词共享的前缀（不再重复写）：
> ```
> Reference image: xianxian-r03.png (gray tabby Ragdoll cat with blue eyes, purple collar, purple flower pendant)
> Style: 2D hand-drawn anime/chibi, flat cel-shaded, clean visible outlines — match the reference exactly.
> Canvas: 1024x1024, character centered ~60%, pure white background #FFFFFF, no shadows.
> ```

**② running-right — 右向小跑**
```text
[共享前缀]
The cat is mid-stride trotting to the right (side view).
- Right front leg raised forward, left front leg planted behind
- Back legs in opposing stride phase
- Tail streaming behind, slightly raised
- Body leaning slightly forward with forward momentum
- Expression: alert, focused, mouth closed
- All four paws visible
```

**④ waving — 招手**
```text
[共享前缀]
IMPORTANT — ANATOMY: This cat has EXACTLY 4 paws total (2 front, 2 back). No extra limbs.

The cat is sitting, facing 3/4 right, raising ONE front paw in a friendly wave.
- FRONT RIGHT PAW: raised to eye level, waving. This is the ONLY raised paw.
- FRONT LEFT PAW: planted flat on the ground, clearly visible, supporting the body.
- BACK PAWS: both tucked under the body / hidden behind the front body — NOT individually visible.
  (Chibi cats sitting in 3/4 view naturally hide back paws behind the round body shape.)
- Tail curled to the left side, resting on the ground.
- Expression: cheerful, eyes bright, mouth slightly open in a smile.
- The body is a simple round chibi shape — do NOT draw extra legs or paws sticking out.

NEGATIVE: Do NOT draw more than 4 paws. Do NOT show 5 or 6 paws. No extra limbs, no duplicate legs, no phantom paw shapes in the background.
```

> ⚠️ **五爪 bug（2026-06-22）**：砚砚前两次 waving 生成均出现 5 只爪子。
> 根因：原提示词未显式限制爪数，3/4 视角让 imagegen 幻觉出多余的爪。
> 修复策略：① 显式声明 "EXACTLY 4 paws" ② 把后腿藏在身体后面（减少需要画的爪子数）③ 添加 NEGATIVE 约束

**⑤ jumping — 跳跃**
```text
[共享前缀]
The cat is in a pre-jump crouch, about to spring up.
- Body low, haunches compressed, ready to leap
- Front paws lifted slightly off ground
- Tail low and tense
- Expression: excited, eyes wide, ears perked forward
- Facing slightly right (3/4 view)
```

**⑥ failed — 沮丧/失败**
```text
[共享前缀]
The cat is sitting with a dejected, sad expression.
- Head slightly lowered, looking down
- Ears slightly flattened (not fully flat, still cute)
- Tail wrapped around body, tip drooping
- A small sweat drop near the head (anime convention for embarrassment/failure)
- Expression: apologetic, slightly worried eyes
- Facing forward, 3/4 view
```

**⑦ waiting — 耐心等待**
```text
[共享前缀]
The cat is sitting upright, looking slightly to the side as if waiting.
- Sitting tall and alert, front paws neatly together
- Head tilted very slightly to the right (curious/patient)
- Tail resting on the ground, tip slightly curved
- Expression: calm, patient, eyes looking to the side
- A subtle "..." or thought bubble above head (optional, anime convention)
```

**⑧ running — 正面小跑**
```text
[共享前缀]
The cat is trotting forward (3/4 front view, slightly facing right).
- Mid-stride, one front paw raised
- Body bouncing slightly with the trot motion
- Tail up and perky behind
- Expression: happy, energetic, mouth slightly open
- Less extreme stride than running-right (more of a jaunty walk)
```

**⑨ review — 专注审视**
```text
[共享前缀]
The cat is sitting attentively, studying something with concentration.
- Head slightly tilted, eyes focused and slightly narrowed (thinking)
- One front paw raised to chin level (thinking gesture)
- Tail still, wrapped around one side
- Expression: thoughtful, concentrated, serious but cute
- Facing 3/4 right
- Pose reference: bottom-right expression from xianxian-r03.png (the sparkly/concentrated look)
```

---

### 各态视频生成提示词（给铲屎官生成视频）

> 所有提示词共享的前缀/后缀：
> ```
> 前缀: 2D hand-drawn anime illustration style, flat cel-shaded coloring, clean visible outlines.
> 后缀: Maintain flat 2D illustration look with visible ink outlines, NOT 3D or photorealistic.
>       No camera motion. Pure white background. Smooth, gentle loop. 2 seconds.
> Negative: 3D, CGI, photorealistic, plastic, clay, Pixar, rubber, glossy, subsurface scattering,
>           realistic fur texture, depth of field, lens blur, film grain, cinematic lighting
> ```

**② running-right**
```text
[前缀]
A cute chibi gray tabby cat trotting in place, facing right.
Small gentle running motion with legs alternating in a natural trot cycle.
The tail bounces lightly with each step.
No forward displacement — the cat stays centered in frame.
[后缀]
```

**④ waving**
```text
[前缀]
A cute chibi gray tabby cat sitting and waving one front paw.
The right paw waves gently back and forth at eye level in a friendly greeting.
The body stays still, only the paw and ears move slightly.
The expression is cheerful with a slight smile.
[后缀]
```

**⑤ jumping**
```text
[前缀]
A cute chibi gray tabby cat performing a small happy jump.
The cat crouches slightly, then springs up into the air, lands softly.
Ears bounce with the motion. The tail follows the arc.
Small, contained jump — not a big leap, more of a playful hop.
[后缀]
```

**⑥ failed**
```text
[前缀]
A cute chibi gray tabby cat looking sad and dejected.
The cat lowers its head slightly, ears droop a little.
A small anime-style sweat drop appears near the head.
The tail droops and curls around the body.
Subtle, gentle sadness — still cute, not dramatic.
[后缀]
```

**⑦ waiting**
```text
[前缀]
A cute chibi gray tabby cat sitting patiently, waiting.
The cat sits upright, occasionally tilting its head slightly side to side.
Eyes blink slowly. Tail tip twitches gently.
Calm, patient posture — like waiting for something interesting.
[后缀]
```

**⑧ running**
```text
[前缀]
A cute chibi gray tabby cat doing a jaunty forward trot in place.
Slight 3/4 angle facing right. Bouncy, happy walking motion.
Front paws alternating, body bobbing gently up and down.
Tail perky and swaying with the rhythm.
[后缀]
```

**⑨ review**
```text
[前缀]
A cute chibi gray tabby cat sitting and thinking intently.
The cat tilts its head slightly, eyes narrow in concentration.
One paw occasionally rises toward its chin in a thinking gesture.
Subtle, focused micro-movements — very still otherwise.
[后缀]
```

---

### 执行清单（按批次 2-2-3）

> 铲屎官要求分批审核。每批 CVO 审核通过后才继续下一批。

**Batch 1（running-right + waving）**
- [x] running-right Frame A — ✅ CVO 审核通过
- [ ] waving Frame A — 🔴 五爪 bug，两次重试均失败，提示词已修正（v2）
- [ ] jumping Frame A
- [ ] failed Frame A
- [ ] waiting Frame A
- [ ] running Frame A
- [ ] review Frame A

**Batch 2: 铲屎官生成 7 个视频**
- [ ] running-right 视频（16:9, 2s, 低运动）
- [ ] waving 视频
- [ ] jumping 视频
- [ ] failed 视频
- [ ] waiting 视频
- [ ] running 视频
- [ ] review 视频

**Batch 3: 宪宪截帧 + 合成 atlas**
- [ ] 各视频截帧（ffmpeg 4fps）
- [ ] 裁剪+抠图+缩放到 192×208
- [ ] idle: 从 R2 的 12 帧选 6 帧
- [ ] running-left: 水平翻转 running-right 的 8 帧
- [ ] 9 行拼接成 spritesheet（1536×1872）
- [ ] 输出 WebP + 更新 pet.json
- [ ] 在桌宠里实测对比

## 关联决策

| 决策 | 内容 | 来源 |
|------|------|------|
| KD-18 | PetSkin 是 concierge 状态机的纯投影，视频只是离线 asset pipeline | F229 spec |
| KD-21 | 四猫视觉 canon 从醋醋喵漫画母图派生 | F229 spec |
| 两猫共识 | 产品可见性修复（接死路态 + 延长停留 + 面板状态位）优先于素材升级；两线可并行 | 2026-06-22 宪宪 + 砚砚讨论 |

---

[宪宪/claude-opus-4-6🐾]
