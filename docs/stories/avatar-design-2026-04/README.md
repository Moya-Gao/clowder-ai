---
title: 猫猫头像设计 — 三猫挤镜头 + 铲屎官被占领
date: 2026-04-09
participants: [opus, gemini, gpt52, landy]
status: prompts-ready
---

# 猫猫头像设计

> 起因：公司 1500 人群满员了，居然没有群头像。铲屎官的个人头像还是巫山框架时代的。
> 三猫讨论后铲屎官一句"猫味呢！？你们才是主角吧？我是你们的挂件～"把方向全部推翻重来。
> 终于把以前 Java 的工作全部交接掉了，今天新的开始！

## 设计共识

| 项目 | 方向 | 关键约束 |
|------|------|---------|
| 群头像 | 猫是主角，三个方向备选 | 40px 圆形裁切可辨识；不靠字；大色块高对比 |
| 个人头像 | 猫占领铲屎官 | 二次元/动漫风格，和猫头像同一画风 |

### 裁切安全规则

- 关键特征（猫眼、耳尖、毛色分界）控制在 **直径 85% 安全圆**内
- 三猫用**三角构图**不用横排（圆形裁切会吃掉两侧耳朵）
- 个人头像构图重心上移，猫耳离顶边至少 7-8% 半径
- 出图后叠圆形 + 圆角矩形双遮罩校验

### 色卡：赛博猫咖 (Cyber Cafe)

| 用途 | 名称 | 色号 |
|------|------|------|
| 底色（大面积） | 深邃醇咖 | `#2A1B38` |
| 主亮色 | 奶油拿铁 | `#FFF8E7` |
| 主亮色 | 焦糖橘 | `#FF8A00` |
| 点睛高光 | 薄荷电火花 | `#00FFCC` |

### 三猫特征速查

| 猫 | 品种特征 | 核心识别色 |
|----|---------|-----------|
| 宪宪 | 布偶猫：蓝色大圆眼、蓬松白色长毛、脸部淡色重点色 | 白 / 奶油 |
| 砚砚 | 缅因猫：大体型、耳尖簇毛、棕色经典虎斑纹、威武 | 棕 / 深琥珀 |
| 烁烁 | 暹罗猫：奶油色身体 + 深色面具（脸/耳/爪/尾）、蓝色杏仁眼 | 黑 / 深巧克力 |

---

## Prompt 1: 三猫挤爆镜头（群头像）

> 三猫大头贴自拍，挤成三角形。

```
Three adorable cartoon cats pressing their faces tightly against the camera
in a triangular composition that fills 85% of a circular frame.

Top center: a Siamese cat with a dark chocolate face mask, large pointed
ears, and glowing cyan-green almond-shaped eyes (#00FFCC), looking
mischievous and slightly smug.

Bottom-left: a Ragdoll cat with fluffy pure white fur, big round blue eyes,
and a gentle calm expression, cheeks squished against the Siamese above.

Bottom-right: a Maine Coon cat with wild tufted ears, classic brown tabby
markings, and an intense confident gaze, pressing in from the side.

All three cats' cheeks are comically squished together. Their fur textures
contrast strongly: silky white, rugged tabby, and sleek dark points.

Style: anime / 2D cel-shaded illustration, clean bold outlines, warm
lighting. Background: deep purple-brown (#2A1B38). Cat fur highlights in
cream (#FFF8E7) and caramel orange (#FF8A00). Eyes glow with cyan-green
(#00FFCC) accent. High contrast, designed to be recognizable as a 40px
circular thumbnail. No text.
```

## Prompt 2: 猫爪咖啡（群头像）

> 俯视咖啡杯，拉花是猫爪印，杯沿挂着猫尾巴。

```
Top-down view of a coffee cup on a dark surface. The latte art in the
creamy foam forms a perfect cat paw print. A fluffy striped cat tail
(Maine Coon tabby pattern) drapes casually over the cup rim, as if a cat
just walked away after dipping its paw.

A tiny Siamese ear tip peeks from the bottom edge of the frame — the cat
is hiding just out of view.

Style: anime / 2D illustration, cozy and minimal. Deep coffee-brown
background (#2A1B38), warm cream foam (#FFF8E7), paw print in caramel
orange (#FF8A00), subtle cyan-green steam wisps (#00FFCC) rising from the
cup. Clean composition, high contrast, optimized for 40px circular avatar.
No text.
```

## Prompt 3: 叠叠猫（群头像）

> 三猫叠罗汉，最底下露出铲屎官被压扁的手。

```
Three cats stacked on top of each other like a totem pole, filling a
vertical composition within a circular frame.

Top: a Siamese cat perched triumphantly at the peak, dark-masked face with
glowing cyan eyes (#00FFCC), tail held high, looking proud and slightly
chaotic.

Middle: a Ragdoll cat with fluffy white fur, looking mildly squished but
serenely accepting its fate, blue eyes half-closed in zen-like patience.

Bottom: a massive Maine Coon cat as the sturdy foundation, brown tabby fur,
powerful build, ears with dramatic tufts, bearing the weight with dignity.

At the very bottom of the stack, a single human hand sticks out comically,
fingers splayed in a "help me" gesture — the cat-dad is completely buried
under his cats.

Style: anime / 2D cel-shaded, humorous and warm. Background: deep
purple-brown (#2A1B38). Fur colors: white, brown tabby, dark chocolate
points. Accents in caramel orange (#FF8A00) and cyan-green (#00FFCC).
Vertical composition centered for circular crop. No text.
```

## Prompt 4: 猫占领（个人头像）

> 铲屎官被猫主子们彻底占领，一脸"我已经放弃挣扎"的幸福。

```
A young East Asian male in anime / 2D style with a boyish, youthful
"shonen" (少年感) aesthetic — soft rounded features, big expressive eyes,
NO glasses, messy-cute dark hair. Slim build, wearing a simple oversized
casual top (like a soft knit or loose tee). He looks like he belongs in
the same world as the cats — equally cute and approachable, not "cool
adult" but "the boy the cats chose." Warm happy expression that says
"I've given up resisting my cats and I love it."

A large fluffy white Ragdoll cat is sprawled luxuriously across the top of
his head, belly-up, completely relaxed. Its long fluffy tail dangles down
across his forehead playfully.

A small Siamese cat with dark face mask is perched on his left shoulder,
leaning forward with curious glowing cyan eyes (#00FFCC), one paw reaching
toward the camera.

The composition is deliberately top-heavy — the cats dominate the upper
70% of the frame while the human is compressed into the lower portion,
reinforcing the "the cats own me" dynamic.

Style: anime / 2D cel-shaded illustration, same art style as the group
avatar. Background: deep purple-brown (#2A1B38). Warm lighting on face,
cream (#FFF8E7) and caramel (#FF8A00) highlights in cat fur. Designed for
circular avatar crop — human chin can be cut off by the frame, but cat
ears must stay within the top safe zone (7-8% margin from edge). No text.

[铲屎官确认：不近视、健身阳光型、开朗小帅哥。已更新描述]
```

---

## 下一步

1. ~~铲屎官确认/调整提示词（特别是 Prompt 4 的外貌描述）~~ ✅ 已确认
2. 烁烁用 Midjourney / DALL-E / Gemini 出图
3. 三猫 + 铲屎官投票选定
4. 叠圆形 + 圆角矩形裁切校验
5. 上线！

---

*[宪宪/Opus-46] 提示词 | [烁烁/Gemini] 视觉方向 + 色卡 | [砚砚/GPT-5.4] 用户视角审美判断*
