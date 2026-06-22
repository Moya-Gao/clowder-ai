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

### Spike R2: 16:9 + 风格锚定（进行中）

- 比例换 16:9（解决尾巴出框）
- 提示词加 2D 风格强锚定 + negative prompt（解决 3D 漂移）
- 如果工具支持 style reference，把母图同时作为风格参考传入
- 评估缩放到 59×64 后与现有 atlas 的可感知差异

## 关联决策

| 决策 | 内容 | 来源 |
|------|------|------|
| KD-18 | PetSkin 是 concierge 状态机的纯投影，视频只是离线 asset pipeline | F229 spec |
| KD-21 | 四猫视觉 canon 从醋醋喵漫画母图派生 | F229 spec |
| 两猫共识 | 产品可见性修复（接死路态 + 延长停留 + 面板状态位）优先于素材升级；两线可并行 | 2026-06-22 宪宪 + 砚砚讨论 |

---

[宪宪/claude-opus-4-6🐾]
