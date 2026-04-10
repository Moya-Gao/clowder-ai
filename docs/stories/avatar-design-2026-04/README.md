---
title: 猫猫头像设计 — 三猫挤镜头 + 铲屎官被占领
date: 2026-04-09
participants: [opus, gemini, gpt52, landy]
status: prompts-v2
---

# 猫猫头像设计

> 起因：公司 1500 人群满员了，居然没有群头像。铲屎官的个人头像还是巫山框架时代的。
> 三猫讨论后铲屎官一句"猫味呢！？你们才是主角吧？我是你们的挂件～"把方向全部推翻重来。
> 终于把以前 Java 的工作全部交接掉了，今天新的开始！

## 设计共识

| 项目 | 方向 | 关键约束 |
|------|------|---------|
| 群头像 | 猫是主角，三个方向备选 | 40px 圆形裁切可辨识；不靠字；大色块高对比 |
| 个人头像 | 猫占领铲屎官 | 二次元/动漫风格，少年感正太，和猫头像同一画风 |

### 风格参考

**必须参考现有头像的画风！** 铲屎官会贴现有头像作为参考图。

现有头像位置：
- 宪宪：`assets/avatars/opus.png`
- 砚砚：`assets/avatars/codex-1.png`
- 烁烁：`assets/avatars/gemini.png`

画风特征：温暖柔和的卡通/动漫风，圆润线条，柔和光影，暖色调背景，猫咖氛围——不是赛博朋克，是**治愈系**。

### 裁切安全规则

- 关键特征（猫眼、耳尖、项圈）控制在 **直径 85% 安全圆**内
- 三猫用**三角构图**不用横排（圆形裁切会吃掉两侧耳朵）
- 个人头像构图重心上移，猫耳离顶边至少 7-8% 半径
- 出图后叠圆形 + 圆角矩形双遮罩校验

### 三猫特征速查（以实际头像为准！）

| 猫 | 毛色 | 眼睛 | 项圈 | 吊坠 | 性格道具 |
|----|------|------|------|------|---------|
| 宪宪（布偶猫） | **蓝双山猫纹 (Blue Bicolor Lynx Point)**：奶白色身体为主 + 蓝灰色重点色区域（头顶、耳朵、尾巴、爪垫）带**条纹纹路**，蓬松长毛 | **蓝色**大圆眼 | **紫色** | **金色星星** ⭐ | 温柔优雅，蓬松但匀称 |
| 砚砚（缅因猫） | **银灰色经典虎斑**：银灰底色 + 深灰条纹，长毛蓬松，体型大 | **琥珀金色** | **青绿色** | **金色 "GPT" 字样** | 端坐如学者，旁边有书 |
| 烁烁（暹罗猫） | **经典暹罗重点色**：奶油白身体 + 深巧克力色面具/耳/爪/尾 | **蓝色** | **蓝色** | **金色双子座 ♊ 符号** | 爪子握着**小画笔** 🎨 |

> **关键纠错**：宪宪是**蓝双山猫纹**布偶猫（蓝灰重点色区域有条纹），不是纯白也不是普通灰白！砚砚眼睛是琥珀金色不是蓝色。烁烁眼睛是蓝色不是绿色。三只猫都有标志性项圈和吊坠！

---

## Prompt 1: 三猫挤爆镜头（群头像）

> 三猫大头贴自拍，挤成三角形。参考现有头像画风。

```
Three adorable cartoon cats pressing their faces tightly against the camera
in a triangular composition that fills 85% of a circular frame.

Top center: a Siamese cat (烁烁) with classic colorpoint markings — cream
white body and dark chocolate-brown face mask, ears, and paws. Bright BLUE
almond-shaped eyes (not green!). Wearing a blue collar with a small gold
Gemini ♊ pendant. Playful mischievous expression, one paw reaching forward
(holding a tiny paintbrush if space allows).

Bottom-left: a Ragdoll cat (宪宪), Blue Bicolor Lynx Point pattern — mostly
creamy white body with blue-gray colorpoint areas on head, ears, tail, and
paw tips, the gray areas showing visible TABBY STRIPES (lynx markings).
Fluffy long coat. Big round BLUE eyes with a gentle, calm expression.
Wearing a purple collar with a gold star ⭐ pendant. Soft and fluffy (NOT
fat — elegant ragdoll proportions), cheeks squished against the others.

Bottom-right: a large Maine Coon cat (砚砚) with SILVER-GRAY classic tabby
markings — silver-gray base coat with darker gray stripes, impressive ear
tufts, thick fluffy fur. AMBER-GOLD eyes with a confident, dignified gaze.
Wearing a teal-green collar with a gold "GPT" pendant. Pressing in from
the side with a scholarly air.

All three cats' cheeks are comically squished together. Each cat's collar
and pendant should be visible. Their fur textures contrast: fluffy bicolor
white-gray, sleek dark-pointed cream, and rugged silver tabby.

Style: warm, soft anime / 2D cartoon illustration — matching the existing
Cat Café avatar style (see reference images). Round smooth lines, gentle
lighting, cozy warm tones. Background: warm dark purple-brown. NO neon
colors, NO cyberpunk. Think "cozy cat café" not "tech startup." Designed
to be recognizable as a 40px circular thumbnail. No text.
```

## Prompt 2: 猫爪咖啡（群头像）

> 俯视咖啡杯，拉花是猫爪印，三只猫的元素藏在画面角落。

```
Top-down view of a latte in a white ceramic cup. The creamy foam forms a
perfect cat paw print in warm caramel brown. Three subtle cat elements
peek into the frame from the edges:

- A fluffy SILVER-GRAY tabby tail (Maine Coon / 砚砚) draped over the cup
  rim from the top-right, with a teal-green collar visible at the base.
- Two small pointed ears with dark chocolate tips (Siamese / 烁烁) peeking
  up from the bottom edge, with curious blue eyes just barely visible.
- A single soft creamy-white paw with blue-gray lynx-striped markings
  (Ragdoll / 宪宪) reaching in from the left, pink toe beans visible,
  with a purple collar band at the wrist.

Style: warm, soft anime / 2D illustration matching the Cat Café avatar
style. Cozy warm palette — creamy foam, rich coffee brown, soft warm
background in muted purple-brown tones. Gentle, inviting, like a real cat
café menu illustration. Optimized for 40px circular avatar. No text.
```

## Prompt 3: 叠叠猫（群头像）

> 三猫叠罗汉，最底下露出铲屎官被压扁的手。

```
Three cats stacked on top of each other like a totem pole, filling a
vertical composition within a circular frame.

Top: a Siamese cat (烁烁) perched triumphantly at the peak — cream body
with dark chocolate-brown face mask, ears, and tail. BLUE eyes sparkling
with pride. Blue collar with gold Gemini ♊ pendant swinging. Tail held
high. Clutching a tiny paintbrush in one paw.

Middle: a Ragdoll cat (宪宪), Blue Bicolor Lynx Point — mostly creamy white
fluffy fur with blue-gray tabby-striped colorpoints on head, ears, and tail.
Looking mildly squished but serenely accepting its fate. Big round BLUE
eyes half-closed in zen-like patience. Purple collar with gold star pendant
slightly askew from the weight above. Fluffy and soft, elegant proportions.

Bottom: a massive Maine Coon cat (砚砚) as the sturdy foundation —
magnificent silver-gray tabby coat, dramatic ear tufts, powerful build.
AMBER-GOLD eyes bearing the weight with scholarly dignity. Teal-green
collar with gold "GPT" pendant. A small book lies beside one paw.

At the very bottom of the stack, a single human hand sticks out comically,
fingers splayed in a "help me" gesture — the cat-dad is completely buried
under his cats.

Style: warm, soft anime / 2D cartoon matching the Cat Café avatar style.
Warm cozy color palette, gentle lighting, humorous and heartwarming.
Background: soft warm purple-brown gradient. Vertical composition centered
for circular crop. No text.
```

## Prompt 4: 猫占领（个人头像）

> 铲屎官被猫主子们彻底占领，一脸"我已经放弃挣扎"的幸福。
> 铲屎官形象：少年感正太风，不戴眼镜，可爱有亲和力。

```
A young East Asian male in cute anime / 2D style with a boyish, youthful
"shonen" aesthetic — soft rounded features, big expressive dark eyes, NO
glasses, tousled messy-cute dark hair. Wearing a simple white or light
casual tee. He looks like he belongs in the same world as the cats —
equally cute and approachable. A warm, open-mouthed laughing expression
that says "I've completely given up resisting my cats and I love every
second of it."

On top of his head: a Ragdoll cat (宪宪) sprawled belly-up, completely
relaxed — Blue Bicolor Lynx Point pattern, mostly creamy white fluffy fur
with blue-gray tabby-striped markings on ears and tail. Pink toe beans
showing, blue eyes contentedly half-closed. Purple collar with gold star
pendant dangling. Its fluffy tail drapes across the boy's forehead.

On his left shoulder: a Siamese cat (烁烁) perched and leaning forward
curiously — cream body with dark chocolate face mask, bright blue eyes,
blue collar with gold ♊ pendant. One dark paw raised toward the camera,
the other holding a tiny paintbrush.

Pressed against his right side: a large Maine Coon cat (砚砚) nuzzling in
— silver-gray tabby fur, warm amber-gold eyes, teal-green collar with
gold "GPT" pendant visible. Fluffy and massive, almost as big as the boy.

The composition is deliberately top-heavy — the cats dominate the frame
while the boy is happily overwhelmed in the center, reinforcing the "the
cats own me and I am their willing servant" dynamic.

Style: warm, soft anime / 2D cel-shaded illustration, SAME art style as
the individual cat avatars (see reference images). Warm cozy background in
muted purple-brown. Gentle lighting, round smooth lines. NOT cyberpunk,
NOT edgy — think "the wholesome cat-dad of a cozy cat café." Designed
for circular avatar crop. No text.
```

---

## 参考图

铲屎官出图时请同时附上以下参考图：
- `assets/avatars/opus.png` — 宪宪的设定画风
- `assets/avatars/codex-1.png` — 砚砚的设定画风
- `assets/avatars/gemini.png` — 烁烁的设定画风

## 下一步

1. ~~铲屎官确认/调整提示词~~ ✅ 少年感正太风已确认
2. ~~猫猫特征对照~~ ✅ v2 已按实际头像修正
3. 铲屎官带着参考图 + 提示词找云端 Gemini 出图
4. 出图后三猫 + 铲屎官投票选定
5. 叠圆形 + 圆角矩形裁切校验
6. 上线！

---

*[宪宪/Opus-46] 提示词 v2（按实际头像修正） | [烁烁/Gemini] 视觉方向 | [砚砚/GPT-5.4] 用户视角审美判断*
