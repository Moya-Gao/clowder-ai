---
title: 三猫设定图 Prompt & Roll Plan
doc_kind: prompt-plan
created: 2026-06-21
status: draft
author: 宪宪/claude-opus-4-6
related_docs:
  - character-bible-v0.1.md
  - prompt-book-v0.1.md
  - episode-brief.md
  - assets/README.md
---

# 三猫设定图 Prompt & Roll Plan

> 本文件是 character-bible-v0.1.md 的执行层：把 bible 的规则变成可以直接喂给生成工具的 prompt。
> 先出三只猫的角色设定图（design sheet），再用设定图作为 EP01 关键帧重抽和 F229 PetSkin 刷新的锚。

## 0. 通用规则

### 风格靶向

**不是纯 chibi，是已验收首帧的风格折中**（暖调动漫 + chibi 表情夸张 + 粗描边）。证据：Wave V 全部首帧已过 CVO 验收，它们的风格 = 我们的事实标准。

### 母图纪律

每个 prompt 必须附两组四格漫画作为参考输入。

### 固定前置（Global Prefix）

贴在每个 prompt 最前面：

```text
[REFERENCE IMAGES ATTACHED: Two Cat Cafe comic panels — these are the CANONICAL mother images.
Preserve the exact same warm cat-cafe anime style with chibi expressiveness, thick outline weight,
warm color palette, soft lighting, and expressive comedy. Match the style of the attached keyframe
examples. Do NOT make the cats realistic or photorealistic. Do NOT redesign the characters.]
```

### 命令式连续性指令（Global Imperatives）

```text
[CONTINUITY IMPERATIVES — MUST be enforced in EVERY generation:]
- ALL cats must maintain their identifying features across ALL poses/expressions.
- Background must be a CLEAN, FLAT light color (cream/warm white). No baked-in scene.
- NO Chinese text baked into the image. NO UI elements. NO speech bubbles.
- Character proportions must be CONSISTENT across the entire design sheet.
```

### Roll 纪律

- 每个 prompt 最多 3 roll
- 3 roll 同类失败 → 改 prompt，不无限抽
- 判定 checklist = bible §3 的"判定"列

---

## 1. 砚砚/醋醋喵 设定图

### Per-character Imperatives

```text
[CHARACTER IMPERATIVES — Yanyan/Cucu:]
- CRITICAL: Yanyan MUST be the LARGEST cat. Noticeably bigger and fluffier than any other cat.
- CRITICAL: Silver tabby Maine Coon pattern — silver-gray base with darker tabby stripes. NOT plain gray.
- CRITICAL: Stern/serious default expression. Even in "embarrassed" state, the sternness is the base layer.
- The "流程即正义" desk sign and I❤CI mug are character props — include them as small icons
  in the prop reference area, NOT in the character poses.
```

### Prompt Body

```text
Create a CHARACTER DESIGN SHEET for Yanyan (砚砚), also known as "Cucu" (醋醋喵).
He is the same large, fluffy silver tabby Maine Coon engineering cat from the reference comics.

Layout: one row of poses, one row of expressions, one small prop reference area.

POSES (top row, 3 poses):
1. Front-facing full body, standing upright, arms slightly crossed, stern look — the "default Yanyan"
2. Side profile (3/4 view), one paw raised pointing at something, slight lean forward — "explaining mode"
3. Back view showing the fluffy tail and broad shoulders — size reference silhouette

EXPRESSIONS (middle row, 4 heads):
1. STERN — default, slight frown, "I'm being professional" face
2. JEALOUS-BUT-DENYING — mouth slightly open protesting, single sweat drop, eyes averted
3. EMBARRASSED — ears flattened, eyes squeezed shut, heavy blush through fur, multiple sweat drops
4. QUIETLY HAPPY — tiny smile trying not to show it, eyes softened, tail tip curled up (shown small)

PROP REFERENCE (bottom strip):
- "流程即正义" wooden desk sign (show the Chinese text clearly)
- Purple "I ❤ CI" mug
- A small keyboard with paw prints on keys

Keep flat warm-cream background. No scene. No text labels except the desk sign prop.
```

### Acceptance Gate

| Check | Pass | Fail |
|---|---|---|
| 跟漫画母图里的砚砚是同一只猫？ | 一眼认出 | 变普通灰猫/变真实猫 |
| 体型明显大？ | 蓬松壮硕 | 跟普通猫一样大 |
| 虎斑纹路？ | 银底+深色条纹清晰 | 纯灰无纹/纹路消失 |
| 嘴硬性格？ | 即使笑也带倔 | 纯甜纯萌 |
| 风格跟首帧一致？ | 暖调动漫+chibi 表情 | 半写实/3D/纯扁平 |

---

## 2. 宪宪 设定图

### Per-character Imperatives

```text
[CHARACTER IMPERATIVES — Xianxian:]
- CRITICAL: Blue bicolor ragdoll cat with lynx-point (山猫纹) markings. NOT a pure white cat.
- CRITICAL: White mittens (gloves) on all four paws — this is the most recognizable feature.
- CRITICAL: Purple collar with a GOLD pendant/charm — clearly visible in front-facing poses.
- CRITICAL: Rounder, softer body shape than Yanyan. Xianxian is fluffy but SHORTER and CHUBBIER.
- Expression baseline: eager, curious, warm. The "new cat who wants to come in" energy.
```

### Prompt Body

```text
Create a CHARACTER DESIGN SHEET for Xianxian (宪宪), a blue bicolor ragdoll cat with lynx-point markings.
She is the same ragdoll cat from the reference comics — the new arrival standing at the cafe entrance.

Layout: one row of poses, one row of expressions, one small accessory reference area.

POSES (top row, 3 poses):
1. Front-facing full body, sitting with paws together, head slightly tilted, wearing purple collar with gold pendant — the "can I come in?" pose
2. Side profile (3/4 view), one white-mittened paw raised as if waving or reaching — "hello!" gesture
3. Curled up cozy pose, tail wrapped around body, peaceful — "settling in" mood

EXPRESSIONS (middle row, 4 heads):
1. EAGER — big blue eyes wide open, ears perked forward, slight head tilt, "I want to come in!"
2. THINKING — one paw on chin, eyes looking up, contemplative but cute
3. SURPRISED — ears up, eyes wide, small "o" mouth, whiskers spread
4. CONTENT — eyes half-closed in happy crescents, tiny smile, pure warmth

ACCESSORY REFERENCE (bottom strip):
- Purple collar with gold pendant/charm (show pendant detail)
- White mitten paws (show the clean white-to-color transition)
- A small golden key or bell charm

Keep flat warm-cream background. No scene. No text labels.
```

### Acceptance Gate

| Check | Pass | Fail |
|---|---|---|
| 布偶猫山猫纹？ | 蓝双色+lynx markings 清晰 | 纯白/纹路消失/变暹罗 |
| 白手套？ | 四爪白色，过渡自然 | 全白腿/无手套 |
| 紫项圈金吊坠？ | 清晰可见 | 缺项圈/吊坠变书本 |
| 体型比砚砚小？ | 矮胖蓬松 | 跟砚砚一样大或更大 |
| 风格一致？ | 暖调动漫+chibi 表情 | 半写实/3D |

---

## 3. 烁烁 设定图

### Per-character Imperatives

```text
[CHARACTER IMPERATIVES — Shuoshuo:]
- CRITICAL: Siamese cat with classic seal-point markings — cream body, dark brown/seal face mask, ears, paws, tail.
- CRITICAL: Elegant and poised posture. Shuoshuo is the AESTHETIC judge — his body language is graceful, never clumsy.
- CRITICAL: Shuoshuo carries a clipboard/preview board as his signature prop. It's always held properly, never tossed aside.
- CRITICAL: Shuoshuo is a MALE cat. Use "he/him." Do NOT feminize the design.
- CRITICAL: Shuoshuo does NOT write code. His role is visual/aesthetic review. Props should reflect taste (夹板/色卡/预览板), NOT engineering (no keyboard/terminal).
```

### Prompt Body

```text
Create a CHARACTER DESIGN SHEET for Shuoshuo (烁烁), a male Siamese cat who serves as the visual/aesthetic reviewer.
He is the same elegant Siamese cat from the reference comics — the one with the clipboard doing "愿景守护" (vision guard review).

Layout: one row of poses, one row of expressions, one small prop reference area.

POSES (top row, 3 poses):
1. Front-facing full body, standing tall and poised, holding a clipboard at chest level, looking directly at viewer with evaluating gaze — the "I'm inspecting your work" pose
2. Side profile (3/4 view), leaning slightly to look at a preview board/screen, one paw pointing — "assessing" mode
3. Walking pose, elegant stride, clipboard tucked under one arm, tail held high — "arriving to review"

EXPRESSIONS (middle row, 4 heads):
1. EVALUATING — one eye slightly narrowed, head tilted, "hmm, let me see" look
2. APPROVED — dignified nod, small satisfied smile, "视觉 OK，批准通过" face
3. SKEPTICAL — both eyes narrowed, whiskers pulled back slightly, "this doesn't meet standards"
4. ELEGANT SURPRISE — ears perked, one eyebrow raised, refined "oh?" expression

PROP REFERENCE (bottom strip):
- Wooden clipboard with a checklist
- Purple collar (simpler than Xianxian's, no pendant)
- A small color swatch card fanned out

Keep flat warm-cream background. No scene. No text labels.
```

### Acceptance Gate

| Check | Pass | Fail |
|---|---|---|
| 暹罗面具纹？ | 奶油底+深褐面具/耳/爪/尾 清晰 | 变黑猫/无面具/纯白 |
| 优雅姿态？ | 站姿挺拔，举止讲究 | 邋遢/笨拙/蜷缩 |
| 夹板/验收道具？ | clipboard 可见且正经 | 拿键盘/拿代码/无道具 |
| 公猫？ | 线条利落不柔媚 | 过度魔法少女化/蝴蝶结 |
| 风格一致？ | 跟砚砚/宪宪同一风格频谱 | 风格跳跃 |

---

## 4. 生成路由

历史工作流是 CVO 带 prompt 去云端砚砚（GPT 系）生成。如果 CVO 想继续这样，直接拿上面的 prompt + 附上母图×2 + 已验收首帧 1-2 张作为风格参考即可。

如果要尝试本地生成路由（孟加拉猫 image-gen / anime-forge skill），需要确认哪只猫在线+有图片生成能力。

**不管哪条路线，每个 roll 结果必须回来过 Acceptance Gate 再入库。**

---

## 5. Roll 后的下一步

设定图入库后：

1. 用设定图作为后续 EP01 关键帧重抽的角色参考（替代从零写 prompt）
2. F229 PetSkin 升级：从设定图切 atlas/sprite
3. character-bible 升级 v0.2：补入设定图路径 + 基于实际 roll 经验修正的规则

---

*[宪宪/claude-opus-4-6🐾]*
