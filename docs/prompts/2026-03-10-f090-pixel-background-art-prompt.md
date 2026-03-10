---
feature_ids: [F090]
topics: [pixel-art, background-art, visual-design]
doc_kind: prompt
created: 2026-03-10
target_model: Gemini (云端)
---

# F090 像素格斗背景图 — Gemini 生图提示词

> 用途：铲屎官复制给云端 Gemini 生成三层视差背景
> 撰写：布偶猫 Opus 4.6 + 暹罗猫 Gemini 25（视觉方案）

## 背景说明（给 Gemini 的上下文）

我们在做一个像素风格的猫猫格斗游戏 demo（Phaser 3），需要三层视差背景资产。

**游戏分辨率**：逻辑层 640×360，输出 1280×720（2x 整数缩放）
**风格**：16-bit Pixel Art，赛博朋克猫咖主题
**核心约束**：背景必须暗，不能比前景角色亮（角色是鲜艳的蓝/绿像素猫）

**调色盘（严格限制）**：
- 最深底色：`#111318`（Ink）
- 主体暗色：`#1E2430`（Slate）
- 边缘/细节：`#3A4658`（Steel）
- 霓虹点缀（极少量）：`#8D6BFF`（紫）、`#00F0FF`（青）、`#2C57A6`（蓝）、`#2FA56E`（绿）

---

## 图 1/3：远景 — 赛博城市天际线（Background）

### 提示词

```
Pixel art background for a 2D fighting game, 16-bit retro style.

Scene: A dark cyberpunk city skyline at night, viewed through a rain-streaked window.

Composition (left to right):
- Left 1/3: Tall dark buildings in silhouette, one building has a small neon sign glowing purple (#8D6BFF)
- Center: A large pixel-art neon sign reading "CAT CAFE" in cyan (#00F0FF), slightly flickering, mounted on a distant rooftop
- Right 1/3: More building silhouettes, a few tiny flying car light trails (single pixel streaks in cyan)
- Sky: Deep dark blue-black (#111318 to #1E2430 gradient using dithering, NOT smooth gradient)
- Rain: Very subtle diagonal pixel rain lines in Steel gray (#3A4658), sparse not dense

Style constraints:
- Pure pixel art, NO anti-aliasing, NO smooth gradients — use dithering for all tonal transitions
- Limited palette: #111318, #1E2430, #3A4658, #8D6BFF, #00F0FF only
- Overall brightness must be VERY LOW — this is a far background layer, must not compete with foreground characters
- 16x16 pixel tile grid visible in architecture
- Scanline texture optional but subtle

Output: 1280x720 PNG, transparent-safe (no transparency needed for this layer, solid background)
```

### 预期效果
深沉的雨夜城市，几乎是剪影，只有零星霓虹招牌发光。整体亮度不超过前景的 30%。

---

## 图 2/3：中景 — 猫咖内景（Midground）

### 提示词

```
Pixel art midground layer for a 2D fighting game, 16-bit retro style.
This layer will be composited ON TOP of a dark city background, so it needs TRANSPARENT BACKGROUND (alpha channel).

Scene: Interior silhouettes of a cyberpunk cat café, seen from the side (like a cross-section).

Elements (spaced across the full width):
- Left side: A tall cat climbing tower / cat tree (3-4 tiers), dark silhouette in #1E2430 with subtle Steel (#3A4658) edge highlights
- Left-center: A small round café table with two stools, silhouette style
- Center: A large window frame — the window is EMPTY/TRANSPARENT (this is where the city background shows through). Window frame is thick pixel border in #3A4658. Light rays come through the window as very faint cyan (#00F0FF at 10% opacity) diagonal streaks
- Right-center: A pixel coffee machine / espresso maker on a bar counter, tiny green (#2FA56E) power LED dot
- Right side: Another smaller cat shelf / perch

Style constraints:
- All elements are DARK SILHOUETTES — no bright fills, only edge highlights in #3A4658
- Transparent PNG background (alpha channel) — only the furniture/architecture elements are opaque
- Pure pixel art, NO anti-aliasing, no smooth edges
- Limited palette: #1E2430 (fills), #3A4658 (edges), tiny accent dots only
- This layer sits at y=80 to y=280 in 640x360 logical space (upper-mid portion of screen)
- Bottom portion (where cats fight) should be EMPTY — no furniture blocking the battle area

Output: 1280x720 PNG with transparent background (alpha channel)
```

### 预期效果
暗色猫咖家具剪影，中间大窗户透出远景城市。像是在一个赛博猫咖里办的地下格斗赛。

---

## 图 3/3：前景 — 战斗地台（Floor）

### 提示词

```
Pixel art floor/stage layer for a 2D fighting game, 16-bit retro style.
This is the ground platform where characters stand and fight.

Scene: An industrial metal floor / arena platform, viewed from the side.

Composition:
- Top edge: A bright horizontal line in Steel (#3A4658), 2px thick — this is the "stage edge" where characters' feet land
- Main floor surface (below the edge line): Dark metal grid/grate pattern
  - Base fill: #1E2430 (Slate)
  - Grid lines: #3A4658 (Steel), forming a subtle 16x16 tile pattern
  - In the grid seams/cracks: Very faint glowing cyan (#00F0FF at 15-20% opacity) light bleeding through, as if there's machinery underneath
  - A few rivets/bolts as single bright pixels in #3A4658
- Bottom: Fades to pure black (#111318)

Style constraints:
- Pure pixel art, no anti-aliasing
- The glow in the cracks should use dithering, NOT smooth glow — individual scattered cyan pixels
- Overall very dark, the floor should ground the scene without drawing attention
- Width: full 1280px, Height: about 200px (the floor occupies bottom ~28% of frame)
- Limited palette: #111318, #1E2430, #3A4658, #00F0FF (cracks only)

Output: 1280x720 PNG — top portion transparent (alpha), bottom 200px is the floor
```

### 预期效果
冰冷的金属擂台地板，缝隙中渗出幽幽青光，工业质感。角色脚踩在上面会很有"重量感"。

---

## 合成预览说明

三层从后到前叠加：
```
Layer 0 (最远): Background.png — 赛博城市（不透明，铺满）
Layer 1 (中间): Midground.png — 猫咖内景（透明底，家具剪影）
Layer 2 (最近): Floor.png — 金属地台（透明底，只有下方 200px）
Layer 3: 角色 + HUD（代码绘制，不需要生图）
```

叠加后效果：透过猫咖的大窗户能看到外面的赛博城市，脚下是金属擂台，猫猫在中间打架。

## 注意事项

1. **一定要像素风！** 不要 AI 画风的那种光滑渐变，要能看到一个个像素点
2. **暗！暗！暗！** 前景角色是鲜艳色，背景必须压暗
3. **用 dithering 不用 gradient** — 明暗过渡用散点抖动
4. **中景和地台需要透明背景**（PNG alpha）
5. 如果一次只能生一张，**优先生远景 Background**，这是最关键的氛围层

## 执行记录（2026-03-10 08:00 布偶猫补充）

### 执行方式
- **不是铲屎官手动复制** — 布偶猫用 Chrome MCP 浏览器自动化直接在 Gemini 上操作
- 流程：`image-generation` skill → Chrome MCP → Gemini "制作图片" → execCommand 注入 → 灯箱下载
- 三张图全程自动化，无需人工介入

### 实际生成 vs 预期

| 层级 | 预期 | 实际 | 差异 |
|------|------|------|------|
| Background | 纯城市天际线剪影 | 赛博猫咖完整场景（含猫角色） | Gemini 理解为"猫咖格斗背景"而非"纯城市远景" |
| Midground | 暗色家具剪影 + 透明底 | 废墟/工业风详细场景 + 透明底 | 太亮太密，作为中景不可用 |
| Floor | 金属格栅 + 青色裂缝光 | 石质地砖 + 木箱 + 格栅 | 风格偏废墟，但可用 |

### 关键 takeaway
1. 远景图虽然不是纯城市剪影，但作为单层完整背景反而效果很好
2. 中景"暗色剪影"对 Gemini 来说太抽象，需要更具体的约束（或后处理）
3. 合成时 opacity 调到 25-35% 是关键——AI 生成的图普遍偏亮
